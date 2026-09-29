import type { EvidenceIntegrityClassification } from "../build-week-integrity/types";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import {
  evaluateCriterionAuthority,
  type ProgramAuthorityContext,
  type ProgramLotOverlayInputs,
  type ProgramRouteAuthorityInput,
} from "./authority-gate";
import {
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
} from "./authority-policy";
import { shraPack } from "./criteria/shra";
import { lowRisePack, sb79Pack } from "./criteria/sb79-low-rise";
import {
  assessProgramFacts,
  isEstablishedFact,
  programFactSpecs,
  programFlagKeysFor,
} from "./facts";
import {
  criterionStatement,
  findProhibitedClientLanguage,
  findProhibitedFactStatementLanguage,
  flagStatement,
  pathwayStatement,
  statutoryRouteLabels,
} from "./language";
import { parseProgramEvidenceAuthority, type ProgramCriterionAuthorityResult } from "./evidence-authority";
import { isVerifiedLotGeometry } from "./lot-overlay";
import { isVerifiedOverlayDatasetView } from "./overlay-dataset";
import { buildCriterionQuestion, buildFlagQuestion, buildReviewTasks } from "./questions";
import {
  criterionAwaitsHumanVerification,
  parseProgramPathwayPacks,
  parseProgramScreenEvidence,
  programIsoDateSchema,
} from "./schema";
import {
  criterionStatuses,
  pathwayRollups,
  programPathwayCompletenessBlockers,
  PROGRAM_SCREEN_SCHEMA_VERSION,
  PROGRAM_SCREEN_SCOPE,
  type CriterionFactValues,
  type CriterionStatus,
  type FireHazardStatutoryRoute,
  type KnownFactValue,
  type PathwayRollup,
  type ProgramCriterion,
  type ProgramCriterionResult,
  type ProgramCriterionRouteRef,
  type ProgramFactAssessment,
  type ProgramFactKey,
  type ProgramFlagCrosscheck,
  type ProgramFlagResult,
  type ProgramFlagSignal,
  type ProgramPathwayPack,
  type ProgramPathwayResult,
  type ProgramQuestion,
  type ProgramScreenResult,
  type ReleaseBlocker,
  type UnreviewedReason,
} from "./types";

/** The v1 LA Program Screen: SHRA, SB 79, and Low-Rise, in that order. */
export const programScreenPathwayPacks: readonly ProgramPathwayPack[] = [
  shraPack,
  sb79Pack,
  lowRisePack,
];

export type ProgramFactIndex = ReadonlyMap<ProgramFactKey, ProgramFactAssessment>;

const predicateOutcomes = new Set([
  "consistent_with_source",
  "disqualifying_per_source",
  "requires_judgment",
]);

function statusClassification(status: CriterionStatus): EvidenceIntegrityClassification {
  if (status === "conflict") return "conflict";
  if (status === "consistent_with_source" || status === "disqualifying_per_source") {
    return "inference";
  }
  return "unknown";
}

function rollupClassification(rollup: PathwayRollup): EvidenceIntegrityClassification {
  if (rollup === "contested") return "conflict";
  if (rollup === "undetermined") return "unknown";
  return "inference";
}

export function isCitationStale(criterion: ProgramCriterion, asOf: string): boolean {
  // The Paper Trail Loop marks a note stale once its review date arrives.
  // A human verification record carries its own review date as well.
  const record = criterion.human_verification;
  return (
    asOf >= criterion.citation.next_review_at ||
    (record !== null && record !== undefined && asOf >= record.next_review_at)
  );
}

const shippedAuthorityContext: ProgramAuthorityContext = {
  registries: programAuthorityRegistries,
  blocks: new Map(),
  records: [],
};

/** A route-separated fact assessed once per statutory route (Phase 3B c). */
export interface ProgramStatutoryRouteAssessmentResult {
  fact_key: ProgramFactKey;
  /** True when at least one record's authority block names one of the routes. */
  routed: boolean;
  entries: ProgramRouteAuthorityInput[];
  /** YES when any route is established YES; NO when every route is established NO; otherwise null. */
  combined: KnownFactValue | null;
}

