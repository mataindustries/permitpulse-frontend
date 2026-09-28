import { z } from "zod";
import {
  canSupportCriterionRule,
  excerptAppearsInCapture,
  locateExcerptPages,
  type OfficialSourceMetadata,
} from "./source-capture";
import {
  criterionPromotionGates,
  humanVerificationRequiredCriterionIds,
  predicateOutcomes,
  programFactDataClasses,
  programFactKeys,
  retiredProgramCriterionIds,
  retiredProgramFactKeys,
  type OfficialSourceType,
  type PredicateOutcome,
} from "./types";

/**
 * Verification preparation, not verification.
 *
 * A proposed verification record is a target prepared for a human reviewer:
 * the criterion, the official source to read, a candidate pinpoint and
 * excerpt, the question the reviewer must answer, and the rule that would be
 * encoded if the reviewer agrees. It is never a human verification record:
 * `reviewer` and `reviewed_at` are always null, and the production schema
 * rejects it. The evaluator never imports this module or reads
 * `app/fixtures/program-screen/proposed-verifications/`; a test enforces both.
 *
 * Since 2026-09-27 each proposal is the source review of one retired broad
 * criterion, and each of its components is one shipped atomic criterion (or a
 * documented removal). Only a later change, made after a named human reviewer
 * approves a component, may convert that atomic criterion to `human_verified`.
 */
export const PROPOSED_VERIFICATION_DIR = "app/fixtures/program-screen/proposed-verifications/";

export interface ExpectedOfficialSource {
  source_id: string;
  title: string;
  /** Null until the exact document URL is recorded at capture. */
  official_url: string | null;
  source_type: OfficialSourceType;
  may_change_source_ids: readonly string[];
  role: string;
}

/**
 * The official documents this verification pass needs. A capture under
 * `official-sources/` must match one of these entries, so an adopted
 * ordinance and a draft can never trade places. URLs are the ones the
 * repository already cites; confirm each at download.
 */
export const expectedOfficialSources: readonly ExpectedOfficialSource[] = [
  {
    source_id: "ordinance-188967",
    title: "City of Los Angeles Ordinance No. 188967 (Low-Rise Ordinance)",
    official_url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S3_ord_188967_06-30-26.pdf",
    source_type: "adopted_ordinance",
    may_change_source_ids: [],
    role: "Operative source for the Low-Rise atomic criteria.",
  },
  {
    source_id: "ordinance-188968",
    title: "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)",
    official_url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf",
    source_type: "adopted_ordinance",
    may_change_source_ids: [],
    role: "Operative source for the SB 79 permanent- and temporary-exemption atomic criteria.",
  },
  {
    source_id: "shra-2025-10-28",
    title:
      "Implementation of Senate Bills 1123 (2024) and 684 (2023) and Assembly Bill 130 (2025) - Starter Home Revitalization Act (interdepartmental memorandum, October 28, 2025)",
    official_url:
      "https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf",
    source_type: "official_memo",
    may_change_source_ids: [],
    role: "City implementation guidance for the SHRA atomic criteria.",
  },
  {
    source_id: "low-rise-draft-2026-09-24",
    title: "Council File 25-1083-S3: September 24, 2026 draft Low-Rise Ordinance (proposed)",
    official_url: null,
    source_type: "proposed_draft",
    may_change_source_ids: ["ordinance-188967"],
    role: "Proposed change only. It can prompt a human re-review; it cannot support a rule.",
  },
];

/**
 * Every reason a capture under official-sources/ does not match its expected
 * entry. An adopted ordinance and a draft can never trade source IDs.
 */
export function expectedSourceIssues(metadata: OfficialSourceMetadata): string[] {
  const expected = expectedOfficialSources.find((source) => source.source_id === metadata.source_id);
  if (expected === undefined) {
    return [`${metadata.source_id} is not an expected official source; register it first.`];
  }
  const issues: string[] = [];
  if (metadata.test_only) issues.push("A test-only capture cannot sit in official-sources/.");
  if (metadata.source_type !== expected.source_type) {
    issues.push(
      `${metadata.source_id} must be recorded as ${expected.source_type}, not ${metadata.source_type}.`,
    );
  }
  if (expected.official_url !== null && metadata.official_url !== expected.official_url) {
    issues.push(`${metadata.source_id} must come from ${expected.official_url}.`);
  }
  const changes = [...metadata.may_change_source_ids].sort().join(",");
  if (changes !== [...expected.may_change_source_ids].sort().join(",")) {
    issues.push(
      `${metadata.source_id} must record may_change_source_ids [${expected.may_change_source_ids.join(", ")}].`,
    );
  }
  return issues;
}

