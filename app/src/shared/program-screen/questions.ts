import { quote } from "./language";
import type {
  ProgramCriterion,
  ProgramCriterionResult,
  ProgramFactAssessment,
  ProgramFactKey,
  ProgramFlagResult,
  ProgramPathwayDefinition,
  ProgramQuestion,
  ProgramQuestionSource,
  ProgramReviewTask,
} from "./types";

/**
 * Deterministic question composition. Question text comes from the
 * criterion's authored template; the reason text is a fixed template filled
 * with canonical fact statements and quoted source metadata. No free prose.
 */

function questionSources(facts: readonly ProgramFactAssessment[]): ProgramQuestionSource[] {
  return facts.flatMap((fact) =>
    fact.evidence.map((citation) => ({
      evidence_id: citation.evidence_id,
      fact_key: fact.key,
      source_agency: citation.source_agency,
      source_title: citation.source_title,
      source_url: citation.source_url,
      retrieved_at: citation.retrieved_at,
      observed_display_value:
        fact.observations.find((observation) => observation.evidence_id === citation.evidence_id)
          ?.observed_display_value ?? "NOT OBSERVED",
    })),
  );
}

function recordedValues(sources: readonly ProgramQuestionSource[]): string {
  return sources
    .map(
      (source) =>
        `${quote(source.observed_display_value)} per ${quote(source.source_agency)} (${quote(source.source_title)})`,
    )
    .join("; ");
}

function criterionCitation(criterion: ProgramCriterion) {
  return {
    criterion_id: criterion.id,
    title: criterion.citation.title,
    url: criterion.citation.url,
    pinpoint: criterion.citation.pinpoint,
  };
}

export function buildCriterionQuestion(
  criterion: ProgramCriterion,
  result: ProgramCriterionResult,
  facts: readonly ProgramFactAssessment[],
): ProgramQuestion | null {
  const base = {
    id: `${criterion.pathway}:${criterion.id}:${result.status}`,
    pathway: criterion.pathway,
    criterion_ids: [criterion.id],
    directed_to: criterion.confirmer,
    citations: [criterionCitation(criterion)],
  };

  if (result.status === "conflict") {
    const conflicting = facts.filter((fact) => fact.classification === "conflict");
    const sources = questionSources(conflicting);
    return {
      ...base,
      trigger: "conflict",
      question: criterion.question_if_conflict,
      why_confirmation_needed: `${conflicting.map((fact) => fact.statement).join(" ")} Recorded values: ${recordedValues(sources)}. PermitPulse keeps every record and does not choose between sources; ${criterion.confirmer} must confirm which governs.`,
      sources,
    };
  }

  if (result.status === "unknown") {
    const missing = facts.filter(
      (fact) =>
        fact.classification !== "verified_fact" &&
        fact.classification !== "source_observation",
    );
    const sources = questionSources(missing);
    const consulted =
      sources.length > 0
        ? `Consulted: ${sources
            .map((source) => `${quote(source.source_title)} (${quote(source.source_agency)})`)
            .join("; ")}.`
        : "No source record was supplied.";
    return {
      ...base,
      trigger: "unknown",
      question: criterion.question_if_unknown,
      why_confirmation_needed: `${missing.map((fact) => fact.statement).join(" ")} ${consulted} Missing or incomplete evidence is not treated as a no.`,
      sources,
    };
  }

  if (result.status === "professional" && criterion.question_if_judgment !== null) {
    return {
      ...base,
      trigger: "professional",
      question: criterion.question_if_judgment,
      why_confirmation_needed: `The cited source (${quote(criterion.citation.title)}, ${criterion.citation.pinpoint}) leaves this determination to agency or professional judgment; PermitPulse does not make it.`,
      sources: questionSources(facts),
    };
  }

  return null;
}

