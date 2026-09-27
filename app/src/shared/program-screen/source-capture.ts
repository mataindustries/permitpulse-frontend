import { z } from "zod";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import {
  officialSourceTypes,
  operativeSourceTypes,
  sourceOperativeStatuses,
  type OfficialSourceType,
  type ProgramCriterionHumanVerification,
  type SourceOperativeStatus,
} from "./types";

/**
 * Captured official sources live one directory per document:
 *
 *   official-sources/<source-id>/original.pdf    exact downloaded bytes
 *   official-sources/<source-id>/extracted.txt   deterministic text extraction
 *   official-sources/<source-id>/metadata.json   provenance and SHA-256 pins
 *
 * `app/scripts/capture-program-screen-source.ts` writes all three; nothing
 * edits them by hand. A human-verified criterion's supporting excerpt must
 * appear in `extracted.txt`, and every hash must match, so a later edit to any
 * file fails the tests.
 */
export const OFFICIAL_SOURCE_CAPTURE_DIR = "app/fixtures/program-screen/official-sources/";
/** Synthetic captures for tests. Never cited by a shipped criterion. */
export const TEST_ONLY_SOURCE_CAPTURE_DIR = "app/fixtures/program-screen/test-only-sources/";

export const captureFileNames = {
  original: "original.pdf",
  extracted: "extracted.txt",
  metadata: "metadata.json",
} as const;

export const OFFICIAL_SOURCE_METADATA_VERSION = "program-screen-official-source-v1" as const;
export const CAPTURE_TOOL_PATH = "app/scripts/capture-program-screen-source.ts" as const;

/**
 * Hosts whose documents may be captured as official sources: the City Clerk
 * (Council files and ordinances), City Planning, and California Legislative
 * Information. The capture tool never downloads; it ingests a local file and
 * records the official URL it was downloaded from.
 */
export const officialSourceHosts = [
  "cityclerk.lacity.org",
  "clkrep.lacity.org",
  "planning.lacity.gov",
  "leginfo.legislature.ca.gov",
] as const;

const TEST_ONLY_HOST_SUFFIX = ".example.test";
const TEST_ONLY_ID_PREFIX = "test-only-";

/**
 * Text extracted from PDFs and HTML wraps lines unpredictably. Only runs of
 * whitespace are collapsed; every other character must match exactly.
 */
export function normalizeSourceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function excerptAppearsInCapture(excerpt: string, captureText: string): boolean {
  const needle = normalizeSourceText(excerpt);
  return needle.length > 0 && normalizeSourceText(captureText).includes(needle);
}

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  return sha256HexBytes(new TextEncoder().encode(text));
}

/* ------------------------------------------------ deterministic extraction */

/**
 * Version of the extracted-text normalization below. Changing the rules means
 * a new version, a re-extraction of every capture, and a human re-review.
 */
export const EXTRACTED_TEXT_NORMALIZATION = "program-screen-text-v1" as const;

/** Pages are separated by a form feed on its own line. */
const PAGE_SEPARATOR = "\n\f\n";

/**
 * `program-screen-text-v1`, applied to one page of extractor output:
 * 1. CRLF and CR become LF.
 * 2. Non-whitespace control characters (such as NUL from an unmapped glyph)
 *    become U+FFFD, so the file stays plain text and the gap stays visible.
 * 3. Every other whitespace character, form feeds included, becomes a space.
 * 4. Runs of spaces collapse; each line is trimmed.
 * 5. Blank lines collapse to one; leading and trailing blank lines are dropped.
 *
 * Only whitespace and unrenderable control characters change.
 */
export function normalizeExtractedPage(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g, "�")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim());
  const kept: string[] = [];
  for (const line of lines) {
    if (line === "" && (kept.length === 0 || kept[kept.length - 1] === "")) continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return kept.join("\n");
}

/** Joins normalized pages; the result is the exact content of `extracted.txt`. */
export function joinExtractedPages(pages: readonly string[]): string {
  if (pages.length === 0) {
    throw new IntegrityValidationError(
      "EMPTY_SOURCE_EXTRACTION",
      "An extracted source must have at least one page.",
    );
  }
  return `${pages.map(normalizeExtractedPage).join(PAGE_SEPARATOR)}\n`;
}

/** Inverse of `joinExtractedPages`. Page 1 is index 0. */
export function splitExtractedPages(extracted: string): string[] {
  return extracted.replace(/\n$/, "").split(PAGE_SEPARATOR);
}

/** True when the text is exactly what `joinExtractedPages` would write. */
export function isNormalizedExtraction(extracted: string): boolean {
  if (!extracted.endsWith("\n")) return false;
  return joinExtractedPages(splitExtractedPages(extracted)) === extracted;
}

/** 1-based pages whose text contains the whole excerpt (whitespace-normalized). */
export function locateExcerptPages(excerpt: string, extracted: string): number[] {
  const needle = normalizeSourceText(excerpt);
  if (needle.length === 0) return [];
  return splitExtractedPages(extracted).flatMap((page, index) =>
    normalizeSourceText(page).includes(needle) ? [index + 1] : [],
  );
}

