import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, inject, it, vi } from "vitest";
import fictionalFixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import sraSourceText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import type { ProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { fileGdbOverlayIndexText, overlayIndexPins, parseOverlayIndex, type OverlayIndexPin } from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { bytesSha256, reviewedLotRecordSchema } from "../src/shared/program-screen/reviewed-lot";
import { sha256Hex } from "../src/shared/program-screen/source-capture";
import { programPathwayCompletenessBlockers, type ProgramScreenResult } from "../src/shared/program-screen/types";
import { mayPrepareProgramScreenCase, type CaseActor } from "../src/worker/cases/authorization";
import { openProgramScreenCaseStore } from "../src/worker/program-screen/case-evidence";
import * as preparation from "../src/worker/program-screen/case-preparation";
import { evaluateCaseProgramScreen, evaluateStoredCaseProgramScreen } from "../src/worker/program-screen/evaluate-case";
import {
  ADMIN_NAME, AS_OF, PDF, REVIEWER_ROLE, addOwner, auditRows, body, bucketWrites, buildProposal, codes, decode, errorCodes, expectPreparationError,
  failingStatement, fileRef, insertCase, insertUser, lotAt, lotFromRings, proxiedBucket, proxiedDb, serviceBindings, syntheticSource, utf8,
  type BuiltProposal, type LegalLotIdentity, type ProposalSpec,
} from "./program-screen-case-preparation-3k-helpers";
import { feature, record, ring, source as lraSource, sra as sraSource, C, D } from "./program-screen-lra-helpers";
import { polygonRecordContent, testOnlySraIndexText } from "./program-screen-overlay-helpers";

type ScreenInput = Omit<Parameters<typeof evaluateProgramScreen>[0], "evidence_records" | "evidence_authority"> & {
  evidence_records: readonly CanonicalEvidenceRecord[];
  evidence_authority?: unknown;
};
const observed = vi.hoisted(() => ({ inputs: [] as ScreenInput[], pins: [] as OverlayIndexPin[] }));

// TEST-ONLY observer: the real evaluator, verification, geometry and validity checks still run.
vi.mock("../src/shared/program-screen/evaluate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/shared/program-screen/evaluate")>();
  return { ...actual, evaluateProgramScreen: (input: ScreenInput) => {
    if (input.evidence_records.some((entry) => entry.id.startsWith("computed-calfire-high-"))) observed.inputs.push(input);
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

const ROUTES = ["gov_51178", "prc_4202"] as const;
type Route = (typeof ROUTES)[number];
const ROUTE_SOURCES = { gov_51178: "calfire-lra-fhsz-2025-03-24-v1", prc_4202: "calfire-sra-fhsz-2023-09-29" } as const;
const SHIPPED_PINS = [...overlayIndexPins];
const REQUEST_ID = "test-only-3k-request";

/**
 * One TEST-ONLY synthetic dataset per route (the Phase 3J world). A lot at
 * x..x+60 selects the zone at x..x+100.
 */
type Zone = { label: string; x0: number; x1: number; state?: "valid" | "invalid" | "unreadable" };
const LRA_WORLD: Zone[] = [
  { label: "Very High", x0: 0, x1: 100 }, { label: "High", x0: 200, x1: 300 }, { label: "Moderate", x0: 400, x1: 500 },
  { label: "NonWildland", x0: 600, x1: 700 }, { label: "Very High", x0: 800, x1: 850 }, { label: "Very High", x0: 1000, x1: 1100, state: "invalid" },
  { label: "Very High", x0: 1200, x1: 1300, state: "unreadable" }, { label: "Very High", x0: 1400, x1: 1500 }, { label: "High", x0: 1600, x1: 1700 },
  { label: "High", x0: 1800, x1: 1900 }, { label: "High", x0: 2000, x1: 2100 }, { label: "High", x0: 2200, x1: 2300 }, { label: "High", x0: 2400, x1: 2500 },
];
const SRA_WORLD: Zone[] = [
  { label: "Very High", x0: 0, x1: 100 }, { label: "Moderate", x0: 200, x1: 300 }, { label: "Moderate", x0: 400, x1: 500 },
  { label: "Moderate", x0: 600, x1: 700 }, { label: "Moderate", x0: 800, x1: 900 }, { label: "Moderate", x0: 1000, x1: 1100 },
  { label: "Moderate", x0: 1200, x1: 1300 }, { label: "Moderate", x0: 1400, x1: 1500 }, { label: "Very High", x0: 1600, x1: 1650 },
  { label: "Very High", x0: 1800, x1: 1900, state: "invalid" }, { label: "Very High", x0: 2000, x1: 2100, state: "unreadable" },
  { label: "Very High", x0: 2200, x1: 2300 }, { label: "Moderate", x0: 2600, x1: 2700 },
];
interface RouteDataset { index_text: string; records: Array<{ record_number: number; content: Uint8Array }>; pin: OverlayIndexPin }
type World = Record<Route, RouteDataset>;
const lraPack = lraSource.package!, sraPack = sraSource.package!;
async function lraIndex(zones: Zone[], layer: string = lraPack.overlay.dataset_name) {
  return fileGdbOverlayIndexText({
    dataset: lraPack.members.overlay_dataset, layer, crs_epsg: 3310, class_field: lraPack.overlay.class_field,
    members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
    records: zones.map((zone, i) => feature(i + 1, zone.label, zone.x0, zone.x1, zone.state ?? "valid")),
  });
}
let worldPromise: Promise<World> | undefined;
async function buildWorld(): Promise<World> {
  const lra = await lraIndex(LRA_WORLD);
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

/* ------------------------------------------------------------- service-level preparation */

const svc = preparation;
const now = () => new Date();
const today = () => new Date().toISOString().slice(0, 10);
async function stage(actor: CaseActor, caseId: string, built: BuiltProposal, skip: readonly string[] = []) {
  for (const [sha, bytes] of built.files) if (!skip.includes(sha)) await svc.storeCasePreparationBlob(serviceBindings(), actor, caseId, sha, bytes);
}
async function hydrate(actor: CaseActor, caseId: string, data: Omit<RouteDataset, "pin">, omit: readonly number[] = []) {
  await svc.hydrateCalFireIndex(serviceBindings(), actor, caseId, await sha256Hex(data.index_text), utf8(data.index_text));
  for (const entry of data.records) {
    if (!omit.includes(entry.record_number)) await svc.hydrateCalFireRecord(serviceBindings(), actor, caseId, await bytesSha256(entry.content), entry.content);
  }
}
type RouteSource = "world" | "native" | "none";
interface CaseSpec extends ProposalSpec {
  admin?: CaseActor;
  caseId?: string;
  routes?: Partial<Record<Route, RouteSource>>;
  omit?: Partial<Record<Route, number[]>>;
}
interface StagedCase { caseId: string; admin: CaseActor; built: BuiltProposal }
/** Stage 1 only: blobs and CAL FIRE content through the Phase 3K services; nothing published. */
async function stageCase(spec: CaseSpec = {}): Promise<StagedCase> {
  const admin = spec.admin ?? await insertUser("admin");
  const caseId = spec.caseId ?? await insertCase();
  const built = await buildProposal(spec);
  await stage(admin, caseId, built);
  const routes: Record<Route, RouteSource> = { gov_51178: "world", prc_4202: "world", ...spec.routes };
  const world = ROUTES.some((route) => routes[route] === "world") ? await useWorld() : null;
  for (const route of ROUTES) {
    if (routes[route] !== "none") await hydrate(admin, caseId, routes[route] === "world" ? world![route] : nativeDataset(route), spec.omit?.[route]);
  }
  return { caseId, admin, built };
}
const publish = (actor: CaseActor, caseId: string, request: unknown, bindings = serviceBindings()) => svc.publishReviewedLotProposal(bindings, actor, caseId, request, now(), REQUEST_ID);
const validate = (actor: CaseActor, caseId: string, request: unknown, bindings = serviceBindings()) => svc.validateReviewedLotProposal(bindings, actor, caseId, request, now());
const status = (actor: CaseActor, caseId: string, bindings = serviceBindings()) => svc.readCasePreparationStatus(bindings, actor, caseId, now());
async function prepareCase(spec: CaseSpec = {}) {
  const staged = await stageCase(spec);
  return { ...staged, publication: await publish(staged.admin, staged.caseId, body(staged.built)) };
}
async function currentRecord(caseId: string) {
  const file = await env.EVIDENCE_FILES.get(`${caseId}/program-screen/current-review.json`);
  return file === null ? null : reviewedLotRecordSchema.parse(JSON.parse(await file.text()));
}

const criteria = (screen: ProgramScreenResult) => screen.pathways.flatMap((pathway) => pathway.criteria);
const criterion = (screen: ProgramScreenResult, id: string) => criteria(screen).find((entry) => entry.criterion_id === id)!;
const cdStatuses = (screen: ProgramScreenResult) => [criterion(screen, C).status, criterion(screen, D).status];
const lastInput = () => observed.inputs.at(-1)!;
const computedRecord = (prefix: string, input = lastInput()) => input.evidence_records.find((entry) => entry.id.startsWith(prefix))!;
const vhValue = (route: Route, input = lastInput()) => {
  const value = computedRecord(`computed-calfire-very-high-${route}-`, input).normalized_value;
  return value.kind === "boolean" ? value.value : null;
};
const authorityBlocks = (input = lastInput()) => input.evidence_authority as ProgramEvidenceAuthority[];
const evaluate = (actor: CaseActor, caseId: string, bindings = serviceBindings()) => evaluateCaseProgramScreen(bindings, actor, caseId, today());
const routeStatus = (routes: readonly preparation.PreparationHazardRouteStatus[], route: Route) => routes.find((entry) => entry.route === route)!;

beforeEach(() => {
  observed.inputs = [];
  observed.pins = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T18:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  observed.pins = [];
  (overlayIndexPins as OverlayIndexPin[]).splice(SHIPPED_PINS.length);
});

/* =================================================================== Commit A: service */

describe("Phase 3K A: service boundary", () => {
  it("exports exactly the seven preparation services, none accepting caller authority, registries, subject, dates, reviewer or route", async () => {
    const functions = Object.entries(preparation).filter(([, value]) => typeof value === "function").map(([name]) => name).sort();
    expect(functions).toEqual(["CasePreparationError", "hydrateCalFireIndex", "hydrateCalFireRecord", "invalidateCurrentReview", "publishReviewedLotProposal",
      "readCasePreparationStatus", "storeCasePreparationBlob", "validateReviewedLotProposal"]);
    expect([svc.readCasePreparationStatus, svc.storeCasePreparationBlob, svc.hydrateCalFireIndex, svc.hydrateCalFireRecord, svc.validateReviewedLotProposal,
      svc.publishReviewedLotProposal, svc.invalidateCurrentReview].map((fn) => fn.length)).toEqual([4, 5, 5, 5, 5, 6, 6]);
    if (false as boolean) {
      const b = serviceBindings(), actor: CaseActor = { id: "test-only", role: "admin" }, at = new Date();
      // @ts-expect-error The server date comes from `now`; no caller as_of.
      await svc.readCasePreparationStatus(b, actor, "case", "2026-10-01");
      // @ts-expect-error No registries, authority or subject argument.
      await svc.readCasePreparationStatus(b, actor, "case", at, programAuthorityRegistries);
      // @ts-expect-error The blob body is raw bytes.
      await svc.storeCasePreparationBlob(b, actor, "case", "sha", "text");
      // @ts-expect-error No caller route or authority source for an index.
      await svc.hydrateCalFireIndex(b, actor, "case", "sha", new Uint8Array(), "gov_51178");
      // @ts-expect-error No caller record number.
      await svc.hydrateCalFireRecord(b, actor, "case", "sha", new Uint8Array(), 1);
      // @ts-expect-error No reviewer argument.
      await svc.validateReviewedLotProposal(b, actor, "case", {}, at, { name: "TEST-ONLY" });
      // @ts-expect-error No caller as_of string.
      await svc.publishReviewedLotProposal(b, actor, "case", {}, "2026-10-01", REQUEST_ID);
      // @ts-expect-error No registries, pins or packs after the request ID.
      await svc.publishReviewedLotProposal(b, actor, "case", {}, at, REQUEST_ID, programAuthorityRegistries);
      // @ts-expect-error No supersession target or state.
      await svc.invalidateCurrentReview(b, actor, "case", {}, at, REQUEST_ID, "superseded");
    }
  });

  it("Z6 every service refuses a client, owner or not, before any D1 or R2 access", async () => {
    const caseId = await insertCase();
    const owner = await insertUser("client");
    await addOwner(caseId, owner.id);
    const world = await useWorld();
    const content = world.prc_4202.records[0].content;
    for (const actor of [owner, await insertUser("client"), { id: crypto.randomUUID(), role: "client" } as CaseActor]) {
      expect(mayPrepareProgramScreenCase(actor)).toBe(false);
      const { db, calls: dbCalls } = proxiedDb();
      const { bucket, calls } = proxiedBucket();
      const b = serviceBindings({ DB: db, EVIDENCE_FILES: bucket });
      for (const target of [caseId, crypto.randomUUID()]) {
        await expectPreparationError(svc.readCasePreparationStatus(b, actor, target, now()), "FORBIDDEN");
        await expectPreparationError(svc.storeCasePreparationBlob(b, actor, target, await bytesSha256(PDF), PDF), "FORBIDDEN");
        await expectPreparationError(svc.hydrateCalFireIndex(b, actor, target, world.prc_4202.pin.index_sha256, utf8(world.prc_4202.index_text)), "FORBIDDEN");
        await expectPreparationError(svc.hydrateCalFireRecord(b, actor, target, await bytesSha256(content), content), "FORBIDDEN");
        await expectPreparationError(svc.validateReviewedLotProposal(b, actor, target, body(await buildProposal()), now()), "FORBIDDEN");
        await expectPreparationError(svc.publishReviewedLotProposal(b, actor, target, body(await buildProposal()), now(), REQUEST_ID), "FORBIDDEN");
        await expectPreparationError(svc.invalidateCurrentReview(b, actor, target, { expected_revision: "x", reason: "other" }, now(), REQUEST_ID), "FORBIDDEN");
      }
      expect(dbCalls).toEqual([]);
      expect(calls).toEqual([]);
    }
    expect(mayPrepareProgramScreenCase({ id: "test-only", role: "admin" })).toBe(true);
    expect(await auditRows(caseId)).toEqual([]);
  });

  it("an administrator still needs an existing case; each service refuses an unknown case before any R2 access", async () => {
    const admin = await insertUser("admin");
    const world = await useWorld();
    const content = world.prc_4202.records[0].content;
    const { bucket, calls } = proxiedBucket();
    const b = serviceBindings({ EVIDENCE_FILES: bucket });
    for (const target of [crypto.randomUUID(), "not-a-case"]) {
      await expectPreparationError(svc.readCasePreparationStatus(b, admin, target, now()), "CASE_NOT_FOUND");
      await expectPreparationError(svc.storeCasePreparationBlob(b, admin, target, await bytesSha256(PDF), PDF), "CASE_NOT_FOUND");
      await expectPreparationError(svc.hydrateCalFireIndex(b, admin, target, world.prc_4202.pin.index_sha256, utf8(world.prc_4202.index_text)), "CASE_NOT_FOUND");
      await expectPreparationError(svc.hydrateCalFireRecord(b, admin, target, await bytesSha256(content), content), "CASE_NOT_FOUND");
      await expectPreparationError(svc.validateReviewedLotProposal(b, admin, target, body(await buildProposal()), now()), "CASE_NOT_FOUND");
      await expectPreparationError(svc.publishReviewedLotProposal(b, admin, target, body(await buildProposal()), now(), REQUEST_ID), "CASE_NOT_FOUND");
      await expectPreparationError(svc.invalidateCurrentReview(b, admin, target, { expected_revision: "x", reason: "other" }, now(), REQUEST_ID), "CASE_NOT_FOUND");
    }
    expect(calls).toEqual([]);
    await expectPreparationError(svc.readCasePreparationStatus(serviceBindings({ EVIDENCE_FILES: undefined }), admin, await insertCase(), now()), "EVIDENCE_STORAGE_UNAVAILABLE");
  });
});

describe("Phase 3K A: publication and status (P2-P4)", () => {
  it.each([220, 20, 820, 1820, 2220])("P2 the ready status lists exactly the evaluator's candidate records for a lot at x=%i, and status/validate write nothing", async (x) => {
    const prepared = await prepareCase({ lot: lotAt(x) });
    const { bucket, calls } = proxiedBucket();
    const { db, calls: dbCalls } = proxiedDb();
    const b = serviceBindings({ DB: db, EVIDENCE_FILES: bucket });
    const current = await status(prepared.admin, prepared.caseId, b);
    const validation = await validate(prepared.admin, prepared.caseId, body(prepared.built, prepared.publication.revision), b);
    expect(bucketWrites(calls)).toEqual([]);
    expect(dbCalls.filter((call) => /\b(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(call))).toEqual([]);
    expect(current).toMatchObject({ schema_version: "program-screen-case-preparation-status-v1", case_id: prepared.caseId, as_of: AS_OF, as_of_basis: "server_utc_calendar_date", integrity: "ok", readiness: "ready" });
    expect(current.current_review).toEqual({
      review_id: prepared.publication.review_id, state: "current", reviewed_on: AS_OF, next_review_on: "2026-10-30", legal_lot_identity: "parcel_is_one_legal_lot",
      reviewer_user_id: prepared.admin.id, revision: prepared.publication.revision, verified: true, diagnostics: [],
    });
    const result = await evaluate(prepared.admin, prepared.caseId);
    for (const route of ROUTES) {
      const entry = routeStatus(current.hazard_routes, route);
      expect(entry).toMatchObject({ route, authority_source_id: ROUTE_SOURCES[route], index: "present", index_sha256: (await useWorld())[route].pin.index_sha256 });
      expect(entry.required_records!.length).toBeGreaterThan(0);
      expect(entry.required_records!.map((required) => required.record_number)).toEqual([...result.route_overlays[route].computed.candidate_records]);
      expect(entry.required_records!.every((required) => required.present)).toBe(true);
    }
    expect(validation).toMatchObject({ valid: true, expected_revision_current: true });
    expect(validation.hazard_routes).toEqual(current.hazard_routes);
  });

  it("P3 the publication revision is the status revision and the R2 ETag; the immutable archive and a committed audit row exist", async () => {
    const prepared = await prepareCase();
    const { publication, caseId, admin, built } = prepared;
    expect(Object.keys(publication)).toEqual(["schema_version", "case_id", "review_id", "reviewed_on", "next_review_on", "legal_lot_identity", "manifest_sha256", "prior_revision", "revision", "replayed", "diagnostics"]);
    expect(publication).toMatchObject({ schema_version: "program-screen-case-publication-v1", case_id: caseId, reviewed_on: AS_OF, next_review_on: "2026-10-30", legal_lot_identity: "parcel_is_one_legal_lot", prior_revision: null, replayed: false });
    const head = await env.EVIDENCE_FILES.head(`${caseId}/program-screen/current-review.json`);
    expect(publication.revision).toBe(head!.etag);
    expect((await status(admin, caseId)).current_review!.revision).toBe(publication.revision);
    const archived = await env.EVIDENCE_FILES.get(`${caseId}/program-screen/reviews/${publication.review_id}-${publication.manifest_sha256}.json`);
    const archivedBytes = new Uint8Array(await archived!.arrayBuffer());
    const currentText = await (await env.EVIDENCE_FILES.get(`${caseId}/program-screen/current-review.json`))!.text();
    expect(await bytesSha256(archivedBytes)).toBe(publication.manifest_sha256);
    expect(decode(archivedBytes)).toBe(currentText);
    const stored = reviewedLotRecordSchema.parse(JSON.parse(currentText));
    expect(currentText).toBe(`${JSON.stringify(stored)}\n`);
    expect(stored).toMatchObject({ review_id: publication.review_id, case_id: caseId, state: { status: "current", superseded_by: null } });
    // The review ID is the documented derivation over the canonical proposal.
    const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
      : value !== null && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(`program-screen-review-id-v1\0${caseId}\0${admin.id}\0none\0${AS_OF}\0${canonical(built.proposal)}`))).slice(0, 16);
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    const hex = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(publication.review_id).toBe(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
    const rows = await auditRows(caseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      case_id: caseId, actor_user_id: admin.id, action: "publish", review_id: publication.review_id, prior_revision: null,
      new_manifest_sha256: publication.manifest_sha256, new_revision: publication.revision, reason: null, outcome: "committed", request_id: REQUEST_ID,
    });
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0].completed_at).not.toBeNull();
    const serialized = JSON.stringify(rows);
    for (const secret of [stored.parcel.apn, stored.parcel.pin, stored.parcel.pind!, stored.legal_lot_reference.tract, stored.legal_lot_reference.lot,
      stored.legal_lot_reference.map_book, ADMIN_NAME, stored.source_provenance.requested_url, built.refs.source.file_id]) expect(serialized).not.toContain(secret);
  });

  it("P4 a replacement publication with the current revision succeeds and both manifests stay archived", async () => {
    const prepared = await prepareCase();
    const first = prepared.publication;
    const next = await buildProposal({ nextReviewOn: "2026-10-29" });
    const second = await publish(prepared.admin, prepared.caseId, body(next, first.revision));
    expect(second).toMatchObject({ replayed: false, prior_revision: first.revision, next_review_on: "2026-10-29" });
    expect(second.review_id).not.toBe(first.review_id);
    expect(second.revision).not.toBe(first.revision);
    expect((await currentRecord(prepared.caseId))!.review_id).toBe(second.review_id);
    for (const publication of [first, second]) expect(await env.EVIDENCE_FILES.head(`${prepared.caseId}/program-screen/reviews/${publication.review_id}-${publication.manifest_sha256}.json`)).not.toBeNull();
    expect((await auditRows(prepared.caseId)).map((row) => [row.prior_revision, row.new_revision, row.outcome])).toEqual([[null, first.revision, "committed"], [first.revision, second.revision, "committed"]]);
    expect((await evaluate(prepared.admin, prepared.caseId)).reviewed_lot!.review_id).toBe(second.review_id);
  });
});

describe("Phase 3K A: provenance (V1-V14)", () => {
  it("V1 a blob whose bytes differ from the path digest is refused and nothing is stored; a matching blob is stored idempotently", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const wrong = await bytesSha256(utf8("TEST-ONLY other bytes"));
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(svc.storeCasePreparationBlob(serviceBindings({ EVIDENCE_FILES: bucket }), admin, caseId, wrong, PDF), "DIGEST_MISMATCH");
    expect(calls).toEqual([]);
    for (const key of [wrong, await bytesSha256(PDF)]) expect(await env.EVIDENCE_FILES.head(`${caseId}/program-screen/blobs/${key}`)).toBeNull();
    await expectPreparationError(svc.storeCasePreparationBlob(serviceBindings(), admin, caseId, (await bytesSha256(PDF)).toUpperCase(), PDF), "INVALID_DIGEST");
    const sha = await bytesSha256(PDF);
    expect(await svc.storeCasePreparationBlob(serviceBindings(), admin, caseId, sha, PDF)).toEqual({ sha256: sha, bytes: PDF.length });
    expect(await svc.storeCasePreparationBlob(serviceBindings(), admin, caseId, sha, PDF)).toEqual({ sha256: sha, bytes: PDF.length });
    const stored = await env.EVIDENCE_FILES.get(`${caseId}/program-screen/blobs/${sha}`);
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(PDF);
    expect((await env.EVIDENCE_FILES.list({ prefix: `${caseId}/` })).objects.map((object) => object.key)).toEqual([`${caseId}/program-screen/blobs/${sha}`]);
    expect(await currentRecord(caseId)).toBeNull();
  });

  it("V2 an empty blob is refused; the 8 MiB blob bound is exact", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const empty = new Uint8Array(0);
    await expectPreparationError(svc.storeCasePreparationBlob(serviceBindings(), admin, caseId, await bytesSha256(empty), empty), "EMPTY_BODY");
    const limit = new Uint8Array(8 * 1024 * 1024).fill(0x25);
    expect((await svc.storeCasePreparationBlob(serviceBindings(), admin, caseId, await bytesSha256(limit), limit)).bytes).toBe(8 * 1024 * 1024);
    const over = new Uint8Array(8 * 1024 * 1024 + 1).fill(0x25);
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(svc.storeCasePreparationBlob(serviceBindings({ EVIDENCE_FILES: bucket }), admin, caseId, await bytesSha256(over), over), "PAYLOAD_TOO_LARGE");
    expect(calls).toEqual([]);
  });

  it("V3 a file reference whose byte count differs from the staged blob is FILE_HASH_MISMATCH", async () => {
    const staged = await stageCase();
    const proposal = structuredClone(staged.built.proposal);
    proposal.source_geometry.file.bytes += 1;
    proposal.source_provenance.evidence_files[0].bytes += 1;
    const result = await validate(staged.admin, staged.caseId, body(proposal));
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual({ code: "FILE_HASH_MISMATCH", severity: "error", field: "source_geometry.file", file_id: staged.built.refs.source.file_id, sha256: staged.built.refs.source.sha256 });
    await expectPreparationError(publish(staged.admin, staged.caseId, body(proposal)), "PREPARATION_INVALID");
    expect(await currentRecord(staged.caseId)).toBeNull();
  });

  it("V4 a missing source blob is FILE_MISSING, blocks publication and leaves no review or audit row", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const built = await buildProposal();
    await stage(admin, caseId, built, [built.refs.source.sha256]);
    const result = await validate(admin, caseId, body(built));
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual({ code: "FILE_MISSING", severity: "error", field: "source_geometry.file", file_id: built.refs.source.file_id, sha256: built.refs.source.sha256 });
    const error = await expectPreparationError(publish(admin, caseId, body(built)), "PREPARATION_INVALID");
    expect(codes((error.details as { diagnostics: preparation.CasePreparationDiagnostic[] }).diagnostics)).toContain("FILE_MISSING");
    expect(await currentRecord(caseId)).toBeNull();
    expect(await auditRows(caseId)).toEqual([]);
    expect((await status(admin, caseId)).readiness).toBe("no_review");
  });

  it("V5 a normalized file the receipt does not link is RECEIPT_NOT_LINKED", async () => {
    const staged = await stageCase({ receipt: (receipt) => { receipt.target.sha256 = "e".repeat(64); } });
    expect(errorCodes((await validate(staged.admin, staged.caseId, body(staged.built))).diagnostics)).toEqual(["RECEIPT_NOT_LINKED"]);
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it.each([
    ["an extra position", lotFromRings([[[220, 20], [220, 80], [250, 90], [280, 80], [280, 20], [220, 20]]])],
    ["an extra ring", lotFromRings([ring(220, 20, 280, 80), ring(230, 30, 240, 40).reverse()])],
  ])("V6 a hand-edited receipt binding an unrelated polygon with %s is NORMALIZED_STRUCTURE_MISMATCH, which the lower-level verifier alone accepts", async (_name, lot) => {
    const staged = await stageCase({ lot, sourceText: sraSourceText });
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual(["NORMALIZED_STRUCTURE_MISMATCH"]);
    expect(result.diagnostics).toContainEqual({ code: "NORMALIZED_STRUCTURE_MISMATCH", severity: "error", field: "normalized_geometry.file", file_id: staged.built.refs.normalized.file_id });
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(await currentRecord(staged.caseId)).toBeNull();
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it("V6 residual: an unrelated polygon with the same ring structure is not detectable without reprojection (the receipt is an attestation)", async () => {
    const staged = await stageCase({ lot: lotAt(820) });
    expect((await validate(staged.admin, staged.caseId, body(staged.built))).valid).toBe(true);
  });

  it.each([
    ["implementation", (receipt: any) => { receipt.implementation.normalizer_version = "1.0.2"; }],
    ["operation", (receipt: any) => { receipt.operation.accuracy_m = 2; }],
    ["resources", (receipt: any) => { receipt.resources[0].sha256 = "f".repeat(64); }],
  ])("V7 a receipt with an altered %s is NORMALIZATION_NOT_PINNED", async (_name, change) => {
    const staged = await stageCase({ receipt: change });
    expect(errorCodes((await validate(staged.admin, staged.caseId, body(staged.built))).diagnostics)).toEqual(["NORMALIZATION_NOT_PINNED"]);
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
  });

  const FORBIDDEN: Array<[string, (request: any) => void]> = [
    ...([["schema_version", "program-screen-reviewed-lot-v1"], ["review_id", "00000000-0000-4000-8000-000000000301"], ["case_id", "00000000-0000-4000-8000-000000000302"],
      ["review", { reviewed_on: "2026-09-01" }], ["reviewer", { kind: "human", name: "TEST-ONLY forged", role: "forged" }], ["reviewer_user_id", "test-only-forged"],
      ["reviewed_on", "2026-09-01"], ["state", { status: "current", superseded_by: null }], ["reprojection", { profile_id: "x" }], ["as_of", "2026-09-01"],
      ["registries", {}], ["packs", []], ["pins", []], ["authority", {}]] as const).map(([key, value]): [string, (request: any) => void] => [`proposal.${key}`, (request) => { request.proposal[key] = value; }]),
    ["proposal.normalized_geometry.crs", (request) => { request.proposal.normalized_geometry.crs = "EPSG:3310"; }],
    ["proposal.normalized_geometry.serialization", (request) => { request.proposal.normalized_geometry.serialization = "x"; }],
    ...(["case_id", "reviewer", "reviewer_user_id", "as_of", "registries", "authority", "review_id"] as const).map((key): [string, (request: any) => void] => [`body.${key}`, (request) => { request[key] = "test-only"; }]),
  ];
  it.each(FORBIDDEN)("V8 a request carrying %s is rejected, never ignored, before any R2 access", async (_name, inject) => {
    const staged = await stageCase();
    const request: any = body(structuredClone(staged.built.proposal));
    inject(request);
    const { bucket, calls } = proxiedBucket();
    const b = serviceBindings({ EVIDENCE_FILES: bucket });
    const refused = await expectPreparationError(validate(staged.admin, staged.caseId, request, b), "VALIDATION_ERROR");
    expect(JSON.stringify(refused.details)).toMatch(/Unrecognized key/);
    await expectPreparationError(publish(staged.admin, staged.caseId, request, b), "VALIDATION_ERROR");
    expect(calls).toEqual([]);
    expect(await currentRecord(staged.caseId)).toBeNull();
  });

  it("V9 the stored reviewer is the D1 account name (trimmed), the fixed role and the acting administrator's user ID", async () => {
    const admin = await insertUser("admin", "  TEST-ONLY 3K Spaced Administrator  ");
    const prepared = await prepareCase({ admin });
    expect((await currentRecord(prepared.caseId))!.review).toEqual({
      reviewer: { kind: "human", name: "TEST-ONLY 3K Spaced Administrator", role: REVIEWER_ROLE }, reviewer_user_id: admin.id, reviewed_on: AS_OF, next_review_on: "2026-10-30",
    });
    for (const name of ["   ", "x".repeat(301)]) {
      const unnamed = await insertUser("admin", name);
      await expectPreparationError(validate(unnamed, prepared.caseId, body(prepared.built)), "REVIEWER_NAME_UNAVAILABLE");
      await expectPreparationError(publish(unnamed, prepared.caseId, body(prepared.built, prepared.publication.revision)), "REVIEWER_NAME_UNAVAILABLE");
    }
    await expectPreparationError(validate({ id: crypto.randomUUID(), role: "admin" }, prepared.caseId, body(prepared.built)), "REVIEWER_NAME_UNAVAILABLE");
    expect(await auditRows(prepared.caseId)).toHaveLength(1);
  });

  it("V10 TEST-ONLY evidence under a production build is TEST_ONLY_EVIDENCE: no publication and no audit row", async () => {
    const staged = await stageCase();
    expect((await validate(staged.admin, staged.caseId, body(staged.built))).valid).toBe(true);
    vi.stubEnv("MODE", "production");
    vi.stubEnv("PROD", true);
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(result.valid).toBe(false);
    expect(errorCodes(result.diagnostics)).toEqual(["TEST_ONLY_EVIDENCE"]);
    const error = await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(errorCodes((error.details as { diagnostics: preparation.CasePreparationDiagnostic[] }).diagnostics)).toEqual(["TEST_ONLY_EVIDENCE"]);
    expect(await currentRecord(staged.caseId)).toBeNull();
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it.each(["requested_url", "final_url"])("V11 an http: %s is PROVENANCE_URL_NOT_HTTPS", async (field) => {
    const staged = await stageCase({ edit: (proposal) => { proposal.source_provenance[field] = "http://records.example.test/phase-3k/synthetic"; } });
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual(["PROVENANCE_URL_NOT_HTTPS"]);
    expect(result.diagnostics[0]).toEqual({ code: "PROVENANCE_URL_NOT_HTTPS", severity: "error", field: `source_provenance.${field}` });
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
  });

  it("V12 a retrieval or normalization time after the server clock is TIMESTAMP_IN_FUTURE", async () => {
    const retrieved = await stageCase({ edit: (proposal) => { proposal.source_provenance.retrieved_at_utc = "2026-10-01T18:00:01Z"; } });
    expect((await validate(retrieved.admin, retrieved.caseId, body(retrieved.built))).diagnostics).toContainEqual({ code: "TIMESTAMP_IN_FUTURE", severity: "error", field: "source_provenance.retrieved_at_utc" });
    const normalized = await stageCase({ receipt: (receipt) => { receipt.normalized_at_utc = "2026-10-01T18:00:01.000001Z"; } });
    const result = await validate(normalized.admin, normalized.caseId, body(normalized.built));
    expect(result.diagnostics).toContainEqual({ code: "TIMESTAMP_IN_FUTURE", severity: "error", field: "receipt.normalized_at_utc", file_id: normalized.built.refs.receipt.file_id });
    await expectPreparationError(publish(normalized.admin, normalized.caseId, body(normalized.built)), "PREPARATION_INVALID");
    const exact = await stageCase({ receipt: (receipt) => { receipt.normalized_at_utc = "2026-10-01T18:00:00Z"; } });
    expect(codes((await validate(exact.admin, exact.caseId, body(exact.built))).diagnostics)).not.toContain("TIMESTAMP_IN_FUTURE");
  });

  it.each<[string, (built: BuiltProposal) => Promise<void>, string, string]>([
    ["one file ID naming two digests", async (built) => { built.proposal.legal_identity_evidence = [{ ...built.refs.legal[0], file_id: built.refs.source.file_id }]; }, "FILE_REF_CONFLICT", "source_geometry.file"],
    ["one digest under two file IDs", async (built) => { built.proposal.source_provenance.evidence_files[0] = { ...built.refs.source, file_id: "test-only-3k-source-alias" }; }, "FILE_REF_CONFLICT", "source_provenance.evidence_files.0"],
    ["a repeated legal-identity reference", async (built) => { built.proposal.legal_identity_evidence = [built.refs.legal[0], built.refs.legal[0]]; }, "DUPLICATE_FILE_REF", "legal_identity_evidence"],
    ["a repeated provenance reference", async (built) => { built.proposal.source_provenance.evidence_files = [built.refs.source, built.refs.source]; }, "DUPLICATE_FILE_REF", "source_provenance.evidence_files"],
  ])("V13 %s is refused", async (_name, change, code, field) => {
    const staged = await stageCase();
    await change(staged.built);
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual([code]);
    expect(result.diagnostics[0].field).toBe(field);
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it("V14 next_review_on must fall after the server date and within 30 calendar days", async () => {
    const staged = await stageCase();
    for (const next of ["2026-11-01", "2026-10-01", "2026-09-30"]) {
      const request = body({ ...staged.built.proposal, next_review_on: next });
      const result = await validate(staged.admin, staged.caseId, request);
      expect(errorCodes(result.diagnostics), next).toEqual(["REVIEW_TERM_OUT_OF_RANGE"]);
      await expectPreparationError(publish(staged.admin, staged.caseId, request), "PREPARATION_INVALID");
    }
    expect((await validate(staged.admin, staged.caseId, body({ ...staged.built.proposal, next_review_on: "2026-10-01" }))).review).toBeNull();
    expect(await currentRecord(staged.caseId)).toBeNull();
    const accepted = await publish(staged.admin, staged.caseId, body({ ...staged.built.proposal, next_review_on: "2026-10-31" }));
    expect(accepted).toMatchObject({ reviewed_on: "2026-10-01", next_review_on: "2026-10-31" });
    expect(await auditRows(staged.caseId)).toHaveLength(1);
  });
});

describe("Phase 3K A: every lower-level verifier refusal maps to a pinned code", () => {
  const sourceWith = (change: (source: any) => void) => {
    const source = JSON.parse(sraSourceText);
    change(source);
    return `${JSON.stringify(source, null, 2)}\n`;
  };
  it.each<[string, CaseSpec]>([
    ["SOURCE_GEOMETRY_UNSUPPORTED", { sourceText: sourceWith((source) => { source.features[0].geometry.hasZ = true; }) }],
    ["SOURCE_CRS_UNSUPPORTED", { sourceText: sourceWith((source) => { source.spatialReference = { wkid: 2229 }; }) }],
    ["SOURCE_CRS_MISMATCH", { edit: (proposal) => { proposal.source_geometry.crs = { wkid: 3857, latest_wkid: 3857, epsg: 3857 }; } }],
    ["SOURCE_IDENTIFIERS_MISMATCH", { edit: (proposal) => { proposal.parcel.apn = "0000000002"; } }],
    ["RECEIPT_TEST_ONLY_MISMATCH", { receipt: (receipt) => { receipt.test_only = false; } }],
    ["CHRONOLOGY_INCONSISTENT", { edit: (proposal) => { proposal.source_provenance.retrieved_at_utc = "2026-09-30T12:00:00Z"; } }],
    ["NORMALIZED_GEOMETRY_INVALID", { lot: lotFromRings([[[220, 20], [280, 80], [280, 20], [220, 80], [220, 20]]]) }],
    ["NORMALIZED_GEOMETRY_INVALID", { lot: lotFromRings([ring(220, 20, 280, 80)], "EPSG:3857") }],
    ["CAPTURED_FILE_MALFORMED", { metadataText: '{"TEST_ONLY":true,"extent":{"spatialReference":{"wkid":102100,"latestWkid":3857}}}\n' }],
    ["CAPTURED_FILE_NOT_JSON", { metadataText: "TEST-ONLY metadata that is not JSON\n" }],
  ])("%s", async (code, spec) => {
    const staged = await stageCase(spec);
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual([code]);
    expect(result.diagnostics.find((entry) => entry.code === code)).toEqual({ code, severity: "error" });
  });

  it("CAPTURED_FILE_NOT_JSON for bytes that are not UTF-8", async () => {
    const staged = await stageCase();
    const bad = Uint8Array.from([0x7b, 0xff, 0xfe, 0x7d]);
    const ref = await fileRef("test-only-3k-metadata-not-utf8", bad);
    await svc.storeCasePreparationBlob(serviceBindings(), staged.admin, staged.caseId, ref.sha256, bad);
    staged.built.proposal.source_geometry.metadata_file = ref;
    staged.built.proposal.source_provenance.evidence_files[1] = ref;
    expect(errorCodes((await validate(staged.admin, staged.caseId, body(staged.built))).diagnostics)).toEqual(["CAPTURED_FILE_NOT_JSON"]);
  });

  it("FILE_MISSING, FILE_HASH_MISMATCH and REVIEWED_LOT_VERIFICATION_FAILED from the verifier, reported by status after storage changes", async () => {
    const prepared = await prepareCase();
    const legal = prepared.built.refs.legal[0];
    const key = `${prepared.caseId}/program-screen/blobs/${legal.sha256}`;
    await env.EVIDENCE_FILES.put(key, utf8("%PDF-1.7\n% TEST-ONLY replaced bytes\n"));
    expect((await status(prepared.admin, prepared.caseId)).current_review).toMatchObject({ verified: false, diagnostics: [{ code: "FILE_HASH_MISMATCH", severity: "error", file_id: legal.file_id }] });
    await env.EVIDENCE_FILES.put(key, new Uint8Array(8 * 1024 * 1024 + 1));
    expect((await status(prepared.admin, prepared.caseId)).current_review).toMatchObject({
      verified: false, diagnostics: [{ code: "REVIEWED_LOT_VERIFICATION_FAILED", severity: "error", detail: "Case evidence file exceeds its bound." }],
    });
    await env.EVIDENCE_FILES.delete(key);
    const missing = await status(prepared.admin, prepared.caseId);
    expect(missing.current_review).toMatchObject({ verified: false, diagnostics: [{ code: "FILE_MISSING", severity: "error", file_id: legal.file_id }] });
    expect(missing.readiness).toBe("review_unverified");
  });
});

describe("Phase 3K A: CAL FIRE hydration (D1-D12)", () => {
  it("D1 each pinned synthetic index is stored for the route the registries name, idempotently", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const world = await useWorld();
    for (const route of ROUTES) {
      const expected = { route, authority_source_id: ROUTE_SOURCES[route], index_sha256: world[route].pin.index_sha256 };
      expect(await svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, world[route].pin.index_sha256, utf8(world[route].index_text))).toEqual(expected);
      expect(await svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, world[route].pin.index_sha256, utf8(world[route].index_text))).toEqual(expected);
      expect(await (await env.EVIDENCE_FILES.get(`${caseId}/program-screen/calfire/index-${world[route].pin.index_sha256}.txt`))!.text()).toBe(world[route].index_text);
    }
    expect(await currentRecord(caseId)).toBeNull();
  });

  it("D1 the shipped LRA and SRA indexes are stored under their registered routes", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    for (const route of ROUTES) {
      const native = nativeDataset(route);
      const sha = await sha256Hex(native.index_text);
      expect(SHIPPED_PINS.some((pin) => pin.index_sha256 === sha)).toBe(true);
      expect(await svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, sha, utf8(native.index_text))).toEqual({ route, authority_source_id: ROUTE_SOURCES[route], index_sha256: sha });
    }
  });

  it("D2 an unpinned index is refused with no write; pinned bytes that are not a usable CAL FIRE index are CALFIRE_INDEX_INVALID with no write", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    await useWorld();
    const unpinned = (await lraIndex(LRA_WORLD.slice(0, 3))).index_text;
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(svc.hydrateCalFireIndex(serviceBindings({ EVIDENCE_FILES: bucket }), admin, caseId, await sha256Hex(unpinned), utf8(unpinned)), "UNPINNED_INDEX");
    expect(calls).toEqual([]);
    observed.pins = [];
    for (const bytes of [utf8("TEST-ONLY not an overlay index\n"), Uint8Array.from([0xff, 0xfe, 0x00]), utf8((await lraIndex(LRA_WORLD, "TEST_ONLY_WRONG_LAYER")).index_text)]) {
      const pin = { dataset: lraPack.members.overlay_dataset, index_sha256: await bytesSha256(bytes) };
      observed.pins = [pin];
      registerPin(pin);
      await expectPreparationError(svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, pin.index_sha256, bytes), "CALFIRE_INDEX_INVALID");
      expect(await env.EVIDENCE_FILES.head(`${caseId}/program-screen/calfire/index-${pin.index_sha256}.txt`)).toBeNull();
    }
    expect((await env.EVIDENCE_FILES.list({ prefix: `${caseId}/` })).objects).toEqual([]);
  });

  it("D3 a BOM-prefixed copy of a pinned index is DIGEST_MISMATCH: raw bytes are hashed before decoding", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const world = await useWorld();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(world.gov_51178.index_text)]);
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(svc.hydrateCalFireIndex(serviceBindings({ EVIDENCE_FILES: bucket }), admin, caseId, world.gov_51178.pin.index_sha256, bom), "DIGEST_MISMATCH");
    expect(calls).toEqual([]);
    expect(await svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, world.gov_51178.pin.index_sha256, utf8(world.gov_51178.index_text))).toMatchObject({ route: "gov_51178" });
  });

  it("D4 the LRA pin path with the SRA index body is DIGEST_MISMATCH", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const world = await useWorld();
    await expectPreparationError(svc.hydrateCalFireIndex(serviceBindings(), admin, caseId, world.gov_51178.pin.index_sha256, utf8(world.prc_4202.index_text)), "DIGEST_MISMATCH");
    expect((await env.EVIDENCE_FILES.list({ prefix: `${caseId}/` })).objects).toEqual([]);
  });

  it("D5 a record before any pinned index is CALFIRE_INDEX_REQUIRED", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const content = (await useWorld()).prc_4202.records[0].content;
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings(), admin, caseId, await bytesSha256(content), content), "CALFIRE_INDEX_REQUIRED");
    expect((await env.EVIDENCE_FILES.list({ prefix: `${caseId}/` })).objects).toEqual([]);
  });

  it("D6 a record listed in no stored pinned index is refused; a listed record that cannot be parsed is CALFIRE_RECORD_INVALID; nothing is stored", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const world = await useWorld();
    await hydrate(admin, caseId, { index_text: world.prc_4202.index_text, records: [] });
    const stray = polygonRecordContent(ring(5000, 0, 5100, 100) as Array<[number, number]>);
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings(), admin, caseId, await bytesSha256(stray), stray), "RECORD_NOT_IN_PINNED_INDEX");
    expect(await env.EVIDENCE_FILES.head(`${caseId}/program-screen/calfire/record-${await bytesSha256(stray)}.bin`)).toBeNull();
    // A TEST-ONLY pinned index whose record 1 lists the digest of unparseable bytes.
    const garbage = Uint8Array.from([5, 0, 0, 0, 1, 2, 3]);
    const original = parseOverlayIndex(world.prc_4202.index_text).entries[0];
    const tampered = world.prc_4202.index_text.replace(`${original.content_bytes} ${original.content_sha256}`, `${garbage.length} ${await bytesSha256(garbage)}`);
    expect(parseOverlayIndex(tampered).entries[0].content_sha256).toBe(await bytesSha256(garbage));
    const pin = { dataset: sraPack.members.overlay_dataset, index_sha256: await sha256Hex(tampered) };
    observed.pins = [pin];
    registerPin(pin);
    const other = await insertCase();
    await svc.hydrateCalFireIndex(serviceBindings(), admin, other, pin.index_sha256, utf8(tampered));
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings(), admin, other, await bytesSha256(garbage), garbage), "CALFIRE_RECORD_INVALID");
    expect(await env.EVIDENCE_FILES.head(`${other}/program-screen/calfire/record-${await bytesSha256(garbage)}.bin`)).toBeNull();
  });

  it("D7 an altered record is DIGEST_MISMATCH at its original digest and RECORD_NOT_IN_PINNED_INDEX at its own", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    const world = await useWorld();
    await hydrate(admin, caseId, { index_text: world.prc_4202.index_text, records: [] });
    const original = world.prc_4202.records[0].content;
    const altered = original.slice();
    altered[altered.length - 1] ^= 1;
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings(), admin, caseId, await bytesSha256(original), altered), "DIGEST_MISMATCH");
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings(), admin, caseId, await bytesSha256(altered), altered), "RECORD_NOT_IN_PINNED_INDEX");
    const stored = await env.EVIDENCE_FILES.list({ prefix: `${caseId}/program-screen/calfire/record-` });
    expect(stored.objects).toEqual([]);
    expect(await svc.hydrateCalFireRecord(serviceBindings(), admin, caseId, await bytesSha256(original), original)).toEqual({
      content_sha256: await bytesSha256(original), content_bytes: original.length, matches: [{ route: "prc_4202", record_number: 1 }],
    });
  });

  it("D8 a missing required candidate is a warning; publication proceeds and the evaluator keeps that route unknown", async () => {
    const staged = await stageCase({ lot: lotAt(220), omit: { gov_51178: [2] } });
    const validation = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(validation.valid).toBe(true);
    expect(validation.diagnostics).toContainEqual({ code: "CALFIRE_RECORDS_MISSING", severity: "warning", route: "gov_51178", record_numbers: [2] });
    const publication = await publish(staged.admin, staged.caseId, body(staged.built));
    expect(publication.diagnostics).toContainEqual({ code: "CALFIRE_RECORDS_MISSING", severity: "warning", route: "gov_51178", record_numbers: [2] });
    expect((await status(staged.admin, staged.caseId)).readiness).toBe("calfire_incomplete");
    const result = await evaluate(staged.admin, staged.caseId);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([null, false]);
    expect(cdStatuses(result.screen)).toEqual(["unknown", "consistent_with_source"]);
    const missing = (await useWorld()).gov_51178.records[1];
    await svc.hydrateCalFireRecord(serviceBindings(), staged.admin, staged.caseId, await bytesSha256(missing.content), missing.content);
    expect((await status(staged.admin, staged.caseId)).readiness).toBe("ready");
  });

  it("D9 invalid records the lot cannot touch are not required and the route is still computed", async () => {
    const prepared = await prepareCase({ lot: lotAt(220) });
    const current = await status(prepared.admin, prepared.caseId);
    expect(routeStatus(current.hazard_routes, "gov_51178").required_records!.map((entry) => entry.record_number)).not.toContain(6);
    expect(routeStatus(current.hazard_routes, "prc_4202").required_records!.map((entry) => entry.record_number)).not.toContain(10);
    expect(codes(prepared.publication.diagnostics)).not.toContain("CALFIRE_CANDIDATE_INVALID");
    const result = await evaluate(prepared.admin, prepared.caseId);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([false, false]);
    expect(cdStatuses(result.screen)).toEqual(["consistent_with_source", "consistent_with_source"]);
  });

  it("D10 a relevant invalid candidate is CALFIRE_CANDIDATE_INVALID and that route's value stays unknown", async () => {
    const prepared = await prepareCase({ lot: lotAt(1820) });
    expect(prepared.publication.diagnostics).toContainEqual({ code: "CALFIRE_CANDIDATE_INVALID", severity: "info", route: "prc_4202", record_numbers: [10] });
    expect(routeStatus((await status(prepared.admin, prepared.caseId)).hazard_routes, "prc_4202").required_records).toEqual([
      expect.objectContaining({ record_number: 10, geometry_state: "invalid", present: true }),
    ]);
    const result = await evaluate(prepared.admin, prepared.caseId);
    expect([vhValue("gov_51178"), vhValue("prc_4202")]).toEqual([false, null]);
    expect(criterion(result.screen, C).status).toBe("unknown");
  });

  it("D11 a missing index for one route is a warning and leaves the other route computed", async () => {
    const prepared = await prepareCase({ lot: lotAt(220), routes: { gov_51178: "none" } });
    expect(prepared.publication.diagnostics).toContainEqual({ code: "CALFIRE_INDEX_MISSING", severity: "warning", route: "gov_51178" });
    const current = await status(prepared.admin, prepared.caseId);
    expect(routeStatus(current.hazard_routes, "gov_51178")).toMatchObject({ index: "missing", required_records: null });
    expect(routeStatus(current.hazard_routes, "prc_4202").index).toBe("present");
    const result = await evaluate(prepared.admin, prepared.caseId);
    expect([result.route_overlays.gov_51178.inputs, result.route_overlays.prc_4202.inputs === undefined]).toEqual([undefined, false]);
    expect(cdStatuses(result.screen)).toEqual(["unknown", "consistent_with_source"]);
  });

  it("D12 a record over 16 MiB is refused before hashing or storage", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    await useWorld();
    const over = new Uint8Array(16 * 1024 * 1024 + 1);
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(svc.hydrateCalFireRecord(serviceBindings({ EVIDENCE_FILES: bucket }), admin, caseId, "a".repeat(64), over), "PAYLOAD_TOO_LARGE");
    expect(calls).toEqual([]);
  });
});

