import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, falModelsTable, settingsTable } from "@workspace/db";
import {
  GenerateImagesParams,
  GenerateImagesBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.post("/sessions/:id/generate", async (req, res): Promise<void> => {
  const params = GenerateImagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = GenerateImagesBody.safeParse(req.body);
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
    res.status(400).json({ error: "Session has no prompt to generate from" });
    return;
  }

  const [falModel] = await db.select().from(falModelsTable).where(eq(falModelsTable.id, parsed.data.falModelId));
  if (!falModel) {
    res.status(404).json({ error: "fal.io model not found" });
    return;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings?.falApiKey) {
    res.status(400).json({ error: "fal.io API key not configured. Please add it in Settings." });
    return;
  }

  await db
    .update(sessionsTable)
    .set({ status: "generating", falModelId: parsed.data.falModelId, falParams: parsed.data.falParams ?? {}, updatedAt: new Date() })
    .where(eq(sessionsTable.id, session.id));

  const imageCount = session.outputType === "M2" ? (parsed.data.imageCount ?? session.imageCount ?? 2) : 1;
  const allImageUrls: string[] = [];
  let hadError = false;

  try {
    for (let i = 0; i < imageCount; i++) {
      const requestBody: Record<string, unknown> = {
        ...(falModel.defaultValues as Record<string, unknown>),
        ...(parsed.data.falParams ?? {}),
        prompt,
      };

      if (session.optionType === "B" && session.referenceStyle === "SAME" && session.referenceImageUrl) {
        requestBody.image_url = session.referenceImageUrl;
        if (session.similarityLevel) {
          requestBody.strength = 1 - (session.similarityLevel / 100);
        }
      }

      const response = await fetch(falModel.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${settings.falApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.text();
        req.log.error({ err, imageIndex: i }, "fal.io API error");
        hadError = true;
        break;
      }

      const data = await response.json() as {
        images?: Array<{ url: string }>;
        image?: { url: string };
        output?: { images?: Array<{ url: string }> };
      };

      const imageUrl =
        data.images?.[0]?.url ||
        data.image?.url ||
        data.output?.images?.[0]?.url;

      if (imageUrl) {
        allImageUrls.push(imageUrl);
      }
    }

    const finalStatus = hadError && allImageUrls.length === 0 ? "failed" : "completed";
    const [updatedSession] = await db
      .update(sessionsTable)
      .set({
        generatedImageUrls: allImageUrls,
        status: finalStatus,
        updatedAt: new Date(),
      })
      .where(eq(sessionsTable.id, session.id))
      .returning();

    void updatedSession;
    res.json({ imageUrls: allImageUrls, sessionId: session.id });
  } catch (err: unknown) {
    req.log.error({ err }, "Generation failed");
    await db
      .update(sessionsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));
    res.status(500).json({ error: err instanceof Error ? err.message : "Generation failed" });
  }
});

export default router;
