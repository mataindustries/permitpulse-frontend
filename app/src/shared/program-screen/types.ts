import type {
  EvidenceIntegrityClassification,
  EvidenceIntegrityReviewStatus,
  EvidenceIntegrityType,
  EvidenceNormalizedValue,
  EvidenceObservedValue,
  IntegrityEvidenceProvenanceCitation,
  IntegrityEvidenceSubject,
} from "../build-week-integrity/types";

/**
 * LA Parcel Program Screen core types.
 *
 * Facts are canonical evidence (`CanonicalEvidenceRecord`) grouped by claim
 * key and assessed by the canonical Case Integrity evaluator. This module adds
 * program criteria, pathway roll-ups, questions, and release gates on top of
 * that evidence model; it never replaces it.
 */

export const PROGRAM_SCREEN_SCOPE = "City of Los Angeles" as const;
export const PROGRAM_SCREEN_SCHEMA_VERSION = "program-screen-core-v1" as const;

export const programPathwayIds = ["la_shra", "la_sb79", "la_low_rise"] as const;

export const programFactKeys = [
  "parcel-match",
  "jurisdiction",
  "zoning",
  "general-plan-land-use",
  "specific-plan-area",
  "hpoz",
  "historic-designation",
  "zoning-code-chapter",
  "lot-area",
  "very-high-fire-hazard-severity-zone",
  "hillside-area",
  "coastal-zone",
  "fault-zone",
  "landslide-area",
  "flood-zone",
  "existing-dwelling-units",
  "existing-structures",
  "rso-status",
  "occupancy-history",
  "prior-subdivisions",
  "housing-element-site-status",
  "sb79-permanent-exclusion",
  "sb79-temporary-exemption",
  "zimas-shra-program-field",
  "zimas-sb79-category",
  "zimas-sb79-tier",
  "zimas-sb79-exemption",
  "zimas-low-rise-category",
] as const;

export const criterionStatuses = [
  "conflict",
  "unknown",
  "professional",
  "unreviewed",
  "consistent_with_source",
  "disqualifying_per_source",
] as const;

/** Ordered strongest first; see `rollUpProgramPathway`. */
export const pathwayRollups = [
  "documented_disqualifier",
  "contested",
  "undetermined",
  "no_disqualifier_found_in_reviewed_sources",
] as const;

/**
 * - `repo_sourced`: rule stated in this repository's reviewed source notes.
 * - `pending_human`: rule not verified; it never runs.
 * - `human_verified`: a named human reviewer checked the rule against captured
 *   official-source text and recorded a `ProgramCriterionHumanVerification`.
 */
export const criterionVerifications = ["repo_sourced", "pending_human", "human_verified"] as const;

/**
 * Criteria that were `pending_human` when the Program Screen core shipped.
 * Each may leave `pending_human` only as `human_verified`, with a complete
 * human-verification record; none may be relabeled `repo_sourced`.
 */
export const humanVerificationRequiredCriterionIds = [
  "la_shra.lot-area-and-zoning",
  "la_shra.existing-structures-and-occupancy",
  "la_shra.prior-subdivisions",
  "la_shra.housing-element-site-status",
  "la_shra.environmental-constraints",
  "la_sb79.permanent-exclusion",
  "la_sb79.temporary-exemption",
  "la_sb79.site-and-overlay-standards",
  "la_low_rise.geographic-criteria",
] as const;

export const sourceCaptureMethods = [
  "pdf_text_extraction",
  "html_text_extraction",
  "manual_transcription",
] as const;

/**
 * What a captured official document is. A `proposed_draft` is never law: it
 * can prompt a human re-review but can never support a criterion rule.
 */
export const officialSourceTypes = ["adopted_ordinance", "official_memo", "proposed_draft"] as const;
/** Source types that can support a human-verified criterion rule. */
export const operativeSourceTypes = ["adopted_ordinance", "official_memo"] as const;
/**
 * Operative status recorded by the person who captured the document.
 * `status_unconfirmed`: adoption or effect was not established at capture.
 */
export const sourceOperativeStatuses = [
  "operative",
  "proposed_not_operative",
  "status_unconfirmed",
  "superseded",
] as const;
export const citationVolatilities = ["high", "medium", "low"] as const;
export const programConfirmers = ["Los Angeles City Planning"] as const;

export const programFlagSignals = [
  "indicates_blocker",
  "indicates_no_blocker",
  "no_signal",
] as const;

export const programFlagCrosschecks = [
  "no_divergence",
  "diverges_from_criteria",
  "not_explained_by_criteria",
  "flag_sources_conflict",
  "not_observed",
  "recorded_only",
] as const;

export const releaseBlockerCodes = [
  "stale_criterion",
  "unreviewed_gating_fact",
  "pending_human_criterion",
  "prohibited_language",
  "program_flag_divergence",
] as const;

export const planningQuestionTriggers = [
  "conflict",
  "unknown",
  "professional",
  "program_flag_divergence",
  "program_flag_unexplained",
  "program_flag_conflict",
] as const;

