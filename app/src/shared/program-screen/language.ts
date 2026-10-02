import { prohibitedIntegrityLanguage } from "../build-week-integrity/validation";
import type { ProgramCriterionAuthorityResult } from "./evidence-authority";
import { programFactSpecs } from "./facts";
import type {
  CriterionStatus,
  FireHazardStatutoryRoute,
  PathwayRollup,
  ProgramFactAssessment,
  ProgramFlagCrosscheck,
  UnreviewedReason,
} from "./types";

/**
 * Client-facing conclusion guard.
 *
 * It scans text PermitPulse generates (labels, statements, questions, review
 * instructions). Source metadata is not scanned: citation titles, source
 * titles, agency names, and observed values may legitimately contain words
 * such as "Eligibility". Generated text may quote that metadata only inside
 * curly quotes, and only when the quoted string is registered as source
 * metadata; every other occurrence is scanned.
 */
const programScreenProhibitedPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:in)?eligib(?:le|ility|ilities)\b/i, label: "eligibility claim" },
  { pattern: /\bqualif(?:y|ies|ied|ying)\b/i, label: "qualification claim" },
  { pattern: /\bby[\s-]+right\b/i, label: "by-right claim" },
  { pattern: /\bbuildable\b/i, label: "buildability claim" },
  { pattern: /\bapprov(?:ed|able)\b/i, label: "approval claim" },
  { pattern: /\bguarantee(?:d|s)?\b/i, label: "guarantee claim" },
  { pattern: /\bentitle(?:d|ment|ments)?\b/i, label: "entitlement claim" },
  {
    pattern: /\bmax(?:imum)?\.?\s+(?:number\s+of\s+)?(?:dwelling\s+|housing\s+)?units?\b/i,
    label: "unit-count claim",
  },
  { pattern: /\bunits?[\s-]+yield\b/i, label: "unit-count claim" },
  {
    pattern: /\b(?:allows?|permits?)\s+(?:up\s+to\s+)?\d+\s+(?:dwelling\s+)?units?\b/i,
    label: "unit-count claim",
  },
];

export const PROGRAM_SCREEN_OPEN_QUOTE = "“";
export const PROGRAM_SCREEN_CLOSE_QUOTE = "”";

export function quote(value: string): string {
  return `${PROGRAM_SCREEN_OPEN_QUOTE}${value}${PROGRAM_SCREEN_CLOSE_QUOTE}`;
}

export function findProhibitedClientLanguage(
  text: string,
  sourceQuotations: Iterable<string> = [],
): string[] {
  let scanned = text;
  // Longest first so a quoted title is removed before a shorter quoted value.
  const quotations = [...new Set(sourceQuotations)]
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length);
  for (const value of quotations) {
    scanned = scanned.split(quote(value)).join(quote(""));
  }
  const labels = programScreenProhibitedPatterns
    .filter(({ pattern }) => pattern.test(scanned))
    .map(({ label }) => label);
  return [...new Set([...labels, ...prohibitedIntegrityLanguage(scanned)])];
}

function canonicalReadableValue(fact: ProgramFactAssessment): string | null {
  const value = fact.normalized_value;
  if (value.kind === "boolean") return value.value ? "YES" : "NO";
  if (value.kind === "number") return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
  if (value.kind === "text" || value.kind === "date") return value.value;
  return null;
}

/**
 * Canonical fact statements end with one source value verbatim and without
 * quotes (" ... as <value>."). Only that trailing source value is removed
 * before scanning; the template and the controlled client label are checked.
 */
export function findProhibitedFactStatementLanguage(
  fact: ProgramFactAssessment,
): string[] {
  const readable = canonicalReadableValue(fact);
  const suffix = readable === null ? null : ` as ${readable}.`;
  const scanned =
    suffix !== null && fact.statement.endsWith(suffix)
      ? fact.statement.slice(0, -suffix.length)
      : fact.statement;
  return findProhibitedClientLanguage(scanned);
}

/* -------------------------------------------------------------- templates */

/** Client-facing names of the statutory routes a route-separated fact is assessed on. */
export const statutoryRouteLabels: Readonly<Record<FireHazardStatutoryRoute, string>> = {
  gov_51178: "GOV §51178 route",
  prc_4202: "PRC §4202 route",
};

function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** Labels of the facts an unmet authority requirement names, in reading order. */
export function authorityShortfallLabels(authority: ProgramCriterionAuthorityResult): {
  unestablished: string[];
  unread: string[];
  outOfScope: string[];
} {
  const labelsFor = (code: "requirement_fact_not_read" | "scope_precondition_not_met") =>
    authority.criterion_failures
      .filter((failure) => failure.code === code)
      .map((failure) => programFactSpecs[failure.fact_key].label);
  return {
    unestablished: authority.facts
      .filter((fact) => !fact.established)
      .map((fact) =>
        fact.route === undefined
          ? programFactSpecs[fact.key].label
          : `${programFactSpecs[fact.key].label} (${statutoryRouteLabels[fact.route]})`,
      ),
    unread: labelsFor("requirement_fact_not_read"),
    outOfScope: labelsFor("scope_precondition_not_met"),
  };
}

