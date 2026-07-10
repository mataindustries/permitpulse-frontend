import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";

const clientA = {
  name: "Avery Mission",
  email: "avery.mission@example.test",
  password: "Fictional-passphrase-42",
};

const clientB = {
  name: "Blair Mission",
  email: "blair.mission@example.test",
  password: "Fictional-passphrase-42",
};

const adminUser = {
  name: "Jordan Mission Admin",
  email: "jordan.mission@example.test",
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

function request(path: string, init?: RequestInit) {
  return app.request(`${localOrigin}${path}`, init, bindings());
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

  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  const body = await response.json<{ user: { id: string } }>();

  expect(cookie).toBeTruthy();

  return { cookie: cookie!, userId: body.user.id };
}

async function signUpAdmin() {
  const admin = await signUp(adminUser);

  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?')
    .bind("admin", admin.userId)
    .run();

  return admin;
}

async function createCase(
  cookie: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await request("/api/v1/cases", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify({
      project_name: "Fictional Mission ADU",
      client_name: "Fictional Client",
      address: "42 Mission Street",
      city: "Exampleville",
      jurisdiction: "Exampleville Building",
      permit_number: "EX-2026-MC",
      current_status: "intake",
      ...overrides,
    }),
  });
  const body = await response.json<{ data: { id: string } }>();

  expect(response.status).toBe(201);

  return body.data.id;
}

async function insertEvidence(
  caseId: string,
  userId: string,
  id: string,
  verificationStatus: "disputed" | "unverified" | "verified",
  completeSource: boolean,
) {
  await env.DB.prepare(
    `INSERT INTO evidence_items (
      id,
      case_id,
      created_by_user_id,
      evidence_type,
      title,
      summary,
      source_url,
      source_label,
      source_date,
      verification_status
    ) VALUES (?, ?, ?, 'document', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      caseId,
      userId,
      `Fictional evidence ${id.slice(-2)}`,
      "Fictional evidence summary.",
      completeSource ? `https://example.test/${id}` : null,
      completeSource ? "Example source" : null,
      completeSource ? "2026-07-01" : null,
      verificationStatus,
    )
    .run();
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

beforeEach(async () => {
  await cleanDatabase();
});

describe("protected Mission Control aggregate", () => {
  it("requires an authenticated workspace session", async () => {
    const response = await request("/api/v1/mission-control");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("keeps client missions isolated and returns real aggregate metrics", async () => {
    const avery = await signUp(clientA);
    const blair = await signUp(clientB);
    const caseId = await createCase(avery.cookie, {
      current_status: "needs_information",
    });
    await createCase(blair.cookie, {
      project_name: "Fictional Hidden Mission",
    });

    await insertEvidence(
      caseId,
      avery.userId,
      "00000000-0000-4000-8000-000000000101",
      "verified",
      true,
    );
    await insertEvidence(
      caseId,
      avery.userId,
      "00000000-0000-4000-8000-000000000102",
      "unverified",
      false,
    );
    await insertEvidence(
      caseId,
      avery.userId,
      "00000000-0000-4000-8000-000000000103",
      "disputed",
      true,
    );
    await env.DB.prepare(
      `INSERT INTO timeline_entries (
        id,
        case_id,
        created_by_user_id,
        occurred_on,
        timeline_type,
        title,
        details
      ) VALUES (?, ?, ?, '2026-07-02', 'status_update', ?, ?)`,
    )
      .bind(
        "00000000-0000-4000-8000-000000000201",
        caseId,
        avery.userId,
        "Fictional status update",
        "Fictional timeline detail.",
      )
      .run();

    const response = await request("/api/v1/mission-control?limit=20", {
      headers: { cookie: avery.cookie },
    });
    const body = await response.json<{
      data: {
        missions: Array<Record<string, unknown>>;
      };
    }>();

    expect(response.status).toBe(200);
    expect(body.data.missions).toHaveLength(1);
    expect(body.data.missions[0]).toMatchObject({
      id: caseId,
      current_status: "needs_information",
      evidence: {
        total: 3,
        ready: 1,
        verified: 1,
        completeness: 33,
      },
      timeline: {
        total: 1,
        linked: 0,
        latest_occurred_on: "2026-07-02",
      },
      intelligence: {
        missionState: "Needs Information",
        recommendedAction: {
          title: "Resolve missing information",
          targetTab: "overview",
          blocking: true,
        },
        blockers: [
          expect.objectContaining({ id: "case-needs-information" }),
          expect.objectContaining({ id: "disputed-evidence" }),
          expect.objectContaining({ id: "unready-evidence" }),
          expect.objectContaining({ id: "unlinked-timeline" }),
        ],
      },
    });
    expect(body.data.missions[0]).not.toHaveProperty("ai_confidence");
    expect(JSON.stringify(body)).not.toContain(clientA.email);
    expect(JSON.stringify(body)).not.toContain(clientB.email);
  });

  it("lets administrators see all cases and validates pagination", async () => {
    const avery = await signUp(clientA);
    const blair = await signUp(clientB);
    const admin = await signUpAdmin();

    await createCase(avery.cookie, { project_name: "Avery mission" });
    await createCase(blair.cookie, { project_name: "Blair mission" });

    const response = await request("/api/v1/mission-control", {
      headers: { cookie: admin.cookie },
    });
    const body = await response.json<{
      data: { missions: Array<{ project_name: string }> };
    }>();
    const invalid = await request("/api/v1/mission-control?limit=51", {
      headers: { cookie: admin.cookie },
    });

    expect(response.status).toBe(200);
    expect(body.data.missions.map((item) => item.project_name).sort()).toEqual([
      "Avery mission",
      "Blair mission",
    ]);
    expect(invalid.status).toBe(400);
  });
});
