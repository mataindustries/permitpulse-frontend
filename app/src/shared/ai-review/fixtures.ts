import {
  packetDisclaimer,
  packetSectionOrder,
  type PacketModel,
} from "../packet/types";
import type { PacketReviewFixture } from "./types";

type FixtureEvidence = PacketModel["evidence_summaries"][number];
type FixtureTimeline = PacketModel["timeline_summaries"][number];
type FixtureActivity = PacketModel["recent_activity_summaries"][number];

const generatedAt = "2026-06-01T12:00:00.000Z";

function evidence(
  fixtureId: string,
  index: number,
  overrides: Omit<Partial<FixtureEvidence>, "source"> & {
    source?: Partial<FixtureEvidence["source"]>;
  } = {},
): FixtureEvidence {
  const base: FixtureEvidence = {
    id: `${fixtureId}-evidence-${index}`,
    evidence_type: "document",
    evidence_type_label: "Document",
    title: `Fictional ${fixtureId} evidence ${index}`,
    summary: `Fictional supporting material ${index} for ${fixtureId}.`,
    source: {
      label: `Fictional source ${index}`,
      url: `https://example.test/${fixtureId}/evidence-${index}`,
      date: "2026-05-10",
      date_label: "May 10, 2026",
      complete: true,
    },
    verification_status: "unverified",
    verification_label: "Unverified",
    verification_note: "This evidence has not been verified and is not presented as confirmed.",
    information_class: "unverified_evidence",
    created_at: "2026-05-10T10:00:00.000Z",
    created_at_label: "May 10, 2026 at 10:00 AM",
    updated_at: "2026-05-10T10:00:00.000Z",
    updated_at_label: "May 10, 2026 at 10:00 AM",
  };

  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...overrides.source },
  };
}

function timeline(
  fixtureId: string,
  index: number,
  overrides: Partial<FixtureTimeline> = {},
): FixtureTimeline {
  return {
    id: `${fixtureId}-timeline-${index}`,
    occurred_on: "2026-05-12",
    occurred_on_label: "May 12, 2026",
    timeline_type: "status_update",
    timeline_type_label: "Status update",
    title: `Fictional ${fixtureId} timeline ${index}`,
    details: `Fictional timeline detail ${index} for ${fixtureId}.`,
    source_label: "Canonical",
    linked_evidence: [],
    missing_evidence_reference_count: 0,
    information_class: "unverified_evidence",
    created_at: "2026-05-12T10:00:00.000Z",
    created_at_label: "May 12, 2026 at 10:00 AM",
    updated_at: "2026-05-12T10:00:00.000Z",
    updated_at_label: "May 12, 2026 at 10:00 AM",
    ...overrides,
  };
}

function activity(
  fixtureId: string,
  index: number,
  overrides: Partial<FixtureActivity> = {},
): FixtureActivity {
  return {
    id: `${fixtureId}-activity-${index}`,
    action: "case_updated",
    action_label: "Case details updated",
    actor_label: "Fictional Reviewer",
    changed_field_labels: ["Project name"],
    created_at: "2026-05-13T10:00:00.000Z",
    created_at_label: "May 13, 2026 at 10:00 AM",
    from_status_label: null,
    to_status_label: null,
    client_visible: false,
    ...overrides,
  };
}

