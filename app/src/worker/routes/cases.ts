import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  actorFromUser,
  canCreateCase,
} from "../cases/authorization";
import {
  createCaseForActor,
  getCaseForActor,
  getEditableCaseForActor,
  listCaseActivity,
  listCasesForActor,
  updateCaseMetadataForActor,
  updateCaseStatusForActor,
} from "../cases/repository";
import {
  caseActivityQuerySchema,
  caseIdSchema,
  caseListQuerySchema,
  createCaseSchema,
  updateCaseMetadataSchema,
  updateCaseStatusSchema,
} from "../cases/validation";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

const maximumRequestBodyBytes = 16 * 1024;

export const caseRoutes = new Hono<WorkerEnv>();

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
