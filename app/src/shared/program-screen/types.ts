import type {
  EvidenceIntegrityClassification,
  EvidenceIntegrityReviewStatus,
  EvidenceIntegrityType,
  EvidenceNormalizedValue,
  EvidenceObservedValue,
  IntegrityEvidenceProvenanceCitation,
  IntegrityEvidenceSubject,
} from "../build-week-integrity/types";
import type { ProgramCriterionAuthorityResult } from "./evidence-authority";

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
  "hpoz",
  "historic-designation",
  "historic-cultural-monument",
  "zoning-code-chapter",
  "lot-area",
  "shra-zone-category",
  "very-high-fire-hazard-severity-zone",
  "high-fire-hazard-severity-zone",
  "state-responsibility-area",
  "hillside-area",
  "coastal-zone",
  "sea-level-rise-area",
  "sb79-sea-level-rise-vulnerability",
  "prime-or-statewide-farmland",
  "wetlands",
  "nccp-conservation-land",
  "conservation-easement",
  "hazardous-waste-site",
  "special-flood-hazard-area",
  "regulatory-floodway",
  "earthquake-fault-zone",
  "existing-structures",
  "rso-status",
  "occupancy-history",
  "affordability-restricted-housing",
  "price-controlled-housing",
  "ellis-act-withdrawal-recorded",
  "prior-shra-or-sb9-map",
  "housing-element-site-listing",
  "sb79-permanent-exemption-shown",
  "sb79-temporary-exemption-shown",
  "seventh-housing-element-revision-adopted",
  "tod-alternative-plan-area",
  "hcm-or-hpoz-designated-by-2025-01-01",
  "low-rise-incentive-area-map-subarea",
  "low-rise-transportation-row",
  "low-rise-zone-class",
  "low-rise-manufacturing-zone-lot",
  "low-rise-single-family-zone-lot",
  "low-rise-excluded-plan-area",
  "zimas-shra-program-field",
  "zimas-sb79-category",
  "zimas-sb79-tier",
  "zimas-sb79-exemption",
  "zimas-low-rise-category",
] as const;

/**
 * Fact keys removed when the nine broad criteria were split (see
 * `retiredProgramFacts` in facts.ts for the reason and any replacement).
 * Evidence for a retired key is rejected, never reinterpreted.
 */
export const retiredProgramFactKeys = [
  "general-plan-land-use",
  "specific-plan-area",
  "landslide-area",
  "flood-zone",
  "fault-zone",
  "existing-dwelling-units",
  "prior-subdivisions",
  "housing-element-site-status",
  "sb79-permanent-exclusion",
  "sb79-temporary-exemption",
] as const;

/**
 * What a fact's value is, and so what may read it:
 * - `controlled_value`: a boolean, a number with a unit, or one of a closed
 *   list of values, recorded from a named record. Only these may feed a
 *   predicate, now or after human verification.
 * - `source_observation`: what a record displays, kept as recorded (a zoning
 *   string, a ZIMAS program field). Never feeds a predicate.
 * - `professional_input`: context for a professional-judgment criterion
 *   (free-text history, a structure count). Never feeds a predicate.
 */
