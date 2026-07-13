import type { ReviewerAction, ReviewerActionKit, ReviewerFinding, ReviewerNote, ReviewerQuestion, ReviewerRevision, ReviewerWorkspace } from "../../shared/reviewer/types";
import type { Bindings } from "../types";
import type { ActionInput, ActionKitInput, FindingInput, NoteInput, QuestionInput } from "./validation";

type Kind = "finding" | "question" | "action" | "note" | "action_kit";
type EditableKind = Exclude<Kind,"action_kit">;
type Input = FindingInput | QuestionInput | ActionInput | NoteInput | ActionKitInput;
const config = {
  finding: { table: "reviewer_findings", fields: ["title","finding_type","severity","summary","confidence","recommended_resolution","internal_notes","approved"] },
  question: { table: "reviewer_questions", fields: ["question","why_it_matters","evidence_requested","assigned_reviewer","status","publishable"] },
  action: { table: "reviewer_actions", fields: ["priority","description","estimated_impact","responsible_party","due_date","approved"] },
  note: { table: "reviewer_notes", fields: ["commentary","publishable"] },
} as const;

function reviewerMutationMarker(): string {
  return `reviewer-mutation:${crypto.randomUUID()}`;
}

async function reviewerCreateId(
  caseId: string,
  kind: EditableKind,
  input: Exclude<Input,ActionKitInput>,
): Promise<string> {
  const { version: _version, ...content } = input;
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ caseId, kind, content })),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const digest = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}

function mutationGuard(table: string): string {
  return `EXISTS (SELECT 1 FROM ${table} WHERE id=? AND case_id=? AND updated_at=?)`;
}

function bools<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const key of ["approved", "publishable"]) if (key in copy) copy[key as keyof T] = Boolean(copy[key]) as T[keyof T];
  return copy;
}
async function links(db: Bindings["DB"], table: string, owner: string, ownerId: string, target: string): Promise<string[]> {
  const result = await db.prepare(`SELECT ${target} AS id FROM ${table} WHERE ${owner} = ? ORDER BY ${target}`).bind(ownerId).all<{id:string}>();
  return result.results.map((row) => row.id);
}
async function mapFinding(db: Bindings["DB"], row: Record<string, unknown>): Promise<ReviewerFinding> {
  return { ...bools(row), evidence_ids: await links(db,"reviewer_finding_evidence","finding_id",String(row.id),"evidence_item_id"), timeline_ids: await links(db,"reviewer_finding_timeline","finding_id",String(row.id),"timeline_entry_id") } as unknown as ReviewerFinding;
}
async function mapAction(db: Bindings["DB"], row: Record<string, unknown>): Promise<ReviewerAction> {
  return { ...bools(row), evidence_ids: await links(db,"reviewer_action_evidence","action_id",String(row.id),"evidence_item_id") } as unknown as ReviewerAction;
}

interface PersistedActionKit {
  evidenceIds: string[];
  row: Record<string, unknown>;
  timelineIds: string[];
}

