import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  actorFromUser,
  canCreateCase,
} from "../cases/authorization";
import {
  createCaseForActor,
  createEvidenceForActor,
  createTimelineForActor,
  getCaseForActor,
  getEditableCaseForActor,
  linkEvidenceToTimelineForActor,
  listCaseActivity,
  listCasesForActor,
  listEvidenceForCase,
  listTimelineForCase,
  readEvidenceForActor,
  readTimelineForActor,
  unlinkEvidenceFromTimelineForActor,
  updateCaseMetadataForActor,
  updateCaseStatusForActor,
  updateEvidenceForActor,
  updateTimelineForActor,
} from "../cases/repository";
import {
  caseActivityQuerySchema,
  caseIdSchema,
  caseListQuerySchema,
  createCaseSchema,
  createEvidenceSchema,
  createTimelineSchema,
  evidenceTimelinePaginationSchema,
  linkEvidenceSchema,
  updateCaseMetadataSchema,
  updateCaseStatusSchema,
  updateEvidenceSchema,
  updateTimelineSchema,
} from "../cases/validation";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

const maximumRequestBodyBytes = 16 * 1024;

export const caseRoutes = new Hono<WorkerEnv>();

type CaseRouteContext = Context<WorkerEnv>;

async function readJsonBody(context: CaseRouteContext): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: Response }
> {
  const contentType = context.req.header("content-type")?.toLowerCase();

  if (!contentType?.startsWith("application/json")) {
    return {
      ok: false,
      response: errorResponse(
        context,
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "The request body must be JSON.",
      ),
    };
  }

  try {
    return {
      ok: true,
      body: await context.req.json(),
    };
  } catch {
    return {
      ok: false,
      response: errorResponse(
        context,
        400,
        "INVALID_JSON",
        "The request body is not valid JSON.",
      ),
    };
  }
}

async function requireCaseAccess(context: CaseRouteContext) {
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

  const parsedId = caseIdSchema.safeParse(context.req.param("caseId"));

  if (!parsedId.success) {
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

  const actor = actorFromUser(user);
  const record = await getCaseForActor(context.env.DB, actor, parsedId.data);

  if (!record) {
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

  return {
    ok: true as const,
    actor,
    caseId: record.id,
  };
}

function mutationErrorResponse(
  context: CaseRouteContext,
  outcome: string,
): Response {
  switch (outcome) {
    case "conflict":
      return errorResponse(
        context,
        409,
        "STALE_VERSION",
        "The record version is stale.",
      );
    case "forbidden":
      return errorResponse(
        context,
        403,
        "FORBIDDEN",
        "The request is not allowed.",
      );
    case "no_changes":
      return errorResponse(
        context,
        400,
        "NO_CHANGES",
        "The update did not change any fields.",
      );
    case "duplicate_link":
      return errorResponse(
        context,
        409,
        "DUPLICATE_LINK",
        "The evidence is already linked to the timeline entry.",
      );
    case "invalid_link":
      return errorResponse(
        context,
        400,
        "INVALID_EVIDENCE_LINK",
        "The evidence link is invalid.",
      );
    default:
      return errorResponse(
        context,
        404,
        "RECORD_NOT_FOUND",
        "The record was not found.",
      );
  }
}

caseRoutes.use("*", sessionMiddleware);

caseRoutes.use(
  "*",
  bodyLimit({
    maxSize: maximumRequestBodyBytes,
    onError: (context) =>
      errorResponse(
        context,
        413,
        "REQUEST_TOO_LARGE",
        "The request body is too large.",
      ),
  }),
);

caseRoutes.post("/:caseId/evidence", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const jsonBody = await readJsonBody(context);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsedBody = createEvidenceSchema.safeParse(jsonBody.body);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The evidence data is invalid.",
    );
  }

  const record = await createEvidenceForActor(
    context.env.DB,
    access.caseId,
    access.actor,
    parsedBody.data,
  );

  return context.json(
    {
      ok: true,
      data: record,
    },
    201,
  );
});

