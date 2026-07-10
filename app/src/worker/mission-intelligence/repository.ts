import type { MissionFacts } from "../../shared/mission-intelligence/facts";
import { getCaseForActor } from "../cases/repository";
import type { CaseActor } from "../cases/authorization";
import type { Bindings } from "../types";

interface EvidenceFactRow {
  id: string;
  title: string;
  verification_status: MissionFacts["evidence"]["records"][number]["verificationStatus"];
  source_complete: number;
}

interface TimelineFactRow {
  id: string;
  title: string;
  timeline_type: MissionFacts["timeline"]["records"][number]["timelineType"];
  is_canonical: number;
  linked_evidence_ids: string | null;
}

export async function getMissionFactsForActor(
  database: Bindings["DB"],
  actor: CaseActor,
  caseId: string,
  evaluatedAt: string,
): Promise<MissionFacts | null> {
  const caseRecord = await getCaseForActor(database, actor, caseId);

  if (!caseRecord) {
    return null;
  }

  const [evidenceResult, timelineResult] = await Promise.all([
    database
      .prepare(
        `SELECT
          id,
          title,
          verification_status,
          CASE
            WHEN source_url IS NOT NULL
              AND length(trim(source_url)) > 0
              AND source_label IS NOT NULL
              AND length(trim(source_label)) > 0
              AND source_date IS NOT NULL
              AND length(trim(source_date)) > 0
            THEN 1 ELSE 0
          END AS source_complete
        FROM evidence_items
        WHERE case_id = ? AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
      )
      .bind(caseRecord.id)
      .all<EvidenceFactRow>(),
    database
      .prepare(
        `SELECT
          timeline_entries.id,
          timeline_entries.title,
          timeline_entries.timeline_type,
          timeline_entries.is_canonical,
          GROUP_CONCAT(evidence_items.id) AS linked_evidence_ids
        FROM timeline_entries
        LEFT JOIN timeline_entry_evidence
          ON timeline_entry_evidence.timeline_entry_id = timeline_entries.id
        LEFT JOIN evidence_items
          ON evidence_items.id = timeline_entry_evidence.evidence_item_id
          AND evidence_items.deleted_at IS NULL
        WHERE timeline_entries.case_id = ?
          AND timeline_entries.deleted_at IS NULL
        GROUP BY timeline_entries.id
        ORDER BY timeline_entries.occurred_on ASC, timeline_entries.id ASC`,
      )
      .bind(caseRecord.id)
      .all<TimelineFactRow>(),
  ]);

  const evidenceRecords = evidenceResult.results.map((row) => ({
    id: row.id,
    title: row.title,
    verificationStatus: row.verification_status,
    sourceComplete: row.source_complete === 1,
  }));
  const verifiedIds = new Set(
    evidenceRecords
      .filter((record) => record.verificationStatus === "verified" && record.sourceComplete)
      .map((record) => record.id),
  );
  const timelineRecords = timelineResult.results.map((row) => ({
    id: row.id,
    title: row.title,
    timelineType: row.timeline_type,
    isCanonical: row.is_canonical === 1,
    linkedEvidenceIds: row.linked_evidence_ids?.split(",").filter(Boolean) ?? [],
  }));

  return {
    case: {
      id: caseRecord.id,
      permitNumber: caseRecord.permit_number,
      currentStatus: caseRecord.current_status,
      updatedAt: caseRecord.updated_at,
    },
    evidence: {
      total: evidenceRecords.length,
      verified: evidenceRecords.filter((record) => record.verificationStatus === "verified").length,
      unverified: evidenceRecords.filter((record) => record.verificationStatus === "unverified").length,
      disputed: evidenceRecords.filter((record) => record.verificationStatus === "disputed").length,
      sourceComplete: evidenceRecords.filter((record) => record.sourceComplete).length,
      deliveryReady: evidenceRecords.filter(
        (record) => record.verificationStatus === "verified" && record.sourceComplete,
      ).length,
      records: evidenceRecords,
    },
    timeline: {
      total: timelineRecords.length,
      linked: timelineRecords.filter((record) => record.linkedEvidenceIds.length > 0).length,
      canonicalApprovalLinkedToVerifiedEvidence: timelineRecords.some(
        (record) =>
          record.isCanonical &&
          record.timelineType === "approval" &&
          record.linkedEvidenceIds.some((id) => verifiedIds.has(id)),
      ),
      records: timelineRecords,
    },
    evaluatedAt,
  };
}
