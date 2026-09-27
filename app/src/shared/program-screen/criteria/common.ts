import { IntegrityValidationError } from "../../build-week-integrity/validation";
import type {
  CriterionFactValues,
  PredicateOutcome,
  ProgramCriterion,
  ProgramCriterionCitation,
  ProgramCriterionException,
  ProgramFactKey,
  ProgramPathwayId,
} from "../types";

/**
 * Criteria are encoded only from rules stated in this repository's reviewed
 * source notes. Both housing-program guides record "Official sources reviewed
 * September 17, 2026"; that is the verification date carried below. Anything
 * the notes do not state concretely is `pending_human` and `not_encoded`.
 */
export const SOURCE_NOTES_REVIEWED_AT = "2026-09-17";

export const repoSourceNotes = {
  sb79LowRiseGuide:
    "dist/resources/does-sb79-low-rise-apply-los-angeles-property/index.html",
  housingProgramsGuide:
    "dist/resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/index.html",
} as const;

const HIGH_VOLATILITY_NEXT_REVIEW = "2026-10-17";
const MEDIUM_VOLATILITY_NEXT_REVIEW = "2026-11-16";

export const officialSources = {
  zimas: {
    title: "ZIMAS — City of Los Angeles property information",
    url: "https://zimas.lacity.org/",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "medium",
    next_review_at: MEDIUM_VOLATILITY_NEXT_REVIEW,
  },
  sb79Hub: {
    title: "Los Angeles City Planning — Senate Bill 79",
    url: "https://planning.lacity.gov/resources/senate-bill-sb-79",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "high",
    next_review_at: HIGH_VOLATILITY_NEXT_REVIEW,
  },
  phasedImplementationOrdinance: {
    title: "Ordinance 188968 — Phased Implementation Ordinance (SB 79)",
    url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "high",
    next_review_at: HIGH_VOLATILITY_NEXT_REVIEW,
  },
  lowRiseOrdinance: {
    title: "Ordinance 188967 — Low-Rise Ordinance (Mixed Income Incentive Program amendments)",
    url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "high",
    next_review_at: HIGH_VOLATILITY_NEXT_REVIEW,
  },
  shraPage: {
    title: "Los Angeles City Planning — SHRA / Senate Bills 684 and 1123",
    url: "https://planning.lacity.gov/project-review/shra-senate-bill-684-1123",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "high",
    next_review_at: HIGH_VOLATILITY_NEXT_REVIEW,
  },
  shraMemo: {
    title:
      "Los Angeles City Planning — SHRA implementation memo (October 28, 2025; SB 684, SB 1123, AB 130)",
    url: "https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf",
    verified_at: SOURCE_NOTES_REVIEWED_AT,
    volatility: "high",
    next_review_at: HIGH_VOLATILITY_NEXT_REVIEW,
  },
} as const satisfies Record<string, Omit<ProgramCriterionCitation, "pinpoint">>;

export function cite(
  source: keyof typeof officialSources,
  pinpoint: string,
): ProgramCriterionCitation {
  return { ...officialSources[source], pinpoint };
}

/**
 * Operative official sources captured under
 * app/fixtures/program-screen/official-sources/. The atomic criteria quote
 * these files exactly; the tests re-check every excerpt against them. The
 * September 24, 2026 Low-Rise draft is deliberately absent: a proposed draft
 * can never be a criterion basis.
 */
export const capturedOperativeSources = {
  shraMemo: "app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt",
  phasedImplementationOrdinance:
    "app/fixtures/program-screen/official-sources/ordinance-188968/extracted.txt",
  lowRiseOrdinance: "app/fixtures/program-screen/official-sources/ordinance-188967/extracted.txt",
} as const satisfies Partial<Record<keyof typeof officialSources, string>>;

const verificationStillRequired =
  "record the reviewer, verification date, exact section, and exact supporting excerpt";

/** One proposition in one captured operative source. */
export interface AtomicCriterionSpec {
  id: string;
  pathway: ProgramPathwayId;
  label: string;
  fact_keys: readonly ProgramFactKey[];
  source: keyof typeof capturedOperativeSources;
  pinpoint: string;
  /** Exact text from the capture; the proposal pins each excerpt to its page. */
  excerpts: readonly string[];
  /** What the source says and why the criterion cannot yet decide more. No conclusions. */
  summary: string;
  permitted_outcomes: readonly PredicateOutcome[];
  exception_paths?: readonly ProgramCriterionException[];
  question_if_unknown: string;
  question_if_conflict: string;
}

function atomicBase(spec: AtomicCriterionSpec) {
  return {
    id: spec.id,
    pathway: spec.pathway,
    label: spec.label,
    gating: false,
    fact_keys: spec.fact_keys,
    permitted_outcomes: spec.permitted_outcomes,
    exception_paths: spec.exception_paths ?? [],
    citation: cite(spec.source, spec.pinpoint),
    confirmer: "Los Angeles City Planning" as const,
    question_if_unknown: spec.question_if_unknown,
    question_if_conflict: spec.question_if_conflict,
    verification: "pending_human" as const,
    human_verification: null,
    basis: { repo_path: capturedOperativeSources[spec.source], excerpts: spec.excerpts },
  };
}

