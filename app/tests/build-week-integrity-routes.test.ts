import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IntegrityAnalystOutput,
  IntegrityDraftItem,
  IntegrityReviewRun,
  IntegritySynthesisOutput,
} from "../src/shared/build-week-integrity/types";
import { buildWeekUnsupportedReassignmentFinding } from "../src/shared/build-week-integrity/demo";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const origin = "http://localhost";
const secret = "build-week-integrity-test-secret-12345678901234567890";
const account = {
  name: "Build Week Integrity Admin",
  email: "integrity-admin@example.test",
  password: "Fictional-integrity-passphrase-42",
};

function bindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    ADMIN_BOOTSTRAP_ENABLED: "false",
    APP_ENV: "local",
    ASSETS: env.ASSETS,
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_ENABLED: "true",
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    BUILD_WEEK_DEMO_MODE: "true",
    BUILD_WEEK_INTEGRITY_ENABLED: "true",
    BUILD_WEEK_INTEGRITY_LIVE_ENABLED: "true",
    DB: env.DB,
    ENABLE_DEV_CASE_API: "true",
    OPENAI_API_KEY: "test-only-openai-key",
    ...overrides,
  };
}

function request(path: string, init?: RequestInit, runtimeBindings = bindings()) {
  return app.request(`${origin}${path}`, init, runtimeBindings);
}

async function postJson(cookie: string, path: string, body: unknown) {
  return request(path, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

async function signUpAdmin(): Promise<{ cookie: string; userId: string }> {
  const response = await postJson("", "/api/auth/sign-up/email", account);
  expect(response.status).toBe(200);
  const body = await response.json<{ user: { id: string } }>();
  await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?')
    .bind("admin", body.user.id)
    .run();
  return {
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0],
    userId: body.user.id,
  };
}

async function signUpClient(): Promise<{ cookie: string; userId: string }> {
  const response = await postJson("", "/api/auth/sign-up/email", {
    name: "Build Week Integrity Client",
    email: "integrity-client@example.test",
    password: "Fictional-integrity-passphrase-42",
  });
  expect(response.status).toBe(200);
  const body = await response.json<{ user: { id: string } }>();
  return {
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0],
    userId: body.user.id,
  };
}

async function seedDemo(cookie: string): Promise<string> {
  const response = await postJson(
    cookie,
    "/api/dev/cases/demo/arroyo-vista",
    undefined,
  );
  expect(response.status).toBe(201);
  return (await response.json<{ data: { case_id: string } }>()).data.case_id;
}

async function evidenceByTitle(caseId: string): Promise<Map<string, string>> {
  const result = await env.DB.prepare(
    "SELECT id, title FROM evidence_items WHERE case_id = ? AND deleted_at IS NULL",
  )
    .bind(caseId)
    .all<{ id: string; title: string }>();
  return new Map(result.results.map((row) => [row.title, row.id]));
}

function item(
  evidenceIds: string[],
  overrides: Partial<IntegrityDraftItem> = {},
): IntegrityDraftItem {
  return {
    category: "evidence_contradiction",
    severity: "high",
    confidence: 94,
    title: "Receipt and portal reflect different workflow stages",
    verified_fact:
      "The intake receipt confirms upload while the portal record remains at Corrections Issued.",
    inference:
      "The public portal may not yet reflect the post-intake routing state.",
    unknown: "The cited evidence does not confirm a current reviewer assignment.",
    rationale:
      "Receipt and portal records support different stages, and neither proves reviewer reassignment.",
    evidence_ids: evidenceIds,
    proposed_corrective_action:
      "Request written confirmation of the current routing stage and assigned reviewer.",
    packet_readiness_impact: "blocks_release",
    source_analysts: ["evidence_auditor"],
    ...overrides,
  };
}

function responseEnvelope(id: string, output: unknown): Response {
  return Response.json({
    id,
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(output) }],
      },
    ],
  });
}

