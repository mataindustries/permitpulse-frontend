import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { decodePDFRawStream,PDFArray,PDFDocument,PDFRawStream } from "pdf-lib";
import { app } from "../src/worker/app";
import type { Bindings } from "../src/worker/types";

const origin="http://localhost", secret="reviewer-test-secret-123456789012345678901234";
const bindings=():Bindings=>({ADMIN_BOOTSTRAP_ENABLED:"false",APP_ENV:"local",ASSETS:env.ASSETS,AUTH_ALLOW_SIGNUP:"true",AUTH_ENABLED:"true",BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,DB:env.DB,ENABLE_DEV_CASE_API:"true"});
const request=(path:string,init?:RequestInit)=>app.request(`${origin}${path}`,init,bindings());
const post=(cookie:string,path:string,body:unknown)=>request(path,{method:"POST",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(body)});

async function setup(){
  const signup=await post("","/api/auth/sign-up/email",{name:"Reviewer Admin",email:`reviewer-${crypto.randomUUID()}@example.test`,password:"Reviewer-passphrase-42"});
  const cookie=signup.headers.get("set-cookie")!.split(";",1)[0]; const user=await signup.json<{user:{id:string}}>();
  await env.DB.prepare('UPDATE "user" SET role=? WHERE id=?').bind("admin",user.user.id).run();
  const created=await post(cookie,"/api/v1/cases",{project_name:"Editorial case",client_name:"Fictional client",address:"8 Review Way",city:"Exampleville",jurisdiction:"Example Building",permit_number:"RW-8",current_status:"ready_for_review"});
  const caseId=(await created.json<{data:{id:string}}>()).data.id;
  const evidenceResponse=await post(cookie,`/api/v1/cases/${caseId}/evidence`,{evidence_type:"portal",title:"Verified portal record",summary:"Portal record supports reviewer finding.",source_url:"https://example.test/reviewer",source_label:"Example portal",source_date:"2026-07-11"});
  const evidenceId=(await evidenceResponse.json<{data:{id:string}}>()).data.id;
  const timelineResponse=await post(cookie,`/api/v1/cases/${caseId}/timeline`,{occurred_on:"2026-07-11",timeline_type:"status_update",title:"Review event",details:"A source-backed event.",is_canonical:true,evidence_ids:[evidenceId]});
  const timelineId=(await timelineResponse.json<{data:{id:string}}>()).data.id;
  return {cookie,caseId,evidenceId,timelineId};
}

beforeEach(async()=>{ await env.DB.batch([
  env.DB.prepare("DELETE FROM reviewer_revisions"),env.DB.prepare("DELETE FROM reviewer_action_kit_timeline"),env.DB.prepare("DELETE FROM reviewer_action_kit_evidence"),env.DB.prepare("DELETE FROM reviewer_action_kits"),env.DB.prepare("DELETE FROM reviewer_finding_timeline"),env.DB.prepare("DELETE FROM reviewer_finding_evidence"),env.DB.prepare("DELETE FROM reviewer_action_evidence"),env.DB.prepare("DELETE FROM reviewer_notes"),env.DB.prepare("DELETE FROM reviewer_actions"),env.DB.prepare("DELETE FROM reviewer_questions"),env.DB.prepare("DELETE FROM reviewer_findings"),
  env.DB.prepare("DELETE FROM delivery_lifecycle_events"),env.DB.prepare("DELETE FROM packet_generations"),env.DB.prepare("DELETE FROM timeline_entry_evidence"),env.DB.prepare("DELETE FROM timeline_entries"),env.DB.prepare("DELETE FROM evidence_items"),env.DB.prepare("DELETE FROM audit_events"),env.DB.prepare("DELETE FROM case_participants"),env.DB.prepare("DELETE FROM cases"),env.DB.prepare("DELETE FROM session"),env.DB.prepare("DELETE FROM account"),env.DB.prepare('DELETE FROM "user"')
]); });

