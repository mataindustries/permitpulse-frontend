import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  createCase,
  getCaseById,
  listCases,
} from "../cases/repository";
import {
  caseIdSchema,
  createCaseSchema,
} from "../cases/validation";
import { isDevelopmentCaseApiEnabled } from "../lib/environment";
import { errorResponse } from "../lib/responses";
import type { WorkerEnv } from "../types";

const maximumRequestBodyBytes = 16 * 1024;

export const developmentCaseRoutes = new Hono<WorkerEnv>();

developmentCaseRoutes.use("*", async (context, next) => {
  if (!isDevelopmentCaseApiEnabled(context)) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }

  await next();
});

developmentCaseRoutes.use(
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

developmentCaseRoutes.get("/", async (context) => {
  const records = await listCases(context.env.DB);

  return context.json({
    ok: true,
    data: records,
  });
});

developmentCaseRoutes.get("/:id", async (context) => {
  const parsedId = caseIdSchema.safeParse(context.req.param("id"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "INVALID_CASE_ID",
      "The case ID is invalid.",
    );
  }

  const record = await getCaseById(context.env.DB, parsedId.data);

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

developmentCaseRoutes.post("/", async (context) => {
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

  const record = await createCase(context.env.DB, parsedBody.data);

  return context.json(
    {
      ok: true,
      data: record,
    },
    201,
  );
});