/**
 * Route-separated assessment (Phase 3B c, `statutory_routes_assessed_separately`).
 *
 * A record whose authority block names a route counts only toward that route;
 * every other record (no block, another basis, a City display) counts toward
 * every route, so it is still compared with each route's records. Records
 * joined by an explicit `conflicts_with` link are assessed together. Each
 * route is then assessed by the canonical evaluator, so records that
 * disagree within a route stay a Layer 1 conflict, and a YES on one route
 * and a NO on the other are two route results, not a conflict.
 *
 * With no routed record every route holds the same records, so each route's
 * assessment is the single-fact assessment and nothing changes.
 */
export function assessStatutoryRoutes(
  criterion: ProgramCriterion,
  factIndex: ProgramFactIndex,
  authorityContext: ProgramAuthorityContext = shippedAuthorityContext,
): ProgramStatutoryRouteAssessmentResult | null {
  const spec = criterion.statutory_routes;
  if (spec === undefined) return null;
  const whole = factIndex.get(spec.fact_key);
  if (whole === undefined) {
    throw new IntegrityValidationError(
      "PROGRAM_FACT_NOT_ASSESSED",
      `Criterion ${criterion.id} requires fact ${spec.fact_key}, which was not assessed.`,
    );
  }
  const records = authorityContext.records.filter((record) => record.claim.key === spec.fact_key);
  const routeOf = (id: string): FireHazardStatutoryRoute | null => {
    const qualifiers = authorityContext.blocks.get(id)?.qualifiers;
    if (qualifiers?.family !== "hazard_map") return null;
    return spec.routes.find((route) => route === qualifiers.statutory_basis) ?? null;
  };
  const routed = records.some((record) => routeOf(record.id) !== null);

  let entries: ProgramRouteAuthorityInput[];
  if (!routed) {
    const ids = new Set(records.map((record) => record.id));
    entries = spec.routes.map((route) => ({ route, assessment: whole, record_ids: ids }));
  } else {
    const wholeIds = whole.observations.map((observation) => observation.evidence_id).sort();
    const recordIds = records.map((record) => record.id).sort();
    if (JSON.stringify(wholeIds) !== JSON.stringify(recordIds)) {
      throw new IntegrityValidationError(
        "PROGRAM_ROUTE_RECORDS_MISMATCH",
        `Criterion ${criterion.id} needs the records behind ${spec.fact_key} to assess its statutory routes.`,
      );
    }
    entries = spec.routes.map((route) => {
      const members = new Set(
        records.filter((record) => [null, route].includes(routeOf(record.id))).map((record) => record.id),
      );
      for (let grew = true; grew; ) {
        grew = false;
        for (const record of records) {
          const linked = members.has(record.id)
            ? record.conflicts_with.filter((id) => !members.has(id))
            : record.conflicts_with.some((id) => members.has(id))
              ? [record.id]
              : [];
          for (const id of linked) {
            members.add(id);
            grew = true;
          }
        }
      }
      const [assessment] = assessProgramFacts(
        records.filter((record) => members.has(record.id)),
        [spec.fact_key],
      );
      return { route, assessment, record_ids: members };
    });
  }

  const values = entries.map(({ assessment }) =>
    isEstablishedFact(assessment) && assessment.normalized_value.kind === "boolean"
      ? assessment.normalized_value.value
      : null,
  );
  const combined: KnownFactValue | null = values.some((value) => value === true)
    ? { kind: "boolean", value: true }
    : values.every((value) => value === false)
      ? { kind: "boolean", value: false }
      : null;
  return { fact_key: spec.fact_key, routed, entries, combined };
}

/** Each route's assessment, labelled with its route, for statements and questions. */
function labelledRouteFacts(routes: ProgramStatutoryRouteAssessmentResult): ProgramFactAssessment[] {
  return routes.entries.map(({ route, assessment }) => ({
    ...assessment,
    label: `${assessment.label} (${statutoryRouteLabels[route]})`,
    statement: `Under the ${statutoryRouteLabels[route]}: ${assessment.statement}`,
  }));
}

/**
 * The facts a criterion's statement and question describe: the route
 * assessments in place of the route-separated fact when a record is routed
 * and the result is unknown or conflict; otherwise the facts it reads.
 */
export function criterionNarrativeFacts(
  facts: readonly ProgramFactAssessment[],
  routes: ProgramStatutoryRouteAssessmentResult | null,
  status: CriterionStatus,
): ProgramFactAssessment[] {
  if (routes === null || !routes.routed || (status !== "unknown" && status !== "conflict")) return [...facts];
  return [...facts.filter((fact) => fact.key !== routes.fact_key), ...labelledRouteFacts(routes)];
}

