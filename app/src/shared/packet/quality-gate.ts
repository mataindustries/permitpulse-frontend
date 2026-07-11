import { formatPacketDateTime, packetVisibleText } from "./presentation";
import {
  packetPresentationVersion,
  type PacketPresentationModel,
} from "./types";

export type PacketQualityTargetTab =
  | "overview"
  | "evidence"
  | "timeline"
  | "findings"
  | "packet";

export type PacketQualityLifecycleState =
  | "draft"
  | "packet_generated"
  | "under_review"
  | "changes_required"
  | "approved_for_delivery"
  | "delivered"
  | "delivery_confirmed";

export interface PacketQualityIssue {
  id: string;
  title: string;
  reason: string;
  source: string;
  recommended_resolution: string;
  target_cockpit_tab: PacketQualityTargetTab;
}

export interface PacketQualityPassedCheck {
  id: string;
  title: string;
  reason: string;
  source: string;
}

export interface DeliveryQualityEvaluation {
  eligible_for_approval: boolean;
  eligible_for_delivery: boolean;
  blockers: PacketQualityIssue[];
  warnings: PacketQualityIssue[];
  passed_checks: PacketQualityPassedCheck[];
  stale_snapshot: boolean;
  evaluated_at: string;
  recommended_resolution: string;
}

export interface EvaluatePacketQualityInput {
  evaluatedAt: Date | string;
  lifecycleState: PacketQualityLifecycleState;
  snapshot: PacketPresentationModel | null;
  snapshotPresent?: boolean;
  staleSnapshot: boolean;
}

interface RuleContext {
  lifecycleState: PacketQualityLifecycleState;
  snapshot: PacketPresentationModel;
  staleSnapshot: boolean;
  sourceIds: Set<string>;
}

interface QualityRuleResult {
  outcome: "blocker" | "warning" | "passed";
  issue: PacketQualityIssue | PacketQualityPassedCheck;
}

interface PacketQualityRule {
  id: string;
  evaluate(context: RuleContext): QualityRuleResult;
}

function blocker(
  id: string,
  title: string,
  reason: string,
  source: string,
  recommendedResolution: string,
  target: PacketQualityTargetTab,
): QualityRuleResult {
  return {
    outcome: "blocker",
    issue: {
      id,
      title,
      reason,
      source,
      recommended_resolution: recommendedResolution,
      target_cockpit_tab: target,
    },
  };
}

function warning(
  id: string,
  title: string,
  reason: string,
  source: string,
  recommendedResolution: string,
  target: PacketQualityTargetTab,
): QualityRuleResult {
  return {
    outcome: "warning",
    issue: {
      id,
      title,
      reason,
      source,
      recommended_resolution: recommendedResolution,
      target_cockpit_tab: target,
    },
  };
}

function passed(
  id: string,
  title: string,
  reason: string,
  source: string,
): QualityRuleResult {
  return { outcome: "passed", issue: { id, title, reason, source } };
}

