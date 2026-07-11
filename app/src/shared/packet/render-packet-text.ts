import { packetSectionTitle } from "./presentation";
import type { PacketModel } from "./types";

function plainText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function addSection(lines: string[], title: string, body: string[]) {
  lines.push("", title, "-".repeat(title.length), ...body);
}

function numberedItems(items: string[], emptyMessage: string): string[] {
  return items.length > 0
    ? items.map((item, index) => `${index + 1}. ${plainText(item)}`)
    : [emptyMessage];
}

export function renderPacketText(model: PacketModel): string {
  const lines = [
    "PERMITPULSE",
    plainText(model.title),
    `Status: ${model.document_status_label}`,
    `Generated: ${model.generated_at_label}`,
    `Packet version: ${model.packet_version}`,
    model.draft_notice,
  ];

  addSection(lines, packetSectionTitle("executive_summary"), [
    plainText(model.executive_summary.text),
    ...model.warnings.map((item) => `Packet note: ${plainText(item.text)}`),
  ]);

  addSection(
    lines,
    packetSectionTitle("case_overview"),
    model.case_overview.map(
      (item) => `${plainText(item.label)}: ${plainText(item.value)}`,
    ),
  );

  addSection(lines, packetSectionTitle("current_status"), [
    `Recorded case status: ${plainText(model.current_status.label)}`,
    `Case record updated: ${model.case_summary.updated_at_label}`,
  ]);

  addSection(
    lines,
    packetSectionTitle("evidence_register"),
    model.evidence_summaries.length > 0
      ? model.evidence_summaries.flatMap((item, index) => [
          `${index + 1}. ${plainText(item.title)}`,
          `   Classification: ${item.verification_label}`,
          `   Type: ${item.evidence_type_label}`,
          `   Summary: ${plainText(item.summary)}`,
          `   Source: ${plainText(item.source.label ?? "Source label not provided")}`,
          `   Source date: ${item.source.date_label}`,
          `   Provenance: ${plainText(item.source.url ?? "Source URL not provided")}`,
          `   Note: ${item.verification_note}`,
        ])
      : ["No evidence records are included in this packet."],
  );

  addSection(
    lines,
    packetSectionTitle("permit_timeline"),
    model.timeline_summaries.length > 0
      ? model.timeline_summaries.flatMap((entry, index) => {
          const linked = entry.linked_evidence.length > 0
            ? entry.linked_evidence
                .map(
                  (item) =>
                    `${plainText(item.title)} (${item.verification_label})`,
                )
                .join("; ")
            : "No supporting evidence linked";

          return [
            `${index + 1}. ${entry.occurred_on_label} — ${plainText(entry.title)}`,
            `   Event type: ${entry.timeline_type_label}`,
            `   Record classification: ${entry.source_label}`,
            `   Details: ${plainText(entry.details)}`,
            `   Supporting evidence: ${linked}`,
          ];
        })
      : ["No permit timeline events are included in this packet."],
  );

  addSection(
    lines,
    packetSectionTitle("findings"),
    numberedItems(
      model.findings.items.map((item) => item.text),
      model.findings.empty_message,
    ),
  );

  addSection(
    lines,
    packetSectionTitle("open_questions"),
    numberedItems(
      model.open_questions.items.map((item) => item.text),
      model.open_questions.empty_message,
    ),
  );

  addSection(
    lines,
    packetSectionTitle("recommended_next_actions"),
    numberedItems(
      model.recommended_next_actions.items.map((item) => item.text),
      model.recommended_next_actions.empty_message,
    ),
  );

  addSection(
    lines,
    packetSectionTitle("supporting_sources"),
    model.supporting_sources.length > 0
      ? model.supporting_sources.flatMap((source, index) => [
          `${index + 1}. ${plainText(source.title)}`,
          `   Source: ${plainText(source.label)}`,
          `   Date: ${source.date_label}`,
          `   Verification: ${source.verification_label}`,
          `   URL: ${plainText(source.url ?? "Not provided")}`,
        ])
      : ["No supporting sources are included in this packet."],
  );

  addSection(lines, packetSectionTitle("disclaimer"), [model.disclaimer]);

  return lines.join("\n");
}
