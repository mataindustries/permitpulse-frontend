import { evaluateMissionIntelligence } from "../../shared/mission-intelligence/evaluate";
import type { MissionFacts } from "../../shared/mission-intelligence/facts";
import type { MissionControlItem } from "../../shared/mission-control/types";
import type { CaseRecord } from "../db/schema";
import type { Bindings } from "../types";
import { caseListScope, type CaseActor } from "../cases/authorization";
import type { CaseListPagination } from "../cases/repository";

interface MissionControlRow {
  id: string;
  project_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseRecord["currentStatus"];
  updated_at: string;
  evidence_total: number;
  evidence_verified: number;
  evidence_unverified: number;
  evidence_disputed: number;
  evidence_source_complete: number;
  evidence_delivery_ready: number;
  timeline_total: number;
  timeline_linked: number;
  latest_timeline_on: string | null;
  canonical_approval_ready: number;
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function factsFromRow(row: MissionControlRow, evaluatedAt: string): MissionFacts {
  return {
    case: {
      id: row.id,
      permitNumber: row.permit_number,
      currentStatus: row.current_status,
      updatedAt: row.updated_at,
    },
    evidence: {
      total: count(row.evidence_total),
      verified: count(row.evidence_verified),
      unverified: count(row.evidence_unverified),
      disputed: count(row.evidence_disputed),
      sourceComplete: count(row.evidence_source_complete),
      deliveryReady: count(row.evidence_delivery_ready),
      records: [],
    },
    timeline: {
      total: count(row.timeline_total),
      linked: count(row.timeline_linked),
      canonicalApprovalLinkedToVerifiedEvidence: row.canonical_approval_ready > 0,
      records: [],
    },
    evaluatedAt,
  };
}

function toMissionControlItem(
  row: MissionControlRow,
  evaluatedAt: string,
): MissionControlItem {
  const facts = factsFromRow(row, evaluatedAt);

  return {
    id: row.id,
    project_name: row.project_name,
    address: row.address,
    city: row.city,
    jurisdiction: row.jurisdiction,
    permit_number: row.permit_number,
    current_status: row.current_status,
    updated_at: row.updated_at,
    evidence: {
      total: facts.evidence.total,
      ready: facts.evidence.deliveryReady,
      verified: facts.evidence.verified,
      completeness:
        facts.evidence.total === 0
          ? 0
          : Math.round((facts.evidence.deliveryReady / facts.evidence.total) * 100),
    },
    timeline: {
      total: facts.timeline.total,
      linked: facts.timeline.linked,
      latest_occurred_on: row.latest_timeline_on,
    },
    intelligence: evaluateMissionIntelligence(facts),
  };
}

export async function listMissionControlForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  pagination: CaseListPagination,
  evaluatedAt: string,
): Promise<MissionControlItem[]> {
  const scope = caseListScope(actor);
  const participantFilter =
    scope === "all"
      ? ""
      : `WHERE EXISTS (
          SELECT 1
          FROM case_participants
          WHERE case_participants.case_id = cases.id
            AND case_participants.user_id = ?
        )`;
  const bindings = scope === "all" ? [] : [actor.id];
  const result = await database
    .prepare(
      `WITH visible_cases AS (
        SELECT cases.*
        FROM cases
        ${participantFilter}
      ),
      evidence_stats AS (
        SELECT
          evidence_items.case_id,
          COUNT(*) AS evidence_total,
          SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS evidence_verified,
          SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) AS evidence_unverified,
          SUM(CASE WHEN verification_status = 'disputed' THEN 1 ELSE 0 END) AS evidence_disputed,
          SUM(CASE
            WHEN source_url IS NOT NULL
              AND length(trim(source_url)) > 0
              AND source_label IS NOT NULL
              AND length(trim(source_label)) > 0
              AND source_date IS NOT NULL
              AND length(trim(source_date)) > 0
            THEN 1 ELSE 0 END
          ) AS evidence_source_complete,
          SUM(CASE
            WHEN verification_status = 'verified'
              AND source_url IS NOT NULL
              AND length(trim(source_url)) > 0
              AND source_label IS NOT NULL
              AND length(trim(source_label)) > 0
              AND source_date IS NOT NULL
              AND length(trim(source_date)) > 0
            THEN 1 ELSE 0 END
          ) AS evidence_delivery_ready
        FROM evidence_items
        INNER JOIN visible_cases ON visible_cases.id = evidence_items.case_id
        WHERE evidence_items.deleted_at IS NULL
        GROUP BY evidence_items.case_id
      ),
      timeline_stats AS (
        SELECT
          timeline_entries.case_id,
          COUNT(*) AS timeline_total,
          SUM(CASE WHEN EXISTS (
            SELECT 1
            FROM timeline_entry_evidence
            INNER JOIN evidence_items
              ON evidence_items.id = timeline_entry_evidence.evidence_item_id
            WHERE timeline_entry_evidence.timeline_entry_id = timeline_entries.id
              AND evidence_items.deleted_at IS NULL
          ) THEN 1 ELSE 0 END) AS timeline_linked,
          MAX(timeline_entries.occurred_on) AS latest_timeline_on,
          SUM(CASE
            WHEN timeline_entries.timeline_type = 'approval'
              AND timeline_entries.is_canonical = 1
              AND EXISTS (
                SELECT 1
                FROM timeline_entry_evidence
                INNER JOIN evidence_items
                  ON evidence_items.id = timeline_entry_evidence.evidence_item_id
                WHERE timeline_entry_evidence.timeline_entry_id = timeline_entries.id
                  AND evidence_items.deleted_at IS NULL
                  AND evidence_items.verification_status = 'verified'
                  AND evidence_items.source_url IS NOT NULL
                  AND length(trim(evidence_items.source_url)) > 0
                  AND evidence_items.source_label IS NOT NULL
                  AND length(trim(evidence_items.source_label)) > 0
                  AND evidence_items.source_date IS NOT NULL
                  AND length(trim(evidence_items.source_date)) > 0
              )
            THEN 1 ELSE 0 END
          ) AS canonical_approval_ready
        FROM timeline_entries
        INNER JOIN visible_cases ON visible_cases.id = timeline_entries.case_id
        WHERE timeline_entries.deleted_at IS NULL
        GROUP BY timeline_entries.case_id
      )
      SELECT
        visible_cases.id,
        visible_cases.project_name,
        visible_cases.address,
        visible_cases.city,
        visible_cases.jurisdiction,
        visible_cases.permit_number,
        visible_cases.current_status,
        visible_cases.updated_at,
        COALESCE(evidence_stats.evidence_total, 0) AS evidence_total,
        COALESCE(evidence_stats.evidence_verified, 0) AS evidence_verified,
        COALESCE(evidence_stats.evidence_unverified, 0) AS evidence_unverified,
        COALESCE(evidence_stats.evidence_disputed, 0) AS evidence_disputed,
        COALESCE(evidence_stats.evidence_source_complete, 0) AS evidence_source_complete,
        COALESCE(evidence_stats.evidence_delivery_ready, 0) AS evidence_delivery_ready,
        COALESCE(timeline_stats.timeline_total, 0) AS timeline_total,
        COALESCE(timeline_stats.timeline_linked, 0) AS timeline_linked,
        timeline_stats.latest_timeline_on,
        COALESCE(timeline_stats.canonical_approval_ready, 0) AS canonical_approval_ready
      FROM visible_cases
      LEFT JOIN evidence_stats ON evidence_stats.case_id = visible_cases.id
      LEFT JOIN timeline_stats ON timeline_stats.case_id = visible_cases.id`,
    )
    .bind(...bindings)
    .all<MissionControlRow>();

  return result.results
    .map((row) => toMissionControlItem(row, evaluatedAt))
    .sort(
      (left, right) =>
        left.intelligence.recommendedAction.priority - right.intelligence.recommendedAction.priority ||
        left.updated_at.localeCompare(right.updated_at) ||
        right.id.localeCompare(left.id),
    )
    .slice(pagination.offset, pagination.offset + pagination.limit);
}
