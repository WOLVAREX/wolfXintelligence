import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modelsTable = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  modelId: text("model_id").notNull().unique(),
  category: text("category").notNull().default("chat"),
  description: text("description").notNull().default(""),
  contextLength: integer("context_length"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModelSchema = createInsertSchema(modelsTable).omit({ id: true, createdAt: true });
export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof modelsTable.$inferSelect;
