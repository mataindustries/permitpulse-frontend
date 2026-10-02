import { env } from "cloudflare:workers";
import { afterAll, afterEach, beforeEach, describe, expect, inject, it, vi } from "vitest";
import baseline from "../fixtures/program-screen/phase-3i-test-only/d-baseline.json";
import reviewedJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import sraSourceBytes from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import sraReceipt from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import metadata from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import normalized from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized-sra.json?raw";
import fictionalFixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { evaluateCriterionAuthority } from "../src/shared/program-screen/authority-gate";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { parseProgramEvidenceAuthority, type ProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { assessProgramFacts } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { loadReviewedLotGeometry, type ReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import { fileGdbOverlayIndexText, loadOverlayDatasetView, overlayIndexPinFor, parseOverlayIndex, type OverlayIndexPin } from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { bytesSha256, reviewedLotRecordSchema, type CaseFileRef, type ReviewedLotRecord } from "../src/shared/program-screen/reviewed-lot";
import { sha256Hex } from "../src/shared/program-screen/source-capture";
import { programPathwayCompletenessBlockers } from "../src/shared/program-screen/types";
import { openProgramScreenCaseStore, type ProgramScreenCaseEvidenceStore } from "../src/worker/program-screen/case-evidence";
import { evaluateStoredCaseProgramScreen, loadCaseHazardOverlays } from "../src/worker/program-screen/evaluate-case";
import { block, encode, feature, record, ring, source as lraSource, sra as sraSource, C, D, HIGH, VH } from "./program-screen-lra-helpers";
import { polygonRecordContent, testOnlySraIndexText } from "./program-screen-overlay-helpers";

type ScreenInput = Omit<Parameters<typeof evaluateProgramScreen>[0], "evidence_records"> & { evidence_records: readonly CanonicalEvidenceRecord[] };
const observed = vi.hoisted(() => ({ inputs: [] as ScreenInput[], dBytes: [] as string[], pins: [] as OverlayIndexPin[], verified: 0, seen: new Set<string>() }));

// TEST-ONLY observers retain the real evaluator, verification, geometry and validity checks.
vi.mock("../src/shared/program-screen/evaluate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/evaluate")>();
  return { ...actual, evaluateProgramScreen: (input: ScreenInput) => {
    const result = actual.evaluateProgramScreen(input);
    if (input.evidence_records.some((record) => record.id.startsWith("computed-calfire-high-"))) {
      observed.inputs.push(input);
      observed.dBytes.push(JSON.stringify(result.pathways.flatMap((p) => p.criteria).find((c) => c.criterion_id === "la_shra.high-fire-hazard-severity-zone")));
    }
    return result;
  } };
});
vi.mock("../src/shared/program-screen/reviewed-lot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/reviewed-lot")>();
  return { ...actual, verifyReviewedLotEvidence: (...args: Parameters<typeof actual.verifyReviewedLotEvidence>) => {
    observed.verified++;
    return actual.verifyReviewedLotEvidence(...args);
  } };
});
vi.mock("../src/shared/program-screen/overlay-dataset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/overlay-dataset")>();
  return { ...actual,
    overlayIndexPinFor: (...args: Parameters<typeof actual.overlayIndexPinFor>) => actual.overlayIndexPinFor(args[0], observed.pins.length ? observed.pins : args[1]),
    loadOverlayDatasetView: (...args: Parameters<typeof actual.loadOverlayDatasetView>) => actual.loadOverlayDatasetView(args[0], observed.pins.length ? observed.pins : args[1]),
  };
});

function baselineName(name: string) {
  return name
    .replace("Phase 3I invariant: the shared evaluator requires both routes' negative records to rest on the same verified lot geometry", "FINDING (hardening, not reachable in production): the shared evaluator does not require both routes' records to name the same lot geometry")
    .replace("production evaluation supplies reviewed-snapshot route evidence and strips caller hazard blocks while retaining conflicts", "production evaluation strips caller hazard blocks, computes only d's High record, and supplies no Route 1 inputs: c can only be unknown")
    .replace("production evaluator computes both c routes; manual authority cannot establish c and observations retain conflicts", "production evaluator computes only d's evidence; manual c authority cannot fill the operational gap");
}

// Re-run the existing scenarios, including standalone route loads. A standalone
// load's d projection uses the same subject used by the pre-edit byte capture.
vi.mock("../src/worker/program-screen/evaluate-case", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/worker/program-screen/evaluate-case")>();
  const captureLoad = async (args: Parameters<typeof actual.loadCaseOverlay>) => {
    const name = baselineName(expect.getState().currentTestName ?? "");
    if (!(name in baseline.cases)) return;
    const anchor = record("test-only-3i-baseline-anchor", "jurisdiction", "City of Los Angeles");
    anchor.subject = { case_id: args[0].case_id, property_id: "test-only-3i-baseline" };
    const registries = import.meta.env.PROD ? programAuthorityRegistries : args[2];
    await actual.evaluateStoredCaseProgramScreen(args[0], { evidence_records: [anchor], as_of: args[1] }, registries);
  };
  return { ...actual,
    loadCaseOverlay: async (...args: Parameters<typeof actual.loadCaseOverlay>) => { const result = await actual.loadCaseOverlay(...args); await captureLoad(args); return result; },
    loadCaseLraOverlay: async (...args: Parameters<typeof actual.loadCaseLraOverlay>) => { const result = await actual.loadCaseLraOverlay(...args); await captureLoad(args); return result; },
  };
});

import "./program-screen-case-evidence-3f.test";
import "./program-screen-c-reaudit-3h.test";
import "./program-screen-c-promotion-audit-3h.test";

