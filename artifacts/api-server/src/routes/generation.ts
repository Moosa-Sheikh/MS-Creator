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

function extractImageUrls(data: unknown): string[] {
  const r = data as Record<string, unknown>;
  if (r.images && Array.isArray(r.images)) {
    return (r.images as { url?: string }[]).map((img) => img.url ?? "").filter(Boolean);
  }
  if (r.image && typeof r.image === "object") {
    const url = (r.image as { url?: string }).url;
    return url ? [url] : [];
  }
  if (r.output) {
    if (Array.isArray(r.output)) {
      const first = r.output[0];
      if (typeof first === "string") return r.output as string[];
      if (typeof first === "object" && first !== null && "url" in first) {
        return (r.output as { url: string }[]).map((x) => x.url).filter(Boolean);
      }
    }
    if (typeof r.output === "object") {
      const out = r.output as Record<string, unknown>;
      if (out.images && Array.isArray(out.images)) {
        return (out.images as { url?: string }[]).map((img) => img.url ?? "").filter(Boolean);
      }
    }
  }
  return [];
}

async function pollFalQueue(
  requestId: string,
  endpoint: string,
  falApiKey: string,
  log: { error: (obj: unknown, msg?: string) => void }
): Promise<unknown> {
  let modelPath: string;
  try {
    const url = new URL(endpoint);
    modelPath = url.pathname.replace(/^\//, "");
  } catch {
    throw new Error(`Invalid fal.io endpoint URL: ${endpoint}`);
  }

  const statusUrl = `https://queue.fal.run/${modelPath}/requests/${requestId}`;
  const resultUrl = `https://queue.fal.run/${modelPath}/requests/${requestId}/response`;

  let attempts = 0;
  while (attempts < 150) {
    await new Promise((r) => setTimeout(r, 3000));
    attempts++;

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falApiKey}` },
    });

    if (!statusRes.ok) {
      log.error({ statusCode: statusRes.status }, "fal.io queue status check failed");
      continue;
    }

    const statusData = (await statusRes.json()) as { status?: string; error?: string };

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${falApiKey}` },
      });
      if (!resultRes.ok) throw new Error("Failed to fetch fal.io result after completion");
      return await resultRes.json();
    }

    if (statusData.status === "FAILED") {
      throw new Error(statusData.error || "fal.io generation failed");
    }
  }

  throw new Error("fal.io generation timed out after 7.5 minutes");
}

async function generateSingleImage(
  prompt: string,
  falModel: { endpoint: string; defaultValues: unknown; paramsSchema: unknown },
  session: { optionType?: string | null; referenceStyle?: string | null; referenceImageUrl?: string | null; similarityLevel?: number | null },
  userParams: Record<string, unknown>,
  falApiKey: string,
  log: { error: (obj: unknown, msg?: string) => void }
): Promise<string[]> {
  const requestBody: Record<string, unknown> = {
    ...(falModel.defaultValues as Record<string, unknown>),
    ...userParams,
    prompt,
  };

  if (session.optionType === "B" && session.referenceStyle === "SAME" && session.referenceImageUrl) {
    requestBody.image_url = session.referenceImageUrl;
    if (session.similarityLevel) {
      requestBody.strength = 1 - session.similarityLevel / 100;
    }
  }

  const response = await fetch(falModel.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`fal.io API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (data.request_id) {
    const queueResult = await pollFalQueue(String(data.request_id), falModel.endpoint, falApiKey, log);
    return extractImageUrls(queueResult);
  }

  return extractImageUrls(data);
}

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
  const errors: string[] = [];

  try {
    for (let i = 0; i < imageCount; i++) {
      try {
        const urls = await generateSingleImage(
          prompt,
          falModel,
          session,
          (parsed.data.falParams ?? {}) as Record<string, unknown>,
          settings.falApiKey,
          req.log
        );
        allImageUrls.push(...urls);
      } catch (imgErr: unknown) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        req.log.error({ err: msg, imageIndex: i }, "Image generation failed for one image");
        errors.push(msg);
      }
    }

    const finalStatus = allImageUrls.length > 0 ? "completed" : "failed";
    await db
      .update(sessionsTable)
      .set({ generatedImageUrls: allImageUrls, status: finalStatus, updatedAt: new Date() })
      .where(eq(sessionsTable.id, session.id));

    res.json({
      imageUrls: allImageUrls,
      sessionId: session.id,
      errors: errors.length ? errors : undefined,
    });
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