describe("Phase 3K A: concurrency and audit (C1-C10)", () => {
  it("C1 a stale expected revision is REVISION_CHANGED; the current review and audit log are unchanged", async () => {
    const prepared = await prepareCase();
    const second = await publish(prepared.admin, prepared.caseId, body(await buildProposal({ nextReviewOn: "2026-10-29" }), prepared.publication.revision));
    await expectPreparationError(publish(prepared.admin, prepared.caseId, body(await buildProposal({ nextReviewOn: "2026-10-28" }), prepared.publication.revision)), "REVISION_CHANGED");
    expect((await currentRecord(prepared.caseId))!.review_id).toBe(second.review_id);
    expect(await auditRows(prepared.caseId)).toHaveLength(2);
  });

  it("C2 when a second administrator publishes first, the first administrator's initial publication is REVISION_CHANGED", async () => {
    const staged = await stageCase();
    const other = await insertUser("admin", "TEST-ONLY 3K Second Administrator");
    const theirs = await publish(other, staged.caseId, body(staged.built));
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "REVISION_CHANGED");
    expect((await currentRecord(staged.caseId))!.review).toMatchObject({ reviewer_user_id: other.id, reviewer: { name: "TEST-ONLY 3K Second Administrator" } });
    expect((await auditRows(staged.caseId)).map((row) => [row.actor_user_id, row.review_id, row.outcome])).toEqual([[other.id, theirs.review_id, "committed"]]);
  });

  it("C3 an identical retry after a committed publication replays it: same review and revision, one audit row", async () => {
    const prepared = await prepareCase();
    const retry = await publish(prepared.admin, prepared.caseId, body(prepared.built));
    expect(retry).toEqual({ ...prepared.publication, replayed: true, diagnostics: [] });
    expect(await auditRows(prepared.caseId)).toHaveLength(1);
    const other = await insertUser("admin");
    await expectPreparationError(publish(other, prepared.caseId, body(prepared.built)), "REVISION_CHANGED");
    await svc.invalidateCurrentReview(serviceBindings(), prepared.admin, prepared.caseId, { expected_revision: prepared.publication.revision, reason: "other" }, now(), REQUEST_ID);
    await expectPreparationError(publish(prepared.admin, prepared.caseId, body(prepared.built)), "REVISION_CHANGED");
  });

  it("C4 a null expected revision when a review exists is REVISION_CHANGED", async () => {
    const prepared = await prepareCase();
    await expectPreparationError(publish(prepared.admin, prepared.caseId, body(await buildProposal({ nextReviewOn: "2026-10-29" }))), "REVISION_CHANGED");
    expect((await currentRecord(prepared.caseId))!.review_id).toBe(prepared.publication.review_id);
    expect(await auditRows(prepared.caseId)).toHaveLength(1);
  });

  it("C5 staged uploads and validation without publication leave the case unprepared", async () => {
    const staged = await stageCase();
    expect((await validate(staged.admin, staged.caseId, body(staged.built))).valid).toBe(true);
    const current = await status(staged.admin, staged.caseId);
    expect(current).toMatchObject({ integrity: "ok", current_review: null, readiness: "no_review" });
    expect(current.hazard_routes.map((route) => [route.index, route.required_records])).toEqual([["present", null], ["present", null]]);
    expect(await currentRecord(staged.caseId)).toBeNull();
    expect(await auditRows(staged.caseId)).toEqual([]);
    const result = await evaluate(staged.admin, staged.caseId);
    expect(result.reviewed_lot).toBeNull();
    expect(cdStatuses(result.screen)).toEqual(["unknown", "unknown"]);
  });

  it("C6 a truncated body does not match its digest and nothing is stored", async () => {
    const admin = await insertUser("admin"), caseId = await insertCase();
    await hydrate(admin, caseId, { index_text: (await useWorld()).prc_4202.index_text, records: [] });
    const record = (await useWorld()).prc_4202.records[0].content;
    for (const [service, full] of [[svc.storeCasePreparationBlob, PDF], [svc.hydrateCalFireRecord, record]] as const) {
      await expectPreparationError(service(serviceBindings(), admin, caseId, await bytesSha256(full), full.slice(0, -1)), "DIGEST_MISMATCH");
    }
    expect(await env.EVIDENCE_FILES.head(`${caseId}/program-screen/blobs/${await bytesSha256(PDF)}`)).toBeNull();
    expect(await env.EVIDENCE_FILES.head(`${caseId}/program-screen/calfire/record-${await bytesSha256(record)}.bin`)).toBeNull();
  });

  it("C7 invalidation is CAS-guarded and audited; afterwards the evaluator sees no reviewed lot", async () => {
    const prepared = await prepareCase();
    const invalidate = (request: unknown, actor = prepared.admin) => svc.invalidateCurrentReview(serviceBindings(), actor, prepared.caseId, request, now(), REQUEST_ID);
    await expectPreparationError(invalidate({ expected_revision: "test-only-stale-revision", reason: "geometry_error" }), "REVISION_CHANGED");
    for (const request of [{ expected_revision: prepared.publication.revision, reason: "superseded" }, { expected_revision: prepared.publication.revision },
      { expected_revision: null, reason: "other" }, { expected_revision: prepared.publication.revision, reason: "other", superseded_by: crypto.randomUUID() }]) {
      await expectPreparationError(invalidate(request), "VALIDATION_ERROR");
    }
    expect(await auditRows(prepared.caseId)).toHaveLength(1);
    const result = await invalidate({ expected_revision: prepared.publication.revision, reason: "geometry_error" });
    expect(Object.keys(result)).toEqual(["schema_version", "case_id", "review_id", "state", "prior_revision", "revision"]);
    const head = await env.EVIDENCE_FILES.head(`${prepared.caseId}/program-screen/current-review.json`);
    expect(result).toEqual({ schema_version: "program-screen-case-invalidation-v1", case_id: prepared.caseId, review_id: prepared.publication.review_id, state: "stale", prior_revision: prepared.publication.revision, revision: head!.etag });
    const stored = await currentRecord(prepared.caseId);
    expect(stored!.state).toEqual({ status: "stale", superseded_by: null });
    const rows = await auditRows(prepared.caseId);
    expect(rows[1]).toMatchObject({
      action: "invalidate", actor_user_id: prepared.admin.id, reason: "geometry_error", review_id: prepared.publication.review_id, prior_revision: prepared.publication.revision,
      new_revision: result.revision, outcome: "committed", new_manifest_sha256: await bytesSha256(utf8(`${JSON.stringify(stored)}\n`)),
    });
    expect(await env.EVIDENCE_FILES.head(`${prepared.caseId}/program-screen/reviews/${prepared.publication.review_id}-${rows[1].new_manifest_sha256}.json`)).not.toBeNull();
    expect((await status(prepared.admin, prepared.caseId)).current_review).toMatchObject({ state: "stale", verified: false, diagnostics: [{ code: "REVIEW_NOT_CURRENT_ON_DATE", severity: "error" }] });
    expect((await evaluate(prepared.admin, prepared.caseId)).reviewed_lot).toBeNull();
    await expectPreparationError(invalidate({ expected_revision: result.revision, reason: "other" }), "REVIEW_NOT_CURRENT");
    await expectPreparationError(svc.invalidateCurrentReview(serviceBindings(), prepared.admin, await insertCase(), { expected_revision: "x", reason: "other" }, now(), REQUEST_ID), "NO_CURRENT_REVIEW");
  });

  it("C8 a publication that loses the R2 CAS race is REVISION_CHANGED with a conflict audit outcome; the winner stays current", async () => {
    const staged = await stageCase();
    const rival = await insertUser("admin", "TEST-ONLY 3K Rival Administrator");
    const mine = (await validate(staged.admin, staged.caseId, body(staged.built))).review!;
    let theirs: preparation.CasePreparationPublication | undefined;
    const { bucket } = proxiedBucket(async (method, key) => {
      if (theirs === undefined && method === "put" && key.endsWith("/current-review.json")) theirs = await publish(rival, staged.caseId, body(staged.built));
    });
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built), serviceBindings({ EVIDENCE_FILES: bucket })), "REVISION_CHANGED");
    expect(theirs).toBeDefined();
    expect((await currentRecord(staged.caseId))!.review_id).toBe(theirs!.review_id);
    expect((await env.EVIDENCE_FILES.head(`${staged.caseId}/program-screen/current-review.json`))!.etag).toBe(theirs!.revision);
    expect(await env.EVIDENCE_FILES.head(`${staged.caseId}/program-screen/reviews/${mine.review_id}-${mine.manifest_sha256}.json`)).not.toBeNull();
    const rows = await auditRows(staged.caseId);
    expect(rows.map((row) => [row.actor_user_id, row.review_id, row.outcome, row.new_revision])).toEqual([
      [staged.admin.id, mine.review_id, "conflict", null],
      [rival.id, theirs!.review_id, "committed", theirs!.revision],
    ]);
  });

  it("C9 when the audit intent cannot be written, nothing is published", async () => {
    const staged = await stageCase();
    const { db } = proxiedDb((sql) => (sql.includes("INSERT INTO program_screen_review_events") ? failingStatement("TEST-ONLY audit insert failure") : undefined));
    const { bucket, calls } = proxiedBucket();
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built), serviceBindings({ DB: db, EVIDENCE_FILES: bucket })), "AUDIT_UNAVAILABLE");
    expect(bucketWrites(calls)).toEqual([]);
    expect(await currentRecord(staged.caseId)).toBeNull();
    expect(await auditRows(staged.caseId)).toEqual([]);
    const publication = await publish(staged.admin, staged.caseId, body(staged.built));
    const writes = proxiedBucket();
    await expectPreparationError(svc.invalidateCurrentReview(serviceBindings({ DB: db, EVIDENCE_FILES: writes.bucket }), staged.admin, staged.caseId,
      { expected_revision: publication.revision, reason: "other" }, now(), REQUEST_ID), "AUDIT_UNAVAILABLE");
    expect(bucketWrites(writes.calls)).toEqual([]);
    expect((await currentRecord(staged.caseId))!.state.status).toBe("current");
  });

  it("C9 a lost audit completion after a committed R2 publication still returns the publication; the pending row names the current manifest", async () => {
    const staged = await stageCase();
    const { db } = proxiedDb((sql) => (sql.includes("UPDATE program_screen_review_events") ? failingStatement("TEST-ONLY audit completion failure") : undefined));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const publication = await publish(staged.admin, staged.caseId, body(staged.built), serviceBindings({ DB: db }));
    expect(errors).toHaveBeenCalledWith("Program Screen review publication committed; its audit completion was not recorded.", expect.objectContaining({ event_id: expect.any(String) }));
    errors.mockRestore();
    expect((await env.EVIDENCE_FILES.head(`${staged.caseId}/program-screen/current-review.json`))!.etag).toBe(publication.revision);
    const [row] = await auditRows(staged.caseId);
    expect(row).toMatchObject({ outcome: "pending", new_revision: null, completed_at: null, new_manifest_sha256: publication.manifest_sha256 });
    const currentBytes = new Uint8Array(await (await env.EVIDENCE_FILES.get(`${staged.caseId}/program-screen/current-review.json`))!.arrayBuffer());
    expect(await bytesSha256(currentBytes)).toBe(row.new_manifest_sha256);
  });

  it("an unreadable or foreign current manifest is an integrity refusal, never published over and never shown", async () => {
    const a = await prepareCase();
    const b = await prepareCase({ admin: a.admin });
    const key = `${b.caseId}/program-screen/current-review.json`;
    const tamper = async (bytes: Uint8Array, contentSha256: string) => env.EVIDENCE_FILES.put(key, bytes, { customMetadata: { contentSha256 } });
    const foreign = new Uint8Array(await (await env.EVIDENCE_FILES.get(`${a.caseId}/program-screen/current-review.json`))!.arrayBuffer());
    for (const [bytes, digest] of [[foreign, "0".repeat(64)], [foreign, await bytesSha256(foreign)]] as const) {
      await tamper(bytes, digest);
      const revision = (await env.EVIDENCE_FILES.head(key))!.etag;
      const current = await status(b.admin, b.caseId);
      expect(current).toMatchObject({ integrity: "current_review_unreadable", current_review: null, readiness: "review_unverified" });
      expect(JSON.stringify(current)).not.toContain(a.publication.review_id);
      if (digest === "0".repeat(64)) {
        const validation = await validate(b.admin, b.caseId, body(b.built, revision));
        expect(validation).toMatchObject({ valid: false, expected_revision_current: false });
        expect(validation.diagnostics[0]).toEqual({ code: "CURRENT_REVIEW_UNREADABLE", severity: "error" });
        await expectPreparationError(publish(b.admin, b.caseId, body(b.built, revision)), "CURRENT_REVIEW_UNREADABLE");
      }
      await expectPreparationError(svc.invalidateCurrentReview(serviceBindings(), b.admin, b.caseId, { expected_revision: revision, reason: "other" }, now(), REQUEST_ID), "CURRENT_REVIEW_UNREADABLE");
      expect((await env.EVIDENCE_FILES.head(key))!.etag).toBe(revision);
    }
    expect(await auditRows(b.caseId)).toHaveLength(1);
  });

  it("C10 a publication during an in-flight evaluation yields no mixed-revision conclusion", async () => {
    const prepared = await prepareCase({ lot: lotAt(20) });
    let replaced = false;
    const { bucket } = proxiedBucket(async (method, key) => {
      if (!replaced && method === "get" && key.includes("/calfire/record-")) {
        replaced = true;
        await publish(prepared.admin, prepared.caseId, body(await buildProposal({ lot: lotAt(20), nextReviewOn: "2026-10-29" }), prepared.publication.revision));
      }
    });
    const result = await evaluate(prepared.admin, prepared.caseId, serviceBindings({ EVIDENCE_FILES: bucket }));
    expect(replaced).toBe(true);
    expect(result.reviewed_lot).toBeNull();
    expect([result.route_overlays.gov_51178.inputs, result.route_overlays.prc_4202.inputs]).toEqual([undefined, undefined]);
    expect(cdStatuses(result.screen)).toEqual(["unknown", "unknown"]);
  });
});