async function readPersistedActionKit(
  db: Bindings["DB"],
  caseId: string,
): Promise<PersistedActionKit | null> {
  const row = await db
    .prepare("SELECT * FROM reviewer_action_kits WHERE case_id=?")
    .bind(caseId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const [evidenceIds, timelineIds] = await Promise.all([
    links(db,"reviewer_action_kit_evidence","action_kit_id",String(row.id),"evidence_item_id"),
    links(db,"reviewer_action_kit_timeline","action_kit_id",String(row.id),"timeline_entry_id"),
  ]);

  return { evidenceIds, row, timelineIds };
}

function normalizedActionKitInput(input: ActionKitInput): Record<string, unknown> {
  return {
    current_position: input.current_position,
    confirmed_record: input.confirmed_record,
    unconfirmed_record: input.unconfirmed_record,
    primary_blocker: input.primary_blocker,
    why_appropriate: input.why_appropriate,
    evidence_readiness: input.evidence_readiness,
    review_readiness: input.review_readiness,
    email_subject: input.email_subject,
    recipient_role: input.recipient_role,
    message_body: input.message_body,
    call_checklist: input.call_checklist,
    requested_confirmations: input.requested_confirmations,
    documents_ready: input.documents_ready,
    escalation_trigger: input.escalation_trigger,
    follow_up_date: input.follow_up_date ?? null,
    internal_note: input.internal_note,
    approved: input.approved,
    evidence_ids: [...input.evidence_ids].sort(),
    timeline_ids: [...input.timeline_ids].sort(),
  };
}

function normalizedPersistedActionKit(value: PersistedActionKit): Record<string, unknown> {
  const { row } = value;
  return {
    current_position: String(row.current_position),
    confirmed_record: String(row.confirmed_record),
    unconfirmed_record: String(row.unconfirmed_record),
    primary_blocker: String(row.primary_blocker),
    why_appropriate: String(row.why_appropriate),
    evidence_readiness: String(row.evidence_readiness),
    review_readiness: String(row.review_readiness),
    email_subject: String(row.email_subject),
    recipient_role: String(row.recipient_role),
    message_body: String(row.message_body),
    call_checklist: JSON.parse(String(row.call_checklist_json)) as unknown,
    requested_confirmations: JSON.parse(String(row.requested_confirmations_json)) as unknown,
    documents_ready: JSON.parse(String(row.documents_ready_json)) as unknown,
    escalation_trigger: String(row.escalation_trigger),
    follow_up_date: row.follow_up_date === null ? null : String(row.follow_up_date),
    internal_note: String(row.internal_note),
    approved: Boolean(row.approved),
    evidence_ids: [...value.evidenceIds].sort(),
    timeline_ids: [...value.timelineIds].sort(),
  };
}

function actionKitMatchesInput(
  persisted: PersistedActionKit,
  input: ActionKitInput,
): boolean {
  return JSON.stringify(normalizedPersistedActionKit(persisted)) ===
    JSON.stringify(normalizedActionKitInput(input));
}

export async function readReviewerWorkspace(db: Bindings["DB"], caseId: string): Promise<ReviewerWorkspace> {
  const [f,q,a,n,k,r] = await Promise.all([
    db.prepare("SELECT * FROM reviewer_findings WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_questions WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_actions WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_notes WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_action_kits WHERE case_id = ?").bind(caseId).first<Record<string,unknown>>(),
    db.prepare(`SELECT r.*,u.name actor_name FROM reviewer_revisions r JOIN "user" u ON u.id=r.actor_user_id WHERE r.case_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(caseId).all<Record<string,unknown>>(),
  ]);
  return {
    findings: await Promise.all(f.results.map((row) => mapFinding(db,row))),
    questions: q.results.map((row) => bools(row) as unknown as ReviewerQuestion),
    actions: await Promise.all(a.results.map((row) => mapAction(db,row))),
    notes: n.results.map((row) => bools(row) as unknown as ReviewerNote),
    action_kit: k ? {
      ...bools(k),
      call_checklist:JSON.parse(String(k.call_checklist_json)), requested_confirmations:JSON.parse(String(k.requested_confirmations_json)), documents_ready:JSON.parse(String(k.documents_ready_json)),
      evidence_ids:await links(db,"reviewer_action_kit_evidence","action_kit_id",String(k.id),"evidence_item_id"), timeline_ids:await links(db,"reviewer_action_kit_timeline","action_kit_id",String(k.id),"timeline_entry_id"),
    } as unknown as ReviewerActionKit : null,
    revisions: r.results.map((row) => ({ id:String(row.id), case_id:String(row.case_id), actor:{id:String(row.actor_user_id),name:row.actor_name as string|null}, object_type:row.object_type as Kind, object_id:String(row.object_id), previous_value:JSON.parse(String(row.previous_value_json)), new_value:JSON.parse(String(row.new_value_json)), timestamp:String(row.created_at) })) as ReviewerRevision[],
  };
}

export async function saveReviewerActionKit(db:Bindings["DB"],caseId:string,actorId:string,input:ActionKitInput):Promise<ReviewerMutation>{
  const persisted=await readPersistedActionKit(db,caseId);
  if (persisted && input.version === undefined) {
    return actionKitMatchesInput(persisted,input)
      ? {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)}
      : {outcome:"conflict"};
  }
  const previous=persisted?.row ?? null;
  if (previous && previous.version !== input.version) return {outcome:"conflict"};
  if (!(await validateReferences(db,caseId,input))) return {outcome:"invalid_reference"};
  const id=previous ? String(previous.id) : crypto.randomUUID(); const now=new Date().toISOString();
  const marker=previous ? reviewerMutationMarker() : null;
  const values=[input.current_position,input.confirmed_record,input.unconfirmed_record,input.primary_blocker,input.why_appropriate,input.evidence_readiness,input.review_readiness,input.email_subject,input.recipient_role,input.message_body,JSON.stringify(input.call_checklist),JSON.stringify(input.requested_confirmations),JSON.stringify(input.documents_ready),input.escalation_trigger,input.follow_up_date??null,input.internal_note,Number(input.approved)];
  const fields=["current_position","confirmed_record","unconfirmed_record","primary_blocker","why_appropriate","evidence_readiness","review_readiness","email_subject","recipient_role","message_body","call_checklist_json","requested_confirmations_json","documents_ready_json","escalation_trigger","follow_up_date","internal_note","approved"];
  const writes=previous
    ? [db.prepare(`UPDATE reviewer_action_kits SET ${fields.map(f=>`${f}=?`).join(",")},version=version+1,updated_at=? WHERE id=? AND case_id=? AND version=?`).bind(...values,marker,id,caseId,input.version)]
    : [db.prepare(`INSERT INTO reviewer_action_kits(id,case_id,${fields.join(",")},created_at,updated_at) VALUES(?,?,${fields.map(()=>"?").join(",")},?,?)`).bind(id,caseId,...values,now,now)];
  if(previous){
    const guard=mutationGuard("reviewer_action_kits");
    writes.push(
      db.prepare(`DELETE FROM reviewer_action_kit_evidence WHERE action_kit_id=? AND ${guard}`).bind(id,id,caseId,marker),
      db.prepare(`DELETE FROM reviewer_action_kit_timeline WHERE action_kit_id=? AND ${guard}`).bind(id,id,caseId,marker),
    );
    for(const evidenceId of input.evidence_ids) writes.push(db.prepare(`INSERT INTO reviewer_action_kit_evidence(action_kit_id,evidence_item_id) SELECT ?,? WHERE ${guard}`).bind(id,evidenceId,id,caseId,marker));
    for(const timelineId of input.timeline_ids) writes.push(db.prepare(`INSERT INTO reviewer_action_kit_timeline(action_kit_id,timeline_entry_id) SELECT ?,? WHERE ${guard}`).bind(id,timelineId,id,caseId,marker));
    writes.push(
      db.prepare(`INSERT INTO reviewer_revisions(id,case_id,actor_user_id,object_type,object_id,previous_value_json,new_value_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),caseId,actorId,"action_kit",id,JSON.stringify(previous),JSON.stringify(input),now,id,caseId,marker),
      db.prepare("UPDATE reviewer_action_kits SET updated_at=? WHERE id=? AND case_id=? AND updated_at=?").bind(now,id,caseId,marker),
    );
  }else{
    for(const evidenceId of input.evidence_ids) writes.push(db.prepare("INSERT INTO reviewer_action_kit_evidence(action_kit_id,evidence_item_id) VALUES(?,?)").bind(id,evidenceId));
    for(const timelineId of input.timeline_ids) writes.push(db.prepare("INSERT INTO reviewer_action_kit_timeline(action_kit_id,timeline_entry_id) VALUES(?,?)").bind(id,timelineId));
    writes.push(db.prepare("INSERT INTO reviewer_revisions(id,case_id,actor_user_id,object_type,object_id,previous_value_json,new_value_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),caseId,actorId,"action_kit",id,JSON.stringify(previous),JSON.stringify(input),now));
  }
  let result;
  try {
    result=await db.batch(writes);
  } catch (error) {
    if (!previous && input.version === undefined) {
      const concurrent=await readPersistedActionKit(db,caseId);
      if (concurrent) {
        return actionKitMatchesInput(concurrent,input)
          ? {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)}
          : {outcome:"conflict"};
      }
    }
    throw error;
  }
  if(previous&&!result[0].meta.changes)return {outcome:"conflict"};
  if(previous&&result[result.length-1].meta.changes!==1)throw new Error("Reviewer Action Kit mutation marker was not finalized.");
  return {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)};
}

async function validateReferences(db: Bindings["DB"], caseId: string, input: Input): Promise<boolean> {
  const checks: Promise<boolean>[] = [];
  const data = input as Input & {evidence_ids?:string[];timeline_ids?:string[]};
  for (const evidenceId of data.evidence_ids ?? []) checks.push(db.prepare("SELECT 1 ok FROM evidence_items WHERE id=? AND case_id=? AND deleted_at IS NULL").bind(evidenceId,caseId).first().then(Boolean));
  for (const timelineId of data.timeline_ids ?? []) checks.push(db.prepare("SELECT 1 ok FROM timeline_entries WHERE id=? AND case_id=? AND deleted_at IS NULL").bind(timelineId,caseId).first().then(Boolean));
  return (await Promise.all(checks)).every(Boolean);
}

export type ReviewerMutation = {outcome:"success";workspace:ReviewerWorkspace}|{outcome:"conflict"|"invalid_reference"|"not_found"};
export async function saveReviewerObject(db: Bindings["DB"], caseId: string, actorId: string, kind: EditableKind, input: Exclude<Input,ActionKitInput>, objectId?: string): Promise<ReviewerMutation> {
  const id = objectId ?? await reviewerCreateId(caseId,kind,input); const now = new Date().toISOString(); const c = config[kind];
  if (!objectId) {
    const replay = await db.prepare(`SELECT 1 ok FROM ${c.table} WHERE id=? AND case_id=?`).bind(id,caseId).first();
    if (replay) return {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)};
  }
  if (!(await validateReferences(db,caseId,input))) return {outcome:"invalid_reference"};
  const previous = objectId ? await db.prepare(`SELECT * FROM ${c.table} WHERE id=? AND case_id=?`).bind(id,caseId).first<Record<string,unknown>>() : null;
  if (objectId && !previous) return {outcome:"not_found"};
  if (objectId && previous?.version !== input.version) return {outcome:"conflict"};
  const marker = objectId ? reviewerMutationMarker() : null;
  const values = c.fields.map((field) => { const value=(input as unknown as Record<string,unknown>)[field]; return typeof value === "boolean" ? Number(value) : value ?? null; });
  const statement = objectId
    ? db.prepare(`UPDATE ${c.table} SET ${c.fields.map((f)=>`${f}=?`).join(",")},version=version+1,updated_at=? WHERE id=? AND case_id=? AND version=?`).bind(...values,marker,id,caseId,input.version)
    : db.prepare(`INSERT INTO ${c.table}(id,case_id,${c.fields.join(",")},created_at,updated_at) VALUES(?,?,${c.fields.map(()=>"?").join(",")},?,?)`).bind(id,caseId,...values,now,now);
  const writes = [statement];
  const guard = objectId ? mutationGuard(c.table) : null;
  if (kind === "finding" || kind === "action") {
    const owner = kind === "finding" ? "finding_id" : "action_id"; const table = kind === "finding" ? "reviewer_finding_evidence" : "reviewer_action_evidence";
    if (objectId) writes.push(db.prepare(`DELETE FROM ${table} WHERE ${owner}=? AND ${guard}`).bind(id,id,caseId,marker));
    for (const evidenceId of (input as FindingInput|ActionInput).evidence_ids) writes.push(objectId
      ? db.prepare(`INSERT INTO ${table}(${owner},evidence_item_id) SELECT ?,? WHERE ${guard}`).bind(id,evidenceId,id,caseId,marker)
      : db.prepare(`INSERT INTO ${table}(${owner},evidence_item_id) VALUES(?,?)`).bind(id,evidenceId));
  }
  if (kind === "finding") {
    if (objectId) writes.push(db.prepare(`DELETE FROM reviewer_finding_timeline WHERE finding_id=? AND ${guard}`).bind(id,id,caseId,marker));
    for (const timelineId of (input as FindingInput).timeline_ids) writes.push(objectId
      ? db.prepare(`INSERT INTO reviewer_finding_timeline(finding_id,timeline_entry_id) SELECT ?,? WHERE ${guard}`).bind(id,timelineId,id,caseId,marker)
      : db.prepare("INSERT INTO reviewer_finding_timeline(finding_id,timeline_entry_id) VALUES(?,?)").bind(id,timelineId));
  }
  const previousValue = previous && kind === "finding" ? await mapFinding(db,previous) : previous && kind === "action" ? await mapAction(db,previous) : previous ? bools(previous) : null;
  writes.push(objectId
    ? db.prepare(`INSERT INTO reviewer_revisions(id,case_id,actor_user_id,object_type,object_id,previous_value_json,new_value_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),caseId,actorId,kind,id,JSON.stringify(previousValue),JSON.stringify(input),now,id,caseId,marker)
    : db.prepare("INSERT INTO reviewer_revisions(id,case_id,actor_user_id,object_type,object_id,previous_value_json,new_value_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),caseId,actorId,kind,id,JSON.stringify(previousValue),JSON.stringify(input),now));
  if (objectId) writes.push(db.prepare(`UPDATE ${c.table} SET updated_at=? WHERE id=? AND case_id=? AND updated_at=?`).bind(now,id,caseId,marker));
  let results;
  try {
    results = await db.batch(writes);
  } catch (error) {
    if (!objectId) {
      const replay = await db.prepare(`SELECT 1 ok FROM ${c.table} WHERE id=? AND case_id=?`).bind(id,caseId).first();
      if (replay) return {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)};
    }
    throw error;
  }
  if (objectId && !results[0].meta.changes) return {outcome:"conflict"};
  if (objectId && results[results.length-1].meta.changes !== 1) throw new Error("Reviewer mutation marker was not finalized.");
  return {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)};
}
