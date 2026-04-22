import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  brandVoice: text("brand_voice"),
  tone: text("tone"),
  targetAudience: text("target_audience"),
  primaryKeywords: text("primary_keywords"),
  websiteUrl: text("website_url"),
  instagramHandle: text("instagram_handle"),
  facebookHandle: text("facebook_handle"),
  twitterHandle: text("twitter_handle"),
  linkedinHandle: text("linkedin_handle"),
  wordpressUrl: text("wordpress_url"),
  wordpressUsername: text("wordpress_username"),
  wordpressAppPassword: text("wordpress_app_password"),
  squarespaceApiKey: text("squarespace_api_key"),
  squarespaceCollectionId: text("squarespace_collection_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
