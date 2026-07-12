import type { MissionSupportingEvidence } from "./types";

export type IntelligenceCaseStatus =
  | "intake"
  | "researching"
  | "needs_information"
  | "ready_for_review";

export interface MissionEvidenceFact {
  id: string;
  title: string;
  verificationStatus: "unverified" | "verified" | "disputed";
  sourceComplete: boolean;
}

export interface MissionTimelineFact {
  id: string;
  title: string;
  timelineType:
    | "submission"
    | "resubmission"
    | "correction"
    | "reviewer_contact"
    | "applicant_contact"
    | "inspection"
    | "approval"
    | "rejection"
    | "status_update"
    | "deadline"
    | "other";
  isCanonical: boolean;
  linkedEvidenceIds: string[];
}

export interface MissionFacts {
  case: {
    id: string;
    permitNumber: string | null;
    currentStatus: IntelligenceCaseStatus;
    updatedAt: string;
  };
  evidence: {
    total: number;
    verified: number;
    unverified: number;
    disputed: number;
    sourceComplete: number;
    deliveryReady: number;
    records: MissionEvidenceFact[];
  };
  timeline: {
    total: number;
    linked: number;
    canonicalApprovalLinkedToVerifiedEvidence: boolean;
    records: MissionTimelineFact[];
  };
  delivery?: {
    state: "draft" | "packet_generated" | "under_review" | "changes_required" | "approved_for_delivery" | "delivered" | "delivery_confirmed";
    latestEventId: string | null;
    latestEventType: string | null;
    packetGenerationId: string | null;
  };
  evaluatedAt: string;
}

export interface MissionFactsRecordInput {
  case: MissionFacts["case"];
  evidence: MissionEvidenceFact[];
  timeline: MissionTimelineFact[];
  delivery?: MissionFacts["delivery"];
  evaluatedAt: string;
}

export function isCompleteEvidenceSource(input: {
  label: string | null;
  url: string | null;
  date: string | null;
}): boolean {
  if (!input.label?.trim() || !input.date?.trim() || !input.url?.trim()) return false;
  try {
    const url = new URL(input.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildMissionFacts(input: MissionFactsRecordInput): MissionFacts {
  const evidenceIds = new Set(input.evidence.map((record) => record.id));
  const deliveryReadyIds = new Set(
    input.evidence
      .filter((record) => record.verificationStatus === "verified" && record.sourceComplete)
      .map((record) => record.id),
  );
  const timeline = input.timeline.map((record) => ({
    ...record,
    linkedEvidenceIds: record.linkedEvidenceIds.filter((id) => evidenceIds.has(id)),
  }));

  return {
    case: input.case,
    evidence: {
      total: input.evidence.length,
      verified: input.evidence.filter((record) => record.verificationStatus === "verified").length,
      unverified: input.evidence.filter((record) => record.verificationStatus === "unverified").length,
      disputed: input.evidence.filter((record) => record.verificationStatus === "disputed").length,
      sourceComplete: input.evidence.filter((record) => record.sourceComplete).length,
      deliveryReady: deliveryReadyIds.size,
      records: input.evidence,
    },
    timeline: {
      total: timeline.length,
      linked: timeline.filter((record) => record.linkedEvidenceIds.length > 0).length,
      canonicalApprovalLinkedToVerifiedEvidence: timeline.some(
        (record) => record.isCanonical && record.timelineType === "approval" &&
          record.linkedEvidenceIds.some((id) => deliveryReadyIds.has(id)),
      ),
      records: timeline,
    },
    delivery: input.delivery,
    evaluatedAt: input.evaluatedAt,
  };
}

export function aggregateEvidence(
  facts: MissionFacts,
): MissionSupportingEvidence[] {
  const delivery = facts.delivery ?? {
    state: "draft" as const,
    latestEventId: null,
    latestEventType: null,
    packetGenerationId: null,
  };
  const permitDetail = facts.case.permitNumber
    ? `Permit number ${facts.case.permitNumber} is recorded.`
    : "The permit number field is empty.";

  return [
    {
      id: "delivery:lifecycle",
      kind: "delivery_event",
      title: "Delivery lifecycle",
      detail: delivery.latestEventType
        ? `Persisted state is ${delivery.state}; latest event is ${delivery.latestEventType}.`
        : "No packet delivery lifecycle event has been recorded.",
      recordId: delivery.latestEventId,
    },
    {
      id: "case:permit-number",
      kind: "case_field",
      title: "Permit number",
      detail: permitDetail,
      recordId: facts.case.id,
    },
    {
      id: "case:status",
      kind: "case_status",
      title: "Case lifecycle status",
      detail: `Current status is ${facts.case.currentStatus}.`,
      recordId: facts.case.id,
    },
    {
      id: "aggregate:evidence",
      kind: "aggregate",
      title: "Evidence inventory",
      detail: `${facts.evidence.total} total; ${facts.evidence.verified} verified; ${facts.evidence.unverified} unverified; ${facts.evidence.disputed} disputed; ${facts.evidence.deliveryReady} verified with complete source metadata.`,
      recordId: null,
    },
    {
      id: "aggregate:timeline",
      kind: "aggregate",
      title: "Timeline inventory",
      detail: `${facts.timeline.total} total; ${facts.timeline.linked} linked to evidence.`,
      recordId: null,
    },
    ...facts.evidence.records.map((record) => ({
      id: `evidence:${record.id}`,
      kind: "evidence_record" as const,
      title: record.title,
      detail: `${record.verificationStatus}; source metadata ${record.sourceComplete ? "complete" : "incomplete"}.`,
      recordId: record.id,
    })),
    ...facts.timeline.records.map((record) => ({
      id: `timeline:${record.id}`,
      kind: "timeline_record" as const,
      title: record.title,
      detail: `${record.timelineType}; ${record.isCanonical ? "canonical" : "contributed"}; ${record.linkedEvidenceIds.length} linked evidence record${record.linkedEvidenceIds.length === 1 ? "" : "s"}.`,
      recordId: record.id,
    })),
  ];
}
