import type { MissionFacts } from "./facts";
import type {
  MissionAction,
  MissionBlocker,
  MissionCompletedCheck,
  MissionState,
  MissionWarning,
} from "./types";

export interface RuleFinding {
  state: MissionState;
  blocker?: MissionBlocker;
  warning?: MissionWarning;
  action: MissionAction;
}

export interface MissionRule {
  id: string;
  priority: number;
  evaluate: (facts: MissionFacts) => RuleFinding | null;
}

function action(
  id: string,
  title: string,
  priority: number,
  reason: string,
  targetTab: MissionAction["targetTab"],
  blocking: boolean,
  supportingEvidence: string[],
): MissionAction {
  return { id, title, priority, reason, targetTab, blocking, supportingEvidence };
}

export const missionRules: readonly MissionRule[] = [
  {
    id: "missing-permit-number",
    priority: 10,
    evaluate: (facts) =>
      facts.case.permitNumber
        ? null
        : {
            state: "Needs Information",
            blocker: {
              id: "missing-permit-number",
              title: "Permit number is missing",
              severity: "high",
              reason: "The case cannot be reliably matched to the jurisdiction record without a permit number.",
              recommendedResolution: "Add the permit number from the jurisdiction record.",
              supportingEvidence: ["case:permit-number"],
            },
            action: action(
              "add-permit-number",
              "Add permit number",
              10,
              "The permit number is the first missing case identifier and blocks reliable packet identification.",
              "overview",
              true,
              ["case:permit-number"],
            ),
          },
  },
  {
    id: "case-needs-information",
    priority: 15,
    evaluate: (facts) =>
      facts.case.currentStatus !== "needs_information"
        ? null
        : {
            state: "Needs Information",
            blocker: {
              id: "case-needs-information",
              title: "Case is marked as needing information",
              severity: "high",
              reason: "The persisted lifecycle status records an unresolved information need.",
              recommendedResolution: "Review the case record and add the missing information before advancing it.",
              supportingEvidence: ["case:status"],
            },
            action: action(
              "resolve-missing-information",
              "Resolve missing information",
              15,
              "The case status explicitly records that information is still required.",
              "overview",
              true,
              ["case:status"],
            ),
          },
  },
  {
    id: "missing-evidence",
    priority: 20,
    evaluate: (facts) =>
      facts.evidence.total > 0
        ? null
        : {
            state: "Needs Evidence",
            blocker: {
              id: "missing-evidence",
              title: "No supporting evidence",
              severity: "critical",
              reason: "The case has no evidence records to support its timeline or packet.",
              recommendedResolution: "Add the first source record for the permit.",
              supportingEvidence: ["aggregate:evidence"],
            },
            action: action(
              "link-missing-evidence",
              "Link missing evidence",
              20,
              "A source record is required before the case can support operational conclusions.",
              "evidence",
              true,
              ["aggregate:evidence"],
            ),
          },
  },
  {
    id: "disputed-evidence",
    priority: 30,
    evaluate: (facts) =>
      facts.evidence.disputed === 0
        ? null
        : {
            state: "Needs Verification",
            blocker: {
              id: "disputed-evidence",
              title: "Evidence is disputed",
              severity: "critical",
              reason: `${facts.evidence.disputed} evidence record${facts.evidence.disputed === 1 ? " is" : "s are"} explicitly disputed and cannot support delivery readiness.`,
              recommendedResolution: "Resolve or replace each disputed source before relying on it.",
              supportingEvidence: ["aggregate:evidence"],
            },
            action: action(
              "verify-disputed-evidence",
              "Verify disputed evidence",
              30,
              "Disputed sources are the highest-risk unresolved evidence condition.",
              "evidence",
              true,
              ["aggregate:evidence"],
            ),
          },
  },
  {
    id: "unready-evidence",
    priority: 40,
    evaluate: (facts) => {
      if (facts.evidence.total === 0 || facts.evidence.deliveryReady === facts.evidence.total) {
        return null;
      }

      const evidenceNeedsVerification = facts.evidence.verified < facts.evidence.total;
      const provenanceIssues = facts.evidence.total - facts.evidence.sourceComplete;

      return evidenceNeedsVerification
        ? {
            state: "Needs Verification" as const,
            blocker: {
              id: "unready-evidence",
              title: "Evidence needs verification",
              severity: "high",
              reason: `${facts.evidence.total - facts.evidence.deliveryReady} evidence record${facts.evidence.total - facts.evidence.deliveryReady === 1 ? " is" : "s are"} unverified or missing source metadata.`,
              recommendedResolution: "Review each source and complete its label, direct record URL, and source date.",
              supportingEvidence: ["aggregate:evidence"],
            },
            action: action(
              "verify-evidence",
              "Complete evidence review",
              40,
              "Every evidence record needs a completed review and source details before packet delivery.",
              "evidence",
              true,
              ["aggregate:evidence"],
            ),
          }
        : {
            state: "Source details incomplete" as const,
            blocker: {
              id: "unready-evidence",
              title: `${provenanceIssues} verified evidence record${provenanceIssues === 1 ? " needs" : "s need"} source details`,
              severity: "high" as const,
              reason: `${provenanceIssues} verified evidence record${provenanceIssues === 1 ? " is" : "s are"} missing required source metadata.`,
              recommendedResolution: "Complete the source label, URL, and source date for each affected record.",
              supportingEvidence: ["aggregate:evidence"],
            },
            action: action(
              "complete-source-details",
              "Complete source details",
              40,
              "All evidence is verified, but every record must also have complete source metadata before packet delivery.",
              "evidence",
              true,
              ["aggregate:evidence"],
            ),
          };
    },
  },
  {
    id: "missing-timeline",
    priority: 50,
    evaluate: (facts) =>
      facts.timeline.total > 0
        ? null
        : {
            state: "Needs Timeline",
            blocker: {
              id: "missing-timeline",
              title: "Permit timeline is empty",
              severity: "high",
              reason: "No permit events are recorded, so the operational history cannot be reviewed.",
              recommendedResolution: "Add the first dated permit event and link its source.",
              supportingEvidence: ["aggregate:timeline"],
            },
            action: action(
              "review-timeline",
              "Review timeline",
              50,
              "A dated permit history is required to explain current case position.",
              "timeline",
              true,
              ["aggregate:timeline"],
            ),
          },
  },
  {
    id: "unlinked-timeline",
    priority: 60,
    evaluate: (facts) =>
      facts.timeline.total === 0 || facts.timeline.linked === facts.timeline.total
        ? null
        : {
            state: "Needs Timeline",
            blocker: {
              id: "unlinked-timeline",
              title: "Timeline events lack supporting evidence",
              severity: "high",
              reason: `${facts.timeline.total - facts.timeline.linked} timeline event${facts.timeline.total - facts.timeline.linked === 1 ? " has" : "s have"} no evidence link.`,
              recommendedResolution: "Link each timeline event to the source that supports it.",
              supportingEvidence: ["aggregate:timeline", "aggregate:evidence"],
            },
            action: action(
              "link-timeline-evidence",
              "Link missing evidence",
              60,
              "Every operational event needs a traceable source before review.",
              "timeline",
              true,
              ["aggregate:timeline", "aggregate:evidence"],
            ),
          },
  },
  {
    id: "needs-review",
    priority: 70,
    evaluate: (facts) =>
      facts.case.currentStatus === "ready_for_review"
        ? null
        : {
            state: "Needs Review",
            warning: {
              id: "needs-review",
              title: "Case has not reached review status",
              severity: "medium",
              reason: `The current lifecycle status is ${facts.case.currentStatus}.`,
              recommendedResolution: "Review the assembled record and advance the case when the operator confirms it is ready.",
              supportingEvidence: ["case:status"],
            },
            action: action(
              "review-case",
              "Review case",
              70,
              "The evidence and timeline checks pass, but operator review is not yet recorded in lifecycle status.",
              "findings",
              false,
              ["case:status", "aggregate:evidence", "aggregate:timeline"],
            ),
          },
  },
] as const;

