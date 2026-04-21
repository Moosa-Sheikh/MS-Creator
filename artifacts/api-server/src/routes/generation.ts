import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, falModelsTable, settingsTable } from "@workspace/db";
import {
  GenerateImagesParams,
  GenerateImagesBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
router.use(requireAuth);

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Convert a stored object path (e.g. "/objects/abc123") to a full public URL
 * so fal.io can download it. Falls back to base64 data URI if domain unknown.
 */
async function objectPathToPublicUrl(
  objectPath: string,
  storageService: ObjectStorageService,
  log: { warn: (obj: unknown, msg?: string) => void }
): Promise<string> {
  // If it already looks like a URL, return as-is
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) {
    return objectPath;
  }

  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) {
    // Build the public URL through the API server (no auth required on /storage/objects/*)
    const cleanPath = objectPath.replace(/^\/objects\//, "");
    return `https://${domain}/api/storage/objects/${cleanPath}`;
  }

  // Fallback: base64-encode the image so fal.io can receive it inline
  log.warn({ objectPath }, "REPLIT_DEV_DOMAIN not set — falling back to base64 for fal.io");
  try {
    const file = await storageService.getObjectEntityFile(objectPath);
    const response = await storageService.downloadObject(file);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch {
    log.warn({ objectPath }, "Could not download image for base64 fallback");
    return objectPath;
  }
}

// ── Image URL extraction ──────────────────────────────────────────────────────

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

// ── fal.io queue polling ──────────────────────────────────────────────────────

/**
 * Derive the queue namespace from the model endpoint URL.
 * fal.io queue status/result endpoints use the first 2 path segments.
 * e.g. https://queue.fal.run/fal-ai/bytedance/seedream/v4/edit → fal-ai/bytedance
 */
function deriveQueueNamespace(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const parts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
    // Use first 2 segments (owner/app) as queue namespace
    return parts.slice(0, 2).join("/");
  } catch {
    return "";
  }
}

interface QueueSubmitResponse {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  [key: string]: unknown;
}

async function pollFalQueue(
  submitResponse: QueueSubmitResponse,
  endpoint: string,
  falApiKey: string,
  timeoutSecs: number,
  log: { error: (obj: unknown, msg?: string) => void }
): Promise<unknown> {
  const requestId = submitResponse.request_id;
  if (!requestId) throw new Error("fal.io response missing request_id");

  // Use URLs from the submit response if available; otherwise derive from endpoint
  const queueNs = deriveQueueNamespace(endpoint);
  const statusUrl = submitResponse.status_url
    ?? `https://queue.fal.run/${queueNs}/requests/${requestId}/status`;
  const resultUrl = submitResponse.response_url
    ?? `https://queue.fal.run/${queueNs}/requests/${requestId}`;

  const pollInterval = 3000; // 3 seconds between polls
  const maxAttempts = Math.ceil((timeoutSecs * 1000) / pollInterval);
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, pollInterval));
    attempts++;

    let statusData: { status?: string; error?: string };
    try {
      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Key ${falApiKey}` },
      });
      if (!statusRes.ok) {
        log.error({ statusCode: statusRes.status }, "fal.io queue status check failed");
        continue;
      }
      statusData = (await statusRes.json()) as { status?: string; error?: string };
    } catch (fetchErr) {
      log.error({ err: fetchErr }, "fal.io status fetch error");
      continue;
    }

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${falApiKey}` },
      });
      if (!resultRes.ok) throw new Error(`fal.io result fetch failed: ${resultRes.status}`);
      return await resultRes.json();
    }

    if (statusData.status === "FAILED") {
      throw new Error(statusData.error || "fal.io generation failed");
    }
    // IN_QUEUE or IN_PROGRESS → keep polling
  }

  throw new Error(`fal.io generation timed out after ${timeoutSecs}s`);
}

// ── Single image generation ───────────────────────────────────────────────────