describe("Phase 3K A: legal-lot identity is a human decision (L1-L8)", () => {
  it("L1 an established identity with PDF evidence publishes and c/d are computed", async () => {
    const prepared = await prepareCase({ lot: lotAt(220) });
    const result = await evaluate(prepared.admin, prepared.caseId);
    expect(result.reviewed_lot).toMatchObject({ review_id: prepared.publication.review_id, legal_lot_identity: "parcel_is_one_legal_lot" });
    expect(cdStatuses(result.screen)).toEqual(["consistent_with_source", "consistent_with_source"]);
    const whole = await prepareCase({ lot: lotAt(20) });
    expect(criterion((await evaluate(whole.admin, whole.caseId)).screen, C).status).toBe("disqualifying_per_source");
  });

  it("L2 not_established with no legal evidence publishes; the identity is preserved and c/d stay unknown", async () => {
    const prepared = await prepareCase({ lot: lotAt(20), identity: "not_established" });
    expect(prepared.publication.diagnostics).toContainEqual({ code: "LEGAL_IDENTITY_NOT_ESTABLISHED", severity: "info", field: "legal_lot_identity" });
    expect((await currentRecord(prepared.caseId))!.legal_identity_evidence).toEqual([]);
    const result = await evaluate(prepared.admin, prepared.caseId);
    expect(result.reviewed_lot!.legal_lot_identity).toBe("not_established");
    expect(cdStatuses(result.screen)).toEqual(["unknown", "unknown"]);
  });

  it.each(["source", "metadata", "normalized", "receipt"] as const)("L3 the %s file reused as legal-identity evidence is refused", async (input) => {
    const staged = await stageCase();
    staged.built.proposal.legal_identity_evidence = [staged.built.refs[input]];
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(result.diagnostics).toContainEqual({ code: "LEGAL_EVIDENCE_OVERLAPS_GEOMETRY_INPUTS", severity: "error", field: "legal_identity_evidence.0", file_id: staged.built.refs[input].file_id, sha256: staged.built.refs[input].sha256 });
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(await currentRecord(staged.caseId)).toBeNull();
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it.each([
    ["plain text", utf8("TEST-ONLY a typed note that the parcel is one lot\n")],
    ["JSON", utf8('{"TEST_ONLY":true,"legal_lot":"one"}\n')],
    ["a PDF signature after a leading byte", utf8(" %PDF-1.7\n")],
  ])("L4 %s legal-identity evidence is LEGAL_EVIDENCE_TYPE_UNSUPPORTED", async (_name, bytes) => {
    const staged = await stageCase({ legal: [bytes] });
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual(["LEGAL_EVIDENCE_TYPE_UNSUPPORTED"]);
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
  });

  it("L4 PDF, both TIFF byte orders, PNG and JPEG legal-identity evidence are accepted", async () => {
    const media = [PDF, Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 1]), Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a, 2]),
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 3]), Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 4])];
    const prepared = await prepareCase({ legal: media });
    expect(errorCodes(prepared.publication.diagnostics)).toEqual([]);
    expect((await currentRecord(prepared.caseId))!.legal_identity_evidence).toHaveLength(5);
  });

  it("L5 an established identity without legal evidence is refused", async () => {
    const staged = await stageCase({ legal: [] });
    const result = await validate(staged.admin, staged.caseId, body(staged.built));
    expect(errorCodes(result.diagnostics)).toEqual(["LEGAL_IDENTITY_EVIDENCE_REQUIRED"]);
    expect(result.review).toBeNull();
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "PREPARATION_INVALID");
    expect(await auditRows(staged.caseId)).toEqual([]);
  });

  it("L6 an omitted legal_lot_identity is a request-shape error, never a default", async () => {
    const staged = await stageCase();
    delete staged.built.proposal.legal_lot_identity;
    await expectPreparationError(validate(staged.admin, staged.caseId, body(staged.built)), "VALIDATION_ERROR");
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "VALIDATION_ERROR");
    expect(await currentRecord(staged.caseId)).toBeNull();
  });

  it("L7 a tract or lot absent from the source attributes is only a warning; the human reference is stored unchanged", async () => {
    const prepared = await prepareCase();
    const warnings = prepared.publication.diagnostics.filter((entry) => entry.code === "LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES");
    expect(warnings).toEqual([
      { code: "LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES", severity: "warning", field: "legal_lot_reference.tract" },
      { code: "LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES", severity: "warning", field: "legal_lot_reference.lot" },
    ]);
    expect((await currentRecord(prepared.caseId))!.legal_lot_reference).toEqual(prepared.built.proposal.legal_lot_reference);
    const reference = prepared.built.proposal.legal_lot_reference;
    const matching = await stageCase({ sourceText: syntheticSource([ring(220, 20, 280, 80)], { APN: "0000000001", PIN: "TEST-ONLY-PIN-3F", TR: reference.tract, LOT: reference.lot }) });
    expect(codes((await validate(matching.admin, matching.caseId, body(matching.built))).diagnostics)).not.toContain("LEGAL_REFERENCE_NOT_IN_SOURCE_ATTRIBUTES");
  });

  it.each(["parcel_and_legal_lot_differ", "tied_or_multiple_lots", "merger_or_resubdivision_pending_or_proposed", "not_established"] as LegalLotIdentity[])(
    "L8 %s publishes safely and c/d stay unknown", async (identity) => {
      const prepared = await prepareCase({ lot: lotAt(20), identity });
      const result = await evaluate(prepared.admin, prepared.caseId);
      expect(result.reviewed_lot!.legal_lot_identity).toBe(identity);
      expect(cdStatuses(result.screen)).toEqual(["unknown", "unknown"]);
    });
});

