import { Hono } from "hono";
import { getPublicEnvironment, logDevelopmentError } from "../lib/environment";
import type { WorkerEnv } from "../types";

export const healthRoutes = new Hono<WorkerEnv>();

healthRoutes.get("/", async (context) => {
  const timestamp = new Date().toISOString();
  const environment = getPublicEnvironment(context.env.APP_ENV);

  try {
    const result = await context.env.DB.prepare(
      "SELECT 1 AS connected",
    ).first<{ connected: number }>();
    const connected = result?.connected === 1;

    return context.json(
      {
        ok: connected,
        service: "permitpulse-case-workspace",
        environment,
        database: {
          connected,
          status: connected ? "connected" : "disconnected",
        },
        timestamp,
      },
      connected ? 200 : 503,
    );
  } catch (error) {
    logDevelopmentError(context, "Database health check failed.", error);

    return context.json(
      {
        ok: false,
        service: "permitpulse-case-workspace",
        environment,
        database: {
          connected: false,
          status: "disconnected",
        },
        timestamp,
      },
      503,
    );
  }
});