beforeEach(() => { observed.inputs = []; observed.dBytes = []; observed.pins = []; observed.verified = 0; });
afterEach(async () => {
  const name = baselineName(expect.getState().currentTestName ?? "");
  const expected = baseline.cases[name as keyof typeof baseline.cases];
  if (expected === undefined) return;
  expect(observed.inputs.length, `${name}: d projection count`).toBe(expected.length);
  for (const [i, input] of observed.inputs.entries()) {
    const dRecord = input.evidence_records.find((record) => record.id.startsWith("computed-calfire-high-"))!;
    const dBlock = (input.evidence_authority as ProgramEvidenceAuthority[]).find((block) => block.evidence_id === dRecord.id) ?? null;
    const d = JSON.parse(observed.dBytes[i]);
    const saved = baseline.objects[expected[i].object as keyof typeof baseline.objects];
    expect(JSON.stringify(dRecord), `${name} / ${i}: d record bytes`).toBe(saved.record);
    expect(JSON.stringify(dBlock), `${name} / ${i}: d authority block bytes`).toBe(saved.block);
    expect(observed.dBytes[i], `${name} / ${i}: d criterion bytes`).toBe(saved.d);
    expect(d.status).toBe(expected[i].status);
    expect(await sha256Hex(JSON.stringify(d.authority ?? null))).toBe(expected[i].authority);
  }
  observed.seen.add(name);
});
afterAll(() => {
  expect([...observed.seen].sort()).toEqual(Object.keys(baseline.cases).sort());
});

// Every synthetic lot, observation, validity verdict and index pin is TEST-ONLY.
const AS_OF = "2026-10-01";
const ROUTES = ["gov_51178", "prc_4202"] as const;
type Route = typeof ROUTES[number];
const utf8 = (text: string) => new TextEncoder().encode(text);
const lotFiles = import.meta.glob("../fixtures/program-screen/test-only-lot-geometries/*.json", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
function lotText(name: string) {
  const text = lotFiles[`../fixtures/program-screen/test-only-lot-geometries/test-only-lot-${name}.json`];
  if (text === undefined) throw new Error(`Missing TEST-ONLY lot fixture: ${name}`);
  return text;
}
const lotBytes = (x = 20) => encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(x, 20, x + 60, 80)] });
const lot = (file_id: string, x = 20) => loadReviewedLotGeometry({ file_id, bytes: lotBytes(x) });

async function directPair(lraLot: ReviewedLotGeometry, sraLot: ReviewedLotGeometry, yes = false) {
  const lra = await fileGdbOverlayIndexText({
    dataset: lraSource.package!.members.overlay_dataset, layer: lraSource.package!.overlay.dataset_name, crs_epsg: 3310,
    class_field: lraSource.package!.overlay.class_field,
    members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
    records: [feature(1, yes ? "Very High" : "High", 0, 100), feature(2, "Moderate", 500, 600)],
  });
  const records = [0, 500].map((x) => ({ label: "Moderate", content: polygonRecordContent(ring(x, 0, x + 100, 100) as Array<[number, number]>) }));
  const sraText = await testOnlySraIndexText({
    dataset: sraSource.package!.members.overlay_dataset, layer: sraSource.package!.overlay.dataset_name, crs_epsg: 3310,
    class_field: sraSource.package!.overlay.class_field, members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records,
  });
  const pins = [
    { dataset: lraSource.package!.members.overlay_dataset, index_sha256: await sha256Hex(lra.index_text) },
    { dataset: sraSource.package!.members.overlay_dataset, index_sha256: await sha256Hex(sraText) },
  ];
  const views = [
    await loadOverlayDatasetView(lra, pins),
    await loadOverlayDatasetView({ index_text: sraText, records: records.map((r, i) => ({ record_number: i + 1, content: r.content })) }, pins),
  ];
  const observations = [record("test-only-3i-lra", VH, yes), record("test-only-3i-sra", VH, false)];
  const authorities = [
    block(observations[0], { lot: lraLot } as Parameters<typeof block>[1], "gov_51178"),
    block(observations[1], { lot: sraLot } as Parameters<typeof block>[1], "prc_4202"),
  ];
  return { observations, authorities, inputs: { datasets: views, lot_geometries: [lraLot, sraLot], index_pins: pins } };
}
function directScreen(pair: Awaited<ReturnType<typeof directPair>>) {
  return evaluateProgramScreen({ evidence_records: pair.observations, evidence_authority: pair.authorities, as_of: AS_OF,
    authority_registries: programAuthorityRegistries, lot_overlay: pair.inputs });
}
const directResult = (pair: Awaited<ReturnType<typeof directPair>>) => directScreen(pair).pathways[0].criteria.find((c) => c.criterion_id === C)!;
function expectUnshared(result: ReturnType<typeof directResult>) {
  expect(result.status).toBe("unknown");
  expect(result.authority?.facts.every((fact) => fact.established)).toBe(true);
  expect(result.authority?.criterion_failures).toEqual([{ code: "statutory_routes_lot_geometry_not_shared", fact_key: VH }]);
  expect(result.statement).toContain("negative records do not rest on one reviewed lot geometry");
  expect(findProhibitedClientLanguage(result.statement)).toEqual([]);
}