describe("Phase 3K A: case isolation and request safety (S1-S9)", () => {
  it("S1 a blob staged only in case A is FILE_MISSING for case B", async () => {
    const a = await stageCase();
    expect((await validate(a.admin, a.caseId, body(a.built))).valid).toBe(true);
    const caseB = await insertCase();
    await stage(a.admin, caseB, a.built, [a.built.refs.legal[0].sha256]);
    await hydrate(a.admin, caseB, (await useWorld()).gov_51178);
    const result = await validate(a.admin, caseB, body(a.built));
    expect(result.diagnostics).toContainEqual({ code: "FILE_MISSING", severity: "error", field: "legal_identity_evidence.0", file_id: a.built.refs.legal[0].file_id, sha256: a.built.refs.legal[0].sha256 });
    await expectPreparationError(publish(a.admin, caseB, body(a.built)), "PREPARATION_INVALID");
    expect(await currentRecord(caseB)).toBeNull();
  });

  it("S2 case B cannot use case A's normalized file until the same bytes are uploaded into B; the audit then attributes B", async () => {
    const a = await prepareCase();
    const caseB = await insertCase();
    await stage(a.admin, caseB, a.built, [a.built.refs.normalized.sha256]);
    expect((await validate(a.admin, caseB, body(a.built))).diagnostics).toContainEqual(expect.objectContaining({ code: "FILE_MISSING", file_id: a.built.refs.normalized.file_id }));
    await svc.storeCasePreparationBlob(serviceBindings(), a.admin, caseB, a.built.refs.normalized.sha256, a.built.files.get(a.built.refs.normalized.sha256)!);
    const publication = await publish(a.admin, caseB, body(a.built));
    expect(publication.case_id).toBe(caseB);
    expect(publication.review_id).not.toBe(a.publication.review_id);
    expect((await auditRows(caseB)).map((row) => [row.case_id, row.review_id])).toEqual([[caseB, publication.review_id]]);
    expect(await auditRows(a.caseId)).toHaveLength(1);
  });

  it("S4 a garbage expected revision is REVISION_CHANGED, not an internal error", async () => {
    const staged = await stageCase();
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built, "test-only-garbage-revision")), "REVISION_CHANGED");
    const publication = await publish(staged.admin, staged.caseId, body(staged.built));
    for (const garbage of ["test-only-garbage-revision", "*", '"' + publication.revision + '"', publication.revision.toUpperCase()]) {
      await expectPreparationError(publish(staged.admin, staged.caseId, body(await buildProposal({ nextReviewOn: "2026-10-29" }), garbage)), "REVISION_CHANGED");
    }
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built, "x".repeat(129))), "VALIDATION_ERROR");
    expect((await validate(staged.admin, staged.caseId, body(staged.built, "test-only-garbage-revision"))).expected_revision_current).toBe(false);
  });

  it.each(["reviewer_user_id", "reprojection", "registries"])("S5/S6 a proposal containing %s is a request-shape error", async (key) => {
    const staged = await stageCase();
    staged.built.proposal[key] = key === "reviewer_user_id" ? staged.admin.id : {};
    await expectPreparationError(publish(staged.admin, staged.caseId, body(staged.built)), "VALIDATION_ERROR");
    expect(await currentRecord(staged.caseId)).toBeNull();
  });

  it("S9 case B's status never contains case A's review", async () => {
    const a = await prepareCase();
    const b = await stageCase({ admin: a.admin });
    const statusB = await status(a.admin, b.caseId);
    expect(statusB).toMatchObject({ case_id: b.caseId, current_review: null, readiness: "no_review" });
    const text = JSON.stringify(statusB);
    for (const value of [a.caseId, a.publication.review_id, a.publication.revision, a.publication.manifest_sha256]) expect(text).not.toContain(value);
    expect((await status(a.admin, a.caseId)).current_review!.review_id).toBe(a.publication.review_id);
  });
});

