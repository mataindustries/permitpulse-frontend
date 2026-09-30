import { env } from "cloudflare:workers";
import { describe, expect, inject, it } from "vitest";
import reviewedJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import sraSource from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import sraReceipt from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import metadata from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import sraGeometry from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized-sra.json?raw";
import laSource from "../fixtures/program-screen/phase-3f-test-only/test-only-source.json?raw";
import laReceipt from "../fixtures/program-screen/phase-3f-test-only/test-only-normalization-receipt.json?raw";
import laGeometry from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized.json?raw";
import partialSource from "../fixtures/program-screen/phase-3f-test-only/test-only-partial-source.json?raw";
import partialReceipt from "../fixtures/program-screen/phase-3f-test-only/test-only-partial-normalization-receipt.json?raw";
import partialGeometry from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized-partial.json?raw";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { parseProgramEvidenceAuthority, PROGRAM_EVIDENCE_AUTHORITY_VERSION, type ProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import { programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { programFactSpecs } from "../src/shared/program-screen/facts";
import { programPathwayCompletenessBlockers } from "../src/shared/program-screen/types";
import { parseOverlayIndex } from "../src/shared/program-screen/overlay-dataset";
import { bytesSha256, reviewedLotRecordSchema, verifyReviewedLotEvidence, type CaseFileRef, type ReviewedLotRecord } from "../src/shared/program-screen/reviewed-lot";
import { openProgramScreenCaseStore, R2ProgramScreenCaseStore, type ProgramScreenCaseEvidenceStore } from "../src/worker/program-screen/case-evidence";
import { evaluateStoredCaseProgramScreen, loadCaseOverlay } from "../src/worker/program-screen/evaluate-case";

// Every case, identity, source capture and lot in this file is TEST-ONLY.
// The candidate records are the unchanged real Phase 3D CAL FIRE package.
const AS_OF = "2026-09-30";
const HIGH = "high-fire-hazard-severity-zone" as const;
const D = "la_shra.high-fire-hazard-severity-zone";
const utf8 = (text: string) => new TextEncoder().encode(text);
const fixture = () => reviewedLotRecordSchema.parse(structuredClone(reviewedJson));

class MemoryCaseStore implements ProgramScreenCaseEvidenceStore {
  case_id = reviewedJson.case_id;
  record: unknown = fixture();
  files = new Map<string, Uint8Array>();
  candidates = new Map<string, Uint8Array>();
  index: Uint8Array | null = null;
  current = true;
  async getFile(ref: CaseFileRef) { return this.files.get(ref.sha256) ?? null; }
  async readReview() { return { record: this.record, revision: "test-only-revision" }; }
  async revisionIsCurrent() { return this.current; }
  async getOverlayIndex() { return this.index; }
  async getOverlayRecord(sha: string) { return this.candidates.get(sha) ?? null; }
}

async function fileRef(id: string, bytes: Uint8Array): Promise<CaseFileRef> {
  return { store: "case_evidence_file", file_id: id, sha256: await bytesSha256(bytes), bytes: bytes.length };
}

async function setup(identity: ReviewedLotRecord["legal_lot_identity"] = "not_established") {
  const store = new MemoryCaseStore();
  const record = fixture();
  for (const [ref, text] of [[record.source_geometry.file, sraSource], [record.source_geometry.metadata_file, metadata], [record.normalized_geometry.file, sraGeometry], [record.reprojection.receipt_file, sraReceipt]] as const) store.files.set(ref.sha256, utf8(text));
  const provided = inject("programScreenOverlayDataset");
  if (provided.index_text === null) throw new Error(provided.error ?? "Missing pinned CAL FIRE test input");
  store.index = utf8(provided.index_text);
  for (const base64 of Object.values(provided.records)) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    store.candidates.set(await bytesSha256(bytes), bytes);
  }
  record.legal_lot_identity = identity;
  if (identity === "parcel_is_one_legal_lot") {
    const bytes = utf8("TEST-ONLY fictional current legal-lot evidence; not a deed or real record.\n");
    const ref = await fileRef("test-only-legal-identity-basis", bytes);
    store.files.set(ref.sha256, bytes);
    record.legal_identity_evidence = [ref];
  }
  store.record = record;
  return { store, record };
}

function observation(key: "parcel-match" | "jurisdiction" | typeof HIGH, value: boolean | string, id: string): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const observed = typeof value === "boolean" ? { kind: "boolean" as const, value } : { kind: "text" as const, value };
  return {
    id, subject: { case_id: reviewedJson.case_id, property_id: "test-only-property-3f" },
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: { agency: "TEST-ONLY", title: "TEST-ONLY synthetic observation", description: "No real case evidence.", url: "https://records.example.test/3f", authority: "official", retrieved_at: "2026-09-29T18:00:00Z" },
    raw_observed_value: observed, normalized_value: observed, evidence_type: key === HIGH ? "official_map" : "official_portal", classification: "source_observation", confidence: 99,
    conflicts_with: [], review_status: "reviewed", notes: [], limitations: [], provenance: { source_record_id: id, capture_method: "manual_research", is_ai_generated: false },
  };
}

