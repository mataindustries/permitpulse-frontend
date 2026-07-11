import {
  packetSectionNumber,
  packetSectionTitle,
} from "./presentation";
import type { PacketModel, PacketSectionId } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("=", "&#61;");
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

function section(
  id: PacketSectionId,
  body: string,
  className = "",
): string {
  const title = packetSectionTitle(id);

  return `<section class="pp-packet-section ${className}" aria-labelledby="pp-packet-${id}-title">
    <div class="pp-packet-section-heading">
      <span>${packetSectionNumber(id)}</span>
      <h2 id="pp-packet-${id}-title">${escapeHtml(title)}</h2>
    </div>
    ${body}
  </section>`;
}

function renderCaseOverview(model: PacketModel): string {
  return `<dl class="pp-packet-meta">${model.case_overview
    .map(
      (item) => `<div>
        <dt>${escapeHtml(item.label)}</dt>
        <dd>${escapeHtml(item.value)}</dd>
      </div>`,
    )
    .join("")}</dl>`;
}

function renderEvidence(model: PacketModel): string {
  if (model.evidence_summaries.length === 0) {
    return `<p class="pp-packet-empty">No evidence records are included in this packet.</p>`;
  }

  return `<ol class="pp-packet-list">${model.evidence_summaries
    .map((item) => {
      const href = safeHref(item.source.url);
      const sourceUrl = href
        ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${escapeHtml(href)}</a>`
        : escapeHtml(item.source.url ?? "Not provided");

      return `<li class="pp-packet-record">
        <div class="pp-packet-record-heading">
          <div>
            <p class="pp-packet-record-kicker">${escapeHtml(item.evidence_type_label)}</p>
            <h3>${escapeHtml(item.title)}</h3>
          </div>
          <span class="pp-packet-evidence-badge pp-packet-evidence-badge--${escapeHtml(item.verification_status)}">${escapeHtml(item.verification_label)}</span>
        </div>
        <p>${escapeHtml(item.summary)}</p>
        <dl class="pp-packet-record-meta">
          <div><dt>Source</dt><dd>${escapeHtml(item.source.label ?? "Source label not provided")}</dd></div>
          <div><dt>Source date</dt><dd>${escapeHtml(item.source.date_label)}</dd></div>
          <div class="pp-packet-record-meta-wide"><dt>Provenance</dt><dd>${sourceUrl}</dd></div>
        </dl>
        <p class="pp-packet-note">${escapeHtml(item.verification_note)}</p>
      </li>`;
    })
    .join("")}</ol>`;
}

function renderTimeline(model: PacketModel): string {
  if (model.timeline_summaries.length === 0) {
    return `<p class="pp-packet-empty">No permit timeline events are included in this packet.</p>`;
  }

  return `<ol class="pp-packet-timeline">${model.timeline_summaries
    .map((entry) => {
      const linked = entry.linked_evidence.length > 0
        ? `<ul>${entry.linked_evidence
            .map(
              (item) =>
                `<li>${escapeHtml(item.title)} <span>(${escapeHtml(item.verification_label)})</span></li>`,
            )
            .join("")}</ul>`
        : `<p class="pp-packet-note">No supporting evidence linked.</p>`;

      return `<li>
        <div class="pp-packet-timeline-date">${escapeHtml(entry.occurred_on_label)}</div>
        <div class="pp-packet-timeline-content">
          <div class="pp-packet-record-heading">
            <div>
              <p class="pp-packet-record-kicker">${escapeHtml(entry.timeline_type_label)}</p>
              <h3>${escapeHtml(entry.title)}</h3>
            </div>
            <span class="pp-packet-source-pill">${escapeHtml(entry.source_label)}</span>
          </div>
          <p>${escapeHtml(entry.details)}</p>
          <h4>Supporting evidence</h4>
          ${linked}
        </div>
      </li>`;
    })
    .join("")}</ol>`;
}

function renderEditorial(
  items: readonly { text: string }[],
  emptyMessage: string,
): string {
  return items.length > 0
    ? `<ol class="pp-packet-editorial-list">${items
        .map((item) => `<li>${escapeHtml(item.text)}</li>`)
        .join("")}</ol>`
    : `<p class="pp-packet-empty">${escapeHtml(emptyMessage)}</p>`;
}

function renderSources(model: PacketModel): string {
  if (model.supporting_sources.length === 0) {
    return `<p class="pp-packet-empty">No supporting sources are included in this packet.</p>`;
  }

  return `<ol class="pp-packet-sources">${model.supporting_sources
    .map((source) => {
      const href = safeHref(source.url);
      const provenance = href
        ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${escapeHtml(href)}</a>`
        : "URL not provided";

      return `<li>
        <h3>${escapeHtml(source.title)}</h3>
        <p>${escapeHtml(source.label)} · ${escapeHtml(source.date_label)} · ${escapeHtml(source.verification_label)}</p>
        <p>${provenance}</p>
      </li>`;
    })
    .join("")}</ol>`;
}

export function renderPacketHtml(model: PacketModel): string {
  const presentationWarnings = model.warnings.length > 0
    ? `<ul class="pp-packet-warnings">${model.warnings
        .map((item) => `<li>${escapeHtml(item.text)}</li>`)
        .join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { color-scheme: light; --jade: #1c744d; --jade-dark: #144d36; --ink: #232a27; --muted: #65706a; --rule: #d9ded9; --paper: #fbfaf7; --soft: #f1f4f0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e8ebe8; color: var(--ink); font-family: Inter, "Helvetica Neue", Arial, sans-serif; font-size: 15px; line-height: 1.55; }
    a { color: var(--jade-dark); overflow-wrap: anywhere; }
    .pp-packet { width: min(100% - 32px, 850px); margin: 32px auto; background: var(--paper); box-shadow: 0 20px 55px rgba(27, 39, 32, .14); }
    .pp-packet-brand { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 3px solid var(--jade); padding: 28px 48px 20px; }
    .pp-packet-wordmark { color: var(--jade-dark); font-size: 18px; font-weight: 850; letter-spacing: .12em; }
    .pp-packet-brand-note { color: var(--muted); font-size: 11px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
    .pp-packet-cover { padding: 54px 48px 44px; }
    .pp-packet-cover h1 { max-width: 620px; margin: 0; color: #1e2522; font-family: Georgia, "Times New Roman", serif; font-size: clamp(36px, 7vw, 58px); font-weight: 600; letter-spacing: -.035em; line-height: 1.04; }
    .pp-packet-cover-project { margin: 22px 0 0; color: var(--jade-dark); font-size: 20px; font-weight: 750; }
    .pp-packet-status-line { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; margin-top: 28px; color: var(--muted); font-size: 13px; }
    .pp-packet-status-badge, .pp-packet-evidence-badge, .pp-packet-source-pill { display: inline-flex; align-items: center; border: 1px solid #68736d; border-radius: 999px; background: #fff; color: #303a35; font-size: 11px; font-weight: 800; letter-spacing: .08em; padding: 5px 10px; text-transform: uppercase; }
    .pp-packet-status-badge { border: 2px solid var(--jade-dark); color: var(--jade-dark); }
    .pp-packet-cover-note { max-width: 670px; margin: 22px 0 0; border-left: 3px solid var(--jade); color: var(--muted); padding-left: 14px; }
    .pp-packet-section { border-top: 1px solid var(--rule); padding: 38px 48px 44px; }
    .pp-packet-section-heading { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: baseline; margin-bottom: 24px; }
    .pp-packet-section-heading span { color: var(--jade); font-size: 11px; font-weight: 850; letter-spacing: .1em; }
    .pp-packet-section-heading h2 { margin: 0; color: #242c28; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 600; }
    .pp-packet-summary { color: #333d38; font-size: 17px; }
    .pp-packet-warnings { margin: 18px 0 0; border-left: 3px solid #68736d; background: var(--soft); color: var(--muted); padding: 12px 14px 12px 30px; font-size: 12px; }
    .pp-packet-meta, .pp-packet-record-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; margin: 0; }
    .pp-packet-meta > div { border-top: 1px solid var(--rule); padding-top: 10px; }
    dt { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
    dd { margin: 3px 0 0; font-weight: 650; overflow-wrap: anywhere; }
    .pp-packet-status-value { display: inline-flex; border-left: 4px solid var(--jade); background: var(--soft); color: var(--jade-dark); font-size: 19px; font-weight: 800; padding: 12px 16px; }
    .pp-packet-list, .pp-packet-editorial-list, .pp-packet-sources { display: grid; gap: 18px; margin: 0; padding: 0; list-style: none; }
    .pp-packet-record { border: 1px solid var(--rule); background: #fff; padding: 20px; }
    .pp-packet-record-heading { display: flex; gap: 18px; align-items: flex-start; justify-content: space-between; }
    .pp-packet-record h3, .pp-packet-timeline h3, .pp-packet-sources h3 { margin: 0; font-size: 16px; line-height: 1.3; }
    .pp-packet-record-kicker { margin: 0 0 4px; color: var(--jade); font-size: 10px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
    .pp-packet-record-meta { margin-top: 14px; border-top: 1px solid var(--rule); padding-top: 12px; }
    .pp-packet-record-meta-wide { grid-column: 1 / -1; }
    .pp-packet-note, .pp-packet-empty { color: var(--muted); }
    .pp-packet-note { margin-bottom: 0; font-size: 12px; }
    .pp-packet-empty { border: 1px solid var(--rule); background: var(--soft); padding: 16px; }
    .pp-packet-timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
    .pp-packet-timeline > li { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 22px; border-top: 1px solid var(--rule); padding: 20px 0; }
    .pp-packet-timeline-date { color: var(--jade-dark); font-size: 13px; font-weight: 800; }
    .pp-packet-timeline-content h4 { margin: 16px 0 4px; color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
    .pp-packet-timeline-content ul { margin: 0; padding-left: 18px; }
    .pp-packet-editorial-list { counter-reset: editorial; }
    .pp-packet-editorial-list li { position: relative; border-left: 2px solid var(--jade); background: var(--soft); padding: 14px 16px; }
    .pp-packet-sources li { border-bottom: 1px solid var(--rule); padding-bottom: 16px; }
    .pp-packet-sources p { margin: 5px 0 0; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .pp-packet-disclaimer { background: #f0f2ef; }
    .pp-packet-footer { display: flex; justify-content: space-between; gap: 20px; border-top: 3px solid var(--jade); color: var(--muted); font-size: 10px; padding: 18px 48px 24px; }
    @page { size: Letter; margin: .55in; }
    @media print { body { background: #fff; } .pp-packet { width: auto; margin: 0; box-shadow: none; } .pp-packet-section, .pp-packet-record, .pp-packet-timeline > li { break-inside: avoid; } a { color: inherit; text-decoration: none; } }
    @media (max-width: 620px) { .pp-packet { width: 100%; margin: 0; } .pp-packet-brand, .pp-packet-cover, .pp-packet-section, .pp-packet-footer { padding-left: 24px; padding-right: 24px; } .pp-packet-meta, .pp-packet-record-meta { grid-template-columns: 1fr; } .pp-packet-record-meta-wide { grid-column: auto; } .pp-packet-timeline > li { grid-template-columns: 1fr; gap: 8px; } }
  </style>
</head>
<body>
  <article class="pp-packet">
    <header>
      <div class="pp-packet-brand">
        <div class="pp-packet-wordmark">PERMITPULSE</div>
        <div class="pp-packet-brand-note">Permit intelligence</div>
      </div>
      <div class="pp-packet-cover">
        <h1>${escapeHtml(model.title)}</h1>
        <p class="pp-packet-cover-project">${escapeHtml(model.case_summary.project_name)}</p>
        <div class="pp-packet-status-line">
          <span class="pp-packet-status-badge">${escapeHtml(model.document_status_label)}</span>
          <span>Generated ${escapeHtml(model.generated_at_label)}</span>
          <span>Packet version ${model.packet_version}</span>
        </div>
        <p class="pp-packet-cover-note">${escapeHtml(model.draft_notice)}</p>
      </div>
    </header>
    ${section("executive_summary", `<p class="pp-packet-summary">${escapeHtml(model.executive_summary.text)}</p>${presentationWarnings}`)}
    ${section("case_overview", renderCaseOverview(model))}
    ${section("current_status", `<p class="pp-packet-status-value">${escapeHtml(model.current_status.label)}</p><p class="pp-packet-note">Case record updated ${escapeHtml(model.case_summary.updated_at_label)}</p>`)}
    ${section("evidence_register", renderEvidence(model))}
    ${section("permit_timeline", renderTimeline(model))}
    ${section("findings", renderEditorial(model.findings.items, model.findings.empty_message))}
    ${section("open_questions", renderEditorial(model.open_questions.items, model.open_questions.empty_message))}
    ${section("recommended_next_actions", renderEditorial(model.recommended_next_actions.items, model.recommended_next_actions.empty_message))}
    ${section("supporting_sources", renderSources(model))}
    ${section("disclaimer", `<p>${escapeHtml(model.disclaimer)}</p>`, "pp-packet-disclaimer")}
    <footer class="pp-packet-footer"><span>PermitPulse · Permit intelligence</span><span>Packet version ${model.packet_version}</span></footer>
  </article>
</body>
</html>`;
}
