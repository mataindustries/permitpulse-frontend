import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-auth-secret-not-for-any-deployment-123456";

const fictionalCase = {
  project_name: "Fictional Evidence Workspace",
  client_name: "Fictional Client",
  address: "42 Evidence Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "EV-2026-001",
  current_status: "intake" as const,
};

const clientA = {
  name: "Avery Evidence Client",
  email: "avery.evidence@example.test",
  password: "Fictional-passphrase-42",
};

const clientB = {
  name: "Blair Timeline Client",
  email: "blair.timeline@example.test",
  password: "Fictional-passphrase-42",
};

const adminUser = {
  name: "Jordan Evidence Admin",
  email: "jordan.evidence.admin@example.test",
  password: "Admin-fictional-passphrase-42",
};

const evidenceInput = {
  evidence_type: "document",
  title: "Fictional plan check notice",
  summary: "Fictional notice from the permit portal.",
  source_url: "https://example.test/notices/plan-check",
  source_label: "Example portal",
  source_date: "2026-01-15",
};

const timelineInput = {
  occurred_on: "2026-01-20",
  timeline_type: "submission",
  title: "Fictional application submitted",
  details: "The fictional application was submitted for review.",
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

async function postJson(cookie: string, path: string, body: Record<string, unknown>) {
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

async function patchJson(cookie: string, path: string, body: Record<string, unknown>) {
  return request(path, {
    method: "PATCH",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: localOrigin,
    },
    body: JSON.stringify(body),
  });
}

async function deleteWithCookie(cookie: string, path: string) {
  return request(path, {
    method: "DELETE",
    headers: {
      cookie,
      origin: localOrigin,
    },
  });
}

async function createCase(cookie: string, suffix: string) {
  const response = await postJson(cookie, "/api/v1/cases", {
    ...fictionalCase,
    project_name: `${fictionalCase.project_name} ${suffix}`,
    permit_number: `EV-2026-${suffix}`,
  });
  const body = await response.json<{
    data: typeof fictionalCase & { id: string; version: number };
  }>();

  expect(response.status).toBe(201);

  return body.data;
}

async function createEvidence(
  cookie: string,
  caseId: string,
  body: Record<string, unknown> = evidenceInput,
) {
  const response = await postJson(cookie, `/api/v1/cases/${caseId}/evidence`, body);
  const payload = await response.json<{
    data: typeof evidenceInput & {
      id: string;
      verification_status: string;
      version: number;
      contributor: { id: string; name: string | null };
    };
  }>();

  expect(response.status).toBe(201);

  return payload.data;
}

async function createTimeline(
  cookie: string,
  caseId: string,
  body: Record<string, unknown> = timelineInput,
) {
  const response = await postJson(cookie, `/api/v1/cases/${caseId}/timeline`, body);
  const payload = await response.json<{
    data: typeof timelineInput & {
      id: string;
      is_canonical: boolean;
      evidence_ids: string[];
      version: number;
      contributor: { id: string; name: string | null };
    };
  }>();

  expect(response.status).toBe(201);

  return payload.data;
}

async function setupWorkspace() {
  const a = await signUp(clientA);
  const b = await signUp(clientB);
  const admin = await signUpAdmin();
  const caseA = await createCase(a.cookie, "A");
  const caseB = await createCase(b.cookie, "B");
  const adminCase = await createCase(admin.cookie, "ADMIN");

  return { a, b, admin, caseA, caseB, adminCase };
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

describe("evidence and timeline authentication and isolation", () => {
  it("returns 401 for unauthenticated evidence and timeline routes", async () => {
    const caseId = "00000000-0000-4000-8000-000000000001";
    const recordId = "00000000-0000-4000-8000-000000000002";

    const responses = await Promise.all([
      request(`/api/v1/cases/${caseId}/evidence`),
      request(`/api/v1/cases/${caseId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: localOrigin },
        body: JSON.stringify(evidenceInput),
      }),
      request(`/api/v1/cases/${caseId}/evidence/${recordId}`),
      request(`/api/v1/cases/${caseId}/timeline`),
      request(`/api/v1/cases/${caseId}/timeline`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: localOrigin },
        body: JSON.stringify(timelineInput),
      }),
      request(`/api/v1/cases/${caseId}/timeline/${recordId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: localOrigin },
        body: JSON.stringify({ evidence_id: recordId }),
      }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([
      401,
      401,
      401,
      401,
      401,
      401,
    ]);
  });

  it("keeps client evidence and timeline isolated by case", async () => {
    const { a, b, admin, caseA, caseB } = await setupWorkspace();
    const evidenceB = await createEvidence(b.cookie, caseB.id);
    const timelineB = await createTimeline(b.cookie, caseB.id);
    const clientAList = await request(`/api/v1/cases/${caseB.id}/evidence`, {
      headers: { cookie: a.cookie },
    });
    const clientATimeline = await request(`/api/v1/cases/${caseB.id}/timeline`, {
      headers: { cookie: a.cookie },
    });
    const crossCaseEvidence = await request(
      `/api/v1/cases/${caseA.id}/evidence/${evidenceB.id}`,
      { headers: { cookie: a.cookie } },
    );
    const crossCaseTimeline = await request(
      `/api/v1/cases/${caseA.id}/timeline/${timelineB.id}`,
      { headers: { cookie: a.cookie } },
    );
    const adminEvidence = await request(`/api/v1/cases/${caseB.id}/evidence`, {
      headers: { cookie: admin.cookie },
    });
    const adminTimeline = await request(`/api/v1/cases/${caseB.id}/timeline`, {
      headers: { cookie: admin.cookie },
    });

    expect(clientAList.status).toBe(404);
    expect(clientATimeline.status).toBe(404);
    expect(crossCaseEvidence.status).toBe(404);
    expect(crossCaseTimeline.status).toBe(404);
    expect(adminEvidence.status).toBe(200);
    expect(adminTimeline.status).toBe(200);
  });
});

describe("evidence API", () => {
  it("lets clients create unverified evidence and rejects privilege injection", async () => {
    const { a, caseA } = await setupWorkspace();
    const record = await createEvidence(a.cookie, caseA.id);
    const injected = await postJson(a.cookie, `/api/v1/cases/${caseA.id}/evidence`, {
      ...evidenceInput,
      verification_status: "verified",
    });

    expect(record).toMatchObject({
      evidence_type: "document",
      title: evidenceInput.title,
      verification_status: "unverified",
      version: 1,
    });
    expect(record.contributor.id).toBe(a.userId);
    expect(injected.status).toBe(400);
  });

  it("allows admin verification while denying client verification", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const record = await createEvidence(a.cookie, caseA.id);
    const clientVerify = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        verification_status: "verified",
      },
    );
    const adminVerify = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        verification_status: "verified",
      },
    );
    const body = await adminVerify.json<{ data: { verification_status: string; version: number } }>();

    expect(clientVerify.status).toBe(403);
    expect(adminVerify.status).toBe(200);
    expect(body.data).toMatchObject({
      verification_status: "verified",
      version: 2,
    });
  });

  it("preserves omitted source fields when summary and verification change", async () => {
    const { admin, caseA } = await setupWorkspace();
    const record = await createEvidence(admin.cookie, caseA.id);
    const summaryOnly = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        summary: "Updated fictional summary only.",
      },
    );
    const summaryOnlyBody = await summaryOnly.json<{
      data: {
        source_url: string | null;
        source_label: string | null;
        source_date: string | null;
        summary: string;
        verification_status: string;
        version: number;
      };
    }>();
    const verificationOnly = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 2,
        verification_status: "verified",
      },
    );
    const verificationOnlyBody = await verificationOnly.json<typeof summaryOnlyBody>();
    const summaryAndVerification = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 3,
        summary: "Updated fictional summary and verification.",
        verification_status: "disputed",
      },
    );
    const summaryAndVerificationBody = await summaryAndVerification.json<
      typeof summaryOnlyBody
    >();

    expect(summaryOnly.status).toBe(200);
    expect(summaryOnlyBody.data).toMatchObject({
      source_url: evidenceInput.source_url,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      summary: "Updated fictional summary only.",
      verification_status: "unverified",
      version: 2,
    });
    expect(verificationOnly.status).toBe(200);
    expect(verificationOnlyBody.data).toMatchObject({
      source_url: evidenceInput.source_url,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      summary: "Updated fictional summary only.",
      verification_status: "verified",
      version: 3,
    });
    expect(summaryAndVerification.status).toBe(200);
    expect(summaryAndVerificationBody.data).toMatchObject({
      source_url: evidenceInput.source_url,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      summary: "Updated fictional summary and verification.",
      verification_status: "disputed",
      version: 4,
    });
  });

  it("clears nullable source fields only when explicit null is supplied", async () => {
    const { admin, caseA } = await setupWorkspace();
    const record = await createEvidence(admin.cookie, caseA.id);
    const clearUrl = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        source_url: null,
      },
    );
    const clearUrlBody = await clearUrl.json<{
      data: {
        source_url: string | null;
        source_label: string | null;
        source_date: string | null;
        version: number;
      };
    }>();
    const clearLabel = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 2,
        source_label: null,
      },
    );
    const clearLabelBody = await clearLabel.json<typeof clearUrlBody>();
    const clearDate = await patchJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 3,
        source_date: null,
      },
    );
    const clearDateBody = await clearDate.json<typeof clearUrlBody>();

    expect(clearUrl.status).toBe(200);
    expect(clearUrlBody.data).toMatchObject({
      source_url: null,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      version: 2,
    });
    expect(clearLabel.status).toBe(200);
    expect(clearLabelBody.data).toMatchObject({
      source_url: null,
      source_label: null,
      source_date: evidenceInput.source_date,
      version: 3,
    });
    expect(clearDate.status).toBe(200);
    expect(clearDateBody.data).toMatchObject({
      source_url: null,
      source_label: null,
      source_date: null,
      version: 4,
    });
  });

  it("keeps no-change, stale-version, and client verification restrictions safe", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const record = await createEvidence(a.cookie, caseA.id);
    const updated = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        summary: "Updated fictional evidence summary.",
      },
    );
    const updatedBody = await updated.json<{
      data: {
        source_url: string | null;
        source_label: string | null;
        source_date: string | null;
        summary: string;
        version: number;
      };
    }>();
    const stale = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 1,
        source_url: null,
        summary: "Fictional stale source clear.",
      },
    );
    const noChange = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 2,
        summary: "Updated fictional evidence summary.",
      },
    );
    const clientVerify = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      {
        expected_version: 2,
        verification_status: "verified",
      },
    );
    const afterRejected = await request(
      `/api/v1/cases/${caseA.id}/evidence/${record.id}`,
      { headers: { cookie: admin.cookie } },
    );
    const afterRejectedBody = await afterRejected.json<typeof updatedBody>();

    expect(updated.status).toBe(200);
    expect(updatedBody.data).toMatchObject({
      source_url: evidenceInput.source_url,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      summary: "Updated fictional evidence summary.",
      version: 2,
    });
    expect(stale.status).toBe(409);
    expect(noChange.status).toBe(400);
    expect(clientVerify.status).toBe(403);
    expect(afterRejectedBody.data).toMatchObject({
      source_url: evidenceInput.source_url,
      source_label: evidenceInput.source_label,
      source_date: evidenceInput.source_date,
      summary: "Updated fictional evidence summary.",
      version: 2,
    });
  });

  it("enforces contributor ownership, stale versions, no-change updates, URLs, and null URLs", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const own = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      source_url: null,
    });
    const adminRecord = await createEvidence(admin.cookie, caseA.id, {
      ...evidenceInput,
      title: "Fictional admin evidence",
    });
    const invalidUrl = await postJson(a.cookie, `/api/v1/cases/${caseA.id}/evidence`, {
      ...evidenceInput,
      source_url: "javascript:alert(1)",
    });
    const updateOwn = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${own.id}`,
      {
        expected_version: 1,
        summary: "Updated fictional evidence summary.",
      },
    );
    const updateOwnBody = await updateOwn.json<{ data: { version: number; source_url: string | null } }>();
    const stale = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${own.id}`,
      {
        expected_version: 1,
        title: "Fictional stale title",
      },
    );
    const noChange = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${own.id}`,
      {
        expected_version: 2,
        summary: "Updated fictional evidence summary.",
      },
    );
    const otherContributor = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/evidence/${adminRecord.id}`,
      {
        expected_version: 1,
        summary: "Fictional unauthorized update.",
      },
    );

    expect(own.source_url).toBeNull();
    expect(invalidUrl.status).toBe(400);
    expect(updateOwn.status).toBe(200);
    expect(updateOwnBody.data).toMatchObject({
      version: 2,
      source_url: null,
    });
    expect(stale.status).toBe(409);
    expect(noChange.status).toBe(400);
    expect(otherContributor.status).toBe(403);
  });

  it("orders evidence deterministically and excludes soft-deleted rows", async () => {
    const { a, caseA } = await setupWorkspace();
    const undated = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "Undated evidence",
      source_date: null,
    });
    const older = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "Older evidence",
      source_date: "2026-01-01",
    });
    const newer = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "Newer evidence",
      source_date: "2026-02-01",
    });

    await env.DB.prepare(
      "UPDATE evidence_items SET deleted_at = ? WHERE id = ?",
    )
      .bind("2026-03-01T00:00:00.000Z", older.id)
      .run();

    const list = await request(`/api/v1/cases/${caseA.id}/evidence?limit=1`, {
      headers: { cookie: a.cookie },
    });
    const body = await list.json<{
      data: {
        evidence: Array<{ id: string; title: string }>;
        pagination: { limit: number; offset: number };
        order: string;
      };
    }>();
    const fullList = await request(`/api/v1/cases/${caseA.id}/evidence`, {
      headers: { cookie: a.cookie },
    });
    const fullBody = await fullList.json<typeof body>();
    const deletedDetail = await request(
      `/api/v1/cases/${caseA.id}/evidence/${older.id}`,
      { headers: { cookie: a.cookie } },
    );

    expect(body.data.pagination).toEqual({ limit: 1, offset: 0 });
    expect(body.data.order).toBe("source_date_desc_nulls_last_created_at_desc");
    expect(fullBody.data.evidence.map(({ id }) => id)).toEqual([
      newer.id,
      undated.id,
    ]);
    expect(deletedDetail.status).toBe(404);
  });
});

