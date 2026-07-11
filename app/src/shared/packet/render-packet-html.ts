import {
  packetDashboard,
  packetEvidenceMissingDetails,
  packetTimelineChronology,
  packetTimelineReviewLabel,
} from "./presentation-summary";
import {
  packetSectionNumber,
  packetSectionTitle,
} from "./presentation";
import type {
  PacketEditorialSection,
  PacketFinding,
  PacketModel,
  PacketOpenQuestion,
  PacketRecommendedAction,
  PacketSectionId,
} from "./types";

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
  if (!value) return null;

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
  options: { className?: string; intro?: string } = {},
): string {
  const title = packetSectionTitle(id);
  const className = options.className ? ` ${options.className}` : "";
  const intro = options.intro
    ? `<p class="pp-section-intro">${escapeHtml(options.intro)}</p>`
    : "";

  return `<section class="pp-section pp-section--${id.replaceAll("_", "-")}${className}" aria-labelledby="pp-packet-${id}-title">
    <div class="pp-section-heading">
      <span>${packetSectionNumber(id)}</span>
      <div>
        <p>Client deliverable</p>
        <h2 id="pp-packet-${id}-title">${escapeHtml(title)}</h2>
      </div>
    </div>
    ${intro}
    ${body}
  </section>`;
}

function renderDashboard(model: PacketModel): string {
  const dashboard = packetDashboard(model);
  const kit=model.action_kit;
  const blockers = dashboard.blockers.length > 0
    ? `<ol class="pp-dashboard-blockers">${dashboard.blockers
        .slice(0, 3)
        .map(
          (item) => `<li>
            <span aria-hidden="true"></span>
            <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.resolution)}</p></div>
          </li>`,
        )
        .join("")}</ol>${dashboard.blockers.length > 3 ? `<p class="pp-dashboard-more">${dashboard.blockers.length - 3} additional condition${dashboard.blockers.length - 3 === 1 ? "" : "s"} documented in the packet.</p>` : ""}`
    : `<p class="pp-dashboard-clear"><strong>No primary blockers identified.</strong><span>The current packet record contains no deterministic blocking condition.</span></p>`;
  const warnings = model.warnings.length > 0
    ? `<ul class="pp-dashboard-notes">${model.warnings
        .map((item) => `<li>${escapeHtml(item.text)}</li>`)
        .join("")}</ul>`
    : "";

  return `<section class="pp-dashboard" aria-labelledby="pp-executive-dashboard-title">
    <div class="pp-dashboard-heading">
      <div>
        <p class="pp-kicker">01 / Decision snapshot / ${escapeHtml(packetSectionTitle("executive_summary"))}</p>
        <h2 id="pp-executive-dashboard-title">Executive Dashboard</h2>
      </div>
      <span class="pp-status-badge pp-status-badge--${model.document_status}">${escapeHtml(model.document_status_label)}</span>
    </div>
    <p class="pp-dashboard-summary">${escapeHtml(kit?.current_position??model.executive_summary.text)}</p>
    ${kit?`<dl class="pp-decision-lines"><div><dt>Record confirms</dt><dd>${escapeHtml(kit.confirmed_record)}</dd></div><div><dt>Record does not confirm</dt><dd>${escapeHtml(kit.unconfirmed_record)}</dd></div><div><dt>Primary blocker</dt><dd>${escapeHtml(kit.primary_blocker)}</dd></div><div><dt>Why this move</dt><dd>${escapeHtml(kit.why_appropriate)}</dd></div><div><dt>Evidence readiness</dt><dd>${escapeHtml(kit.evidence_readiness)}</dd></div><div><dt>Review readiness</dt><dd>${escapeHtml(kit.review_readiness)}</dd></div></dl>`:""}
    ${(model.executive_summary.key_risks.length || model.executive_summary.key_strengths.length) ? `<div class="pp-dashboard-grid">
      ${model.executive_summary.key_risks.length ? `<section class="pp-dashboard-panel"><p class="pp-panel-label">Key Risks</p><ul>${model.executive_summary.key_risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
      ${model.executive_summary.key_strengths.length ? `<section class="pp-dashboard-panel"><p class="pp-panel-label">Key Strengths</p><ul>${model.executive_summary.key_strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    </div>` : ""}
    <div class="pp-dashboard-metrics">
      <div class="pp-metric-card">
        <span>Permit status</span>
        <strong>${escapeHtml(dashboard.permit_status)}</strong>
        <small>Recorded case status</small>
      </div>
      <div class="pp-metric-card pp-metric-card--${dashboard.mission_health.tone}">
        <span>Overall Mission Health</span>
        <strong>${escapeHtml(dashboard.mission_health.label)}</strong>
        <small>${dashboard.mission_health.score}% · ${escapeHtml(dashboard.mission_health.explanation)}</small>
      </div>
      <div class="pp-metric-card pp-metric-card--score">
        <span>Readiness score</span>
        <strong>${dashboard.readiness.score}%</strong>
        <small>${escapeHtml(dashboard.readiness.explanation)}</small>
      </div>
    </div>
    <div class="pp-dashboard-grid">
      <section class="pp-dashboard-panel" aria-labelledby="pp-primary-blockers-title">
        <p class="pp-panel-label" id="pp-primary-blockers-title">Primary blockers</p>
        ${blockers}
      </section>
      <section class="pp-dashboard-panel pp-dashboard-panel--action" aria-labelledby="pp-recommended-action-title">
        <p class="pp-panel-label" id="pp-recommended-action-title">Recommended next action</p>
        <strong>${escapeHtml(dashboard.recommended_action.title)}</strong>
        <p>${escapeHtml(dashboard.recommended_action.detail)}</p>
      </section>
    </div>
    <section class="pp-evidence-snapshot" aria-labelledby="pp-evidence-summary-title">
      <div>
        <p class="pp-panel-label" id="pp-evidence-summary-title">Evidence summary</p>
        <p>${escapeHtml(dashboard.evidence.text)}</p>
      </div>
      <dl>
        <div><dt>Verified</dt><dd>${dashboard.evidence.verified}</dd></div>
        <div><dt>Unverified</dt><dd>${dashboard.evidence.unverified}</dd></div>
        <div><dt>Disputed</dt><dd>${dashboard.evidence.disputed}</dd></div>
      </dl>
    </section>
    ${warnings}
    <aside class="pp-packet-metadata" aria-label="Packet metadata">
      <div><span>Packet version</span><strong>${model.packet_version}</strong></div>
      <div><span>Generation date</span><strong>${escapeHtml(model.generated_at_label)}</strong></div>
      <div><span>Lifecycle status</span><strong>${escapeHtml(dashboard.lifecycle_status)}</strong></div>
      <div><span>Reviewer status</span><strong>${escapeHtml(dashboard.reviewer_status)}</strong></div>
      <div class="pp-packet-metadata-wide"><span>Packet integrity / version</span><strong>${escapeHtml(dashboard.integrity)} · deterministic render</strong></div>
    </aside>
  </section>`;
}

function renderCaseOverview(model: PacketModel): string {
  return `<dl class="pp-case-grid">${model.case_overview
    .map((item) => {
      const value = item.information_class === "missing_information"
        ? "Pending record entry"
        : item.value;
      return `<div class="${item.information_class === "missing_information" ? "pp-case-grid--pending" : ""}">
        <dt>${escapeHtml(item.label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>`;
    })
    .join("")}</dl>`;
}

function renderEvidence(model: PacketModel): string {
  if (model.evidence_summaries.length === 0) {
    return `<p class="pp-editorial-empty"><strong>Evidence register not yet assembled.</strong><span>No evidence records are included in this packet.</span></p>`;
  }

  return `<ol class="pp-evidence-list">${model.evidence_summaries
    .map((item, index) => {
      const href = safeHref(item.source.url);
      const missing = packetEvidenceMissingDetails(item);
      const metadata = [
        item.source.label?.trim()
          ? `<div><dt>Source</dt><dd>${escapeHtml(item.source.label)}</dd></div>`
          : "",
        item.source.date
          ? `<div><dt>Source date</dt><dd>${escapeHtml(item.source.date_label)}</dd></div>`
          : "",
        href
          ? `<div class="pp-evidence-meta-wide"><dt>Provenance</dt><dd><a href="${escapeHtml(href)}" rel="noreferrer noopener">${escapeHtml(href)}</a></dd></div>`
          : "",
      ].filter(Boolean).join("");
      const missingNote = missing.length > 0
        ? `<p class="pp-evidence-incomplete">Source details pending: ${escapeHtml(missing.join(", "))}.</p>`
        : "";

      return `<li class="pp-evidence-card">
        <div class="pp-evidence-card-header">
          <div>
            <p>${item.reference} · ${escapeHtml(item.evidence_type_label)}</p>
            <h3>${escapeHtml(item.title)}</h3>
          </div>
          <span class="pp-verification-badge pp-verification-badge--${item.verification_status}">${escapeHtml(item.verification_label)}</span>
        </div>
        <p class="pp-evidence-summary">${escapeHtml(item.summary)}</p>
        ${metadata ? `<dl class="pp-evidence-meta">${metadata}</dl>` : ""}
        ${missingNote}
        <div class="pp-reviewer-note"><span>Reviewer note</span><p>${escapeHtml(item.verification_note)}</p></div>
      </li>`;
    })
    .join("")}</ol>`;
}

function renderTimeline(model: PacketModel): string {
  const timeline = packetTimelineChronology(model);

  if (timeline.length === 0) {
    return `<p class="pp-editorial-empty"><strong>Permit history not yet assembled.</strong><span>No permit timeline events are included in this packet.</span></p>`;
  }

  return `<ol class="pp-timeline">${timeline
    .map((entry, index) => {
      const linked = entry.linked_evidence.length > 0
        ? `<ul class="pp-linked-evidence">${entry.linked_evidence
            .map(
              (item) => `<li><span>${escapeHtml(item.verification_label)}</span>${escapeHtml(item.title)}</li>`,
            )
            .join("")}</ul>`
        : `<p class="pp-timeline-unlinked">No supporting evidence linked. Evidence linkage has not been recorded for this event.</p>`;
      const reviewLabel = packetTimelineReviewLabel(entry);

      return `<li class="pp-timeline-event">
        <div class="pp-timeline-rail"><span>${entry.reference}</span></div>
        <div class="pp-timeline-date"><time datetime="${escapeHtml(entry.occurred_on)}">${escapeHtml(entry.occurred_on_label)}</time><span>${escapeHtml(entry.timeline_type_label)}</span></div>
        <article>
          <div class="pp-timeline-heading">
            <h3>${escapeHtml(entry.title)}</h3>
            <div><span class="pp-source-pill">${escapeHtml(entry.source_label)}</span><span class="pp-review-pill pp-review-pill--${entry.information_class}" aria-label="Review status">${reviewLabel}</span></div>
          </div>
          <p>${escapeHtml(entry.details)}</p>
          <div class="pp-timeline-evidence"><span>Supporting evidence</span>${linked}</div>
        </article>
      </li>`;
    })
    .join("")}</ol>`;
}

type EditorialItem = PacketFinding | PacketOpenQuestion | PacketRecommendedAction;

function renderEditorial(
  sectionValue: PacketEditorialSection<EditorialItem>,
  itemLabel: string,
): string {
  if (sectionValue.items.length === 0) {
    return `<p class="pp-editorial-empty"><strong>Editorial status</strong><span>${escapeHtml(sectionValue.empty_message)}</span></p>`;
  }

  return `<ol class="pp-editorial-list">${sectionValue.items
    .map((item, index) => {
      const supportIds = "supporting_source_ids" in item
        ? item.supporting_source_ids
        : [];
      const references = "citation_references" in item ? item.citation_references : [];
      const support = references.length > 0
        ? `<span>Supported by ${escapeHtml(references.join(", "))}</span>`
        : "";

      return `<li>
        <div class="pp-editorial-index"><span>${escapeHtml(itemLabel)}</span><strong>${String(index + 1).padStart(2, "0")}</strong></div>
        <div><p>${escapeHtml(item.text)}</p>${support}</div>
      </li>`;
    })
    .join("")}</ol>`;
}

function renderEvidenceMatrix(model:PacketModel):string {
  return `<div class="pp-source-table pp-evidence-matrix" role="table"><div class="pp-source-table-head" role="row"><span>Reference / evidence</span><span>Source / provenance</span><span>Review</span></div>${model.evidence_summaries.map(item=>`<div class="pp-source-row" role="row"><div><span>${item.reference}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.evidence_type_label)} · ${escapeHtml(item.source.date_label)}</small></div><div>${escapeHtml(item.source.label??"Source label pending")}<br>${escapeHtml(item.source.url??"Digital provenance not recorded")}</div><div><span class="pp-source-pill">${escapeHtml(item.verification_label)}</span><small>${escapeHtml(item.summary)}</small></div></div>`).join("")}</div>`;
}

function renderActionKit(model:PacketModel):string {
  const kit=model.action_kit;if(!kit)return `<p class="pp-editorial-empty"><strong>Not approved</strong><span>No reviewer-approved Agency Follow-Up Kit is included.</span></p>`;
  const list=(title:string,items:string[])=>`<section class="pp-dashboard-panel"><p class="pp-panel-label">${escapeHtml(title)}</p><ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></section>`;
  return `<div class="pp-action-kit"><dl class="pp-case-grid"><div><dt>Subject</dt><dd>${escapeHtml(kit.email_subject)}</dd></div><div><dt>Recipient / role</dt><dd>${escapeHtml(kit.recipient_role)}</dd></div></dl><div class="pp-message-body">${escapeHtml(kit.message_body).replaceAll("\n","<br>")}</div><p class="pp-citations">Supported by ${escapeHtml(kit.citation_references.join(", "))}</p><div class="pp-dashboard-grid">${list("Requested confirmations",kit.requested_confirmations)}${list("Call checklist",kit.call_checklist)}${list("Documents to have ready",kit.documents_ready)}<section class="pp-dashboard-panel"><p class="pp-panel-label">Trigger for escalation</p><p>${escapeHtml(kit.escalation_trigger)}</p>${kit.follow_up_date?`<strong>Review date: ${escapeHtml(kit.follow_up_date)}</strong>`:""}</section></div></div>`;
}

function renderSources(model: PacketModel): string {
  if (model.supporting_sources.length === 0) {
    return `<p class="pp-editorial-empty"><strong>Source log is empty.</strong><span>No supporting sources are included in this packet edition.</span></p>`;
  }

  return `<div class="pp-source-table" role="table" aria-label="Supporting source log">
    <div class="pp-source-table-head" role="row"><span role="columnheader">Source record</span><span role="columnheader">Provenance</span><span role="columnheader">Review</span></div>
    ${model.supporting_sources
      .map((source, index) => {
        const href = safeHref(source.url);
        const provenance = href
          ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${escapeHtml(href)}</a>`
          : `<span>Digital provenance not recorded</span>`;
        const label = source.label === "Source label not provided"
          ? "Source label pending"
          : source.label;
        const date = source.date_label === "Not provided"
          ? "Source date pending"
          : source.date_label;

        return `<div class="pp-source-row" role="row">
          <div role="cell"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(label)} · ${escapeHtml(date)}</small></div>
          <div role="cell">${provenance}</div>
          <div role="cell"><span class="pp-source-pill">${escapeHtml(source.verification_label)}</span></div>
        </div>`;
      })
      .join("")}
  </div>`;
}

export function renderPacketHtml(model: PacketModel): string {
  const dashboard = packetDashboard(model);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { color-scheme: light; --jade: #1c744d; --jade-dark: #114d35; --jade-soft: #e9f2ec; --navy: #0b1d2c; --navy-soft: #132a3d; --orange: #e5653f; --ink: #202824; --muted: #617068; --rule: #d5ddd7; --paper: #fbfaf7; --soft: #f0f3ef; --white: #fff; --warning: #b56a20; --danger: #a2413a; }
    * { box-sizing: border-box; }
    html { background: #dde3df; }
    body { margin: 0; color: var(--ink); background: #dde3df; font-family: Inter, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.52; }
    a { color: var(--jade-dark); overflow-wrap: anywhere; }
    .pp-packet { width: min(100% - 32px, 880px); margin: 32px auto; background: var(--paper); box-shadow: 0 24px 70px rgba(11, 29, 44, .18); }
    .pp-cover { position: relative; overflow: hidden; background: var(--paper); }
    .pp-cover::before { position: absolute; inset: 0 0 auto; height: 7px; background: linear-gradient(90deg, var(--orange) 0 30%, var(--jade) 30% 100%); content: ""; }
    .pp-brand { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid rgba(255,255,255,.14); background: var(--navy); color: #fff; padding: 24px 48px 18px; }
    .pp-wordmark { display: flex; gap: 12px; align-items: baseline; font-size: 17px; font-weight: 900; letter-spacing: .13em; }
    .pp-wordmark span { color: #56bf8c; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
    .pp-brand-note { color: #bfd0c7; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .pp-cover-intro { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(220px, .65fr); gap: 32px; background: var(--navy); color: #fff; padding: 34px 48px 38px; }
    .pp-kicker, .pp-panel-label { margin: 0; color: var(--jade); font-size: 9px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .pp-cover-intro .pp-kicker { color: #65c998; }
    .pp-cover-intro h1 { max-width: 520px; margin: 8px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(35px, 6vw, 52px); font-weight: 600; letter-spacing: -.035em; line-height: 1.02; }
    .pp-project-name { margin: 18px 0 0; color: #fff; font-size: 17px; font-weight: 800; }
    .pp-project-location { margin: 5px 0 0; color: #b9c9c1; font-size: 12px; }
    .pp-cover-identity { display: grid; align-content: start; gap: 13px; margin: 0; border-left: 1px solid rgba(255,255,255,.16); padding-left: 24px; }
    .pp-cover-identity div { display: grid; gap: 2px; }
    .pp-cover-identity dt { color: #78cda1; font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .pp-cover-identity dd { margin: 0; color: #fff; font-size: 11px; font-weight: 700; overflow-wrap: anywhere; }
    .pp-dashboard { padding: 30px 48px 34px; }
    .pp-dashboard-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
    .pp-dashboard-heading h2 { margin: 3px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: 28px; font-weight: 600; letter-spacing: -.02em; }
    .pp-status-badge, .pp-verification-badge, .pp-source-pill, .pp-review-pill { display: inline-flex; align-items: center; border: 1px solid currentColor; border-radius: 999px; background: #fff; font-size: 8px; font-weight: 900; letter-spacing: .09em; padding: 5px 9px; text-transform: uppercase; white-space: nowrap; }
    .pp-status-badge { border: 0; background: var(--jade-dark); color: #fff; }
    .pp-status-badge--delivered { background: var(--navy); }
    .pp-dashboard-summary { max-width: 740px; margin: 13px 0 0; color: #39443e; font-family: Georgia, "Times New Roman", serif; font-size: 15px; line-height: 1.55; }
    .pp-decision-lines { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 18px;margin:12px 0 0;border-top:1px solid var(--rule);padding-top:9px; }
    .pp-decision-lines div { display:grid;grid-template-columns:105px minmax(0,1fr);gap:7px; }
    .pp-decision-lines dt { color:var(--jade);font-size:7px;font-weight:900;text-transform:uppercase; }
    .pp-decision-lines dd { margin:0;font-size:8px; }
    .pp-dashboard-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
    .pp-metric-card { position: relative; min-height: 92px; overflow: hidden; border: 1px solid var(--rule); background: #fff; padding: 14px 15px; }
    .pp-metric-card::before { position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--jade); content: ""; }
    .pp-metric-card--attention::before { background: var(--warning); }
    .pp-metric-card--at_risk::before { background: var(--danger); }
    .pp-metric-card--score { background: var(--navy); color: #fff; }
    .pp-metric-card--score::before { background: var(--orange); }
    .pp-metric-card > span { display: block; color: var(--muted); font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .pp-metric-card--score > span, .pp-metric-card--score small { color: #b9c9c1; }
    .pp-metric-card strong { display: block; margin-top: 7px; font-size: 18px; line-height: 1.15; }
    .pp-metric-card small { display: block; margin-top: 6px; color: var(--muted); font-size: 8px; line-height: 1.35; }
    .pp-dashboard-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 10px; margin-top: 10px; }
    .pp-dashboard-panel { border: 1px solid var(--rule); background: var(--soft); padding: 14px 15px; }
    .pp-dashboard-panel--action { border: 0; background: var(--jade-dark); color: #fff; }
    .pp-dashboard-panel--action .pp-panel-label { color: #8cdbb2; }
    .pp-dashboard-panel--action > strong { display: block; margin-top: 9px; font-size: 13px; line-height: 1.35; }
    .pp-dashboard-panel--action > p:last-child { margin: 7px 0 0; color: #c8dbd1; font-size: 9px; }
    .pp-dashboard-blockers { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
    .pp-dashboard-blockers li { display: grid; grid-template-columns: 6px minmax(0, 1fr); gap: 9px; }
    .pp-dashboard-blockers li > span { width: 6px; height: 6px; margin-top: 5px; border-radius: 50%; background: var(--orange); }
    .pp-dashboard-blockers strong { font-size: 10px; }
    .pp-dashboard-blockers p, .pp-dashboard-more { margin: 2px 0 0; color: var(--muted); font-size: 8px; }
    .pp-dashboard-clear { display: grid; gap: 4px; margin: 10px 0 0; }
    .pp-dashboard-clear strong { color: var(--jade-dark); font-size: 11px; }
    .pp-dashboard-clear span { color: var(--muted); font-size: 9px; }
    .pp-evidence-snapshot { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; margin-top: 10px; border: 1px solid var(--rule); background: #fff; padding: 12px 15px; }
    .pp-evidence-snapshot p:last-child { margin: 4px 0 0; color: var(--muted); font-size: 9px; }
    .pp-evidence-snapshot dl { display: flex; gap: 16px; margin: 0; }
    .pp-evidence-snapshot dl div { text-align: center; }
    .pp-evidence-snapshot dt { color: var(--muted); font-size: 7px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .pp-evidence-snapshot dd { margin: 1px 0 0; font-size: 15px; font-weight: 850; }
    .pp-dashboard-notes { margin: 9px 0 0; border-left: 3px solid var(--warning); background: #fbf4e9; color: #6c573e; padding: 8px 12px 8px 27px; font-size: 8px; }
    .pp-packet-metadata { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin-top: 10px; border: 1px solid var(--rule); background: var(--soft); }
    .pp-packet-metadata > div { min-width: 0; border-right: 1px solid var(--rule); padding: 9px 11px; }
    .pp-packet-metadata > div:nth-child(4) { border-right: 0; }
    .pp-packet-metadata-wide { grid-column: 1 / -1; border-top: 1px solid var(--rule); border-right: 0 !important; }
    .pp-packet-metadata span { display: block; color: var(--muted); font-size: 7px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .pp-packet-metadata strong { display: block; margin-top: 3px; font-size: 8.5px; overflow-wrap: anywhere; }
    .pp-section { border-top: 1px solid var(--rule); background: var(--paper); padding: 38px 48px 44px; }
    .pp-section-heading { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 11px; align-items: start; margin-bottom: 20px; break-after: avoid; page-break-after: avoid; }
    .pp-section-heading > span { padding-top: 4px; color: var(--orange); font-size: 9px; font-weight: 900; letter-spacing: .1em; }
    .pp-section-heading p { margin: 0 0 2px; color: var(--jade); font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .pp-section-heading h2 { margin: 0; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 600; letter-spacing: -.02em; }
    .pp-section-intro { max-width: 700px; margin: -7px 0 22px 45px; color: var(--muted); font-size: 11px; }
    .pp-case-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; margin: 0; }
    .pp-case-grid > div { border-top: 1px solid var(--rule); padding-top: 9px; }
    .pp-case-grid dt, .pp-evidence-meta dt { color: var(--muted); font-size: 8px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .pp-case-grid dd, .pp-evidence-meta dd { margin: 3px 0 0; font-weight: 720; overflow-wrap: anywhere; }
    .pp-case-grid--pending dd { color: var(--warning); }
    .pp-status-callout { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 17px; align-items: center; border-left: 4px solid var(--jade); background: var(--jade-soft); padding: 15px 18px; }
    .pp-status-callout strong { color: var(--jade-dark); font-size: 18px; }
    .pp-status-callout p { margin: 2px 0 0; color: var(--muted); font-size: 10px; }
    .pp-evidence-list { display: grid; gap: 15px; margin: 0; padding: 0; list-style: none; }
    .pp-evidence-card { position: relative; break-inside: avoid; page-break-inside: avoid; border: 1px solid var(--rule); background: #fff; padding: 18px 19px 0; }
    .pp-evidence-card::before { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--jade); content: ""; }
    .pp-evidence-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .pp-evidence-card-header p { margin: 0 0 4px; color: var(--jade); font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .pp-evidence-card-header h3 { margin: 0; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.25; }
    .pp-verification-badge--verified { color: var(--jade-dark); background: var(--jade-soft); }
    .pp-verification-badge--unverified { color: var(--warning); background: #fff8eb; }
    .pp-verification-badge--disputed { color: var(--danger); background: #fff0ed; }
    .pp-evidence-summary { margin: 13px 0 0; color: #39443e; }
    .pp-evidence-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; margin: 14px 0 0; border-top: 1px solid var(--rule); padding-top: 11px; }
    .pp-evidence-meta-wide { grid-column: 1 / -1; }
    .pp-evidence-incomplete { margin: 12px 0 0; color: var(--warning); font-size: 9px; }
    .pp-reviewer-note { display: grid; grid-template-columns: 95px minmax(0, 1fr); gap: 12px; margin: 14px -19px 0; background: var(--soft); padding: 10px 19px; }
    .pp-reviewer-note span, .pp-timeline-evidence > span { color: var(--muted); font-size: 8px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .pp-reviewer-note p { margin: 0; color: var(--muted); font-size: 9px; }
    .pp-timeline { margin: 0; padding: 0; list-style: none; }
    .pp-timeline-event { display: grid; grid-template-columns: 28px 122px minmax(0, 1fr); gap: 14px; break-inside: avoid; page-break-inside: avoid; }
    .pp-timeline-rail { position: relative; min-height: 100%; border-right: 1px solid var(--rule); }
    .pp-timeline-rail::before { position: absolute; top: 8px; right: -5px; width: 9px; height: 9px; border: 2px solid var(--paper); border-radius: 50%; background: var(--orange); content: ""; }
    .pp-timeline-rail span { color: var(--muted); font-size: 7px; font-weight: 900; }
    .pp-timeline-date { display: grid; align-content: start; gap: 5px; padding: 2px 0 27px; }
    .pp-timeline-date time { color: var(--navy); font-size: 10px; font-weight: 850; }
    .pp-timeline-date span { color: var(--jade); font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .pp-timeline-event article { margin-bottom: 24px; border: 1px solid var(--rule); background: #fff; padding: 15px 16px; }
    .pp-timeline-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .pp-timeline-heading h3 { margin: 0; color: var(--navy); font-size: 14px; }
    .pp-timeline-heading > div { display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end; }
    .pp-source-pill { color: var(--muted); }
    .pp-review-pill { color: var(--warning); }
    .pp-review-pill--confirmed_fact { color: var(--jade-dark); background: var(--jade-soft); }
    .pp-timeline-event article > p { margin: 10px 0 0; }
    .pp-timeline-evidence { margin-top: 13px; border-top: 1px solid var(--rule); padding-top: 10px; }
    .pp-linked-evidence { display: grid; gap: 5px; margin: 7px 0 0; padding: 0; list-style: none; }
    .pp-linked-evidence li { display: flex; gap: 7px; align-items: baseline; color: var(--muted); font-size: 9px; }
    .pp-linked-evidence li span { color: var(--jade); font-size: 7px; font-weight: 900; text-transform: uppercase; }
    .pp-timeline-unlinked { margin: 7px 0 0; color: var(--warning); font-size: 9px; }
    .pp-editorial-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .pp-editorial-list li { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 16px; break-inside: avoid; page-break-inside: avoid; border-top: 1px solid var(--rule); padding: 13px 0; }
    .pp-editorial-index { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--jade); }
    .pp-editorial-index span { font-size: 7px; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
    .pp-editorial-index strong { color: var(--orange); font-size: 10px; }
    .pp-editorial-list li > div:last-child p { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 14px; line-height: 1.48; }
    .pp-editorial-list li > div:last-child span { display: inline-block; margin-top: 6px; color: var(--muted); font-size: 8px; font-weight: 800; text-transform: uppercase; }
    .pp-editorial-empty { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 18px; margin: 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 13px 0; }
    .pp-editorial-empty strong { color: var(--jade-dark); }
    .pp-editorial-empty span { color: var(--muted); }
    .pp-source-table { border: 1px solid var(--rule); background: #fff; }
    .pp-source-table-head, .pp-source-row { display: grid; grid-template-columns: 1.35fr 1fr 90px; gap: 0; }
    .pp-source-table-head { background: var(--navy); color: #fff; }
    .pp-source-table-head span { padding: 8px 11px; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .pp-source-row { break-inside: avoid; page-break-inside: avoid; border-top: 1px solid var(--rule); }
    .pp-source-row > div { min-width: 0; border-right: 1px solid var(--rule); padding: 10px 11px; overflow-wrap: anywhere; }
    .pp-source-row > div:last-child { border-right: 0; }
    .pp-source-row > div:first-child { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 1px 5px; }
    .pp-source-row > div:first-child > span { grid-row: 1 / 3; color: var(--orange); font-size: 8px; font-weight: 900; }
    .pp-source-row strong { font-size: 10px; }
    .pp-source-row small { grid-column: 2; color: var(--muted); font-size: 8px; }
    .pp-source-row > div:nth-child(2) { color: var(--muted); font-size: 8px; }
    .pp-section--disclaimer { background: var(--soft); }
    .pp-disclaimer { margin: 0; color: var(--muted); font-size: 10px; }
    .pp-message-body { margin-top: 16px; border-left: 4px solid var(--jade); background: #fff; padding: 16px; white-space: normal; }
    .pp-citations { color: var(--jade-dark); font-size: 9px; font-weight: 800; }
    .pp-footer { display: flex; justify-content: space-between; gap: 20px; border-top: 5px solid var(--navy); color: var(--muted); font-size: 8px; padding: 16px 48px 20px; }
    @page { size: Letter; margin: .45in; }
    @media print {
      html, body { background: #fff; }
      body { font-size: 10pt; }
      .pp-packet { width: auto; margin: 0; box-shadow: none; }
      .pp-cover { break-after: page; page-break-after: always; }
      .pp-section--evidence-register, .pp-section--permit-timeline, .pp-section--findings { break-before: page; page-break-before: always; }
      .pp-section-heading, h2, h3 { break-after: avoid; page-break-after: avoid; }
      .pp-evidence-card, .pp-timeline-event, .pp-editorial-list li, .pp-source-row, .pp-status-callout { break-inside: avoid; page-break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
    @media (max-width: 680px) {
      .pp-packet { width: 100%; margin: 0; }
      .pp-brand, .pp-cover-intro, .pp-dashboard, .pp-section, .pp-footer { padding-left: 22px; padding-right: 22px; }
      .pp-cover-intro, .pp-dashboard-grid { grid-template-columns: 1fr; }
      .pp-decision-lines { grid-template-columns:1fr; }
      .pp-cover-identity { border-top: 1px solid rgba(255,255,255,.16); border-left: 0; padding-top: 16px; padding-left: 0; }
      .pp-dashboard-metrics { grid-template-columns: 1fr; }
      .pp-evidence-snapshot { grid-template-columns: 1fr; }
      .pp-packet-metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pp-packet-metadata > div:nth-child(2) { border-right: 0; }
      .pp-packet-metadata > div:nth-child(3), .pp-packet-metadata > div:nth-child(4) { border-top: 1px solid var(--rule); }
      .pp-case-grid, .pp-evidence-meta { grid-template-columns: 1fr; }
      .pp-evidence-meta-wide { grid-column: auto; }
      .pp-timeline-event { grid-template-columns: 20px minmax(0, 1fr); }
      .pp-timeline-date { grid-column: 2; padding-bottom: 3px; }
      .pp-timeline-event article { grid-column: 2; }
      .pp-timeline-rail { grid-row: 1 / 3; }
      .pp-source-table-head { display: none; }
      .pp-source-row { grid-template-columns: 1fr; }
      .pp-source-row > div { border-right: 0; border-bottom: 1px solid var(--rule); }
      .pp-source-row > div:last-child { border-bottom: 0; }
    }
  </style>
</head>
<body>
  <article class="pp-packet">
    <header class="pp-cover">
      <div class="pp-brand">
        <div class="pp-wordmark">PERMITPULSE <span>Permit intelligence</span></div>
        <div class="pp-brand-note">Professional permit review</div>
      </div>
      <div class="pp-cover-intro">
        <div>
          <p class="pp-kicker">Client permit deliverable</p>
          <h1>${escapeHtml(model.title)}</h1>
          <p class="pp-project-name">${escapeHtml(model.case_summary.project_name)}</p>
          <p class="pp-project-location">${escapeHtml([model.case_summary.address, model.case_summary.city].filter(Boolean).join(", "))}</p>
        </div>
        <dl class="pp-cover-identity">
          <div><dt>Prepared for</dt><dd>${escapeHtml(model.case_summary.client_name)}</dd></div>
          <div><dt>Jurisdiction</dt><dd>${escapeHtml(model.jurisdiction)}</dd></div>
          <div><dt>Permit identifier</dt><dd>${escapeHtml(model.permit_number?.trim() || "Pending record entry")}</dd></div>
          <div><dt>Packet status</dt><dd>${escapeHtml(dashboard.lifecycle_status)}</dd></div>
        </dl>
      </div>
      ${renderDashboard(model)}
    </header>
    ${section("recommended_next_actions", renderEditorial(model.recommended_next_actions, "Action"), { intro: "Reviewer-approved client actions only. PermitPulse system operations are excluded." })}
    ${section("agency_follow_up_kit", renderActionKit(model))}
    ${section("case_overview", renderCaseOverview(model), { intro: `Current Status: ${model.current_status.label}. Core project identity and jurisdiction information carried forward from the case record.` })}
    ${section("findings", renderEditorial(model.findings, "Finding"), { intro: "Reviewer-authored conclusions included in this packet edition. No finding is generated by the presentation layer." })}
    ${section("open_questions", renderEditorial(model.open_questions, "Question"), { intro: "Unresolved items that remain explicitly open in the reviewed packet record." })}
    ${section("evidence_matrix",renderEvidenceMatrix(model),{intro:"Compact index of every evidence record; full source notes and review detail remain in the register."})}
    ${section("permit_timeline", renderTimeline(model), { intro: "Chronological permit history, earliest to latest. Each event retains its recorded type, source classification, evidence linkage, and review status." })}
    ${section("evidence_register", renderEvidence(model), { intro: "Detailed evidence register preserving summaries, provenance, source notes, and reviewer status." })}
    ${section("supporting_sources", renderSources(model), { intro: "Compact source log for the evidence cited throughout the packet." })}
    ${section("disclaimer", `<p class="pp-disclaimer">${escapeHtml(model.disclaimer)}</p>`, { className: "pp-section--disclaimer" })}
    <footer class="pp-footer"><span>PermitPulse · Permit intelligence</span><span>${escapeHtml(dashboard.integrity)} · deterministic render</span></footer>
  </article>
</body>
</html>`;
}
