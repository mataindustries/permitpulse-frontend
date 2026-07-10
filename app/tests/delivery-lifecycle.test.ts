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
async function setup() {
  const signup = await post("", "/api/auth/sign-up/email", account);
  const cookie = signup.headers.get("set-cookie")!.split(";", 1)[0];
  const user = await signup.json<{ user: { id: string } }>();
  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?').bind("admin", user.user.id).run();
  const created = await post(cookie, "/api/v1/cases", { project_name: "Delivery lifecycle", client_name: "Fictional client", address: "1 Audit Way", city: "Exampleville", jurisdiction: "Example Building", permit_number: "DL-1", current_status: "ready_for_review" });
  const body = await created.json<{ data: { id: string } }>();
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