/* ------------------------------------------------------ source validation */

/** Null when the URL is an HTTPS URL on an official source host. */
export function officialSourceUrlIssue(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "is not a valid URL";
  }
  if (url.protocol !== "https:") return "must use HTTPS";
  if (url.username !== "" || url.password !== "") return "must not embed credentials";
  if (url.port !== "") return "must use the default HTTPS port";
  if (!(officialSourceHosts as readonly string[]).includes(url.hostname)) {
    return `host ${url.hostname} is not an official source host (${officialSourceHosts.join(", ")})`;
  }
  return null;
}

function testOnlyUrlIssue(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "is not a valid URL";
  }
  if (url.protocol !== "https:") return "must use HTTPS";
  if (!url.hostname.endsWith(TEST_ONLY_HOST_SUFFIX)) {
    return `must use an ${TEST_ONLY_HOST_SUFFIX} host for a test-only source`;
  }
  return null;
}

/**
 * A draft is only ever `proposed_not_operative`: if it is adopted, the adopted
 * instrument is captured as its own `adopted_ordinance` source. An adopted
 * ordinance or official memo is never recorded as proposed.
 */
export function sourceTypeStatusIssue(
  sourceType: OfficialSourceType,
  status: SourceOperativeStatus,
): string | null {
  if (sourceType === "proposed_draft" && status !== "proposed_not_operative") {
    return "A proposed draft must be recorded as proposed_not_operative.";
  }
  if (sourceType !== "proposed_draft" && status === "proposed_not_operative") {
    return `A ${sourceType} cannot be recorded as proposed_not_operative.`;
  }
  return null;
}

/** Whether a captured source can support a human-verified criterion rule. */
export function canSupportCriterionRule(metadata: {
  source_type: OfficialSourceType;
  operative_status: SourceOperativeStatus;
}): boolean {
  return (
    (operativeSourceTypes as readonly string[]).includes(metadata.source_type) &&
    metadata.operative_status === "operative"
  );
}

const sourceIdSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Source IDs are lowercase kebab-case.");
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
    },
    { message: "Dates must be valid ISO calendar dates." },
  );

export const officialSourceMetadataSchema = z
  .object({
    schema_version: z.literal(OFFICIAL_SOURCE_METADATA_VERSION),
    source_id: sourceIdSchema,
    title: z.string().trim().min(1).max(300),
    official_url: z.string().max(600),
    source_type: z.enum(officialSourceTypes),
    document_date: isoDate,
    retrieved_at: z.string().datetime({ offset: true }),
    sha256_original: hex64,
    sha256_extracted: hex64,
    operative_status: z.enum(sourceOperativeStatuses),
    notes: z.string().max(2000),
    /** Operative sources this document would change if adopted. */
    may_change_source_ids: z.array(sourceIdSchema),
    original: z
      .object({
        file: z.literal(captureFileNames.original),
        media_type: z.literal("application/pdf"),
        bytes: z.number().int().positive(),
      })
      .strict(),
    extraction: z
      .object({
        file: z.literal(captureFileNames.extracted),
        extractor: z.literal("pdfjs-dist"),
        extractor_version: z.string().regex(/^\d+\.\d+\.\d+$/),
        normalization: z.literal(EXTRACTED_TEXT_NORMALIZATION),
        page_separator: z.literal("form_feed"),
        page_count: z.number().int().positive(),
        pages_without_text: z.array(z.number().int().positive()),
      })
      .strict(),
    capture_tool: z.literal(CAPTURE_TOOL_PATH),
    is_ai_generated: z.literal(false),
    test_only: z.boolean(),
  })
  .strict()
  .superRefine((metadata, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    const testOnlyId = metadata.source_id.startsWith(TEST_ONLY_ID_PREFIX);
    if (metadata.test_only !== testOnlyId) {
      issue("source_id", `Only a test-only source may use the ${TEST_ONLY_ID_PREFIX} prefix, and it must.`);
    }
    const urlIssue = metadata.test_only
      ? testOnlyUrlIssue(metadata.official_url)
      : officialSourceUrlIssue(metadata.official_url);
    if (urlIssue !== null) issue("official_url", `The source URL ${urlIssue}.`);

    const statusIssue = sourceTypeStatusIssue(metadata.source_type, metadata.operative_status);
    if (statusIssue !== null) issue("operative_status", statusIssue);

    if (metadata.document_date > metadata.retrieved_at.slice(0, 10)) {
      issue("document_date", "A document cannot be dated after it was retrieved.");
    }
    const changes = metadata.may_change_source_ids;
    if (new Set(changes).size !== changes.length || changes.includes(metadata.source_id)) {
      issue("may_change_source_ids", "Changed sources must be unique and not the source itself.");
    }
    const { page_count: pageCount, pages_without_text: empty } = metadata.extraction;
    const ascending = empty.every((page, index) => index === 0 || page > empty[index - 1]);
    if (!ascending || empty.some((page) => page > pageCount)) {
      issue("extraction", "pages_without_text must be ascending page numbers within page_count.");
    }
    if (empty.length >= pageCount) {
      issue("extraction", "A capture needs extractable text; an image-only PDF needs a text layer or transcription.");
    }
  });

