import { packetSectionTitle } from "./presentation";
import {
  packetDashboard,
  packetEvidenceMissingDetails,
  packetTimelineChronology,
  packetTimelineReviewLabel,
} from "./presentation-summary";
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
  const dashboard = packetDashboard(model);
  const lines = [
    "PERMITPULSE",
    plainText(model.title),
    `Status: ${model.document_status_label}`,
    `Generated: ${model.generated_at_label}`,
    `Packet version: ${model.packet_version}`,
    model.draft_notice,
  ];

  addSection(lines, "Executive Dashboard", [
    `Executive Summary: ${plainText(model.executive_summary.text)}`,
    ...model.executive_summary.key_risks.map((item) => `Key Risk: ${plainText(item)}`),
    ...model.executive_summary.key_strengths.map((item) => `Key Strength: ${plainText(item)}`),
    `Permit status: ${plainText(dashboard.permit_status)}`,
    `Overall Mission Health: ${dashboard.mission_health.label} (${dashboard.mission_health.score}%)`,
    `Readiness score: ${dashboard.readiness.score}%`,
    "Primary blockers:",
    ...(dashboard.blockers.length > 0
      ? dashboard.blockers.map(
          (item, index) =>
            `  ${index + 1}. ${plainText(item.title)} — ${plainText(item.resolution)}`,
        )
      : ["  No primary blockers identified in the current packet record."]),
    `Recommended next action: ${plainText(dashboard.recommended_action.title)}`,
    `Action context: ${plainText(dashboard.recommended_action.detail)}`,
    `Evidence summary: ${plainText(dashboard.evidence.text)}`,
    ...model.warnings.map((item) => `Packet note: ${plainText(item.text)}`),
  ]);

  addSection(lines, "Packet Metadata", [
    `Packet version: ${model.packet_version}`,
    `Generation date: ${model.generated_at_label}`,
    `Lifecycle status: ${dashboard.lifecycle_status}`,
    `Reviewer status: ${dashboard.reviewer_status}`,
    `Packet integrity / version: ${dashboard.integrity} · deterministic render`,
  ]);

  addSection(
    lines,
    packetSectionTitle("case_overview"),
    model.case_overview.map(
      (item) =>
        `${plainText(item.label)}: ${plainText(item.information_class === "missing_information" ? "Pending record entry" : item.value)}`,
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
      ? model.evidence_summaries.flatMap((item, index) => {
          const missing = packetEvidenceMissingDetails(item);

          return [
            `${index + 1}. ${plainText(item.title)}`,
            `   Type: ${item.evidence_type_label}`,
            `   Classification: ${item.verification_label}`,
            `   Summary: ${plainText(item.summary)}`,
            ...(item.source.label
              ? [`   Source: ${plainText(item.source.label)}`]
              : []),
            ...(item.source.date
              ? [`   Source date: ${item.source.date_label}`]
              : []),
            ...(item.source.url
              ? [`   Provenance: ${plainText(item.source.url)}`]
              : []),
            ...(missing.length > 0
              ? [`   Source details pending: ${missing.join(", ")}.`]
              : []),
            `   Reviewer note: ${item.verification_note}`,
          ];
        })
      : [
          "Evidence register not yet assembled. No evidence records are included in this packet.",
        ],
  );

  addSection(
    lines,
    packetSectionTitle("permit_timeline"),
    model.timeline_summaries.length > 0
      ? packetTimelineChronology(model).flatMap((entry, index) => {
          const linked = entry.linked_evidence.length > 0
            ? entry.linked_evidence
                .map(
                  (item) =>
                    `${plainText(item.title)} (${item.verification_label})`,
                )
                .join("; ")
            : "No supporting evidence linked; evidence linkage has not been recorded";

          return [
            `${index + 1}. ${entry.occurred_on_label} — ${plainText(entry.title)}`,
            `   Event type: ${entry.timeline_type_label}`,
            `   Record classification: ${entry.source_label}`,
            `   Review status: ${packetTimelineReviewLabel(entry)}`,
            `   Details: ${plainText(entry.details)}`,
            `   Supporting evidence: ${linked}`,
          ];
        })
      : [
          "Permit history not yet assembled. No permit timeline events are included in this packet.",
        ],
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
          `   Provenance: ${plainText(source.url ?? "Digital provenance not recorded")}`,
        ])
      : ["Source log is empty. No supporting sources are included in this packet edition."],
  );

  addSection(lines, packetSectionTitle("disclaimer"), [model.disclaimer]);

  return lines.join("\n");
}
