import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const localOrigin = "http://localhost";
const fictionalCase = {
  project_name: "Fictional Moonlight Library Renovation",
  client_name: "Example Client (Fictional)",
  address: "100 Example Avenue",
  city: "Exampleville",
  jurisdiction: "Fictional Building Department",
  permit_number: "DEMO-0001",
  current_status: "intake",
};

async function createFictionalCase() {
  return exports.default.fetch(`${localOrigin}/api/dev/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(fictionalCase),
  });
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM timeline_entry_evidence").run();
  await env.DB.prepare("DELETE FROM timeline_entries").run();
  await env.DB.prepare("DELETE FROM evidence_items").run();
  await env.DB.prepare("DELETE FROM audit_events").run();
  await env.DB.prepare("DELETE FROM cases").run();
});

describe("GET /api/health", () => {
  it("reports service and database health without internal details", async () => {
    const response = await exports.default.fetch(
      `${localOrigin}/api/health`,
    );
    const body = await response.json<{
      ok: boolean;
      service: string;
      environment: string;
      database: { connected: boolean; status: string };
      timestamp: string;
    }>();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "permitpulse-case-workspace",
      environment: "local",
      database: {
        connected: true,
        status: "connected",
      },
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(JSON.stringify(body)).not.toContain("DB");
  });

  it("can query the migrated D1 database", async () => {
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
    )
      .bind("table", "cases")
      .first<{ name: string }>();

    expect(table?.name).toBe("cases");
  });
});

describe("development case persistence API", () => {
  it("creates, persists, retrieves, and lists a valid case", async () => {
    const createResponse = await createFictionalCase();
    const createBody = await createResponse.json<{
      ok: true;
      data: typeof fictionalCase & { id: string };
    }>();

    expect(createResponse.status).toBe(201);
    expect(createBody.ok).toBe(true);
    expect(createBody.data).toMatchObject(fictionalCase);
    expect(createBody.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const persisted = await env.DB.prepare(
      "SELECT project_name FROM cases WHERE id = ?",
    )
      .bind(createBody.data.id)
      .first<{ project_name: string }>();

    expect(persisted?.project_name).toBe(fictionalCase.project_name);

    const getResponse = await exports.default.fetch(
      `${localOrigin}/api/dev/cases/${createBody.data.id}`,
    );
    const getBody = await getResponse.json<{
      ok: true;
      data: typeof fictionalCase & { id: string };
    }>();

    expect(getResponse.status).toBe(200);
    expect(getBody.data).toEqual(createBody.data);

    const listResponse = await exports.default.fetch(
      `${localOrigin}/api/dev/cases`,
    );
    const listBody = await listResponse.json<{
      ok: true;
      data: Array<typeof fictionalCase & { id: string }>;
    }>();

    expect(listResponse.status).toBe(200);
    expect(listBody.data).toEqual([createBody.data]);
  });

  it("rejects malformed case input", async () => {
    const response = await exports.default.fetch(
      `${localOrigin}/api/dev/cases`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          project_name: "",
        }),
      },
    );
    const body = await response.json<{
      ok: false;
      error: { code: string };
    }>();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST",
      },
    });
  });

  it("returns 404 for a missing case", async () => {
    const response = await exports.default.fetch(
      `${localOrigin}/api/dev/cases/00000000-0000-4000-8000-000000000000`,
    );
    const body = await response.json<{
      ok: false;
      error: { code: string };
    }>();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("CASE_NOT_FOUND");
  });

  it("rejects unknown fields without persisting the request", async () => {
    const response = await exports.default.fetch(
      `${localOrigin}/api/dev/cases`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...fictionalCase,
          is_admin: true,
        }),
      },
    );

    expect(response.status).toBe(400);

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cases",
    ).first<{ count: number }>();

    expect(row?.count).toBe(0);
  });

  it("does not expose case endpoints on a non-loopback host", async () => {
    const response = await exports.default.fetch(
      "https://workspace.example/api/dev/cases",
    );

    expect(response.status).toBe(404);
  });
});
