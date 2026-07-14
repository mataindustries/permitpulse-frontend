import { env } from "cloudflare:workers";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";
import { arroyoVistaDemoEvidence, arroyoVistaDemoPermitNumber } from "../src/shared/demo/arroyo-vista-demo";

const origin="http://localhost";
const previewOrigin="https://workspace-preview.getpermitpulse.com";
const secret="demo-seed-test-secret-123456789012345678901234";
const previewSeedToken="preview-demo-seed-test-token-123456789012345678901234";
const bindings=(overrides:Partial<Bindings>={}):Bindings=>({ADMIN_BOOTSTRAP_ENABLED:"false",APP_ENV:"local",ASSETS:env.ASSETS,AUTH_ALLOW_SIGNUP:"true",AUTH_ENABLED:"true",BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,DB:env.DB,ENABLE_DEV_CASE_API:"true",PREVIEW_DEMO_SEED_ENABLED:"false",...overrides});
const request=(path:string,init?:RequestInit)=>app.request(`${origin}${path}`,init,bindings());
const pdfHex=(value:string)=>Buffer.from(value,"latin1").toString("hex").toUpperCase();
const pdfOperators=(document:PDFDocument)=>document.getPages().map((page)=>{
  const contents=page.node.Contents();
  const resolved=page.node.context.lookup(contents);
  const entries=resolved instanceof PDFArray?resolved.asArray():[contents];
  return entries.map((entry)=>new TextDecoder().decode(decodePDFRawStream(page.node.context.lookup(entry) as PDFRawStream).decode())).join("\n");
}).join("\n");
const post=(cookie:string,path:string,body?:unknown)=>request(path,{method:"POST",headers:{cookie,origin,...(body === undefined ? {} : {"content-type":"application/json"})},body:body === undefined ? undefined : JSON.stringify(body)});

async function account(role:"admin"|"client") {
  const email=`demo-${role}-${crypto.randomUUID()}@example.test`;
  const password="Demo-passphrase-42";
  const response=await post("","/api/auth/sign-up/email",{name:`Demo ${role}`,email,password});
  const cookie=response.headers.get("set-cookie")!.split(";",1)[0];
  const body=await response.json<{user:{id:string}}>();
  if (role === "admin") await env.DB.prepare('UPDATE "user" SET role=? WHERE id=?').bind("admin",body.user.id).run();
  return {cookie,id:body.user.id,email,password};
}

const previewBindings=(overrides:Partial<Bindings>={}):Bindings=>bindings({
  APP_ENV:"preview",AUTH_ALLOW_SIGNUP:"false",BETTER_AUTH_URL:previewOrigin,
  ENABLE_DEV_CASE_API:"false",PREVIEW_DEMO_SEED_ENABLED:"true",
  PREVIEW_DEMO_SEED_TOKEN:previewSeedToken,...overrides,
});
async function previewCookie(accountData:Awaited<ReturnType<typeof account>>){
  const response=await app.request(`${previewOrigin}/api/auth/sign-in/email`,{method:"POST",headers:{origin:previewOrigin,"content-type":"application/json"},body:JSON.stringify({email:accountData.email,password:accountData.password})},previewBindings());
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";",1)[0];
}
const previewSeed=(cookie:string,authorization=`Bearer ${previewSeedToken}`,overrides:Partial<Bindings>={},body:unknown={confirmation:"seed-canonical-arroyo-vista-v1"})=>app.request(`${previewOrigin}/api/internal/seed-arroyo-vista`,{method:"POST",headers:{cookie,origin:previewOrigin,authorization,"content-type":"application/json"},body:JSON.stringify(body)},previewBindings(overrides));

beforeEach(async()=>{ await env.DB.batch([
  env.DB.prepare("DELETE FROM reviewer_revisions"),env.DB.prepare("DELETE FROM reviewer_action_kit_timeline"),env.DB.prepare("DELETE FROM reviewer_action_kit_evidence"),env.DB.prepare("DELETE FROM reviewer_action_kits"),env.DB.prepare("DELETE FROM reviewer_finding_timeline"),env.DB.prepare("DELETE FROM reviewer_finding_evidence"),env.DB.prepare("DELETE FROM reviewer_action_evidence"),env.DB.prepare("DELETE FROM reviewer_notes"),env.DB.prepare("DELETE FROM reviewer_actions"),env.DB.prepare("DELETE FROM reviewer_questions"),env.DB.prepare("DELETE FROM reviewer_findings"),
  env.DB.prepare("DELETE FROM delivery_lifecycle_events"),env.DB.prepare("DELETE FROM packet_generations"),env.DB.prepare("DELETE FROM timeline_entry_evidence"),env.DB.prepare("DELETE FROM timeline_entries"),env.DB.prepare("DELETE FROM evidence_items"),env.DB.prepare("DELETE FROM audit_events"),env.DB.prepare("DELETE FROM case_participants"),env.DB.prepare("DELETE FROM cases"),env.DB.prepare("DELETE FROM admin_bootstrap_claim"),env.DB.prepare("DELETE FROM verification"),env.DB.prepare("DELETE FROM session"),env.DB.prepare("DELETE FROM account"),env.DB.prepare('DELETE FROM "user"')
]); });