describe("Phase 3I verified content identity across statutory-route negatives", () => {
  it("Route 1 NO lot A / Route 2 NO lot B stays unknown", async () => {
    expectUnshared(directResult(await directPair(await lot("test-only-A"), await lot("test-only-B", 520))));
  });
  it("the same file_id with different verified bytes cannot combine", async () => {
    const a = await lot("test-only-same-id"), b = await lot("test-only-same-id", 520);
    expect(a.file_id).toBe(b.file_id); expect(a.sha256).not.toBe(b.sha256);
    expectUnshared(directResult(await directPair(a, b)));
  });
  it("different file_ids with identical verified normalized bytes combine", async () => {
    const a = await lot("test-only-A"), b = await lot("test-only-alias-A");
    expect(a.file_id).not.toBe(b.file_id); expect(a.sha256).toBe(b.sha256);
    expect(directResult(await directPair(a, b))).toMatchObject({ status: "consistent_with_source", authority: { established: true, criterion_failures: [] } });
  });
  it("a YES on lot A is sufficient even when the other route's NO names lot B", async () => {
    expect(directResult(await directPair(await lot("test-only-A"), await lot("test-only-B", 520), true)).status).toBe("disqualifying_per_source");
  });
  it("a block claiming a SHA without the matching verified object cannot establish", async () => {
    const a = await lot("test-only-A"), b = await lot("test-only-B", 520), pair = await directPair(a, b);
    pair.inputs.lot_geometries = [a];
    const result = directResult(pair);
    expect(result.status).toBe("unknown");
    expect(result.authority?.facts[1].non_establishing[0].failures).toContain("lot_overlay_not_established");
  });
  it("a typed copy of a verified geometry is still refused", async () => {
    const a = await lot("test-only-A"), pair = await directPair(a, a);
    pair.inputs.lot_geometries = [{ ...a, rings: () => a.rings() } as ReviewedLotGeometry];
    expect(() => directResult(pair)).toThrowError("typed values are never accepted");
  });
  it("uses an intersection of all establishing records, allowing a shared witness among other lots", async () => {
    const a = await lot("test-only-A"), b = await lot("test-only-B", 520), pair = await directPair(a, b);
    const shared = record("test-only-sra-shared-witness", VH, false);
    pair.observations.push(shared);
    pair.authorities.push(block(shared, { lot: a } as Parameters<typeof block>[1], "prc_4202"));
    expect(directResult(pair).status).toBe("consistent_with_source");
  });
  it("names the shared-geometry shortfall in a complete review task without inventing missing route authority", async () => {
    const screen = directScreen(await directPair(await lot("test-only-A"), await lot("test-only-B", 520)));
    expectUnshared(screen.pathways[0].criteria.find((c) => c.criterion_id === C)!);
    const task = screen.review_tasks.find((task) => task.kind === "review_evidence_authority" && task.criterion_id === C)!;
    expect(task.instruction.trim().length).toBeGreaterThan(0);
    expect(task.instruction).toContain("do not rest on one reviewed lot geometry");
    expect(task.instruction).toContain("Review the lot geometry used by each route");
    expect(task.instruction).not.toMatch(/behind\s*,|\(\s*\)|\[\s*\]|issuing agency|registered, reviewed authority/);
    expect(findProhibitedClientLanguage(task.instruction)).toEqual([]);
  });
});