export function buildFlagQuestion(input: {
  pathway: ProgramPathwayDefinition;
  flag: ProgramFlagResult;
  flagFact: ProgramFactAssessment;
  decisive: readonly ProgramCriterion[];
  documentedBlocker: boolean;
}): ProgramQuestion | null {
  const { pathway, flag, flagFact, decisive } = input;
  const shown = flag.observations.map((observation) => quote(observation.observed_display_value)).join(" and ");
  const base = {
    pathway: pathway.id,
    criterion_ids: decisive.map((criterion) => criterion.id),
    directed_to: pathway.confirmer,
    citations: decisive.map(criterionCitation),
    sources: questionSources([flagFact]),
  };

  if (flag.crosscheck === "diverges_from_criteria") {
    return {
      ...base,
      id: `${pathway.id}:${flag.fact_key}:program_flag_divergence`,
      trigger: "program_flag_divergence",
      question: input.documentedBlocker
        ? `${flag.label} for this parcel was recorded as ${shown}, while the reviewed record documents a condition treated as blocking under: ${decisive.map((criterion) => criterion.label).join("; ")}. Which record governs for this parcel?`
        : `${flag.label} for this parcel was recorded as ${shown}, but the reviewed criteria documented no blocking condition. Which condition does the display reflect, and which record governs?`,
      why_confirmation_needed:
        "A ZIMAS program display is an observation, not a determination. It disagrees with the criteria-based result, and PermitPulse does not resolve that disagreement.",
    };
  }

  if (flag.crosscheck === "not_explained_by_criteria") {
    return {
      ...base,
      id: `${pathway.id}:${flag.fact_key}:program_flag_unexplained`,
      trigger: "program_flag_unexplained",
      question: `${flag.label} for this parcel was recorded as ${shown}. Which condition and record does this display reflect?`,
      why_confirmation_needed:
        "The display may reflect a condition the reviewed criteria have not captured; PermitPulse does not infer that condition from the display.",
    };
  }

  if (flag.crosscheck === "flag_sources_conflict") {
    return {
      ...base,
      id: `${pathway.id}:${flag.fact_key}:program_flag_conflict`,
      trigger: "program_flag_conflict",
      question: `Sources disagree on ${flag.label} for this parcel. Which display or record governs?`,
      why_confirmation_needed:
        "Official displays disagree; PermitPulse keeps both and does not choose between them.",
    };
  }

  return null;
}

export function buildReviewTasks(input: {
  pathway: ProgramPathwayDefinition;
  criteria: readonly ProgramCriterion[];
  results: readonly ProgramCriterionResult[];
  facts: ReadonlyMap<ProgramFactKey, ProgramFactAssessment>;
  flags: readonly ProgramFlagResult[];
}): ProgramReviewTask[] {
  const pathway = input.pathway.id;
  const tasks: ProgramReviewTask[] = [];

  input.criteria.forEach((criterion, index) => {
    const result = input.results[index];
    if (criterion.verification === "pending_human") {
      tasks.push({
        id: `${pathway}:verify_criterion_rule:${criterion.id}`,
        pathway,
        kind: "verify_criterion_rule",
        criterion_id: criterion.id,
        fact_key: null,
        instruction: `Verify the rule for this criterion against ${quote(criterion.citation.title)}, ${criterion.citation.pinpoint}, and record the verification before any client conclusion.`,
      });
    }
    if (result.stale) {
      tasks.push({
        id: `${pathway}:reverify_stale_citation:${criterion.id}`,
        pathway,
        kind: "reverify_stale_citation",
        criterion_id: criterion.id,
        fact_key: null,
        instruction: `Reopen ${quote(criterion.citation.title)} and reverify ${criterion.citation.pinpoint}; the citation was due for review on ${criterion.citation.next_review_at}.`,
      });
    }
  });

  const referenced = new Set(input.criteria.flatMap((criterion) => criterion.fact_keys));
  for (const [key, fact] of input.facts) {
    if (!referenced.has(key) || !fact.supplied || fact.reviewed) continue;
    tasks.push({
      id: `${pathway}:review_evidence:${key}`,
      pathway,
      kind: "review_evidence",
      criterion_id: null,
      fact_key: key,
      instruction: `Review the evidence records for ${fact.label} (${fact.evidence
        .map((citation) => citation.evidence_id)
        .join(", ")}) before relying on them.`,
    });
  }

  for (const flag of input.flags) {
    if (flag.crosscheck !== "not_observed") continue;
    tasks.push({
      id: `${pathway}:record_program_flag:${flag.fact_key}`,
      pathway,
      kind: "record_program_flag",
      criterion_id: null,
      fact_key: flag.fact_key,
      instruction: `Record ${flag.label} exactly as displayed for the matched parcel, including an absent or unclear result.`,
    });
  }

  return tasks;
}
