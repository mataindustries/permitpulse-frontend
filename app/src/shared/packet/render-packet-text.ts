import {
  assertCanonicalPacketPresentation,
  buildPacketPresentation,
  type CanonicalPacketPresentation,
  type PacketPresentationBlock,
} from "./presentation";
import type { PacketModel } from "./types";

function plainText(value: string): string {
  return value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    " ",
  );
}

function unsupportedPacketBlock(block: never): never {
  const kind = (block as { kind?: unknown }).kind;
  throw new Error(`Unsupported canonical packet block: ${String(kind)}`);
}

function numbered(items: readonly string[]): string[] {
  return items.map((item, index) => `${index + 1}. ${plainText(item)}`);
}

function blockLines(block: PacketPresentationBlock): string[] {
  switch (block.kind) {
    case "cover":
      return [
        "PERMITPULSE · PERMIT INTELLIGENCE",
        plainText(block.title),
        `Project: ${plainText(block.project_name)}`,
        `Location: ${plainText(block.location)}`,
        `Prepared for: ${plainText(block.client_name)}`,
        `Jurisdiction: ${plainText(block.jurisdiction)}`,
        `Permit identifier: ${plainText(block.permit_identifier)}`,
        `Packet status: ${plainText(block.lifecycle_status)} / ${plainText(block.packet_status)}`,
        `Packet version: ${block.packet_version}`,
        `Generated: ${plainText(block.generated_at_label)}`,
        plainText(block.draft_notice),
      ];
    case "executive_summary":
      return [
        plainText(block.summary),
        ...block.decision_lines.map(
          (item) => `${item.label}: ${plainText(item.value)}`,
        ),
        ...block.key_risks.map((item) => `Key risk: ${plainText(item)}`),
        ...block.key_strengths.map((item) => `Key strength: ${plainText(item)}`),
      ];
    case "case_snapshot":
      return [
        ...block.facts.map(
          (item) =>
            `${plainText(item.label)}: ${plainText(item.information_class === "missing_information" ? "Pending record entry" : item.value)}`,
        ),
        `Case workflow status: ${plainText(block.workflow_status)}`,
        `Investigation state: ${plainText(block.investigation_state)}`,
        `Packet Readiness: ${plainText(block.packet_readiness)}`,
        plainText(block.resolution_notice),
        `Case record updated: ${plainText(block.record_updated_at)}`,
      ];
    case "editorial_list":
      return block.items.length > 0
        ? block.items.map(
            (item, index) =>
              `${index + 1}. ${plainText(item.text)}${item.citation_references.length > 0 ? ` (Supported by ${item.citation_references.join(", ")})` : ""}`,
          )
        : [plainText(block.empty_message)];
    case "dependency_map":
      return block.items.length > 0
        ? block.items.flatMap((item, index) => [
            `${index + 1}. Discipline: ${plainText(item.discipline)}`,
            `   Blocking issue: ${plainText(item.blocking_issue)}`,
            `   Dependent review: ${plainText(item.dependent_review)}`,
            `   Recommended next step: ${plainText(item.recommended_next_step)}`,
            `   Supported by: ${item.citation_references.join(", ")}`,
          ])
        : [plainText(block.empty_message)];
    case "action_kit": {
      const kit = block.kit;
      if (!kit) return [plainText(block.empty_message)];

      return [
        `Subject: ${plainText(kit.email_subject)}`,
        `Recommended contact: ${plainText(kit.recipient_role)}`,
        "Message:",
        plainText(kit.message_body),
        `Supported by: ${kit.citation_references.join(", ")}`,
        "Requested confirmations:",
        ...numbered(kit.requested_confirmations).map((item) => `  ${item}`),
        "Call script:",
        ...numbered(kit.call_checklist).map((item) => `  ${item}`),
        "Documents to have ready:",
        ...(kit.documents_ready.length > 0
          ? numbered(kit.documents_ready).map((item) => `  ${item}`)
          : ["  Use only the cited packet sources listed above."]),
        `Escalation summary: ${plainText(kit.escalation_trigger)}`,
        `Recommended next contact: ${plainText(kit.recipient_role)}`,
        ...(kit.follow_up_date
          ? [`Follow-up / review date: ${plainText(kit.follow_up_date)}`]
          : []),
      ];
    }
    case "timeline":
      return block.items.length > 0
        ? block.items.flatMap((entry, index) => [
            `${index + 1}. ${plainText(entry.occurred_on_label)} — ${plainText(entry.title)}`,
            `   Event type: ${plainText(entry.timeline_type_label)}`,
            `   Record classification: ${plainText(entry.source_label)}`,
            `   Review status: ${plainText(entry.review_label)}`,
            `   Details: ${plainText(entry.details)}`,
            `   Supporting evidence: ${entry.linked_evidence.length > 0 ? entry.linked_evidence.map((item) => `${plainText(item.title)} (${plainText(item.verification_label)})`).join("; ") : "No supporting evidence linked; evidence linkage has not been recorded"}`,
          ])
        : [plainText(block.empty_message)];
    case "evidence":
      return block.items.length > 0
        ? block.items.flatMap((item, index) => [
            `${index + 1}. ${item.reference} — ${plainText(item.title)}`,
            `   Type: ${plainText(item.evidence_type_label)}`,
            `   Classification: ${plainText(item.verification_label)}`,
            `   Summary: ${plainText(item.summary)}`,
            ...(item.source.label
              ? [`   Source: ${plainText(item.source.label)}`]
              : []),
            ...(item.source.date
              ? [`   Source date: ${plainText(item.source.date_label)}`]
              : []),
            `   ${item.attribution_label}: ${plainText(item.contributor_label ?? "Contributor not recorded")}`,
            ...(item.source_href
              ? [`   Provenance: ${plainText(item.source_href)}`]
              : []),
            ...(item.missing_details.length > 0
              ? [`   Source details pending: ${item.missing_details.join(", ")}.`]
              : []),
            `   Reviewer note: ${plainText(item.verification_note)}`,
          ])
        : [plainText(block.empty_message)];
    case "sources":
      return block.items.length > 0
        ? block.items.flatMap((source, index) => [
            `${index + 1}. ${plainText(source.title)}`,
            `   Source: ${plainText(source.label_display)}`,
            `   Date: ${plainText(source.date_display)}`,
            `   Verification: ${plainText(source.verification_label)}`,
            `   ${source.attribution_label}: ${plainText(source.contributor_label ?? "Contributor not recorded")}`,
            `   Provenance: ${plainText(source.source_href ?? "Digital provenance not recorded")}`,
          ])
        : [plainText(block.empty_message)];
    case "readiness": {
      const dashboard = block.dashboard;
      return [
        plainText(block.conclusion),
        plainText(block.methodology),
        `Investigation state: ${plainText(dashboard.permit_status)} (not a jurisdiction disposition)`,
        `Investigation Health: ${plainText(dashboard.mission_health.label)} (${dashboard.mission_health.completed} of ${dashboard.mission_health.total} checks complete)`,
        `Packet Readiness: ${dashboard.readiness.completed} of ${dashboard.readiness.total} checks complete`,
        "Packet-readiness conditions:",
        ...(dashboard.blockers.length > 0
          ? dashboard.blockers.map(
              (item, index) =>
                `  ${index + 1}. ${plainText(item.title)} — ${plainText(item.resolution)}`,
            )
          : [
              "  No packet-readiness conditions remain. Open agency findings do not indicate jurisdiction resolution.",
            ]),
        `Recommended next action: ${plainText(dashboard.recommended_action.title)}`,
        `Action context: ${plainText(dashboard.recommended_action.detail)}`,
        `Evidence summary: ${plainText(dashboard.evidence.text)}`,
        `Evidence counts: verified ${dashboard.evidence.verified}; unverified ${dashboard.evidence.unverified}; disputed ${dashboard.evidence.disputed}; provenance issues ${dashboard.evidence.provenance_issues}`,
        "Packet Readiness checks:",
        ...dashboard.factors.map(
          (factor) =>
            `  [${factor.passed ? "PASS" : "OPEN"}] ${plainText(factor.label)} — ${plainText(factor.detail)}`,
        ),
        ...block.warnings.map((warning) => `Packet note: ${plainText(warning)}`),
        ...block.metadata.map(
          (item) => `${plainText(item.label)}: ${plainText(item.value)}`,
        ),
        `Use limitation: ${plainText(block.disclaimer)}`,
      ];
    }
    case "disclosure":
      return [plainText(block.text)];
    default:
      return unsupportedPacketBlock(block);
  }
}

export function renderPacketTextPresentation(
  presentation: CanonicalPacketPresentation,
): string {
  assertCanonicalPacketPresentation(presentation);
  const lines: string[] = [];

  presentation.sections.forEach((section) => {
    lines.push(
      ...(lines.length > 0 ? [""] : []),
      section.title,
      "-".repeat(section.title.length),
      ...(section.intro ? [plainText(section.intro)] : []),
      ...section.blocks.flatMap(blockLines),
    );
  });

  lines.push(
    "",
    "PermitPulse · Permit intelligence",
    plainText(presentation.footer),
  );

  return lines.join("\n");
}

export function renderPacketText(model: PacketModel): string {
  return renderPacketTextPresentation(buildPacketPresentation(model));
}
