import { maySetEvidenceVerification, type CaseActor } from "../cases/authorization";
import { getCaseForActor, getEditableCaseForActor } from "../cases/repository";
import { R2EvidenceFileStore } from "../evidence-intake/file-store";
import type { Bindings } from "../types";
import {
  bytesSha256, caseFileRefSchema, decodeEvidenceJson, reviewedLotRecordSchema, verifyReviewedLotEvidence,
  type CaseFileRef, type ReviewedLotEvidenceReader, type ReviewedLotRecord,
} from "../../shared/program-screen/reviewed-lot";
import { loadOverlayDatasetView, overlayIndexPins } from "../../shared/program-screen/overlay-dataset";

export interface CaseReviewSnapshot { record: unknown; revision: string }
export interface ProgramScreenCaseEvidenceStore extends ReviewedLotEvidenceReader {
  readReview(): Promise<CaseReviewSnapshot | null>;
  revisionIsCurrent(revision: string): Promise<boolean>;
  getOverlayIndex(indexSha256: string): Promise<Uint8Array | null>;
  getOverlayRecord(contentSha256: string): Promise<Uint8Array | null>;
}

function prefix(caseId: string): string {
  // Validated independently of every manifest; no caller-supplied storage key is accepted.
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) throw new Error("Invalid case evidence scope.");
  return `${caseId}/program-screen`;
}

/** Internal adapter. Application callers open it through the existing case authorization checks below. */
class R2ProgramScreenCaseStore implements ProgramScreenCaseEvidenceStore {
  readonly case_id: string;
  private readonly root: string;
  private readonly files: R2EvidenceFileStore;

  constructor(private readonly bucket: R2Bucket, caseId: string, private readonly writeActorId: string | null = null) {
    this.case_id = caseId;
    this.root = prefix(caseId);
    this.files = new R2EvidenceFileStore(bucket);
  }

  private async read(key: string, maxBytes = 8 * 1024 * 1024): Promise<Uint8Array | null> {
    const file = await this.files.get(key);
    if (file === null) return null;
    if (file.size > maxBytes) throw new Error("Case evidence file exceeds its bound.");
    return new Uint8Array(await file.arrayBuffer());
  }

  getFile(ref: CaseFileRef): Promise<Uint8Array | null> {
    caseFileRefSchema.parse(ref);
    return this.read(`${this.root}/blobs/${ref.sha256}`);
  }

  async readReview(): Promise<CaseReviewSnapshot | null> {
    const file = await this.bucket.get(`${this.root}/current-review.json`);
    if (file === null) return null;
    if (file.size > 128 * 1024) throw new Error("Reviewed manifest is oversized.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (await bytesSha256(bytes) !== file.customMetadata?.contentSha256) throw new Error("Reviewed manifest integrity mismatch.");
    return { record: decodeEvidenceJson(bytes), revision: file.etag };
  }

  async revisionIsCurrent(revision: string): Promise<boolean> {
    return (await this.bucket.head(`${this.root}/current-review.json`))?.etag === revision;
  }

  getOverlayIndex(indexSha256: string): Promise<Uint8Array | null> {
    if (!overlayIndexPins.some((pin) => pin.index_sha256 === indexSha256)) throw new Error("Unpinned overlay index.");
    return this.read(`${this.root}/calfire/index-${indexSha256}.txt`, 4 * 1024 * 1024);
  }

  getOverlayRecord(contentSha256: string): Promise<Uint8Array | null> {
    if (!/^[0-9a-f]{64}$/.test(contentSha256)) throw new Error("Malformed record digest.");
    return this.read(`${this.root}/calfire/record-${contentSha256}.bin`, 16 * 1024 * 1024);
  }

  private requireWriter(): void {
    if (this.writeActorId === null) throw new Error("This case evidence store is read-only.");
  }

  private async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const sha = await bytesSha256(bytes);
    await this.files.put(key, bytes.slice().buffer as ArrayBuffer, {
      contentSha256: sha, contentType, filename: key.split("/").at(-1)!,
      sha256: Uint8Array.from(sha.match(/../g)!, (part) => Number.parseInt(part, 16)).buffer,
    });
  }

