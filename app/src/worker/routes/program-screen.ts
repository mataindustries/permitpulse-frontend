import { Hono } from "hono";
import { z } from "zod";
import { actorFromUser, mayEvaluateProgramScreen } from "../cases/authorization";
import { getCaseForActor } from "../cases/repository";
import { caseIdSchema } from "../cases/validation";
import { logDevelopmentError } from "../lib/environment";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import { buildProgramScreenCaseEvaluationResponse, programScreenAsOf } from "../program-screen/case-evaluation-response";
import type { WorkerEnv } from "../types";

/** No caller date, revision, evidence, authority, registry or case selector is accepted. */
const programScreenQuerySchema = z.object({}).strict();

export const programScreenCaseRoutes = new Hono<WorkerEnv>();
programScreenCaseRoutes.use("/:caseId/program-screen", sessionMiddleware);

/**
 * Admin-only, read-only evaluation of an already-prepared case. The role check precedes every
 * case-specific step so a non-administrator learns nothing about whether a case exists.
 */
programScreenCaseRoutes.get("/:caseId/program-screen", async (context) => {
  const user = context.get("authenticatedUser");
  if (!user) return errorResponse(context, 401, "UNAUTHENTICATED", "Authentication is required.");
  const actor = actorFromUser(user);
  if (!mayEvaluateProgramScreen(actor)) return errorResponse(context, 403, "FORBIDDEN", "Program Screen evaluation requires an administrator.");
  if (!programScreenQuerySchema.safeParse(context.req.query()).success) return errorResponse(context, 400, "INVALID_QUERY", "Program Screen evaluation accepts no query parameters.");
  const caseId = caseIdSchema.safeParse(context.req.param("caseId"));
  if (!caseId.success) return errorResponse(context, 400, "INVALID_CASE_ID", "The case ID is invalid.");
  const caseRecord = await getCaseForActor(context.env.DB, actor, caseId.data);
  if (!caseRecord) return errorResponse(context, 404, "CASE_NOT_FOUND", "The case was not found.");
  if (context.env.EVIDENCE_FILES === undefined) return errorResponse(context, 503, "EVIDENCE_STORAGE_UNAVAILABLE", "Evidence file storage is not configured.");
  const asOf = programScreenAsOf(new Date());
  try {
    // Loaded on demand so the Worker entry's static import graph never instantiates the evaluator
    // modules ahead of the Program Screen suites' module observers.
    const { evaluateCaseProgramScreen } = await import("../program-screen/evaluate-case");
    const result = await evaluateCaseProgramScreen(context.env, actor, caseRecord.id, asOf);
    return context.json({ ok: true, data: buildProgramScreenCaseEvaluationResponse(result, asOf) });
  } catch (error) {
    logDevelopmentError(context, "Program Screen evaluation failed.", error);
    return errorResponse(context, 500, "PROGRAM_SCREEN_EVALUATION_FAILED", "The Program Screen evaluation could not be completed.");
  }
});