export const proposedVerificationStatuses = [
  "awaiting_source_capture",
  "awaiting_human_review",
] as const;

/**
 * What the preparer thinks one part of a source review could become. The
 * human reviewer decides; none of these runs anything.
 * - `deterministic_candidate`: both outcomes could be encoded once the named
 *   facts are controlled and human-recorded.
 * - `partially_deterministic`: only one direction is safe; the other must
 *   stay unknown or judgment.
 * - `interpretation_unresolved`: the source's reading must first be resolved
 *   (and reconciled with other official sources); only judgment is safe.
 * - `professional_judgment`: must stay a Planning judgment.
 * - `no_rule_in_source`: the source states no such rule; the fact was removed.
 * - `outside_screen`: the source states a condition the parcel screen does not
 *   evaluate (a project or application condition); no criterion ships.
 */
export const proposedComponentDispositions = [
  "deterministic_candidate",
  "partially_deterministic",
  "interpretation_unresolved",
  "professional_judgment",
  "no_rule_in_source",
  "outside_screen",
] as const;

/** Dispositions that correspond to a shipped atomic criterion. */
export const shippedComponentDispositions = [
  "deterministic_candidate",
  "partially_deterministic",
  "interpretation_unresolved",
  "professional_judgment",
] as const;

export const PROPOSAL_SCHEMA_VERSION = "program-screen-proposal-v2" as const;

const nonEmptyText = z.string().trim().min(1).max(1200);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest.");
const expectedIds = new Map(expectedOfficialSources.map((source) => [source.source_id, source]));
const atomicCriterionIds = new Set<string>(humanVerificationRequiredCriterionIds);
const shipped = new Set<string>(shippedComponentDispositions);
/** Current and retired fact keys: a proposal may name either when it records a removal. */
const anyFactKey = z.enum([...programFactKeys, ...retiredProgramFactKeys]);

/**
 * One part of a retired criterion as the source text divides it. A shipped
 * component's ID is the atomic criterion that now carries it; the tests
 * require its label, pinpoint, facts, and excerpts to match that criterion.
 */
export const proposedComponentSchema = z
  .object({
    component_id: z
      .string()
      .regex(/^la_(?:shra|sb79|low_rise)\.[a-z0-9]+(?:-[a-z0-9]+)*$/, "Component IDs are <pathway>.<kebab-slug>."),
    label: nonEmptyText,
    pinpoint: nonEmptyText,
    /** Each excerpt must appear, whitespace-normalized, on its page of the capture. */
    excerpts: z
      .array(z.object({ page: z.number().int().positive(), text: nonEmptyText }).strict())
      .min(1),
    disposition: z.enum(proposedComponentDispositions),
    /** The shipped criterion's facts, exactly; empty for a removal or an unscreened condition. */
    reads_existing_fact_keys: z.array(z.enum(programFactKeys)),
    /** Facts this component removed from the retired criterion (no_rule_in_source only). */
    removed_fact_keys: z.array(anyFactKey),
    /** Facts still not modeled that a deterministic rule would need. */
    new_facts_needed: z.array(nonEmptyText),
    controlled_value_encoding: nonEmptyText,
    proposed_rule_if_reviewer_agrees: nonEmptyText.nullable(),
    judgment_or_ambiguity: z.array(nonEmptyText),
    /** The specific question a named human reviewer must answer for this component. */
    reviewer_question: nonEmptyText.refine((value) => value.includes("?"), "A reviewer question asks something."),
  })
  .strict()
  .superRefine((component, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    const deterministic =
      component.disposition === "deterministic_candidate" ||
      component.disposition === "partially_deterministic";
    if (deterministic && component.proposed_rule_if_reviewer_agrees === null) {
      issue("proposed_rule_if_reviewer_agrees", "A deterministic candidate needs a proposed rule.");
    }
    if (!deterministic && component.proposed_rule_if_reviewer_agrees !== null) {
      issue("proposed_rule_if_reviewer_agrees", "Only a deterministic candidate proposes a rule.");
    }
    if (component.disposition !== "deterministic_candidate" && component.judgment_or_ambiguity.length === 0) {
      issue("judgment_or_ambiguity", "Say why this component is not fully deterministic.");
    }
    const isShipped = shipped.has(component.disposition);
    if (isShipped && !atomicCriterionIds.has(component.component_id)) {
      issue("component_id", `${component.component_id} is not a shipped atomic criterion.`);
    }
    if (!isShipped && atomicCriterionIds.has(component.component_id)) {
      issue("component_id", `${component.component_id} is shipped; it cannot be recorded as ${component.disposition}.`);
    }
    if (!isShipped && component.reads_existing_fact_keys.length > 0) {
      issue("reads_existing_fact_keys", "A removal or an unscreened condition reads no fact.");
    }
    if (component.disposition !== "no_rule_in_source" && component.removed_fact_keys.length > 0) {
      issue("removed_fact_keys", "Only a no-rule component records removed facts.");
    }
  });

