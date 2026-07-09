import type { PacketModel } from "../packet/types";

export type PacketReviewCitationSource = "evidence" | "timeline" | "activity";

export interface PacketReviewCitation {
  source_type: PacketReviewCitationSource;
  record_id: string;
  note: string;
}

export interface PacketReviewDraft {
  summary: string;
  missing_information: string[];
  recommended_next_actions: string[];
  evidence_citations: PacketReviewCitation[];
  unsupported_claims: string[];
  confidence_notes: string[];
  model_metadata?: {
    reviewer: string;
    generated_at: string;
    local_only: true;
    version?: string;
  };
}

export interface PacketReviewFixture {
  id: string;
  name: string;
  coverage: string[];
  packet: PacketModel;
  expected_missing_information: string[];
  expected_citation_ids: string[];
  forbidden_claims: string[];
  minimum_score: number;
  minimum_acceptable_score_notes: string;
}

export interface PacketReviewEvaluation {
  fixture_id: string;
  total_score: number;
  groundedness_score: number;
  citation_validity_score: number;
  missing_information_score: number;
  unsupported_claim_penalty: number;
  schema_validity: boolean;
  safety_warnings: string[];
  passed: boolean;
  pass_threshold: number;
  notes: string[];
}

export interface PacketReviewDraftEvaluationReport {
  score: number;
  passed: boolean;
  warnings: string[];
  citation_validity: {
    score: number;
    passed: boolean;
    invalid_citations: string[];
  };
  safety: {
    passed: boolean;
    warnings: string[];
  };
}

export interface PacketReviewDraftResponseData {
  review: PacketReviewDraft;
  evaluation: PacketReviewDraftEvaluationReport;
  metadata: {
    reviewer: "deterministic-baseline";
    live_ai: false;
    external_calls: false;
  };
}

export interface PacketReviewRecordIds {
  evidence: Set<string>;
  timeline: Set<string>;
  activity: Set<string>;
  all: Set<string>;
}