describe("timeline API", () => {
  it("lets clients create non-canonical entries and blocks client canonical writes", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const clientEntry = await createTimeline(a.cookie, caseA.id);
    const clientCanonical = await postJson(a.cookie, `/api/v1/cases/${caseA.id}/timeline`, {
      ...timelineInput,
      is_canonical: true,
    });
    const adminCanonical = await createTimeline(admin.cookie, caseA.id, {
      ...timelineInput,
      title: "Canonical fictional submission",
      is_canonical: true,
    });

    expect(clientEntry.is_canonical).toBe(false);
    expect(clientEntry.contributor.id).toBe(a.userId);
    expect(clientCanonical.status).toBe(403);
    expect(adminCanonical.is_canonical).toBe(true);
  });

  it("enforces timeline ownership, canonical restrictions, stale versions, and date validation", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const clientEntry = await createTimeline(a.cookie, caseA.id);
    const canonical = await createTimeline(admin.cookie, caseA.id, {
      ...timelineInput,
      title: "Canonical entry",
      is_canonical: true,
    });
    const invalidDate = await postJson(a.cookie, `/api/v1/cases/${caseA.id}/timeline`, {
      ...timelineInput,
      occurred_on: "2026-02-30",
    });
    const updateOwn = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${clientEntry.id}`,
      {
        expected_version: 1,
        details: "Updated fictional timeline details.",
      },
    );
    const stale = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${clientEntry.id}`,
      {
        expected_version: 1,
        title: "Fictional stale timeline title",
      },
    );
    const editCanonical = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${canonical.id}`,
      {
        expected_version: 1,
        details: "Client should not edit canonical history.",
      },
    );
    const makeCanonical = await patchJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${clientEntry.id}`,
      {
        expected_version: 2,
        is_canonical: true,
      },
    );
    const updateBody = await updateOwn.json<{ data: { version: number; details: string } }>();

    expect(invalidDate.status).toBe(400);
    expect(updateOwn.status).toBe(200);
    expect(updateBody.data).toMatchObject({
      version: 2,
      details: "Updated fictional timeline details.",
    });
    expect(stale.status).toBe(409);
    expect(editCanonical.status).toBe(403);
    expect(makeCanonical.status).toBe(403);
  });

  it("orders timeline entries deterministically and excludes soft-deleted rows", async () => {
    const { a, caseA } = await setupWorkspace();
    const older = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      title: "Older timeline",
      occurred_on: "2026-01-01",
    });
    const newer = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      title: "Newer timeline",
      occurred_on: "2026-02-01",
    });
    const deleted = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      title: "Deleted timeline",
      occurred_on: "2026-03-01",
    });

    await env.DB.prepare(
      "UPDATE timeline_entries SET deleted_at = ? WHERE id = ?",
    )
      .bind("2026-03-02T00:00:00.000Z", deleted.id)
      .run();

    const list = await request(`/api/v1/cases/${caseA.id}/timeline?limit=1`, {
      headers: { cookie: a.cookie },
    });
    const body = await list.json<{
      data: {
        timeline: Array<{ id: string; title: string }>;
        pagination: { limit: number; offset: number };
        order: string;
      };
    }>();
    const fullList = await request(`/api/v1/cases/${caseA.id}/timeline`, {
      headers: { cookie: a.cookie },
    });
    const fullBody = await fullList.json<typeof body>();
    const deletedDetail = await request(
      `/api/v1/cases/${caseA.id}/timeline/${deleted.id}`,
      { headers: { cookie: a.cookie } },
    );

    expect(body.data.pagination).toEqual({ limit: 1, offset: 0 });
    expect(body.data.order).toBe("occurred_on_desc_created_at_desc");
    expect(fullBody.data.timeline.map(({ id }) => id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(deletedDetail.status).toBe(404);
  });
});