export type ProposedComponent = z.infer<typeof proposedComponentSchema>;

export const proposedVerificationSchema = z
  .object({
    record_kind: z.literal("proposed_verification"),
    schema_version: z.literal(PROPOSAL_SCHEMA_VERSION),
    /** The broad criterion this source review split; it can never ship again. */
    retired_criterion_id: z.enum(retiredProgramCriterionIds),
    source_id: z.string(),
    /** Other official documents the reviewer may also need to read. */
    additional_sources_needed: z.array(nonEmptyText),
    /** Drafts that would change the source: re-review triggers only. */
    related_draft_source_ids: z.array(z.string()),
    /** `sha256_extracted` of the capture the excerpt was taken from. */
    source_sha256: hex64.nullable(),
    candidate_page: z.number().int().positive().nullable(),
    candidate_pinpoint: nonEmptyText.nullable(),
    candidate_excerpt: nonEmptyText.nullable(),
    /** Where to look in the source. */
    locate_in_source: nonEmptyText,
    /** Whether the reviewer accepts the split as a whole; each component has its own question. */
    question_for_human_reviewer: nonEmptyText,
    proposed_controlled_interpretation: z
      .object({
        /** The retired criterion's facts, some of them now retired keys. */
        fact_keys_before_split: z.array(anyFactKey).min(1),
        controlled_values_required: nonEmptyText,
        fact_narrowing_required: z.boolean(),
        narrowing_note: nonEmptyText.nullable(),
        predicate_shape_if_reviewer_agrees: nonEmptyText,
        must_remain_unresolved_when: z.array(nonEmptyText).min(1),
        zimas_conflict_risk: nonEmptyText,
      })
      .strict(),
    /** The retired criterion as the source divides it; empty until the source is captured. */
    candidate_components: z.array(proposedComponentSchema),
    reviewer: z.null({ error: "A proposal never names a reviewer; human approval happens outside it." }),
    reviewed_at: z.null({ error: "A proposal is never marked reviewed." }),
    status: z.enum(proposedVerificationStatuses),
  })
  .strict()
  .superRefine((proposal, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    const source = expectedIds.get(proposal.source_id);
    if (source === undefined) {
      issue("source_id", "A proposal must cite an expected official source.");
    } else if (source.source_type === "proposed_draft") {
      issue("source_id", "A proposal cannot rest on a proposed draft.");
    }
    for (const id of proposal.related_draft_source_ids) {
      if (expectedIds.get(id)?.source_type !== "proposed_draft") {
        issue("related_draft_source_ids", `${id} is not an expected proposed draft.`);
      }
    }
    const interpretation = proposal.proposed_controlled_interpretation;
    if (interpretation.fact_narrowing_required !== (interpretation.narrowing_note !== null)) {
      issue("proposed_controlled_interpretation", "A narrowing note is required exactly when narrowing is required.");
    }
    const candidate = [
      proposal.source_sha256,
      proposal.candidate_page,
      proposal.candidate_pinpoint,
      proposal.candidate_excerpt,
    ];
    if (proposal.status === "awaiting_source_capture" && candidate.some((value) => value !== null)) {
      issue("status", "Without a capture, a proposal has no source hash, page, pinpoint, or excerpt.");
    }
    if (proposal.status === "awaiting_human_review" && candidate.some((value) => value === null)) {
      issue("status", "A proposal awaiting review needs a source hash, page, pinpoint, and excerpt.");
    }

    const components = proposal.candidate_components;
    if (proposal.status === "awaiting_source_capture" && components.length > 0) {
      issue("candidate_components", "Without a capture, a proposal has no candidate components.");
    }
    if (proposal.status === "awaiting_human_review") {
      if (components.length === 0) {
        issue("candidate_components", "A proposal awaiting review needs at least one candidate component.");
      } else {
        // The headline candidate is the first component's first excerpt, so the two cannot drift.
        const [first] = components;
        if (
          proposal.candidate_page !== first.excerpts[0].page ||
          proposal.candidate_excerpt !== first.excerpts[0].text ||
          proposal.candidate_pinpoint !== first.pinpoint
        ) {
          issue("candidate_excerpt", "The candidate page, pinpoint, and excerpt must be the first component's.");
        }
      }
    }
    const pathway = proposal.retired_criterion_id.slice(0, proposal.retired_criterion_id.indexOf("."));
    const ids = components.map((component) => component.component_id);
    if (new Set(ids).size !== ids.length) {
      issue("candidate_components", "Component IDs must be unique.");
    }
    for (const id of ids) {
      if (!id.startsWith(`${pathway}.`)) issue("candidate_components", `${id} is not in pathway ${pathway}.`);
    }
  });

