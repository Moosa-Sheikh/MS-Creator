import { pgTable, text, serial, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  falApiKey: text("fal_api_key"),
  openrouterApiKey: text("openrouter_api_key"),
  claudeApiKey: text("claude_api_key"),
  openaiApiKey: text("openai_api_key"),
  googleApiKey: text("google_api_key"),
  claudeEnabled: boolean("claude_enabled").notNull().default(false),
  flowSystemPrompts: jsonb("flow_system_prompts").$type<Record<string, string>>().default({}),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
