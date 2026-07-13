import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { decodePDFRawStream,PDFArray,PDFDocument,PDFRawStream } from "pdf-lib";
import { app } from "../src/worker/app";
import { saveReviewerActionKit, saveReviewerObject } from "../src/worker/reviewer/repository";
import type { ActionKitInput, FindingInput } from "../src/worker/reviewer/validation";
import type { Bindings } from "../src/worker/types";

const origin="http://localhost", secret="reviewer-test-secret-123456789012345678901234";
const bindings=(database:Bindings["DB"]=env.DB):Bindings=>({ADMIN_BOOTSTRAP_ENABLED:"false",APP_ENV:"local",ASSETS:env.ASSETS,AUTH_ALLOW_SIGNUP:"true",AUTH_ENABLED:"true",BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,DB:database,ENABLE_DEV_CASE_API:"true"});
const request=(path:string,init?:RequestInit)=>app.request(`${origin}${path}`,init,bindings());
const post=(cookie:string,path:string,body:unknown)=>request(path,{method:"POST",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(body)});

async function pdfOperators(response: Response): Promise<string> {
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    const resolved = page.node.context.lookup(contents);
    const entries = resolved instanceof PDFArray ? resolved.asArray() : [contents];
    return entries.map((entry) =>
      new TextDecoder().decode(
        decodePDFRawStream(page.node.context.lookup(entry) as PDFRawStream).decode(),
      ),
    );
  }).join("\n");
}

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
  return {cookie,caseId,evidenceId,timelineId,userId:user.user.id};
}

function actionKitInput(
  evidenceId: string,
  timelineId: string,
  overrides: Partial<ActionKitInput> = {},
): ActionKitInput {
  return {
    current_position:"Receipt is recorded; routing is not confirmed.",
    confirmed_record:"The record confirms receipt.",
    unconfirmed_record:"The record does not confirm assignment.",
    primary_blocker:"Routing ownership is unconfirmed.",
    why_appropriate:"A targeted inquiry can resolve ownership.",
    evidence_readiness:"Receipt ready.",
    review_readiness:"Ready for inquiry.",
    email_subject:"Routing confirmation request",
    recipient_role:"Agency intake role",
    message_body:"Please confirm current routing and outstanding responses.",
    call_checklist:["Provide the receipt date"],
    requested_confirmations:["Assigned reviewer","Discipline queue"],
    documents_ready:["Receipt"],
    escalation_trigger:"No routing confirmation by the review date.",
    follow_up_date:"2026-07-18",
    evidence_ids:[evidenceId],
    timeline_ids:[timelineId],
    internal_note:"Private Action Kit note.",
    approved:true,
    ...overrides,
  };
}

