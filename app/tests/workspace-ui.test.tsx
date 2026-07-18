import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaseApiError,
  createCase,
  generateAiReviewDraft,
  getCase,
  listCaseActivity,
  listCases,
  updateCaseMetadata,
  updateCaseStatus,
} from "../src/client/api/cases";
import { App, type AuthState } from "../src/client/App";
import { CaseActivity } from "../src/client/components/CaseActivity";
import {
  CaseDetail,
  ConflictNotice,
  RecordConflictNotice,
} from "../src/client/components/CaseDetail";
import { CaseList } from "../src/client/components/CaseList";
import { CreateCaseForm } from "../src/client/components/CreateCaseForm";
import { EditCaseForm } from "../src/client/components/EditCaseForm";
import { EvidenceDetail } from "../src/client/components/EvidenceDetail";
import { EvidenceForm } from "../src/client/components/EvidenceForm";
import { EvidenceLinkManager } from "../src/client/components/EvidenceLinkManager";
import { EvidenceList } from "../src/client/components/EvidenceList";
import { packetNeedsRegeneration } from "../src/client/components/DeliveryLifecyclePanel";
import {
  copyPacketText,
  PacketPreview,
} from "../src/client/components/PacketPreview";
import {
  AIReviewPanel,
  compileAiReviewText,
  copyAiReviewText,
  safeAiReviewError,
} from "../src/client/components/AIReviewPanel";
import {
  StatusManagement,
  validNextStatuses,
} from "../src/client/components/StatusManagement";
import { TimelineForm } from "../src/client/components/TimelineForm";
import { TimelineList } from "../src/client/components/TimelineList";
import {
  createEvidence,
  createTimelineEntry,
  linkTimelineEvidence,
  listEvidence,
  listTimelineEntries,
  updateEvidence,
  updateTimelineEntry,
  unlinkTimelineEvidence,
} from "../src/client/api/evidence-timeline";
import type { CaseDto, CreateCaseInput } from "../src/client/types/cases";
import type {
  EvidenceItemDto,
  TimelineEntryDto,
} from "../src/client/types/evidence-timeline";
import type { PacketReviewDraftResponseData } from "../src/shared/ai-review/types";
import { evaluateMissionIntelligence } from "../src/shared/mission-intelligence/evaluate";

const safeCase: CaseDto = {
  id: "00000000-0000-4000-8000-000000000001",
  project_name: "Fictional Oak Street ADU",
  client_name: "Fictional Client",
  address: "42 Oak Street",
  city: "Exampleville",
  jurisdiction: "Exampleville Building",
  permit_number: "EX-2026-001",
  current_status: "intake",
  version: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const signedInState: AuthState = {
  status: "signed-in",
  user: {
    id: "fictional-user",
    email: "avery@example.test",
    name: "Avery Example",
    role: "client",
  },
};

const safeEvidence: EvidenceItemDto = {
  id: "00000000-0000-4000-8000-000000000101",
  evidence_type: "document",
  title: "Fictional plan check notice",
  summary: "Fictional notice from the permit portal.",
  source_url: "https://example.test/notices/plan-check",
  source_label: "Example portal",
  source_date: "2026-01-15",
  verification_status: "unverified",
  contributor: { id: "fictional-user", name: "Avery Example" },
  version: 1,
  created_at: "2026-01-15T00:00:00.000Z",
  updated_at: "2026-01-16T00:00:00.000Z",
};

const safeTimeline: TimelineEntryDto = {
  id: "00000000-0000-4000-8000-000000000201",
  occurred_on: "2026-01-20",
  timeline_type: "submission",
  title: "Fictional application submitted",
  details: "The fictional application was submitted for review.",
  is_canonical: false,
  contributor: { id: "fictional-user", name: "Avery Example" },
  evidence_ids: [safeEvidence.id],
  version: 1,
  created_at: "2026-01-20T00:00:00.000Z",
  updated_at: "2026-01-21T00:00:00.000Z",
};

const safeAiReview: PacketReviewDraftResponseData = {
  review: {
    summary: "The packet case is in Intake.",
    missing_information: ["Permit number is not provided."],
    recommended_next_actions: ["Review missing fields before relying on the packet."],
    evidence_citations: [
      {
        source_type: "evidence",
        record_id: safeEvidence.id,
        note: "This evidence record is included in the packet.",
      },
    ],
    unsupported_claims: ["A fictional unsupported claim for human review."],
    confidence_notes: ["Treat unverified evidence as needing human review."],
    model_metadata: {
      reviewer: "deterministic-baseline",
      generated_at: "2026-07-09T12:00:00.000Z",
      local_only: true,
      version: "2026-07-09",
    },
  },
  evaluation: {
    score: 96,
    passed: true,
    warnings: [],
    citation_validity: {
      score: 100,
      passed: true,
      invalid_citations: [],
    },
    safety: {
      passed: true,
      warnings: [],
    },
  },
  metadata: {
    provider: "deterministic-baseline",
    reviewer: "deterministic-baseline",
    live_ai: false,
    external_calls: false,
    evaluation_passed: true,
    safety_blocked: false,
    warnings_count: 0,
  },
};

const defaultDetailProps = {
  activityError: "",
  activityLoading: false,
  activityResponse: {
    activity: [],
    pagination: { limit: 10, offset: 0 },
    order: "created_at_desc" as const,
  },
  currentUserId: "fictional-user",
  error: "",
  evidenceError: "",
  evidenceLoading: false,
  evidenceResponse: {
    evidence: [safeEvidence],
    pagination: { limit: 10, offset: 0 },
    order: "source_date_desc_created_at_desc_id_desc" as const,
  },
  highlightedEvidenceId: null,
  intelligence: evaluateMissionIntelligence({
    case: {
      id: safeCase.id,
      permitNumber: safeCase.permit_number,
      currentStatus: safeCase.current_status,
      updatedAt: safeCase.updated_at,
    },
    evidence: {
      total: 1,
      verified: 0,
      unverified: 1,
      disputed: 0,
      sourceComplete: 1,
      deliveryReady: 0,
      records: [],
    },
    timeline: {
      total: 1,
      linked: 1,
      canonicalApprovalLinkedToVerifiedEvidence: false,
      records: [],
    },
    evaluatedAt: "2026-07-09T12:00:00.000Z",
  }),
  intelligenceError: "",
  intelligenceLoading: false,
  loading: false,
  role: "client" as const,
  selectedEvidenceId: safeEvidence.id,
  selectedTimelineId: safeTimeline.id,
  timelineError: "",
  timelineLoading: false,
  timelineResponse: {
    timeline: [safeTimeline],
    pagination: { limit: 10, offset: 0 },
    order: "occurred_on_desc_created_at_desc_id_desc" as const,
  },
  onActivityNextPage: () => undefined,
  onActivityPreviousPage: () => undefined,
  onActivityRetry: () => undefined,
  onBack: () => undefined,
  onCreateEvidence: async () => safeEvidence,
  onCreateTimeline: async () => safeTimeline,
  onEvidenceNextPage: () => undefined,
  onEvidencePreviousPage: () => undefined,
  onEvidenceRetry: () => undefined,
  onGenerateAiReview: async () => safeAiReview,
  onLinkEvidence: async () => safeTimeline,
  onMetadataUpdate: async () => undefined,
  onReloadEvidence: async () => safeEvidence,
  onReloadLatest: async () => undefined,
  onReloadTimeline: async () => safeTimeline,
  onRetry: () => undefined,
  onSelectEvidence: () => undefined,
  onSelectTimeline: () => undefined,
  onStatusUpdate: async () => undefined,
  onTimelineNextPage: () => undefined,
  onTimelinePreviousPage: () => undefined,
  onTimelineRetry: () => undefined,
  onUnlinkEvidence: async () => safeTimeline,
  onUpdateEvidence: async () => safeEvidence,
  onUpdateTimeline: async () => safeTimeline,
};

function okJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorJson(
  status: number,
  code: string,
  message: string,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message },
      request_id: "fictional-request",
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace authentication UI states", () => {
  it("keeps the signed-out form available", () => {
    const markup = renderToStaticMarkup(
      <App initialAuthState={{ status: "signed-out", allowSignup: true }} />,
    );

    expect(markup).toContain("Sign in");
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain("Create a local development account");
  });

  it("keeps preview signup hidden when signup is disabled", () => {
    const markup = renderToStaticMarkup(
      <App initialAuthState={{ status: "signed-out", allowSignup: false }} />,
    );

    expect(markup).toContain("Sign in");
    expect(markup).not.toContain("Create a local development account");
  });

  it("renders the workspace after authentication succeeds", () => {
    const markup = renderToStaticMarkup(
      <App initialAuthState={signedInState} />,
    );

    expect(markup).toContain("Case Workspace");
    expect(markup).toContain("Signed in as");
    expect(markup).toContain("Loading missions");
  });

  it("shows a safe sign-out progress state", () => {
    const markup = renderToStaticMarkup(
      <App
        initialAuthState={{
          status: "signing-out",
          user:
            signedInState.status === "signed-in"
              ? signedInState.user
              : {
                  id: "fictional-user",
                  email: "avery@example.test",
                  role: "client",
                },
        }}
      />,
    );

    expect(markup).toContain("Mission Control");
    expect(markup).toContain("Signed in as");
    expect(markup).not.toContain("Sign in");
  });

  it("returns expired sessions to the sign-in state", () => {
    const markup = renderToStaticMarkup(
      <App initialAuthState={{ status: "session-expired", allowSignup: false }} />,
    );

    expect(markup).toContain("Your session expired. Sign in again.");
    expect(markup).toContain("Sign in");
    expect(markup).not.toContain("Case list");
  });
});