describe("timeline evidence links", () => {
  it("supports valid links, rejects duplicates and cross-case atomic creation", async () => {
    const { a, admin, caseA, caseB } = await setupWorkspace();
    const evidenceA = await createEvidence(a.cookie, caseA.id);
    const evidenceB = await createEvidence(admin.cookie, caseB.id);
    const timelineA = await createTimeline(admin.cookie, caseA.id);
    const adminLink = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${timelineA.id}/evidence`,
      { evidence_id: evidenceA.id },
    );
    const duplicate = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${timelineA.id}/evidence`,
      { evidence_id: evidenceA.id },
    );
    const crossCaseCreate = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/timeline`,
      {
        ...timelineInput,
        title: "Cross-case rejected timeline",
        evidence_ids: [evidenceB.id],
      },
    );
    const crossCaseRows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM timeline_entries WHERE title = ?",
    )
      .bind("Cross-case rejected timeline")
      .first<{ count: number }>();
    const body = await adminLink.json<{ data: { evidence_ids: string[] } }>();

    expect(adminLink.status).toBe(200);
    expect(body.data.evidence_ids).toEqual([evidenceA.id]);
    expect(duplicate.status).toBe(409);
    expect(crossCaseCreate.status).toBe(400);
    expect(crossCaseRows?.count).toBe(0);
  });

  it("allows permitted client links and removes only the link", async () => {
    const { a, caseA } = await setupWorkspace();
    const evidence = await createEvidence(a.cookie, caseA.id);
    const timeline = await createTimeline(a.cookie, caseA.id);
    const link = await postJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${timeline.id}/evidence`,
      { evidence_id: evidence.id },
    );
    const unlink = await deleteWithCookie(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${timeline.id}/evidence/${evidence.id}`,
    );
    const linkCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM timeline_entry_evidence",
    ).first<{ count: number }>();
    const evidenceCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM evidence_items WHERE id = ?",
    )
      .bind(evidence.id)
      .first<{ count: number }>();
    const timelineCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM timeline_entries WHERE id = ?",
    )
      .bind(timeline.id)
      .first<{ count: number }>();

    expect(link.status).toBe(200);
    expect(unlink.status).toBe(200);
    expect(linkCount?.count).toBe(0);
    expect(evidenceCount?.count).toBe(1);
    expect(timelineCount?.count).toBe(1);
  });

  it("blocks client links to other contributors, canonical entries, and soft-deleted evidence", async () => {
    const { a, admin, caseA } = await setupWorkspace();
    const clientEvidence = await createEvidence(a.cookie, caseA.id);
    const adminEvidence = await createEvidence(admin.cookie, caseA.id, {
      ...evidenceInput,
      title: "Admin-owned evidence",
    });
    const clientTimeline = await createTimeline(a.cookie, caseA.id);
    const canonicalTimeline = await createTimeline(admin.cookie, caseA.id, {
      ...timelineInput,
      title: "Canonical link target",
      is_canonical: true,
    });
    const otherContributor = await postJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${clientTimeline.id}/evidence`,
      { evidence_id: adminEvidence.id },
    );
    const canonical = await postJson(
      a.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${canonicalTimeline.id}/evidence`,
      { evidence_id: clientEvidence.id },
    );
    const linkBeforeDelete = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${canonicalTimeline.id}/evidence`,
      { evidence_id: clientEvidence.id },
    );

    await env.DB.prepare(
      "UPDATE evidence_items SET deleted_at = ? WHERE id = ?",
    )
      .bind("2026-04-01T00:00:00.000Z", clientEvidence.id)
      .run();

    const timelineAfterDelete = await request(
      `/api/v1/cases/${caseA.id}/timeline/${canonicalTimeline.id}`,
      { headers: { cookie: admin.cookie } },
    );
    const timelineAfterDeleteBody = await timelineAfterDelete.json<{
      data: { evidence_ids: string[] };
    }>();
    const deletedEvidence = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseA.id}/timeline/${canonicalTimeline.id}/evidence`,
      { evidence_id: clientEvidence.id },
    );

    expect(otherContributor.status).toBe(403);
    expect(canonical.status).toBe(403);
    expect(linkBeforeDelete.status).toBe(200);
    expect(timelineAfterDeleteBody.data.evidence_ids).toEqual([]);
    expect(deletedEvidence.status).toBe(404);
  });
});

describe("evidence and timeline response safety", () => {
  it("returns safe DTOs and stores XSS-like strings as plain data", async () => {
    const { a, caseA } = await setupWorkspace();
    const evidence = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "<script>alert('fictional')</script>",
      summary: "Plain text <img src=x onerror=alert(1)> evidence.",
    });
    const timeline = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      evidence_ids: [evidence.id],
      details: "Plain text <svg onload=alert(1)> timeline.",
    });
    const detail = await request(
      `/api/v1/cases/${caseA.id}/timeline/${timeline.id}`,
      { headers: { cookie: a.cookie } },
    );
    const text = await detail.text();
    const lower = text.toLowerCase();

    expect(detail.status).toBe(200);
    expect(text).toContain("<svg onload=alert(1)>");
    expect(text).toContain(evidence.id);
    for (const forbidden of [
      "password",
      "account",
      "session",
      "cookie",
      "token",
      "authorization",
      "request_id",
      "created_by_user_id",
      "deleted_at",
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });
});
