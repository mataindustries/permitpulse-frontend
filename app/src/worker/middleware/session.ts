import type { MiddlewareHandler } from "hono";
import { AuthConfigurationError, isAuthEnabled } from "../auth/config";
import { createAuth } from "../auth/create-auth";
import { errorResponse } from "../lib/responses";
import type { WorkerEnv } from "../types";

export const sessionMiddleware: MiddlewareHandler<WorkerEnv> = async (
  context,
  next,
) => {
  context.set("authenticatedUser", null);
  context.set("authenticatedSession", null);

  if (!isAuthEnabled(context.env)) {
    await next();
    return;
  }

  try {
    const auth = createAuth(context.env);
    const result = await auth.api.getSession({
      headers: context.req.raw.headers,
    });

    if (result) {
      const userRole = await context.env.DB.prepare(
        'SELECT role FROM "user" WHERE id = ?',
      )
        .bind(result.user.id)
        .first<{ role: "client" | "admin" }>();

      context.set("authenticatedUser", {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name || null,
        role: userRole?.role === "admin" ? "admin" : "client",
      });
      context.set("authenticatedSession", {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      });
    }
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

  await next();
};
