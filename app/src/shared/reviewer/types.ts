export const findingSeverities = ["critical", "high", "medium", "low"] as const;
export const confidenceLevels = ["high", "medium", "low"] as const;
export const questionStatuses = ["open", "waiting", "answered", "closed"] as const;
export const actionPriorities = ["critical", "high", "medium", "low"] as const;

export type FindingSeverity = (typeof findingSeverities)[number];
export type ConfidenceLevel = (typeof confidenceLevels)[number];
export type QuestionStatus = (typeof questionStatuses)[number];
export type ActionPriority = (typeof actionPriorities)[number];

export interface ReviewerFinding {
  id: string; case_id: string; title: string; finding_type: "risk" | "strength"; severity: FindingSeverity;
  summary: string; evidence_ids: string[]; timeline_ids: string[];
  confidence: ConfidenceLevel; recommended_resolution: string;
  internal_notes: string; approved: boolean; version: number;
  created_at: string; updated_at: string;
}

export interface ReviewerQuestion {
  id: string; case_id: string; question: string; why_it_matters: string;
  evidence_requested: string; assigned_reviewer: string; status: QuestionStatus;
  publishable: boolean; version: number; created_at: string; updated_at: string;
}

export interface ReviewerAction {
  id: string; case_id: string; priority: ActionPriority; description: string;
  evidence_ids: string[]; estimated_impact: string; responsible_party: string;
  due_date: string | null; approved: boolean; version: number;
  created_at: string; updated_at: string;
}

export interface ReviewerNote {
  id: string; case_id: string; commentary: string; publishable: boolean;
  version: number; created_at: string; updated_at: string;
}

export interface ReviewerRevision {
  id: string; case_id: string; actor: { id: string; name: string | null };
  object_type: "finding" | "question" | "action" | "note";
  object_id: string; previous_value: unknown; new_value: unknown; timestamp: string;
}

export interface ReviewerWorkspace {
  findings: ReviewerFinding[]; questions: ReviewerQuestion[];
  actions: ReviewerAction[]; notes: ReviewerNote[]; revisions: ReviewerRevision[];
}
