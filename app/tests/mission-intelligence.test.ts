import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { evaluateMissionIntelligence } from "../src/shared/mission-intelligence/evaluate";
import type { MissionFacts } from "../src/shared/mission-intelligence/facts";
import type { Bindings } from "../src/worker/types";
import { app } from "../src/worker/app";

const localOrigin = "http://localhost";
const testSecret = "test-only-mission-intelligence-secret-123456789";

type FactsOverrides = {
  case?: Partial<MissionFacts["case"]>;
  evidence?: Partial<MissionFacts["evidence"]>;
  timeline?: Partial<MissionFacts["timeline"]>;
  delivery?: NonNullable<MissionFacts["delivery"]>;
  evaluatedAt?: string;
};

function facts(overrides: FactsOverrides = {}): MissionFacts {
  const baseline: MissionFacts = {
    case: {
      id: "00000000-0000-4000-8000-000000000001",
      permitNumber: "EX-2026-INTELLIGENCE",
      currentStatus: "ready_for_review",
      updatedAt: "2026-07-10T00:00:00.000Z",
    },
    evidence: {
      total: 1,
      verified: 1,
      unverified: 0,
      disputed: 0,
      sourceComplete: 1,
      deliveryReady: 1,
      records: [],
    },
    timeline: {
      total: 1,
      linked: 1,
      canonicalApprovalLinkedToVerifiedEvidence: false,
      records: [],
    },
    evaluatedAt: "2026-07-10T12:00:00.000Z",
  };

  return {
    ...baseline,
    ...overrides,
    case: { ...baseline.case, ...overrides.case },
    evidence: { ...baseline.evidence, ...overrides.evidence },
    timeline: { ...baseline.timeline, ...overrides.timeline },
  };
}