/**
 * An atomic criterion whose rule might be encoded once a named human reviewer
 * verifies it. It never runs in this state: status `unreviewed`, release
 * blocked. `permitted_outcomes` caps what a verified rule could ever return.
 */
export function pendingAtomicCriterion(spec: AtomicCriterionSpec): ProgramCriterion {
  return {
    ...atomicBase(spec),
    predicate: "not_encoded",
    rule_summary: `Rule not encoded. ${spec.summary} A PermitPulse reviewer must verify it against the captured source and ${verificationStillRequired} before this criterion can produce a result.`,
    question_if_judgment: null,
  };
}

/**
 * An atomic criterion the source leaves to agency or professional judgment
 * (project scope, site analysis, or a legal definition). It routes to
 * Planning and never resolves; it also stays release-blocking until a human
 * reviewer confirms the reading.
 */
export function professionalAtomicCriterion(
  spec: Omit<AtomicCriterionSpec, "permitted_outcomes"> & { question_if_judgment: string },
): ProgramCriterion {
  return {
    ...atomicBase({ ...spec, permitted_outcomes: ["requires_judgment"] }),
    predicate: "professional_judgment",
    rule_summary: `Not a mechanical test: ${spec.summary} Planning makes this determination. The reading is unverified; a PermitPulse reviewer must still ${verificationStillRequired}.`,
    question_if_judgment: spec.question_if_judgment,
  };
}

/* ------------------------------------------------------ predicate helpers */

function factValue(facts: CriterionFactValues, key: ProgramFactKey) {
  const value = facts[key];
  if (value === undefined) {
    throw new IntegrityValidationError(
      "PREDICATE_FACT_MISSING",
      `A predicate read ${key} without an established value.`,
    );
  }
  return value;
}

export function booleanFact(facts: CriterionFactValues, key: ProgramFactKey): boolean {
  const value = factValue(facts, key);
  if (value.kind !== "boolean") {
    throw new IntegrityValidationError(
      "PREDICATE_FACT_SHAPE",
      `A predicate expected ${key} to be boolean.`,
    );
  }
  return value.value;
}

export function textFact(facts: CriterionFactValues, key: ProgramFactKey): string {
  const value = factValue(facts, key);
  if (value.kind !== "text") {
    throw new IntegrityValidationError(
      "PREDICATE_FACT_SHAPE",
      `A predicate expected ${key} to be text.`,
    );
  }
  return value.value;
}

/* --------------------------------------------------- screen anchor criteria */

const anchorBasis = {
  repo_path: repoSourceNotes.sb79LowRiseGuide,
  excerpts: [
    "These are City of Los Angeles research directions.",
    "Match the address to its parcel in ZIMAS, the City’s property mapping system.",
    "Save the parcel identifier and boundary; a mailing-city name alone is not your jurisdiction check.",
    "If you cannot confidently match the site, stop the program screen there.",
    "A failed search leaves jurisdiction unresolved.",
  ],
} as const;

export function parcelMatchCriterion(pathway: ProgramPathwayId): ProgramCriterion {
  return {
    id: `${pathway}.parcel-match`,
    pathway,
    label: "Address matched to a single City parcel record",
    gating: true,
    fact_keys: ["parcel-match"],
    predicate: (facts) =>
      booleanFact(facts, "parcel-match") ? "consistent_with_source" : "requires_judgment",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    exception_paths: [],
    rule_summary:
      "Consistent when a reviewed record matches the address to one parcel record; an unmatched address stops the screen for confirmation.",
    citation: cite("zimas", "Parcel search: parcel identifier and boundary"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "Which single parcel record in ZIMAS corresponds to this address, and what parcel identifier and boundary does it show?",
    question_if_conflict:
      "Official records disagree on which parcel this address matches. Which parcel record governs?",
    question_if_judgment:
      "The address could not be matched to a single parcel record. Which parcel record, if any, corresponds to this address?",
    verification: "repo_sourced",
    human_verification: null,
    basis: anchorBasis,
  };
}

export function jurisdictionCriterion(pathway: ProgramPathwayId): ProgramCriterion {
  return {
    id: `${pathway}.jurisdiction`,
    pathway,
    label: "Parcel within the City of Los Angeles (scope of this City pathway)",
    gating: true,
    fact_keys: ["jurisdiction"],
    predicate: (facts) =>
      textFact(facts, "jurisdiction") === "City of Los Angeles"
        ? "consistent_with_source"
        : "disqualifying_per_source",
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary:
      "Consistent when the matched parcel is recorded in the City of Los Angeles; another recorded jurisdiction is outside this City pathway.",
    citation: cite("zimas", "Matched parcel: jurisdiction"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Which agency has land-use jurisdiction over the matched parcel?",
    question_if_conflict:
      "Official records disagree on the matched parcel's land-use jurisdiction. Which agency's record governs?",
    question_if_judgment: "Which agency has land-use jurisdiction over the matched parcel?",
    verification: "repo_sourced",
    human_verification: null,
    basis: anchorBasis,
  };
}
