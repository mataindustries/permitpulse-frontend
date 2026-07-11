import { env } from "cloudflare:workers";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/client/App";
import { app } from "../src/worker/app";
import { getAuthRuntimeConfig } from "../src/worker/auth/config";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const codespacesOrigin = "https://74.app.github.dev";
const previewOrigin = "https://workspace-preview.getpermitpulse.com";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";
const bootstrapToken =
  "test-only-bootstrap-token-not-for-deployment-0123456789";
const fictionalAccount = {
  name: "Avery Example",
  email: "avery@example.test",
  password: "Fictional-passphrase-42",
};
const fictionalAdminAccount = {
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

function jsonRequest(
  path: string,
  body: Record<string, unknown>,
  overrides?: Partial<Bindings>,
) {
  return request(
    path,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: localOrigin,
      },
      body: JSON.stringify(body),
    },
    overrides,
  );
}

async function signUp(
  account: typeof fictionalAccount = fictionalAccount,
  overrides?: Partial<Bindings>,
) {
  return jsonRequest("/api/auth/sign-up/email", account, overrides);
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");

  expect(setCookie).toBeTruthy();

  return setCookie!.split(";", 1)[0];
}

async function deleteAuthRecords() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_bootstrap_claim"),
    env.DB.prepare("DELETE FROM verification"),
    env.DB.prepare("DELETE FROM session"),
    env.DB.prepare("DELETE FROM account"),
    env.DB.prepare('DELETE FROM "user"'),
  ]);
}

function bootstrapBindings(overrides: Partial<Bindings> = {}) {
  return bindings({
    ADMIN_BOOTSTRAP_ENABLED: "true",
    ADMIN_BOOTSTRAP_TOKEN: bootstrapToken,
    APP_ENV: "preview",
    AUTH_ALLOW_SIGNUP: "false",
    AUTH_ENABLED: "true",
    BETTER_AUTH_URL: previewOrigin,
    ENABLE_DEV_CASE_API: "false",
    ...overrides,
  });
}

