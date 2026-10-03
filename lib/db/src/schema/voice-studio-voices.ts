import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { voiceStudioUsersTable } from "./voice-studio-users";
import { z } from "zod/v4";

export const voiceStudioVoicesTable = pgTable("voice_studio_voices", {
  voiceId: text("voice_id").primaryKey(),
  ownerId: uuid("owner_id").references(() => voiceStudioUsersTable.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("cloned"),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVoiceStudioVoiceSchema = createInsertSchema(
  voiceStudioVoicesTable,
).omit({ createdAt: true });
export type InsertVoiceStudioVoice = z.infer<
  typeof insertVoiceStudioVoiceSchema
>;
export type VoiceStudioVoice = typeof voiceStudioVoicesTable.$inferSelect;