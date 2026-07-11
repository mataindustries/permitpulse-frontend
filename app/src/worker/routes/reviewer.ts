import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCaseForActor } from "../cases/repository";
import { actorFromUser } from "../cases/authorization";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import { readReviewerWorkspace, saveReviewerObject } from "../reviewer/repository";
import { actionInputSchema, findingInputSchema, noteInputSchema, questionInputSchema } from "../reviewer/validation";
import type { WorkerEnv } from "../types";

export const reviewerRoutes = new Hono<WorkerEnv>();
reviewerRoutes.use("/:caseId/reviewer/*", sessionMiddleware);
reviewerRoutes.use("/:caseId/reviewer", sessionMiddleware);
reviewerRoutes.use("/:caseId/reviewer/*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => errorResponse(c,413,"PAYLOAD_TOO_LARGE","Reviewer edits must be 64 KB or smaller.") }));

async function access(context: Parameters<typeof errorResponse>[0]) {
  const user = context.get("authenticatedUser");
  if (!user) return { response: errorResponse(context,401,"UNAUTHENTICATED","Authentication is required.") };
  if (user.role !== "admin") return { response: errorResponse(context,403,"FORBIDDEN","Reviewer workspace access requires an administrator.") };
  const record = await getCaseForActor(context.env.DB, actorFromUser(user), context.req.param("caseId") ?? "");
  if (!record) return { response: errorResponse(context,404,"NOT_FOUND","The case was not found.") };
  return { user, record };
}

reviewerRoutes.get("/:caseId/reviewer", async (context) => {
  const allowed = await access(context); if ("response" in allowed) return allowed.response;
  return context.json({ ok: true, data: { workspace: await readReviewerWorkspace(context.env.DB,allowed.record.id) } });
});

for (const definition of [
  { kind:"finding", path:"findings", schema:findingInputSchema },
  { kind:"question", path:"questions", schema:questionInputSchema },
  { kind:"action", path:"actions", schema:actionInputSchema },
  { kind:"note", path:"notes", schema:noteInputSchema },
] as const) {
  for (const method of ["post","put"] as const) reviewerRoutes[method](`/:caseId/reviewer/${definition.path}${method === "put" ? "/:objectId" : ""}`, async (context) => {
    const allowed = await access(context); if ("response" in allowed) return allowed.response;
    let body: unknown; try { body = await context.req.json(); } catch { return errorResponse(context,400,"INVALID_JSON","The request body is not valid JSON."); }
    const parsed = definition.schema.safeParse(body); if (!parsed.success) return errorResponse(context,422,"VALIDATION_ERROR","Reviewer fields are incomplete or invalid.",parsed.error.flatten());
    const result = await saveReviewerObject(context.env.DB,allowed.record.id,allowed.user.id,definition.kind,parsed.data,method === "put" ? context.req.param("objectId") : undefined);
    if (result.outcome === "conflict") return errorResponse(context,409,"STALE_VERSION","This reviewer record changed. Reload before saving.");
    if (result.outcome === "invalid_reference") return errorResponse(context,422,"INVALID_REFERENCE","Evidence and timeline references must belong to this case.");
    if (result.outcome === "not_found") return errorResponse(context,404,"NOT_FOUND","The reviewer record was not found.");
    if (result.outcome !== "success") return errorResponse(context,500,"INTERNAL_ERROR","The reviewer edit could not be saved.");
    return context.json({ ok: true, data: { workspace: result.workspace } }, method === "post" ? 201 : 200);
  });
}
