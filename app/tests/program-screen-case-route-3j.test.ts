import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, inject, it, vi } from "vitest";
import reviewedJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import sraSourceBytes from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import sraReceipt from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import metadata from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import fictionalFixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import type { ProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { fileGdbOverlayIndexText, overlayIndexPins, type OverlayIndexPin } from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { bytesSha256, reviewedLotRecordSchema, type CaseFileRef, type ReviewedLotRecord } from "../src/shared/program-screen/reviewed-lot";
import { sha256Hex } from "../src/shared/program-screen/source-capture";
import { programPathwayCompletenessBlockers, type ProgramScreenResult } from "../src/shared/program-screen/types";
import { app } from "../src/worker/app";
import { mayEvaluateProgramScreen, type CaseActor } from "../src/worker/cases/authorization";
import { openProgramScreenCaseStore } from "../src/worker/program-screen/case-evidence";
import {
  buildProgramScreenCaseEvaluationResponse,
  PROGRAM_SCREEN_CASE_EVALUATION_VERSION,
  programScreenAsOf,
  type ProgramScreenCaseEvaluationResponse,
} from "../src/worker/program-screen/case-evaluation-response";
import { evaluateCaseProgramScreen, evaluateStoredCaseProgramScreen, type CaseOverlayResult } from "../src/worker/program-screen/evaluate-case";
import type { Bindings } from "../src/worker/types";
import { encode, feature, record, ring, source as lraSource, sra as sraSource, C, D, HIGH, VH } from "./program-screen-lra-helpers";
import { polygonRecordContent, testOnlySraIndexText } from "./program-screen-overlay-helpers";

type ScreenInput = Omit<Parameters<typeof evaluateProgramScreen>[0], "evidence_records" | "evidence_authority"> & {
  evidence_records: readonly CanonicalEvidenceRecord[];
  evidence_authority?: unknown;
};
const observed = vi.hoisted(() => ({ inputs: [] as ScreenInput[], pins: [] as OverlayIndexPin[], failEvaluator: null as string | null }));

// TEST-ONLY observers keep the real evaluator, verification, geometry and validity checks.
vi.mock("../src/shared/program-screen/evaluate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/evaluate")>();
  return { ...actual, evaluateProgramScreen: (input: ScreenInput) => {
    if (input.evidence_records.some((entry) => entry.id.startsWith("computed-calfire-high-"))) {
      observed.inputs.push(input);
      if (observed.failEvaluator !== null) throw new Error(observed.failEvaluator);
    }
    return actual.evaluateProgramScreen(input);
  } };
});
// TEST-ONLY synthetic index pins take the place of the shipped list only while a test registers them.
vi.mock("../src/shared/program-screen/overlay-dataset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/overlay-dataset")>();
  return { ...actual,
    overlayIndexPinFor: (...args: Parameters<typeof actual.overlayIndexPinFor>) => actual.overlayIndexPinFor(args[0], observed.pins.length ? observed.pins : args[1]),
    loadOverlayDatasetView: (...args: Parameters<typeof actual.loadOverlayDatasetView>) => actual.loadOverlayDatasetView(args[0], observed.pins.length ? observed.pins : args[1]),
  };
});

// Every lot, review, index, pin, case and observation below is TEST-ONLY.
const AS_OF = "2026-10-01";
const ROUTES = ["gov_51178", "prc_4202"] as const;
type Route = (typeof ROUTES)[number];
const SHIPPED_PINS = [...overlayIndexPins];
const ADMIN: CaseActor = { id: "test-only-3j-admin", role: "admin" };
const utf8 = (text: string) => new TextEncoder().encode(text);
const lotFiles = import.meta.glob("../fixtures/program-screen/test-only-lot-geometries/*.json", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
function lotText(name: string) {
  const text = lotFiles[`../fixtures/program-screen/test-only-lot-geometries/test-only-lot-${name}.json`];
  if (text === undefined) throw new Error(`Missing TEST-ONLY lot fixture: ${name}`);
  return text;
}
const lotAt = (x: number) => new TextDecoder().decode(encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(x, 20, x + 60, 80)] }));
const WITNESS_10977 = new TextDecoder().decode(encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(237650, -405245, 237665, -405230)] }));

/**
 * One TEST-ONLY synthetic dataset per route, shared by every case in a test so
 * their pins never compete. A lot at x+20..x+80 selects the zone at x..x+100.
 */
type Zone = { label: string; x0: number; x1: number; state?: "valid" | "invalid" | "unreadable" };
const LRA_WORLD: Zone[] = [
  { label: "Very High", x0: 0, x1: 100 },
  { label: "High", x0: 200, x1: 300 },
  { label: "Moderate", x0: 400, x1: 500 },
  { label: "NonWildland", x0: 600, x1: 700 },
  { label: "Very High", x0: 800, x1: 850 },
  { label: "Very High", x0: 1000, x1: 1100, state: "invalid" },
  { label: "Very High", x0: 1200, x1: 1300, state: "unreadable" },
  { label: "Very High", x0: 1400, x1: 1500 },
  { label: "High", x0: 1600, x1: 1700 },
  { label: "High", x0: 1800, x1: 1900 },
  { label: "High", x0: 2000, x1: 2100 },
  { label: "High", x0: 2200, x1: 2300 },
  { label: "High", x0: 2400, x1: 2500 },
];
const SRA_WORLD: Zone[] = [
  { label: "Very High", x0: 0, x1: 100 },
  { label: "Moderate", x0: 200, x1: 300 },
  { label: "Moderate", x0: 400, x1: 500 },
  { label: "Moderate", x0: 600, x1: 700 },
  { label: "Moderate", x0: 800, x1: 900 },
  { label: "Moderate", x0: 1000, x1: 1100 },
  { label: "Moderate", x0: 1200, x1: 1300 },
  { label: "Moderate", x0: 1400, x1: 1500 },
  { label: "Very High", x0: 1600, x1: 1650 },
  { label: "Very High", x0: 1800, x1: 1900, state: "invalid" },
  { label: "Very High", x0: 2000, x1: 2100, state: "unreadable" },
  { label: "Very High", x0: 2200, x1: 2300 },
  { label: "Moderate", x0: 2600, x1: 2700 },
];
/** Record numbers whose content a case may omit, leaving the relevant feature missing. */
const OMITTABLE = { gov_51178: 8, prc_4202: 12 } as const;

interface RouteDataset { index_text: string; records: Array<{ record_number: number; content: Uint8Array }>; pin: OverlayIndexPin }
type World = Record<Route, RouteDataset>;
let worldPromise: Promise<World> | undefined;
async function buildWorld(): Promise<World> {
  const lraPack = lraSource.package!, sraPack = sraSource.package!;
  const lra = await fileGdbOverlayIndexText({
    dataset: lraPack.members.overlay_dataset, layer: lraPack.overlay.dataset_name, crs_epsg: 3310, class_field: lraPack.overlay.class_field,
    members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
    records: LRA_WORLD.map((zone, i) => feature(i + 1, zone.label, zone.x0, zone.x1, zone.state ?? "valid")),
  });
  const sraRecords = SRA_WORLD.map((zone) => ({ label: zone.label, content: polygonRecordContent(ring(zone.x0, 0, zone.x1, 100) as Array<[number, number]>) }));
  const sraText = await testOnlySraIndexText({
    dataset: sraPack.members.overlay_dataset, layer: sraPack.overlay.dataset_name, crs_epsg: 3310, class_field: sraPack.overlay.class_field,
    members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records: sraRecords,
  }, SRA_WORLD.map((zone) => zone.state ?? "valid"));
  return {
    gov_51178: { index_text: lra.index_text, records: lra.records, pin: { dataset: lraPack.members.overlay_dataset, index_sha256: await sha256Hex(lra.index_text) } },
    prc_4202: { index_text: sraText, records: sraRecords.map((entry, i) => ({ record_number: i + 1, content: entry.content })), pin: { dataset: sraPack.members.overlay_dataset, index_sha256: await sha256Hex(sraText) } },
  };
}
/** The real R2 adapter checks the exported pin list, so TEST-ONLY pins are appended there too. */
function registerPin(pin: OverlayIndexPin) {
  if (!observed.pins.includes(pin)) observed.pins.push(pin);
  if (!overlayIndexPins.includes(pin)) (overlayIndexPins as OverlayIndexPin[]).push(pin);
}
async function useWorld(): Promise<World> {
  const world = await (worldPromise ??= buildWorld());
  for (const route of ROUTES) registerPin(world[route].pin);
  return world;
}
function nativeDataset(route: Route): Omit<RouteDataset, "pin"> {
  const provided = route === "prc_4202" ? inject("programScreenOverlayDataset") : inject("programScreenLraDataset");
  if (provided.index_text === null) throw new Error(provided.error ?? "Exact native CAL FIRE derivation required");
  return { index_text: provided.index_text, records: Object.entries(provided.records).map(([number, base64]) => ({ record_number: Number(number), content: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) })) };
}

