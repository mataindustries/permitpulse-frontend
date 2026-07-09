import {
  packetDisclaimer,
  packetDraftNotice,
  packetPlaceholderNote,
  packetTitle,
  type BuildPacketModelInput,
  type PacketActivityAction,
  type PacketCaseStatus,
  type PacketEvidenceSummary,
  type PacketEvidenceType,
  type PacketModel,
  type PacketTimelineSummary,
  type PacketTimelineType,
  type PacketVerificationStatus,
} from "./types";

const caseStatusLabels: Record<PacketCaseStatus, string> = {
  intake: "Intake",
  researching: "Researching",
  needs_information: "Needs information",
  ready_for_review: "Ready for review",
};

const evidenceTypeLabels: Record<PacketEvidenceType, string> = {
  document: "Document",
  portal: "Portal",
  email: "Email",
  phone_call: "Phone call",
  meeting: "Meeting",
  inspection: "Inspection",
  code_reference: "Code reference",
  photo: "Photo",
  other: "Other",
};

const verificationStatusLabels: Record<PacketVerificationStatus, string> = {
  unverified: "Unverified",
  verified: "Verified",
  disputed: "Disputed",
};

const timelineTypeLabels: Record<PacketTimelineType, string> = {
  submission: "Submission",
  resubmission: "Resubmission",
  correction: "Correction",
  reviewer_contact: "Reviewer contact",
  applicant_contact: "Applicant contact",
  inspection: "Inspection",
  approval: "Approval",
  rejection: "Rejection",
  status_update: "Status update",
  deadline: "Deadline",
  other: "Other",
};

const activityActionLabels: Record<PacketActivityAction, string> = {
  case_created: "Case created",
  case_updated: "Case details updated",
  case_status_changed: "Status changed",
};

const activityFieldLabels: Record<string, string> = {
  project_name: "Project name",
  client_name: "Client name",
  address: "Address",
  city: "City",
  jurisdiction: "Jurisdiction",
  permit_number: "Permit number",
  current_status: "Current status",
};

function verificationNote(status: PacketVerificationStatus): string {
  if (status === "verified") {
    return "Marked verified.";
  }

  if (status === "disputed") {
    return "Disputed evidence. Do not treat as confirmed.";
  }

  return "Unverified evidence. Do not treat as confirmed.";
}

function generatedTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
}

function compareDesc(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? 1 : -1;
}

function compareEvidence(
  left: BuildPacketModelInput["evidence"][number],
  right: BuildPacketModelInput["evidence"][number],
): number {
  return (
    compareDesc(left.source_date ?? "", right.source_date ?? "") ||
    compareDesc(left.created_at, right.created_at) ||
    compareDesc(left.id, right.id)
  );
}

function compareTimeline(
  left: BuildPacketModelInput["timeline"][number],
  right: BuildPacketModelInput["timeline"][number],
): number {
  return (
    compareDesc(left.occurred_on, right.occurred_on) ||
    compareDesc(left.created_at, right.created_at) ||
    compareDesc(left.id, right.id)
  );
}

function compareActivity(
  left: NonNullable<BuildPacketModelInput["activityResponse"]>["activity"][number],
  right: NonNullable<BuildPacketModelInput["activityResponse"]>["activity"][number],
): number {
  return compareDesc(left.created_at, right.created_at) || compareDesc(left.id, right.id);
}

function evidenceSummary(
  item: BuildPacketModelInput["evidence"][number],
): PacketEvidenceSummary {
  return {
    id: item.id,
    evidence_type: item.evidence_type,
    evidence_type_label: evidenceTypeLabels[item.evidence_type],
    title: item.title,
    summary: item.summary,
    source: {
      label: item.source_label,
      url: item.source_url,
      date: item.source_date,
    },
    verification_status: item.verification_status,
    verification_label: verificationStatusLabels[item.verification_status],
    verification_note: verificationNote(item.verification_status),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function buildPacketModel({
  activityResponse,
  caseRecord,
  evidence,
  generatedAt,
  timeline,
}: BuildPacketModelInput): PacketModel {
  const sortedEvidence = [...evidence].sort(compareEvidence);
  const evidenceSummaries = sortedEvidence.map(evidenceSummary);
  const evidenceById = new Map(
    sortedEvidence.map((item, index) => [item.id, evidenceSummaries[index]]),
  );

  const timelineSummaries: PacketTimelineSummary[] = [...timeline]
    .sort(compareTimeline)
    .map((entry) => {
      const linkedEvidence = entry.evidence_ids
        .map((id) => evidenceById.get(id))
        .filter((item): item is PacketEvidenceSummary => Boolean(item))
        .map((item) => ({
          title: item.title,
          verification_label: item.verification_label,
        }));

      return {
        id: entry.id,
        occurred_on: entry.occurred_on,
        timeline_type: entry.timeline_type,
        timeline_type_label: timelineTypeLabels[entry.timeline_type],
        title: entry.title,
        details: entry.details,
        source_label: entry.is_canonical ? "Canonical" : "Contributed",
        linked_evidence: linkedEvidence,
        missing_evidence_reference_count:
          entry.evidence_ids.length - linkedEvidence.length,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      };
    });

  return {
    title: packetTitle,
    generated_at: generatedTimestamp(generatedAt),
    draft_notice: packetDraftNotice,
    case_summary: {
      project_name: caseRecord.project_name,
      client_name: caseRecord.client_name,
      address: caseRecord.address,
      city: caseRecord.city,
      created_at: caseRecord.created_at,
      updated_at: caseRecord.updated_at,
      version: caseRecord.version,
    },
    current_status: {
      value: caseRecord.current_status,
      label: caseStatusLabels[caseRecord.current_status],
    },
    jurisdiction: caseRecord.jurisdiction,
    permit_number: caseRecord.permit_number,
    evidence_summaries: evidenceSummaries,
    timeline_summaries: timelineSummaries,
    recent_activity_summaries: [...(activityResponse?.activity ?? [])]
      .sort(compareActivity)
      .map((entry) => ({
        id: entry.id,
        action: entry.action,
        action_label: activityActionLabels[entry.action],
        actor_label: entry.actor?.name?.trim() || "System",
        changed_field_labels: entry.changed_fields
          .filter((field) => field in activityFieldLabels)
          .map((field) => activityFieldLabels[field]),
        created_at: entry.created_at,
        from_status_label: entry.from_status
          ? caseStatusLabels[entry.from_status]
          : null,
        to_status_label: entry.to_status ? caseStatusLabels[entry.to_status] : null,
      })),
    open_questions: {
      note: packetPlaceholderNote,
      instruction:
        "Add reviewer-verified open questions manually before sending.",
    },
    recommended_next_actions: {
      note: packetPlaceholderNote,
      instruction:
        "Add reviewer-approved next actions manually before sending.",
    },
    disclaimer: packetDisclaimer,
  };
}
