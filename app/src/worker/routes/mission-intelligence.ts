import { Hono } from "hono";
import { evaluateMissionIntelligence } from "../../shared/mission-intelligence/evaluate";
import { actorFromUser } from "../cases/authorization";
import { caseIdSchema } from "../cases/validation";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import { getMissionFactsForActor } from "../mission-intelligence/repository";
import type { WorkerEnv } from "../types";

export const missionIntelligenceRoutes = new Hono<WorkerEnv>();

missionIntelligenceRoutes.use("*", sessionMiddleware);

missionIntelligenceRoutes.get("/:caseId", async (context) => {
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

  const facts = await getMissionFactsForActor(
    context.env.DB,
    actorFromUser(user),
    parsedId.data,
    new Date().toISOString(),
  );

  if (!facts) {
    return errorResponse(
      context,
      404,
      "CASE_NOT_FOUND",
      "The case was not found.",
    );
  }

  return context.json({
    ok: true,
    data: {
      intelligence: evaluateMissionIntelligence(facts),
    },
  });
});

