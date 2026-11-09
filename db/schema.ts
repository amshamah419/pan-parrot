import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Application data for Netlify Database.
 * Table set replaces the previous Prisma models (users, endpoints,
 * captured requests) and adds sessions, sign-in challenges, and
 * rate-limit buckets. Netlify applies the SQL in
 * netlify/database/migrations on deploy.
 */
export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: roleEnum("role").notNull().default("USER"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
    lastLogin: timestamp("last_login", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check(
      "users_email_domain",
      sql`${table.email} ~ '^[^@]+@paloaltonetworks\\.com$'`,
    ),
  ],
);

export const endpoints = pgTable(
  "endpoints",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    url: text("url").notNull(),
    description: text("description"),
    ...timestamps,
    mockEnabled: boolean("mock_enabled").notNull().default(false),
    mockStatusCode: integer("mock_status_code"),
    mockHeaders: jsonb("mock_headers").$type<Record<string, string>>(),
    mockBody: text("mock_body"),
    mockDelay: integer("mock_delay").notNull().default(0),
    mockSpec: jsonb("mock_spec"),
    mockRequestCount: integer("mock_request_count").notNull().default(0),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("endpoints_user_idx").on(table.userId)],
);

export const capturedRequests = pgTable(
  "captured_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    method: text("method").notNull(),
    path: text("path").notNull(),
    status: integer("status").notNull().default(200),
    ip: text("ip"),
    userAgent: text("user_agent"),
    headers: jsonb("headers").$type<Record<string, string>>().notNull(),
    body: jsonb("body"),
    query: jsonb("query").$type<Record<string, string>>(),
    truncated: boolean("truncated").notNull().default(false),
    responsePreview: text("response_preview"),
    chaosEffects: jsonb("chaos_effects").$type<string[]>(),
    recordCount: integer("record_count"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("captured_requests_endpoint_created_idx").on(
      table.endpointId,
      table.createdAt,
    ),
    index("captured_requests_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("captured_requests_created_idx").on(table.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const loginChallenges = pgTable(
  "login_challenges",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeSalt: text("code_salt").notNull(),
    codeHash: text("code_hash").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("login_challenges_email_idx").on(table.email)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
