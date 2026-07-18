import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  integrityDecisionInputSchema,
  integrityDemoResetRequestSchema,
  integrityRunRequestSchema,
} from "../../shared/build-week-integrity/schema";
import { arroyoVistaDemoPermitNumber } from "../../shared/demo/arroyo-vista-demo";
import { actorFromUser } from "../cases/authorization";
import { getCaseForActor } from "../cases/repository";
import { caseIdSchema } from "../cases/validation";
import { readIntegrityReviewConfig } from "../build-week-integrity/config";
import {
  archiveIntegrityDemoRuns,
  decideIntegrityItem,
  hasRunningIntegrityRun,
  latestIntegrityRunId,
  readIntegrityRun,
} from "../build-week-integrity/repository";
import { runIntegrityReview } from "../build-week-integrity/service";
import { IntegritySnapshotError } from "../build-week-integrity/snapshot";
import { seedArroyoVistaDemo } from "../demo/seed-arroyo-vista";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

type IntegrityContext = Context<WorkerEnv>;
const maximumRequestBytes = 16 * 1024;

export const buildWeekIntegrityCaseRoutes = new Hono<WorkerEnv>();
export const buildWeekIntegrityRoutes = new Hono<WorkerEnv>();

async function requireIntegrityCase(context: IntegrityContext) {
  const config = readIntegrityReviewConfig(context.env);
  if (!config.enabled) {
    return {
      ok: false as const,
      response: errorResponse(
        context,
        404,
        "NOT_FOUND",
        "The requested resource was not found.",
      ),
    };
  }

  const user = context.get("authenticatedUser");
  if (!user) {
    return {
      ok: false as const,
      response: errorResponse(
        context,
        401,
        "UNAUTHENTICATED",
        "Authentication is required.",
      ),
    };
  }
  if (user.role !== "admin") {
    return {
      ok: false as const,
      response: errorResponse(
        context,
        403,
        "FORBIDDEN",
        "Integrity Review requires an administrator reviewer.",
      ),
    };
  }

  const caseId = caseIdSchema.safeParse(context.req.param("caseId"));
  if (!caseId.success) {
    return {
      ok: false as const,
      response: errorResponse(
        context,
        400,
        "INVALID_CASE_ID",
        "The case ID is invalid.",
      ),
    };
  }
  const record = await getCaseForActor(
    context.env.DB,
    actorFromUser(user),
    caseId.data,
  );
  if (
    !record ||
    (config.demo_mode && record.permit_number !== arroyoVistaDemoPermitNumber)
  ) {
    return {
      ok: false as const,
      response: errorResponse(
        context,
        404,
        "CASE_NOT_FOUND",
        "The case was not found.",
      ),
    };
  }

  return { ok: true as const, config, record, user };
}

async function readJson(context: IntegrityContext): Promise<unknown | Response> {
  if (!context.req.header("content-type")?.startsWith("application/json")) {
    return errorResponse(
      context,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "The request body must be JSON.",
    );
  }
  try {
    return await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }
}

buildWeekIntegrityCaseRoutes.use("*", sessionMiddleware);
buildWeekIntegrityCaseRoutes.use(
  "*",
  bodyLimit({
    maxSize: maximumRequestBytes,
    onError: (context) =>
      errorResponse(
        context,
        413,
        "REQUEST_TOO_LARGE",
        "The request body is too large.",
      ),
  }),
);

buildWeekIntegrityCaseRoutes.get(
  "/:caseId/integrity-reviews/latest",
  async (context) => {
    const access = await requireIntegrityCase(context);
    if (!access.ok) return access.response;
    const runId = await latestIntegrityRunId(context.env.DB, access.record.id);
    const run = runId
      ? await readIntegrityRun({
          caseId: access.record.id,
          database: context.env.DB,
          runId,
        })
      : null;
    return context.json({ ok: true, data: { run } });
  },
);

buildWeekIntegrityCaseRoutes.get(
  "/:caseId/integrity-reviews/:runId",
  async (context) => {
    const access = await requireIntegrityCase(context);
    if (!access.ok) return access.response;
    const run = await readIntegrityRun({
      caseId: access.record.id,
      database: context.env.DB,
      runId: context.req.param("runId"),
    });
    return run
      ? context.json({ ok: true, data: { run } })
      : errorResponse(
          context,
          404,
          "INTEGRITY_RUN_NOT_FOUND",
          "The Integrity Review run was not found.",
        );
  },
);

