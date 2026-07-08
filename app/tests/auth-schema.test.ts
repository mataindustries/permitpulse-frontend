import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

interface SchemaObject {
  name: string;
  sql: string | null;
  type: "index" | "table";
}

describe("Better Auth migration schema", () => {
  it("contains the reviewed core tables, constraints, and indexes", async () => {
    const result = await env.DB.prepare(
      `SELECT type, name, sql
       FROM sqlite_master
       WHERE name IN (
         'user',
         'session',
         'account',
         'verification',
         'session_user_id_idx',
         'session_expires_at_idx',
         'session_impersonated_by_idx',
         'account_user_id_idx',
         'account_provider_account_uidx',
         'user_banned_idx',
         'user_role_idx',
         'verification_identifier_idx',
         'verification_expires_at_idx',
         'admin_bootstrap_claim',
         'case_participants',
         'case_participants_user_case_idx',
         'case_participants_case_role_idx',
         'audit_events',
         'audit_events_case_created_at_idx',
         'audit_events_actor_created_at_idx',
         'cases_lifecycle_mutation_nonce_uidx',
         'evidence_items',
         'evidence_items_case_list_idx',
         'evidence_items_case_source_date_idx',
         'evidence_items_created_by_idx',
         'timeline_entries',
         'timeline_entries_case_list_idx',
         'timeline_entries_case_canonical_idx',
         'timeline_entries_created_by_idx',
         'timeline_entry_evidence',
         'timeline_entry_evidence_evidence_idx'
       )
       ORDER BY type, name`,
    ).all<SchemaObject>();
    const objects = result.results;

    expect(objects.map(({ name }) => name)).toEqual([
      "account_provider_account_uidx",
      "account_user_id_idx",
      "audit_events_actor_created_at_idx",
      "audit_events_case_created_at_idx",
      "case_participants_case_role_idx",
      "case_participants_user_case_idx",
      "cases_lifecycle_mutation_nonce_uidx",
      "evidence_items_case_list_idx",
      "evidence_items_case_source_date_idx",
      "evidence_items_created_by_idx",
      "session_expires_at_idx",
      "session_impersonated_by_idx",
      "session_user_id_idx",
      "timeline_entries_case_canonical_idx",
      "timeline_entries_case_list_idx",
      "timeline_entries_created_by_idx",
      "timeline_entry_evidence_evidence_idx",
      "user_banned_idx",
      "user_role_idx",
      "verification_expires_at_idx",
      "verification_identifier_idx",
      "account",
      "admin_bootstrap_claim",
      "audit_events",
      "case_participants",
      "evidence_items",
      "session",
      "timeline_entries",
      "timeline_entry_evidence",
      "user",
      "verification",
    ]);

    const userSql = objects.find(({ name }) => name === "user")?.sql ?? "";
    const sessionSql =
      objects.find(({ name }) => name === "session")?.sql ?? "";
    const accountSql =
      objects.find(({ name }) => name === "account")?.sql ?? "";
    const participantSql =
      objects.find(({ name }) => name === "case_participants")?.sql ?? "";
    const casesNonceSql =
      objects.find(({ name }) => name === "cases_lifecycle_mutation_nonce_uidx")
        ?.sql ?? "";
    const auditSql =
      objects.find(({ name }) => name === "audit_events")?.sql ?? "";
    const evidenceSql =
      objects.find(({ name }) => name === "evidence_items")?.sql ?? "";
    const timelineSql =
      objects.find(({ name }) => name === "timeline_entries")?.sql ?? "";
    const linkSql =
      objects.find(({ name }) => name === "timeline_entry_evidence")?.sql ?? "";

    expect(userSql).toContain("email TEXT NOT NULL UNIQUE");
    expect(userSql).toContain("role TEXT NOT NULL DEFAULT 'client'");
    expect(userSql).toContain("role IN ('client', 'admin')");
    expect(userSql).toContain("banned INTEGER NOT NULL DEFAULT 0");
    expect(userSql).toContain("ban_reason TEXT");
    expect(userSql).toContain("ban_expires INTEGER");
    expect(sessionSql).toContain("impersonated_by TEXT");
    expect(sessionSql).toContain('REFERENCES "user" (id) ON DELETE CASCADE');
    expect(accountSql).toContain('REFERENCES "user" (id) ON DELETE CASCADE');
    expect(participantSql).toContain("PRIMARY KEY (case_id, user_id)");
    expect(participantSql).toContain("participant_role = 'owner'");
    expect(participantSql).toContain("REFERENCES cases (id) ON DELETE CASCADE");
    expect(participantSql).toContain('REFERENCES "user" (id) ON DELETE CASCADE');
    expect(casesNonceSql).toContain("lifecycle_mutation_nonce");
    expect(casesNonceSql).toContain("WHERE lifecycle_mutation_nonce IS NOT NULL");
    expect(auditSql).toContain("CREATE TABLE audit_events");
    expect(auditSql).toContain("case_created");
    expect(auditSql).toContain("case_updated");
    expect(auditSql).toContain("case_status_changed");
    expect(auditSql).toContain("json_valid(changed_fields)");
    expect(auditSql).toContain("REFERENCES cases (id) ON DELETE RESTRICT");
    expect(auditSql).toContain('REFERENCES "user" (id) ON DELETE SET NULL');
    expect(evidenceSql).toContain("CREATE TABLE evidence_items");
    expect(evidenceSql).toContain("evidence_type IN");
    expect(evidenceSql).toContain("verification_status IN");
    expect(evidenceSql).toContain("version INTEGER NOT NULL");
    expect(evidenceSql).toContain("deleted_at TEXT");
    expect(evidenceSql).toContain("REFERENCES cases (id) ON DELETE RESTRICT");
    expect(evidenceSql).toContain('REFERENCES "user" (id) ON DELETE RESTRICT');
    expect(timelineSql).toContain("CREATE TABLE timeline_entries");
    expect(timelineSql).toContain("timeline_type IN");
    expect(timelineSql).toContain("is_canonical INTEGER NOT NULL");
    expect(timelineSql).toContain("CHECK (is_canonical IN (0, 1))");
    expect(timelineSql).toContain("deleted_at TEXT");
    expect(linkSql).toContain("PRIMARY KEY (timeline_entry_id, evidence_item_id)");
    expect(linkSql).toContain(
      "REFERENCES timeline_entries (id) ON DELETE CASCADE",
    );
    expect(linkSql).toContain("REFERENCES evidence_items (id) ON DELETE CASCADE");
  });
});
