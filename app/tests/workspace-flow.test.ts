import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";

const account = {
  name: "Fictional Workspace Tester",
  email: "fictional.workspace.flow@example.test",
  password: "Fictional-passphrase-42",
};

const fictionalCase = {
  project_name: "Fictional Local Workspace Case",
  client_name: "Fictional Local Client",
  address: "123 Fictional Permit Lane",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "LOCAL-2026-001",
  current_status: "intake",
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

async function jsonRequest(
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
) {
  return request(path, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");

  expect(setCookie).toBeTruthy();

  return setCookie!.split(";", 1)[0];
}

async function cleanDatabase() {
  await env.DB.batch([
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

describe("authenticated workspace flow", () => {
  it("signs in, lists cases, creates a case, opens detail, preserves session, and signs out", async () => {
    const signupResponse = await jsonRequest(
      "/api/auth/sign-up/email",
      account,
    );
    const cookie = cookieFrom(signupResponse);

    expect(signupResponse.status).toBe(200);

    const sessionResponse = await request("/api/auth/get-session", {
      headers: { cookie },
    });
    const initialListResponse = await request("/api/v1/cases", {
      headers: { cookie },
    });
    const initialList = await initialListResponse.json<{
      data: { cases: unknown[] };
    }>();

    expect(sessionResponse.status).toBe(200);
    expect(initialListResponse.status).toBe(200);
    expect(initialList.data.cases).toEqual([]);

    const createResponse = await jsonRequest(
      "/api/v1/cases",
      fictionalCase,
      cookie,
    );
    const createdBody = await createResponse.json<{
      data: typeof fictionalCase & { id: string };
    }>();

    expect(createResponse.status).toBe(201);
    expect(createdBody.data).toMatchObject(fictionalCase);

    const listAfterCreateResponse = await request("/api/v1/cases", {
      headers: { cookie },
    });
    const listAfterCreate = await listAfterCreateResponse.json<{
      data: { cases: Array<{ id: string }> };
    }>();

    expect(listAfterCreate.data.cases.map(({ id }) => id)).toEqual([
      createdBody.data.id,
    ]);

    const detailResponse = await request(
      `/api/v1/cases/${createdBody.data.id}`,
      { headers: { cookie } },
    );
    const detailBody = await detailResponse.json<{
      data: typeof fictionalCase & { id: string };
    }>();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.data).toMatchObject({
      id: createdBody.data.id,
      project_name: fictionalCase.project_name,
    });

    const refreshSessionResponse = await request("/api/auth/get-session", {
      headers: { cookie },
    });
    const refreshListResponse = await request("/api/v1/cases", {
      headers: { cookie },
    });

    expect(refreshSessionResponse.status).toBe(200);
    expect(refreshListResponse.status).toBe(200);

    const signOutResponse = await request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie,
        origin: localOrigin,
      },
    });
    const protectedWorkspaceResponse = await request("/api/workspace", {
      headers: { cookie },
    });

    expect(signOutResponse.status).toBe(200);
    expect(protectedWorkspaceResponse.status).toBe(401);
  });
});
