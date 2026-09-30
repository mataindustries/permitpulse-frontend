import { z } from "zod";
import normalizationProfile from "./normalization-profile.json";
import normalizationProfileRaw from "./normalization-profile.json?raw";
import { legalLotIdentities, isIsoCalendarDate, authorityHumanReviewerSchema } from "./evidence-authority";
import { loadReviewedLotGeometry, type ReviewedLotGeometry } from "./lot-overlay";

export const REVIEWED_LOT_VERSION = "program-screen-reviewed-lot-v1" as const;
export const normalizationPins = normalizationProfile;
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const text = z.string().trim().min(1).max(256);
const date = z.string().refine(isIsoCalendarDate);
const timestamp = z.iso.datetime({ offset: true });

export const caseFileRefSchema = z.object({
  store: z.literal("case_evidence_file"),
  file_id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/),
  sha256: digest,
  bytes: z.number().int().positive().max(8 * 1024 * 1024),
}).strict();
export type CaseFileRef = z.infer<typeof caseFileRefSchema>;

const crsSchema = z.object({
  wkid: z.number().int().positive(), latest_wkid: z.number().int().positive().nullable(), epsg: z.literal(3857),
}).strict();

/** APN identifies the assessor parcel; the structured recorded reference is a separate claim. */
export const reviewedLotRecordSchema = z.object({
  schema_version: z.literal(REVIEWED_LOT_VERSION),
  review_id: z.uuid(),
  case_id: z.uuid(),
  parcel: z.object({ apn: z.string().regex(/^\d{10}$/), pin: text, pind: text.nullable() }).strict(),
  legal_lot_reference: z.object({
    subdivision_type: z.literal("tract"), tract: text, lot: text,
    map_book: text, map_pages: z.object({ first: z.number().int().positive(), last: z.number().int().positive() }).strict(),
  }).strict(),
  legal_lot_identity: z.enum(legalLotIdentities),
  /** Named human's current-identity basis. Historical map/GIS references alone never fill this automatically. */
  legal_identity_evidence: z.array(caseFileRefSchema).max(20),
  source_geometry: z.object({
    file: caseFileRefSchema, metadata_file: caseFileRefSchema, crs: crsSchema,
    identity_fields: z.object({ apn: text, pin: text }).strict(),
  }).strict(),
  normalized_geometry: z.object({ file: caseFileRefSchema, crs: z.literal("EPSG:3310"), serialization: z.literal(normalizationProfile.serialization) }).strict(),
  reprojection: z.object({
    profile_id: z.literal(normalizationProfile.profile_id), profile_sha256: digest,
    proj_version: z.literal("9.9.0"), normalizer_version: z.literal("1.0.1"),
    pipeline_sha256: z.literal(normalizationProfile.operation.pipeline_sha256), receipt_file: caseFileRefSchema,
  }).strict(),
  source_provenance: z.object({
    agency: text, requested_url: z.url(), final_url: z.url(), retrieved_at_utc: timestamp,
    evidence_files: z.array(caseFileRefSchema).min(1).max(20),
  }).strict(),
  review: z.object({ reviewer: authorityHumanReviewerSchema, reviewer_user_id: text, reviewed_on: date, next_review_on: date }).strict(),
  state: z.object({ status: z.enum(["current", "stale", "superseded", "unreviewed"]), superseded_by: z.uuid().nullable() }).strict(),
}).strict().superRefine((record, ctx) => {
  if (record.legal_lot_reference.map_pages.first > record.legal_lot_reference.map_pages.last) ctx.addIssue({ code: "custom", message: "Recorded map page range is reversed." });
  if (record.review.next_review_on <= record.review.reviewed_on) ctx.addIssue({ code: "custom", message: "Review expiry must follow review." });
  if (record.legal_lot_identity === "parcel_is_one_legal_lot" && record.legal_identity_evidence.length === 0) ctx.addIssue({ code: "custom", message: "An established legal-lot identity needs the human review's private evidence references." });
});
export type ReviewedLotRecord = z.infer<typeof reviewedLotRecordSchema>;

const receiptSchema = z.object({
  schema_version: z.literal("program-screen-normalization-receipt-v1"),
  profile_id: z.literal(normalizationProfile.profile_id), profile_sha256: digest,
  implementation: z.unknown(),
  source: z.object({ sha256: digest, metadata_sha256: digest, crs: crsSchema }).strict(),
  target: z.object({ crs_epsg: z.literal(3310), sha256: digest, bytes: z.number().int().positive(), serialization: z.literal(normalizationProfile.serialization) }).strict(),
  operation: z.unknown(), resources: z.unknown(), network_enabled: z.literal(false), test_only: z.boolean(), normalized_at_utc: timestamp,
}).strict();

export interface ReviewedLotEvidenceReader {
  readonly case_id: string;
  getFile(ref: CaseFileRef): Promise<Uint8Array | null>;
}

export async function bytesSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeEvidenceJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function verifiedCaseFile(reader: ReviewedLotEvidenceReader, ref: CaseFileRef): Promise<Uint8Array> {
  const bytes = await reader.getFile(ref);
  if (bytes === null) throw new Error(`Missing case evidence file: ${ref.file_id}`);
  if (bytes.length !== ref.bytes || await bytesSha256(bytes) !== ref.sha256) throw new Error(`Case evidence hash/length mismatch: ${ref.file_id}`);
  return bytes;
}

const spatialReference = z.object({ wkid: z.number().int(), latestWkid: z.number().int().optional() }).passthrough();
const sourceSchema = z.object({
  spatialReference: spatialReference.optional(),
  features: z.array(z.object({
    attributes: z.record(z.string(), z.unknown()),
    geometry: z.object({
      rings: z.array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(4)).min(1).max(50),
      spatialReference: spatialReference.optional(),
    }).passthrough(),
  }).passthrough()).length(1),
}).passthrough();
const metadataSchema = z.object({ geometryType: z.literal("esriGeometryPolygon"), extent: z.object({ spatialReference }).passthrough() }).passthrough();

