import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  deterministicEvidenceClassifier,
} from "../../shared/evidence-intake/classifier";
import { placeholderEvidenceExtractor } from "../../shared/evidence-intake/extractor";
import { validateEvidenceFile } from "../../shared/evidence-intake/file-validation";
import type { EvidenceFileMetadata } from "../../shared/evidence-intake/types";
import { actorFromUser } from "../cases/authorization";
import { getCaseForActor } from "../cases/repository";
import {
  evidenceContentDisposition,
  evidenceStorageKey,
  evidenceStorageKeyPrefix,
  R2EvidenceFileStore,
} from "../evidence-intake/file-store";
import {
  claimEvidenceDrafts,
  createEvidenceDraft,
  deleteEvidenceDrafts,
  getEvidenceDraftFileRecord,
  getEvidenceDraftUploadRecord,
  getOwnedDraftStorageRecords,
  listEvidenceDrafts,
  markEvidenceDraftsReviewed,
  moveDraftsToEvidence,
  releaseEvidenceDraftClaims,
} from "../evidence-intake/repository";
import { validateEvidenceFileStructure } from "../evidence-intake/structural-validation";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

const maximumEvidenceFileBytes = 20 * 1024 * 1024;
const maximumUploadBodyBytes = maximumEvidenceFileBytes + 64 * 1024;
const uuidSchema = z.uuid();
const idempotencyKeySchema = z.string().trim().min(1).max(128);
const bulkActionSchema = z
  .object({
    action: z.enum(["delete", "mark_reviewed", "move_to_evidence"]),
    draft_ids: z.array(uuidSchema).min(1).max(100),
    case_id: uuidSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "move_to_evidence" && !value.case_id) {
      context.addIssue({
        code: "custom",
        message: "case_id is required when moving drafts.",
        path: ["case_id"],
      });
    }
  });

export const evidenceInboxRoutes = new Hono<WorkerEnv>();