const anchors = () => [observation("parcel-match", true, "test-only-parcel-anchor"), observation("jurisdiction", "City of Los Angeles", "test-only-jurisdiction-anchor")];
async function screen(store: MemoryCaseStore, extras: CanonicalEvidenceRecord[] = [], asOf = AS_OF) {
  return evaluateStoredCaseProgramScreen(store, { evidence_records: [...anchors(), ...extras], as_of: asOf });
}
function criterion(result: Awaited<ReturnType<typeof screen>>) {
  return result.screen.pathways.flatMap((pathway) => pathway.criteria).find((criterion) => criterion.criterion_id === D)!;
}

async function changeNormalized(store: MemoryCaseStore, record: ReviewedLotRecord, text: string) {
  const bytes = utf8(text);
  record.normalized_geometry.file = await fileRef("test-only-normalized-lot", bytes);
  store.files.set(record.normalized_geometry.file.sha256, bytes);
  const receipt = JSON.parse(sraReceipt);
  receipt.target.sha256 = record.normalized_geometry.file.sha256;
  receipt.target.bytes = bytes.length;
  const receiptBytes = utf8(`${JSON.stringify(receipt)}\n`);
  record.reprojection.receipt_file = await fileRef("test-only-normalization-receipt", receiptBytes);
  store.files.set(record.reprojection.receipt_file.sha256, receiptBytes);
}

async function useNormalizedFixture(store: MemoryCaseStore, record: ReviewedLotRecord, source: string, receipt: string, geometry: string) {
  record.source_geometry.file = await fileRef("test-only-source", utf8(source));
  record.normalized_geometry.file = await fileRef("test-only-normalized-lot", utf8(geometry));
  record.reprojection.receipt_file = await fileRef("test-only-normalization-receipt", utf8(receipt));
  record.source_provenance.evidence_files = [record.source_geometry.file, record.source_geometry.metadata_file];
  for (const [ref, text] of [[record.source_geometry.file, source], [record.normalized_geometry.file, geometry], [record.reprojection.receipt_file, receipt]] as const) store.files.set(ref.sha256, utf8(text));
}