const qualityRules: readonly PacketQualityRule[] = [
  {
    id: "project-identity-present",
    evaluate: ({ snapshot }) =>
      snapshot.case_summary.project_name.trim()
        ? passed(
            "project-identity-present",
            "Project identity is present",
            "The packet includes a project name.",
            "Case overview: project name",
          )
        : blocker(
            "project-identity-present",
            "Project identity is missing",
            "A client-facing packet must identify the project.",
            "Case overview: project name is empty",
            "Add the project name in Overview, then regenerate the packet.",
            "overview",
          ),
  },
  {
    id: "address-present",
    evaluate: ({ snapshot }) =>
      snapshot.case_summary.address.trim()
        ? passed(
            "address-present",
            "Project address is present",
            "The packet includes the recorded project address.",
            "Case overview: address",
          )
        : blocker(
            "address-present",
            "Project address is missing",
            "The packet cannot reliably identify the project location without an address.",
            "Case overview: address is empty",
            "Add the project address in Overview, then regenerate the packet.",
            "overview",
          ),
  },
  {
    id: "jurisdiction-present",
    evaluate: ({ snapshot }) =>
      snapshot.jurisdiction.trim()
        ? passed(
            "jurisdiction-present",
            "Jurisdiction is present",
            "The packet identifies the recorded permitting jurisdiction.",
            "Case overview: jurisdiction",
          )
        : blocker(
            "jurisdiction-present",
            "Jurisdiction is missing",
            "A permit packet must identify the authority associated with the record.",
            "Case overview: jurisdiction is empty",
            "Add the jurisdiction in Overview, then regenerate the packet.",
            "overview",
          ),
  },
  {
    id: "permit-number-present",
    evaluate: ({ snapshot }) => {
      if (snapshot.permit_number?.trim()) {
        return passed(
          "permit-number-present",
          "Permit number is present",
          "The packet includes the recorded permit number.",
          "Case overview: permit number",
        );
      }

      if (snapshot.current_status.value === "intake") {
        return warning(
          "permit-number-present",
          "Permit number is not yet recorded",
          "The case is still in intake, so a permit number may not have been assigned.",
          "Case overview: permit number is empty; status is Intake",
          "Add the permit number when the jurisdiction assigns one.",
          "overview",
        );
      }

      return blocker(
        "permit-number-present",
        "Permit number is required",
        "The case has advanced beyond intake without a recorded permit number.",
        `Case overview: status is ${snapshot.current_status.label}; permit number is empty`,
        "Add the permit number in Overview, then regenerate the packet.",
        "overview",
      );
    },
  },
  {
    id: "evidence-exists",
    evaluate: ({ snapshot }) =>
      snapshot.evidence_summaries.length > 0
        ? passed(
            "evidence-exists",
            "Evidence register is populated",
            `${snapshot.evidence_summaries.length} evidence record${snapshot.evidence_summaries.length === 1 ? " is" : "s are"} included.`,
            "Evidence register",
          )
        : blocker(
            "evidence-exists",
            "Evidence register is empty",
            "The packet has no source record supporting its contents.",
            "Evidence register: 0 records",
            "Add at least one evidence record, then regenerate the packet.",
            "evidence",
          ),
  },
  {
    id: "evidence-source-ready",
    evaluate: ({ snapshot }) => {
      const ready = snapshot.evidence_summaries.filter(
        (item) => item.verification_status === "verified" || item.source.complete,
      );

      return ready.length > 0
        ? passed(
            "evidence-source-ready",
            "Source-ready evidence exists",
            `${ready.length} evidence record${ready.length === 1 ? " is" : "s are"} verified or source-complete.`,
            "Evidence register: verification and provenance metadata",
          )
        : blocker(
            "evidence-source-ready",
            "No evidence is verified or source-complete",
            "At least one evidence record must be verified or include a source label, URL, and date.",
            "Evidence register: no verified or source-complete record",
            "Verify an evidence record or complete its source label, URL, and date, then regenerate the packet.",
            "evidence",
          );
    },
  },
  {
    id: "timeline-exists",
    evaluate: ({ snapshot }) =>
      snapshot.timeline_summaries.length > 0
        ? passed(
            "timeline-exists",
            "Permit timeline is populated",
            `${snapshot.timeline_summaries.length} permit event${snapshot.timeline_summaries.length === 1 ? " is" : "s are"} included.`,
            "Permit timeline",
          )
        : blocker(
            "timeline-exists",
            "Permit timeline is empty",
            "The packet does not include any permit events.",
            "Permit timeline: 0 events",
            "Add at least one supported permit timeline event, then regenerate the packet.",
            "timeline",
          ),
  },
  {
    id: "snapshot-current",
    evaluate: ({ staleSnapshot }) =>
      staleSnapshot
        ? blocker(
            "snapshot-current",
            "Packet snapshot is stale",
            "Current case, evidence, or timeline data differs from the persisted packet snapshot.",
            "Persisted snapshot digest does not match the current presentation digest",
            "Regenerate the packet before approval or delivery.",
            "packet",
          )
        : passed(
            "snapshot-current",
            "Packet snapshot is current",
            "The persisted packet matches the current normalized presentation.",
            "Snapshot and current presentation digests match",
          ),
  },
  {
    id: "customer-facing-language",
    evaluate: ({ snapshot }) => {
      const internalPattern =
        /this placeholder is not ai-generated yet|runtime provider|\blive_ai\b|\bexternal_calls\b|internal (?:working|review) draft|developer-facing|component name|\/api\/v\d+\//i;
      const offending = packetVisibleText(snapshot).find((value) =>
        internalPattern.test(value),
      );

      return offending
        ? blocker(
            "customer-facing-language",
            "Internal language is present",
            "The packet contains implementation or internal-review wording that is not suitable for a client.",
            `Client-visible text matched an internal-language rule: ${offending.slice(0, 120)}`,
            "Remove or replace the internal wording, then regenerate the packet.",
            "packet",
          )
        : passed(
            "customer-facing-language",
            "Customer-facing language check passed",
            "No known placeholder, provider, route, or implementation wording is visible.",
            "Normalized client-visible packet text",
          );
    },
  },
  {
    id: "findings-grounded",
    evaluate: ({ snapshot, sourceIds }) => {
      const unsupported = snapshot.findings.items.filter(
        (item) =>
          !item.grounded ||
          !item.reviewer_approved ||
          item.supporting_source_ids.length === 0 ||
          item.supporting_source_ids.some((id) => !sourceIds.has(id)),
      );

      return unsupported.length > 0
        ? blocker(
            "findings-grounded",
            "A finding is not grounded",
            `${unsupported.length} finding${unsupported.length === 1 ? " lacks" : "s lack"} reviewer approval or valid supporting sources.`,
            "Findings: reviewer approval and supporting source references",
            "Ground or remove each unsupported finding, record reviewer approval, then regenerate the packet.",
            "findings",
          )
        : passed(
            "findings-grounded",
            "Findings are grounded",
            snapshot.findings.items.length > 0
              ? "Every included finding is reviewer-approved and references packet sources."
              : "No ungrounded finding is included.",
            "Findings section",
          );
    },
  },
  {
    id: "unsupported-claims-absent",
    evaluate: ({ snapshot }) =>
      snapshot.unsupported_claims.length === 0
        ? passed(
            "unsupported-claims-absent",
            "No unsupported claims are recorded",
            "The presentation model contains no unresolved unsupported claim.",
            "Unsupported-claims register",
          )
        : blocker(
            "unsupported-claims-absent",
            "Unsupported claims remain",
            `${snapshot.unsupported_claims.length} unsupported claim${snapshot.unsupported_claims.length === 1 ? " is" : "s are"} unresolved.`,
            "Unsupported-claims register",
            "Remove the claim or add valid supporting evidence and reviewer approval, then regenerate the packet.",
            "findings",
          ),
  },
  {
    id: "open-questions-approved",
    evaluate: ({ snapshot }) => {
      const unapproved = snapshot.open_questions.items.filter(
        (item) => !item.reviewer_approved,
      );

      return unapproved.length > 0
        ? blocker(
            "open-questions-approved",
            "An open question is not reviewer-approved",
            `${unapproved.length} open question${unapproved.length === 1 ? " has" : "s have"} not been approved for client presentation.`,
            "Open Questions: reviewer approval state",
            "Approve, revise, or remove each question, then regenerate the packet.",
            "findings",
          )
        : passed(
            "open-questions-approved",
            "Open questions are approved",
            snapshot.open_questions.items.length > 0
              ? "Every included open question is reviewer-approved."
              : "No unapproved open question is included.",
            "Open Questions section",
          );
    },
  },
  {
    id: "recommended-actions-approved",
    evaluate: ({ snapshot }) => {
      const unapproved = snapshot.recommended_next_actions.items.filter(
        (item) => !item.reviewer_approved,
      );

      return unapproved.length > 0
        ? blocker(
            "recommended-actions-approved",
            "A recommended action is not reviewer-approved",
            `${unapproved.length} recommended action${unapproved.length === 1 ? " has" : "s have"} not been approved for client presentation.`,
            "Recommended Next Actions: reviewer approval state",
            "Approve, revise, or remove each action, then regenerate the packet.",
            "findings",
          )
        : passed(
            "recommended-actions-approved",
            "Recommended actions are approved",
            snapshot.recommended_next_actions.items.length > 0
              ? "Every included recommended action is reviewer-approved."
              : "No unapproved recommended action is included.",
            "Recommended Next Actions section",
          );
    },
  },
  {
    id: "disclaimer-present",
    evaluate: ({ snapshot }) =>
      snapshot.disclaimer.trim()
        ? passed(
            "disclaimer-present",
            "Disclaimer is present",
            "The packet includes the customer-facing reliance disclaimer.",
            "Disclaimer section",
          )
        : blocker(
            "disclaimer-present",
            "Disclaimer is missing",
            "The packet does not include the required reliance and verification notice.",
            "Disclaimer section is empty",
            "Restore the standard PermitPulse disclaimer, then regenerate the packet.",
            "packet",
          ),
  },
  {
    id: "not-internal-draft",
    evaluate: ({ snapshot }) =>
      snapshot.is_internal_draft
        ? blocker(
            "not-internal-draft",
            "Packet is marked as an internal draft",
            "A packet marked for internal use cannot be approved or delivered.",
            "Presentation metadata: is_internal_draft is true",
            "Create a client-facing packet snapshot, then complete review again.",
            "packet",
          )
        : passed(
            "not-internal-draft",
            "Packet is client-facing",
            "The presentation is not marked as an internal draft.",
            "Presentation metadata: is_internal_draft is false",
          ),
  },
  {
    id: "delivery-lifecycle-compatible",
    evaluate: ({ lifecycleState }) =>
      lifecycleState === "under_review" ||
      lifecycleState === "approved_for_delivery" ||
      lifecycleState === "delivered" ||
      lifecycleState === "delivery_confirmed"
        ? passed(
            "delivery-lifecycle-compatible",
            "Delivery lifecycle is compatible",
            `The persisted delivery lifecycle state is ${lifecycleState}.`,
            "Delivery lifecycle event stream",
          )
        : warning(
            "delivery-lifecycle-compatible",
            "Packet has not completed review",
            `The delivery lifecycle is currently ${lifecycleState}.`,
            "Delivery lifecycle event stream",
            "Move the current snapshot through review before approval or delivery.",
            "packet",
          ),
  },
  {
    id: "evidence-verification-depth",
    evaluate: ({ snapshot }) => {
      const verified = snapshot.evidence_summaries.filter(
        (item) => item.verification_status === "verified",
      ).length;

      return snapshot.evidence_summaries.length > 0 && verified === 0
        ? warning(
            "evidence-verification-depth",
            "Evidence is source-complete but unverified",
            "No evidence record has reviewer verification, although source-complete evidence may satisfy the minimum gate.",
            "Evidence register: 0 verified records",
            "Review and verify the strongest source records before delivery when possible.",
            "evidence",
          )
        : passed(
            "evidence-verification-depth",
            "Verified evidence is present",
            `${verified} evidence record${verified === 1 ? " is" : "s are"} verified.`,
            "Evidence register: verification states",
          );
    },
  },
  {
    id: "disputed-evidence-disclosed",
    evaluate: ({ snapshot }) => {
      const disputed = snapshot.evidence_summaries.filter(
        (item) => item.verification_status === "disputed",
      ).length;

      return disputed > 0
        ? warning(
            "disputed-evidence-disclosed",
            "Disputed evidence is included",
            `${disputed} evidence record${disputed === 1 ? " is" : "s are"} explicitly labeled disputed and is not presented as confirmed.`,
            "Evidence Register: disputed verification state",
            "Resolve or replace disputed evidence when possible; retain the label if it remains material to the client.",
            "evidence",
          )
        : passed(
            "disputed-evidence-disclosed",
            "No disputed evidence is included",
            "The packet contains no evidence record with a disputed verification state.",
            "Evidence Register: verification states",
          );
    },
  },
  {
    id: "evidence-provenance-complete",
    evaluate: ({ snapshot }) => {
      const incomplete = snapshot.evidence_summaries.filter(
        (item) => !item.source.complete,
      ).length;

      return incomplete > 0
        ? warning(
            "evidence-provenance-complete",
            "Some evidence provenance is incomplete",
            `${incomplete} evidence record${incomplete === 1 ? " is" : "s are"} missing a source label, URL, or date.`,
            "Evidence register: source metadata",
            "Complete provenance for each source when the information is available.",
            "evidence",
          )
        : passed(
            "evidence-provenance-complete",
            "Evidence provenance is complete",
            "Every evidence record includes a source label, URL, and date.",
            "Evidence register: source metadata",
          );
    },
  },
  {
    id: "timeline-supported",
    evaluate: ({ snapshot }) => {
      const unsupported = snapshot.timeline_summaries.filter(
        (item) => item.linked_evidence.length === 0,
      ).length;

      return unsupported > 0
        ? warning(
            "timeline-supported",
            "Some timeline events have no linked evidence",
            `${unsupported} timeline event${unsupported === 1 ? " has" : "s have"} no supporting evidence link.`,
            "Permit timeline: evidence links",
            "Link supporting evidence to each timeline event when available.",
            "timeline",
          )
        : passed(
            "timeline-supported",
            "Timeline events are linked to evidence",
            "Every included timeline event has at least one evidence link.",
            "Permit timeline: evidence links",
          );
    },
  },
  {
    id: "packet-source-scope-complete",
    evaluate: ({ snapshot }) => {
      const truncationWarnings = snapshot.warnings.filter((item) =>
        item.id.endsWith("-truncated"),
      );

      return truncationWarnings.length > 0
        ? warning(
            "packet-source-scope-complete",
            "Packet source scope is bounded",
            truncationWarnings.map((item) => item.text).join(" "),
            "Presentation warnings: bounded evidence or timeline query",
            "Review whether a narrower, manually curated source set is needed before delivery.",
            "packet",
          )
        : passed(
            "packet-source-scope-complete",
            "Packet source scope is complete",
            "The evidence and timeline lists did not exceed packet assembly limits.",
            "Presentation warnings: no source-list truncation",
          );
    },
  },
  ...(["findings", "open_questions", "recommended_next_actions"] as const).map(
    (section): PacketQualityRule => ({
      id: `${section.replaceAll("_", "-")}-content`,
      evaluate: ({ snapshot }) => {
        const content = snapshot[section];
        const title =
          section === "findings"
            ? "Findings"
            : section === "open_questions"
              ? "Open Questions"
              : "Recommended Next Actions";

        return content.items.length === 0
          ? warning(
              `${section.replaceAll("_", "-")}-content`,
              `${title} is empty`,
              content.empty_message,
              `${title} section: 0 reviewer-approved items`,
              "Add reviewer-approved content when it is material to the client; do not fabricate content solely to clear this warning.",
              "findings",
            )
          : passed(
              `${section.replaceAll("_", "-")}-content`,
              `${title} has approved content`,
              `${content.items.length} client-facing item${content.items.length === 1 ? " is" : "s are"} included.`,
              `${title} section`,
            );
      },
    }),
  ),
];