caseRoutes.get("/:caseId/evidence", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedQuery = evidenceTimelinePaginationSchema.safeParse(
    context.req.query(),
  );

  if (!parsedQuery.success) {
    return errorResponse(
      context,
      400,
      "INVALID_QUERY",
      "The pagination query is invalid.",
    );
  }

  const records = await listEvidenceForCase(
    context.env.DB,
    access.caseId,
    parsedQuery.data,
  );

  return context.json({
    ok: true,
    data: {
      evidence: records,
      pagination: parsedQuery.data,
      order: "source_date_desc_nulls_last_created_at_desc",
    },
  });
});

caseRoutes.get("/:caseId/evidence/:evidenceId", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedEvidenceId = caseIdSchema.safeParse(
    context.req.param("evidenceId"),
  );

  if (!parsedEvidenceId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_EVIDENCE_ID",
      "The evidence ID is invalid.",
    );
  }

  const record = await readEvidenceForActor(
    context.env.DB,
    access.caseId,
    parsedEvidenceId.data,
  );

  if (!record) {
    return errorResponse(
      context,
      404,
      "EVIDENCE_NOT_FOUND",
      "The evidence was not found.",
    );
  }

  return context.json({
    ok: true,
    data: record,
  });
});

caseRoutes.patch("/:caseId/evidence/:evidenceId", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedEvidenceId = caseIdSchema.safeParse(
    context.req.param("evidenceId"),
  );

  if (!parsedEvidenceId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_EVIDENCE_ID",
      "The evidence ID is invalid.",
    );
  }

  const jsonBody = await readJsonBody(context);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsedBody = updateEvidenceSchema.safeParse(jsonBody.body);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The evidence update is invalid.",
    );
  }

  const existing = await readEvidenceForActor(
    context.env.DB,
    access.caseId,
    parsedEvidenceId.data,
  );

  if (!existing) {
    return errorResponse(
      context,
      404,
      "EVIDENCE_NOT_FOUND",
      "The evidence was not found.",
    );
  }

  const result = await updateEvidenceForActor(
    context.env.DB,
    access.caseId,
    access.actor,
    existing,
    parsedBody.data,
  );

  if (result.outcome !== "success") {
    return mutationErrorResponse(context, result.outcome);
  }

  return context.json({
    ok: true,
    data: result.record,
  });
});

caseRoutes.post("/:caseId/timeline", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const jsonBody = await readJsonBody(context);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsedBody = createTimelineSchema.safeParse(jsonBody.body);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The timeline entry data is invalid.",
    );
  }

  const result = await createTimelineForActor(
    context.env.DB,
    access.caseId,
    access.actor,
    parsedBody.data,
  );

  if (result.outcome !== "success") {
    return mutationErrorResponse(context, result.outcome);
  }

  return context.json(
    {
      ok: true,
      data: result.record,
    },
    201,
  );
});

caseRoutes.get("/:caseId/timeline", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedQuery = evidenceTimelinePaginationSchema.safeParse(
    context.req.query(),
  );

  if (!parsedQuery.success) {
    return errorResponse(
      context,
      400,
      "INVALID_QUERY",
      "The pagination query is invalid.",
    );
  }

  const records = await listTimelineForCase(
    context.env.DB,
    access.caseId,
    parsedQuery.data,
  );

  return context.json({
    ok: true,
    data: {
      timeline: records,
      pagination: parsedQuery.data,
      order: "occurred_on_desc_created_at_desc",
    },
  });
});

caseRoutes.get("/:caseId/timeline/:timelineId", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedTimelineId = caseIdSchema.safeParse(
    context.req.param("timelineId"),
  );

  if (!parsedTimelineId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_TIMELINE_ID",
      "The timeline entry ID is invalid.",
    );
  }

  const record = await readTimelineForActor(
    context.env.DB,
    access.caseId,
    parsedTimelineId.data,
  );

  if (!record) {
    return errorResponse(
      context,
      404,
      "TIMELINE_NOT_FOUND",
      "The timeline entry was not found.",
    );
  }

  return context.json({
    ok: true,
    data: record,
  });
});

