import type { MiddlewareHandler } from "hono";
import {
  AuthConfigurationError,
  isTrustedApplicationOrigin,
} from "../auth/config";
import { errorResponse } from "../lib/responses";
import type { WorkerEnv } from "../types";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Browser writes use cookie authentication, so a supplied Origin must match
 * the configured application origin. Requests without Origin remain available
 * to non-browser operational clients and are still protected by authentication.
 */
export const applicationOriginMiddleware: MiddlewareHandler<WorkerEnv> = async (
  context,
  next,
) => {
  if (safeMethods.has(context.req.method)) {
    await next();
    return;
  }

  const origin = context.req.header("origin");
  if (!origin) {
    await next();
    return;
  }

  try {
    if (!isTrustedApplicationOrigin(context.env, origin, context.req.url)) {
      return errorResponse(
        context,
        403,
        "INVALID_ORIGIN",
        "The request origin is not allowed.",
      );
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
