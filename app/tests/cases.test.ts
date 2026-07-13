import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import { createCaseForActor } from "../src/worker/cases/repository";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";

const fictionalCase = {
  project_name: "Fictional Oak Street ADU",
  client_name: "Fictional Client",
  address: "42 Oak Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "EX-2026-001",
  current_status: "intake" as const,
};

const clientA = {
  name: "Avery Client",
  email: "avery.client@example.test",
  password: "Fictional-passphrase-42",
};

const clientB = {
  name: "Blair Client",
  email: "blair.client@example.test",
  password: "Fictional-passphrase-42",
};

const adminUser = {
  name: "Jordan Admin",
  email: "jordan.admin@example.test",
  password: "Admin-fictional-passphrase-42",
};

function bindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    ADMIN_BOOTSTRAP_ENABLED: "false",
    APP_ENV: "local",
    ASSETS: env.ASSETS,
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_ENABLED: "true",
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: localOrigin,
    DB: env.DB,
    ENABLE_DEV_CASE_API: "true",
    ...overrides,
  };
}

function request(
  path: string,
  init?: RequestInit,
  overrides?: Partial<Bindings>,
) {
  return app.request(`${localOrigin}${path}`, init, bindings(overrides));
}

async function signUp(account: typeof clientA) {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(account),
  });

  expect(response.status).toBe(200);

  const setCookie = response.headers.get("set-cookie");

  expect(setCookie).toBeTruthy();

  const body = await response.json<{ user: { id: string } }>();

  return {
    cookie: setCookie!.split(";", 1)[0],
    userId: body.user.id,
  };
}

async function signUpAdmin() {
  const admin = await signUp(adminUser);

  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?')
    .bind("admin", admin.userId)
    .run();

  return admin;
}

