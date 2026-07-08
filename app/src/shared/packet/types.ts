export const packetDraftNotice =
  "Draft packet preview — verify before sending";

export const packetPlaceholderNote = "This placeholder is not AI-generated yet.";

export const packetDisclaimer =
  "Internal review draft only. Verify all source records, statuses, dates, and jurisdiction requirements before sending or relying on this packet.";

export const packetTitle = "PermitPulse packet preview";

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

export interface BuildPacketModelInput {
  activityResponse: PacketActivityResponseDto | null;
  caseRecord: PacketCaseDto;
  evidence: readonly PacketEvidenceDto[];
  generatedAt: Date | string;
  timeline: readonly PacketTimelineDto[];
}

export interface PacketCaseSummary {
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface PacketStatusSummary {
  value: PacketCaseStatus;
  label: string;
}

export interface PacketSourceSummary {
  label: string | null;
  url: string | null;
  date: string | null;
}

export interface PacketEvidenceSummary {
  evidence_type: PacketEvidenceType;
  evidence_type_label: string;
  title: string;
  summary: string;
  source: PacketSourceSummary;
  verification_status: PacketVerificationStatus;
  verification_label: string;
  verification_note: string;
  created_at: string;
  updated_at: string;
}

export interface PacketLinkedEvidenceSummary {
  title: string;
  verification_label: string;
}

export interface PacketTimelineSummary {
  occurred_on: string;
  timeline_type: PacketTimelineType;
  timeline_type_label: string;
  title: string;
  details: string;
  source_label: "Canonical" | "Contributed";
  linked_evidence: PacketLinkedEvidenceSummary[];
  missing_evidence_reference_count: number;
  created_at: string;
  updated_at: string;
}

export interface PacketActivitySummary {
  action: PacketActivityAction;
  action_label: string;
  actor_label: string;
  changed_field_labels: string[];
  created_at: string;
  from_status_label: string | null;
  to_status_label: string | null;
}

export interface PacketPlaceholderSection {
  note: string;
  instruction: string;
}

export interface PacketModel {
  title: string;
  generated_at: string;
  draft_notice: string;
  case_summary: PacketCaseSummary;
  current_status: PacketStatusSummary;
  jurisdiction: string;
  permit_number: string | null;
  evidence_summaries: PacketEvidenceSummary[];
  timeline_summaries: PacketTimelineSummary[];
  recent_activity_summaries: PacketActivitySummary[];
  open_questions: PacketPlaceholderSection;
  recommended_next_actions: PacketPlaceholderSection;
  disclaimer: string;
}

