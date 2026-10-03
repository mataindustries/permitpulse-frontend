import { Hono, type Context } from "hono";
import { z } from "zod";
import { actorFromUser, mayPrepareProgramScreenCase, type CaseActor } from "../cases/authorization";
import { getEditableCaseForActor } from "../cases/repository";
import { caseIdSchema } from "../cases/validation";
import { logDevelopmentError } from "../lib/environment";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { Bindings, WorkerEnv } from "../types";
import type * as CasePreparationService from "../program-screen/case-preparation";

/*
 * Phase 3K: administrator-only Program Screen case preparation, mounted at /api/v1/program-screen.
 * It is outside /api/v1/cases so the 16 KiB wildcard body limit there never applies, and it loads
 * the preparation service on demand so the Worker entry never instantiates Program Screen modules.
 */

type Service = typeof CasePreparationService;
interface PreparationRequest {
  service: Service;
  bindings: Bindings;
  actor: CaseActor;
  caseId: string;
  digest: string;
  bytes: Uint8Array;
  json: unknown;
  now: Date;
  requestId: string;
}
interface Endpoint {
  digest: boolean;
  body: null | { media: readonly string[]; maxBytes: number; json: boolean };
  run(request: PreparationRequest): Promise<{ status: 200 | 201; data: unknown }>;
}

const KiB = 1024, MiB = 1024 * KiB;
const OCTET_STREAM = ["application/octet-stream"];
const JSON_MEDIA = ["application/json", "application/json; charset=utf-8"];
const emptyQuery = z.object({}).strict();

/** Lowercase, with single "; " separators, then compared exactly to the endpoint's media types. */
function mediaType(value: string | undefined): string {
  return (value ?? "").toLowerCase().split(";").map((part) => part.trim()).filter((part) => part.length > 0).join("; ");
}

/** Reads at most maxBytes; null when the declared or actual body is larger. */
async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\s*\d+\s*$/.test(declared) && Number(declared) > maxBytes) return null;
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Gate order: session, administrator, query, case ID, digest, encoding, media type, body limit,
 * case lookup, storage, then the server clock and the on-demand service. A non-administrator
 * learns nothing about the case, the digest or the body.
 */