async function postCase(cookie: string, body: Record<string, unknown>) {
  return request("/api/v1/cases", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function patchCase(
  cookie: string,
  caseId: string,
  body: Record<string, unknown>,
) {
  return request(`/api/v1/cases/${caseId}`, {
    method: "PATCH",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function updateStatus(
  cookie: string,
  caseId: string,
  body: Record<string, unknown>,
) {
  return request(`/api/v1/cases/${caseId}/status`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function getActivity(cookie: string, caseId: string, query = "") {
  return request(`/api/v1/cases/${caseId}/activity${query}`, {
    headers: { cookie },
  });
}

async function createCase(cookie: string, body = fictionalCase) {
  const response = await postCase(cookie, body);
  const payload = await response.json<{
    ok: true;
    data: typeof fictionalCase & {
      id: string;
      version: number;
      created_at: string;
      updated_at: string;
    };
  }>();

  expect(response.status).toBe(201);

  return payload.data;
}

async function auditCount(caseId: string, action?: string) {
  const row = action
    ? await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE case_id = ? AND action = ?",
      )
        .bind(caseId, action)
        .first<{ count: number }>()
    : await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE case_id = ?",
      )
        .bind(caseId)
        .first<{ count: number }>();

  return row?.count ?? 0;
}

async function cleanDatabase() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM timeline_entry_evidence"),
    env.DB.prepare("DELETE FROM timeline_entries"),
    env.DB.prepare("DELETE FROM evidence_items"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM case_participants"),
    env.DB.prepare("DELETE FROM cases"),
    env.DB.prepare("DELETE FROM admin_bootstrap_claim"),
    env.DB.prepare("DELETE FROM verification"),
    env.DB.prepare("DELETE FROM session"),
    env.DB.prepare("DELETE FROM account"),
    env.DB.prepare('DELETE FROM "user"'),
  ]);
}

async function insertLegacyCase(id: string) {
  await env.DB.prepare(
    `INSERT INTO cases (
      id,
      project_name,
      client_name,
      address,
      city,
      jurisdiction,
      permit_number,
      current_status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      "Fictional Legacy Case",
      "Legacy Fictional Client",
      "1 Legacy Way",
      "Exampleville",
      "Exampleville Building",
      null,
      "intake",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    )
    .run();
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("authenticated case API authentication", () => {
  it("returns 401 for unauthenticated create, list, and detail", async () => {
    const createResponse = await request("/api/v1/cases", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: localOrigin,
      },
      body: JSON.stringify(fictionalCase),
    });
    const listResponse = await request("/api/v1/cases");
    const detailResponse = await request(
      "/api/v1/cases/00000000-0000-4000-8000-000000000000",
    );

    expect(createResponse.status).toBe(401);
    expect(listResponse.status).toBe(401);
    expect(detailResponse.status).toBe(401);
  });

  it("returns 401 instead of enabling production auth when auth is disabled", async () => {
    const response = await request("/api/v1/cases", undefined, {
      APP_ENV: "production",
      AUTH_ALLOW_SIGNUP: "false",
      AUTH_ENABLED: "false",
      BETTER_AUTH_URL: "https://workspace.getpermitpulse.com",
      ENABLE_DEV_CASE_API: "false",
    });

    expect(response.status).toBe(401);
  });
});

describe("client case creation", () => {
  it("creates a case and automatically adds an owner participant", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);

    expect(record).toMatchObject(fictionalCase);
    expect(record.version).toBe(1);
    expect(await auditCount(record.id, "case_created")).toBe(1);

    const participant = await env.DB.prepare(
      `SELECT participant_role
       FROM case_participants
       WHERE case_id = ? AND user_id = ?`,
    )
      .bind(record.id, client.userId)
      .first<{ participant_role: string }>();

    expect(participant?.participant_role).toBe("owner");
  });

  it.each([
    ["owner_user_id", "other-user"],
    ["user_id", "other-user"],
    ["participant_role", "owner"],
    ["role", "admin"],
    ["created_by", "other-user"],
    ["unexpected_field", true],
  ])("rejects injected field %s", async (field, value) => {
    const client = await signUp(clientA);
    const response = await postCase(client.cookie, {
      ...fictionalCase,
      [field]: value,
    });

    expect(response.status).toBe(400);

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cases",
    ).first<{ count: number }>();

    expect(row?.count).toBe(0);
  });

  it("rejects malformed input", async () => {
    const client = await signUp(clientA);
    const response = await postCase(client.cookie, {
      ...fictionalCase,
      project_name: "",
      current_status: "approved",
    });

    expect(response.status).toBe(400);
  });

  it("rolls back the case insert when owner participant insertion fails", async () => {
    await expect(
      createCaseForActor(env.DB, fictionalCase, {
        id: "missing-fictional-user",
        role: "client",
      }),
    ).rejects.toThrow();

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cases WHERE project_name = ?",
    )
      .bind(fictionalCase.project_name)
      .first<{ count: number }>();

    expect(row?.count).toBe(0);
  });
});

describe("client isolation", () => {
  it("lists only each client's participating cases", async () => {
    const a = await signUp(clientA);
    const b = await signUp(clientB);
    const caseA = await createCase(a.cookie, {
      ...fictionalCase,
      project_name: "Fictional Client A Case",
    });
    const caseB = await createCase(b.cookie, {
      ...fictionalCase,
      project_name: "Fictional Client B Case",
    });

    const listA = await request("/api/v1/cases", {
      headers: { cookie: a.cookie },
    });
    const listB = await request("/api/v1/cases", {
      headers: { cookie: b.cookie },
    });
    const bodyA = await listA.json<{
      data: { cases: Array<{ id: string }> };
    }>();
    const bodyB = await listB.json<{
      data: { cases: Array<{ id: string }> };
    }>();

    expect(bodyA.data.cases.map(({ id }) => id)).toEqual([caseA.id]);
    expect(bodyB.data.cases.map(({ id }) => id)).toEqual([caseB.id]);
  });

  it("returns safe 404 for another client's case", async () => {
    const a = await signUp(clientA);
    const b = await signUp(clientB);
    const caseA = await createCase(a.cookie);
    const response = await request(`/api/v1/cases/${caseA.id}`, {
      headers: { cookie: b.cookie },
    });
    const body = await response.json<{ error: { code: string } }>();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("CASE_NOT_FOUND");
  });

  it("keeps unowned legacy cases invisible to clients", async () => {
    const client = await signUp(clientA);
    const legacyId = "00000000-0000-4000-8000-000000000123";

    await insertLegacyCase(legacyId);

    const listResponse = await request("/api/v1/cases", {
      headers: { cookie: client.cookie },
    });
    const detailResponse = await request(`/api/v1/cases/${legacyId}`, {
      headers: { cookie: client.cookie },
    });
    const listBody = await listResponse.json<{
      data: { cases: Array<{ id: string }> };
    }>();

    expect(listBody.data.cases).toEqual([]);
    expect(detailResponse.status).toBe(404);
  });
});

describe("admin case visibility", () => {
  it("lists and reads every case", async () => {
    const client = await signUp(clientA);
    const admin = await signUpAdmin();
    const clientCase = await createCase(client.cookie);
    const legacyId = "00000000-0000-4000-8000-000000000456";

    await insertLegacyCase(legacyId);

    const listResponse = await request("/api/v1/cases", {
      headers: { cookie: admin.cookie },
    });
    const listBody = await listResponse.json<{
      data: { cases: Array<{ id: string }> };
    }>();
    const detailResponse = await request(`/api/v1/cases/${clientCase.id}`, {
      headers: { cookie: admin.cookie },
    });

    expect(listResponse.status).toBe(200);
    expect(listBody.data.cases.map(({ id }) => id)).toContain(clientCase.id);
    expect(listBody.data.cases.map(({ id }) => id)).toContain(legacyId);
    expect(detailResponse.status).toBe(200);
  });

  it("creates an admin-visible unassigned case that clients cannot see", async () => {
    const admin = await signUpAdmin();
    const client = await signUp(clientA);
    const adminCase = await createCase(admin.cookie, {
      ...fictionalCase,
      project_name: "Fictional Admin Intake",
    });
    const participant = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM case_participants WHERE case_id = ?",
    )
      .bind(adminCase.id)
      .first<{ count: number }>();
    const clientList = await request("/api/v1/cases", {
      headers: { cookie: client.cookie },
    });
    const clientDetail = await request(`/api/v1/cases/${adminCase.id}`, {
      headers: { cookie: client.cookie },
    });
    const clientListBody = await clientList.json<{
      data: { cases: Array<{ id: string }> };
    }>();

    expect(participant?.count).toBe(0);
    expect(clientListBody.data.cases).toEqual([]);
    expect(clientDetail.status).toBe(404);

    const adminDetail = await request(`/api/v1/cases/${adminCase.id}`, {
      headers: { cookie: admin.cookie },
    });

    expect(adminDetail.status).toBe(200);
  });

  it("does not let a client use Better Auth admin functions or elevate role", async () => {
    const client = await signUp(clientA);
    const adminEndpoint = await request("/api/auth/admin/list-users", {
      headers: { cookie: client.cookie },
    });
    const roleInjection = await postCase(client.cookie, {
      ...fictionalCase,
      role: "admin",
    });
    const user = await env.DB.prepare(
      'SELECT role FROM "user" WHERE id = ?',
    )
      .bind(client.userId)
      .first<{ role: string }>();

    expect(adminEndpoint.status).toBe(403);
    expect(roleInjection.status).toBe(400);
    expect(user?.role).toBe("client");
  });
});

describe("case metadata editing", () => {
  it("returns 401 for unauthenticated edits", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const response = await request(`/api/v1/cases/${record.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: localOrigin,
      },
      body: JSON.stringify({
        expected_version: record.version,
        project_name: "Fictional Updated Project",
      }),
    });

    expect(response.status).toBe(401);
  });

  it("lets an owner client edit their case and records only actual changed fields", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const response = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
      project_name: "Fictional Updated ADU",
      city: record.city,
    });
    const body = await response.json<{
      ok: true;
      data: typeof record;
    }>();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: record.id,
      project_name: "Fictional Updated ADU",
      city: record.city,
      version: record.version + 1,
    });
    expect(body.data.updated_at).not.toBe(record.updated_at);
    expect(await auditCount(record.id, "case_updated")).toBe(1);

    const audit = await env.DB.prepare(
      "SELECT changed_fields FROM audit_events WHERE case_id = ? AND action = ?",
    )
      .bind(record.id, "case_updated")
      .first<{ changed_fields: string }>();

    expect(JSON.parse(audit?.changed_fields ?? "[]")).toEqual([
      "project_name",
    ]);
  });

  it("returns safe 404 for unrelated clients and allows admins to edit any case", async () => {
    const owner = await signUp(clientA);
    const unrelated = await signUp(clientB);
    const admin = await signUpAdmin();
    const record = await createCase(owner.cookie);
    const unrelatedResponse = await patchCase(unrelated.cookie, record.id, {
      expected_version: record.version,
      project_name: "Fictional Unauthorized Edit",
    });
    const adminResponse = await patchCase(admin.cookie, record.id, {
      expected_version: record.version,
      jurisdiction: "Fictional County Building",
    });
    const adminBody = await adminResponse.json<{ data: typeof record }>();

    expect(unrelatedResponse.status).toBe(404);
    expect(adminResponse.status).toBe(200);
    expect(adminBody.data.jurisdiction).toBe("Fictional County Building");
    expect(adminBody.data.version).toBe(record.version + 1);
  });

  it.each([
    ["unknown fields", { unexpected_field: true }],
    ["status injection", { current_status: "researching" }],
    ["version injection", { version: 99 }],
    ["owner injection", { owner_user_id: "other-user" }],
    ["role injection", { role: "admin" }],
  ])("rejects %s through metadata edit", async (_label, injected) => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const response = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
      project_name: "Fictional Updated ADU",
      ...injected,
    });

    expect(response.status).toBe(400);
    expect(await auditCount(record.id, "case_updated")).toBe(0);
  });

  it("rejects an empty patch", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const response = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
    });

    expect(response.status).toBe(400);
    expect(await auditCount(record.id, "case_updated")).toBe(0);
  });
});

