export type PublicEnvironment = "local" | "preview" | "production";

export interface Bindings {
  APP_ENV: string;
  ASSETS: Fetcher;
  AUTH_ALLOW_SIGNUP: string;
  AUTH_ENABLED: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL: string;
  DB: D1Database;
  ENABLE_DEV_CASE_API: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface Variables {
  authenticatedSession: AuthenticatedSession | null;
  authenticatedUser: AuthenticatedUser | null;
  requestId: string;
}

export type WorkerEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