caseRoutes.patch("/:caseId/timeline/:timelineId", async (context) => {
  const access = await requireCaseAccess(context);

  if (!access.ok) {
    return access.response;
  }

  const parsedTimelineId = caseIdSchema.safeParse(
    context.req.param("timelineId"),
  );

  if (!parsedTimelineId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_TIMELINE_ID",
      "The timeline entry ID is invalid.",
    );
  }

  const jsonBody = await readJsonBody(context);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsedBody = updateTimelineSchema.safeParse(jsonBody.body);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The timeline entry update is invalid.",
    );
  }

  const existing = await readTimelineForActor(
    context.env.DB,
    access.caseId,
    parsedTimelineId.data,
  );

  if (!existing) {
    return errorResponse(
      context,
      404,
      "TIMELINE_NOT_FOUND",
      "The timeline entry was not found.",
    );
  }

  const result = await updateTimelineForActor(
    context.env.DB,
    access.caseId,
    access.actor,
    existing,
    parsedBody.data,
  );

  if (result.outcome !== "success") {
    return mutationErrorResponse(context, result.outcome);
  }

  return context.json({
    ok: true,
    data: result.record,
  });
});

caseRoutes.post(
  "/:caseId/timeline/:timelineId/evidence",
  async (context) => {
    const access = await requireCaseAccess(context);

    if (!access.ok) {
      return access.response;
    }

    const parsedTimelineId = caseIdSchema.safeParse(
      context.req.param("timelineId"),
    );

    if (!parsedTimelineId.success) {
      return errorResponse(
        context,
        400,
        "INVALID_TIMELINE_ID",
        "The timeline entry ID is invalid.",
      );
    }

    const jsonBody = await readJsonBody(context);

    if (!jsonBody.ok) {
      return jsonBody.response;
    }

    const parsedBody = linkEvidenceSchema.safeParse(jsonBody.body);

    if (!parsedBody.success) {
      return errorResponse(
        context,
        400,
        "INVALID_REQUEST",
        "The evidence link request is invalid.",
      );
    }

    const result = await linkEvidenceToTimelineForActor(
      context.env.DB,
      access.caseId,
      access.actor,
      parsedTimelineId.data,
      parsedBody.data.evidence_id,
    );

    if (result.outcome !== "success") {
      return mutationErrorResponse(context, result.outcome);
    }

    return context.json({
      ok: true,
      data: result.record,
    });
  },
);

caseRoutes.delete(
  "/:caseId/timeline/:timelineId/evidence/:evidenceId",
  async (context) => {
    const access = await requireCaseAccess(context);

    if (!access.ok) {
      return access.response;
    }

    const parsedTimelineId = caseIdSchema.safeParse(
      context.req.param("timelineId"),
    );
    const parsedEvidenceId = caseIdSchema.safeParse(
      context.req.param("evidenceId"),
    );

    if (!parsedTimelineId.success) {
      return errorResponse(
        context,
        400,
        "INVALID_TIMELINE_ID",
        "The timeline entry ID is invalid.",
      );
    }

    if (!parsedEvidenceId.success) {
      return errorResponse(
        context,
        400,
        "INVALID_EVIDENCE_ID",
        "The evidence ID is invalid.",
      );
    }

    const result = await unlinkEvidenceFromTimelineForActor(
      context.env.DB,
      access.caseId,
      access.actor,
      parsedTimelineId.data,
      parsedEvidenceId.data,
    );

    if (result.outcome !== "success") {
      return mutationErrorResponse(context, result.outcome);
    }

    return context.json({
      ok: true,
      data: result.record,
    });
  },
);

caseRoutes.get("/", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const parsedQuery = caseListQuerySchema.safeParse(context.req.query());

  if (!parsedQuery.success) {
    return errorResponse(
      context,
      400,
      "INVALID_QUERY",
      "The pagination query is invalid.",
    );
  }

  const actor = actorFromUser(user);
  const records = await listCasesForActor(
    context.env.DB,
    actor,
    parsedQuery.data,
  );

  return context.json({
    ok: true,
    data: {
      cases: records,
      pagination: parsedQuery.data,
    },
  });
});

caseRoutes.get("/:caseId", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const parsedId = caseIdSchema.safeParse(context.req.param("caseId"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_CASE_ID",
      "The case ID is invalid.",
    );
  }

  const record = await getCaseForActor(
    context.env.DB,
    actorFromUser(user),
    parsedId.data,
  );

  if (!record) {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  return context.json({
    ok: true,
    data: record,
  });
});

