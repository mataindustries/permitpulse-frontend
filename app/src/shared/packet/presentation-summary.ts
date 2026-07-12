import type {
  PacketEvidenceSummary,
  PacketModel,
  PacketTimelineSummary,
} from "./types";
import { evaluateMissionIntelligence } from "../mission-intelligence/evaluate";
import { buildMissionFacts } from "../mission-intelligence/facts";
import type { MissionHealthMetric, MissionIntelligence, MissionReadinessFactor } from "../mission-intelligence/types";

export const packetRendererVersion = 3 as const;

export type PacketDashboardTone = "strong" | "attention" | "at_risk";

export interface PacketDashboardMetric {
  completed: number;
  explanation: string;
  label: string;
  score: number;
  tone: PacketDashboardTone;
  total: number;
}

export interface PacketDashboardBlocker {
  id: string;
  resolution: string;
  title: string;
}

export interface PacketDashboardAction {
  detail: string;
  title: string;
}

export interface PacketDashboardEvidenceSummary {
  disputed: number;
  linked_timeline: number;
  source_complete: number;
  text: string;
  timeline_total: number;
  total: number;
  unverified: number;
  verified: number;
  provenance_issues: number;
}

export interface PacketDashboard {
  blockers: PacketDashboardBlocker[];
  evidence: PacketDashboardEvidenceSummary;
  integrity: string;
  lifecycle_status: string;
  mission_health: PacketDashboardMetric;
  permit_status: string;
  readiness: PacketDashboardMetric;
  recommended_action: PacketDashboardAction;
  reviewer_status: string;
  factors: MissionReadinessFactor[];
  warning_count: number;
}

function metric(value: MissionHealthMetric): PacketDashboardMetric {
  const tone = value.status;
  return {
    completed: value.completed,
    explanation: value.explanation,
    label: tone === "strong"
      ? "Strong"
      : tone === "attention"
        ? "Needs attention"
        : "At risk",
    score: value.score,
    tone,
    total: value.total,
  };
}

function readinessForPacket(model: PacketModel): MissionIntelligence {
  if (model.readiness) return model.readiness;

  return evaluateMissionIntelligence(buildMissionFacts({
    case: {
      id: `packet:${model.packet_version}`,
      permitNumber: model.permit_number,
      currentStatus: model.current_status.value,
      updatedAt: model.case_summary.updated_at,
    },
    evidence: model.evidence_summaries.map((item) => ({
      id: item.id,
      title: item.title,
      verificationStatus: item.verification_status,
      sourceComplete: item.source.complete,
    })),
    timeline: model.timeline_summaries.map((item) => ({
      id: item.id,
      title: item.title,
      timelineType: item.timeline_type,
      isCanonical: item.source_label === "Canonical",
      linkedEvidenceIds: item.linked_evidence.map((evidence) => evidence.source_id),
    })),
    evaluatedAt: model.generated_at,
  }));
}

function evidenceSummary(readiness: MissionIntelligence): PacketDashboardEvidenceSummary {
  const counts = readiness.counts;
  const { total, verified, unverified, disputed, sourceComplete, provenanceIssues } = counts.evidence;
  const timelineTotal = counts.timeline.total;
  const linkedTimeline = counts.timeline.linked;
  const evidenceText = total === 0
    ? "No evidence records are included in this packet edition."
    : `${total} evidence record${total === 1 ? "" : "s"}: ${verified} verified, ${unverified} unverified, and ${disputed} disputed. ${sourceComplete} ${sourceComplete === 1 ? "record has" : "records have"} complete provenance.`;
  const timelineText = timelineTotal === 0
    ? " No permit events are available for source linkage."
    : ` ${linkedTimeline} of ${timelineTotal} permit event${timelineTotal === 1 ? "" : "s"} ${timelineTotal === 1 ? "is" : "are"} linked to available evidence.`;

  return {
    disputed,
    linked_timeline: linkedTimeline,
    source_complete: sourceComplete,
    text: `${evidenceText}${timelineText}`,
    timeline_total: timelineTotal,
    total,
    unverified,
    verified,
    provenance_issues: provenanceIssues,
  };
}

function recommendedAction(
  model: PacketModel,
  blockers: PacketDashboardBlocker[],
  readiness: MissionIntelligence,
): PacketDashboardAction {
  if (blockers[0]) {
    return {
      title: readiness.recommendedAction.title,
      detail: readiness.recommendedAction.reason,
    };
  }
  const recordedAction = model.recommended_next_actions.items[0];
  if (recordedAction) {
    return {
      title: recordedAction.text,
      detail: "Reviewer-approved action recorded in this packet.",
    };
  }

  if (model.document_status === "approved") {
    return {
      title: "Proceed with the recorded delivery step.",
      detail: "This packet is approved for delivery under the persisted lifecycle state.",
    };
  }

  if (model.document_status === "delivered") {
    return {
      title: "Review the recorded delivery status.",
      detail: "Delivery of this packet has already been recorded.",
    };
  }

  if (model.current_status.value === "ready_for_review") {
    return {
      title: "Complete the packet review and quality checks.",
      detail: "The case record is marked ready for review; delivery approval has not been recorded.",
    };
  }

  return {
    title: "Complete the case review.",
    detail: "The assembled record has not yet reached ready-for-review status.",
  };
}

export function packetDashboard(model: PacketModel): PacketDashboard {
  const readiness = readinessForPacket(model);
  const evidence = evidenceSummary(readiness);
  const blockers = readiness.blockers.map((blocker) => ({
    id: blocker.id,
    title: blocker.title,
    resolution: blocker.recommendedResolution,
  }));
  const lifecycleStatus = model.document_status === "approved"
    ? "Approved for delivery"
    : model.document_status === "delivered"
      ? "Delivered"
      : "Draft packet";
  const reviewerStatus = blockers.length > 0
    ? `Blocked — ${blockers.length} readiness condition${blockers.length === 1 ? "" : "s"}`
    : model.document_status === "approved" || model.document_status === "delivered"
    ? "Reviewer approved"
    : readiness.missionState;

  return {
    blockers,
    evidence,
    integrity: `Presentation v${model.presentation_version} · renderer v${packetRendererVersion} · case snapshot v${model.packet_version}`,
    lifecycle_status: lifecycleStatus,
    mission_health: metric(readiness.missionHealth),
    permit_status: readiness.missionState,
    readiness: metric(readiness.packetReadiness),
    recommended_action: recommendedAction(model, blockers, readiness),
    reviewer_status: reviewerStatus,
    factors: readiness.readinessFactors,
    warning_count: readiness.counts.warnings,
  };
}

export function packetEvidenceMissingDetails(
  evidence: PacketEvidenceSummary,
): string[] {
  const missing: string[] = [];

  if (!evidence.source.label?.trim()) missing.push("source label");
  if (!evidence.source.date) missing.push("source date");
  if (!evidence.source.url) missing.push("digital provenance");

  return missing;
}

export function packetTimelineReviewLabel(
  entry: PacketTimelineSummary,
): "Evidence confirmed" | "Review pending" {
  return entry.information_class === "confirmed_fact"
    ? "Evidence confirmed"
    : "Review pending";
}

export function packetTimelineChronology(
  model: PacketModel,
): PacketTimelineSummary[] {
  return [...model.timeline_summaries].reverse();
}