/**
 * Criterion status precedence:
 * 1. any required fact in conflict            -> conflict
 * 2. any required fact unknown / inference    -> unknown
 *    (a route-separated fact counts per statutory route instead: conflict on
 *    any route, else unknown unless a route is YES or every route is NO)
 * 3. professional judgment criterion          -> professional
 * 4. rule pending human or evidence unreviewed -> unreviewed
 * 5. enforced authority requirement not met   -> unknown
 * 6. pure predicate over reviewed, established facts
 *    (a predicate may itself return `requires_judgment` -> professional;
 *    an outcome outside `permitted_outcomes` is rejected)
 *
 * A predicate never runs on missing, conflicting, or unreviewed facts, and a
 * pending-human rule never runs at all. A criterion that needs human
 * verification (formerly pending, or marked human_verified) counts as
 * pending until it carries a complete human-verification record and, for an
 * atomic criterion, every promotion gate is met. Step 5 runs only after
 * steps 1-4 pass, so it can only turn a would-be result into `unknown`; it
 * never touches a conflict or an unknown fact. Without a context, the
 * shipped deny-by-default registries apply and every record is unattested.
 */
export function evaluateProgramCriterion(
  criterion: ProgramCriterion,
  factIndex: ProgramFactIndex,
  asOf: string,
  authorityContext: ProgramAuthorityContext = shippedAuthorityContext,
): ProgramCriterionResult {
  const facts = criterion.fact_keys.map((key) => {
    const fact = factIndex.get(key);
    if (!fact) {
      throw new IntegrityValidationError(
        "PROGRAM_FACT_NOT_ASSESSED",
        `Criterion ${criterion.id} requires fact ${key}, which was not assessed.`,
      );
    }
    return fact;
  });

  let status: CriterionStatus;
  const unreviewedReasons: UnreviewedReason[] = [];
  let authority: ProgramCriterionAuthorityResult | undefined;
  const routes = assessStatutoryRoutes(criterion, factIndex, authorityContext);
  // The route-separated fact is judged through its routes, never as one fact.
  const ruleFacts = routes === null ? facts : facts.filter((fact) => fact.key !== routes.fact_key);

  if (
    ruleFacts.some((fact) => fact.classification === "conflict") ||
    routes?.entries.some((entry) => entry.assessment.classification === "conflict")
  ) {
    status = "conflict";
  } else if (ruleFacts.some((fact) => !isEstablishedFact(fact)) || (routes !== null && routes.combined === null)) {
    status = "unknown";
  } else if (criterion.predicate === "professional_judgment") {
    status = "professional";
  } else {
    if (
      criterionAwaitsHumanVerification(criterion, authorityContext.registries) ||
      criterion.predicate === "not_encoded"
    ) {
      unreviewedReasons.push("criterion_pending_human");
    }
    if (facts.some((fact) => !fact.reviewed)) {
      unreviewedReasons.push("evidence_unreviewed");
    }

    const requirement = authorityContext.registries.criterion_requirements[criterion.id];
    if (
      unreviewedReasons.length === 0 &&
      typeof criterion.predicate === "function" &&
      requirement?.applicability === "enforced"
    ) {
      authority = evaluateCriterionAuthority({
        criterion,
        requirement,
        facts,
        context: authorityContext,
        asOf,
        ...(routes === null ? {} : { routes: { fact_key: routes.fact_key, entries: routes.entries } }),
      });
    }

    if (unreviewedReasons.length > 0 || typeof criterion.predicate !== "function") {
      status = "unreviewed";
    } else if (authority !== undefined && !authority.established) {
      status = "unknown";
    } else {
      const values: CriterionFactValues = Object.freeze(
        Object.fromEntries(
          facts.map((fact) => [
            fact.key,
            fact.key === routes?.fact_key ? (routes.combined as KnownFactValue) : (fact.normalized_value as KnownFactValue),
          ]),
        ),
      );
      const outcome = criterion.predicate(values);
      if (!predicateOutcomes.has(outcome)) {
        throw new IntegrityValidationError(
          "INVALID_PREDICATE_OUTCOME",
          `Criterion ${criterion.id} returned an unsupported outcome.`,
        );
      }
      // The criterion's outcome ceiling holds even for callers that skip pack
      // validation: a one-direction criterion can never return the other.
      if (!Array.isArray(criterion.permitted_outcomes) || !criterion.permitted_outcomes.includes(outcome)) {
        throw new IntegrityValidationError(
          "PREDICATE_OUTCOME_NOT_PERMITTED",
          `Criterion ${criterion.id} returned ${outcome}, which it does not permit.`,
        );
      }
      status = outcome === "requires_judgment" ? "professional" : outcome;
    }
  }

  return {
    criterion_id: criterion.id,
    pathway: criterion.pathway,
    label: criterion.label,
    gating: criterion.gating,
    verification: criterion.verification,
    rule_kind: typeof criterion.predicate === "function" ? "predicate" : criterion.predicate,
    rule_summary: criterion.rule_summary,
    status,
    classification: statusClassification(status),
    statement: criterionStatement({
      status,
      facts: criterionNarrativeFacts(facts, routes, status),
      unreviewedReasons,
      authority,
    }),
    unreviewed_reasons: unreviewedReasons,
    facts: facts.map((fact) => ({
      key: fact.key,
      classification: fact.classification,
      supplied: fact.supplied,
      reviewed: fact.reviewed,
      evidence_ids: fact.evidence.map((citation) => citation.evidence_id),
    })),
    citation: criterion.citation,
    stale: isCitationStale(criterion, asOf),
    confirmer: criterion.confirmer,
    // Appended only when the gate ran, so every other result is unchanged.
    ...(authority === undefined ? {} : { authority }),
    // Appended only when a record is routed; otherwise the routes are the single fact.
    ...(routes === null || !routes.routed ? {} : { statutory_routes: routeRefs(routes) }),
  };
}

