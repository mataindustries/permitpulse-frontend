import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "./auth-client";

interface AuthCapabilities {
  enabled: boolean;
  signup_enabled: boolean;
}

interface SafeUser {
  id: string;
  email: string;
  name: string;
}

type ViewState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "signed-out"; allowSignup: boolean }
  | { status: "signed-in"; user: SafeUser };

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

  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
  };
}

export function App() {
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [allowSignup, setAllowSignup] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const capabilities = await loadCapabilities();

        if (!capabilities.enabled) {
          if (active) {
            setView({ status: "disabled" });
          }
          return;
        }

        const user = await loadSession();

        if (!active) {
          return;
        }

        setAllowSignup(capabilities.signup_enabled);
        setView(
          user
            ? { status: "signed-in", user }
            : {
                status: "signed-out",
                allowSignup: capabilities.signup_enabled,
              },
        );
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
          setView({ status: "signed-out", allowSignup: false });
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

      setView({ status: "signed-in", user });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setSubmitting(true);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        throw result.error;
      }

      setView({
        status: "signed-out",
        allowSignup,
      });
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <p className="eyebrow">PermitPulse</p>
      <h1>Case Workspace</h1>

      {view.status === "loading" && (
        <p role="status">Checking your session…</p>
      )}

      {view.status === "disabled" && (
        <section aria-labelledby="auth-disabled-title">
          <h2 id="auth-disabled-title">Authentication unavailable</h2>
          <p>Authentication is not enabled in this environment.</p>
        </section>
      )}

      {view.status === "signed-out" && (
        <section aria-labelledby="auth-title">
          <h2 id="auth-title">
            {mode === "sign-up" ? "Create a local account" : "Sign in"}
          </h2>
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
                ? "Working…"
                : mode === "sign-up"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          {view.allowSignup && (
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

      {view.status === "signed-in" && (
        <section aria-labelledby="workspace-title">
          <h2 id="workspace-title">Workspace ready</h2>
          <p>
            Signed in as <strong>{view.user.email}</strong>. Case management is
            intentionally not included in this milestone.
          </p>
          <button
            disabled={submitting}
            onClick={() => void handleSignOut()}
            type="button"
          >
            {submitting ? "Signing out…" : "Sign out"}
          </button>
        </section>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