describe("case API client", () => {
  it("requests the default case list without an unbounded query", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        okJson({
          cases: [safeCase],
          pagination: { limit: 20, offset: 0 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCases()).resolves.toEqual({
      cases: [safeCase],
      pagination: { limit: 20, offset: 0 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/cases",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("submits only permitted create fields", async () => {
    let submittedBody = "";
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      submittedBody = String(init?.body ?? "");
      return Promise.resolve(okJson(safeCase, 201));
    });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      project_name: "Fictional Oak Street ADU",
      client_name: "Fictional Client",
      address: "42 Oak Street",
      city: "Exampleville",
      jurisdiction: "Exampleville Building",
      permit_number: null,
      current_status: "intake",
      owner_user_id: "not-allowed",
      user_id: "not-allowed",
      participant_role: "owner",
      role: "admin",
      created_by: "not-allowed",
    } as CreateCaseInput & Record<string, unknown>;

    await createCase(input);

    expect(JSON.parse(submittedBody)).toEqual({
      project_name: "Fictional Oak Street ADU",
      client_name: "Fictional Client",
      address: "42 Oak Street",
      city: "Exampleville",
      jurisdiction: "Exampleville Building",
      permit_number: null,
      current_status: "intake",
    });
    expect(submittedBody).not.toContain("owner_user_id");
    expect(submittedBody).not.toContain("participant_role");
    expect(submittedBody).not.toContain("created_by");
  });

  it("distinguishes server validation and unauthorized responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorJson(400, "INVALID_REQUEST", "The case data is invalid."),
        )
        .mockResolvedValueOnce(
          errorJson(401, "UNAUTHENTICATED", "Authentication is required."),
        ),
    );

    await expect(createCase(safeCase)).rejects.toMatchObject({
      kind: "validation",
      status: 400,
      code: "INVALID_REQUEST",
    });
    await expect(listCases()).rejects.toMatchObject({
      kind: "unauthorized",
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("distinguishes missing case detail responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(errorJson(404, "CASE_NOT_FOUND", "The case was not found.")),
      ),
    );

    await expect(getCase(safeCase.id)).rejects.toBeInstanceOf(CaseApiError);
    await expect(getCase(safeCase.id)).rejects.toMatchObject({
      kind: "not-found",
      status: 404,
    });
  });

  it("submits only permitted metadata update fields with expected_version", async () => {
    let submittedBody = "";
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      submittedBody = String(init?.body ?? "");
      return Promise.resolve(okJson({ ...safeCase, version: 2 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateCaseMetadata(safeCase.id, {
      expected_version: 1,
      project_name: "Fictional Updated ADU",
      permit_number: null,
      current_status: "researching",
      owner_user_id: "not-allowed",
    } as Parameters<typeof updateCaseMetadata>[1] & Record<string, unknown>);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/cases/${safeCase.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.parse(submittedBody)).toEqual({
      expected_version: 1,
      project_name: "Fictional Updated ADU",
      permit_number: null,
    });
    expect(submittedBody).not.toContain("current_status");
    expect(submittedBody).not.toContain("owner_user_id");
  });

  it("submits status transitions with expected_version and current_status only", async () => {
    let submittedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBody = String(init?.body ?? "");
        return Promise.resolve(okJson({ ...safeCase, current_status: "researching" }));
      }),
    );

    await updateCaseStatus(safeCase.id, {
      expected_version: 1,
      current_status: "researching",
      role: "admin",
    } as Parameters<typeof updateCaseStatus>[1] & Record<string, unknown>);

    expect(JSON.parse(submittedBody)).toEqual({
      expected_version: 1,
      current_status: "researching",
    });
    expect(submittedBody).not.toContain("role");
  });

  it("requests activity with bounded pagination", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        okJson({
          activity: [],
          pagination: { limit: 50, offset: 10000 },
          order: "created_at_desc",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listCaseActivity(safeCase.id, { limit: 500, offset: 99999 });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/cases/${safeCase.id}/activity?limit=50&offset=10000`,
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("maps conflict and forbidden responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorJson(409, "STALE_VERSION", "The case version is stale."),
        )
        .mockResolvedValueOnce(
          errorJson(403, "FORBIDDEN", "The request is not allowed."),
        ),
    );

    await expect(
      updateCaseMetadata(safeCase.id, {
        expected_version: 1,
        project_name: "Fictional Updated ADU",
      }),
    ).rejects.toMatchObject({
      kind: "conflict",
      status: 409,
      code: "STALE_VERSION",
    });
    await expect(
      updateCaseStatus(safeCase.id, {
        expected_version: 1,
        current_status: "researching",
      }),
    ).rejects.toMatchObject({
      kind: "forbidden",
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("posts a valid empty JSON object for UI review generation and validates the response", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okJson(safeAiReview)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateAiReviewDraft(safeCase.id)).resolves.toEqual(
      safeAiReview,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/cases/${safeCase.id}/ai-review/draft`,
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({
          accept: "application/json",
          "content-type": "application/json",
        }),
        body: "{}",
      }),
    );
  });

  it("rejects malformed AI review responses without exposing response data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(okJson({ ...safeAiReview, token: "hidden" }))),
    );

    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({
      kind: "server",
      code: "INVALID_RESPONSE",
      message: "The case request could not be completed. Try again.",
    });
  });

  it("maps AI review authorization, validation, server, and network failures safely", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorJson(401, "UNAUTHENTICATED", "Authentication is required."),
        )
        .mockResolvedValueOnce(
          errorJson(403, "FORBIDDEN", "The request is not allowed."),
        )
        .mockResolvedValueOnce(
          errorJson(404, "CASE_NOT_FOUND", "The case was not found."),
        )
        .mockResolvedValueOnce(
          errorJson(400, "INVALID_CASE_ID", "The case ID is invalid."),
        )
        .mockResolvedValueOnce(
          errorJson(500, "INTERNAL_ERROR", "private server detail"),
        )
        .mockRejectedValueOnce(new Error("private network detail")),
    );

    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({ kind: "forbidden" });
    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({ kind: "not-found" });
    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({ kind: "validation" });
    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({
      kind: "server",
      message: "The case request could not be completed. Try again.",
    });
    await expect(generateAiReviewDraft(safeCase.id)).rejects.toMatchObject({
      kind: "network",
      message: "The network request could not be completed.",
    });
  });
});

