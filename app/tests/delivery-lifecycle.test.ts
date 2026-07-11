import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const origin = "http://localhost";
const secret = "test-only-delivery-secret-not-for-deployment-123456";
const account = { name: "Delivery Admin", email: "delivery.admin@example.test", password: "Delivery-passphrase-42" };

function bindings(): Bindings {
  return { ADMIN_BOOTSTRAP_ENABLED: "false", APP_ENV: "local", ASSETS: env.ASSETS, AUTH_ALLOW_SIGNUP: "true", AUTH_ENABLED: "true", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: origin, DB: env.DB, ENABLE_DEV_CASE_API: "true" };
}
function request(path: string, init?: RequestInit) { return app.request(`${origin}${path}`, init, bindings()); }
async function post(cookie: string, path: string, body: unknown) {
  return request(path, { method: "POST", headers: { cookie, "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
async function setup(options: { qualityReady?: boolean } = {}) {
  const signup = await post("", "/api/auth/sign-up/email", account);
  const cookie = signup.headers.get("set-cookie")!.split(";", 1)[0];
  const user = await signup.json<{ user: { id: string } }>();
  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?').bind("admin", user.user.id).run();
  const created = await post(cookie, "/api/v1/cases", { project_name: "Delivery lifecycle", client_name: "Fictional client", address: "1 Audit Way", city: "Exampleville", jurisdiction: "Example Building", permit_number: "DL-1", current_status: "ready_for_review" });
  const body = await created.json<{ data: { id: string } }>();
  if (options.qualityReady !== false) {
    const evidenceResponse = await post(cookie, `/api/v1/cases/${body.data.id}/evidence`, {
      evidence_type: "portal",
      title: "Fictional delivery source",
      summary: "Source-complete evidence for delivery lifecycle tests.",
      source_url: "https://example.test/delivery/source",
      source_label: "Example permit portal",
      source_date: "2026-07-10",
    });
    const evidence = await evidenceResponse.json<{ data: { id: string } }>();
    expect(evidenceResponse.status).toBe(201);
    const timelineResponse = await post(cookie, `/api/v1/cases/${body.data.id}/timeline`, {
      occurred_on: "2026-07-10",
      timeline_type: "status_update",
      title: "Fictional delivery status recorded",
      details: "A source-backed delivery test event was recorded.",
      is_canonical: true,
      evidence_ids: [evidence.data.id],
    });
    expect(timelineResponse.status).toBe(201);
  }
  return { cookie, caseId: body.data.id };
}
async function transition(cookie: string, caseId: string, event_type: string, key: string, note: string | null = null) {
  return post(cookie, `/api/v1/cases/${caseId}/delivery-lifecycle/transitions`, { event_type, idempotency_key: key, note });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM delivery_lifecycle_events"), env.DB.prepare("DELETE FROM packet_generations"),
    env.DB.prepare("DELETE FROM timeline_entry_evidence"), env.DB.prepare("DELETE FROM timeline_entries"), env.DB.prepare("DELETE FROM evidence_items"),
    env.DB.prepare("DELETE FROM audit_events"), env.DB.prepare("DELETE FROM case_participants"), env.DB.prepare("DELETE FROM cases"),
    env.DB.prepare("DELETE FROM session"), env.DB.prepare("DELETE FROM account"), env.DB.prepare('DELETE FROM "user"'),
  ]);
});

describe("delivery lifecycle", () => {
  it("starts empty and rejects unauthenticated access", async () => {
    const { cookie, caseId } = await setup();
    expect((await request(`/api/v1/cases/${caseId}/delivery-lifecycle`)).status).toBe(401);
    const response = await request(`/api/v1/cases/${caseId}/delivery-lifecycle`, { headers: { cookie } });
    expect(response.status).toBe(200);
    expect((await response.json<{ data: { lifecycle: { current_state: string; events: unknown[] } } }>()).data.lifecycle).toMatchObject({ current_state: "draft", events: [] });
  });

  it("persists the ordered review, correction, delivery, and confirmation sequence", async () => {
    const { cookie, caseId } = await setup();
    const sequence = ["packet_generated", "review_started", "changes_requested", "packet_generated", "review_started", "approved_for_delivery", "delivery_recorded", "delivery_confirmed"];
    for (const [index, event] of sequence.entries()) {
      const response = await transition(cookie, caseId, event, `ordered-${index}`, index === 2 ? "Correct the cover note" : null);
      expect(response.status, event).toBe(201);
    }
    const response = await request(`/api/v1/cases/${caseId}/delivery-lifecycle`, { headers: { cookie } });
    const lifecycle = (await response.json<{ data: { lifecycle: { current_state: string; events: Array<{ sequence: number; packet_generation_id: string | null }> } } }>()).data.lifecycle;
    expect(lifecycle.current_state).toBe("delivery_confirmed");
    expect(lifecycle.events).toHaveLength(8);
    expect(lifecycle.events[0].sequence).toBe(8);
    expect(new Set(lifecycle.events.map((event) => event.packet_generation_id)).size).toBe(2);
    expect((await transition(cookie, caseId, "changes_requested", "no-revert")).status).toBe(409);
  });

  it("enforces prerequisites and makes identical retries safe", async () => {
    const { cookie, caseId } = await setup();
    expect((await transition(cookie, caseId, "approved_for_delivery", "too-soon")).status).toBe(409);
    const first = await transition(cookie, caseId, "packet_generated", "same-key");
    const retry = await transition(cookie, caseId, "packet_generated", "same-key");
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect((await transition(cookie, caseId, "review_started", "same-key")).status).toBe(409);
    const counts = await env.DB.prepare("SELECT (SELECT count(*) FROM packet_generations) AS packets, (SELECT count(*) FROM delivery_lifecycle_events) AS events").first<{ packets: number; events: number }>();
    expect(counts).toEqual({ packets: 1, events: 1 });
  });

  it("allows generation and review to begin when the quality gate has blockers", async () => {
    const { cookie, caseId } = await setup({ qualityReady: false });
    const generated = await transition(cookie, caseId, "packet_generated", "blocked-draft");
    const generatedBody = await generated.json<{
      data: { lifecycle: { quality: { blockers: Array<{ id: string }> } } };
    }>();

    expect(generated.status).toBe(201);
    expect(generatedBody.data.lifecycle.quality.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["evidence-exists", "timeline-exists"]),
    );
    expect((await transition(cookie, caseId, "review_started", "blocked-review")).status).toBe(201);
  });

  it("blocks approval with exact quality checks", async () => {
    const { cookie, caseId } = await setup({ qualityReady: false });
    await transition(cookie, caseId, "packet_generated", "quality-draft");
    await transition(cookie, caseId, "review_started", "quality-review");
    const response = await transition(cookie, caseId, "approved_for_delivery", "quality-approval");
    const body = await response.json<{
      error: {
        code: string;
        message: string;
        details: { blocking_checks: Array<{ id: string }> };
      };
    }>();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PACKET_QUALITY_BLOCKED");
    expect(body.error.message).toContain("evidence-exists: Evidence register is empty");
    expect(body.error.details.blocking_checks.map((item) => item.id)).toEqual(
      expect.arrayContaining(["evidence-exists", "timeline-exists"]),
    );
  });

  it("blocks approval when the persisted snapshot is stale", async () => {
    const { cookie, caseId } = await setup();
    await transition(cookie, caseId, "packet_generated", "stale-draft");
    await transition(cookie, caseId, "review_started", "stale-review");
    await env.DB.prepare(
      "UPDATE cases SET project_name = ?, version = version + 1, updated_at = ? WHERE id = ?",
    ).bind("Changed after generation", "2026-07-10T15:00:00.000Z", caseId).run();
    const response = await transition(cookie, caseId, "approved_for_delivery", "stale-approval");
    const body = await response.json<{
      error: { details: { blocking_checks: Array<{ id: string }> } };
    }>();

    expect(response.status).toBe(409);
    expect(body.error.details.blocking_checks.map((item) => item.id)).toContain("snapshot-current");
  });

  it("successfully approves a current packet with no blockers", async () => {
    const { cookie, caseId } = await setup();
    await transition(cookie, caseId, "packet_generated", "valid-draft");
    await transition(cookie, caseId, "review_started", "valid-review");
    const response = await transition(cookie, caseId, "approved_for_delivery", "valid-approval");
    const body = await response.json<{
      data: { lifecycle: { current_state: string; quality: { blockers: unknown[]; eligible_for_delivery: boolean } } };
    }>();

    expect(response.status).toBe(201);
    expect(body.data.lifecycle.current_state).toBe("approved_for_delivery");
    expect(body.data.lifecycle.quality.blockers).toEqual([]);
    expect(body.data.lifecycle.quality.eligible_for_delivery).toBe(true);
  });

  it("blocks delivery when approved packet content becomes stale", async () => {
    const { cookie, caseId } = await setup();
    await transition(cookie, caseId, "packet_generated", "delivery-draft");
    await transition(cookie, caseId, "review_started", "delivery-review");
    await transition(cookie, caseId, "approved_for_delivery", "delivery-approval");
    await env.DB.prepare(
      "UPDATE evidence_items SET summary = ?, version = version + 1, updated_at = ? WHERE case_id = ?",
    ).bind("Changed after approval", "2026-07-10T16:00:00.000Z", caseId).run();
    const response = await transition(cookie, caseId, "delivery_recorded", "stale-delivery");
    const body = await response.json<{
      error: { code: string; details: { blocking_checks: Array<{ id: string }> } };
    }>();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("PACKET_QUALITY_BLOCKED");
    expect(body.error.details.blocking_checks.map((item) => item.id)).toContain("snapshot-current");
  });

  it("regenerates a stale approved packet and invalidates the prior approval", async () => {
    const { cookie, caseId } = await setup();
    await transition(cookie, caseId, "packet_generated", "regen-draft");
    await transition(cookie, caseId, "review_started", "regen-review");
    await transition(cookie, caseId, "approved_for_delivery", "regen-approval");
    await env.DB.prepare(
      "UPDATE evidence_items SET summary = ?, version = version + 1, updated_at = ? WHERE case_id = ?",
    ).bind("Revised before delivery", "2026-07-10T17:00:00.000Z", caseId).run();
    const response = await transition(cookie, caseId, "packet_generated", "regen-after-approval");
    const body = await response.json<{
      data: { lifecycle: { current_state: string; quality: { stale_snapshot: boolean } } };
    }>();

    expect(response.status).toBe(201);
    expect(body.data.lifecycle.current_state).toBe("packet_generated");
    expect(body.data.lifecycle.quality.stale_snapshot).toBe(false);
  });

  it("keeps inaccessible cases hidden and records immutable actor audit facts", async () => {
    const owner = await setup();
    const otherSignup = await post("", "/api/auth/sign-up/email", { ...account, email: "other.delivery@example.test" });
    const otherCookie = otherSignup.headers.get("set-cookie")!.split(";", 1)[0];
    expect((await request(`/api/v1/cases/${owner.caseId}/delivery-lifecycle`, { headers: { cookie: otherCookie } })).status).toBe(404);
    await transition(owner.cookie, owner.caseId, "packet_generated", "audit-key", "Generated after source review");
    const row = await env.DB.prepare("SELECT actor_user_id, note, previous_state, resulting_state FROM delivery_lifecycle_events WHERE case_id = ?").bind(owner.caseId).first<Record<string, string>>();
    expect(row).toMatchObject({ note: "Generated after source review", previous_state: "draft", resulting_state: "packet_generated" });
    expect(row?.actor_user_id).toBeTruthy();
  });
});