function bootstrapRequest(
  body: Record<string, unknown> = fictionalAdminAccount,
  overrides?: Partial<Bindings>,
  authorization = `Bearer ${bootstrapToken}`,
) {
  return app.request(
    `${previewOrigin}/api/internal/bootstrap-admin`,
    {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    bootstrapBindings(overrides),
  );
}

beforeEach(async () => {
  await deleteAuthRecords();
});

describe("authentication configuration", () => {
  it("trusts localhost and the bounded Codespaces preview pattern locally", () => {
    expect(getAuthRuntimeConfig(bindings()).trustedOrigins).toEqual([
      localOrigin,
      "https://*.app.github.dev",
    ]);
  });

  it("keeps production trusted origins explicit", () => {
    const productionOrigin = "https://workspace.getpermitpulse.com";

    expect(
      getAuthRuntimeConfig(
        bindings({
          APP_ENV: "production",
          BETTER_AUTH_URL: productionOrigin,
        }),
      ).trustedOrigins,
    ).toEqual([productionOrigin]);
  });

  it("accepts localhost locally", async () => {
    expect((await signUp()).status).toBe(200);
  });

  it("accepts a Codespaces forwarded preview origin locally", async () => {
    const response = await app.request(
      `${codespacesOrigin}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: codespacesOrigin,
        },
        body: JSON.stringify(fictionalAccount),
      },
      bindings(),
    );

    expect(response.status).toBe(200);
  });

  it("rejects an unrelated origin locally", async () => {
    const response = await app.request(
      `${localOrigin}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://unrelated.example.test",
        },
        body: JSON.stringify(fictionalAccount),
      },
      bindings(),
    );

    expect(response.status).toBe(403);
  });

  it("fails closed when authentication is disabled", async () => {
    const response = await signUp(fictionalAccount, {
      AUTH_ENABLED: "false",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("fails closed safely when the secret is missing", async () => {
    const response = await signUp(fictionalAccount, {
      BETTER_AUTH_SECRET: undefined,
    });
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is unavailable.",
      },
    });
    expect(text).not.toContain("BETTER_AUTH_SECRET");
    expect(text).not.toContain(testSecret);
    expect(text).not.toContain("configuration is invalid");
  });

  it("blocks signup when AUTH_ALLOW_SIGNUP is false", async () => {
    const response = await signUp(fictionalAccount, {
      AUTH_ALLOW_SIGNUP: "false",
    });

    expect(response.status).toBeGreaterThanOrEqual(400);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("keeps normal preview signup blocked even when the signup flag is set", async () => {
    const response = await app.request(
      `${previewOrigin}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: previewOrigin,
        },
        body: JSON.stringify(fictionalAccount),
      },
      bindings({
        APP_ENV: "preview",
        AUTH_ALLOW_SIGNUP: "true",
        AUTH_ENABLED: "true",
        BETTER_AUTH_URL: previewOrigin,
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });
});

describe("preview admin bootstrap", () => {
  it("is always unavailable in production", async () => {
    const response = await bootstrapRequest(fictionalAdminAccount, {
      APP_ENV: "production",
      ADMIN_BOOTSTRAP_ENABLED: "true",
      BETTER_AUTH_URL: "https://workspace.getpermitpulse.com",
    });

    expect(response.status).toBe(404);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("is disabled by default in preview", async () => {
    const response = await bootstrapRequest(fictionalAdminAccount, {
      ADMIN_BOOTSTRAP_ENABLED: "false",
    });

    expect(response.status).toBe(404);
  });

  it("denies requests with a missing bearer token", async () => {
    const response = await bootstrapRequest(
      fictionalAdminAccount,
      undefined,
      "",
    );

    expect(response.status).toBe(401);
  });

  it("denies requests with an incorrect bearer token", async () => {
    const response = await bootstrapRequest(
      fictionalAdminAccount,
      undefined,
      "Bearer incorrect-bootstrap-token-not-for-deployment-0123456789",
    );

    expect(response.status).toBe(401);
  });

  it("fails closed when the configured token is weak or missing", async () => {
    const weakResponse = await bootstrapRequest(fictionalAdminAccount, {
      ADMIN_BOOTSTRAP_TOKEN: "too-short",
    });
    const missingResponse = await bootstrapRequest(fictionalAdminAccount, {
      ADMIN_BOOTSTRAP_TOKEN: undefined,
    });

    expect(weakResponse.status).toBe(503);
    expect(missingResponse.status).toBe(503);

    for (const response of [weakResponse, missingResponse]) {
      const text = await response.text();

      expect(text).not.toContain(bootstrapToken);
      expect(text).not.toContain(fictionalAdminAccount.password);
    }
  });

  it("rejects invalid or role-injecting request bodies", async () => {
    const invalidResponse = await bootstrapRequest({
      ...fictionalAdminAccount,
      email: "not-an-email",
    });
    const roleInjectionResponse = await bootstrapRequest({
      ...fictionalAdminAccount,
      role: "client",
    });

    expect(invalidResponse.status).toBe(400);
    expect(roleInjectionResponse.status).toBe(400);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("creates the first admin with a credential account and no session", async () => {
    const response = await bootstrapRequest();
    const body = await response.json<{
      ok: true;
      data: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    }>();
    const text = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(body).toEqual({
      ok: true,
      data: {
        id: expect.any(String),
        email: fictionalAdminAccount.email,
        name: fictionalAdminAccount.name,
        role: "admin",
      },
    });
    expect(text).not.toContain(bootstrapToken);
    expect(text).not.toContain(fictionalAdminAccount.password);
    expect(text.toLowerCase()).not.toContain("password");
    expect(text.toLowerCase()).not.toContain("token");

    const user = await env.DB.prepare(
      'SELECT id, email, role FROM "user" WHERE email = ?',
    )
      .bind(fictionalAdminAccount.email)
      .first<{ id: string; email: string; role: string }>();
    const account = await env.DB.prepare(
      "SELECT provider_id, password FROM account WHERE user_id = ?",
    )
      .bind(user?.id)
      .first<{ provider_id: string; password: string }>();
    const session = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM session",
    ).first<{ count: number }>();

    expect(user).toMatchObject({
      email: fictionalAdminAccount.email,
      role: "admin",
    });
    expect(account?.provider_id).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(fictionalAdminAccount.password);
    expect(session?.count).toBe(0);
  });

  it("rejects a second bootstrap attempt", async () => {
    expect((await bootstrapRequest()).status).toBe(200);

    const response = await bootstrapRequest({
      name: "Second Admin",
      email: "second.admin@example.test",
      password: "Second-admin-fictional-passphrase-42",
    });

    expect(response.status).toBe(409);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user"',
    ).first<{ count: number }>();
    expect(row?.count).toBe(1);
  });

  it("is blocked by an existing client user", async () => {
    expect((await signUp()).status).toBe(200);

    const response = await bootstrapRequest();

    expect(response.status).toBe(409);

    const admin = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM "user" WHERE role = ?',
    )
      .bind("admin")
      .first<{ count: number }>();
    expect(admin?.count).toBe(0);
  });
});

describe("email and password lifecycle", () => {
  it("creates a local account with credential records and a safe role", async () => {
    const response = await signUp();
    const body = await response.json<{
      user: { id: string; email: string; name: string };
      token?: string;
    }>();

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      email: fictionalAccount.email,
      name: fictionalAccount.name,
    });
    expect(body).not.toHaveProperty("token");

    const user = await env.DB.prepare(
      'SELECT id, email, role FROM "user" WHERE email = ?',
    )
      .bind(fictionalAccount.email)
      .first<{ id: string; email: string; role: string }>();
    const account = await env.DB.prepare(
      "SELECT provider_id, password FROM account WHERE user_id = ?",
    )
      .bind(user?.id)
      .first<{ provider_id: string; password: string }>();

    expect(user).toMatchObject({
      email: fictionalAccount.email,
      role: "client",
    });
    expect(account?.provider_id).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(fictionalAccount.password);
  });

  it("does not expose sensitive internals for a duplicate email", async () => {
    expect((await signUp()).status).toBe(200);

    const response = await signUp();
    const text = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toContain(testSecret);
    expect(text).not.toContain(fictionalAccount.password);
    expect(text.toLowerCase()).not.toContain("password_hash");
    expect(text.toLowerCase()).not.toContain("sqlite");
    expect(text.toLowerCase()).not.toContain("stack");
  });

  it("signs in with valid credentials", async () => {
    expect((await signUp()).status).toBe(200);
    await env.DB.prepare("DELETE FROM session").run();

    const response = await jsonRequest("/api/auth/sign-in/email", {
      email: fictionalAccount.email,
      password: fictionalAccount.password,
    });
    const body = await response.json<Record<string, unknown>>();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeTruthy();
    expect(body).not.toHaveProperty("token");

    const session = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM session",
    ).first<{ count: number }>();
    expect(session?.count).toBe(1);
  });

  it("rejects an invalid password", async () => {
    expect((await signUp()).status).toBe(200);
    await env.DB.prepare("DELETE FROM session").run();

    const response = await jsonRequest("/api/auth/sign-in/email", {
      email: fictionalAccount.email,
      password: "Incorrect-fictional-passphrase-42",
    });
    const text = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toContain(testSecret);
    expect(text).not.toContain("password_hash");
  });

  it("returns null for an unauthenticated session", async () => {
    const response = await request("/api/auth/get-session");

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("retrieves an authenticated session without its token", async () => {
    const signupResponse = await signUp();
    const cookie = cookieFrom(signupResponse);

    const response = await request("/api/auth/get-session", {
      headers: { cookie },
    });
    const body = await response.json<{
      session: Record<string, unknown>;
      user: Record<string, unknown>;
    }>();

    expect(response.status).toBe(200);
    expect(body.session).toMatchObject({
      id: expect.any(String),
      userId: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(body.session).not.toHaveProperty("token");
    expect(body.user).toMatchObject({
      email: fictionalAccount.email,
      name: fictionalAccount.name,
    });
    expect(body.user).not.toHaveProperty("role");
  });

  it("signs out and invalidates the database-backed session", async () => {
    const signupResponse = await signUp();
    const cookie = cookieFrom(signupResponse);

    const signOutResponse = await request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie,
        origin: localOrigin,
      },
    });
    expect(signOutResponse.status).toBe(200);

    const sessionResponse = await request("/api/auth/get-session", {
      headers: { cookie },
    });
    expect(await sessionResponse.json()).toBeNull();

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM session",
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("cannot assign a privileged role from the signup body", async () => {
    const response = await jsonRequest("/api/auth/sign-up/email", {
      ...fictionalAccount,
      role: "admin",
    });

    expect([200, 400]).toContain(response.status);

    const row = await env.DB.prepare(
      'SELECT role FROM "user" WHERE email = ?',
    )
      .bind(fictionalAccount.email)
      .first<{ role: string }>();
    expect(row?.role ?? null).not.toBe("admin");
  });

  it("sets HttpOnly and SameSite=Lax on the local session cookie", async () => {
    const response = await signUp();
    const setCookie = response.headers.get("set-cookie")?.toLowerCase();

    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("samesite=lax");
  });

  it("sets Secure on a preview session cookie", async () => {
    expect((await signUp()).status).toBe(200);
    await env.DB.prepare("DELETE FROM session").run();

    const response = await app.request(
      `${previewOrigin}/api/auth/sign-in/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: previewOrigin,
        },
        body: JSON.stringify({
          email: fictionalAccount.email,
          password: fictionalAccount.password,
        }),
      },
      bindings({
        APP_ENV: "preview",
        AUTH_ENABLED: "true",
        BETTER_AUTH_URL: previewOrigin,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain(
      "secure",
    );
  });

  it("rejects a credentialed mutation from an untrusted origin", async () => {
    const response = await jsonRequest("/api/auth/sign-up/email", {
      ...fictionalAccount,
    });
    const cookie = cookieFrom(response);

    const signOutResponse = await request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie,
        origin: "https://untrusted.example.test",
      },
    });

    expect(signOutResponse.status).toBe(403);
  });
});

