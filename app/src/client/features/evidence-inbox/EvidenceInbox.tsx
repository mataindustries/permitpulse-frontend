import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  listEvidenceInbox,
  runEvidenceInboxBulkAction,
  uploadEvidenceFile,
} from "../../api/evidence-inbox";
import { CaseApiError } from "../../api/cases";
import { Icon } from "../../design-system/icons";
import type { CaseDto } from "../../types/cases";
import {
  acceptedEvidenceExtensions,
  isAcceptedEvidenceFile,
} from "../../../shared/evidence-intake/classifier";
import type {
  EvidenceDraftDto,
  EvidenceDraftQueueState,
  EvidenceInboxResponse,
} from "../../../shared/evidence-intake/types";

interface EvidenceInboxProps {
  cases: CaseDto[];
  onSessionExpired: () => void;
}

interface PendingUpload {
  id: string;
  filename: string;
  progress: number;
  state: "waiting" | "processing" | "failed";
  error?: string;
}

const emptyCounts: EvidenceInboxResponse["counts"] = {
  waiting: 0,
  processing: 0,
  ready_for_review: 0,
  needs_attention: 0,
};

const stateLabels: Record<EvidenceDraftQueueState, string> = {
  waiting: "Waiting",
  processing: "Processing",
  ready_for_review: "Ready for Review",
  needs_attention: "Needs Attention",
};

