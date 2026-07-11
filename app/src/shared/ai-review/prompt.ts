import type { PacketModel } from "../packet/types";

export const packetReviewPromptRules = [
  "Cite only evidence, timeline, or activity record IDs included in citation_record_ids.",
  "Do not invent agencies, reviewer names, code sections, dates, or outcomes.",
  "Do not predict permit approval.",
  "Do not provide legal guarantees.",
  "Do not treat unverified or disputed evidence as verified.",
  "Return strict JSON matching PacketReviewDraft and no additional fields or prose.",
] as const;

export interface PacketReviewPromptContract {
  contract_version: "permitpulse-packet-review-v1";
  task: "review-permit-packet-draft";
  rules: readonly string[];
  citation_record_ids: {
    evidence: string[];
    timeline: string[];
    activity: string[];
  };
  packet: {
    title: string;
    generated_at: string;
    draft_notice: string;
    case_summary: PacketModel["case_summary"];
    current_status: PacketModel["current_status"];
    jurisdiction: string;
    permit_number: string | null;
    evidence_summaries: PacketModel["evidence_summaries"];
    timeline_summaries: PacketModel["timeline_summaries"];
    recent_activity_summaries: PacketModel["recent_activity_summaries"];
    disclaimer: string;
  };
  response_contract: {
    format: "json";
    schema_name: "PacketReviewDraft";
    strict: true;
    required_fields: readonly [
      "summary",
      "missing_information",
      "recommended_next_actions",
      "evidence_citations",
      "unsupported_claims",
      "confidence_notes",
    ];
  };
}

export function buildPacketReviewPromptContract(
  packet: PacketModel,
): PacketReviewPromptContract {
  return {
    contract_version: "permitpulse-packet-review-v1",
    task: "review-permit-packet-draft",
    rules: packetReviewPromptRules,
    citation_record_ids: {
      evidence: packet.evidence_summaries.map((item) => item.id),
      timeline: packet.timeline_summaries.map((item) => item.id),
      activity: packet.recent_activity_summaries.map((item) => item.id),
    },
    packet: {
      title: packet.title,
      generated_at: packet.generated_at,
      draft_notice: packet.draft_notice,
      case_summary: {
        project_name: packet.case_summary.project_name,
        client_name: packet.case_summary.client_name,
        address: packet.case_summary.address,
        city: packet.case_summary.city,
        created_at: packet.case_summary.created_at,
        created_at_label: packet.case_summary.created_at_label,
        updated_at: packet.case_summary.updated_at,
        updated_at_label: packet.case_summary.updated_at_label,
        version: packet.case_summary.version,
        information_class: packet.case_summary.information_class,
      },
      current_status: {
        value: packet.current_status.value,
        label: packet.current_status.label,
        information_class: packet.current_status.information_class,
      },
      jurisdiction: packet.jurisdiction,
      permit_number: packet.permit_number,
      evidence_summaries: packet.evidence_summaries.map((item) => ({
        id: item.id,
        reference:item.reference,
        evidence_type: item.evidence_type,
        evidence_type_label: item.evidence_type_label,
        title: item.title,
        summary: item.summary,
        source: {
          label: item.source.label,
          url: item.source.url,
          date: item.source.date,
          date_label: item.source.date_label,
          complete: item.source.complete,
        },
        verification_status: item.verification_status,
        verification_label: item.verification_label,
        verification_note: item.verification_note,
        information_class: item.information_class,
        created_at: item.created_at,
        created_at_label: item.created_at_label,
        updated_at: item.updated_at,
        updated_at_label: item.updated_at_label,
      })),
      timeline_summaries: packet.timeline_summaries.map((item) => ({
        id: item.id,
        reference:item.reference,
        occurred_on: item.occurred_on,
        occurred_on_label: item.occurred_on_label,
        timeline_type: item.timeline_type,
        timeline_type_label: item.timeline_type_label,
        title: item.title,
        details: item.details,
        source_label: item.source_label,
        linked_evidence: item.linked_evidence.map((evidence) => ({
          source_id: evidence.source_id,
          title: evidence.title,
          verification_label: evidence.verification_label,
        })),
        missing_evidence_reference_count:
          item.missing_evidence_reference_count,
        information_class: item.information_class,
        created_at: item.created_at,
        created_at_label: item.created_at_label,
        updated_at: item.updated_at,
        updated_at_label: item.updated_at_label,
      })),
      recent_activity_summaries: packet.recent_activity_summaries.map(
        (item) => ({
          id: item.id,
          action: item.action,
          action_label: item.action_label,
          actor_label: item.actor_label,
          changed_field_labels: [...item.changed_field_labels],
          created_at: item.created_at,
          created_at_label: item.created_at_label,
          from_status_label: item.from_status_label,
          to_status_label: item.to_status_label,
          client_visible: item.client_visible,
        }),
      ),
      disclaimer: packet.disclaimer,
    },
    response_contract: {
      format: "json",
      schema_name: "PacketReviewDraft",
      strict: true,
      required_fields: [
        "summary",
        "missing_information",
        "recommended_next_actions",
        "evidence_citations",
        "unsupported_claims",
        "confidence_notes",
      ],
    },
  };
}
