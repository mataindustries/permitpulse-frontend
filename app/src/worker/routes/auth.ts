import type { Context } from "hono";
import { AuthConfigurationError, isAuthEnabled } from "../auth/config";
import { createAuth } from "../auth/create-auth";
import { errorResponse } from "../lib/responses";
import type { WorkerEnv } from "../types";

const tokenResponsePaths = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
]);

function jsonResponse(response: Response, body: unknown): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function omitBodyToken(response: Response): Promise<Response> {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  const body = (await response.json()) as Record<string, unknown>;
  const { token: _token, ...safeBody } = body;

  if (
    safeBody.user &&
    typeof safeBody.user === "object" &&
    !Array.isArray(safeBody.user)
  ) {
    safeBody.user = safeUser(safeBody.user as Record<string, unknown>);
  }

  return jsonResponse(response, safeBody);
}

function safeUser(user: Record<string, unknown>): Record<string, unknown> {
  const {
    role: _role,
    banned: _banned,
    banReason: _banReason,
    banExpires: _banExpires,
    ban_reason: _ban_reason,
    ban_expires: _ban_expires,
    ...safe
  } = user;

  return safe;
}

async function omitSessionToken(response: Response): Promise<Response> {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  const body = (await response.json()) as {
    session?: Record<string, unknown>;
    user?: Record<string, unknown>;
  } | null;

  if (!body?.session) {
    return jsonResponse(response, body);
  }

  const { token: _token, ...safeSession } = body.session;

  return jsonResponse(response, {
    ...body,
    session: safeSession,
    user:
      body.user &&
      typeof body.user === "object" &&
      !Array.isArray(body.user)
        ? safeUser(body.user as Record<string, unknown>)
        : body.user,
  });
}

export async function handleAuthRequest(context: Context<WorkerEnv>) {
  if (!isAuthEnabled(context.env)) {
    return errorResponse(
      context,
      404,
      "NOT_FOUND",
      "The requested resource was not found.",
    );
  }

  try {
    const auth = createAuth(context.env, context.req.url);
    const pathname = new URL(context.req.url).pathname;

    if (
      context.req.method === "GET" &&
      pathname === "/api/auth/get-session"
    ) {
      return omitSessionToken(await auth.handler(context.req.raw));
    }

    const response = await auth.handler(context.req.raw);

    return tokenResponsePaths.has(pathname)
      ? await omitBodyToken(response)
      : response;
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
}
