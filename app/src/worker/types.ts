export type PublicEnvironment = "local" | "preview" | "production";

export interface Bindings {
  APP_ENV: string;
  ASSETS: Fetcher;
  DB: D1Database;
  ENABLE_DEV_CASE_API: string;
}

export interface Variables {
  requestId: string;
}

export type WorkerEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