type RouteSource = "world" | "native" | "none";
interface CaseSpec {
  caseId?: string;
  reviewId?: string;
  lot?: string;
  identity?: ReviewedLotRecord["legal_lot_identity"];
  routes?: Partial<Record<Route, RouteSource>>;
  omit?: Route[];
  dropIndex?: Route[];
}
interface PreparedCase {
  caseId: string;
  lot: ReviewedLotRecord;
  revision: string;
  files: Map<string, Uint8Array>;
  indexShas: string[];
  recordShas: string[];
  writer: Awaited<ReturnType<typeof openProgramScreenCaseStore>>;
}
async function insertCase(caseId: string = crypto.randomUUID()): Promise<string> {
  await env.DB.prepare("INSERT INTO cases (id, project_name, client_name, address, city, jurisdiction) VALUES (?, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY', 'Los Angeles', 'City of Los Angeles')").bind(caseId).run();
  return caseId;
}
async function fileRef(file_id: string, bytes: Uint8Array): Promise<CaseFileRef> {
  return { store: "case_evidence_file", file_id, sha256: await bytesSha256(bytes), bytes: bytes.length };
}
/** Prepare a case only through the existing private writer: putFile, ingestCalFire, ingestReviewedLot. */
async function prepareCase(spec: CaseSpec = {}): Promise<PreparedCase> {
  const caseId = await insertCase(spec.caseId);
  const lot = reviewedLotRecordSchema.parse(structuredClone(reviewedJson));
  lot.case_id = caseId;
  lot.review_id = spec.reviewId ?? crypto.randomUUID();
  lot.legal_lot_identity = spec.identity ?? "parcel_is_one_legal_lot";
  const files = new Map<string, Uint8Array>([[lot.source_geometry.file.sha256, utf8(sraSourceBytes)], [lot.source_geometry.metadata_file.sha256, utf8(metadata)]]);
  if (lot.legal_lot_identity === "parcel_is_one_legal_lot") {
    const bytes = utf8("TEST-ONLY fictional human legal-lot review; no real deed.\n"), ref = await fileRef("test-only-3j-identity", bytes);
    files.set(ref.sha256, bytes); lot.legal_identity_evidence = [ref];
  }
  const lotBytes = utf8(spec.lot ?? lotAt(20));
  lot.normalized_geometry.file = await fileRef("test-only-3j-normalized", lotBytes);
  files.set(lot.normalized_geometry.file.sha256, lotBytes);
  const receipt = JSON.parse(sraReceipt);
  receipt.target.sha256 = lot.normalized_geometry.file.sha256; receipt.target.bytes = lotBytes.length;
  const receiptBytes = encode(receipt);
  lot.reprojection.receipt_file = await fileRef("test-only-3j-normalization-receipt", receiptBytes);
  files.set(lot.reprojection.receipt_file.sha256, receiptBytes);
  const writer = await openProgramScreenCaseStore(env, { id: lot.review.reviewer_user_id, role: "admin" }, caseId, "write");
  for (const ref of [lot.source_geometry.file, lot.source_geometry.metadata_file, lot.normalized_geometry.file, lot.reprojection.receipt_file, ...lot.legal_identity_evidence]) await writer.putFile(ref, files.get(ref.sha256)!);
  const routes: Record<Route, RouteSource> = { gov_51178: "world", prc_4202: "world", ...spec.routes };
  const world = ROUTES.some((route) => routes[route] === "world") ? await useWorld() : null;
  const indexShas: string[] = [], recordShas: string[] = [];
  for (const route of ROUTES) {
    if (routes[route] === "none") continue;
    const data = routes[route] === "world" ? world![route] : nativeDataset(route);
    if (routes[route] === "native" && world !== null) registerPin(SHIPPED_PINS.find((pin) => pin.dataset.source_id === (route === "prc_4202" ? sraSource : lraSource).package!.members.overlay_dataset.source_id)!);
    const records = data.records.filter((entry) => !(spec.omit?.includes(route) && routes[route] === "world" && entry.record_number === OMITTABLE[route]));
    await writer.ingestCalFire(data.index_text, records);
    const indexSha = await sha256Hex(data.index_text);
    indexShas.push(indexSha);
    for (const entry of records) recordShas.push(await bytesSha256(entry.content));
    if (spec.dropIndex?.includes(route)) await env.EVIDENCE_FILES.delete(`${caseId}/program-screen/calfire/index-${indexSha}.txt`);
  }
  const revision = await writer.ingestReviewedLot(lot, null, AS_OF);
  return { caseId, lot, revision, files, indexShas, recordShas, writer };
}