function routeRefs(routes: ProgramStatutoryRouteAssessmentResult): ProgramCriterionRouteRef[] {
  return routes.entries.map(({ route, assessment }) => ({
    route,
    fact_key: routes.fact_key,
    classification: assessment.classification,
    supplied: assessment.supplied,
    reviewed: assessment.reviewed,
    value:
      isEstablishedFact(assessment) && assessment.normalized_value.kind === "boolean"
        ? assessment.normalized_value.value
        : null,
    evidence_ids: assessment.evidence.map((citation) => citation.evidence_id),
  }));
}

export interface ProgramPathwayRollupResult {
  rollup: PathwayRollup;
  anchored: boolean;
  decisive_criteria: string[];
  fact_conflict: boolean;
  /** Set only when an open completeness blocker held the roll-up at `undetermined`. */
  completeness_blockers?: string[];
}

function ids(results: readonly ProgramCriterionResult[]): string[] {
  return [...new Set(results.map((result) => result.criterion_id))];
}

/**
 * Pathway roll-up precedence:
 *   documented_disqualifier > contested > undetermined
 *   > no_disqualifier_found_in_reviewed_sources
 *
 * Gating criteria anchor the screen. Until every gating criterion is
 * consistent, only a gating criterion that documents a blocker (with all
 * earlier gating criteria consistent) can decide the pathway; otherwise the
 * result is contested or undetermined. A program-flag divergence counts as a
 * conflict. The pathway is never described as available or open.
 *
 * Completeness guard (Phase 3B G1, G2): while a pathway has an open
 * completeness blocker, a roll-up that would find no disqualifier is
 * `undetermined` instead. The guard is keyed to the pathway, not the pack, so
 * no pack can drop it.
 */
