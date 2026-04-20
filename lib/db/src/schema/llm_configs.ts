import { pgTable, text, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const llmConfigsTable = pgTable("llm_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // "openrouter" | "anthropic" | "openai" | "google"
  modelId: text("model_id").notNull(),
  endpoint: text("endpoint"),
  systemPrompt: text("system_prompt"),
  curlCommand: text("curl_command"),
  paramsSchema: jsonb("params_schema").notNull().default({}),
  defaultValues: jsonb("default_values").notNull().default({}),
  isActive: boolean("is_active").notNull().default(false),
  supportsVision: boolean("supports_vision").notNull().default(false),
  supportsThinking: boolean("supports_thinking").notNull().default(false),
  isFree: boolean("is_free").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLlmConfigSchema = createInsertSchema(llmConfigsTable).omit({ id: true, createdAt: true });
export type InsertLlmConfig = z.infer<typeof insertLlmConfigSchema>;
export type LlmConfig = typeof llmConfigsTable.$inferSelect;
