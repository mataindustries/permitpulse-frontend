import { type FormEvent, useEffect, useState } from "react";
import {
  CaseApiError,
  createCase,
  generateAiReviewDraft,
  getCase,
  listCaseActivity,
  listCases,
  updateCaseMetadata,
  updateCaseStatus,
} from "./api/cases";
import {
  createEvidence,
  createTimelineEntry,
  getEvidence,
  getTimelineEntry,
  linkTimelineEvidence,
  listEvidence,
  listTimelineEntries,
  unlinkTimelineEvidence,
  updateEvidence,
  updateTimelineEntry,
} from "./api/evidence-timeline";
import { listMissionControl } from "./api/mission-control";
import { getMissionIntelligence } from "./api/mission-intelligence";
import { authClient } from "./auth-client";
import {
  CaseDetail,
  type CaseDetailSection,
} from "./components/CaseDetail";
import { CaseList } from "./components/CaseList";
import { CreateCaseForm } from "./components/CreateCaseForm";
import { FounderView } from "./features/founder/FounderView";
import { MissionControlHome } from "./features/mission-control/MissionControlHome";
import { CaseDestinationView } from "./features/navigation/CaseDestinationView";
import { MobileShell } from "./os/MobileShell";
import type { OsDestination } from "./os/navigation";
import type {
  CaseDto,
  CaseActivityResponse,
  CaseListPagination,
  CreateCaseInput,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
  UserRole,
} from "./types/cases";
import type {
  CreateEvidenceInput,
  CreateTimelineInput,
  EvidenceItemDto,
  EvidenceListResponse,
  TimelineEntryDto,
  TimelineListResponse,
  UpdateEvidenceInput,
  UpdateTimelineInput,
} from "./types/evidence-timeline";
import type { MissionControlItem } from "./types/mission-control";
import type { MissionIntelligence } from "./types/mission-intelligence";
import type { PacketReviewDraftResponseData } from "../shared/ai-review/types";

interface AuthCapabilities {
  enabled: boolean;
  signup_enabled: boolean;
}

export interface SafeUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

export type AuthState =
  | { status: "checking-config" }
  | { status: "checking-session"; allowSignup: boolean }
  | { status: "disabled" }
  | { status: "signed-out"; allowSignup: boolean }
  | { status: "session-expired"; allowSignup: boolean }
  | { status: "signed-in"; user: SafeUser }
  | { status: "signing-out"; user: SafeUser };

type WorkspaceView =
  | { name: "mission" }
  | { name: "list" }
  | { name: "create" }
  | {
      name: "detail";
      caseId: string;
      initialSection: CaseDetailSection;
      origin: Exclude<OsDestination, "founder">;
    }
  | { name: "destination"; destination: "ai" | "packets" }
  | { name: "founder" };

interface CaseClient {
  createEvidence: typeof createEvidence;
  createCase: typeof createCase;
  createTimelineEntry: typeof createTimelineEntry;
  generateAiReviewDraft: typeof generateAiReviewDraft;
  getCase: typeof getCase;
  getMissionIntelligence: typeof getMissionIntelligence;
  getEvidence: typeof getEvidence;
  getTimelineEntry: typeof getTimelineEntry;
  linkTimelineEvidence: typeof linkTimelineEvidence;
  listEvidence: typeof listEvidence;
  listCaseActivity: typeof listCaseActivity;
  listCases: typeof listCases;
  listMissionControl: typeof listMissionControl;
  listTimelineEntries: typeof listTimelineEntries;
  unlinkTimelineEvidence: typeof unlinkTimelineEvidence;
  updateEvidence: typeof updateEvidence;
  updateCaseMetadata: typeof updateCaseMetadata;
  updateCaseStatus: typeof updateCaseStatus;
  updateTimelineEntry: typeof updateTimelineEntry;
}

const defaultCaseClient: CaseClient = {
  createEvidence,
  createCase,
  createTimelineEntry,
  generateAiReviewDraft,
  getCase,
  getMissionIntelligence,
  getEvidence,
  getTimelineEntry,
  linkTimelineEvidence,
  listEvidence,
  listCaseActivity,
  listCases,
  listMissionControl,
  listTimelineEntries,
  unlinkTimelineEvidence,
  updateEvidence,
  updateCaseMetadata,
  updateCaseStatus,
  updateTimelineEntry,
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The request could not be completed. Please try again.";
}