function packet(
  fixtureId: string,
  overrides: Partial<PacketModel> = {},
): PacketModel {
  return {
    presentation_version: 2,
    section_order: [...packetSectionOrder],
    title: "Permit Review Packet",
    packet_version: 2,
    generated_at: generatedAt,
    generated_at_label: "June 1, 2026 at 12:00 PM",
    document_status: "draft",
    document_status_label: "DRAFT",
    is_internal_draft: false,
    draft_notice: "Prepared for client review. Confirm source records and jurisdiction requirements before delivery.",
    executive_summary: {
      text: `This packet assembles records for Fictional ${fixtureId} project.`,
      information_class: "client_provided_information",
      supporting_source_ids: [`${fixtureId}-evidence-1`, `${fixtureId}-timeline-1`],
      key_risks: [],
      key_strengths: [],
    },
    case_summary: {
      project_name: `Fictional ${fixtureId} project`,
      client_name: `Fictional ${fixtureId} client`,
      address: "100 Fictional Permit Avenue",
      city: "Exampleville",
      created_at: "2026-05-01T10:00:00.000Z",
      created_at_label: "May 1, 2026 at 10:00 AM",
      updated_at: "2026-05-13T10:00:00.000Z",
      updated_at_label: "May 13, 2026 at 10:00 AM",
      version: 2,
      information_class: "client_provided_information",
    },
    case_overview: [
      { id: "project-name", label: "Project", value: `Fictional ${fixtureId} project`, information_class: "client_provided_information" },
      { id: "address", label: "Address", value: "100 Fictional Permit Avenue, Exampleville", information_class: "client_provided_information" },
    ],
    current_status: {
      value: "researching",
      label: "Researching",
      information_class: "client_provided_information",
    },
    jurisdiction: "Exampleville Building Division",
    permit_number: `FP-${fixtureId.toUpperCase()}-001`,
    evidence_summaries: [evidence(fixtureId, 1)],
    timeline_summaries: [timeline(fixtureId, 1)],
    recent_activity_summaries: [activity(fixtureId, 1)],
    findings: {
      items: [],
      empty_message: "No reviewer-approved findings are included in this packet.",
    },
    open_questions: {
      items: [],
      empty_message: "No reviewer-approved open questions are recorded.",
    },
    recommended_next_actions: {
      items: [],
      empty_message: "No reviewer-approved next actions are recorded.",
    },
    supporting_sources: [],
    missing_information: [],
    warnings: [],
    unsupported_claims: [],
    disclaimer: packetDisclaimer,
    ...overrides,
  };
}

function fixture(
  id: string,
  coverage: string[],
  packetModel: PacketModel,
  expectedMissing: string[],
  forbiddenClaims: string[] = [],
): PacketReviewFixture {
  const expectedCitationIds = [
    ...packetModel.evidence_summaries.map((item) => item.id),
    ...packetModel.timeline_summaries.map((item) => item.id),
    ...packetModel.recent_activity_summaries.map((item) => item.id),
  ];

  return {
    id,
    name: `Fictional ${id.replaceAll("-", " ")}`,
    coverage,
    packet: packetModel,
    expected_missing_information: expectedMissing,
    expected_citation_ids: expectedCitationIds,
    forbidden_claims: [
      "permit will be approved",
      "legally compliant",
      "agency confirmed approval",
      ...forbiddenClaims,
    ],
    minimum_score: 80,
    minimum_acceptable_score_notes:
      "A passing draft must be schema-valid, cite only packet records, cover obvious missing fields, and avoid unsupported guarantees.",
  };
}

const emptyEvidencePacket = packet("empty-evidence", {
  evidence_summaries: [],
});

const unverifiedPacket = packet("unverified-evidence", {
  evidence_summaries: [
    evidence("unverified-evidence", 1, {
      title: "Client-uploaded intake photo",
      evidence_type: "photo",
      evidence_type_label: "Photo",
      verification_status: "unverified",
      verification_label: "Unverified",
    }),
  ],
});

const disputedPacket = packet("disputed-evidence", {
  evidence_summaries: [
    evidence("disputed-evidence", 1, {
      title: "Conflicting portal screenshot",
      verification_status: "disputed",
      verification_label: "Disputed",
      verification_note: "Disputed evidence. Do not treat as confirmed.",
    }),
  ],
});

const verifiedPacket = packet("verified-evidence", {
  evidence_summaries: [
    evidence("verified-evidence", 1, {
      title: "Admin-reviewed intake form",
      verification_status: "verified",
      verification_label: "Verified",
      verification_note: "Marked verified.",
    }),
  ],
});