describe("case optimistic concurrency", () => {
  it("rejects stale edits without changing data or creating an audit event", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const first = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
      project_name: "Fictional First Update",
    });
    const stale = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
      client_name: "Fictional Stale Client",
    });
    const detail = await request(`/api/v1/cases/${record.id}`, {
      headers: { cookie: client.cookie },
    });
    const detailBody = await detail.json<{ data: typeof record }>();

    expect(first.status).toBe(200);
    expect(stale.status).toBe(409);
    expect(detailBody.data).toMatchObject({
      project_name: "Fictional First Update",
      client_name: record.client_name,
      version: record.version + 1,
    });
    expect(await auditCount(record.id, "case_updated")).toBe(1);
  });

  it("does not let two same-version metadata mutations both succeed", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const [first, second] = await Promise.all([
      patchCase(client.cookie, record.id, {
        expected_version: record.version,
        project_name: "Fictional Concurrent Project",
      }),
      patchCase(client.cookie, record.id, {
        expected_version: record.version,
        city: "Concurrentville",
      }),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 409]);
    expect(await auditCount(record.id, "case_updated")).toBe(1);
  });
});

describe("case status transitions", () => {
  it("lets an admin perform a valid transition and records from/to status", async () => {
    const client = await signUp(clientA);
    const admin = await signUpAdmin();
    const record = await createCase(client.cookie);
    const response = await updateStatus(admin.cookie, record.id, {
      expected_version: record.version,
      current_status: "researching",
    });
    const body = await response.json<{ data: typeof record }>();

    expect(response.status).toBe(200);
    expect(body.data.current_status).toBe("researching");
    expect(body.data.version).toBe(record.version + 1);

    const audit = await env.DB.prepare(
      `SELECT changed_fields, from_status, to_status
       FROM audit_events
       WHERE case_id = ? AND action = ?`,
    )
      .bind(record.id, "case_status_changed")
      .first<{
        changed_fields: string;
        from_status: string;
        to_status: string;
      }>();

    expect(JSON.parse(audit?.changed_fields ?? "[]")).toEqual([
      "current_status",
    ]);
    expect(audit?.from_status).toBe("intake");
    expect(audit?.to_status).toBe("researching");
  });

  it("denies client status transitions while preserving safe unrelated behavior", async () => {
    const owner = await signUp(clientA);
    const unrelated = await signUp(clientB);
    const record = await createCase(owner.cookie);
    const ownerResponse = await updateStatus(owner.cookie, record.id, {
      expected_version: record.version,
      current_status: "researching",
    });
    const unrelatedResponse = await updateStatus(unrelated.cookie, record.id, {
      expected_version: record.version,
      current_status: "researching",
    });

    expect(ownerResponse.status).toBe(403);
    expect(unrelatedResponse.status).toBe(404);
    expect(await auditCount(record.id, "case_status_changed")).toBe(0);
  });

  it("rejects invalid, same-status, and stale transitions without extra events", async () => {
    const client = await signUp(clientA);
    const admin = await signUpAdmin();
    const record = await createCase(client.cookie);
    const invalid = await updateStatus(admin.cookie, record.id, {
      expected_version: record.version,
      current_status: "ready_for_review",
    });
    const same = await updateStatus(admin.cookie, record.id, {
      expected_version: record.version,
      current_status: "intake",
    });
    const valid = await updateStatus(admin.cookie, record.id, {
      expected_version: record.version,
      current_status: "researching",
    });
    const stale = await updateStatus(admin.cookie, record.id, {
      expected_version: record.version,
      current_status: "needs_information",
    });

    expect(invalid.status).toBe(400);
    expect(same.status).toBe(400);
    expect(valid.status).toBe(200);
    expect(stale.status).toBe(409);
    expect(await auditCount(record.id, "case_status_changed")).toBe(1);
  });
});