export function rollUpProgramPathway(
  results: readonly ProgramCriterionResult[],
  options: { flagDivergence: boolean } = { flagDivergence: false },
): ProgramPathwayRollupResult {
  if (results.length === 0) {
    throw new IntegrityValidationError(
      "EMPTY_PROGRAM_PATHWAY",
      "A pathway roll-up requires at least one criterion result.",
    );
  }
  const conflicts = results.filter((result) => result.status === "conflict");
  const factConflict = conflicts.length > 0;

  const gating = results.filter((result) => result.gating);
  for (const result of gating) {
    if (result.status === "consistent_with_source") continue;
    if (result.status === "disqualifying_per_source") {
      return {
        rollup: "documented_disqualifier",
        anchored: true,
        decisive_criteria: [result.criterion_id],
        fact_conflict: factConflict,
      };
    }
    break;
  }

  const unresolvedGating = gating.filter(
    (result) => result.status !== "consistent_with_source",
  );
  if (unresolvedGating.length > 0) {
    return {
      rollup: factConflict || options.flagDivergence ? "contested" : "undetermined",
      anchored: false,
      decisive_criteria: ids([...unresolvedGating, ...conflicts]),
      fact_conflict: factConflict,
    };
  }

  const disqualifiers = results.filter(
    (result) => result.status === "disqualifying_per_source",
  );
  if (disqualifiers.length > 0) {
    return {
      rollup: "documented_disqualifier",
      anchored: true,
      decisive_criteria: ids(disqualifiers),
      fact_conflict: factConflict,
    };
  }
  if (factConflict || options.flagDivergence) {
    return {
      rollup: "contested",
      anchored: true,
      decisive_criteria: ids(factConflict ? conflicts : results),
      fact_conflict: factConflict,
    };
  }
  const unresolved = results.filter(
    (result) =>
      result.status === "unknown" ||
      result.status === "professional" ||
      result.status === "unreviewed",
  );
  if (unresolved.length > 0) {
    return {
      rollup: "undetermined",
      anchored: true,
      decisive_criteria: ids(unresolved),
      fact_conflict: false,
    };
  }
  const pathway = results.find((result) => result.pathway !== undefined)?.pathway;
  const open = programPathwayCompletenessBlockers.filter(
    (blocker) => blocker.pathway === pathway && blocker.status === "open",
  );
  if (open.length > 0) {
    const related = results.filter((result) => open.some((blocker) => blocker.related_criterion_id === result.criterion_id));
    return {
      rollup: "undetermined",
      anchored: true,
      decisive_criteria: ids(related.length > 0 ? related : results),
      fact_conflict: false,
      completeness_blockers: open.map((blocker) => blocker.id),
    };
  }
  return {
    rollup: "no_disqualifier_found_in_reviewed_sources",
    anchored: true,
    decisive_criteria: ids(results),
    fact_conflict: false,
  };
}

/**
 * ZIMAS program fields are observations only. They never feed a criterion
 * and never settle a pathway; they are compared with the criteria-based
 * roll-up so a disagreement stays visible.
 */
export function crosscheckProgramFlag(
  fact: ProgramFactAssessment,
  rollup: PathwayRollup,
): ProgramFlagResult {
  const spec = programFactSpecs[fact.key].flag;
  if (spec === null) {
    throw new IntegrityValidationError(
      "NOT_A_PROGRAM_FLAG",
      `${fact.key} is not a program flag.`,
    );
  }

  let signal: ProgramFlagSignal = "no_signal";
  let crosscheck: ProgramFlagCrosscheck;
  if (!fact.supplied || fact.classification === "unknown" || fact.classification === "inference") {
    crosscheck = "not_observed";
  } else if (fact.classification === "conflict") {
    crosscheck = "flag_sources_conflict";
  } else if (fact.normalized_value.kind === "boolean") {
    signal = fact.normalized_value.value ? spec.signal_when_true : spec.signal_when_false;
    if (signal === "indicates_no_blocker" && rollup === "documented_disqualifier") {
      crosscheck = "diverges_from_criteria";
    } else if (
      signal === "indicates_blocker" &&
      rollup === "no_disqualifier_found_in_reviewed_sources"
    ) {
      crosscheck = "diverges_from_criteria";
    } else if (
      signal === "indicates_blocker" &&
      (rollup === "undetermined" || rollup === "contested")
    ) {
      crosscheck = "not_explained_by_criteria";
    } else {
      crosscheck = "no_divergence";
    }
  } else {
    crosscheck = "recorded_only";
  }

  const observations = fact.evidence.map((citation) => ({
    evidence_id: citation.evidence_id,
    observed_display_value:
      fact.observations.find((observation) => observation.evidence_id === citation.evidence_id)
        ?.observed_display_value ?? "NOT OBSERVED",
    source_agency: citation.source_agency,
    source_title: citation.source_title,
    source_url: citation.source_url,
    retrieved_at: citation.retrieved_at,
  }));

  return {
    fact_key: fact.key,
    label: fact.label,
    treated_as: "observation_only",
    classification: fact.classification,
    observations,
    signal,
    crosscheck,
    statement: flagStatement({
      label: fact.label,
      displays: observations.map((observation) => observation.observed_display_value),
      crosscheck,
    }),
  };
}

