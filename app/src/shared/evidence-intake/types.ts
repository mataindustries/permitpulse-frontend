export const evidenceDraftCategories = [
  "portal_screenshot",
  "correction_notice",
  "resubmittal_receipt",
  "structural_response",
  "energy_documents",
  "email",
  "permit_application",
  "plan_sheets",
  "other",
] as const;

export type EvidenceDraftCategory = (typeof evidenceDraftCategories)[number];

export const evidenceDraftQueueStates = [
  "waiting",
  "processing",
  "ready_for_review",
  "needs_attention",
] as const;

export type EvidenceDraftQueueState =
  (typeof evidenceDraftQueueStates)[number];

export const evidenceDraftExtractionStatuses = [
  "pending",
  "placeholder_complete",
  "placeholder_limited",
] as const;

export type EvidenceDraftExtractionStatus =
  (typeof evidenceDraftExtractionStatuses)[number];

export interface EvidenceFileMetadata {
  filename: string;
  mediaType: string;
  size: number;
  lastModified: number | null;
}

export interface EvidenceClassification {
  category: EvidenceDraftCategory;
  detectedType: string;
  reasons: string[];
}

export interface EvidenceExtraction {
  permitNumber: string | null;
  jurisdiction: string | null;
  address: string | null;
  documentDate: string | null;
  reviewer: string | null;
  discipline: string | null;
  confidence: number;
  detectedIssues: string[];
  status: EvidenceDraftExtractionStatus;
}

export interface EvidenceClassifier {
  classify(metadata: EvidenceFileMetadata): EvidenceClassification;
}

export interface EvidenceExtractor {
  extract(
    metadata: EvidenceFileMetadata,
    classification: EvidenceClassification,
  ): EvidenceExtraction;
}

export interface EvidenceDraftDto {
  id: string;
  filename: string;
  uploaded_at: string;
  file_size: number;
  media_type: string;
  detected_type: string;
  category: EvidenceDraftCategory;
  classification_reasons: string[];
  extraction_status: EvidenceDraftExtractionStatus;
  queue_state: EvidenceDraftQueueState;
  permit_number: string | null;
  jurisdiction: string | null;
  address: string | null;
  document_date: string | null;
  reviewer: string | null;
  discipline: string | null;
  evidence_confidence: number;
  detected_issues: string[];
  reviewed_at: string | null;
  moved_to_evidence_id: string | null;
}

export interface EvidenceInboxResponse {
  drafts: EvidenceDraftDto[];
  counts: Record<EvidenceDraftQueueState, number>;
}

export type EvidenceDraftBulkAction =
  | "delete"
  | "mark_reviewed"
  | "move_to_evidence";

