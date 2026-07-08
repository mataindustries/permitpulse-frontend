import { type FormEvent, useEffect, useState } from "react";
import {
  CaseApiError,
  createCase,
  getCase,
  listCaseActivity,
  listCases,
  updateCaseMetadata,
  updateCaseStatus,
} from "./api/cases";
import { authClient } from "./auth-client";
import { CaseDetail } from "./components/CaseDetail";
import { CaseList } from "./components/CaseList";
import { CreateCaseForm } from "./components/CreateCaseForm";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import type {
  CaseDto,
  CaseActivityResponse,
  CaseListPagination,
  CreateCaseInput,
  UpdateCaseMetadataInput,
  UpdateCaseStatusInput,
  UserRole,
} from "./types/cases";

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
  | { name: "list" }
  | { name: "create" }
  | { name: "detail"; caseId: string };

interface CaseClient {
  createCase: typeof createCase;
  getCase: typeof getCase;
  listCaseActivity: typeof listCaseActivity;
  listCases: typeof listCases;
  updateCaseMetadata: typeof updateCaseMetadata;
  updateCaseStatus: typeof updateCaseStatus;
}

const defaultCaseClient: CaseClient = {
  createCase,
  getCase,
  listCaseActivity,
  listCases,
  updateCaseMetadata,
  updateCaseStatus,
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
  const [view, setView] = useState<WorkspaceView>({ name: "list" });
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [pagination, setPagination] = useState<CaseListPagination | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [detailCase, setDetailCase] = useState<CaseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [activityResponse, setActivityResponse] =
    useState<CaseActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
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

  async function loadCaseDetail(caseId: string) {
    setDetailLoading(true);
    setDetailError("");
    setDetailCase(null);
    setActivityResponse(null);
    setActivityError("");
    setView({ name: "detail", caseId });

    try {
      const record = await client.getCase(caseId);

      setDetailCase(record);
      updateCaseInList(record);
      void loadActivity(caseId, 0);
    } catch (error) {
      handleCaseError(error, setDetailError);
    } finally {
      setDetailLoading(false);
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
      await loadCaseList(0);
      setDetailCase(created);
      setDetailError("");
      setDetailLoading(false);
      setActivityResponse(null);
      setActivityError("");
      setView({ name: "detail", caseId: created.id });
      void loadActivity(created.id, 0);
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

    const updated = await client.updateCaseMetadata(detailCase.id, input);

    setDetailCase(updated);
    updateCaseInList(updated);
    setSuccessMessage("Case details saved.");
    await loadActivity(updated.id, 0);
  }

  async function handleStatusUpdate(input: UpdateCaseStatusInput) {
    if (!detailCase) {
      return;
    }

    const updated = await client.updateCaseStatus(detailCase.id, input);

    setDetailCase(updated);
    updateCaseInList(updated);
    setSuccessMessage("Case status updated.");
    await loadActivity(updated.id, 0);
  }

  return (
    <div className="workspace-shell">
      <WorkspaceHeader
        displayName={user.name || user.email}
        onNewCase={() => {
          setCreateError("");
          setSuccessMessage("");
          setView({ name: "create" });
        }}
        onSignOut={onSignOut}
        signOutDisabled={signingOut}
        signingOut={signingOut}
      />

      <div className="workspace-layout">
        <nav aria-label="Workspace navigation" className="workspace-nav">
          <button
            className={view.name === "list" ? "nav-button active" : "nav-button"}
            type="button"
            onClick={() => setView({ name: "list" })}
          >
            Cases
          </button>
          <button
            className={
              view.name === "create" ? "nav-button active" : "nav-button"
            }
            type="button"
            onClick={() => {
              setCreateError("");
              setSuccessMessage("");
              setView({ name: "create" });
            }}
          >
            New case
          </button>
        </nav>

        <div className="workspace-content">
          {successMessage && (
            <p className="success" role="status">
              {successMessage}
            </p>
          )}

          {view.name === "list" && (
            <CaseList
              cases={cases}
              error={listError}
              loading={listLoading}
              pagination={pagination}
              onCreate={() => setView({ name: "create" })}
              onNextPage={nextPage}
              onOpenCase={(caseId) => void loadCaseDetail(caseId)}
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

          {view.name === "detail" && (
            <CaseDetail
              activityError={activityError}
              activityLoading={activityLoading}
              activityResponse={activityResponse}
              caseRecord={detailCase}
              error={detailError}
              loading={detailLoading}
              role={user.role}
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
              onBack={() => setView({ name: "list" })}
              onMetadataUpdate={handleMetadataUpdate}
              onReloadLatest={reloadLatestCase}
              onRetry={() => void loadCaseDetail(view.caseId)}
              onStatusUpdate={handleStatusUpdate}
            />
          )}
        </div>
      </div>
    </div>
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