async function generateSingleImage(
  prompt: string,
  falModel: { endpoint: string; defaultValues: unknown; paramsSchema: unknown },
  session: {
    productImageUrls?: string[] | null;
  },
  userParams: Record<string, unknown>,
  falApiKey: string,
  timeoutSecs: number,
  storageService: ObjectStorageService,
  log: { error: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void }
): Promise<string[]> {
  // Build the image_urls array — only product photos go to fal.io.
  // The reference image stays on the LLM side only (used for style analysis, not passed to the edit model).
  const imageUrls: string[] = [];
  for (const p of session.productImageUrls ?? []) {
    const url = await objectPathToPublicUrl(p, storageService, log);
    imageUrls.push(url);
  }

  const requestBody: Record<string, unknown> = {
    ...(falModel.defaultValues as Record<string, unknown>),
    ...userParams,
    prompt,
  };

  // Always pass image_urls if we have product images
  if (imageUrls.length > 0) {
    requestBody.image_urls = imageUrls;
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
    throw new Error(`fal.io API error ${response.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await response.json()) as QueueSubmitResponse;

  // Queue-based API (has request_id) → poll for result
  if (data.request_id) {
    const queueResult = await pollFalQueue(data, falModel.endpoint, falApiKey, timeoutSecs, log);
    return extractImageUrls(queueResult);
  }

  // Sync API (result returned immediately)
  return extractImageUrls(data);
}

// ── Route ─────────────────────────────────────────────────────────────────────

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
    res.status(400).json({ error: "Session has no prompt yet. Complete the Q&A phase first." });
    return;
  }

  const [falModel] = await db.select().from(falModelsTable).where(eq(falModelsTable.id, parsed.data.falModelId));
  if (!falModel) {
    res.status(404).json({ error: "fal.io model not found" });
    return;
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings?.falApiKey) {
    res.status(400).json({ error: "fal.io API key not configured. Please add it in Settings → Image Generation." });
    return;
  }

  const timeoutSecs = settings.falPollingTimeoutSecs ?? 60;

  const storageService = new ObjectStorageService();

  // For M2 sessions, use per-image variation prompts if available
  const variationPrompts = (session.variationPrompts ?? []) as string[];

  // ── Per-image regeneration (M2 only) ─────────────────────────────────────
  // When imageIndex is provided, only regenerate that one image — do not flip
  // the whole session to "generating" so other images remain visible.
  if (parsed.data.imageIndex != null && session.outputType === "M2") {
    const imageIndex = parsed.data.imageIndex;

    // Validate imageIndex: must be a non-negative integer within the existing image array
    const existingCount = ((session.generatedImageUrls ?? []) as string[]).length;
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= existingCount) {
      res.status(400).json({
        error: `imageIndex must be an integer between 0 and ${existingCount - 1} (got ${imageIndex})`,
      });
      return;
    }

    const imagePrompt = parsed.data.promptOverride ?? variationPrompts[imageIndex] ?? prompt;

    try {
      const urls = await generateSingleImage(
        imagePrompt,
        falModel,
        { productImageUrls: session.productImageUrls },
        (parsed.data.falParams ?? {}) as Record<string, unknown>,
        settings.falApiKey,
        timeoutSecs,
        storageService,
        req.log
      );

      const newUrl = urls[0];
      if (!newUrl) throw new Error("No image URL returned from fal.io");

      // Re-read the latest image URLs from DB right before writing to avoid
      // overwriting concurrent per-image regenerations on other indices.
      const [latestSession] = await db
        .select({ generatedImageUrls: sessionsTable.generatedImageUrls })
        .from(sessionsTable)
        .where(eq(sessionsTable.id, session.id));
      const latestUrls = ((latestSession?.generatedImageUrls ?? []) as string[]).slice();
      latestUrls[imageIndex] = newUrl;

      await db
        .update(sessionsTable)
        .set({ generatedImageUrls: latestUrls, status: "completed", updatedAt: new Date() })
        .where(eq(sessionsTable.id, session.id));

      res.json({ imageUrls: latestUrls, sessionId: session.id });
    } catch (err: unknown) {
      req.log.error({ err, imageIndex }, "Per-image regeneration failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Regeneration failed" });
    }
    return;
  }

  // ── Full generation ───────────────────────────────────────────────────────
  await db
    .update(sessionsTable)
    .set({ status: "generating", falModelId: parsed.data.falModelId, falParams: parsed.data.falParams ?? {}, updatedAt: new Date() })
    .where(eq(sessionsTable.id, session.id));

  const imageCount = session.outputType === "M2" ? (parsed.data.imageCount ?? session.imageCount ?? 2) : 1;
  const allImageUrls: string[] = [];
  const errors: string[] = [];

  try {
    for (let i = 0; i < imageCount; i++) {
      // Use variation prompt for this specific image index if available
      const imagePrompt = (session.outputType === "M2" && variationPrompts[i])
        ? variationPrompts[i]
        : prompt;

      try {
        const urls = await generateSingleImage(
          imagePrompt,
          falModel,
          { productImageUrls: session.productImageUrls },
          (parsed.data.falParams ?? {}) as Record<string, unknown>,
          settings.falApiKey,
          timeoutSecs,
          storageService,
          req.log
        );
        allImageUrls.push(...urls);
      } catch (imgErr: unknown) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        req.log.error({ err: msg, imageIndex: i }, "Image generation failed");
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