/** Counts every call the evaluation makes on the private bucket, and optionally intervenes. */
function proxiedBucket(before?: (method: string, key: string) => Promise<void> | void) {
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
function serviceBindings(bucket: R2Bucket | undefined = env.EVIDENCE_FILES): Pick<Bindings, "DB" | "EVIDENCE_FILES"> {
  return { DB: env.DB, EVIDENCE_FILES: bucket };
}

const criteria = (screen: ProgramScreenResult) => screen.pathways.flatMap((pathway) => pathway.criteria);
const criterion = (screen: ProgramScreenResult, id: string) => criteria(screen).find((entry) => entry.criterion_id === id)!;
const lastInput = () => observed.inputs.at(-1)!;
const computedRecord = (prefix: string, input = lastInput()) => input.evidence_records.find((entry) => entry.id.startsWith(prefix))!;
const vhValue = (route: Route, input = lastInput()) => {
  const value = computedRecord(`computed-calfire-very-high-${route}-`, input).normalized_value;
  return value.kind === "boolean" ? value.value : null;
};
const authorityBlocks = (input = lastInput()) => input.evidence_authority as ProgramEvidenceAuthority[];
function anchors(caseId: string): CanonicalEvidenceRecord[] {
  return [record("test-only-3j-jurisdiction", "jurisdiction", "City of Los Angeles"), record("test-only-3j-parcel", "parcel-match", true)]
    .map((entry) => ({ ...entry, subject: { case_id: caseId, property_id: "test-only-3j-property" } }));
}
async function legacy(caseId: string, extra: CanonicalEvidenceRecord[] = []) {
  return evaluateStoredCaseProgramScreen(await openProgramScreenCaseStore(env, ADMIN, caseId, "read"), { evidence_records: [...anchors(caseId), ...extra], as_of: AS_OF });
}
/** Everything the legacy entry returns, with verified views reduced to what pins them. */
async function legacyFingerprint(result: Awaited<ReturnType<typeof evaluateStoredCaseProgramScreen>>): Promise<string> {
  const route = (overlay: CaseOverlayResult) => ({
    record: overlay.record, computed: overlay.computed, labels: overlay.semantic_zone_labels, issues: overlay.issues,
    inputs: overlay.inputs === undefined ? null : {
      datasets: overlay.inputs.datasets.map((view) => [view.dataset, view.index_sha256, view.recordNumbers()]),
      lots: overlay.inputs.lot_geometries.map((geometry) => [geometry.file_id, geometry.sha256]),
    },
  });
  return sha256Hex(JSON.stringify({
    keys: Object.keys(result), route_keys: Object.keys(result.route_overlays), same: result.overlay === result.route_overlays.prc_4202,
    gov_51178: route(result.route_overlays.gov_51178), prc_4202: route(result.route_overlays.prc_4202), screen: result.screen,
  }));
}

beforeEach(() => {
  observed.inputs = [];
  observed.pins = [];
  observed.failEvaluator = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  observed.pins = [];
  (overlayIndexPins as OverlayIndexPin[]).splice(SHIPPED_PINS.length);
});

/**
 * Captured from evaluateStoredCaseProgramScreen on the unmodified Phase 3I
 * tree (43fef1a) before the Phase 3J refactor, with fixed TEST-ONLY IDs.
 */
const LEGACY_PINS: Record<string, string> = {
  "synthetic whole Very High on both routes": "114961a800c1abce0105dc4b6abf0b58e4b522a5f91f9d7f6b61ce92a043cfa8",
  "synthetic non-Very-High on both routes": "c0f00414041d60fe0ca6183fe7c300d7cdefcb77f8a8015473997b6c17e7bd31",
  "synthetic LRA Very High with SRA never ingested": "fca0fdd5e5b369f1533e21998b64fdce22ace9ff69ab6ab22303856b43112053",
  "synthetic LRA partial with SRA NO": "406429e533ecfcb0fe86f881e9596c0c3c1e439692486e03a4da608366ed9af2",
  "synthetic whole Very High without one-legal-lot identity": "554a00f8a5605e38db7f5b341db792f8576d0aa3c95ab54d53a4328eecc30e12",
  "synthetic SRA index missing": "d212f733da9d5c4412cb9cf1b7890a4656f236da7deb10d10a36f43aa1cb9465",
  "caller Very High observation conflicts with computed NO": "ed1429f9d0e615a586b92eb070cbdd316288bf0d9027d7751c5ccb5f838431eb",
  "native whole Very High on PRC §4202": "c9a54a5368a1ce57cda888b6ae1ce522bea046110f65ea58487be8ac5eb236c9",
  "never prepared": "54ee2de9aaac1f80c8cea37be5fbb1aca6aeda73b4e71acd4d43cc0ca4985a1a",
};
const LEGACY_SCENARIOS: Array<[string, CaseSpec, (caseId: string) => CanonicalEvidenceRecord[]]> = [
  ["synthetic whole Very High on both routes", { lot: lotAt(20) }, () => []],
  ["synthetic non-Very-High on both routes", { lot: lotAt(220) }, () => []],
  ["synthetic LRA Very High with SRA never ingested", { routes: { prc_4202: "none" } }, () => []],
  ["synthetic LRA partial with SRA NO", { lot: lotAt(820) }, () => []],
  ["synthetic whole Very High without one-legal-lot identity", { identity: "not_established" }, () => []],
  ["synthetic SRA index missing", { lot: lotAt(220), dropIndex: ["prc_4202"] }, () => []],
  ["caller Very High observation conflicts with computed NO", { lot: lotAt(220) }, (caseId) => [{ ...record("test-only-3j-caller-vh", VH, true), subject: anchors(caseId)[0].subject }]],
];

describe("Phase 3J A: legacy stored-case entry is unchanged by the refactor", () => {
  it.each(LEGACY_SCENARIOS.map(([name, spec, extra], i) => [name, spec, extra, `00000000-0000-4000-8000-0000000003${(0xa0 + i).toString(16)}`] as const))("%s keeps its pre-refactor bytes", async (name, spec, extra, caseId) => {
    await prepareCase({ ...spec, caseId, reviewId: "00000000-0000-4000-8000-0000000003f1" });
    expect(await legacyFingerprint(await legacy(caseId, extra(caseId))), name).toBe(LEGACY_PINS[name]);
  });
  it("native whole Very High on PRC §4202 keeps its pre-refactor bytes", async () => {
    const caseId = "00000000-0000-4000-8000-0000000003b0";
    await prepareCase({ caseId, reviewId: "00000000-0000-4000-8000-0000000003f1", lot: lotText("whole-very-high"), routes: { gov_51178: "none", prc_4202: "native" } });
    expect(await legacyFingerprint(await legacy(caseId))).toBe(LEGACY_PINS["native whole Very High on PRC §4202"]);
  });
  it("a case that was never prepared keeps its pre-refactor bytes", async () => {
    const caseId = await insertCase("00000000-0000-4000-8000-0000000003b1");
    expect(await legacyFingerprint(await legacy(caseId))).toBe(LEGACY_PINS["never prepared"]);
  });
  it("keeps every caller guard and its order", async () => {
    const { caseId } = await prepareCase();
    const store = await openProgramScreenCaseStore(env, ADMIN, caseId, "read");
    await expect(evaluateStoredCaseProgramScreen(store, { evidence_records: [], as_of: AS_OF })).rejects.toThrow("Program Screen evidence must belong to the authorized case.");
    await expect(evaluateStoredCaseProgramScreen(store, { evidence_records: anchors(crypto.randomUUID()), as_of: AS_OF })).rejects.toThrow("Program Screen evidence must belong to the authorized case.");
    const reserved = { ...record("computed-calfire-very-high-prc_4202-forged", VH, true), subject: anchors(caseId)[0].subject };
    await expect(evaluateStoredCaseProgramScreen(store, { evidence_records: [...anchors(caseId), reserved], as_of: AS_OF })).rejects.toThrow("Computed hazard evidence ID is reserved.");
    vi.stubEnv("MODE", "production"); vi.stubEnv("PROD", true);
    await expect(evaluateStoredCaseProgramScreen(store, { evidence_records: [reserved], as_of: AS_OF }, structuredClone(programAuthorityRegistries))).rejects.toThrow("Test registry overrides cannot enter production evaluation.");
  });
});

async function clientParticipant(caseId: string): Promise<CaseActor> {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').bind(id, "TEST-ONLY 3J client", `test-only-3j-${id}@example.test`).run();
  await env.DB.prepare("INSERT INTO case_participants (case_id, user_id, participant_role) VALUES (?, ?, 'owner')").bind(caseId, id).run();
  return { id, role: "client" };
}
const RESPONSE_KEYS = ["schema_version", "case_id", "as_of", "as_of_basis", "reviewed_lot", "hazard_routes", "screen"];
const SCREEN_KEYS = ["schema_version", "screen_id", "screen_scope", "subject", "as_of", "facts", "pathways", "planning_questions", "review_tasks", "release", "counts"];
const SUMMARY_KEYS = ["review_id", "reviewed_on", "next_review_on", "legal_lot_identity"];
const computedIds = (reviewId: string) => [`computed-calfire-high-${reviewId}`, `computed-calfire-very-high-gov_51178-${reviewId}`, `computed-calfire-very-high-prc_4202-${reviewId}`];

describe("Phase 3J A: server-only case evaluation service", () => {
  it("accepts only bindings, actor, case ID and the server date: no caller evidence, authority, subject, registries, packs, overlay or revision", async () => {
    expect(evaluateCaseProgramScreen.length).toBe(4);
    const { caseId, lot } = await prepareCase();
    if (false as boolean) {
      // @ts-expect-error The Phase 3I caller-evidence input object is no longer accepted.
      await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, { evidence_records: anchors(caseId), as_of: AS_OF });
      // @ts-expect-error No fifth argument (registries, packs, overlay, revision) exists.
      await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF, programAuthorityRegistries);
    }
    const result = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    const input = lastInput();
    expect(observed.inputs).toHaveLength(1);
    expect(input.evidence_records.map((entry) => entry.id)).toEqual(computedIds(lot.review_id));
    expect(authorityBlocks(input).map((block) => block.evidence_id).sort()).toEqual(computedIds(lot.review_id).sort());
    expect(input.authority_registries).toBe(programAuthorityRegistries);
    expect(input.packs).toBeUndefined();
    expect(input.lot_overlay!.lot_geometries).toHaveLength(1);
    expect(input.as_of).toBe(AS_OF);
    expect(criterion(result.screen, C).status).toBe("disqualifying_per_source");
  });
  it("creates a frozen server subject with property_id null for every computed record", async () => {
    const { caseId } = await prepareCase({ lot: lotAt(220) });
    const result = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    const subjects = lastInput().evidence_records.map((entry) => entry.subject);
    expect(new Set(subjects).size).toBe(1);
    expect(subjects[0]).toEqual({ case_id: caseId, property_id: null });
    expect(Object.isFrozen(subjects[0])).toBe(true);
    expect(result.screen.subject).toEqual({ case_id: caseId, property_id: null });
  });
  it.each([
    ["participant client", true],
    ["unrelated client", false],
  ])("rejects a %s before any private storage call", async (_name, owner) => {
    const { caseId } = await prepareCase();
    const actor: CaseActor = owner ? await clientParticipant(caseId) : { id: crypto.randomUUID(), role: "client" };
    const { bucket, calls } = proxiedBucket();
    expect(mayEvaluateProgramScreen(actor)).toBe(false);
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), actor, caseId, AS_OF)).rejects.toThrow("Program Screen evaluation permission denied.");
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), actor, crypto.randomUUID(), AS_OF)).rejects.toThrow("Program Screen evaluation permission denied.");
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
  });
  it("only an administrator may evaluate, and an administrator still needs an existing case", async () => {
    expect(mayEvaluateProgramScreen({ id: "test-only", role: "admin" })).toBe(true);
    expect(mayEvaluateProgramScreen({ id: "test-only", role: "client" })).toBe(false);
    const { bucket, calls } = proxiedBucket();
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), ADMIN, crypto.randomUUID(), AS_OF)).rejects.toThrow("Case evidence access denied.");
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), ADMIN, "not-a-case", AS_OF)).rejects.toThrow("Case evidence access denied.");
    expect(calls).toEqual([]);
  });
  it.each(["2026-10-1", "2026-02-30", "2026-10-01T00:00:00Z", ""])("refuses a non-calendar evaluation date %j before reading storage", async (asOf) => {
    const { caseId } = await prepareCase();
    const { bucket, calls } = proxiedBucket();
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), ADMIN, caseId, asOf)).rejects.toThrow("server calendar date");
    expect(calls).toEqual([]);
  });
  it("summarizes the surviving reviewed lot with only four allowed, frozen fields", async () => {
    const { caseId, lot } = await prepareCase();
    const { reviewed_lot } = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    expect(Object.keys(reviewed_lot!)).toEqual(SUMMARY_KEYS);
    expect(reviewed_lot).toEqual({ review_id: lot.review_id, reviewed_on: "2026-09-30", next_review_on: "2026-10-30", legal_lot_identity: "parcel_is_one_legal_lot" });
    expect(Object.isFrozen(reviewed_lot)).toBe(true);
  });
  it("has no reviewed-lot summary when nothing was prepared", async () => {
    const caseId = await insertCase();
    const result = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    expect(result.reviewed_lot).toBeNull();
    for (const id of [C, D]) expect(criterion(result.screen, id).status).toBe("unknown");
  });
  it("keeps d identical to the legacy entry on the same prepared store", async () => {
    const { caseId } = await prepareCase();
    const server = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    const serverInput = lastInput();
    const old = await legacy(caseId);
    const oldInput = lastInput();
    expect(JSON.stringify(criterion(server.screen, D))).toBe(JSON.stringify(criterion(old.screen, D)));
    expect(JSON.stringify(criterion(server.screen, C))).toBe(JSON.stringify(criterion(old.screen, C)));
    const dRecord = (input: ScreenInput) => ({ ...computedRecord("computed-calfire-high-", input), subject: null });
    expect(JSON.stringify(dRecord(serverInput))).toBe(JSON.stringify(dRecord(oldInput)));
    const dBlock = (input: ScreenInput) => authorityBlocks(input).find((block) => block.evidence_id.startsWith("computed-calfire-high-"));
    expect(JSON.stringify(dBlock(serverInput))).toBe(JSON.stringify(dBlock(oldInput)));
  });
});