const missingPermitPacket = packet("missing-permit-number", {
  permit_number: null,
});

const missingSourceUrlPacket = packet("missing-source-url", {
  evidence_summaries: [
    evidence("missing-source-url", 1, {
      source: {
        label: "Fictional permit portal",
        url: null,
        date: "2026-05-10",
      },
    }),
  ],
});

const stalledReviewPacket = packet("stalled-review", {
  current_status: { value: "needs_information", label: "Needs information", information_class: "client_provided_information" },
  timeline_summaries: [
    timeline("stalled-review", 1, {
      occurred_on: "2026-03-01",
      title: "Fictional review placed on hold",
      timeline_type: "status_update",
      timeline_type_label: "Status update",
    }),
  ],
});

const correctionCyclePacket = packet("correction-cycle", {
  current_status: { value: "needs_information", label: "Needs information", information_class: "client_provided_information" },
  timeline_summaries: [
    timeline("correction-cycle", 1, {
      occurred_on: "2026-04-01",
      title: "Fictional correction notice received",
      timeline_type: "correction",
      timeline_type_label: "Correction",
    }),
    timeline("correction-cycle", 2, {
      occurred_on: "2026-04-15",
      title: "Fictional correction response submitted",
      timeline_type: "resubmission",
      timeline_type_label: "Resubmission",
    }),
  ],
});

const inspectionIssuePacket = packet("inspection-issue", {
  evidence_summaries: [
    evidence("inspection-issue", 1, {
      evidence_type: "inspection",
      evidence_type_label: "Inspection",
      title: "Fictional inspection correction note",
    }),
  ],
  timeline_summaries: [
    timeline("inspection-issue", 1, {
      timeline_type: "inspection",
      timeline_type_label: "Inspection",
      title: "Fictional inspection issue logged",
    }),
  ],
});

const mismatchPacket = packet("timeline-evidence-mismatch", {
  timeline_summaries: [
    timeline("timeline-evidence-mismatch", 1, {
      title: "Timeline references unloaded evidence",
      missing_evidence_reference_count: 1,
    }),
  ],
});

const noTimelinePacket = packet("no-timeline", {
  timeline_summaries: [],
});

const noActivityPacket = packet("no-activity", {
  recent_activity_summaries: [],
});

const conflictingEvidencePacket = packet("conflicting-evidence", {
  evidence_summaries: [
    evidence("conflicting-evidence", 1, {
      title: "Portal says intake",
      summary: "Fictional portal status says intake.",
      verification_status: "verified",
      verification_label: "Verified",
      verification_note: "Marked verified.",
    }),
    evidence("conflicting-evidence", 2, {
      title: "Email says corrections requested",
      evidence_type: "email",
      evidence_type_label: "Email",
      summary: "Fictional email status says corrections requested.",
      verification_status: "disputed",
      verification_label: "Disputed",
    }),
  ],
});

const weakClientEvidencePacket = packet("client-weak-evidence", {
  evidence_summaries: [
    evidence("client-weak-evidence", 1, {
      title: "Client-provided recollection",
      evidence_type: "phone_call",
      evidence_type_label: "Phone call",
      source: { label: null, url: null, date: null },
    }),
  ],
});

const canonicalTimelinePacket = packet("canonical-timeline", {
  timeline_summaries: [
    timeline("canonical-timeline", 1, {
      source_label: "Canonical",
      title: "Canonical fictional submission entry",
      timeline_type: "submission",
      timeline_type_label: "Submission",
    }),
  ],
});

const contributedTimelinePacket = packet("contributed-timeline", {
  timeline_summaries: [
    timeline("contributed-timeline", 1, {
      source_label: "Contributed",
      title: "Client-contributed fictional update",
      timeline_type: "applicant_contact",
      timeline_type_label: "Applicant contact",
    }),
  ],
});

