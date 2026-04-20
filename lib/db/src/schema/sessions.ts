import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(),
  optionType: text("option_type"), // "A" or "B"
  outputType: text("output_type"), // "M1" or "M2"
  imageCount: integer("image_count"), // For M2: 2-8
  referenceStyle: text("reference_style"), // "SAME" or "IDEA" (Option B only)
  similarityLevel: integer("similarity_level"), // 1-100 for SAME mode
  productImageUrls: text("product_image_urls").array().notNull().default([]),
  referenceImageUrl: text("reference_image_url"),
  referenceAnalysis: text("reference_analysis"),
  qaAnswers: jsonb("qa_answers").notNull().default([]),
  finalPrompt: text("final_prompt"),
  enhancedPrompt: text("enhanced_prompt"),
  falModelId: uuid("fal_model_id"),
  falParams: jsonb("fal_params").notNull().default({}),
  generatedImageUrls: text("generated_image_urls").array().notNull().default([]),
  status: text("status").notNull().default("draft"), // draft | prompt_ready | generating | completed | failed
  flowId: text("flow_id"), // F1-F6 — computed from optionType + referenceStyle + templateInspirationId
  templateInspirationId: uuid("template_inspiration_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
