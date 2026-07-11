export const packetPresentationVersion = 2 as const;

export const packetDraftNotice =
  "Prepared for client review. Confirm source records and jurisdiction requirements before delivery.";

export const packetDisclaimer =
  "This PermitPulse packet summarizes the records available at the time shown. It is not a permit, legal opinion, guarantee of approval, or substitute for confirmation with the applicable jurisdiction. Source records, dates, and requirements should be independently verified before reliance.";

export const packetTitle = "Permit Review Packet";

export const packetSectionOrder = [
  "executive_summary",
  "case_overview",
  "current_status",
  "evidence_register",
  "permit_timeline",
  "findings",
  "open_questions",
  "recommended_next_actions",
  "supporting_sources",
  "disclaimer",
] as const;

export type PacketSectionId = (typeof packetSectionOrder)[number];

export type PacketInformationClass =
  | "confirmed_fact"
  | "client_provided_information"
  | "unverified_evidence"
  | "disputed_information"
  | "missing_information"
  | "warning"
  | "reviewer_approved_finding"
  | "approved_next_action";

export type PacketDocumentStatus = "draft" | "approved" | "delivered";

export type PacketCaseStatus =
  | "intake"
  | "researching"
  | "needs_information"
  | "ready_for_review";

export type PacketEvidenceType =
  | "document"
  | "portal"
  | "email"
  | "phone_call"
  | "meeting"
  | "inspection"
  | "code_reference"
  | "photo"
  | "other";

export type PacketVerificationStatus =
  | "unverified"
  | "verified"
  | "disputed";

export type PacketTimelineType =
  | "submission"
  | "resubmission"
  | "correction"
  | "reviewer_contact"
  | "applicant_contact"
  | "inspection"
  | "approval"
  | "rejection"
  | "status_update"
  | "deadline"
  | "other";

export type PacketActivityAction =
  | "case_created"
  | "case_updated"
  | "case_status_changed";

