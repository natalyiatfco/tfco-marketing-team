import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";
import { propertiesTable } from "./properties";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
  title: text("title").notNull(),
  inputPrompt: text("input_prompt").notNull(),
  output: text("output"),
  status: text("status").notNull().default("pending"),
  publishStatus: text("publish_status"),
  publishUrl: text("publish_url"),
  publishPlatform: text("publish_platform"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  output: true,
  status: true,
  publishStatus: true,
  publishUrl: true,
  publishPlatform: true,
  publishedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