export const programFactDataClasses = [
  "controlled_value",
  "source_observation",
  "professional_input",
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
 * The nine broad criteria that were `pending_human` when the Program Screen
 * core shipped. Each was split into the atomic criteria listed in
 * `humanVerificationRequiredCriterionIds` (mapping: criteria/retired.ts).
 * A retired ID can never be shipped again.
 */
export const retiredProgramCriterionIds = [
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

/**
 * Atomic criteria that replaced the nine broad pending criteria. Each rests on
 * one proposition in a captured operative source and stays `pending_human`
 * (rule not encoded, or professional judgment) until a named human reviewer
 * verifies it. Each may leave `pending_human` only as `human_verified`, with a
 * complete human-verification record; none may be relabeled `repo_sourced`.
 */
export const humanVerificationRequiredCriterionIds = [
  "la_shra.zone-category",
  "la_shra.multifamily-lot-area-threshold",
  "la_shra.single-family-lot-area-threshold",
  "la_shra.single-family-vacancy-condition",
  "la_shra.ellis-act-withdrawal",
  "la_shra.protected-housing-affordability-covenant",
  "la_shra.protected-housing-price-control",
  "la_shra.protected-housing-tenant-occupancy",
  "la_shra.protected-housing-demolition-or-alteration",
  "la_shra.prior-shra-or-sb9-map",
  "la_shra.housing-element-projected-units",
  "la_shra.housing-element-lower-income-units",
  "la_shra.prime-or-statewide-farmland",
  "la_shra.wetlands",
  "la_shra.very-high-fire-hazard-severity-zone",
  "la_shra.high-fire-hazard-severity-zone",
  "la_shra.natural-community-conservation-plan-land",
  "la_shra.protected-species-habitat",
  "la_shra.conservation-easement",
  "la_shra.hazardous-waste-site",
  "la_shra.special-flood-hazard-area",
  "la_shra.regulatory-floodway",
  "la_shra.earthquake-fault-zone",
  "la_sb79.permanent-exemption-shown",
  "la_sb79.permanent-exemption-walking-path",
  "la_sb79.permanent-exemption-industrial-hub",
  "la_sb79.temporary-exemption-all-parcels",
  "la_sb79.temporary-exemption-period",
  "la_sb79.temporary-exemption-shown",
  "la_sb79.temporary-exemption-capacity-criteria",
  "la_sb79.temporary-exemption-tod-alternative-plan",
  "la_sb79.temporary-exemption-fire-or-state-responsibility-area",
  "la_sb79.temporary-exemption-sea-level-rise",
  "la_sb79.temporary-exemption-historic-resource",
  "la_low_rise.incentive-area-map-subarea",
  "la_low_rise.subarea-distance-bands",
  "la_low_rise.subarea-geographic-criteria",
  "la_low_rise.underlying-zone",
  "la_low_rise.manufacturing-zone-exclusion",
  "la_low_rise.single-family-zone-exclusion",
  "la_low_rise.fire-restriction-area-exclusion",
  "la_low_rise.coastal-zone-exclusion",
  "la_low_rise.sea-level-rise-area-exclusion",
  "la_low_rise.excluded-plan-area",
  "la_low_rise.c10-exception-path",
  "la_low_rise.tod-subarea-historic-limit",
] as const;

/**
 * Conditions a named human reviewer set before a criterion may become
 * `human_verified`. Each maps to a check computed from code registries
 * (`authorityPromotionBlockers` in authority-policy.ts), so no condition is
 * met because someone wrote a note saying so.
 */
export const criterionPromotionGates = [
  "lot_area_precision_fails_closed",
  "legal_lot_identity_fails_closed",
  "r1_variation_zone_fails_closed",
  "chapter_1a_fails_closed",
  "map_history_completeness_fails_closed",
  "search_completeness_fails_closed",
  "applicable_law_fails_closed",
  "evidence_provenance_enforced_or_fails_closed",
  "map_identity_and_edition_recorded",
  "responsibility_area_and_legend_recorded",
  "adopted_plan_identity_adoption_and_map_date_recorded",
  "instrument_identity_in_force_status_and_coverage_recorded",
  "defining_official_source_captured",
  "directors_section_3_map_captured",
  "reviewer_confirms_encoded_rule",
  "human_verification_record",
  // Decided in Phase 3B (docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md), wired in Phase 3C.
  "statutory_route_recorded",
  "statutory_routes_assessed_separately",
  "prc_4202_map_coverage_and_legend_class_recorded",
  "fmmp_categories_tied_to_usda_criteria",
  "nccp_plan_type_and_statutory_basis_recorded",
] as const;

/**
 * Gates a later decision replaced. Each stays in `criterionPromotionGates` so
 * the decision records that name it still parse, but no authority
 * requirement may list it and it is never met.
 * `responsibility_area_and_legend_recorded` (Round 1 d) was replaced by
 * `prc_4202_map_coverage_and_legend_class_recorded` (Phase 3B d).
 */
export const retiredCriterionPromotionGates = ["responsibility_area_and_legend_recorded"] as const;

/**
 * The two statutory routes to a Very High Fire Hazard Severity Zone record
 * (Phase 3B c): a zone determined by CAL FIRE under GOV §51178, and a zone on a
 * map adopted by CAL FIRE under PRC §4202. High has only the PRC §4202 route
 * (Phase 3B d).
 */
export const fireHazardStatutoryRoutes = ["gov_51178", "prc_4202"] as const;

/**
 * A statutory category a pathway's criteria do not model yet (Phase 3B
 * pathway completeness blockers). While one is open, its pathway never rolls
 * up to `no_disqualifier_found_in_reviewed_sources`; see `rollUpProgramPathway`.
 * A blocker closes only through a separately reviewed criterion or fact, or an
 * explicit later human review, recorded as a reviewed change to this list.
 */
export interface ProgramPathwayCompletenessBlocker {
  id: string;
  key: string;
  pathway: ProgramPathwayId;
  statute_source_id: string;
  statute_pinpoint: string;
  /** The criterion nearest the category. Passing it never closes the blocker. */
  related_criterion_id: string;
  status: "open";
}

/** Mirrors `pathway_completeness_blockers` in the Phase 3B decisions record. */
export const programPathwayCompletenessBlockers: readonly ProgramPathwayCompletenessBlocker[] = [
  {
    id: "G1",
    key: "shra_a9a_ballot_measure_agricultural_land",
    pathway: "la_shra",
    statute_source_id: "gcs-66499-41",
    statute_pinpoint: "(a)(9)(A)",
    related_criterion_id: "la_shra.prime-or-statewide-farmland",
    status: "open",
  },
  {
    id: "G2",
    key: "shra_a9h_hcp_and_other_resource_protection_plans",
    pathway: "la_shra",
    statute_source_id: "gcs-66499-41",
    statute_pinpoint: "(a)(9)(H)",
    related_criterion_id: "la_shra.natural-community-conservation-plan-land",
    status: "open",
  },
];

export const sourceCaptureMethods = [
  "pdf_text_extraction",
  "html_text_extraction",
  "manual_transcription",
] as const;

/**
 * What a captured official document is. A `proposed_draft` is never law: it
 * can prompt a human re-review but can never support a criterion rule.
 * `agency_map` and `statute` (Phase 2b) are captured for later reviewed use:
 * a map through the authority registries, a statute for human re-review.
 * Neither can support a criterion rule.
 */
export const officialSourceTypes = [
  "adopted_ordinance",
  "official_memo",
  "proposed_draft",
  "agency_map",
  "statute",
] as const;
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
  "review_evidence_authority",
] as const;

export type ProgramPathwayId = (typeof programPathwayIds)[number];
export type ProgramFactKey = (typeof programFactKeys)[number];
export type RetiredProgramFactKey = (typeof retiredProgramFactKeys)[number];
export type ProgramFactDataClass = (typeof programFactDataClasses)[number];
export type RetiredProgramCriterionId = (typeof retiredProgramCriterionIds)[number];
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
export type CriterionPromotionGate = (typeof criterionPromotionGates)[number];
export type FireHazardStatutoryRoute = (typeof fireHazardStatutoryRoutes)[number];

/**
 * A named human reviewer's decision: by review round and letter (Round 1), or
 * by re-review phase and letter (Phase 3B supersedes Round 1 c-g).
 */
export type ProgramDecisionRef = { round: number; letter: string } | { phase: string; letter: string };

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
  data_class: ProgramFactDataClass;
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

export const predicateOutcomes = [
  "consistent_with_source",
  "disqualifying_per_source",
  "requires_judgment",
] as const;

export type PredicateOutcome = (typeof predicateOutcomes)[number];

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
  /**
   * The review decision whose encoded rule the reviewer confirmed. Required
   * for the `reviewer_confirms_encoded_rule` promotion gate.
   */
  decision_ref?: ProgramDecisionRef;
}

