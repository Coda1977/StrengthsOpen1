import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { randomUUID } from "crypto";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Onboarding and strengths data
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  topStrengths: jsonb("top_strengths").$type<string[]>(),
  
  // Admin functionality
  isAdmin: boolean("is_admin").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team members table
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    // Always use Node.js crypto for server-side UUID generation
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      // If crypto.randomUUID is not available, use crypto.randomBytes for secure generation
      try {
        const crypto = require('crypto');
        const bytes = crypto.randomBytes(16);
        // Format as UUID v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant bits
        const hex = bytes.toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      } catch (cryptoError) {
        // Absolute fallback - throw error rather than use weak generation
        throw new Error('Cryptographically secure UUID generation is not available. Cannot create team member ID.');
      }
    }
  }),
  managerId: varchar("manager_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  name: varchar("name").notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_team_members_manager_id").on(table.managerId),
]);

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  mode: text("mode", { enum: ["personal", "team"] }).notNull().default("personal"),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
  metadata: jsonb("metadata"),
}, (table) => [
  index("IDX_conversations_user_id").on(table.userId),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  type: text("type", { enum: ["user", "ai"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("IDX_messages_conversation_id").on(table.conversationId),
]);

export const conversationBackups = pgTable("conversation_backups", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => {
    try {
      const crypto = require('crypto');
      return crypto.randomUUID();
    } catch (e) {
      const crypto = require('crypto');
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }),
  userId: varchar("user_id").notNull(),
  backupData: jsonb("backup_data").notNull(),
  source: text("source", { enum: ["localStorage", "manual", "automatic"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  restoredAt: timestamp("restored_at"),
});

// Email tracking tables
export const emailSubscriptions = pgTable("email_subscriptions", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  emailType: text("email_type", { enum: ["welcome", "weekly_coaching"] }).notNull(),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date").defaultNow(),
  timezone: varchar("timezone").default("America/New_York"), // User's timezone for scheduling
  weeklyEmailCount: text("weekly_email_count").default("0"), // Track how many weekly emails sent (max 12)
  nextScheduledTime: timestamp("next_scheduled_time"), // When the next email should be sent
  lastSentAt: timestamp("last_sent_at"), // When the last email was sent
  lastEmailDate: timestamp("last_email_date", { mode: "date" }), // Track the date of last email sent (for daily limits)
  // New fields for email variety tracking
  previousOpeners: jsonb("previous_openers").$type<string[]>().default([]), // Track last 4 opener patterns
  previousTeamMembers: jsonb("previous_team_members").$type<string[]>().default([]), // Track last 4 team members featured
  previousPersonalTips: jsonb("previous_personal_tips").$type<string[]>().default([]), // Track last 4 personal tips
  previousSubjectPatterns: jsonb("previous_subject_patterns").$type<string[]>().default([]), // Track last 4 subject line patterns
  previousQuoteSources: jsonb("previous_quote_sources").$type<string[]>().default([]), // Track last 4 quote source types
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_email_subscriptions_user_id").on(table.userId),
]);

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  emailType: text("email_type", { enum: ["welcome", "weekly_coaching"] }).notNull(),
  emailSubject: text("email_subject").notNull(),
  weekNumber: text("week_number"), // For weekly emails: "1", "2", etc.
  resendId: varchar("resend_id"), // ID from Resend API
  status: text("status", { enum: ["sent", "failed", "pending", "retry"] }).notNull(),
  retryCount: text("retry_count").default("0"), // Track retry attempts
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_email_logs_user_id").on(table.userId),
]);

// New table for email metrics
export const emailMetrics = pgTable("email_metrics", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  date: timestamp("date").defaultNow(),
  totalAttempted: text("total_attempted").default("0"),
  succeeded: text("succeeded").default("0"),
  failed: text("failed").default("0"),
  timezoneBreakdown: jsonb("timezone_breakdown").$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// OpenAI usage logs table
export const openaiUsageLogs = pgTable("openai_usage_logs", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  requestType: text("request_type").notNull(), // 'insight', 'coaching_response', 'collaboration_insight', 'email_content'
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Unsubscribe tokens table for secure email unsubscription
export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  token: varchar("token").notNull(),
  emailType: text("email_type", { enum: ["welcome", "weekly_coaching", "all"] }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserOnboardingSchema = createInsertSchema(users).pick({
  hasCompletedOnboarding: true,
  topStrengths: true,
  firstName: true,
  lastName: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).pick({
  managerId: true,
  name: true,
  strengths: true,
}).extend({
  // Ensure ID is optional since it will be generated securely
  id: z.string().uuid().optional(),
});

export const updateTeamMemberSchema = createInsertSchema(teamMembers).pick({
  name: true,
  strengths: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  mode: true,
  metadata: true,
});

export const updateConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  mode: true,
  lastActivity: true,
  isArchived: true,
  metadata: true,
}).partial();

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  content: true,
  type: true,
  metadata: true,
});

export const insertConversationBackupSchema = createInsertSchema(conversationBackups).pick({
  backupData: true,
  source: true,
});

export const insertEmailSubscriptionSchema = createInsertSchema(emailSubscriptions).pick({
  userId: true,
  emailType: true,
  timezone: true,
});

export const updateEmailSubscriptionSchema = createInsertSchema(emailSubscriptions).pick({
  isActive: true,
  timezone: true,
  weeklyEmailCount: true,
}).partial();

export const insertEmailLogSchema = createInsertSchema(emailLogs).pick({
  userId: true,
  emailType: true,
  emailSubject: true,
  weekNumber: true,
  resendId: true,
  status: true,
  errorMessage: true,
});

export const insertUnsubscribeTokenSchema = createInsertSchema(unsubscribeTokens).pick({
  userId: true,
  token: true,
  emailType: true,
});

export const updateUnsubscribeTokenSchema = createInsertSchema(unsubscribeTokens).pick({
  usedAt: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserOnboarding = z.infer<typeof updateUserOnboardingSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ConversationBackup = typeof conversationBackups.$inferSelect;
export type InsertConversationBackup = z.infer<typeof insertConversationBackupSchema>;
export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type InsertEmailSubscription = z.infer<typeof insertEmailSubscriptionSchema>;
export type UpdateEmailSubscription = z.infer<typeof updateEmailSubscriptionSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type UnsubscribeToken = typeof unsubscribeTokens.$inferSelect;
export type InsertUnsubscribeToken = z.infer<typeof insertUnsubscribeTokenSchema>;
export type UpdateUnsubscribeToken = z.infer<typeof updateUnsubscribeTokenSchema>;