class MemoryStore implements ProgramScreenCaseEvidenceStore {
  case_id = reviewedJson.case_id;
  record: unknown = reviewedLotRecordSchema.parse(structuredClone(reviewedJson));
  files = new Map<string, Uint8Array>();
  indexes = new Map<string, Uint8Array>();
  records = new Map<string, Uint8Array>();
  reads = 0;
  revisionChecks = 0;
  events: string[] = [];
  current = true;
  async getFile(ref: CaseFileRef) { return this.files.get(ref.sha256) ?? null; }
  async readReview() { this.reads++; this.events.push("review"); return this.record === null ? null : { record: this.record, revision: "test-only-revision-A" }; }
  async revisionIsCurrent(revision: string) { this.revisionChecks++; this.events.push(`revision:${revision}`); return this.current; }
  async getOverlayIndex(sha: string) { this.events.push(`index:${sha}`); return this.indexes.get(sha) ?? null; }
  async getOverlayRecord(sha: string) { this.events.push(`candidate:${sha}`); return this.records.get(sha) ?? null; }
}
async function fileRef(file_id: string, bytes: Uint8Array): Promise<CaseFileRef> {
  return { store: "case_evidence_file", file_id, sha256: await bytesSha256(bytes), bytes: bytes.length };
}
async function changeLot(store: MemoryStore, lot: ReviewedLotRecord, text: string) {
  const bytes = utf8(text);
  lot.normalized_geometry.file = await fileRef("test-only-3i-normalized", bytes);
  store.files.set(lot.normalized_geometry.file.sha256, bytes);
  const receipt = JSON.parse(sraReceipt);
  receipt.target.sha256 = lot.normalized_geometry.file.sha256; receipt.target.bytes = bytes.length;
  const receiptBytes = encode(receipt);
  lot.reprojection.receipt_file = await fileRef("test-only-3i-normalization-receipt", receiptBytes);
  store.files.set(lot.reprojection.receipt_file.sha256, receiptBytes);
}
async function setupStore(identity: ReviewedLotRecord["legal_lot_identity"] = "parcel_is_one_legal_lot", text = normalized) {
  const store = new MemoryStore(), lot = reviewedLotRecordSchema.parse(structuredClone(reviewedJson));
  for (const [ref, bytes] of [[lot.source_geometry.file, sraSourceBytes], [lot.source_geometry.metadata_file, metadata], [lot.normalized_geometry.file, normalized], [lot.reprojection.receipt_file, sraReceipt]] as const) store.files.set(ref.sha256, utf8(bytes));
  lot.legal_lot_identity = identity;
  if (identity === "parcel_is_one_legal_lot") {
    const bytes = utf8("TEST-ONLY fictional human legal-lot review; no real deed.\n"), ref = await fileRef("test-only-3i-identity", bytes);
    store.files.set(ref.sha256, bytes); lot.legal_identity_evidence = [ref];
  }
  await changeLot(store, lot, text);
  store.record = lot;
  return { store, lot };
}
function anchors(caseId: string): CanonicalEvidenceRecord[] {
  return [record("test-only-3i-jurisdiction", "jurisdiction", "City of Los Angeles"), record("test-only-3i-parcel", "parcel-match", true)].map((r) => ({ ...r, subject: { case_id: caseId, property_id: "test-only-3i-property" } }));
}
async function evaluateStore(store: ProgramScreenCaseEvidenceStore, extra: CanonicalEvidenceRecord[] = [], authority: ProgramEvidenceAuthority[] = []) {
  return evaluateStoredCaseProgramScreen(store, { evidence_records: [...anchors(store.case_id), ...extra], evidence_authority: authority, as_of: AS_OF });
}
type Evaluation = Awaited<ReturnType<typeof evaluateStore>>;
const cResult = (result: Evaluation) => result.screen.pathways.flatMap((p) => p.criteria).find((c) => c.criterion_id === C)!;
const dResult = (result: Evaluation) => result.screen.pathways.flatMap((p) => p.criteria).find((c) => c.criterion_id === D)!;
const lastInput = () => observed.inputs.at(-1)!;
const vhRecord = (route: Route, input = lastInput()) => input.evidence_records.find((r) => r.id.startsWith(`computed-calfire-very-high-${route}-`))!;
const authorityBlocks = (input = lastInput()) => input.evidence_authority as ProgramEvidenceAuthority[];
function valueOf(record: CanonicalEvidenceRecord) { return record.normalized_value.kind === "boolean" ? record.normalized_value.value : null; }
function dBytes(result: Evaluation, input = lastInput()) {
  const record = input.evidence_records.find((r) => r.id.startsWith("computed-calfire-high-"))!;
  return { record: JSON.stringify(record), block: JSON.stringify(authorityBlocks(input).find((b) => b.evidence_id === record.id) ?? null), criterion: JSON.stringify(dResult(result)) };
}
async function addNative(store: MemoryStore, route: Route) {
  const provided = route === "prc_4202" ? inject("programScreenOverlayDataset") : inject("programScreenLraDataset");
  if (provided.index_text === null) throw new Error(provided.error ?? "Exact native CAL FIRE derivation required");
  store.indexes.set(await sha256Hex(provided.index_text), utf8(provided.index_text));
  for (const base64 of Object.values(provided.records)) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    store.records.set(await bytesSha256(bytes), bytes);
  }
}
type Zone = { label: string; x0?: number; x1?: number; state?: "valid" | "invalid" | "unreadable"; missing?: boolean };
async function addSynthetic(store: MemoryStore, route: Route, zones: Zone[]) {
  const source = route === "prc_4202" ? sraSource : lraSource, pack = source.package!;
  let index_text: string, records: Array<{ record_number: number; content: Uint8Array }>;
  if (route === "gov_51178") {
    const derived = await fileGdbOverlayIndexText({ dataset: pack.members.overlay_dataset, layer: pack.overlay.dataset_name, crs_epsg: 3310, class_field: pack.overlay.class_field,
      members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
      records: zones.map((z, i) => feature(i + 1, z.label, z.x0 ?? 0, z.x1 ?? 100, z.state ?? "valid")),
    });
    index_text = derived.index_text; records = derived.records;
  } else {
    const data = zones.map((z) => ({ label: z.label, content: polygonRecordContent(ring(z.x0 ?? 0, 0, z.x1 ?? 100, 100) as Array<[number, number]>) }));
    index_text = await testOnlySraIndexText({ dataset: pack.members.overlay_dataset, layer: pack.overlay.dataset_name, crs_epsg: 3310, class_field: pack.overlay.class_field,
      members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records: data,
    }, zones.map((z) => z.state ?? "valid"));
    records = data.map((r, i) => ({ record_number: i + 1, content: r.content }));
  }
  const pin = { dataset: pack.members.overlay_dataset, index_sha256: await sha256Hex(index_text) };
  observed.pins.push(pin); store.indexes.set(pin.index_sha256, utf8(index_text));
  for (const r of records) if (!zones[r.record_number - 1].missing) store.records.set(await bytesSha256(r.content), r.content);
  return pin;
}
async function syntheticStore(lra: Zone[] = [{ label: "High" }], sra: Zone[] = [{ label: "Moderate" }], identity: ReviewedLotRecord["legal_lot_identity"] = "parcel_is_one_legal_lot") {
  const fixture = await setupStore(identity, new TextDecoder().decode(lotBytes()));
  const lraPin = await addSynthetic(fixture.store, "gov_51178", lra), sraPin = await addSynthetic(fixture.store, "prc_4202", sra);
  return { ...fixture, lraPin, sraPin };
}

