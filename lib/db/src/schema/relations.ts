import { relations } from "drizzle-orm";
import { propertiesTable } from "./properties";
import { agentsTable } from "./agents";
import { tasksTable } from "./tasks";
import { reviewsTable } from "./reviews";
import { schedulesTable } from "./schedules";
import { memoryEntriesTable, memoryEmbeddingsTable } from "./memory";

export const propertiesRelations = relations(propertiesTable, ({ many }) => ({
  tasks: many(tasksTable),
  schedules: many(schedulesTable),
  memoryEntries: many(memoryEntriesTable),
}));

export const agentsRelations = relations(agentsTable, ({ many }) => ({
  tasks: many(tasksTable),
  schedules: many(schedulesTable),
}));

export const tasksRelations = relations(tasksTable, ({ one, many }) => ({
  agent: one(agentsTable, { fields: [tasksTable.agentId], references: [agentsTable.id] }),
  property: one(propertiesTable, { fields: [tasksTable.propertyId], references: [propertiesTable.id] }),
  review: one(reviewsTable, { fields: [tasksTable.id], references: [reviewsTable.taskId] }),
  memoryEntries: many(memoryEntriesTable),
}));

export const reviewsRelations = relations(reviewsTable, ({ one, many }) => ({
  task: one(tasksTable, { fields: [reviewsTable.taskId], references: [tasksTable.id] }),
  memoryEntries: many(memoryEntriesTable),
}));

export const schedulesRelations = relations(schedulesTable, ({ one }) => ({
  agent: one(agentsTable, { fields: [schedulesTable.agentId], references: [agentsTable.id] }),
  property: one(propertiesTable, { fields: [schedulesTable.propertyId], references: [propertiesTable.id] }),
}));

export const memoryEntriesRelations = relations(memoryEntriesTable, ({ one, many }) => ({
  property: one(propertiesTable, {
    fields: [memoryEntriesTable.propertyId],
    references: [propertiesTable.id],
  }),
  sourceTask: one(tasksTable, {
    fields: [memoryEntriesTable.sourceTaskId],
    references: [tasksTable.id],
  }),
  sourceReview: one(reviewsTable, {
    fields: [memoryEntriesTable.sourceReviewId],
    references: [reviewsTable.id],
  }),
  embeddings: many(memoryEmbeddingsTable),
}));

export const memoryEmbeddingsRelations = relations(memoryEmbeddingsTable, ({ one }) => ({
  entry: one(memoryEntriesTable, {
    fields: [memoryEmbeddingsTable.entryId],
    references: [memoryEntriesTable.id],
  }),
}));
