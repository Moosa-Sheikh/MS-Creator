import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, templatesTable, productsTable, settingsTable } from "@workspace/db";
import {
  GetNextQuestionParams,
  SubmitAnswerParams,
  SubmitAnswerBody,
  EnhancePromptParams,
  RevisePromptParams,
  RevisePromptBody,
  RewritePromptParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { callActiveLlm, extractJson } from "../lib/llm";
import { DEFAULT_FLOW_PROMPTS, FLOWS, type FlowId } from "../lib/flows";

const router: IRouter = Router();
router.use(requireAuth);

type QAAnswer = { question: string; answer: string; questionIndex: number };

router.post("/sessions/:id/qa/next-question", async (req, res): Promise<void> => {
  const params = GetNextQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, session.productId));
  const qaAnswers = (session.qaAnswers as QAAnswer[]) || [];
  const questionIndex = qaAnswers.length;

  let templateContext = "";
  if (session.templateInspirationId) {
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, session.templateInspirationId));
    if (template) {
      const tplConfig = (template.sessionConfig as { qaAnswers?: QAAnswer[] }) ?? {};
      const tplQA = tplConfig.qaAnswers ?? [];
      const tplQASummary = tplQA.length
        ? tplQA.map((a) => `  Q: ${a.question}\n  A: ${a.answer}`).join("\n")
        : "";
      templateContext = `
TEMPLATE INSPIRATION — User chose to base this session on a saved template:
Template name: "${template.name}"
Template's proven prompt: "${template.prompt}"
${tplQASummary ? `Q&A answers that led to this template:\n${tplQASummary}\n` : ""}`;
    }
  }

  const [settingsRow] = await db.select().from(settingsTable).limit(1);
  const savedPrompts = (settingsRow?.flowSystemPrompts ?? {}) as Record<string, string>;
  const flowId = (session.flowId as FlowId | null) ?? "F5";
  const systemPrompt = savedPrompts[flowId] || DEFAULT_FLOW_PROMPTS[flowId] || DEFAULT_FLOW_PROMPTS["F5"];

  // Format reference analysis as readable sections (not raw JSON string)
  let referenceSection = "";
  if (session.referenceAnalysis) {
    try {
      const ra = JSON.parse(session.referenceAnalysis) as Record<string, string>;
      const labelMap: Record<string, string> = {
        background: "Background / Setting",
        lighting: "Lighting",
        placement: "Product Placement & Composition",
        props: "Props & Accessories",
        mood: "Mood & Aesthetic",
        photography_style: "Photography Style",
        additional_notes: "Additional Notes",
      };
      const lines = Object.entries(ra)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `  • ${labelMap[k] ?? k}: ${v}`);
      if (lines.length > 0) {
        referenceSection = `\n━━━ REFERENCE IMAGE ANALYSIS (USE THIS AS SPECIFICATION) ━━━\n${lines.join("\n")}`;
        if (session.similarityLevel != null) {
          referenceSection += `\n  • Similarity target: ${session.similarityLevel}/100 (${session.similarityLevel >= 70 ? "high fidelity — replicate closely" : session.similarityLevel >= 40 ? "moderate — adapt meaningfully" : "loose — use as broad inspiration"})`;
        }
      }
    } catch {
      referenceSection = `\nReference image analysis: ${session.referenceAnalysis}`;
    }
  }

  const userPrompt = `━━━ PRODUCT ━━━
Name: ${product?.name ?? "Unknown"}
Description: ${product?.description ?? "(no description provided)"}
Flow: ${flowId} — ${FLOWS[flowId]?.name ?? flowId}
Output: ${session.outputType}${session.outputType === "M2" ? ` (${session.imageCount} images — plan variation across them)` : ""}
${session.referenceStyle ? `Reference style: ${session.referenceStyle}` : ""}${referenceSection}
${templateContext ? `\n━━━ TEMPLATE CONTEXT ━━━\n${templateContext}` : ""}
━━━ Q&A HISTORY (${questionIndex} questions so far) ━━━
${questionIndex === 0 ? "(No questions asked yet — this is the first question)" : qaAnswers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join("\n\n")}

━━━ INSTRUCTION ━━━
${questionIndex >= 6 ? "You have gathered substantial information. Generate the final prompt now if you have enough clarity, or ask one last targeted question about a gap that remains." : `Ask question #${questionIndex + 1}. Use the reference analysis and product context above to make this question SPECIFIC to this product and situation — not generic.`}`;

  try {
    const rawResponse = await callActiveLlm([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const parsed = JSON.parse(extractJson(rawResponse)) as {
      done: boolean;
      question?: string;
      options?: Array<{ label: string; description: string }>;
      aiSuggestion?: string;
      questionIndex?: number;
      finalPrompt?: string;
    };

    if (parsed.done && parsed.finalPrompt) {
      await db
        .update(sessionsTable)
        .set({ finalPrompt: parsed.finalPrompt, status: "prompt_ready", updatedAt: new Date() })
        .where(eq(sessionsTable.id, session.id));
    }

    res.json({ ...parsed, systemPrompt });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get next question");
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

router.post("/sessions/:id/qa/answer", async (req, res): Promise<void> => {
  const params = SubmitAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const existing = (session.qaAnswers as QAAnswer[]) || [];
  const updated = [...existing, { question: parsed.data.question, answer: parsed.data.answer, questionIndex: parsed.data.questionIndex }];

  const [updatedSession] = await db
    .update(sessionsTable)
    .set({ qaAnswers: updated, updatedAt: new Date() })
    .where(eq(sessionsTable.id, session.id))
    .returning();
  res.json(updatedSession);
});

router.post("/sessions/:id/prompt/enhance", async (req, res): Promise<void> => {
  const params = EnhancePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const prompt = session.enhancedPrompt || session.finalPrompt;
  if (!prompt) {
    res.status(400).json({ error: "No prompt to enhance" });
    return;
  }

  try {
    const response = await callActiveLlm([
      {
        role: "user",
        content: `You are an expert AI image prompt engineer. Analyze this image generation prompt and find vague, non-visual words that should be replaced with specific, detailed descriptions.

Prompt: "${prompt}"

Find words/phrases like "beautiful", "cozy", "stylish", "nice", "good", "professional", "elegant", etc. and suggest specific visual replacements.

Return JSON:
{
  "suggestions": [
    {
      "original": "exact text to replace",
      "replacement": "specific visual description",
      "reason": "why this is better"
    }
  ]
}

Only include 3-6 most impactful suggestions. Return [] if the prompt is already specific enough.`,
      },
    ]);

    const parsed = JSON.parse(extractJson(response)) as { suggestions: Array<{ original: string; replacement: string; reason: string }> };
    res.json(parsed);
  } catch (err: unknown) {
    req.log.error({ err }, "Enhance prompt error");
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

router.post("/sessions/:id/prompt/revise", async (req, res): Promise<void> => {
  const params = RevisePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RevisePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const prompt = session.enhancedPrompt || session.finalPrompt;
  if (!prompt) {
    res.status(400).json({ error: "No prompt to revise" });
    return;
  }

  try {
    const response = await callActiveLlm([
      {
        role: "user",
        content: `You are an expert AI image prompt engineer for Etsy product mockups.

Current prompt: "${prompt}"

User instruction: "${parsed.data.instruction}"

Revise ONLY the relevant part of the prompt based on the instruction. Keep everything else the same. Return the full revised prompt.

Return JSON: { "prompt": "..." }`,
      },
    ]);
    const result = JSON.parse(extractJson(response)) as { prompt: string };
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Revise prompt error");
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

router.post("/sessions/:id/prompt/rewrite", async (req, res): Promise<void> => {
  const params = RewritePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, session.productId));
  const qaAnswers = (session.qaAnswers as QAAnswer[]) || [];

  try {
    const response = await callActiveLlm([
      {
        role: "user",
        content: `You are an expert Etsy mockup photographer and AI image prompt engineer.

Write a completely new, detailed image generation prompt for this product mockup.

Product: ${product?.name ?? "Unknown"} — ${product?.description ?? ""}
Option: ${session.optionType}
Output: ${session.outputType}${session.optionType === "B" && session.referenceAnalysis ? `\nReference analysis: ${session.referenceAnalysis}` : ""}

Q&A context:
${qaAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}

Write a comprehensive, highly visual prompt that an AI image model can use to generate a stunning Etsy mockup photo. Be specific about lighting, composition, background, mood, style, and visual details.

Return JSON: { "prompt": "..." }`,
      },
    ]);
    const result = JSON.parse(extractJson(response)) as { prompt: string };
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Rewrite prompt error");
    res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
  }
});

export default router;