describe("Phase 3J A: allowlist response DTO", () => {
  it("uses the UTC calendar date of the server clock", () => {
    expect(programScreenAsOf(new Date("2026-10-02T03:00:00Z"))).toBe("2026-10-02");
    expect(programScreenAsOf(new Date("2026-10-01T23:59:59.999Z"))).toBe("2026-10-01");
    expect(programScreenAsOf(new Date("2026-10-01T20:00:00-07:00"))).toBe("2026-10-02");
    expect(programScreenAsOf(new Date("2026-10-02T00:30:00+02:00"))).toBe("2026-10-01");
  });
  it("copies only allowed fields and never the reviewed record, overlays, geometry, datasets or issues", async () => {
    const prepared = await prepareCase();
    const result = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, prepared.caseId, AS_OF);
    const response = buildProgramScreenCaseEvaluationResponse(result, AS_OF);
    expect(Object.keys(response)).toEqual(RESPONSE_KEYS);
    expect(Object.keys(response.screen)).toEqual(SCREEN_KEYS);
    expect(Object.keys(response.reviewed_lot!)).toEqual(SUMMARY_KEYS);
    expect(response).toMatchObject({ schema_version: PROGRAM_SCREEN_CASE_EVALUATION_VERSION, case_id: prepared.caseId, as_of: AS_OF, as_of_basis: "server_utc_calendar_date" });
    expect(response.hazard_routes).toEqual([
      { route: "gov_51178", authority_source_id: "calfire-lra-fhsz-2025-03-24-v1", overlay: "computed" },
      { route: "prc_4202", authority_source_id: "calfire-sra-fhsz-2023-09-29", overlay: "computed" },
    ]);
    expect(response.screen).toEqual(JSON.parse(JSON.stringify(result.screen)));
    expect(response.screen).not.toBe(result.screen);
    expect(response.reviewed_lot).not.toBe(result.reviewed_lot);
    const text = JSON.stringify(response);
    for (const value of [prepared.lot.parcel.apn, prepared.lot.parcel.pin, prepared.lot.legal_lot_reference.tract, prepared.lot.review.reviewer.name,
      prepared.lot.review.reviewer_user_id, prepared.lot.normalized_geometry.file.file_id, prepared.lot.normalized_geometry.file.sha256, ...prepared.indexShas,
      prepared.revision, "\"overlay\":{", "route_overlays", "lot_geometries", "\"issues\"", "candidate_records"]) expect(text).not.toContain(value);
  });
  it("refuses a result whose date or subject did not come from the server", async () => {
    const { caseId } = await prepareCase();
    const result = await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF);
    expect(() => buildProgramScreenCaseEvaluationResponse(result, "2026-10-02")).toThrow("differs from the server date");
    const forged = { ...result, screen: { ...result.screen, subject: { case_id: caseId, property_id: "test-only-3j-property" } } };
    expect(() => buildProgramScreenCaseEvaluationResponse(forged, AS_OF)).toThrow("must be server-supplied");
  });
  it("reports a route as unavailable when its overlay inputs were not computed", async () => {
    const { caseId } = await prepareCase({ routes: { prc_4202: "none" } });
    const response = buildProgramScreenCaseEvaluationResponse(await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, AS_OF), AS_OF);
    expect(response.hazard_routes.map((route) => route.overlay)).toEqual(["computed", "unavailable"]);
  });
});

describe("Phase 3J A: protected release state", () => {
  it.each([
    ["2026-09-27", "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad", "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070"],
    ["2026-10-01", "be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb", "2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e"],
  ])("keeps evaluator/demo hashes, 2/44/34/44 counts and G1/G2 open at %s", async (asOf, evaluator, demo) => {
    const screen = evaluateProgramScreen({ evidence_records: fictionalFixtureJson.evidence_records, as_of: asOf });
    expect(await sha256Hex(JSON.stringify(screen))).toBe(evaluator);
    expect(await sha256Hex(JSON.stringify(buildProgramScreenPublicDemoPayload(fictionalFixtureJson, { as_of: asOf })))).toBe(demo);
    const packCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(packCriteria.filter((entry) => entry.verification === "human_verified").map((entry) => entry.id)).toEqual([C, D]);
    expect(packCriteria.filter((entry) => entry.verification === "pending_human")).toHaveLength(44);
    expect(packCriteria.filter((entry) => entry.predicate === "not_encoded")).toHaveLength(34);
    expect(screen.release.blockers.filter((blocker) => blocker.code === "pending_human_criterion")).toHaveLength(44);
    expect(programPathwayCompletenessBlockers.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "G1", status: "open" }, { id: "G2", status: "open" }]);
  });
});