async function loadCapabilities(): Promise<AuthCapabilities> {
  const response = await fetch("/api/config/auth", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Authentication status could not be loaded.");
  }

  const body = (await response.json()) as {
    data: AuthCapabilities;
  };

  return body.data;
}

async function loadSession(): Promise<SafeUser | null> {
  const { data, error } = await authClient.getSession();

  if (error) {
    throw error;
  }

  if (!data?.user) {
    return null;
  }

  return loadWorkspaceIdentity();
}

async function loadWorkspaceIdentity(): Promise<SafeUser> {
  const response = await fetch("/api/workspace", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });

  if (response.status === 401) {
    throw new CaseApiError(
      "unauthorized",
      "Your session expired. Sign in again.",
      401,
      "UNAUTHENTICATED",
    );
  }

  if (!response.ok) {
    throw new Error("Workspace identity could not be loaded.");
  }

  const body = (await response.json()) as {
    data?: {
      user?: {
        id?: unknown;
        email?: unknown;
        name?: unknown;
        role?: unknown;
      };
    };
  };
  const user = body.data?.user;

  if (
    typeof user?.id !== "string" ||
    typeof user.email !== "string" ||
    (user.role !== "client" && user.role !== "admin")
  ) {
    throw new Error("Workspace identity could not be loaded.");
  }

  return {
    id: user.id,
    email: user.email,
    ...(typeof user.name === "string" && user.name.length > 0
      ? { name: user.name }
      : {}),
    role: user.role,
  };
}

interface WorkspaceProps {
  client: CaseClient;
  onSessionExpired: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  user: SafeUser;
}

