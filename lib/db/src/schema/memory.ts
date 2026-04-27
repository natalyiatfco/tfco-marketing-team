import { pgTable, text, serial, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";
import { tasksTable } from "./tasks";
import { reviewsTable } from "./reviews";

export const MEMORY_TYPES = [
  "brand_voice_sample",
  "rejection_reason",
  "campaign_entry",
  "content_entry",
  "seo_keyword",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const memoryEntriesTable = pgTable("memory_entries", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => propertiesTable.id, { onDelete: "cascade" }),
  agentRole: text("agent_role"),
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  sourceTaskId: integer("source_task_id").references(() => tasksTable.id, {
    onDelete: "set null",
  }),
  sourceReviewId: integer("source_review_id").references(() => reviewsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memoryEmbeddingsTable = pgTable(
  "memory_embeddings",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => memoryEntriesTable.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    model: text("model").notNull().default("text-embedding-3-small"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memory_embeddings_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type MemoryEntry = typeof memoryEntriesTable.$inferSelect;
export type InsertMemoryEntry = typeof memoryEntriesTable.$inferInsert;
export type MemoryEmbedding = typeof memoryEmbeddingsTable.$inferSelect;
