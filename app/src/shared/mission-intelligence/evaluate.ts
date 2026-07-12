import { aggregateEvidence, type MissionFacts } from "./facts";
import { completedChecks, missionRules } from "./rules";
import type {
  MissionAction,
  MissionHealthMetric,
  MissionIntelligence,
  MissionState,
  MissionReadinessFactor,
} from "./types";

function metric(completed: number, total: number, subject: string): MissionHealthMetric {
  const score = total === 0 ? 0 : Math.round((completed / total) * 100);
  const readableSubject = subject.replaceAll("-", " ");
  return {
    score,
    status: score >= 80 ? "strong" : score >= 50 ? "attention" : "at_risk",
    completed,
    total,
    explanation: `${completed} of ${total} ${readableSubject} checks are complete.`,
  };
}

function readyAction(facts: MissionFacts): { state: MissionState; action: MissionAction } {
  const delivery = facts.delivery ?? { state: "draft" as const };
  if (delivery.state === "delivery_confirmed") {
    return { state: "Delivery Confirmed", action: { id: "view-confirmed-delivery", title: "View delivery record", priority: 130, reason: "A persisted delivery confirmation event completes the lifecycle.", targetTab: "packet", blocking: false, supportingEvidence: ["delivery:lifecycle"] } };
  }
  if (delivery.state === "delivered") {
    return { state: "Delivered", action: { id: "confirm-delivery", title: "Confirm delivery", priority: 120, reason: "Delivery is recorded, but confirmation has not been persisted.", targetTab: "packet", blocking: false, supportingEvidence: ["delivery:lifecycle"] } };
  }
  if (delivery.state === "approved_for_delivery") {
    return {
      state: "Ready To Deliver",
      action: {
        id: "record-delivery",
        title: "Record delivery",
        priority: 90,
        reason: "The generated packet has a persisted approval-for-delivery event.",
        targetTab: "packet",
        blocking: false,
        supportingEvidence: ["delivery:lifecycle"],
      },
    };
  }

  if (delivery.state === "packet_generated" || delivery.state === "under_review" || delivery.state === "changes_required") {
    const changes = delivery.state === "changes_required";
    return { state: "Needs Review", action: {
      id: changes ? "regenerate-packet" : delivery.state === "packet_generated" ? "mark-ready-for-review" : "complete-packet-review",
      title: changes ? "Generate packet" : delivery.state === "packet_generated" ? "Mark ready for review" : "Complete packet review",
      priority: 85,
      reason: changes ? "Persisted review feedback requires a new packet generation." : "A generated packet exists but has not been approved for delivery.",
      targetTab: "packet", blocking: false, supportingEvidence: ["delivery:lifecycle"],
    } };
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
  const evidenceCompleted = Number(facts.evidence.total > 0) + Number(facts.evidence.total > 0 && facts.evidence.deliveryReady === facts.evidence.total);
  const timelineCompleted = Number(facts.timeline.total > 0) + Number(facts.timeline.total > 0 && facts.timeline.linked === facts.timeline.total);
  const reviewCompleted = Number(facts.case.currentStatus === "ready_for_review");
  const missionState = primaryFinding?.state ?? ready.state;
  const blockers = findings.flatMap(({ finding }) => finding.blocker ? [finding.blocker] : []);
  const warnings = findings.flatMap(({ finding }) => finding.warning ? [finding.warning] : []);
  const readinessFactors: MissionReadinessFactor[] = [
    {
      id: "permit-number-recorded",
      label: "Permit identifier recorded",
      category: "identity",
      passed: Boolean(facts.case.permitNumber?.trim()),
      blocking: true,
      detail: facts.case.permitNumber?.trim()
        ? `Permit number ${facts.case.permitNumber} is recorded.`
        : "The jurisdiction permit number is missing.",
      supportingEvidence: ["case:permit-number"],
    },
    {
      id: "evidence-present",
      label: "Supporting evidence present",
      category: "evidence",
      passed: facts.evidence.total > 0,
      blocking: true,
      detail: `${facts.evidence.total} evidence record${facts.evidence.total === 1 ? " is" : "s are"} attached.`,
      supportingEvidence: ["aggregate:evidence"],
    },
    {
      id: "evidence-ready",
      label: "Evidence reviewed with provenance",
      category: "evidence",
      passed: facts.evidence.total > 0 && facts.evidence.deliveryReady === facts.evidence.total,
      blocking: true,
      detail: `${facts.evidence.deliveryReady} of ${facts.evidence.total} evidence records are verified and source-complete.`,
      supportingEvidence: ["aggregate:evidence"],
    },
    {
      id: "timeline-present",
      label: "Permit timeline assembled",
      category: "timeline",
      passed: facts.timeline.total > 0,
      blocking: true,
      detail: `${facts.timeline.total} permit event${facts.timeline.total === 1 ? " is" : "s are"} recorded.`,
      supportingEvidence: ["aggregate:timeline"],
    },
    {
      id: "timeline-supported",
      label: "Timeline linked to evidence",
      category: "timeline",
      passed: facts.timeline.total > 0 && facts.timeline.linked === facts.timeline.total,
      blocking: true,
      detail: `${facts.timeline.linked} of ${facts.timeline.total} permit events are linked to evidence.`,
      supportingEvidence: ["aggregate:timeline", "aggregate:evidence"],
    },
    {
      id: "review-recorded",
      label: "Operator review status recorded",
      category: "review",
      passed: facts.case.currentStatus === "ready_for_review",
      blocking: false,
      detail: facts.case.currentStatus === "ready_for_review"
        ? "The recorded lifecycle status has reached operator review."
        : `The recorded lifecycle status is ${facts.case.currentStatus}.`,
      supportingEvidence: ["case:status"],
    },
  ];
  const intelligence: MissionIntelligence = {
    missionHealth: metric(readinessFactors.filter((factor) => factor.passed).length, readinessFactors.length, "mission"),
    missionState,
    blockers,
    warnings,
    completedChecks: checks,
    recommendedAction,
    secondaryActions: findings.slice(1).map(({ finding }) => finding.action),
    supportingEvidence: aggregateEvidence(facts),
    explanation: blockers[0]?.reason ?? warnings[0]?.reason ?? recommendedAction.reason,
    lastEvaluated: facts.evaluatedAt,
    packetReadiness: metric(readinessFactors.slice(0, 5).filter((factor) => factor.passed).length, 5, "packet-readiness"),
    timelineHealth: metric(timelineCompleted, 2, "timeline"),
    evidenceHealth: metric(evidenceCompleted, 2, "evidence"),
    reviewHealth: metric(reviewCompleted, 1, "review"),
    readinessFactors,
    counts: {
      blockers: blockers.length,
      warnings: warnings.length,
      evidence: {
        total: facts.evidence.total,
        verified: facts.evidence.verified,
        unverified: facts.evidence.unverified,
        disputed: facts.evidence.disputed,
        provenanceIssues: Math.max(0, facts.evidence.total - facts.evidence.sourceComplete),
        sourceComplete: facts.evidence.sourceComplete,
        deliveryReady: facts.evidence.deliveryReady,
      },
      timeline: {
        total: facts.timeline.total,
        linked: facts.timeline.linked,
        unlinked: Math.max(0, facts.timeline.total - facts.timeline.linked),
      },
    },
  };

  assertExplainable(intelligence);
  return intelligence;
}