caseRoutes.get("/:caseId/activity", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const parsedId = caseIdSchema.safeParse(context.req.param("caseId"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_CASE_ID",
      "The case ID is invalid.",
    );
  }

  const parsedQuery = caseActivityQuerySchema.safeParse(context.req.query());

  if (!parsedQuery.success) {
    return errorResponse(
      context,
      400,
      "INVALID_QUERY",
      "The pagination query is invalid.",
    );
  }

  const actor = actorFromUser(user);
  const record = await getCaseForActor(context.env.DB, actor, parsedId.data);

  if (!record) {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  const activity = await listCaseActivity(
    context.env.DB,
    record.id,
    parsedQuery.data,
  );

  return context.json({
    ok: true,
    data: {
      activity,
      pagination: parsedQuery.data,
      order: "created_at_desc",
    },
  });
});

caseRoutes.patch("/:caseId", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const parsedId = caseIdSchema.safeParse(context.req.param("caseId"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_CASE_ID",
      "The case ID is invalid.",
    );
  }

  const contentType = context.req.header("content-type")?.toLowerCase();

  if (!contentType?.startsWith("application/json")) {
    return errorResponse(
      context,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "The request body must be JSON.",
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }

  const parsedBody = updateCaseMetadataSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The case update is invalid.",
    );
  }

  const actor = actorFromUser(user);
  const record = await getEditableCaseForActor(
    context.env.DB,
    actor,
    parsedId.data,
  );

  if (!record) {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  const result = await updateCaseMetadataForActor(
    context.env.DB,
    actor,
    record,
    parsedBody.data,
    context.get("requestId"),
  );

  if (result.outcome === "conflict") {
    return errorResponse(
      context,
      409,
      "STALE_VERSION",
      "The case version is stale.",
    );
  }

  if (result.outcome === "no_changes") {
    return errorResponse(
      context,
      400,
      "NO_CHANGES",
      "The case update did not change any fields.",
    );
  }

  if (result.outcome !== "success") {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  return context.json({
    ok: true,
    data: result.record,
  });
});

caseRoutes.post("/:caseId/status", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const parsedId = caseIdSchema.safeParse(context.req.param("caseId"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_CASE_ID",
      "The case ID is invalid.",
    );
  }

  const contentType = context.req.header("content-type")?.toLowerCase();

  if (!contentType?.startsWith("application/json")) {
    return errorResponse(
      context,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "The request body must be JSON.",
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }

  const parsedBody = updateCaseStatusSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The status update is invalid.",
    );
  }

  const actor = actorFromUser(user);
  const record = await getCaseForActor(context.env.DB, actor, parsedId.data);

  if (!record) {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  if (actor.role !== "admin") {
    return errorResponse(
      context,
      403,
      "FORBIDDEN",
      "The request is not allowed.",
    );
  }

  const result = await updateCaseStatusForActor(
    context.env.DB,
    actor,
    record,
    parsedBody.data,
    context.get("requestId"),
  );

  if (result.outcome === "conflict") {
    return errorResponse(
      context,
      409,
      "STALE_VERSION",
      "The case version is stale.",
    );
  }

  if (result.outcome === "same_status") {
    return errorResponse(
      context,
      400,
      "SAME_STATUS",
      "The requested status is already current.",
    );
  }

  if (result.outcome === "invalid_transition") {
    return errorResponse(
      context,
      400,
      "INVALID_TRANSITION",
      "The status transition is not allowed.",
    );
  }

  if (result.outcome !== "success") {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  return context.json({
    ok: true,
    data: result.record,
  });
});

caseRoutes.post("/", async (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  const actor = actorFromUser(user);

  if (!canCreateCase(actor)) {
    return errorResponse(
      context,
      403,
      "FORBIDDEN",
      "The request is not allowed.",
    );
  }

  const contentType = context.req.header("content-type")?.toLowerCase();

  if (!contentType?.startsWith("application/json")) {
    return errorResponse(
      context,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "The request body must be JSON.",
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }

  const parsedBody = createCaseSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The case data is invalid.",
    );
  }

  const record = await createCaseForActor(
    context.env.DB,
    parsedBody.data,
    actor,
    context.get("requestId"),
  );

  return context.json(
    {
      ok: true,
      data: record,
    },
    201,
  );
});