buildWeekIntegrityCaseRoutes.post(
  "/:caseId/integrity-reviews",
  async (context) => {
    const access = await requireIntegrityCase(context);
    if (!access.ok) return access.response;
    const body = await readJson(context);
    if (body instanceof Response) return body;
    if (!integrityRunRequestSchema.safeParse(body).success) {
      return errorResponse(
        context,
        400,
        "INVALID_INTEGRITY_REQUEST",
        "The Integrity Review request is invalid.",
      );
    }

    try {
      const result = await runIntegrityReview({
        bindings: context.env,
        caseRecord: access.record,
        requestedByUserId: access.user.id,
      });
      if (result.outcome === "live_unavailable") {
        return errorResponse(
          context,
          503,
          "INTEGRITY_LIVE_UNAVAILABLE",
          "Live Integrity Review is not configured. No AI call was made.",
        );
      }
      if (result.outcome === "running") {
        return errorResponse(
          context,
          409,
          "INTEGRITY_REVIEW_RUNNING",
          "An Integrity Review is already running for this case.",
        );
      }
      if (result.outcome === "throttled") {
        context.header("retry-after", "60");
        return errorResponse(
          context,
          429,
          "INTEGRITY_REVIEW_THROTTLED",
          "Wait before running another Integrity Review for this case.",
        );
      }
      if (!("run" in result)) {
        throw new Error("Integrity Review returned an unexpected outcome.");
      }
      return context.json({
        ok: true,
        data: { run: result.run, outcome: result.outcome },
      });
    } catch (error) {
      if (error instanceof IntegritySnapshotError) {
        return errorResponse(
          context,
          error.code === "INPUT_TOO_LARGE" ? 422 : 409,
          `INTEGRITY_${error.code}`,
          error.message,
        );
      }
      throw error;
    }
  },
);

buildWeekIntegrityCaseRoutes.patch(
  "/:caseId/integrity-reviews/:runId/items/:itemId",
  async (context) => {
    const access = await requireIntegrityCase(context);
    if (!access.ok) return access.response;
    const body = await readJson(context);
    if (body instanceof Response) return body;
    const parsed = integrityDecisionInputSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        context,
        422,
        "INVALID_INTEGRITY_DECISION",
        "The Integrity Review decision is invalid.",
        parsed.error.flatten(),
      );
    }

    const outcome = await decideIntegrityItem({
      caseId: access.record.id,
      database: context.env.DB,
      decision: parsed.data,
      itemId: context.req.param("itemId"),
      requestId: context.get("requestId"),
      reviewerUserId: access.user.id,
      runId: context.req.param("runId"),
      timestamp: new Date().toISOString(),
    });
    if (outcome === "not_found") {
      return errorResponse(
        context,
        404,
        "INTEGRITY_ITEM_NOT_FOUND",
        "The Integrity Review item was not found.",
      );
    }
    if (outcome === "conflict") {
      return errorResponse(
        context,
        409,
        "STALE_VERSION",
        "The Integrity Review item changed. Reload before deciding.",
      );
    }

    const run = await readIntegrityRun({
      caseId: access.record.id,
      database: context.env.DB,
      runId: context.req.param("runId"),
    });
    return context.json({ ok: true, data: { run } });
  },
);

buildWeekIntegrityRoutes.use("*", sessionMiddleware);
buildWeekIntegrityRoutes.use(
  "*",
  bodyLimit({
    maxSize: maximumRequestBytes,
    onError: (context) =>
      errorResponse(
        context,
        413,
        "REQUEST_TOO_LARGE",
        "The request body is too large.",
      ),
  }),
);

buildWeekIntegrityRoutes.get("/integrity/config", (context) => {
  const user = context.get("authenticatedUser");
  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  return context.json({
    ok: true,
    data: { config: readIntegrityReviewConfig(context.env) },
  });
});

buildWeekIntegrityRoutes.post("/integrity/demo/reset", async (context) => {
  const config = readIntegrityReviewConfig(context.env);
  if (!config.enabled || !config.demo_mode) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }
  const user = context.get("authenticatedUser");
  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  if (user.role !== "admin") {
    return errorResponse(
      context,
      403,
      "FORBIDDEN",
      "Integrity demo reset requires an administrator.",
    );
  }
  const body = await readJson(context);
  if (body instanceof Response) return body;
  if (!integrityDemoResetRequestSchema.safeParse(body).success) {
    return errorResponse(
      context,
      400,
      "INVALID_DEMO_RESET",
      "The demo reset confirmation is invalid.",
    );
  }

  const existing = await context.env.DB
    .prepare("SELECT id FROM cases WHERE permit_number = ? LIMIT 1")
    .bind(arroyoVistaDemoPermitNumber)
    .first<{ id: string }>();
  if (
    existing &&
    (await hasRunningIntegrityRun(context.env.DB, existing.id))
  ) {
    return errorResponse(
      context,
      409,
      "INTEGRITY_REVIEW_RUNNING",
      "Wait for the running Integrity Review before resetting the demo.",
    );
  }

  const seed = await seedArroyoVistaDemo({
    actor: actorFromUser(user),
    database: context.env.DB,
  });
  const archivedRunCount = await archiveIntegrityDemoRuns({
    caseId: seed.case_id,
    database: context.env.DB,
    timestamp: new Date().toISOString(),
  });
  return context.json({
    ok: true,
    data: {
      case_id: seed.case_id,
      seed_outcome: seed.outcome,
      archived_run_count: archivedRunCount,
    },
  });
});