function sourceQuotations(
  facts: readonly ProgramFactAssessment[],
  packs: readonly ProgramPathwayPack[],
): Set<string> {
  const quotations = new Set<string>();
  for (const fact of facts) {
    for (const citation of fact.evidence) {
      quotations.add(citation.source_title);
      quotations.add(citation.source_agency);
    }
    for (const observation of fact.observations) {
      quotations.add(observation.observed_display_value);
    }
  }
  for (const pack of packs) {
    for (const criterion of pack.criteria) quotations.add(criterion.citation.title);
  }
  return quotations;
}

function languageBlockers(
  pathway: ProgramPathwayResult["pathway"] | null,
  texts: ReadonlyArray<readonly [string, string]>,
  quotations: ReadonlySet<string>,
): ReleaseBlocker[] {
  return texts.flatMap(([ref, text]) =>
    findProhibitedClientLanguage(text, quotations).map((label) => ({
      code: "prohibited_language" as const,
      pathway,
      ref,
      detail: `Generated client-facing text contains a prohibited ${label}.`,
    })),
  );
}

function evaluatePathway(
  pack: ProgramPathwayPack,
  factIndex: ProgramFactIndex,
  asOf: string,
  quotations: ReadonlySet<string>,
  authorityContext: ProgramAuthorityContext,
): ProgramPathwayResult {
  const { pathway, criteria } = pack;
  const results = criteria.map((criterion) =>
    evaluateProgramCriterion(criterion, factIndex, asOf, authorityContext),
  );

  const flagFacts = programFlagKeysFor(pathway.id).map((key) => {
    const fact = factIndex.get(key);
    if (!fact) {
      throw new IntegrityValidationError(
        "PROGRAM_FACT_NOT_ASSESSED",
        `Program flag ${key} was not assessed.`,
      );
    }
    return fact;
  });
  const base = rollUpProgramPathway(results);
  // A flag is compared with what the criteria found. The completeness guard
  // holds a clear result at undetermined, but a display that points to a
  // blocker still diverges from the criteria and escalates to contested.
  const criteriaRollup = base.completeness_blockers === undefined ? base.rollup : "no_disqualifier_found_in_reviewed_sources";
  const flags = flagFacts.map((fact) => crosscheckProgramFlag(fact, criteriaRollup));
  const flagDivergence = flags.some((flag) => flag.crosscheck === "diverges_from_criteria");
  const final = flagDivergence ? rollUpProgramPathway(results, { flagDivergence }) : base;

  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const decisive = final.decisive_criteria.map((id) => criteriaById.get(id) as ProgramCriterion);

  const questions: ProgramQuestion[] = [];
  criteria.forEach((criterion, index) => {
    const facts = criterion.fact_keys.map((key) => factIndex.get(key) as ProgramFactAssessment);
    const routes = assessStatutoryRoutes(criterion, factIndex, authorityContext);
    const question = buildCriterionQuestion(
      criterion,
      results[index],
      criterionNarrativeFacts(facts, routes, results[index].status),
    );
    if (question) questions.push(question);
  });
  flags.forEach((flag, index) => {
    const question = buildFlagQuestion({
      pathway,
      flag,
      flagFact: flagFacts[index],
      decisive,
      documentedBlocker: final.rollup === "documented_disqualifier",
    });
    if (question) questions.push(question);
  });

  const reviewTasks = buildReviewTasks({
    pathway,
    criteria,
    results,
    facts: factIndex,
    flags,
    registries: authorityContext.registries,
  });

  const statement = pathwayStatement({
    rollup: final.rollup,
    anchored: final.anchored,
    factConflict: final.fact_conflict,
    flagDivergence,
    confirmer: pathway.confirmer,
    completenessBlocked: final.completeness_blockers !== undefined,
  });

  const blockers: ReleaseBlocker[] = [];
  criteria.forEach((criterion, index) => {
    if (criterionAwaitsHumanVerification(criterion, authorityContext.registries)) {
      blockers.push({
        code: "pending_human_criterion",
        pathway: pathway.id,
        ref: criterion.id,
        detail: "The criterion's rule awaits PermitPulse reviewer verification.",
      });
    }
    if (results[index].stale) {
      blockers.push({
        code: "stale_criterion",
        pathway: pathway.id,
        ref: criterion.id,
        detail: `The criterion citation was due for review on ${criterion.citation.next_review_at}.`,
      });
    }
  });
  const unreviewedGatingFacts = new Set<ProgramFactKey>();
  for (const criterion of criteria.filter((candidate) => candidate.gating)) {
    for (const key of criterion.fact_keys) {
      if (!factIndex.get(key)?.reviewed) unreviewedGatingFacts.add(key);
    }
  }
  for (const key of unreviewedGatingFacts) {
    blockers.push({
      code: "unreviewed_gating_fact",
      pathway: pathway.id,
      ref: key,
      detail: "A gating fact lacks completed human review.",
    });
  }
  for (const flag of flags.filter((candidate) => candidate.crosscheck === "diverges_from_criteria")) {
    blockers.push({
      code: "program_flag_divergence",
      pathway: pathway.id,
      ref: flag.fact_key,
      detail: "A program display disagrees with the criteria-based result and needs human resolution.",
    });
  }

  const texts: Array<readonly [string, string]> = [
    [`${pathway.id}.label`, pathway.label],
    [`${pathway.id}.statement`, statement],
    ...results.flatMap((result) => [
      [`${result.criterion_id}.label`, result.label] as const,
      [`${result.criterion_id}.rule_summary`, result.rule_summary] as const,
      [`${result.criterion_id}.statement`, result.statement] as const,
    ]),
    ...criteria.flatMap((criterion) => [
      [`${criterion.id}.question_if_unknown`, criterion.question_if_unknown] as const,
      [`${criterion.id}.question_if_conflict`, criterion.question_if_conflict] as const,
      ...(criterion.question_if_judgment === null
        ? []
        : [[`${criterion.id}.question_if_judgment`, criterion.question_if_judgment] as const]),
    ]),
    ...flags.map((flag) => [`${pathway.id}.${flag.fact_key}.statement`, flag.statement] as const),
    ...questions.flatMap((question) => [
      [`${question.id}.question`, question.question] as const,
      [`${question.id}.why`, question.why_confirmation_needed] as const,
    ]),
    ...reviewTasks.map((task) => [`${task.id}.instruction`, task.instruction] as const),
  ];
  blockers.push(...languageBlockers(pathway.id, texts, quotations));

  return {
    pathway: pathway.id,
    label: pathway.label,
    rollup: final.rollup,
    classification: rollupClassification(final.rollup),
    statement,
    anchored: final.anchored,
    decisive_criteria: final.decisive_criteria,
    criteria: results,
    program_flags: flags,
    planning_questions: questions,
    review_tasks: reviewTasks,
    release: { client_releasable: blockers.length === 0, blockers },
    ...(final.completeness_blockers === undefined ? {} : { open_completeness_blockers: final.completeness_blockers }),
  };
}

