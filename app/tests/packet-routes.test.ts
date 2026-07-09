import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { PacketModel } from "../src/shared/packet/types";
import type { Bindings } from "../src/worker/types";

const localOrigin = "http://localhost";
const testSecret = "test-only-packet-secret-not-for-any-deployment-123456";

const fictionalCase = {
  project_name: "Fictional Packet Workspace",
  client_name: "Fictional Packet Client",
  address: "42 Packet Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "PKT-2026-001",
  current_status: "intake" as const,
};

const clientA = {
  name: "Avery Packet Client",
  email: "avery.packet@example.test",
  password: "Fictional-passphrase-42",
};

const clientB = {
  name: "Blair Packet Client",
  email: "blair.packet@example.test",
  password: "Fictional-passphrase-42",
};

const adminUser = {
  name: "Jordan Packet Admin",
  email: "jordan.packet.admin@example.test",
  password: "Admin-fictional-passphrase-42",
};

const evidenceInput = {
  evidence_type: "document",
  title: "Fictional packet notice",
  summary: "Fictional packet evidence summary.",
  source_url: "https://example.test/packet/notice",
  source_label: "Example portal",
  source_date: "2026-01-15",
};

const timelineInput = {
  occurred_on: "2026-01-20",
  timeline_type: "submission",
  title: "Fictional packet application submitted",
  details: "The fictional packet application was submitted for review.",
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

async function createCase(cookie: string, suffix: string) {
  const response = await postJson(cookie, "/api/v1/cases", {
    ...fictionalCase,
    project_name: `${fictionalCase.project_name} ${suffix}`,
    permit_number: `PKT-2026-${suffix}`,
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
    data: typeof evidenceInput & { id: string; version: number };
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
    data: typeof timelineInput & { id: string; version: number };
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

function uuidAt(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

async function insertEvidenceRows(caseId: string, userId: string, count: number) {
  const timestamp = "2026-02-01T00:00:00.000Z";

  await env.DB.batch(
    Array.from({ length: count }, (_, index) =>
      env.DB.prepare(
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
          verification_status,
          version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, 'document', ?, ?, ?, 'Bulk packet fixture', '2026-02-01', 'unverified', 1, ?, ?)`,
      ).bind(
        uuidAt(10_000 + index),
        caseId,
        userId,
        `Bulk evidence ${String(index).padStart(2, "0")}`,
        `Bulk fictional evidence summary ${index}.`,
        `https://example.test/evidence/${index}`,
        timestamp,
        timestamp,
      ),
    ),
  );
}

async function insertTimelineRows(caseId: string, userId: string, count: number) {
  const timestamp = "2026-02-01T00:00:00.000Z";

  await env.DB.batch(
    Array.from({ length: count }, (_, index) =>
      env.DB.prepare(
        `INSERT INTO timeline_entries (
          id,
          case_id,
          created_by_user_id,
          occurred_on,
          timeline_type,
          title,
          details,
          is_canonical,
          version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, '2026-02-01', 'status_update', ?, ?, 0, 1, ?, ?)`,
      ).bind(
        uuidAt(20_000 + index),
        caseId,
        userId,
        `Bulk timeline ${String(index).padStart(2, "0")}`,
        `Bulk fictional timeline details ${index}.`,
        timestamp,
        timestamp,
      ),
    ),
  );
}

async function insertActivityRows(caseId: string, userId: string, count: number) {
  const timestamp = "2026-02-01T00:00:00.000Z";

  await env.DB.batch(
    Array.from({ length: count }, (_, index) =>
      env.DB.prepare(
        `INSERT INTO audit_events (
          id,
          case_id,
          actor_user_id,
          action,
          changed_fields,
          from_status,
          to_status,
          request_id,
          created_at
        ) VALUES (?, ?, ?, 'case_updated', ?, NULL, NULL, ?, ?)`,
      ).bind(
        uuidAt(30_000 + index),
        caseId,
        userId,
        JSON.stringify(["project_name"]),
        `packet-test-${index}`,
        timestamp,
      ),
    ),
  );
}

async function fetchJsonPacket(cookie: string, caseId: string) {
  const response = await request(`/api/v1/cases/${caseId}/packet`, {
    headers: { cookie },
  });
  const body = await response.json<{ ok: true; data: { packet: PacketModel } }>();

  return { response, body };
}

async function fetchPdfPacket(cookie: string, caseId: string) {
  const response = await request(`/api/v1/cases/${caseId}/packet.pdf`, {
    headers: { cookie },
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  return { response, bytes };
}

function expectPdfResponse(response: Response, bytes: Uint8Array) {
  const disposition = response.headers.get("content-disposition");
  const filename = disposition?.match(/filename="([^"]+)"/)?.[1];

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/pdf");
  expect(disposition).toMatch(/^attachment; filename="permitpulse-packet-[a-z0-9-]+\.pdf"$/);
  expect(filename).toBeTruthy();
  expect(filename).not.toMatch(/[\\/\r\n]/);
  expect(bytes.length).toBeGreaterThan(100);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("packet preview routes", () => {
  it("returns 401 for unauthenticated packet routes", async () => {
    const caseId = "00000000-0000-4000-8000-000000000001";
    const responses = await Promise.all([
      request(`/api/v1/cases/${caseId}/packet`),
      request(`/api/v1/cases/${caseId}/packet.txt`),
      request(`/api/v1/cases/${caseId}/packet.html`),
      request(`/api/v1/cases/${caseId}/packet.pdf`),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
  });

  it("allows admins and owner clients to fetch JSON packets", async () => {
    const { a, admin, caseA } = await setupWorkspace();

    await createEvidence(a.cookie, caseA.id);
    await createTimeline(a.cookie, caseA.id);

    const owner = await fetchJsonPacket(a.cookie, caseA.id);
    const adminResult = await fetchJsonPacket(admin.cookie, caseA.id);

    expect(owner.response.status).toBe(200);
    expect(adminResult.response.status).toBe(200);
    expect(owner.body.data.packet.case_summary.project_name).toBe(
      "Fictional Packet Workspace A",
    );
    expect(adminResult.body.data.packet.evidence_summaries).toHaveLength(1);
  });

  it("allows admins and owner clients to export PDF packets", async () => {
    const { a, admin, caseA } = await setupWorkspace();

    await createEvidence(a.cookie, caseA.id);
    await createTimeline(a.cookie, caseA.id);

    const owner = await fetchPdfPacket(a.cookie, caseA.id);
    const adminResult = await fetchPdfPacket(admin.cookie, caseA.id);

    expectPdfResponse(owner.response, owner.bytes);
    expectPdfResponse(adminResult.response, adminResult.bytes);
  });

  it("returns a safe 404 for unrelated clients", async () => {
    const { a, b, caseA, caseB } = await setupWorkspace();

    const unrelated = await request(`/api/v1/cases/${caseB.id}/packet`, {
      headers: { cookie: a.cookie },
    });
    const missing = await request(
      "/api/v1/cases/00000000-0000-4000-8000-000000999999/packet",
      { headers: { cookie: b.cookie } },
    );

    expect(unrelated.status).toBe(404);
    expect(await unrelated.json()).toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
    expect(caseA.id).toBeTruthy();
  });

  it("returns a safe 404 for unrelated PDF exports", async () => {
    const { a, caseB } = await setupWorkspace();
    const response = await request(`/api/v1/cases/${caseB.id}/packet.pdf`, {
      headers: { cookie: a.cookie },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
  });

  it("assembles JSON packet sections from safe case, evidence, timeline, and activity data", async () => {
    const { a, caseA } = await setupWorkspace();
    const keptEvidence = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "<script>alert('packet')</script>",
      summary: "Plain evidence <img src=x onerror=alert(1)>.",
    });
    const deletedEvidence = await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "Deleted packet evidence",
    });
    const keptTimeline = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      evidence_ids: [keptEvidence.id],
      details: "Plain timeline <svg onload=alert(1)>.",
    });
    const deletedTimeline = await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      title: "Deleted packet timeline",
    });

    await env.DB.batch([
      env.DB.prepare("UPDATE evidence_items SET deleted_at = ? WHERE id = ?")
        .bind("2026-03-01T00:00:00.000Z", deletedEvidence.id),
      env.DB.prepare("UPDATE timeline_entries SET deleted_at = ? WHERE id = ?")
        .bind("2026-03-01T00:00:00.000Z", deletedTimeline.id),
    ]);

    const { response, body } = await fetchJsonPacket(a.cookie, caseA.id);
    const packetText = JSON.stringify(body.data.packet).toLowerCase();

    expect(response.status).toBe(200);
    expect(body.data.packet.case_summary.project_name).toBe(
      "Fictional Packet Workspace A",
    );
    expect(body.data.packet.evidence_summaries.map(({ title }) => title)).toEqual([
      "<script>alert('packet')</script>",
    ]);
    expect(body.data.packet.timeline_summaries.map(({ title }) => title)).toEqual([
      keptTimeline.title,
    ]);
    expect(body.data.packet.timeline_summaries[0].linked_evidence).toEqual([
      {
        title: "<script>alert('packet')</script>",
        verification_label: "Unverified",
      },
    ]);
    expect(body.data.packet.recent_activity_summaries.length).toBeGreaterThan(0);
    for (const forbidden of [
      "password",
      "session",
      "account",
      "cookie",
      "token",
      "authorization",
      "request_id",
      "created_by_user_id",
      "deleted_at",
      "lifecycle_mutation_nonce",
      "participant",
    ]) {
      expect(packetText).not.toContain(forbidden);
    }
  });

  it("returns clean plain text packets", async () => {
    const { a, caseA } = await setupWorkspace();

    await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "<b>Unsafe packet evidence</b>",
      summary: "<img src=x onerror=alert(1)>",
    });
    await createTimeline(a.cookie, caseA.id);

    const response = await request(`/api/v1/cases/${caseA.id}/packet.txt`, {
      headers: { cookie: a.cookie },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toContain("inline");
    for (const section of [
      "Packet header",
      "Project summary",
      "Current permit status",
      "Key evidence",
      "Permit timeline",
      "Recent case activity",
      "Disclaimer / internal-review note",
    ]) {
      expect(text).toContain(section);
    }
    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain("&lt;b&gt;Unsafe packet evidence&lt;/b&gt;");
  });

  it("returns escaped script-free HTML packets", async () => {
    const { a, caseA } = await setupWorkspace();

    await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "<script>alert('packet')</script>",
      summary: "<img src=x onerror=alert(1)>",
      source_url: "https://example.test/safe-source",
    });
    await createTimeline(a.cookie, caseA.id, {
      ...timelineInput,
      title: "<script>timeline</script>",
      details: "<svg onload=alert(1)>",
    });

    const response = await request(`/api/v1/cases/${caseA.id}/packet.html`, {
      headers: { cookie: a.cookie },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(html).toContain("&lt;script&gt;alert(&#39;packet&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src&#61;x onerror&#61;alert(1)&gt;");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    for (const section of [
      "Project summary",
      "Current permit status",
      "Key evidence",
      "Permit timeline",
      "Recent case activity",
      "Disclaimer / internal-review note",
    ]) {
      expect(html).toContain(section);
    }
  });

  it("returns non-empty PDF packets without obvious private field names", async () => {
    const { a, caseA } = await setupWorkspace();

    await createEvidence(a.cookie, caseA.id, {
      ...evidenceInput,
      title: "<b>Unsafe packet evidence</b>",
      summary: "<img src=x onerror=alert(1)>",
    });
    await createTimeline(a.cookie, caseA.id);

    const { response, bytes } = await fetchPdfPacket(a.cookie, caseA.id);
    const pdfText = new TextDecoder("latin1").decode(bytes).toLowerCase();

    expectPdfResponse(response, bytes);
    for (const forbidden of [
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
      expect(pdfText).not.toContain(forbidden);
    }
  });

  it("uses bounded deterministic source lists for packet assembly", async () => {
    const { a, admin, caseA } = await setupWorkspace();

    await env.DB.prepare("DELETE FROM audit_events WHERE case_id = ?")
      .bind(caseA.id)
      .run();
    await insertEvidenceRows(caseA.id, a.userId, 55);
    await insertTimelineRows(caseA.id, a.userId, 55);
    await insertActivityRows(caseA.id, a.userId, 30);

    const { response, body } = await fetchJsonPacket(admin.cookie, caseA.id);
    const packet = body.data.packet;

    expect(response.status).toBe(200);
    expect(packet.evidence_summaries).toHaveLength(50);
    expect(packet.timeline_summaries).toHaveLength(50);
    expect(packet.recent_activity_summaries).toHaveLength(25);
    expect(packet.evidence_summaries.slice(0, 3).map(({ title }) => title)).toEqual([
      "Bulk evidence 54",
      "Bulk evidence 53",
      "Bulk evidence 52",
    ]);
    expect(packet.timeline_summaries.slice(0, 3).map(({ title }) => title)).toEqual([
      "Bulk timeline 54",
      "Bulk timeline 53",
      "Bulk timeline 52",
    ]);
  });

  it("uses the same bounded packet assembly limits for PDF export", async () => {
    const { a, admin, caseA } = await setupWorkspace();

    await env.DB.prepare("DELETE FROM audit_events WHERE case_id = ?")
      .bind(caseA.id)
      .run();
    await insertEvidenceRows(caseA.id, a.userId, 55);
    await insertTimelineRows(caseA.id, a.userId, 55);
    await insertActivityRows(caseA.id, a.userId, 30);

    const pdf = await fetchPdfPacket(admin.cookie, caseA.id);
    const json = await fetchJsonPacket(admin.cookie, caseA.id);

    expectPdfResponse(pdf.response, pdf.bytes);
    expect(json.body.data.packet.evidence_summaries).toHaveLength(50);
    expect(json.body.data.packet.timeline_summaries).toHaveLength(50);
    expect(json.body.data.packet.recent_activity_summaries).toHaveLength(25);
  });

  it("rejects invalid packet case IDs safely", async () => {
    const { a } = await setupWorkspace();
    const response = await request("/api/v1/cases/not-a-uuid/packet", {
      headers: { cookie: a.cookie },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_CASE_ID" },
    });
  });

  it("rejects invalid packet PDF case IDs safely", async () => {
    const { a } = await setupWorkspace();
    const response = await request("/api/v1/cases/not-a-uuid/packet.pdf", {
      headers: { cookie: a.cookie },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_CASE_ID" },
    });
  });
});