describe("case activity", () => {
  it("returns create, update, and status events in deterministic newest-first order", async () => {
    const client = await signUp(clientA);
    const admin = await signUpAdmin();
    const record = await createCase(client.cookie);
    const edit = await patchCase(client.cookie, record.id, {
      expected_version: record.version,
      address: "84 Fictional Oak Street",
    });
    const editBody = await edit.json<{ data: typeof record }>();

    await updateStatus(admin.cookie, record.id, {
      expected_version: editBody.data.version,
      current_status: "researching",
    });

    const firstResponse = await getActivity(client.cookie, record.id);
    const secondResponse = await getActivity(client.cookie, record.id);
    const firstBody = await firstResponse.json<{
      data: {
        activity: Array<{
          id: string;
          action: string;
          changed_fields: string[];
          from_status: string | null;
          to_status: string | null;
          actor?: Record<string, unknown> | null;
          created_at: string;
        }>;
        order: string;
      };
    }>();
    const secondBody = await secondResponse.json<typeof firstBody>();
    const actions = firstBody.data.activity.map(({ action }) => action);

    expect(firstResponse.status).toBe(200);
    expect(firstBody.data.order).toBe("created_at_desc");
    expect(actions).toContain("case_created");
    expect(actions).toContain("case_updated");
    expect(actions).toContain("case_status_changed");
    expect(secondBody.data.activity.map(({ id }) => id)).toEqual(
      firstBody.data.activity.map(({ id }) => id),
    );

    for (let index = 1; index < firstBody.data.activity.length; index += 1) {
      expect(
        firstBody.data.activity[index - 1]!.created_at >=
          firstBody.data.activity[index]!.created_at,
      ).toBe(true);
    }
  });

  it("uses bounded pagination for activity", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const limited = await getActivity(client.cookie, record.id, "?limit=1");
    const tooLarge = await getActivity(client.cookie, record.id, "?limit=51");
    const body = await limited.json<{
      data: { activity: unknown[]; pagination: { limit: number; offset: number } };
    }>();

    expect(limited.status).toBe(200);
    expect(body.data.activity).toHaveLength(1);
    expect(body.data.pagination).toEqual({ limit: 1, offset: 0 });
    expect(tooLarge.status).toBe(400);
  });

  it("allows owner clients and admins to read activity while hiding it from unrelated clients", async () => {
    const owner = await signUp(clientA);
    const unrelated = await signUp(clientB);
    const admin = await signUpAdmin();
    const record = await createCase(owner.cookie);
    const ownerResponse = await getActivity(owner.cookie, record.id);
    const adminResponse = await getActivity(admin.cookie, record.id);
    const unrelatedResponse = await getActivity(unrelated.cookie, record.id);

    expect(ownerResponse.status).toBe(200);
    expect(adminResponse.status).toBe(200);
    expect(unrelatedResponse.status).toBe(404);
  });

  it("does not expose sensitive fields in activity responses", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);
    const response = await getActivity(client.cookie, record.id);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text.toLowerCase()).not.toContain("token");
    expect(text.toLowerCase()).not.toContain("password");
    expect(text.toLowerCase()).not.toContain("cookie");
    expect(text.toLowerCase()).not.toContain("session");
    expect(text.toLowerCase()).not.toContain("account");
    expect(text.toLowerCase()).not.toContain("actor_user_id");
    expect(text.toLowerCase()).not.toContain("lifecycle_mutation_nonce");
  });
});