export function completedChecks(facts: MissionFacts): MissionCompletedCheck[] {
  const checks: Array<MissionCompletedCheck | null> = [
    facts.case.permitNumber
      ? { id: "permit-number-recorded", title: "Permit number recorded", reason: "The case has a jurisdiction permit identifier.", supportingEvidence: ["case:permit-number"] }
      : null,
    facts.evidence.total > 0
      ? { id: "evidence-present", title: "Evidence present", reason: `${facts.evidence.total} evidence record${facts.evidence.total === 1 ? " is" : "s are"} attached.`, supportingEvidence: ["aggregate:evidence"] }
      : null,
    facts.evidence.total > 0 && facts.evidence.deliveryReady === facts.evidence.total
      ? { id: "evidence-ready", title: "Evidence review complete", reason: "Every evidence record is reviewed and has complete source details.", supportingEvidence: ["aggregate:evidence"] }
      : null,
    facts.timeline.total > 0
      ? { id: "timeline-present", title: "Timeline present", reason: `${facts.timeline.total} permit event${facts.timeline.total === 1 ? " is" : "s are"} recorded.`, supportingEvidence: ["aggregate:timeline"] }
      : null,
    facts.timeline.total > 0 && facts.timeline.linked === facts.timeline.total
      ? { id: "timeline-supported", title: "Timeline supported", reason: "Every timeline event has at least one evidence link.", supportingEvidence: ["aggregate:timeline", "aggregate:evidence"] }
      : null,
    facts.case.currentStatus === "ready_for_review"
      ? { id: "review-recorded", title: "Review status recorded", reason: "The lifecycle status is ready for review.", supportingEvidence: ["case:status"] }
      : null,
  ];

  return checks.filter((check): check is MissionCompletedCheck => check !== null);
}
