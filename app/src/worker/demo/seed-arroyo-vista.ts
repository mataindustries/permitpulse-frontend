import {
  arroyoVistaDemoActions,
  arroyoVistaDemoActionKit,
  arroyoVistaDemoCase,
  arroyoVistaDemoEvidence,
  arroyoVistaDemoFindings,
  arroyoVistaDemoNotes,
  arroyoVistaDemoPermitNumber,
  arroyoVistaDemoQuestions,
  arroyoVistaDemoTimeline,
} from "../../shared/demo/arroyo-vista-demo";
import type { DeliveryState } from "../../shared/delivery-lifecycle/types";
import { packetRendererVersion } from "../../shared/packet/presentation-summary";
import { packetPresentationVersion } from "../../shared/packet/types";
import type {
  ReviewerAction,
  ReviewerFinding,
  ReviewerNote,
  ReviewerQuestion,
} from "../../shared/reviewer/types";
import type { CaseActor } from "../cases/authorization";
import {
  createCaseForActor,
  createEvidenceForActor,
  createTimelineForActor,
  getCaseById,
  linkEvidenceToTimelineForActor,
  listEvidenceForCase,
  listTimelineForCase,
  unlinkEvidenceFromTimelineForActor,
  updateCaseMetadataForActor,
  updateCaseStatusForActor,
  updateEvidenceForActor,
  updateTimelineForActor,
  type CaseResponse,
} from "../cases/repository";
import {
  packetComparableDigest,
  readDeliveryLifecycle,
  readGeneratedPacketSnapshot,
  recordDeliveryTransition,
  sha256,
} from "../delivery/repository";
import { buildStablePacketPresentation } from "../packet/service";
import { readReviewerWorkspace, saveReviewerActionKit, saveReviewerObject } from "../reviewer/repository";
import type { Bindings } from "../types";

export interface DemoSeedResult {
  case_id: string;
  created: boolean;
  outcome: "created" | "reconciled" | "already_current";
  evidence_count: number;
  timeline_count: number;
  finding_count: number;
  question_count: number;
  action_count: number;
  internal_note_count: number;
  agency_dependency_count: number;
  action_kit_ready: boolean;
  lifecycle_state: DeliveryState;
  presentation_version: typeof packetPresentationVersion;
  renderer_version: typeof packetRendererVersion;
}

async function findDemoCaseId(database: Bindings["DB"]): Promise<string | null> {
  const result = await database.prepare(
    "SELECT id FROM cases WHERE permit_number = ? ORDER BY created_at LIMIT 2",
  ).bind(arroyoVistaDemoPermitNumber).all<{id:string}>();
  if (result.results.length > 1) {
    throw new Error("Demo seed found more than one canonical permit case; manual reconciliation is required.");
  }
  return result.results[0]?.id ?? null;
}

