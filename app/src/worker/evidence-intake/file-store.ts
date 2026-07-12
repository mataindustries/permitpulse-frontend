import type { Bindings } from "../types";

export interface EvidenceFileStore {
  put(
    key: string,
    body: ReadableStream | ArrayBuffer,
    metadata: { contentType: string; filename: string },
  ): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string[]): Promise<void>;
}

export class R2EvidenceFileStore implements EvidenceFileStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(
    key: string,
    body: ReadableStream | ArrayBuffer,
    metadata: { contentType: string; filename: string },
  ): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: { filename: metadata.filename },
    });
  }

  get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.bucket.delete(keys);
    }
  }
}

export function evidenceStorageKey(
  ownerUserId: string,
  draftId: string,
  filename: string,
): string {
  const safeFilename = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "evidence-file";

  return `${ownerUserId}/${draftId}/${safeFilename}`;
}
