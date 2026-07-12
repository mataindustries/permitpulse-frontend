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
    ...(model.demonstration_notice ? [model.demonstration_notice] : []),
    plainText(model.title),
    `Status: ${model.document_status_label}`,
    `Generated: ${model.generated_at_label}`,
    `Packet version: ${model.packet_version}`,
    model.draft_notice,
  ];

  addSection(lines, "Executive Dashboard", [
    `Executive Summary: ${plainText(model.executive_summary.text)}`,
    `Current position: ${plainText(model.action_kit?.current_position??model.executive_summary.text)}`,
    ...(model.action_kit?[`What the record confirms: ${plainText(model.action_kit.confirmed_record)}`,`What the record does not confirm: ${plainText(model.action_kit.unconfirmed_record)}`,`Primary blocker: ${plainText(model.action_kit.primary_blocker)}`,`Why this move is appropriate: ${plainText(model.action_kit.why_appropriate)}`,`Evidence readiness: ${plainText(model.action_kit.evidence_readiness)}`,`Review readiness: ${plainText(model.action_kit.review_readiness)}`]:[]),
    ...model.executive_summary.key_risks.map((item) => `Key Risk: ${plainText(item)}`),
    ...model.executive_summary.key_strengths.map((item) => `Key Strength: ${plainText(item)}`),
    `Authoritative readiness state: ${plainText(dashboard.permit_status)}`,
    `Overall Mission Health: ${dashboard.mission_health.label} (${dashboard.mission_health.score}%)`,
    `Readiness score: ${dashboard.readiness.score}%`,
    "Readiness factors:",
    ...dashboard.factors.map((factor) => `  [${factor.passed ? "PASS" : "OPEN"}] ${plainText(factor.label)} — ${plainText(factor.detail)}`),
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
    `Evidence counts: verified ${dashboard.evidence.verified}; unverified ${dashboard.evidence.unverified}; disputed ${dashboard.evidence.disputed}; provenance issues ${dashboard.evidence.provenance_issues}`,
    ...model.warnings.map((item) => `Packet note: ${plainText(item.text)}`),
  ]);

  addSection(lines, "Packet Metadata", [
    `Packet version: ${model.packet_version}`,
    `Generation date: ${model.generated_at_label}`,
    `Lifecycle status: ${dashboard.lifecycle_status}`,
    `Reviewer status: ${dashboard.reviewer_status}`,
    `Packet integrity / version: ${dashboard.integrity} · deterministic render`,
  ]);

  addSection(lines,"Recommended Next Actions",numberedItems(model.recommended_next_actions.items.map(item=>`${item.text}${item.citation_references.length?` (Supported by ${item.citation_references.join(", ")})`:""}`),model.recommended_next_actions.empty_message));
  if(model.action_kit){const kit=model.action_kit;addSection(lines,"Agency Follow-Up Kit",[
    `Subject: ${plainText(kit.email_subject)}`,`Recipient / agency role: ${plainText(kit.recipient_role)}`,"Message:",plainText(kit.message_body),`Supported by: ${kit.citation_references.join(", ")}`,
    "Requested confirmations:",...kit.requested_confirmations.map((x,i)=>`  ${i+1}. ${plainText(x)}`),"Call script:",...kit.call_checklist.map((x,i)=>`  ${i+1}. ${plainText(x)}`),"Documents to have ready:",...(kit.documents_ready.length ? kit.documents_ready.map((x,i)=>`  ${i+1}. ${plainText(x)}`) : ["  Use only the cited packet sources listed above."]),`Escalation summary: ${plainText(kit.escalation_trigger)}`,`Next contact recommendation: ${plainText(kit.recipient_role)}`,...(kit.follow_up_date?[`Follow-up / review date: ${kit.follow_up_date}`]:[]),
  ]);} else { addSection(lines, "Agency Follow-Up Kit", ["No reviewer-approved findings support an Agency Follow-Up Kit for this edition."]); }

  addSection(
    lines,
    packetSectionTitle("case_overview"),
    model.case_overview.map(
      (item) =>
        `${plainText(item.label)}: ${plainText(item.information_class === "missing_information" ? "Pending record entry" : item.value)}`,
    ),
  );

  addSection(lines, "Current Status", [
    `Recorded workflow status: ${plainText(model.current_status.label)}`,
    `Authoritative readiness state: ${plainText(dashboard.permit_status)}`,
    `Case record updated: ${model.case_summary.updated_at_label}`,
  ]);

  addSection(lines,"Evidence Matrix",model.evidence_summaries.map(item=>`${item.reference} | ${plainText(item.title)} | ${item.evidence_type_label} | ${item.source.date_label} | ${item.verification_label} | ${plainText(item.source.label??"Source label pending")} | ${plainText(item.summary)}`));

  addSection(
    lines,
    packetSectionTitle("evidence_register"),
    model.evidence_summaries.length > 0
      ? model.evidence_summaries.flatMap((item, index) => {
          const missing = packetEvidenceMissingDetails(item);

          return [
            `${item.reference}. ${plainText(item.title)}`,
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
            `${entry.reference}. ${entry.occurred_on_label} — ${plainText(entry.title)}`,
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
    [...numberedItems(
      model.findings.items.map((item) => `${item.text}${item.citation_references.length?` (Supported by ${item.citation_references.join(", ")})`:""}`),
      model.findings.empty_message,
    ), ...(model.agency_dependencies ?? []).flatMap((item, index) => [
      `Agency dependency ${index + 1}:`,
      `  Discipline: ${plainText(item.discipline)}`,
      `  ↓ Blocking issue: ${plainText(item.blocking_issue)}`,
      `  ↓ Dependent review: ${plainText(item.dependent_review)}`,
      `  ↓ Recommended next step: ${plainText(item.recommended_next_step)} (Supported by ${item.citation_references.join(", ")})`,
    ])],
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
