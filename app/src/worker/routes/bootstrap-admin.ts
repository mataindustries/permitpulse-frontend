import { Hono } from "hono";
import { z } from "zod";
import { AuthConfigurationError } from "../auth/config";
import { createAuth } from "../auth/create-auth";
import { getPublicEnvironment } from "../lib/environment";
import { errorResponse } from "../lib/responses";
import {
  getBearerToken,
  TemporaryAuthorizationConfigurationError,
  temporaryTokenMatches,
} from "../lib/temporary-authorization";
import type { WorkerEnv } from "../types";

const bootstrapAdminBodySchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(12).max(128),
  })
  .strict();

export const bootstrapAdminRoutes = new Hono<WorkerEnv>();

function isBootstrapEnabled(context: WorkerEnv["Bindings"]): boolean {
  return (
    getPublicEnvironment(context.APP_ENV) === "preview" &&
    context.ADMIN_BOOTSTRAP_ENABLED === "true"
  );
}

async function userCount(context: WorkerEnv["Bindings"]): Promise<number> {
  const row = await context.DB.prepare(
    'SELECT COUNT(*) AS count FROM "user"',
  ).first<{ count: number }>();

  return row?.count ?? 0;
}

async function claimBootstrap(context: WorkerEnv["Bindings"]): Promise<boolean> {
  const result = await context.DB.prepare(
    "INSERT OR IGNORE INTO admin_bootstrap_claim (id) VALUES (1)",
  ).run();

  return result.meta.changes === 1;
}

bootstrapAdminRoutes.post("/", async (context) => {
  if (!isBootstrapEnabled(context.env)) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }

  try {
    const suppliedToken = getBearerToken(context.req.header("authorization"));

    if (
      !(await temporaryTokenMatches(
        context.env.ADMIN_BOOTSTRAP_TOKEN,
        suppliedToken,
      ))
    ) {
      return errorResponse(
        context,
        401,
        "UNAUTHORIZED",
        "Admin bootstrap is unavailable.",
      );
    }
  } catch (error) {
    if (error instanceof TemporaryAuthorizationConfigurationError) {
      return errorResponse(
        context,
        503,
        "BOOTSTRAP_UNAVAILABLE",
        "Admin bootstrap is unavailable.",
      );
    }

    throw error;
  }

  if (!context.req.header("content-type")?.includes("application/json")) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The request body is invalid.",
    );
  }

  let payload: unknown;

  try {
    payload = await context.req.json();
  } catch {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The request body is invalid.",
    );
  }

  const parsed = bootstrapAdminBodySchema.safeParse(payload);

  if (!parsed.success) {
    return errorResponse(
      context,
      400,
      "INVALID_REQUEST",
      "The request body is invalid.",
    );
  }

  try {
    const auth = createAuth(context.env);

    if ((await userCount(context.env)) !== 0) {
      return errorResponse(
        context,
        409,
        "BOOTSTRAP_ALREADY_USED",
        "Admin bootstrap is unavailable.",
      );
    }

    if (!(await claimBootstrap(context.env))) {
      return errorResponse(
        context,
        409,
        "BOOTSTRAP_ALREADY_USED",
        "Admin bootstrap is unavailable.",
      );
    }

    if ((await userCount(context.env)) !== 0) {
      return errorResponse(
        context,
        409,
        "BOOTSTRAP_ALREADY_USED",
        "Admin bootstrap is unavailable.",
      );
    }

    const created = await auth.api.createUser({
      body: {
        email: parsed.data.email,
        name: parsed.data.name,
        password: parsed.data.password,
        role: "admin",
      },
    });

    return context.json({
      ok: true,
      data: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
        role: "admin",
      },
    });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return errorResponse(
        context,
        503,
        "AUTH_UNAVAILABLE",
        "Authentication is unavailable.",
      );
    }

    throw error;
  }
});
