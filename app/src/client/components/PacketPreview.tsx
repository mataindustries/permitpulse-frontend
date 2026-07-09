import { useMemo, useState } from "react";
import type { CaseActivityResponse, CaseDto } from "../types/cases";
import type { EvidenceItemDto, TimelineEntryDto } from "../types/evidence-timeline";
import { buildPacketModel } from "../../shared/packet/build-packet-model";
import { renderPacketText } from "../../shared/packet/render-packet-text";
import {
  formatDateOnly,
  formatDateTime,
  safeExternalHref,
} from "./evidenceTimelineUtils";

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
  const packetModel = useMemo(
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
  const packetText = useMemo(() => renderPacketText(packetModel), [packetModel]);
  const packetPdfPath = caseRecord.id
    ? `/api/v1/cases/${encodeURIComponent(caseRecord.id)}/packet.pdf`
    : null;

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
    if (!packetPdfPath || typeof globalThis.window?.open !== "function") {
      return;
    }

    globalThis.window.open(packetPdfPath, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="packet-preview" aria-labelledby="packet-preview-title">
      <div className="packet-toolbar print-hidden">
        <div>
          <p className="eyebrow">Packet preview</p>
          <h3 id="packet-preview-title">Draft permit packet</h3>
        </div>
        <div className="packet-actions">
          <button type="button" onClick={() => void handleCopy()}>
            Copy packet text
          </button>
          <button
            className="secondary-button"
            disabled={!packetPdfPath}
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
          Packet text copied. Verify before sending.
        </p>
      )}
      {copyStatus === "error" && (
        <p className="error packet-feedback" role="alert">
          Packet text could not be copied. Use browser selection or print preview.
        </p>
      )}

      <article className="packet-document">
        <header className="packet-section packet-section--header">
          <p className="eyebrow">Packet header</p>
          <h3>{packetModel.title}</h3>
          <p>{packetModel.draft_notice}</p>
          <dl className="detail-grid">
            <div>
              <dt>Project</dt>
              <dd>{packetModel.case_summary.project_name}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>
                <time dateTime={packetModel.generated_at}>
                  {formatDateTime(packetModel.generated_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Jurisdiction</dt>
              <dd>{packetModel.jurisdiction}</dd>
            </div>
            <div>
              <dt>Permit number</dt>
              <dd>{packetModel.permit_number ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Case version</dt>
              <dd>{packetModel.case_summary.version}</dd>
            </div>
          </dl>
        </header>

        <section className="packet-section" aria-labelledby="packet-summary-title">
          <h3 id="packet-summary-title">Project summary</h3>
          <dl className="detail-grid">
            <div>
              <dt>Client</dt>
              <dd>{packetModel.case_summary.client_name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{packetModel.case_summary.address}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{packetModel.case_summary.city}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(packetModel.case_summary.updated_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="packet-section" aria-labelledby="packet-status-title">
          <h3 id="packet-status-title">Current permit status</h3>
          <p>{packetModel.current_status.label}</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-evidence-title">
          <h3 id="packet-evidence-title">Key evidence</h3>
          {packetModel.evidence_summaries.length === 0 ? (
            <p>No evidence records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {packetModel.evidence_summaries.map((item, index) => {
                const href = safeExternalHref(item.source.url);

                return (
                  <li key={`${item.created_at}-${item.title}-${index}`}>
                    <div className="packet-item-heading">
                      <strong>{item.title}</strong>
                      <span
                        className={`verification-badge verification-badge--${item.verification_status}`}
                      >
                        {item.verification_label}
                      </span>
                    </div>
                    <p>{item.summary}</p>
                    <dl className="record-meta">
                      <div>
                        <dt>Type</dt>
                        <dd>{item.evidence_type_label}</dd>
                      </div>
                      <div>
                        <dt>Source label</dt>
                        <dd>{item.source.label ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Source URL</dt>
                        <dd>
                          {href ? (
                            <a href={href} rel="noreferrer noopener" target="_blank">
                              {href}
                            </a>
                          ) : (
                            item.source.url ?? "Not provided"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Source date</dt>
                        <dd>{formatDateOnly(item.source.date)}</dd>
                      </div>
                    </dl>
                    <p className="field-note">{item.verification_note}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-timeline-title">
          <h3 id="packet-timeline-title">Permit timeline</h3>
          {packetModel.timeline_summaries.length === 0 ? (
            <p>No permit timeline records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {packetModel.timeline_summaries.map((entry, index) => {
                return (
                  <li key={`${entry.occurred_on}-${entry.title}-${index}`}>
                    <div className="packet-item-heading">
                      <strong>{entry.title}</strong>
                      <span
                        className={
                          entry.source_label === "Canonical"
                            ? "record-pill record-pill--canonical"
                            : "record-pill"
                        }
                      >
                        {entry.source_label}
                      </span>
                    </div>
                    <p>
                      <time dateTime={entry.occurred_on}>
                        {formatDateOnly(entry.occurred_on)}
                      </time>{" "}
                      · {entry.timeline_type_label}
                    </p>
                    <p>{entry.details}</p>
                    <div className="linked-evidence">
                      <h4>Linked evidence references</h4>
                      {entry.linked_evidence.length === 0 &&
                      entry.missing_evidence_reference_count === 0 ? (
                        <p className="field-note">No supporting evidence linked.</p>
                      ) : (
                        <ul className="packet-reference-list">
                          {entry.linked_evidence.map((item, itemIndex) => (
                            <li key={`${item.title}-${itemIndex}`}>
                              {item.title} ({item.verification_label})
                            </li>
                          ))}
                          {entry.missing_evidence_reference_count > 0 && (
                            <li>
                              {entry.missing_evidence_reference_count} linked
                              evidence reference
                              {entry.missing_evidence_reference_count === 1
                                ? ""
                                : "s"}{" "}
                              not loaded.
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-activity-title">
          <h3 id="packet-activity-title">Recent case activity</h3>
          {packetModel.recent_activity_summaries.length === 0 ? (
            <p>No recent case activity records are available in this case.</p>
          ) : (
            <ol className="packet-list">
              {packetModel.recent_activity_summaries.map((entry, index) => {
                return (
                  <li key={`${entry.created_at}-${entry.action}-${index}`}>
                    <div className="packet-item-heading">
                      <strong>{entry.action_label}</strong>
                      <time dateTime={entry.created_at}>
                        {formatDateTime(entry.created_at)}
                      </time>
                    </div>
                    <p>Actor: {entry.actor_label}</p>
                    {entry.changed_field_labels.length > 0 && (
                      <p>
                        Changed fields: {entry.changed_field_labels.join(", ")}
                      </p>
                    )}
                    {entry.action === "case_status_changed" &&
                      entry.from_status_label &&
                      entry.to_status_label && (
                        <p>
                          Status: {entry.from_status_label} to{" "}
                          {entry.to_status_label}
                        </p>
                      )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="packet-section" aria-labelledby="packet-questions-title">
          <h3 id="packet-questions-title">Open questions / missing information</h3>
          <p>{packetModel.open_questions.note}</p>
          <p>{packetModel.open_questions.instruction}</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-actions-title">
          <h3 id="packet-actions-title">Recommended next actions</h3>
          <p>{packetModel.recommended_next_actions.note}</p>
          <p>{packetModel.recommended_next_actions.instruction}</p>
        </section>

        <section className="packet-section" aria-labelledby="packet-disclaimer-title">
          <h3 id="packet-disclaimer-title">Disclaimer / internal-review note</h3>
          <p>{packetModel.disclaimer}</p>
        </section>
      </article>
    </section>
  );
}
