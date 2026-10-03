import { z } from "zod";
import normalizationProfileRaw from "../../shared/program-screen/normalization-profile.json?raw";
import { programAuthorityRegistries } from "../../shared/program-screen/authority-policy";
import { isIsoCalendarDate, legalLotIdentities } from "../../shared/program-screen/evidence-authority";
import { loadReviewedLotGeometry, type ReviewedLotGeometry } from "../../shared/program-screen/lot-overlay";
import { loadOverlayDatasetView, overlayCandidates, overlayIndexPinFor, type OverlayDatasetView, type OverlayIndexPin } from "../../shared/program-screen/overlay-dataset";
import {
  bytesSha256, caseFileRefSchema, decodeEvidenceJson, normalizationPins, REVIEWED_LOT_VERSION, reviewedLotRecordSchema, verifyReviewedLotEvidence,
  type CaseFileRef, type ReviewedLotEvidenceReader, type ReviewedLotRecord,
} from "../../shared/program-screen/reviewed-lot";
import { mayPrepareProgramScreenCase, type CaseActor } from "../cases/authorization";
import type { Bindings } from "../types";
import { openProgramScreenCaseStore } from "./case-evidence";
import { programScreenAsOf } from "./case-evaluation-response";
import { completeReviewEvent, insertReviewEventIntent, reviewInvalidationReasons } from "./case-preparation-audit";

/*
 * Phase 3K: the administrator-only preparation boundary for one Program Screen case.
 *
 * Stage 1 stores immutable, hash-addressed content (evidence blobs, pinned CAL FIRE indexes and
 * their records) and never touches current-review.json. Validate builds the exact server-completed
 * review and writes nothing. Publish repeats every check, records an audit intent and then uses
 * the existing CAS publication. The private writer's primitives stay internal to this module.
 */

export const PROGRAM_SCREEN_REVIEWER_ROLE = "Administrator (Program Screen reviewed-lot publication)";
export const MAX_REVIEW_TERM_DAYS = 30;
export const CASE_PREPARATION_LIMITS = { blob: 8 * 1024 * 1024, index: 4 * 1024 * 1024, record: 16 * 1024 * 1024 } as const;

const casePreparationErrors = {
  FORBIDDEN: [403, "Program Screen case preparation requires an administrator."],
  CASE_NOT_FOUND: [404, "The case was not found."],
  EVIDENCE_STORAGE_UNAVAILABLE: [503, "Evidence file storage is not configured."],
  INVALID_DIGEST: [400, "The digest must be 64 lowercase hexadecimal characters."],
  DIGEST_MISMATCH: [422, "The request body does not match the SHA-256 digest in the path."],
  EMPTY_BODY: [422, "The request body is empty."],
  PAYLOAD_TOO_LARGE: [413, "The request body is too large."],
  UNPINNED_INDEX: [422, "The digest is not a shipped CAL FIRE overlay index pin."],
  CALFIRE_INDEX_INVALID: [422, "The CAL FIRE overlay index could not be verified."],
  CALFIRE_INDEX_REQUIRED: [409, "Store a pinned CAL FIRE overlay index before its records."],
  RECORD_NOT_IN_PINNED_INDEX: [422, "The record is not listed in any stored pinned CAL FIRE index."],
  CALFIRE_RECORD_INVALID: [422, "The CAL FIRE record could not be verified against its pinned index."],
  INVALID_JSON: [400, "The request body is not valid JSON."],
  VALIDATION_ERROR: [422, "The request body is incomplete or invalid."],
  PREPARATION_INVALID: [422, "The reviewed-lot proposal did not pass validation."],
  REVISION_CHANGED: [409, "The current review changed. Reload before retrying."],
  NO_CURRENT_REVIEW: [409, "The case has no current reviewed lot."],
  REVIEW_NOT_CURRENT: [409, "The case's reviewed lot is not current."],
  CURRENT_REVIEW_UNREADABLE: [409, "The case's current reviewed-lot manifest could not be read."],
  REVIEWER_NAME_UNAVAILABLE: [422, "The administrator's account name is unavailable for the review record."],
  AUDIT_UNAVAILABLE: [503, "The review event log is unavailable. Nothing was published."],
} as const;
export type CasePreparationErrorCode = keyof typeof casePreparationErrors;

/** Every message is fixed and public; internal error text never reaches a response. */
export class CasePreparationError extends Error {
  readonly code: CasePreparationErrorCode;
  readonly status: (typeof casePreparationErrors)[CasePreparationErrorCode][0];
  readonly details: unknown;

  constructor(code: CasePreparationErrorCode, details?: unknown) {
    super(casePreparationErrors[code][1]);
    this.name = "CasePreparationError";
    this.code = code;
    this.status = casePreparationErrors[code][0];
    this.details = details;
  }
}

const HAZARD_ROUTES = [
  { route: "gov_51178", authority_source_id: "calfire-lra-fhsz-2025-03-24-v1" },
  { route: "prc_4202", authority_source_id: "calfire-sra-fhsz-2023-09-29" },
] as const;
export type PreparationHazardRoute = (typeof HAZARD_ROUTES)[number]["route"];

/**
 * Admin-only diagnostics: fixed codes, schema field paths, referenced digests, routes and record
 * numbers. Never a caller-chosen file ID or key, verifier or exception text, or any parcel,
 * legal-lot, reviewer, URL, coordinate or file content.
 */
export interface CasePreparationDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  field?: string;
  sha256?: string;
  route?: PreparationHazardRoute;
  record_numbers?: number[];
}

/** A VALIDATION_ERROR issue: zod's issue code or prohibited_key, and only a schema-owned path. */
export interface CasePreparationValidationIssue {
  code: string;
  field?: string;
}

export interface RequiredCalFireRecord {
  record_number: number;
  content_sha256: string;
  content_bytes: number;
  geometry_state: "valid" | "invalid" | "unreadable" | null;
  present: boolean;
}

export interface PreparationHazardRouteStatus {
  route: PreparationHazardRoute;
  authority_source_id: string;
  index_sha256: string | null;
  index: "present" | "missing";
  required_records: RequiredCalFireRecord[] | null;
}

