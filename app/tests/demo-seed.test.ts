import { env } from "cloudflare:workers";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const origin="http://localhost";
const secret="demo-seed-test-secret-123456789012345678901234";
const bindings=():Bindings=>({ADMIN_BOOTSTRAP_ENABLED:"false",APP_ENV:"local",ASSETS:env.ASSETS,AUTH_ALLOW_SIGNUP:"true",AUTH_ENABLED:"true",BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,DB:env.DB,ENABLE_DEV_CASE_API:"true"});
const request=(path:string,init?:RequestInit)=>app.request(`${origin}${path}`,init,bindings());
const post=(cookie:string,path:string,body?:unknown)=>request(path,{method:"POST",headers:{cookie,origin,...(body === undefined ? {} : {"content-type":"application/json"})},body:body === undefined ? undefined : JSON.stringify(body)});

async function account(role:"admin"|"client") {
  const response=await post("","/api/auth/sign-up/email",{name:`Demo ${role}`,email:`demo-${role}-${crypto.randomUUID()}@example.test`,password:"Demo-passphrase-42"});
  const cookie=response.headers.get("set-cookie")!.split(";",1)[0];
  const body=await response.json<{user:{id:string}}>();
  if (role === "admin") await env.DB.prepare('UPDATE "user" SET role=? WHERE id=?').bind("admin",body.user.id).run();
  return {cookie,id:body.user.id};
}

beforeEach(async()=>{ await env.DB.batch([
  env.DB.prepare("DELETE FROM reviewer_revisions"),env.DB.prepare("DELETE FROM reviewer_finding_timeline"),env.DB.prepare("DELETE FROM reviewer_finding_evidence"),env.DB.prepare("DELETE FROM reviewer_action_evidence"),env.DB.prepare("DELETE FROM reviewer_notes"),env.DB.prepare("DELETE FROM reviewer_actions"),env.DB.prepare("DELETE FROM reviewer_questions"),env.DB.prepare("DELETE FROM reviewer_findings"),
  env.DB.prepare("DELETE FROM delivery_lifecycle_events"),env.DB.prepare("DELETE FROM packet_generations"),env.DB.prepare("DELETE FROM timeline_entry_evidence"),env.DB.prepare("DELETE FROM timeline_entries"),env.DB.prepare("DELETE FROM evidence_items"),env.DB.prepare("DELETE FROM audit_events"),env.DB.prepare("DELETE FROM case_participants"),env.DB.prepare("DELETE FROM cases"),env.DB.prepare("DELETE FROM admin_bootstrap_claim"),env.DB.prepare("DELETE FROM verification"),env.DB.prepare("DELETE FROM session"),env.DB.prepare("DELETE FROM account"),env.DB.prepare('DELETE FROM "user"')
]); });