  /** Source/metadata/receipt/normalized files all stay inside the existing private bucket. */
  async putFile(ref: CaseFileRef, bytes: Uint8Array): Promise<void> {
    this.requireWriter();
    caseFileRefSchema.parse(ref);
    if (bytes.length !== ref.bytes || await bytesSha256(bytes) !== ref.sha256) throw new Error("Case evidence upload hash/length mismatch.");
    await this.put(`${this.root}/blobs/${ref.sha256}`, bytes, "application/octet-stream");
  }

  /** Partial candidate ingestion is permitted; missing records at evaluation always fail closed. */
  async ingestCalFire(indexText: string, records: Array<{ record_number: number; content: Uint8Array }>): Promise<void> {
    this.requireWriter();
    const view = await loadOverlayDatasetView({ index_text: indexText, records });
    if (view.crs_epsg !== 3310 || view.class_field !== "FHSZ_Descr" || view.layer !== "FHSZSRA_23_3") throw new Error("Unexpected CAL FIRE overlay metadata.");
    for (const record of records) await this.put(`${this.root}/calfire/record-${await bytesSha256(record.content)}.bin`, record.content, "application/octet-stream");
    await this.put(`${this.root}/calfire/index-${view.index_sha256}.txt`, new TextEncoder().encode(indexText), "text/plain; charset=utf-8");
  }

  private async publish(record: ReviewedLotRecord, expectedRevision: string | null): Promise<string> {
    const bytes = new TextEncoder().encode(`${JSON.stringify(record)}\n`);
    const sha = await bytesSha256(bytes);
    await this.put(`${this.root}/reviews/${record.review_id}-${sha}.json`, bytes, "application/json");
    const current = await this.bucket.put(`${this.root}/current-review.json`, bytes, {
      httpMetadata: { contentType: "application/json" }, customMetadata: { contentSha256: sha },
      onlyIf: expectedRevision === null ? { etagDoesNotMatch: "*" } : { etagMatches: expectedRevision },
    });
    if (current === null) throw new Error("Reviewed manifest changed; reload before publishing.");
    return current.etag;
  }

  /** Publish only after verifying the offline receipt and files, with an explicit human review and CAS. */
  async ingestReviewedLot(input: unknown, expectedRevision: string | null, asOf: string): Promise<string> {
    this.requireWriter();
    const { record } = await verifyReviewedLotEvidence(this, input, asOf);
    if (record.review.reviewer_user_id !== this.writeActorId) throw new Error("Review must identify the authenticated writer.");
    return this.publish(record, expectedRevision);
  }

  async invalidateReview(state: "stale" | "superseded", expectedRevision: string, supersededBy: string | null = null): Promise<string> {
    this.requireWriter();
    const current = await this.readReview();
    if (current === null || current.revision !== expectedRevision) throw new Error("Reviewed manifest changed.");
    const record = reviewedLotRecordSchema.parse(current.record);
    if (record.case_id !== this.case_id) throw new Error("Reviewed manifest belongs to another case.");
    return this.publish(reviewedLotRecordSchema.parse({ ...record, state: { status: state, superseded_by: supersededBy } }), expectedRevision);
  }
}

/** Existing case visibility/edit rules are the authorization boundary; no new public file route is exposed. */
export async function openProgramScreenCaseStore(bindings: Pick<Bindings, "DB" | "EVIDENCE_FILES">, actor: CaseActor, caseId: string, access: "read" | "write" = "read"): Promise<R2ProgramScreenCaseStore> {
  const allowed = access === "write" ? await getEditableCaseForActor(bindings.DB, actor, caseId) : await getCaseForActor(bindings.DB, actor, caseId);
  if (allowed === null) throw new Error("Case evidence access denied.");
  if (access === "write" && !maySetEvidenceVerification(actor)) throw new Error("Case evidence verification permission denied.");
  if (bindings.EVIDENCE_FILES === undefined) throw new Error("Private evidence storage is unavailable.");
  return new R2ProgramScreenCaseStore(bindings.EVIDENCE_FILES, caseId, access === "write" ? actor.id : null);
}