export interface CasePreparationStatus {
  schema_version: "program-screen-case-preparation-status-v1";
  case_id: string;
  as_of: string;
  as_of_basis: "server_utc_calendar_date";
  integrity: "ok" | "current_review_unreadable";
  current_review: null | {
    review_id: string;
    state: ReviewedLotRecord["state"]["status"];
    reviewed_on: string;
    next_review_on: string;
    legal_lot_identity: ReviewedLotRecord["legal_lot_identity"];
    reviewer_user_id: string;
    revision: string;
    verified: boolean;
    diagnostics: CasePreparationDiagnostic[];
  };
  hazard_routes: PreparationHazardRouteStatus[];
  readiness: "no_review" | "review_unverified" | "calfire_incomplete" | "ready";
}

export interface ProposedReviewSummary {
  review_id: string;
  reviewed_on: string;
  next_review_on: string;
  legal_lot_identity: ReviewedLotRecord["legal_lot_identity"];
  manifest_sha256: string;
}

export interface CasePreparationValidation {
  schema_version: "program-screen-case-preparation-validation-v1";
  case_id: string;
  as_of: string;
  valid: boolean;
  expected_revision_current: boolean;
  review: ProposedReviewSummary | null;
  diagnostics: CasePreparationDiagnostic[];
  hazard_routes: PreparationHazardRouteStatus[];
}

export interface CasePreparationPublication extends ProposedReviewSummary {
  schema_version: "program-screen-case-publication-v1";
  case_id: string;
  prior_revision: string | null;
  revision: string;
  replayed: boolean;
  diagnostics: CasePreparationDiagnostic[];
}

export interface CaseReviewInvalidation {
  schema_version: "program-screen-case-invalidation-v1";
  case_id: string;
  review_id: string;
  state: "stale";
  prior_revision: string;
  revision: string;
}

/* ------------------------------------------------------------------ request schemas */

const recordShape = reviewedLotRecordSchema.shape;
const revisionSchema = z.string().min(1).max(128);

/**
 * Only the human reviewer's claims and the offline outputs' file references. The server supplies
 * schema_version, review_id, case_id, the normalized CRS/serialization, every reprojection pin, the
 * reviewer, reviewed_on and state. Unknown keys are rejected at every level, never ignored.
 */
const proposalSchema = z.object({
  parcel: recordShape.parcel,
  legal_lot_reference: recordShape.legal_lot_reference,
  legal_lot_identity: z.enum(legalLotIdentities),
  legal_identity_evidence: z.array(caseFileRefSchema).max(20),
  source_geometry: recordShape.source_geometry,
  normalized_geometry: z.object({ file: caseFileRefSchema }).strict(),
  receipt_file: caseFileRefSchema,
  source_provenance: recordShape.source_provenance,
  next_review_on: z.string().refine(isIsoCalendarDate, "Expected an ISO calendar date."),
}).strict().superRefine((proposal, ctx) => {
  if (proposal.legal_lot_reference.map_pages.first > proposal.legal_lot_reference.map_pages.last) {
    ctx.addIssue({ code: "custom", path: ["legal_lot_reference", "map_pages"], message: "Recorded map page range is reversed." });
  }
});
type ReviewedLotProposal = z.infer<typeof proposalSchema>;
const proposalBodySchema = z.object({ proposal: proposalSchema, expected_revision: revisionSchema.nullable() }).strict();
const invalidationBodySchema = z.object({ expected_revision: revisionSchema, reason: z.enum(reviewInvalidationReasons) }).strict();

/** Own keys that can address a prototype. zod strips an own JSON `__proto__` silently, so these are refused first. */
const prohibitedKeys = ["__proto__", "prototype", "constructor"] as const;

/** Reads every object and array in the parsed body, iteratively and without mutating it. */
function hasProhibitedKey(body: unknown): boolean {
  const pending: unknown[] = [body];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (prohibitedKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return true;
    for (const child of Object.values(value)) pending.push(child);
  }
  return false;
}

/** Every key the request schemas define: the only names a validation issue path may contain. */
function schemaKeys(schema: z.ZodType, keys = new Set<string>()): Set<string> {
  if (schema instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(schema.shape)) {
      keys.add(key);
      schemaKeys(child as z.ZodType, keys);
    }
  } else if (schema instanceof z.ZodArray) schemaKeys(schema.element as z.ZodType, keys);
  else if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) schemaKeys(schema.unwrap() as z.ZodType, keys);
  return keys;
}
const requestKeys = new Set([...schemaKeys(proposalBodySchema), ...schemaKeys(invalidationBodySchema)]);

/** zod's issue code and its path when every segment is a schema key or an index. Never a message, key list or value. */
function validationIssue(issue: { code: string; path: readonly PropertyKey[] }): CasePreparationValidationIssue {
  const named = issue.path.every((segment) => typeof segment === "number" || (typeof segment === "string" && requestKeys.has(segment)));
  return named && issue.path.length > 0 ? { code: issue.code, field: issue.path.join(".") } : { code: issue.code };
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  if (hasProhibitedKey(body)) throw new CasePreparationError("VALIDATION_ERROR", { issues: [{ code: "prohibited_key" }] });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new CasePreparationError("VALIDATION_ERROR", { issues: parsed.error.issues.map(validationIssue) });
  return parsed.data;
}

/* ------------------------------------------------------------------------ helpers */

const utf8 = (text: string) => new TextEncoder().encode(text);
const isDigest = (value: string) => /^[0-9a-f]{64}$/.test(value);
type CaseStore = Awaited<ReturnType<typeof openProgramScreenCaseStore>>;

function requireAdministrator(actor: CaseActor): void {
  if (!mayPrepareProgramScreenCase(actor)) throw new CasePreparationError("FORBIDDEN");
}

