import { Hono } from "hono";
import { z } from "zod";
import { actorFromUser } from "../cases/authorization";
import { seedArroyoVistaDemo } from "../demo/seed-arroyo-vista";
import { getPublicEnvironment } from "../lib/environment";
import { errorResponse } from "../lib/responses";
import {
  getBearerToken,
  TemporaryAuthorizationConfigurationError,
  temporaryTokenMatches,
} from "../lib/temporary-authorization";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

const confirmation = "seed-canonical-arroyo-vista-v1";
const requestSchema = z.object({ confirmation: z.literal(confirmation) }).strict();

export const previewDemoSeedRoutes = new Hono<WorkerEnv>();

function isEnabled(environment: WorkerEnv["Bindings"]): boolean {
  return (
    getPublicEnvironment(environment.APP_ENV) === "preview" &&
    environment.PREVIEW_DEMO_SEED_ENABLED === "true"
  );
}

previewDemoSeedRoutes.use("*", async (context, next) => {
  if (!isEnabled(context.env)) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }

  await next();
});

previewDemoSeedRoutes.post("/", sessionMiddleware, async (context) => {
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
      "Preview demo seed access requires an administrator.",
    );
  }

  try {
    if (
      !(await temporaryTokenMatches(
        context.env.PREVIEW_DEMO_SEED_TOKEN,
        getBearerToken(context.req.header("authorization")),
      ))
    ) {
      return errorResponse(
        context,
        401,
        "UNAUTHORIZED",
        "Preview demo seed authorization is unavailable.",
      );
    }
  } catch (error) {
    if (error instanceof TemporaryAuthorizationConfigurationError) {
      return errorResponse(
        context,
        503,
        "SEED_UNAVAILABLE",
        "Preview demo seed authorization is unavailable.",
      );
    }
    throw error;
  }

  if (!context.req.header("content-type")?.startsWith("application/json")) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The seed confirmation is invalid.",
    );
  }

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The seed confirmation is invalid.",
    );
  }
  if (!requestSchema.safeParse(body).success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The seed confirmation is invalid.",
    );
  }

  const result = await seedArroyoVistaDemo({
    actor: actorFromUser(user),
    database: context.env.DB,
  });

  return context.json(
    { ok: true, data: result },
    result.outcome === "created" ? 201 : 200,
  );
});