/* ------------------------------------------------------------- Phase 3J B: HTTP */

const ORIGIN = "http://localhost";
const ERROR_403 = ["FORBIDDEN", "Program Screen evaluation requires an administrator."] as const;
const ERROR_400 = ["INVALID_QUERY", "Program Screen evaluation accepts no query parameters."] as const;
function bindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    ADMIN_BOOTSTRAP_ENABLED: "false", APP_ENV: "local", ASSETS: env.ASSETS, AUTH_ALLOW_SIGNUP: "true", AUTH_ENABLED: "true",
    BETTER_AUTH_SECRET: "test-only-program-screen-3j-auth-secret-123456789", BETTER_AUTH_URL: ORIGIN, DB: env.DB,
    ENABLE_DEV_CASE_API: "false", EVIDENCE_FILES: env.EVIDENCE_FILES, ...overrides,
  };
}
/** Sign up through the real auth route under the current (fake) clock; admins are promoted directly in D1. */
async function signUp(role: "admin" | "client"): Promise<{ cookie: string; id: string }> {
  const response = await app.request(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ name: `TEST-ONLY 3J ${role}`, email: `test-only-3j-${role}-${crypto.randomUUID()}@example.test`, password: "Fictional-3j-passphrase-42" }),
  }, bindings());
  expect(response.status).toBe(200);
  const body = await response.json<{ user: { id: string } }>();
  if (role === "admin") await env.DB.prepare('UPDATE "user" SET role = ? WHERE id = ?').bind("admin", body.user.id).run();
  return { cookie: response.headers.get("set-cookie")!.split(";", 1)[0], id: body.user.id };
}
async function addOwner(caseId: string, userId: string) {
  await env.DB.prepare("INSERT INTO case_participants (case_id, user_id, participant_role) VALUES (?, ?, 'owner')").bind(caseId, userId).run();
}
function get(caseId: string, cookie: string | null, options: { query?: string; env?: Bindings; method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return app.request(`${ORIGIN}/api/v1/cases/${caseId}/program-screen${options.query ?? ""}`, {
    method: options.method ?? "GET", headers: { ...(cookie === null ? {} : { cookie }), ...options.headers }, body: options.body,
  }, options.env ?? bindings());
}
function at(instant: string) {
  vi.setSystemTime(new Date(instant));
}
type ErrorBody = { ok: false; error: { code: string; message: string; details?: unknown }; request_id: string };
function expectPrivateHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  expect(response.headers.get("etag")).toBeNull();
}
async function expectError(response: Response, status: number, code: string, message: string): Promise<ErrorBody> {
  const text = await response.text();
  expect(response.status, text).toBe(status);
  expectPrivateHeaders(response);
  const body = JSON.parse(text) as ErrorBody;
  expect(body).toEqual({ ok: false, error: { code, message }, request_id: expect.any(String) });
  return body;
}
async function evaluated(response: Response): Promise<ProgramScreenCaseEvaluationResponse> {
  const text = await response.text();
  expect(response.status, text).toBe(200);
  expectPrivateHeaders(response);
  const body = JSON.parse(text) as { ok: true; data: ProgramScreenCaseEvaluationResponse };
  expect(Object.keys(body)).toEqual(["ok", "data"]);
  expect(body.ok).toBe(true);
  expect(Object.keys(body.data)).toEqual(RESPONSE_KEYS);
  expect(Object.keys(body.data.screen)).toEqual(SCREEN_KEYS);
  return body.data;
}
const statuses = (data: ProgramScreenCaseEvaluationResponse) => [criterion(data.screen, C).status, criterion(data.screen, D).status];
const overlays = (data: ProgramScreenCaseEvaluationResponse) => data.hazard_routes.map((route) => route.overlay);

