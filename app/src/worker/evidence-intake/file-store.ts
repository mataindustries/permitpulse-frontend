export interface EvidenceFileStore {
  put(
    key: string,
    body: ReadableStream | ArrayBuffer,
    metadata: {
      contentSha256: string;
      contentType: string;
      filename: string;
      sha256: ArrayBuffer;
    },
  ): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string[]): Promise<void>;
}

export class R2EvidenceFileStore implements EvidenceFileStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(
    key: string,
    body: ReadableStream | ArrayBuffer,
    metadata: {
      contentSha256: string;
      contentType: string;
      filename: string;
      sha256: ArrayBuffer;
    },
  ): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: {
        contentSha256: metadata.contentSha256,
        filename: metadata.filename,
      },
      sha256: metadata.sha256,
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
  contentFingerprint?: string,
  attemptId?: string,
): string {
  const safeFilename = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "evidence-file";

  const fingerprintPrefix = contentFingerprint
    ? `${contentFingerprint.slice(0, 64)}-${attemptId ? `${attemptId}-` : ""}`
    : "";

  return `${ownerUserId}/${draftId}/${fingerprintPrefix}${safeFilename}`;
}

export function evidenceStorageKeyPrefix(
  ownerUserId: string,
  draftId: string,
  contentFingerprint: string,
): string {
  return `${ownerUserId}/${draftId}/${contentFingerprint.slice(0, 64)}-`;
}

function asciiFilenameFallback(filename: string): string {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .slice(-120);

  return fallback || "evidence-file";
}

function utf8HeaderValue(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map((byte) => {
      const character = String.fromCharCode(byte);
      return /[a-zA-Z0-9._-]/.test(character)
        ? character
        : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .join("");
}

export function evidenceContentDisposition(filename: string): string {
  return `attachment; filename="${asciiFilenameFallback(filename)}"; filename*=UTF-8''${utf8HeaderValue(filename)}`;
}
