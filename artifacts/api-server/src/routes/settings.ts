import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, falModelsTable, llmConfigsTable } from "@workspace/db";
import {
  UpdateSettingsBody,
  UpdateFalModelParams,
  UpdateFalModelBody,
  DeleteFalModelParams,
  CreateFalModelBody,
  CreateLlmConfigBody,
  UpdateLlmConfigParams,
  UpdateLlmConfigBody,
  DeleteLlmConfigParams,
  ActivateLlmConfigParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { parseCurlCommand, parseLlmCurlCommand, parseCurlForPreview } from "../lib/curlParser";
import { BUILTIN_MODELS, isBuiltinAvailable } from "../lib/llm";

const router: IRouter = Router();
router.use(requireAuth);

async function ensureSettings() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(settingsTable).values({ claudeEnabled: false });
    return (await db.select().from(settingsTable).limit(1))[0];
  }
  return existing[0];
}

router.get("/settings", async (req, res): Promise<void> => {
  const settings = await ensureSettings();
  if (!settings) {
    res.status(500).json({ error: "Failed to load settings" });
    return;
  }
  res.json({
    id: settings.id,
    falApiKeySet: !!settings.falApiKey,
    openrouterApiKeySet: !!settings.openrouterApiKey,
    claudeApiKeySet: !!settings.claudeApiKey,
    claudeEnabled: settings.claudeEnabled,
  });
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await ensureSettings();
  if (!settings) {
    res.status(500).json({ error: "Failed to load settings" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.falApiKey !== undefined) update.falApiKey = parsed.data.falApiKey || null;
  if (parsed.data.openrouterApiKey !== undefined) update.openrouterApiKey = parsed.data.openrouterApiKey || null;
  if (parsed.data.claudeApiKey !== undefined) update.claudeApiKey = parsed.data.claudeApiKey || null;
  if (parsed.data.claudeEnabled !== undefined) update.claudeEnabled = parsed.data.claudeEnabled;

  const [updated] = await db.update(settingsTable).set(update).where(eq(settingsTable.id, settings.id)).returning();
  res.json({
    id: updated.id,
    falApiKeySet: !!updated.falApiKey,
    openrouterApiKeySet: !!updated.openrouterApiKey,
    claudeApiKeySet: !!updated.claudeApiKey,
    claudeEnabled: updated.claudeEnabled,
  });
});

router.get("/fal-models", async (req, res): Promise<void> => {
  const models = await db.select().from(falModelsTable).orderBy(falModelsTable.createdAt);
  res.json(models);
});

router.post("/fal-models", async (req, res): Promise<void> => {
  const parsed = CreateFalModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { endpoint, paramsSchema, defaultValues: parsedDefaults } = parseCurlCommand(parsed.data.curlCommand);
    const rawBody = req.body as Record<string, unknown>;
    const defaultValues =
      rawBody.defaultValues && typeof rawBody.defaultValues === "object" && !Array.isArray(rawBody.defaultValues)
        ? (rawBody.defaultValues as Record<string, unknown>)
        : parsedDefaults;
    const [model] = await db.insert(falModelsTable).values({
      name: parsed.data.name,
      endpoint,
      curlCommand: parsed.data.curlCommand,
      paramsSchema,
      defaultValues,
    }).returning();
    res.status(201).json(model);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse curl command" });
  }
});

router.patch("/fal-models/:id", async (req, res): Promise<void> => {
  const params = UpdateFalModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFalModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.curlCommand) {
    try {
      const { endpoint, paramsSchema, defaultValues } = parseCurlCommand(parsed.data.curlCommand);
      update.curlCommand = parsed.data.curlCommand;
      update.endpoint = endpoint;
      update.paramsSchema = paramsSchema;
      update.defaultValues = defaultValues;
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse curl" });
      return;
    }
  }
  if (parsed.data.defaultValues) update.defaultValues = parsed.data.defaultValues;
  const [model] = await db.update(falModelsTable).set(update).where(eq(falModelsTable.id, params.data.id)).returning();
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json(model);
});