async function cleanDatabase(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM build_week_integrity_decision_events"),
    env.DB.prepare("DELETE FROM build_week_integrity_item_evidence"),
    env.DB.prepare("DELETE FROM build_week_integrity_items"),
    env.DB.prepare("DELETE FROM build_week_integrity_stages"),
    env.DB.prepare("DELETE FROM build_week_integrity_runs"),
    env.DB.prepare("DELETE FROM reviewer_revisions"),
    env.DB.prepare("DELETE FROM reviewer_action_kit_timeline"),
    env.DB.prepare("DELETE FROM reviewer_action_kit_evidence"),
    env.DB.prepare("DELETE FROM reviewer_action_kits"),
    env.DB.prepare("DELETE FROM reviewer_finding_timeline"),
    env.DB.prepare("DELETE FROM reviewer_finding_evidence"),
    env.DB.prepare("DELETE FROM reviewer_action_evidence"),
    env.DB.prepare("DELETE FROM reviewer_notes"),
    env.DB.prepare("DELETE FROM reviewer_actions"),
    env.DB.prepare("DELETE FROM reviewer_questions"),
    env.DB.prepare("DELETE FROM reviewer_findings"),
    env.DB.prepare("DELETE FROM delivery_lifecycle_events"),
    env.DB.prepare("DELETE FROM packet_generations"),
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
  vi.unstubAllGlobals();
  await cleanDatabase();
});