/** Where in this repository the criterion's rule or dependency is stated. */
export interface ProgramCriterionBasis {
  repo_path: string;
  excerpts: readonly string[];
}

/**
 * A source exception that can override the criterion's blocking direction,
 * such as Ordinance 188967 (c)(10) for the Low-Rise site exclusions. A
 * criterion with an exception may permit `disqualifying_per_source` only when
 * every exception names at least one fact and the criterion reads it; an
 * exception with no modeled fact rules the blocking direction out.
 */
export interface ProgramCriterionException {
  label: string;
  pinpoint: string;
  fact_keys: readonly ProgramFactKey[];
}

/**
 * Records of `fact_key` are assessed separately for each route: a record
 * whose authority block names a route counts only toward that route, and
 * every other record counts toward every route. Each route keeps canonical
 * Layer 1 conflict handling. A YES on any route supports the criterion; a NO
 * needs every route; anything else is unknown.
 */
export interface ProgramStatutoryRouteAssessment {
  fact_key: ProgramFactKey;
  routes: readonly FireHazardStatutoryRoute[];
}

export interface ProgramCriterion {
  id: string;
  pathway: ProgramPathwayId;
  label: string;
  /** Screen anchor: must be consistent before any pathway result is drawn. */
  gating: boolean;
  /** May be empty only for a professional-judgment criterion whose test no parcel fact records. */
  fact_keys: readonly ProgramFactKey[];
  predicate: CriterionPredicate | "professional_judgment" | "not_encoded";
  /**
   * The only outcomes the rule may ever return, now or once human-verified.
   * Always includes `requires_judgment`; the evaluator rejects anything else.
   * This is how a one-direction-only criterion stays one-direction.
   */
  permitted_outcomes: readonly PredicateOutcome[];
  exception_paths: readonly ProgramCriterionException[];
  /**
   * Phase 3B c: the fact whose records are assessed once per statutory route
   * before the roll-up. Absent for every other criterion.
   * See `assessStatutoryRoutes` in evaluate.ts.
   */
  statutory_routes?: ProgramStatutoryRouteAssessment;
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

/** One statutory route's assessment of a route-separated fact. */
export interface ProgramCriterionRouteRef {
  route: FireHazardStatutoryRoute;
  fact_key: ProgramFactKey;
  classification: EvidenceIntegrityClassification;
  supplied: boolean;
  reviewed: boolean;
  /** The route's established YES or NO; null when the route is not established. */
  value: boolean | null;
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
  /**
   * Present only when the evidence-authority gate ran: the criterion has an
   * enforced authority requirement and reached it (every earlier status check
   * passed). Absent otherwise, so criteria the gate never reaches keep their
   * exact output.
   */
  authority?: ProgramCriterionAuthorityResult;
  /**
   * Present only when a record of the route-separated fact names a statutory
   * route. With no routed record every route sees the same records, so the
   * result is the single-fact result and is left unchanged.
   */
  statutory_routes?: ProgramCriterionRouteRef[];
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
  /**
   * Present only when an open completeness blocker held the roll-up at
   * `undetermined` instead of `no_disqualifier_found_in_reviewed_sources`.
   */
  open_completeness_blockers?: string[];
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