describe("canonical rich demo case",()=>{
  it("seeds idempotently with linked evidence, editorial content, and a generated packet",async()=>{
    const admin=await account("admin");
    const first=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    expect(first.status).toBe(201);
    const seeded=await first.json<{data:{case_id:string;evidence_count:number;timeline_count:number;finding_count:number;question_count:number;action_count:number;internal_note_count:number;lifecycle_state:string}}>();
    expect(seeded.data).toMatchObject({evidence_count:9,timeline_count:8,finding_count:4,question_count:5,action_count:5,internal_note_count:2,lifecycle_state:"packet_generated"});
    const second=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    expect(second.status).toBe(200);
    expect((await second.json<{data:typeof seeded.data}>()).data).toMatchObject({...seeded.data,created:false});
    const counts=await env.DB.prepare(`SELECT
      (SELECT count(*) FROM cases WHERE permit_number='DEMO-LADBS-2026-1842') cases,
      (SELECT count(*) FROM evidence_items WHERE case_id=?) evidence,
      (SELECT count(*) FROM timeline_entries WHERE case_id=?) timeline,
      (SELECT count(*) FROM timeline_entry_evidence te JOIN timeline_entries t ON t.id=te.timeline_entry_id WHERE t.case_id=?) links,
      (SELECT count(*) FROM delivery_lifecycle_events WHERE case_id=?) lifecycle`).bind(seeded.data.case_id,seeded.data.case_id,seeded.data.case_id,seeded.data.case_id).first<{cases:number;evidence:number;timeline:number;links:number;lifecycle:number}>();
    expect(counts).toEqual({cases:1,evidence:9,timeline:8,links:16,lifecycle:1});

    const packetResponse=await request(`/api/v1/cases/${seeded.data.case_id}/packet`,{headers:{cookie:admin.cookie}});
    const packetBody=await packetResponse.json<{data:{packet:unknown;quality:{blockers:unknown[];stale_snapshot:boolean};persisted_snapshot:boolean}}>();
    const serialized=JSON.stringify(packetBody.data.packet);
    expect(packetBody.data.persisted_snapshot).toBe(true);
    expect(packetBody.data.quality).toMatchObject({blockers:[],stale_snapshot:false});
    expect(serialized).toContain("Receipt does not establish reviewer assignment");
    expect(serialized).not.toContain("Internal only:");

    for (const extension of ["txt","html"] as const) {
      const exported=await request(`/api/v1/cases/${seeded.data.case_id}/packet.${extension}`,{headers:{cookie:admin.cookie}});
      expect(exported.status).toBe(200);
      const text=await exported.text();
      expect(text).toContain("Receipt does not establish reviewer assignment");
      expect(text).not.toContain("Internal only:");
      expect(text).not.toMatch(/2026-\d\d-\d\dT/);
      expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    }
    const pdf=await request(`/api/v1/cases/${seeded.data.case_id}/packet.pdf`,{headers:{cookie:admin.cookie}});
    expect(pdf.status).toBe(200);
    const document=await PDFDocument.load(await pdf.arrayBuffer());
    expect(document.getPageCount()).toBeGreaterThan(3);
  });

  it("keeps authorization intact and detects then clears a stale generated packet",async()=>{
    const admin=await account("admin"); const client=await account("client");
    expect((await post(client.cookie,"/api/dev/cases/demo/arroyo-vista")).status).toBe(403);
    const seed=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    const caseId=(await seed.json<{data:{case_id:string}}>()).data.case_id;
    expect((await request(`/api/v1/cases/${caseId}`,{headers:{cookie:client.cookie}})).status).toBe(404);
    const evidence=await request(`/api/v1/cases/${caseId}/evidence?limit=50&offset=0`,{headers:{cookie:admin.cookie}});
    const item=(await evidence.json<{data:{evidence:Array<{id:string;version:number;summary:string}>}}>()).data.evidence[0];
    const edited=await request(`/api/v1/cases/${caseId}/evidence/${item.id}`,{method:"PATCH",headers:{cookie:admin.cookie,origin,"content-type":"application/json"},body:JSON.stringify({expected_version:item.version,summary:`${item.summary} Fictional QA edit.`})});
    expect(edited.status).toBe(200);
    let packet=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie:admin.cookie}});
    expect((await packet.json<{data:{quality:{stale_snapshot:boolean;blockers:Array<{id:string}>}}}>()).data.quality).toMatchObject({stale_snapshot:true,blockers:[{id:"snapshot-current"}]});
    const regenerated=await post(admin.cookie,`/api/v1/cases/${caseId}/delivery-lifecycle/transitions`,{event_type:"packet_generated",idempotency_key:"demo-test-regenerate",note:"Regenerate after fictional QA edit."});
    expect(regenerated.status).toBe(201);
    packet=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie:admin.cookie}});
    expect((await packet.json<{data:{quality:{stale_snapshot:boolean;blockers:unknown[]};lifecycle:{current_state:string}}}>()).data).toMatchObject({quality:{stale_snapshot:false,blockers:[]},lifecycle:{current_state:"packet_generated"}});
  });
});
