import type { PacketModel } from "./types";

function textDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
}

function textDateOnly(value: string | null): string {
  return value ?? "Not provided";
}

function plainText(value: string): string {
  return value.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function addSection(lines: string[], title: string, body: string[]) {
  lines.push("", title, "-".repeat(title.length), ...body);
}

function linkedEvidenceText(
  linkedEvidence: PacketModel["timeline_summaries"][number]["linked_evidence"],
  missingCount: number,
): string {
  const loaded = linkedEvidence.map((item) =>
    `${plainText(item.title)} (${item.verification_label})`,
  );

  if (missingCount > 0) {
    loaded.push(
      `${missingCount} linked evidence reference${missingCount === 1 ? "" : "s"} not loaded`,
    );
  }

  return loaded.length > 0 ? loaded.join("; ") : "No linked evidence.";
}

export function renderPacketText(model: PacketModel): string {
  const lines = [
    plainText(model.title),
    model.draft_notice,
    `Generated: ${model.generated_at}`,
  ];

  addSection(lines, "Packet header", [
    `Project: ${plainText(model.case_summary.project_name)}`,
    `Client: ${plainText(model.case_summary.client_name)}`,
    `Jurisdiction: ${plainText(model.jurisdiction)}`,
    `Permit number: ${plainText(model.permit_number ?? "Not provided")}`,
    `Case version: ${model.case_summary.version}`,
  ]);

  addSection(lines, "Project summary", [
    `Address: ${plainText(model.case_summary.address)}`,
    `City: ${plainText(model.case_summary.city)}`,
    `Created: ${textDateTime(model.case_summary.created_at)}`,
    `Updated: ${textDateTime(model.case_summary.updated_at)}`,
  ]);

  addSection(lines, "Current permit status", [
    `Current status: ${model.current_status.label}`,
  ]);

  addSection(
    lines,
    "Key evidence",
    model.evidence_summaries.length > 0
      ? model.evidence_summaries.flatMap((item, index) => [
          `${index + 1}. ${plainText(item.title)}`,
          `   Type: ${item.evidence_type_label}`,
          `   Verification: ${item.verification_label} - ${item.verification_note}`,
          `   Source label: ${plainText(item.source.label ?? "Not provided")}`,
          `   Source URL: ${plainText(item.source.url ?? "Not provided")}`,
          `   Source date: ${textDateOnly(item.source.date)}`,
          `   Summary: ${plainText(item.summary)}`,
        ])
      : ["No evidence records are available in this case."],
  );

  addSection(
    lines,
    "Permit timeline",
    model.timeline_summaries.length > 0
      ? model.timeline_summaries.flatMap((entry, index) => [
          `${index + 1}. ${entry.occurred_on} - ${plainText(entry.title)}`,
          `   Type: ${entry.timeline_type_label}`,
          `   Entry source: ${entry.source_label}`,
          `   Linked evidence: ${linkedEvidenceText(
            entry.linked_evidence,
            entry.missing_evidence_reference_count,
          )}`,
          `   Details: ${plainText(entry.details)}`,
        ])
      : ["No permit timeline records are available in this case."],
  );

  addSection(
    lines,
    "Recent case activity",
    model.recent_activity_summaries.length > 0
      ? model.recent_activity_summaries.flatMap((entry, index) => {
          const statusLine =
            entry.action === "case_status_changed" &&
            entry.from_status_label &&
            entry.to_status_label
              ? `   Status: ${entry.from_status_label} to ${entry.to_status_label}`
              : null;

          return [
            `${index + 1}. ${entry.action_label} at ${textDateTime(entry.created_at)}`,
            `   Actor: ${plainText(entry.actor_label)}`,
            ...(entry.changed_field_labels.length > 0
              ? [`   Changed fields: ${entry.changed_field_labels.join(", ")}`]
              : []),
            ...(statusLine ? [statusLine] : []),
          ];
        })
      : ["No recent case activity records are available in this case."],
  );

  addSection(lines, "Open questions / missing information", [
    `${model.open_questions.note} ${model.open_questions.instruction}`,
  ]);
  addSection(lines, "Recommended next actions", [
    `${model.recommended_next_actions.note} ${model.recommended_next_actions.instruction}`,
  ]);
  addSection(lines, "Disclaimer / internal-review note", [model.disclaimer]);

  return lines.join("\n");
}

