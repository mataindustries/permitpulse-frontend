export type PublicEnvironment = "local" | "preview" | "production";

export interface Bindings {
  AI_REVIEW_EXTERNAL_CALLS_ENABLED?: string;
  AI_REVIEW_LIVE_ENABLED?: string;
  AI_REVIEW_LOCAL_TEST_ENABLED?: string;
  AI_REVIEW_PROVIDER?: string;
  AI_REVIEW_API_KEY?: string;
  AI_REVIEW_MODEL_ENDPOINT?: string;
  AI_REVIEW_MODEL_NAME?: string;
  APP_ENV: string;
  ADMIN_BOOTSTRAP_ENABLED: string;
  ADMIN_BOOTSTRAP_TOKEN?: string;
  ASSETS: Fetcher;
  AUTH_ALLOW_SIGNUP: string;
  AUTH_ENABLED: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL: string;
  BUILD_WEEK_DEMO_MODE?: string;
  BUILD_WEEK_INTEGRITY_ENABLED?: string;
  BUILD_WEEK_INTEGRITY_LIVE_ENABLED?: string;
  DB: D1Database;
  EVIDENCE_FILES?: R2Bucket;
  ENABLE_DEV_CASE_API: string;
  PREVIEW_DEMO_SEED_ENABLED?: string;
  PREVIEW_DEMO_SEED_TOKEN?: string;
  OPENAI_API_KEY?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: "client" | "admin";
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
