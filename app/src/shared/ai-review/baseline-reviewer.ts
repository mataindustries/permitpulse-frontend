import type { PacketModel } from "../packet/types";
import type { PacketReviewDraft } from "./types";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function missingInformation(packet: PacketModel): string[] {
  const missing: string[] = [];

  if (!packet.permit_number) {
    missing.push("Permit number is not provided.");
  }

  if (packet.evidence_summaries.length === 0) {
    missing.push("No evidence records are available in the packet.");
  }

  if (packet.timeline_summaries.length === 0) {
    missing.push("No permit timeline records are available in the packet.");
  }

  if (packet.recent_activity_summaries.length === 0) {
    missing.push("No recent case activity records are available in the packet.");
  }

  if (!/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)\b/i.test(
    packet.case_summary.address,
  )) {
    missing.push("Complete project address may be missing.");
  }

  for (const evidence of packet.evidence_summaries) {
    if (!evidence.source.url) {
      missing.push(`Source URL is not provided for evidence "${evidence.title}".`);
    }
    if (!evidence.source.date) {
      missing.push(`Source date is not provided for evidence "${evidence.title}".`);
    }
    if (!evidence.source.label) {
      missing.push(`Source label is not provided for evidence "${evidence.title}".`);
    }
  }

  const missingTimelineLinks = packet.timeline_summaries.reduce(
    (count, item) => count + item.missing_evidence_reference_count,
    0,
  );

  if (missingTimelineLinks > 0) {
    missing.push("Timeline evidence link reference is not loaded in the packet.");
  }

  return unique(missing);
}

function confidenceNotes(packet: PacketModel): string[] {
  const notes: string[] = [
    "This local baseline uses deterministic packet fields only.",
    "No live model, external service, or agency lookup was used.",
  ];

  const unconfirmedEvidence = packet.evidence_summaries.filter(
    (item) => item.verification_status !== "verified",
  );

  if (unconfirmedEvidence.length > 0) {
    notes.push(
      `Treat ${unconfirmedEvidence.length} unconfirmed or disputed evidence record as needing human review.`,
    );
  }

  const missingTimelineLinks = packet.timeline_summaries.reduce(
    (count, item) => count + item.missing_evidence_reference_count,
    0,
  );

  if (missingTimelineLinks > 0) {
    notes.push(
      `${missingTimelineLinks} timeline evidence link reference is not loaded in this packet.`,
    );
  }

  return notes;
}

export function createBaselinePacketReviewDraft(
  packet: PacketModel,
): PacketReviewDraft {
  const evidenceCount = packet.evidence_summaries.length;
  const timelineCount = packet.timeline_summaries.length;
  const activityCount = packet.recent_activity_summaries.length;

  return {
    summary: [
      `Project "${packet.case_summary.project_name}" is in ${packet.current_status.label}.`,
      `Jurisdiction is ${packet.jurisdiction}.`,
      `Packet contains ${evidenceCount} evidence record(s), ${timelineCount} timeline record(s), and ${activityCount} recent activity record(s).`,
    ].join(" "),
    missing_information: missingInformation(packet),
    recommended_next_actions: [
      "Review missing fields before relying on the packet.",
      "Compare evidence, timeline, and recent activity for consistency.",
      "Ask a human reviewer to confirm jurisdiction-specific requirements before sending.",
    ],
    evidence_citations: [
      ...packet.evidence_summaries.map((item) => ({
        source_type: "evidence" as const,
        record_id: item.id,
        note: `Evidence record "${item.title}" is included in the packet.`,
      })),
      ...packet.timeline_summaries.map((item) => ({
        source_type: "timeline" as const,
        record_id: item.id,
        note: `Timeline record "${item.title}" is included in the packet.`,
      })),
      ...packet.recent_activity_summaries.map((item) => ({
        source_type: "activity" as const,
        record_id: item.id,
        note: `Activity record "${item.action_label}" is included in the packet.`,
      })),
    ],
    unsupported_claims: [],
    confidence_notes: confidenceNotes(packet),
    model_metadata: {
      reviewer: "deterministic-baseline",
      generated_at: packet.generated_at,
      local_only: true,
      version: "2026-07-09",
    },
  };
}