export type ProposedVerification = z.infer<typeof proposedVerificationSchema>;

/**
 * Every reason a proposal's candidate does not hold against its capture: wrong
 * source, a draft or non-operative source, a hash that does not pin the
 * captured text, or an excerpt that is not on the candidate page.
 */
export function proposalCaptureIssues(
  proposal: ProposedVerification,
  capture: { metadata: OfficialSourceMetadata; extracted: string },
): string[] {
  const issues: string[] = [];
  if (capture.metadata.source_id !== proposal.source_id) {
    issues.push(`The capture is ${capture.metadata.source_id}, not ${proposal.source_id}.`);
  }
  if (!canSupportCriterionRule(capture.metadata)) {
    issues.push(
      `A ${capture.metadata.source_type} recorded as ${capture.metadata.operative_status} cannot support a rule.`,
    );
  }
  if (proposal.status !== "awaiting_human_review") return issues;

  if (proposal.source_sha256 !== capture.metadata.sha256_extracted) {
    issues.push("source_sha256 does not pin the captured extracted text.");
  }
  const excerpt = proposal.candidate_excerpt ?? "";
  if (!excerptAppearsInCapture(excerpt, capture.extracted)) {
    issues.push("The candidate excerpt does not appear in the captured text.");
  } else if (!locateExcerptPages(excerpt, capture.extracted).includes(proposal.candidate_page ?? 0)) {
    issues.push("The candidate excerpt is not on the candidate page.");
  }
  for (const component of proposal.candidate_components) {
    for (const { page, text } of component.excerpts) {
      if (!excerptAppearsInCapture(text, capture.extracted)) {
        issues.push(`${component.component_id}: an excerpt does not appear in the captured text.`);
      } else if (!locateExcerptPages(text, capture.extracted).includes(page)) {
        issues.push(`${component.component_id}: an excerpt is not on page ${page}.`);
      }
    }
  }
  return issues;
}

export interface DraftChangeWarning {
  kind: "draft_change_warning";
  draft_source_id: string;
  affects_source_id: string;
  /** The shipped atomic criteria whose source the draft would change. */
  criterion_ids: string[];
  action: "human_re_review";
}

/**
 * A captured draft never changes a criterion result. It only flags the atomic
 * criteria whose source it would change, for human re-review.
 */
export function draftChangeWarnings(
  captures: readonly OfficialSourceMetadata[],
  proposals: readonly ProposedVerification[],
): DraftChangeWarning[] {
  return captures
    .filter((metadata) => metadata.source_type === "proposed_draft")
    .flatMap((draft) =>
      draft.may_change_source_ids.map((affected) => ({
        kind: "draft_change_warning" as const,
        draft_source_id: draft.source_id,
        affects_source_id: affected,
        criterion_ids: proposals
          .filter((proposal) => proposal.source_id === affected)
          .flatMap((proposal) => proposal.candidate_components)
          .filter((component) => shipped.has(component.disposition))
          .map((component) => component.component_id),
        action: "human_re_review" as const,
      })),
    );
}

/* ------------------------------------------------------ human review rounds */

/**
 * A human review round: a small set of atomic criteria prepared for a named
 * human reviewer to check against the captured official text, with one exact
 * candidate rule each. Like a proposal, it is preparation only. It never names
 * a reviewer, records a decision, or marks anything verified (the schema has
 * no field for any of them), and no production module reads it. Promoting a
 * criterion stays a separate, later change that fills in the criterion's own
 * human-verification record.
 */
export const HUMAN_REVIEW_ROUND_DIR = "app/fixtures/program-screen/human-review-rounds/";
export const HUMAN_REVIEW_ROUND_SCHEMA_VERSION = "program-screen-human-review-round-v1" as const;

/**
 * What the captured source safely supports, from a controlled parcel fact:
 * - `both_directions_safe`: a consistent result and a documented disqualifier.
 * - `block_only`: a disqualifier when the condition is affirmatively shown;
 *   absence does not establish consistency.
 * - `clear_only`: consistency in one direction; presence needs judgment.
 * - `professional_judgment`: nothing the screen can decide deterministically.
 * - `not_supported`: the captured source does not support the criterion.
 */
export const humanReviewClassifications = [
  "both_directions_safe",
  "block_only",
  "clear_only",
  "professional_judgment",
  "not_supported",
] as const;

/** The preparer's view of timing only; the reviewer's decision is recorded elsewhere. */
export const humanReviewPreparerRecommendations = [
  "ready_for_decision",
  "decide_after_open_questions",
  "keep_pending_recommended",
] as const;