function hexDigest(value: ArrayBuffer): string {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function deterministicDraftId(
  ownerUserId: string,
  idempotencyKey: string,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${ownerUserId}\u0000${idempotencyKey}`),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const value = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function deleteWithRetry(
  fileStore: R2EvidenceFileStore,
  storageKey: string,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fileStore.delete([storageKey]);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Evidence file cleanup failed.", { cause: lastError });
}

evidenceInboxRoutes.use("*", sessionMiddleware);

evidenceInboxRoutes.get("/", async (context) => {
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
    data: await listEvidenceDrafts(context.env.DB, user.id),
  });
});

evidenceInboxRoutes.post(
  "/upload",
  bodyLimit({
    maxSize: maximumUploadBodyBytes,
    onError: (context) =>
      errorResponse(
        context,
        413,
        "EVIDENCE_FILE_TOO_LARGE",
        "Evidence files must be 20 MB or smaller.",
      ),
  }),
  async (context) => {
    const user = context.get("authenticatedUser");
    if (!user) {
      return errorResponse(
        context,
        401,
        "UNAUTHENTICATED",
        "Authentication is required.",
      );
    }
    if (!context.env.EVIDENCE_FILES) {
      return errorResponse(
        context,
        503,
        "EVIDENCE_STORAGE_UNAVAILABLE",
        "Evidence file storage is not configured.",
      );
    }

    const contentType = context.req.header("content-type")?.toLowerCase();
    if (!contentType?.startsWith("multipart/form-data")) {
      return errorResponse(
        context,
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Evidence uploads must use multipart form data.",
      );
    }

    let formData: FormData;
    try {
      formData = await context.req.formData();
    } catch {
      return errorResponse(
        context,
        400,
        "INVALID_UPLOAD",
        "The evidence upload could not be read.",
      );
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse(
        context,
        400,
        "EVIDENCE_FILE_REQUIRED",
        "Choose an evidence file to upload.",
      );
    }
    if (file.size === 0) {
      return errorResponse(
        context,
        400,
        "INVALID_EVIDENCE_FILE",
        "Use a non-empty PDF, JPG, PNG, HEIC, TXT, or EML file up to 20 MB.",
      );
    }
    if (file.size > maximumEvidenceFileBytes) {
      return errorResponse(
        context,
        413,
        "EVIDENCE_FILE_TOO_LARGE",
        "Evidence files must be 20 MB or smaller.",
      );
    }

    const idempotencyHeader = context.req.header("idempotency-key");
    const parsedIdempotencyKey = idempotencyHeader === undefined
      ? { success: true as const, data: null }
      : idempotencyKeySchema.safeParse(idempotencyHeader);
    if (!parsedIdempotencyKey.success) {
      return errorResponse(
        context,
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "The idempotency key is invalid.",
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    const validation = validateEvidenceFile({
      bytes: fileBytes,
      declaredMediaType: file.type,
      filename: file.name,
    });
    if (!validation.ok) {
      return errorResponse(
        context,
        400,
        validation.reason === "invalid_media_type"
          ? "EVIDENCE_MEDIA_TYPE_MISMATCH"
          : "INVALID_EVIDENCE_FILE",
        validation.reason === "invalid_media_type"
          ? "The evidence filename and media type do not match."
          : "The evidence file name or contents are invalid.",
      );
    }
    if (!(await validateEvidenceFileStructure({ bytes: fileBytes, filename: file.name }))) {
      return errorResponse(
        context,
        400,
        "INVALID_EVIDENCE_FILE",
        "The evidence file name or contents are invalid.",
      );
    }

    const contentDigest = await crypto.subtle.digest("SHA-256", fileBuffer);
    const contentSha256 = hexDigest(contentDigest);
    const metadata: EvidenceFileMetadata = {
      filename: file.name,
      mediaType: validation.mediaType,
      size: file.size,
      lastModified: null,
    };
    const classification = deterministicEvidenceClassifier.classify(metadata);
    const extraction = placeholderEvidenceExtractor.extract(
      metadata,
      classification,
    );
    const idempotencyKey = parsedIdempotencyKey.data;
    const id = idempotencyKey
      ? await deterministicDraftId(user.id, idempotencyKey)
      : crypto.randomUUID();
    const storageKeyPrefix = idempotencyKey
      ? evidenceStorageKeyPrefix(user.id, id, contentSha256)
      : null;
    const storageKey = evidenceStorageKey(
      user.id,
      id,
      file.name,
      idempotencyKey ? contentSha256 : undefined,
      idempotencyKey ? crypto.randomUUID() : undefined,
    );
    const fileStore = new R2EvidenceFileStore(context.env.EVIDENCE_FILES);
    const existing = await getEvidenceDraftUploadRecord(context.env.DB, user.id, id);
    if (existing) {
      if (
        idempotencyKey &&
        storageKeyPrefix &&
        existing.storageKey.startsWith(storageKeyPrefix) &&
        existing.draft.filename === metadata.filename &&
        existing.draft.file_size === metadata.size &&
        existing.draft.media_type === metadata.mediaType
      ) {
        const persistedObject = await fileStore.get(existing.storageKey);
        if (
          !persistedObject ||
          persistedObject.size !== metadata.size ||
          persistedObject.customMetadata?.contentSha256 !== contentSha256
        ) {
          return errorResponse(
            context,
            409,
            "EVIDENCE_UPLOAD_INCOMPLETE",
            "The existing evidence draft does not have a matching stored file.",
          );
        }
        return context.json({ ok: true, data: existing.draft }, 200);
      }
      return errorResponse(
        context,
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "The idempotency key was already used for another upload.",
      );
    }

    try {
      await fileStore.put(storageKey, fileBuffer, {
        contentSha256,
        contentType: metadata.mediaType,
        filename: metadata.filename,
        sha256: contentDigest,
      });
      const draft = await createEvidenceDraft(context.env.DB, {
        id,
        ownerUserId: user.id,
        storageKey,
        metadata,
        classification,
        extraction,
      });
      return context.json({ ok: true, data: draft }, 201);
    } catch (error) {
      const persisted = await getEvidenceDraftUploadRecord(
        context.env.DB,
        user.id,
        id,
      ).catch(() => null);
      if (
        idempotencyKey &&
        storageKeyPrefix &&
        persisted?.storageKey.startsWith(storageKeyPrefix) &&
        persisted.draft.filename === metadata.filename &&
        persisted.draft.file_size === metadata.size &&
        persisted.draft.media_type === metadata.mediaType
      ) {
        if (persisted.storageKey !== storageKey) {
          await deleteWithRetry(fileStore, storageKey);
        }
        const persistedObject = await fileStore.get(persisted.storageKey);
        if (
          !persistedObject ||
          persistedObject.size !== metadata.size ||
          persistedObject.customMetadata?.contentSha256 !== contentSha256
        ) {
          return errorResponse(
            context,
            409,
            "EVIDENCE_UPLOAD_INCOMPLETE",
            "The existing evidence draft does not have a matching stored file.",
          );
        }
        return context.json({ ok: true, data: persisted.draft }, 200);
      }
      await deleteWithRetry(fileStore, storageKey);
      if (idempotencyKey && persisted) {
        return errorResponse(
          context,
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "The idempotency key was already used for another upload.",
        );
      }
      throw error;
    }
  },
);

evidenceInboxRoutes.get("/:draftId/file", async (context) => {
  const user = context.get("authenticatedUser");
  const parsedId = uuidSchema.safeParse(context.req.param("draftId"));
  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  if (!context.env.EVIDENCE_FILES) {
    return errorResponse(
      context,
      503,
      "EVIDENCE_STORAGE_UNAVAILABLE",
      "Evidence file storage is not configured.",
    );
  }
  if (!parsedId.success) {
    return errorResponse(context, 400, "INVALID_DRAFT_ID", "The draft ID is invalid.");
  }
  const draft = await getEvidenceDraftFileRecord(
    context.env.DB,
    actorFromUser(user),
    parsedId.data,
  );
  if (!draft) {
    return errorResponse(context, 404, "DRAFT_NOT_FOUND", "The evidence draft was not found.");
  }
  const object = await new R2EvidenceFileStore(context.env.EVIDENCE_FILES).get(
    draft.storageKey,
  );
  if (!object) {
    return errorResponse(context, 404, "FILE_NOT_FOUND", "The evidence file was not found.");
  }
  return new Response(object.body, {
    headers: {
      "content-disposition": evidenceContentDisposition(draft.filename),
      "content-length": String(object.size),
      "content-type": draft.mediaType,
      "x-content-type-options": "nosniff",
    },
  });
});

evidenceInboxRoutes.patch("/bulk", async (context) => {
  const user = context.get("authenticatedUser");
  if (!user) {
    return errorResponse(
      context,
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(context, 400, "INVALID_BULK_ACTION", "The bulk action is invalid.");
  }
  const draftIds = Array.from(new Set(parsed.data.draft_ids));
  const drafts = await getOwnedDraftStorageRecords(context.env.DB, user.id, draftIds);
  if (drafts.length !== draftIds.length) {
    return errorResponse(context, 404, "DRAFT_NOT_FOUND", "One or more evidence drafts were not found.");
  }

  if (parsed.data.action === "delete") {
    if (!context.env.EVIDENCE_FILES) {
      return errorResponse(
        context,
        503,
        "EVIDENCE_STORAGE_UNAVAILABLE",
        "Evidence file storage is not configured.",
      );
    }
    const claimTimestamp = await claimEvidenceDrafts(
      context.env.DB,
      user.id,
      drafts,
    );
    if (!claimTimestamp) {
      return errorResponse(context, 409, "DRAFT_STATE_CHANGED", "One or more evidence drafts changed. Reload and try again.");
    }
    const fileStore = new R2EvidenceFileStore(context.env.EVIDENCE_FILES);
    try {
      await fileStore.delete(drafts.map((draft) => draft.storageKey));
    } catch (error) {
      await releaseEvidenceDraftClaims(
        context.env.DB,
        user.id,
        drafts,
        claimTimestamp,
      );
      throw error;
    }
    await deleteEvidenceDrafts(
      context.env.DB,
      user.id,
      draftIds,
      claimTimestamp,
    );
  } else if (parsed.data.action === "mark_reviewed") {
    const reviewed = await markEvidenceDraftsReviewed(context.env.DB, user.id, draftIds);
    if (reviewed !== draftIds.length) {
      return errorResponse(context, 409, "DRAFT_STATE_CHANGED", "One or more evidence drafts changed. Reload and try again.");
    }
  } else {
    const actor = actorFromUser(user);
    const caseRecord = await getCaseForActor(
      context.env.DB,
      actor,
      parsed.data.case_id!,
    );
    if (!caseRecord) {
      return errorResponse(context, 404, "CASE_NOT_FOUND", "The destination case was not found.");
    }
    const claimTimestamp = await claimEvidenceDrafts(
      context.env.DB,
      user.id,
      drafts,
    );
    if (!claimTimestamp) {
      return errorResponse(context, 409, "DRAFT_STATE_CHANGED", "One or more evidence drafts changed. Reload and try again.");
    }
    try {
      await moveDraftsToEvidence(context.env.DB, {
        ownerUserId: user.id,
        caseId: caseRecord.id,
        claimTimestamp,
        drafts,
        sourceOrigin: new URL(context.env.BETTER_AUTH_URL).origin,
      });
    } catch (error) {
      await releaseEvidenceDraftClaims(
        context.env.DB,
        user.id,
        drafts,
        claimTimestamp,
      );
      throw error;
    }
  }

  return context.json({
    ok: true,
    data: await listEvidenceDrafts(context.env.DB, user.id),
  });
});