const categoryLabels: Record<EvidenceDraftDto["category"], string> = {
  portal_screenshot: "Portal Screenshot",
  correction_notice: "Correction Notice",
  resubmittal_receipt: "Resubmittal Receipt",
  structural_response: "Structural Response",
  energy_documents: "Energy Documents",
  email: "Email",
  permit_application: "Permit Application",
  plan_sheets: "Plan Sheets",
  other: "Other",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function displayValue(value: string | null): string {
  return value || "Not detected";
}

function extractionLabel(draft: EvidenceDraftDto): string {
  if (draft.extraction_status === "pending") return "Pending";
  if (draft.extraction_status === "placeholder_limited") {
    return "Metadata review limited";
  }
  return "Metadata prepared";
}

export function EvidenceInbox({ cases, onSessionExpired }: EvidenceInboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [response, setResponse] = useState<EvidenceInboxResponse>({
    drafts: [],
    counts: emptyCounts,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destinationCaseId, setDestinationCaseId] = useState(cases[0]?.id ?? "");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [message, setMessage] = useState("");

  function handleError(caught: unknown, fallback: string) {
    if (caught instanceof CaseApiError && caught.kind === "unauthorized") {
      onSessionExpired();
      return;
    }
    setError(caught instanceof Error ? caught.message : fallback);
  }

  async function loadInbox() {
    setLoading(true);
    setError("");
    try {
      setResponse(await listEvidenceInbox());
    } catch (caught) {
      handleError(caught, "The Evidence Inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
    // The inbox loads once when its destination mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateUpload(id: string, update: Partial<PendingUpload>) {
    setUploads((current) =>
      current.map((upload) =>
        upload.id === id ? { ...upload, ...update } : upload,
      ),
    );
  }

  async function addFiles(files: File[]) {
    const accepted = files.filter((file) => isAcceptedEvidenceFile(file.name));
    const rejectedCount = files.length - accepted.length;
    if (rejectedCount > 0) {
      setError(
        `${rejectedCount} file${rejectedCount === 1 ? " was" : "s were"} skipped. Use PDF, JPG, PNG, HEIC, TXT, or EML.`,
      );
    } else {
      setError("");
    }
    setMessage("");
    const queued = accepted.map((file) => ({
      file,
      upload: {
        id: crypto.randomUUID(),
        filename: file.name,
        progress: 0,
        state: "waiting" as const,
      },
    }));
    setUploads((current) => [...current, ...queued.map((item) => item.upload)]);

    const results = await Promise.all(
      queued.map(async ({ file, upload }) => {
        updateUpload(upload.id, { state: "processing" });
        try {
          const draft = await uploadEvidenceFile(file, (progress) =>
            updateUpload(upload.id, { progress }),
          );
          setResponse((current) => ({
            drafts: [draft, ...current.drafts],
            counts: {
              ...current.counts,
              [draft.queue_state]: current.counts[draft.queue_state] + 1,
            },
          }));
          setUploads((current) => current.filter((item) => item.id !== upload.id));
          return true;
        } catch (caught) {
          if (caught instanceof CaseApiError && caught.kind === "unauthorized") {
            onSessionExpired();
            return false;
          }
          updateUpload(upload.id, {
            state: "failed",
            error:
              caught instanceof Error ? caught.message : "Upload failed. Try again.",
          });
          return false;
        }
      }),
    );
    const importedCount = results.filter(Boolean).length;
    if (importedCount > 0) {
      setMessage(
        `${importedCount} evidence draft${importedCount === 1 ? "" : "s"} imported.`,
      );
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === response.drafts.length
        ? new Set()
        : new Set(response.drafts.map((draft) => draft.id)),
    );
  }

  async function runBulkAction(
    action: "delete" | "mark_reviewed" | "move_to_evidence",
  ) {
    const draftIds = Array.from(selected);
    if (draftIds.length === 0) return;
    if (action === "delete" && !window.confirm(`Delete ${draftIds.length} selected draft${draftIds.length === 1 ? "" : "s"}?`)) {
      return;
    }
    if (action === "move_to_evidence" && !destinationCaseId) {
      setError("Choose a destination case first.");
      return;
    }
    setBulkWorking(true);
    setError("");
    setMessage("");
    try {
      const next = await runEvidenceInboxBulkAction({
        action,
        draft_ids: draftIds,
        ...(action === "move_to_evidence"
          ? { case_id: destinationCaseId }
          : {}),
      });
      setResponse(next);
      setSelected(new Set());
      setMessage(
        action === "delete"
          ? "Selected drafts deleted."
          : action === "mark_reviewed"
            ? "Selected drafts marked reviewed."
            : "Selected drafts moved to case evidence.",
      );
    } catch (caught) {
      handleError(caught, "The bulk action could not be completed.");
    } finally {
      setBulkWorking(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <section className="evidence-inbox" aria-labelledby="evidence-inbox-title">
      <header className="evidence-inbox__header">
        <div>
          <p className="eyebrow">Real evidence intake</p>
          <h1 id="evidence-inbox-title">Evidence Inbox</h1>
          <p>Import permit records, check deterministic extraction, then move reviewed drafts into a case.</p>
        </div>
        <div className="evidence-inbox__counts" aria-label="Evidence queue summary">
          {(Object.keys(stateLabels) as EvidenceDraftQueueState[]).map((state) => (
            <div key={state}>
              <strong>{response.counts[state] + uploads.filter((upload) => upload.state === state).length}</strong>
              <span>{stateLabels[state]}</span>
            </div>
          ))}
        </div>
      </header>

      <div
        className={`evidence-dropzone${dragging ? " evidence-dropzone--active" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <Icon name="evidence" size={30} />
        <div>
          <h2>Drop permit evidence here</h2>
          <p>PDF, JPG, PNG, HEIC, TXT, or EML · multiple files · 20 MB each</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          className="evidence-dropzone__input"
          type="file"
          multiple
          accept={acceptedEvidenceExtensions.map((extension) => `.${extension}`).join(",")}
          onChange={handleInput}
        />
      </div>

      {uploads.length > 0 && (
        <section className="evidence-upload-list" aria-label="Uploads in progress">
          {uploads.map((upload) => (
            <div className="evidence-upload" key={upload.id}>
              <div>
                <strong>{upload.filename}</strong>
                <span>{upload.state === "failed" ? upload.error : stateLabels[upload.state]}</span>
              </div>
              <progress max={100} value={upload.progress}>{upload.progress}%</progress>
              <span>{upload.progress}%</span>
            </div>
          ))}
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <div className="evidence-bulk-bar">
        <label className="evidence-select-all">
          <input
            type="checkbox"
            checked={response.drafts.length > 0 && selectedCount === response.drafts.length}
            onChange={toggleAll}
          />
          Select all <span>{selectedCount > 0 ? `(${selectedCount})` : ""}</span>
        </label>
        <label className="evidence-case-picker">
          <span>Destination case</span>
          <select value={destinationCaseId} onChange={(event) => setDestinationCaseId(event.target.value)}>
            <option value="">Choose a case</option>
            {cases.map((record) => (
              <option key={record.id} value={record.id}>{record.project_name}</option>
            ))}
          </select>
        </label>
        <div className="evidence-bulk-actions">
          <button type="button" className="secondary" disabled={selectedCount === 0 || bulkWorking} onClick={() => void runBulkAction("mark_reviewed")}>Mark Reviewed</button>
          <button type="button" disabled={selectedCount === 0 || !destinationCaseId || bulkWorking} onClick={() => void runBulkAction("move_to_evidence")}>Move to Evidence</button>
          <button type="button" className="danger-button" disabled={selectedCount === 0 || bulkWorking} onClick={() => void runBulkAction("delete")}>Delete</button>
        </div>
      </div>

      {loading ? (
        <p className="evidence-inbox__loading" role="status">Loading evidence drafts…</p>
      ) : response.drafts.length === 0 ? (
        <div className="evidence-inbox__empty">
          <Icon name="evidence" size={28} />
          <h2>Your inbox is ready</h2>
          <p>Upload the first permit document to create an Evidence Draft.</p>
        </div>
      ) : (
        <div className="evidence-draft-grid">
          {response.drafts.map((draft) => (
            <article className={`evidence-draft evidence-draft--${draft.queue_state}`} key={draft.id}>
              <header className="evidence-draft__header">
                <input
                  aria-label={`Select ${draft.filename}`}
                  type="checkbox"
                  checked={selected.has(draft.id)}
                  onChange={() => toggleSelected(draft.id)}
                />
                <div>
                  <h2>{draft.filename}</h2>
                  <p>{formatTimestamp(draft.uploaded_at)} · {formatBytes(draft.file_size)} · {draft.detected_type}</p>
                </div>
                <span className={`evidence-state evidence-state--${draft.queue_state}`}>{stateLabels[draft.queue_state]}</span>
              </header>
              <div className="evidence-draft__classification">
                <span>{categoryLabels[draft.category]}</span>
                <span>{extractionLabel(draft)}</span>
                {draft.reviewed_at && <span className="evidence-reviewed"><Icon name="check" size={14} /> Reviewed</span>}
              </div>
              <dl className="evidence-draft__fields">
                <div><dt>Permit Number</dt><dd>{displayValue(draft.permit_number)}</dd></div>
                <div><dt>Jurisdiction</dt><dd>{displayValue(draft.jurisdiction)}</dd></div>
                <div><dt>Address</dt><dd>{displayValue(draft.address)}</dd></div>
                <div><dt>Document Date</dt><dd>{displayValue(draft.document_date)}</dd></div>
                <div><dt>Reviewer</dt><dd>{displayValue(draft.reviewer)}</dd></div>
                <div><dt>Discipline</dt><dd>{displayValue(draft.discipline)}</dd></div>
              </dl>
              <div className="evidence-confidence">
                <div><span>Evidence Confidence</span><strong>{draft.evidence_confidence}%</strong></div>
                <progress max={100} value={draft.evidence_confidence}>{draft.evidence_confidence}%</progress>
              </div>
              <details className="evidence-issues">
                <summary>Detected Issues ({draft.detected_issues.length})</summary>
                <ul>{draft.detected_issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