describe("case pagination", () => {
  it("uses the default limit and deterministic order", async () => {
    const admin = await signUpAdmin();

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO cases (
          id, project_name, client_name, address, city, jurisdiction,
          permit_number, current_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        "00000000-0000-4000-8000-000000000001",
        "First",
        "Client",
        "1 First",
        "Exampleville",
        "Exampleville",
        null,
        "intake",
        "2026-01-01T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      ),
      env.DB.prepare(
        `INSERT INTO cases (
          id, project_name, client_name, address, city, jurisdiction,
          permit_number, current_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        "00000000-0000-4000-8000-000000000002",
        "Second",
        "Client",
        "2 Second",
        "Exampleville",
        "Exampleville",
        null,
        "intake",
        "2026-01-01T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      ),
    ]);

    const response = await request("/api/v1/cases", {
      headers: { cookie: admin.cookie },
    });
    const body = await response.json<{
      data: {
        cases: Array<{ id: string }>;
        pagination: { limit: number; offset: number };
      };
    }>();

    expect(body.data.pagination).toEqual({ limit: 20, offset: 0 });
    expect(body.data.cases.map(({ id }) => id)).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);
  });

  it("enforces the maximum limit", async () => {
    const admin = await signUpAdmin();
    const response = await request("/api/v1/cases?limit=51", {
      headers: { cookie: admin.cookie },
    });

    expect(response.status).toBe(400);
  });

  it("does not duplicate cases from participant checks", async () => {
    const client = await signUp(clientA);
    const record = await createCase(client.cookie);

    await env.DB.prepare(
      `INSERT OR IGNORE INTO case_participants (
        case_id,
        user_id,
        participant_role
      ) VALUES (?, ?, 'owner')`,
    )
      .bind(record.id, client.userId)
      .run();

    const response = await request("/api/v1/cases", {
      headers: { cookie: client.cookie },
    });
    const body = await response.json<{
      data: { cases: Array<{ id: string }> };
    }>();

    expect(body.data.cases.map(({ id }) => id)).toEqual([record.id]);
  });
});

describe("case API response safety", () => {
  it("rejects a cookie-authenticated write from an untrusted origin before persistence", async () => {
    const client = await signUp(clientA);
    const response = await request("/api/v1/cases", {
      method: "POST",
      headers: {
        cookie: client.cookie,
        "content-type": "application/json",
        origin: "https://attacker.example.test",
      },
      body: JSON.stringify(fictionalCase),
    });
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cases",
    ).first<{ count: number }>();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_ORIGIN" },
    });
    expect(count?.count).toBe(0);
  });

  it("does not trust a different Codespaces origin merely because it is same-site", async () => {
    const client = await signUp(clientA);
    const response = await app.request(
      "https://victim-workspace.app.github.dev/api/v1/cases",
      {
        method: "POST",
        headers: {
          cookie: client.cookie,
          "content-type": "application/json",
          origin: "https://attacker-workspace.app.github.dev",
        },
        body: JSON.stringify(fictionalCase),
      },
      bindings(),
    );
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cases",
    ).first<{ count: number }>();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_ORIGIN" },
    });
    expect(count?.count).toBe(0);
  });

  it("does not expose session, password, account, or participant internals", async () => {
    const client = await signUp(clientA);
    const createResponse = await postCase(client.cookie, fictionalCase);
    const listResponse = await request("/api/v1/cases", {
      headers: { cookie: client.cookie },
    });
    const detailBody = await createResponse.json<{
      data: { id: string };
    }>();
    const detailResponse = await request(
      `/api/v1/cases/${detailBody.data.id}`,
      {
        headers: { cookie: client.cookie },
      },
    );

    for (const text of [
      JSON.stringify(detailBody),
      await listResponse.text(),
      await detailResponse.text(),
    ]) {
      expect(text.toLowerCase()).not.toContain("token");
      expect(text.toLowerCase()).not.toContain("password");
      expect(text.toLowerCase()).not.toContain("account");
      expect(text.toLowerCase()).not.toContain("session");
      expect(text.toLowerCase()).not.toContain("participant");
      expect(text.toLowerCase()).not.toContain("user_id");
    }
  });
});
