import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { llmConfigsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

export const BUILTIN_MODELS = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Balanced — recommended for most uses" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Fastest — ideal for quick responses" },
] as const;

export function isBuiltinAvailable(): boolean {
  return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}

async function callBuiltinAnthropic(messages: LlmMessage[], modelId: string): Promise<string> {
  const client = new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });

  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const systemContent = systemMessages.map((m) => String(m.content)).join("\n");

  logger.info({ model: modelId }, "Calling built-in Anthropic");

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    ...(systemContent ? { system: systemContent } : {}),
    messages: chatMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  throw new Error("Unexpected Anthropic response format");
}

async function ensureBuiltinConfig(): Promise<typeof import("@workspace/db").llmConfigsTable.$inferSelect | null> {
  if (!isBuiltinAvailable()) return null;
  const defaultModelId = BUILTIN_MODELS[0].id;
  const defaultModelName = BUILTIN_MODELS[0].name;
  // Deactivate all and create/activate the default built-in config
  await db.update(llmConfigsTable).set({ isActive: false });
  const [existing] = await db.select().from(llmConfigsTable).where(eq(llmConfigsTable.modelId, defaultModelId));
  if (existing && existing.provider === "replit-anthropic") {
    const [activated] = await db.update(llmConfigsTable).set({ isActive: true }).where(eq(llmConfigsTable.id, existing.id)).returning();
    return activated ?? null;
  }
  const [created] = await db.insert(llmConfigsTable).values({
    name: `${defaultModelName} (Built-in)`,
    provider: "replit-anthropic",
    modelId: defaultModelId,
    endpoint: "built-in",
    curlCommand: "built-in",
    paramsSchema: {},
    defaultValues: {},
    isActive: true,
  }).returning();
  return created ?? null;
}

export async function callActiveLlm(messages: LlmMessage[]): Promise<string> {
  let [activeConfig] = await db
    .select()
    .from(llmConfigsTable)
    .where(eq(llmConfigsTable.isActive, true))
    .limit(1);

  // No active config — auto-activate the built-in model if available
  if (!activeConfig) {
    if (isBuiltinAvailable()) {
      logger.info("No active LLM config, auto-activating built-in model");
      activeConfig = (await ensureBuiltinConfig())!;
    }
    if (!activeConfig) {
      throw new Error("No AI model configured. Please add an LLM in Settings to continue.");
    }
  }

  // Built-in Anthropic path (no API key needed from user)
  if (activeConfig.provider === "replit-anthropic") {
    if (!isBuiltinAvailable()) {
      throw new Error("Built-in AI integration is not available. Please contact support.");
    }
    const systemPrompt = activeConfig.systemPrompt;
    const fullMessages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...messages]
      : messages;
    return callBuiltinAnthropic(fullMessages, activeConfig.modelId);
  }

  // Manual API key path (OpenRouter / Claude direct)
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) throw new Error("No settings found. Please configure API keys in Settings.");

  const isClaudeActive = settings.claudeEnabled && settings.claudeApiKey;
  const apiKey = isClaudeActive ? settings.claudeApiKey : settings.openrouterApiKey;

  if (!apiKey) {
    throw new Error("No API key configured. Please add your API key in Settings.");
  }

  const systemPrompt = activeConfig.systemPrompt;
  const fullMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const params = {
    ...(activeConfig.defaultValues as Record<string, unknown>),
    model: activeConfig.modelId,
    messages: fullMessages,
  };

  logger.info({ endpoint: activeConfig.endpoint, model: activeConfig.modelId }, "Calling LLM");

  const response = await fetch(activeConfig.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(activeConfig.provider === "anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message: { content: string } }>;
    content?: Array<{ text: string }>;
  };

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (data.content?.[0]?.text) {
    return data.content[0].text;
  }

  throw new Error("Unexpected LLM response format");
}
