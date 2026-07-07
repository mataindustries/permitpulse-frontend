export const caseStatuses = [
  "intake",
  "researching",
  "needs_information",
  "ready_for_review",
] as const;

export type CaseStatus = (typeof caseStatuses)[number];

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

export const caseStatusLabels: Record<CaseStatus, string> = {
  intake: "Intake",
  researching: "Researching",
  needs_information: "Needs information",
  ready_for_review: "Ready for review",
};
