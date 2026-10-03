import { env } from "cloudflare:workers";
import { expect } from "vitest";
import reviewedJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import metadataText from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import sraReceiptText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import sraSourceText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import type { legalLotIdentities } from "../src/shared/program-screen/evidence-authority";
import { bytesSha256, type CaseFileRef } from "../src/shared/program-screen/reviewed-lot";
import type { CaseActor } from "../src/worker/cases/authorization";
import { CasePreparationError, type CasePreparationDiagnostic } from "../src/worker/program-screen/case-preparation";
import type { Bindings } from "../src/worker/types";
import { encode, ring } from "./program-screen-lra-helpers";

/* Every case, user, lot, file, receipt and proposal built here is TEST-ONLY. */

export const AS_OF = "2026-10-01";
export const REVIEWER_ROLE = "Administrator (Program Screen reviewed-lot publication)";
export const ADMIN_NAME = "TEST-ONLY 3K Administrator";
export const utf8 = (value: string) => new TextEncoder().encode(value);
export const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
export const PDF = utf8("%PDF-1.7\n% TEST-ONLY fictional legal-lot review; no real deed.\n");
export type LegalLotIdentity = (typeof legalLotIdentities)[number];
/** Proposals are edited freely by the refusal tests below. */
export type Proposal = any;


export function lotFromRings(rings: number[][][], crs = "EPSG:3310"): string {
  return decode(encode({ schema_version: "program-screen-lot-geometry-v1", crs, type: "Polygon", coordinates: rings }));
}
/** A lot at x+0..x+60 selects the TEST-ONLY world zone at x..x+100. */
export const lotAt = (x: number) => lotFromRings([ring(x, 20, x + 60, 80)]);

export async function insertCase(caseId: string = crypto.randomUUID()): Promise<string> {
  await env.DB.prepare("INSERT INTO cases (id, project_name, client_name, address, city, jurisdiction) VALUES (?, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY', 'Los Angeles', 'City of Los Angeles')").bind(caseId).run();
  return caseId;
}
export async function insertUser(role: "admin" | "client", name: string = role === "admin" ? ADMIN_NAME : "TEST-ONLY 3K client"): Promise<CaseActor> {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').bind(id, name, `test-only-3k-${id}@example.test`).run();
  if (role === "admin") await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?').bind("admin", id).run();
  return { id, role };
}
export async function addOwner(caseId: string, userId: string): Promise<void> {
  await env.DB.prepare("INSERT INTO case_participants (case_id, user_id, participant_role) VALUES (?, ?, 'owner')").bind(caseId, userId).run();
}
export function serviceBindings(overrides: Partial<Pick<Bindings, "DB" | "EVIDENCE_FILES">> = {}): Pick<Bindings, "DB" | "EVIDENCE_FILES"> {
  return { DB: env.DB, EVIDENCE_FILES: env.EVIDENCE_FILES, ...overrides };
}

/** Records every private-bucket call, and optionally intervenes before it runs. */
export function proxiedBucket(before?: (method: string, key: string) => Promise<void> | void) {
  const calls: string[] = [];
  const base = env.EVIDENCE_FILES;
  const bucket = new Proxy(base, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        calls.push(`${String(property)}:${String(args[0])}`);
        await before?.(String(property), String(args[0]));
        return value.apply(target, args);
      };
    },
  });
  return { bucket, calls };
}
export const bucketWrites = (calls: readonly string[]) => calls.filter((call) => /^(put|delete|createMultipartUpload|resumeMultipartUpload):/.test(call));

/** Records every D1 call; `replace` may substitute a prepared statement. */
export function proxiedDb(replace?: (sql: string) => D1PreparedStatement | undefined) {
  const calls: string[] = [];
  const db = new Proxy(env.DB, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        calls.push(`${String(property)}:${String(args[0]).replace(/\s+/g, " ").trim()}`);
        if (property === "prepare") {
          const replaced = replace?.(String(args[0]));
          if (replaced !== undefined) return replaced;
        }
        return value.apply(target, args);
      };
    },
  });
  return { db, calls };
}
export const failingStatement = (message: string) => ({
  bind: () => ({ run: async () => { throw new Error(message); }, first: async () => { throw new Error(message); }, all: async () => { throw new Error(message); } }),
}) as unknown as D1PreparedStatement;

export async function fileRef(file_id: string, bytes: Uint8Array): Promise<CaseFileRef> {
  return { store: "case_evidence_file", file_id, sha256: await bytesSha256(bytes), bytes: bytes.length };
}

/** A TEST-ONLY source capture with the given ring structure (the coordinates are never compared). */
export function syntheticSource(rings: number[][][], attributes: Record<string, unknown> = { APN: "0000000001", PIN: "TEST-ONLY-PIN-3F", TR: "TEST-ONLY-TRACT", LOT: "1" }, geometryExtra: Record<string, unknown> = {}): string {
  const shifted = rings.map((r) => r.map(([x, y]) => [-13043980 + x / 10, 4003918 + y / 10]));
  return `${JSON.stringify({ TEST_ONLY: true, spatialReference: { wkid: 102100, latestWkid: 3857 }, features: [{ attributes, geometry: { rings: shifted, ...geometryExtra } }] }, null, 2)}\n`;
}