function Workspace({
  client,
  onSessionExpired,
  onSignOut,
  signingOut,
  user,
}: WorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>({ name: "mission" });
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [pagination, setPagination] = useState<CaseListPagination | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [missions, setMissions] = useState<MissionControlItem[]>([]);
  const [missionLoading, setMissionLoading] = useState(true);
  const [missionError, setMissionError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [detailCase, setDetailCase] = useState<CaseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [missionIntelligence, setMissionIntelligence] =
    useState<MissionIntelligence | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [activityResponse, setActivityResponse] =
    useState<CaseActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [evidenceResponse, setEvidenceResponse] =
    useState<EvidenceListResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null,
  );
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<
    string | null
  >(null);
  const [timelineResponse, setTimelineResponse] =
    useState<TimelineListResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState("");

  function handleCaseError(error: unknown, setMessage: (message: string) => void) {
    if (error instanceof CaseApiError && error.kind === "unauthorized") {
      onSessionExpired();
      return;
    }

    setMessage(getErrorMessage(error));
  }

  async function loadCaseList(offset = pagination?.offset ?? 0) {
    setListLoading(true);
    setListError("");

    try {
      const response = await client.listCases(
        offset > 0 ? { offset } : undefined,
      );

      setCases(response.cases);
      setPagination(response.pagination);
    } catch (error) {
      handleCaseError(error, setListError);
    } finally {
      setListLoading(false);
    }
  }

  async function loadMissionQueue() {
    setMissionLoading(true);
    setMissionError("");

    try {
      const response = await client.listMissionControl({ limit: 20 });

      setMissions(response.missions);
    } catch (error) {
      handleCaseError(error, setMissionError);
    } finally {
      setMissionLoading(false);
    }
  }

  async function loadCaseDetail(
    caseId: string,
    initialSection: CaseDetailSection = "overview",
    origin: Exclude<OsDestination, "founder"> = "cases",
  ) {
    setDetailLoading(true);
    setDetailError("");
    setDetailCase(null);
    setMissionIntelligence(null);
    setIntelligenceError("");
    setActivityResponse(null);
    setActivityError("");
    setEvidenceResponse(null);
    setEvidenceError("");
    setSelectedEvidenceId(null);
    setHighlightedEvidenceId(null);
    setTimelineResponse(null);
    setTimelineError("");
    setSelectedTimelineId(null);
    setView({ name: "detail", caseId, initialSection, origin });

    try {
      const record = await client.getCase(caseId);

      setDetailCase(record);
      updateCaseInList(record);
      // Mission Intelligence is supplementary and must not gate the core case.
      void loadMissionIntelligence(caseId);
      void loadActivity(caseId, 0);
      void loadEvidenceRecords(caseId, 0);
      void loadTimelineRecords(caseId, 0);
    } catch (error) {
      handleCaseError(error, setDetailError);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadMissionIntelligence(caseId: string) {
    setIntelligenceLoading(true);
    setIntelligenceError("");

    try {
      const intelligence = await client.getMissionIntelligence(caseId);
      setMissionIntelligence(intelligence);
      return intelligence;
    } catch (error) {
      handleCaseError(error, setIntelligenceError);
    } finally {
      setIntelligenceLoading(false);
    }
  }

  async function loadActivity(caseId: string, offset = 0) {
    setActivityLoading(true);
    setActivityError("");

    try {
      setActivityResponse(
        await client.listCaseActivity(caseId, { limit: 10, offset }),
      );
    } catch (error) {
      handleCaseError(error, setActivityError);
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadEvidenceRecords(caseId: string, offset = 0) {
    setEvidenceLoading(true);
    setEvidenceError("");

    try {
      const response = await client.listEvidence(caseId, { limit: 10, offset });

      setEvidenceResponse(response);
      setSelectedEvidenceId((current) =>
        current && response.evidence.some((item) => item.id === current)
          ? current
          : response.evidence[0]?.id ?? null,
      );
    } catch (error) {
      handleCaseError(error, setEvidenceError);
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function loadTimelineRecords(caseId: string, offset = 0) {
    setTimelineLoading(true);
    setTimelineError("");

    try {
      const response = await client.listTimelineEntries(caseId, {
        limit: 10,
        offset,
      });

      setTimelineResponse(response);
      setSelectedTimelineId((current) =>
        current && response.timeline.some((item) => item.id === current)
          ? current
          : response.timeline[0]?.id ?? null,
      );
    } catch (error) {
      handleCaseError(error, setTimelineError);
    } finally {
      setTimelineLoading(false);
    }
  }

  function updateCaseInList(updated: CaseDto) {
    setCases((current) =>
      current.map((caseRecord) =>
        caseRecord.id === updated.id ? updated : caseRecord,
      ),
    );
  }

  async function reloadLatestCase() {
    if (!detailCase) {
      return;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      const latest = await client.getCase(detailCase.id);

      setDetailCase(latest);
      updateCaseInList(latest);
      await loadActivity(latest.id, 0);
    } catch (error) {
      handleCaseError(error, setDetailError);
      throw error;
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadCaseList(0);
    void loadMissionQueue();
    // The initial load should only run when the authenticated workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCase(input: CreateCaseInput) {
    if (createSubmitting) {
      return;
    }

    setCreateSubmitting(true);
    setCreateError("");
    setSuccessMessage("");

    try {
      const created = await client.createCase(input);

      setSuccessMessage(`Created case: ${created.project_name}.`);
      await Promise.all([loadCaseList(0), loadMissionQueue()]);
      setDetailCase(created);
      setDetailError("");
      setDetailLoading(false);
      setActivityResponse(null);
      setActivityError("");
      setEvidenceResponse(null);
      setEvidenceError("");
      setSelectedEvidenceId(null);
      setHighlightedEvidenceId(null);
      setTimelineResponse(null);
      setTimelineError("");
      setSelectedTimelineId(null);
      setView({
        name: "detail",
        caseId: created.id,
        initialSection: "overview",
        origin: "cases",
      });
      void loadActivity(created.id, 0);
      void loadEvidenceRecords(created.id, 0);
      void loadTimelineRecords(created.id, 0);
      void loadMissionIntelligence(created.id);
    } catch (error) {
      handleCaseError(error, setCreateError);
    } finally {
      setCreateSubmitting(false);
    }
  }

  function nextPage() {
    if (!pagination || cases.length < pagination.limit) {
      return;
    }

    void loadCaseList(pagination.offset + pagination.limit);
  }

  function previousPage() {
    if (!pagination) {
      return;
    }

    void loadCaseList(Math.max(0, pagination.offset - pagination.limit));
  }

  async function handleMetadataUpdate(input: UpdateCaseMetadataInput) {
    if (!detailCase) {
      return;
    }

    try {
      const updated = await client.updateCaseMetadata(detailCase.id, input);

      setDetailCase(updated);
      updateCaseInList(updated);
      setSuccessMessage("Case details saved.");
      await loadActivity(updated.id, 0);
      await loadMissionIntelligence(updated.id);
      void loadMissionQueue();
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleStatusUpdate(input: UpdateCaseStatusInput) {
    if (!detailCase) {
      return;
    }

    try {
      const updated = await client.updateCaseStatus(detailCase.id, input);

      setDetailCase(updated);
      updateCaseInList(updated);
      setSuccessMessage("Case status updated.");
      await loadActivity(updated.id, 0);
      await loadMissionIntelligence(updated.id);
      void loadMissionQueue();
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleGenerateAiReview(): Promise<PacketReviewDraftResponseData> {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      return await client.generateAiReviewDraft(detailCase.id);
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  function replaceEvidence(updated: EvidenceItemDto) {
    setEvidenceResponse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        evidence: current.evidence.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
    });
  }

  function replaceTimeline(updated: TimelineEntryDto) {
    setTimelineResponse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        timeline: current.timeline.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      };
    });
  }

  async function handleCreateEvidence(
    input: CreateEvidenceInput,
  ): Promise<EvidenceItemDto> {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const created = await client.createEvidence(detailCase.id, input);

      setSuccessMessage("Evidence added.");
      setSelectedEvidenceId(created.id);
      setHighlightedEvidenceId(created.id);
      await loadEvidenceRecords(detailCase.id, 0);
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return created;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleUpdateEvidence(
    evidenceId: string,
    input: UpdateEvidenceInput,
  ): Promise<EvidenceItemDto> {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const updated = await client.updateEvidence(detailCase.id, evidenceId, input);

      replaceEvidence(updated);
      setSelectedEvidenceId(updated.id);
      setHighlightedEvidenceId(updated.id);
      setSuccessMessage("Evidence saved.");
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return updated;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleReloadEvidence(evidenceId: string) {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const latest = await client.getEvidence(detailCase.id, evidenceId);

      replaceEvidence(latest);
      setSelectedEvidenceId(latest.id);
      setHighlightedEvidenceId(null);

      return latest;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleCreateTimeline(
    input: CreateTimelineInput,
  ): Promise<TimelineEntryDto> {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const created = await client.createTimelineEntry(detailCase.id, input);

      setSuccessMessage("Timeline entry added.");
      setSelectedTimelineId(created.id);
      await loadTimelineRecords(detailCase.id, 0);
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return created;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleUpdateTimeline(
    timelineId: string,
    input: UpdateTimelineInput,
  ): Promise<TimelineEntryDto> {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const updated = await client.updateTimelineEntry(
        detailCase.id,
        timelineId,
        input,
      );

      replaceTimeline(updated);
      setSelectedTimelineId(updated.id);
      setSuccessMessage("Timeline entry saved.");
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return updated;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleReloadTimeline(timelineId: string) {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const latest = await client.getTimelineEntry(detailCase.id, timelineId);

      replaceTimeline(latest);
      setSelectedTimelineId(latest.id);

      return latest;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleLinkEvidence(timelineId: string, evidenceId: string) {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const updated = await client.linkTimelineEvidence(
        detailCase.id,
        timelineId,
        evidenceId,
      );

      replaceTimeline(updated);
      setSelectedTimelineId(updated.id);
      setSuccessMessage("Supporting evidence linked.");
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return updated;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  async function handleUnlinkEvidence(timelineId: string, evidenceId: string) {
    if (!detailCase) {
      throw new Error("No case is open.");
    }

    try {
      const updated = await client.unlinkTimelineEvidence(
        detailCase.id,
        timelineId,
        evidenceId,
      );

      replaceTimeline(updated);
      setSelectedTimelineId(updated.id);
      setSuccessMessage("Supporting evidence unlinked.");
      await loadMissionIntelligence(detailCase.id);
      void loadMissionQueue();

      return updated;
    } catch (error) {
      if (error instanceof CaseApiError && error.kind === "unauthorized") {
        onSessionExpired();
      }
      throw error;
    }
  }

  const displayName = user.name || user.email;
  const activeDestination: OsDestination =
    view.name === "mission"
      ? "mission"
      : view.name === "destination"
        ? view.destination
        : view.name === "founder"
          ? "founder"
          : view.name === "detail"
            ? view.origin
            : "cases";
  const shellTitle =
    activeDestination === "mission"
      ? "Mission Control"
      : activeDestination === "cases"
        ? "Cases"
        : activeDestination === "ai"
          ? "AI Review"
          : activeDestination === "packets"
            ? "Packets"
            : "Founder";

  function showCreateCase() {
    setCreateError("");
    setSuccessMessage("");
    setView({ name: "create" });
  }

  function navigate(destination: OsDestination) {
    setSuccessMessage("");

    switch (destination) {
      case "mission":
        setView({ name: "mission" });
        return;
      case "cases":
        setView({ name: "list" });
        return;
      case "ai":
      case "packets":
        setView({ name: "destination", destination });
        return;
      case "founder":
        setView({ name: "founder" });
    }
  }

  return (
    <MobileShell
      activeDestination={activeDestination}
      displayName={displayName}
      onCreateCase={showCreateCase}
      onNavigate={navigate}
      title={shellTitle}
    >
      <div className="workspace-content os-workspace-content">
        {successMessage && (
          <p className="success" role="status">
            {successMessage}
          </p>
        )}

        {view.name === "mission" && (
          <MissionControlHome
            displayName={displayName}
            error={missionError}
            loading={missionLoading}
            missions={missions}
            onCreateCase={showCreateCase}
            onOpenMission={(mission) =>
              void loadCaseDetail(
                mission.id,
                mission.intelligence.recommendedAction.targetTab,
                "mission",
              )
            }
            onRetry={() => void loadMissionQueue()}
            onViewCases={() => setView({ name: "list" })}
          />
        )}

        {view.name === "list" && (
          <CaseList
            cases={cases}
            error={listError}
            loading={listLoading}
            pagination={pagination}
            onCreate={showCreateCase}
            onNextPage={nextPage}
            onOpenCase={(caseId) =>
              void loadCaseDetail(caseId, "overview", "cases")
            }
            onPreviousPage={previousPage}
            onRetry={() => void loadCaseList()}
          />
        )}

        {view.name === "create" && (
          <CreateCaseForm
            error={createError}
            submitting={createSubmitting}
            onCancel={() => setView({ name: "list" })}
            onSubmit={handleCreateCase}
          />
        )}

        {view.name === "destination" && (
          <CaseDestinationView
            cases={cases}
            destination={view.destination}
            error={listError}
            loading={listLoading}
            onOpenCase={(caseId) =>
              void loadCaseDetail(
                caseId,
                view.destination === "ai" ? "ai-review" : "packet",
                view.destination,
              )
            }
            onRetry={() => void loadCaseList(0)}
          />
        )}

        {view.name === "founder" && (
          <FounderView
            onSignOut={onSignOut}
            signingOut={signingOut}
            user={user}
          />
        )}

        {view.name === "detail" && (
          <CaseDetail
            activityError={activityError}
            activityLoading={activityLoading}
            activityResponse={activityResponse}
            backLabel={
              view.origin === "mission"
                ? "Back to Mission"
                : view.origin === "ai"
                  ? "Back to AI"
                  : view.origin === "packets"
                    ? "Back to Packets"
                    : "Back to cases"
            }
            caseRecord={detailCase}
            currentUserId={user.id}
            error={detailError}
            evidenceError={evidenceError}
            evidenceLoading={evidenceLoading}
            evidenceResponse={evidenceResponse}
            highlightedEvidenceId={highlightedEvidenceId}
            initialSection={view.initialSection}
            intelligence={missionIntelligence}
            intelligenceError={intelligenceError}
            intelligenceLoading={intelligenceLoading}
            onDeliveryLifecycleChanged={async () => {
              if (!detailCase) return;
              await loadMissionIntelligence(detailCase.id);
              void loadMissionQueue();
            }}
            loading={detailLoading}
            role={user.role}
            selectedEvidenceId={selectedEvidenceId}
            selectedTimelineId={selectedTimelineId}
            timelineError={timelineError}
            timelineLoading={timelineLoading}
            timelineResponse={timelineResponse}
            onActivityNextPage={() => {
              if (!detailCase || !activityResponse) {
                return;
              }

              void loadActivity(
                detailCase.id,
                activityResponse.pagination.offset +
                  activityResponse.pagination.limit,
              );
            }}
            onActivityPreviousPage={() => {
              if (!detailCase || !activityResponse) {
                return;
              }

              void loadActivity(
                detailCase.id,
                Math.max(
                  0,
                  activityResponse.pagination.offset -
                    activityResponse.pagination.limit,
                ),
              );
            }}
            onActivityRetry={() => {
              if (detailCase) {
                void loadActivity(
                  detailCase.id,
                  activityResponse?.pagination.offset ?? 0,
                );
              }
            }}
            onBack={() =>
              setView(
                view.origin === "mission"
                  ? { name: "mission" }
                  : view.origin === "cases"
                    ? { name: "list" }
                    : { name: "destination", destination: view.origin },
              )
            }
            onCreateEvidence={handleCreateEvidence}
            onCreateTimeline={handleCreateTimeline}
            onEvidenceNextPage={() => {
              if (!detailCase || !evidenceResponse) {
                return;
              }

              void loadEvidenceRecords(
                detailCase.id,
                evidenceResponse.pagination.offset +
                  evidenceResponse.pagination.limit,
              );
            }}
            onEvidencePreviousPage={() => {
              if (!detailCase || !evidenceResponse) {
                return;
              }

              void loadEvidenceRecords(
                detailCase.id,
                Math.max(
                  0,
                  evidenceResponse.pagination.offset -
                    evidenceResponse.pagination.limit,
                ),
              );
            }}
            onEvidenceRetry={() => {
              if (detailCase) {
                void loadEvidenceRecords(
                  detailCase.id,
                  evidenceResponse?.pagination.offset ?? 0,
                );
              }
            }}
            onGenerateAiReview={handleGenerateAiReview}
            onLinkEvidence={handleLinkEvidence}
            onMetadataUpdate={handleMetadataUpdate}
            onReloadEvidence={handleReloadEvidence}
            onReloadLatest={reloadLatestCase}
            onReloadTimeline={handleReloadTimeline}
            onRetry={() =>
              void loadCaseDetail(
                view.caseId,
                view.initialSection,
                view.origin,
              )
            }
            onSelectEvidence={(evidence) => {
              setSelectedEvidenceId(evidence.id);
              setHighlightedEvidenceId(null);
            }}
            onSelectTimeline={(timeline) => setSelectedTimelineId(timeline.id)}
            onStatusUpdate={handleStatusUpdate}
            onTimelineNextPage={() => {
              if (!detailCase || !timelineResponse) {
                return;
              }

              void loadTimelineRecords(
                detailCase.id,
                timelineResponse.pagination.offset +
                  timelineResponse.pagination.limit,
              );
            }}
            onTimelinePreviousPage={() => {
              if (!detailCase || !timelineResponse) {
                return;
              }

              void loadTimelineRecords(
                detailCase.id,
                Math.max(
                  0,
                  timelineResponse.pagination.offset -
                    timelineResponse.pagination.limit,
                ),
              );
            }}
            onTimelineRetry={() => {
              if (detailCase) {
                void loadTimelineRecords(
                  detailCase.id,
                  timelineResponse?.pagination.offset ?? 0,
                );
              }
            }}
            onUnlinkEvidence={handleUnlinkEvidence}
            onUpdateEvidence={handleUpdateEvidence}
            onUpdateTimeline={handleUpdateTimeline}
          />
        )}
      </div>
    </MobileShell>
  );
}

interface AppProps {
  caseClient?: CaseClient;
  initialAuthState?: AuthState;
}

export function App({
  caseClient = defaultCaseClient,
  initialAuthState = { status: "checking-config" },
}: AppProps) {
  const [authState, setAuthState] = useState<AuthState>({
    ...initialAuthState,
  });
  const [allowSignup, setAllowSignup] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let loadedAllowSignup = false;

    async function initialize() {
      try {
        const capabilities = await loadCapabilities();
        loadedAllowSignup = capabilities.signup_enabled;

        if (!active) {
          return;
        }

        if (!capabilities.enabled) {
          setAuthState({ status: "disabled" });
          return;
        }

        setAllowSignup(capabilities.signup_enabled);
        setAuthState({
          status: "checking-session",
          allowSignup: capabilities.signup_enabled,
        });

        const user = await loadSession();

        if (!active) {
          return;
        }

        setAuthState(
          user
            ? { status: "signed-in", user }
            : {
                status: "signed-out",
                allowSignup: capabilities.signup_enabled,
              },
        );
      } catch (loadError) {
        if (active) {
          if (
            loadError instanceof CaseApiError &&
            loadError.kind === "unauthorized"
          ) {
            setAuthState({
              status: "session-expired",
              allowSignup: loadedAllowSignup,
            });
            setMode("sign-in");
          } else {
            setError(getErrorMessage(loadError));
            setAuthState({ status: "signed-out", allowSignup: false });
          }
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "");

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        throw result.error;
      }

      const user = await loadSession();

      if (!user) {
        throw new Error("A session could not be established.");
      }

      setAuthState({ status: "signed-in", user });
    } catch (submitError) {
      if (
        submitError instanceof CaseApiError &&
        submitError.kind === "unauthorized"
      ) {
        handleSessionExpired();
      } else {
        setError(getErrorMessage(submitError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (
      authState.status !== "signed-in" &&
      authState.status !== "signing-out"
    ) {
      return;
    }

    const user = authState.user;

    setError("");
    setAuthState({ status: "signing-out", user });
    setSubmitting(true);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        throw result.error;
      }

      setAuthState({
        status: "signed-out",
        allowSignup,
      });
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
      setAuthState({ status: "signed-in", user });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSessionExpired() {
    setError("");
    setAuthState({
      status: "session-expired",
      allowSignup,
    });
    setMode("sign-in");
  }

  const authIsSignedOut =
    authState.status === "signed-out" ||
    authState.status === "session-expired";
  const signedOutAllowsSignup =
    authIsSignedOut && "allowSignup" in authState
      ? authState.allowSignup
      : false;

  return (
    <main
      className={
        authState.status === "signed-in" || authState.status === "signing-out"
          ? "app-main workspace"
          : "app-main"
      }
    >
      {(authState.status === "checking-config" ||
        authState.status === "checking-session") && (
        <section className="auth-card" aria-labelledby="loading-title">
          <p className="eyebrow">PermitPulse</p>
          <h1 id="loading-title">Case Workspace</h1>
          <p role="status">
            {authState.status === "checking-config"
              ? "Checking authentication configuration..."
              : "Checking your session..."}
          </p>
        </section>
      )}

      {authState.status === "disabled" && (
        <section className="auth-card" aria-labelledby="auth-disabled-title">
          <p className="eyebrow">PermitPulse</p>
          <h1>Case Workspace</h1>
          <h2 id="auth-disabled-title">Authentication unavailable</h2>
          <p>Authentication is not enabled in this environment.</p>
        </section>
      )}

      {authIsSignedOut && (
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">PermitPulse</p>
          <h1>Case Workspace</h1>
          <h2 id="auth-title">
            {mode === "sign-up" ? "Create a local account" : "Sign in"}
          </h2>
          <p>
            Access is limited to authenticated PermitPulse workspace users.
          </p>

          {authState.status === "session-expired" && (
            <p className="error" role="alert">
              Your session expired. Sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <label>
                Name
                <input
                  autoComplete="name"
                  name="name"
                  required
                  type="text"
                />
              </label>
            )}
            <label>
              Email
              <input
                autoComplete="email"
                name="email"
                required
                type="email"
              />
            </label>
            <label>
              Password
              <input
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <button disabled={submitting} type="submit">
              {submitting
                ? "Working..."
                : mode === "sign-up"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          {signedOutAllowsSignup && (
            <button
              className="link-button"
              disabled={submitting}
              onClick={() => {
                setError("");
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              }}
              type="button"
            >
              {mode === "sign-in"
                ? "Create a local development account"
                : "Use an existing account"}
            </button>
          )}
        </section>
      )}

      {(authState.status === "signed-in" ||
        authState.status === "signing-out") && (
        <Workspace
          client={caseClient}
          onSessionExpired={handleSessionExpired}
          onSignOut={() => void handleSignOut()}
          signingOut={authState.status === "signing-out"}
          user={authState.user}
        />
      )}

      {error && (
        <p className="error global-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
