import type { Bindings } from "../types";

export interface PacketInputRevision {
  case_revision: string;
  contributor_revision: string;
  evidence_revision: string;
  reviewer_revision: string;
  timeline_link_revision: string;
  timeline_revision: string;
}

export const packetInputRevisionFields = [
  "case_revision",
  "evidence_revision",
  "timeline_revision",
  "timeline_link_revision",
  "reviewer_revision",
  "contributor_revision",
] as const satisfies readonly (keyof PacketInputRevision)[];

/**
 * The packet inputs already carry monotonic row versions. This ordered token
 * projects those versions (plus relationship and contributor changes) without
 * adding a second persistence model or a schema-level revision counter.
 */
export const packetInputRevisionSelectSql = `SELECT
  COALESCE((SELECT CAST(version AS TEXT) FROM cases WHERE id = ?), 'missing') AS case_revision,
  COALESCE((
    SELECT group_concat(token, '|') FROM (
      SELECT id || ':' || version AS token
      FROM evidence_items
      WHERE case_id = ? AND deleted_at IS NULL
      ORDER BY id
    )
  ), '') AS evidence_revision,
  COALESCE((
    SELECT group_concat(token, '|') FROM (
      SELECT id || ':' || version AS token
      FROM timeline_entries
      WHERE case_id = ? AND deleted_at IS NULL
      ORDER BY id
    )
  ), '') AS timeline_revision,
  COALESCE((
    SELECT group_concat(token, '|') FROM (
      SELECT links.timeline_entry_id || ':' || links.evidence_item_id AS token
      FROM timeline_entry_evidence links
      INNER JOIN timeline_entries timeline
        ON timeline.id = links.timeline_entry_id
       AND timeline.deleted_at IS NULL
      INNER JOIN evidence_items evidence
        ON evidence.id = links.evidence_item_id
       AND evidence.deleted_at IS NULL
      WHERE timeline.case_id = ?
      ORDER BY links.timeline_entry_id, links.evidence_item_id
    )
  ), '') AS timeline_link_revision,
  COALESCE((
    SELECT group_concat(token, '|') FROM (
      SELECT 'finding:' || id || ':' || version AS token
      FROM reviewer_findings WHERE case_id = ?
      UNION ALL
      SELECT 'question:' || id || ':' || version AS token
      FROM reviewer_questions WHERE case_id = ?
      UNION ALL
      SELECT 'action:' || id || ':' || version AS token
      FROM reviewer_actions WHERE case_id = ?
      UNION ALL
      SELECT 'action-kit:' || id || ':' || version AS token
      FROM reviewer_action_kits WHERE case_id = ?
      ORDER BY token
    )
  ), '') AS reviewer_revision,
  COALESCE((
    SELECT group_concat(token, '|') FROM (
      SELECT users.id || ':' || users.updated_at AS token
      FROM "user" users
      WHERE users.id IN (
        SELECT created_by_user_id FROM evidence_items
        WHERE case_id = ? AND deleted_at IS NULL
        UNION
        SELECT created_by_user_id FROM timeline_entries
        WHERE case_id = ? AND deleted_at IS NULL
      )
      ORDER BY users.id
    )
  ), '') AS contributor_revision`;

export function packetInputRevisionCaseBindings(caseId: string): string[] {
  return Array.from({ length: 10 }, () => caseId);
}

export async function readPacketInputRevision(
  database: Bindings["DB"],
  caseId: string,
): Promise<PacketInputRevision> {
  const revision = await database
    .prepare(packetInputRevisionSelectSql)
    .bind(...packetInputRevisionCaseBindings(caseId))
    .first<PacketInputRevision>();

  if (!revision || revision.case_revision === "missing") {
    throw new Error("Packet input revision could not be read.");
  }

  return revision;
}

export function packetInputRevisionsEqual(
  left: PacketInputRevision,
  right: PacketInputRevision,
): boolean {
  return packetInputRevisionFields.every((field) => left[field] === right[field]);
}

export function packetInputRevisionValues(
  revision: PacketInputRevision,
): string[] {
  return packetInputRevisionFields.map((field) => revision[field]);
}