function requireSuccess<T extends {outcome:string}>(result: T, label: string): T & {outcome:"success"} {
  if (result.outcome !== "success") throw new Error(`Demo seed could not create ${label}: ${result.outcome}.`);
  return result as T & {outcome:"success"};
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function findingMatches(record: ReviewerFinding, fixture: typeof arroyoVistaDemoFindings[number], evidenceIds: string[], timelineIds: string[]): boolean {
  return record.title === fixture.title && record.finding_type === fixture.finding_type &&
    record.severity === fixture.severity && record.summary === fixture.summary &&
    record.confidence === fixture.confidence && record.recommended_resolution === fixture.recommended_resolution &&
    record.internal_notes === fixture.internal_notes && record.approved === fixture.approved &&
    sameIds(record.evidence_ids,evidenceIds) && sameIds(record.timeline_ids,timelineIds);
}

function questionMatches(record: ReviewerQuestion, fixture: typeof arroyoVistaDemoQuestions[number]): boolean {
  return record.question === fixture.question && record.why_it_matters === fixture.why_it_matters &&
    record.evidence_requested === fixture.evidence_requested && record.assigned_reviewer === fixture.assigned_reviewer &&
    record.status === fixture.status && record.publishable === fixture.publishable;
}

function actionMatches(record: ReviewerAction, fixture: typeof arroyoVistaDemoActions[number], evidenceIds: string[]): boolean {
  return record.priority === fixture.priority && record.description === fixture.description &&
    record.estimated_impact === fixture.estimated_impact && record.responsible_party === fixture.responsible_party &&
    record.due_date === fixture.due_date && record.approved === fixture.approved && sameIds(record.evidence_ids,evidenceIds);
}

function noteMatches(record: ReviewerNote, fixture: typeof arroyoVistaDemoNotes[number]): boolean {
  return record.commentary === fixture.commentary && record.publishable === fixture.publishable;
}

export async function seedArroyoVistaDemo(input: {
  actor: CaseActor;
  database: Bindings["DB"];
}): Promise<DemoSeedResult> {
  const { actor, database } = input;
  if (actor.role !== "admin") throw new Error("Demo seed requires an administrator actor.");

  let caseId = await findDemoCaseId(database);
  const created = caseId === null;
  let reconciled = false;
  if (!caseId) caseId = (await createCaseForActor(database, arroyoVistaDemoCase, actor, "demo-seed-arroyo-vista")).id;
  const loadedCaseRecord = await getCaseById(database, caseId);
  if (!loadedCaseRecord) throw new Error("Demo case could not be loaded after creation.");
  let caseRecord: CaseResponse = loadedCaseRecord;

  const metadata = {
    project_name:arroyoVistaDemoCase.project_name,
    client_name:arroyoVistaDemoCase.client_name,
    address:arroyoVistaDemoCase.address,
    city:arroyoVistaDemoCase.city,
    jurisdiction:arroyoVistaDemoCase.jurisdiction,
    permit_number:arroyoVistaDemoCase.permit_number,
  };
  if (Object.entries(metadata).some(([field,value]) => caseRecord![field as keyof typeof metadata] !== value)) {
    const updated = requireSuccess(await updateCaseMetadataForActor(database,actor,caseRecord,{
      expected_version:caseRecord.version,
      ...metadata,
    },"demo-seed-arroyo-vista"),"canonical case metadata");
    caseRecord=updated.record;
    reconciled=true;
  }
  const statusPath = {
    intake:["researching","ready_for_review"],
    researching:["ready_for_review"],
    needs_information:["ready_for_review"],
    ready_for_review:[],
  } as const;
  for (const status of statusPath[caseRecord.current_status]) {
    const statusUpdate=await updateCaseStatusForActor(database,actor,caseRecord,{
      expected_version:caseRecord.version,
      current_status:status,
    },"demo-seed-arroyo-vista");
    const updated=requireSuccess(statusUpdate,"canonical case status");
    caseRecord=updated.record;
    reconciled=true;
  }

  let evidence = await listEvidenceForCase(database, caseId, {limit:50,offset:0});
  for (const fixture of arroyoVistaDemoEvidence) {
    let record = evidence.find((item) => item.title === fixture.title);
    if (!record) {
      record = await createEvidenceForActor(database, caseId, actor, fixture);
      evidence.push(record);
      reconciled=true;
    }
    const fixturePatch = {
      evidence_type: fixture.evidence_type,
      title: fixture.title,
      summary: fixture.summary,
      source_url: fixture.source_url,
      source_label: fixture.source_label,
      source_date: fixture.source_date,
      verification_status: fixture.verification_status,
    };
    if (Object.entries(fixturePatch).some(([field, value]) => record![field as keyof typeof record] !== value)) {
      const updated = requireSuccess(await updateEvidenceForActor(database, caseId, actor, record, {
        expected_version:record.version,
        ...fixturePatch,
      }), fixture.title);
      record = updated.record;
      evidence = evidence.map((item) => item.id === record!.id ? record! : item);
      reconciled=true;
    }
  }
  const evidenceByKey = new Map(arroyoVistaDemoEvidence.map((fixture) => [fixture.key, evidence.find((item) => item.title === fixture.title)!.id]));

  let timeline = await listTimelineForCase(database, caseId, {limit:50,offset:0});
  for (const fixture of arroyoVistaDemoTimeline) {
    const expectedEvidenceIds=fixture.evidence_keys.map((key) => evidenceByKey.get(key)!);
    let record=timeline.find((item) => item.title === fixture.title);
    if(!record){
      const result = requireSuccess(await createTimelineForActor(database, caseId, actor, {
        occurred_on:fixture.occurred_on,
        timeline_type:fixture.timeline_type,
        title:fixture.title,
        details:fixture.details,
        is_canonical:fixture.is_canonical,
        evidence_ids:expectedEvidenceIds,
      }), fixture.title);
      record=result.record;
      timeline.push(record);
      reconciled=true;
    }
    const timelinePatch={occurred_on:fixture.occurred_on,timeline_type:fixture.timeline_type,title:fixture.title,details:fixture.details,is_canonical:fixture.is_canonical};
    if(Object.entries(timelinePatch).some(([field,value])=>record![field as keyof typeof timelinePatch]!==value)){
      const result=requireSuccess(await updateTimelineForActor(database,caseId,actor,record,{expected_version:record.version,...timelinePatch}),fixture.title);
      record=result.record;
      reconciled=true;
    }
    for(const evidenceId of record.evidence_ids.filter((id)=>!expectedEvidenceIds.includes(id))){
      record=requireSuccess(await unlinkEvidenceFromTimelineForActor(database,caseId,actor,record.id,evidenceId),fixture.title).record;
      reconciled=true;
    }
    for(const evidenceId of expectedEvidenceIds.filter((id)=>!record!.evidence_ids.includes(id))){
      record=requireSuccess(await linkEvidenceToTimelineForActor(database,caseId,actor,record.id,evidenceId),fixture.title).record;
      reconciled=true;
    }
    timeline=timeline.map((item)=>item.id===record!.id?record!:item);
  }
  const timelineByKey = new Map(arroyoVistaDemoTimeline.map((fixture) => [fixture.key, timeline.find((item) => item.title === fixture.title)!.id]));

  let workspace = await readReviewerWorkspace(database, caseId);
  for (const fixture of arroyoVistaDemoFindings) {
    const evidenceIds=fixture.evidence_keys.map((key) => evidenceByKey.get(key)!);
    const timelineIds=fixture.timeline_keys.map((key) => timelineByKey.get(key)!);
    const existing=workspace.findings.find((item) => item.title === fixture.title);
    if(existing&&findingMatches(existing,fixture,evidenceIds,timelineIds))continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "finding", {
      ...fixture,
      evidence_ids:evidenceIds,
      timeline_ids:timelineIds,
      ...(existing?{version:existing.version}:{}),
    },existing?.id), fixture.title);
    workspace = result.workspace;
    reconciled=true;
  }
  for (const fixture of arroyoVistaDemoQuestions) {
    const existing=workspace.questions.find((item) => item.question === fixture.question);
    if(existing&&questionMatches(existing,fixture))continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "question", {
      ...fixture,
      ...(existing?{version:existing.version}:{}),
    },existing?.id), fixture.question);
    workspace = result.workspace;
    reconciled=true;
  }
  for (const fixture of arroyoVistaDemoActions) {
    const evidenceIds=fixture.evidence_keys.map((key) => evidenceByKey.get(key)!);
    const existing=workspace.actions.find((item) => item.description === fixture.description);
    if(existing&&actionMatches(existing,fixture,evidenceIds))continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "action", {
      ...fixture,
      evidence_ids:evidenceIds,
      ...(existing?{version:existing.version}:{}),
    },existing?.id), fixture.description);
    workspace = result.workspace;
    reconciled=true;
  }
  for (const fixture of arroyoVistaDemoNotes) {
    const existing=workspace.notes.find((item) => item.commentary === fixture.commentary);
    if(existing&&noteMatches(existing,fixture))continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "note", {
      ...fixture,
      ...(existing?{version:existing.version}:{}),
    },existing?.id), fixture.commentary);
    workspace = result.workspace;
    reconciled=true;
  }
  const actionKitInput={...arroyoVistaDemoActionKit,evidence_ids:["receipt","reviewer-email","corrections","structural","energy"].map(key=>evidenceByKey.get(key)!),timeline_ids:["uploaded","intake","waiting"].map(key=>timelineByKey.get(key)!)};
  const actionKit=workspace.action_kit;
  const actionKitMatches=actionKit&&Object.entries(actionKitInput).every(([field,value])=>{
    const actual=actionKit[field as keyof typeof actionKit];
    return Array.isArray(value)&&Array.isArray(actual)?sameIds(actual,value):actual===value;
  });
  if(!actionKitMatches){
    const result=requireSuccess(await saveReviewerActionKit(database,caseId,actor.id,{...actionKitInput,...(actionKit?{version:actionKit.version}:{})}),"Action Kit");
    workspace=result.workspace;
    reconciled=true;
  }

  let lifecycle = await readDeliveryLifecycle(database, caseId);
  const stablePacket = await buildStablePacketPresentation({caseRecord,database,generatedAt:new Date()});
  const snapshot=lifecycle.active_packet_generation_id
    ?await readGeneratedPacketSnapshot(database,caseId,lifecycle.active_packet_generation_id)
    :null;
  const packetCurrent=Boolean(snapshot?.packet)&&
    await packetComparableDigest(snapshot!.packet!)===await packetComparableDigest(stablePacket.packet);
  if (!packetCurrent) {
    const revisionDigest=await sha256(JSON.stringify(stablePacket.packet_input_revision));
    const transition = await recordDeliveryTransition({
      actor,
      caseId,
      caseVersion:stablePacket.case_record.version,
      database,
      eventType:"packet_generated",
      idempotencyKey:`demo-seed-arroyo-vista-packet-${revisionDigest.slice(0,32)}`,
      note:"Fictional demo packet generated for controlled workflow validation.",
      packet:stablePacket.packet,
      packetInputRevision:stablePacket.packet_input_revision,
    });
    if (!("lifecycle" in transition)) throw new Error(`Demo packet generation failed: ${transition.kind}.`);
    lifecycle = transition.lifecycle;
    reconciled=true;
  }

  const finalPacket=packetCurrent?snapshot!.packet!:stablePacket.packet;

  return {
    case_id:caseId,
    created,
    outcome:created?"created":reconciled?"reconciled":"already_current",
    evidence_count:arroyoVistaDemoEvidence.length,
    timeline_count:arroyoVistaDemoTimeline.length,
    finding_count:arroyoVistaDemoFindings.length,
    question_count:arroyoVistaDemoQuestions.length,
    action_count:arroyoVistaDemoActions.length,
    internal_note_count:arroyoVistaDemoNotes.filter((item) => !item.publishable).length,
    agency_dependency_count:finalPacket.agency_dependencies?.length??0,
    action_kit_ready:Boolean(finalPacket.action_kit),
    lifecycle_state:lifecycle.current_state,
    presentation_version:packetPresentationVersion,
    renderer_version:packetRendererVersion,
  };
}
