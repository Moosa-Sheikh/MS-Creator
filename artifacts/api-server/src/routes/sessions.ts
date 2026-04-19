import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
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
import { callActiveLlm } from "../lib/llm";

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

  try {
    const analysis = await callActiveLlm([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this product mockup reference image for an Etsy seller. Extract and describe in detail:
1. Background setting and environment
2. Lighting style (direction, quality, mood)
3. Product placement and composition
4. Props and styling elements
5. Overall mood and aesthetic
6. Photography style
7. Color palette

Be specific and visual. This will be used to help recreate or draw inspiration from this mockup style.`,
          },
          {
            type: "image_url",
            image_url: { url: session.referenceImageUrl },
          },
        ],
      },
    ]);

    await db
      .update(sessionsTable)
      .set({ referenceAnalysis: analysis, updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    res.json({ analysis, sessionId: session.id });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to analyze reference image");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to analyze image" });
  }
});

export default router;