describe("canonical rich demo case",()=>{
  it("seeds idempotently with linked evidence, editorial content, and a generated packet",async()=>{
    const admin=await account("admin");
    const first=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    expect(first.status).toBe(201);
    const seeded=await first.json<{data:{case_id:string;created:boolean;outcome:string;evidence_count:number;timeline_count:number;finding_count:number;question_count:number;action_count:number;internal_note_count:number;agency_dependency_count:number;action_kit_ready:boolean;lifecycle_state:string;presentation_version:number;renderer_version:number}}>();
    expect(seeded.data).toMatchObject({created:true,outcome:"created",evidence_count:9,timeline_count:8,finding_count:4,question_count:5,action_count:5,internal_note_count:2,agency_dependency_count:3,action_kit_ready:true,lifecycle_state:"packet_generated",presentation_version:3,renderer_version:4});
    const second=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    expect(second.status).toBe(200);
    expect((await second.json<{data:typeof seeded.data}>()).data).toMatchObject({...seeded.data,created:false,outcome:"already_current"});
    const counts=await env.DB.prepare(`SELECT
      (SELECT count(*) FROM cases WHERE permit_number=?) cases,
      (SELECT count(*) FROM evidence_items WHERE case_id=?) evidence,
      (SELECT count(*) FROM timeline_entries WHERE case_id=?) timeline,
      (SELECT count(*) FROM timeline_entry_evidence te JOIN timeline_entries t ON t.id=te.timeline_entry_id WHERE t.case_id=?) links,
      (SELECT count(*) FROM delivery_lifecycle_events WHERE case_id=?) lifecycle`).bind(arroyoVistaDemoPermitNumber,seeded.data.case_id,seeded.data.case_id,seeded.data.case_id,seeded.data.case_id).first<{cases:number;evidence:number;timeline:number;links:number;lifecycle:number}>();
    expect(counts).toEqual({cases:1,evidence:9,timeline:8,links:16,lifecycle:1});

    const packetResponse=await request(`/api/v1/cases/${seeded.data.case_id}/packet`,{headers:{cookie:admin.cookie}});
    const packetBody=await packetResponse.json<{data:{packet:{presentation_version:number;findings:{items:unknown[]};open_questions:{items:unknown[]};recommended_next_actions:{items:unknown[]};agency_dependencies:unknown[];action_kit:unknown;evidence_summaries:Array<{title:string;summary:string;verification_status:string;contributor_label?:string;source:{label:string|null;url:string|null;complete:boolean}}>};quality:{blockers:unknown[];stale_snapshot:boolean};persisted_snapshot:boolean}}>();
    const serialized=JSON.stringify(packetBody.data.packet);
    expect(packetBody.data.persisted_snapshot).toBe(true);
    expect(packetBody.data.quality).toMatchObject({blockers:[],stale_snapshot:false});
    expect(packetBody.data.packet.evidence_summaries).toHaveLength(9);
    expect(packetBody.data.packet).toMatchObject({presentation_version:3});
    expect(packetBody.data.packet.findings.items).toHaveLength(4);
    expect(packetBody.data.packet.open_questions.items).toHaveLength(5);
    expect(packetBody.data.packet.recommended_next_actions.items).toHaveLength(4);
    expect(packetBody.data.packet.agency_dependencies).toHaveLength(3);
    expect(packetBody.data.packet.action_kit).not.toBeNull();
    expect(packetBody.data.packet.evidence_summaries.every((item)=>item.verification_status==="verified"&&item.source.complete)).toBe(true);
    expect(packetBody.data.packet.evidence_summaries.every((item)=>item.contributor_label&&item.contributor_label!=="Contributor not recorded")).toBe(true);
    expect(packetBody.data.packet.evidence_summaries.find((item)=>item.title==="Client status inquiry")?.source).toMatchObject({label:"Client email record",complete:true});
    expect(packetBody.data.packet.evidence_summaries.find((item)=>item.title==="Reviewer routing email note")?.source).toMatchObject({label:"Agency routing email record",complete:true});
    const portalSummary=arroyoVistaDemoEvidence.find((item)=>item.key==="portal")!.summary;
    expect(packetBody.data.packet.evidence_summaries.find((item)=>item.title==="Permit portal status capture")?.summary).toBe(portalSummary);
    expect(serialized.match(new RegExp(portalSummary.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))).toHaveLength(1);
    expect(serialized).toContain("Receipt does not establish reviewer assignment");
    expect(serialized).not.toContain("Internal only:");

    for (const extension of ["txt","html"] as const) {
      const exported=await request(`/api/v1/cases/${seeded.data.case_id}/packet.${extension}`,{headers:{cookie:admin.cookie}});
      expect(exported.status).toBe(200);
      const text=await exported.text();
      expect(text).toContain("Receipt does not establish reviewer assignment");
      expect(text).toContain("Client email record");
      expect(text).toContain("Agency routing email record");
      expect(text).not.toContain(`${portalSummary} ${portalSummary}`);
      expect(text).not.toContain("Source label pending");
      expect(text).not.toContain("Digital provenance not recorded");
      expect(text).not.toContain("Internal only:");
      expect(text).not.toMatch(/2026-\d\d-\d\dT/);
      expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    }
    const pdf=await request(`/api/v1/cases/${seeded.data.case_id}/packet.pdf`,{headers:{cookie:admin.cookie}});
    expect(pdf.status).toBe(200);
    const document=await PDFDocument.load(await pdf.arrayBuffer());
    expect(document.getPageCount()).toBeGreaterThan(3);
    const operators=pdfOperators(document);
    expect(operators).toContain(pdfHex("Client email record"));
    expect(operators).toContain(pdfHex("Agency routing email record"));
    for(const heading of ["Findings","Agency Dependency Map","Open Questions","Recommended Next Actions","Agency Follow-Up Kit","Timeline","Supporting Evidence"]){
      expect(operators).toContain(pdfHex(heading));
    }
    expect(operators).not.toContain(pdfHex("Source label pending"));
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
    const staleQuality=(await packet.json<{data:{quality:{stale_snapshot:boolean;blockers:Array<{id:string}>}}}>()).data.quality;
    expect(staleQuality.stale_snapshot).toBe(true);
    expect(staleQuality.blockers.map((item)=>item.id)).toEqual(expect.arrayContaining(["snapshot-current"]));
    const reconciled=await post(admin.cookie,"/api/dev/cases/demo/arroyo-vista");
    expect(reconciled.status).toBe(200);
    expect((await reconciled.json<{data:{outcome:string;lifecycle_state:string}}>()).data).toMatchObject({outcome:"reconciled",lifecycle_state:"packet_generated"});
    packet=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie:admin.cookie}});
    expect((await packet.json<{data:{quality:{stale_snapshot:boolean;blockers:unknown[]};lifecycle:{current_state:string}}}>()).data).toMatchObject({quality:{stale_snapshot:false,blockers:[]},lifecycle:{current_state:"packet_generated"}});
  });

  it("keeps the preview seed behind preview, administrator, origin, confirmation, and temporary-token gates",async()=>{
    const admin=await account("admin"); const client=await account("client");
    const adminCookie=await previewCookie(admin); const clientCookie=await previewCookie(client);

    expect((await previewSeed(adminCookie,undefined,{PREVIEW_DEMO_SEED_ENABLED:"false"})).status).toBe(404);
    expect((await previewSeed("",undefined,{PREVIEW_DEMO_SEED_ENABLED:"false",BETTER_AUTH_SECRET:undefined})).status).toBe(404);
    expect((await previewSeed("")).status).toBe(401);
    expect((await previewSeed(clientCookie)).status).toBe(403);
    expect((await previewSeed(adminCookie,"")).status).toBe(401);
    expect((await previewSeed(adminCookie,"Bearer incorrect-preview-seed-token-12345678901234567890")).status).toBe(401);
    expect((await previewSeed(adminCookie,undefined,{PREVIEW_DEMO_SEED_TOKEN:"too-short"})).status).toBe(503);
    expect((await previewSeed(adminCookie,undefined,{},{})).status).toBe(400);
    expect((await app.request("https://workspace.getpermitpulse.com/api/internal/seed-arroyo-vista",{method:"POST",headers:{cookie:adminCookie,origin:"https://workspace.getpermitpulse.com",authorization:`Bearer ${previewSeedToken}`,"content-type":"application/json"},body:JSON.stringify({confirmation:"seed-canonical-arroyo-vista-v1"})},previewBindings({APP_ENV:"production",BETTER_AUTH_URL:"https://workspace.getpermitpulse.com"}))).status).toBe(404);
    expect((await app.request(`${previewOrigin}/api/dev/cases/demo/arroyo-vista`,{method:"POST",headers:{cookie:adminCookie,origin:previewOrigin}},previewBindings())).status).toBe(404);
    expect((await app.request(`${previewOrigin}/api/internal/seed-arroyo-vista`,{method:"POST",headers:{cookie:adminCookie,origin:"https://attacker.example",authorization:`Bearer ${previewSeedToken}`,"content-type":"application/json"},body:JSON.stringify({confirmation:"seed-canonical-arroyo-vista-v1"})},previewBindings())).status).toBe(403);

    const first=await previewSeed(adminCookie);
    expect(first.status).toBe(201);
    expect((await first.json<{data:{outcome:string;created:boolean}}>()).data).toMatchObject({outcome:"created",created:true});
    const second=await previewSeed(adminCookie);
    expect(second.status).toBe(200);
    expect((await second.json<{data:{outcome:string;created:boolean}}>()).data).toMatchObject({outcome:"already_current",created:false});
  });
});
