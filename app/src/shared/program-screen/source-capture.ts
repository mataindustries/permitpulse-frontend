import { z } from "zod";
import { httpCaptureSchema, httpCaptureIssues } from "./http-capture";
import {
  FILEGDB_EXTRACTOR,
  FILEGDB_VERSION,
  extractFileGdbPages,
  LRA_DIRECTORY,
  LRA_LAYER,
  LRA_METADATA_SHA256,
} from "./filegdb-capture";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import type { ReviewedAuthoritySource } from "./authority-policy";
import {
  extractDatasetArchivePages,
  isZip,
  readDatasetArchiveSummary,
  ZIP_MANIFEST_EXTRACTOR,
  ZIP_MANIFEST_EXTRACTOR_VERSION,
} from "./dataset-archive";
import {
  operativeSourceTypes,
  sourceOperativeStatuses,
  type OfficialSourceType,
  type ProgramCriterionHumanVerification,
  type ProgramFactKey,
  type SourceOperativeStatus,
} from "./types";

/**
 * Captured official sources live one directory per document:
 *
 *   official-sources/<source-id>/original.pdf    exact downloaded bytes
 *     (or original.html: a statute page, exactly as the official host served it;
 *      or original.zip: a GIS data archive, exactly as served, Phase 3D)
 *   official-sources/<source-id>/extracted.txt   deterministic text extraction
 *   official-sources/<source-id>/metadata.json   provenance and SHA-256 pins
 *
 * `app/scripts/capture-program-screen-source.ts` writes all three; nothing
 * edits them by hand. A human-verified criterion's supporting excerpt must
 * appear in `extracted.txt`, and every hash must match, so a later edit to any
 * file fails the tests.
 *
 * Metadata v1 (ordinances, memos, drafts) is frozen. Metadata v2 (Phase 2b,
 * docs/PROGRAM_SCREEN_SOURCE_CAPTURE_2B.md) adds agency maps and statutes, and
 * Phase 3D (docs/PROGRAM_SCREEN_PHASE_3D_CALFIRE_SRA_PACKAGE.md) adds adopted
 * regulations and GIS data archives. A capture is only a pinned copy: it never
 * registers an issuer or authority source, never supports a criterion rule,
 * and never establishes a fact.
 */
export const OFFICIAL_SOURCE_CAPTURE_DIR = "app/fixtures/program-screen/official-sources/";
/** Synthetic captures for tests. Never cited by a shipped criterion. */
export const TEST_ONLY_SOURCE_CAPTURE_DIR = "app/fixtures/program-screen/test-only-sources/";

export const captureFileNames = {
  original: "original.pdf",
  extracted: "extracted.txt",
  metadata: "metadata.json",
} as const;

/**
 * The forms an original may take. HTML is accepted for a v2 statute only, a
 * ZIP for a v2 data archive only.
 */
export const captureOriginals = {
  pdf: { file: "original.pdf", media_type: "application/pdf" },
  html: { file: "original.html", media_type: "text/html" },
  zip: { file: "original.zip", media_type: "application/zip" },
} as const;

export const OFFICIAL_SOURCE_METADATA_VERSION = "program-screen-official-source-v1" as const;
export const OFFICIAL_SOURCE_METADATA_V2_VERSION = "program-screen-official-source-v2" as const;
export const CAPTURE_TOOL_PATH = "app/scripts/capture-program-screen-source.ts" as const;

/** Source types metadata v1 records. Frozen: v1 never gains a type. */
export const v1SourceTypes = [
  "adopted_ordinance",
  "official_memo",
  "proposed_draft",
] as const satisfies readonly OfficialSourceType[];
/** Source types metadata v2 records: agency maps and statutes (Phase 2b), regulations and data archives (Phase 3D). */
export const v2SourceTypes = ["agency_map", "statute", "regulation", "dataset_archive"] as const satisfies readonly OfficialSourceType[];
/** v2 types whose document may print no date of its own (Phase 3D): `document_date` is then null. */
export const undatedSourceTypes = ["regulation", "dataset_archive"] as const satisfies readonly V2SourceType[];
export type V2SourceType = (typeof v2SourceTypes)[number];

/**
 * Hosts whose documents may be captured as official sources: the City Clerk
 * (Council files and ordinances), City Planning, and California Legislative
 * Information. The capture tool never downloads; it ingests a local file and
 * records the official URL it was downloaded from. Any other host needs a
 * reviewed, source-specific exception (`sourceHostExceptions`); this list is
 * never broadened for one source (D11).
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

/* --------------------------------------------- served-HTML statute capture */

/**
 * Extractor for a statute page captured as the exact HTML bytes the official
 * host served (B1). Changing any rule below means a new version, a
 * re-extraction of every HTML capture, and a human re-review.
 */
export const HTML_TEXT_EXTRACTOR = "program-screen-html-text" as const;
export const HTML_TEXT_EXTRACTOR_VERSION = "1.0.0" as const;

/** Strict UTF-8 decoding that keeps a byte-order mark; null when not UTF-8. */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}

const HTML_DOCUMENT_START = /^﻿?\s*(?:<\?xml[^>]*\?>\s*)?(?:<!doctype\s+html\b|<html[\s>])/i;
const DECLARED_CHARSET = /<meta\b[^>]*?\bcharset\s*=\s*["']?\s*([a-z0-9_.:-]+)/gi;
/**
 * Markers that browser "Save page" tools write into a copy. A tripwire only:
 * the rule (B1) is to capture the exact bytes downloaded from the official
 * host, never a browser-generated or modified copy.
 */
const BROWSER_SAVE_MARKERS: ReadonlyArray<[RegExp, string]> = [
  [/<!--\s*saved from url=/i, "a browser save-page marker (saved from url)"],
  [/<!--\s*Page saved with SingleFile/i, "a SingleFile save-page marker"],
];

/** Why bytes are not an acceptable served-HTML capture, or null. */
export function htmlCaptureIssue(bytes: Uint8Array): string | null {
  const text = decodeUtf8Strict(bytes);
  if (text === null) return "is not valid UTF-8";
  if (!HTML_DOCUMENT_START.test(text)) return "is not an HTML document";
  for (const match of text.matchAll(DECLARED_CHARSET)) {
    if (!["utf-8", "utf8"].includes(match[1].toLowerCase())) {
      return `declares charset ${match[1]}; only UTF-8 is accepted`;
    }
  }
  for (const [marker, name] of BROWSER_SAVE_MARKERS) {
    if (marker.test(text)) return `carries ${name}; capture the bytes the official host served, not a browser copy`;
  }
  return null;
}

export function isHtml(bytes: Uint8Array): boolean {
  return htmlCaptureIssue(bytes) === null;
}

/** Elements whose start or end tag ends a line. Every other tag is dropped. */
const HTML_LINE_BREAK_TAGS: ReadonlySet<string> = new Set([
  "address", "article", "aside", "blockquote", "body", "br", "caption", "dd", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head",
  "header", "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td",
  "tfoot", "th", "thead", "title", "tr", "ul",
]);

/** The only named character references decoded; any other stays as written. */
const HTML_NAMED_REFERENCES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  para: "¶",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
};

const HTML_TAG = /<\/?([a-z][a-z0-9-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

function decodeCharacterReference(reference: string, body: string): string {
  if (body.startsWith("#")) {
    const hex = body[1] === "x" || body[1] === "X";
    const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return "\ufffd";
    }
    return String.fromCodePoint(code);
  }
  return HTML_NAMED_REFERENCES[body] ?? reference;
}

/**
 * `program-screen-html-text` 1.0.0: the text of a served HTML page, as one
 * page for `joinExtractedPages`.
 * 1. A leading byte-order mark is dropped.
 * 2. Comments, and script, style, and template elements with their content,
 *    are removed; so are the doctype, other `<!...>` declarations, and
 *    processing instructions.
 * 3. A start or end tag of a block element (`HTML_LINE_BREAK_TAGS`) becomes a
 *    line break; every other tag is removed. Quoted attribute values may
 *    contain `>`.
 * 4. Decimal and hexadecimal character references, and the named references
 *    in `HTML_NAMED_REFERENCES`, are decoded in a single pass (so `&amp;lt;`
 *    becomes `&lt;`). An invalid code point becomes U+FFFD; an unlisted named
 *    reference stays as written.
 * Whitespace is then normalized by `program-screen-text-v1`.
 */
export function extractHtmlPages(html: string): string[] {
  const text = html
    .replace(/^﻿/, "")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<![^>]*>|<\?[\s\S]*?(?:\?>|$)/g, "")
    .replace(HTML_TAG, (_tag, name: string) => (HTML_LINE_BREAK_TAGS.has(name.toLowerCase()) ? "\n" : ""))
    .replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g, decodeCharacterReference);
  return [text];
}