describe("Phase 3I production evidence from one reviewed snapshot", () => {
  it("whole-lot Very High on PRC §4202 establishes c through the in-memory production store", async () => {
    const { store } = await setupStore("parcel_is_one_legal_lot", lotText("whole-very-high"));
    await addNative(store, "prc_4202");
    const result = await evaluateStore(store);
    expect(result.overlay.computed).toMatchObject({ lot_within_features: "whole_lot", classes_on_lot: ["Very High"] });
    expect(valueOf(vhRecord("prc_4202"))).toBe(true);
    expect(valueOf(vhRecord("gov_51178"))).toBeNull();
    expect(cResult(result).status).toBe("disqualifying_per_source");
  });
  it("whole-lot Very High on GOV §51178 independently establishes c while PRC is unknown", async () => {
    const { store, sraPin } = await syntheticStore([{ label: "Very High" }]); store.indexes.delete(sraPin.index_sha256);
    const result = await evaluateStore(store);
    expect(valueOf(vhRecord("gov_51178"))).toBe(true); expect(valueOf(vhRecord("prc_4202"))).toBeNull();
    expect(cResult(result).status).toBe("disqualifying_per_source");
    expect(dResult(result).status).toBe("unknown");
  });
  it.each(["High", "Moderate", "NonWildland"])("complete non-VH coverage on both routes clears c with LRA %s on the same snapshot", async (label) => {
    const { store } = await syntheticStore([{ label }]);
    const result = await evaluateStore(store);
    expect(valueOf(vhRecord("gov_51178"))).toBe(false); expect(valueOf(vhRecord("prc_4202"))).toBe(false);
    expect(cResult(result)).toMatchObject({ status: "consistent_with_source", authority: { established: true, criterion_failures: [] } });
    if (label === "NonWildland") {
      expect(result.route_overlays.gov_51178.semantic_zone_labels).toEqual(["non_wildland"]);
      expect(result.route_overlays.gov_51178.computed.classes_on_lot).toEqual(["NonWildland"]);
    }
  });
  const unknownZones: Array<[string, Zone[]]> = [
    ["outside", [{ label: "Very High", x0: 200, x1: 300 }]],
    ["partial", [{ label: "Very High", x1: 50 }]],
    ["missing index", [{ label: "Very High" }]],
    ["invalid relevant feature", [{ label: "Very High", state: "invalid" }]],
    ["unreadable relevant feature", [{ label: "Very High", state: "unreadable" }]],
    ["missing relevant feature", [{ label: "Very High", missing: true }]],
  ];
  for (const route of ROUTES) {
    it.each(unknownZones)(`${route} NO plus the other route's %s stays unknown`, async (state, zones) => {
      const other = route === "prc_4202" ? "gov_51178" : "prc_4202";
      const { store, sraPin, lraPin } = await syntheticStore(other === "gov_51178" ? zones : [{ label: "High" }], other === "prc_4202" ? zones : [{ label: "Moderate" }]);
      if (state === "missing index") store.indexes.delete((other === "prc_4202" ? sraPin : lraPin).index_sha256);
      const result = await evaluateStore(store);
      expect(valueOf(vhRecord(route))).toBe(false); expect(valueOf(vhRecord(other))).toBeNull();
      expect(cResult(result).status).toBe("unknown");
    });
  }
  it("whole-lot VH on both routes cannot establish without reviewed one-legal-lot identity", async () => {
    const { store } = await syntheticStore([{ label: "Very High" }], [{ label: "Very High" }], "not_established");
    const result = await evaluateStore(store);
    for (const route of ROUTES) {
      expect(result.route_overlays[route].computed.lot_within_features).toBe("whole_lot");
      expect(vhRecord(route)).toMatchObject({ raw_observed_value: { kind: "not_observed", value: null }, normalized_value: { kind: "unknown", value: null }, classification: "unknown" });
      expectParity(route);
    }
    expect(cResult(result).status).toBe("unknown");
  });
  it.each(["missing index", "missing record", "source throws"])("LRA %s preserves every d byte and PRC's independent c YES", async (kind) => {
    const { store, lraPin } = await syntheticStore([{ label: "High" }], [{ label: "Very High" }]);
    const before = dBytes(await evaluateStore(store));
    if (kind === "missing index") store.indexes.delete(lraPin.index_sha256);
    if (kind === "missing record") {
      const entry = parseOverlayIndex(new TextDecoder().decode(store.indexes.get(lraPin.index_sha256)!)).entries[0];
      store.records.delete(entry.content_sha256);
    }
    if (kind === "source throws") {
      const get = store.getOverlayIndex.bind(store);
      store.getOverlayIndex = async (sha) => { if (sha === lraPin.index_sha256) throw new Error("TEST-ONLY LRA source failure"); return get(sha); };
    }
    const result = await evaluateStore(store);
    expect(dBytes(result)).toEqual(before);
    expect(valueOf(vhRecord("prc_4202"))).toBe(true); expect(valueOf(vhRecord("gov_51178"))).toBeNull();
    expect(cResult(result).status).toBe("disqualifying_per_source");
  });
  it("reads and verifies once, checks revision once after both routes, and supplies exactly one geometry object to all blocks", async () => {
    const { store, lot } = await syntheticStore();
    const result = await evaluateStore(store), input = lastInput();
    expect(store.reads).toBe(1); expect(observed.verified).toBe(1); expect(store.revisionChecks).toBe(1);
    expect(store.events.at(-1)).toBe("revision:test-only-revision-A");
    expect(store.events.filter((e) => e.startsWith("index:")).length).toBe(2);
    expect(input.lot_overlay!.lot_geometries).toHaveLength(1);
    expect(input.lot_overlay!.datasets).toHaveLength(2);
    const geometry = input.lot_overlay!.lot_geometries[0];
    for (const route of ROUTES) expect(result.route_overlays[route].inputs!.lot_geometries[0]).toBe(geometry);
    expect(Object.isFrozen(geometry)).toBe(true);
    expect(Object.isFrozen(result.overlay.record)).toBe(true);
    expect(Object.isFrozen(result.overlay.record!.normalized_geometry.file)).toBe(true);
    expect(authorityBlocks()).toHaveLength(3);
    for (const block of authorityBlocks()) {
      expect(block.qualifiers?.family).toBe("hazard_map");
      if (block.qualifiers?.family !== "hazard_map") throw new Error("TEST-ONLY expected hazard block");
      expect(block.qualifiers.lot_overlay!.lot_geometry).toEqual({ store: "case_evidence_file", file_id: lot.normalized_geometry.file.file_id, sha256: geometry.sha256 });
    }
    expect(result.overlay).toBe(result.route_overlays.prc_4202);
  });
  it("keeps the single verified geometry even when neither route index is available", async () => {
    const { store } = await syntheticStore(); store.indexes.clear();
    expect(cResult(await evaluateStore(store)).status).toBe("unknown");
    expect(lastInput().lot_overlay!.datasets).toEqual([]);
    expect(lastInput().lot_overlay!.lot_geometries).toHaveLength(1);
    store.record = null;
    await evaluateStore(store); expect(lastInput().lot_overlay).toBeUndefined();
  });
  it("never reads review B from a store that would return A then B", async () => {
    const { store, lot: a } = await syntheticStore([{ label: "High" }], [{ label: "Moderate" }]);
    const b = structuredClone(a); b.review_id = "00000000-0000-4000-8000-00000000003b";
    await changeLot(store, b, new TextDecoder().decode(lotBytes(520)));
    store.readReview = async () => { store.reads++; return { record: store.reads === 1 ? a : b, revision: store.reads === 1 ? "test-only-revision-A" : "test-only-revision-B" }; };
    const result = await evaluateStore(store);
    expect(store.reads).toBe(1);
    for (const route of ROUTES) expect(result.route_overlays[route].record?.review_id).toBe(a.review_id);
    expect(cResult(result).status).toBe("consistent_with_source");
  });
  it("a revision change after both route computations makes c and d unknown and both routes unavailable", async () => {
    const { store } = await syntheticStore([{ label: "Very High" }], [{ label: "High" }]);
    const get = store.getOverlayRecord.bind(store);
    store.getOverlayRecord = async (sha) => { const bytes = await get(sha); if (store.events.filter((e) => e.startsWith("index:")).length === 2) store.current = false; return bytes; };
    const result = await evaluateStore(store);
    expect(store.revisionChecks).toBe(1); expect(store.events.at(-1)).toBe("revision:test-only-revision-A");
    expect(cResult(result).status).toBe("unknown"); expect(dResult(result).status).toBe("unknown");
    for (const route of ROUTES) { expect(result.route_overlays[route].inputs).toBeUndefined(); expect(valueOf(vhRecord(route))).toBeNull(); }
    expect(lastInput().lot_overlay).toBeUndefined();
  });
});

