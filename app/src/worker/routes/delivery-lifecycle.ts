import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { deliveryEventTypes } from "../../shared/delivery-lifecycle/types";
import { qualityBlockingSummary } from "../../shared/packet/quality-gate";
import { actorFromUser, mayTransitionCaseStatus } from "../cases/authorization";
import { getCaseForActor } from "../cases/repository";
import { caseIdSchema } from "../cases/validation";
import {
  deliveryTransitionReplayStatus,
  recordDeliveryTransition,
} from "../delivery/repository";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import {
  buildCurrentPacketPresentation,
  readPacketDeliveryContext,
} from "../packet/service";
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

deliveryLifecycleRoutes.get("/:caseId/delivery-lifecycle", async (context) => {
  const allowed = await access(context);
  if (!allowed.ok) return allowed.response;
  const packetContext = await readPacketDeliveryContext({
    caseRecord: allowed.record,
    database: context.env.DB,
    evaluatedAt: new Date(),
  });
  return context.json({ ok: true, data: { lifecycle: packetContext.lifecycle } });
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

  const note = parsed.data.note ?? null;
  const replayStatus = await deliveryTransitionReplayStatus({
    caseId: allowed.record.id,
    database: context.env.DB,
    eventType: parsed.data.event_type,
    idempotencyKey: parsed.data.idempotency_key,
    note,
  });
  if (replayStatus === "none" && (
    parsed.data.event_type === "approved_for_delivery" ||
    parsed.data.event_type === "delivery_recorded"
  )) {
    const packetContext = await readPacketDeliveryContext({
      caseRecord: allowed.record,
      database: context.env.DB,
      evaluatedAt: new Date(),
    });
    const isApplicableApproval =
      parsed.data.event_type === "approved_for_delivery" &&
      packetContext.lifecycle.current_state === "under_review";
    const isApplicableDelivery =
      parsed.data.event_type === "delivery_recorded" &&
      packetContext.lifecycle.current_state === "approved_for_delivery";
    const blocked =
      (isApplicableApproval && !packetContext.quality.eligible_for_approval) ||
      (isApplicableDelivery && !packetContext.quality.eligible_for_delivery);

    if (blocked) {
      const action = isApplicableApproval ? "approval" : "delivery";
      const summary = qualityBlockingSummary(packetContext.quality);

      return errorResponse(
        context,
        409,
        "PACKET_QUALITY_BLOCKED",
        `Packet ${action} is blocked by: ${summary}.`,
        {
          blocking_checks: packetContext.quality.blockers,
          recommended_resolution: packetContext.quality.recommended_resolution,
          stale_snapshot: packetContext.quality.stale_snapshot,
        },
      );
    }
  }

  let packet;
  if (parsed.data.event_type === "packet_generated") {
    packet = await buildCurrentPacketPresentation({
      caseRecord: allowed.record,
      database: context.env.DB,
      generatedAt: new Date(),
    });
  }
  const outcome = await recordDeliveryTransition({
    actor: allowed.actor, caseId: allowed.record.id, caseVersion: allowed.record.version,
    database: context.env.DB, eventType: parsed.data.event_type,
    idempotencyKey: parsed.data.idempotency_key, note, packet,
  });
  if (outcome.kind === "invalid_transition") return errorResponse(context, 409, "INVALID_DELIVERY_TRANSITION", "That delivery lifecycle transition is not permitted from the current state.");
  if (outcome.kind === "idempotency_conflict") return errorResponse(context, 409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for a different request.");
  if (outcome.kind === "concurrent_transition") return errorResponse(context, 409, "DELIVERY_STATE_CHANGED", "The delivery lifecycle changed. Reload and try again.");
  if (!("lifecycle" in outcome)) return errorResponse(context, 500, "DELIVERY_TRANSITION_FAILED", "The delivery lifecycle could not be updated.");
  const packetContext = await readPacketDeliveryContext({
    caseRecord: allowed.record,
    database: context.env.DB,
    evaluatedAt: new Date(),
  });
  return context.json({ ok: true, data: { lifecycle: packetContext.lifecycle, retry: outcome.kind === "retry" } }, outcome.kind === "created" ? 201 : 200);
});
