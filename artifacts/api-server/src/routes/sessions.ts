import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, llmConfigsTable } from "@workspace/db";
import {
  CreateSessionBody,
  UpdateSessionBody,
  GetSessionParams,
  UpdateSessionParams,
  DeleteSessionParams,
  ListSessionsQueryParams,
  AnalyzeReferenceImageParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { callActiveLlm, extractJson } from "../lib/llm";
import { ObjectStorageService } from "../lib/objectStorage";
import sharp from "sharp";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/sessions", async (req, res): Promise<void> => {
  const query = ListSessionsQueryParams.safeParse(req.query);
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(
      query.success && query.data.productId
        ? eq(sessionsTable.productId, query.data.productId)
        : undefined
    )
    .orderBy(sessionsTable.createdAt);
  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db.insert(sessionsTable).values({
    productId: parsed.data.productId,
    optionType: parsed.data.optionType,
    outputType: parsed.data.outputType,
    imageCount: parsed.data.imageCount ?? null,
    referenceStyle: parsed.data.referenceStyle ?? null,
    similarityLevel: parsed.data.similarityLevel ?? null,
    productImageUrls: parsed.data.productImageUrls,
    referenceImageUrl: parsed.data.referenceImageUrl ?? null,
    templateInspirationId: parsed.data.templateInspirationId ?? null,
    status: "draft",
  }).returning();
  res.status(201).json(session);
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.optionType !== undefined) updateData.optionType = parsed.data.optionType;
  if (parsed.data.outputType !== undefined) updateData.outputType = parsed.data.outputType;
  if (parsed.data.imageCount !== undefined) updateData.imageCount = parsed.data.imageCount;
  if (parsed.data.referenceStyle !== undefined) updateData.referenceStyle = parsed.data.referenceStyle;
  if (parsed.data.similarityLevel !== undefined) updateData.similarityLevel = parsed.data.similarityLevel;
  if (parsed.data.productImageUrls !== undefined) updateData.productImageUrls = parsed.data.productImageUrls;
  if (parsed.data.referenceImageUrl !== undefined) updateData.referenceImageUrl = parsed.data.referenceImageUrl;
  if (parsed.data.qaAnswers !== undefined) updateData.qaAnswers = parsed.data.qaAnswers;
  if (parsed.data.finalPrompt !== undefined) updateData.finalPrompt = parsed.data.finalPrompt;
  if (parsed.data.enhancedPrompt !== undefined) updateData.enhancedPrompt = parsed.data.enhancedPrompt;
  if (parsed.data.falModelId !== undefined) updateData.falModelId = parsed.data.falModelId;
  if (parsed.data.falParams !== undefined) updateData.falParams = parsed.data.falParams;
  if (parsed.data.generatedImageUrls !== undefined) updateData.generatedImageUrls = parsed.data.generatedImageUrls;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.flowId !== undefined) updateData.flowId = parsed.data.flowId;
  if (parsed.data.templateInspirationId !== undefined) updateData.templateInspirationId = parsed.data.templateInspirationId;

  const [session] = await db
    .update(sessionsTable)
    .set(updateData)
    .where(eq(sessionsTable.id, params.data.id))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/sessions/:id/analyze-reference", async (req, res): Promise<void> => {
  const params = AnalyzeReferenceImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (!session.referenceImageUrl) {
    res.status(400).json({ error: "Session has no reference image" });
    return;
  }

  // Check that the active model supports vision before proceeding
  const [activeConfig] = await db.select().from(llmConfigsTable).where(eq(llmConfigsTable.isActive, true)).limit(1);
  if (!activeConfig) {
    res.status(400).json({ error: "No AI model configured. Go to Settings → Language Models and add a model." });
    return;
  }
  if (!activeConfig.supportsVision) {
    res.status(400).json({
      error: `"${activeConfig.name}" does not support image analysis. Enable "Supports vision" for this model in Settings → Language Models, or switch to a vision-capable model.`,
    });
    return;
  }

  try {
    // Step 1: Downloading image
    await db.update(sessionsTable)
      .set({ status: "analyzing_image", updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    const storageService = new ObjectStorageService();
    let imageContent: { type: string; image_url?: { url: string }; text?: string };
    try {
      const file = await storageService.getObjectEntityFile(session.referenceImageUrl);
      const [buffer] = await file.download();
      // Resize to max 1024px on longest side to stay well within token limits
      const resized = await sharp(buffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      const base64 = resized.toString("base64");
      imageContent = { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } };
    } catch {
      imageContent = { type: "image_url", image_url: { url: session.referenceImageUrl } };
    }

    // Step 2: AI analyzing image
    await db.update(sessionsTable)
      .set({ status: "analyzing_vision", updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    const rawAnalysis = await callActiveLlm([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert Etsy product mockup analyst. Analyze this reference mockup image and extract the key visual characteristics.

Return ONLY valid JSON with these exact keys (no markdown, no explanation):
{
  "background": "description of the background setting, colors, materials, environment",
  "lighting": "lighting style, direction, warmth, quality",
  "placement": "how the product is placed, angle, composition",
  "props": "any props, accessories, or additional elements in the scene",
  "mood": "overall mood and aesthetic style",
  "photography_style": "photography style (lifestyle/flat lay/close-up/studio/etc.)",
  "additional_notes": "any other notable visual characteristics worth capturing"
}`,
          },
          imageContent as { type: string; [key: string]: unknown },
        ],
      },
    ]);

    // Parse JSON — fall back to storing raw text if parsing fails
    let analysisData: Record<string, string>;
    try {
      analysisData = JSON.parse(extractJson(rawAnalysis));
    } catch {
      analysisData = { additional_notes: rawAnalysis };
    }

    await db
      .update(sessionsTable)
      .set({ referenceAnalysis: JSON.stringify(analysisData), status: "qa", updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    res.json({ analysis: analysisData, sessionId: session.id });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to analyze reference image");
    const errMsg = err instanceof Error ? err.message : "Failed to analyze image";
    await db
      .update(sessionsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));
    res.status(500).json({ error: errMsg });
  }
});

export default router;
