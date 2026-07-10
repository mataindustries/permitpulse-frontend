import { Hono } from "hono";
import { actorFromUser } from "../cases/authorization";
import { caseListQuerySchema } from "../cases/validation";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import { listMissionControlForActor } from "../mission-control/repository";
import type { WorkerEnv } from "../types";

export const missionControlRoutes = new Hono<WorkerEnv>();

missionControlRoutes.use("*", sessionMiddleware);

missionControlRoutes.get("/", async (context) => {
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

  const missions = await listMissionControlForActor(
    context.env.DB,
    actorFromUser(user),
    parsedQuery.data,
  );

  return context.json({
    ok: true,
    data: {
      missions,
      pagination: parsedQuery.data,
      order: "attention_status_updated_at_asc",
    },
  });
});
