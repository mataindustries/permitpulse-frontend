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

export const deliveryStates = ["draft", "packet_generated", "under_review", "changes_required", "approved_for_delivery", "delivered", "delivery_confirmed"] as const;
export const deliveryEventTypes = ["packet_generated", "review_started", "changes_requested", "approved_for_delivery", "delivery_recorded", "delivery_confirmed"] as const;

export const packetGenerations = sqliteTable(
  "packet_generations",
  {
    id: text("id").primaryKey().notNull(),
    caseId: text("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
    caseVersion: integer("case_version").notNull(),
    generatedByUserId: text("generated_by_user_id").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    snapshotJson: text("snapshot_json").notNull(),
    contentSha256: text("content_sha256").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    check("packet_generations_case_version_check", sql`${table.caseVersion} >= 1`),
    check("packet_generations_snapshot_json_check", sql`json_valid(${table.snapshotJson}) AND json_type(${table.snapshotJson}) = 'object'`),
    check("packet_generations_digest_check", sql`length(${table.contentSha256}) = 64`),
    index("packet_generations_case_created_idx").on(table.caseId, table.createdAt, table.id),
  ],
);

export const deliveryLifecycleEvents = sqliteTable(
  "delivery_lifecycle_events",
  {
    id: text("id").primaryKey().notNull(),
    caseId: text("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
    eventType: text("event_type", { enum: deliveryEventTypes }).notNull(),
    actorUserId: text("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    note: text("note"),
    packetGenerationId: text("packet_generation_id").references(() => packetGenerations.id, { onDelete: "restrict" }),
    previousState: text("previous_state", { enum: deliveryStates }).notNull(),
    resultingState: text("resulting_state", { enum: deliveryStates }).notNull(),
    sequence: integer("sequence").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    uniqueIndex("delivery_events_case_sequence_uidx").on(table.caseId, table.sequence),
    uniqueIndex("delivery_events_case_idempotency_uidx").on(table.caseId, table.idempotencyKey),
    index("delivery_events_case_created_idx").on(table.caseId, table.sequence),
    index("delivery_events_packet_idx").on(table.packetGenerationId, table.sequence),
  ],
);

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

export const evidenceTypes = [
  "document",
  "portal",
  "email",
  "phone_call",
  "meeting",
  "inspection",
  "code_reference",
  "photo",
  "other",
] as const;

export const evidenceVerificationStatuses = [
  "unverified",
  "verified",
  "disputed",
] as const;

export const evidenceItems = sqliteTable(
  "evidence_items",
  {
    id: text("id").primaryKey().notNull(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    evidenceType: text("evidence_type", { enum: evidenceTypes }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceUrl: text("source_url"),
    sourceLabel: text("source_label"),
    sourceDate: text("source_date"),
    verificationStatus: text("verification_status", {
      enum: evidenceVerificationStatuses,
    })
      .notNull()
      .default("unverified"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    check(
      "evidence_items_type_check",
      sql`${table.evidenceType} IN ('document', 'portal', 'email', 'phone_call', 'meeting', 'inspection', 'code_reference', 'photo', 'other')`,
    ),
    check(
      "evidence_items_title_length_check",
      sql`length(trim(${table.title})) BETWEEN 1 AND 160`,
    ),
    check(
      "evidence_items_summary_length_check",
      sql`length(trim(${table.summary})) BETWEEN 1 AND 2000`,
    ),
    check(
      "evidence_items_source_url_length_check",
      sql`${table.sourceUrl} IS NULL OR length(${table.sourceUrl}) BETWEEN 1 AND 2048`,
    ),
    check(
      "evidence_items_source_label_length_check",
      sql`${table.sourceLabel} IS NULL OR length(trim(${table.sourceLabel})) BETWEEN 1 AND 160`,
    ),
    check(
      "evidence_items_source_date_iso_check",
      sql`${table.sourceDate} IS NULL OR (length(${table.sourceDate}) = 10 AND ${table.sourceDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
    check(
      "evidence_items_verification_status_check",
      sql`${table.verificationStatus} IN ('unverified', 'verified', 'disputed')`,
    ),
    check("evidence_items_version_positive_check", sql`${table.version} >= 1`),
    index("evidence_items_case_list_idx").on(
      table.caseId,
      table.deletedAt,
      table.sourceDate,
      table.createdAt,
      table.id,
    ),
    index("evidence_items_case_source_date_idx").on(
      table.caseId,
      table.sourceDate,
      table.createdAt,
      table.id,
    ),
    index("evidence_items_created_by_idx").on(
      table.createdByUserId,
      table.createdAt,
      table.id,
    ),
  ],
);

export type EvidenceItemRecord = typeof evidenceItems.$inferSelect;

export const timelineTypes = [
  "submission",
  "resubmission",
  "correction",
  "reviewer_contact",
  "applicant_contact",
  "inspection",
  "approval",
  "rejection",
  "status_update",
  "deadline",
  "other",
] as const;

export const timelineEntries = sqliteTable(
  "timeline_entries",
  {
    id: text("id").primaryKey().notNull(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    occurredOn: text("occurred_on").notNull(),
    timelineType: text("timeline_type", { enum: timelineTypes }).notNull(),
    title: text("title").notNull(),
    details: text("details").notNull(),
    isCanonical: integer("is_canonical", { mode: "boolean" })
      .notNull()
      .default(false),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    check(
      "timeline_entries_occurred_on_iso_check",
      sql`length(${table.occurredOn}) = 10 AND ${table.occurredOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "timeline_entries_type_check",
      sql`${table.timelineType} IN ('submission', 'resubmission', 'correction', 'reviewer_contact', 'applicant_contact', 'inspection', 'approval', 'rejection', 'status_update', 'deadline', 'other')`,
    ),
    check(
      "timeline_entries_title_length_check",
      sql`length(trim(${table.title})) BETWEEN 1 AND 160`,
    ),
    check(
      "timeline_entries_details_length_check",
      sql`length(trim(${table.details})) BETWEEN 1 AND 4000`,
    ),
    check(
      "timeline_entries_canonical_boolean_check",
      sql`${table.isCanonical} IN (0, 1)`,
    ),
    check("timeline_entries_version_positive_check", sql`${table.version} >= 1`),
    index("timeline_entries_case_list_idx").on(
      table.caseId,
      table.deletedAt,
      table.occurredOn,
      table.createdAt,
      table.id,
    ),
    index("timeline_entries_case_canonical_idx").on(
      table.caseId,
      table.isCanonical,
      table.occurredOn,
      table.id,
    ),
    index("timeline_entries_created_by_idx").on(
      table.createdByUserId,
      table.createdAt,
      table.id,
    ),
  ],
);

export type TimelineEntryRecord = typeof timelineEntries.$inferSelect;

export const timelineEntryEvidence = sqliteTable(
  "timeline_entry_evidence",
  {
    timelineEntryId: text("timeline_entry_id")
      .notNull()
      .references(() => timelineEntries.id, { onDelete: "cascade" }),
    evidenceItemId: text("evidence_item_id")
      .notNull()
      .references(() => evidenceItems.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    primaryKey({
      columns: [table.timelineEntryId, table.evidenceItemId],
      name: "timeline_entry_evidence_pk",
    }),
    index("timeline_entry_evidence_evidence_idx").on(
      table.evidenceItemId,
      table.timelineEntryId,
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
