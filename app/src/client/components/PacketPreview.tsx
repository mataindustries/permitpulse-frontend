import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CaseActivityResponse, CaseDto } from "../types/cases";
import type { EvidenceItemDto, TimelineEntryDto } from "../types/evidence-timeline";
import { getPacketPresentation } from "../api/packet";
import type { PacketPresentationResponse } from "../api/packet";
import { buildPacketModel } from "../../shared/packet/build-packet-model";
import {
  packetSectionNumber,
  packetSectionTitle,
} from "../../shared/packet/presentation";
import {
  packetDashboard,
  packetEvidenceMissingDetails,
  packetTimelineChronology,
  packetTimelineReviewLabel,
} from "../../shared/packet/presentation-summary";
import { renderPacketText } from "../../shared/packet/render-packet-text";
import type {
  PacketFinding,
  PacketOpenQuestion,
  PacketRecommendedAction,
  PacketSectionId,
} from "../../shared/packet/types";
import { safeExternalHref } from "./evidenceTimelineUtils";

interface PacketPreviewProps {
  activityResponse: CaseActivityResponse | null;
  caseRecord: CaseDto;
  evidence: EvidenceItemDto[];
  initialCopyStatus?: "idle" | "success" | "error";
  timeline: TimelineEntryDto[];
}

interface PacketTextInput extends PacketPreviewProps {
  generatedAt: Date;
}

export function compilePacketText(input: PacketTextInput): string {
  return renderPacketText(buildPacketModel(input));
}