export const humanReviewFactAnswers = ["yes", "no", "with_recording_instruction"] as const;
export const humanReviewNotFoundAnswers = [
  "distinct",
  "not_distinct",
  "distinct_only_with_recording_instruction",
] as const;

/** Round candidates never include the unresolved SB 79 temporary exemption. */
const EXCLUDED_CANDIDATE_PREFIX = "la_sb79.temporary-exemption";

const reviewText = z.string().trim().min(1).max(2000);
const question = reviewText.refine((value) => value.trim().endsWith("?"), "A review question asks something.");
const outcome = z.enum(predicateOutcomes);
const factKey = z.enum(programFactKeys);

const pagedExcerpt = z.object({ page: z.number().int().positive(), text: reviewText }).strict();

/** One condition on one fact's established value. Numbers compare in the fact's own unit. */
export const humanReviewRuleConditionSchema = z.union([
  z.object({ fact_key: factKey, equals: z.union([z.boolean(), reviewText]) }).strict(),
  z.object({ fact_key: factKey, in: z.array(reviewText).min(1) }).strict(),
  z.object({ fact_key: factKey, less_than: z.number().positive() }).strict(),
  z.object({ fact_key: factKey, at_least: z.number().positive() }).strict(),
]);

export type HumanReviewRuleCondition = z.infer<typeof humanReviewRuleConditionSchema>;

const ruleCaseSchema = z
  .object({ when: z.array(humanReviewRuleConditionSchema).min(1), outcome })
  .strict();

export const humanReviewCandidateRuleSchema = z
  .object({
    plain_english: reviewText,
    pseudocode: reviewText,
    /** Mutually exclusive; every established value combination must match exactly one case. */
    cases: z.array(ruleCaseSchema).min(1),
  })
  .strict();

export type HumanReviewCandidateRule = z.infer<typeof humanReviewCandidateRuleSchema>;

const factReviewSchema = z
  .object({
    fact_key: factKey,
    data_class: z.enum(programFactDataClasses),
    value: z.union([
      z.object({ kind: z.literal("boolean") }).strict(),
      z.object({ kind: z.literal("number"), unit: reviewText }).strict(),
      z.object({ kind: z.literal("text"), allowed: z.array(reviewText).nullable() }).strict(),
    ]),
    record_source: reviewText,
    recordable_without_free_text_interpretation: z.enum(humanReviewFactAnswers),
    not_found_distinct_from_no: z.enum(humanReviewNotFoundAnswers),
    date_dependency: reviewText,
    narrowing_required: z.boolean(),
    smallest_correction: reviewText.nullable(),
  })
  .strict()
  .superRefine((fact, context) => {
    if (fact.narrowing_required !== (fact.smallest_correction !== null)) {
      context.addIssue({
        code: "custom",
        path: ["smallest_correction"],
        message: "A smallest correction is required exactly when narrowing is required.",
      });
    }
  });

const directionSchema = z.object({ safe: z.boolean(), reasoning: reviewText }).strict();

