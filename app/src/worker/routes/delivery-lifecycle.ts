import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { buildPacketModel } from "../../shared/packet/build-packet-model";
import { deliveryEventTypes } from "../../shared/delivery-lifecycle/types";
import { actorFromUser, mayTransitionCaseStatus } from "../cases/authorization";
import { getCaseForActor, listCaseActivity, listEvidenceForCase, listTimelineForCase } from "../cases/repository";
import { caseIdSchema } from "../cases/validation";
import { packetComparableDigest, readDeliveryLifecycle, readGeneratedPacket, recordDeliveryTransition } from "../delivery/repository";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

export const deliveryLifecycleRoutes = new Hono<WorkerEnv>();
type RouteContext = Context<WorkerEnv>;
const transitionSchema = z.object({
  event_type: z.enum(deliveryEventTypes),
  idempotency_key: z.string().trim().min(1).max(128),
  note: z.string().trim().min(1).max(1000).nullable().optional(),
}).strict();

async function access(context: RouteContext) {
  const user = context.get("authenticatedUser");
  if (!user) return { ok: false as const, response: errorResponse(context, 401, "UNAUTHENTICATED", "Authentication is required.") };
  const parsed = caseIdSchema.safeParse(context.req.param("caseId"));
  if (!parsed.success) return { ok: false as const, response: errorResponse(context, 400, "INVALID_CASE_ID", "The case ID is invalid.") };
  const actor = actorFromUser(user);
  const record = await getCaseForActor(context.env.DB, actor, parsed.data);
  if (!record) return { ok: false as const, response: errorResponse(context, 404, "CASE_NOT_FOUND", "The case was not found.") };
  return { ok: true as const, actor, record };
}

deliveryLifecycleRoutes.use("*", sessionMiddleware);
deliveryLifecycleRoutes.use("*", bodyLimit({
  maxSize: 16 * 1024,
  onError: (context) => errorResponse(context, 413, "REQUEST_TOO_LARGE", "The request body is too large."),
}));

async function livePacket(context: RouteContext, record: Awaited<ReturnType<typeof getCaseForActor>> & {}) {
  const [evidence, timeline, activity] = await Promise.all([
    listEvidenceForCase(context.env.DB, record.id, { limit: 50, offset: 0 }),
    listTimelineForCase(context.env.DB, record.id, { limit: 50, offset: 0 }),
    listCaseActivity(context.env.DB, record.id, { limit: 25, offset: 0 }),
  ]);
  return buildPacketModel({ caseRecord: record, evidence, timeline, activityResponse: { activity }, generatedAt: new Date() });
}

deliveryLifecycleRoutes.get("/:caseId/delivery-lifecycle", async (context) => {
  const allowed = await access(context);
  if (!allowed.ok) return allowed.response;
  const lifecycle = await readDeliveryLifecycle(context.env.DB, allowed.record.id);
  if (lifecycle.active_packet_generation_id) {
    const [persisted, current] = await Promise.all([
      readGeneratedPacket(context.env.DB, allowed.record.id, lifecycle.active_packet_generation_id),
      livePacket(context, allowed.record),
    ]);
    lifecycle.live_preview_differs = Boolean(persisted && await packetComparableDigest(persisted) !== await packetComparableDigest(current));
  }
  return context.json({ ok: true, data: { lifecycle } });
});

deliveryLifecycleRoutes.post("/:caseId/delivery-lifecycle/transitions", async (context) => {
  const allowed = await access(context);
  if (!allowed.ok) return allowed.response;
  if (!mayTransitionCaseStatus(allowed.actor)) return errorResponse(context, 403, "FORBIDDEN", "Only an administrator may change delivery lifecycle state.");
  if (!context.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse(context, 415, "UNSUPPORTED_MEDIA_TYPE", "The request body must be JSON.");
  }
  let body: unknown;
  try { body = await context.req.json(); } catch { return errorResponse(context, 400, "INVALID_JSON", "The request body is not valid JSON."); }
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) return errorResponse(context, 400, "INVALID_TRANSITION_INPUT", "The lifecycle transition input is invalid.");

  let packet;
  if (parsed.data.event_type === "packet_generated") {
    packet = await livePacket(context, allowed.record);
  }
  const outcome = await recordDeliveryTransition({
    actor: allowed.actor, caseId: allowed.record.id, caseVersion: allowed.record.version,
    database: context.env.DB, eventType: parsed.data.event_type,
    idempotencyKey: parsed.data.idempotency_key, note: parsed.data.note ?? null, packet,
  });
  if (outcome.kind === "invalid_transition") return errorResponse(context, 409, "INVALID_DELIVERY_TRANSITION", "That delivery lifecycle transition is not permitted from the current state.");
  if (outcome.kind === "idempotency_conflict") return errorResponse(context, 409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for a different request.");
  if (outcome.kind === "concurrent_transition") return errorResponse(context, 409, "DELIVERY_STATE_CHANGED", "The delivery lifecycle changed. Reload and try again.");
  if (!("lifecycle" in outcome)) return errorResponse(context, 500, "DELIVERY_TRANSITION_FAILED", "The delivery lifecycle could not be updated.");
  return context.json({ ok: true, data: { lifecycle: outcome.lifecycle, retry: outcome.kind === "retry" } }, outcome.kind === "created" ? 201 : 200);
});
