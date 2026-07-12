import { buildMissionFacts, isCompleteEvidenceSource, type MissionFacts } from "../../shared/mission-intelligence/facts";
import { getCaseForActor } from "../cases/repository";
import type { CaseActor } from "../cases/authorization";
import type { Bindings } from "../types";

interface EvidenceFactRow {
  id: string;
  title: string;
  verification_status: MissionFacts["evidence"]["records"][number]["verificationStatus"];
  source_url: string | null;
  source_label: string | null;
  source_date: string | null;
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

  const [evidenceResult, timelineResult, deliveryRow] = await Promise.all([
    database
      .prepare(
        `SELECT
          id,
          title,
          verification_status,
          source_url,
          source_label,
          source_date
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
    database.prepare(
      `SELECT id, event_type, resulting_state, packet_generation_id
       FROM delivery_lifecycle_events WHERE case_id = ? ORDER BY sequence DESC LIMIT 1`,
    ).bind(caseRecord.id).first<{ id: string; event_type: string; resulting_state: NonNullable<MissionFacts["delivery"]>["state"]; packet_generation_id: string | null }>(),
  ]);

  const evidenceRecords = evidenceResult.results.map((row) => ({
    id: row.id,
    title: row.title,
    verificationStatus: row.verification_status,
    sourceComplete: isCompleteEvidenceSource({ label: row.source_label, url: row.source_url, date: row.source_date }),
  }));
  const timelineRecords = timelineResult.results.map((row) => ({
    id: row.id,
    title: row.title,
    timelineType: row.timeline_type,
    isCanonical: row.is_canonical === 1,
    linkedEvidenceIds: row.linked_evidence_ids?.split(",").filter(Boolean) ?? [],
  }));

  return buildMissionFacts({
    case: {
      id: caseRecord.id,
      permitNumber: caseRecord.permit_number,
      currentStatus: caseRecord.current_status,
      updatedAt: caseRecord.updated_at,
    },
    evidence: evidenceRecords,
    timeline: timelineRecords,
    delivery: {
      state: deliveryRow?.resulting_state ?? "draft",
      latestEventId: deliveryRow?.id ?? null,
      latestEventType: deliveryRow?.event_type ?? null,
      packetGenerationId: deliveryRow?.packet_generation_id ?? null,
    },
    evaluatedAt,
  });
}