function reviewerReadBarrier(
  database: Bindings["DB"],
  queryPrefix = "SELECT * FROM reviewer_findings WHERE id=? AND case_id=?",
): Bindings["DB"] {
  let arrivalCount = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  return {
    prepare(query: string) {
      const statement = database.prepare(query);
      if (!query.startsWith(queryPrefix)) {
        return statement;
      }

      return {
        bind(...values: unknown[]) {
          const bound = statement.bind(...values);
          return {
            async first<T>() {
              const row = await bound.first<T>();
              arrivalCount += 1;
              if (arrivalCount === 2) release();
              await gate;
              return row;
            },
          } as D1PreparedStatement;
        },
      } as D1PreparedStatement;
    },
    batch: database.batch.bind(database),
  } as unknown as Bindings["DB"];
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

  it("treats an identical versionless Action Kit PUT as a replay",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    const value=actionKitInput(evidenceId,timelineId);
    const first=await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(value)});
    const retry=await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(value)});
    expect([first.status,retry.status]).toEqual([200,200]);
    const firstKit=(await first.json<{data:{workspace:{action_kit:{id:string;version:number}}}}>()).data.workspace.action_kit;
    const retryKit=(await retry.json<{data:{workspace:{action_kit:{id:string;version:number}}}}>()).data.workspace.action_kit;
    expect(retryKit).toEqual(firstKit);

    const different=await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify({...value,message_body:"A different versionless request must not overwrite the singleton."})});
    expect(different.status).toBe(409);
    const counts=await env.DB.prepare("SELECT (SELECT count(*) FROM reviewer_action_kits WHERE case_id=?) kits,(SELECT count(*) FROM reviewer_revisions WHERE case_id=? AND object_type='action_kit') revisions").bind(caseId,caseId).first<{kits:number;revisions:number}>();
    expect(counts).toEqual({kits:1,revisions:1});
  });

  it("resolves concurrent Action Kit creates as replay or conflict instead of a server error",async()=>{
    const identicalCase=await setup();
    const identical=actionKitInput(identicalCase.evidenceId,identicalCase.timelineId);
    const identicalDatabase=reviewerReadBarrier(env.DB,"SELECT * FROM reviewer_action_kits WHERE case_id=?");
    const identicalOutcomes=await Promise.all([
      saveReviewerActionKit(identicalDatabase,identicalCase.caseId,identicalCase.userId,identical),
      saveReviewerActionKit(identicalDatabase,identicalCase.caseId,identicalCase.userId,identical),
    ]);
    expect(identicalOutcomes.map((item)=>item.outcome)).toEqual(["success","success"]);
    const identicalCounts=await env.DB.prepare("SELECT (SELECT count(*) FROM reviewer_action_kits WHERE case_id=?) kits,(SELECT count(*) FROM reviewer_revisions WHERE case_id=? AND object_type='action_kit') revisions").bind(identicalCase.caseId,identicalCase.caseId).first<{kits:number;revisions:number}>();
    expect(identicalCounts).toEqual({kits:1,revisions:1});

    const competingCase=await setup();
    const first=actionKitInput(competingCase.evidenceId,competingCase.timelineId,{current_position:"Concurrent candidate A"});
    const second=actionKitInput(competingCase.evidenceId,competingCase.timelineId,{current_position:"Concurrent candidate B"});
    const competingDatabase=reviewerReadBarrier(env.DB,"SELECT * FROM reviewer_action_kits WHERE case_id=?");
    const competingOutcomes=await Promise.all([
      saveReviewerActionKit(competingDatabase,competingCase.caseId,competingCase.userId,first),
      saveReviewerActionKit(competingDatabase,competingCase.caseId,competingCase.userId,second),
    ]);
    expect(competingOutcomes.map((item)=>item.outcome).sort()).toEqual(["conflict","success"]);
    const competingCounts=await env.DB.prepare("SELECT (SELECT count(*) FROM reviewer_action_kits WHERE case_id=?) kits,(SELECT count(*) FROM reviewer_revisions WHERE case_id=? AND object_type='action_kit') revisions").bind(competingCase.caseId,competingCase.caseId).first<{kits:number;revisions:number}>();
    expect(competingCounts).toEqual({kits:1,revisions:1});
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

  it("keeps a concurrent stale reviewer update from changing links or revisions",async()=>{
    const {cookie,caseId,evidenceId,timelineId,userId}=await setup();
    const secondEvidenceResponse=await post(cookie,`/api/v1/cases/${caseId}/evidence`,{evidence_type:"portal",title:"Second portal record",summary:"Second record for the reviewer race.",source_url:"https://example.test/reviewer-2",source_label:"Second portal",source_date:"2026-07-12"});
    const secondEvidenceId=(await secondEvidenceResponse.json<{data:{id:string}}>()).data.id;
    const secondTimelineResponse=await post(cookie,`/api/v1/cases/${caseId}/timeline`,{occurred_on:"2026-07-12",timeline_type:"status_update",title:"Second review event",details:"A second source-backed event.",is_canonical:true,evidence_ids:[secondEvidenceId]});
    const secondTimelineId=(await secondTimelineResponse.json<{data:{id:string}}>()).data.id;
    const original={title:"Original finding",finding_type:"risk",severity:"high",summary:"The original finding remains unresolved.",evidence_ids:[evidenceId],timeline_ids:[timelineId],confidence:"high",recommended_resolution:"Confirm the original record.",internal_notes:"",approved:true} satisfies Omit<FindingInput,"version">;
    const created=await post(cookie,`/api/v1/cases/${caseId}/reviewer/findings`,original);
    const findingId=(await created.json<{data:{workspace:{findings:Array<{id:string}>}}}>()).data.workspace.findings[0].id;
    const first={...original,title:"Concurrent winner A",evidence_ids:[evidenceId],timeline_ids:[timelineId],version:1} satisfies FindingInput;
    const second={...original,title:"Concurrent winner B",evidence_ids:[secondEvidenceId],timeline_ids:[secondTimelineId],version:1} satisfies FindingInput;
    const raceDatabase=reviewerReadBarrier(env.DB);

    const outcomes=await Promise.all([
      saveReviewerObject(raceDatabase,caseId,userId,"finding",first,findingId),
      saveReviewerObject(raceDatabase,caseId,userId,"finding",second,findingId),
    ]);
    expect(outcomes.map((item)=>item.outcome).sort()).toEqual(["conflict","success"]);

    const row=await env.DB.prepare("SELECT title,version,updated_at FROM reviewer_findings WHERE id=?").bind(findingId).first<{title:string;version:number;updated_at:string}>();
    const evidenceLinks=await env.DB.prepare("SELECT evidence_item_id id FROM reviewer_finding_evidence WHERE finding_id=?").bind(findingId).all<{id:string}>();
    const timelineLinks=await env.DB.prepare("SELECT timeline_entry_id id FROM reviewer_finding_timeline WHERE finding_id=?").bind(findingId).all<{id:string}>();
    const revisions=await env.DB.prepare("SELECT new_value_json FROM reviewer_revisions WHERE object_id=? ORDER BY created_at,id").bind(findingId).all<{new_value_json:string}>();
    const winnerIsFirst=row?.title==="Concurrent winner A";

    expect(row?.version).toBe(2);
    expect(row?.updated_at).not.toContain("reviewer-mutation:");
    expect(evidenceLinks.results.map((item)=>item.id)).toEqual([winnerIsFirst?evidenceId:secondEvidenceId]);
    expect(timelineLinks.results.map((item)=>item.id)).toEqual([winnerIsFirst?timelineId:secondTimelineId]);
    expect(revisions.results).toHaveLength(2);
    expect(revisions.results.map((item)=>JSON.parse(item.new_value_json) as {title:string}).map((item)=>item.title)).toEqual(expect.arrayContaining(["Original finding",row!.title]));
    expect(revisions.results.map((item)=>JSON.parse(item.new_value_json) as {title:string}).map((item)=>item.title)).not.toContain(winnerIsFirst?"Concurrent winner B":"Concurrent winner A");
  });

  it("rejects duplicate reviewer references before persistence",async()=>{
    const {cookie,caseId,evidenceId}=await setup();
    const response=await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,{priority:"high",description:"Resolve the duplicate reference",evidence_ids:[evidenceId,evidenceId],estimated_impact:"Avoid an invalid revision",responsible_party:"Permit analyst",approved:true});
    expect(response.status).toBe(422);
    const counts=await env.DB.prepare("SELECT (SELECT count(*) FROM reviewer_actions) actions,(SELECT count(*) FROM reviewer_revisions) revisions").first<{actions:number;revisions:number}>();
    expect(counts).toEqual({actions:0,revisions:0});
  });

  it("keeps repeated reviewer create POSTs idempotent",async()=>{
    const {cookie,caseId,evidenceId}=await setup();
    const value={priority:"high",description:"Confirm the recorded reviewer assignment.",evidence_ids:[evidenceId],estimated_impact:"Avoid a duplicate follow-up.",responsible_party:"Permit analyst",approved:true};
    const first=await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,value);
    const retry=await post(cookie,`/api/v1/cases/${caseId}/reviewer/actions`,value);
    expect([first.status,retry.status]).toEqual([201,201]);
    const firstId=(await first.json<{data:{workspace:{actions:Array<{id:string}>}}}>()).data.workspace.actions[0].id;
    const retryId=(await retry.json<{data:{workspace:{actions:Array<{id:string}>}}}>()).data.workspace.actions[0].id;
    expect(retryId).toBe(firstId);
    expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const counts=await env.DB.prepare("SELECT (SELECT count(*) FROM reviewer_actions) actions,(SELECT count(*) FROM reviewer_revisions WHERE object_type='action') revisions").first<{actions:number;revisions:number}>();
    expect(counts).toEqual({actions:1,revisions:1});
  });

  it("denies reviewer reads and writes to an owner client",async()=>{
    const signup=await post("","/api/auth/sign-up/email",{name:"Reviewer Client",email:`client-${crypto.randomUUID()}@example.test`,password:"Reviewer-passphrase-42"});
    const cookie=signup.headers.get("set-cookie")!.split(";",1)[0];
    const created=await post(cookie,"/api/v1/cases",{project_name:"Client reviewer boundary",client_name:"Fictional client",address:"9 Review Way",city:"Exampleville",jurisdiction:"Example Building",permit_number:"RW-9",current_status:"intake"});
    const caseId=(await created.json<{data:{id:string}}>()).data.id;
    const read=await request(`/api/v1/cases/${caseId}/reviewer`,{headers:{cookie}});
    const write=await post(cookie,`/api/v1/cases/${caseId}/reviewer/notes`,{commentary:"A client must not create this note.",publishable:false});
    expect([read.status,write.status]).toEqual([403,403]);
    expect(await env.DB.prepare("SELECT count(*) count FROM reviewer_notes").first<{count:number}>()).toEqual({count:0});
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

  it("never exports reviewer, finding, or Action Kit internal notes",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    const privatePhrases=["PRIVATE FINDING NOTE","PRIVATE REVIEWER NOTE","PRIVATE ACTION KIT NOTE"];
    expect((await post(cookie,`/api/v1/cases/${caseId}/reviewer/findings`,{title:"Export-safe finding",finding_type:"risk",severity:"medium",summary:"The public finding remains evidence-grounded.",evidence_ids:[evidenceId],timeline_ids:[timelineId],confidence:"high",recommended_resolution:"Confirm the public record.",internal_notes:privatePhrases[0],approved:true})).status).toBe(201);
    expect((await post(cookie,`/api/v1/cases/${caseId}/reviewer/notes`,{commentary:privatePhrases[1],publishable:true})).status).toBe(201);
    const kit=actionKitInput(evidenceId,timelineId,{internal_note:privatePhrases[2]});
    expect((await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(kit)})).status).toBe(200);

    const preview=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}});
    const htmlResponse=await request(`/api/v1/cases/${caseId}/packet.html`,{headers:{cookie}});
    const textResponse=await request(`/api/v1/cases/${caseId}/packet.txt`,{headers:{cookie}});
    const pdfResponse=await request(`/api/v1/cases/${caseId}/packet.pdf`,{headers:{cookie}});
    expect([preview.status,htmlResponse.status,textResponse.status,pdfResponse.status]).toEqual([200,200,200,200]);
    const previewBody=await preview.text();
    const html=await htmlResponse.text();
    const text=await textResponse.text();
    const pdf=await pdfOperators(pdfResponse);

    for(const phrase of privatePhrases){
      expect(previewBody).not.toContain(phrase);
      expect(html).not.toContain(phrase);
      expect(text).not.toContain(phrase);
      expect(pdf).not.toContain(Buffer.from(phrase,"latin1").toString("hex").toUpperCase());
    }
  });

  it("keeps an unapproved Action Kit out of every packet surface",async()=>{
    const {cookie,caseId,evidenceId,timelineId}=await setup();
    const kit={current_position:"UNAPPROVED KIT POSITION",confirmed_record:"UNAPPROVED KIT RECORD",unconfirmed_record:"The record remains incomplete.",primary_blocker:"Routing is open.",why_appropriate:"A follow-up may be appropriate.",evidence_readiness:"Evidence is recorded.",review_readiness:"Review is pending.",email_subject:"UNAPPROVED KIT SUBJECT",recipient_role:"Agency intake role",message_body:"UNAPPROVED KIT MESSAGE",call_checklist:["UNAPPROVED KIT CALL"],requested_confirmations:["UNAPPROVED KIT CONFIRMATION"],documents_ready:["UNAPPROVED KIT DOCUMENT"],escalation_trigger:"UNAPPROVED KIT ESCALATION",follow_up_date:null,evidence_ids:[evidenceId],timeline_ids:[timelineId],internal_note:"UNAPPROVED KIT PRIVATE",approved:false};
    expect((await request(`/api/v1/cases/${caseId}/reviewer/action-kit`,{method:"PUT",headers:{cookie,"content-type":"application/json",origin},body:JSON.stringify(kit)})).status).toBe(200);
    const preview=await request(`/api/v1/cases/${caseId}/packet`,{headers:{cookie}});
    const previewText=await preview.text();
    expect(previewText).not.toContain("UNAPPROVED KIT");
    for(const format of ["txt","html"]){
      const exported=await request(`/api/v1/cases/${caseId}/packet.${format}`,{headers:{cookie}});
      expect(await exported.text()).not.toContain("UNAPPROVED KIT");
    }
    const pdfResponse=await request(`/api/v1/cases/${caseId}/packet.pdf`,{headers:{cookie}});
    const operators=await pdfOperators(pdfResponse);
    expect(operators).not.toContain(Buffer.from("UNAPPROVED KIT","latin1").toString("hex").toUpperCase());
  });
});