describe("Phase 3F production case evidence ingestion and overlay", () => {
  it("keeps the Vidor-equivalent unknown even with real CAL FIRE whole-High coverage and valid offline-normalized geometry", async () => {
    const { store, record } = await setup();
    const verified = await verifyReviewedLotEvidence(store, record, AS_OF);
    expect(verified.geometry.valid).toBe(true);
    expect(verified.geometry.crs_epsg).toBe(3310);
    const result = await screen(store);
    expect(result.overlay.computed.lot_within_features).toBe("whole_lot");
    expect(result.overlay.computed.classes_on_lot).toEqual(["High"]);
    expect(result.overlay.semantic_zone_labels).toEqual(["high"]);
    expect(result.overlay.record?.legal_lot_identity).toBe("not_established");
    expect(result.screen.facts.find((fact) => fact.key === HIGH)?.normalized_value.kind).toBe("unknown");
    expect(criterion(result).status).toBe("unknown");
    expect(criterion(result).verification).toBe("human_verified");
    // Same files and geometry, only a TEST-ONLY explicit human identity review differs.
    const established = await setup("parcel_is_one_legal_lot");
    expect(criterion(await screen(established.store)).status).toBe("disqualifying_per_source");
  });

  it("preserves d alone at human_verified 1 / pending_human 45, c pending and G1/G2 open", () => {
    const criteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(criteria.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual([D]);
    expect(criteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(45);
    expect(criteria.find((criterion) => criterion.id === "la_shra.very-high-fire-hazard-severity-zone")?.verification).toBe("pending_human");
    expect(programPathwayCompletenessBlockers.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "G1", status: "open" }, { id: "G2", status: "open" },
    ]);
  });

  it("does not accept a legal identity asserted without its private human-review evidence", () => {
    expect(reviewedLotRecordSchema.safeParse({ ...fixture(), legal_lot_identity: "parcel_is_one_legal_lot" }).success).toBe(false);
  });

  it("fails closed when normalized geometry is missing", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    store.files.delete(record.normalized_geometry.file.sha256);
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it.each(["source", "normalized"] as const)("fails closed on a %s geometry hash mismatch", async (which) => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    const ref = which === "source" ? record.source_geometry.file : record.normalized_geometry.file;
    store.files.set(ref.sha256, utf8("TEST-ONLY corrupted bytes"));
    const result = await screen(store);
    expect(result.overlay.computed.lot_within_features).toBe("not_established");
    expect(criterion(result).status).toBe("unknown");
  });

  it("refuses a normalized file in the wrong CRS without runtime reprojection", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    const geometry = JSON.parse(sraGeometry); geometry.crs = "EPSG:3857";
    await changeNormalized(store, record, JSON.stringify(geometry));
    const result = await screen(store);
    expect(result.overlay.issues.join(" ")).toContain("EPSG:3310");
    expect(criterion(result).status).toBe("unknown");
  });

  it("refuses invalid geometry even when file and receipt hashes match", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    const geometry = JSON.parse(sraGeometry);
    const [a, b, c, d] = geometry.coordinates[0]; geometry.coordinates = [[a, c, b, d, a]];
    await changeNormalized(store, record, JSON.stringify(geometry));
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it.each(["stale", "superseded", "unreviewed"] as const)("refuses %s reviewed geometry", async (state) => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    record.state.status = state;
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it("refuses an expired review and a record with a supersession pointer", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    record.review.next_review_on = "2026-10-01";
    expect(criterion(await screen(store, [], "2026-10-01")).status).toBe("unknown");
    record.state.superseded_by = "00000000-0000-4000-8000-0000000000f2";
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it("refuses another case's manifest or a changed revision", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    record.case_id = "00000000-0000-4000-8000-000000000099";
    expect(criterion(await screen(store)).status).toBe("unknown");
    record.case_id = store.case_id; store.current = false;
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it("refuses an unpinned normalization receipt", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    const receipt = JSON.parse(sraReceipt); receipt.operation.pipeline_sha256 = "0".repeat(64);
    const bytes = utf8(JSON.stringify(receipt)); record.reprojection.receipt_file = await fileRef("test-only-altered-receipt", bytes); store.files.set(record.reprojection.receipt_file.sha256, bytes);
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it("fails closed on a missing candidate record instead of manufacturing NO", async () => {
    const { store } = await setup("parcel_is_one_legal_lot");
    const ready = await loadCaseOverlay(store, AS_OF);
    const candidate = ready.computed.candidate_records[0]; expect(candidate).toBeDefined();
    const entry = parseOverlayIndex(new TextDecoder().decode(store.index!)).entries[candidate - 1];
    store.candidates.delete(entry.content_sha256);
    const result = await screen(store);
    expect(result.overlay.computed.lot_within_features).toBe("not_established");
    expect(criterion(result).status).toBe("unknown");
  });

  it("fails closed on partial SRA coverage", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    await useNormalizedFixture(store, record, partialSource, partialReceipt, partialGeometry);
    const result = await screen(store);
    expect(result.overlay.computed.lot_within_features).toBe("part_of_lot");
    expect(criterion(result).status).toBe("unknown");
  });

  it("fails closed outside SRA with the normalized Los Angeles TEST-ONLY polygon", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    await useNormalizedFixture(store, record, laSource, laReceipt, laGeometry);
    const result = await screen(store);
    expect(result.overlay.computed.lot_within_features).toBe("none");
    expect(criterion(result).status).toBe("unknown");
  });

  it("fails closed for a superseded package or missing index", async () => {
    const { store } = await setup("parcel_is_one_legal_lot");
    const registries = structuredClone(programAuthorityRegistries);
    registries.sources = [...registries.sources, { ...structuredClone(registries.sources[0]), authority_source_id: "test-only-next-edition" }];
    registries.sources[0].superseded_by = "test-only-next-edition";
    const result = await evaluateStoredCaseProgramScreen(store, { evidence_records: anchors(), as_of: AS_OF }, registries);
    expect(criterion(result).status).toBe("unknown");
    store.index = null;
    expect(criterion(await screen(store)).status).toBe("unknown");
  });

  it("retains manual disagreements as Layer 1 conflicts", async () => {
    const { store } = await setup("parcel_is_one_legal_lot");
    expect(criterion(await screen(store, [observation(HIGH, false, "test-only-manual-no")])).status).toBe("conflict");
  });

  it("manual YES/coverage cannot replace unavailable geometry", async () => {
    const { store, record } = await setup("parcel_is_one_legal_lot");
    store.files.delete(record.normalized_geometry.file.sha256);
    expect(criterion(await screen(store, [observation(HIGH, true, "test-only-manual-yes")])).status).toBe("unknown");
    expect(reviewedLotRecordSchema.safeParse({ ...record, classes_on_lot: ["High"], map_covers_lot: "yes" }).success).toBe(false);
  });

  it.each(["yes", "no"] as const)("ignores caller hazard authority and map_covers_lot=%s when stored legal identity is not established", async (attested) => {
    const { store, record } = await setup();
    const manual = observation(HIGH, true, "test-only-manual-authority");
    const source = programAuthorityRegistries.sources[0];
    const block: ProgramEvidenceAuthority = {
      schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION, evidence_id: manual.id, fact_key: HIGH, record_kind: "agency_hazard_map",
      issuer: { name: "Office of the State Fire Marshal", issuer_id: "calfire-osfm" },
      source_identifier: { scheme: "authority_source_id", value: source.authority_source_id }, document_title: source.title,
      edition: { ...source.edition, currency: "current_on_as_of", currency_checked_on: AS_OF },
      retrieved_at: manual.source.retrieved_at, source_url: manual.source.url, capture: { store: "repo_official_source", ...source.capture },
      parcel_relationship: { matched_by: "spatial_overlay", parcel_identifier: record.parcel.apn, legal_lot_reference: "TEST-ONLY reference", legal_lot_identity: "parcel_is_one_legal_lot" },
      coverage: "whole_parcel",
      qualifiers: {
        family: "hazard_map", hazard_class: "high", statutory_basis: "prc_4202", adoption_status: "adopted", named_agency: "department_of_forestry_and_fire_protection",
        map_covers_lot: attested, legend_defines_class_for_lot: "yes", responsibility_area_as_stated: "state",
        lot_overlay: { method: "deterministic_spatial_overlay", dataset: source.package!.members.overlay_dataset, lot_geometry: { store: "case_evidence_file", file_id: record.normalized_geometry.file.file_id, sha256: record.normalized_geometry.file.sha256 } },
      },
      authority_review: { status: "reviewed", reviewer: record.review.reviewer, reviewed_on: record.review.reviewed_on }, notes: [], is_ai_generated: false,
    };
    expect(parseProgramEvidenceAuthority([block], [manual]).size).toBe(1);
    const result = await evaluateStoredCaseProgramScreen(store, { evidence_records: [...anchors(), manual], evidence_authority: [block], as_of: AS_OF });
    expect(result.overlay.computed.lot_within_features).toBe("whole_lot");
    expect(result.overlay.record?.legal_lot_identity).toBe("not_established");
    expect(criterion(result).status).toBe("unknown");
  });
});

describe("Phase 3F existing private R2 evidence boundary", () => {
  it("ingests verified files and CAL FIRE records, publishes with CAS, then evaluates through the production adapter", async () => {
    const { store: memory, record } = await setup();
    const store = new R2ProgramScreenCaseStore(env.EVIDENCE_FILES!, record.case_id, record.review.reviewer_user_id);
    for (const ref of [record.source_geometry.file, record.source_geometry.metadata_file, record.normalized_geometry.file, record.reprojection.receipt_file]) await store.putFile(ref, memory.files.get(ref.sha256)!);
    const provided = inject("programScreenOverlayDataset");
    await store.ingestCalFire(provided.index_text!, Object.entries(provided.records).map(([number, base64]) => ({ record_number: Number(number), content: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) })));
    const revision = await store.ingestReviewedLot(record, null, AS_OF);
    await expect(store.ingestReviewedLot(record, null, AS_OF)).rejects.toThrow("changed");
    const result = await evaluateStoredCaseProgramScreen(store, { evidence_records: anchors(), as_of: AS_OF });
    expect(result.overlay.computed.lot_within_features).toBe("whole_lot");
    expect(criterion(result).status).toBe("unknown");
    const anotherCase = new R2ProgramScreenCaseStore(env.EVIDENCE_FILES!, "00000000-0000-4000-8000-000000000099");
    expect(await anotherCase.getFile(record.normalized_geometry.file)).toBeNull();
    await store.invalidateReview("superseded", revision, "00000000-0000-4000-8000-0000000000f2");
    expect(criterion(await evaluateStoredCaseProgramScreen(store, { evidence_records: anchors(), as_of: AS_OF })).status).toBe("unknown");
    await expect(anotherCase.putFile(record.normalized_geometry.file, utf8(sraGeometry))).rejects.toThrow("read-only");
  });

  it("uses existing case authorization to deny an unrelated user", async () => {
    const caseId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO cases (id, project_name, client_name, address, city, jurisdiction) VALUES (?, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY', 'Los Angeles', 'City of Los Angeles')").bind(caseId).run();
    await expect(openProgramScreenCaseStore(env, { id: "test-only-unrelated-user", role: "client" }, caseId)).rejects.toThrow("denied");
    const admin = await openProgramScreenCaseStore(env, { id: "test-only-admin", role: "admin" }, caseId);
    expect(admin.case_id).toBe(caseId);
  });
});
