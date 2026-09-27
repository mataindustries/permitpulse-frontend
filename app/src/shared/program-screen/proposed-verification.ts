import { z } from "zod";
import {
  canSupportCriterionRule,
  excerptAppearsInCapture,
  locateExcerptPages,
  type OfficialSourceMetadata,
} from "./source-capture";
import {
  humanVerificationRequiredCriterionIds,
  programFactKeys,
  type OfficialSourceType,
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
 * Only a later change, made after a named human reviewer approves a
 * proposal, may convert a criterion to `human_verified`.
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
    role: "Operative source for the Low-Rise geographic criteria.",
  },
  {
    source_id: "ordinance-188968",
    title: "City of Los Angeles Ordinance No. 188968 (SB 79 Phased Implementation Ordinance)",
    official_url: "https://cityclerk.lacity.org/onlinedocs/2025/25-1083-S4_ord_188968_06-30-26.pdf",
    source_type: "adopted_ordinance",
    may_change_source_ids: [],
    role: "Operative source for the SB 79 exclusion, exemption, and site criteria.",
  },
  {
    source_id: "shra-2025-10-28",
    title:
      "Implementation of Senate Bills 1123 (2024) and 684 (2023) and Assembly Bill 130 (2025) - Starter Home Revitalization Act (interdepartmental memorandum, October 28, 2025)",
    official_url:
      "https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf",
    source_type: "official_memo",
    may_change_source_ids: [],
    role: "City implementation guidance for the SHRA criteria.",
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

const nonEmptyText = z.string().trim().min(1).max(1200);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest.");
const expectedIds = new Map(expectedOfficialSources.map((source) => [source.source_id, source]));

export const proposedVerificationSchema = z
  .object({
    record_kind: z.literal("proposed_verification"),
    criterion_id: z.enum(humanVerificationRequiredCriterionIds),
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
    /** Where to look. Taken from the repository's existing citation; not located in source text. */
    locate_in_source: nonEmptyText,
    question_for_human_reviewer: nonEmptyText,
    proposed_controlled_interpretation: z
      .object({
        fact_keys: z.array(z.enum(programFactKeys)).min(1),
        controlled_values_required: nonEmptyText,
        fact_narrowing_required: z.boolean(),
        narrowing_note: nonEmptyText.nullable(),
        predicate_shape_if_reviewer_agrees: nonEmptyText,
        must_remain_unresolved_when: z.array(nonEmptyText).min(1),
        zimas_conflict_risk: nonEmptyText,
      })
      .strict(),
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
  return issues;
}

export interface DraftChangeWarning {
  kind: "draft_change_warning";
  draft_source_id: string;
  affects_source_id: string;
  criterion_ids: string[];
  action: "human_re_review";
}

/**
 * A captured draft never changes a criterion result. It only flags the
 * criteria whose proposed source it would change, for human re-review.
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
          .map((proposal) => proposal.criterion_id),
        action: "human_re_review" as const,
      })),
    );
}
