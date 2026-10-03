import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { voiceStudioUsersTable } from "./voice-studio-users";
import { z } from "zod/v4";

export const voiceStudioEventsTable = pgTable("voice_studio_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => voiceStudioUsersTable.id, {
    onDelete: "set null",
  }),
  actorClerkUserId: text("actor_clerk_user_id"),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  tokenDelta: integer("token_delta").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVoiceStudioEventSchema = createInsertSchema(
  voiceStudioEventsTable,
).omit({ id: true, createdAt: true });
export type InsertVoiceStudioEvent = z.infer<
  typeof insertVoiceStudioEventSchema
>;
export type VoiceStudioEvent = typeof voiceStudioEventsTable.$inferSelect;