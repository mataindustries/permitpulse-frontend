import type {
  EvidenceClassification,
  EvidenceDraftDto,
  EvidenceDraftQueueState,
  EvidenceExtraction,
  EvidenceFileMetadata,
  EvidenceInboxResponse,
} from "../../shared/evidence-intake/types";
import type { EvidenceItemRecord } from "../db/schema";
import type { Bindings } from "../types";

interface EvidenceDraftRow {
  id: string;
  filename: string;
  storage_key: string;
  file_size: number;
  media_type: string;
  detected_type: string;
  category: EvidenceDraftDto["category"];
  classification_reasons: string;
  extraction_status: EvidenceDraftDto["extraction_status"];
  queue_state: EvidenceDraftQueueState;
  permit_number: string | null;
  jurisdiction: string | null;
  address: string | null;
  document_date: string | null;
  reviewer: string | null;
  discipline: string | null;
  evidence_confidence: number;
  detected_issues: string;
  reviewed_at: string | null;
  moved_to_evidence_id: string | null;
  created_at: string;
}

export interface EvidenceDraftStorageRecord {
  id: string;
  filename: string;
  storageKey: string;
  mediaType: string;
  category: EvidenceDraftDto["category"];
  detectedType: string;
  documentDate: string | null;
  detectedIssues: string[];
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function rowToDto(row: EvidenceDraftRow): EvidenceDraftDto {
  return {
    id: row.id,
    filename: row.filename,
    uploaded_at: row.created_at,
    file_size: row.file_size,
    media_type: row.media_type,
    detected_type: row.detected_type,
    category: row.category,
    classification_reasons: parseStringArray(row.classification_reasons),
    extraction_status: row.extraction_status,
    queue_state: row.queue_state,
    permit_number: row.permit_number,
    jurisdiction: row.jurisdiction,
    address: row.address,
    document_date: row.document_date,
    reviewer: row.reviewer,
    discipline: row.discipline,
    evidence_confidence: row.evidence_confidence,
    detected_issues: parseStringArray(row.detected_issues),
    reviewed_at: row.reviewed_at,
    moved_to_evidence_id: row.moved_to_evidence_id,
  };
}

const draftSelect = `id, filename, storage_key, file_size, media_type,
  detected_type, category, classification_reasons, extraction_status,
  queue_state, permit_number, jurisdiction, address, document_date, reviewer,
  discipline, evidence_confidence, detected_issues, reviewed_at,
  moved_to_evidence_id, created_at`;

export async function createEvidenceDraft(
  database: Bindings["DB"],
  input: {
    id: string;
    ownerUserId: string;
    storageKey: string;
    metadata: EvidenceFileMetadata;
    classification: EvidenceClassification;
    extraction: EvidenceExtraction;
  },
): Promise<EvidenceDraftDto> {
  const timestamp = new Date().toISOString();
  const queueState: EvidenceDraftQueueState =
    input.extraction.status === "placeholder_limited"
      ? "needs_attention"
      : "ready_for_review";

  await database
    .prepare(
      `INSERT INTO evidence_drafts (
        id, owner_user_id, filename, storage_key, file_size, media_type,
        detected_type, category, classification_reasons, extraction_status,
        queue_state, permit_number, jurisdiction, address, document_date,
        reviewer, discipline, evidence_confidence, detected_issues,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.ownerUserId,
      input.metadata.filename,
      input.storageKey,
      input.metadata.size,
      input.metadata.mediaType,
      input.classification.detectedType,
      input.classification.category,
      JSON.stringify(input.classification.reasons),
      input.extraction.status,
      queueState,
      input.extraction.permitNumber,
      input.extraction.jurisdiction,
      input.extraction.address,
      input.extraction.documentDate,
      input.extraction.reviewer,
      input.extraction.discipline,
      input.extraction.confidence,
      JSON.stringify(input.extraction.detectedIssues),
      timestamp,
      timestamp,
    )
    .run();

  const created = await database
    .prepare(`SELECT ${draftSelect} FROM evidence_drafts WHERE id = ?`)
    .bind(input.id)
    .first<EvidenceDraftRow>();

  if (!created) throw new Error("Evidence draft was not persisted.");
  return rowToDto(created);
}

export async function listEvidenceDrafts(
  database: Bindings["DB"],
  ownerUserId: string,
): Promise<EvidenceInboxResponse> {
  const result = await database
    .prepare(
      `SELECT ${draftSelect}
       FROM evidence_drafts
       WHERE owner_user_id = ? AND moved_to_evidence_id IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
    )
    .bind(ownerUserId)
    .all<EvidenceDraftRow>();
  const drafts = result.results.map(rowToDto);
  const counts: EvidenceInboxResponse["counts"] = {
    waiting: 0,
    processing: 0,
    ready_for_review: 0,
    needs_attention: 0,
  };
  for (const draft of drafts) counts[draft.queue_state] += 1;
  return { drafts, counts };
}

export async function getEvidenceDraftStorageRecord(
  database: Bindings["DB"],
  ownerUserId: string,
  draftId: string,
  requireUnmoved = false,
): Promise<EvidenceDraftStorageRecord | null> {
  const row = await database
    .prepare(
      `SELECT id, filename, storage_key, media_type, category, detected_type,
        document_date, detected_issues
       FROM evidence_drafts
       WHERE id = ? AND owner_user_id = ?${requireUnmoved ? " AND moved_to_evidence_id IS NULL" : ""}
       LIMIT 1`,
    )
    .bind(draftId, ownerUserId)
    .first<{
      id: string;
      filename: string;
      storage_key: string;
      media_type: string;
      category: EvidenceDraftDto["category"];
      detected_type: string;
      document_date: string | null;
      detected_issues: string;
    }>();
  return row
    ? {
        id: row.id,
        filename: row.filename,
        storageKey: row.storage_key,
        mediaType: row.media_type,
        category: row.category,
        detectedType: row.detected_type,
        documentDate: row.document_date,
        detectedIssues: parseStringArray(row.detected_issues),
      }
    : null;
}

export async function getOwnedDraftStorageRecords(
  database: Bindings["DB"],
  ownerUserId: string,
  draftIds: string[],
): Promise<EvidenceDraftStorageRecord[]> {
  const records = await Promise.all(
    draftIds.map((id) =>
      getEvidenceDraftStorageRecord(database, ownerUserId, id, true),
    ),
  );
  return records.filter(
    (record): record is EvidenceDraftStorageRecord => record !== null,
  );
}

export async function deleteEvidenceDrafts(
  database: Bindings["DB"],
  ownerUserId: string,
  draftIds: string[],
): Promise<void> {
  await database.batch(
    draftIds.map((id) =>
      database
        .prepare(
          "DELETE FROM evidence_drafts WHERE id = ? AND owner_user_id = ? AND moved_to_evidence_id IS NULL",
        )
        .bind(id, ownerUserId),
    ),
  );
}

export async function markEvidenceDraftsReviewed(
  database: Bindings["DB"],
  ownerUserId: string,
  draftIds: string[],
): Promise<void> {
  const timestamp = new Date().toISOString();
  await database.batch(
    draftIds.map((id) =>
      database
        .prepare(
          `UPDATE evidence_drafts
           SET reviewed_at = ?, queue_state = 'ready_for_review', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND moved_to_evidence_id IS NULL`,
        )
        .bind(timestamp, timestamp, id, ownerUserId),
    ),
  );
}

function evidenceTypeForCategory(
  category: EvidenceDraftDto["category"],
): EvidenceItemRecord["evidenceType"] {
  if (category === "email") return "email";
  if (category === "portal_screenshot") return "portal";
  return category === "other" ? "other" : "document";
}

export async function moveDraftsToEvidence(
  database: Bindings["DB"],
  input: {
    ownerUserId: string;
    caseId: string;
    drafts: EvidenceDraftStorageRecord[];
  },
): Promise<string[]> {
  const timestamp = new Date().toISOString();
  const evidenceIds = input.drafts.map(() => crypto.randomUUID());
  const statements = input.drafts.flatMap((draft, index) => {
    const evidenceId = evidenceIds[index];
    const summary = [
      `${draft.detectedType} imported through Evidence Inbox.`,
      `Deterministic category: ${draft.category.replaceAll("_", " ")}.`,
      ...draft.detectedIssues.slice(0, 3),
    ].join(" ").slice(0, 2000);

    return [
      database
        .prepare(
          `INSERT INTO evidence_items (
            id, case_id, created_by_user_id, evidence_type, title, summary,
            source_url, source_label, source_date, verification_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', ?, ?)`,
        )
        .bind(
          evidenceId,
          input.caseId,
          input.ownerUserId,
          evidenceTypeForCategory(draft.category),
          draft.filename.slice(0, 160),
          summary,
          `/api/v1/evidence-inbox/${draft.id}/file`,
          `Evidence Inbox · ${draft.filename}`.slice(0, 160),
          draft.documentDate,
          timestamp,
          timestamp,
        ),
      database
        .prepare(
          `UPDATE evidence_drafts
           SET moved_to_evidence_id = ?, reviewed_at = COALESCE(reviewed_at, ?),
             queue_state = 'ready_for_review', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND moved_to_evidence_id IS NULL`,
        )
        .bind(evidenceId, timestamp, timestamp, draft.id, input.ownerUserId),
    ];
  });
  await database.batch(statements);
  return evidenceIds;
}