describe("Phase 3K A: evaluation parity and protected state", () => {
  function anchors(caseId: string): CanonicalEvidenceRecord[] {
    return [record("test-only-3k-jurisdiction", "jurisdiction", "City of Los Angeles"), record("test-only-3k-parcel", "parcel-match", true)]
      .map((entry) => ({ ...entry, subject: { case_id: caseId, property_id: "test-only-3k-property" } }));
  }
  it.each([220, 20])("E5 d is identical between the server entry and the legacy direct evaluator on a 3K-prepared store (lot at x=%i)", async (x) => {
    const prepared = await prepareCase({ lot: lotAt(x) });
    const server = await evaluate(prepared.admin, prepared.caseId);
    const serverInput = lastInput();
    const old = await evaluateStoredCaseProgramScreen(await openProgramScreenCaseStore(env, prepared.admin, prepared.caseId, "read"), { evidence_records: anchors(prepared.caseId), as_of: AS_OF });
    const oldInput = lastInput();
    expect(JSON.stringify(criterion(server.screen, D))).toBe(JSON.stringify(criterion(old.screen, D)));
    const dRecord = (input: ScreenInput) => ({ ...computedRecord("computed-calfire-high-", input), subject: null });
    expect(JSON.stringify(dRecord(serverInput))).toBe(JSON.stringify(dRecord(oldInput)));
    const dBlock = (input: ScreenInput) => authorityBlocks(input).find((block) => block.evidence_id.startsWith("computed-calfire-high-"));
    expect(dBlock(serverInput)).toBeDefined();
    expect(JSON.stringify(dBlock(serverInput))).toBe(JSON.stringify(dBlock(oldInput)));
  });

  it.each([
    ["2026-09-27", "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad", "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070"],
    ["2026-10-01", "be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb", "2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e"],
  ])("G1 keeps evaluator/demo hashes, 2/44/34/44 counts and G1/G2 open at %s", async (asOf, evaluator, demo) => {
    const screen = evaluateProgramScreen({ evidence_records: fictionalFixtureJson.evidence_records, as_of: asOf });
    expect(await sha256Hex(JSON.stringify(screen))).toBe(evaluator);
    expect(await sha256Hex(JSON.stringify(buildProgramScreenPublicDemoPayload(fictionalFixtureJson, { as_of: asOf })))).toBe(demo);
    const packCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(packCriteria.filter((entry) => entry.verification === "human_verified").map((entry) => entry.id)).toEqual([C, D]);
    expect(packCriteria.filter((entry) => entry.verification === "pending_human")).toHaveLength(44);
    expect(packCriteria.filter((entry) => entry.predicate === "not_encoded")).toHaveLength(34);
    expect(screen.release.blockers.filter((blocker) => blocker.code === "pending_human_criterion")).toHaveLength(44);
    expect(screen.release.client_releasable).toBe(false);
    expect(programPathwayCompletenessBlockers.map(({ id, status }) => ({ id, status }))).toEqual([{ id: "G1", status: "open" }, { id: "G2", status: "open" }]);
  });
});
