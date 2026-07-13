const canonicalMediaTypesByExtension = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  txt: "text/plain",
  eml: "message/rfc822",
} as const;

const compatibleDeclaredMediaTypes: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  heic: ["image/heic", "image/heif"],
  txt: ["text/plain"],
  eml: ["message/rfc822"],
};

const genericMediaTypes = new Set(["", "application/octet-stream"]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export const acceptedEvidenceExtensions = Object.freeze(
  Object.keys(canonicalMediaTypesByExtension),
);

export function evidenceFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function isAcceptedEvidenceFile(filename: string): boolean {
  return acceptedEvidenceExtensions.includes(evidenceFileExtension(filename));
}

export function canonicalEvidenceMediaType(filename: string): string | null {
  const extension = evidenceFileExtension(filename);
  return canonicalMediaTypesByExtension[
    extension as keyof typeof canonicalMediaTypesByExtension
  ] ?? null;
}

export function isSafeEvidenceFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    !/[\u0000-\u001f\u007f]/.test(filename) &&
    !/[\\/]/.test(filename) &&
    isAcceptedEvidenceFile(filename)
  );
}

function normalizedMediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return (
    bytes.length >= prefix.length &&
    prefix.every((value, index) => bytes[index] === value)
  );
}

function containsSequence(
  bytes: Uint8Array,
  sequence: readonly number[],
  start = 0,
): boolean {
  const finalStart = bytes.length - sequence.length;
  for (let offset = Math.max(0, start); offset <= finalStart; offset += 1) {
    if (sequence.every((value, index) => bytes[offset + index] === value)) {
      return true;
    }
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function isPdf(bytes: Uint8Array): boolean {
  const headerWindow = bytes.slice(0, Math.min(bytes.length, 1_024));
  const trailerStart = Math.max(0, bytes.length - 4_096);
  return (
    containsSequence(headerWindow, [0x25, 0x50, 0x44, 0x46, 0x2d]) &&
    containsSequence(bytes, [0x25, 0x25, 0x45, 0x4f, 0x46], trailerStart)
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  const trailerStart = Math.max(0, bytes.length - 32);
  return (
    hasPrefix(bytes, [0xff, 0xd8, 0xff]) &&
    containsSequence(bytes, [0xff, 0xd9], trailerStart)
  );
}

function isPng(bytes: Uint8Array): boolean {
  const trailerStart = Math.max(0, bytes.length - 64);
  return (
    hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    containsSequence(
      bytes,
      [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82],
      trailerStart,
    )
  );
}

function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") return false;

  const compatibleBrands = new Set([
    "heic",
    "heix",
    "hevc",
    "hevx",
    "heim",
    "heis",
    "mif1",
    "msf1",
  ]);
  const boxLength = Math.min(bytes.length, 64);
  for (let offset = 8; offset + 4 <= boxLength; offset += 4) {
    if (compatibleBrands.has(ascii(bytes, offset, 4))) return true;
  }
  return false;
}

function decodedText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;

  try {
    const text = utf8Decoder.decode(bytes);
    return /[\u0001-\u0008\u000b\u000e-\u001f\u007f]/.test(text)
      ? null
      : text;
  } catch {
    return null;
  }
}

function isEmail(bytes: Uint8Array): boolean {
  const text = decodedText(bytes);
  if (text === null) return false;

  const headerBlock = text.split(/\r?\n\r?\n/, 1)[0] ?? "";
  return /^(?:from|to|subject|date|message-id|mime-version):[^\r\n]+$/im.test(
    headerBlock,
  );
}

function contentMatchesExtension(extension: string, bytes: Uint8Array): boolean {
  switch (extension) {
    case "pdf":
      return isPdf(bytes);
    case "jpg":
    case "jpeg":
      return isJpeg(bytes);
    case "png":
      return isPng(bytes);
    case "heic":
      return isHeic(bytes);
    case "txt":
      return decodedText(bytes) !== null;
    case "eml":
      return isEmail(bytes);
    default:
      return false;
  }
}

export type EvidenceFileValidationResult =
  | { ok: true; mediaType: string }
  | {
      ok: false;
      reason: "invalid_filename" | "invalid_media_type" | "invalid_content";
    };

export function validateEvidenceFile(input: {
  bytes: Uint8Array;
  declaredMediaType: string;
  filename: string;
}): EvidenceFileValidationResult {
  if (!isSafeEvidenceFilename(input.filename)) {
    return { ok: false, reason: "invalid_filename" };
  }

  const extension = evidenceFileExtension(input.filename);
  const mediaType = canonicalEvidenceMediaType(input.filename);
  if (!mediaType) return { ok: false, reason: "invalid_filename" };

  const declaredMediaType = normalizedMediaType(input.declaredMediaType);
  if (
    !genericMediaTypes.has(declaredMediaType) &&
    !compatibleDeclaredMediaTypes[extension]?.includes(declaredMediaType)
  ) {
    return { ok: false, reason: "invalid_media_type" };
  }

  return contentMatchesExtension(extension, input.bytes)
    ? { ok: true, mediaType }
    : { ok: false, reason: "invalid_content" };
}
