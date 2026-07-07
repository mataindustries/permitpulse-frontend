import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaseApiError,
  createCase,
  getCase,
  listCases,
} from "../src/client/api/cases";
import { App, type AuthState } from "../src/client/App";
import { CaseDetail } from "../src/client/components/CaseDetail";
import { CaseList } from "../src/client/components/CaseList";
import { CreateCaseForm } from "../src/client/components/CreateCaseForm";
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
  },
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
          user: signedInState.user,
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
        caseRecord={safeCase}
        error=""
        loading={false}
        onBack={() => undefined}
        onRetry={() => undefined}
      />,
    );
    const notFoundMarkup = renderToStaticMarkup(
      <CaseDetail
        caseRecord={null}
        error="The case was not found or is no longer available."
        loading={false}
        onBack={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(detailMarkup).toContain("Fictional Oak Street ADU");
    expect(detailMarkup).toContain("Editing and evidence tools are not available");
    expect(detailMarkup).not.toContain("participant");
    expect(notFoundMarkup).toContain("Case unavailable");
    expect(notFoundMarkup).toContain("Back to list");
  });

  it("does not render workspace-sensitive internals", () => {
    const markup = renderToStaticMarkup(
      <CaseDetail
        caseRecord={safeCase}
        error=""
        loading={false}
        onBack={() => undefined}
        onRetry={() => undefined}
      />,
    ).toLowerCase();

    expect(markup).not.toContain("session");
    expect(markup).not.toContain("token");
    expect(markup).not.toContain("authorization");
    expect(markup).not.toContain("account");
    expect(markup).not.toContain("user_id");
  });
});