export async function copyPacketText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
    ?.clipboard,
): Promise<boolean> {
  if (!clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

function PacketSection({
  children,
  id,
}: {
  children: ReactNode;
  id: PacketSectionId;
}) {
  const headingId = `packet-${id}-title`;

  return (
    <section
      className={`packet-section packet-section--${id.replaceAll("_", "-")}`}
      aria-labelledby={headingId}
    >
      <div className="packet-section-heading">
        <span>{packetSectionNumber(id)}</span>
        <h3 id={headingId}>{packetSectionTitle(id)}</h3>
      </div>
      {children}
    </section>
  );
}

function EditorialItems({
  emptyMessage,
  itemLabel,
  items,
}: {
  emptyMessage: string;
  itemLabel: string;
  items: readonly (
    | PacketFinding
    | PacketOpenQuestion
    | PacketRecommendedAction
  )[];
}) {
  return items.length > 0 ? (
    <ol className="packet-editorial-list">
      {items.map((item, index) => {
        const supportingSources = "supporting_source_ids" in item
          ? item.supporting_source_ids.length
          : 0;

        return (
          <li key={item.id}>
            <div className="packet-editorial-index">
              <span>{itemLabel}</span>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
            </div>
            <div>
              <p>{item.text}</p>
              {supportingSources > 0 && (
                <span>{supportingSources} linked source{supportingSources === 1 ? "" : "s"}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  ) : (
    <p className="packet-empty packet-empty--client">
      <strong>Editorial status</strong>
      <span>{emptyMessage}</span>
    </p>
  );
}

export function PacketPreview({
  activityResponse,
  caseRecord,
  evidence,
  initialCopyStatus = "idle",
  timeline,
}: PacketPreviewProps) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    initialCopyStatus,
  );
  const [serverPresentation, setServerPresentation] =
    useState<PacketPresentationResponse | null>(null);
  const [presentationError, setPresentationError] = useState("");
  const livePacketModel = useMemo(
    () =>
      buildPacketModel({
        activityResponse,
        caseRecord,
        evidence,
        generatedAt,
        timeline,
      }),
    [activityResponse, caseRecord, evidence, generatedAt, timeline],
  );
  const packetModel = serverPresentation?.packet ?? livePacketModel;
  const packetText = useMemo(() => renderPacketText(packetModel), [packetModel]);
  const packetPdfPath = caseRecord.id
    ? `/api/v1/cases/${encodeURIComponent(caseRecord.id)}/packet.pdf`
    : null;
  const exportSupported = Boolean(
    packetPdfPath && (serverPresentation?.export_supported ?? false),
  );

  useEffect(() => {
    let active = true;

    async function loadPresentation() {
      try {
        const response = await getPacketPresentation(caseRecord.id);
        if (active) {
          setServerPresentation(response);
          setPresentationError("");
        }
      } catch {
        if (active) {
          setPresentationError(
            "The persisted packet status could not be loaded. A live draft preview is shown.",
          );
        }
      }
    }

    void loadPresentation();
    const refresh = () => void loadPresentation();
    globalThis.window?.addEventListener("permitpulse:packet-changed", refresh);

    return () => {
      active = false;
      globalThis.window?.removeEventListener("permitpulse:packet-changed", refresh);
    };
  }, [caseRecord.id, caseRecord.version]);

  async function handleCopy() {
    setCopyStatus("idle");
    const copied = await copyPacketText(packetText);

    setCopyStatus(copied ? "success" : "error");
  }

  function handlePrint() {
    setGeneratedAt(new Date());
    if (typeof globalThis.window?.print === "function") {
      globalThis.window.print();
    }
  }

  function handleDownloadPdf() {
    if (!exportSupported || !packetPdfPath || typeof globalThis.window?.open !== "function") {
      return;
    }

    globalThis.window.open(packetPdfPath, "_blank", "noopener,noreferrer");
  }

  const quality = serverPresentation?.quality;
  const qualityTone = quality?.blockers.length
    ? "blocked"
    : quality?.warnings.length
      ? "warning"
      : "ready";
  const qualityLabel = quality?.blockers.length
    ? `${quality.blockers.length} approval blocker${quality.blockers.length === 1 ? "" : "s"}`
    : quality?.warnings.length
      ? `${quality.warnings.length} quality warning${quality.warnings.length === 1 ? "" : "s"}`
      : "Quality checks passed";
  const dashboard = packetDashboard(packetModel);
  const chronologicalTimeline = packetTimelineChronology(packetModel);

  return (
    <section className="packet-preview" aria-labelledby="packet-preview-title">
      <div className="packet-toolbar print-hidden">
        <div>
          <p className="eyebrow">Deliverable workspace / Packet preview</p>
          <h3 id="packet-preview-title">Client packet</h3>
          <p>The preview and PDF use the same persisted presentation model.</p>
        </div>
        <div className="packet-actions">
          <button type="button" onClick={() => void handleCopy()}>
            Copy packet text
          </button>
          <button
            className="secondary-button"
            disabled={!exportSupported}
            type="button"
            onClick={handleDownloadPdf}
          >
            Download PDF
          </button>
          <button className="secondary-button" type="button" onClick={handlePrint}>
            Print preview
          </button>
        </div>
      </div>

      {copyStatus === "success" && (
        <p className="success packet-feedback" role="status">
          Packet text copied.
        </p>
      )}
      {copyStatus === "error" && (
        <p className="error packet-feedback" role="alert">
          Packet text could not be copied. Use browser selection or the PDF export.
        </p>
      )}
      {presentationError && (
        <p className="error packet-feedback" role="alert">{presentationError}</p>
      )}

      {quality && (
        <section
          className={`packet-quality-summary packet-quality-summary--${qualityTone}`}
          aria-labelledby="packet-quality-title"
        >
          <div className="packet-quality-summary__heading">
            <div>
              <p className="eyebrow">Delivery quality</p>
              <h3 id="packet-quality-title">{qualityLabel}</h3>
            </div>
            <span>{quality.stale_snapshot ? "Regeneration required" : "Snapshot evaluated"}</span>
          </div>
          {quality.blockers.length > 0 && (
            <ol className="packet-quality-list packet-quality-list--blockers">
              {quality.blockers.map((issue) => (
                <li key={issue.id}>
                  <strong>{issue.title}</strong>
                  <p>{issue.reason}</p>
                  <span>{issue.recommended_resolution}</span>
                </li>
              ))}
            </ol>
          )}
          {quality.warnings.length > 0 && (
            <details>
              <summary>Review {quality.warnings.length} non-blocking warning{quality.warnings.length === 1 ? "" : "s"}</summary>
              <ol className="packet-quality-list">
                {quality.warnings.map((issue) => (
                  <li key={issue.id}>
                    <strong>{issue.title}</strong>
                    <p>{issue.reason}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      <article className="packet-document packet-document--client">
        <header className="packet-cover">
          <div className="packet-brand-header">
            <strong>PERMITPULSE <span>Permit intelligence</span></strong>
            <span>Professional permit review</span>
          </div>
          <div className="packet-cover-body">
            <div>
              <p className="packet-cover-kicker">Client permit deliverable</p>
              <h2>{packetModel.title}</h2>
              <p className="packet-cover-project">{packetModel.case_summary.project_name}</p>
              <p className="packet-cover-location">
                {[packetModel.case_summary.address, packetModel.case_summary.city].filter(Boolean).join(", ")}
              </p>
            </div>
            <dl className="packet-cover-identity">
              <div><dt>Prepared for</dt><dd>{packetModel.case_summary.client_name}</dd></div>
              <div><dt>Jurisdiction</dt><dd>{packetModel.jurisdiction}</dd></div>
              <div><dt>Permit identifier</dt><dd>{packetModel.permit_number?.trim() || "Pending record entry"}</dd></div>
              <div><dt>Packet status</dt><dd>{dashboard.lifecycle_status}</dd></div>
            </dl>
          </div>

          <section className="packet-dashboard" aria-labelledby="packet-executive-dashboard-title">
            <div className="packet-dashboard-heading">
              <div>
                <p className="packet-dashboard-kicker">01 / Decision snapshot / Executive Summary</p>
                <h3 id="packet-executive-dashboard-title">Executive Dashboard</h3>
              </div>
              <span className={`packet-status-badge packet-status-badge--${packetModel.document_status}`}>
                {packetModel.document_status_label}
              </span>
            </div>
            <p className="packet-executive-summary">{packetModel.action_kit?.current_position ?? packetModel.executive_summary.text}</p>
            {packetModel.action_kit&&<dl className="packet-client-meta"><div><dt>Record confirms</dt><dd>{packetModel.action_kit.confirmed_record}</dd></div><div><dt>Record does not confirm</dt><dd>{packetModel.action_kit.unconfirmed_record}</dd></div><div><dt>Primary blocker</dt><dd>{packetModel.action_kit.primary_blocker}</dd></div><div><dt>Why this move</dt><dd>{packetModel.action_kit.why_appropriate}</dd></div><div><dt>Evidence readiness</dt><dd>{packetModel.action_kit.evidence_readiness}</dd></div><div><dt>Review readiness</dt><dd>{packetModel.action_kit.review_readiness}</dd></div></dl>}

            <div className="packet-dashboard-metrics">
              <div className="packet-dashboard-metric">
                <span>Permit status</span>
                <strong>{dashboard.permit_status}</strong>
                <small>Recorded case status</small>
              </div>
              <div className={`packet-dashboard-metric packet-dashboard-metric--${dashboard.mission_health.tone}`}>
                <span>Overall Mission Health</span>
                <strong>{dashboard.mission_health.label}</strong>
                <small>{dashboard.mission_health.score}% · {dashboard.mission_health.explanation}</small>
              </div>
              <div className="packet-dashboard-metric packet-dashboard-metric--score">
                <span>Readiness score</span>
                <strong>{dashboard.readiness.score}%</strong>
                <small>{dashboard.readiness.explanation}</small>
              </div>
            </div>

            <div className="packet-dashboard-grid">
              <section className="packet-dashboard-panel">
                <p className="packet-dashboard-label">Primary blockers</p>
                {dashboard.blockers.length > 0 ? (
                  <ol className="packet-dashboard-blockers">
                    {dashboard.blockers.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <span aria-hidden="true" />
                        <div><strong>{item.title}</strong><p>{item.resolution}</p></div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="packet-dashboard-clear"><strong>No primary blockers identified.</strong><span>The current packet record contains no deterministic blocking condition.</span></p>
                )}
                {dashboard.blockers.length > 3 && (
                  <p className="packet-dashboard-more">{dashboard.blockers.length - 3} additional documented condition{dashboard.blockers.length - 3 === 1 ? "" : "s"}.</p>
                )}
              </section>
              <section className="packet-dashboard-panel packet-dashboard-panel--action">
                <p className="packet-dashboard-label">Recommended next action</p>
                <strong>{dashboard.recommended_action.title}</strong>
                <p>{dashboard.recommended_action.detail}</p>
              </section>
            </div>

            <section className="packet-evidence-snapshot">
              <div>
                <p className="packet-dashboard-label">Evidence summary</p>
                <p>{dashboard.evidence.text}</p>
              </div>
              <dl>
                <div><dt>Verified</dt><dd>{dashboard.evidence.verified}</dd></div>
                <div><dt>Unverified</dt><dd>{dashboard.evidence.unverified}</dd></div>
                <div><dt>Disputed</dt><dd>{dashboard.evidence.disputed}</dd></div>
              </dl>
            </section>

            {packetModel.warnings.length > 0 && (
              <ul className="packet-client-warnings">
                {packetModel.warnings.map((item) => <li key={item.id}>{item.text}</li>)}
              </ul>
            )}

            <aside className="packet-metadata-panel" aria-label="Packet metadata">
              <div><span>Packet version</span><strong>{packetModel.packet_version}</strong></div>
              <div><span>Generation date</span><strong>{packetModel.generated_at_label}</strong></div>
              <div><span>Lifecycle status</span><strong>{dashboard.lifecycle_status}</strong></div>
              <div><span>Reviewer status</span><strong>{dashboard.reviewer_status}</strong></div>
              <div className="packet-metadata-panel--wide"><span>Packet integrity / version</span><strong>{dashboard.integrity} · deterministic render</strong></div>
            </aside>
            <p className="packet-cover-note">{packetModel.draft_notice}</p>
          </section>
        </header>

        <PacketSection id="case_overview">
          <p className="packet-section-intro">Core project identity and jurisdiction information carried forward from the case record.</p>
          <dl className="packet-client-meta">
            {packetModel.case_overview.map((item) => (
              <div key={item.id} className={item.information_class === "missing_information" ? "packet-client-meta--pending" : undefined}>
                <dt>{item.label}</dt>
                <dd>{item.information_class === "missing_information" ? "Pending record entry" : item.value}</dd>
              </div>
            ))}
          </dl>
        </PacketSection>

        <section className="packet-section" aria-label="Current Status">
          <p className="packet-section-intro">Recorded case status at the time this packet edition was generated.</p>
          <div className="packet-current-status">
            <strong>{packetModel.current_status.label}</strong>
            <span>Case record updated {packetModel.case_summary.updated_at_label}</span>
          </div>
        </section>

        <PacketSection id="evidence_matrix">
          <p className="packet-section-intro">Compact evidence index. Detailed summaries and provenance remain in the register.</p>
          <div className="reviewer-table">{packetModel.evidence_summaries.map(item=><article key={item.id}><strong>{item.reference} · {item.title}</strong><span>{item.evidence_type_label} · {item.source.date_label} · {item.verification_label}</span><p>{item.summary}</p></article>)}</div>
        </PacketSection>

        <PacketSection id="evidence_register">
          <p className="packet-section-intro">Source records are organized as review cards. Verification labels describe the recorded review state and do not expand the underlying evidence.</p>
          {packetModel.evidence_summaries.length === 0 ? (
            <p className="packet-empty packet-empty--client"><strong>Evidence register not yet assembled.</strong><span>No evidence records are included in this packet.</span></p>
          ) : (
            <ol className="packet-client-records">
              {packetModel.evidence_summaries.map((item, index) => {
                const href = safeExternalHref(item.source.url);
                const missing = packetEvidenceMissingDetails(item);
                const hasMetadata = Boolean(item.source.label?.trim() || item.source.date || href);

                return (
                  <li key={item.id}>
                    <div className="packet-client-record-heading">
                      <div>
                        <p>Evidence {String(index + 1).padStart(2, "0")} · {item.evidence_type_label}</p>
                        <h4>{item.title}</h4>
                      </div>
                      <span className={`verification-badge verification-badge--${item.verification_status}`}>
                        {item.verification_label}
                      </span>
                    </div>
                    <p className="packet-evidence-summary">{item.summary}</p>
                    {hasMetadata && (
                      <dl className="packet-client-record-meta">
                        {item.source.label?.trim() && <div><dt>Source</dt><dd>{item.source.label}</dd></div>}
                        {item.source.date && <div><dt>Source date</dt><dd>{item.source.date_label}</dd></div>}
                        {href && <div className="packet-client-record-meta--wide"><dt>Provenance</dt><dd><a href={href} rel="noreferrer noopener" target="_blank">{href}</a></dd></div>}
                      </dl>
                    )}
                    {missing.length > 0 && <p className="packet-source-pending">Source details pending: {missing.join(", ")}.</p>}
                    <div className="packet-reviewer-note"><span>Reviewer note</span><p>{item.verification_note}</p></div>
                  </li>
                );
              })}
            </ol>
          )}
        </PacketSection>

        <PacketSection id="permit_timeline">
          <p className="packet-section-intro">Chronological permit history, earliest to latest. Each event retains its recorded type, source classification, evidence linkage, and review status.</p>
          {chronologicalTimeline.length === 0 ? (
            <p className="packet-empty packet-empty--client"><strong>Permit history not yet assembled.</strong><span>No permit timeline events are included in this packet.</span></p>
          ) : (
            <ol className="packet-client-timeline">
              {chronologicalTimeline.map((entry, index) => (
                <li key={entry.id}>
                  <div className="packet-timeline-rail"><span>{String(index + 1).padStart(2, "0")}</span></div>
                  <div className="packet-timeline-date"><time>{entry.occurred_on_label}</time><span>{entry.timeline_type_label}</span></div>
                  <article>
                    <div className="packet-timeline-heading">
                      <h4>{entry.title}</h4>
                      <div><span className="record-pill">{entry.source_label}</span><span className={`record-pill record-pill--${entry.information_class}`} aria-label="Review status">{packetTimelineReviewLabel(entry)}</span></div>
                    </div>
                    <p>{entry.details}</p>
                    <div className="packet-timeline-evidence">
                      <h5>Supporting evidence</h5>
                      {entry.linked_evidence.length > 0 ? (
                        <ul>{entry.linked_evidence.map((item) => <li key={item.source_id}><span>{item.verification_label}</span>{item.title}</li>)}</ul>
                      ) : (
                        <p className="packet-source-pending">No supporting evidence linked. Evidence linkage has not been recorded for this event.</p>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </PacketSection>

        <PacketSection id="findings">
          <p className="packet-section-intro">Reviewer-authored conclusions included in this packet edition. No finding is generated by the presentation layer.</p>
          <EditorialItems itemLabel="Finding" items={packetModel.findings.items} emptyMessage={packetModel.findings.empty_message} />
        </PacketSection>

        <PacketSection id="open_questions">
          <p className="packet-section-intro">Unresolved items that remain explicitly open in the reviewed packet record.</p>
          <EditorialItems itemLabel="Question" items={packetModel.open_questions.items} emptyMessage={packetModel.open_questions.empty_message} />
        </PacketSection>

        <PacketSection id="recommended_next_actions">
          <p className="packet-section-intro">Recorded follow-up actions, presented in client-ready order without adding new recommendations.</p>
          <EditorialItems itemLabel="Action" items={packetModel.recommended_next_actions.items} emptyMessage={packetModel.recommended_next_actions.empty_message} />
        </PacketSection>

        <PacketSection id="agency_follow_up_kit">
          {packetModel.action_kit ? <div className="reviewer-block"><h3>{packetModel.action_kit.email_subject}</h3><p><strong>Recipient / agency role:</strong> {packetModel.action_kit.recipient_role}</p><p>{packetModel.action_kit.message_body}</p><small>Supported by {packetModel.action_kit.citation_references.join(", ")}</small><h4>Requested confirmations</h4><ul>{packetModel.action_kit.requested_confirmations.map(item=><li key={item}>{item}</li>)}</ul><h4>Call checklist</h4><ul>{packetModel.action_kit.call_checklist.map(item=><li key={item}>{item}</li>)}</ul><h4>Documents to have ready</h4><ul>{packetModel.action_kit.documents_ready.map(item=><li key={item}>{item}</li>)}</ul><p><strong>Trigger for escalation:</strong> {packetModel.action_kit.escalation_trigger}</p>{packetModel.action_kit.follow_up_date&&<p><strong>Review date:</strong> {packetModel.action_kit.follow_up_date}</p>}</div> : <p className="packet-empty packet-empty--client">No reviewer-approved Agency Follow-Up Kit is included.</p>}
        </PacketSection>

        <PacketSection id="supporting_sources">
          <p className="packet-section-intro">Compact source log for the evidence cited throughout the packet.</p>
          {packetModel.supporting_sources.length > 0 ? (
            <div className="packet-source-list" role="table" aria-label="Supporting source log">
              <div className="packet-source-list__heading" role="row"><span>Source record</span><span>Provenance</span><span>Review</span></div>
              {packetModel.supporting_sources.map((source, index) => {
                const href = safeExternalHref(source.url);
                const sourceLabel = source.label === "Source label not provided" ? "Source label pending" : source.label;
                const sourceDate = source.date_label === "Not provided" ? "Source date pending" : source.date_label;
                return (
                  <div className="packet-source-list__row" role="row" key={source.id}>
                    <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{source.title}</strong><small>{sourceLabel} · {sourceDate}</small></div>
                    <div>{href ? <a href={href} rel="noreferrer noopener" target="_blank">{href}</a> : <span>Digital provenance not recorded</span>}</div>
                    <div><span className="record-pill">{source.verification_label}</span></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="packet-empty packet-empty--client"><strong>Source log is empty.</strong><span>No supporting sources are included in this packet edition.</span></p>
          )}
        </PacketSection>

        <PacketSection id="disclaimer">
          <p className="packet-disclaimer-text">{packetModel.disclaimer}</p>
        </PacketSection>

        <footer className="packet-client-footer">
          <span>PermitPulse · Permit intelligence</span>
          <span>{dashboard.integrity} · deterministic render</span>
        </footer>
      </article>
    </section>
  );
}
