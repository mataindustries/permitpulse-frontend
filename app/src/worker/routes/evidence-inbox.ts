import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  deterministicEvidenceClassifier,
  evidenceFileExtension,
  isAcceptedEvidenceFile,
} from "../../shared/evidence-intake/classifier";
import { placeholderEvidenceExtractor } from "../../shared/evidence-intake/extractor";
import type { EvidenceFileMetadata } from "../../shared/evidence-intake/types";
import { actorFromUser } from "../cases/authorization";
import { getCaseForActor } from "../cases/repository";
import {
  evidenceStorageKey,
  R2EvidenceFileStore,
} from "../evidence-intake/file-store";
import {
  createEvidenceDraft,
  deleteEvidenceDrafts,
  getEvidenceDraftStorageRecord,
  getOwnedDraftStorageRecords,
  listEvidenceDrafts,
  markEvidenceDraftsReviewed,
  moveDraftsToEvidence,
} from "../evidence-intake/repository";
import { errorResponse } from "../lib/responses";
import { sessionMiddleware } from "../middleware/session";
import type { WorkerEnv } from "../types";

const maximumEvidenceFileBytes = 20 * 1024 * 1024;
const maximumUploadBodyBytes = maximumEvidenceFileBytes + 64 * 1024;
const uuidSchema = z.uuid();
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

const fallbackMediaTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  txt: "text/plain",
  eml: "message/rfc822",
};

export const evidenceInboxRoutes = new Hono<WorkerEnv>();

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
    if (
      file.name.length === 0 ||
      file.name.length > 255 ||
      file.size === 0 ||
      file.size > maximumEvidenceFileBytes ||
      !isAcceptedEvidenceFile(file.name)
    ) {
      return errorResponse(
        context,
        400,
        "INVALID_EVIDENCE_FILE",
        "Use a non-empty PDF, JPG, PNG, HEIC, TXT, or EML file up to 20 MB.",
      );
    }

    const rawLastModified = formData.get("last_modified");
    const parsedLastModified =
      typeof rawLastModified === "string" ? Number(rawLastModified) : NaN;
    const extension = evidenceFileExtension(file.name);
    const metadata: EvidenceFileMetadata = {
      filename: file.name,
      mediaType: file.type || fallbackMediaTypes[extension] || "application/octet-stream",
      size: file.size,
      lastModified:
        Number.isFinite(parsedLastModified) && parsedLastModified > 0
          ? parsedLastModified
          : null,
    };
    const classification = deterministicEvidenceClassifier.classify(metadata);
    const extraction = placeholderEvidenceExtractor.extract(
      metadata,
      classification,
    );
    const id = crypto.randomUUID();
    const storageKey = evidenceStorageKey(user.id, id, file.name);
    const fileStore = new R2EvidenceFileStore(context.env.EVIDENCE_FILES);

    try {
      await fileStore.put(storageKey, file.stream(), {
        contentType: metadata.mediaType,
        filename: metadata.filename,
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
      await fileStore.delete([storageKey]).catch(() => undefined);
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
  const draft = await getEvidenceDraftStorageRecord(
    context.env.DB,
    user.id,
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
  const safeFilename = draft.filename.replace(/["\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "content-disposition": `attachment; filename="${safeFilename}"`,
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
    await deleteEvidenceDrafts(context.env.DB, user.id, draftIds);
    await new R2EvidenceFileStore(context.env.EVIDENCE_FILES).delete(
      drafts.map((draft) => draft.storageKey),
    );
  } else if (parsed.data.action === "mark_reviewed") {
    await markEvidenceDraftsReviewed(context.env.DB, user.id, draftIds);
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
    await moveDraftsToEvidence(context.env.DB, {
      ownerUserId: user.id,
      caseId: caseRecord.id,
      drafts,
    });
  }

  return context.json({
    ok: true,
    data: await listEvidenceDrafts(context.env.DB, user.id),
  });
});