export const reviewTaskKinds = [
  "verify_criterion_rule",
  "review_evidence",
  "reverify_stale_citation",
  "record_program_flag",
] as const;

export type ProgramPathwayId = (typeof programPathwayIds)[number];
export type ProgramFactKey = (typeof programFactKeys)[number];
export type CriterionStatus = (typeof criterionStatuses)[number];
export type PathwayRollup = (typeof pathwayRollups)[number];
export type CriterionVerification = (typeof criterionVerifications)[number];
export type CitationVolatility = (typeof citationVolatilities)[number];
export type ProgramConfirmer = (typeof programConfirmers)[number];
export type ProgramFlagSignal = (typeof programFlagSignals)[number];
export type ProgramFlagCrosscheck = (typeof programFlagCrosschecks)[number];
export type ReleaseBlockerCode = (typeof releaseBlockerCodes)[number];
export type PlanningQuestionTrigger = (typeof planningQuestionTriggers)[number];
export type ReviewTaskKind = (typeof reviewTaskKinds)[number];
export type SourceCaptureMethod = (typeof sourceCaptureMethods)[number];
export type OfficialSourceType = (typeof officialSourceTypes)[number];
export type OperativeSourceType = (typeof operativeSourceTypes)[number];
export type SourceOperativeStatus = (typeof sourceOperativeStatuses)[number];

/* ------------------------------------------------------------------ facts */

export type ProgramFactValueSpec =
  | { kind: "boolean" }
  | { kind: "number"; unit: string }
  | { kind: "text"; allowed: readonly string[] | null };

export interface ProgramFlagSpec {
  pathway: ProgramPathwayId;
  signal_when_true: ProgramFlagSignal;
  signal_when_false: ProgramFlagSignal;
}

/**
 * A fact key's schema. `label` and `client_label` must match the canonical
 * evidence claim exactly so evidence cannot inject client-facing wording.
 * `program_flag` facts are observation-only: no criterion may read them.
 */
export interface ProgramFactSpec {
  key: ProgramFactKey;
  label: string;
  client_label: string;
  role: "parcel_fact" | "program_flag";
  value: ProgramFactValueSpec;
  allowed_evidence_types: readonly EvidenceIntegrityType[] | null;
  flag: ProgramFlagSpec | null;
}

export type KnownFactValue = Exclude<
  EvidenceNormalizedValue,
  { kind: "unknown" } | { kind: "unresolved" }
>;

export interface ProgramFactObservation {
  evidence_id: string;
  raw_observed_value: EvidenceObservedValue;
  observed_display_value: string;
  normalized_value: EvidenceNormalizedValue;
  review_status: EvidenceIntegrityReviewStatus;
}

export interface ProgramFactAssessment {
  key: ProgramFactKey;
  label: string;
  client_label: string;
  role: ProgramFactSpec["role"];
  supplied: boolean;
  /** Canonical classification: fact / observation / inference / unknown / conflict. */
  classification: EvidenceIntegrityClassification;
  normalized_value: EvidenceNormalizedValue;
  /** Every underlying evidence record has completed human review. */
  reviewed: boolean;
  /** Canonical client-safe statement produced by the Case Integrity evaluator. */
  statement: string;
  assessment_id: string | null;
  evidence: IntegrityEvidenceProvenanceCitation[];
  observations: ProgramFactObservation[];
}

/* --------------------------------------------------------------- criteria */

export type PredicateOutcome =
  | "consistent_with_source"
  | "disqualifying_per_source"
  | "requires_judgment";

export type CriterionFactValues = Readonly<Record<string, KnownFactValue>>;

/** Pure, deterministic rule over established, reviewed fact values only. */
export type CriterionPredicate = (facts: CriterionFactValues) => PredicateOutcome;

export interface ProgramCriterionCitation {
  title: string;
  url: string;
  pinpoint: string;
  verified_at: string;
  volatility: CitationVolatility;
  next_review_at: string;
}

/**
 * Official-source text captured into this repository so a verified excerpt
 * can be re-checked deterministically. The file holds source text only; its
 * SHA-256 pins it to what the reviewer read. AI output is never a capture.
 */
export interface ProgramSourceCapture {
  repo_path: string;
  retrieved_at: string;
  capture_method: SourceCaptureMethod;
  sha256: string;
  is_ai_generated: false;
  /** A proposed draft can never support a rule; see `operativeSourceTypes`. */
  source_type: OperativeSourceType;
  operative_status: "operative";
}

/**
 * A named human reviewer's record that the criterion's rule is stated by the
 * cited official source. Title, URL, pinpoint, and dates must match the
 * criterion citation; the excerpt must appear in the captured source text.
 */
export interface ProgramCriterionHumanVerification {
  reviewer: {
    kind: "human";
    name: string;
    role: string;
  };
  verified_at: string;
  next_review_at: string;
  source_title: string;
  source_url: string;
  /** Ordinance, statute, or memo identifier, e.g. "Ordinance 188968". */
  instrument: string;
  pinpoint: string;
  supporting_excerpt: string;
  source_capture: ProgramSourceCapture;
}