describe("reviewer editorial workspace",()=>{
  it("publishes an approved Action Kit with stable citations while excluding private and internal workflow language",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,{priority:"critical",description:"Confirm reviewer or discipline routing and determine whether any outstanding response remains.",evidence_ids:[evidenceId],estimated_impact:"Identifies accountable ownership.",responsible_party:"Permit professional",approved:true});
    await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,{priority:"medium",description:"Regenerate packet and rerun quality gate after the update.",evidence_ids:[evidenceId],estimated_impact:"Internal upkeep.",responsible_party:"PermitPulse reviewer",approved:true});
    const kit={current_position:"Receipt is recorded; routing is not confirmed.",confirmed_record:"The record confirms receipt.",unconfirmed_record:"The record does not confirm assignment.",primary_blocker:"Routing ownership is unconfirmed.",why_appropriate:"A targeted inquiry can resolve ownership.",evidence_readiness:"Receipt ready.",review_readiness:"Ready for inquiry.",email_subject:"Routing confirmation request",recipient_role:"Agency intake role",message_body:"Please confirm current routing and outstanding responses.",call_checklist:["Provide the receipt date"],requested_confirmations:["Assigned reviewer","Discipline queue","Outstanding response","Next milestone"],documents_ready:["Receipt"],escalation_trigger:"No routing confirmation by the review date.",follow_up_date:"2026-07-18",evidence_ids:[evidenceId],timeline_ids:[timelineId],internal_note:"PRIVATE ACTION KIT NOTE",approved:true};
    const saved=await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(kit)});expect(saved.status).toBe(200);
    const packet=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}});const model=(await packet.json<{data:{packet:{action_kit:{citation_references:string[]};recommended_next_actions:{items:Array<{text:string}>};evidence_summaries:Array<{reference:string}>;timeline_summaries:Array<{reference:string}>}}}>()).data.packet;
    expect(model.action_kit.citation_references).toEqual(["E01","T01"]);expect(model.evidence_summaries[0].reference).toBe("E01");expect(model.timeline_summaries[0].reference).toBe("T01");expect(model.recommended_next_actions.items.map(x=>x.text)).toEqual(["Confirm reviewer or discipline routing and determine whether any outstanding response remains."]);expect(JSON.stringify(model)).not.toContain("PRIVATE ACTION KIT NOTE");expect(JSON.stringify(model)).not.toContain("Regenerate packet");
    for(const format of ["txt","html"]){const exported=await request(`/api/v1/cases/${caseId}/packet.${format}`,{headers:{cookie}});const body=await exported.text();expect(body).toContain("Routing confirmation request");expect(body).not.toContain("PRIVATE ACTION KIT NOTE");expect(body).not.toContain("Regenerate packet");expect(body).not.toContain("rerun quality gate");}
    const pdfResponse=await request(`/api/v1/cases/${caseId}/packet.pdf`,{headers:{cookie}});const pdf=await PDFDocument.load(await pdfResponse.arrayBuffer());const operators=pdf.getPages().flatMap(page=>{const contents=page.node.Contents();const resolved=page.node.context.lookup(contents);const entries=resolved instanceof PDFArray?resolved.asArray():[contents];return entries.map(entry=>new TextDecoder().decode(decodePDFRawStream(page.node.context.lookup(entry) as PDFRawStream).decode()));}).join("\n");const hex=(value:string)=>Buffer.from(value,"latin1").toString("hex").toUpperCase();expect(operators).toContain(hex("Routing confirmation request"));expect(operators).not.toContain(hex("PRIVATE ACTION KIT NOTE"));expect(operators).not.toContain(hex("Regenerate packet"));expect(operators).not.toContain(hex("rerun quality gate"));
  });
  it("persists structured findings by reference and records immutable revisions",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    const value={title:"Portal status requires attention",finding_type:"risk",severity:"high",summary:"The recorded portal status remains unresolved.",evidence_ids:[evidenceId],timeline_ids:[timelineId],confidence:"high",recommended_resolution:"Confirm the status with the jurisdiction.",internal_notes:"Call history is internal.",approved:true};
    const created=await post(cookie,`/api/v1/cases/${caseId}/reviewer/findings`,value); expect(created.status).toBe(201);
    const body=await created.json<{data:{workspace:{findings:Array<{id:string;version:number;evidence_ids:string[];internal_notes:string}>;revisions:unknown[]}}}>();
    expect(body.data.workspace.findings[0]).toMatchObject({version:1,evidence_ids:[evidenceId],internal_notes:"Call history is internal."});
    expect(body.data.workspace.revisions).toHaveLength(1);
    const updated=await request(`/api/v1/cases/${caseId}/reviewer/findings/${body.data.workspace.findings[0].id}`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify({...value,severity:"critical",version:1})});
    expect(updated.status).toBe(200);
    const revisionCount=await env.DB.prepare("SELECT count(*) count FROM reviewer_revisions WHERE case_id=?").bind(caseId).first<{count:number}>(); expect(revisionCount?.count).toBe(2);
    expect((await request(`/api/v1/cases/${caseId}/reviewer/findings/${body.data.workspace.findings[0].id}`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify({...value,version:1})})).status).toBe(409);
  });

  it("rejects cross-case references and keeps the workspace analyst-only",async()=>{
    const {cookie,caseId}=await setup(); const other=await setup();
    const invalid=await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,{priority:"high",description:"Resolve the issue",evidence_ids:[other.evidenceId],estimated_impact:"Avoid delay",responsible_party:"Permit analyst",approved:true});
    expect(invalid.status).toBe(422); expect((await request(`/api/v1/cases/${caseId}/reviewer`)).status).toBe(401);
  });

  it("builds packet editorial language only from approved reviewer data",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    await post(cookie,`/api/v1/cases/${caseId}/reviewer/findings`,{title:"Verified jurisdiction strength",finding_type:"strength",severity:"low",summary:"The jurisdiction record is verified.",evidence_ids:[evidenceId],timeline_ids:[timelineId],confidence:"high",recommended_resolution:"Retain the verified record.",internal_notes:"Never export this phrase.",approved:true});
    const packet=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}}); const model=(await packet.json<{data:{packet:{executive_summary:{text:string;key_strengths:string[]};findings:{items:unknown[]}}}}>()).data.packet;
    expect(model.executive_summary.text).toBe("The jurisdiction record is verified."); expect(model.executive_summary.key_strengths).toEqual(["Verified jurisdiction strength"]); expect(JSON.stringify(model)).not.toContain("Never export this phrase"); expect(model.findings.items).toHaveLength(1);
  });
});