export const humanReviewCandidateSchema = z
  .object({
    criterion_id: z.enum(humanVerificationRequiredCriterionIds),
    concept: reviewText,
    /** The v2 proposal file whose component carries this criterion. */
    proposal_file: z.string().regex(/^la_(?:shra|sb79|low_rise)\.[a-z0-9-]+\.json$/),
    source: z
      .object({
        source_id: z.string(),
        source_type: z.enum(["adopted_ordinance", "official_memo"]),
        operative_status: z.literal("operative"),
        /** `sha256_extracted` of the capture every excerpt was taken from. */
        source_sha256: hex64,
        text_layer: z.enum(["born_digital_text", "city_ocr_of_scan"]),
      })
      .strict(),
    pdf_pages: z.array(z.number().int().positive()).min(1),
    printed_page_note: reviewText,
    section: reviewText,
    /** The shipped criterion's citation pinpoint, unchanged. */
    current_pinpoint: reviewText,
    /** The rule text, exact from the capture. */
    excerpts: z.array(pagedExcerpt).min(1),
    basis_excerpt_changes: reviewText.nullable(),
    /** Neighboring or cross-source text a reviewer needs; exact from an operative capture. */
    context_excerpts: z.array(
      z.object({ source_id: z.string(), page: z.number().int().positive(), text: reviewText, why: reviewText }).strict(),
    ),
    text_layer_check: z
      .object({
        pages_compared_with_image: z.array(z.number().int().positive()).min(1),
        discrepancies: z.array(
          z
            .object({
              page: z.number().int().positive(),
              text_layer_reads: reviewText,
              page_image_reads: reviewText,
              in_rule_excerpt: z.boolean(),
            })
            .strict(),
        ),
        note: reviewText,
      })
      .strict(),
    exceptions: z.array(reviewText).min(1),
    cross_references: z
      .array(z.object({ reference: reviewText, captured: z.boolean(), why_it_matters: reviewText }).strict())
      .min(1),
    direction_safety: z.object({ blocking: directionSchema, consistent: directionSchema }).strict(),
    classification: z.enum(humanReviewClassifications),
    classification_reasoning: reviewText,
    facts: z.array(factReviewSchema).min(1),
    /** The shipped criterion's `permitted_outcomes`, unchanged by this round. */
    current_outcome_ceiling: z.array(outcome).min(1),
    /** What the candidate rule can return: never wider than the current ceiling. */
    proposed_outcome_ceiling: z.array(outcome).min(1),
    candidate_rule: humanReviewCandidateRuleSchema,
    changes_from_v2_proposal: reviewText.nullable(),
    why_this_appears_safe: z.array(reviewText).min(1),
    what_could_make_it_wrong: z.array(reviewText).min(1),
    review_questions: z.array(question).min(1),
    preparer_recommendation: z.enum(humanReviewPreparerRecommendations),
  })
  .strict()
  .superRefine((candidate, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    if (candidate.criterion_id.startsWith(EXCLUDED_CANDIDATE_PREFIX)) {
      issue("criterion_id", "The SB 79 temporary-exemption criteria are unresolved and cannot be a review-round candidate.");
    }
    const source = expectedIds.get(candidate.source.source_id);
    if (source === undefined || source.source_type === "proposed_draft") {
      issue("source", "A review candidate must rest on an expected operative source, never a draft.");
    } else if (source.source_type !== candidate.source.source_type) {
      issue("source", `${candidate.source.source_id} is recorded as ${source.source_type}.`);
    }
    for (const excerpt of candidate.context_excerpts) {
      const quotedSource = expectedIds.get(excerpt.source_id);
      if (quotedSource === undefined || quotedSource.source_type === "proposed_draft") {
        issue("context_excerpts", "Context may be quoted only from an expected operative source, never a draft.");
      }
    }
    if (!candidate.proposal_file.startsWith(candidate.criterion_id.slice(0, candidate.criterion_id.indexOf(".") + 1))) {
      issue("proposal_file", "The proposal file must belong to the candidate's pathway.");
    }

    const current = new Set<string>(candidate.current_outcome_ceiling);
    const proposed = new Set<string>(candidate.proposed_outcome_ceiling);
    if (proposed.size !== candidate.proposed_outcome_ceiling.length) {
      issue("proposed_outcome_ceiling", "Outcomes must be unique.");
    }
    if (!proposed.has("requires_judgment")) {
      issue("proposed_outcome_ceiling", "Every candidate must be able to route to judgment.");
    }
    for (const value of proposed) {
      if (!current.has(value)) issue("proposed_outcome_ceiling", `${value} is outside the current ceiling.`);
    }
    const used = new Set<string>(["requires_judgment", ...candidate.candidate_rule.cases.map((ruleCase) => ruleCase.outcome)]);
    if ([...used].sort().join() !== [...proposed].sort().join()) {
      issue("proposed_outcome_ceiling", "The proposed ceiling must be exactly the outcomes the rule uses, plus requires_judgment.");
    }

    const blocking = proposed.has("disqualifying_per_source");
    const clearing = proposed.has("consistent_with_source");
    const expected: Record<(typeof humanReviewClassifications)[number], [boolean, boolean]> = {
      both_directions_safe: [true, true],
      block_only: [true, false],
      clear_only: [false, true],
      professional_judgment: [false, false],
      not_supported: [false, false],
    };
    const [mayBlock, mayClear] = expected[candidate.classification];
    if (blocking !== mayBlock || clearing !== mayClear) {
      issue("classification", `A ${candidate.classification} candidate cannot propose that ceiling.`);
    }
    if (candidate.direction_safety.blocking.safe !== mayBlock || candidate.direction_safety.consistent.safe !== mayClear) {
      issue("direction_safety", `Direction safety must match the ${candidate.classification} classification.`);
    }

    const read = new Set(candidate.facts.map((fact) => fact.fact_key));
    if (read.size !== candidate.facts.length) issue("facts", "Each fact is reviewed once.");
    for (const ruleCase of candidate.candidate_rule.cases) {
      for (const condition of ruleCase.when) {
        if (!read.has(condition.fact_key)) {
          issue("candidate_rule", `The rule reads ${condition.fact_key}, which the fact review does not cover.`);
        }
      }
    }
    for (const fact of candidate.facts) {
      if (fact.data_class !== "controlled_value" && candidate.candidate_rule.cases.length > 0) {
        issue("facts", `${fact.fact_key} is not a controlled value; a rule cannot read it.`);
      }
    }
  });