router.delete("/fal-models/:id", async (req, res): Promise<void> => {
  const params = DeleteFalModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(falModelsTable).where(eq(falModelsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/llm-configs", async (req, res): Promise<void> => {
  const configs = await db.select().from(llmConfigsTable).orderBy(llmConfigsTable.createdAt);
  res.json(configs);
});

router.post("/llm-configs", async (req, res): Promise<void> => {
  const parsed = CreateLlmConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { endpoint, paramsSchema, defaultValues: parsedDefaults, provider, modelId } = parseLlmCurlCommand(parsed.data.curlCommand);
    const rawBody = req.body as Record<string, unknown>;
    const defaultValues =
      rawBody.defaultValues && typeof rawBody.defaultValues === "object" && !Array.isArray(rawBody.defaultValues)
        ? (rawBody.defaultValues as Record<string, unknown>)
        : parsedDefaults;
    const [config] = await db.insert(llmConfigsTable).values({
      name: parsed.data.name,
      provider,
      modelId,
      endpoint,
      curlCommand: parsed.data.curlCommand,
      systemPrompt: parsed.data.systemPrompt ?? null,
      paramsSchema,
      defaultValues,
      isActive: false,
    }).returning();
    res.status(201).json(config);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse curl command" });
  }
});

router.patch("/llm-configs/:id", async (req, res): Promise<void> => {
  const params = UpdateLlmConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLlmConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.systemPrompt !== undefined) update.systemPrompt = parsed.data.systemPrompt;
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
  if (parsed.data.defaultValues) update.defaultValues = parsed.data.defaultValues;
  if (parsed.data.curlCommand) {
    try {
      const { endpoint, paramsSchema, defaultValues, provider, modelId } = parseLlmCurlCommand(parsed.data.curlCommand);
      update.curlCommand = parsed.data.curlCommand;
      update.endpoint = endpoint;
      update.paramsSchema = paramsSchema;
      update.defaultValues = defaultValues;
      update.provider = provider;
      update.modelId = modelId;
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse curl" });
      return;
    }
  }
  const [config] = await db.update(llmConfigsTable).set(update).where(eq(llmConfigsTable.id, params.data.id)).returning();
  if (!config) {
    res.status(404).json({ error: "Config not found" });
    return;
  }
  res.json(config);
});

router.delete("/llm-configs/:id", async (req, res): Promise<void> => {
  const params = DeleteLlmConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(llmConfigsTable).where(eq(llmConfigsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/llm-configs/builtin-status", async (_req, res): Promise<void> => {
  res.json({ available: isBuiltinAvailable(), models: BUILTIN_MODELS });
});

router.post("/llm-configs/setup-builtin", async (req, res): Promise<void> => {
  const { modelId } = req.body as { modelId?: string };
  if (!modelId || !BUILTIN_MODELS.find((m) => m.id === modelId)) {
    res.status(400).json({ error: "Invalid modelId" });
    return;
  }
  if (!isBuiltinAvailable()) {
    res.status(503).json({ error: "Built-in AI integration is not configured" });
    return;
  }
  const model = BUILTIN_MODELS.find((m) => m.id === modelId)!;
  // Deactivate all existing configs
  await db.update(llmConfigsTable).set({ isActive: false });
  // Find or create a built-in config for this modelId
  const [existing] = await db
    .select()
    .from(llmConfigsTable)
    .where(eq(llmConfigsTable.modelId, modelId));
  let config;
  if (existing && existing.provider === "replit-anthropic") {
    [config] = await db
      .update(llmConfigsTable)
      .set({ isActive: true })
      .where(eq(llmConfigsTable.id, existing.id))
      .returning();
  } else {
    [config] = await db
      .insert(llmConfigsTable)
      .values({
        name: `${model.name} (Built-in)`,
        provider: "replit-anthropic",
        modelId,
        endpoint: "built-in",
        curlCommand: "built-in",
        paramsSchema: {},
        defaultValues: {},
        isActive: true,
      })
      .returning();
  }
  res.json(config);
});

router.post("/parse-curl", async (req, res): Promise<void> => {
  const { curl, type } = req.body as { curl?: string; type?: string };
  if (!curl || typeof curl !== "string") {
    res.status(400).json({ error: "curl field is required" });
    return;
  }
  const modelType = type === "llm" ? "llm" : "fal";
  try {
    const result = parseCurlForPreview(curl, modelType);
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse curl command" });
  }
});

router.post("/llm-configs/:id/activate", async (req, res): Promise<void> => {
  const params = ActivateLlmConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(llmConfigsTable).set({ isActive: false });
  const [config] = await db
    .update(llmConfigsTable)
    .set({ isActive: true })
    .where(eq(llmConfigsTable.id, params.data.id))
    .returning();
  if (!config) {
    res.status(404).json({ error: "Config not found" });
    return;
  }
  res.json(config);
});

export default router;
