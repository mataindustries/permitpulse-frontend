import { useRef, useState } from "react";
import { CaseApiError } from "../api/cases";
import type {
  CaseActivityResponse,
  CaseDto,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
  UserRole,
} from "../types/cases";
import { CaseActivity } from "./CaseActivity";
import { EditCaseForm } from "./EditCaseForm";
import { StatusBadge } from "./StatusBadge";
import { StatusManagement } from "./StatusManagement";

interface CaseDetailProps {
  activityError: string;
  activityLoading: boolean;
  activityResponse: CaseActivityResponse | null;
  caseRecord: CaseDto | null;
  error: string;
  loading: boolean;
  role: UserRole;
  onActivityNextPage: () => void;
  onActivityPreviousPage: () => void;
  onActivityRetry: () => void;
  onBack: () => void;
  onMetadataUpdate: (input: UpdateCaseMetadataInput) => Promise<void>;
  onReloadLatest: () => Promise<void>;
  onRetry: () => void;
  onStatusUpdate: (input: UpdateCaseStatusInput) => Promise<void>;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeLifecycleError(error: unknown): string {
  if (error instanceof CaseApiError) {
    if (error.kind === "conflict" && error.code === "STALE_VERSION") {
      return "Someone or another request updated this case. Reload the latest version before trying again.";
    }

    if (
      error.code === "INVALID_TRANSITION" ||
      error.code === "SAME_STATUS" ||
      error.kind === "validation" ||
      error.kind === "forbidden"
    ) {
      return error.message;
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The case action could not be completed. Try again.";
}

function isStaleVersion(error: unknown): boolean {
  return (
    error instanceof CaseApiError &&
    error.kind === "conflict" &&
    error.code === "STALE_VERSION"
  );
}

interface ConflictNoticeProps {
  onCancel: () => void;
  onReload: () => Promise<void>;
}

export function ConflictNotice({ onCancel, onReload }: ConflictNoticeProps) {
  const [reloading, setReloading] = useState(false);

  async function reload() {
    if (reloading) {
      return;
    }

    setReloading(true);
    try {
      await onReload();
    } catch {
      // Parent state displays the safe reload failure or session-expired state.
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="state-box state-box--error" role="alert">
      <h3>Case version changed</h3>
      <p>
        Someone or another request updated this case. Reload the latest version
        before trying again.
      </p>
      <div className="form-actions">
        <button disabled={reloading} type="button" onClick={() => void reload()}>
          {reloading ? "Reloading..." : "Reload latest case"}
        </button>
        <button
          className="secondary-button"
          disabled={reloading}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CaseDetail({
  activityError,
  activityLoading,
  activityResponse,
  caseRecord,
  error,
  loading,
  role,
  onActivityNextPage,
  onActivityPreviousPage,
  onActivityRetry,
  onBack,
  onMetadataUpdate,
  onReloadLatest,
  onRetry,
  onStatusUpdate,
}: CaseDetailProps) {
  const [editing, setEditing] = useState(false);
  const editSubmittingRef = useRef(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const statusSubmittingRef = useRef(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [conflictMode, setConflictMode] = useState<"edit" | "status" | null>(
    null,
  );

  async function submitMetadata(input: UpdateCaseMetadataInput) {
    if (editSubmittingRef.current) {
      return;
    }

    editSubmittingRef.current = true;
    setEditSubmitting(true);
    setEditError("");
    setConflictMode(null);

    try {
      await onMetadataUpdate(input);
      setEditing(false);
    } catch (updateError) {
      if (isStaleVersion(updateError)) {
        setConflictMode("edit");
      } else {
        setEditError(safeLifecycleError(updateError));
      }
    } finally {
      editSubmittingRef.current = false;
      setEditSubmitting(false);
    }
  }

  async function submitStatus(input: UpdateCaseStatusInput) {
    if (statusSubmittingRef.current) {
      return;
    }

    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusError("");
    setConflictMode(null);

    try {
      await onStatusUpdate(input);
    } catch (updateError) {
      if (isStaleVersion(updateError)) {
        setConflictMode("status");
      } else {
        setStatusError(safeLifecycleError(updateError));
      }
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  async function reloadLatest() {
    await onReloadLatest();
    setConflictMode(null);
    setEditing(false);
    setEditError("");
    setStatusError("");
  }

  return (
    <section aria-labelledby="case-detail-title" className="workspace-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Case detail</p>
          <h2 id="case-detail-title">
            {caseRecord?.project_name ?? "Case details"}
          </h2>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back to list
        </button>
      </div>

      {loading && <p role="status">Loading case details...</p>}

      {!loading && error && (
        <div className="state-box state-box--error" role="alert">
          <h3>Case unavailable</h3>
          <p>{error}</p>
          <div className="form-actions">
            <button type="button" onClick={onRetry}>
              Retry
            </button>
            <button className="secondary-button" type="button" onClick={onBack}>
              Back to list
            </button>
          </div>
        </div>
      )}

      {!loading && !error && caseRecord && (
        <div className="case-detail">
          <section className="detail-section" aria-labelledby="overview-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Overview</p>
                <h3 id="overview-title">Case overview</h3>
              </div>
              <StatusBadge status={caseRecord.current_status} />
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Client</dt>
                <dd>{caseRecord.client_name}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{caseRecord.address}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{caseRecord.city}</dd>
              </div>
              <div>
                <dt>Jurisdiction</dt>
                <dd>{caseRecord.jurisdiction}</dd>
              </div>
              <div>
                <dt>Permit number</dt>
                <dd>{caseRecord.permit_number ?? "Not provided"}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{caseRecord.version}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(caseRecord.created_at)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(caseRecord.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <section
            className="detail-section"
            aria-labelledby="edit-details-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Edit details</p>
                <h3 id="edit-details-title">Case metadata</h3>
              </div>
              {!editing && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setEditError("");
                    setConflictMode(null);
                    setEditing(true);
                  }}
                >
                  Edit details
                </button>
              )}
            </div>

            {conflictMode === "edit" && (
              <ConflictNotice
                onCancel={() => setConflictMode(null)}
                onReload={reloadLatest}
              />
            )}

            {editing ? (
              <EditCaseForm
                caseRecord={caseRecord}
                error={editError}
                submitting={editSubmitting}
                onCancel={() => {
                  setEditing(false);
                  setEditError("");
                  setConflictMode(null);
                }}
                onSubmit={submitMetadata}
              />
            ) : (
              <p>
                Update project, client, location, jurisdiction, and permit
                metadata without changing lifecycle status.
              </p>
            )}
          </section>

          {role === "admin" && (
            <>
              {conflictMode === "status" && (
                <ConflictNotice
                  onCancel={() => setConflictMode(null)}
                  onReload={reloadLatest}
                />
              )}
              <StatusManagement
                caseRecord={caseRecord}
                error={statusError}
                submitting={statusSubmitting}
                onSubmit={submitStatus}
              />
            </>
          )}

          <CaseActivity
            error={activityError}
            loading={activityLoading}
            response={activityResponse}
            onNextPage={onActivityNextPage}
            onPreviousPage={onActivityPreviousPage}
            onRetry={onActivityRetry}
          />
        </div>
      )}
    </section>
  );
}
