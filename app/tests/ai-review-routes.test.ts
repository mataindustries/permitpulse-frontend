import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { packetReviewDraftResponseDataSchema } from "../src/shared/ai-review/schema";
import type { PacketReviewDraftResponseData } from "../src/shared/ai-review/types";
import type { PacketModel } from "../src/shared/packet/types";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-ai-review-secret-not-for-deployment-123456";

const clientA = {
  name: "Avery AI Review Client",
  email: "avery.ai-review@example.test",
  password: "Fictional-passphrase-42",
};

const clientB = {
  name: "Blair AI Review Client",
  email: "blair.ai-review@example.test",
  password: "Fictional-passphrase-42",
};

const adminUser = {
  name: "Jordan AI Review Admin",
  email: "jordan.ai-review.admin@example.test",
  password: "Admin-fictional-passphrase-42",
};

function bindings(): Bindings {
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

async function postJson(
  cookie: string,
  path: string,
  body: Record<string, unknown>,
) {
  return request(path, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function createCase(
  cookie: string,
  suffix: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await postJson(cookie, "/api/v1/cases", {
    project_name: `Fictional AI Review Case ${suffix}`,
    client_name: `Fictional Client ${suffix}`,
    address: "42 Review Street",
    city: "Exampleville",
    jurisdiction: "Exampleville Building",
    permit_number: `AIR-${suffix}`,
    current_status: "researching",
    ...overrides,
  });
  const body = await response.json<{ data: { id: string } }>();

  expect(response.status).toBe(201);

  return body.data;
}

async function createEvidence(
  cookie: string,
  caseId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await postJson(
    cookie,
    `/api/v1/cases/${caseId}/evidence`,
    {
      evidence_type: "document",
      title: "Fictional intake record",
      summary: "Fictional supporting material for local review.",
      source_url: "https://example.test/ai-review/source",
      source_label: "Fictional permit portal",
      source_date: "2026-06-01",
      ...overrides,
    },
  );
  const body = await response.json<{ data: { id: string } }>();

  expect(response.status).toBe(201);

  return body.data;
}

async function createTimeline(
  cookie: string,
  caseId: string,
  evidenceId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await postJson(
    cookie,
    `/api/v1/cases/${caseId}/timeline`,
    {
      occurred_on: "2026-06-02",
      timeline_type: "submission",
      title: "Fictional application submitted",
      details: "Fictional submission entry for local review.",
      evidence_ids: [evidenceId],
      ...overrides,
    },
  );
  const body = await response.json<{ data: { id: string } }>();

  expect(response.status).toBe(201);

  return body.data;
}

async function draftReview(cookie: string, caseId: string) {
  const response = await request(`/api/v1/cases/${caseId}/ai-review/draft`, {
    method: "POST",
    headers: { cookie, origin: localOrigin },
  });
  const body = await response.json<{
    ok: true;
    data: PacketReviewDraftResponseData;
  }>();

  return { response, body };
}

async function packet(cookie: string, caseId: string) {
  const response = await request(`/api/v1/cases/${caseId}/packet`, {
    headers: { cookie },
  });
  const body = await response.json<{ data: { packet: PacketModel } }>();

  expect(response.status).toBe(200);

  return body.data.packet;
}

async function setupWorkspace() {
  const a = await signUp(clientA);
  const b = await signUp(clientB);
  const admin = await signUpAdmin();
  const caseA = await createCase(a.cookie, "A");
  const caseB = await createCase(b.cookie, "B");

  return { a, b, admin, caseA, caseB };
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

function reviewText(data: PacketReviewDraftResponseData): string {
  const review = data.review;

  return [
    review.summary,
    ...review.missing_information,
    ...review.recommended_next_actions,
    ...review.evidence_citations.map((citation) => citation.note),
    ...review.unsupported_claims,
    ...review.confidence_notes,
  ].join("\n");
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(objectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...objectKeys(child),
  ]);
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("AI review draft route", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await request(
      "/api/v1/cases/00000000-0000-4000-8000-000000000001/ai-review/draft",
      { method: "POST" },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("allows a participating client and returns a strict evaluated draft", async () => {
    const { a, caseA } = await setupWorkspace();
    const evidence = await createEvidence(a.cookie, caseA.id);
    await createTimeline(a.cookie, caseA.id, evidence.id);

    const { response, body } = await draftReview(a.cookie, caseA.id);

    expect(response.status).toBe(200);
    expect(packetReviewDraftResponseDataSchema.safeParse(body.data).success).toBe(
      true,
    );
    expect(body.data.metadata).toEqual({
      reviewer: "deterministic-baseline",
      live_ai: false,
      external_calls: false,
    });
    expect(body.data.evaluation.score).toBeGreaterThanOrEqual(80);
    expect(body.data.evaluation.passed).toBe(true);
    expect(body.data.evaluation.citation_validity).toMatchObject({
      score: 100,
      passed: true,
      invalid_citations: [],
    });
    expect(body.data.evaluation.safety).toEqual({ passed: true, warnings: [] });
  });

  it("allows an administrator to generate a review for any case", async () => {
    const { admin, caseA } = await setupWorkspace();
    const { response, body } = await draftReview(admin.cookie, caseA.id);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.metadata.reviewer).toBe("deterministic-baseline");
  });

  it("returns the same safe 404 for unrelated and missing cases", async () => {
    const { a, caseB } = await setupWorkspace();
    const unrelated = await draftReview(a.cookie, caseB.id);
    const missing = await draftReview(
      a.cookie,
      "00000000-0000-4000-8000-000000999999",
    );

    expect(unrelated.response.status).toBe(404);
    expect(missing.response.status).toBe(404);
    expect(unrelated.body).toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
    expect(missing.body).toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
  });

  it("rejects an invalid case ID", async () => {
    const { a } = await setupWorkspace();
    const response = await request(
      "/api/v1/cases/not-a-uuid/ai-review/draft",
      { method: "POST", headers: { cookie: a.cookie, origin: localOrigin } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_CASE_ID" },
    });
  });

  it("cites only evidence, timeline, and activity IDs in the packet snapshot", async () => {
    const { a, caseA } = await setupWorkspace();
    const evidence = await createEvidence(a.cookie, caseA.id);
    await createTimeline(a.cookie, caseA.id, evidence.id);
    const packetModel = await packet(a.cookie, caseA.id);
    const { body } = await draftReview(a.cookie, caseA.id);
    const ids = {
      evidence: new Set(packetModel.evidence_summaries.map((item) => item.id)),
      timeline: new Set(packetModel.timeline_summaries.map((item) => item.id)),
      activity: new Set(
        packetModel.recent_activity_summaries.map((item) => item.id),
      ),
    };

    expect(
      body.data.review.evidence_citations.every((citation) =>
        ids[citation.source_type].has(citation.record_id),
      ),
    ).toBe(true);
  });

  it("reports missing permit/source fields and warns about unverified evidence", async () => {
    const a = await signUp(clientA);
    const caseA = await createCase(a.cookie, "MISSING", {
      permit_number: null,
    });
    await createEvidence(a.cookie, caseA.id, {
      source_url: null,
      source_label: null,
      source_date: null,
    });

    const { body } = await draftReview(a.cookie, caseA.id);
    const missing = body.data.review.missing_information.join("\n");
    const confidence = body.data.review.confidence_notes.join("\n");

    expect(missing).toContain("Permit number is not provided.");
    expect(missing).toContain("Source URL is not provided");
    expect(missing).toContain("Source label is not provided");
    expect(missing).toContain("Source date is not provided");
    expect(confidence).toMatch(/unconfirmed or disputed evidence/i);
  });

  it("does not echo unsafe stored claims or expose private field names", async () => {
    const a = await signUp(clientA);
    const unsafeClaim =
      "Permit will be approved under code section 123 by reviewer Taylor";
    const caseA = await createCase(a.cookie, "SAFE", {
      project_name: unsafeClaim,
      jurisdiction: "Agency confirmed approval",
    });
    const evidence = await createEvidence(a.cookie, caseA.id, {
      title: unsafeClaim,
      summary: "Legally compliant and guaranteed approval.",
    });
    await createTimeline(a.cookie, caseA.id, evidence.id, {
      title: "Inspector Morgan approved by the city",
      details: "The permit will issue.",
    });

    const { response, body } = await draftReview(a.cookie, caseA.id);
    const text = reviewText(body.data);
    const keys = objectKeys(body);

    expect(response.status).toBe(200);
    expect(text).not.toMatch(/will be approved|permit will issue/i);
    expect(text).not.toMatch(/guarantee|legally compliant/i);
    expect(text).not.toMatch(/reviewer Taylor|inspector Morgan/i);
    expect(text).not.toMatch(/code section 123|agency confirmed/i);
    for (const forbiddenKey of [
      "authorization",
      "password",
      "session",
      "account",
      "cookie",
      "token",
      "request_id",
      "created_by_user_id",
      "deleted_at",
      "lifecycle_mutation_nonce",
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("requires no external API call", async () => {
    const { a, caseA } = await setupWorkspace();
    const fetchStub = vi.fn(() => {
      throw new Error("external calls are not allowed");
    });

    vi.stubGlobal("fetch", fetchStub);

    try {
      const { response, body } = await draftReview(a.cookie, caseA.id);

      expect(response.status).toBe(200);
      expect(body.data.metadata.external_calls).toBe(false);
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
