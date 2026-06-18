/**
 * Drizzle schema — mirrors the reference DDL in docs/03-api-et-data-model.md.
 *
 * IDs are application-generated, prefixed TEXT keys (wk_, mdl_, jb_, ...), not
 * serials, so they are stable and human-recognizable across services.
 *
 * Money columns are NUMERIC(12,6). We keep them as strings in JS (Drizzle's
 * default for numeric) and let Postgres do the SUM for balances, so credits
 * stay exact (no float drift).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const workers = pgTable("workers", {
  id: text("id").primaryKey(),
  devicePubkey: text("device_pubkey").notNull(),
  platform: text("platform").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  modelCaps: jsonb("model_caps").notNull().default(sql`'[]'::jsonb`),
  reputation: real("reputation").notNull().default(1.0),
  // Linked chatbot account (set when the worker signs in with email).
  userId: text("user_id"),
  // Device model label (e.g. "iPhone15,3") for the admin compute estimate.
  deviceModel: text("device_model"),
  // Updated on every authenticated call — used to tell who is "online".
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const models = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  downloadUrl: text("download_url").notNull(),
  quant: text("quant").notNull(),
  sizeMb: integer("size_mb").notNull(),
  creditRate: numeric("credit_rate", { precision: 12, scale: 6 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

// status: queued | assigned | done | failed
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    prompt: text("prompt").notNull(),
    params: jsonb("params").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("queued"),
    assignedWorkerId: text("assigned_worker_id").references(() => workers.id),
    // Set when a chatbot user's message created this job (so we can charge them
    // and deliver the answer back). Null for canaries and admin-submitted jobs.
    requesterUserId: text("requester_user_id"),
    // Conversation this job answers (for chat delivery). Null for non-chat jobs.
    conversationId: text("conversation_id"),
    isCanary: boolean("is_canary").notNull().default(false),
    canaryExpected: text("canary_expected"),
    redundancyGroup: text("redundancy_group"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deadline: timestamp("deadline", { withTimezone: true }),
  },
  (t) => [index("idx_jobs_dispatch").on(t.status, t.modelId)],
);

export const jobResults = pgTable("job_results", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  output: text("output").notNull(),
  latencyMs: integer("latency_ms"),
  accepted: boolean("accepted").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

// type: earn | payout | adjust
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    workerId: text("worker_id")
      .notNull()
      .references(() => workers.id),
    amount: numeric("amount", { precision: 12, scale: 6 }).notNull(), // + earn, - payout
    type: text("type").notNull(),
    jobId: text("job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ledger_worker").on(t.workerId)],
);

// --- Chatbot web app (requester side) ---

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// User credit ledger (USD). Balance = SUM(amount). Signup inserts a +grant.
// type: grant | spend | adjust
export const userLedgerEntries = pgTable(
  "user_ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    amount: numeric("amount", { precision: 14, scale: 6 }).notNull(), // + grant, - spend
    type: text("type").notNull(),
    jobId: text("job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_user_ledger_user").on(t.userId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull().default("New chat"),
    modelId: text("model_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_conversations_user").on(t.userId)],
);

// role: user | assistant
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    jobId: text("job_id"),
    costUsd: numeric("cost_usd", { precision: 14, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_messages_conversation").on(t.conversationId)],
);

// User-created API keys (for external apps / OpenAI-compatible clients).
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull().default("API key"),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(), // shown in the dashboard, e.g. sk-nvp-ab12cd…
    revoked: boolean("revoked").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_api_keys_user").on(t.userId)],
);

// status: requested | approved | paid | rejected
export const payouts = pgTable("payouts", {
  id: text("id").primaryKey(),
  workerId: text("worker_id")
    .notNull()
    .references(() => workers.id),
  amount: numeric("amount", { precision: 12, scale: 6 }).notNull(),
  status: text("status").notNull().default("requested"),
  method: text("method").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