/* ------------------------------------------ source-specific host exceptions */

/**
 * A reviewed exception that lets ONE v2 capture use ONE host that is not on
 * the global allowlist (D11). It covers only its own `source_id` and
 * `source_type`, only on its exact host, and only under its path. It never
 * widens `officialSourceHosts`, and a v1 capture can never use one.
 */
export interface SourceHostException {
  exception_id: string;
  source_id: string;
  source_type: V2SourceType;
  /** One exact lowercase hostname: no wildcard, port, or IP address. */
  host: string;
  /** A normalized absolute path: a single file, or a directory ending in "/". Never "/". */
  path_prefix: string;
  /** The agency that publishes on the host. Display only. */
  operator: string;
  reason: string;
  review: {
    reviewer: { kind: "human"; name: string; role: string };
    reviewed_on: string;
    decision_ref: { round: number; letter: string } | null;
  };
}

/** CAL FIRE's Azure CDN endpoint, which serves the media the official CAL FIRE / OSFM pages link to. */
const CALFIRE_CDN_HOST = "34c031f8-c9fd-4018-8c5a-4159cdff6b0d-cdn-endpoint.azureedge.net";
const PHASE_3D_REVIEW = {
  reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
  reviewed_on: "2026-09-29",
  decision_ref: null,
} as const;
const PHASE_3D_CDN_REASON =
  "Phase 3D decision D1: the current official CAL FIRE / OSFM Fire Hazard Severity Zones pages link to this exact file. " +
  "One exact path for one package member; the CDN hostname is not trusted for anything else.";

/**
 * Each real exception is added only after its exact official source, host,
 * and path are identified and a named human reviewer explicitly approves it
 * (Phase 2b decision B2). Phase 3D D1 approved exactly these three: one
 * exact file path each, for the three CAL FIRE SRA package members. Phase 3G
 * adds the owner-approved exact combined LRA vector path. The scanned OAL
 * Notice of Approval is not a package member and has none.
 */
export const sourceHostExceptions: readonly SourceHostException[] = [
  {
    exception_id: "calfire-cdn-sra-fhsz-statewide-map",
    source_id: "calfire-sra-fhsz-map-2023-09-29",
    source_type: "agency_map",
    host: CALFIRE_CDN_HOST,
    path_prefix:
      "/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhsz_statewide_sra_e_2022_3.pdf",
    operator: "California Department of Forestry and Fire Protection (CAL FIRE), Office of the State Fire Marshal",
    reason: PHASE_3D_CDN_REASON,
    review: PHASE_3D_REVIEW,
  },
  {
    exception_id: "calfire-cdn-fhsz-sra-final-text",
    source_id: "ccr-19-2201-fhsz-sra-final-text",
    source_type: "regulation",
    host: CALFIRE_CDN_HOST,
    path_prefix: "/-/media/osfm-website/what-we-do/code-development-and-analysis/title-19-development/fhsz-2024/final-text.pdf",
    operator: "California Department of Forestry and Fire Protection (CAL FIRE), Office of the State Fire Marshal",
    reason: PHASE_3D_CDN_REASON,
    review: PHASE_3D_REVIEW,
  },
  {
    exception_id: "calfire-cdn-fhszsra-23-3-data",
    source_id: "calfire-fhszsra-23-3-data",
    source_type: "dataset_archive",
    host: CALFIRE_CDN_HOST,
    path_prefix: "/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhszsra_23_3.zip",
    operator: "California Department of Forestry and Fire Protection (CAL FIRE), Office of the State Fire Marshal",
    reason: PHASE_3D_CDN_REASON,
    review: PHASE_3D_REVIEW,
  },
  {
    exception_id: "calfire-cdn-fhszlra-25-1-all-data",
    source_id: "calfire-fhszlra-25-1-all-data",
    source_type: "dataset_archive",
    host: CALFIRE_CDN_HOST,
    path_prefix: "/-/media/osfm-website/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones/fhszlra251allgdb.zip",
    operator: "California Department of Forestry and Fire Protection (CAL FIRE), Office of the State Fire Marshal",
    reason: "Phase 3G owner-approved Route 1 package and exact original 3G-1 URL. The official FHSZ page links this exact combined 2025 LRA vector archive. One source/path only; no other CDN artifact is authorized.",
    review: {
      reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
      reviewed_on: "2026-09-30",
      decision_ref: null,
    },
  },
];

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
const shortText = z.string().trim().min(1).max(300);

/** Lowercase labels; the last label starts with a letter, so an IP address never matches. */
const EXACT_HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isNormalizedPathPrefix(prefix: string): boolean {
  if (!prefix.startsWith("/") || prefix === "/" || /[?#\\%]/.test(prefix)) return false;
  try {
    return new URL(prefix, "https://host.invalid").pathname === prefix;
  } catch {
    return false;
  }
}

export const sourceHostExceptionsSchema = z
  .array(
    z
      .object({
        exception_id: sourceIdSchema,
        source_id: sourceIdSchema,
        source_type: z.enum(v2SourceTypes),
        host: z
          .string()
          .regex(EXACT_HOSTNAME, "A host exception names one exact lowercase hostname: no wildcard, port, or IP address."),
        path_prefix: z.string().max(300),
        operator: shortText,
        reason: z.string().trim().min(1).max(1000),
        review: z
          .object({
            reviewer: z.object({ kind: z.literal("human"), name: shortText, role: shortText }).strict(),
            reviewed_on: isoDate,
            decision_ref: z
              .object({ round: z.number().int().positive(), letter: z.string().regex(/^[a-z]$/) })
              .strict()
              .nullable(),
          })
          .strict(),
      })
      .strict(),
  )
  .superRefine((exceptions, context) => {
    const issue = (path: Array<string | number>, message: string) =>
      context.addIssue({ code: "custom", path, message });
    exceptions.forEach((exception, index) => {
      if ((officialSourceHosts as readonly string[]).includes(exception.host)) {
        issue([index, "host"], "A host on the global allowlist needs no exception.");
      }
      if (exception.host === TEST_ONLY_HOST_SUFFIX.slice(1) || exception.host.endsWith(TEST_ONLY_HOST_SUFFIX)) {
        issue([index, "host"], "A test-only host is never an official source exception.");
      }
      if (exception.source_id.startsWith(TEST_ONLY_ID_PREFIX)) {
        issue([index, "source_id"], "A test-only source never takes an official host exception.");
      }
      if (!isNormalizedPathPrefix(exception.path_prefix)) {
        issue(
          [index, "path_prefix"],
          "The path prefix is a normalized absolute path other than /, without a query, fragment, or percent-encoding.",
        );
      }
    });
    const exceptionIds = exceptions.map((exception) => exception.exception_id);
    if (new Set(exceptionIds).size !== exceptionIds.length) issue([], "Exception IDs must be unique.");
    const sourceIds = exceptions.map((exception) => exception.source_id);
    if (new Set(sourceIds).size !== sourceIds.length) issue([], "A source has at most one host exception.");
  });

export function parseSourceHostExceptions(value: readonly SourceHostException[]): readonly SourceHostException[] {
  const parsed = sourceHostExceptionsSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IntegrityValidationError(
      "INVALID_SOURCE_HOST_EXCEPTION",
      `Source host exceptions failed validation at ${issue.path.join(".") || "exceptions"}: ${issue.message}`,
    );
  }
  return value;
}

function exceptionCovers(exception: SourceHostException, url: URL): boolean {
  if (url.hostname !== exception.host) return false;
  return exception.path_prefix.endsWith("/")
    ? url.pathname.startsWith(exception.path_prefix)
    : url.pathname === exception.path_prefix;
}

/* ------------------------------------------------------ source validation */

function httpsUrl(value: string): URL | string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "is not a valid URL";
  }
  if (url.protocol !== "https:") return "must use HTTPS";
  if (url.username !== "" || url.password !== "") return "must not embed credentials";
  if (url.port !== "") return "must use the default HTTPS port";
  return url;
}

