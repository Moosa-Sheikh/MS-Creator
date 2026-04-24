import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { db } from "@workspace/db";
import { llmConfigsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type ContentPart = { type: string; [key: string]: unknown };

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

type Settings = typeof settingsTable.$inferSelect;
type LlmConfig = typeof llmConfigsTable.$inferSelect;

/** Extract text-only content for providers that don't support vision in this path */
function contentAsString(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text")
    .map((p) => (p.text as string) ?? "")
    .join("\n");
}

function systemContent(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => contentAsString(m.content))
    .join("\n");
}

/**
 * Returns chat messages preserving array content for vision-capable providers.
 * OpenAI/OpenRouter format: content can be string or ContentPart[]
 */
function chatMessagesRaw(messages: LlmMessage[]): Array<{ role: "user" | "assistant"; content: string | ContentPart[] }> {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

/**
 * Convert OpenAI-style vision content parts to Anthropic content blocks.
 * OpenAI image_url with data URI → Anthropic base64 image block.
 */
function toAnthropicContent(content: string | ContentPart[]): Anthropic.MessageParam["content"] {
  if (typeof content === "string") return content;
  return content.map((part): Anthropic.ContentBlockParam => {
    if (part.type === "image_url") {
      const imageUrl = (part.image_url as { url: string }).url;
      if (imageUrl.startsWith("data:")) {
        const [header, data] = imageUrl.split(",");
        const mediaType = header.replace("data:", "").replace(";base64", "") as Anthropic.Base64ImageSource["media_type"];
        return { type: "image", source: { type: "base64", media_type: mediaType, data } };
      }
      // URL-based image
      return { type: "image", source: { type: "url", url: imageUrl } as Anthropic.URLImageSource };
    }
    return { type: "text", text: contentAsString([part]) };
  });
}

/**
 * Convert OpenAI-style vision content parts to Google Generative AI parts.
 */
function toGoogleParts(content: string | ContentPart[]): Part[] {
  if (typeof content === "string") return [{ text: content }];
  return content.flatMap((part): Part[] => {
    if (part.type === "image_url") {
      const imageUrl = (part.image_url as { url: string }).url;
      if (imageUrl.startsWith("data:")) {
        const [header, data] = imageUrl.split(",");
        const mimeType = header.replace("data:", "").replace(";base64", "");
        return [{ inlineData: { mimeType, data } }];
      }
      // External URL — pass as text fallback (Google doesn't natively support arbitrary image URLs in all contexts)
      return [{ text: `[image: ${imageUrl}]` }];
    }
    return [{ text: contentAsString([part]) }];
  });
}

async function callOpenRouter(messages: LlmMessage[], config: LlmConfig, settings: Settings): Promise<string> {
  const apiKey = config.apiKey || settings.openrouterApiKey;
  if (!apiKey) throw new Error("OpenRouter API key not set. Add it in Settings → API Keys or on the model config.");
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
  const sys = systemContent(messages);
  const rawMessages = chatMessagesRaw(messages);
  // OpenRouter uses OpenAI-compatible format — content arrays are supported natively
  const allMessages = [
    ...(sys ? [{ role: "system" as const, content: sys }] : []),
    ...rawMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      // OpenAI SDK accepts content as string | Array<ChatCompletionContentPart>
      content: m.content as string,
    })),
  ] as OpenAI.Chat.ChatCompletionMessageParam[];
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
  const anthropicMessages: Anthropic.MessageParam[] = chatMessagesRaw(messages).map((m) => ({
    role: m.role,
    content: toAnthropicContent(m.content),
  }));
  const res = await client.messages.create({
    model: config.modelId,
    max_tokens: 8192,
    ...(sys ? { system: sys } : {}),
    messages: anthropicMessages,
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
  const rawMessages = chatMessagesRaw(messages);
  const allMessages = [
    ...(sys ? [{ role: "system" as const, content: sys }] : []),
    ...rawMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
  ] as OpenAI.Chat.ChatCompletionMessageParam[];
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
  const rawMessages = chatMessagesRaw(messages);
  logger.info({ model: config.modelId }, "Calling Google Gemini");

  const history = rawMessages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toGoogleParts(m.content),
  }));
  const lastMessage = rawMessages[rawMessages.length - 1];
  const lastParts = lastMessage ? toGoogleParts(lastMessage.content) : [{ text: "" }];

  const chatSession = model.startChat({
    history,
    ...(sys ? { systemInstruction: sys } : {}),
  });
  const res = await chatSession.sendMessage(lastParts);
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

/** Retry a transient-error-prone async call with exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      // Only retry on transient network errors (ECONNRESET, ECONNREFUSED, ETIMEDOUT, fetch aborts)
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|terminated|network|fetch failed|socket hang up/i.test(msg);
      if (!isTransient || attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      logger.warn({ attempt, delay, err }, `LLM call failed with transient error, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
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

  const callProvider = () => {
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
  };

  return withRetry(callProvider);
}
