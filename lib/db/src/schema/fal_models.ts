import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const falModelsTable = pgTable("fal_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull(),
  curlCommand: text("curl_command").notNull(),
  paramsSchema: jsonb("params_schema").notNull().default({}),
  defaultValues: jsonb("default_values").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFalModelSchema = createInsertSchema(falModelsTable).omit({ id: true, createdAt: true });
export type InsertFalModel = z.infer<typeof insertFalModelSchema>;
export type FalModel = typeof falModelsTable.$inferSelect;
