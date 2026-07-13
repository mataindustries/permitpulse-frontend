import type {
  EvidenceDraftBulkAction,
  EvidenceDraftDto,
  EvidenceInboxResponse,
} from "../../shared/evidence-intake/types";
import { CaseApiError, requestJson } from "./cases";

interface UploadEnvelope {
  ok?: unknown;
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
}

export function evidenceDraftFileUrl(draftId: string): string {
  return `/api/v1/evidence-inbox/${encodeURIComponent(draftId)}/file`;
}

export function listEvidenceInbox(): Promise<EvidenceInboxResponse> {
  return requestJson<EvidenceInboxResponse>("/api/v1/evidence-inbox");
}

export function runEvidenceInboxBulkAction(input: {
  action: EvidenceDraftBulkAction;
  draft_ids: string[];
  case_id?: string;
}): Promise<EvidenceInboxResponse> {
  return requestJson<EvidenceInboxResponse>("/api/v1/evidence-inbox/bulk", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function uploadEvidenceFile(
  file: File,
  onProgress: (progress: number) => void,
  idempotencyKey: string,
): Promise<EvidenceDraftDto> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/evidence-inbox/upload");
    request.responseType = "json";
    request.setRequestHeader("accept", "application/json");
    request.setRequestHeader("idempotency-key", idempotencyKey);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });
    request.addEventListener("error", () => {
      reject(
        new CaseApiError(
          "network",
          "The evidence upload could not be completed.",
          0,
          "NETWORK_ERROR",
        ),
      );
    });
    request.addEventListener("load", () => {
      const envelope = request.response as UploadEnvelope | null;
      if (request.status < 200 || request.status >= 300) {
        const message =
          typeof envelope?.error?.message === "string"
            ? envelope.error.message
            : "The evidence file could not be uploaded.";
        reject(
          new CaseApiError(
            request.status === 401 ? "unauthorized" : "validation",
            message,
            request.status,
            typeof envelope?.error?.code === "string"
              ? envelope.error.code
              : undefined,
          ),
        );
        return;
      }
      if (!envelope || envelope.ok !== true || !envelope.data) {
        reject(
          new CaseApiError(
            "server",
            "The upload response was invalid.",
            request.status,
            "INVALID_RESPONSE",
          ),
        );
        return;
      }
      onProgress(100);
      resolve(envelope.data as EvidenceDraftDto);
    });
    const data = new FormData();
    data.append("file", file);
    request.send(data);
  });
}
