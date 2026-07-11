import {
  formatPacketDateOnly,
  formatPacketDateTime,
  packetStatusLabel,
  packetStatusNotice,
} from "./presentation";
import {
  packetDisclaimer,
  packetPresentationVersion,
  packetSectionOrder,
  packetTitle,
  type BuildPacketModelInput,
  type PacketActivityAction,
  type PacketCaseStatus,
  type PacketEvidenceSummary,
  type PacketEvidenceType,
  type PacketFinding,
  type PacketMissingInformation,
  type PacketModel,
  type PacketOpenQuestion,
  type PacketPresentationWarning,
  type PacketRecommendedAction,
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
  portal: "Portal record",
  email: "Email",
  phone_call: "Phone call",
  meeting: "Meeting",
  inspection: "Inspection",
  code_reference: "Code reference",
  photo: "Photo",
  other: "Other source",
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
  other: "Other event",
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
    return "Reviewer verification is recorded for this evidence.";
  }

  if (status === "disputed") {
    return "This information is disputed and is not presented as confirmed.";
  }

  return "This evidence has not been verified and is not presented as confirmed.";
}

function evidenceInformationClass(
  status: PacketVerificationStatus,
): PacketEvidenceSummary["information_class"] {
  if (status === "verified") {
    return "confirmed_fact";
  }

  if (status === "disputed") {
    return "disputed_information";
  }

  return "unverified_evidence";
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
  let sourceUrl: string | null = null;

  if (item.source_url) {
    try {
      const parsed = new URL(item.source_url);
      sourceUrl = parsed.protocol === "http:" || parsed.protocol === "https:"
        ? parsed.toString()
        : null;
    } catch {
      sourceUrl = null;
    }
  }
  const sourceComplete = Boolean(
    item.source_label?.trim() && sourceUrl && item.source_date,
  );

  return {
    id: item.id,
    evidence_type: item.evidence_type,
    evidence_type_label: evidenceTypeLabels[item.evidence_type],
    title: item.title,
    summary: item.summary,
    source: {
      label: item.source_label,
      url: sourceUrl,
      date: item.source_date,
      date_label: formatPacketDateOnly(item.source_date),
      complete: sourceComplete,
    },
    verification_status: item.verification_status,
    verification_label: verificationStatusLabels[item.verification_status],
    verification_note: verificationNote(item.verification_status),
    information_class: evidenceInformationClass(item.verification_status),
    created_at: item.created_at,
    created_at_label: formatPacketDateTime(item.created_at).label,
    updated_at: item.updated_at,
    updated_at_label: formatPacketDateTime(item.updated_at).label,
  };
}

function missingInformation(input: {
  caseRecord: BuildPacketModelInput["caseRecord"];
  evidence: PacketEvidenceSummary[];
  timeline: PacketTimelineSummary[];
}): PacketMissingInformation[] {
  const missing: PacketMissingInformation[] = [];

  if (!input.caseRecord.permit_number?.trim()) {
    missing.push({
      id: "permit-number",
      title: "Permit number not provided",
      reason: "A permit number has not been recorded for this case.",
      information_class: "missing_information",
    });
  }

  if (input.evidence.length === 0) {
    missing.push({
      id: "evidence-register",
      title: "Evidence register is empty",
      reason: "No evidence records are available for this packet.",
      information_class: "missing_information",
    });
  }

  if (input.timeline.length === 0) {
    missing.push({
      id: "permit-timeline",
      title: "Permit timeline is empty",
      reason: "No permit timeline events are available for this packet.",
      information_class: "missing_information",
    });
  }

  return missing;
}

function presentationWarnings(
  evidence: PacketEvidenceSummary[],
): PacketPresentationWarning[] {
  const warnings: PacketPresentationWarning[] = [];
  const unverified = evidence.filter((item) => item.verification_status === "unverified");
  const disputed = evidence.filter((item) => item.verification_status === "disputed");

  if (unverified.length > 0) {
    warnings.push({
      id: "unverified-evidence",
      text: `${unverified.length} evidence record${unverified.length === 1 ? " is" : "s are"} labeled unverified.`,
      information_class: "warning",
    });
  }

  if (disputed.length > 0) {
    warnings.push({
      id: "disputed-evidence",
      text: `${disputed.length} evidence record${disputed.length === 1 ? " is" : "s are"} labeled disputed.`,
      information_class: "warning",
    });
  }

  return warnings;
}