/** The existing case authorization opens the store; its refusals become typed errors. */
async function openStore(bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">, actor: CaseActor, caseId: string, access: "read" | "write"): Promise<CaseStore> {
  try {
    return await openProgramScreenCaseStore(bindings, actor, caseId, access);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Case evidence access denied.") throw new CasePreparationError("CASE_NOT_FOUND");
    if (message === "Private evidence storage is unavailable.") throw new CasePreparationError("EVIDENCE_STORAGE_UNAVAILABLE");
    if (message === "Case evidence verification permission denied.") throw new CasePreparationError("FORBIDDEN");
    throw error;
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A UUID (version 5 layout) from the case, actor, revision, server date and canonical proposal. */
async function deriveReviewId(caseId: string, actorId: string, expectedRevision: string | null, asOf: string, proposal: ReviewedLotProposal): Promise<string> {
  const input = `program-screen-review-id-v1\0${caseId}\0${actorId}\0${expectedRevision ?? "none"}\0${asOf}\0${canonicalJson(proposal)}`;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(input))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Exactly the bytes the private writer publishes and archives as reviews/<review_id>-<sha>.json. */
function manifestSha256(record: ReviewedLotRecord): Promise<string> {
  return bytesSha256(utf8(`${JSON.stringify(record)}\n`));
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function reviewerName(db: Bindings["DB"], actorId: string): Promise<string> {
  const row = await db.prepare('SELECT name FROM "user" WHERE id = ?').bind(actorId).first<{ name: unknown }>();
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  if (name.length < 1 || name.length > 300) throw new CasePreparationError("REVIEWER_NAME_UNAVAILABLE");
  return name;
}

type CurrentReview = { record: ReviewedLotRecord; revision: string } | null;
/**
 * The current review only when its bytes pass their integrity check, parse as a reviewed-lot record
 * and name this case. Anything else is CURRENT_REVIEW_UNREADABLE, so no ordinary publication or
 * invalidation can replace a malformed or foreign manifest; the object is left untouched.
 */
async function readCurrentReview(store: CaseStore): Promise<CurrentReview> {
  let current: { record: unknown; revision: string } | null;
  try {
    current = await store.readReview();
  } catch {
    throw new CasePreparationError("CURRENT_REVIEW_UNREADABLE");
  }
  if (current === null) return null;
  const parsed = reviewedLotRecordSchema.safeParse(current.record);
  if (!parsed.success || parsed.data.case_id !== store.case_id) throw new CasePreparationError("CURRENT_REVIEW_UNREADABLE");
  return { record: parsed.data, revision: current.revision };
}

const publicationConflicts = new Set(["Reviewed manifest changed; reload before publishing.", "Reviewed manifest changed."]);
const isPublicationConflict = (error: unknown) => error instanceof Error && publicationConflicts.has(error.message);

function auditRequestId(requestId: string): string {
  const trimmed = typeof requestId === "string" ? requestId.trim() : "";
  return trimmed.length >= 1 && trimmed.length <= 128 ? trimmed : crypto.randomUUID();
}

/* ---------------------------------------------------------------- verifier mapping */

const verifierCodes: Readonly<Record<string, string>> = {
  "Reviewed geometry is stale, superseded, unreviewed, or future-dated.": "REVIEW_NOT_CURRENT_ON_DATE",
  "TEST-ONLY evidence cannot enter a production case evaluation.": "TEST_ONLY_EVIDENCE",
  "Captured geometry is not supported linear 2D geometry.": "SOURCE_GEOMETRY_UNSUPPORTED",
  "Captured CRS differs from approved EPSG:3857.": "SOURCE_CRS_UNSUPPORTED",
  "Reviewed source CRS differs from captured metadata.": "SOURCE_CRS_MISMATCH",
  "Captured identifiers differ from the reviewed parcel identifiers.": "SOURCE_IDENTIFIERS_MISMATCH",
  "Normalization receipt misstates the TEST-ONLY source boundary.": "RECEIPT_TEST_ONLY_MISMATCH",
  "Offline normalization does not match the approved pinned implementation.": "NORMALIZATION_NOT_PINNED",
  "Normalization receipt is not linked to these source/normalized bytes.": "RECEIPT_NOT_LINKED",
  "Normalization/review chronology is inconsistent.": "CHRONOLOGY_INCONSISTENT",
  "Reviewed normalized geometry is invalid or is not EPSG:3310.": "NORMALIZED_GEOMETRY_INVALID",
};
const verifierPrefixes = [["Missing case evidence file: ", "FILE_MISSING"], ["Case evidence hash/length mismatch: ", "FILE_HASH_MISMATCH"]] as const;

type FieldRef = { field: string; ref: CaseFileRef };

/**
 * Explicit, message-pinned mapping of the unchanged lower-level verifier's refusals. A file refusal
 * names the schema field and digest of the reference, never the caller's file ID from the message;
 * any other text is reduced to its fixed code.
 */
function verifierDiagnostic(error: unknown, refs: readonly FieldRef[]): CasePreparationDiagnostic {
  if (error instanceof z.ZodError) return { code: "CAPTURED_FILE_MALFORMED", severity: "error" };
  // A fatal UTF-8 decode is a TypeError: "Failed to decode input." in workerd, "...not valid for encoding utf-8" in Node.
  if (error instanceof SyntaxError || (error instanceof TypeError && /Failed to decode input|not valid for encoding|utf-?8/i.test(error.message))) return { code: "CAPTURED_FILE_NOT_JSON", severity: "error" };
  const message = error instanceof Error ? error.message : String(error);
  const code = verifierCodes[message];
  if (code !== undefined) return { code, severity: "error" };
  for (const [prefix, prefixCode] of verifierPrefixes) {
    if (!message.startsWith(prefix)) continue;
    const named = refs.find(({ ref }) => ref.file_id === message.slice(prefix.length));
    return named === undefined ? { code: prefixCode, severity: "error" } : { code: prefixCode, severity: "error", field: named.field, sha256: named.ref.sha256 };
  }
  return { code: "REVIEWED_LOT_VERIFICATION_FAILED", severity: "error" };
}

/* ------------------------------------------------------------- staged case files */

/** Reads only this case's blobs, once per digest, for both the narrowing rules and the verifier. */
class StagedCaseFiles implements ReviewedLotEvidenceReader {
  readonly case_id: string;
  readonly #reads = new Map<string, Promise<Uint8Array | null>>();
  readonly #digests = new Map<Uint8Array, Promise<string>>();

  constructor(private readonly store: CaseStore) {
    this.case_id = store.case_id;
  }

  getFile(ref: CaseFileRef): Promise<Uint8Array | null> {
    let read = this.#reads.get(ref.sha256);
    if (read === undefined) {
      read = this.store.getFile(ref);
      this.#reads.set(ref.sha256, read);
    }
    return read;
  }

  /** The verified bytes, or the R5 refusal. */
  async check(ref: CaseFileRef): Promise<{ bytes: Uint8Array } | { code: "FILE_MISSING" | "FILE_HASH_MISMATCH" }> {
    let bytes: Uint8Array | null;
    try {
      bytes = await this.getFile(ref);
    } catch {
      return { code: "FILE_HASH_MISMATCH" };
    }
    if (bytes === null) return { code: "FILE_MISSING" };
    let digest = this.#digests.get(bytes);
    if (digest === undefined) {
      digest = bytesSha256(bytes);
      this.#digests.set(bytes, digest);
    }
    return bytes.length === ref.bytes && (await digest) === ref.sha256 ? { bytes } : { code: "FILE_HASH_MISMATCH" };
  }
}

function proposalFileRefs(proposal: ReviewedLotProposal): FieldRef[] {
  return [
    ...proposal.legal_identity_evidence.map((ref, i) => ({ field: `legal_identity_evidence.${i}`, ref })),
    { field: "source_geometry.file", ref: proposal.source_geometry.file },
    { field: "source_geometry.metadata_file", ref: proposal.source_geometry.metadata_file },
    { field: "normalized_geometry.file", ref: proposal.normalized_geometry.file },
    { field: "receipt_file", ref: proposal.receipt_file },
    ...proposal.source_provenance.evidence_files.map((ref, i) => ({ field: `source_provenance.evidence_files.${i}`, ref })),
  ];
}

function recordFileRefs(record: ReviewedLotRecord): FieldRef[] {
  return [
    ...record.legal_identity_evidence.map((ref, i) => ({ field: `legal_identity_evidence.${i}`, ref })),
    { field: "source_geometry.file", ref: record.source_geometry.file },
    { field: "source_geometry.metadata_file", ref: record.source_geometry.metadata_file },
    { field: "normalized_geometry.file", ref: record.normalized_geometry.file },
    { field: "reprojection.receipt_file", ref: record.reprojection.receipt_file },
    ...record.source_provenance.evidence_files.map((ref, i) => ({ field: `source_provenance.evidence_files.${i}`, ref })),
  ];
}

const legalEvidenceSignatures: readonly (readonly number[])[] = [
  [0x25, 0x50, 0x44, 0x46, 0x2d], // PDF: %PDF-
  [0x49, 0x49, 0x2a, 0x00], // TIFF, little endian
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF, big endian
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0xff, 0xd8, 0xff], // JPEG
];
const hasLegalEvidenceSignature = (bytes: Uint8Array) =>
  legalEvidenceSignatures.some((signature) => signature.length <= bytes.length && signature.every((byte, i) => bytes[i] === byte));

function parsedJson(bytes: Uint8Array): unknown {
  try {
    return decodeEvidenceJson(bytes);
  } catch {
    return undefined;
  }
}
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
/** Ring count and positions per ring only. No coordinate is read or compared. */
function ringStructure(rings: unknown): number[] | undefined {
  return Array.isArray(rings) && rings.every(Array.isArray) ? rings.map((ring: unknown[]) => ring.length) : undefined;
}

/* ------------------------------------------------------------ CAL FIRE candidates */

interface ResolvedRoute {
  route: PreparationHazardRoute;
  authority_source_id: string;
  pin: OverlayIndexPin;
  layer: string;
  class_field: string;
  applicable_on: (asOf: string) => boolean;
}

/** route -> registered source -> package -> overlay dataset -> shipped index pin. Nothing from the request. */
function resolveRoute(entry: (typeof HAZARD_ROUTES)[number]): ResolvedRoute | null {
  const source = programAuthorityRegistries.sources.find((candidate) => candidate.authority_source_id === entry.authority_source_id);
  const pack = source?.package;
  if (source === undefined || source.superseded_by !== null || pack === undefined || pack.statutory_basis !== entry.route) return null;
  const pin = overlayIndexPinFor(pack.members.overlay_dataset);
  if (pin === undefined) return null;
  const adopted = pack.statutory_basis === "prc_4202"
    ? pack.adoption.status === "adopted"
    : pack.identification.status === "state_identification_recommendation";
  return {
    route: entry.route, authority_source_id: entry.authority_source_id, pin,
    layer: pack.overlay.dataset_name, class_field: pack.overlay.class_field,
    applicable_on: (asOf) => adopted && source.edition.date <= asOf,
  };
}

const indexDecoder = () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** A stored index whose raw bytes match the pin, checked before decoding, as the evaluator does. */
async function storedIndex(store: CaseStore, resolved: ResolvedRoute): Promise<{ text: string; view: OverlayDatasetView } | null> {
  try {
    const bytes = await store.getOverlayIndex(resolved.pin.index_sha256);
    if (bytes === null || (await bytesSha256(bytes)) !== resolved.pin.index_sha256) return null;
    const text = indexDecoder().decode(bytes);
    const view = await loadOverlayDatasetView({ index_text: text, records: [] });
    if (view.crs_epsg !== 3310 || view.class_field !== resolved.class_field || view.layer !== resolved.layer) return null;
    return { text, view };
  } catch {
    return null;
  }
}

async function recordPresent(store: CaseStore, contentSha256: string): Promise<boolean> {
  try {
    return (await store.getOverlayRecord(contentSha256)) !== null;
  } catch {
    return false;
  }
}

/** The evaluator's candidate selection: the lot's box from geometry.rings(), then overlayCandidates. */
async function hazardRouteStatuses(store: CaseStore, geometry: ReviewedLotGeometry | null, asOf: string): Promise<PreparationHazardRouteStatus[]> {
  const statuses: PreparationHazardRouteStatus[] = [];
  for (const entry of HAZARD_ROUTES) {
    const resolved = resolveRoute(entry);
    const base = { route: entry.route, authority_source_id: entry.authority_source_id, index_sha256: resolved?.pin.index_sha256 ?? null };
    const index = resolved === null ? null : await storedIndex(store, resolved);
    if (index === null) {
      statuses.push({ ...base, index: "missing", required_records: null });
      continue;
    }
    const positions = geometry?.rings() ?? [];
    if (positions.length === 0 || !resolved!.applicable_on(asOf)) {
      statuses.push({ ...base, index: "present", required_records: null });
      continue;
    }
    const xs = positions.flatMap((ring) => ring.filter((_, i) => i % 2 === 0));
    const ys = positions.flatMap((ring) => ring.filter((_, i) => i % 2 === 1));
    const required: RequiredCalFireRecord[] = [];
    for (const candidate of overlayCandidates(index.view.entries(), [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)])) {
      required.push({
        record_number: candidate.record_number, content_sha256: candidate.content_sha256, content_bytes: candidate.content_bytes,
        geometry_state: candidate.geometry_state ?? null, present: await recordPresent(store, candidate.content_sha256),
      });
    }
    statuses.push({ ...base, index: "present", required_records: required });
  }
  return statuses;
}

/** CAL FIRE completeness is advisory: a missing index or record already yields unknown in the evaluator. */
function hazardRouteDiagnostics(routes: readonly PreparationHazardRouteStatus[]): CasePreparationDiagnostic[] {
  const diagnostics: CasePreparationDiagnostic[] = [];
  for (const route of routes) {
    if (route.index === "missing") {
      diagnostics.push({ code: "CALFIRE_INDEX_MISSING", severity: "warning", route: route.route });
      continue;
    }
    const missing = (route.required_records ?? []).filter((entry) => !entry.present).map((entry) => entry.record_number);
    if (missing.length > 0) diagnostics.push({ code: "CALFIRE_RECORDS_MISSING", severity: "warning", route: route.route, record_numbers: missing });
    const invalid = (route.required_records ?? []).filter((entry) => entry.geometry_state !== "valid").map((entry) => entry.record_number);
    if (invalid.length > 0) diagnostics.push({ code: "CALFIRE_CANDIDATE_INVALID", severity: "info", route: route.route, record_numbers: invalid });
  }
  return diagnostics;
}

/* ---------------------------------------------------------------- proposal checks */

interface ProposalAssessment {
  review_id: string;
  record: ReviewedLotRecord | null;
  manifest_sha256: string | null;
  diagnostics: CasePreparationDiagnostic[];
  geometry: ReviewedLotGeometry | null;
}

let profileSha256: Promise<string> | undefined;

/** The exact server-completed record. Nothing here comes from the request except the proposal. */
interface CompletedReview { reviewId: string; record: ReviewedLotRecord | null; manifest: string | null }
async function completedReview(caseId: string, actor: CaseActor, reviewer: string, proposal: ReviewedLotProposal, expectedRevision: string | null, asOf: string): Promise<CompletedReview> {
  const reviewId = await deriveReviewId(caseId, actor.id, expectedRevision, asOf, proposal);
  const input = {
    schema_version: REVIEWED_LOT_VERSION,
    review_id: reviewId,
    case_id: caseId,
    parcel: proposal.parcel,
    legal_lot_reference: proposal.legal_lot_reference,
    legal_lot_identity: proposal.legal_lot_identity,
    legal_identity_evidence: proposal.legal_identity_evidence,
    source_geometry: proposal.source_geometry,
    normalized_geometry: { file: proposal.normalized_geometry.file, crs: "EPSG:3310", serialization: normalizationPins.serialization },
    reprojection: {
      profile_id: normalizationPins.profile_id,
      profile_sha256: await (profileSha256 ??= bytesSha256(utf8(normalizationProfileRaw))),
      proj_version: normalizationPins.implementation.version,
      normalizer_version: normalizationPins.implementation.normalizer_version,
      pipeline_sha256: normalizationPins.operation.pipeline_sha256,
      receipt_file: proposal.receipt_file,
    },
    source_provenance: proposal.source_provenance,
    review: {
      reviewer: { kind: "human", name: reviewer, role: PROGRAM_SCREEN_REVIEWER_ROLE },
      reviewer_user_id: actor.id,
      reviewed_on: asOf,
      next_review_on: proposal.next_review_on,
    },
    state: { status: "current", superseded_by: null },
  };
  const parsed = reviewedLotRecordSchema.safeParse(input);
  const record = parsed.success ? parsed.data : null;
  return { reviewId, record, manifest: record === null ? null : await manifestSha256(record) };
}

/** R2-R10 on the completed record. Every error-severity diagnostic blocks publication. */
async function assessProposal(store: CaseStore, proposal: ReviewedLotProposal, completed: CompletedReview, asOf: string, now: Date): Promise<ProposalAssessment> {
  const diagnostics: CasePreparationDiagnostic[] = [];
  const error = (code: string, extra: Omit<CasePreparationDiagnostic, "code" | "severity"> = {}) => diagnostics.push({ code, severity: "error", ...extra });
  const { reviewId, record, manifest } = completed;

  // R2: a review term of at most 30 calendar days that begins on the server date.
  if (proposal.next_review_on <= asOf || proposal.next_review_on > addCalendarDays(asOf, MAX_REVIEW_TERM_DAYS)) error("REVIEW_TERM_OUT_OF_RANGE", { field: "next_review_on" });
  if (proposal.legal_lot_identity === "parcel_is_one_legal_lot" && proposal.legal_identity_evidence.length === 0) error("LEGAL_IDENTITY_EVIDENCE_REQUIRED", { field: "legal_identity_evidence" });
  if (record === null && diagnostics.length === 0) error("REVIEWED_LOT_RECORD_INVALID");

  // R4: one file ID names one (sha256, bytes); one sha256 has one file ID; no repeated reference within a list.
  const refs = proposalFileRefs(proposal);
  const byId = new Map<string, CaseFileRef>(), bySha = new Map<string, string>(), conflicts = new Set<string>();
  for (const { field, ref } of refs) {
    const named = byId.get(ref.file_id);
    if (named !== undefined && (named.sha256 !== ref.sha256 || named.bytes !== ref.bytes) && !conflicts.has(`id\0${ref.file_id}`)) {
      conflicts.add(`id\0${ref.file_id}`);
      error("FILE_REF_CONFLICT", { field });
    }
    const id = bySha.get(ref.sha256);
    if (id !== undefined && id !== ref.file_id && !conflicts.has(`sha\0${ref.sha256}`)) {
      conflicts.add(`sha\0${ref.sha256}`);
      error("FILE_REF_CONFLICT", { field, sha256: ref.sha256 });
    }
    byId.set(ref.file_id, named ?? ref);
    bySha.set(ref.sha256, id ?? ref.file_id);
  }
  for (const [field, list] of [["legal_identity_evidence", proposal.legal_identity_evidence], ["source_provenance.evidence_files", proposal.source_provenance.evidence_files]] as const) {
    const seen = new Set<string>();
    for (const ref of list) {
      if (seen.has(ref.sha256)) error("DUPLICATE_FILE_REF", { field, sha256: ref.sha256 });
      seen.add(ref.sha256);
    }
  }

  // R5: every reference is present in THIS case's blobs with its exact length and digest.
  const files = new StagedCaseFiles(store);
  const verified = new Map<string, Uint8Array>();
  const reported = new Set<string>();
  for (const { field, ref } of refs) {
    const checked = await files.check(ref);
    if ("bytes" in checked) verified.set(`${ref.file_id}\0${ref.sha256}\0${ref.bytes}`, checked.bytes);
    else if (!reported.has(`${checked.code}\0${ref.sha256}`)) {
      reported.add(`${checked.code}\0${ref.sha256}`);
      error(checked.code, { field, sha256: ref.sha256 });
    }
  }
  const bytesOf = (ref: CaseFileRef) => verified.get(`${ref.file_id}\0${ref.sha256}\0${ref.bytes}`);

  // R6: legal-identity evidence is a separate human document, never a geometry input, in an accepted medium.
  const geometryInputs = new Set([proposal.source_geometry.file.sha256, proposal.source_geometry.metadata_file.sha256, proposal.normalized_geometry.file.sha256, proposal.receipt_file.sha256]);
  proposal.legal_identity_evidence.forEach((ref, i) => {
    const field = `legal_identity_evidence.${i}`;
    if (geometryInputs.has(ref.sha256)) error("LEGAL_EVIDENCE_OVERLAPS_GEOMETRY_INPUTS", { field, sha256: ref.sha256 });
    const bytes = bytesOf(ref);
    if (bytes !== undefined && !hasLegalEvidenceSignature(bytes)) error("LEGAL_EVIDENCE_TYPE_UNSUPPORTED", { field, sha256: ref.sha256 });
  });

  // R7: HTTPS provenance only.
  for (const field of ["requested_url", "final_url"] as const) {
    if (new URL(proposal.source_provenance[field]).protocol !== "https:") error("PROVENANCE_URL_NOT_HTTPS", { field: `source_provenance.${field}` });
  }

  // R8: no timestamp after the server clock.
  if (Date.parse(proposal.source_provenance.retrieved_at_utc) > now.getTime()) error("TIMESTAMP_IN_FUTURE", { field: "source_provenance.retrieved_at_utc" });
  const receiptBytes = bytesOf(proposal.receipt_file);
  const receipt = receiptBytes === undefined ? undefined : asRecord(parsedJson(receiptBytes));
  if (typeof receipt?.normalized_at_utc === "string" && Date.parse(receipt.normalized_at_utc) > now.getTime()) {
    error("TIMESTAMP_IN_FUTURE", { field: "receipt.normalized_at_utc" });
  }

  // R9: the normalized polygon has the source feature's ring and position counts. No coordinate arithmetic.
  const sourceBytes = bytesOf(proposal.source_geometry.file);
  const normalizedBytes = bytesOf(proposal.normalized_geometry.file);
  const sourceJson = sourceBytes === undefined ? undefined : asRecord(parsedJson(sourceBytes));
  const sourceFeatures = Array.isArray(sourceJson?.features) && sourceJson.features.length === 1 ? sourceJson.features : undefined;
  const sourceFeature = asRecord(sourceFeatures?.[0]);
  const sourceRings = ringStructure(asRecord(sourceFeature?.geometry)?.rings);
  const normalizedRings = normalizedBytes === undefined ? undefined : ringStructure(asRecord(parsedJson(normalizedBytes))?.coordinates);
  if (sourceRings !== undefined && normalizedRings !== undefined && canonicalJson(sourceRings) !== canonicalJson(normalizedRings)) {
    error("NORMALIZED_STRUCTURE_MISMATCH", { field: "normalized_geometry.file" });
  }

  // R10: the unchanged lower-level verifier, through the same memoized case-only reader.
  if (record !== null) {
    try {
      await verifyReviewedLotEvidence(files, record, asOf);
    } catch (thrown) {
      const mapped = verifierDiagnostic(thrown, refs);
      if (!diagnostics.some((entry) => entry.code === mapped.code && entry.sha256 === mapped.sha256)) diagnostics.push(mapped);
    }
  }

  // Non-blocking: the human's legal-lot decision and the advisory attribute cross-check.
  if (proposal.legal_lot_identity !== "parcel_is_one_legal_lot") diagnostics.push({ code: "LEGAL_IDENTITY_NOT_ESTABLISHED", severity: "info", field: "legal_lot_identity" });
  const attributes = asRecord(sourceFeature?.attributes);
  if (attributes !== undefined) {
    const values = new Set(Object.values(attributes).filter((value) => typeof value === "string" || typeof value === "number").map((value) => String(value).trim().toLowerCase()));
    for (const field of ["tract", "lot"] as const) {
      if (!values.has(proposal.legal_lot_reference[field].trim().toLowerCase())) diagnostics.push({ code: "LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES", severity: "warning", field: `legal_lot_reference.${field}` });
    }
  }

  let geometry: ReviewedLotGeometry | null = null;
  if (normalizedBytes !== undefined) {
    const loaded = await loadReviewedLotGeometry({ file_id: proposal.normalized_geometry.file.file_id, bytes: normalizedBytes });
    if (loaded.valid && loaded.crs_epsg === 3310) geometry = loaded;
  }
  return { review_id: reviewId, record, manifest_sha256: manifest, diagnostics, geometry };
}

const hasErrors = (diagnostics: readonly CasePreparationDiagnostic[]) => diagnostics.some((entry) => entry.severity === "error");

function summary(record: ReviewedLotRecord, manifest: string): ProposedReviewSummary {
  return {
    review_id: record.review_id, reviewed_on: record.review.reviewed_on, next_review_on: record.review.next_review_on,
    legal_lot_identity: record.legal_lot_identity, manifest_sha256: manifest,
  };
}

/* ================================================================ public services */

/** Read-only status of the case's current review and CAL FIRE hydration. Makes no write. */
export async function readCasePreparationStatus(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  now: Date,
): Promise<CasePreparationStatus> {
  requireAdministrator(actor);
  const asOf = programScreenAsOf(now);
  const store = await openStore(bindings, actor, caseId, "read");
  let integrity: CasePreparationStatus["integrity"] = "ok";
  let current: CasePreparationStatus["current_review"] = null;
  let geometry: ReviewedLotGeometry | null = null;
  let review: CurrentReview = null;
  try {
    review = await readCurrentReview(store);
  } catch {
    integrity = "current_review_unreadable";
  }
  if (review !== null) {
    const record = review.record;
    const diagnostics: CasePreparationDiagnostic[] = [];
    let verified = false;
    try {
      geometry = (await verifyReviewedLotEvidence(store, record, asOf)).geometry;
      verified = true;
    } catch (thrown) {
      diagnostics.push(verifierDiagnostic(thrown, recordFileRefs(record)));
    }
    if (record.legal_lot_identity !== "parcel_is_one_legal_lot") diagnostics.push({ code: "LEGAL_IDENTITY_NOT_ESTABLISHED", severity: "info", field: "legal_lot_identity" });
    current = {
      review_id: record.review_id, state: record.state.status, reviewed_on: record.review.reviewed_on, next_review_on: record.review.next_review_on,
      legal_lot_identity: record.legal_lot_identity, reviewer_user_id: record.review.reviewer_user_id, revision: review.revision, verified, diagnostics,
    };
  }
  const hazard_routes = await hazardRouteStatuses(store, geometry, asOf);
  const complete = hazard_routes.every((route) => route.index === "present" && route.required_records !== null && route.required_records.every((entry) => entry.present));
  const readiness: CasePreparationStatus["readiness"] = current === null && integrity === "ok"
    ? "no_review"
    : current === null || !current.verified ? "review_unverified" : complete ? "ready" : "calfire_incomplete";
  return { schema_version: "program-screen-case-preparation-status-v1", case_id: store.case_id, as_of: asOf, as_of_basis: "server_utc_calendar_date", integrity, current_review: current, hazard_routes, readiness };
}

/** Stage 1: one immutable, content-addressed evidence blob in this case. Type is checked at validate/publish. */
export async function storeCasePreparationBlob(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  sha256: string,
  bytes: Uint8Array,
): Promise<{ sha256: string; bytes: number }> {
  requireAdministrator(actor);
  if (!isDigest(sha256)) throw new CasePreparationError("INVALID_DIGEST");
  if (bytes.length === 0) throw new CasePreparationError("EMPTY_BODY");
  if (bytes.length > CASE_PREPARATION_LIMITS.blob) throw new CasePreparationError("PAYLOAD_TOO_LARGE");
  if ((await bytesSha256(bytes)) !== sha256) throw new CasePreparationError("DIGEST_MISMATCH");
  const writer = await openStore(bindings, actor, caseId, "write");
  await writer.putFile({ store: "case_evidence_file", file_id: `sha256-${sha256.slice(0, 32)}`, sha256, bytes: bytes.length }, bytes);
  return { sha256, bytes: bytes.length };
}

/** Stage 1: a shipped, pinned CAL FIRE overlay index. The route and source come from the registries. */
export async function hydrateCalFireIndex(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  indexSha256: string,
  bytes: Uint8Array,
): Promise<{ route: PreparationHazardRoute; authority_source_id: string; index_sha256: string }> {
  requireAdministrator(actor);
  if (!isDigest(indexSha256)) throw new CasePreparationError("INVALID_DIGEST");
  const resolved = HAZARD_ROUTES.map(resolveRoute).find((entry) => entry !== null && entry.pin.index_sha256 === indexSha256);
  if (resolved === undefined || resolved === null) throw new CasePreparationError("UNPINNED_INDEX");
  if (bytes.length === 0) throw new CasePreparationError("EMPTY_BODY");
  if (bytes.length > CASE_PREPARATION_LIMITS.index) throw new CasePreparationError("PAYLOAD_TOO_LARGE");
  // Raw bytes are hashed before any decoding; a BOM or re-encoding cannot pass as the pinned index.
  if ((await bytesSha256(bytes)) !== indexSha256) throw new CasePreparationError("DIGEST_MISMATCH");
  let text: string;
  try {
    text = indexDecoder().decode(bytes);
  } catch {
    throw new CasePreparationError("CALFIRE_INDEX_INVALID");
  }
  const writer = await openStore(bindings, actor, caseId, "write");
  try {
    await writer.ingestCalFire(text, []);
  } catch {
    throw new CasePreparationError("CALFIRE_INDEX_INVALID");
  }
  return { route: resolved.route, authority_source_id: resolved.authority_source_id, index_sha256: indexSha256 };
}

/** Stage 1: one CAL FIRE record, accepted only where a stored pinned index lists its digest. */
export async function hydrateCalFireRecord(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  contentSha256: string,
  bytes: Uint8Array,
): Promise<{ content_sha256: string; content_bytes: number; matches: Array<{ route: PreparationHazardRoute; record_number: number }> }> {
  requireAdministrator(actor);
  if (!isDigest(contentSha256)) throw new CasePreparationError("INVALID_DIGEST");
  if (bytes.length === 0) throw new CasePreparationError("EMPTY_BODY");
  if (bytes.length > CASE_PREPARATION_LIMITS.record) throw new CasePreparationError("PAYLOAD_TOO_LARGE");
  if ((await bytesSha256(bytes)) !== contentSha256) throw new CasePreparationError("DIGEST_MISMATCH");
  const writer = await openStore(bindings, actor, caseId, "write");
  const indexes: Array<{ resolved: ResolvedRoute; text: string; view: OverlayDatasetView }> = [];
  for (const entry of HAZARD_ROUTES) {
    const resolved = resolveRoute(entry);
    const index = resolved === null ? null : await storedIndex(writer, resolved);
    if (index !== null) indexes.push({ resolved: resolved!, ...index });
  }
  if (indexes.length === 0) throw new CasePreparationError("CALFIRE_INDEX_REQUIRED");
  const matches = indexes.flatMap(({ resolved, text, view }) =>
    view.entries().filter((entry) => entry.content_sha256 === contentSha256).map((entry) => ({ route: resolved.route, record_number: entry.record_number, text })));
  if (matches.length === 0) throw new CasePreparationError("RECORD_NOT_IN_PINNED_INDEX");
  for (const match of matches) {
    try {
      await writer.ingestCalFire(match.text, [{ record_number: match.record_number, content: bytes }]);
    } catch {
      throw new CasePreparationError("CALFIRE_RECORD_INVALID");
    }
  }
  return { content_sha256: contentSha256, content_bytes: bytes.length, matches: matches.map(({ route, record_number }) => ({ route, record_number })) };
}

/** Builds and checks the exact server-completed review. Writes nothing. */
export async function validateReviewedLotProposal(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  body: unknown,
  now: Date,
): Promise<CasePreparationValidation> {
  requireAdministrator(actor);
  const asOf = programScreenAsOf(now);
  const { proposal, expected_revision } = parseBody(proposalBodySchema, body);
  const store = await openStore(bindings, actor, caseId, "read");
  const reviewer = await reviewerName(bindings.DB, actor.id);
  const integrity: CasePreparationDiagnostic[] = [];
  let current: CurrentReview = null;
  let readable = true;
  try {
    current = await readCurrentReview(store);
  } catch {
    readable = false;
    integrity.push({ code: "CURRENT_REVIEW_UNREADABLE", severity: "error" });
  }
  const assessment = await assessProposal(store, proposal, await completedReview(store.case_id, actor, reviewer, proposal, expected_revision, asOf), asOf, now);
  const hazard_routes = await hazardRouteStatuses(store, assessment.geometry, asOf);
  const diagnostics = [...integrity, ...assessment.diagnostics, ...hazardRouteDiagnostics(hazard_routes)];
  return {
    schema_version: "program-screen-case-preparation-validation-v1",
    case_id: store.case_id,
    as_of: asOf,
    valid: !hasErrors(diagnostics),
    expected_revision_current: readable && (current?.revision ?? null) === expected_revision,
    review: assessment.record === null || assessment.manifest_sha256 === null ? null : summary(assessment.record, assessment.manifest_sha256),
    diagnostics,
    hazard_routes,
  };
}

/** Repeats every validation, records the audit intent, then publishes through the existing CAS. */
export async function publishReviewedLotProposal(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  body: unknown,
  now: Date,
  requestId: string,
): Promise<CasePreparationPublication> {
  requireAdministrator(actor);
  const asOf = programScreenAsOf(now);
  const { proposal, expected_revision } = parseBody(proposalBodySchema, body);
  const writer = await openStore(bindings, actor, caseId, "write");
  const reviewer = await reviewerName(bindings.DB, actor.id);
  const current = await readCurrentReview(writer);
  const derived = await completedReview(writer.case_id, actor, reviewer, proposal, expected_revision, asOf);
  const priorRevision = current?.revision ?? null;
  if (priorRevision !== expected_revision) {
    // An identical retry of an already-committed publication returns that publication.
    if (current !== null && derived.record !== null && derived.manifest !== null &&
      current.record.review_id === derived.reviewId && (await manifestSha256(current.record)) === derived.manifest) {
      return { schema_version: "program-screen-case-publication-v1", case_id: writer.case_id, ...summary(derived.record, derived.manifest), prior_revision: expected_revision, revision: current.revision, replayed: true, diagnostics: [] };
    }
    throw new CasePreparationError("REVISION_CHANGED");
  }
  const assessment = await assessProposal(writer, proposal, derived, asOf, now);
  const diagnostics = [...assessment.diagnostics, ...hazardRouteDiagnostics(await hazardRouteStatuses(writer, assessment.geometry, asOf))];
  if (hasErrors(diagnostics) || assessment.record === null || assessment.manifest_sha256 === null) throw new CasePreparationError("PREPARATION_INVALID", { diagnostics });
  const record = assessment.record, manifest = assessment.manifest_sha256;
  const eventId = crypto.randomUUID();
  try {
    await insertReviewEventIntent(bindings.DB, {
      id: eventId, case_id: writer.case_id, actor_user_id: actor.id, action: "publish", review_id: record.review_id,
      prior_revision: expected_revision, new_manifest_sha256: manifest, reason: null, request_id: auditRequestId(requestId),
    });
  } catch {
    throw new CasePreparationError("AUDIT_UNAVAILABLE");
  }
  let revision: string;
  try {
    revision = await writer.ingestReviewedLot(record, expected_revision, asOf);
  } catch (thrown) {
    const conflict = isPublicationConflict(thrown);
    await completeReviewEvent(bindings.DB, eventId, conflict ? "conflict" : "failed", null).catch(() => false);
    if (conflict) throw new CasePreparationError("REVISION_CHANGED");
    const mapped = verifierDiagnostic(thrown, proposalFileRefs(proposal));
    if (mapped.code === "REVIEWED_LOT_VERIFICATION_FAILED") throw thrown;
    throw new CasePreparationError("PREPARATION_INVALID", { diagnostics: [mapped] });
  }
  const completed = await completeReviewEvent(bindings.DB, eventId, "committed", revision).catch(() => false);
  if (!completed) console.error("Program Screen review publication committed; its audit completion was not recorded.", { event_id: eventId });
  return { schema_version: "program-screen-case-publication-v1", case_id: writer.case_id, ...summary(record, manifest), prior_revision: expected_revision, revision, replayed: false, diagnostics };
}

/** Marks the current review stale through the existing CAS invalidation, with an audit record. */
export async function invalidateCurrentReview(
  bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">,
  actor: CaseActor,
  caseId: string,
  body: unknown,
  now: Date,
  requestId: string,
): Promise<CaseReviewInvalidation> {
  requireAdministrator(actor);
  const { expected_revision, reason } = parseBody(invalidationBodySchema, body);
  const writer = await openStore(bindings, actor, caseId, "write");
  const current = await readCurrentReview(writer);
  if (current === null) throw new CasePreparationError("NO_CURRENT_REVIEW");
  if (current.revision !== expected_revision) throw new CasePreparationError("REVISION_CHANGED");
  const reviewed = current.record;
  if (reviewed.state.status !== "current") throw new CasePreparationError("REVIEW_NOT_CURRENT");
  // The manifest invalidateReview will publish: the same record with only its state changed.
  const stale = await manifestSha256(reviewedLotRecordSchema.parse({ ...reviewed, state: { status: "stale", superseded_by: null } }));
  const eventId = crypto.randomUUID();
  try {
    await insertReviewEventIntent(bindings.DB, {
      id: eventId, case_id: writer.case_id, actor_user_id: actor.id, action: "invalidate", review_id: reviewed.review_id,
      prior_revision: expected_revision, new_manifest_sha256: stale, reason, request_id: auditRequestId(requestId),
    });
  } catch {
    throw new CasePreparationError("AUDIT_UNAVAILABLE");
  }
  let revision: string;
  try {
    revision = await writer.invalidateReview("stale", expected_revision, null);
  } catch (thrown) {
    const conflict = isPublicationConflict(thrown);
    await completeReviewEvent(bindings.DB, eventId, conflict ? "conflict" : "failed", null).catch(() => false);
    if (conflict) throw new CasePreparationError("REVISION_CHANGED");
    throw thrown;
  }
  const completed = await completeReviewEvent(bindings.DB, eventId, "committed", revision).catch(() => false);
  if (!completed) console.error("Program Screen review invalidation committed; its audit completion was not recorded.", { event_id: eventId, at: now.toISOString() });
  return { schema_version: "program-screen-case-invalidation-v1", case_id: writer.case_id, review_id: reviewed.review_id, state: "stale", prior_revision: expected_revision, revision };
}
