import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const caseStatuses = [
  "intake",
  "researching",
  "needs_information",
  "ready_for_review",
] as const;

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey().notNull(),
    projectName: text("project_name").notNull(),
    clientName: text("client_name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    permitNumber: text("permit_number"),
    currentStatus: text("current_status", {
      enum: caseStatuses,
    })
      .notNull()
      .default("intake"),
    version: integer("version").notNull().default(1),
    lifecycleMutationNonce: text("lifecycle_mutation_nonce"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index("cases_current_status_updated_at_idx").on(
      table.currentStatus,
      table.updatedAt,
    ),
    index("cases_city_jurisdiction_idx").on(
      table.city,
      table.jurisdiction,
    ),
    check("cases_version_positive_check", sql`${table.version} >= 1`),
    check(
      "cases_lifecycle_mutation_nonce_length_check",
      sql`${table.lifecycleMutationNonce} IS NULL OR length(${table.lifecycleMutationNonce}) BETWEEN 1 AND 64`,
    ),
    uniqueIndex("cases_lifecycle_mutation_nonce_uidx")
      .on(table.lifecycleMutationNonce)
      .where(sql`${table.lifecycleMutationNonce} IS NOT NULL`),
  ],
);

export type CaseRecord = typeof cases.$inferSelect;

export const authUsers = sqliteTable(
  "user",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .default(false)
      .notNull(),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    role: text("role", { enum: ["client", "admin"] })
      .default("client")
      .notNull(),
    banned: integer("banned", { mode: "boolean" })
      .default(false)
      .notNull(),
    banReason: text("ban_reason"),
    banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "user_role_reviewed_check",
      sql`${table.role} IN ('client', 'admin')`,
    ),
    index("user_role_idx").on(table.role),
    index("user_banned_idx").on(table.banned),
  ],
);

export const auditEventActions = [
  "case_created",
  "case_updated",
  "case_status_changed",
] as const;

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey().notNull(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    action: text("action", { enum: auditEventActions }).notNull(),
    changedFields: text("changed_fields").notNull(),
    fromStatus: text("from_status", { enum: caseStatuses }),
    toStatus: text("to_status", { enum: caseStatuses }),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    check(
      "audit_events_action_check",
      sql`${table.action} IN ('case_created', 'case_updated', 'case_status_changed')`,
    ),
    check(
      "audit_events_changed_fields_json_array_check",
      sql`json_valid(${table.changedFields}) AND json_type(${table.changedFields}) = 'array'`,
    ),
    check(
      "audit_events_from_status_check",
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} IN ('intake', 'researching', 'needs_information', 'ready_for_review')`,
    ),
    check(
      "audit_events_to_status_check",
      sql`${table.toStatus} IS NULL OR ${table.toStatus} IN ('intake', 'researching', 'needs_information', 'ready_for_review')`,
    ),
    check(
      "audit_events_request_id_length_check",
      sql`length(trim(${table.requestId})) BETWEEN 1 AND 128`,
    ),
    index("audit_events_case_created_at_idx").on(
      table.caseId,
      table.createdAt,
      table.id,
    ),
    index("audit_events_actor_created_at_idx").on(
      table.actorUserId,
      table.createdAt,
      table.id,
    ),
  ],
);

export type AuditEventRecord = typeof auditEvents.$inferSelect;

export const participantRoles = ["owner"] as const;

export const caseParticipants = sqliteTable(
  "case_participants",
  {
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    participantRole: text("participant_role", {
      enum: participantRoles,
    }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    primaryKey({
      columns: [table.caseId, table.userId],
      name: "case_participants_case_user_pk",
    }),
    check(
      "case_participants_role_owner_check",
      sql`${table.participantRole} = 'owner'`,
    ),
    index("case_participants_user_case_idx").on(
      table.userId,
      table.caseId,
    ),
    index("case_participants_case_role_idx").on(
      table.caseId,
      table.participantRole,
    ),
  ],
);

export const authSessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_expires_at_idx").on(table.expiresAt),
    index("session_impersonated_by_idx").on(table.impersonatedBy),
  ],
);

export const authAccounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_uidx").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const authVerifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey().notNull(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

export const authSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
};
