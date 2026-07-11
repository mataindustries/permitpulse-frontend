import {
  packetSectionOrder,
  type PacketDocumentStatus,
  type PacketPresentationModel,
  type PacketSectionId,
} from "./types";

const sectionTitles: Record<PacketSectionId, string> = {
  executive_summary: "Executive Summary",
  case_overview: "Case Overview",
  current_status: "Current Status",
  evidence_register: "Evidence Register",
  permit_timeline: "Permit Timeline",
  findings: "Findings",
  open_questions: "Open Questions",
  recommended_next_actions: "Recommended Next Actions",
  supporting_sources: "Supporting Sources",
  disclaimer: "Disclaimer",
};

export function packetSectionTitle(section: PacketSectionId): string {
  return sectionTitles[section];
}

export function packetSectionNumber(section: PacketSectionId): string {
  return String(packetSectionOrder.indexOf(section) + 1).padStart(2, "0");
}

export function formatPacketDateTime(value: Date | string): {
  raw: string;
  label: string;
} {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { raw: "", label: "Date not available" };
  }

  return {
    raw: date.toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date),
  };
}

export function formatPacketDateOnly(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export function packetStatusLabel(
  status: PacketDocumentStatus,
): PacketPresentationModel["document_status_label"] {
  if (status === "approved") {
    return "APPROVED";
  }

  if (status === "delivered") {
    return "DELIVERED";
  }

  return "DRAFT";
}

export function packetStatusNotice(status: PacketDocumentStatus): string {
  if (status === "approved") {
    return "Approved for delivery following reviewer quality checks.";
  }

  if (status === "delivered") {
    return "Delivery of this packet has been recorded.";
  }

  return "Prepared for client review. Confirm source records and jurisdiction requirements before delivery.";
}

export function packetDocumentStatusForDeliveryState(
  state:
    | "draft"
    | "packet_generated"
    | "under_review"
    | "changes_required"
    | "approved_for_delivery"
    | "delivered"
    | "delivery_confirmed",
): PacketDocumentStatus {
  if (state === "delivered" || state === "delivery_confirmed") {
    return "delivered";
  }

  if (state === "approved_for_delivery") {
    return "approved";
  }

  return "draft";
}

export function withPacketDocumentStatus(
  model: PacketPresentationModel,
  status: PacketDocumentStatus,
): PacketPresentationModel {
  return {
    ...model,
    document_status: status,
    document_status_label: packetStatusLabel(status),
    draft_notice: packetStatusNotice(status),
  };
}

export function isPacketPresentationModel(
  value: unknown,
): value is PacketPresentationModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PacketPresentationModel>;

  return (
    candidate.presentation_version === 2 &&
    Array.isArray(candidate.section_order) &&
    candidate.section_order.join("|") === packetSectionOrder.join("|") &&
    typeof candidate.generated_at_label === "string" &&
    typeof candidate.disclaimer === "string" &&
    typeof candidate.findings === "object" &&
    candidate.findings !== null &&
    Array.isArray(candidate.findings.items)
  );
}

export function packetVisibleText(model: PacketPresentationModel): string[] {
  return [
    model.title,
    model.generated_at_label,
    model.document_status_label,
    model.draft_notice,
    model.executive_summary.text,
    ...model.warnings.map((item) => item.text),
    ...model.case_overview.flatMap((item) => [item.label, item.value]),
    model.current_status.label,
    ...model.evidence_summaries.flatMap((item) => [
      item.title,
      item.summary,
      item.evidence_type_label,
      item.verification_label,
      item.verification_note,
      item.source.label ?? "",
      item.source.url ?? "",
      item.source.date_label,
    ]),
    ...model.timeline_summaries.flatMap((item) => [
      item.occurred_on_label,
      item.timeline_type_label,
      item.title,
      item.details,
      item.source_label,
      ...item.linked_evidence.flatMap((evidence) => [
        evidence.title,
        evidence.verification_label,
      ]),
    ]),
    ...model.findings.items.map((item) => item.text),
    model.findings.empty_message,
    ...model.open_questions.items.map((item) => item.text),
    model.open_questions.empty_message,
    ...model.recommended_next_actions.items.map((item) => item.text),
    model.recommended_next_actions.empty_message,
    ...model.supporting_sources.flatMap((item) => [
      item.title,
      item.label,
      item.url ?? "",
      item.date_label,
      item.verification_label,
    ]),
    model.disclaimer,
  ];
}
