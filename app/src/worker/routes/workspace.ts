import { Hono } from "hono";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

export const workspaceRoutes = new Hono<WorkerEnv>();

workspaceRoutes.use("*", sessionMiddleware);

workspaceRoutes.get("/", (context) => {
  const user = context.get("authenticatedUser");

  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }

  return context.json({
    ok: true,
    data: {
      status: "ready",
      user: {
        id: user.id,
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
        role: user.role,
      },
    },
  });
});
