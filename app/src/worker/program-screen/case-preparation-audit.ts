import type { Bindings } from "../types";

export const reviewInvalidationReasons = ["evidence_withdrawn", "geometry_error", "legal_identity_changed", "source_superseded", "other"] as const;
export type ReviewInvalidationReason = (typeof reviewInvalidationReasons)[number];
export type ReviewEventOutcome = "committed" | "conflict" | "failed";

/**
 * One reviewed-lot publication or invalidation, recorded before its R2 effect. The row carries no
 * parcel, legal-lot, reviewer-name, URL, coordinate or file content: only identifiers and digests.
 */
export interface ReviewEventIntent {
  id: string;
  case_id: string;
  actor_user_id: string;
  action: "publish" | "invalidate";
  review_id: string;
  prior_revision: string | null;
  new_manifest_sha256: string;
  reason: ReviewInvalidationReason | null;
  request_id: string;
}

/** Throws when the row cannot be written; the caller must then make no publication write. */
export async function insertReviewEventIntent(db: Bindings["DB"], intent: ReviewEventIntent): Promise<void> {
  await db.prepare(
    `INSERT INTO program_screen_review_events
       (id, case_id, actor_user_id, action, review_id, prior_revision, new_manifest_sha256, reason, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    intent.id, intent.case_id, intent.actor_user_id, intent.action, intent.review_id,
    intent.prior_revision, intent.new_manifest_sha256, intent.reason, intent.request_id,
  ).run();
}

/**
 * The single permitted transition, pending to one final outcome. The intent always precedes this
 * workflow's R2 effect, but a committed effect can be followed by a lost completion update. A row
 * left pending whose new_manifest_sha256 matches the current manifest is consistent with that
 * content having been published; it does not identify which of several attempts carrying identical
 * content committed it. Nothing here resolves a pending row automatically; an operator must.
 */
export async function completeReviewEvent(db: Bindings["DB"], id: string, outcome: ReviewEventOutcome, newRevision: string | null): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE program_screen_review_events
     SET
       outcome = ?,
       new_revision = ?,
       completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?
       AND outcome = 'pending'`,
  ).bind(outcome, newRevision, id).run();
  return result.meta.changes === 1;
}
