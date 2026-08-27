export const integrityCategories = [
  "evidence_contradiction",
  "unsupported_finding",
  "timeline_gap_or_stale_status",
  "missing_record_or_confirmation",
  "unresolved_dependency",
  "next_best_action",
] as const;

export const integritySeverities = ["critical", "high", "medium", "low"] as const;
export const integrityPacketImpacts = [
  "blocks_release",
  "needs_resolution",
  "monitor",
  "none",
] as const;
export const integrityDecisions = ["pending", "accepted", "edited", "rejected"] as const;
export const integrityStageNames = [
  "evidence_auditor",
  "chronology_analyst",
  "skeptical_reviewer",
  "synthesis",
] as const;

export type IntegrityCategory = (typeof integrityCategories)[number];
export type IntegritySeverity = (typeof integritySeverities)[number];
export type IntegrityPacketImpact = (typeof integrityPacketImpacts)[number];
export type IntegrityDecision = (typeof integrityDecisions)[number];
export type IntegrityStageName = (typeof integrityStageNames)[number];
export type IntegrityStageStatus = "queued" | "running" | "completed" | "failed";
export type IntegrityRunStatus = "running" | "completed" | "failed";

export interface IntegrityDraftItem {
  category: IntegrityCategory;
  severity: IntegritySeverity;
  confidence: number;
  title: string;
  verified_fact: string;
  inference: string | null;
  unknown: string | null;
  rationale: string;
  evidence_ids: string[];
  proposed_corrective_action: string;
  packet_readiness_impact: IntegrityPacketImpact;
  source_analysts: Array<Exclude<IntegrityStageName, "synthesis">>;
}

export interface IntegrityAnalystOutput {
  analyst_summary: string;
  observations: IntegrityDraftItem[];
}

export interface IntegritySynthesisOutput {
  summary: string;
  items: IntegrityDraftItem[];
}

export interface IntegrityEvidenceCitation {
  id: string;
  title: string;
  verification_status: "unverified" | "verified" | "disputed";
}

export interface IntegrityReviewItem extends IntegrityDraftItem {
  id: string;
  decision_status: IntegrityDecision;
  reviewer_edited_text: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  packet_generation_id: string | null;
  version: number;
  evidence: IntegrityEvidenceCitation[];
  created_at: string;
  updated_at: string;
}

export interface IntegrityReviewStage {
  stage: IntegrityStageName;
  model_id: string;
  status: IntegrityStageStatus;
  response_id: string | null;
  failure_code: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface IntegrityReviewRun {
  id: string;
  case_id: string;
  status: IntegrityRunStatus;
  input_hash: string;
  case_version: number;
  prompt_version: string;
  schema_version: string;
  specialist_model: string;
  synthesizer_model: string;
  summary: string | null;
  failure_code: string | null;
  cached_from_run_id: string | null;
  cache_hit: boolean;
  created_at: string;
  completed_at: string | null;
  stages: IntegrityReviewStage[];
  items: IntegrityReviewItem[];
  counts: {
    total: number;
    pending: number;
    accepted: number;
    edited: number;
    rejected: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface IntegrityReviewConfig {
  enabled: boolean;
  demo_mode: boolean;
  live_available: boolean;
  human_review_required: true;
  specialist_model: string;
  synthesizer_model: string;
}

export interface IntegrityDecisionInput {
  decision: Exclude<IntegrityDecision, "pending">;
  expected_version: number;
  reviewer_edited_text?: string;
}

export interface IntegrityDemoResetResult {
  case_id: string;
  seed_outcome: "created" | "reconciled" | "already_current";
  archived_run_count: number;
}

export interface IntegrityCanonicalSnapshot {
  snapshot_version: "permitpulse-build-week-integrity-input-v1";
  case_record: Record<string, unknown>;
  evidence_register: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  reviewer_findings: Array<Record<string, unknown>>;
  reviewer_questions: Array<Record<string, unknown>>;
  reviewer_actions: Array<Record<string, unknown>>;
  reviewer_action_kit: Record<string, unknown> | null;
  agency_dependencies: Array<Record<string, unknown>>;
  packet_input_revision: Record<string, string>;
  active_packet_generation_id: string | null;
  presentation_version: number;
}
