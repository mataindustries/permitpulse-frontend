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
  evaluatedAt: string;
}

export function aggregateEvidence(
  facts: MissionFacts,
): MissionSupportingEvidence[] {
  const permitDetail = facts.case.permitNumber
    ? `Permit number ${facts.case.permitNumber} is recorded.`
    : "The permit number field is empty.";

  return [
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