function findingClass(item: PacketFinding): PacketFinding["information_class"] {
  return item.grounded && item.reviewer_approved
    ? "reviewer_approved_finding"
    : "warning";
}

export function buildPacketModel({
  activityResponse,
  caseRecord,
  documentStatus = "draft",
  editorialContent,
  evidence,
  generatedAt,
  timeline,
}: BuildPacketModelInput): PacketModel {
  const generated = formatPacketDateTime(generatedAt);
  const sortedEvidence = [...evidence].sort(compareEvidence);
  const evidenceSummaries = sortedEvidence.map(evidenceSummary);
  const evidenceById = new Map(
    evidenceSummaries.map((item) => [item.id, item]),
  );

  const timelineSummaries: PacketTimelineSummary[] = [...timeline]
    .sort(compareTimeline)
    .map((entry) => {
      const linkedEvidence = entry.evidence_ids
        .map((id) => evidenceById.get(id))
        .filter((item): item is PacketEvidenceSummary => Boolean(item))
        .map((item) => ({
          source_id: item.id,
          title: item.title,
          verification_label: item.verification_label,
        }));
      const supportingEvidence = entry.evidence_ids
        .map((id) => evidenceById.get(id))
        .filter((item): item is PacketEvidenceSummary => Boolean(item));
      const isConfirmed =
        entry.is_canonical &&
        supportingEvidence.length > 0 &&
        supportingEvidence.every(
          (item) => item.verification_status === "verified" && item.source.complete,
        ) &&
        supportingEvidence.length === entry.evidence_ids.length;

      return {
        id: entry.id,
        occurred_on: entry.occurred_on,
        occurred_on_label: formatPacketDateOnly(entry.occurred_on),
        timeline_type: entry.timeline_type,
        timeline_type_label: timelineTypeLabels[entry.timeline_type],
        title: entry.title,
        details: entry.details,
        source_label: entry.is_canonical ? "Canonical" : "Contributed",
        linked_evidence: linkedEvidence,
        missing_evidence_reference_count:
          entry.evidence_ids.length - linkedEvidence.length,
        information_class: isConfirmed ? "confirmed_fact" : "unverified_evidence",
        created_at: entry.created_at,
        created_at_label: formatPacketDateTime(entry.created_at).label,
        updated_at: entry.updated_at,
        updated_at_label: formatPacketDateTime(entry.updated_at).label,
      };
    });

  const findings: PacketFinding[] = (editorialContent?.findings ?? []).map(
    (item) => {
      const finding: PacketFinding = {
        id: item.id,
        text: item.text.trim(),
        title: item.title,
        severity: item.severity,
        finding_type: item.finding_type,
        confidence: item.confidence,
        recommended_resolution: item.recommended_resolution,
        supporting_source_ids: [...item.supporting_source_ids],
        grounded: item.grounded,
        reviewer_approved: item.reviewer_approved,
        information_class: "warning",
      };
      finding.information_class = findingClass(finding);
      return finding;
    },
  );
  const openQuestions: PacketOpenQuestion[] = (
    editorialContent?.openQuestions ?? []
  ).map((item) => ({
    id: item.id,
    text: item.text.trim(),
    reviewer_approved: item.reviewer_approved,
    information_class: "missing_information",
  }));
  const nextActions: PacketRecommendedAction[] = (
    editorialContent?.recommendedNextActions ?? []
  ).map((item) => ({
    id: item.id,
    text: item.text.trim(),
    supporting_source_ids: [...item.supporting_source_ids],
    reviewer_approved: item.reviewer_approved,
    information_class: item.reviewer_approved ? "approved_next_action" : "warning",
  }));
  const evidenceCount = evidenceSummaries.length;
  const timelineCount = timelineSummaries.length;

  return {
    presentation_version: packetPresentationVersion,
    section_order: [...packetSectionOrder],
    title: packetTitle,
    packet_version: caseRecord.version,
    generated_at: generated.raw,
    generated_at_label: generated.label,
    document_status: documentStatus,
    document_status_label: packetStatusLabel(documentStatus),
    is_internal_draft: false,
    draft_notice: packetStatusNotice(documentStatus),
    executive_summary: {
      text: findings.filter((item) => item.reviewer_approved).map((item) => item.text).join(" ") || `This packet assembles ${evidenceCount} evidence record${evidenceCount === 1 ? "" : "s"} and ${timelineCount} permit timeline event${timelineCount === 1 ? "" : "s"} for ${caseRecord.project_name}. The recorded case status is ${caseStatusLabels[caseRecord.current_status]}.`,
      information_class: "client_provided_information",
      supporting_source_ids: [
        ...evidenceSummaries.map((item) => item.id),
        ...timelineSummaries.map((item) => item.id),
      ],
      key_risks: findings.filter((item) => item.reviewer_approved && item.finding_type === "risk").map((item) => item.title ?? item.text),
      key_strengths: findings.filter((item) => item.reviewer_approved && item.finding_type === "strength").map((item) => item.title ?? item.text),
    },
    case_summary: {
      project_name: caseRecord.project_name,
      client_name: caseRecord.client_name,
      address: caseRecord.address,
      city: caseRecord.city,
      created_at: caseRecord.created_at,
      created_at_label: formatPacketDateTime(caseRecord.created_at).label,
      updated_at: caseRecord.updated_at,
      updated_at_label: formatPacketDateTime(caseRecord.updated_at).label,
      version: caseRecord.version,
      information_class: "client_provided_information",
    },
    case_overview: [
      { id: "project-name", label: "Project", value: caseRecord.project_name, information_class: "client_provided_information" },
      { id: "client-name", label: "Client", value: caseRecord.client_name, information_class: "client_provided_information" },
      { id: "address", label: "Address", value: [caseRecord.address, caseRecord.city].filter(Boolean).join(", "), information_class: "client_provided_information" },
      { id: "jurisdiction", label: "Jurisdiction", value: caseRecord.jurisdiction, information_class: "client_provided_information" },
      { id: "permit-number", label: "Permit number", value: caseRecord.permit_number ?? "Not provided", information_class: caseRecord.permit_number ? "client_provided_information" : "missing_information" },
      { id: "packet-version", label: "Packet version", value: String(caseRecord.version), information_class: "confirmed_fact" },
    ],
    current_status: {
      value: caseRecord.current_status,
      label: caseStatusLabels[caseRecord.current_status],
      information_class: "client_provided_information",
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
        created_at_label: formatPacketDateTime(entry.created_at).label,
        from_status_label: entry.from_status
          ? caseStatusLabels[entry.from_status]
          : null,
        to_status_label: entry.to_status ? caseStatusLabels[entry.to_status] : null,
        client_visible: false,
      })),
    findings: {
      items: findings,
      empty_message: "No reviewer-approved findings are included in this packet.",
    },
    open_questions: {
      items: openQuestions,
      empty_message: "No reviewer-approved open questions are recorded.",
    },
    recommended_next_actions: {
      items: nextActions,
      empty_message: "No reviewer-approved next actions are recorded.",
    },
    supporting_sources: evidenceSummaries.map((item) => ({
      id: item.id,
      title: item.title,
      label: item.source.label ?? "Source label not provided",
      url: item.source.url,
      date_label: item.source.date_label,
      verification_label: item.verification_label,
      information_class: item.information_class,
    })),
    missing_information: missingInformation({
      caseRecord,
      evidence: evidenceSummaries,
      timeline: timelineSummaries,
    }),
    warnings: presentationWarnings(evidenceSummaries),
    unsupported_claims: [...(editorialContent?.unsupportedClaims ?? [])].map((item) => item.trim()).filter(Boolean),
    disclaimer: packetDisclaimer,
  };
}