/** Where in this repository the criterion's rule or dependency is stated. */
export interface ProgramCriterionBasis {
  repo_path: string;
  excerpts: readonly string[];
}

export interface ProgramCriterion {
  id: string;
  pathway: ProgramPathwayId;
  label: string;
  /** Screen anchor: must be consistent before any pathway result is drawn. */
  gating: boolean;
  fact_keys: readonly ProgramFactKey[];
  predicate: CriterionPredicate | "professional_judgment" | "not_encoded";
  rule_summary: string;
  citation: ProgramCriterionCitation;
  confirmer: ProgramConfirmer;
  question_if_unknown: string;
  question_if_conflict: string;
  question_if_judgment: string | null;
  verification: CriterionVerification;
  /** Required for `human_verified`; must be null otherwise. */
  human_verification: ProgramCriterionHumanVerification | null;
  basis: ProgramCriterionBasis;
}

export interface ProgramPathwayDefinition {
  id: ProgramPathwayId;
  label: string;
  confirmer: ProgramConfirmer;
}

export interface ProgramPathwayPack {
  pathway: ProgramPathwayDefinition;
  criteria: readonly ProgramCriterion[];
}

/* ---------------------------------------------------------------- results */

export type UnreviewedReason = "criterion_pending_human" | "evidence_unreviewed";

export interface ProgramCriterionFactRef {
  key: ProgramFactKey;
  classification: EvidenceIntegrityClassification;
  supplied: boolean;
  reviewed: boolean;
  evidence_ids: string[];
}

export interface ProgramCriterionResult {
  criterion_id: string;
  pathway: ProgramPathwayId;
  label: string;
  gating: boolean;
  verification: CriterionVerification;
  rule_kind: "predicate" | "professional_judgment" | "not_encoded";
  rule_summary: string;
  status: CriterionStatus;
  /** Applying a cited rule is inference; unresolved results stay unknown/conflict. */
  classification: EvidenceIntegrityClassification;
  statement: string;
  unreviewed_reasons: UnreviewedReason[];
  facts: ProgramCriterionFactRef[];
  citation: ProgramCriterionCitation;
  stale: boolean;
  confirmer: ProgramConfirmer;
}

export interface ProgramFlagResult {
  fact_key: ProgramFactKey;
  label: string;
  treated_as: "observation_only";
  classification: EvidenceIntegrityClassification;
  observations: Array<{
    evidence_id: string;
    observed_display_value: string;
    source_agency: string;
    source_title: string;
    source_url: string | null;
    retrieved_at: string;
  }>;
  signal: ProgramFlagSignal;
  crosscheck: ProgramFlagCrosscheck;
  statement: string;
}

export interface ProgramQuestionSource {
  evidence_id: string;
  fact_key: ProgramFactKey;
  source_agency: string;
  source_title: string;
  source_url: string | null;
  retrieved_at: string;
  observed_display_value: string;
}

export interface ProgramQuestion {
  id: string;
  pathway: ProgramPathwayId;
  trigger: PlanningQuestionTrigger;
  criterion_ids: string[];
  directed_to: ProgramConfirmer;
  question: string;
  why_confirmation_needed: string;
  citations: Array<{
    criterion_id: string;
    title: string;
    url: string;
    pinpoint: string;
  }>;
  sources: ProgramQuestionSource[];
}

export interface ProgramReviewTask {
  id: string;
  pathway: ProgramPathwayId;
  kind: ReviewTaskKind;
  criterion_id: string | null;
  fact_key: ProgramFactKey | null;
  instruction: string;
}

export interface ReleaseBlocker {
  code: ReleaseBlockerCode;
  pathway: ProgramPathwayId | null;
  ref: string;
  detail: string;
}

export interface ReleaseDecision {
  client_releasable: boolean;
  blockers: ReleaseBlocker[];
}

export interface ProgramPathwayResult {
  pathway: ProgramPathwayId;
  label: string;
  rollup: PathwayRollup;
  classification: EvidenceIntegrityClassification;
  statement: string;
  anchored: boolean;
  decisive_criteria: string[];
  criteria: ProgramCriterionResult[];
  program_flags: ProgramFlagResult[];
  planning_questions: ProgramQuestion[];
  review_tasks: ProgramReviewTask[];
  release: ReleaseDecision;
}

export interface ProgramScreenResult {
  schema_version: typeof PROGRAM_SCREEN_SCHEMA_VERSION;
  screen_id: string;
  screen_scope: typeof PROGRAM_SCREEN_SCOPE;
  subject: IntegrityEvidenceSubject;
  as_of: string;
  facts: ProgramFactAssessment[];
  pathways: ProgramPathwayResult[];
  planning_questions: ProgramQuestion[];
  review_tasks: ProgramReviewTask[];
  release: ReleaseDecision;
  counts: {
    facts: Record<EvidenceIntegrityClassification, number>;
    criteria: Record<CriterionStatus, number>;
    pathways: Record<PathwayRollup, number>;
  };
}