export interface PacketCaseDto {
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: PacketCaseStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PacketEvidenceDto {
  id: string;
  evidence_type: PacketEvidenceType;
  title: string;
  summary: string;
  source_url: string | null;
  source_label: string | null;
  source_date: string | null;
  verification_status: PacketVerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface PacketTimelineDto {
  id: string;
  occurred_on: string;
  timeline_type: PacketTimelineType;
  title: string;
  details: string;
  is_canonical: boolean;
  evidence_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface PacketActivityActorDto {
  name: string | null;
}

export interface PacketActivityDto {
  id: string;
  action: PacketActivityAction;
  changed_fields: string[];
  from_status: PacketCaseStatus | null;
  to_status: PacketCaseStatus | null;
  actor: PacketActivityActorDto | null;
  created_at: string;
}

export interface PacketActivityResponseDto {
  activity: PacketActivityDto[];
}

export interface PacketFindingInput {
  id: string;
  text: string;
  supporting_source_ids: string[];
  grounded: boolean;
  reviewer_approved: boolean;
}

export interface PacketQuestionInput {
  id: string;
  text: string;
  reviewer_approved: boolean;
}

export interface PacketActionInput {
  id: string;
  text: string;
  supporting_source_ids: string[];
  reviewer_approved: boolean;
}

export interface PacketEditorialContentInput {
  findings?: readonly PacketFindingInput[];
  openQuestions?: readonly PacketQuestionInput[];
  recommendedNextActions?: readonly PacketActionInput[];
  unsupportedClaims?: readonly string[];
}

export interface BuildPacketModelInput {
  activityResponse: PacketActivityResponseDto | null;
  caseRecord: PacketCaseDto;
  documentStatus?: PacketDocumentStatus;
  editorialContent?: PacketEditorialContentInput;
  evidence: readonly PacketEvidenceDto[];
  generatedAt: Date | string;
  timeline: readonly PacketTimelineDto[];
}

export interface PacketDateValue {
  raw: string | null;
  label: string;
}

export interface PacketCaseSummary {
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  created_at: string;
  created_at_label: string;
  updated_at: string;
  updated_at_label: string;
  version: number;
  information_class: "client_provided_information";
}

export interface PacketStatusSummary {
  value: PacketCaseStatus;
  label: string;
  information_class: "client_provided_information";
}

export interface PacketSourceSummary {
  label: string | null;
  url: string | null;
  date: string | null;
  date_label: string;
  complete: boolean;
}

export interface PacketEvidenceSummary {
  id: string;
  evidence_type: PacketEvidenceType;
  evidence_type_label: string;
  title: string;
  summary: string;
  source: PacketSourceSummary;
  verification_status: PacketVerificationStatus;
  verification_label: string;
  verification_note: string;
  information_class:
    | "confirmed_fact"
    | "unverified_evidence"
    | "disputed_information";
  created_at: string;
  created_at_label: string;
  updated_at: string;
  updated_at_label: string;
}

export interface PacketLinkedEvidenceSummary {
  source_id: string;
  title: string;
  verification_label: string;
}

export interface PacketTimelineSummary {
  id: string;
  occurred_on: string;
  occurred_on_label: string;
  timeline_type: PacketTimelineType;
  timeline_type_label: string;
  title: string;
  details: string;
  source_label: "Canonical" | "Contributed";
  linked_evidence: PacketLinkedEvidenceSummary[];
  missing_evidence_reference_count: number;
  information_class: "confirmed_fact" | "unverified_evidence";
  created_at: string;
  created_at_label: string;
  updated_at: string;
  updated_at_label: string;
}

export interface PacketActivitySummary {
  id: string;
  action: PacketActivityAction;
  action_label: string;
  actor_label: string;
  changed_field_labels: string[];
  created_at: string;
  created_at_label: string;
  from_status_label: string | null;
  to_status_label: string | null;
  client_visible: false;
}

export interface PacketFact {
  id: string;
  label: string;
  value: string;
  information_class:
    | "client_provided_information"
    | "confirmed_fact"
    | "missing_information";
}

export interface PacketExecutiveSummary {
  text: string;
  information_class: "client_provided_information";
  supporting_source_ids: string[];
}

export interface PacketFinding extends PacketFindingInput {
  information_class: "reviewer_approved_finding" | "warning";
}

export interface PacketOpenQuestion extends PacketQuestionInput {
  information_class: "missing_information";
}

export interface PacketRecommendedAction extends PacketActionInput {
  information_class: "approved_next_action" | "warning";
}

export interface PacketEditorialSection<T> {
  items: T[];
  empty_message: string;
}

export interface PacketSupportingSource {
  id: string;
  title: string;
  label: string;
  url: string | null;
  date_label: string;
  verification_label: string;
  information_class:
    | "confirmed_fact"
    | "unverified_evidence"
    | "disputed_information";
}

export interface PacketMissingInformation {
  id: string;
  title: string;
  reason: string;
  information_class: "missing_information";
}

export interface PacketPresentationWarning {
  id: string;
  text: string;
  information_class: "warning";
}

export interface PacketPresentationModel {
  presentation_version: typeof packetPresentationVersion;
  section_order: PacketSectionId[];
  title: string;
  packet_version: number;
  generated_at: string;
  generated_at_label: string;
  document_status: PacketDocumentStatus;
  document_status_label: "DRAFT" | "APPROVED" | "DELIVERED";
  is_internal_draft: false;
  draft_notice: string;
  executive_summary: PacketExecutiveSummary;
  case_summary: PacketCaseSummary;
  case_overview: PacketFact[];
  current_status: PacketStatusSummary;
  jurisdiction: string;
  permit_number: string | null;
  evidence_summaries: PacketEvidenceSummary[];
  timeline_summaries: PacketTimelineSummary[];
  recent_activity_summaries: PacketActivitySummary[];
  findings: PacketEditorialSection<PacketFinding>;
  open_questions: PacketEditorialSection<PacketOpenQuestion>;
  recommended_next_actions: PacketEditorialSection<PacketRecommendedAction>;
  supporting_sources: PacketSupportingSource[];
  missing_information: PacketMissingInformation[];
  warnings: PacketPresentationWarning[];
  unsupported_claims: string[];
  disclaimer: string;
}

export type PacketModel = PacketPresentationModel;