function preparationHandler(endpoint: Endpoint) {
  return async (context: Context<WorkerEnv>) => {
    const user = context.get("authenticatedUser");
    if (!user) return errorResponse(context, 401, "UNAUTHENTICATED", "Authentication is required.");
    const actor = actorFromUser(user);
    if (!mayPrepareProgramScreenCase(actor)) return errorResponse(context, 403, "FORBIDDEN", "Program Screen case preparation requires an administrator.");
    if (!emptyQuery.safeParse(context.req.query()).success) return errorResponse(context, 400, "INVALID_QUERY", "Program Screen case preparation accepts no query parameters.");
    const caseId = caseIdSchema.safeParse(context.req.param("caseId"));
    if (!caseId.success) return errorResponse(context, 400, "INVALID_CASE_ID", "The case ID is invalid.");
    const digest = context.req.param("sha256") ?? "";
    if (endpoint.digest && !/^[0-9a-f]{64}$/.test(digest)) return errorResponse(context, 400, "INVALID_DIGEST", "The digest must be 64 lowercase hexadecimal characters.");
    if (context.req.header("content-encoding") !== undefined) return errorResponse(context, 415, "UNSUPPORTED_CONTENT_ENCODING", "Content encodings are not accepted.");
    let bytes: Uint8Array = new Uint8Array(0);
    if (endpoint.body !== null) {
      if (!endpoint.body.media.includes(mediaType(context.req.header("content-type")))) return errorResponse(context, 415, "UNSUPPORTED_MEDIA_TYPE", "The request media type is not accepted here.");
      const read = await readLimitedBody(context.req.raw, endpoint.body.maxBytes);
      if (read === null) return errorResponse(context, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
      bytes = read;
    }
    const caseRecord = await getEditableCaseForActor(context.env.DB, actor, caseId.data);
    if (!caseRecord) return errorResponse(context, 404, "CASE_NOT_FOUND", "The case was not found.");
    if (context.env.EVIDENCE_FILES === undefined) return errorResponse(context, 503, "EVIDENCE_STORAGE_UNAVAILABLE", "Evidence file storage is not configured.");
    const now = new Date();
    let service: Service | undefined;
    try {
      // Loaded on demand: the Worker entry's static import graph never reaches Program Screen modules.
      service = await import("../program-screen/case-preparation");
      let json: unknown;
      if (endpoint.body?.json) {
        try {
          json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          throw new service.CasePreparationError("INVALID_JSON");
        }
      }
      const result = await endpoint.run({ service, bindings: context.env, actor, caseId: caseRecord.id, digest, bytes, json, now, requestId: context.get("requestId") });
      return context.json({ ok: true, data: result.data }, result.status);
    } catch (error) {
      if (service !== undefined && error instanceof service.CasePreparationError) return errorResponse(context, error.status, error.code, error.message, error.details);
      logDevelopmentError(context, "Program Screen case preparation failed.", error);
      return errorResponse(context, 500, "PROGRAM_SCREEN_PREPARATION_FAILED", "The Program Screen case preparation could not be completed.");
    }
  };
}

const ok = (data: unknown) => ({ status: 200 as const, data });

export const programScreenPreparationRoutes = new Hono<WorkerEnv>();
programScreenPreparationRoutes.use("/cases/:caseId/preparation", sessionMiddleware);
programScreenPreparationRoutes.use("/cases/:caseId/preparation/*", sessionMiddleware);

programScreenPreparationRoutes.get("/cases/:caseId/preparation", preparationHandler({
  digest: false, body: null,
  run: async (r) => ok(await r.service.readCasePreparationStatus(r.bindings, r.actor, r.caseId, r.now)),
}));
programScreenPreparationRoutes.put("/cases/:caseId/preparation/blobs/:sha256", preparationHandler({
  digest: true, body: { media: OCTET_STREAM, maxBytes: 8 * MiB, json: false },
  run: async (r) => ok(await r.service.storeCasePreparationBlob(r.bindings, r.actor, r.caseId, r.digest, r.bytes)),
}));
programScreenPreparationRoutes.put("/cases/:caseId/preparation/calfire/index/:sha256", preparationHandler({
  digest: true, body: { media: ["text/plain; charset=utf-8"], maxBytes: 4 * MiB, json: false },
  run: async (r) => ok(await r.service.hydrateCalFireIndex(r.bindings, r.actor, r.caseId, r.digest, r.bytes)),
}));
programScreenPreparationRoutes.put("/cases/:caseId/preparation/calfire/records/:sha256", preparationHandler({
  digest: true, body: { media: OCTET_STREAM, maxBytes: 16 * MiB, json: false },
  run: async (r) => ok(await r.service.hydrateCalFireRecord(r.bindings, r.actor, r.caseId, r.digest, r.bytes)),
}));
programScreenPreparationRoutes.post("/cases/:caseId/preparation/validate", preparationHandler({
  digest: false, body: { media: JSON_MEDIA, maxBytes: 64 * KiB, json: true },
  run: async (r) => ok(await r.service.validateReviewedLotProposal(r.bindings, r.actor, r.caseId, r.json, r.now)),
}));
programScreenPreparationRoutes.post("/cases/:caseId/preparation/publish", preparationHandler({
  digest: false, body: { media: JSON_MEDIA, maxBytes: 64 * KiB, json: true },
  run: async (r) => {
    const publication = await r.service.publishReviewedLotProposal(r.bindings, r.actor, r.caseId, r.json, r.now, r.requestId);
    return { status: publication.replayed ? 200 : 201, data: publication };
  },
}));
programScreenPreparationRoutes.post("/cases/:caseId/preparation/invalidate", preparationHandler({
  digest: false, body: { media: JSON_MEDIA, maxBytes: 4 * KiB, json: true },
  run: async (r) => ok(await r.service.invalidateCurrentReview(r.bindings, r.actor, r.caseId, r.json, r.now, r.requestId)),
}));