describe("Phase 3I real private R2 adapter", () => {
  it.each([false, true])("ingests pinned native SRA (and LRA=%s), then establishes PRC Very High through openProgramScreenCaseStore", async (includeLra) => {
    const { store: memory, lot } = await setupStore("parcel_is_one_legal_lot", lotText("whole-very-high"));
    lot.case_id = crypto.randomUUID(); memory.case_id = lot.case_id;
    await env.DB.prepare("INSERT INTO cases (id, project_name, client_name, address, city, jurisdiction) VALUES (?, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY', 'Los Angeles', 'City of Los Angeles')").bind(lot.case_id).run();
    const store = await openProgramScreenCaseStore(env, { id: lot.review.reviewer_user_id, role: "admin" }, lot.case_id, "write");
    for (const ref of [lot.source_geometry.file, lot.source_geometry.metadata_file, lot.normalized_geometry.file, lot.reprojection.receipt_file, ...lot.legal_identity_evidence]) await store.putFile(ref, memory.files.get(ref.sha256)!);
    for (const provided of [inject("programScreenOverlayDataset"), ...(includeLra ? [inject("programScreenLraDataset")] : [])]) {
      if (provided.index_text === null) throw new Error(provided.error ?? "Exact native tooling required");
      await store.ingestCalFire(provided.index_text, Object.entries(provided.records).map(([number, base64]) => ({ record_number: Number(number), content: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) })));
    }
    await store.ingestReviewedLot(lot, null, AS_OF);
    const read = vi.spyOn(store, "readReview"), revision = vi.spyOn(store, "revisionIsCurrent"); observed.verified = 0;
    const result = await evaluateStore(store);
    expect(read).toHaveBeenCalledTimes(1); expect(revision).toHaveBeenCalledTimes(1); expect(observed.verified).toBe(1);
    expect(valueOf(vhRecord("prc_4202"))).toBe(true); expect(cResult(result).status).toBe("disqualifying_per_source");
    expect(lastInput().lot_overlay!.lot_geometries).toHaveLength(1);
    if (includeLra) {
      expect(result.route_overlays.gov_51178.inputs!.datasets[0].dataset).toEqual(lraSource.package!.members.overlay_dataset);
      expect(result.route_overlays.gov_51178.inputs!.lot_geometries[0]).toBe(result.overlay.inputs!.lot_geometries[0]);
    } else expect(result.route_overlays.gov_51178.inputs).toBeUndefined();
  });
});

