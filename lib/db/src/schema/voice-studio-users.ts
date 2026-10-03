import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const voiceStudioUsersTable = pgTable("voice_studio_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("pending"),
  role: text("role").notNull().default("user"),
  tokenBalance: integer("token_balance").notNull().default(0),
  invitationId: text("invitation_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertVoiceStudioUserSchema = createInsertSchema(
  voiceStudioUsersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVoiceStudioUser = z.infer<typeof insertVoiceStudioUserSchema>;
export type VoiceStudioUser = typeof voiceStudioUsersTable.$inferSelect;