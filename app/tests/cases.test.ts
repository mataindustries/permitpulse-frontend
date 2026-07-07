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

async function createCase(cookie: string, body = fictionalCase) {
  const response = await postCase(cookie, body);
  const payload = await response.json<{
    ok: true;
    data: typeof fictionalCase & {
      id: string;
      created_at: string;
      updated_at: string;
    };
  }>();

  expect(response.status).toBe(201);

  return payload.data;
}

async function cleanDatabase() {
  await env.DB.batch([
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
