import { type KeyboardEvent, useEffect, useRef, useState } from "react";
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
import { DeliveryLifecyclePanel } from "./DeliveryLifecyclePanel";
import { AIReviewPanel } from "./AIReviewPanel";
import { ReviewerWorkspacePanel } from "./ReviewerWorkspacePanel";
import { StatusBadge } from "./StatusBadge";
import { StatusManagement } from "./StatusManagement";
import { TimelineForm } from "./TimelineForm";
import { TimelineList } from "./TimelineList";
import {
  formatDateTime,
  isStaleRecordVersion,
  safeRecordError,
} from "./evidenceTimelineUtils";
import type { PacketReviewDraftResponseData } from "../../shared/ai-review/types";
import type { MissionIntelligence } from "../types/mission-intelligence";
import { Icon, type IconName } from "../design-system/icons";
import {
  MetricChip,
  PrimaryAction,
  ProgressBar,
  SecondaryAction,
  StatusBadge as OsStatusBadge,
  SurfaceCard,
} from "../design-system/primitives";

export type CaseDetailSection =
  | "overview"
  | "evidence"
  | "timeline"
  | "activity"
  | "packet"
  | "ai-review"
  | "reviewer"
  | "findings";

interface CaseDetailProps {
  activityError: string;
  activityLoading: boolean;
  activityResponse: CaseActivityResponse | null;
  backLabel?: string;
  caseRecord: CaseDto | null;
  currentUserId: string;
  error: string;
  evidenceError: string;
  evidenceLoading: boolean;
  evidenceResponse: EvidenceListResponse | null;
  highlightedEvidenceId: string | null;
  initialSection?: CaseDetailSection;
  loading: boolean;
  intelligence: MissionIntelligence | null;
  intelligenceError: string;
  intelligenceLoading: boolean;
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
  onGenerateAiReview: () => Promise<PacketReviewDraftResponseData>;
  onDeliveryLifecycleChanged?: () => Promise<void>;
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

type CockpitSection = "overview" | "evidence" | "timeline" | "findings" | "reviewer" | "packet";

const detailSections = [
  ["overview", "Overview", "mission"],
  ["evidence", "Evidence", "evidence"],
  ["timeline", "Timeline", "timeline"],
  ["findings", "Findings", "ai"],
  ["reviewer", "Reviewer", "evidence"],
  ["packet", "Packet", "packets"],
] as const satisfies readonly [CockpitSection, string, IconName][];

function normalizeSection(section: CaseDetailSection): CockpitSection {
  if (section === "ai-review") return "findings";
  if (section === "activity") return "timeline";
  return section;
}

export function CaseDetail({
  activityError,
  activityLoading,
  activityResponse,
  backLabel = "Back to list",
  caseRecord,
  currentUserId,
  error,
  evidenceError,
  evidenceLoading,
  evidenceResponse,
  highlightedEvidenceId,
  initialSection = "overview",
  loading,
  intelligence,
  intelligenceError,
  intelligenceLoading,
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
  onGenerateAiReview,
  onDeliveryLifecycleChanged = async () => {},
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
  const [activeSection, setActiveSection] = useState<CockpitSection>(
    normalizeSection(initialSection),
  );
  const [timelineView, setTimelineView] = useState<"permit" | "activity">(
    initialSection === "activity" ? "activity" : "permit",
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  // Never render a previous evaluation while a mutation-triggered refresh is
  // running. Evidence remains usable even if the supplementary refresh fails.
  const currentIntelligence = intelligenceLoading ? null : intelligence;
  const signalsLoading = intelligenceLoading || !currentIntelligence;
  const missionHealth = currentIntelligence?.missionHealth.score ?? 0;
  const packetCompleted = currentIntelligence?.packetReadiness.completed ?? 0;
  const packetProgress = currentIntelligence?.packetReadiness.score ?? 0;
  const evidenceConditionCount = currentIntelligence?.blockers.filter((item) =>
    ["missing-evidence", "disputed-evidence", "unready-evidence"].includes(item.id)
  ).length ?? 0;
  const nextAction = currentIntelligence?.recommendedAction;

  useEffect(() => {
    setActiveSection(normalizeSection(initialSection));
    setTimelineView(initialSection === "activity" ? "activity" : "permit");
  }, [caseRecord?.id, initialSection]);

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

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % detailSections.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + detailSections.length) % detailSections.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = detailSections.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextSection = detailSections[nextIndex][0];
    setActiveSection(nextSection);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section aria-labelledby="case-detail-title" className="workspace-panel case-cockpit">
      <div className="case-cockpit__back-row">
        <SecondaryAction onClick={onBack}>
          {backLabel}
        </SecondaryAction>
      </div>

      <header className="case-cockpit__hero">
        <div className="case-cockpit__hero-copy">
          <p className="eyebrow">Permit operations / Case Cockpit</p>
          <h1 id="case-detail-title">{caseRecord?.project_name ?? "Case cockpit"}</h1>
          {caseRecord && (
            <>
              <p className="case-cockpit__address">
                {caseRecord.address}, {caseRecord.city}
              </p>
              <div className="case-cockpit__hero-meta">
                <StatusBadge status={caseRecord.current_status} />
                <span>{caseRecord.jurisdiction}</span>
                <span>{caseRecord.permit_number ?? "Permit number pending"}</span>
              </div>
            </>
          )}
        </div>
        {caseRecord && (
          <div className="case-cockpit__updated">
            <span>Last signal</span>
            <strong>{formatDateTime(caseRecord.updated_at)}</strong>
          </div>
        )}
      </header>

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
              {backLabel}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && caseRecord && (
        <div className="case-detail">
          <div className="case-cockpit__command-grid">
            <SurfaceCard as="article" className="mission-brief" elevated>
              <div className="mission-brief__icon" aria-hidden="true">
                <Icon name="ai" size={20} />
              </div>
              <div className="mission-brief__copy">
                <div className="mission-brief__heading">
                  <div>
                    <p className="eyebrow">Case brief</p>
                    <h2>What matters now</h2>
                  </div>
                  <OsStatusBadge tone="info">Deterministic</OsStatusBadge>
                </div>
                <p>
                  {intelligenceError ||
                    currentIntelligence?.explanation ||
                    "Evaluating current case evidence and timeline state."}
                </p>
                <PrimaryAction
                  disabled={!nextAction}
                  icon="arrow-right"
                  iconAfter
                  onClick={() => {
                    if (nextAction) setActiveSection(nextAction.targetTab);
                  }}
                >
                  {nextAction?.title ?? "Evaluating case"}
                </PrimaryAction>
              </div>
            </SurfaceCard>

            <SurfaceCard as="article" className="mission-health">
              <div className="mission-health__heading">
                <div>
                  <p className="eyebrow">Investigation health</p>
                  <h2>{signalsLoading ? "—" : `${missionHealth}%`}</h2>
                </div>
                <OsStatusBadge
                  tone={signalsLoading ? "info" : missionHealth >= 80 ? "success" : missionHealth >= 55 ? "warning" : "danger"}
                >
                  {signalsLoading ? "Syncing" : missionHealth >= 80 ? "Strong" : missionHealth >= 55 ? "Attention" : "At risk"}
                </OsStatusBadge>
              </div>
              <ProgressBar
                label={signalsLoading ? "Investigation health syncing" : `Investigation health ${missionHealth}%`}
                tone={signalsLoading ? "jade" : missionHealth >= 80 ? "success" : missionHealth >= 55 ? "warning" : "danger"}
                value={signalsLoading ? 0 : missionHealth}
              />
              <div className="mission-health__metrics">
                <MetricChip icon="evidence" label="evidence" value={`${currentIntelligence?.evidenceHealth.completed ?? 0}/${currentIntelligence?.evidenceHealth.total ?? 2}`} />
                <MetricChip icon="timeline" label="timeline" value={`${currentIntelligence?.timelineHealth.completed ?? 0}/${currentIntelligence?.timelineHealth.total ?? 2}`} />
                <MetricChip icon="packets" label="packet" value={`${packetCompleted}/5`} />
              </div>
              {currentIntelligence && (
                <ul className="readiness-factor-list" aria-label="Mission health calculation">
                  {currentIntelligence.readinessFactors.map((factor) => (
                    <li className={factor.passed ? "is-passed" : "is-pending"} key={factor.id}>
                      <span aria-hidden="true">{factor.passed ? "✓" : "—"}</span>
                      <div><strong>{factor.label}</strong><small>{factor.detail}</small></div>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
          </div>

          <div className="section-tabs case-cockpit__tabs" role="tablist" aria-label="Case cockpit sections">
            {detailSections.map(([section, label, icon], index) => (
              <button
                aria-controls={`case-detail-panel-${section}`}
                aria-selected={activeSection === section}
                className={
                  activeSection === section ? "tab-button active" : "tab-button"
                }
                key={section}
                id={`case-detail-tab-${section}`}
                role="tab"
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                tabIndex={activeSection === section ? 0 : -1}
                type="button"
                onClick={() => setActiveSection(section)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <Icon name={icon} size={17} />
                {label}
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`case-detail-tab-${activeSection}`}
            id={`case-detail-panel-${activeSection}`}
            role="tabpanel"
          >

          {activeSection === "overview" && (
            <>
              <section className="detail-section cockpit-section" aria-labelledby="overview-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Mission snapshot</p>
                    <h3 id="overview-title">Case overview</h3>
                  </div>
                  {currentIntelligence ? (
                    <OsStatusBadge tone={currentIntelligence.counts.blockers > 0 ? "warning" : "success"}>
                      {currentIntelligence.missionState}
                    </OsStatusBadge>
                  ) : <StatusBadge status={caseRecord.current_status} />}
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
                className="detail-section cockpit-section cockpit-action-card"
                aria-labelledby="edit-details-title"
              >
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Case controls</p>
                    <h3 id="edit-details-title">Keep the permit summary current</h3>
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
                  <p>Update project, client, location, jurisdiction, and permit metadata when the record changes.</p>
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
            <section className="detail-section cockpit-section" aria-labelledby="evidence-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Evidence quality</p>
                  <h3 id="evidence-title">Source readiness</h3>
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

              <div className="evidence-health" aria-label="Evidence health indicators">
                <MetricChip icon="check" label="Review checks" tone="success" value={`${currentIntelligence?.evidenceHealth.completed ?? 0}/${currentIntelligence?.evidenceHealth.total ?? 2}`} />
                <MetricChip icon="warning" label="Open conditions" tone={evidenceConditionCount ? "danger" : "success"} value={evidenceConditionCount} />
                <MetricChip icon="evidence" label="Records ready" value={`${currentIntelligence?.counts.evidence.deliveryReady ?? 0}/${currentIntelligence?.counts.evidence.total ?? 0}`} />
                <MetricChip icon="warning" label="Provenance issues" tone={currentIntelligence?.counts.evidence.provenanceIssues ? "warning" : "success"} value={currentIntelligence?.counts.evidence.provenanceIssues ?? 0} />
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
            <section className="detail-section cockpit-section" aria-labelledby="timeline-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Timeline</p>
                  <h3 id="timeline-title">Mission chronology</h3>
                </div>
                {timelineView === "permit" && timelineFormMode !== "create" && (
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

              <div className="cockpit-subtabs" role="tablist" aria-label="Timeline views">
                <button
                  aria-selected={timelineView === "permit"}
                  className={timelineView === "permit" ? "active" : ""}
                  role="tab"
                  type="button"
                  onClick={() => setTimelineView("permit")}
                >
                  Permit events
                </button>
                <button
                  aria-selected={timelineView === "activity"}
                  className={timelineView === "activity" ? "active" : ""}
                  role="tab"
                  type="button"
                  onClick={() => setTimelineView("activity")}
                >
                  Case activity
                </button>
              </div>

              {timelineView === "permit" && timelineFormMode === "create" && (
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

              {timelineView === "permit" && timelineConflictId && (
                <RecordConflictNotice
                  onCancel={() => setTimelineConflictId(null)}
                  onReload={reloadSelectedTimeline}
                />
              )}

              {timelineView === "permit" && selectedTimeline && timelineFormMode === "edit" && (
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

              {timelineView === "permit" && <TimelineList
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
              />}

              {timelineView === "permit" && <EvidenceLinkManager
                currentUserId={currentUserId}
                error={linkError}
                evidence={evidenceItems}
                role={role}
                submitting={linkSubmitting}
                timelineEntry={selectedTimeline}
                onLink={linkEvidence}
                onUnlink={unlinkEvidence}
              />}

              {timelineView === "activity" && (
                <CaseActivity
                  error={activityError}
                  loading={activityLoading}
                  response={activityResponse}
                  onNextPage={onActivityNextPage}
                  onPreviousPage={onActivityPreviousPage}
                  onRetry={onActivityRetry}
                />
              )}
            </section>
          )}

          {activeSection === "packet" && (
            <section className="cockpit-packet" aria-labelledby="packet-progress-title">
              <SurfaceCard className="packet-progress">
                <div className="packet-progress__heading">
                  <div>
                    <p className="eyebrow">Packet readiness</p>
                    <h3 id="packet-progress-title">{packetCompleted === 5 ? "Packet ready for delivery review" : `${packetCompleted} of 5 delivery checks complete`}</h3>
                  </div>
                  <strong>{packetCompleted}/5</strong>
                </div>
                <ProgressBar
                  label={`Packet readiness ${Math.round(packetProgress)}%`}
                  tone={packetProgress === 100 ? "success" : "warning"}
                  value={packetProgress}
                />
                <p>{currentIntelligence?.packetReadiness.explanation ?? "Evaluating packet readiness."} Packet readiness does not indicate permit approval or jurisdiction resolution.</p>
                {currentIntelligence && (
                  <ul className="readiness-factor-list readiness-factor-list--packet" aria-label="Packet readiness calculation">
                    {currentIntelligence.readinessFactors.slice(0, 5).map((factor) => (
                      <li className={factor.passed ? "is-passed" : "is-pending"} key={factor.id}>
                        <span aria-hidden="true">{factor.passed ? "✓" : "—"}</span>
                        <div><strong>{factor.label}</strong><small>{factor.detail}</small></div>
                      </li>
                    ))}
                  </ul>
                )}
              </SurfaceCard>
              <DeliveryLifecyclePanel
                caseId={caseRecord.id}
                caseVersion={caseRecord.version}
                role={role}
                onChanged={onDeliveryLifecycleChanged}
              />
              <PacketPreview
                activityResponse={activityResponse}
                caseRecord={caseRecord}
                evidence={evidenceItems}
                timeline={timelineItems}
              />
            </section>
          )}

          {activeSection === "findings" && (
            <section className="cockpit-findings" aria-labelledby="findings-title">
              <div className="cockpit-section-heading">
                <p className="eyebrow">Findings</p>
                <h2 id="findings-title">Review signals and grounded next steps</h2>
                <p>The existing protected review workflow checks the assembled case without changing source records.</p>
              </div>
              <AIReviewPanel
                key={caseRecord.id}
                onGenerate={onGenerateAiReview}
                onCompareWithPacket={() => setActiveSection("packet")}
              />
            </section>
          )}
          {activeSection === "reviewer" && (role === "admin" ? (
            <ReviewerWorkspacePanel caseId={caseRecord.id} evidence={evidenceItems} timeline={timelineItems} />
          ) : (
            <section className="cockpit-section"><p>Reviewer workspace access is limited to permit analysts.</p></section>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}
