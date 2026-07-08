export const caseStatuses = [
  "intake",
  "researching",
  "needs_information",
  "ready_for_review",
] as const;

export type CaseStatus = (typeof caseStatuses)[number];

export type UserRole = "client" | "admin";

export interface CaseDto {
  id: string;
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseListPagination {
  limit: number;
  offset: number;
}

export interface CaseListResponse {
  cases: CaseDto[];
  pagination: CaseListPagination;
}

export interface CreateCaseInput {
  project_name: string;
  client_name: string;
  address: string;
  city: string;
  jurisdiction: string;
  permit_number: string | null;
  current_status: CaseStatus;
}

export interface UpdateCaseMetadataInput {
  expected_version: number;
  project_name?: string;
  client_name?: string;
  address?: string;
  city?: string;
  jurisdiction?: string;
  permit_number?: string | null;
}

export interface UpdateCaseStatusInput {
  expected_version: number;
  current_status: CaseStatus;
}

export type CaseActivityAction =
  | "case_created"
  | "case_updated"
  | "case_status_changed";

export interface ActivityActor {
  id: string;
  name: string | null;
}

export interface CaseActivityEntry {
  id: string;
  action: CaseActivityAction;
  changed_fields: string[];
  from_status: CaseStatus | null;
  to_status: CaseStatus | null;
  actor: ActivityActor | null;
  created_at: string;
}

export interface CaseActivityResponse {
  activity: CaseActivityEntry[];
  pagination: CaseListPagination;
  order: "created_at_desc";
}

export const caseStatusLabels: Record<CaseStatus, string> = {
  intake: "Intake",
  researching: "Researching",
  needs_information: "Needs information",
  ready_for_review: "Ready for review",
};