describe("protected workspace", () => {
  it("returns the consistent 401 error when unauthenticated", async () => {
    const response = await request("/api/workspace");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      },
      request_id: expect.any(String),
    });
  });

  it("returns only the safe client workspace user DTO when authenticated", async () => {
    const signupResponse = await signUp();
    const signupBody = await signupResponse.json<{
      user: { id: string };
    }>();
    const cookie = cookieFrom(signupResponse);

    const response = await request("/api/workspace", {
      headers: { cookie },
    });
    const body = await response.json<{
      data: {
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      };
    }>();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        status: "ready",
        user: {
          id: signupBody.user.id,
          email: fictionalAccount.email,
          name: fictionalAccount.name,
          role: "client",
        },
      },
    });
    const text = JSON.stringify(body).toLowerCase();

    expect(text).not.toContain("token");
    expect(text).not.toContain("password");
    expect(text).not.toContain("cookie");
    expect(text).not.toContain("session");
    expect(text).not.toContain("account");
    expect(text).not.toContain("banned");
  });

  it("returns the safe admin role from the protected workspace identity", async () => {
    const signupResponse = await signUp(fictionalAdminAccount);
    const signupBody = await signupResponse.json<{
      user: { id: string };
    }>();
    const cookie = cookieFrom(signupResponse);

    await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?')
      .bind("admin", signupBody.user.id)
      .run();

    const response = await request("/api/workspace", {
      headers: { cookie },
    });
    const body = await response.json<{
      data: {
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      };
    }>();

    expect(response.status).toBe(200);
    expect(body.data.user).toEqual({
      id: signupBody.user.id,
      email: fictionalAdminAccount.email,
      name: fictionalAdminAccount.name,
      role: "admin",
    });
  });
});

describe("Better Auth admin endpoints", () => {
  it("rejects unauthenticated users", async () => {
    const response = await request("/api/auth/admin/list-users");

    expect(response.status).toBe(401);
  });

  it("rejects authenticated client users", async () => {
    const signupResponse = await signUp();
    const cookie = cookieFrom(signupResponse);

    const response = await request("/api/auth/admin/list-users", {
      headers: { cookie },
    });

    expect(response.status).toBe(403);
  });
});

describe("secret redaction", () => {
  it("does not render or return the configured secret", async () => {
    const markup = renderToStaticMarkup(<App />);
    const configResponse = await request("/api/config/auth");
    const configBody = await configResponse.text();

    expect(markup).not.toContain(testSecret);
    expect(configBody).not.toContain(testSecret);
    expect(configBody).toContain('"enabled":true');
  });
});
