import type { CaseListPagination } from "./cases";

export const evidenceTypes = [
  "document",
  "portal",
  "email",
  "phone_call",
  "meeting",
  "inspection",
  "code_reference",
  "photo",
  "other",
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];

export const verificationStatuses = [
  "unverified",
  "verified",
  "disputed",
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export const timelineTypes = [
  "submission",
  "resubmission",
  "correction",
  "reviewer_contact",
  "applicant_contact",
  "inspection",
  "approval",
  "rejection",
  "status_update",
  "deadline",
  "other",
] as const;

export type TimelineType = (typeof timelineTypes)[number];

export interface RecordContributor {
  id: string;
  name: string | null;
}

export interface EvidenceItemDto {
  id: string;
  evidence_type: EvidenceType;
  title: string;
  summary: string;
  source_url: string | null;
  source_label: string | null;
  source_date: string | null;
  verification_status: VerificationStatus;
  contributor: RecordContributor | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntryDto {
  id: string;
  occurred_on: string;
  timeline_type: TimelineType;
  title: string;
  details: string;
  is_canonical: boolean;
  contributor: RecordContributor | null;
  evidence_ids: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEvidenceInput {
  evidence_type: EvidenceType;
  title: string;
  summary: string;
  source_url?: string | null;
  source_label?: string | null;
  source_date?: string | null;
}

export interface UpdateEvidenceInput {
  expected_version: number;
  evidence_type?: EvidenceType;
  title?: string;
  summary?: string;
  source_url?: string | null;
  source_label?: string | null;
  source_date?: string | null;
  verification_status?: VerificationStatus;
}

export interface EvidenceListResponse {
  evidence: EvidenceItemDto[];
  pagination: CaseListPagination;
  order: "source_date_desc_created_at_desc_id_desc";
}

export interface CreateTimelineInput {
  occurred_on: string;
  timeline_type: TimelineType;
  title: string;
  details: string;
  is_canonical?: boolean;
  evidence_ids?: string[];
}

export interface UpdateTimelineInput {
  expected_version: number;
  occurred_on?: string;
  timeline_type?: TimelineType;
  title?: string;
  details?: string;
  is_canonical?: boolean;
}

export interface TimelineListResponse {
  timeline: TimelineEntryDto[];
  pagination: CaseListPagination;
  order: "occurred_on_desc_created_at_desc_id_desc";
}

export const evidenceTypeLabels: Record<EvidenceType, string> = {
  document: "Document",
  portal: "Portal",
  email: "Email",
  phone_call: "Phone call",
  meeting: "Meeting",
  inspection: "Inspection",
  code_reference: "Code reference",
  photo: "Photo",
  other: "Other",
};

export const verificationStatusLabels: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  verified: "Verified",
  disputed: "Disputed",
};

export const timelineTypeLabels: Record<TimelineType, string> = {
  submission: "Submission",
  resubmission: "Resubmission",
  correction: "Correction",
  reviewer_contact: "Reviewer contact",
  applicant_contact: "Applicant contact",
  inspection: "Inspection",
  approval: "Approval",
  rejection: "Rejection",
  status_update: "Status update",
  deadline: "Deadline",
  other: "Other",
};