describe("OpenAI Build Week Integrity Review Worker pipeline", () => {
  it("runs parallel Terra analysts, persists pending Sol items, audits review, and reuses identical input", async () => {
    const admin = await signUpAdmin();
    const caseId = await seedDemo(admin.cookie);
    const ids = await evidenceByTitle(caseId);
    const receipt = ids.get("Resubmittal confirmation receipt")!;
    const portal = ids.get("Permit portal status capture")!;
    const routingEmail = ids.get("Reviewer routing email note")!;
    expect([receipt, portal, routingEmail].every(Boolean)).toBe(true);

    const analystOutputs: Record<string, IntegrityAnalystOutput> = {
      permitpulse_evidence_auditor_v1: {
        analyst_summary:
          "The receipt and portal records do not establish the same workflow stage.",
        observations: [item([receipt, portal])],
      },
      permitpulse_chronology_analyst_v1: {
        analyst_summary:
          "The later intake record is not reflected by the earlier portal status.",
        observations: [
          item([receipt, portal], {
            category: "timeline_gap_or_stale_status",
            severity: "medium",
            confidence: 90,
            title: "Portal status predates documented intake",
            source_analysts: ["chronology_analyst"],
          }),
        ],
      },
      permitpulse_skeptical_reviewer_v1: {
        analyst_summary:
          "The draft reassignment statement is stronger than the supporting record.",
        observations: [
          item([receipt, routingEmail, portal], {
            category: "unsupported_finding",
            title: "Draft reviewer-reassignment statement is unsupported",
            source_analysts: ["skeptical_reviewer"],
          }),
        ],
      },
    };
    const synthesisOutput: IntegritySynthesisOutput = {
      summary:
        "Receipt is verified, but current routing and reviewer assignment remain unknown pending human confirmation.",
      items: [
        item([receipt, routingEmail, portal], {
          category: "unsupported_finding",
          title: "Draft reviewer-reassignment statement exceeds the record",
          source_analysts: ["evidence_auditor", "skeptical_reviewer"],
        }),
        item([receipt, portal, routingEmail], {
          category: "next_best_action",
          severity: "high",
          confidence: 96,
          title: "Confirm routing and reviewer assignment in writing",
          proposed_corrective_action:
            "Ask intake for the current routing stage, discipline queue, assigned reviewer, and routing date.",
          source_analysts: [
            "evidence_auditor",
            "chronology_analyst",
            "skeptical_reviewer",
          ],
        }),
      ],
    };

    let activeSpecialists = 0;
    let maximumActiveSpecialists = 0;
    const requestBodies: Array<Record<string, unknown>> = [];
    const fetchStub = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        store: boolean;
        text: { format: { name: string; strict: boolean; type: string } };
      };
      requestBodies.push(body as unknown as Record<string, unknown>);
      const name = body.text.format.name;
      const analyst = analystOutputs[name];
      if (analyst) {
        activeSpecialists += 1;
        maximumActiveSpecialists = Math.max(
          maximumActiveSpecialists,
          activeSpecialists,
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeSpecialists -= 1;
        return responseEnvelope(`resp-${name}`, analyst);
      }
      if (name === "permitpulse_integrity_synthesis_v1") {
        expect(activeSpecialists).toBe(0);
        return responseEnvelope("resp-synthesis", synthesisOutput);
      }
      return Response.json({ error: "unexpected schema" }, { status: 400 });
    });
    vi.stubGlobal("fetch", fetchStub);

    const runResponse = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseId}/integrity-reviews`,
      {},
    );
    expect(runResponse.status).toBe(200);
    const runBody = await runResponse.json<{
      data: { outcome: string; run: IntegrityReviewRun };
    }>();
    const run = runBody.data.run;

    expect(runBody.data.outcome).toBe("completed");
    expect(maximumActiveSpecialists).toBe(3);
    expect(fetchStub).toHaveBeenCalledTimes(4);
    expect(requestBodies.map((body) => body.model)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.6-terra",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
    expect(
      requestBodies.every(
        (body) =>
          body.store === false &&
          (body.text as { format: { strict: boolean; type: string } }).format.strict ===
            true &&
          (body.text as { format: { strict: boolean; type: string } }).format.type ===
            "json_schema",
      ),
    ).toBe(true);
    expect(run).toMatchObject({
      status: "completed",
      specialist_model: "gpt-5.6-terra",
      synthesizer_model: "gpt-5.6-sol",
      cache_hit: false,
      counts: { total: 2, pending: 2, accepted: 0 },
    });
    expect(run.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(run.stages).toHaveLength(4);
    expect(run.stages.every((stage) => stage.status === "completed")).toBe(true);
    expect(run.items.every((candidate) => candidate.decision_status === "pending"))
      .toBe(true);
    expect(run.items.every((candidate) => candidate.packet_generation_id === null))
      .toBe(true);
    expect(run.items.flatMap((candidate) => candidate.evidence_ids)).not.toContain(
      expect.stringContaining("not-in-case"),
    );

    const packetBefore = await request(`/api/v1/cases/${caseId}/packet`, {
      headers: { cookie: admin.cookie },
    });
    const packetBeforeBody = await packetBefore.json<{
      data: { packet: { findings: { items: unknown[] } } };
    }>();
    expect(packetBeforeBody.data.packet.findings.items).toHaveLength(4);
    expect(JSON.stringify(packetBeforeBody.data.packet)).not.toContain(
      "Reviewer reassignment confirmed",
    );

    const decisionResponse = await request(
      `/api/v1/cases/${caseId}/integrity-reviews/${run.id}/items/${run.items[0].id}`,
      {
        method: "PATCH",
        headers: {
          cookie: admin.cookie,
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({ decision: "accepted", expected_version: 1 }),
      },
    );
    expect(decisionResponse.status).toBe(200);
    const decidedRun = (
      await decisionResponse.json<{ data: { run: IntegrityReviewRun } }>()
    ).data.run;
    expect(decidedRun.counts).toMatchObject({ pending: 1, accepted: 1 });
    expect(decidedRun.items.find((candidate) => candidate.id === run.items[0].id))
      .toMatchObject({ decision_status: "accepted", version: 2 });
    const audit = await env.DB.prepare(
      "SELECT previous_decision, decision, reviewer_user_id FROM build_week_integrity_decision_events WHERE item_id = ?",
    )
      .bind(run.items[0].id)
      .first<{
        previous_decision: string;
        decision: string;
        reviewer_user_id: string;
      }>();
    expect(audit).toEqual({
      previous_decision: "pending",
      decision: "accepted",
      reviewer_user_id: admin.userId,
    });

    const packetAfter = await request(`/api/v1/cases/${caseId}/packet`, {
      headers: { cookie: admin.cookie },
    });
    const packetAfterBody = await packetAfter.json<{
      data: { packet: { findings: { items: unknown[] } } };
    }>();
    expect(packetAfterBody.data.packet.findings.items).toHaveLength(4);
    expect(JSON.stringify(packetAfterBody.data.packet)).not.toContain(
      "Reviewer reassignment confirmed",
    );

    const cachedResponse = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseId}/integrity-reviews`,
      {},
    );
    expect(cachedResponse.status).toBe(200);
    const cachedBody = await cachedResponse.json<{
      data: { outcome: string; run: IntegrityReviewRun };
    }>();
    expect(cachedBody.data).toMatchObject({
      outcome: "cached",
      run: { id: run.id, cache_hit: true },
    });
    expect(fetchStub).toHaveBeenCalledTimes(4);
  });

  it("fails closed before synthesis when a Terra analyst cites another case", async () => {
    const admin = await signUpAdmin();
    const caseId = await seedDemo(admin.cookie);
    const ids = await evidenceByTitle(caseId);
    const receipt = ids.get("Resubmittal confirmation receipt")!;
    const fetchStub = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        text: { format: { name: string } };
      };
      const name = body.text.format.name;
      const stage = name.replace("permitpulse_", "").replace("_v1", "") as
        | "evidence_auditor"
        | "chronology_analyst"
        | "skeptical_reviewer";
      const output: IntegrityAnalystOutput = {
        analyst_summary: "The case requires a human-supported routing confirmation.",
        observations: [
          item(
            [stage === "evidence_auditor" ? "evidence-from-another-case" : receipt],
            { source_analysts: [stage] },
          ),
        ],
      };
      return responseEnvelope(`resp-${name}`, output);
    });
    vi.stubGlobal("fetch", fetchStub);

    const response = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseId}/integrity-reviews`,
      {},
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      data: { outcome: string; run: IntegrityReviewRun };
    }>();
    expect(body.data).toMatchObject({
      outcome: "failed",
      run: {
        status: "failed",
        failure_code: "OPENAI_OUTPUT_SCHEMA_INVALID",
        counts: { total: 0, pending: 0 },
      },
    });
    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(body.data.run.stages.find((stage) => stage.stage === "evidence_auditor"))
      .toMatchObject({
        status: "failed",
        failure_code: "OPENAI_OUTPUT_SCHEMA_INVALID",
      });
    expect(body.data.run.stages.find((stage) => stage.stage === "synthesis"))
      .toMatchObject({ status: "queued" });
  });

  it("persists no items when canonical evidence changes while Sol is running", async () => {
    const admin = await signUpAdmin();
    const caseId = await seedDemo(admin.cookie);
    const ids = await evidenceByTitle(caseId);
    const receipt = ids.get("Resubmittal confirmation receipt")!;
    const fetchStub = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        text: { format: { name: string } };
      };
      const name = body.text.format.name;
      if (name === "permitpulse_integrity_synthesis_v1") {
        await env.DB.prepare(
          `UPDATE evidence_items
           SET summary = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND case_id = ?`,
        )
          .bind(
            "Canonical evidence changed while synthesis was in flight.",
            new Date().toISOString(),
            receipt,
            caseId,
          )
          .run();
        return responseEnvelope("resp-racing-synthesis", {
          summary:
            "The record requires human confirmation before any packet change.",
          items: [
            item([receipt], {
              category: "unsupported_finding",
              source_analysts: ["evidence_auditor", "skeptical_reviewer"],
            }),
            item([receipt], {
              category: "next_best_action",
              title: "Confirm the current routing stage",
              proposed_corrective_action:
                "Request written confirmation of routing and reviewer assignment.",
              source_analysts: ["chronology_analyst"],
            }),
          ],
        } satisfies IntegritySynthesisOutput);
      }

      const stage = name.replace("permitpulse_", "").replace("_v1", "") as
        | "evidence_auditor"
        | "chronology_analyst"
        | "skeptical_reviewer";
      return responseEnvelope(`resp-racing-${stage}`, {
        analyst_summary:
          "The cited record supports intake but not reviewer assignment.",
        observations: [item([receipt], { source_analysts: [stage] })],
      } satisfies IntegrityAnalystOutput);
    });
    vi.stubGlobal("fetch", fetchStub);

    const response = await postJson(
      admin.cookie,
      `/api/v1/cases/${caseId}/integrity-reviews`,
      {},
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      data: { outcome: string; run: IntegrityReviewRun };
    }>();
    expect(body.data).toMatchObject({
      outcome: "failed",
      run: {
        status: "failed",
        failure_code: "INPUT_CHANGED_BEFORE_PERSIST",
        counts: { total: 0, pending: 0 },
      },
    });
    expect(fetchStub).toHaveBeenCalledTimes(4);
    expect(body.data.run.stages.slice(0, 3).every((stage) => stage.status === "completed"))
      .toBe(true);
    expect(body.data.run.stages.find((stage) => stage.stage === "synthesis"))
      .toMatchObject({
        status: "failed",
        failure_code: "INPUT_CHANGED_BEFORE_PERSIST",
      });
    const persisted = await env.DB.prepare(
      "SELECT count(*) AS count FROM build_week_integrity_items WHERE run_id = ?",
    )
      .bind(body.data.run.id)
      .first<{ count: number }>();
    expect(persisted?.count).toBe(0);
  });

  it("keeps config secret-free and lets only an admin reset the fictional demo", async () => {
    const admin = await signUpAdmin();
    const client = await signUpClient();
    const caseId = await seedDemo(admin.cookie);

    expect(
      (await request("/api/v1/build-week/integrity/config")).status,
    ).toBe(401);
    const configResponse = await request(
      "/api/v1/build-week/integrity/config",
      { headers: { cookie: client.cookie } },
    );
    expect(configResponse.status).toBe(200);
    const configText = await configResponse.text();
    expect(JSON.parse(configText)).toMatchObject({
      data: {
        config: {
          enabled: true,
          demo_mode: true,
          live_available: true,
          human_review_required: true,
          specialist_model: "gpt-5.6-terra",
          synthesizer_model: "gpt-5.6-sol",
        },
      },
    });
    expect(configText).not.toContain("test-only-openai-key");

    const completedRunId = crypto.randomUUID();
    const completedAt = "2026-07-18T04:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO build_week_integrity_runs (
        id, case_id, requested_by_user_id, status, input_hash,
        input_snapshot_json, case_version, packet_input_revision_json,
        prompt_version, schema_version, specialist_model, synthesizer_model,
        summary, created_at, completed_at
      ) VALUES (?, ?, ?, 'completed', ?, '{}', 1, '{}', ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        completedRunId,
        caseId,
        admin.userId,
        "a".repeat(64),
        "permitpulse-integrity-prompts-2026-07-18-v1",
        "permitpulse-integrity-schema-v1",
        "gpt-5.6-terra",
        "gpt-5.6-sol",
        "Completed review fixture for reset coverage.",
        completedAt,
        completedAt,
      )
      .run();

    await env.DB.prepare(
      `UPDATE reviewer_findings
       SET approved = 1, version = version + 1, updated_at = ?
       WHERE case_id = ? AND title = ?`,
    )
      .bind(
        "2026-07-18T04:01:00.000Z",
        caseId,
        buildWeekUnsupportedReassignmentFinding.title,
      )
      .run();

    const clientReview = await request(
      `/api/v1/cases/${caseId}/integrity-reviews/latest`,
      { headers: { cookie: client.cookie } },
    );
    expect(clientReview.status).toBe(403);
    const clientReset = await postJson(
      client.cookie,
      "/api/v1/build-week/integrity/demo/reset",
      { confirmation: "reset-arroyo-vista-integrity-v1" },
    );
    expect(clientReset.status).toBe(403);

    const latestBefore = await request(
      `/api/v1/cases/${caseId}/integrity-reviews/latest`,
      { headers: { cookie: admin.cookie } },
    );
    expect(latestBefore.status).toBe(200);
    expect(
      (await latestBefore.json<{ data: { run: { id: string } | null } }>()).data
        .run?.id,
    ).toBe(completedRunId);

    const reset = await postJson(
      admin.cookie,
      "/api/v1/build-week/integrity/demo/reset",
      { confirmation: "reset-arroyo-vista-integrity-v1" },
    );
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({
      data: {
        case_id: caseId,
        seed_outcome: "reconciled",
        archived_run_count: 1,
      },
    });

    const latestAfter = await request(
      `/api/v1/cases/${caseId}/integrity-reviews/latest`,
      { headers: { cookie: admin.cookie } },
    );
    expect(latestAfter.status).toBe(200);
    expect(
      (await latestAfter.json<{ data: { run: IntegrityReviewRun | null } }>()).data,
    ).toEqual({ run: null });
    const archived = await env.DB.prepare(
      "SELECT archived_at FROM build_week_integrity_runs WHERE id = ?",
    )
      .bind(completedRunId)
      .first<{ archived_at: string | null }>();
    expect(archived?.archived_at).toMatch(/^2026-/);

    const restoredDraft = await env.DB.prepare(
      "SELECT approved, internal_notes FROM reviewer_findings WHERE case_id = ? AND title = ?",
    )
      .bind(caseId, buildWeekUnsupportedReassignmentFinding.title)
      .first<{ approved: number; internal_notes: string }>();
    expect(restoredDraft).toMatchObject({
      approved: 0,
      internal_notes: expect.stringContaining("Build Week 2026 demo-only"),
    });

    const packetResponse = await request(`/api/v1/cases/${caseId}/packet`, {
      headers: { cookie: admin.cookie },
    });
    expect(packetResponse.status).toBe(200);
    const packetText = await packetResponse.text();
    expect(packetText).not.toContain(buildWeekUnsupportedReassignmentFinding.title);
    expect(packetText).not.toContain(buildWeekUnsupportedReassignmentFinding.summary);
  });
});