describe("evidence and timeline API client", () => {
  it("creates evidence with permitted fields only", async () => {
    let submittedBody = "";
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      submittedBody = String(init?.body ?? "");
      return Promise.resolve(okJson(safeEvidence, 201));
    });
    vi.stubGlobal("fetch", fetchMock);

    await createEvidence(safeCase.id, {
      evidence_type: "document",
      title: "Fictional notice",
      summary: "Fictional summary",
      source_url: "https://example.test/notice",
      source_label: "Example",
      source_date: "2026-01-15",
      verification_status: "verified",
      version: 99,
      user_id: "not-allowed",
    } as Parameters<typeof createEvidence>[1] & Record<string, unknown>);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/cases/${safeCase.id}/evidence`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(submittedBody)).toEqual({
      evidence_type: "document",
      title: "Fictional notice",
      summary: "Fictional summary",
      source_url: "https://example.test/notice",
      source_label: "Example",
      source_date: "2026-01-15",
    });
    expect(submittedBody).not.toContain("verification_status");
    expect(submittedBody).not.toContain("user_id");
  });

  it("patches evidence with expected_version and changed permitted fields only", async () => {
    let submittedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBody = String(init?.body ?? "");
        return Promise.resolve(okJson({ ...safeEvidence, version: 2 }));
      }),
    );

    await updateEvidence(safeCase.id, safeEvidence.id, {
      expected_version: 1,
      title: "Updated evidence",
      source_url: null,
      owner_user_id: "not-allowed",
    } as Parameters<typeof updateEvidence>[2] & Record<string, unknown>);

    expect(JSON.parse(submittedBody)).toEqual({
      expected_version: 1,
      title: "Updated evidence",
      source_url: null,
    });
    expect(submittedBody).not.toContain("owner_user_id");
  });

  it("omits unchanged evidence sources and sends explicit null source clears", async () => {
    const submittedBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBodies.push(String(init?.body ?? ""));
        return Promise.resolve(okJson({ ...safeEvidence, version: 2 }));
      }),
    );

    await updateEvidence(safeCase.id, safeEvidence.id, {
      expected_version: 1,
      summary: "Updated summary only",
    });
    await updateEvidence(safeCase.id, safeEvidence.id, {
      expected_version: 2,
      source_url: null,
      source_label: null,
      source_date: null,
    });

    expect(JSON.parse(submittedBodies[0])).toEqual({
      expected_version: 1,
      summary: "Updated summary only",
    });
    expect(submittedBodies[0]).not.toContain("source_url");
    expect(submittedBodies[0]).not.toContain("source_label");
    expect(submittedBodies[0]).not.toContain("source_date");
    expect(JSON.parse(submittedBodies[1])).toEqual({
      expected_version: 2,
      source_url: null,
      source_label: null,
      source_date: null,
    });
  });

  it("types admin evidence verification updates", async () => {
    let submittedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBody = String(init?.body ?? "");
        return Promise.resolve(
          okJson({ ...safeEvidence, verification_status: "verified", version: 2 }),
        );
      }),
    );

    await updateEvidence(safeCase.id, safeEvidence.id, {
      expected_version: 1,
      verification_status: "verified",
    });

    expect(JSON.parse(submittedBody)).toEqual({
      expected_version: 1,
      verification_status: "verified",
    });
  });

  it("creates timeline entries with permitted unique evidence IDs", async () => {
    let submittedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBody = String(init?.body ?? "");
        return Promise.resolve(okJson(safeTimeline, 201));
      }),
    );

    await createTimelineEntry(safeCase.id, {
      occurred_on: "2026-01-20",
      timeline_type: "submission",
      title: "Fictional submitted",
      details: "Fictional details",
      is_canonical: true,
      evidence_ids: [safeEvidence.id, safeEvidence.id],
      case_id: "not-allowed",
    } as Parameters<typeof createTimelineEntry>[1] & Record<string, unknown>);

    expect(JSON.parse(submittedBody)).toEqual({
      occurred_on: "2026-01-20",
      timeline_type: "submission",
      title: "Fictional submitted",
      details: "Fictional details",
      is_canonical: true,
      evidence_ids: [safeEvidence.id],
    });
    expect(submittedBody).not.toContain("case_id");
  });

  it("patches timeline entries without evidence links", async () => {
    let submittedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        submittedBody = String(init?.body ?? "");
        return Promise.resolve(okJson({ ...safeTimeline, version: 2 }));
      }),
    );

    await updateTimelineEntry(safeCase.id, safeTimeline.id, {
      expected_version: 1,
      title: "Updated timeline",
      evidence_ids: [safeEvidence.id],
    } as Parameters<typeof updateTimelineEntry>[2] & Record<string, unknown>);

    expect(JSON.parse(submittedBody)).toEqual({
      expected_version: 1,
      title: "Updated timeline",
    });
    expect(submittedBody).not.toContain("evidence_ids");
  });

  it("uses dedicated link and unlink paths", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okJson(safeTimeline)));
    vi.stubGlobal("fetch", fetchMock);

    await linkTimelineEvidence(safeCase.id, safeTimeline.id, safeEvidence.id);
    await unlinkTimelineEvidence(safeCase.id, safeTimeline.id, safeEvidence.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/v1/cases/${safeCase.id}/timeline/${safeTimeline.id}/evidence`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ evidence_id: safeEvidence.id }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/v1/cases/${safeCase.id}/timeline/${safeTimeline.id}/evidence/${safeEvidence.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("maps evidence/timeline conflict and forbidden responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          errorJson(409, "STALE_VERSION", "The record version is stale."),
        )
        .mockResolvedValueOnce(
          errorJson(403, "FORBIDDEN", "The request is not allowed."),
        ),
    );

    await expect(
      updateEvidence(safeCase.id, safeEvidence.id, {
        expected_version: 1,
        title: "Updated",
      }),
    ).rejects.toMatchObject({ kind: "conflict", code: "STALE_VERSION" });
    await expect(
      updateTimelineEntry(safeCase.id, safeTimeline.id, {
        expected_version: 1,
        title: "Updated",
      }),
    ).rejects.toMatchObject({ kind: "forbidden", code: "FORBIDDEN" });
  });

  it("bounds evidence and timeline pagination requests", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        okJson({
          evidence: [],
          timeline: [],
          pagination: { limit: 50, offset: 10000 },
          order: "source_date_desc_created_at_desc_id_desc",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listEvidence(safeCase.id, { limit: 500, offset: 99999 });
    await listTimelineEntries(safeCase.id, { limit: 500, offset: 99999 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/v1/cases/${safeCase.id}/evidence?limit=50&offset=10000`,
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/v1/cases/${safeCase.id}/timeline?limit=50&offset=10000`,
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});

describe("case workspace components", () => {
  it("renders list loading and empty states", () => {
    const loadingMarkup = renderToStaticMarkup(
      <CaseList
        cases={[]}
        error=""
        loading={true}
        pagination={null}
        onCreate={() => undefined}
        onNextPage={() => undefined}
        onOpenCase={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <CaseList
        cases={[]}
        error=""
        loading={false}
        pagination={{ limit: 20, offset: 0 }}
        onCreate={() => undefined}
        onNextPage={() => undefined}
        onOpenCase={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(loadingMarkup).toContain("Loading cases");
    expect(emptyMarkup).toContain("No cases yet");
  });

  it("renders returned cases and safe optional permit numbers", () => {
    const markup = renderToStaticMarkup(
      <CaseList
        cases={[safeCase, { ...safeCase, id: "two", permit_number: null }]}
        error=""
        loading={false}
        pagination={{ limit: 20, offset: 0 }}
        onCreate={() => undefined}
        onNextPage={() => undefined}
        onOpenCase={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain("Fictional Oak Street ADU");
    expect(markup).toContain("EX-2026-001");
    expect(markup).toContain("Not provided");
    expect(markup).toContain("Open details");
  });

  it("renders list load errors with a retry control", () => {
    const markup = renderToStaticMarkup(
      <CaseList
        cases={[]}
        error="The case request could not be completed. Try again."
        loading={false}
        pagination={null}
        onCreate={() => undefined}
        onNextPage={() => undefined}
        onOpenCase={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain("Cases could not be loaded");
    expect(markup).toContain("Retry");
  });

  it("renders the create form with required fields and allowed statuses", () => {
    const markup = renderToStaticMarkup(
      <CreateCaseForm
        error=""
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    for (const field of [
      "project_name",
      "client_name",
      "address",
      "city",
      "jurisdiction",
      "permit_number",
      "current_status",
    ]) {
      expect(markup).toContain(`name="${field}"`);
    }

    expect(markup).toContain("Needs information");
    expect(markup).toContain("Ready for review");
  });

  it("shows disabled duplicate-submission controls and server validation errors", () => {
    const markup = renderToStaticMarkup(
      <CreateCaseForm
        error="The case data is invalid."
        submitting={true}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(markup).toContain("Creating...");
    expect(markup).toContain("disabled");
    expect(markup).toContain("The case data is invalid.");
  });

  it("renders safe case detail, 404 state, and back action", () => {
    const detailMarkup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
      />,
    );
    const notFoundMarkup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={null}
        error="The case was not found or is no longer available."
      />,
    );

    expect(detailMarkup).toContain("Fictional Oak Street ADU");
    expect(detailMarkup).toContain("Case overview");
    expect(detailMarkup).toContain("Edit details");
    expect(detailMarkup).toContain("Timeline");
    expect(detailMarkup).toContain("Evidence");
    expect(detailMarkup).toContain("Case Cockpit");
    expect(detailMarkup).toContain("Case brief");
    expect(detailMarkup).toContain("Investigation health");
    expect(detailMarkup).toContain("Findings");
    expect(detailMarkup).toContain("Packet");
    expect(detailMarkup).toContain('aria-selected="true"');
    expect(detailMarkup).toContain('tabindex="0"');
    expect(detailMarkup).not.toContain("participant");
    expect(notFoundMarkup).toContain("Case unavailable");
    expect(notFoundMarkup).toContain("Back to list");
  });

  it("does not render workspace-sensitive internals", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
      />,
    ).toLowerCase();

    expect(markup).not.toContain("session");
    expect(markup).not.toContain("token");
    expect(markup).not.toContain("authorization");
    expect(markup).not.toContain("account");
    expect(markup).not.toContain("user_id");
  });

  it("renders the edit form prepopulated with safe editable fields", () => {
    const markup = renderToStaticMarkup(
      <EditCaseForm
        caseRecord={safeCase}
        error=""
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(markup).toContain('name="project_name"');
    expect(markup).toContain('value="Fictional Oak Street ADU"');
    expect(markup).toContain('name="permit_number"');
    expect(markup).not.toContain("current_status");
    expect(markup).not.toContain("owner_user_id");
  });

  it("shows duplicate edit submission and server validation states", () => {
    const markup = renderToStaticMarkup(
      <EditCaseForm
        caseRecord={safeCase}
        error="The case update is invalid."
        submitting={true}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(markup).toContain("Saving...");
    expect(markup).toContain("disabled");
    expect(markup).toContain("The case update is invalid.");
  });

  it("renders admin status controls with only valid transitions", () => {
    const markup = renderToStaticMarkup(
      <StatusManagement
        caseRecord={safeCase}
        error=""
        submitting={false}
        onSubmit={async () => undefined}
      />,
    );

    expect(validNextStatuses("intake")).toEqual([
      "researching",
      "needs_information",
    ]);
    expect(markup).toContain("Researching");
    expect(markup).toContain("Needs information");
    expect(markup).not.toContain("Ready for review");
  });

  it("does not render status controls for clients", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        role="client"
      />,
    );

    expect(markup).not.toContain("Administrator status controls");
  });

  it("renders status controls for admins", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        role="admin"
      />,
    );

    expect(markup).toContain("Administrator status controls");
  });

  it("renders the shared stale-version conflict actions", () => {
    const markup = renderToStaticMarkup(
      <ConflictNotice
        onCancel={() => undefined}
        onReload={async () => undefined}
      />,
    );

    expect(markup).toContain(
      "Someone or another request updated this case. Reload the latest version before trying again.",
    );
    expect(markup).toContain("Reload latest case");
    expect(markup).toContain("Cancel");
  });

  it("renders the shared record stale-version conflict actions", () => {
    const markup = renderToStaticMarkup(
      <RecordConflictNotice
        onCancel={() => undefined}
        onReload={async () => undefined}
      />,
    );

    expect(markup).toContain(
      "Someone or another request updated this record. Reload the latest version before trying again.",
    );
    expect(markup).toContain("Reload latest");
    expect(markup).toContain("Cancel");
  });

  it("renders evidence loading, empty, returned records, safe links, and retry states", () => {
    const loadingMarkup = renderToStaticMarkup(
      <EvidenceList
        error=""
        highlightedEvidenceId={null}
        loading={true}
        response={null}
        selectedEvidenceId={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectEvidence={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <EvidenceList
        error=""
        highlightedEvidenceId={null}
        loading={false}
        response={{
          evidence: [],
          pagination: { limit: 10, offset: 0 },
          order: "source_date_desc_created_at_desc_id_desc",
        }}
        selectedEvidenceId={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectEvidence={() => undefined}
      />,
    );
    const recordMarkup = renderToStaticMarkup(
      <EvidenceList
        error=""
        highlightedEvidenceId={safeEvidence.id}
        loading={false}
        response={{
          evidence: [safeEvidence],
          pagination: { limit: 1, offset: 1 },
          order: "source_date_desc_created_at_desc_id_desc",
        }}
        selectedEvidenceId={safeEvidence.id}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectEvidence={() => undefined}
      />,
    );
    const invalidUrlMarkup = renderToStaticMarkup(
      <EvidenceList
        error=""
        highlightedEvidenceId={null}
        loading={false}
        response={{
          evidence: [
            {
              ...safeEvidence,
              id: "bad-url",
              source_url: "javascript:alert(1)",
              source_label: "Unsafe source",
            },
          ],
          pagination: { limit: 10, offset: 0 },
          order: "source_date_desc_created_at_desc_id_desc",
        }}
        selectedEvidenceId={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectEvidence={() => undefined}
      />,
    ).toLowerCase();
    const errorMarkup = renderToStaticMarkup(
      <EvidenceList
        error="The evidence request failed."
        highlightedEvidenceId={null}
        loading={false}
        response={null}
        selectedEvidenceId={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectEvidence={() => undefined}
      />,
    );

    expect(loadingMarkup).toContain("Loading evidence");
    expect(emptyMarkup).toContain("No evidence yet");
    expect(emptyMarkup).toContain("tracks source records, provenance, dates");
    expect(recordMarkup).toContain("Fictional plan check notice");
    expect(recordMarkup).toContain("Unverified");
    expect(recordMarkup).toContain('href="https://example.test/notices/plan-check"');
    expect(recordMarkup).toContain("Previous");
    expect(invalidUrlMarkup).toContain("unsafe source");
    expect(invalidUrlMarkup).not.toContain("href=");
    expect(errorMarkup).toContain("Evidence unavailable");
    expect(errorMarkup).toContain("Retry");
  });

  it("renders evidence forms and role-aware verification controls", () => {
    const createMarkup = renderToStaticMarkup(
      <EvidenceForm
        currentUserId="fictional-user"
        error=""
        mode="create"
        role="client"
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );
    const clientEditMarkup = renderToStaticMarkup(
      <EvidenceForm
        currentUserId="fictional-user"
        error=""
        evidence={safeEvidence}
        mode="edit"
        role="client"
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );
    const adminEditMarkup = renderToStaticMarkup(
      <EvidenceForm
        currentUserId="admin-user"
        error="The evidence update is invalid."
        evidence={{ ...safeEvidence, verification_status: "verified" }}
        mode="edit"
        role="admin"
        submitting={true}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(createMarkup).toContain('name="evidence_type"');
    expect(createMarkup).toContain('name="source_url"');
    expect(createMarkup).not.toContain("verification_status");
    expect(clientEditMarkup).toContain('value="Fictional plan check notice"');
    expect(clientEditMarkup).not.toContain("verification_status");
    expect(adminEditMarkup).toContain('name="verification_status"');
    expect(adminEditMarkup).toContain("Verified");
    expect(adminEditMarkup).toContain("Saving...");
    expect(adminEditMarkup).toContain("The evidence update is invalid.");
  });

  it("renders evidence detail safely without internal fields", () => {
    const markup = renderToStaticMarkup(
      <EvidenceDetail
        currentUserId="fictional-user"
        evidence={{
          ...safeEvidence,
          title: "<script>alert(1)</script>",
          summary: "<img src=x onerror=alert(1)>",
        }}
        role="client"
        onEdit={() => undefined}
      />,
    ).toLowerCase();

    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).toContain("edit evidence");
    expect(markup).not.toContain("password");
    expect(markup).not.toContain("session");
    expect(markup).not.toContain("request_id");
  });

  it("renders timeline loading, empty, canonical, linked evidence, pagination, and retry states", () => {
    const loadingMarkup = renderToStaticMarkup(
      <TimelineList
        currentUserId="fictional-user"
        error=""
        evidence={[safeEvidence]}
        loading={true}
        response={null}
        role="client"
        selectedTimelineId={null}
        onEditTimeline={() => undefined}
        onNextPage={() => undefined}
        onOpenEvidence={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectTimeline={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <TimelineList
        currentUserId="fictional-user"
        error=""
        evidence={[]}
        loading={false}
        response={{
          timeline: [],
          pagination: { limit: 10, offset: 0 },
          order: "occurred_on_desc_created_at_desc_id_desc",
        }}
        role="client"
        selectedTimelineId={null}
        onEditTimeline={() => undefined}
        onNextPage={() => undefined}
        onOpenEvidence={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectTimeline={() => undefined}
      />,
    );
    const timelineMarkup = renderToStaticMarkup(
      <TimelineList
        currentUserId="fictional-user"
        error=""
        evidence={[safeEvidence]}
        loading={false}
        response={{
          timeline: [{ ...safeTimeline, is_canonical: true }],
          pagination: { limit: 1, offset: 1 },
          order: "occurred_on_desc_created_at_desc_id_desc",
        }}
        role="admin"
        selectedTimelineId={safeTimeline.id}
        onEditTimeline={() => undefined}
        onNextPage={() => undefined}
        onOpenEvidence={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectTimeline={() => undefined}
      />,
    );
    const clientCanonicalMarkup = renderToStaticMarkup(
      <TimelineList
        currentUserId="fictional-user"
        error=""
        evidence={[safeEvidence]}
        loading={false}
        response={{
          timeline: [{ ...safeTimeline, is_canonical: true }],
          pagination: { limit: 10, offset: 0 },
          order: "occurred_on_desc_created_at_desc_id_desc",
        }}
        role="client"
        selectedTimelineId={safeTimeline.id}
        onEditTimeline={() => undefined}
        onNextPage={() => undefined}
        onOpenEvidence={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectTimeline={() => undefined}
      />,
    );
    const errorMarkup = renderToStaticMarkup(
      <TimelineList
        currentUserId="fictional-user"
        error="The timeline request failed."
        evidence={[]}
        loading={false}
        response={null}
        role="client"
        selectedTimelineId={null}
        onEditTimeline={() => undefined}
        onNextPage={() => undefined}
        onOpenEvidence={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
        onSelectTimeline={() => undefined}
      />,
    );

    expect(loadingMarkup).toContain("Loading permit timeline");
    expect(emptyMarkup).toContain("No timeline entries yet");
    expect(emptyMarkup).toContain("separate from internal case activity");
    expect(timelineMarkup).toContain("Canonical");
    expect(timelineMarkup).toContain("Fictional plan check notice");
    expect(timelineMarkup).toContain("Edit entry");
    expect(timelineMarkup).toContain("Previous");
    expect(clientCanonicalMarkup).not.toContain("Edit entry");
    expect(errorMarkup).toContain("Permit timeline unavailable");
    expect(errorMarkup).toContain("Retry");
  });

  it("renders timeline forms with admin-only canonical controls and evidence choices", () => {
    const clientCreateMarkup = renderToStaticMarkup(
      <TimelineForm
        currentUserId="fictional-user"
        error=""
        evidence={[safeEvidence, safeEvidence]}
        mode="create"
        role="client"
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );
    const adminCreateMarkup = renderToStaticMarkup(
      <TimelineForm
        currentUserId="admin-user"
        error=""
        evidence={[safeEvidence]}
        mode="create"
        role="admin"
        submitting={false}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );
    const clientCanonicalEditMarkup = renderToStaticMarkup(
      <TimelineForm
        currentUserId="fictional-user"
        error=""
        evidence={[safeEvidence]}
        mode="edit"
        role="client"
        submitting={false}
        timelineEntry={{ ...safeTimeline, is_canonical: true }}
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />,
    );

    expect(clientCreateMarkup).toContain('name="occurred_on"');
    expect(clientCreateMarkup).toContain("Fictional plan check notice");
    expect(clientCreateMarkup).not.toContain("is_canonical");
    expect(adminCreateMarkup).toContain('name="is_canonical"');
    expect(clientCanonicalEditMarkup).toBe("");
  });

  it("renders link controls with already-linked evidence omitted and safe errors", () => {
    const unlinkedEvidence = {
      ...safeEvidence,
      id: "00000000-0000-4000-8000-000000000102",
      title: "Fictional separate evidence",
    };
    const markup = renderToStaticMarkup(
      <EvidenceLinkManager
        currentUserId="fictional-user"
        error="Duplicate evidence link."
        evidence={[safeEvidence, unlinkedEvidence]}
        role="client"
        submitting={false}
        timelineEntry={safeTimeline}
        onLink={async () => undefined}
        onUnlink={async () => undefined}
      />,
    );

    expect(markup).toContain("Fictional plan check notice");
    expect(markup).toContain("Fictional separate evidence");
    expect(markup).toContain("Unlink");
    expect(markup).toContain("Link evidence");
    expect(markup).toContain("Duplicate evidence link.");
    expect(markup).not.toContain(
      `<option value="${safeEvidence.id}">Fictional plan check notice</option>`,
    );
  });

  it("renders activity loading, empty, events, retry, and pagination states safely", () => {
    const loadingMarkup = renderToStaticMarkup(
      <CaseActivity
        error=""
        loading={true}
        response={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <CaseActivity
        error=""
        loading={false}
        response={{
          activity: [],
          pagination: { limit: 10, offset: 0 },
          order: "created_at_desc",
        }}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const eventMarkup = renderToStaticMarkup(
      <CaseActivity
        error=""
        loading={false}
        response={{
          activity: [
            {
              id: "activity-1",
              action: "case_status_changed",
              changed_fields: ["current_status", "actor_user_id"],
              from_status: "intake",
              to_status: "researching",
              actor: { id: "user-1", name: "Avery Example" },
              created_at: "2026-01-03T00:00:00.000Z",
            },
          ],
          pagination: { limit: 1, offset: 1 },
          order: "created_at_desc",
        }}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    ).toLowerCase();
    const errorMarkup = renderToStaticMarkup(
      <CaseActivity
        error="The network request could not be completed."
        loading={false}
        response={null}
        onNextPage={() => undefined}
        onPreviousPage={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(loadingMarkup).toContain("Loading case activity");
    expect(emptyMarkup).toContain("No activity yet");
    expect(eventMarkup).toContain("status changed");
    expect(eventMarkup).toContain("avery example");
    expect(eventMarkup).toContain("intake to researching");
    expect(eventMarkup).toContain("previous");
    expect(eventMarkup).not.toContain("actor_user_id");
    expect(eventMarkup).not.toContain("session");
    expect(eventMarkup).not.toContain("token");
    expect(errorMarkup).toContain("Activity could not be loaded");
    expect(errorMarkup).toContain("Retry");
  });

  it("shows the packet cockpit tab for signed-in case detail users", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        initialSection="packet"
      />,
    );

    expect(markup).toContain("Packet readiness");
    expect(markup).toContain("4 of 5 delivery checks complete");
    expect(markup).toContain("Client packet");
    expect(markup).toContain('role="tab"');
  });

  it("shows evidence health before the existing evidence workflow", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        initialSection="evidence"
      />,
    );

    expect(markup).toContain("Evidence quality");
    expect(markup).toContain("Source readiness");
    expect(markup).toContain("Complete evidence review");
    expect(markup).toContain("Open conditions");
    expect(markup).toContain("Fictional plan check notice");
  });

  it("does not show a stale verification recommendation while intelligence refreshes", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        evidenceResponse={{
          ...defaultDetailProps.evidenceResponse,
          evidence: [{ ...safeEvidence, verification_status: "verified" }],
        }}
        intelligenceLoading
      />,
    );

    expect(markup).not.toContain("Complete evidence review");
    expect(markup).toContain("Evaluating case");
  });

  it("keeps the Case Cockpit usable when optional intelligence is unavailable", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        intelligence={null}
        intelligenceError="Mission Intelligence could not be refreshed."
      />,
    );

    expect(markup).toContain("Fictional Oak Street ADU");
    expect(markup).toContain("Mission Intelligence could not be refreshed.");
    expect(markup).toContain("Edit details");
    expect(markup).toContain("Evidence");
  });

  it("treats an outdated packet presentation as requiring regeneration", () => {
    expect(packetNeedsRegeneration({
      case_id: safeCase.id,
      current_state: "packet_generated",
      events: [],
      latest_event: null,
      next_events: ["review_started", "packet_generated"],
      active_packet_generation_id: "packet-1",
      live_preview_differs: false,
      quality: {
        eligible_for_approval: false,
        eligible_for_delivery: false,
        blockers: [{
          id: "presentation-version-current",
          title: "Packet presentation is outdated",
          reason: "The persisted snapshot uses an old presentation version.",
          source: "Persisted packet snapshot schema",
          recommended_resolution: "Regenerate the packet.",
          target_cockpit_tab: "packet",
        }],
        warnings: [],
        passed_checks: [],
        stale_snapshot: false,
        evaluated_at: "2026-07-11T00:00:00.000Z",
        recommended_resolution: "Regenerate the packet.",
      },
    })).toBe(true);
  });

  it("shows the findings cockpit tab for signed-in case detail users", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail {...defaultDetailProps} caseRecord={safeCase} />,
    );

    expect(markup).toContain("Findings");
    expect(markup).toContain('role="tab"');
  });

  it("renders the isolated Integrity Review cockpit for administrators only", () => {
    const adminMarkup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        initialSection="integrity-review"
        role="admin"
      />,
    );
    const clientMarkup = renderToStaticMarkup(
      <CaseDetail {...defaultDetailProps} caseRecord={safeCase} />,
    );

    expect(adminMarkup).toContain("OpenAI Build Week 2026 extension");
    expect(adminMarkup).toContain("Run Integrity Review");
    expect(adminMarkup).toContain("Human approval is required");
    expect(adminMarkup).toContain("No AI output enters the client packet automatically");
    expect(clientMarkup).not.toContain("OpenAI Build Week 2026 extension");
  });

  it("can open the existing AI review section from OS navigation", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        initialSection="ai-review"
      />,
    );

    expect(markup).toContain("Generate review draft");
    expect(markup).not.toContain("Edit details");
  });

  it("maps the legacy activity destination into the cockpit timeline", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        {...defaultDetailProps}
        caseRecord={safeCase}
        initialSection="activity"
      />,
    );

    expect(markup).toContain("Mission chronology");
    expect(markup).toContain("Case activity");
    expect(markup).toContain("No activity yet");
    expect(markup).not.toContain("Edit details");
  });

  it("starts the AI review panel without an automatically generated review", () => {
    const markup = renderToStaticMarkup(
      <AIReviewPanel
        onCompareWithPacket={() => undefined}
        onGenerate={async () => safeAiReview}
      />,
    );

    expect(markup).toContain("Deterministic baseline review");
    expect(markup).toContain("Generate review draft");
    expect(markup).toContain("No review draft has been generated");
    expect(markup).toContain("Provider status");
    expect(markup).toContain("Active provider");
    expect(markup).toContain("Reviewed packet source");
    expect(markup).toContain("Case / evidence / timeline / activity");
    expect(markup).toContain("live_ai=false");
    expect(markup).toContain("external_calls=false");
    expect(markup).toContain("What the baseline review checks");
    expect(markup).toContain("Evidence grounding");
    expect(markup).toContain("Unsupported-claim warnings");
    expect(markup).toContain("Citation validity");
    expect(markup).toContain("Compare with Packet preview");
    expect(markup).not.toContain("Generated draft review");
  });

  it("renders an accessible AI review loading state", () => {
    const markup = renderToStaticMarkup(
      <AIReviewPanel
        initialStatus="loading"
        onGenerate={async () => safeAiReview}
      />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Generating review...");
    expect(markup).toContain("Generating a deterministic review");
    expect(markup).toContain('role="status"');
  });

  it("renders the complete validated review and evaluation report", () => {
    const markup = renderToStaticMarkup(
      <AIReviewPanel
        initialData={safeAiReview}
        onGenerate={async () => safeAiReview}
      />,
    );

    expect(markup).toContain("The packet case is in Intake.");
    expect(markup).toContain("Missing information");
    expect(markup).toContain("Permit number is not provided.");
    expect(markup).toContain("Recommended next actions");
    expect(markup).toContain("Review missing fields before relying on the packet.");
    expect(markup).toContain("Evidence citations");
    expect(markup).toContain(safeEvidence.id);
    expect(markup).not.toContain("This evidence record is included in the packet.");
    expect(markup).toContain("Unsupported claims");
    expect(markup).toContain("A fictional unsupported claim for human review.");
    expect(markup).toContain("Confidence notes");
    expect(markup).toContain("Treat unverified evidence as needing human review.");
    expect(markup).toContain("96/100");
    expect(markup).toContain("Citation validity");
    expect(markup).toContain("Safety warnings");
    expect(markup).toContain("Evaluation report");
    expect(markup).toContain("Provider status");
    expect(markup).toContain("live_ai=false");
    expect(markup).toContain("external_calls=false");
    expect(markup).toContain("Copy review text");
    expect(markup).toContain("not live AI");
    expect(markup).toContain("may miss issues");
    expect(markup).toContain("not legal advice");
  });

  it("renders XSS-like review values as text and omits private fields", () => {
    const markup = renderToStaticMarkup(
      <AIReviewPanel
        initialData={{
          ...safeAiReview,
          review: {
            ...safeAiReview.review,
            summary: "<script>alert('review')</script>",
            missing_information: ["<img src=x onerror=alert(1)>"],
          },
        }}
        onGenerate={async () => safeAiReview}
      />,
    ).toLowerCase();

    expect(markup).toContain("&lt;script&gt;alert(&#x27;review&#x27;)&lt;/script&gt;");
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<script>");
    for (const forbidden of [
      "password",
      "account",
      "cookie",
      "token",
      "authorization",
      "request_id",
      "created_by_user_id",
      "deleted_at",
      "lifecycle_mutation_nonce",
    ]) {
      expect(markup).not.toContain(forbidden);
    }
  });

  it("renders safe retry errors without operational detail", () => {
    const notFound = safeAiReviewError(
      new CaseApiError("not-found", "private missing detail", 404),
    );
    const server = safeAiReviewError(
      new CaseApiError("server", "private stack detail", 500),
    );
    const markup = renderToStaticMarkup(
      <AIReviewPanel
        initialError={server}
        initialStatus="error"
        onGenerate={async () => safeAiReview}
      />,
    );

    expect(notFound).toBe("The case was not found or is no longer available.");
    expect(server).toBe("The review draft could not be generated. Try again.");
    expect(markup).toContain("Review unavailable");
    expect(markup).toContain("Retry review draft");
    expect(markup).not.toContain("private stack detail");
  });

  it("compiles and copies clean review text with safe feedback", async () => {
    const text = compileAiReviewText(safeAiReview);
    const writes: string[] = [];
    const success = await copyAiReviewText(text, {
      writeText: async (value) => {
        writes.push(value);
      },
    });
    const failure = await copyAiReviewText(text, {
      writeText: async () => {
        throw new Error("private clipboard detail");
      },
    });
    const failureMarkup = renderToStaticMarkup(
      <AIReviewPanel
        initialCopyStatus="error"
        initialData={safeAiReview}
        onGenerate={async () => safeAiReview}
      />,
    );

    expect(text).toContain("Draft review — verify before sending");
    expect(text).toContain("live_ai=false");
    expect(text).toContain("external_calls=false");
    expect(text).toContain(`evidence: ${safeEvidence.id}`);
    expect(text).not.toContain("<ul>");
    expect(success).toBe(true);
    expect(writes).toEqual([text]);
    expect(failure).toBe(false);
    expect(failureMarkup).toContain("Review text could not be copied.");
    expect(failureMarkup).not.toContain("private clipboard detail");
  });

  it("renders an authoritative packet loading boundary before any deliverable actions", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview caseRecord={safeCase} />,
    );

    expect(markup).toContain("Client packet");
    expect(markup).toContain("Loading the authoritative packet");
    expect(markup).not.toContain("Prepared for client review");
    expect(markup).not.toContain("Copy packet text");
    expect(markup).not.toContain("Open print preview");
    expect(markup).not.toContain("Download PDF");
  });

  it("does not render local case content as a packet while the server model loads", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview
        caseRecord={{
          ...safeCase,
          project_name: "<script>untrusted local project</script>",
        }}
      />,
    ).toLowerCase();

    expect(markup).toContain("loading the authoritative packet");
    expect(markup).not.toContain("untrusted local project");
    expect(markup).not.toContain("packet-canonical-document");
  });

  it("does not render a local timeline or activity as a partial packet", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview caseRecord={safeCase} />,
    ).toLowerCase();

    expect(markup).not.toContain("permit timeline");
    expect(markup).not.toContain("recent case activity");
    expect(markup).not.toContain("fictional plan check notice");
  });

  it("does not fabricate empty packet sections before the authoritative response", () => {
    const markup = renderToStaticMarkup(
      <PacketPreview caseRecord={safeCase} />,
    );

    expect(markup).not.toContain("No evidence records are included in this packet.");
    expect(markup).not.toContain("No permit timeline events are included in this packet.");
    expect(markup).not.toContain("No reviewer-approved findings are included in this packet.");
    expect(markup).not.toContain("Recent case activity");
  });

  it("reports copy success and failure through the clipboard helper", async () => {
    const failureMarkup = renderToStaticMarkup(
      <PacketPreview
        caseRecord={safeCase}
        initialCopyStatus="error"
      />,
    );
    const writes: string[] = [];
    const success = await copyPacketText("Plain packet", {
      writeText: async (value) => {
        writes.push(value);
      },
    });
    const failure = await copyPacketText("Plain packet", {
      writeText: async () => {
        throw new Error("Clipboard denied");
      },
    });
    const missing = await copyPacketText("Plain packet", undefined);

    expect(success).toBe(true);
    expect(writes).toEqual(["Plain packet"]);
    expect(failure).toBe(false);
    expect(missing).toBe(false);
    expect(failureMarkup).toContain("Packet text could not be copied.");
    expect(failureMarkup).not.toContain("Clipboard denied");
  });
});