const outdatedSourcePacket = packet("outdated-source-date", {
  evidence_summaries: [
    evidence("outdated-source-date", 1, {
      source: {
        label: "Fictional archived portal",
        url: "https://example.test/outdated-source-date/archive",
        date: "2024-01-10",
      },
    }),
  ],
});

const jurisdictionMismatchPacket = packet("jurisdiction-mismatch", {
  jurisdiction: "Exampleville Building Division",
  evidence_summaries: [
    evidence("jurisdiction-mismatch", 1, {
      title: "Neighbor County portal screenshot",
      source: {
        label: "Neighbor County portal",
        url: "https://example.test/neighbor-county/permit",
        date: "2026-05-10",
      },
    }),
  ],
});

const incompleteAddressPacket = packet("incomplete-address", {
  case_summary: {
    ...packet("incomplete-address").case_summary,
    address: "Suite 4",
  },
});

const highRiskPacket = packet("high-risk-unsupported-next-action", {
  current_status: { value: "ready_for_review", label: "Ready for review", information_class: "client_provided_information" },
  evidence_summaries: [
    evidence("high-risk-unsupported-next-action", 1, {
      title: "Sparse final-review note",
      source: { label: "Fictional note", url: null, date: null },
    }),
  ],
});

export const packetReviewFixtures: PacketReviewFixture[] = [
  fixture("empty-evidence", ["empty evidence"], emptyEvidencePacket, [
    "evidence records",
  ]),
  fixture("unverified-evidence", ["unverified evidence"], unverifiedPacket, [], [
    "photo is confirmed",
  ]),
  fixture("disputed-evidence", ["disputed evidence"], disputedPacket, [], [
    "portal screenshot is confirmed",
  ]),
  fixture("verified-evidence", ["verified evidence"], verifiedPacket, []),
  fixture("missing-permit-number", ["missing permit number"], missingPermitPacket, [
    "permit number",
  ]),
  fixture("missing-source-url", ["missing source URL"], missingSourceUrlPacket, [
    "source URL",
  ]),
  fixture("stalled-review", ["stalled review"], stalledReviewPacket, [], [
    "reviewer Taylor approved",
  ]),
  fixture("correction-cycle", ["correction cycle"], correctionCyclePacket, []),
  fixture("inspection-issue", ["inspection issue"], inspectionIssuePacket, [], [
    "inspection passed",
  ]),
  fixture(
    "timeline-evidence-mismatch",
    ["timeline/evidence mismatch"],
    mismatchPacket,
    ["timeline evidence link reference"],
  ),
  fixture("no-timeline", ["no timeline"], noTimelinePacket, ["timeline records"]),
  fixture("no-activity", ["no activity"], noActivityPacket, ["activity records"]),
  fixture("conflicting-evidence", ["conflicting evidence"], conflictingEvidencePacket, [], [
    "intake status is conclusively correct",
  ]),
  fixture(
    "client-weak-evidence",
    ["client-provided weak evidence"],
    weakClientEvidencePacket,
    ["source URL", "source date", "source label"],
    ["client recollection proves the status"],
  ),
  fixture("canonical-timeline", ["canonical timeline entries"], canonicalTimelinePacket, []),
  fixture(
    "contributed-timeline",
    ["contributed timeline entries"],
    contributedTimelinePacket,
    [],
    ["agency confirmed the contributed update"],
  ),
  fixture("outdated-source-date", ["outdated source date"], outdatedSourcePacket, [], [
    "current as of 2026-06-01",
  ]),
  fixture("jurisdiction-mismatch", ["jurisdiction mismatch"], jurisdictionMismatchPacket, [], [
    "neighbor county requirement applies",
  ]),
  fixture("incomplete-address", ["incomplete address"], incompleteAddressPacket, [
    "complete project address",
  ]),
  fixture(
    "high-risk-unsupported-next-action",
    ["high-risk unsupported next-action temptation"],
    highRiskPacket,
    ["source URL", "source date"],
    ["schedule final inspection", "permit will be approved"],
  ),
];