function authorityUnknownStatement(authority: ProgramCriterionAuthorityResult): string {
  const { unestablished, unread, outOfScope } = authorityShortfallLabels(authority);
  const parts: string[] = [];
  if (unestablished.length > 0) {
    parts.push(
      `No record that this criterion accepts as authoritative establishes the recorded ${joinLabels(unestablished)}.`,
    );
  }
  if (unread.length > 0) {
    parts.push(`The criterion's authority requirement names ${joinLabels(unread)}, which the criterion does not yet read.`);
  }
  if (outOfScope.length > 0) {
    parts.push(`The recorded ${joinLabels(outOfScope)} is outside the scope the criterion's authority requirement covers.`);
  }
  if (authority.criterion_failures.some((failure) => failure.code === "statutory_routes_lot_geometry_not_shared")) {
    parts.push("The statutory routes' negative records do not rest on one reviewed lot geometry, so they are not combined.");
  }
  parts.push(
    "This criterion stays unknown. A record that is not a registered, reviewed authority can conflict with other records but cannot establish a fact, and missing authority is not treated as a no.",
  );
  return parts.join(" ");
}

export function criterionStatement(input: {
  status: CriterionStatus;
  facts: readonly ProgramFactAssessment[];
  unreviewedReasons: readonly UnreviewedReason[];
  /** Set only when the evidence-authority gate ran. */
  authority?: ProgramCriterionAuthorityResult;
}): string {
  const factLabels = joinLabels(input.facts.map((fact) => fact.label));
  if (input.status === "unknown" && input.authority !== undefined && !input.authority.established) {
    return authorityUnknownStatement(input.authority);
  }
  switch (input.status) {
    case "conflict":
      return `${input.facts
        .filter((fact) => fact.classification === "conflict")
        .map((fact) => fact.statement)
        .join(" ")} This criterion stays unresolved; PermitPulse does not choose between conflicting sources.`;
    case "unknown":
      return `${input.facts
        .filter(
          (fact) =>
            fact.classification !== "verified_fact" &&
            fact.classification !== "source_observation",
        )
        .map((fact) => fact.statement)
        .join(" ")} This criterion stays unknown; missing evidence is not treated as a no.`;
    case "professional":
      return "This criterion turns on agency or professional judgment under the cited source; PermitPulse does not make that determination.";
    case "unreviewed": {
      const reasons: string[] = [];
      if (input.unreviewedReasons.includes("criterion_pending_human")) {
        reasons.push(
          "the rule has not been verified against the cited source by a PermitPulse reviewer",
        );
      }
      if (input.unreviewedReasons.includes("evidence_unreviewed")) {
        reasons.push(`evidence for ${factLabels} has not been reviewed`);
      }
      return `No result is drawn because ${joinLabels(reasons)}.`;
    }
    case "consistent_with_source":
      return `Reviewed records for ${factLabels} are consistent with the cited source for this criterion.`;
    case "disqualifying_per_source":
      return `Reviewed records for ${factLabels} document a condition that the cited source treats as blocking this pathway.`;
  }
}

export function pathwayStatement(input: {
  rollup: PathwayRollup;
  anchored: boolean;
  factConflict: boolean;
  flagDivergence: boolean;
  confirmer: string;
  /** An open completeness blocker held a clear roll-up at undetermined (Phase 3B G1, G2). */
  completenessBlocked?: boolean;
}): string {
  const unanchored =
    "The parcel match or jurisdiction is not settled in the reviewed record, so this screen draws no pathway result.";
  const divergence =
    "A ZIMAS program display and the reviewed criteria point in different directions. The display is kept as an observation, and the disagreement stays open.";
  switch (input.rollup) {
    case "documented_disqualifier":
      return [
        "The reviewed official record documents at least one condition that a cited source treats as blocking this pathway.",
        ...(input.flagDivergence ? [divergence] : []),
        `${input.confirmer} makes the governing determination.`,
      ].join(" ");
    case "contested": {
      const parts: string[] = [];
      if (!input.anchored) parts.push(unanchored);
      if (input.factConflict) {
        parts.push(
          "Official sources disagree on at least one fact this pathway depends on. PermitPulse has not chosen between them.",
        );
      }
      if (input.flagDivergence) parts.push(divergence);
      parts.push(`The pathway stays contested until ${input.confirmer} confirms which record governs.`);
      return parts.join(" ");
    }
    case "undetermined":
      if (input.anchored && input.completenessBlocked) {
        return `No blocking condition was found in the reviewed sources for the criteria screened, but at least one statutory site category this screen does not yet cover remains open, so the reviewed record does not settle this pathway. ${input.confirmer} makes the governing determination.`;
      }
      return input.anchored
        ? "The reviewed record does not settle this pathway: at least one criterion is unknown, turns on agency or professional judgment, or awaits PermitPulse review."
        : unanchored;
    case "no_disqualifier_found_in_reviewed_sources":
      return `No blocking condition was found in the reviewed sources for the criteria screened. This is not a determination that the pathway is available; ${input.confirmer} makes that determination.`;
  }
}

export function flagStatement(input: {
  label: string;
  displays: readonly string[];
  crosscheck: ProgramFlagCrosscheck;
}): string {
  const shown = input.displays.map(quote).join(" and ");
  const observation = `${input.label} was recorded as ${shown}. PermitPulse keeps this display as an observation; it does not decide the pathway.`;
  switch (input.crosscheck) {
    case "no_divergence":
    case "recorded_only":
      return observation;
    case "diverges_from_criteria":
      return `${observation} It points the other way from the reviewed criteria, and that disagreement stays open.`;
    case "not_explained_by_criteria":
      return `${observation} The reviewed criteria have not documented the condition behind it.`;
    case "flag_sources_conflict":
      return `Sources disagree on ${input.label}: ${shown}. PermitPulse does not choose between them.`;
    case "not_observed":
      return `No observation of ${input.label} was recorded; it remains unknown.`;
  }
}
