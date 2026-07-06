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

  return jsonResponse(response, safeBody);
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
  } | null;

  if (!body?.session) {
    return jsonResponse(response, body);
  }

  const { token: _token, ...safeSession } = body.session;

  return jsonResponse(response, {
    ...body,
    session: safeSession,
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
    const auth = createAuth(context.env);
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