function notOfficialHost(hostname: string): string {
  return `host ${hostname} is not an official source host (${officialSourceHosts.join(", ")})`;
}

/**
 * Null when the URL is an HTTPS URL on a globally allowed official source
 * host. Never consults `sourceHostExceptions`: an exception is never global.
 */
export function officialSourceUrlIssue(value: string): string | null {
  const url = httpsUrl(value);
  if (typeof url === "string") return url;
  if (!(officialSourceHosts as readonly string[]).includes(url.hostname)) return notOfficialHost(url.hostname);
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

/** Which rule admitted a v2 capture's host; recorded in its metadata. */
export type CaptureHostBasis = "global_allowlist" | "test_only_host" | { exception_id: string };

export type CaptureHostResolution = { basis: CaptureHostBasis; issue: null } | { basis: null; issue: string };

/**
 * Resolves the host of one capture's URL: the global allowlist, the
 * test-only suffix, or the single reviewed exception for this exact source.
 * An exception for any other source, type, host, or path never applies, and
 * a v1 source type never uses one.
 */
export function captureHostBasis(
  value: string,
  capture: { source_id: string; source_type: OfficialSourceType; test_only: boolean;
  },
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): CaptureHostResolution {
  if (capture.test_only) {
    const issue = testOnlyUrlIssue(value);
    return issue === null ? { basis: "test_only_host", issue: null } : { basis: null, issue };
  }
  const url = httpsUrl(value);
  if (typeof url === "string") return { basis: null, issue: url };
  if ((officialSourceHosts as readonly string[]).includes(url.hostname)) {
    return { basis: "global_allowlist", issue: null };
  }
  const refusal = notOfficialHost(url.hostname);
  if (!(v2SourceTypes as readonly string[]).includes(capture.source_type)) return { basis: null, issue: refusal };
  const exception = exceptions.find((candidate) => candidate.source_id === capture.source_id);
  if (exception === undefined) {
    return { basis: null, issue: `${refusal}, and no reviewed host exception covers source ${capture.source_id}` };
  }
  if (exception.source_type !== capture.source_type) {
    return {
      basis: null,
      issue: `${refusal}; host exception ${exception.exception_id} covers a ${exception.source_type}, not a ${capture.source_type}`,
    };
  }
  if (!exceptionCovers(exception, url)) {
    return {
      basis: null,
      issue: `${refusal}; host exception ${exception.exception_id} covers only https://${exception.host}${exception.path_prefix}`,
    };
  }
  return { basis: { exception_id: exception.exception_id }, issue: null };
}

/**
 * A draft is only ever `proposed_not_operative`: if it is adopted, the adopted
 * instrument is captured as its own `adopted_ordinance` source. An adopted
 * ordinance, official memo, or statute is never recorded as proposed. An
 * agency map may be: a map published as recommended or proposed rather than
 * in effect (B7). Such a map can never be registered or establish a fact.
 */
export function sourceTypeStatusIssue(
  sourceType: OfficialSourceType,
  status: SourceOperativeStatus,
): string | null {
  if (sourceType === "proposed_draft" && status !== "proposed_not_operative") {
    return "A proposed draft must be recorded as proposed_not_operative.";
  }
  if (sourceType === "agency_map") return null;
  if (sourceType !== "proposed_draft" && status === "proposed_not_operative") {
    return `A ${sourceType} cannot be recorded as proposed_not_operative.`;
  }
  return null;
}

/**
 * Whether a captured source can support a human-verified criterion rule.
 * Only an operative adopted ordinance or official memo can (B4): an agency
 * map or statute capture never can.
 */
export function canSupportCriterionRule(metadata: {
  source_type: OfficialSourceType;
  operative_status: SourceOperativeStatus;
}): boolean {
  return (
    (operativeSourceTypes as readonly string[]).includes(metadata.source_type) &&
    metadata.operative_status === "operative"
  );
}

/* ------------------------------------------------------ metadata v1 (frozen) */

export const officialSourceMetadataV1Schema = z
  .object({
    schema_version: z.literal(OFFICIAL_SOURCE_METADATA_VERSION),
    source_id: sourceIdSchema,
    title: z.string().trim().min(1).max(300),
    official_url: z.string().max(600),
    source_type: z.enum(v1SourceTypes),
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

/* ---------------------------------------- metadata v2: agency map, statute */

/** Text quoted exactly from one page of the capture's extracted text. */
const pageExcerptSchema = z
  .object({ page: z.number().int().positive(), text: z.string().trim().min(1).max(2000) })
  .strict();

/**
 * How a map labels its edition date. `dated` (Phase 3D D4): the map prints a
 * bare date, which the adopting text calls the date the map is "dated"; it is
 * never relabeled as issued, published, or adopted.
 */
export const mapEditionDateKinds = ["effective", "adopted", "published", "issued", "dated"] as const;
export const responsibilityAreas = ["state", "local", "federal"] as const;
export const mapLegendClasses = ["very_high", "high", "moderate"] as const;
export const mapSupersessionStatements = ["stated_current", "stated_superseded", "not_stated"] as const;
export type MapLegendClass = (typeof mapLegendClasses)[number];

/**
 * What the capturer located in an agency map, each item pinned to text on
 * its page. It records what the map prints, not a conclusion: whether the
 * map can establish anything is decided at a separate, reviewed registration
 * (`authoritySourceCaptureIssues`). The legend must be in this same capture
 * (B5); a legend in another document is not linked.
 */
export const agencyMapCaptureContextSchema = z
  .object({
    issuing_agency: z.object({ name: shortText, excerpt: pageExcerptSchema.nullable() }).strict(),
    edition: z
      .object({
        label: shortText.nullable(),
        date: isoDate.nullable(),
        date_kind: z.enum(mapEditionDateKinds).nullable(),
        excerpt: pageExcerptSchema.nullable(),
      })
      .strict(),
    /**
     * Context, recorded only when the map itself states it: each responsibility
     * area the map shows, with the hazard classes its legend lists for it.
     * Empty: the map states none. Never a registration condition (Phase 3B d).
     */
    responsibility_areas: z
      .array(
        z
          .object({
            area: z.enum(responsibilityAreas),
            legend_classes: z.array(z.enum(mapLegendClasses)).min(1).max(mapLegendClasses.length),
            excerpts: z.array(pageExcerptSchema).min(1).max(10),
          })
          .strict(),
      )
      .max(responsibilityAreas.length),
    /**
     * The hazard classes the map's legend lists, recorded for the map as a
     * whole when the legend is not tied to a stated responsibility area.
     * Absent: not recorded this way.
     */
    legend: z
      .object({
        classes: z.array(z.enum(mapLegendClasses)).min(1).max(mapLegendClasses.length),
        excerpts: z.array(pageExcerptSchema).min(1).max(10),
      })
      .strict()
      .optional(),
    supersession: z
      .object({ statement: z.enum(mapSupersessionStatements), excerpt: pageExcerptSchema.nullable() })
      .strict(),
  })
  .strict();

export type AgencyMapCaptureContext = z.infer<typeof agencyMapCaptureContextSchema>;

/** `code_section_page`: the leginfo code-section page, as served HTML. `official_pdf`: a PDF the official source itself supplies. */
export const statuteForms = ["code_section_page", "official_pdf"] as const;
export const STATUTE_CODE_SECTION_PAGE_PATH = "/faces/codes_displaySection.xhtml";

/**
 * Which statute section a capture holds, pinned three ways: the URL requests
 * exactly that code and section, the section heading is a whole line of the
 * text, and each pinpoint's excerpt follows the heading.
 */
export const statuteCaptureContextSchema = z
  .object({
    jurisdiction: z.literal("CA"),
    code: z.string().regex(/^[A-Z]{2,5}$/, "A code is its leginfo lawCode, such as GOV."),
    section: z.string().max(20).regex(/^\d+(?:\.\d+)*$/, "A section is its number, such as 66499.41."),
    form: z.enum(statuteForms),
    section_heading: pageExcerptSchema,
    pinpoints: z
      .array(
        z
          .object({
            pinpoint: z.string().max(40).regex(
                /^(?:section|(?:\([a-z0-9]+\))+)$/,
                "Use section for an unnumbered section, or a pinpoint like (a)(9).",
              ),
            excerpt: pageExcerptSchema,
          })
          .strict(),
      )
      .min(1)
      .max(20),
    /** The source's own history or effective-date note, if it prints one. */
    status_as_published: pageExcerptSchema.nullable(),
  })
  .strict();

export type StatuteCaptureContext = z.infer<typeof statuteCaptureContextSchema>;

/**
 * Which regulation section a capture holds (Phase 3D): an official PDF of an
 * adopted regulation's text, pinned to one section of the California Code of
 * Regulations. Text extraction drops strike-through and underline, so a
 * document that also prints repealed text is read only inside the pinned
 * section (`regulationSectionPages`).
 */
export const regulationCaptureContextSchema = z
  .object({
    jurisdiction: z.literal("CA"),
    code: z.literal("CCR"),
    title: z.string().regex(/^[1-9]\d?$/, "A CCR title is its number, such as 19."),
    section: z.string().max(20).regex(/^\d+(?:\.\d+)*$/, "A section is its number, such as 2201."),
    /** How the document labels itself, as printed. */
    document_label: pageExcerptSchema,
    /** A heading naming the title, such as "Title 19 Public Safety". */
    title_heading: pageExcerptSchema,
    /** The section heading: a whole line reading "<section>. <caption>". */
    section_heading: pageExcerptSchema,
    /** The document's own statement of the section's effect, if it prints one. */
    status_as_published: pageExcerptSchema.nullable(),
  })
  .strict();

export type RegulationCaptureContext = z.infer<typeof regulationCaptureContextSchema>;

const labelCountSchema = z.object({ label: z.string().min(1).max(60), count: z.number().int().positive() }).strict();
const datasetFieldName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);

/**
 * What a GIS data archive holds (Phase 3D), each item checked against the
 * extractor's own summary of the archive. It records what the archive
 * contains, not a conclusion: which labels mean which hazard class, and what
 * the archive can establish, are decided by a reviewed authority package.
 */
export const datasetArchiveCaptureContextSchema = z
  .object({
    /** The layer's base name: its .shp, .shx, .dbf, and .prj members are the layer. */
    dataset_name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    title: pageExcerptSchema,
    publisher: z.object({ name: shortText, excerpt: pageExcerptSchema }).strict(),
    crs: z.object({ epsg: z.number().int().positive(), excerpt: pageExcerptSchema }).strict(),
    geometry: z
      .object({ shape_type: z.enum(["Polygon", "PolygonZ", "PolygonM", "MultiPolygon"]), feature_count: z.number().int().positive() })
      .strict(),
    /** The attribute that carries each feature's class, and every value it takes, with counts. */
    class_field: z.object({ field: datasetFieldName, values: z.array(labelCountSchema).min(1).max(10) }).strict(),
    /** An attribute every feature carries with the same single value: the area the layer maps. */
    extent_field: z.object({ field: datasetFieldName, values: z.array(labelCountSchema).length(1) }).strict(),
    /** The archive's own statement of its status, if it states one. */
    status_as_published: pageExcerptSchema.nullable(),
    /**
     * Metadata fields kept byte for byte but never relied on (stale or
     * contradictory), by their extracted path, such as
     * /metadata/dataIdInfo/idCitation/date/pubDate.
     */
    non_authoritative: z
      .array(z.object({ path: z.string().max(200).regex(/^(?:\/[A-Za-z_][\w.:-]*)+(?:@[A-Za-z_][\w.:-]*)?$/), reason: shortText }).strict())
      .max(20),
    file_geodatabase: z
      .object({
        directory: z.literal(LRA_DIRECTORY),
        metadata_fid: z.literal(3),
        metadata_sha256: z.literal(LRA_METADATA_SHA256),
        definition_sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict()
      .optional(),
  })
  .strict();

export type DatasetArchiveCaptureContext = z.infer<typeof datasetArchiveCaptureContextSchema>;

/** Whole-line section heading, such as "2201. Fire Hazard Severity Zones in the SRA." */
function headingOpensSection(heading: string, section: string): boolean {
  return new RegExp(`^(?:§ ?)?${escapeRegExp(section)}\\. \\S`).test(normalizeSourceText(heading));
}

const SECTION_HEADING_LINE = /^(?:§ ?)?\d+(?:\.\d+)*\.\s+\S/;

/**
 * The text of the pinned regulation section on each page it spans: from its
 * heading line to the next line that opens another section (or the end),
 * whitespace-normalized and keyed by 1-based page. Null when no whole line
 * on the heading's page is the heading. An excerpt is inside the section only
 * if it is inside the section's text on the page it names, so identical text
 * elsewhere in the document (such as a repealed section's authority note)
 * never counts.
 */
export function regulationSectionPages(
  extracted: string,
  context: Pick<RegulationCaptureContext, "section_heading">,
): ReadonlyMap<number, string> | null {
  const pages = splitExtractedPages(extracted);
  const heading = context.section_heading;
  const first = (pages[heading.page - 1] ?? "").split("\n");
  const start = first.findIndex((line) => normalizeSourceText(line) === normalizeSourceText(heading.text));
  if (start < 0) return null;
  const section = new Map<number, string>();
  let lines = first.slice(start);
  for (let page = heading.page; page <= pages.length; page += 1) {
    if (page > heading.page) lines = pages[page - 1].split("\n");
    const end = lines.findIndex((line, index) => (page > heading.page || index > 0) && SECTION_HEADING_LINE.test(line.trim()));
    section.set(page, normalizeSourceText((end < 0 ? lines : lines.slice(0, end)).join("\n")));
    if (end >= 0) break;
  }
  return section;
}

/** Whether an excerpt lies inside the pinned regulation section, on the page it names. */
export function excerptInRegulationSection(
  excerpt: { page: number; text: string },
  extracted: string,
  context: Pick<RegulationCaptureContext, "section_heading">,
): boolean {
  const needle = normalizeSourceText(excerpt.text);
  const onPage = regulationSectionPages(extracted, context)?.get(excerpt.page);
  return needle.length > 0 && onPage !== undefined && onPage.includes(needle);
}

/**
 * The extracted metadata line for a path, such as
 * `/metadata/dataIdInfo/idAbs: ...`, on the archive's XML page(s).
 */
export function datasetMetadataLine(extracted: string, path: string): string | null {
  for (const page of splitExtractedPages(extracted)) {
    const lines = page.split("\n");
    const index = lines.findIndex((line) => line.startsWith(`${path}: `) || line === `${path}:`);
    if (index >= 0) {
      const next = lines.slice(index + 1).findIndex((line) => /^\/[\w.:@/-]+:(?: |$)/.test(line));
      return normalizeSourceText(lines.slice(index, next < 0 ? undefined : index + 1 + next).join("\n"));
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when a heading reads exactly the section number, optionally with § and a final period. */
function headingNamesSection(heading: string, section: string): boolean {
  return new RegExp(`^(?:§ ?)?${escapeRegExp(section)}\\.?$`).test(normalizeSourceText(heading));
}

/**
 * Null when the URL requests exactly this code and section. A code-section
 * page must be the leginfo page for it; any `lawCode` or `sectionNum` in any
 * URL must match. leginfo writes `sectionNum` with or without a final period.
 */
export function statuteUrlIssue(
  value: string,
  statute: Pick<StatuteCaptureContext, "code" | "section" | "form">,
): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "The statute URL is not a valid URL.";
  }
  const codes = url.searchParams.getAll("lawCode");
  const sections = url.searchParams.getAll("sectionNum");
  if (statute.form === "code_section_page") {
    if (url.pathname !== STATUTE_CODE_SECTION_PAGE_PATH) {
      return `A code-section page is served from ${STATUTE_CODE_SECTION_PAGE_PATH}.`;
    }
    if (codes.length !== 1 || sections.length !== 1) {
      return "A code-section page URL names exactly one lawCode and one sectionNum.";
    }
  }
  const sectionMatches = (candidate: string) => candidate === statute.section || candidate === `${statute.section}.`;
  if (codes.some((code) => code !== statute.code) || !sections.every(sectionMatches)) {
    return `The URL requests lawCode=${codes.join(",") || "(none)"} sectionNum=${sections.join(",") || "(none)"}, not ${statute.code} ${statute.section}.`;
  }
  return null;
}

type Excerpt = z.infer<typeof pageExcerptSchema>;

/** Every excerpt a v2 context quotes, with where it sits in the metadata. */
function contextExcerpts(metadata: {
  agency_map: AgencyMapCaptureContext | null;
  statute: StatuteCaptureContext | null;
  regulation?: RegulationCaptureContext | null;
  dataset_archive?: DatasetArchiveCaptureContext | null;
}): Array<{ path: string; excerpt: Excerpt }> {
  const found: Array<{ path: string; excerpt: Excerpt | null }> = [];
  const map = metadata.agency_map;
  if (map !== null) {
    found.push({ path: "agency_map.issuing_agency", excerpt: map.issuing_agency.excerpt });
    found.push({ path: "agency_map.edition", excerpt: map.edition.excerpt });
    map.responsibility_areas.forEach((area, index) =>
      area.excerpts.forEach((excerpt) => found.push({ path: `agency_map.responsibility_areas.${index}`, excerpt })),
    );
    map.legend?.excerpts.forEach((excerpt) => found.push({ path: "agency_map.legend", excerpt }));
    found.push({ path: "agency_map.supersession", excerpt: map.supersession.excerpt });
  }
  const statute = metadata.statute;
  if (statute !== null) {
    found.push({ path: "statute.section_heading", excerpt: statute.section_heading });
    statute.pinpoints.forEach((pinpoint, index) => found.push({ path: `statute.pinpoints.${index}`, excerpt: pinpoint.excerpt }));
    found.push({ path: "statute.status_as_published", excerpt: statute.status_as_published });
  }
  const regulation = metadata.regulation ?? null;
  if (regulation !== null) {
    found.push({ path: "regulation.document_label", excerpt: regulation.document_label });
    found.push({ path: "regulation.title_heading", excerpt: regulation.title_heading });
    found.push({ path: "regulation.section_heading", excerpt: regulation.section_heading });
    found.push({ path: "regulation.status_as_published", excerpt: regulation.status_as_published });
  }
  const dataset = metadata.dataset_archive ?? null;
  if (dataset !== null) {
    found.push({ path: "dataset_archive.title", excerpt: dataset.title });
    found.push({ path: "dataset_archive.publisher", excerpt: dataset.publisher.excerpt });
    found.push({ path: "dataset_archive.crs", excerpt: dataset.crs.excerpt });
    found.push({ path: "dataset_archive.status_as_published", excerpt: dataset.status_as_published });
  }
  return found.flatMap(({ path, excerpt }) => (excerpt === null ? [] : [{ path, excerpt }]));
}

const hostBasisSchema = z.union([
  z.literal("global_allowlist"),
  z.literal("test_only_host"),
  z.object({ exception_id: sourceIdSchema }).strict(),
]);

function describeHostBasis(basis: CaptureHostBasis): string {
  return typeof basis === "string" ? basis : `exception ${basis.exception_id}`;
}

function officialSourceMetadataV2SchemaWith(exceptions: readonly SourceHostException[]) {
  return z
    .object({
      schema_version: z.literal(OFFICIAL_SOURCE_METADATA_V2_VERSION),
      source_id: sourceIdSchema,
      title: z.string().trim().min(1).max(300),
      official_url: z.string().max(600),
      source_type: z.enum(v2SourceTypes),
      /** Null only for a regulation or data archive that prints no date of its own (Phase 3D). */
      document_date: isoDate.nullable(),
      retrieved_at: z.string().datetime({ offset: true }),
      sha256_original: hex64,
      sha256_extracted: hex64,
      operative_status: z.enum(sourceOperativeStatuses),
      notes: z.string().max(2000),
      /** Only a proposed draft records sources it may change. */
      may_change_source_ids: z.array(sourceIdSchema).max(0, "Only a proposed draft records sources it may change."),
      original: z.discriminatedUnion("media_type", [
        z
          .object({
            file: z.literal(captureOriginals.pdf.file),
            media_type: z.literal(captureOriginals.pdf.media_type),
            bytes: z.number().int().positive(),
          })
          .strict(),
        z
          .object({
            file: z.literal(captureOriginals.html.file),
            media_type: z.literal(captureOriginals.html.media_type),
            bytes: z.number().int().positive(),
          })
          .strict(),
        z
          .object({
            file: z.literal(captureOriginals.zip.file),
            media_type: z.literal(captureOriginals.zip.media_type),
            bytes: z.number().int().positive(),
          })
          .strict(),
      ]),
      extraction: z
        .object({
          file: z.literal(captureFileNames.extracted),
          extractor: z.enum(["pdfjs-dist", HTML_TEXT_EXTRACTOR, ZIP_MANIFEST_EXTRACTOR, FILEGDB_EXTRACTOR]),
          extractor_version: z.string().regex(/^\d+\.\d+\.\d+$/),
          normalization: z.literal(EXTRACTED_TEXT_NORMALIZATION),
          page_separator: z.literal("form_feed"),
          page_count: z.number().int().positive(),
          pages_without_text: z.array(z.number().int().positive()),
        })
        .strict(),
      host_basis: hostBasisSchema,
      agency_map: agencyMapCaptureContextSchema.nullable(),
      statute: statuteCaptureContextSchema.nullable(),
      /** Phase 3D. Absent in earlier captures, which the schema reads as null. */
      regulation: regulationCaptureContextSchema.nullable().optional(),
      dataset_archive: datasetArchiveCaptureContextSchema.nullable().optional(),
      http_capture: httpCaptureSchema.optional(),
      capture_tool: z.literal(CAPTURE_TOOL_PATH),
      is_ai_generated: z.literal(false),
      test_only: z.boolean(),
    })
    .strict()
    .superRefine((metadata, context) => {
      const issue = (path: string, message: string) =>
        context.addIssue({ code: "custom", path: path.split("."), message });

      const testOnlyId = metadata.source_id.startsWith(TEST_ONLY_ID_PREFIX);
      if (metadata.test_only !== testOnlyId) {
        issue("source_id", `Only a test-only source may use the ${TEST_ONLY_ID_PREFIX} prefix, and it must.`);
      }
      const host = captureHostBasis(metadata.official_url, metadata, exceptions);
      if (host.issue !== null) {
        issue("official_url", `The source URL ${host.issue}.`);
      } else if (JSON.stringify(host.basis) !== JSON.stringify(metadata.host_basis)) {
        issue("host_basis", `The host basis must be ${describeHostBasis(host.basis)}.`);
      }
      if (metadata.http_capture) {
        if (metadata.http_capture.requested_url !== metadata.official_url)
          issue("http_capture.requested_url", "Transport requested URL must preserve the exact official URL.");
        const finalHost = captureHostBasis(metadata.http_capture.final_url, metadata, exceptions);
        if (finalHost.issue !== null) issue("http_capture.final_url", `The final source URL ${finalHost.issue}.`);
      }

      const statusIssue = sourceTypeStatusIssue(metadata.source_type, metadata.operative_status);
      if (statusIssue !== null) issue("operative_status", statusIssue);
      if (metadata.document_date === null) {
        if (!(undatedSourceTypes as readonly string[]).includes(metadata.source_type)) {
          issue("document_date", `A ${metadata.source_type} capture records its document date.`);
        }
      } else if (metadata.document_date > metadata.retrieved_at.slice(0, 10)) {
        issue("document_date", "A document cannot be dated after it was retrieved.");
      }

      const { page_count: pageCount, pages_without_text: empty } = metadata.extraction;
      const ascending = empty.every((page, index) => index === 0 || page > empty[index - 1]);
      if (!ascending || empty.some((page) => page > pageCount)) {
        issue("extraction", "pages_without_text must be ascending page numbers within page_count.");
      }
      if (empty.length >= pageCount) {
        issue("extraction", "A capture needs extractable text; an image-only PDF needs a text layer or transcription.");
      }

      const html = metadata.original.media_type === captureOriginals.html.media_type;
      const zip = metadata.original.media_type === captureOriginals.zip.media_type;
      if (html) {
        if (metadata.extraction.extractor !== HTML_TEXT_EXTRACTOR || metadata.extraction.extractor_version !== HTML_TEXT_EXTRACTOR_VERSION) {
          issue("extraction", `Served HTML is extracted by ${HTML_TEXT_EXTRACTOR} ${HTML_TEXT_EXTRACTOR_VERSION}.`);
        }
        if (pageCount !== 1) issue("extraction", "Served HTML is extracted as one page.");
        if (metadata.source_type !== "statute") issue("original", "Only a statute page may be captured as served HTML.");
      } else if (zip) {
        if (
          !(
            (metadata.extraction.extractor === ZIP_MANIFEST_EXTRACTOR &&
              metadata.extraction.extractor_version === ZIP_MANIFEST_EXTRACTOR_VERSION) ||
            (metadata.extraction.extractor === FILEGDB_EXTRACTOR &&
              metadata.extraction.extractor_version === FILEGDB_VERSION &&
              metadata.dataset_archive?.file_geodatabase !== undefined)
          )
        ) {
          issue("extraction", `A data archive is extracted by ${ZIP_MANIFEST_EXTRACTOR} ${ZIP_MANIFEST_EXTRACTOR_VERSION}.`);
        }
        if (metadata.source_type !== "dataset_archive") issue("original", "Only a data archive may be captured as a ZIP.");
      } else if (metadata.extraction.extractor !== "pdfjs-dist") {
        issue("extraction", "A PDF is extracted by pdfjs-dist.");
      }
      if (metadata.source_type === "dataset_archive" && !zip) issue("original", "A data archive is captured as the exact ZIP served.");

      const map = metadata.agency_map;
      const statute = metadata.statute;
      const regulation = metadata.regulation ?? null;
      const dataset = metadata.dataset_archive ?? null;
      // Exactly one context block, the one for the source type.
      const contexts = { agency_map: map, statute, regulation, dataset_archive: dataset };
      for (const [type, context] of Object.entries(contexts)) {
        if ((type === metadata.source_type) !== (context !== null)) {
          issue(
            metadata.source_type,
            `A ${metadata.source_type} capture records ${metadata.source_type} context and no other context.`,
          );
          break;
        }
      }

      for (const { path, excerpt } of contextExcerpts(metadata)) {
        if (excerpt.page > pageCount || empty.includes(excerpt.page)) {
          issue(path, `Page ${excerpt.page} has no extracted text to quote.`);
        }
      }

      if (metadata.source_type === "agency_map" && map !== null) {
        const edition = map.edition;
        if ((edition.date === null) !== (edition.date_kind === null)) {
          issue("agency_map.edition", "An edition date and its kind are recorded together or not at all.");
        }
        if ((edition.date !== null || edition.label !== null) !== (edition.excerpt !== null)) {
          issue("agency_map.edition", "An edition label or date is recorded exactly when an excerpt shows it.");
        }
        if (edition.date !== null && edition.date !== metadata.document_date) {
          issue("agency_map.edition", "The edition date is the document date.");
        }
        const areas = map.responsibility_areas.map((area) => area.area);
        if (new Set(areas).size !== areas.length) {
          issue("agency_map.responsibility_areas", "Each responsibility area is recorded once.");
        }
        map.responsibility_areas.forEach((area, index) => {
          if (new Set(area.legend_classes).size !== area.legend_classes.length) {
            issue(`agency_map.responsibility_areas.${index}`, "Each legend class is recorded once.");
          }
        });
        if (map.legend !== undefined && new Set(map.legend.classes).size !== map.legend.classes.length) {
          issue("agency_map.legend", "Each legend class is recorded once.");
        }
        const supersession = map.supersession;
        if ((supersession.statement === "not_stated") !== (supersession.excerpt === null)) {
          issue("agency_map.supersession", "A supersession statement is recorded exactly when an excerpt shows it.");
        }
        if (supersession.statement === "stated_superseded" && metadata.operative_status !== "superseded") {
          issue("operative_status", "A map that states it is superseded is recorded as superseded.");
        }
        if (metadata.operative_status === "operative" && (edition.date === null || supersession.statement === "stated_superseded")) {
          issue("operative_status", "An operative map has an established edition date and does not state it is superseded.");
        }
        if (html) issue("original", "An agency map is captured as the agency's PDF.");
      }

      if (metadata.source_type === "statute" && statute !== null) {
        if ((statute.form === "code_section_page") !== html) {
          issue("statute.form", "A code-section page is captured as served HTML; an official PDF as a PDF.");
        }
        const urlIssue = statuteUrlIssue(metadata.official_url, statute);
        if (urlIssue !== null) issue("official_url", urlIssue);
        if (!headingNamesSection(statute.section_heading.text, statute.section)) {
          issue("statute.section_heading", `The section heading must read ${statute.section}.`);
        }
        const pinpoints = statute.pinpoints.map((pinpoint) => pinpoint.pinpoint);
        if (new Set(pinpoints).size !== pinpoints.length) issue("statute.pinpoints", "Each pinpoint is recorded once.");
        statute.pinpoints.forEach((pinpoint, index) => {
          if (pinpoint.pinpoint === "section") return;
          const last = pinpoint.pinpoint.slice(pinpoint.pinpoint.lastIndexOf("("));
          if (!normalizeSourceText(pinpoint.excerpt.text).startsWith(last)) {
            issue(`statute.pinpoints.${index}`, `The excerpt for ${pinpoint.pinpoint} begins with ${last}.`);
          }
        });
        if (metadata.operative_status === "operative" && statute.status_as_published === null) {
          issue("operative_status", "An operative statute capture quotes the source's own history or effective-date note.");
        }
      }

      if (metadata.source_type === "regulation" && regulation !== null) {
        if (html || zip) issue("original", "A regulation is captured as the agency's PDF.");
        if (!headingOpensSection(regulation.section_heading.text, regulation.section)) {
          issue("regulation.section_heading", `The section heading must open section ${regulation.section}.`);
        }
        if (!new RegExp(`\\bTitle ${regulation.title}\\b`).test(normalizeSourceText(regulation.title_heading.text))) {
          issue("regulation.title_heading", `The title heading must name Title ${regulation.title}.`);
        }
        if (metadata.operative_status === "operative" && regulation.status_as_published === null) {
          issue("operative_status", "An operative regulation capture quotes the document's own statement of its effect.");
        }
      }

      if (metadata.source_type === "dataset_archive" && dataset !== null) {
        const classLabels = dataset.class_field.values.map((value) => value.label);
        if (new Set(classLabels).size !== classLabels.length) issue("dataset_archive.class_field", "Each class label is recorded once.");
        const total = dataset.class_field.values.reduce((sum, value) => sum + value.count, 0);
        if (total !== dataset.geometry.feature_count || dataset.extent_field.values[0].count !== dataset.geometry.feature_count) {
          issue("dataset_archive", "Every feature carries one class and the extent value.");
        }
        if (dataset.class_field.field === dataset.extent_field.field) issue("dataset_archive", "The class and extent fields differ.");
        const paths = dataset.non_authoritative.map((field) => field.path);
        if (new Set(paths).size !== paths.length) issue("dataset_archive.non_authoritative", "Each field is recorded once.");
        if (metadata.operative_status === "operative" && dataset.status_as_published === null) {
          issue("operative_status", "An operative data archive quotes the archive's own statement of its status.");
        }
      }
    });
}

/**
 * Parses v1 or v2 metadata. `exceptions` defaults to the shipped (empty)
 * registry; tests pass TEST-ONLY exceptions the way they pass `packs`.
 */
export function officialSourceMetadataSchemaWith(exceptions: readonly SourceHostException[]) {
  const checked = parseSourceHostExceptions(exceptions);
  return z.discriminatedUnion("schema_version", [officialSourceMetadataV1Schema, officialSourceMetadataV2SchemaWith(checked)]);
}

export const officialSourceMetadataSchema = officialSourceMetadataSchemaWith(sourceHostExceptions);

export type OfficialSourceMetadata = z.infer<typeof officialSourceMetadataSchema>;
export type OfficialSourceMetadataV1 = z.infer<typeof officialSourceMetadataV1Schema>;
export type OfficialSourceMetadataV2 = Extract<OfficialSourceMetadata, { schema_version: typeof OFFICIAL_SOURCE_METADATA_V2_VERSION }>;

export function parseOfficialSourceMetadata(
  value: unknown,
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): OfficialSourceMetadata {
  const schema = exceptions === sourceHostExceptions ? officialSourceMetadataSchema : officialSourceMetadataSchemaWith(exceptions);
  const parsed = schema.safeParse(value);
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

/**
 * The original file a capture's (unvalidated) metadata declares, so a reader
 * knows which file to load before validation: original.html only when the
 * metadata says so, otherwise original.pdf.
 */
export function declaredOriginalFile(metadata: unknown): "original.pdf" | "original.html" | "original.zip" {
  const original = (metadata as { original?: { file?: unknown } } | null)?.original;
  if (original?.file === captureOriginals.html.file) return captureOriginals.html.file;
  if (original?.file === captureOriginals.zip.file) return captureOriginals.zip.file;
  return captureOriginals.pdf.file;
}

export interface OfficialSourceCaptureFiles {
  /** Capture directory relative to the repository root, without a trailing slash. */
  directory: string;
  metadata: unknown;
  /** The bytes of the original file the metadata declares (`declaredOriginalFile`). */
  original: Uint8Array | null;
  extracted: string | null;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

/** The text after a whole-line heading, from its page onward; null when no line is the heading. */
function textFromHeadingLine(extracted: string, page: number, heading: string): string | null {
  const pages = splitExtractedPages(extracted);
  const lines = (pages[page - 1] ?? "").split("\n");
  const index = lines.findIndex((line) => normalizeSourceText(line) === normalizeSourceText(heading));
  if (index < 0) return null;
  return normalizeSourceText([lines.slice(index).join("\n"), ...pages.slice(page)].join("\n"));
}

/**
 * Every v2 context excerpt that is not on its stated page of the extracted
 * text; a statute heading that is not a whole line; a pinpoint excerpt that
 * does not follow the heading. Empty for v1 metadata.
 */
export function captureContextIssues(metadata: OfficialSourceMetadata, extracted: string): string[] {
  if (metadata.schema_version !== OFFICIAL_SOURCE_METADATA_V2_VERSION) return [];
  const issues: string[] = [];
  for (const { path, excerpt } of contextExcerpts(metadata)) {
    if (!locateExcerptPages(excerpt.text, extracted).includes(excerpt.page)) {
      issues.push(`${path}: the excerpt is not on page ${excerpt.page} of extracted.txt.`);
    }
  }
  const regulation = metadata.regulation ?? null;
  if (regulation !== null && regulationSectionPages(extracted, regulation) === null) {
    issues.push(`regulation.section_heading: no whole line on page ${regulation.section_heading.page} reads ${regulation.section_heading.text}.`);
  }
  const dataset = metadata.dataset_archive ?? null;
  if (dataset !== null) issues.push(...datasetArchiveContextIssues(dataset, extracted));
  const statute = metadata.statute;
  if (statute !== null) {
    const afterHeading = textFromHeadingLine(extracted, statute.section_heading.page, statute.section_heading.text);
    if (afterHeading === null) {
      issues.push(`statute.section_heading: no whole line on page ${statute.section_heading.page} reads ${statute.section_heading.text}.`);
    } else {
      statute.pinpoints.forEach((pinpoint, index) => {
        if (!afterHeading.includes(normalizeSourceText(pinpoint.excerpt.text))) {
          issues.push(`statute.pinpoints.${index}: the ${pinpoint.pinpoint} excerpt does not follow the section heading.`);
        }
      });
    }
  }
  return issues;
}

/** Every way a data archive's context disagrees with the extractor's own summary of the archive. */
function datasetArchiveContextIssues(dataset: DatasetArchiveCaptureContext, extracted: string): string[] {
  const issues: string[] = [];
  if (dataset.file_geodatabase) {
    const pages = splitExtractedPages(extracted),
      page = pages.at(-1) ?? "";
    const associationLine = page.split("\n").find((line) => line.startsWith("active metadata association "));
    let association: Record<string, unknown> = {};
    try {
      association = JSON.parse(associationLine?.slice(28) ?? "{}");
    } catch {
      issues.push("FileGDB metadata association is malformed.");
    }
    if (
      dataset.dataset_name !== LRA_LAYER ||
      dataset.geometry.shape_type !== "MultiPolygon" ||
      dataset.geometry.feature_count !== 9752 ||
      dataset.crs.epsg !== 3310 ||
      dataset.class_field.field !== "FHSZ_Description" ||
      dataset.extent_field.field !== "SRA" ||
      association.name !== dataset.dataset_name ||
      association.fid !== dataset.file_geodatabase.metadata_fid ||
      association.metadata_sha256 !== dataset.file_geodatabase.metadata_sha256 ||
      association.definition_sha256 !== dataset.file_geodatabase.definition_sha256
    )
      issues.push("FileGDB active layer/metadata association differs from the capture.");
    for (const field of [dataset.class_field, dataset.extent_field]) {
      const expected = [...field.values]
        .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
        .map((v) => `${JSON.stringify(v.label)} ${v.count}`)
        .join("; ");
      if (!page.split("\n").includes(`values ${field.field}: ${expected}`))
        issues.push(`FileGDB ${field.field} values differ.`);
    }
    for (const field of dataset.non_authoritative)
      if (datasetMetadataLine(extracted, field.path) === null)
        issues.push(`No non-authoritative metadata line ${field.path}.`);
    return issues;
  }
  const summary = readDatasetArchiveSummary(splitExtractedPages(extracted));
  const name = dataset.dataset_name;
  for (const suffix of [".shp", ".shx", ".dbf", ".prj"]) {
    if (!summary.members.has(`${name}${suffix}`)) issues.push(`dataset_archive: the archive has no ${name}${suffix} member.`);
  }
  const table = summary.tables.get(`${name}.dbf`);
  const shape = summary.shapes.get(name);
  if (table === undefined || shape === undefined) return [...issues, `dataset_archive: ${name} has no attribute table or shapefile summary.`];
  if (table.records !== dataset.geometry.feature_count || table.deleted !== 0 || shape.records !== dataset.geometry.feature_count) {
    issues.push(`dataset_archive.geometry: the archive holds ${table.records} records and ${shape.records} shapes, not ${dataset.geometry.feature_count}.`);
  }
  if (shape.type !== dataset.geometry.shape_type) issues.push(`dataset_archive.geometry: the shapefile holds ${shape.type}, not ${dataset.geometry.shape_type}.`);
  const sameValues = (field: { field: string; values: ReadonlyArray<{ label: string; count: number }> }) => {
    const found = table.values.get(field.field);
    if (found === undefined || found === null) return false;
    const recorded = [...field.values].map((value) => `${value.label}\u0000${value.count}`).sort();
    return JSON.stringify(recorded) === JSON.stringify(found.map(([label, count]) => `${label}\u0000${count}`).sort());
  };
  if (!sameValues(dataset.class_field)) issues.push(`dataset_archive.class_field: ${dataset.class_field.field} does not take exactly the recorded values.`);
  if (!sameValues(dataset.extent_field)) issues.push(`dataset_archive.extent_field: ${dataset.extent_field.field} does not take exactly the recorded value.`);
  const crs = normalizeSourceText(dataset.crs.excerpt.text);
  if (!crs.includes("EPSG") || !new RegExp(`\\b${dataset.crs.epsg}\\b`).test(crs)) {
    issues.push(`dataset_archive.crs: the excerpt does not name EPSG ${dataset.crs.epsg}.`);
  }
  for (const field of dataset.non_authoritative) {
    if (datasetMetadataLine(extracted, field.path) === null) issues.push(`dataset_archive.non_authoritative: no extracted line reads ${field.path}.`);
  }
  return issues;
}

/**
 * Every reason a capture directory fails its pins. Empty means the metadata is
 * valid, sits in the right directory, both files hash to their pins, served
 * HTML re-extracts to the same text, and every context excerpt is on its page.
 */
export async function officialSourceCaptureIssues(
  files: OfficialSourceCaptureFiles,
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): Promise<string[]> {
  const schema = exceptions === sourceHostExceptions ? officialSourceMetadataSchema : officialSourceMetadataSchemaWith(exceptions);
  const parsed = schema.safeParse(files.metadata);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `metadata.json ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
  }
  const metadata = parsed.data;
  const originalFile = metadata.original.file;
  const html = metadata.original.media_type === captureOriginals.html.media_type;
  const zip = metadata.original.media_type === captureOriginals.zip.media_type;
  const issues: string[] = [];

  if (files.directory !== captureDirectoryFor(metadata)) {
    issues.push(`metadata.json source_id ${metadata.source_id} does not match directory ${files.directory}.`);
  }
  if (metadata.schema_version === OFFICIAL_SOURCE_METADATA_V2_VERSION && metadata.http_capture)
    issues.push(...await httpCaptureIssues(metadata.http_capture));

  let servedHtml: string | null = null;
  let archive: Uint8Array | null = null;
  if (files.original === null) {
    issues.push(`${originalFile} is missing.`);
  } else {
    if (html) {
      const htmlIssue = htmlCaptureIssue(files.original);
      if (htmlIssue === null) servedHtml = decodeUtf8Strict(files.original);
      else issues.push(`${originalFile} ${htmlIssue}.`);
    } else if (zip) {
      if (isZip(files.original)) archive = files.original;
      else issues.push(`${originalFile} is not a ZIP archive.`);
    } else if (!isPdf(files.original)) {
      issues.push(`${originalFile} is not a PDF file.`);
    }
    if (files.original.byteLength !== metadata.original.bytes) {
      issues.push(`${originalFile} size does not match metadata.json.`);
    }
    if ((await sha256HexBytes(files.original)) !== metadata.sha256_original) {
      issues.push(`${originalFile} does not match sha256_original.`);
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
    // Served HTML and data archives are re-extracted on every check: both extractors are pure code.
    if (servedHtml !== null && joinExtractedPages(extractHtmlPages(servedHtml)) !== files.extracted) {
      issues.push(
        `extracted.txt differs from a re-extraction of ${originalFile} with ${HTML_TEXT_EXTRACTOR} ${HTML_TEXT_EXTRACTOR_VERSION}.`,
      );
    }
    if (archive !== null) {
      let reextracted: string | null = null;
      try {
        reextracted = joinExtractedPages(await (metadata.extraction.extractor === FILEGDB_EXTRACTOR
            ? extractFileGdbPages(archive)
            : extractDatasetArchivePages(archive)));
      } catch (error) {
        issues.push(`${originalFile} cannot be read: ${(error as Error).message}.`);
      }
      if (reextracted !== null && reextracted !== files.extracted) {
        issues.push(
          `extracted.txt differs from a re-extraction of ${originalFile} with ${ZIP_MANIFEST_EXTRACTOR} ${ZIP_MANIFEST_EXTRACTOR_VERSION}.`,
        );
      }
    }
    issues.push(...captureContextIssues(metadata, files.extracted));
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

/* ----------------------------------------- authority registration readiness */

/** The legend class an agency map must define to back each fact it may back. */
export const agencyMapFactLegendClasses: Readonly<Partial<Record<ProgramFactKey, MapLegendClass>>> = {
  "very-high-fire-hazard-severity-zone": "very_high",
  "high-fire-hazard-severity-zone": "high",
};

/**
 * Every reason a capture cannot back a registered authority source. Empty
 * means it may be registered, not that it is: registration stays a separate,
 * human-reviewed change to authority-policy.ts. Enforced by tests over the
 * shipped registries (B6); the evaluator never reads captures.
 *
 * In Phase 2b only an agency map can back a source, and only when the
 * capture itself shows everything a reviewer needs: an operative edition
 * with a date matching the registration, the issuing agency printed on the
 * map, and a legend class for each fact (Very High for the Very High fact,
 * High for the High fact), on the map's own legend or a stated
 * responsibility area's. Responsibility area is context only: a map that
 * states none is not refused for that (Phase 3B d, Phase 3C). A test-only,
 * proposed, superseded, or unconfirmed map, a statute, and an ordinance or
 * memo never can.
 */
export async function authoritySourceCaptureIssues(
  source: Pick<ReviewedAuthoritySource, "record_kind" | "edition" | "capture" | "fact_keys" | "package">,
  capture: { metadata: OfficialSourceMetadata; extracted: string },
  exceptions: readonly SourceHostException[] = sourceHostExceptions,
): Promise<string[]> {
  const { metadata, extracted } = capture;
  const issues: string[] = [];
  const schema = exceptions === sourceHostExceptions ? officialSourceMetadataSchema : officialSourceMetadataSchemaWith(exceptions);
  if (!schema.safeParse(metadata).success) issues.push("The capture metadata is not valid.");
  if (metadata.source_id !== source.capture.source_id) {
    issues.push(`The registration cites capture ${source.capture.source_id}, not ${metadata.source_id}.`);
  }
  if (source.capture.sha256_extracted !== metadata.sha256_extracted || (await sha256Hex(extracted)) !== metadata.sha256_extracted) {
    issues.push("The registration's SHA-256 does not pin the captured extracted text.");
  }
  if (metadata.test_only) issues.push("A test-only capture can never back an authority source.");
  if (
    metadata.schema_version === OFFICIAL_SOURCE_METADATA_V2_VERSION &&
    metadata.source_type === "dataset_archive" &&
    source.package?.statutory_basis === "gov_51178"
  ) {
    const data = metadata.dataset_archive,
      pack = source.package;
    if (
      source.record_kind !== "agency_hazard_map" ||
      metadata.operative_status !== "operative" ||
      !data?.file_geodatabase
    )
      issues.push("Route 1 requires an operative reviewed FileGDB identification package.");
    if (
      source.edition.date !== pack.identification.map_date ||
      source.edition.date !== metadata.document_date ||
      source.edition.date_kind !== "dated"
    )
      issues.push("Route 1's edition differs from its captured map date.");
    if (
      data?.dataset_name !== pack.active_metadata.layer ||
      data?.class_field.field !== "FHSZ_Description" ||
      data?.crs.epsg !== 3310 ||
      data?.file_geodatabase?.metadata_sha256 !== pack.active_metadata.xml_sha256 ||
      data.file_geodatabase.definition_sha256 !== pack.active_metadata.definition_sha256
    )
      issues.push("Route 1's active layer/metadata/class field differs.");
    if (source.fact_keys.length !== 1 || source.fact_keys[0] !== "very-high-fire-hazard-severity-zone")
      issues.push("LRA evidence establishes only the Very High fact.");
    if (data?.publisher.name !== "Fire Hazard Severity Zone Team, CAL FIRE")
      issues.push("The active dataset publisher differs.");
    issues.push(...captureContextIssues(metadata, extracted));
    return issues;
  }
  if (metadata.schema_version !== OFFICIAL_SOURCE_METADATA_V2_VERSION || metadata.source_type !== "agency_map" || metadata.agency_map === null) {
    issues.push(`A ${metadata.source_type} capture cannot back an authority source.`);
    return issues;
  }
  if (source.record_kind !== "agency_hazard_map") {
    issues.push(`An agency map capture cannot back a ${source.record_kind} authority source.`);
    return issues;
  }
  const map = metadata.agency_map;
  if (metadata.operative_status !== "operative") {
    issues.push(`A map recorded as ${metadata.operative_status} can never back an authority source.`);
  }
  if (map.edition.date === null || map.edition.date_kind === null) {
    issues.push("The capture does not establish the map's edition date.");
  } else if (map.edition.date !== source.edition.date || map.edition.date_kind !== source.edition.date_kind) {
    issues.push("The registered edition date or kind differs from the captured edition.");
  }
  if (map.issuing_agency.excerpt === null) issues.push("The capture does not show the issuing agency printed on the map.");
  if (map.supersession.statement === "stated_superseded") issues.push("The map states that it is superseded.");
  // The legend class is operative; where the map states responsibility areas,
  // their legends count too, and that context is kept as recorded.
  const legendClasses = new Set([...(map.legend?.classes ?? []), ...map.responsibility_areas.flatMap((area) => area.legend_classes)]);
  for (const key of source.fact_keys) {
    const needed = agencyMapFactLegendClasses[key];
    if (needed === undefined) {
      issues.push(`An agency map capture cannot back ${key}.`);
    } else if (!legendClasses.has(needed)) {
      issues.push(`The captured legend defines no ${needed} class, so it cannot back ${key}.`);
    }
  }
  issues.push(...captureContextIssues(metadata, extracted));
  return issues;
}
