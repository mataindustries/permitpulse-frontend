import type { PacketModel } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("=", "&#61;");
}

function formatDateOnly(value: string | null): string {
  return value ? escapeHtml(value) : "Not provided";
}

function safeHref(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function definition(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function htmlDateTime(value: string): string {
  const date = new Date(value);
  const label = Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();

  return `<time datetime="${escapeHtml(value)}">${escapeHtml(label)}</time>`;
}

function linkedEvidenceList(
  linkedEvidence: PacketModel["timeline_summaries"][number]["linked_evidence"],
  missingCount: number,
): string {
  if (linkedEvidence.length === 0 && missingCount === 0) {
    return `<p class="pp-packet-note">No supporting evidence linked.</p>`;
  }

  const loaded = linkedEvidence
    .map(
      (item) =>
        `<li>${escapeHtml(item.title)} (${escapeHtml(item.verification_label)})</li>`,
    )
    .join("");
  const missing =
    missingCount > 0
      ? `<li>${missingCount} linked evidence reference${
          missingCount === 1 ? "" : "s"
        } not loaded.</li>`
      : "";

  return `<ul class="pp-packet-reference-list">${loaded}${missing}</ul>`;
}

function renderEvidence(model: PacketModel): string {
  if (model.evidence_summaries.length === 0) {
    return `<p>No evidence records are available in this case.</p>`;
  }

  return `<ol class="pp-packet-list">${model.evidence_summaries
    .map((item) => {
      const href = safeHref(item.source.url);
      const urlValue = item.source.url
        ? href
          ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${escapeHtml(href)}</a>`
          : escapeHtml(item.source.url)
        : "Not provided";

      return `<li>
        <div class="pp-packet-item-heading">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="pp-packet-badge pp-packet-badge--${escapeHtml(item.verification_status)}">${escapeHtml(
            item.verification_label,
          )}</span>
        </div>
        <p>${escapeHtml(item.summary)}</p>
        <dl class="pp-packet-meta">
          ${definition("Type", escapeHtml(item.evidence_type_label))}
          ${definition("Source label", escapeHtml(item.source.label ?? "Not provided"))}
          ${definition("Source URL", urlValue)}
          ${definition("Source date", formatDateOnly(item.source.date))}
        </dl>
        <p class="pp-packet-note">${escapeHtml(item.verification_note)}</p>
      </li>`;
    })
    .join("")}</ol>`;
}

function renderTimeline(model: PacketModel): string {
  if (model.timeline_summaries.length === 0) {
    return `<p>No permit timeline records are available in this case.</p>`;
  }

  return `<ol class="pp-packet-list">${model.timeline_summaries
    .map(
      (entry) => `<li>
        <div class="pp-packet-item-heading">
          <strong>${escapeHtml(entry.title)}</strong>
          <span class="pp-packet-pill">${escapeHtml(entry.source_label)}</span>
        </div>
        <p><time datetime="${escapeHtml(entry.occurred_on)}">${escapeHtml(
          entry.occurred_on,
        )}</time> · ${escapeHtml(entry.timeline_type_label)}</p>
        <p>${escapeHtml(entry.details)}</p>
        <section class="pp-packet-linked-evidence" aria-label="Linked evidence references">
          <h4>Linked evidence references</h4>
          ${linkedEvidenceList(
            entry.linked_evidence,
            entry.missing_evidence_reference_count,
          )}
        </section>
      </li>`,
    )
    .join("")}</ol>`;
}

function renderActivity(model: PacketModel): string {
  if (model.recent_activity_summaries.length === 0) {
    return `<p>No recent case activity records are available in this case.</p>`;
  }

  return `<ol class="pp-packet-list">${model.recent_activity_summaries
    .map((entry) => {
      const fields =
        entry.changed_field_labels.length > 0
          ? `<p>Changed fields: ${escapeHtml(entry.changed_field_labels.join(", "))}</p>`
          : "";
      const status =
        entry.action === "case_status_changed" &&
        entry.from_status_label &&
        entry.to_status_label
          ? `<p>Status: ${escapeHtml(entry.from_status_label)} to ${escapeHtml(
              entry.to_status_label,
            )}</p>`
          : "";

      return `<li>
        <div class="pp-packet-item-heading">
          <strong>${escapeHtml(entry.action_label)}</strong>
          ${htmlDateTime(entry.created_at)}
        </div>
        <p>Actor: ${escapeHtml(entry.actor_label)}</p>
        ${fields}
        ${status}
      </li>`;
    })
    .join("")}</ol>`;
}

export function renderPacketHtml(model: PacketModel): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { color-scheme: light; }
    body { color: #17202a; font-family: Arial, sans-serif; line-height: 1.45; margin: 0; }
    .pp-packet { margin: 0 auto; max-width: 880px; padding: 32px; }
    .pp-packet-section { border-top: 1px solid #d8dee7; padding: 20px 0; page-break-inside: avoid; }
    .pp-packet-header { border-top: 0; }
    .pp-packet-meta { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pp-packet-meta dt { color: #506070; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .pp-packet-meta dd { margin: 2px 0 0; }
    .pp-packet-list { margin: 0; padding-left: 22px; }
    .pp-packet-list > li { margin-bottom: 18px; }
    .pp-packet-item-heading { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
    .pp-packet-badge, .pp-packet-pill { border: 1px solid #bac6d5; border-radius: 999px; font-size: 12px; padding: 2px 8px; }
    .pp-packet-note { color: #516170; }
    @media print {
      .pp-packet { max-width: none; padding: 0.45in; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <article class="pp-packet">
    <header class="pp-packet-section pp-packet-header">
      <p class="pp-packet-eyebrow">Packet header</p>
      <h1>${escapeHtml(model.title)}</h1>
      <p>${escapeHtml(model.draft_notice)}</p>
      <dl class="pp-packet-meta">
        ${definition("Project", escapeHtml(model.case_summary.project_name))}
        ${definition("Generated", htmlDateTime(model.generated_at))}
        ${definition("Jurisdiction", escapeHtml(model.jurisdiction))}
        ${definition("Permit number", escapeHtml(model.permit_number ?? "Not provided"))}
        ${definition("Case version", String(model.case_summary.version))}
      </dl>
    </header>

    <section class="pp-packet-section" aria-labelledby="pp-packet-summary-title">
      <h2 id="pp-packet-summary-title">Project summary</h2>
      <dl class="pp-packet-meta">
        ${definition("Client", escapeHtml(model.case_summary.client_name))}
        ${definition("Address", escapeHtml(model.case_summary.address))}
        ${definition("City", escapeHtml(model.case_summary.city))}
        ${definition("Updated", htmlDateTime(model.case_summary.updated_at))}
      </dl>
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-status-title">
      <h2 id="pp-packet-status-title">Current permit status</h2>
      <p>${escapeHtml(model.current_status.label)}</p>
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-evidence-title">
      <h2 id="pp-packet-evidence-title">Key evidence</h2>
      ${renderEvidence(model)}
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-timeline-title">
      <h2 id="pp-packet-timeline-title">Permit timeline</h2>
      ${renderTimeline(model)}
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-activity-title">
      <h2 id="pp-packet-activity-title">Recent case activity</h2>
      ${renderActivity(model)}
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-questions-title">
      <h2 id="pp-packet-questions-title">Open questions / missing information</h2>
      <p>${escapeHtml(model.open_questions.note)}</p>
      <p>${escapeHtml(model.open_questions.instruction)}</p>
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-actions-title">
      <h2 id="pp-packet-actions-title">Recommended next actions</h2>
      <p>${escapeHtml(model.recommended_next_actions.note)}</p>
      <p>${escapeHtml(model.recommended_next_actions.instruction)}</p>
    </section>

    <section class="pp-packet-section" aria-labelledby="pp-packet-disclaimer-title">
      <h2 id="pp-packet-disclaimer-title">Disclaimer / internal-review note</h2>
      <p>${escapeHtml(model.disclaimer)}</p>
    </section>
  </article>
</body>
</html>`;
}