export type HumanReviewCandidate = z.infer<typeof humanReviewCandidateSchema>;

export const humanReviewRoundSchema = z
  .object({
    record_kind: z.literal("human_review_round"),
    schema_version: z.literal(HUMAN_REVIEW_ROUND_SCHEMA_VERSION),
    round: z.number().int().positive(),
    /** A round never records a decision: approval happens in a later, separate change. */
    status: z.literal("awaiting_human_review"),
    prepared_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    packet: z.string().regex(/^docs\/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_\d+\.md$/),
    preparation_note: reviewText,
    not_in_this_round: z.array(z.object({ topic: reviewText, reason: reviewText }).strict()).min(1),
    candidates: z.array(humanReviewCandidateSchema).min(1),
  })
  .strict()
  .superRefine((round, context) => {
    const ids = round.candidates.map((candidate) => candidate.criterion_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", path: ["candidates"], message: "Each criterion appears once per round." });
    }
  });

export type HumanReviewRound = z.infer<typeof humanReviewRoundSchema>;

/**
 * Every reason a candidate's quoted text does not hold against the captures:
 * a wrong or non-operative source, a hash that does not pin the captured text,
 * or an excerpt that is not on its stated page.
 */
export function humanReviewCaptureIssues(
  candidate: HumanReviewCandidate,
  captures: Readonly<Record<string, { metadata: OfficialSourceMetadata; extracted: string }>>,
): string[] {
  const issues: string[] = [];
  const own = captures[candidate.source.source_id];
  if (own === undefined) return [`${candidate.source.source_id} is not captured.`];
  if (!canSupportCriterionRule(own.metadata)) {
    issues.push(`A ${own.metadata.source_type} recorded as ${own.metadata.operative_status} cannot support a rule.`);
  }
  if (own.metadata.source_type !== candidate.source.source_type) {
    issues.push("The recorded source type differs from the capture metadata.");
  }
  if (own.metadata.operative_status !== candidate.source.operative_status) {
    issues.push("The recorded operative status differs from the capture metadata.");
  }
  if (candidate.source.source_sha256 !== own.metadata.sha256_extracted) {
    issues.push("source_sha256 does not pin the captured extracted text.");
  }
  const quoted = [
    ...candidate.excerpts.map((excerpt) => ({ ...excerpt, source_id: candidate.source.source_id })),
    ...candidate.context_excerpts,
  ];
  for (const { source_id: sourceId, page, text } of quoted) {
    const capture = captures[sourceId];
    if (capture === undefined) {
      issues.push(`${sourceId} is not captured.`);
    } else if (!canSupportCriterionRule(capture.metadata)) {
      issues.push(`${sourceId} cannot support a rule; it cannot be quoted as review context.`);
    } else if (!excerptAppearsInCapture(text, capture.extracted)) {
      issues.push(`An excerpt does not appear in ${sourceId}.`);
    } else if (!locateExcerptPages(text, capture.extracted).includes(page)) {
      issues.push(`An excerpt is not on page ${page} of ${sourceId}.`);
    }
  }
  return issues;
}

function conditionHolds(
  condition: HumanReviewRuleCondition,
  values: Readonly<Record<string, boolean | number | string>>,
): boolean {
  const value = values[condition.fact_key];
  if (value === undefined) return false;
  if ("equals" in condition) return value === condition.equals;
  if ("in" in condition) return typeof value === "string" && condition.in.includes(value);
  if (typeof value !== "number") return false;
  return "less_than" in condition ? value < condition.less_than : value >= condition.at_least;
}

/**
 * TEST-ONLY interpreter for a candidate rule, so tests can exercise the exact
 * rule a reviewer is asked to accept. Throws unless exactly one case matches.
 * Production never calls it: a promoted rule is written as its criterion's own
 * predicate in a later, reviewed change.
 */
export function candidateRuleOutcome(
  rule: HumanReviewCandidateRule,
  values: Readonly<Record<string, boolean | number | string>>,
): PredicateOutcome {
  const matches = rule.cases.filter((ruleCase) => ruleCase.when.every((condition) => conditionHolds(condition, values)));
  if (matches.length !== 1) {
    throw new Error(`A candidate rule must match exactly one case; ${matches.length} matched.`);
  }
  return matches[0].outcome;
}

/* ---------------------------------------------------- human review decisions */

