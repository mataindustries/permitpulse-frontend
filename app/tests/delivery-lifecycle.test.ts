import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/worker/app";
import { transitionDeliveryLifecycle as clientTransitionDeliveryLifecycle } from "../src/client/api/delivery-lifecycle";
import { CaseApiError } from "../src/client/api/cases";
import { shouldRetainDeliveryTransitionKey } from "../src/client/components/DeliveryLifecyclePanel";
import { getCaseById } from "../src/worker/cases/repository";
import {
  recordDeliveryTransition,
  sha256,
  type ExpectedDeliveryLifecycle,
} from "../src/worker/delivery/repository";
import { readPacketDeliveryContext } from "../src/worker/packet/service";
import { packetInputRevisionSelectSql, type PacketInputRevision } from "../src/worker/packet/revision";
import type { Bindings } from "../src/worker/types";

const origin = "http://localhost";
const secret = "test-only-delivery-secret-not-for-deployment-123456";
const account = { name: "Delivery Admin", email: "delivery.admin@example.test", password: "Delivery-passphrase-42" };

function bindings(database:Bindings["DB"]=env.DB): Bindings {
  return { ADMIN_BOOTSTRAP_ENABLED: "false", APP_ENV: "local", ASSETS: env.ASSETS, AUTH_ALLOW_SIGNUP: "true", AUTH_ENABLED: "true", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: origin, DB: database, ENABLE_DEV_CASE_API: "true" };
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
    const evidence = await evidenceResponse.json<{ data: { id: string; version: number } }>();
    expect(evidenceResponse.status).toBe(201);
    const verifiedResponse = await request(`/api/v1/cases/${body.data.id}/evidence/${evidence.data.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", origin },
      body: JSON.stringify({ expected_version: evidence.data.version, verification_status: "verified" }),
    });
    expect(verifiedResponse.status).toBe(200);
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
  return { cookie, caseId: body.data.id, userId: user.user.id };
}
async function transition(cookie: string, caseId: string, event_type: string, key: string, note: string | null = null) {
  return post(cookie, `/api/v1/cases/${caseId}/delivery-lifecycle/transitions`, { event_type, idempotency_key: key, note });
}

function evaluatedLifecycle(
  context: Awaited<ReturnType<typeof readPacketDeliveryContext>>,
): ExpectedDeliveryLifecycle {
  const activePacketGenerationId = context.lifecycle.active_packet_generation_id;
  const sequence = context.lifecycle.latest_event?.sequence;
  if (!activePacketGenerationId || sequence === undefined) {
    throw new Error("Expected an evaluated packet lifecycle.");
  }

  return {
    activePacketGenerationId,
    sequence,
    state: context.lifecycle.current_state,
  };
}

async function rewritePacketSnapshot(
  caseId: string,
  mutate: (snapshot: Record<string, unknown>) => void,
): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT id,snapshot_json FROM packet_generations WHERE case_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
  ).bind(caseId).first<{id:string;snapshot_json:string}>();
  if (!row) throw new Error("Expected a packet snapshot.");
  const snapshot=JSON.parse(row.snapshot_json) as Record<string,unknown>;
  mutate(snapshot);
  const json=JSON.stringify(snapshot);
  await env.DB.prepare("UPDATE packet_generations SET snapshot_json=?,content_sha256=? WHERE id=?").bind(json,await sha256(json),row.id).run();
}

function unstablePacketRevisionDatabase(database: Bindings["DB"]): Bindings["DB"] {
  let reads=0;
  return {
    prepare(query:string){
      const statement=database.prepare(query);
      if(query!==packetInputRevisionSelectSql)return statement;
      return {
        bind(...values:unknown[]){
          const bound=statement.bind(...values);
          return {
            async first<T>(){
              const row=await bound.first<T>();
              reads+=1;
              if(row&&reads%2===0){
                const revision=row as unknown as PacketInputRevision;
                return {...revision,evidence_revision:`${revision.evidence_revision}:changed-during-read`} as T;
              }
              return row;
            },
          } as D1PreparedStatement;
        },
      } as D1PreparedStatement;
    },
    batch:database.batch.bind(database),
  } as unknown as Bindings["DB"];
}

function lifecycleEvaluationRaceDatabase(
  database: Bindings["DB"],
  race: () => Promise<void>,
): Bindings["DB"] {
  let raced=false;
  return {
    prepare(query:string){
      const statement=database.prepare(query);
      if(
        !query.includes("FROM delivery_lifecycle_events e") ||
        !query.includes("ORDER BY e.sequence DESC LIMIT ?")
      ) return statement;
      return {
        bind(...values:unknown[]){
          const bound=statement.bind(...values);
          return {
            async all<T>(){
              const result=await bound.all<T>();
              if(!raced){
                raced=true;
                await race();
              }
              return result;
            },
          } as D1PreparedStatement;
        },
      } as D1PreparedStatement;
    },
    batch:database.batch.bind(database),
  } as unknown as Bindings["DB"];
}

function missFirstLifecycleIdempotencyRead(
  database: Bindings["DB"],
): Bindings["DB"] {
  let missed = false;

  return {
    prepare(query: string) {
      const statement = database.prepare(query);
      if (!query.includes("e.idempotency_key = ? LIMIT 1")) return statement;

      return {
        bind(...values: unknown[]) {
          const bound = statement.bind(...values);
          return {
            async first<T>() {
              if (!missed) {
                missed = true;
                return null;
              }
              return bound.first<T>();
            },
          } as D1PreparedStatement;
        },
      } as D1PreparedStatement;
    },
    batch: database.batch.bind(database),
  } as unknown as Bindings["DB"];
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM delivery_lifecycle_events"), env.DB.prepare("DELETE FROM packet_generations"),
    env.DB.prepare("DELETE FROM timeline_entry_evidence"), env.DB.prepare("DELETE FROM timeline_entries"), env.DB.prepare("DELETE FROM evidence_items"),
    env.DB.prepare("DELETE FROM audit_events"), env.DB.prepare("DELETE FROM case_participants"), env.DB.prepare("DELETE FROM cases"),
    env.DB.prepare("DELETE FROM session"), env.DB.prepare("DELETE FROM account"), env.DB.prepare('DELETE FROM "user"'),
  ]);
});

afterEach(()=>{vi.unstubAllGlobals();});

describe("delivery lifecycle", () => {
  it("accepts a caller-owned idempotency key for network retries",async()=>{
    const fetchMock=vi.fn().mockImplementation(async()=>Response.json({ok:true,data:{lifecycle:{},retry:false}}));
    vi.stubGlobal("fetch",fetchMock);
    await clientTransitionDeliveryLifecycle("case-1","packet_generated",null,"stable-retry-key");
    await clientTransitionDeliveryLifecycle("case-1","packet_generated",null,"stable-retry-key");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys=fetchMock.mock.calls.map((call)=>(JSON.parse(String((call[1] as RequestInit).body)) as {idempotency_key:string}).idempotency_key);
    expect(keys).toEqual(["stable-retry-key","stable-retry-key"]);
    expect(shouldRetainDeliveryTransitionKey(new CaseApiError("network","Network failure",0,"NETWORK_ERROR"))).toBe(true);
    expect(shouldRetainDeliveryTransitionKey(new CaseApiError("server","Invalid response",200,"INVALID_RESPONSE"))).toBe(true);
    expect(shouldRetainDeliveryTransitionKey(new CaseApiError("server","Server failure",500,"INTERNAL_ERROR"))).toBe(true);
    expect(shouldRetainDeliveryTransitionKey(new CaseApiError("conflict","Conflict",409,"DELIVERY_STATE_CHANGED"))).toBe(false);
  });

  it("starts empty and rejects unauthenticated access", async () => {
    const { cookie, caseId } = await setup();
    expect((await request(`/api/v1/cases/${caseId}/delivery-lifecycle`)).status).toBe(401);
    const response = await request(`/api/v1/cases/${caseId}/delivery-lifecycle`, { headers: { cookie } });
    expect(response.status).toBe(200);
    expect((await response.json<{ data: { lifecycle: { current_state: string; events: unknown[] } } }>()).data.lifecycle).toMatchObject({ current_state: "draft", events: [] });
  });

  it("returns a deterministic 409 when packet preview inputs cannot stabilize",async()=>{
    const {cookie,caseId}=await setup();
    const response=await app.request(`${origin}/api/v1/cases/${caseId}/packet`,{headers:{cookie}},bindings(unstablePacketRevisionDatabase(env.DB)));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({error:{code:"PACKET_INPUTS_CHANGED"}});
  });

  it("denies delivery lifecycle transitions to an owner client",async()=>{
    const signup=await post("","/api/auth/sign-up/email",{name:"Delivery Client",email:`delivery-client-${crypto.randomUUID()}@example.test`,password:"Delivery-passphrase-42"});
    const cookie=signup.headers.get("set-cookie")!.split(";",1)[0];
    const created=await post(cookie,"/api/v1/cases",{project_name:"Client delivery boundary",client_name:"Fictional client",address:"2 Audit Way",city:"Exampleville",jurisdiction:"Example Building",permit_number:"DL-2",current_status:"intake"});
    const caseId=(await created.json<{data:{id:string}}>()).data.id;
    const response=await transition(cookie,caseId,"packet_generated","client-forbidden");
    expect(response.status).toBe(403);
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=?").bind(caseId).first<{count:number}>()).toEqual({count:0});
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
    await env.DB.prepare("UPDATE evidence_items SET summary=?,version=version+1,updated_at=? WHERE case_id=?").bind("Changed after the original idempotent request","2026-07-10T14:00:00.000Z",caseId).run();
    const retry = await transition(cookie, caseId, "packet_generated", "same-key");
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect((await transition(cookie, caseId, "review_started", "same-key")).status).toBe(409);
    const counts = await env.DB.prepare("SELECT (SELECT count(*) FROM packet_generations) AS packets, (SELECT count(*) FROM delivery_lifecycle_events) AS events").first<{ packets: number; events: number }>();
    expect(counts).toEqual({ packets: 1, events: 1 });
  });

  it("does not misreport a non-concurrency D1 failure as a lifecycle conflict",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","failure-draft");
    const failingDatabase={
      prepare:env.DB.prepare.bind(env.DB),
      batch:async()=>{throw new Error("synthetic delivery write failure");},
    } as unknown as Bindings["DB"];

    await expect(recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:1,database:failingDatabase,eventType:"review_started",idempotencyKey:"failure-review",note:null})).rejects.toThrow("synthetic delivery write failure");
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='review_started'").bind(caseId).first<{count:number}>()).toEqual({count:0});
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
    expect(body.error.message).toContain("evidence-exists: No supporting evidence");
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

  it("classifies a concurrent identical approval as an idempotent retry",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","concurrent-retry-draft");
    await transition(cookie,caseId,"review_started","concurrent-retry-review");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    const evaluated=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});
    const idempotencyKey="concurrent-retry-approval";
    expect((await transition(cookie,caseId,"approved_for_delivery",idempotencyKey)).status).toBe(201);

    const outcome=await recordDeliveryTransition({
      actor:{id:userId,role:"admin"},
      caseId,
      caseVersion:caseRecord.version,
      database:missFirstLifecycleIdempotencyRead(env.DB),
      eventType:"approved_for_delivery",
      idempotencyKey,
      note:null,
      expectedLifecycle:evaluatedLifecycle(evaluated),
      packetInputRevision:evaluated.packet_input_revision,
    });

    expect(outcome).toMatchObject({kind:"retry",lifecycle:{current_state:"approved_for_delivery"}});
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='approved_for_delivery'").bind(caseId).first<{count:number}>()).toEqual({count:1});
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

  it("atomically rejects approval when packet inputs change after quality evaluation",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","atomic-draft");
    await transition(cookie,caseId,"review_started","atomic-review");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    const packetContext=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});
    expect(packetContext.quality.eligible_for_approval).toBe(true);
    await env.DB.prepare("UPDATE evidence_items SET summary=?,version=version+1,updated_at=? WHERE case_id=?").bind("Changed between evaluation and approval","2026-07-10T16:30:00.000Z",caseId).run();
    const outcome=await recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:caseRecord.version,database:env.DB,eventType:"approved_for_delivery",idempotencyKey:"atomic-approval",note:null,expectedLifecycle:evaluatedLifecycle(packetContext),packetInputRevision:packetContext.packet_input_revision});
    expect(outcome).toEqual({kind:"presentation_changed"});
    const lifecycle=await request(`/api/v1/cases/${caseId}/delivery-lifecycle`,{headers:{cookie}});
    expect((await lifecycle.json<{data:{lifecycle:{current_state:string;events:unknown[]}}}>()).data.lifecycle).toMatchObject({current_state:"under_review",events:expect.arrayContaining([])});
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='approved_for_delivery'").bind(caseId).first<{count:number}>()).toEqual({count:0});
  });

  it("does not apply approval evaluated for an earlier packet generation",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","generation-identity-a");
    await transition(cookie,caseId,"review_started","generation-identity-a-review");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    const evaluated=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});
    const evaluatedGeneration=evaluated.lifecycle.active_packet_generation_id;
    expect(evaluated.quality.eligible_for_approval).toBe(true);

    await transition(cookie,caseId,"packet_generated","generation-identity-b");
    await transition(cookie,caseId,"review_started","generation-identity-b-review");
    const outcome=await recordDeliveryTransition({
      actor:{id:userId,role:"admin"},
      caseId,
      caseVersion:caseRecord.version,
      database:env.DB,
      eventType:"approved_for_delivery",
      idempotencyKey:"generation-identity-stale-approval",
      note:null,
      expectedLifecycle:evaluatedLifecycle(evaluated),
      packetInputRevision:evaluated.packet_input_revision,
    });
    const current=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});

    expect(outcome).toEqual({kind:"concurrent_transition"});
    expect(current.lifecycle.current_state).toBe("under_review");
    expect(current.lifecycle.active_packet_generation_id).not.toBe(evaluatedGeneration);
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='approved_for_delivery'").bind(caseId).first<{count:number}>()).toEqual({count:0});
  });

  it("does not record delivery from an approval evaluation for a replaced generation",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","delivery-identity-a");
    await transition(cookie,caseId,"review_started","delivery-identity-a-review");
    await transition(cookie,caseId,"approved_for_delivery","delivery-identity-a-approval");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    const evaluated=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});
    const evaluatedGeneration=evaluated.lifecycle.active_packet_generation_id;
    expect(evaluated.quality.eligible_for_delivery).toBe(true);

    await transition(cookie,caseId,"packet_generated","delivery-identity-b");
    await transition(cookie,caseId,"review_started","delivery-identity-b-review");
    await transition(cookie,caseId,"approved_for_delivery","delivery-identity-b-approval");
    const outcome=await recordDeliveryTransition({
      actor:{id:userId,role:"admin"},
      caseId,
      caseVersion:caseRecord.version,
      database:env.DB,
      eventType:"delivery_recorded",
      idempotencyKey:"delivery-identity-stale-record",
      note:null,
      expectedLifecycle:evaluatedLifecycle(evaluated),
      packetInputRevision:evaluated.packet_input_revision,
    });
    const current=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});

    expect(outcome).toEqual({kind:"concurrent_transition"});
    expect(current.lifecycle.current_state).toBe("approved_for_delivery");
    expect(current.lifecycle.active_packet_generation_id).not.toBe(evaluatedGeneration);
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='delivery_recorded'").bind(caseId).first<{count:number}>()).toEqual({count:0});
  });

  it("does not approve when review becomes applicable after route evaluation",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","approval-race-draft");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    let reviewOutcome:Awaited<ReturnType<typeof recordDeliveryTransition>>|null=null;
    const raceDatabase=lifecycleEvaluationRaceDatabase(env.DB,async()=>{
      reviewOutcome=await recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:caseRecord.version,database:env.DB,eventType:"review_started",idempotencyKey:"approval-race-review",note:null});
    });
    const response=await app.request(`${origin}/api/v1/cases/${caseId}/delivery-lifecycle/transitions`,{method:"POST",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify({event_type:"approved_for_delivery",idempotency_key:"approval-race-attempt",note:null})},bindings(raceDatabase));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({error:{code:"INVALID_DELIVERY_TRANSITION"}});
    expect(reviewOutcome).toMatchObject({kind:"created"});
    expect(await env.DB.prepare("SELECT event_type,count(*) count FROM delivery_lifecycle_events WHERE case_id=? GROUP BY event_type ORDER BY event_type").bind(caseId).all()).toMatchObject({results:expect.arrayContaining([expect.objectContaining({event_type:"review_started",count:1})])});
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='approved_for_delivery'").bind(caseId).first<{count:number}>()).toEqual({count:0});
    expect(await recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:caseRecord.version,database:env.DB,eventType:"approved_for_delivery",idempotencyKey:"approval-without-revision",note:null})).toEqual({kind:"invalid_transition"});
  });

  it("does not persist an unguarded packet generation through the repository",async()=>{
    const {caseId,userId}=await setup();
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");

    const outcome=await recordDeliveryTransition({
      actor:{id:userId,role:"admin"},
      caseId,
      caseVersion:caseRecord.version,
      database:env.DB,
      eventType:"packet_generated",
      idempotencyKey:"unguarded-generation",
      note:null,
      packet:{} as never,
    });

    expect(outcome).toEqual({kind:"invalid_transition"});
    expect(await env.DB.prepare("SELECT count(*) count FROM packet_generations WHERE case_id=?").bind(caseId).first<{count:number}>()).toEqual({count:0});
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=?").bind(caseId).first<{count:number}>()).toEqual({count:0});
  });

  it("does not record delivery when approval becomes applicable after route evaluation",async()=>{
    const {cookie,caseId,userId}=await setup();
    await transition(cookie,caseId,"packet_generated","delivery-race-draft");
    await transition(cookie,caseId,"review_started","delivery-race-review");
    const caseRecord=await getCaseById(env.DB,caseId);
    if(!caseRecord)throw new Error("Expected delivery case.");
    const approvalContext=await readPacketDeliveryContext({caseRecord,database:env.DB,evaluatedAt:new Date()});
    expect(approvalContext.quality.eligible_for_approval).toBe(true);
    let approvalOutcome:Awaited<ReturnType<typeof recordDeliveryTransition>>|null=null;
    const raceDatabase=lifecycleEvaluationRaceDatabase(env.DB,async()=>{
      approvalOutcome=await recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:caseRecord.version,database:env.DB,eventType:"approved_for_delivery",idempotencyKey:"delivery-race-approval",note:null,expectedLifecycle:evaluatedLifecycle(approvalContext),packetInputRevision:approvalContext.packet_input_revision});
    });
    const response=await app.request(`${origin}/api/v1/cases/${caseId}/delivery-lifecycle/transitions`,{method:"POST",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify({event_type:"delivery_recorded",idempotency_key:"delivery-race-attempt",note:null})},bindings(raceDatabase));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({error:{code:"INVALID_DELIVERY_TRANSITION"}});
    expect(approvalOutcome).toMatchObject({kind:"created"});
    expect(await env.DB.prepare("SELECT count(*) count FROM delivery_lifecycle_events WHERE case_id=? AND event_type='delivery_recorded'").bind(caseId).first<{count:number}>()).toEqual({count:0});
    expect(await recordDeliveryTransition({actor:{id:userId,role:"admin"},caseId,caseVersion:caseRecord.version,database:env.DB,eventType:"delivery_recorded",idempotencyKey:"delivery-without-revision",note:null})).toEqual({kind:"invalid_transition"});
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

  it("regenerates an outdated presentation and returns a current preview and quality gate", async () => {
    const { cookie, caseId } = await setup();
    await transition(cookie, caseId, "packet_generated", "legacy-draft");
    await rewritePacketSnapshot(caseId,(snapshot)=>{snapshot.presentation_version=1;});

    const staleResponse = await request(`/api/v1/cases/${caseId}/packet`, {
      headers: { cookie },
    });
    const stale = await staleResponse.json<{
      data: { quality: { blockers: Array<{ id: string }> }; persisted_snapshot: boolean };
    }>();
    expect(stale.data.persisted_snapshot).toBe(false);
    expect(stale.data.quality.blockers.map((item) => item.id)).toContain(
      "presentation-version-current",
    );

    const regeneratedResponse = await transition(
      cookie,
      caseId,
      "packet_generated",
      "replace-legacy-presentation",
    );
    expect(regeneratedResponse.status).toBe(201);

    const refreshedResponse = await request(`/api/v1/cases/${caseId}/packet`, {
      headers: { cookie },
    });
    const refreshed = await refreshedResponse.json<{
      data: {
        packet: { presentation_version: number };
        quality: { blockers: Array<{ id: string }>; stale_snapshot: boolean };
        persisted_snapshot: boolean;
      };
    }>();
    expect(refreshed.data.persisted_snapshot).toBe(true);
    expect(refreshed.data.packet.presentation_version).toBe(3);
    expect(refreshed.data.quality.stale_snapshot).toBe(false);
    expect(refreshed.data.quality.blockers.map((item) => item.id)).not.toContain(
      "presentation-version-current",
    );
  });

  it("detects snapshot hash tampering and never labels the live fallback approved",async()=>{
    const {cookie,caseId}=await setup();
    await transition(cookie,caseId,"packet_generated","hash-draft");
    await transition(cookie,caseId,"review_started","hash-review");
    await transition(cookie,caseId,"approved_for_delivery","hash-approval");
    await env.DB.prepare("UPDATE packet_generations SET snapshot_json=json_set(snapshot_json,'$.title','Tampered packet') WHERE case_id=?").bind(caseId).run();

    const preview=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}});
    const body=await preview.json<{data:{packet:{document_status:string;document_status_label:string};quality:{blockers:Array<{id:string}>};lifecycle:{current_state:string;live_preview_differs:boolean};export_supported:boolean;persisted_snapshot:boolean}}>();
    expect(preview.status).toBe(200);
    expect(body.data.packet).toMatchObject({document_status:"draft",document_status_label:"DRAFT"});
    expect(body.data.lifecycle).toMatchObject({current_state:"approved_for_delivery",live_preview_differs:true});
    expect(body.data.quality.blockers.map((item)=>item.id)).toContain("snapshot-integrity");
    expect(body.data).toMatchObject({export_supported:false,persisted_snapshot:false});
    const exported=await request(`/api/v1/cases/${caseId}/packet.pdf`,{headers:{cookie}});
    expect(exported.status).toBe(409);
    expect(await exported.json()).toMatchObject({error:{code:"PACKET_REGENERATION_REQUIRED"}});
    const delivery=await transition(cookie,caseId,"delivery_recorded","hash-delivery");
    expect(delivery.status).toBe(409);
    expect(await delivery.json()).toMatchObject({error:{code:"PACKET_QUALITY_BLOCKED",details:{blocking_checks:expect.arrayContaining([expect.objectContaining({id:"snapshot-integrity"})])}}});
  });

  it("treats a malformed approved snapshot as an unapproved live fallback",async()=>{
    const {cookie,caseId}=await setup();
    await transition(cookie,caseId,"packet_generated","invalid-draft");
    await transition(cookie,caseId,"review_started","invalid-review");
    await transition(cookie,caseId,"approved_for_delivery","invalid-approval");
    await rewritePacketSnapshot(caseId,(snapshot)=>{delete snapshot.case_summary;});

    const preview=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}});
    const body=await preview.json<{data:{packet:{document_status_label:string};quality:{blockers:Array<{id:string}>};export_supported:boolean;persisted_snapshot:boolean}}>();
    expect(preview.status).toBe(200);
    expect(body.data.packet.document_status_label).toBe("DRAFT");
    expect(body.data.quality.blockers.map((item)=>item.id)).toContain("persisted-snapshot-invalid");
    expect(body.data).toMatchObject({export_supported:false,persisted_snapshot:false});
    expect((await request(`/api/v1/cases/${caseId}/packet.html`,{headers:{cookie}})).status).toBe(409);
    expect((await transition(cookie,caseId,"delivery_recorded","invalid-delivery")).status).toBe(409);
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