describe("Phase 3I caller authority and route boundaries", () => {
  for (const route of ROUTES) for (const value of [true, false]) {
    it.each([true, false])(`strips caller ${route} VH=${value} authority with matching geometry=%s`, async (matching) => {
      const { store } = await syntheticStore([{ label: "Very High" }], [{ label: "Very High" }], "not_established");
      const loaded = await loadCaseHazardOverlays(store, AS_OF), geometry = loaded.prc_4202.inputs!.lot_geometries[0];
      const caller = record(`test-only-forged-${route}-${value}-${matching}`, VH, value); caller.subject = anchors(store.case_id)[0].subject;
      const forged = block(caller, { lot: geometry } as Parameters<typeof block>[1], route);
      if (!matching && forged.qualifiers?.family === "hazard_map") forged.qualifiers.lot_overlay!.lot_geometry!.sha256 = "0".repeat(64);
      const result = await evaluateStore(store, [caller], [forged]);
      expect(cResult(result).status).toBe("unknown");
      expect(cResult(result).authority?.established).toBe(false);
      expect(authorityBlocks().every((b) => b.evidence_id.startsWith("computed-calfire-"))).toBe(true);
      expect(authorityBlocks().some((b) => b.evidence_id === caller.id)).toBe(false);
      expect(result.screen.facts.find((f) => f.key === VH)!.evidence.some((e) => e.evidence_id === caller.id)).toBe(true);
    });
  }
  it.each(ROUTES)("retains a legitimate Layer 1 conflict from a caller YES on %s against computed non-VH", async (route) => {
    const { store } = await syntheticStore();
    const loaded = await loadCaseHazardOverlays(store, AS_OF);
    const caller = record("test-only-layer-one-yes", VH, true); caller.subject = anchors(store.case_id)[0].subject;
    const forged = block(caller, { lot: loaded.prc_4202.inputs!.lot_geometries[0] } as Parameters<typeof block>[1], route);
    const result = await evaluateStore(store, [caller], [forged]);
    expect(cResult(result).status).toBe("conflict"); expect(cResult(result).authority).toBeUndefined();
    expect(result.screen.facts.find((f) => f.key === VH)!.normalized_value.kind).toBe("unresolved");
    expect(authorityBlocks().some((b) => b.evidence_id === caller.id)).toBe(false);
  });
  it.each(["computed-calfire-very-high-gov_51178-forged", "computed-calfire-very-high-prc_4202-forged", "computed-calfire-high-forged", "computed-calfire-anything"])("refuses the entire reserved computed prefix: %s", async (id) => {
    const { store } = await syntheticStore(), caller = record(id, VH, true); caller.subject = anchors(store.case_id)[0].subject;
    await expect(evaluateStore(store, [caller])).rejects.toThrow("Computed hazard evidence ID is reserved");
  });
  it.each(ROUTES)("a registered record from the other source cannot establish swapped route %s", async (route) => {
    const a = await lot("test-only-3i-swap"), pair = await directPair(a, a, true);
    const at = route === "prc_4202" ? 0 : 1;
    const swapped = pair.authorities[at];
    if (swapped.qualifiers?.family !== "hazard_map") throw new Error("TEST-ONLY expected hazard map");
    swapped.qualifiers.statutory_basis = route;
    swapped.qualifiers.responsibility_area_as_stated = route === "prc_4202" ? "state" : "local";
    swapped.qualifiers.adoption_status = route === "prc_4202" ? "adopted" : "not_established";
    const records = [pair.observations[at]];
    const result = evaluateProgramScreen({ evidence_records: records, evidence_authority: [swapped], as_of: AS_OF, lot_overlay: pair.inputs }).pathways[0].criteria.find((c) => c.criterion_id === C)!;
    expect(result.status).toBe("unknown"); expect(result.authority?.established).not.toBe(true);
  });
  it("computed authority uses only registered package metadata and the prescribed route qualifiers", async () => {
    const { store } = await syntheticStore(); await evaluateStore(store);
    for (const route of ROUTES) {
      const source = route === "prc_4202" ? sraSource : lraSource;
      const authority = authorityBlocks().find((b) => b.evidence_id === vhRecord(route).id)!;
      expect(authority.source_identifier.value).toBe(source.authority_source_id);
      expect(authority.document_title).toBe(source.title); expect(authority.capture).toEqual({ store: "repo_official_source", ...source.capture });
      expect(authority.edition).toEqual({ ...source.edition, currency: "current_on_as_of", currency_checked_on: AS_OF });
      expect(authority.qualifiers).toMatchObject({ family: "hazard_map", hazard_class: "very_high", statutory_basis: route,
        named_agency: "department_of_forestry_and_fire_protection", map_covers_lot: "not_established", legend_defines_class_for_lot: "yes",
        adoption_status: route === "prc_4202" ? "adopted" : "not_established", responsibility_area_as_stated: route === "prc_4202" ? "state" : "local",
        lot_overlay: { dataset: source.package!.members.overlay_dataset },
      });
    }
  });
});

// Ask the gate independently about both possible observed values. This uses
// the production dataset views and verified geometry, and changes only the
// TEST-ONLY observation under assessment, never the source or native validity.
function routeGateValue(route: Route, value: boolean, input = lastInput()) {
  const computed = vhRecord(route, input), candidate = record(`test-only-parity-${route}-${value}`, VH, value);
  const loadedGeometry = input.lot_overlay?.lot_geometries[0];
  if (loadedGeometry === undefined) return false;
  const authority = block(candidate, { lot: loadedGeometry } as Parameters<typeof block>[1], route);
  const computedBlock = authorityBlocks(input).find((b) => b.evidence_id === computed.id);
  authority.parcel_relationship.legal_lot_identity = computedBlock?.parcel_relationship.legal_lot_identity ?? "not_established";
  const fact = assessProgramFacts([candidate], [VH])[0], criterion = programScreenPathwayPacks.flatMap((p) => p.criteria).find((c) => c.id === C)!;
  expect(computed.claim.key).toBe(VH);
  const requirement = programAuthorityRegistries.criterion_requirements[C];
  if (requirement.applicability !== "enforced") throw new Error("TEST-ONLY expected enforced criterion");
  const result = evaluateCriterionAuthority({ criterion, requirement, facts: [fact], asOf: AS_OF,
    context: { registries: programAuthorityRegistries, records: [candidate], blocks: parseProgramEvidenceAuthority([authority], [candidate]), overlay: input.lot_overlay },
    routes: { fact_key: VH, entries: [{ route, assessment: fact, record_ids: new Set([candidate.id]) }] },
  });
  return result.facts[0].established;
}
function expectParity(route: Route, input = lastInput()) {
  const workerValue = valueOf(vhRecord(route, input)), yes = routeGateValue(route, true, input), no = routeGateValue(route, false, input);
  expect(workerValue !== null, `${route}: worker/gate establishment parity`).toBe(yes || no);
  expect(yes && no).toBe(false);
  if (workerValue !== null) expect(workerValue).toBe(yes);
}

