import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseDto } from "../types/cases";
import { getPacketPresentation } from "../api/packet";
import type { PacketPresentationResponse } from "../api/packet";
import { buildPacketPresentation } from "../../shared/packet/presentation";
import { renderPacketText } from "../../shared/packet/render-packet-text";
import { PacketDocument } from "../../shared/packet/PacketDocument";

interface PacketPreviewProps {
  caseRecord: CaseDto;
  initialCopyStatus?: "idle" | "success" | "error";
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
  caseRecord,
  initialCopyStatus = "idle",
}: PacketPreviewProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    initialCopyStatus,
  );
  const [serverPresentation, setServerPresentation] =
    useState<PacketPresentationResponse | null>(null);
  const [presentationCaseId, setPresentationCaseId] = useState("");
  const [presentationLoading, setPresentationLoading] = useState(true);
  const [presentationError, setPresentationError] = useState("");
  const presentationRequest = useRef(0);
  const activeServerPresentation = presentationCaseId === caseRecord.id
    ? serverPresentation
    : null;
  const packetModel = activeServerPresentation?.packet ?? null;
  const packetPresentation = useMemo(
    () => packetModel ? buildPacketPresentation(packetModel) : null,
    [packetModel],
  );
  const packetText = useMemo(
    () => packetModel ? renderPacketText(packetModel) : null,
    [packetModel],
  );
  const packetPdfPath = caseRecord.id
    ? `/api/v1/cases/${encodeURIComponent(caseRecord.id)}/packet.pdf`
    : null;
  const packetHtmlPath = caseRecord.id
    ? `/api/v1/cases/${encodeURIComponent(caseRecord.id)}/packet.html`
    : null;
  const exportSupported = Boolean(
    packetPdfPath && (activeServerPresentation?.export_supported ?? false),
  );

  useEffect(() => {
    let active = true;

    async function loadPresentation() {
      const request = ++presentationRequest.current;
      setServerPresentation(null);
      setPresentationCaseId("");
      setPresentationLoading(true);
      setPresentationError("");

      try {
        const response = await getPacketPresentation(caseRecord.id);
        if (active && request === presentationRequest.current) {
          setServerPresentation(response);
          setPresentationCaseId(caseRecord.id);
        }
      } catch {
        if (active && request === presentationRequest.current) {
          setPresentationError(
            "The authoritative packet could not be loaded. No preview or deliverable action is available until it reloads.",
          );
        }
      } finally {
        if (active && request === presentationRequest.current) {
          setPresentationLoading(false);
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
    if (!packetText) return;
    setCopyStatus("idle");
    setCopyStatus((await copyPacketText(packetText)) ? "success" : "error");
  }

  function handlePrint() {
    if (!exportSupported || !packetHtmlPath) return;
    globalThis.window?.open(packetHtmlPath, "_blank", "noopener,noreferrer");
  }

  function handleDownloadPdf() {
    if (
      !exportSupported ||
      !packetPdfPath ||
      typeof globalThis.window?.open !== "function"
    ) {
      return;
    }

    globalThis.window.open(packetPdfPath, "_blank", "noopener,noreferrer");
  }

  const quality = activeServerPresentation?.quality;
  const qualityTone = quality?.blockers.length
    ? "blocked"
    : quality?.warnings.length
      ? "warning"
      : "ready";
  const qualityLabel = quality?.blockers.length
    ? `${quality.blockers.length} approval blocker${quality.blockers.length === 1 ? "" : "s"}`
    : quality?.warnings.length
      ? `${quality.warnings.length} quality warning${quality.warnings.length === 1 ? "" : "s"}`
      : "Packet delivery checks passed";

  return (
    <section className="packet-preview" aria-labelledby="packet-preview-title">
      <div className="packet-toolbar print-hidden">
        <div>
          <p className="eyebrow">Deliverable workspace / Packet preview</p>
          <h3 id="packet-preview-title">Client packet</h3>
          <p>Preview, HTML, and PDF consume the same canonical section graph.</p>
        </div>
        {activeServerPresentation && (
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
            <button
              className="secondary-button"
              disabled={!exportSupported}
              type="button"
              onClick={handlePrint}
            >
              Open print preview
            </button>
          </div>
        )}
      </div>

      {copyStatus === "success" && (
        <p className="success packet-feedback" role="status">Packet text copied.</p>
      )}
      {copyStatus === "error" && (
        <p className="error packet-feedback" role="alert">
          Packet text could not be copied. Use browser selection or the PDF export.
        </p>
      )}
      {presentationError && (
        <p className="error packet-feedback" role="alert">{presentationError}</p>
      )}
      {presentationLoading && (
        <p className="packet-feedback" role="status">
          Loading the authoritative packet…
        </p>
      )}

      {quality && (
        <section className={`packet-quality-summary packet-quality-summary--${qualityTone}`} aria-label="Packet quality checks">
          <div className="packet-quality-summary__heading">
            <div><p className="eyebrow">Delivery quality gate</p><h3>{qualityLabel}</h3></div>
            <span>{quality.eligible_for_approval ? "Approval eligible" : "Review required"}</span>
          </div>
          {quality.blockers.length > 0 && (
            <ol className="packet-quality-list packet-quality-list--blockers">
              {quality.blockers.map((issue) => <li key={issue.id}><strong>{issue.title}</strong><p>{issue.reason}</p></li>)}
            </ol>
          )}
          {quality.warnings.length > 0 && (
            <details>
              <summary>Review {quality.warnings.length} non-blocking warning{quality.warnings.length === 1 ? "" : "s"}</summary>
              <ol className="packet-quality-list">
                {quality.warnings.map((issue) => <li key={issue.id}><strong>{issue.title}</strong><p>{issue.reason}</p></li>)}
              </ol>
            </details>
          )}
        </section>
      )}

      {packetPresentation && <PacketDocument presentation={packetPresentation} />}
    </section>
  );
}
