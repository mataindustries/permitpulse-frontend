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
import type { CaseActor } from "../cases/authorization";
import {
  createCaseForActor,
  createEvidenceForActor,
  createTimelineForActor,
  getCaseById,
  listEvidenceForCase,
  listTimelineForCase,
  updateEvidenceForActor,
} from "../cases/repository";
import { readDeliveryLifecycle, recordDeliveryTransition } from "../delivery/repository";
import { buildCurrentPacketPresentation } from "../packet/service";
import { readReviewerWorkspace, saveReviewerActionKit, saveReviewerObject } from "../reviewer/repository";
import type { Bindings } from "../types";

export interface DemoSeedResult {
  case_id: string;
  created: boolean;
  evidence_count: number;
  timeline_count: number;
  finding_count: number;
  question_count: number;
  action_count: number;
  internal_note_count: number;
  lifecycle_state: DeliveryState;
}

async function findDemoCaseId(database: Bindings["DB"]): Promise<string | null> {
  const row = await database.prepare(
    "SELECT id FROM cases WHERE permit_number = ? ORDER BY created_at LIMIT 1",
  ).bind(arroyoVistaDemoPermitNumber).first<{id:string}>();
  return row?.id ?? null;
}

function requireSuccess<T extends {outcome:string}>(result: T, label: string): T & {outcome:"success"} {
  if (result.outcome !== "success") throw new Error(`Demo seed could not create ${label}: ${result.outcome}.`);
  return result as T & {outcome:"success"};
}

export async function seedArroyoVistaDemo(input: {
  actor: CaseActor;
  database: Bindings["DB"];
}): Promise<DemoSeedResult> {
  const { actor, database } = input;
  if (actor.role !== "admin") throw new Error("Demo seed requires an administrator actor.");

  let caseId = await findDemoCaseId(database);
  const created = caseId === null;
  if (!caseId) caseId = (await createCaseForActor(database, arroyoVistaDemoCase, actor, "demo-seed-arroyo-vista")).id;
  const caseRecord = await getCaseById(database, caseId);
  if (!caseRecord) throw new Error("Demo case could not be loaded after creation.");

  let evidence = await listEvidenceForCase(database, caseId, {limit:50,offset:0});
  for (const fixture of arroyoVistaDemoEvidence) {
    let record = evidence.find((item) => item.title === fixture.title);
    if (!record) {
      record = await createEvidenceForActor(database, caseId, actor, fixture);
      evidence.push(record);
    }
    if (fixture.verification_status === "verified" && record.verification_status !== "verified") {
      const updated = requireSuccess(await updateEvidenceForActor(database, caseId, actor, record, {
        expected_version:record.version,
        verification_status:"verified",
      }), fixture.title);
      record = updated.record;
      evidence = evidence.map((item) => item.id === record!.id ? record! : item);
    }
  }
  const evidenceByKey = new Map(arroyoVistaDemoEvidence.map((fixture) => [fixture.key, evidence.find((item) => item.title === fixture.title)!.id]));

  let timeline = await listTimelineForCase(database, caseId, {limit:50,offset:0});
  for (const fixture of arroyoVistaDemoTimeline) {
    if (timeline.some((item) => item.title === fixture.title)) continue;
    const result = requireSuccess(await createTimelineForActor(database, caseId, actor, {
      occurred_on:fixture.occurred_on,
      timeline_type:fixture.timeline_type,
      title:fixture.title,
      details:fixture.details,
      is_canonical:fixture.is_canonical,
      evidence_ids:fixture.evidence_keys.map((key) => evidenceByKey.get(key)!),
    }), fixture.title);
    timeline.push(result.record);
  }
  const timelineByKey = new Map(arroyoVistaDemoTimeline.map((fixture) => [fixture.key, timeline.find((item) => item.title === fixture.title)!.id]));

  let workspace = await readReviewerWorkspace(database, caseId);
  for (const fixture of arroyoVistaDemoFindings) {
    if (workspace.findings.some((item) => item.title === fixture.title)) continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "finding", {
      ...fixture,
      evidence_ids:fixture.evidence_keys.map((key) => evidenceByKey.get(key)!),
      timeline_ids:fixture.timeline_keys.map((key) => timelineByKey.get(key)!),
    }), fixture.title);
    workspace = result.workspace;
  }
  for (const fixture of arroyoVistaDemoQuestions) {
    if (workspace.questions.some((item) => item.question === fixture.question)) continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "question", fixture), fixture.question);
    workspace = result.workspace;
  }
  for (const fixture of arroyoVistaDemoActions) {
    if (workspace.actions.some((item) => item.description === fixture.description)) continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "action", {
      ...fixture,
      evidence_ids:fixture.evidence_keys.map((key) => evidenceByKey.get(key)!),
    }), fixture.description);
    workspace = result.workspace;
  }
  for (const fixture of arroyoVistaDemoNotes) {
    if (workspace.notes.some((item) => item.commentary === fixture.commentary)) continue;
    const result = requireSuccess(await saveReviewerObject(database, caseId, actor.id, "note", fixture), fixture.commentary);
    workspace = result.workspace;
  }
  if(!workspace.action_kit){
    const result=requireSuccess(await saveReviewerActionKit(database,caseId,actor.id,{...arroyoVistaDemoActionKit,evidence_ids:["receipt","reviewer-email","corrections","structural","energy"].map(key=>evidenceByKey.get(key)!),timeline_ids:["uploaded","intake","waiting"].map(key=>timelineByKey.get(key)!)}),"Action Kit");
    workspace=result.workspace;
  }

  let lifecycle = await readDeliveryLifecycle(database, caseId);
  if (lifecycle.current_state === "draft") {
    const packet = await buildCurrentPacketPresentation({caseRecord,database,generatedAt:new Date()});
    const transition = await recordDeliveryTransition({
      actor,
      caseId,
      caseVersion:caseRecord.version,
      database,
      eventType:"packet_generated",
      idempotencyKey:"demo-seed-arroyo-vista-packet-v1",
      note:"Fictional demo packet generated for local workflow validation.",
      packet,
    });
    if (!("lifecycle" in transition)) throw new Error(`Demo packet generation failed: ${transition.kind}.`);
    lifecycle = transition.lifecycle;
  }

  return {
    case_id:caseId,
    created,
    evidence_count:evidence.length,
    timeline_count:timeline.length,
    finding_count:workspace.findings.length,
    question_count:workspace.questions.length,
    action_count:workspace.actions.length,
    internal_note_count:workspace.notes.filter((item) => !item.publishable).length,
    lifecycle_state:lifecycle.current_state,
  };
}
