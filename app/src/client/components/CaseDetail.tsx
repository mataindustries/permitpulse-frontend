import { useRef, useState } from "react";
import { CaseApiError } from "../api/cases";
import type {
  CaseActivityResponse,
  CaseDto,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
  UserRole,
} from "../types/cases";
import type {
  CreateEvidenceInput,
  CreateTimelineInput,
  EvidenceItemDto,
  EvidenceListResponse,
  TimelineEntryDto,
  TimelineListResponse,
  UpdateEvidenceInput,
  UpdateTimelineInput,
} from "../types/evidence-timeline";
import { CaseActivity } from "./CaseActivity";
import { EditCaseForm } from "./EditCaseForm";
import { EvidenceDetail } from "./EvidenceDetail";
import { EvidenceForm } from "./EvidenceForm";
import { EvidenceLinkManager } from "./EvidenceLinkManager";
import { EvidenceList } from "./EvidenceList";
import { PacketPreview } from "./PacketPreview";
import { StatusBadge } from "./StatusBadge";
import { StatusManagement } from "./StatusManagement";
import { TimelineForm } from "./TimelineForm";
import { TimelineList } from "./TimelineList";
import {
  formatDateTime,
  isStaleRecordVersion,
  safeRecordError,
} from "./evidenceTimelineUtils";

type DetailSection =
  | "overview"
  | "evidence"
  | "timeline"
  | "activity"
  | "packet";

