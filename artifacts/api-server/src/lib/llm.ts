import { db } from "@workspace/db";
import { llmConfigsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

export async function callActiveLlm(messages: LlmMessage[]): Promise<string> {
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) throw new Error("No settings found. Please configure API keys in Settings.");

  const [activeConfig] = await db
    .select()
    .from(llmConfigsTable)
    .where(eq(llmConfigsTable.isActive, true))
    .limit(1);

  if (!activeConfig) {
    throw new Error("No active LLM config found. Please configure an LLM in Settings.");
  }

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