function stableScreenId(seed: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of seed) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `program-screen-${hash.toString(16).padStart(16, "0")}`;
}

function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

export interface ProgramScreenInput {
  evidence_records: unknown;
  /** Evaluation date (YYYY-MM-DD). Required: the core never reads a clock. */
  as_of: string;
  packs?: readonly ProgramPathwayPack[];
  /**
   * Evidence-authority sidecar: blocks keyed by evidence_id. Omitted, every
   * record is unattested. Malformed or falsely linked blocks throw.
   */
  evidence_authority?: unknown;
  /**
   * TEST-ONLY registries, passed like `packs`. Omitted, the shipped
   * deny-by-default registries apply.
   */
  authority_registries?: ProgramAuthorityRegistries;
  /**
   * Phase 3E: verified lot geometries and overlay dataset views, from their
   * loaders. The authority gate computes every lot overlay from them. Omitted,
   * no overlay can be computed and no hazard record establishes anything.
   */
  lot_overlay?: ProgramLotOverlayInputs;
}

/** Refuses any overlay input that did not come from its verifying loader. */
function parseLotOverlayInputs(value: ProgramLotOverlayInputs | undefined): ProgramLotOverlayInputs | undefined {
  if (value === undefined) return undefined;
  if (!value.datasets.every(isVerifiedOverlayDatasetView) || !value.lot_geometries.every(isVerifiedLotGeometry)) {
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_LOT_OVERLAY",
      "Lot overlay inputs must come from loadOverlayDatasetView and loadReviewedLotGeometry; typed values are never accepted.",
    );
  }
  return value;
}

