import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { llmConfigsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

type Settings = typeof settingsTable.$inferSelect;
type LlmConfig = typeof llmConfigsTable.$inferSelect;

function textContent(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n");
}

function systemContent(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n");
}

function chatMessages(messages: LlmMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
}

async function callOpenRouter(messages: LlmMessage[], config: LlmConfig, settings: Settings): Promise<string> {
  const apiKey = config.apiKey || settings.openrouterApiKey;
  if (!apiKey) throw new Error("OpenRouter API key not set. Add it in Settings → API Keys or on the model config.");
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
  const sys = systemContent(messages);
  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(sys ? [{ role: "system" as const, content: sys }] : []),
    ...chatMessages(messages).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
  logger.info({ model: config.modelId }, "Calling OpenRouter");
  const res = await client.chat.completions.create({
    model: config.modelId,
    messages: allMessages,
    ...(config.defaultValues as object),
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenRouter");
  return text;
}

async function callAnthropic(messages: LlmMessage[], config: LlmConfig, settings: Settings): Promise<string> {
  const apiKey = config.apiKey || settings.claudeApiKey;
  if (!apiKey) throw new Error("Anthropic API key not set. Add it in Settings → API Keys or on the model config.");
  const client = new Anthropic({ apiKey });
  const sys = systemContent(messages);
  logger.info({ model: config.modelId }, "Calling Anthropic");
  const res = await client.messages.create({
    model: config.modelId,
    max_tokens: 8192,
    ...(sys ? { system: sys } : {}),
    messages: chatMessages(messages),
  });
  const block = res.content[0];
  if (block.type === "text") return block.text;
  throw new Error("Unexpected Anthropic response format");
}

async function callOpenAI(messages: LlmMessage[], config: LlmConfig, settings: Settings): Promise<string> {
  const apiKey = config.apiKey || settings.openaiApiKey;
  if (!apiKey) throw new Error("OpenAI API key not set. Add it in Settings → API Keys or on the model config.");
  const client = new OpenAI({ apiKey });
  const sys = systemContent(messages);
  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(sys ? [{ role: "system" as const, content: sys }] : []),
    ...chatMessages(messages).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
  logger.info({ model: config.modelId }, "Calling OpenAI");
  const res = await client.chat.completions.create({
    model: config.modelId,
    messages: allMessages,
    ...(config.defaultValues as object),
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

async function callGoogle(messages: LlmMessage[], config: LlmConfig, settings: Settings): Promise<string> {
  const apiKey = config.apiKey || settings.googleApiKey;
  if (!apiKey) throw new Error("Google AI API key not set. Add it in Settings → API Keys or on the model config.");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: config.modelId });
  const sys = systemContent(messages);
  const chat = chatMessages(messages);
  logger.info({ model: config.modelId }, "Calling Google Gemini");

  // For Google, send all messages in the chat format
  const history = chat.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = chat[chat.length - 1]?.content ?? "";

  const chatSession = model.startChat({
    history,
    ...(sys ? { systemInstruction: sys } : {}),
  });
  const res = await chatSession.sendMessage(lastMessage);
  return res.response.text();
}

/**
 * Strips <thinking> blocks (extended thinking models like claude-3.7-sonnet:thinking)
 * and markdown code fences, then extracts the first JSON object from the response.
 * Throws if no valid JSON object is found.
 */
export function extractJson(text: string): string {
  const cleaned = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/) ?? text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in LLM response");
  return match[0];
}

export async function callActiveLlm(messages: LlmMessage[]): Promise<string> {
  const [activeConfig] = await db
    .select()
    .from(llmConfigsTable)
    .where(eq(llmConfigsTable.isActive, true))
    .limit(1);

  if (!activeConfig) {
    throw new Error("No AI model configured. Go to Settings → Language Models and add a model.");
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) throw new Error("Settings not found. Please configure the app in Settings.");

  const sys = activeConfig.systemPrompt;
  const fullMessages: LlmMessage[] = sys
    ? [{ role: "system", content: sys }, ...messages]
    : messages;

  switch (activeConfig.provider) {
    case "openrouter":
      return callOpenRouter(fullMessages, activeConfig, settings);
    case "anthropic":
      return callAnthropic(fullMessages, activeConfig, settings);
    case "openai":
      return callOpenAI(fullMessages, activeConfig, settings);
    case "google":
      return callGoogle(fullMessages, activeConfig, settings);
    default:
      throw new Error(`Unknown provider: ${activeConfig.provider}`);
  }
}