/** Validation only: no projection or address lookup is implemented in runtime code. */
function validateCapturedSource(record: ReviewedLotRecord, sourceBytes: Uint8Array, metadataBytes: Uint8Array): boolean {
  const source = sourceSchema.parse(decodeEvidenceJson(sourceBytes));
  const metadata = metadataSchema.parse(decodeEvidenceJson(metadataBytes));
  const testOnly = "TEST_ONLY" in source || "TEST_ONLY" in metadata;
  const testNamespace = [record.parcel.pin, record.legal_lot_reference.tract, record.legal_lot_reference.lot, record.source_provenance.agency,
    record.source_geometry.file.file_id, record.source_geometry.metadata_file.file_id, record.normalized_geometry.file.file_id].some((value) => /test[-_]only/i.test(value)) ||
    [record.source_provenance.requested_url, record.source_provenance.final_url].some((url) => new URL(url).hostname.endsWith(".test"));
  // Vite folds both conditions to false in every production build, including --mode test.
  if ((testOnly || testNamespace) && !(import.meta.env.MODE === "test" && !import.meta.env.PROD)) throw new Error("TEST-ONLY evidence cannot enter a production case evaluation.");
  const feature = source.features[0];
  if ("curveRings" in feature.geometry || feature.geometry.hasZ || feature.geometry.hasM || feature.geometry.rings.flat().length > 2000) throw new Error("Captured geometry is not supported linear 2D geometry.");
  const declarations = [metadata.extent.spatialReference, source.spatialReference, feature.geometry.spatialReference].filter((value) => value !== undefined);
  for (const crs of declarations) {
    if (!(crs.wkid === 3857 && (crs.latestWkid === undefined || crs.latestWkid === 3857)) && !([102100, 102113].includes(crs.wkid) && crs.latestWkid === 3857)) throw new Error("Captured CRS differs from approved EPSG:3857.");
  }
  const captured = metadata.extent.spatialReference;
  if (captured.wkid !== record.source_geometry.crs.wkid || (captured.latestWkid ?? null) !== record.source_geometry.crs.latest_wkid) throw new Error("Reviewed source CRS differs from captured metadata.");
  const fields = record.source_geometry.identity_fields;
  if (String(feature.attributes[fields.apn]) !== record.parcel.apn || feature.attributes[fields.pin] !== record.parcel.pin) throw new Error("Captured identifiers differ from the reviewed parcel identifiers.");
  return testOnly;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Only a current, case-bound human review with pinned offline provenance may supply evaluation geometry. */
export async function verifyReviewedLotEvidence(reader: ReviewedLotEvidenceReader, input: unknown, asOf: string): Promise<{ record: ReviewedLotRecord; geometry: ReviewedLotGeometry }> {
  const record = reviewedLotRecordSchema.parse(input);
  if (!isIsoCalendarDate(asOf)) throw new Error("An explicit evaluation date is required.");
  if (record.case_id !== reader.case_id) throw new Error("Reviewed lot belongs to another case.");
  if (record.state.status !== "current" || record.state.superseded_by !== null || record.review.reviewed_on > asOf || asOf >= record.review.next_review_on) throw new Error("Reviewed geometry is stale, superseded, unreviewed, or future-dated.");
  // Source byte verification precedes source parsing and normalized-file acceptance.
  const sourceBytes = await verifiedCaseFile(reader, record.source_geometry.file);
  const metadataBytes = await verifiedCaseFile(reader, record.source_geometry.metadata_file);
  const testOnly = validateCapturedSource(record, sourceBytes, metadataBytes);
  const receipt = receiptSchema.parse(decodeEvidenceJson(await verifiedCaseFile(reader, record.reprojection.receipt_file)));
  if (receipt.test_only !== testOnly) throw new Error("Normalization receipt misstates the TEST-ONLY source boundary.");
  const profileHash = await bytesSha256(new TextEncoder().encode(normalizationProfileRaw));
  if (record.reprojection.profile_sha256 !== profileHash || receipt.profile_sha256 !== profileHash || canonical(receipt.implementation) !== canonical(normalizationProfile.implementation) || canonical(receipt.operation) !== canonical(normalizationProfile.operation) || canonical(receipt.resources) !== canonical(normalizationProfile.resources)) throw new Error("Offline normalization does not match the approved pinned implementation.");
  if (receipt.source.sha256 !== record.source_geometry.file.sha256 || receipt.source.metadata_sha256 !== record.source_geometry.metadata_file.sha256 || canonical(receipt.source.crs) !== canonical(record.source_geometry.crs) || receipt.target.sha256 !== record.normalized_geometry.file.sha256 || receipt.target.bytes !== record.normalized_geometry.file.bytes) throw new Error("Normalization receipt is not linked to these source/normalized bytes.");
  if (receipt.normalized_at_utc.slice(0, 10) > record.review.reviewed_on || Date.parse(record.source_provenance.retrieved_at_utc) > Date.parse(receipt.normalized_at_utc)) throw new Error("Normalization/review chronology is inconsistent.");
  for (const file of [...record.source_provenance.evidence_files, ...record.legal_identity_evidence]) await verifiedCaseFile(reader, file);
  const geometry = await loadReviewedLotGeometry({ file_id: record.normalized_geometry.file.file_id, bytes: await verifiedCaseFile(reader, record.normalized_geometry.file) });
  if (!geometry.valid || geometry.crs_epsg !== 3310) throw new Error("Reviewed normalized geometry is invalid or is not EPSG:3310.");
  return { record, geometry };
}