describe("deterministic Mission Intelligence rules", () => {
  it("clears the verification recommendation when evidence becomes verified and source-complete", () => {
    const result = evaluateMissionIntelligence(facts());

    expect(result.recommendedAction.id).not.toBe("verify-evidence");
    expect(result.blockers.map((blocker) => blocker.id)).not.toContain("unready-evidence");
    expect(result.evidenceHealth).toMatchObject({ score: 100, completed: 2 });
  });

  it("evaluates an empty case without fabricating readiness", () => {
    const result = evaluateMissionIntelligence(
      facts({
        case: { permitNumber: null, currentStatus: "intake" },
        evidence: { total: 0, verified: 0, unverified: 0, disputed: 0, sourceComplete: 0, deliveryReady: 0 },
        timeline: { total: 0, linked: 0, canonicalApprovalLinkedToVerifiedEvidence: false },
      }),
    );

    expect(result.missionState).toBe("Needs Information");
    expect(result.recommendedAction.title).toBe("Add permit number");
    expect(result.missionHealth).toMatchObject({ score: 0, completed: 0, total: 6 });
    expect(result.blockers.map((blocker) => blocker.id)).toEqual(
      expect.arrayContaining(["missing-permit-number", "missing-evidence", "missing-timeline"]),
    );
  });

  it("prioritizes a missing permit number and cites the checked field", () => {
    const result = evaluateMissionIntelligence(facts({ case: { permitNumber: null } }));

    expect(result.recommendedAction).toMatchObject({
      title: "Add permit number",
      targetTab: "overview",
      blocking: true,
      supportingEvidence: ["case:permit-number"],
    });
    expect(result.supportingEvidence).toContainEqual(
      expect.objectContaining({ id: "case:permit-number", detail: "The permit number field is empty." }),
    );
  });

  it("identifies missing evidence after case information is present", () => {
    const result = evaluateMissionIntelligence(
      facts({
        evidence: { total: 0, verified: 0, unverified: 0, disputed: 0, sourceComplete: 0, deliveryReady: 0 },
      }),
    );

    expect(result.missionState).toBe("Needs Evidence");
    expect(result.recommendedAction.title).toBe("Link missing evidence");
    expect(result.blockers[0]).toMatchObject({
      id: "missing-evidence",
      supportingEvidence: ["aggregate:evidence"],
    });
  });

  it("recognizes a complete, evidence-linked timeline", () => {
    const result = evaluateMissionIntelligence(
      facts({ case: { currentStatus: "researching" } }),
    );

    expect(result.timelineHealth).toMatchObject({ score: 100, completed: 2, total: 2 });
    expect(result.completedChecks.map((check) => check.id)).toEqual(
      expect.arrayContaining(["timeline-present", "timeline-supported"]),
    );
    expect(result.missionState).toBe("Needs Review");
  });

  it("marks a fully checked case ready for packet", () => {
    const result = evaluateMissionIntelligence(facts());

    expect(result.missionState).toBe("Ready For Packet");
    expect(result.packetReadiness).toMatchObject({ score: 100, completed: 5, total: 5 });
    expect(result.recommendedAction).toMatchObject({ title: "Generate packet", blocking: false });
  });

  it("uses persisted lifecycle facts for every delivery-related mission state", () => {
    const generated = evaluateMissionIntelligence(facts({ delivery: { state: "packet_generated", latestEventId: "event-1", latestEventType: "packet_generated", packetGenerationId: "packet-1" } }));
    const review = evaluateMissionIntelligence(facts({ delivery: { state: "under_review", latestEventId: "event-2", latestEventType: "review_started", packetGenerationId: "packet-1" } }));
    const approved = evaluateMissionIntelligence(facts({ delivery: { state: "approved_for_delivery", latestEventId: "event-3", latestEventType: "approved_for_delivery", packetGenerationId: "packet-1" } }));
    const delivered = evaluateMissionIntelligence(facts({ delivery: { state: "delivered", latestEventId: "event-4", latestEventType: "delivery_recorded", packetGenerationId: "packet-1" } }));
    const confirmed = evaluateMissionIntelligence(facts({ delivery: { state: "delivery_confirmed", latestEventId: "event-5", latestEventType: "delivery_confirmed", packetGenerationId: "packet-1" } }));

    expect(generated).toMatchObject({ missionState: "Needs Review", recommendedAction: { title: "Mark ready for review" } });
    expect(review).toMatchObject({ missionState: "Needs Review", recommendedAction: { title: "Complete packet review" } });
    expect(approved).toMatchObject({ missionState: "Ready To Deliver", recommendedAction: { title: "Record delivery" } });
    expect(delivered).toMatchObject({ missionState: "Delivered", recommendedAction: { title: "Confirm delivery" } });
    expect(confirmed).toMatchObject({ missionState: "Delivery Confirmed", recommendedAction: { title: "View delivery record" } });
  });

  it("does not infer delivery readiness from a canonical permit approval", () => {
    const result = evaluateMissionIntelligence(
      facts({ timeline: { canonicalApprovalLinkedToVerifiedEvidence: true } }),
    );

    expect(result.missionState).toBe("Ready For Packet");
    expect(result.recommendedAction).toMatchObject({ title: "Generate packet", targetTab: "packet" });
  });

  it("returns mixed findings in stable priority order with one primary action", () => {
    const result = evaluateMissionIntelligence(
      facts({
        case: { currentStatus: "researching" },
        evidence: { total: 2, verified: 0, unverified: 1, disputed: 1, sourceComplete: 1, deliveryReady: 0 },
        timeline: { total: 2, linked: 1 },
      }),
    );

    expect(result.recommendedAction.title).toBe("Verify disputed evidence");
    expect(result.blockers.map((blocker) => blocker.id)).toEqual([
      "disputed-evidence",
      "unready-evidence",
      "unlinked-timeline",
    ]);
    expect(result.warnings.map((warning) => warning.id)).toEqual(["needs-review"]);
    expect(result.secondaryActions.length).toBe(3);
    expect(result.lastEvaluated).toBe("2026-07-10T12:00:00.000Z");
  });
});