/**
 * The named human reviewer's decisions on a review round, kept apart from the
 * round's preparation manifest (which can never name a reviewer or record a
 * decision). A decisions record promotes nothing: every criterion it covers
 * stays `pending_human`, and each decision lists the gates that must be met
 * before a later, separate change may make the criterion `human_verified`.
 * No production module reads it.
 */
export const HUMAN_REVIEW_DECISIONS_SCHEMA_VERSION = "program-screen-human-review-decisions-v1" as const;

export const humanReviewDecisionValues = ["approve_as_written", "approve_with_revision", "keep_pending"] as const;

/** The first line of a verbatim decision text names the decision. */
export const humanReviewDecisionLabels: Readonly<Record<(typeof humanReviewDecisionValues)[number], string>> = {
  approve_as_written: "APPROVE AS WRITTEN",
  approve_with_revision: "APPROVE WITH REVISION",
  keep_pending: "KEEP PENDING",
};

/**
 * - `gated_on_enforcement`: a decided rule that stays pending until its gates
 *   can be enforced in code or fail closed.
 * - `pending_source_capture`: no rule until a missing official record is
 *   captured and reviewed.
 */
export const humanReviewDecisionTiers = ["gated_on_enforcement", "pending_source_capture"] as const;

/** Defined in types.ts so the evaluator can compute promotion blockers without importing this module. */
export const humanReviewPromotionGates = criterionPromotionGates;

const snakeToken = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
const verbatimText = z.string().min(1).max(8000);

export const humanReviewDecisionSchema = z
  .object({
    letter: z.string().regex(/^[a-z]$/),
    criterion_id: z.enum(humanVerificationRequiredCriterionIds),
    decision: z.enum(humanReviewDecisionValues),
    /** The reviewer's decision text exactly as given. */
    reviewer_text_verbatim: verbatimText,
    /** The reviewer's later decision on the criterion's promotion tier, exactly as given. */
    promotion_tier_text_verbatim: verbatimText.nullable(),
    source_proposition_accepted: z.boolean(),
    tier: z.enum(humanReviewDecisionTiers),
    /** A decisions record never promotes a criterion. */
    status_after_review: z.literal("pending_human"),
    outcome_ceiling_changed: z.literal(false),
    promotion_gates: z.array(z.enum(humanReviewPromotionGates)).min(1),
    rereview_triggers: z.array(snakeToken),
    deferred_changes: z.array(snakeToken),
    completed_in_this_change: z.array(snakeToken),
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (entry.reviewer_text_verbatim.split("\n", 1)[0] !== humanReviewDecisionLabels[entry.decision]) {
      issue("reviewer_text_verbatim", "The verbatim text must open with the decision it records.");
    }
    if (new Set(entry.promotion_gates).size !== entry.promotion_gates.length) {
      issue("promotion_gates", "Gates must be unique.");
    }
    for (const gate of ["reviewer_confirms_encoded_rule", "human_verification_record"] as const) {
      if (!entry.promotion_gates.includes(gate)) {
        issue("promotion_gates", `Every decision keeps the ${gate} gate; approval of a rule never promotes it.`);
      }
    }
    const expectedTier = entry.decision === "keep_pending" ? "pending_source_capture" : "gated_on_enforcement";
    if (entry.tier !== expectedTier) {
      issue("tier", `A ${entry.decision} decision is recorded as ${expectedTier}.`);
    }
  });

export type HumanReviewDecision = z.infer<typeof humanReviewDecisionSchema>;

export const humanReviewDecisionsSchema = z
  .object({
    record_kind: z.literal("human_review_decisions"),
    schema_version: z.literal(HUMAN_REVIEW_DECISIONS_SCHEMA_VERSION),
    round: z.number().int().positive(),
    manifest: z.string().regex(/^app\/fixtures\/program-screen\/human-review-rounds\/round-\d+\.json$/),
    packet: z.string().regex(/^docs\/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_\d+\.md$/),
    decisions_doc: z.string().regex(/^docs\/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_\d+_DECISIONS\.md$/),
    reviewer: z
      .object({ kind: z.literal("human"), name: reviewText, role: reviewText })
      .strict(),
    decided_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Promotion happens only in a later change to the criterion itself. */
    promoted_in_this_round: z.array(z.string()).max(0),
    phase_constraints_verbatim: verbatimText,
    decisions: z.array(humanReviewDecisionSchema).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    const ids = record.decisions.map((entry) => entry.criterion_id);
    const letters = record.decisions.map((entry) => entry.letter);
    if (new Set(ids).size !== ids.length || new Set(letters).size !== letters.length) {
      context.addIssue({ code: "custom", path: ["decisions"], message: "Each criterion and letter appears once." });
    }
  });

export type HumanReviewDecisions = z.infer<typeof humanReviewDecisionsSchema>;