describe("Phase 3J B: admin-only GET /api/v1/cases/:caseId/program-screen", () => {
  it("A1 an administrator evaluates a prepared case with the server date and a server subject", async () => {
    const admin = await signUp("admin");
    const { caseId, lot } = await prepareCase({ lot: lotAt(220) });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data).toMatchObject({
      schema_version: "program-screen-case-evaluation-v1", case_id: caseId, as_of: "2026-10-01", as_of_basis: "server_utc_calendar_date",
      reviewed_lot: { review_id: lot.review_id, reviewed_on: "2026-09-30", next_review_on: "2026-10-30", legal_lot_identity: "parcel_is_one_legal_lot" },
    });
    expect(data.screen.subject).toEqual({ case_id: caseId, property_id: null });
    expect(data.screen.as_of).toBe("2026-10-01");
    expect(statuses(data)).toEqual(["consistent_with_source", "consistent_with_source"]);
    expect(observed.inputs).toHaveLength(1);
    expect(lastInput().evidence_records.every((entry) => entry.subject.case_id === caseId && entry.subject.property_id === null)).toBe(true);
  });

  it("A2 a client cannot evaluate the case it owns, and no private file is read", async () => {
    const client = await signUp("client");
    const { caseId } = await prepareCase();
    await addOwner(caseId, client.id);
    expect((await app.request(`${ORIGIN}/api/v1/cases/${caseId}`, { headers: { cookie: client.cookie } }, bindings())).status).toBe(200);
    const { bucket, calls } = proxiedBucket();
    const body = await expectError(await get(caseId, client.cookie, { env: bindings({ EVIDENCE_FILES: bucket }) }), 403, ...ERROR_403);
    expect(JSON.stringify(body)).not.toMatch(/screen|criteria|reviewed_lot/);
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
  });

  it("A3 an unrelated client receives the same 403 for a real and a nonexistent case: no existence oracle", async () => {
    const client = await signUp("client");
    const { caseId } = await prepareCase();
    const { bucket, calls } = proxiedBucket();
    const runtime = bindings({ EVIDENCE_FILES: bucket });
    const real = await expectError(await get(caseId, client.cookie, { env: runtime }), 403, ...ERROR_403);
    const missing = await expectError(await get(crypto.randomUUID(), client.cookie, { env: runtime }), 403, ...ERROR_403);
    expect({ ...real, request_id: null }).toEqual({ ...missing, request_id: null });
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
  });

  it("A3 an administrator receives 404 for a case that does not exist, before any private read", async () => {
    const admin = await signUp("admin");
    const { bucket, calls } = proxiedBucket();
    await expectError(await get(crypto.randomUUID(), admin.cookie, { env: bindings({ EVIDENCE_FILES: bucket }) }), 404, "CASE_NOT_FOUND", "The case was not found.");
    expect(calls).toEqual([]);
  });

  it("A4 each case returns only its own evaluation; a query cannot name another case", async () => {
    const admin = await signUp("admin");
    const a = await prepareCase({ lot: lotAt(20) }), b = await prepareCase({ lot: lotAt(220) });
    const dataA = await evaluated(await get(a.caseId, admin.cookie));
    const dataB = await evaluated(await get(b.caseId, admin.cookie));
    expect([dataA.case_id, dataA.screen.subject.case_id, dataA.reviewed_lot!.review_id]).toEqual([a.caseId, a.caseId, a.lot.review_id]);
    expect([dataB.case_id, dataB.screen.subject.case_id, dataB.reviewed_lot!.review_id]).toEqual([b.caseId, b.caseId, b.lot.review_id]);
    expect(criterion(dataA.screen, C).status).toBe("disqualifying_per_source");
    expect(criterion(dataB.screen, C).status).toBe("consistent_with_source");
    expect(observed.inputs.map((input) => input.evidence_records.map((entry) => entry.subject.case_id))).toEqual([[a.caseId, a.caseId, a.caseId], [b.caseId, b.caseId, b.caseId]]);
    const { bucket, calls } = proxiedBucket();
    await expectError(await get(a.caseId, admin.cookie, { query: `?case_id=${b.caseId}`, env: bindings({ EVIDENCE_FILES: bucket }) }), 400, ...ERROR_400);
    await expectError(await get(a.caseId, admin.cookie, { query: `?caseId=${b.caseId}`, env: bindings({ EVIDENCE_FILES: bucket }) }), 400, ...ERROR_400);
    expect(calls).toEqual([]);
  });

  it("A5 an unauthenticated request receives 401 without reading storage, including when auth is disabled", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase();
    const { bucket, calls } = proxiedBucket();
    await expectError(await get(caseId, null, { env: bindings({ EVIDENCE_FILES: bucket }) }), 401, "UNAUTHENTICATED", "Authentication is required.");
    await expectError(await get(caseId, "better-auth.session_token=test-only-forged", { env: bindings({ EVIDENCE_FILES: bucket }) }), 401, "UNAUTHENTICATED", "Authentication is required.");
    await expectError(await get(caseId, admin.cookie, { env: bindings({ EVIDENCE_FILES: bucket, AUTH_ENABLED: "false" }) }), 401, "UNAUTHENTICATED", "Authentication is required.");
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
  });

  it("A6 native whole-lot Very High on PRC §4202 discloses c while GOV §51178 is unavailable, and d is still computed from SRA", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotText("whole-very-high"), routes: { gov_51178: "none", prc_4202: "native" } });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(overlays(data)).toEqual(["unavailable", "computed"]);
    expect(criterion(data.screen, C).status).toBe("disqualifying_per_source");
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([null, true]);
    expect(computedRecord("computed-calfire-high-").normalized_value).toEqual({ kind: "boolean", value: false });
    expect(criterion(data.screen, D)).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
  });

  it("A7 whole-lot Very High on GOV §51178 discloses c while PRC §4202 is unavailable; d stays unknown", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20), routes: { prc_4202: "none" } });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(overlays(data)).toEqual(["computed", "unavailable"]);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([true, null]);
    expect(statuses(data)).toEqual(["disqualifying_per_source", "unknown"]);
  });

  it.each([["High", 220], ["Moderate", 420], ["NonWildland", 620]])("A8 LRA %s and SRA Moderate on the same reviewed geometry clear c", async (_label, x) => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(x) });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([false, false]);
    expect(criterion(data.screen, C)).toMatchObject({ status: "consistent_with_source", authority: { established: true, criterion_failures: [] } });
    expect(lastInput().lot_overlay!.lot_geometries).toHaveLength(1);
  });

  it.each([
    ["GOV §51178 partial", "gov_51178", { lot: lotAt(820) }],
    ["GOV §51178 outside", "gov_51178", { lot: lotAt(2620) }],
    ["GOV §51178 missing index", "gov_51178", { lot: lotAt(220), dropIndex: ["gov_51178"] }],
    ["GOV §51178 relevant invalid", "gov_51178", { lot: lotAt(1020) }],
    ["GOV §51178 relevant unreadable", "gov_51178", { lot: lotAt(1220) }],
    ["GOV §51178 relevant record missing", "gov_51178", { lot: lotAt(1420), omit: ["gov_51178"] }],
    ["PRC §4202 partial", "prc_4202", { lot: lotAt(1620) }],
    ["PRC §4202 outside", "prc_4202", { lot: lotAt(2420) }],
    ["PRC §4202 missing index", "prc_4202", { lot: lotAt(220), dropIndex: ["prc_4202"] }],
    ["PRC §4202 relevant invalid", "prc_4202", { lot: lotAt(1820) }],
    ["PRC §4202 relevant unreadable", "prc_4202", { lot: lotAt(2020) }],
    ["PRC §4202 relevant record missing", "prc_4202", { lot: lotAt(2220), omit: ["prc_4202"] }],
  ] as Array<[string, Route, CaseSpec]>)("A9 %s with a NO on the other route keeps c unknown", async (_name, unknownRoute, spec) => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase(spec);
    const data = await evaluated(await get(caseId, admin.cookie));
    const other = unknownRoute === "gov_51178" ? "prc_4202" : "gov_51178";
    expect(vhValue(unknownRoute)).toBeNull();
    expect(vhValue(other)).toBe(false);
    expect(criterion(data.screen, C).status).toBe("unknown");
    expect(data.reviewed_lot).not.toBeNull();
  });

  it("A10 d is identical between HTTP, the direct server-only service and the legacy entry on one prepared store", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20) });
    const data = await evaluated(await get(caseId, admin.cookie));
    const httpInput = lastInput();
    const direct = buildProgramScreenCaseEvaluationResponse(await evaluateCaseProgramScreen(serviceBindings(), ADMIN, caseId, programScreenAsOf(new Date())), AS_OF);
    expect(data).toEqual(JSON.parse(JSON.stringify(direct)));
    const old = await legacy(caseId);
    const oldInput = lastInput();
    expect(JSON.stringify(criterion(data.screen, D))).toBe(JSON.stringify(criterion(old.screen, D)));
    expect(criterion(data.screen, D)).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
    const dRecord = (input: ScreenInput) => ({ ...computedRecord("computed-calfire-high-", input), subject: null });
    const dBlock = (input: ScreenInput) => authorityBlocks(input).find((block) => block.evidence_id.startsWith("computed-calfire-high-"));
    expect(JSON.stringify(dRecord(httpInput))).toBe(JSON.stringify(dRecord(oldInput)));
    expect(JSON.stringify(dBlock(httpInput))).toBe(JSON.stringify(dBlock(oldInput)));
  });

  it("A11 native SRA invalid record 10977 never establishes c", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: WITNESS_10977, routes: { gov_51178: "none", prc_4202: "native" } });
    const data = await evaluated(await get(caseId, admin.cookie));
    const view = lastInput().lot_overlay!.datasets[0];
    expect(view.entries()[10976]).toMatchObject({ record_number: 10977, label: "Very High", geometry_state: "invalid" });
    expect(vhValue("prc_4202")).toBeNull();
    expect(criterion(data.screen, C).status).toBe("unknown");
  });

  it("A12 whole-lot Very High without one-legal-lot identity stays unknown", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20), identity: "not_established" });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data.reviewed_lot!.legal_lot_identity).toBe("not_established");
    expect(overlays(data)).toEqual(["computed", "computed"]);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([null, null]);
    expect(criterion(data.screen, C).status).toBe("unknown");
  });

  it("A13 refuses every caller input: query parameters and request bodies", async () => {
    const admin = await signUp("admin");
    const { caseId, revision } = await prepareCase();
    const { bucket, calls } = proxiedBucket();
    const runtime = bindings({ EVIDENCE_FILES: bucket });
    const forged = encodeURIComponent(JSON.stringify([{ evidence_id: "test-only-forged", qualifiers: { family: "hazard_map" } }]));
    for (const query of [`?evidence_authority=${forged}`, `?registries=${forged}`, `?revision=${encodeURIComponent(revision)}`, "?evidence=x", "?as_of=2026-10-01",
      "?packs=x", "?lot_overlay=x", "?subject=x", "?property_id=x", "?revision", "?case_id=", "?as_of=2026-10-01&as_of=2026-10-02", "?=x&as_of=2026-10-01"]) {
      await expectError(await get(caseId, admin.cookie, { query, env: runtime }), 400, ...ERROR_400);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await get(caseId, admin.cookie, { method, env: runtime, headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ evidence_records: anchors(caseId), evidence_authority: [], as_of: "2026-10-01" }) });
      await expectError(response, 404, "NOT_FOUND", "The requested resource was not found.");
    }
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
    // A nameless pair carries no parameter name; the parser drops it and nothing reaches the evaluator.
    const plain = await evaluated(await get(caseId, admin.cookie));
    for (const query of ["?", "?=x", "?&"]) expect(await evaluated(await get(caseId, admin.cookie, { query }))).toEqual(plain);
  });

  it("A14 the evaluated evidence is only the three server-computed records; no caller or anchor record appears", async () => {
    const admin = await signUp("admin");
    const { caseId, lot } = await prepareCase({ lot: lotAt(220) });
    const data = await evaluated(await get(caseId, admin.cookie));
    const input = lastInput();
    expect(input.evidence_records.map((entry) => entry.id)).toEqual(computedIds(lot.review_id));
    expect(authorityBlocks(input).every((block) => block.evidence_id.startsWith("computed-calfire-"))).toBe(true);
    expect(data.screen.facts.flatMap((fact) => fact.evidence.map((entry) => entry.evidence_id)).sort()).toEqual(computedIds(lot.review_id).sort());
    const anchorsInScreen = data.screen.facts.filter((fact) => ["jurisdiction", "parcel-match"].includes(fact.key));
    expect(anchorsInScreen.length).toBeGreaterThan(0);
    for (const fact of anchorsInScreen) expect(fact).toMatchObject({ supplied: false, evidence: [] });
  });

  it("A15 on 2026-10-29 d carries a stale-criterion blocker while c is not yet stale", async () => {
    at("2026-10-29T18:00:00Z");
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(220) });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data.as_of).toBe("2026-10-29");
    expect(data.reviewed_lot).not.toBeNull();
    expect([criterion(data.screen, C).stale, criterion(data.screen, D).stale]).toEqual([false, true]);
    const stale = data.screen.release.blockers.filter((blocker) => blocker.code === "stale_criterion").map((blocker) => blocker.ref);
    expect(stale.some((ref) => ref.includes(D))).toBe(true);
    expect(stale.some((ref) => ref.includes(C))).toBe(false);
  });

  it("A16 on 2026-10-31 c and d are both stale and the expired review is not used", async () => {
    at("2026-10-31T18:00:00Z");
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20) });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data.as_of).toBe("2026-10-31");
    expect([criterion(data.screen, C).stale, criterion(data.screen, D).stale]).toEqual([true, true]);
    const stale = data.screen.release.blockers.filter((blocker) => blocker.code === "stale_criterion").map((blocker) => blocker.ref);
    expect([C, D].every((id) => stale.some((ref) => ref.includes(id)))).toBe(true);
    expect(data.reviewed_lot).toBeNull();
    expect(overlays(data)).toEqual(["unavailable", "unavailable"]);
    expect(statuses(data)).toEqual(["unknown", "unknown"]);
  });

  it("A17 on 2026-11-15 a historical ?as_of cannot bypass current safety checks", async () => {
    at("2026-11-15T18:00:00Z");
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20) });
    await expectError(await get(caseId, admin.cookie, { query: "?as_of=2026-10-01" }), 400, ...ERROR_400);
    expect(observed.inputs).toEqual([]);
    const data = await evaluated(await get(caseId, admin.cookie));
    expect([data.as_of, data.screen.as_of]).toEqual(["2026-11-15", "2026-11-15"]);
    expect(data.reviewed_lot).toBeNull();
    expect(statuses(data)).toEqual(["unknown", "unknown"]);
  });

  it("A18 a review invalidated during evaluation yields no mixed-revision conclusion", async () => {
    const admin = await signUp("admin");
    const prepared = await prepareCase({ lot: lotAt(20) });
    let invalidated = false;
    const { bucket, calls } = proxiedBucket(async (method, key) => {
      if (!invalidated && method === "get" && key.includes("/calfire/record-")) {
        invalidated = true;
        await prepared.writer.invalidateReview("stale", prepared.revision);
      }
    });
    const data = await evaluated(await get(prepared.caseId, admin.cookie, { env: bindings({ EVIDENCE_FILES: bucket }) }));
    expect(invalidated).toBe(true);
    expect(calls.filter((call) => call.startsWith("get:") && call.endsWith("/current-review.json"))).toHaveLength(1);
    expect(calls.at(-1)).toBe(`head:${prepared.caseId}/program-screen/current-review.json`);
    expect(data.reviewed_lot).toBeNull();
    expect(overlays(data)).toEqual(["unavailable", "unavailable"]);
    expect(statuses(data)).toEqual(["unknown", "unknown"]);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([null, null]);
    expect(lastInput().lot_overlay).toBeUndefined();
    const after = await evaluated(await get(prepared.caseId, admin.cookie));
    expect(after.reviewed_lot).toBeNull();
  });

  it("A19 the response carries only the allowlisted schema and none of the prepared case's private values", async () => {
    const admin = await signUp("admin");
    const prepared = await prepareCase({ lot: lotAt(20) });
    const response = await get(prepared.caseId, admin.cookie);
    const text = await response.clone().text();
    const data = await evaluated(response);
    expect(Object.keys(data.reviewed_lot!)).toEqual(SUMMARY_KEYS);
    for (const route of data.hazard_routes) expect(Object.keys(route)).toEqual(["route", "authority_source_id", "overlay"]);
    expect(Object.keys(data.screen.subject)).toEqual(["case_id", "property_id"]);
    const { lot } = prepared;
    const head = await env.EVIDENCE_FILES.head(`${prepared.caseId}/program-screen/current-review.json`);
    const refs = [lot.source_geometry.file, lot.source_geometry.metadata_file, lot.normalized_geometry.file, lot.reprojection.receipt_file, ...lot.legal_identity_evidence, ...lot.source_provenance.evidence_files];
    const secrets = [
      lot.parcel.apn, lot.parcel.pin, lot.parcel.pind!, lot.legal_lot_reference.tract, lot.legal_lot_reference.lot, lot.legal_lot_reference.map_book,
      `Tract ${lot.legal_lot_reference.tract}`, lot.review.reviewer.name, lot.review.reviewer.role, lot.review.reviewer_user_id,
      ...refs.map((ref) => ref.file_id), ...refs.map((ref) => ref.sha256), ...prepared.files.keys(), ...prepared.indexShas, ...prepared.recordShas,
      lot.source_provenance.requested_url, lot.source_provenance.final_url, lot.source_provenance.agency, lot.reprojection.profile_sha256, lot.reprojection.pipeline_sha256,
      prepared.revision, head!.etag, head!.httpEtag,
      "program-screen/", "current-review", "blobs/", "calfire/", "reviews/", "issues", "lot_geometries", "route_overlays", "candidate_records", "coordinates",
      "Current one-legal-lot identity", "coverage is not established",
    ];
    expect(new Set(secrets).size).toBeGreaterThan(25);
    for (const secret of secrets) expect(text, `response leaks ${secret}`).not.toContain(secret);
  });

  it("A20 identical inputs on the same server day are deterministic; a new review or day changes screen_id", async () => {
    const admin = await signUp("admin");
    const prepared = await prepareCase({ lot: lotAt(220) });
    const first = await evaluated(await get(prepared.caseId, admin.cookie));
    const second = await evaluated(await get(prepared.caseId, admin.cookie));
    expect(second).toEqual(first);
    const next = structuredClone(prepared.lot);
    next.review_id = crypto.randomUUID();
    await prepared.writer.ingestReviewedLot(next, prepared.revision, AS_OF);
    const reviewed = await evaluated(await get(prepared.caseId, admin.cookie));
    expect(reviewed.reviewed_lot!.review_id).toBe(next.review_id);
    expect(reviewed.screen.screen_id).not.toBe(first.screen.screen_id);
    at("2026-10-02T18:00:00Z");
    const tomorrow = await evaluated(await get(prepared.caseId, admin.cookie));
    expect(tomorrow.as_of).toBe("2026-10-02");
    expect(tomorrow.screen.screen_id).not.toBe(reviewed.screen.screen_id);
    expect(await evaluated(await get(prepared.caseId, admin.cookie))).toEqual(tomorrow);
  });

  it("A21 a case without Program Screen preparation is an unknown screen, not an HTTP error", async () => {
    const admin = await signUp("admin");
    const caseId = await insertCase();
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data.case_id).toBe(caseId);
    expect(data.reviewed_lot).toBeNull();
    expect(overlays(data)).toEqual(["unavailable", "unavailable"]);
    expect(statuses(data)).toEqual(["unknown", "unknown"]);
    expect(data.screen.release.client_releasable).toBe(false);
  });

  it("A22 TEST-ONLY lot evidence is refused in a production build", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotText("whole-very-high"), routes: { gov_51178: "none", prc_4202: "native" } });
    const control = await evaluated(await get(caseId, admin.cookie));
    expect(control.reviewed_lot).not.toBeNull();
    expect(criterion(control.screen, C).status).toBe("disqualifying_per_source");
    vi.stubEnv("MODE", "production");
    vi.stubEnv("PROD", true);
    const data = await evaluated(await get(caseId, admin.cookie));
    expect(data.reviewed_lot).toBeNull();
    expect(overlays(data)).toEqual(["unavailable", "unavailable"]);
    expect(statuses(data)).toEqual(["unknown", "unknown"]);
  });

  it("A23 an LRA load failure leaves PRC's c YES and every d byte unchanged", async () => {
    const admin = await signUp("admin");
    const reviewId = crypto.randomUUID();
    const prepared = await prepareCase({ lot: lotAt(20), reviewId });
    const withoutLra = await prepareCase({ lot: lotAt(20), reviewId, routes: { gov_51178: "none" } });
    const world = await useWorld();
    const lraIndex = `${prepared.caseId}/program-screen/calfire/index-${world.gov_51178.pin.index_sha256}.txt`;
    const normal = await evaluated(await get(prepared.caseId, admin.cookie));
    const normalInput = lastInput();
    const { bucket } = proxiedBucket((method, key) => {
      if (method === "get" && key === lraIndex) throw new Error("TEST-ONLY LRA source failure");
    });
    const failed = await evaluated(await get(prepared.caseId, admin.cookie, { env: bindings({ EVIDENCE_FILES: bucket }) }));
    const failedInput = lastInput();
    const absent = await evaluated(await get(withoutLra.caseId, admin.cookie));
    const absentInput = lastInput();
    expect(overlays(normal)).toEqual(["computed", "computed"]);
    expect(overlays(failed)).toEqual(["unavailable", "computed"]);
    expect(vhValue("gov_51178", failedInput)).toBeNull();
    expect(vhValue("prc_4202", failedInput)).toBe(true);
    expect(criterion(failed.screen, C).status).toBe("disqualifying_per_source");
    const dBytes = (data: ProgramScreenCaseEvaluationResponse, input: ScreenInput) => ({
      criterion: JSON.stringify(criterion(data.screen, D)),
      record: JSON.stringify({ ...computedRecord("computed-calfire-high-", input), subject: null }),
      block: JSON.stringify(authorityBlocks(input).find((block) => block.evidence_id.startsWith("computed-calfire-high-"))),
    });
    expect(dBytes(failed, failedInput)).toEqual(dBytes(normal, normalInput));
    expect(dBytes(absent, absentInput)).toEqual(dBytes(normal, normalInput));
    expect(criterion(failed.screen, D)).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
  });

  it("A24 missing evidence storage is a 503 after authorization", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase();
    await expectError(await get(caseId, admin.cookie, { env: bindings({ EVIDENCE_FILES: undefined }) }), 503, "EVIDENCE_STORAGE_UNAVAILABLE", "Evidence file storage is not configured.");
    expect(observed.inputs).toEqual([]);
    const client = await signUp("client");
    await expectError(await get(caseId, client.cookie, { env: bindings({ EVIDENCE_FILES: undefined }) }), 403, ...ERROR_403);
  });

  it("A25 every response is no-store with no CORS or ETag header", async () => {
    const admin = await signUp("admin");
    const client = await signUp("client");
    const { caseId } = await prepareCase();
    const foreign = { origin: "https://attacker.example.test" };
    await evaluated(await get(caseId, admin.cookie, { headers: foreign }));
    await expectError(await get(caseId, null, { headers: foreign }), 401, "UNAUTHENTICATED", "Authentication is required.");
    await expectError(await get(caseId, client.cookie, { headers: foreign }), 403, ...ERROR_403);
    await expectError(await get(caseId, admin.cookie, { query: "?as_of=2026-10-01", headers: foreign }), 400, ...ERROR_400);
    await expectError(await get("not-a-uuid", admin.cookie, { headers: foreign }), 400, "INVALID_CASE_ID", "The case ID is invalid.");
    await expectError(await get(crypto.randomUUID(), admin.cookie, { headers: foreign }), 404, "CASE_NOT_FOUND", "The case was not found.");
    await expectError(await get(caseId, admin.cookie, { headers: foreign, env: bindings({ EVIDENCE_FILES: undefined }) }), 503, "EVIDENCE_STORAGE_UNAVAILABLE", "Evidence file storage is not configured.");
    observed.failEvaluator = "TEST-ONLY evaluator failure";
    await expectError(await get(caseId, admin.cookie, { headers: foreign }), 500, "PROGRAM_SCREEN_EVALUATION_FAILED", "The Program Screen evaluation could not be completed.");
    const preflight = await get(caseId, null, { method: "OPTIONS", headers: { ...foreign, "access-control-request-method": "GET" } });
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("A26 a malformed case ID is 400 for an administrator but 403 for a client, before any case lookup", async () => {
    const admin = await signUp("admin");
    const client = await signUp("client");
    const { bucket, calls } = proxiedBucket();
    const runtime = bindings({ EVIDENCE_FILES: bucket });
    for (const id of ["not-a-uuid", "00000000-0000-4000-8000-00000000000", "%20", "00000000-0000-4000-8000-0000000003a1x", "TEST-ONLY%27%20OR%201%3D1"]) {
      await expectError(await get(id, admin.cookie, { env: runtime }), 400, "INVALID_CASE_ID", "The case ID is invalid.");
      await expectError(await get(id, client.cookie, { env: runtime }), 403, ...ERROR_403);
    }
    expect(calls).toEqual([]);
  });

  it("A27 the response still reflects 2 human-verified, 44 pending, 34 unencoded, 44 release blockers and open G1/G2", async () => {
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(20) });
    const data = await evaluated(await get(caseId, admin.cookie));
    const all = criteria(data.screen);
    expect(all.filter((entry) => entry.verification === "human_verified").map((entry) => entry.criterion_id)).toEqual([C, D]);
    expect(all.filter((entry) => entry.verification === "pending_human")).toHaveLength(44);
    expect(all.filter((entry) => entry.rule_kind === "not_encoded")).toHaveLength(34);
    expect(data.screen.release.blockers.filter((blocker) => blocker.code === "pending_human_criterion")).toHaveLength(44);
    expect(data.screen.release.client_releasable).toBe(false);
    const packCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(packCriteria.filter((entry) => entry.predicate === "not_encoded")).toHaveLength(34);
    expect(programPathwayCompletenessBlockers.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "G1", status: "open" }, { id: "G2", status: "open" }]);
  });

  it("A28 an internal failure returns only the generic message", async () => {
    const admin = await signUp("admin");
    const prepared = await prepareCase();
    const secret = `TEST-ONLY internal ${prepared.caseId}/program-screen/blobs/${prepared.lot.normalized_geometry.file.sha256} ${prepared.lot.review.reviewer_user_id}`;
    observed.failEvaluator = secret;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get(prepared.caseId, admin.cookie);
    const text = await response.clone().text();
    await expectError(response, 500, "PROGRAM_SCREEN_EVALUATION_FAILED", "The Program Screen evaluation could not be completed.");
    for (const value of [secret, "TEST-ONLY internal", prepared.lot.normalized_geometry.file.sha256, prepared.lot.review.reviewer_user_id, "program-screen/", "stack", "Error"]) expect(text).not.toContain(value);
    expect(observed.inputs).toHaveLength(1);
    expect(errors).toHaveBeenCalledWith("Program Screen evaluation failed.", expect.any(Error));
    errors.mockRestore();
  });

  it("A29 the service itself rejects a client, so the route is not the only admin boundary", async () => {
    const { caseId } = await prepareCase();
    const client = await signUp("client");
    await addOwner(caseId, client.id);
    const { bucket, calls } = proxiedBucket();
    await expect(evaluateCaseProgramScreen(serviceBindings(bucket), { id: client.id, role: "client" }, caseId, AS_OF)).rejects.toThrow("Program Screen evaluation permission denied.");
    expect(calls).toEqual([]);
    expect(observed.inputs).toEqual([]);
  });

  it("A30 as_of is the UTC calendar date, even when it is still the previous day in Los Angeles", async () => {
    at("2026-10-02T03:00:00Z");
    expect(new Date().toISOString()).toBe("2026-10-02T03:00:00.000Z");
    const admin = await signUp("admin");
    const { caseId } = await prepareCase({ lot: lotAt(220) });
    const data = await evaluated(await get(caseId, admin.cookie));
    expect([data.as_of, data.screen.as_of, data.as_of_basis]).toEqual(["2026-10-02", "2026-10-02", "server_utc_calendar_date"]);
    expect(lastInput().as_of).toBe("2026-10-02");
  });
});