/**
 * Deterministic LA Parcel Program Screen. Same input, same output: no clock,
 * network, randomness, or AI. Result ordering follows declared fact, pathway,
 * and criterion order.
 */
export function evaluateProgramScreen(input: ProgramScreenInput): ProgramScreenResult {
  if (!programIsoDateSchema.safeParse(input.as_of).success) {
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_SCREEN_DATE",
      "The Program Screen requires an explicit as_of date (YYYY-MM-DD).",
    );
  }
  const records = parseProgramScreenEvidence(input.evidence_records);
  const packs = parseProgramPathwayPacks(input.packs ?? programScreenPathwayPacks);
  const registries = parseProgramAuthorityRegistries(
    input.authority_registries ?? programAuthorityRegistries,
  );
  const blocks = parseProgramEvidenceAuthority(input.evidence_authority, records);
  const overlay = parseLotOverlayInputs(input.lot_overlay);
  const authorityContext: ProgramAuthorityContext = { registries, blocks, records, ...(overlay === undefined ? {} : { overlay }) };

  const keys = new Set<ProgramFactKey>();
  for (const pack of packs) {
    for (const criterion of pack.criteria) criterion.fact_keys.forEach((key) => keys.add(key));
    programFlagKeysFor(pack.pathway.id).forEach((key) => keys.add(key));
  }
  const facts = assessProgramFacts(records, keys);
  const factIndex: ProgramFactIndex = new Map(facts.map((fact) => [fact.key, fact]));
  const quotations = sourceQuotations(facts, packs);

  const pathways = packs.map((pack) =>
    evaluatePathway(pack, factIndex, input.as_of, quotations, authorityContext),
  );

  const factLanguageBlockers: ReleaseBlocker[] = facts.flatMap((fact) =>
    findProhibitedFactStatementLanguage(fact).map((label) => ({
      code: "prohibited_language" as const,
      pathway: null,
      ref: `fact.${fact.key}.statement`,
      detail: `Generated client-facing text contains a prohibited ${label}.`,
    })),
  );
  const blockers = [
    ...pathways.flatMap((pathway) => pathway.release.blockers),
    ...factLanguageBlockers,
  ];

  const counts = {
    facts: zeroCounts([
      "verified_fact",
      "source_observation",
      "inference",
      "unknown",
      "conflict",
    ] as const),
    criteria: zeroCounts(criterionStatuses),
    pathways: zeroCounts(pathwayRollups),
  };
  facts.forEach((fact) => (counts.facts[fact.classification] += 1));
  pathways.forEach((pathway) => {
    counts.pathways[pathway.rollup] += 1;
    pathway.criteria.forEach((criterion) => (counts.criteria[criterion.status] += 1));
  });

  const subject = records[0].subject;
  const seedParts: unknown[] = [
    subject,
    input.as_of,
    records.map((record) => record.id).sort(),
    packs.flatMap((pack) => pack.criteria.map((criterion) => criterion.id)),
  ];
  // Authority inputs join the seed only when supplied, so a screen without
  // them keeps its existing ID.
  if (blocks.size > 0 || input.authority_registries !== undefined) {
    seedParts.push([
      [...blocks.values()].sort((left, right) => left.evidence_id.localeCompare(right.evidence_id)),
      input.authority_registries ?? null,
    ]);
  }
  // Overlay inputs join it the same way, by what pins them.
  if (overlay !== undefined) {
    seedParts.push([
      overlay.datasets.map((view) => [view.dataset, view.index_sha256, view.recordNumbers()]),
      overlay.lot_geometries.map((lot) => [lot.file_id, lot.sha256]),
      overlay.index_pins ?? null,
    ]);
  }
  const screenSeed = JSON.stringify(seedParts);

  return {
    schema_version: PROGRAM_SCREEN_SCHEMA_VERSION,
    screen_id: stableScreenId(screenSeed),
    screen_scope: PROGRAM_SCREEN_SCOPE,
    subject,
    as_of: input.as_of,
    facts,
    pathways,
    planning_questions: pathways.flatMap((pathway) => pathway.planning_questions),
    review_tasks: pathways.flatMap((pathway) => pathway.review_tasks),
    release: { client_releasable: blockers.length === 0, blockers },
    counts,
  };
}
