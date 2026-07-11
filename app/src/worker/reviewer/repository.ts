import type { ReviewerAction, ReviewerFinding, ReviewerNote, ReviewerQuestion, ReviewerRevision, ReviewerWorkspace } from "../../shared/reviewer/types";
import type { Bindings } from "../types";
import type { ActionInput, FindingInput, NoteInput, QuestionInput } from "./validation";

type Kind = "finding" | "question" | "action" | "note";
type Input = FindingInput | QuestionInput | ActionInput | NoteInput;
const config = {
  finding: { table: "reviewer_findings", fields: ["title","finding_type","severity","summary","confidence","recommended_resolution","internal_notes","approved"] },
  question: { table: "reviewer_questions", fields: ["question","why_it_matters","evidence_requested","assigned_reviewer","status","publishable"] },
  action: { table: "reviewer_actions", fields: ["priority","description","estimated_impact","responsible_party","due_date","approved"] },
  note: { table: "reviewer_notes", fields: ["commentary","publishable"] },
} as const;

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
export async function readReviewerWorkspace(db: Bindings["DB"], caseId: string): Promise<ReviewerWorkspace> {
  const [f,q,a,n,r] = await Promise.all([
    db.prepare("SELECT * FROM reviewer_findings WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_questions WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_actions WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare("SELECT * FROM reviewer_notes WHERE case_id = ? ORDER BY updated_at DESC,id DESC").bind(caseId).all<Record<string,unknown>>(),
    db.prepare(`SELECT r.*,u.name actor_name FROM reviewer_revisions r JOIN "user" u ON u.id=r.actor_user_id WHERE r.case_id=? ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(caseId).all<Record<string,unknown>>(),
  ]);
  return {
    findings: await Promise.all(f.results.map((row) => mapFinding(db,row))),
    questions: q.results.map((row) => bools(row) as unknown as ReviewerQuestion),
    actions: await Promise.all(a.results.map((row) => mapAction(db,row))),
    notes: n.results.map((row) => bools(row) as unknown as ReviewerNote),
    revisions: r.results.map((row) => ({ id:String(row.id), case_id:String(row.case_id), actor:{id:String(row.actor_user_id),name:row.actor_name as string|null}, object_type:row.object_type as Kind, object_id:String(row.object_id), previous_value:JSON.parse(String(row.previous_value_json)), new_value:JSON.parse(String(row.new_value_json)), timestamp:String(row.created_at) })) as ReviewerRevision[],
  };
}

async function validateReferences(db: Bindings["DB"], caseId: string, input: Input): Promise<boolean> {
  const checks: Promise<boolean>[] = [];
  const data = input as Input & {evidence_ids?:string[];timeline_ids?:string[]};
  for (const evidenceId of data.evidence_ids ?? []) checks.push(db.prepare("SELECT 1 ok FROM evidence_items WHERE id=? AND case_id=? AND deleted_at IS NULL").bind(evidenceId,caseId).first().then(Boolean));
  for (const timelineId of data.timeline_ids ?? []) checks.push(db.prepare("SELECT 1 ok FROM timeline_entries WHERE id=? AND case_id=? AND deleted_at IS NULL").bind(timelineId,caseId).first().then(Boolean));
  return (await Promise.all(checks)).every(Boolean);
}

export type ReviewerMutation = {outcome:"success";workspace:ReviewerWorkspace}|{outcome:"conflict"|"invalid_reference"|"not_found"};
export async function saveReviewerObject(db: Bindings["DB"], caseId: string, actorId: string, kind: Kind, input: Input, objectId?: string): Promise<ReviewerMutation> {
  if (!(await validateReferences(db,caseId,input))) return {outcome:"invalid_reference"};
  const id = objectId ?? crypto.randomUUID(); const now = new Date().toISOString(); const c = config[kind];
  const previous = objectId ? await db.prepare(`SELECT * FROM ${c.table} WHERE id=? AND case_id=?`).bind(id,caseId).first<Record<string,unknown>>() : null;
  if (objectId && !previous) return {outcome:"not_found"};
  if (objectId && previous?.version !== input.version) return {outcome:"conflict"};
  const values = c.fields.map((field) => { const value=(input as unknown as Record<string,unknown>)[field]; return typeof value === "boolean" ? Number(value) : value ?? null; });
  const statement = objectId
    ? db.prepare(`UPDATE ${c.table} SET ${c.fields.map((f)=>`${f}=?`).join(",")},version=version+1,updated_at=? WHERE id=? AND case_id=? AND version=?`).bind(...values,now,id,caseId,input.version)
    : db.prepare(`INSERT INTO ${c.table}(id,case_id,${c.fields.join(",")},created_at,updated_at) VALUES(?,?,${c.fields.map(()=>"?").join(",")},?,?)`).bind(id,caseId,...values,now,now);
  const writes = [statement];
  if (kind === "finding" || kind === "action") {
    const owner = kind === "finding" ? "finding_id" : "action_id"; const table = kind === "finding" ? "reviewer_finding_evidence" : "reviewer_action_evidence";
    if (objectId) writes.push(db.prepare(`DELETE FROM ${table} WHERE ${owner}=?`).bind(id));
    for (const evidenceId of (input as FindingInput|ActionInput).evidence_ids) writes.push(db.prepare(`INSERT INTO ${table}(${owner},evidence_item_id) VALUES(?,?)`).bind(id,evidenceId));
  }
  if (kind === "finding") {
    if (objectId) writes.push(db.prepare("DELETE FROM reviewer_finding_timeline WHERE finding_id=?").bind(id));
    for (const timelineId of (input as FindingInput).timeline_ids) writes.push(db.prepare("INSERT INTO reviewer_finding_timeline(finding_id,timeline_entry_id) VALUES(?,?)").bind(id,timelineId));
  }
  const previousValue = previous && kind === "finding" ? await mapFinding(db,previous) : previous && kind === "action" ? await mapAction(db,previous) : previous ? bools(previous) : null;
  writes.push(db.prepare("INSERT INTO reviewer_revisions(id,case_id,actor_user_id,object_type,object_id,previous_value_json,new_value_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),caseId,actorId,kind,id,JSON.stringify(previousValue),JSON.stringify(input),now));
  const results = await db.batch(writes); if (objectId && !results[0].meta.changes) return {outcome:"conflict"};
  return {outcome:"success",workspace:await readReviewerWorkspace(db,caseId)};
}