describe("Phase 3I whole-lot class and worker/gate parity", () => {
  const states: Array<[string, Zone[], boolean | null]> = [
    ["whole Very High", [{ label: "Very High" }], true],
    ["whole High", [{ label: "High" }], false],
    ["whole Moderate", [{ label: "Moderate" }], false],
    ["mixed Very High/High", [{ label: "Very High", x1: 50 }, { label: "High", x0: 50 }], null],
    ["mixed Very High/Moderate", [{ label: "Very High", x1: 50 }, { label: "Moderate", x0: 50 }], null],
    ["mixed High/Moderate", [{ label: "High", x1: 50 }, { label: "Moderate", x0: 50 }], false],
    ["partial Very High", [{ label: "Very High", x1: 50 }], null],
    ["outside", [{ label: "Very High", x0: 200, x1: 300 }], null],
    ["invalid relevant", [{ label: "Very High", state: "invalid" }], null],
    ["unreadable relevant", [{ label: "Very High", state: "unreadable" }], null],
    ["missing relevant", [{ label: "Very High", missing: true }], null],
    ["unrecognized semantic label", [{ label: "Unrecognized" }], null],
  ];
  for (const route of ROUTES) {
    it.each(states)(`${route} %s has computed VH=%s and matches the independent gate`, async (_state, zones, expected) => {
      const { store } = await syntheticStore(route === "gov_51178" ? zones : [{ label: "High" }], route === "prc_4202" ? zones : [{ label: "Moderate" }]);
      await evaluateStore(store); expect(valueOf(vhRecord(route))).toBe(expected);
      for (const route of ROUTES) expectParity(route);
    });
  }
  it.each([
    ["NonWildland", [{ label: "NonWildland" }], false],
    ["Very High/NonWildland", [{ label: "Very High", x1: 50 }, { label: "NonWildland", x0: 50 }], null],
  ] as const)("LRA %s has only the recognized Very High meaning", async (_name, zones, expected) => {
    const { store } = await syntheticStore([...zones]); await evaluateStore(store);
    expect(valueOf(vhRecord("gov_51178"))).toBe(expected); expectParity("gov_51178");
  });
  it.each(Object.keys(lotFiles).map((path) => path.split("/").at(-1)!.replace(/^test-only-lot-/, "").replace(/\.json$/, "")))("every existing TEST-ONLY native lot %s has worker/gate parity on both routes", async (name) => {
    const { store } = await setupStore("parcel_is_one_legal_lot", lotText(name));
    await addNative(store, "prc_4202"); await addNative(store, "gov_51178"); await evaluateStore(store);
    for (const route of ROUTES) expectParity(route);
  });
  it.each([false, true])("native invalid SRA record 10977 leaves c unknown unless the other route gives YES=%s", async (lraYes) => {
    const text = new TextDecoder().decode(encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(237650, -405245, 237665, -405230)] }));
    const { store } = await setupStore("parcel_is_one_legal_lot", text); await addNative(store, "prc_4202");
    if (lraYes) {
      const pack = lraSource.package!;
      const f = feature(1, "Very High", 237640, 237675); f.extent = [237640, -405255, 237675, -405220]; f.coordinates = [[ring(237640, -405255, 237675, -405220)]];
      const built = await fileGdbOverlayIndexText({ dataset: pack.members.overlay_dataset, layer: pack.overlay.dataset_name, crs_epsg: 3310, class_field: pack.overlay.class_field,
        members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) }, records: [f] });
      observed.pins = [overlayIndexPinFor(sraSource.package!.members.overlay_dataset)!, { dataset: pack.members.overlay_dataset, index_sha256: await sha256Hex(built.index_text) }];
      store.indexes.set(observed.pins[1].index_sha256, utf8(built.index_text));
      for (const r of built.records) store.records.set(await bytesSha256(r.content), r.content);
    }
    const result = await evaluateStore(store);
    expect(result.overlay.inputs!.datasets[0].entries()[10976]).toMatchObject({ record_number: 10977, label: "Very High", geometry_state: "invalid", content_sha256: "a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13" });
    expect(result.overlay.computed.candidate_records).toContain(10977);
    expect(valueOf(vhRecord("prc_4202"))).toBeNull();
    expect(cResult(result).status).toBe(lraYes ? "disqualifying_per_source" : "unknown");
    for (const route of ROUTES) expectParity(route);
  });
});

describe("Phase 3I unchanged release fixture", () => {
  it.each([
    ["2026-09-27", "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad", "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070"],
    [AS_OF, "be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb", "2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e"],
  ])("keeps evaluator/demo hashes, 2/44/34/44 counts and G1/G2 open at %s", async (as_of, evaluator, demo) => {
    const screen = evaluateProgramScreen({ evidence_records: fictionalFixtureJson.evidence_records, as_of });
    expect(await sha256Hex(JSON.stringify(screen))).toBe(evaluator);
    expect(await sha256Hex(JSON.stringify(buildProgramScreenPublicDemoPayload(fictionalFixtureJson, { as_of })))).toBe(demo);
    const criteria = programScreenPathwayPacks.flatMap((p) => p.criteria);
    expect(criteria.filter((c) => c.verification === "human_verified").map((c) => c.id)).toEqual([C, D]);
    expect(criteria.filter((c) => c.verification === "pending_human")).toHaveLength(44);
    expect(criteria.filter((c) => c.predicate === "not_encoded")).toHaveLength(34);
    expect(screen.release.blockers.filter((b) => b.code === "pending_human_criterion")).toHaveLength(44);
    expect(programPathwayCompletenessBlockers.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "G1", status: "open" }, { id: "G2", status: "open" }]);
  });
});
