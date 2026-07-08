import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaseApiError,
  createCase,
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
} from "../src/client/components/CaseDetail";
import { CaseList } from "../src/client/components/CaseList";
import { CreateCaseForm } from "../src/client/components/CreateCaseForm";
import { EditCaseForm } from "../src/client/components/EditCaseForm";
import {
  StatusManagement,
  validNextStatuses,
} from "../src/client/components/StatusManagement";
import type { CaseDto, CreateCaseInput } from "../src/client/types/cases";

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

const defaultDetailProps = {
  activityError: "",
  activityLoading: false,
  activityResponse: {
    activity: [],
    pagination: { limit: 10, offset: 0 },
    order: "created_at_desc" as const,
  },
  error: "",
  loading: false,
  role: "client" as const,
  onActivityNextPage: () => undefined,
  onActivityPreviousPage: () => undefined,
  onActivityRetry: () => undefined,
  onBack: () => undefined,
  onMetadataUpdate: async () => undefined,
  onReloadLatest: async () => undefined,
  onRetry: () => undefined,
  onStatusUpdate: async () => undefined,
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
    expect(markup).toContain("Loading cases");
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

    expect(markup).toContain("Signing out...");
    expect(markup).toContain("Case list");
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
    expect(detailMarkup).toContain("Immutable case activity");
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
});
