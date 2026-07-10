import type { CaseRecord } from "../db/schema";
import type { Bindings } from "../types";
import { caseListScope, type CaseActor } from "../cases/authorization";
import type { CaseListPagination } from "../cases/repository";
import type { MissionControlItem } from "../../shared/mission-control/types";

export type MissionControlResponse = MissionControlItem;

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
  evidence_ready: number;
  evidence_verified: number;
  evidence_unverified: number;
  evidence_disputed: number;
  evidence_incomplete: number;
  timeline_total: number;
  latest_timeline_on: string | null;
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function warningLabels(row: MissionControlRow): string[] {
  const labels: string[] = [];
  const evidenceTotal = count(row.evidence_total);
  const unverified = count(row.evidence_unverified);
  const disputed = count(row.evidence_disputed);
  const incomplete = count(row.evidence_incomplete);

  if (row.current_status === "needs_information") {
    labels.push("Case needs information");
  }

  if (!row.permit_number) {
    labels.push("Permit number missing");
  }

  if (evidenceTotal === 0) {
    labels.push("No evidence added");
  }

  if (unverified > 0) {
    labels.push(`${unverified} unverified evidence record${unverified === 1 ? "" : "s"}`);
  }

  if (disputed > 0) {
    labels.push(`${disputed} disputed evidence record${disputed === 1 ? "" : "s"}`);
  }

  if (incomplete > 0) {
    labels.push(`${incomplete} evidence record${incomplete === 1 ? "" : "s"} incomplete`);
  }

  if (count(row.timeline_total) === 0) {
    labels.push("Permit timeline empty");
  }

  return labels;
}

function nextAction(row: MissionControlRow): MissionControlResponse["next_action"] {
  if (row.current_status === "needs_information") {
    return { label: "Resolve missing information", section: "evidence" };
  }

  if (count(row.evidence_total) === 0) {
    return { label: "Add first evidence", section: "evidence" };
  }

  if (count(row.evidence_disputed) > 0) {
    return { label: "Review disputed evidence", section: "evidence" };
  }

  if (count(row.evidence_incomplete) > 0) {
    return { label: "Complete evidence sources", section: "evidence" };
  }

  if (count(row.timeline_total) === 0) {
    return { label: "Build permit timeline", section: "timeline" };
  }

  if (row.current_status === "ready_for_review") {
    return { label: "Run AI review", section: "ai-review" };
  }

  if (row.current_status === "researching") {
    return { label: "Continue case research", section: "overview" };
  }

  return { label: "Complete case intake", section: "overview" };
}

function toMissionControlResponse(row: MissionControlRow): MissionControlResponse {
  const evidenceTotal = count(row.evidence_total);
  const evidenceReady = count(row.evidence_ready);
  const labels = warningLabels(row);

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
      total: evidenceTotal,
      ready: evidenceReady,
      verified: count(row.evidence_verified),
      completeness:
        evidenceTotal === 0
          ? 0
          : Math.round((evidenceReady / evidenceTotal) * 100),
    },
    timeline: {
      total: count(row.timeline_total),
      latest_occurred_on: row.latest_timeline_on,
    },
    warnings: {
      count: labels.length,
      labels,
    },
    next_action: nextAction(row),
  };
}

export async function listMissionControlForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  pagination: CaseListPagination,
): Promise<MissionControlResponse[]> {
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
  const bindings =
    scope === "all"
      ? [pagination.limit, pagination.offset]
      : [actor.id, pagination.limit, pagination.offset];
  const result = await database
    .prepare(
      `WITH visible_cases AS (
        SELECT cases.*
        FROM cases
        ${participantFilter}
      ),
      page_cases AS (
        SELECT
          visible_cases.*,
          CASE visible_cases.current_status
            WHEN 'needs_information' THEN 0
            WHEN 'ready_for_review' THEN 1
            WHEN 'researching' THEN 2
            ELSE 3
          END AS attention_rank
        FROM visible_cases
        ORDER BY
          attention_rank,
          visible_cases.updated_at ASC,
          visible_cases.id DESC
        LIMIT ? OFFSET ?
      ),
      evidence_stats AS (
        SELECT
          evidence_items.case_id,
          COUNT(*) AS evidence_total,
          SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS evidence_verified,
          SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) AS evidence_unverified,
          SUM(CASE WHEN verification_status = 'disputed' THEN 1 ELSE 0 END) AS evidence_disputed,
          SUM(CASE
            WHEN verification_status = 'verified'
              AND source_url IS NOT NULL
              AND length(trim(source_url)) > 0
              AND source_label IS NOT NULL
              AND length(trim(source_label)) > 0
              AND source_date IS NOT NULL
              AND length(trim(source_date)) > 0
            THEN 1 ELSE 0 END
          ) AS evidence_ready,
          SUM(CASE
            WHEN verification_status != 'verified'
              OR source_url IS NULL
              OR length(trim(source_url)) = 0
              OR source_label IS NULL
              OR length(trim(source_label)) = 0
              OR source_date IS NULL
              OR length(trim(source_date)) = 0
            THEN 1 ELSE 0 END
          ) AS evidence_incomplete
        FROM evidence_items
        INNER JOIN page_cases ON page_cases.id = evidence_items.case_id
        WHERE evidence_items.deleted_at IS NULL
        GROUP BY evidence_items.case_id
      ),
      timeline_stats AS (
        SELECT
          timeline_entries.case_id,
          COUNT(*) AS timeline_total,
          MAX(occurred_on) AS latest_timeline_on
        FROM timeline_entries
        INNER JOIN page_cases ON page_cases.id = timeline_entries.case_id
        WHERE timeline_entries.deleted_at IS NULL
        GROUP BY timeline_entries.case_id
      )
      SELECT
        cases.id,
        cases.project_name,
        cases.address,
        cases.city,
        cases.jurisdiction,
        cases.permit_number,
        cases.current_status,
        cases.updated_at,
        COALESCE(evidence_stats.evidence_total, 0) AS evidence_total,
        COALESCE(evidence_stats.evidence_ready, 0) AS evidence_ready,
        COALESCE(evidence_stats.evidence_verified, 0) AS evidence_verified,
        COALESCE(evidence_stats.evidence_unverified, 0) AS evidence_unverified,
        COALESCE(evidence_stats.evidence_disputed, 0) AS evidence_disputed,
        COALESCE(evidence_stats.evidence_incomplete, 0) AS evidence_incomplete,
        COALESCE(timeline_stats.timeline_total, 0) AS timeline_total,
        timeline_stats.latest_timeline_on
      FROM page_cases AS cases
      LEFT JOIN evidence_stats ON evidence_stats.case_id = cases.id
      LEFT JOIN timeline_stats ON timeline_stats.case_id = cases.id
      ORDER BY
        cases.attention_rank,
        cases.updated_at ASC,
        cases.id DESC`,
    )
    .bind(...bindings)
    .all<MissionControlRow>();

  return result.results.map(toMissionControlResponse);
}
