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
         'account_user_id_idx',
         'account_provider_account_uidx',
         'verification_identifier_idx',
         'verification_expires_at_idx'
       )
       ORDER BY type, name`,
    ).all<SchemaObject>();
    const objects = result.results;

    expect(objects.map(({ name }) => name)).toEqual([
      "account_provider_account_uidx",
      "account_user_id_idx",
      "session_expires_at_idx",
      "session_user_id_idx",
      "verification_expires_at_idx",
      "verification_identifier_idx",
      "account",
      "session",
      "user",
      "verification",
    ]);

    const userSql = objects.find(({ name }) => name === "user")?.sql ?? "";
    const sessionSql =
      objects.find(({ name }) => name === "session")?.sql ?? "";
    const accountSql =
      objects.find(({ name }) => name === "account")?.sql ?? "";

    expect(userSql).toContain("email TEXT NOT NULL UNIQUE");
    expect(userSql).toContain("CHECK (role = 'client')");
    expect(sessionSql).toContain('REFERENCES "user" (id) ON DELETE CASCADE');
    expect(accountSql).toContain('REFERENCES "user" (id) ON DELETE CASCADE');
  });
});