export type OfficialSourceMetadata = z.infer<typeof officialSourceMetadataSchema>;

export function parseOfficialSourceMetadata(value: unknown): OfficialSourceMetadata {
  const parsed = officialSourceMetadataSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IntegrityValidationError(
      "INVALID_OFFICIAL_SOURCE_METADATA",
      `Official source metadata failed validation at ${issue.path.join(".") || "metadata"}: ${issue.message}`,
    );
  }
  return parsed.data;
}

/** The capture directory, relative to the repository root, for a source. */
export function captureDirectoryFor(metadata: Pick<OfficialSourceMetadata, "source_id" | "test_only">): string {
  const root = metadata.test_only ? TEST_ONLY_SOURCE_CAPTURE_DIR : OFFICIAL_SOURCE_CAPTURE_DIR;
  return `${root}${metadata.source_id}`;
}

export interface OfficialSourceCaptureFiles {
  /** Capture directory relative to the repository root, without a trailing slash. */
  directory: string;
  metadata: unknown;
  original: Uint8Array | null;
  extracted: string | null;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

/**
 * Every reason a capture directory fails its pins. Empty means the metadata is
 * valid, sits in the right directory, and both files hash to their pins.
 */
export async function officialSourceCaptureIssues(
  files: OfficialSourceCaptureFiles,
): Promise<string[]> {
  const parsed = officialSourceMetadataSchema.safeParse(files.metadata);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `metadata.json ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
  }
  const metadata = parsed.data;
  const issues: string[] = [];

  if (files.directory !== captureDirectoryFor(metadata)) {
    issues.push(`metadata.json source_id ${metadata.source_id} does not match directory ${files.directory}.`);
  }

  if (files.original === null) {
    issues.push("original.pdf is missing.");
  } else {
    if (!isPdf(files.original)) issues.push("original.pdf is not a PDF file.");
    if (files.original.byteLength !== metadata.original.bytes) {
      issues.push("original.pdf size does not match metadata.json.");
    }
    if ((await sha256HexBytes(files.original)) !== metadata.sha256_original) {
      issues.push("original.pdf does not match sha256_original.");
    }
  }

  if (files.extracted === null) {
    issues.push("extracted.txt is missing.");
  } else {
    if ((await sha256Hex(files.extracted)) !== metadata.sha256_extracted) {
      issues.push("extracted.txt does not match sha256_extracted.");
    }
    if (!isNormalizedExtraction(files.extracted)) {
      issues.push(`extracted.txt is not in ${EXTRACTED_TEXT_NORMALIZATION} form.`);
    }
    const pages = splitExtractedPages(files.extracted);
    if (pages.length !== metadata.extraction.page_count) {
      issues.push("extracted.txt page count does not match metadata.json.");
    }
    const empty = pages.flatMap((page, index) => (page === "" ? [index + 1] : []));
    if (JSON.stringify(empty) !== JSON.stringify(metadata.extraction.pages_without_text)) {
      issues.push("extracted.txt empty pages do not match pages_without_text.");
    }
  }
  return issues;
}

/**
 * Ties a human-verification record to the capture it cites. The record's own
 * source type and status are self-declared; this checks them, its hash, URL,
 * and excerpt against the capture so a draft cannot be relabeled operative.
 */
export function humanRecordCaptureIssues(
  record: ProgramCriterionHumanVerification,
  capture: { metadata: OfficialSourceMetadata; extracted: string },
): string[] {
  const { metadata } = capture;
  const cited = record.source_capture;
  const issues: string[] = [];
  if (!canSupportCriterionRule(metadata)) {
    issues.push(
      `The capture is a ${metadata.source_type} recorded as ${metadata.operative_status}; it cannot support a rule.`,
    );
  }
  if (cited.repo_path !== `${captureDirectoryFor(metadata)}/${captureFileNames.extracted}`) {
    issues.push("The record does not cite this capture's extracted text.");
  }
  if (cited.sha256 !== metadata.sha256_extracted) {
    issues.push("The record's SHA-256 does not pin the captured extracted text.");
  }
  if (cited.source_type !== metadata.source_type || cited.operative_status !== metadata.operative_status) {
    issues.push("The record's source type or operative status differs from the capture metadata.");
  }
  if (cited.retrieved_at !== metadata.retrieved_at) {
    issues.push("The record's retrieval time differs from the capture metadata.");
  }
  if (cited.capture_method !== "pdf_text_extraction") {
    issues.push("A captured PDF must be recorded as pdf_text_extraction.");
  }
  if (record.source_url !== metadata.official_url) {
    issues.push("The record's source URL differs from the capture's official URL.");
  }
  if (!excerptAppearsInCapture(record.supporting_excerpt, capture.extracted)) {
    issues.push("The supporting excerpt does not appear in the captured text.");
  }
  return issues;
}
