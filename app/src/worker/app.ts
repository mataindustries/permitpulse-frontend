import { Hono } from "hono";
import { logDevelopmentError } from "./lib/environment";
import { errorResponse } from "./lib/responses";
import { authConfigRoutes } from "./routes/auth-config";
import { handleAuthRequest } from "./routes/auth";
import { bootstrapAdminRoutes } from "./routes/bootstrap-admin";
import { caseRoutes } from "./routes/cases";
import { developmentCaseRoutes } from "./routes/development-cases";
import { healthRoutes } from "./routes/health";
import { missionControlRoutes } from "./routes/mission-control";
import { missionIntelligenceRoutes } from "./routes/mission-intelligence";
import { workspaceRoutes } from "./routes/workspace";
import { deliveryLifecycleRoutes } from "./routes/delivery-lifecycle";
import { reviewerRoutes } from "./routes/reviewer";
import { previewDemoSeedRoutes } from "./routes/preview-demo-seed";
import { evidenceInboxRoutes } from "./routes/evidence-inbox";
import {
  buildWeekIntegrityCaseRoutes,
  buildWeekIntegrityRoutes,
} from "./routes/build-week-integrity";
import { applicationOriginMiddleware } from "./middleware/application-origin";
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

app.use("/api/v1/*", applicationOriginMiddleware);
app.use("/api/dev/*", applicationOriginMiddleware);
app.use("/api/internal/seed-arroyo-vista", applicationOriginMiddleware);

app.on(["GET", "POST"], "/api/auth/*", handleAuthRequest);
app.route("/api/config/auth", authConfigRoutes);
app.route("/api/health", healthRoutes);
app.route("/api/internal/bootstrap-admin", bootstrapAdminRoutes);
app.route("/api/internal/seed-arroyo-vista", previewDemoSeedRoutes);
app.route("/api/dev/cases", developmentCaseRoutes);
app.route("/api/v1/cases", caseRoutes);
app.route("/api/v1/cases", buildWeekIntegrityCaseRoutes);
app.route("/api/v1/cases", deliveryLifecycleRoutes);
app.route("/api/v1/cases", reviewerRoutes);
app.route("/api/v1/mission-control", missionControlRoutes);
app.route("/api/v1/mission-intelligence", missionIntelligenceRoutes);
app.route("/api/v1/evidence-inbox", evidenceInboxRoutes);
app.route("/api/v1/build-week", buildWeekIntegrityRoutes);
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
