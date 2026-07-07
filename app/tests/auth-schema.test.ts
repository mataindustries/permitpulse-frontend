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
         'case_participants_case_role_idx'
       )
       ORDER BY type, name`,
    ).all<SchemaObject>();
    const objects = result.results;

    expect(objects.map(({ name }) => name)).toEqual([
      "account_provider_account_uidx",
      "account_user_id_idx",
      "case_participants_case_role_idx",
      "case_participants_user_case_idx",
      "session_expires_at_idx",
      "session_impersonated_by_idx",
      "session_user_id_idx",
      "user_banned_idx",
      "user_role_idx",
      "verification_expires_at_idx",
      "verification_identifier_idx",
      "account",
      "admin_bootstrap_claim",
      "case_participants",
      "session",
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
  });
});
