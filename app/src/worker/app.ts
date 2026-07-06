import { Hono } from "hono";
import { logDevelopmentError } from "./lib/environment";
import { errorResponse } from "./lib/responses";
import { authConfigRoutes } from "./routes/auth-config";
import { handleAuthRequest } from "./routes/auth";
import { developmentCaseRoutes } from "./routes/development-cases";
import { healthRoutes } from "./routes/health";
import { workspaceRoutes } from "./routes/workspace";
import type { WorkerEnv } from "./types";

export const app = new Hono<WorkerEnv>();

app.use("*", async (context, next) => {
  const requestId =
    context.req.header("cf-ray") ?? crypto.randomUUID();

  context.set("requestId", requestId);
  await next();
  context.header("x-request-id", requestId);
});

app.use("/api/*", async (context, next) => {
  await next();
  context.header("cache-control", "no-store");
});

app.on(["GET", "POST"], "/api/auth/*", handleAuthRequest);
app.route("/api/config/auth", authConfigRoutes);
app.route("/api/health", healthRoutes);
app.route("/api/dev/cases", developmentCaseRoutes);
app.route("/api/workspace", workspaceRoutes);

app.notFound((context) =>
  errorResponse(
    context,
    404,
    "NOT_FOUND",
    "The requested resource was not found.",
  ),
);

app.onError((error, context) => {
  logDevelopmentError(context, "Unhandled API error.", error);

  return errorResponse(
    context,
    500,
    "INTERNAL_ERROR",
    "The request could not be completed.",
  );
});
