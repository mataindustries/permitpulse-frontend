import { aggregateEvidence, type MissionFacts } from "./facts";
import { completedChecks, missionRules } from "./rules";
import type {
  MissionAction,
  MissionHealthMetric,
  MissionIntelligence,
  MissionState,
} from "./types";

function metric(completed: number, total: number, subject: string): MissionHealthMetric {
  const score = total === 0 ? 0 : Math.round((completed / total) * 100);
  return {
    score,
    status: score >= 80 ? "strong" : score >= 50 ? "attention" : "at_risk",
    completed,
    total,
    explanation: `${completed} of ${total} deterministic ${subject} checks pass.`,
  };
}

function readyAction(facts: MissionFacts): { state: MissionState; action: MissionAction } {
  if (facts.timeline.canonicalApprovalLinkedToVerifiedEvidence) {
    return {
      state: "Ready To Deliver",
      action: {
        id: "export-pdf",
        title: "Export PDF",
        priority: 90,
        reason: "All packet checks pass and a canonical approval event is linked to verified evidence.",
        targetTab: "packet",
        blocking: false,
        supportingEvidence: ["case:status", "aggregate:evidence", "aggregate:timeline"],
      },
    };
  }

  return {
    state: "Ready For Packet",
    action: {
      id: "generate-packet",
      title: "Generate packet",
      priority: 80,
      reason: "All case, evidence, timeline, and review readiness checks pass.",
      targetTab: "packet",
      blocking: false,
      supportingEvidence: ["case:permit-number", "case:status", "aggregate:evidence", "aggregate:timeline"],
    },
  };
}

function assertExplainable(intelligence: MissionIntelligence): void {
  const evidenceIds = new Set(intelligence.supportingEvidence.map((item) => item.id));
  const references = [
    ...intelligence.blockers,
    ...intelligence.warnings,
    ...intelligence.completedChecks,
    intelligence.recommendedAction,
    ...intelligence.secondaryActions,
  ];

  for (const item of references) {
    if (item.supportingEvidence.length === 0) {
      throw new Error(`Mission Intelligence item ${item.id} is unexplained.`);
    }

    for (const reference of item.supportingEvidence) {
      if (!evidenceIds.has(reference)) {
        throw new Error(`Mission Intelligence item ${item.id} references unknown evidence ${reference}.`);
      }
    }
  }
}

export function evaluateMissionIntelligence(facts: MissionFacts): MissionIntelligence {
  const findings = missionRules
    .map((rule) => ({ rule, finding: rule.evaluate(facts) }))
    .filter((entry): entry is { rule: (typeof missionRules)[number]; finding: NonNullable<ReturnType<(typeof missionRules)[number]["evaluate"]>> } => entry.finding !== null)
    .sort((left, right) => left.rule.priority - right.rule.priority || left.rule.id.localeCompare(right.rule.id));
  const ready = readyAction(facts);
  const primaryFinding = findings[0]?.finding;
  const recommendedAction = primaryFinding?.action ?? ready.action;
  const checks = completedChecks(facts);
  const packetCompleted = checks.filter((check) => check.id !== "review-recorded").length;
  const evidenceCompleted = Number(facts.evidence.total > 0) + Number(facts.evidence.total > 0 && facts.evidence.deliveryReady === facts.evidence.total);
  const timelineCompleted = Number(facts.timeline.total > 0) + Number(facts.timeline.total > 0 && facts.timeline.linked === facts.timeline.total);
  const reviewCompleted = Number(facts.case.currentStatus === "ready_for_review");
  const missionState = primaryFinding?.state ?? ready.state;
  const blockers = findings.flatMap(({ finding }) => finding.blocker ? [finding.blocker] : []);
  const warnings = findings.flatMap(({ finding }) => finding.warning ? [finding.warning] : []);
  const intelligence: MissionIntelligence = {
    missionHealth: metric(checks.length, 6, "mission"),
    missionState,
    blockers,
    warnings,
    completedChecks: checks,
    recommendedAction,
    secondaryActions: findings.slice(1).map(({ finding }) => finding.action),
    supportingEvidence: aggregateEvidence(facts),
    explanation: blockers[0]?.reason ?? warnings[0]?.reason ?? recommendedAction.reason,
    lastEvaluated: facts.evaluatedAt,
    packetReadiness: metric(packetCompleted, 5, "packet-readiness"),
    timelineHealth: metric(timelineCompleted, 2, "timeline"),
    evidenceHealth: metric(evidenceCompleted, 2, "evidence"),
    reviewHealth: metric(reviewCompleted, 1, "review"),
  };

  assertExplainable(intelligence);
  return intelligence;
}

