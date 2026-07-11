import type {
  PacketEvidenceSummary,
  PacketModel,
  PacketTimelineSummary,
} from "./types";

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
}

function metric(
  completed: number,
  total: number,
  subject: string,
): PacketDashboardMetric {
  const score = total === 0 ? 0 : Math.round((completed / total) * 100);
  const tone: PacketDashboardTone = score >= 80
    ? "strong"
    : score >= 50
      ? "attention"
      : "at_risk";

  return {
    completed,
    explanation: `${completed} of ${total} deterministic ${subject} checks pass.`,
    label: tone === "strong"
      ? "Strong"
      : tone === "attention"
        ? "Needs attention"
        : "At risk",
    score,
    tone,
    total,
  };
}

function evidenceCounts(model: PacketModel): PacketDashboardEvidenceSummary {
  const verified = model.evidence_summaries.filter(
    (item) => item.verification_status === "verified",
  ).length;
  const unverified = model.evidence_summaries.filter(
    (item) => item.verification_status === "unverified",
  ).length;
  const disputed = model.evidence_summaries.filter(
    (item) => item.verification_status === "disputed",
  ).length;
  const sourceComplete = model.evidence_summaries.filter(
    (item) => item.source.complete,
  ).length;
  const linkedTimeline = model.timeline_summaries.filter(
    (item) =>
      item.linked_evidence.length > 0 &&
      item.missing_evidence_reference_count === 0,
  ).length;
  const total = model.evidence_summaries.length;
  const timelineTotal = model.timeline_summaries.length;
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
  };
}

function dashboardBlockers(
  model: PacketModel,
  evidence: PacketDashboardEvidenceSummary,
): PacketDashboardBlocker[] {
  const blockers: PacketDashboardBlocker[] = [];

  if (!model.permit_number?.trim()) {
    blockers.push({
      id: "permit-number",
      title: "Permit identifier is missing",
      resolution: "Record the jurisdiction permit number before relying on the packet for file identification.",
    });
  }

  if (model.current_status.value === "needs_information") {
    blockers.push({
      id: "case-needs-information",
      title: "Outstanding case information",
      resolution: "Resolve the information need recorded in the current case status.",
    });
  }

  if (evidence.total === 0) {
    blockers.push({
      id: "evidence-empty",
      title: "No supporting evidence",
      resolution: "Add the first source record before presenting a permit history.",
    });
  } else if (evidence.disputed > 0) {
    blockers.push({
      id: "evidence-disputed",
      title: `${evidence.disputed} disputed evidence record${evidence.disputed === 1 ? "" : "s"}`,
      resolution: "Resolve or replace disputed sources before relying on them.",
    });
  }

  const deliveryReadyEvidence = model.evidence_summaries.filter(
    (item) => item.verification_status === "verified" && item.source.complete,
  ).length;

  if (evidence.total > 0 && deliveryReadyEvidence < evidence.total) {
    const count = evidence.total - deliveryReadyEvidence;
    blockers.push({
      id: "evidence-readiness",
      title: `${count} evidence record${count === 1 ? " needs" : "s need"} verification or provenance`,
      resolution: "Verify each source and complete its source label, date, and digital provenance.",
    });
  }

  if (evidence.timeline_total === 0) {
    blockers.push({
      id: "timeline-empty",
      title: "Permit history is not assembled",
      resolution: "Add the first dated permit event and connect it to its source.",
    });
  } else if (evidence.linked_timeline < evidence.timeline_total) {
    const count = evidence.timeline_total - evidence.linked_timeline;
    blockers.push({
      id: "timeline-linkage",
      title: `${count} permit event${count === 1 ? " lacks" : "s lack"} evidence linkage`,
      resolution: "Connect each event to the evidence record that supports it.",
    });
  }

  return blockers;
}

function recommendedAction(
  model: PacketModel,
  blockers: PacketDashboardBlocker[],
): PacketDashboardAction {
  const recordedAction = model.recommended_next_actions.items[0];

  if (recordedAction) {
    return {
      title: recordedAction.text,
      detail: recordedAction.reviewer_approved
        ? "Reviewer-approved action recorded in this packet."
        : "Recorded action remains subject to reviewer approval.",
    };
  }

  if (blockers[0]) {
    return {
      title: blockers[0].resolution,
      detail: `Addresses the highest-priority packet condition: ${blockers[0].title}.`,
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
  const evidence = evidenceCounts(model);
  const deliveryReadyEvidence = model.evidence_summaries.length > 0 &&
    model.evidence_summaries.every(
      (item) => item.verification_status === "verified" && item.source.complete,
    );
  const timelineLinked = model.timeline_summaries.length > 0 &&
    model.timeline_summaries.every(
      (item) =>
        item.linked_evidence.length > 0 &&
        item.missing_evidence_reference_count === 0,
    );
  const checks = [
    Boolean(model.permit_number?.trim()),
    model.evidence_summaries.length > 0,
    deliveryReadyEvidence,
    model.timeline_summaries.length > 0,
    timelineLinked,
    model.current_status.value === "ready_for_review",
  ];
  const packetChecks = checks.slice(0, 5);
  const blockers = dashboardBlockers(model, evidence);
  const lifecycleStatus = model.document_status === "approved"
    ? "Approved for delivery"
    : model.document_status === "delivered"
      ? "Delivered"
      : "Draft packet";
  const reviewerStatus = model.document_status === "approved" || model.document_status === "delivered"
    ? "Reviewer approved"
    : model.current_status.value === "ready_for_review"
      ? "Ready for review"
      : "Review pending";

  return {
    blockers,
    evidence,
    integrity: `Presentation v${model.presentation_version} · renderer v${packetRendererVersion} · case snapshot v${model.packet_version}`,
    lifecycle_status: lifecycleStatus,
    mission_health: metric(
      checks.filter(Boolean).length,
      checks.length,
      "mission",
    ),
    permit_status: model.current_status.label,
    readiness: metric(
      packetChecks.filter(Boolean).length,
      packetChecks.length,
      "packet-readiness",
    ),
    recommended_action: recommendedAction(model, blockers),
    reviewer_status: reviewerStatus,
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