function snapshotIssue(
  present: boolean,
): PacketQualityIssue {
  return present
    ? {
        id: "presentation-version-current",
        title: "Packet presentation is outdated",
        reason: `The persisted snapshot does not use presentation version ${packetPresentationVersion}.`,
        source: "Persisted packet snapshot schema",
        recommended_resolution: "Regenerate the packet with the current renderer before approval or delivery.",
        target_cockpit_tab: "packet",
      }
    : {
        id: "persisted-snapshot-present",
        title: "No persisted packet snapshot exists",
        reason: "Approval and delivery require a generated packet snapshot.",
        source: "Delivery lifecycle: no active packet generation",
        recommended_resolution: "Generate the packet to create a persisted snapshot.",
        target_cockpit_tab: "packet",
      };
}

export function evaluatePacketQuality({
  evaluatedAt,
  lifecycleState,
  snapshot,
  snapshotPresent = Boolean(snapshot),
  staleSnapshot,
}: EvaluatePacketQualityInput): DeliveryQualityEvaluation {
  const evaluated = formatPacketDateTime(evaluatedAt).raw;

  if (!snapshot) {
    const issue = snapshotIssue(snapshotPresent);

    return {
      eligible_for_approval: false,
      eligible_for_delivery: false,
      blockers: [issue],
      warnings: [],
      passed_checks: [],
      stale_snapshot: false,
      evaluated_at: evaluated,
      recommended_resolution: issue.recommended_resolution,
    };
  }

  const sourceIds = new Set([
    ...snapshot.evidence_summaries.map((item) => item.id),
    ...snapshot.timeline_summaries.map((item) => item.id),
  ]);
  const context: RuleContext = {
    lifecycleState,
    snapshot,
    staleSnapshot,
    sourceIds,
  };
  const results = qualityRules.map((rule) => rule.evaluate(context));
  const blockers = results
    .filter((result) => result.outcome === "blocker")
    .map((result) => result.issue as PacketQualityIssue);
  const warnings = results
    .filter((result) => result.outcome === "warning")
    .map((result) => result.issue as PacketQualityIssue);
  const passedChecks = results
    .filter((result) => result.outcome === "passed")
    .map((result) => result.issue as PacketQualityPassedCheck);
  const recommendedResolution =
    blockers[0]?.recommended_resolution ??
    warnings[0]?.recommended_resolution ??
    "The current snapshot passes all delivery-quality checks.";

  return {
    eligible_for_approval:
      lifecycleState === "under_review" && blockers.length === 0,
    eligible_for_delivery:
      lifecycleState === "approved_for_delivery" && blockers.length === 0,
    blockers,
    warnings,
    passed_checks: passedChecks,
    stale_snapshot: staleSnapshot,
    evaluated_at: evaluated,
    recommended_resolution: recommendedResolution,
  };
}

export function qualityBlockingSummary(
  evaluation: DeliveryQualityEvaluation,
): string {
  return evaluation.blockers
    .map((issue) => `${issue.id}: ${issue.title}`)
    .join("; ");
}