interface CaseDetailProps {
  activityError: string;
  activityLoading: boolean;
  activityResponse: CaseActivityResponse | null;
  caseRecord: CaseDto | null;
  currentUserId: string;
  error: string;
  evidenceError: string;
  evidenceLoading: boolean;
  evidenceResponse: EvidenceListResponse | null;
  highlightedEvidenceId: string | null;
  loading: boolean;
  role: UserRole;
  selectedEvidenceId: string | null;
  selectedTimelineId: string | null;
  timelineError: string;
  timelineLoading: boolean;
  timelineResponse: TimelineListResponse | null;
  onActivityNextPage: () => void;
  onActivityPreviousPage: () => void;
  onActivityRetry: () => void;
  onBack: () => void;
  onCreateEvidence: (input: CreateEvidenceInput) => Promise<EvidenceItemDto>;
  onCreateTimeline: (input: CreateTimelineInput) => Promise<TimelineEntryDto>;
  onEvidenceNextPage: () => void;
  onEvidencePreviousPage: () => void;
  onEvidenceRetry: () => void;
  onLinkEvidence: (
    timelineId: string,
    evidenceId: string,
  ) => Promise<TimelineEntryDto>;
  onMetadataUpdate: (input: UpdateCaseMetadataInput) => Promise<void>;
  onReloadEvidence: (evidenceId: string) => Promise<EvidenceItemDto>;
  onReloadLatest: () => Promise<void>;
  onReloadTimeline: (timelineId: string) => Promise<TimelineEntryDto>;
  onRetry: () => void;
  onSelectEvidence: (evidence: EvidenceItemDto) => void;
  onSelectTimeline: (timeline: TimelineEntryDto) => void;
  onStatusUpdate: (input: UpdateCaseStatusInput) => Promise<void>;
  onTimelineNextPage: () => void;
  onTimelinePreviousPage: () => void;
  onTimelineRetry: () => void;
  onUnlinkEvidence: (
    timelineId: string,
    evidenceId: string,
  ) => Promise<TimelineEntryDto>;
  onUpdateEvidence: (
    evidenceId: string,
    input: UpdateEvidenceInput,
  ) => Promise<EvidenceItemDto>;
  onUpdateTimeline: (
    timelineId: string,
    input: UpdateTimelineInput,
  ) => Promise<TimelineEntryDto>;
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

function isStaleCaseVersion(error: unknown): boolean {
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

export function RecordConflictNotice({
  onCancel,
  onReload,
}: ConflictNoticeProps) {
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
      <h3>Record version changed</h3>
      <p>
        Someone or another request updated this record. Reload the latest
        version before trying again.
      </p>
      <div className="form-actions">
        <button disabled={reloading} type="button" onClick={() => void reload()}>
          {reloading ? "Reloading..." : "Reload latest"}
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

const detailSections = [
  ["overview", "Overview"],
  ["evidence", "Evidence"],
  ["timeline", "Permit timeline"],
  ["activity", "Activity"],
  ["packet", "Packet preview"],
] as const satisfies readonly [DetailSection, string][];

export function CaseDetail({
  activityError,
  activityLoading,
  activityResponse,
  caseRecord,
  currentUserId,
  error,
  evidenceError,
  evidenceLoading,
  evidenceResponse,
  highlightedEvidenceId,
  loading,
  role,
  selectedEvidenceId,
  selectedTimelineId,
  timelineError,
  timelineLoading,
  timelineResponse,
  onActivityNextPage,
  onActivityPreviousPage,
  onActivityRetry,
  onBack,
  onCreateEvidence,
  onCreateTimeline,
  onEvidenceNextPage,
  onEvidencePreviousPage,
  onEvidenceRetry,
  onLinkEvidence,
  onMetadataUpdate,
  onReloadEvidence,
  onReloadLatest,
  onReloadTimeline,
  onRetry,
  onSelectEvidence,
  onSelectTimeline,
  onStatusUpdate,
  onTimelineNextPage,
  onTimelinePreviousPage,
  onTimelineRetry,
  onUnlinkEvidence,
  onUpdateEvidence,
  onUpdateTimeline,
}: CaseDetailProps) {
  const [activeSection, setActiveSection] = useState<DetailSection>("overview");
  const [editing, setEditing] = useState(false);
  const editSubmittingRef = useRef(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const statusSubmittingRef = useRef(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [caseConflictMode, setCaseConflictMode] = useState<
    "edit" | "status" | null
  >(null);

  const [evidenceFormMode, setEvidenceFormMode] = useState<
    "create" | "edit" | null
  >(null);
  const evidenceSubmittingRef = useRef(false);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [evidenceFormError, setEvidenceFormError] = useState("");
  const [evidenceConflictId, setEvidenceConflictId] = useState<string | null>(
    null,
  );

  const [timelineFormMode, setTimelineFormMode] = useState<
    "create" | "edit" | null
  >(null);
  const timelineSubmittingRef = useRef(false);
  const [timelineSubmitting, setTimelineSubmitting] = useState(false);
  const [timelineFormError, setTimelineFormError] = useState("");
  const [timelineConflictId, setTimelineConflictId] = useState<string | null>(
    null,
  );
  const linkSubmittingRef = useRef(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState("");

  const evidenceItems = evidenceResponse?.evidence ?? [];
  const timelineItems = timelineResponse?.timeline ?? [];
  const selectedEvidence =
    evidenceItems.find((item) => item.id === selectedEvidenceId) ?? null;
  const selectedTimeline =
    timelineItems.find((item) => item.id === selectedTimelineId) ?? null;

  async function submitMetadata(input: UpdateCaseMetadataInput) {
    if (editSubmittingRef.current) {
      return;
    }

    editSubmittingRef.current = true;
    setEditSubmitting(true);
    setEditError("");
    setCaseConflictMode(null);

    try {
      await onMetadataUpdate(input);
      setEditing(false);
    } catch (updateError) {
      if (isStaleCaseVersion(updateError)) {
        setCaseConflictMode("edit");
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
    setCaseConflictMode(null);

    try {
      await onStatusUpdate(input);
    } catch (updateError) {
      if (isStaleCaseVersion(updateError)) {
        setCaseConflictMode("status");
      } else {
        setStatusError(safeLifecycleError(updateError));
      }
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  async function reloadLatestCase() {
    await onReloadLatest();
    setCaseConflictMode(null);
    setEditing(false);
    setEditError("");
    setStatusError("");
  }

  async function submitEvidence(
    input: CreateEvidenceInput | UpdateEvidenceInput,
  ) {
    if (evidenceSubmittingRef.current) {
      return;
    }

    evidenceSubmittingRef.current = true;
    setEvidenceSubmitting(true);
    setEvidenceFormError("");
    setEvidenceConflictId(null);

    try {
      if (evidenceFormMode === "edit" && selectedEvidence) {
        await onUpdateEvidence(selectedEvidence.id, input as UpdateEvidenceInput);
      } else {
        await onCreateEvidence(input as CreateEvidenceInput);
      }
      setEvidenceFormMode(null);
    } catch (updateError) {
      if (isStaleRecordVersion(updateError) && selectedEvidence) {
        setEvidenceConflictId(selectedEvidence.id);
      } else {
        setEvidenceFormError(safeRecordError(updateError));
      }
    } finally {
      evidenceSubmittingRef.current = false;
      setEvidenceSubmitting(false);
    }
  }

  async function submitTimeline(
    input: CreateTimelineInput | UpdateTimelineInput,
  ) {
    if (timelineSubmittingRef.current) {
      return;
    }

    timelineSubmittingRef.current = true;
    setTimelineSubmitting(true);
    setTimelineFormError("");
    setTimelineConflictId(null);

    try {
      if (timelineFormMode === "edit" && selectedTimeline) {
        await onUpdateTimeline(selectedTimeline.id, input as UpdateTimelineInput);
      } else {
        await onCreateTimeline(input as CreateTimelineInput);
      }
      setTimelineFormMode(null);
    } catch (updateError) {
      if (isStaleRecordVersion(updateError) && selectedTimeline) {
        setTimelineConflictId(selectedTimeline.id);
      } else {
        setTimelineFormError(safeRecordError(updateError));
      }
    } finally {
      timelineSubmittingRef.current = false;
      setTimelineSubmitting(false);
    }
  }

  async function linkEvidence(evidenceId: string) {
    if (!selectedTimeline || linkSubmittingRef.current) {
      return;
    }

    linkSubmittingRef.current = true;
    setLinkSubmitting(true);
    setLinkError("");

    try {
      await onLinkEvidence(selectedTimeline.id, evidenceId);
    } catch (updateError) {
      setLinkError(safeRecordError(updateError));
    } finally {
      linkSubmittingRef.current = false;
      setLinkSubmitting(false);
    }
  }

  async function unlinkEvidence(evidenceId: string) {
    if (!selectedTimeline || linkSubmittingRef.current) {
      return;
    }

    linkSubmittingRef.current = true;
    setLinkSubmitting(true);
    setLinkError("");

    try {
      await onUnlinkEvidence(selectedTimeline.id, evidenceId);
    } catch (updateError) {
      setLinkError(safeRecordError(updateError));
    } finally {
      linkSubmittingRef.current = false;
      setLinkSubmitting(false);
    }
  }

  async function reloadSelectedEvidence() {
    if (!evidenceConflictId) {
      return;
    }

    await onReloadEvidence(evidenceConflictId);
    setEvidenceConflictId(null);
    setEvidenceFormError("");
  }

  async function reloadSelectedTimeline() {
    if (!timelineConflictId) {
      return;
    }

    await onReloadTimeline(timelineConflictId);
    setTimelineConflictId(null);
    setTimelineFormError("");
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
          <div className="section-tabs" role="tablist" aria-label="Case detail sections">
            {detailSections.map(([section, label]) => (
              <button
                aria-selected={activeSection === section}
                className={
                  activeSection === section ? "tab-button active" : "tab-button"
                }
                key={section}
                role="tab"
                type="button"
                onClick={() => setActiveSection(section)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeSection === "overview" && (
            <>
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
                    <dd>{formatDateTime(caseRecord.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(caseRecord.updated_at)}</dd>
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
                        setCaseConflictMode(null);
                        setEditing(true);
                      }}
                    >
                      Edit details
                    </button>
                  )}
                </div>

                {caseConflictMode === "edit" && (
                  <ConflictNotice
                    onCancel={() => setCaseConflictMode(null)}
                    onReload={reloadLatestCase}
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
                      setCaseConflictMode(null);
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
                  {caseConflictMode === "status" && (
                    <ConflictNotice
                      onCancel={() => setCaseConflictMode(null)}
                      onReload={reloadLatestCase}
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
            </>
          )}

          {activeSection === "evidence" && (
            <section className="detail-section" aria-labelledby="evidence-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Evidence</p>
                  <h3 id="evidence-title">Structured case evidence</h3>
                </div>
                {evidenceFormMode !== "create" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFormError("");
                      setEvidenceConflictId(null);
                      setEvidenceFormMode("create");
                    }}
                  >
                    Add evidence
                  </button>
                )}
              </div>

              {evidenceFormMode === "create" && (
                <EvidenceForm
                  currentUserId={currentUserId}
                  error={evidenceFormError}
                  mode="create"
                  role={role}
                  submitting={evidenceSubmitting}
                  onCancel={() => {
                    setEvidenceFormMode(null);
                    setEvidenceFormError("");
                    setEvidenceConflictId(null);
                  }}
                  onSubmit={submitEvidence}
                />
              )}

              {evidenceConflictId && (
                <RecordConflictNotice
                  onCancel={() => setEvidenceConflictId(null)}
                  onReload={reloadSelectedEvidence}
                />
              )}

              {selectedEvidence && evidenceFormMode === "edit" && (
                <EvidenceForm
                  currentUserId={currentUserId}
                  error={evidenceFormError}
                  evidence={selectedEvidence}
                  mode="edit"
                  role={role}
                  submitting={evidenceSubmitting}
                  onCancel={() => {
                    setEvidenceFormMode(null);
                    setEvidenceFormError("");
                    setEvidenceConflictId(null);
                  }}
                  onSubmit={submitEvidence}
                />
              )}

              <EvidenceList
                error={evidenceError}
                highlightedEvidenceId={highlightedEvidenceId}
                loading={evidenceLoading}
                response={evidenceResponse}
                selectedEvidenceId={selectedEvidenceId}
                onNextPage={onEvidenceNextPage}
                onPreviousPage={onEvidencePreviousPage}
                onRetry={onEvidenceRetry}
                onSelectEvidence={(evidence) => {
                  onSelectEvidence(evidence);
                  setEvidenceFormMode(null);
                  setEvidenceFormError("");
                }}
              />

              {selectedEvidence && evidenceFormMode !== "edit" && (
                <EvidenceDetail
                  currentUserId={currentUserId}
                  evidence={selectedEvidence}
                  role={role}
                  onEdit={() => {
                    setEvidenceFormError("");
                    setEvidenceConflictId(null);
                    setEvidenceFormMode("edit");
                  }}
                />
              )}
            </section>
          )}

          {activeSection === "timeline" && (
            <section className="detail-section" aria-labelledby="timeline-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Permit timeline</p>
                  <h3 id="timeline-title">Structured permit events</h3>
                </div>
                {timelineFormMode !== "create" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineFormError("");
                      setTimelineConflictId(null);
                      setTimelineFormMode("create");
                    }}
                  >
                    Add timeline entry
                  </button>
                )}
              </div>

              {timelineFormMode === "create" && (
                <TimelineForm
                  currentUserId={currentUserId}
                  error={timelineFormError}
                  evidence={evidenceItems}
                  mode="create"
                  role={role}
                  submitting={timelineSubmitting}
                  onCancel={() => {
                    setTimelineFormMode(null);
                    setTimelineFormError("");
                    setTimelineConflictId(null);
                  }}
                  onSubmit={submitTimeline}
                />
              )}

              {timelineConflictId && (
                <RecordConflictNotice
                  onCancel={() => setTimelineConflictId(null)}
                  onReload={reloadSelectedTimeline}
                />
              )}

              {selectedTimeline && timelineFormMode === "edit" && (
                <TimelineForm
                  currentUserId={currentUserId}
                  error={timelineFormError}
                  evidence={evidenceItems}
                  mode="edit"
                  role={role}
                  submitting={timelineSubmitting}
                  timelineEntry={selectedTimeline}
                  onCancel={() => {
                    setTimelineFormMode(null);
                    setTimelineFormError("");
                    setTimelineConflictId(null);
                  }}
                  onSubmit={submitTimeline}
                />
              )}

              <TimelineList
                currentUserId={currentUserId}
                error={timelineError}
                evidence={evidenceItems}
                loading={timelineLoading}
                response={timelineResponse}
                role={role}
                selectedTimelineId={selectedTimelineId}
                onEditTimeline={(timeline) => {
                  onSelectTimeline(timeline);
                  setTimelineFormError("");
                  setTimelineConflictId(null);
                  setTimelineFormMode("edit");
                }}
                onNextPage={onTimelineNextPage}
                onOpenEvidence={(evidence) => {
                  onSelectEvidence(evidence);
                  setActiveSection("evidence");
                }}
                onPreviousPage={onTimelinePreviousPage}
                onRetry={onTimelineRetry}
                onSelectTimeline={(timeline) => {
                  onSelectTimeline(timeline);
                  setTimelineFormMode(null);
                  setTimelineFormError("");
                  setLinkError("");
                }}
              />

              <EvidenceLinkManager
                currentUserId={currentUserId}
                error={linkError}
                evidence={evidenceItems}
                role={role}
                submitting={linkSubmitting}
                timelineEntry={selectedTimeline}
                onLink={linkEvidence}
                onUnlink={unlinkEvidence}
              />
            </section>
          )}

          {activeSection === "activity" && (
            <CaseActivity
              error={activityError}
              loading={activityLoading}
              response={activityResponse}
              onNextPage={onActivityNextPage}
              onPreviousPage={onActivityPreviousPage}
              onRetry={onActivityRetry}
            />
          )}

          {activeSection === "packet" && (
            <PacketPreview
              activityResponse={activityResponse}
              caseRecord={caseRecord}
              evidence={evidenceItems}
              timeline={timelineItems}
            />
          )}
        </div>
      )}
    </section>
  );
}
