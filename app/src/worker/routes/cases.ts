import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  actorFromUser,
  canCreateCase,
} from "../cases/authorization";
import {
  createCaseForActor,
  getCaseForActor,
  listCasesForActor,
} from "../cases/repository";
import {
  caseIdSchema,
  caseListQuerySchema,
  createCaseSchema,
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
  );

  return context.json(
    {
      ok: true,
      data: record,
    },
    201,
  );
});