export interface ProposalSpec {
  lot?: string;
  identity?: LegalLotIdentity;
  /** Legal-identity evidence bytes; defaults to one PDF for an established identity. */
  legal?: Uint8Array[];
  sourceText?: string;
  metadataText?: string;
  nextReviewOn?: string;
  receipt?: (draft: Proposal) => void;
  edit?: (proposal: Proposal) => void;
  /** File ID namespace; a suffix keeps different proposals' file IDs distinct. */
  tag?: string;
}
export interface BuiltProposal {
  proposal: Proposal;
  files: Map<string, Uint8Array>;
  refs: { source: CaseFileRef; metadata: CaseFileRef; normalized: CaseFileRef; receipt: CaseFileRef; legal: CaseFileRef[] };
}

/** The reviewer's claims from the 3F TEST-ONLY review, with this lot's offline outputs and a linked receipt. */
export async function buildProposal(spec: ProposalSpec = {}): Promise<BuiltProposal> {
  const tag = spec.tag ?? "test-only-3k";
  const lotText = spec.lot ?? lotAt(220);
  const rings = (JSON.parse(lotText) as { coordinates: number[][][] }).coordinates;
  const sourceText = spec.sourceText ?? (rings.length === 1 && rings[0].length === 5 ? sraSourceText : syntheticSource(rings));
  const source = utf8(sourceText), metadata = utf8(spec.metadataText ?? metadataText), normalized = utf8(lotText);
  const sourceRef = await fileRef(`${tag}-source`, source), metadataRef = await fileRef(`${tag}-metadata`, metadata), normalizedRef = await fileRef(`${tag}-normalized`, normalized);
  const receiptJson = JSON.parse(sraReceiptText);
  receiptJson.source.sha256 = sourceRef.sha256;
  receiptJson.source.metadata_sha256 = metadataRef.sha256;
  receiptJson.target.sha256 = normalizedRef.sha256;
  receiptJson.target.bytes = normalizedRef.bytes;
  spec.receipt?.(receiptJson);
  const receipt = encode(receiptJson);
  const receiptRef = await fileRef(`${tag}-normalization-receipt`, receipt);
  const identity = spec.identity ?? "parcel_is_one_legal_lot";
  const legalBytes = spec.legal ?? (identity === "parcel_is_one_legal_lot" ? [PDF] : []);
  const legalRefs = await Promise.all(legalBytes.map((bytes, i) => fileRef(`${tag}-legal-${i + 1}`, bytes)));
  const files = new Map<string, Uint8Array>();
  for (const [ref, bytes] of [[sourceRef, source], [metadataRef, metadata], [normalizedRef, normalized], [receiptRef, receipt], ...legalRefs.map((ref, i) => [ref, legalBytes[i]] as const)] as const) files.set(ref.sha256, bytes);
  const proposal: Proposal = {
    parcel: structuredClone(reviewedJson.parcel),
    legal_lot_reference: structuredClone(reviewedJson.legal_lot_reference),
    legal_lot_identity: identity,
    legal_identity_evidence: legalRefs,
    source_geometry: { file: sourceRef, metadata_file: metadataRef, crs: structuredClone(reviewedJson.source_geometry.crs), identity_fields: structuredClone(reviewedJson.source_geometry.identity_fields) },
    normalized_geometry: { file: normalizedRef },
    receipt_file: receiptRef,
    source_provenance: { ...structuredClone(reviewedJson.source_provenance), evidence_files: [sourceRef, metadataRef] },
    next_review_on: spec.nextReviewOn ?? "2026-10-30",
  };
  spec.edit?.(proposal);
  return { proposal, files, refs: { source: sourceRef, metadata: metadataRef, normalized: normalizedRef, receipt: receiptRef, legal: legalRefs } };
}
export const body = (built: BuiltProposal | Proposal, expected: string | null = null) => ({ proposal: "files" in built ? built.proposal : built, expected_revision: expected });

export interface AuditRow {
  id: string; case_id: string; actor_user_id: string | null; action: string; review_id: string; prior_revision: string | null;
  new_manifest_sha256: string; new_revision: string | null; reason: string | null; outcome: string; request_id: string; created_at: string; completed_at: string | null;
}
export async function auditRows(caseId: string): Promise<AuditRow[]> {
  return (await env.DB.prepare("SELECT * FROM program_screen_review_events WHERE case_id = ? ORDER BY created_at, rowid").bind(caseId).all<AuditRow>()).results;
}

export async function expectPreparationError(promise: Promise<unknown>, code: string): Promise<CasePreparationError> {
  const outcome = await promise.then((value) => ({ value }), (error: unknown) => ({ error }));
  expect("error" in outcome, `expected ${code}, resolved ${JSON.stringify("value" in outcome ? outcome.value : null)?.slice(0, 400)}`).toBe(true);
  const error = (outcome as { error: unknown }).error;
  expect(error, String(error)).toBeInstanceOf(CasePreparationError);
  expect((error as CasePreparationError).code, String(error)).toBe(code);
  return error as CasePreparationError;
}
export const codes = (diagnostics: readonly CasePreparationDiagnostic[]) => diagnostics.map((entry) => entry.code);
export const errorCodes = (diagnostics: readonly CasePreparationDiagnostic[]) => diagnostics.filter((entry) => entry.severity === "error").map((entry) => entry.code);