const clientA = {
  name: "Avery Intelligence",
  email: "avery.intelligence@example.test",
  password: "Fictional-passphrase-42",
};
const clientB = {
  name: "Blair Intelligence",
  email: "blair.intelligence@example.test",
  password: "Fictional-passphrase-42",
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
    headers: { "content-type": "application/json", origin: localOrigin },
    body: JSON.stringify(account),
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];

  expect(response.status).toBe(200);
  expect(cookie).toBeTruthy();
  return cookie!;
}

async function createCase(cookie: string, projectName: string) {
  const response = await request("/api/v1/cases", {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: localOrigin },
    body: JSON.stringify({
      project_name: projectName,
      client_name: "Fictional Client",
      address: "42 Intelligence Street",
      city: "Exampleville",
      jurisdiction: "Exampleville Building",
      permit_number: "EX-2026-INTELLIGENCE",
      current_status: "intake",
    }),
  });
  const body = await response.json<{ data: { id: string } }>();

  expect(response.status).toBe(201);
  return body.data.id;
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

describe("protected Mission Intelligence endpoint", () => {
  beforeEach(cleanDatabase);

  it("rejects unauthenticated access", async () => {
    const response = await request(
      "/api/v1/mission-intelligence/00000000-0000-4000-8000-000000000001",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("keeps actor-scoped cases isolated", async () => {
    const averyCookie = await signUp(clientA);
    const blairCookie = await signUp(clientB);
    const averyCase = await createCase(averyCookie, "Avery private mission");
    const blairCase = await createCase(blairCookie, "Blair private mission");

    const own = await request(`/api/v1/mission-intelligence/${averyCase}`, {
      headers: { cookie: averyCookie },
    });
    const unrelated = await request(`/api/v1/mission-intelligence/${blairCase}`, {
      headers: { cookie: averyCookie },
    });

    expect(own.status).toBe(200);
    await expect(own.json()).resolves.toMatchObject({
      ok: true,
      data: { intelligence: { missionState: "Needs Evidence" } },
    });
    expect(unrelated.status).toBe(404);
    await expect(unrelated.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "CASE_NOT_FOUND" },
    });
  });

  it("reflects an evidence verification mutation without a page reload", async () => {
    const cookie = await signUp(clientA);
    await env.DB.prepare('UPDATE "user" SET role = ? WHERE email = ?')
      .bind("admin", clientA.email)
      .run();
    const caseId = await createCase(cookie, "Verification refresh mission");
    const createdResponse = await request(`/api/v1/cases/${caseId}/evidence`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: localOrigin },
      body: JSON.stringify({
        evidence_type: "portal",
        title: "Fictional verified permit source",
        summary: "A source-complete record used to verify refresh behavior.",
        source_url: "https://example.test/permit-source",
        source_label: "Example permit portal",
        source_date: "2026-07-11",
      }),
    });
    const created = await createdResponse.json<{ data: { id: string; version: number } }>();
    expect(createdResponse.status).toBe(201);

    const before = await request(`/api/v1/mission-intelligence/${caseId}`, {
      headers: { cookie },
    });
    await expect(before.json()).resolves.toMatchObject({
      data: { intelligence: { recommendedAction: { id: "verify-evidence" } } },
    });

    const verifiedResponse = await request(
      `/api/v1/cases/${caseId}/evidence/${created.data.id}`,
      {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json", origin: localOrigin },
        body: JSON.stringify({
          expected_version: created.data.version,
          verification_status: "verified",
        }),
      },
    );
    expect(verifiedResponse.status).toBe(200);

    const after = await request(`/api/v1/mission-intelligence/${caseId}`, {
      headers: { cookie },
    });
    const afterBody = await after.json<{
      data: { intelligence: { recommendedAction: { id: string }; blockers: Array<{ id: string }> } };
    }>();
    expect(afterBody.data.intelligence.recommendedAction.id).not.toBe("verify-evidence");
    expect(afterBody.data.intelligence.blockers.map((item) => item.id)).not.toContain(
      "unready-evidence",
    );
  });
});
