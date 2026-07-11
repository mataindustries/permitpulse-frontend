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
import { renderPacketText } from "../../shared/packet/render-packet-text";
import type { PacketSectionId } from "../../shared/packet/types";
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
  items,
}: {
  emptyMessage: string;
  items: readonly { id: string; text: string }[];
}) {
  return items.length > 0 ? (
    <ol className="packet-editorial-list">
      {items.map((item) => <li key={item.id}>{item.text}</li>)}
    </ol>
  ) : (
    <p className="packet-empty packet-empty--client">{emptyMessage}</p>
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
            <strong>PERMITPULSE</strong>
            <span>Permit intelligence</span>
          </div>
          <div className="packet-cover-body">
            <h2>{packetModel.title}</h2>
            <p className="packet-cover-project">{packetModel.case_summary.project_name}</p>
            <div className="packet-cover-meta">
              <span className={`packet-status-badge packet-status-badge--${packetModel.document_status}`}>
                {packetModel.document_status_label}
              </span>
              <span>Generated {packetModel.generated_at_label}</span>
              <span>Packet version {packetModel.packet_version}</span>
            </div>
            <p className="packet-cover-note">{packetModel.draft_notice}</p>
          </div>
        </header>

        <PacketSection id="executive_summary">
          <p className="packet-executive-summary">{packetModel.executive_summary.text}</p>
          {packetModel.warnings.length > 0 && (
            <ul className="packet-client-warnings">
              {packetModel.warnings.map((item) => <li key={item.id}>{item.text}</li>)}
            </ul>
          )}
        </PacketSection>

        <PacketSection id="case_overview">
          <dl className="packet-client-meta">
            {packetModel.case_overview.map((item) => (
              <div key={item.id}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </PacketSection>

        <PacketSection id="current_status">
          <p className="packet-current-status">{packetModel.current_status.label}</p>
          <p className="packet-client-note">Case record updated {packetModel.case_summary.updated_at_label}</p>
        </PacketSection>

        <PacketSection id="evidence_register">
          {packetModel.evidence_summaries.length === 0 ? (
            <p className="packet-empty packet-empty--client">No evidence records are included in this packet.</p>
          ) : (
            <ol className="packet-client-records">
              {packetModel.evidence_summaries.map((item) => {
                const href = safeExternalHref(item.source.url);

                return (
                  <li key={item.id}>
                    <div className="packet-client-record-heading">
                      <div>
                        <p>{item.evidence_type_label}</p>
                        <h4>{item.title}</h4>
                      </div>
                      <span className={`verification-badge verification-badge--${item.verification_status}`}>
                        {item.verification_label}
                      </span>
                    </div>
                    <p>{item.summary}</p>
                    <dl className="packet-client-record-meta">
                      <div><dt>Source</dt><dd>{item.source.label ?? "Source label not provided"}</dd></div>
                      <div><dt>Source date</dt><dd>{item.source.date_label}</dd></div>
                      <div className="packet-client-record-meta--wide">
                        <dt>Provenance</dt>
                        <dd>{href ? <a href={href} rel="noreferrer noopener" target="_blank">{href}</a> : item.source.url ?? "Not provided"}</dd>
                      </div>
                    </dl>
                    <p className="packet-client-note">{item.verification_note}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </PacketSection>

        <PacketSection id="permit_timeline">
          {packetModel.timeline_summaries.length === 0 ? (
            <p className="packet-empty packet-empty--client">No permit timeline events are included in this packet.</p>
          ) : (
            <ol className="packet-client-timeline">
              {packetModel.timeline_summaries.map((entry) => (
                <li key={entry.id}>
                  <time>{entry.occurred_on_label}</time>
                  <div>
                    <div className="packet-client-record-heading">
                      <div>
                        <p>{entry.timeline_type_label}</p>
                        <h4>{entry.title}</h4>
                      </div>
                      <span className="record-pill">{entry.source_label}</span>
                    </div>
                    <p>{entry.details}</p>
                    <h5>Supporting evidence</h5>
                    {entry.linked_evidence.length > 0 ? (
                      <ul>
                        {entry.linked_evidence.map((item) => (
                          <li key={item.source_id}>{item.title} ({item.verification_label})</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="packet-client-note">No supporting evidence linked.</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </PacketSection>

        <PacketSection id="findings">
          <EditorialItems items={packetModel.findings.items} emptyMessage={packetModel.findings.empty_message} />
        </PacketSection>

        <PacketSection id="open_questions">
          <EditorialItems items={packetModel.open_questions.items} emptyMessage={packetModel.open_questions.empty_message} />
        </PacketSection>

        <PacketSection id="recommended_next_actions">
          <EditorialItems items={packetModel.recommended_next_actions.items} emptyMessage={packetModel.recommended_next_actions.empty_message} />
        </PacketSection>

        <PacketSection id="supporting_sources">
          {packetModel.supporting_sources.length > 0 ? (
            <ol className="packet-source-list">
              {packetModel.supporting_sources.map((source) => {
                const href = safeExternalHref(source.url);
                return (
                  <li key={source.id}>
                    <h4>{source.title}</h4>
                    <p>{source.label} · {source.date_label} · {source.verification_label}</p>
                    <p>{href ? <a href={href} rel="noreferrer noopener" target="_blank">{href}</a> : "URL not provided"}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="packet-empty packet-empty--client">No supporting sources are included in this packet.</p>
          )}
        </PacketSection>

        <PacketSection id="disclaimer">
          <p className="packet-disclaimer-text">{packetModel.disclaimer}</p>
        </PacketSection>

        <footer className="packet-client-footer">
          <span>PermitPulse · Permit intelligence</span>
          <span>Packet version {packetModel.packet_version}</span>
        </footer>
      </article>
    </section>
  );
}
