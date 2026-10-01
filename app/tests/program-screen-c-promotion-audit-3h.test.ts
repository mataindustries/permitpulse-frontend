import { describe, expect, inject, it, vi } from "vitest";
import fixture from "../fixtures/program-screen/fictional-la-parcel.json";
import decision from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json";
import memoMetadataJson from "../fixtures/program-screen/official-sources/shra-2025-10-28/metadata.json";
import memoText from "../fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt?raw";
import reviewedJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import sourceText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import sourceMetadataText from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import receiptText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import normalizedText from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized-sra.json?raw";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import type { ProgramLotOverlayInputs } from "../src/shared/program-screen/authority-gate";
import { authorityPromotionBlockers, parseProgramAuthorityRegistries, programAuthorityRegistries, type ProgramAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { booleanFact, jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPathway } from "../src/shared/program-screen/criteria/shra";
import { assessStatutoryRoutes, evaluateProgramCriterion, evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { parseProgramEvidenceAuthority, type ProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import { assessProgramFacts } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { computeLotOverlay, loadReviewedLotGeometry, type ReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import { fileGdbOverlayIndexText, loadOverlayDatasetView, overlayCandidates, overlayIndexPinFor, overlayIndexText, parseOverlayIndex, type OverlayIndexPin } from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { bytesSha256, reviewedLotRecordSchema, type CaseFileRef } from "../src/shared/program-screen/reviewed-lot";
import { addDays, criterionAwaitsHumanVerification, criterionPromotionBlockers, hasCompleteHumanVerification, programCriterionSchema } from "../src/shared/program-screen/schema";
import { humanRecordCaptureIssues, normalizeSourceText, parseOfficialSourceMetadata, sha256Hex, splitExtractedPages } from "../src/shared/program-screen/source-capture";
import { programPathwayCompletenessBlockers, type CriterionPredicate, type ProgramCriterion, type ProgramCriterionHumanVerification, type ProgramPathwayPack, type ProgramScreenResult } from "../src/shared/program-screen/types";
import type { ProgramScreenCaseEvidenceStore } from "../src/worker/program-screen/case-evidence";
import { evaluateStoredCaseProgramScreen, loadCaseLraOverlay, loadCaseOverlay } from "../src/worker/program-screen/evaluate-case";
import { block, edit, encode, feature, record, ring, source as lraSource, sra as sraSource, C, D, HIGH, VH } from "./program-screen-lra-helpers";
import { prePromotionC, prePromotionPacks } from "./program-screen-c-pre-promotion";
import { polygonRecordContent, realLotOverlay, testOnlySraIndexText } from "./program-screen-overlay-helpers";

/**
 * TEST-ONLY Phase 3H audit. Nothing here promotes a production criterion.
 * Candidate c is an in-memory copy of the actual shipped criterion, using its
 * actual Phase 3B requirement and the unchanged SHIPPED authority registries.
 * Matrix geometry is explicitly synthetic; TEST-ONLY index pins are passed
 * only through the test interface. Both routes use ONE identical reviewed
 * lot geometry/reference, never a different lot chosen for each route.
 */
const AS_OF = "2026-10-01";
const NEXT_REVIEW = "2026-10-31"; // Conditional on human approval on AS_OF.
const criteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const shippedC = criteria.find((criterion) => criterion.id === C)!;
const shippedD = criteria.find((criterion) => criterion.id === D)!;
const memoMetadata = parseOfficialSourceMetadata(memoMetadataJson);
const cDecision = decision.decisions.find((entry) => entry.letter === "c")!;
// Updated in Phase 3H: the exact approved 598-character summary replaces the earlier 568-character draft.
const SUMMARY = "Phase 3B decision c. Disqualifying per source when, on either separately assessed route, a reviewed CAL FIRE / OSFM record (GOV §51178 2025 LRA identification or PRC §4202 adopted SRA map), a deterministic overlay of the reviewed legal-lot geometry on that route's registered dataset, shows the whole lot proposed to be subdivided in Very High. Consistent with source only when both routes each show no part of the lot in Very High. Partial or mixed coverage, invalid source geometry, a one-route negative, an unclear legal lot, and any other source stay unknown; no threshold. High is criterion d.";
const QUESTION = "How does Planning apply the SHRA Very High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?";
const EXCERPT = "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.";
const proposedPredicate: CriterionPredicate = (facts) => booleanFact(facts, VH) ? "disqualifying_per_source" : "consistent_with_source";
const citation = { ...shippedC.citation, verified_at: AS_OF, next_review_at: NEXT_REVIEW };
const proposedRecord: ProgramCriterionHumanVerification = {
  reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
  verified_at: AS_OF, next_review_at: NEXT_REVIEW,
  source_title: citation.title, source_url: citation.url,
  instrument: "City of Los Angeles SHRA implementation memo, October 28, 2025",
  pinpoint: citation.pinpoint, supporting_excerpt: EXCERPT,
  source_capture: {
    repo_path: "app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt",
    retrieved_at: "2026-09-27T16:19:20Z", capture_method: "pdf_text_extraction",
    sha256: "f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2",
    is_ai_generated: false, source_type: "official_memo", operative_status: "operative",
  },
  decision_ref: { phase: "3B", letter: "c" },
};
function candidate(overrides: Partial<ProgramCriterion> = {}): ProgramCriterion {
  return { ...shippedC, predicate: proposedPredicate, rule_summary: SUMMARY, question_if_judgment: QUESTION,
    citation, verification: "human_verified", human_verification: proposedRecord, ...overrides };
}
// Updated in Phase 3H: c is shipped promoted; the pre-promotion c is rebuilt by the shared TEST-ONLY helper.
const pendingC = prePromotionC;
function projectedPacks(): ProgramPathwayPack[] {
  return programScreenPathwayPacks.map((pack) => ({ ...pack, criteria: pack.criteria.map((criterion) => criterion.id === C ? candidate() : criterion) }));
}
type State = "YES" | "NO" | "unknown" | "partial" | "invalid" | "unreadable" | "mixed" | "outside" | "High" | "NonWildland" | "missing";
const lot = await loadReviewedLotGeometry({ file_id: "test-only-phase-3h-one-legal-lot", bytes: encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(10, 20, 90, 80)] }) });
function rawValue(state: State): boolean | null {
  return state === "unknown" ? null : ["NO", "High", "NonWildland", "outside"].includes(state) ? false : true;
}
function observation(id: string, state: State): CanonicalEvidenceRecord {
  const value = rawValue(state);
  const evidence = record(id, VH, value ?? false);
  if (value !== null) return evidence;
  return { ...evidence, raw_observed_value: { kind: "not_observed", value: null }, normalized_value: { kind: "unknown", value: null, reason: "insufficient_evidence" }, classification: "unknown" };
}
async function routeOverlay(route: "gov_51178" | "prc_4202", state: State, complementaryHalf = false) {
  const source = route === "gov_51178" ? lraSource : sraSource;
  const pack = source.package!;
  const label = state === "High" ? "High" : state === "NonWildland" ? "NonWildland" : ["YES", "partial", "invalid", "unreadable", "mixed", "missing"].includes(state) ? "Very High" : "Moderate";
  const bounds = complementaryHalf ? [50, 100] : state === "outside" ? [200, 300] : [0, state === "partial" || state === "mixed" ? 50 : 100];
  let indexText: string;
  let records: Array<{ record_number: number; content: Uint8Array }>;
  if (route === "gov_51178") {
    const f = feature(1, label, bounds[0], bounds[1], state === "invalid" ? "invalid" : state === "unreadable" ? "unreadable" : "valid");
    if (state === "unreadable") { f.coordinates = []; f.native_wkb = "010c00000000000000"; }
    const derived = await fileGdbOverlayIndexText({ dataset: pack.members.overlay_dataset, layer: pack.overlay.dataset_name, crs_epsg: 3310, class_field: pack.overlay.class_field,
      members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
      records: state === "mixed" ? [f, feature(2, "Moderate", 50, 100)] : [f] });
    indexText = derived.index_text; records = derived.records;
  } else {
    const fs = [{ label, content: polygonRecordContent(ring(bounds[0], 0, bounds[1], 100) as Array<[number, number]>) }];
    if (state === "mixed") fs.push({ label: "Moderate", content: polygonRecordContent(ring(50, 0, 100, 100) as Array<[number, number]>) });
    if (state === "invalid") fs[0].content = polygonRecordContent([[0, 0], [100, 100], [100, 0], [0, 100], [0, 0]]);
    indexText = await testOnlySraIndexText({ dataset: pack.members.overlay_dataset, layer: pack.overlay.dataset_name, crs_epsg: 3310, class_field: pack.overlay.class_field, members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records: fs }, fs.map(() => state === "invalid" ? "invalid" : state === "unreadable" ? "unreadable" : "valid"));
    records = fs.map((f, i) => ({ record_number: i + 1, content: f.content }));
  }
  const pin: OverlayIndexPin = { dataset: pack.members.overlay_dataset, index_sha256: await sha256Hex(indexText) };
  const view = await loadOverlayDatasetView({ index_text: indexText, records: state === "missing" ? [] : records }, [pin]);
  const evidence = observation(`test-only-phase-3h-${route}`, state);
  const authority = block(evidence, { lot } as Parameters<typeof block>[1], route);
  authority.parcel_relationship.legal_lot_reference = "TEST-ONLY Phase 3H Lot 1, same legal lot for both routes";
  return { view, pin, evidence, authority };
}
async function pair(r1: State, r2: State) {
  const a = await routeOverlay("gov_51178", r1), b = await routeOverlay("prc_4202", r2);
  return { records: [a.evidence, b.evidence], blocks: [a.authority, b.authority], inputs: { datasets: [a.view, b.view], lot_geometries: [lot], index_pins: [a.pin, b.pin] } satisfies ProgramLotOverlayInputs };
}
type Pair = Awaited<ReturnType<typeof pair>>;
function screen(p: Pair, criterion = candidate(), registries = programAuthorityRegistries) {
  return evaluateProgramScreen({ evidence_records: [record("test-only-anchor-jurisdiction", "jurisdiction", "City of Los Angeles"), record("test-only-anchor-match", "parcel-match", true), ...p.records],
    evidence_authority: p.blocks, as_of: AS_OF, authority_registries: registries, lot_overlay: p.inputs,
    packs: [{ pathway: shraPathway, criteria: [jurisdictionCriterion("la_shra"), parcelMatchCriterion("la_shra"), criterion] }] });
}
const resultC = (result: ProgramScreenResult) => result.pathways[0].criteria.find((criterion) => criterion.criterion_id === C)!;
const failures = (result: ReturnType<typeof resultC>) => result.authority?.facts.flatMap((fact) => fact.non_establishing.flatMap((record) => record.failures)) ?? [];
function directWithSpy(criterion: ProgramCriterion, registries = programAuthorityRegistries) {
  const evidence = record("test-only-promotion-gate-value", VH, true);
  const index = new Map(assessProgramFacts([evidence], [VH]).map((fact) => [fact.key, fact]));
  const spy = vi.fn(proposedPredicate);
  return { result: evaluateProgramCriterion({ ...criterion, predicate: spy }, index, AS_OF, { registries, records: [evidence], blocks: new Map() }), spy };
}
async function realInvalidSraWitness() {
  const real = await realLotOverlay();
  const invalidLot = await loadReviewedLotGeometry({ file_id: "test-only-phase-3h-invalid-sra-witness", bytes: encode({
    schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon",
    coordinates: [ring(236688, -401049, 236696, -401041)],
  }) });
  const computed = computeLotOverlay(real.view, invalidLot);
  const evidence = observation("test-only-invalid-real-sra", "YES");
  const authority = block(evidence, { lot: invalidLot } as Parameters<typeof block>[1], "prc_4202");
  const result = resultC(screen({ records: [evidence], blocks: [authority], inputs: { datasets: [real.view], lot_geometries: [invalidLot], index_pins: [overlayIndexPinFor(sraSource.package!.members.overlay_dataset)!] } }));
  return { real, invalidLot, computed, result };
}

describe("Phase 3H protected shipped state and conditional proposal", () => {
  // Updated in Phase 3H: c is promoted exactly as audited; d is unchanged.
  it("ships c and d human_verified with all Phase 3B gates/ceilings intact", () => {
    expect(criteria.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual([C, D]);
    expect(criteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(44);
    expect(criteria.filter((criterion) => criterion.predicate === "not_encoded")).toHaveLength(34);
    expect(shippedC).toMatchObject({ verification: "human_verified", rule_summary: SUMMARY, question_if_judgment: QUESTION, citation, human_verification: proposedRecord });
    expect(typeof shippedC.predicate).toBe("function");
    for (const id of ["la_shra.prime-or-statewide-farmland", "la_shra.natural-community-conservation-plan-land", "la_shra.conservation-easement"]) expect(criteria.find((criterion) => criterion.id === id)).toMatchObject({ verification: "pending_human", predicate: "not_encoded", human_verification: null });
    expect(programPathwayCompletenessBlockers.map((b) => [b.id, b.status])).toEqual([["G1", "open"], ["G2", "open"]]);
    expect(programAuthorityRegistries.criterion_requirements[C].promotion_gates).toEqual(cDecision.promotion_gates);
    expect(programAuthorityRegistries.criterion_requirements[C].decision_ref).toEqual({ phase: "3B", letter: "c" });
    expect(shippedC.permitted_outcomes).toEqual(["consistent_with_source", "disqualifying_per_source", "requires_judgment"]);
    expect(candidate().permitted_outcomes).toBe(shippedC.permitted_outcomes);
    expect(candidate().statutory_routes).toBe(shippedC.statutory_routes);
    expect(criterionPromotionBlockers(shippedC)).toEqual([]);
    expect(criterionPromotionBlockers(pendingC())).toEqual(["reviewer_confirms_encoded_rule", "human_verification_record"]);
  });
  it("pins the actual Phase 3B c decision, including the two-route NO and no geography shortcut", () => {
    expect(cDecision.status_after_review).toBe("pending_human");
    expect(cDecision.rule_as_decided).toHaveLength(8);
    expect(cDecision.rule_as_decided[2]).toBe("3. YES → disqualifying_per_source when a qualifying record under either route shows the whole lot proposed to be subdivided inside a Very High zone. A negative under one route never cancels a YES under the other.");
    expect(cDecision.rule_as_decided[4]).toBe('5. NO → consistent_with_source only when qualifying records under both routes each show no part of the lot in a Very High zone. A negative under one route alone gives unknown. There is no "only one route applies here" shortcut unless a later captured, reviewed source supports it.');
    expect(cDecision.outcome_ceiling_changed).toBe(false);
  });
  it("supports the exact proposed human record with the captured memo, not stale d dates", async () => {
    expect(programCriterionSchema.safeParse(candidate()).success).toBe(true);
    expect(hasCompleteHumanVerification(candidate())).toBe(true);
    expect(criterionPromotionBlockers(candidate())).toEqual([]);
    expect(humanRecordCaptureIssues(proposedRecord, { metadata: memoMetadata, extracted: memoText })).toEqual([]);
    expect(normalizeSourceText(splitExtractedPages(memoText)[3])).toContain(EXCERPT);
    expect(await sha256Hex(memoText)).toBe(proposedRecord.source_capture.sha256);
    expect(inject("programScreenOfficialCaptureByteChecks")["app/fixtures/program-screen/official-sources/shra-2025-10-28"]).toMatchObject({ issues: [], sha256_original: memoMetadata.sha256_original });
    expect(NEXT_REVIEW).toBe(addDays(AS_OF, 30));
    expect(citation.verified_at).not.toBe(shippedD.citation.verified_at);
    expect(SUMMARY.length).toBe(598);
    expect(SUMMARY.length).toBeLessThanOrEqual(600);
    expect(findProhibitedClientLanguage(SUMMARY)).toEqual([]);
    expect(findProhibitedClientLanguage(QUESTION)).toEqual([]);
    expect(programCriterionSchema.safeParse(candidate({ citation: { ...citation, next_review_at: "2026-11-01" } })).success).toBe(false);
  });
  it.each(["hash", "retrieval", "excerpt", "source"])("rejects a human capture %s mutation", (field) => {
    const changed = edit(proposedRecord, (record) => {
      if (field === "hash") record.source_capture.sha256 = "0".repeat(64);
      if (field === "retrieval") record.source_capture.retrieved_at = "2026-09-28T16:19:20Z";
      if (field === "excerpt") record.supporting_excerpt = "Very High only under either route; whole-lot coverage required.";
      if (field === "source") record.source_url = "https://records.example.test/invented";
    });
    expect(humanRecordCaptureIssues(changed, { metadata: memoMetadata, extracted: memoText }).length).toBeGreaterThan(0);
  });
});

describe("Phase 3H actual c with independent statutory routes and the SAME lot", () => {
  it.each([
    ["YES", "YES", "disqualifying_per_source"], ["YES", "unknown", "disqualifying_per_source"], ["unknown", "YES", "disqualifying_per_source"],
    ["YES", "NO", "disqualifying_per_source"], ["NO", "YES", "disqualifying_per_source"], ["NO", "NO", "consistent_with_source"],
    ["NO", "unknown", "unknown"], ["unknown", "NO", "unknown"], ["unknown", "unknown", "unknown"],
  ] as const)("truth table Route 1 %s / Route 2 %s => %s", async (r1, r2, expected) => {
    const p = await pair(r1, r2);
    expect(p.inputs.lot_geometries).toEqual([lot]);
    expect(p.blocks.map((b) => b.qualifiers?.family === "hazard_map" ? b.qualifiers.lot_overlay?.lot_geometry?.sha256 : null)).toEqual([lot.sha256, lot.sha256]);
    expect(p.blocks[0].parcel_relationship.legal_lot_reference).toBe(p.blocks[1].parcel_relationship.legal_lot_reference);
    const result = resultC(screen(p));
    expect(result.status).toBe(expected);
    if (expected !== "unknown") expect(result.authority?.established).toBe(true);
    expect(result.statutory_routes?.map((entry) => entry.route)).toEqual(["gov_51178", "prc_4202"]);
  });
  it.each(["partial", "invalid", "unreadable", "mixed", "outside", "missing"] as const)("Route 1 %s stays unknown with Route 2 NO, but cannot cancel Route 2 YES", async (state) => {
    expect(resultC(screen(await pair(state, "NO"))).status).toBe("unknown");
    expect(resultC(screen(await pair(state, "YES"))).status).toBe("disqualifying_per_source");
  });
  it.each(["partial", "invalid", "unreadable", "mixed", "outside", "missing"] as const)("Route 2 %s stays unknown with Route 1 NO, but cannot cancel Route 1 YES", async (state) => {
    expect(resultC(screen(await pair("NO", state))).status).toBe("unknown");
    expect(resultC(screen(await pair("YES", state))).status).toBe("disqualifying_per_source");
  });
  it.each(["High", "Moderate"])("relevant invalid SRA %s cannot clear actual c even when Route 1 is NO", async (label) => {
    const p = await pair("NO", "NO");
    const content = polygonRecordContent([...ring(0, 0, 100, 100), [4, 4], [4, 0], [0, 4], [0, 0]] as Array<[number, number]>);
    const text = await testOnlySraIndexText({ dataset: sraSource.package!.members.overlay_dataset, layer: sraSource.package!.overlay.dataset_name,
      crs_epsg: 3310, class_field: sraSource.package!.overlay.class_field, members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records: [{ label, content }] }, ["invalid"]);
    const pin = { dataset: sraSource.package!.members.overlay_dataset, index_sha256: await sha256Hex(text) };
    p.inputs.datasets[1] = await loadOverlayDatasetView({ index_text: text, records: [{ record_number: 1, content }] }, [pin]);
    p.inputs.index_pins[1] = pin;
    const result = resultC(screen(p));
    expect(result.status).toBe("unknown"); expect(result.authority?.established).toBe(false);
    expect(failures(result)).toContain("lot_overlay_not_established");
  });
  it("does not add partial coverage from the two routes", async () => {
    const p = await pair("partial", "partial");
    // The route polygons cover complementary halves whose union covers the
    // lot. Neither independently covers the whole lot, so c stays unknown.
    const second = await routeOverlay("prc_4202", "partial", true);
    p.records[1] = second.evidence; p.blocks[1] = second.authority;
    p.inputs.datasets[1] = second.view; p.inputs.index_pins[1] = second.pin;
    expect(computeLotOverlay(p.inputs.datasets[0], lot).lot_within_features).toBe("part_of_lot");
    expect(computeLotOverlay(p.inputs.datasets[1], lot).lot_within_features).toBe("part_of_lot");
    expect(resultC(screen(p)).status).toBe("unknown");
  });
  it.each(["High", "NonWildland"] as const)("whole-lot LRA %s establishes only a route negative", async (state) => {
    expect(resultC(screen(await pair(state, "unknown"))).status).toBe("unknown");
    expect(resultC(screen(await pair(state, "NO"))).status).toBe("consistent_with_source");
    const p = await pair(state, "unknown");
    p.records[0] = observation(p.records[0].id, "YES"); p.blocks[0].coverage = "whole_parcel";
    expect(failures(resultC(screen(p)))).toContain("lot_overlay_classes_do_not_support_value");
  });
  it.each([0, 1])("route %s cannot borrow the other package or a superseded edition", async (index) => {
    const p = await pair("YES", "YES");
    const other = index === 0 ? sraSource : lraSource;
    p.blocks[index].source_identifier.value = other.authority_source_id;
    p.blocks[index].capture = { store: "repo_official_source", ...other.capture };
    p.blocks[index].edition = { ...p.blocks[index].edition, ...other.edition };
    const alone = { ...p, records: [p.records[index]], blocks: [p.blocks[index]] };
    expect(failures(resultC(screen(alone)))).toContain("statutory_route_not_accepted");
    expect(resultC(screen(p)).status).toBe("disqualifying_per_source");
    const clean = await pair("NO", "NO");
    const registries = edit(programAuthorityRegistries, (r) => {
      const current = r.sources[index === 0 ? 1 : 0]; const next = structuredClone(current);
      next.authority_source_id += "-test-only-next"; current.superseded_by = next.authority_source_id; r.sources.push(next);
    });
    expect(criterionPromotionBlockers(candidate(), registries)).toEqual([]); // Wired route; operational currency failure.
    expect(resultC(screen(clean, candidate(), registries)).status).toBe("unknown");
    expect(resultC(screen(await pair("YES", "YES"), candidate(), registries)).status).toBe("disqualifying_per_source");
  });
  it.each(["not_established", "parcel_and_legal_lot_differ", "tied_or_multiple_lots", "merger_or_resubdivision_pending_or_proposed"])("APN cannot substitute for legal identity %s", async (identity) => {
    const p = await pair("YES", "YES");
    for (const b of p.blocks) b.parcel_relationship.legal_lot_identity = identity as ProgramEvidenceAuthority["parcel_relationship"]["legal_lot_identity"];
    expect(resultC(screen(p)).status).toBe("unknown");
    expect(failures(resultC(screen(p)))).toContain("legal_lot_identity_not_established");
  });
  it("manual coverage/class/adoption attestations cannot create an outcome", async () => {
    const p = await pair("High", "High");
    p.records = p.records.map((r) => observation(r.id, "YES"));
    for (const b of p.blocks) { b.coverage = "whole_parcel"; if (b.qualifiers?.family === "hazard_map") { b.qualifiers.map_covers_lot = "yes"; b.qualifiers.adoption_status = "adopted"; } }
    expect(resultC(screen(p)).status).toBe("unknown");
    expect(failures(resultC(screen(p)))).toContain("lot_overlay_classes_do_not_support_value");
    const bad = structuredClone(p.blocks);
    (bad[0].qualifiers as any).lot_overlay.classes_on_lot = ["Very High"];
    expect(() => parseProgramEvidenceAuthority(bad, p.records)).toThrow();
  });
  it("responsibility area and City adoption are context only for GOV 51178", async () => {
    const p = await pair("YES", "unknown");
    if (p.blocks[0].qualifiers?.family !== "hazard_map") throw new Error("Wrong family");
    p.blocks[0].qualifiers.responsibility_area_as_stated = "not_stated";
    p.blocks[0].qualifiers.adoption_status = "not_adopted";
    expect(resultC(screen(p)).status).toBe("disqualifying_per_source");
  });
  it("nonqualifying records cannot establish c; disagreement stays Layer 1 conflict", async () => {
    const p = await pair("YES", "unknown");
    expect(resultC(screen({ ...p, blocks: [] })).status).toBe("unknown");
    const disagreeing = record("test-only-city-disagrees", VH, false);
    const withConflict = { ...p, records: [...p.records, disagreeing] };
    expect(resultC(screen(withConflict)).status).toBe("conflict");
    expect(resultC(screen(withConflict)).authority).toBeUndefined();
  });
  it.each([0, 1])("required issuer/route/record/edition fields fail closed on route %s", async (index) => {
    for (const field of ["agency", "route", "issuer", "edition", "capture", "reference", "adoption"]) {
      if (field === "adoption" && index === 0) continue;
      const p = await pair("YES", "YES");
      const b = p.blocks[index];
      if (b.qualifiers?.family !== "hazard_map") throw new Error("Wrong qualifier family");
      if (field === "agency") b.qualifiers.named_agency = "not_established";
      if (field === "route") b.qualifiers.statutory_basis = "not_established";
      if (field === "issuer") b.issuer.issuer_id = "test-only-wrong-issuer";
      if (field === "edition") b.edition.date = "2022-04-12";
      if (field === "capture" && b.capture?.store === "repo_official_source") b.capture.sha256_extracted = "0".repeat(64);
      if (field === "reference") b.parcel_relationship.legal_lot_reference = null;
      if (field === "adoption") b.qualifiers.adoption_status = "not_adopted";
      expect(resultC(screen({ ...p, records: [p.records[index]], blocks: [b] })).status, field).toBe("unknown");
    }
  });
  it("SRA is independently computed against the real pinned Phase 3D dataset", async () => {
    const real = await realLotOverlay();
    for (const [name, raw, expected] of [["whole-very-high", true, "disqualifying_per_source"], ["whole-high", false, "unknown"], ["whole-moderate", false, "unknown"], ["very-high-moderate", true, "unknown"], ["part-moderate-outside-sra", false, "unknown"], ["outside-sra", false, "unknown"]] as const) {
      const p = await pair("unknown", raw ? "YES" : "NO");
      if (p.blocks[1].qualifiers?.family !== "hazard_map") throw new Error("Wrong family");
      p.blocks[1].qualifiers.lot_overlay!.lot_geometry = real.lots[name];
      p.inputs = { datasets: [real.view], lot_geometries: [real.geometries[name]], index_pins: [overlayIndexPinFor(sraSource.package!.members.overlay_dataset)!] };
      expect(resultC(screen(p)).status, name).toBe(expected);
    }
  });
  it("rejects the exact real relevant-invalid SRA feature that previously established c YES", async () => {
    // Native GDAL 3.10.3 / GEOS 3.13.1 audit of the ORIGINAL pinned archive:
    // 233 invalid features (139 Very High, 70 High, 24 Moderate).
    // Record 10977 / GDAL FID 10976 is Very High and GEOS reports:
    // Ring Self-intersection near (237657.61459999904, -405236.31659999955).
    // This fictional 8 m square is inside the existing 3E mixed-lot fixture's
    // bbox, so its complete candidates are already supplied by global setup.
    // No source record, class, coordinate, archive or pin is altered/repaired.
    const { real, computed, result } = await realInvalidSraWitness();
    expect(computed.candidate_records).toEqual([537, 10977, 10984]);
    expect(computed.lot_within_features).toBe("not_established");
    expect(computed.classes_on_lot).toEqual([]);
    expect(computed.issues.join(" ")).toContain("10977");
    expect(real.view.feature(10977)?.label).toBe("Very High");
    expect(real.view.index_sha256).toBe(overlayIndexPinFor(sraSource.package!.members.overlay_dataset)!.index_sha256);
    expect(real.view.entries()[10976].geometry_state).toBe("invalid");
    expect(real.view.entries()[10976].content_sha256).toBe("a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13");
    expect(real.view.entries()[10976].topology_diagnostic).toContain("Ring Self-intersection");
    expect(result.status).toBe("unknown");
    expect(result.authority?.established).toBe(false);
    expect(result.authority?.facts[0].establishing_evidence_ids).toEqual([]);
  });
  it("a relevant invalid real SRA feature must leave c unknown", async () => {
    const { result } = await realInvalidSraWitness();
    // Former explicit expected failure from the audit; now a required passing regression.
    expect(result.status).toBe("unknown");
  });
});

describe("Phase 3H promotion gates are executable requirements", () => {
  const breakages: Array<[string, (draft: any) => void]> = [
    ["evidence_provenance_enforced_or_fails_closed", (r) => { r.fact_policies[VH].establishing = []; }],
    ["map_identity_and_edition_recorded", (r) => { r.fact_policies[VH].establishing[0].currency_max_age_days = null; }],
    ["map_identity_and_edition_recorded", (r) => { r.fact_policies[VH].establishing[0].identity = "recorded_instrument_identity"; }],
    ["statutory_route_recorded", (r) => { r.fact_policies[VH].establishing[0].record_kind = "generic_gis_layer"; }],
    ["legal_lot_identity_fails_closed", (r) => { r.fact_policies[VH].requires_legal_lot_identity = false; }],
  ];
  it.each(breakages)("cannot promote c when %s is broken", (gate, change) => {
    const broken = edit(programAuthorityRegistries, change);
    expect(authorityPromotionBlockers(candidate(), broken, true)).toContain(gate);
    expect(criterionPromotionBlockers(candidate(), broken)).toContain(gate);
    expect(criterionAwaitsHumanVerification(candidate(), broken)).toBe(true);
    const { result, spy } = directWithSpy(candidate(), broken);
    expect(result.status).toBe("unreviewed"); expect(spy).not.toHaveBeenCalled();
  });
  it.each([lraSource.authority_source_id, sraSource.authority_source_id])("cannot promote without route registration %s", (id) => {
    const broken = edit(programAuthorityRegistries, (r) => { r.sources = r.sources.filter((s: any) => s.authority_source_id !== id); r.fact_policies[VH].establishing = r.fact_policies[VH].establishing.filter((e: any) => !e.authority_source_ids.includes(id)); if (id === sraSource.authority_source_id) r.fact_policies[HIGH].establishing = []; });
    expect(() => parseProgramAuthorityRegistries(broken)).not.toThrow();
    expect(criterionPromotionBlockers(candidate(), broken)).toContain("statutory_route_recorded");
    const { result, spy } = directWithSpy(candidate(), broken);
    expect(result.status).toBe("unreviewed"); expect(spy).not.toHaveBeenCalled();
  });
  it("cannot promote without separate assessment of both statutory routes", () => {
    const changed = candidate({ statutory_routes: undefined });
    expect(criterionPromotionBlockers(changed)).toContain("statutory_routes_assessed_separately");
    const { result, spy } = directWithSpy(changed);
    expect(result.status).toBe("unreviewed"); expect(spy).not.toHaveBeenCalled();
    expect(programCriterionSchema.safeParse(candidate({ statutory_routes: { fact_key: VH, routes: ["prc_4202"] } })).success).toBe(false);
  });
  it("cannot promote without an encoded rule", () => {
    const changed = candidate({ predicate: "not_encoded" });
    expect(programCriterionSchema.safeParse(changed).success).toBe(false);
    const evidence = record("test-only-unencoded", VH, true);
    const index = new Map(assessProgramFacts([evidence], [VH]).map((fact) => [fact.key, fact]));
    expect(evaluateProgramCriterion(changed, index, AS_OF).status).toBe("unreviewed");
  });
  it.each([undefined, { round: 1, letter: "c" }, { phase: "3B", letter: "d" }, { round: 99, letter: "c" }])("cannot promote with decision reference %j", (ref) => {
    const record = { ...proposedRecord }; if (ref === undefined) delete record.decision_ref; else record.decision_ref = ref;
    const changed = candidate({ human_verification: record });
    expect(criterionPromotionBlockers(changed)).toContain("reviewer_confirms_encoded_rule");
    const { result, spy } = directWithSpy(changed);
    expect(result.status).toBe("unreviewed"); expect(spy).not.toHaveBeenCalled();
  });
  it.each(["missing", "machine", "blank", "AI", "stale-date", "citation-mismatch"])("cannot promote with human record %s", (kind) => {
    const changed = candidate({ human_verification: edit(proposedRecord, (r) => {
      if (kind === "machine") r.reviewer.kind = "ai";
      if (kind === "blank") r.reviewer.name = "";
      if (kind === "AI") r.source_capture.is_ai_generated = true;
      if (kind === "stale-date") r.verified_at = "2026-09-17";
      if (kind === "citation-mismatch") r.next_review_at = "2026-10-29";
    }) });
    if (kind === "missing") changed.human_verification = null;
    expect(hasCompleteHumanVerification(changed)).toBe(false);
    expect(criterionPromotionBlockers(changed)).toContain("human_verification_record");
    const { result, spy } = directWithSpy(changed);
    expect(result.status).toBe("unreviewed"); expect(spy).not.toHaveBeenCalled();
  });
});

class TestOnlyCaseStore implements ProgramScreenCaseEvidenceStore {
  readonly case_id = reviewedJson.case_id;
  record: unknown = reviewedLotRecordSchema.parse(structuredClone(reviewedJson));
  files = new Map<string, Uint8Array>(); indexes = new Map<string, Uint8Array>(); records = new Map<string, Uint8Array>();
  current = true;
  async getFile(ref: CaseFileRef) { return this.files.get(ref.sha256) ?? null; }
  async readReview() { return { record: this.record, revision: "test-only-phase-3h-revision" }; }
  async revisionIsCurrent() { return this.current; }
  async getOverlayIndex(sha: string) { return this.indexes.get(sha) ?? null; }
  async getOverlayRecord(sha: string) { return this.records.get(sha) ?? null; }
}
async function privateInputs() {
  const store = new TestOnlyCaseStore(), record = reviewedLotRecordSchema.parse(structuredClone(reviewedJson));
  for (const [ref, text] of [[record.source_geometry.file, sourceText], [record.source_geometry.metadata_file, sourceMetadataText], [record.normalized_geometry.file, normalizedText], [record.reprojection.receipt_file, receiptText]] as const) store.files.set(ref.sha256, new TextEncoder().encode(text));
  const identity = new TextEncoder().encode("TEST-ONLY current legal-lot review basis; no real case evidence.\n");
  const identityRef: CaseFileRef = { store: "case_evidence_file", file_id: "test-only-phase-3h-legal-identity", sha256: await bytesSha256(identity), bytes: identity.length };
  store.files.set(identityRef.sha256, identity); record.legal_identity_evidence = [identityRef]; record.legal_lot_identity = "parcel_is_one_legal_lot"; store.record = record;
  for (const provided of [inject("programScreenOverlayDataset"), inject("programScreenLraDataset")]) {
    if (provided.index_text === null) throw new Error(provided.error ?? "Native CAL FIRE derivation unavailable");
    store.indexes.set(await sha256Hex(provided.index_text), new TextEncoder().encode(provided.index_text));
    for (const base64 of Object.values(provided.records)) { const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); store.records.set(await bytesSha256(bytes), bytes); }
  }
  return { store, record };
}
describe("Phase 3H private production-input boundary", () => {
  it("loads each shipped dataset against the identical private reviewed EPSG:3310 lot", async () => {
    const { store } = await privateInputs();
    const sra = await loadCaseOverlay(store, AS_OF), lra = await loadCaseLraOverlay(store, AS_OF);
    expect(sra.inputs?.lot_geometries[0].sha256).toBe(lra.inputs?.lot_geometries[0].sha256);
    expect(sra.inputs?.lot_geometries[0].crs_epsg).toBe(3310);
    expect(lra.inputs?.datasets[0].dataset).toEqual(lraSource.package!.members.overlay_dataset);
    expect(sra.inputs?.datasets[0].dataset).toEqual(sraSource.package!.members.overlay_dataset);
    expect(sra.record?.legal_lot_identity).toBe("parcel_is_one_legal_lot");
  });
  // Updated in Phase 3H: c is promoted, but production still computes only d's evidence, so c stays unknown.
  it("production evaluator computes only d's evidence; manual c authority cannot fill the operational gap", async () => {
    const { store } = await privateInputs();
    const p = await pair("YES", "YES");
    p.records = p.records.map((r) => ({ ...r, subject: { ...r.subject, case_id: store.case_id } }));
    const result = await evaluateStoredCaseProgramScreen(store, { evidence_records: p.records, evidence_authority: p.blocks, as_of: AS_OF });
    const c = result.screen.pathways[0].criteria.find((criterion) => criterion.criterion_id === C)!;
    expect(c.verification).toBe("human_verified");
    expect(c.status).toBe("unknown");
    expect(c.authority?.established).toBe(false);
    expect(result.screen.facts.filter((f) => f.key === VH)[0].evidence.map((e) => e.evidence_id)).toEqual(p.records.map((r) => r.id));
    expect(result.screen.facts.find((f) => f.key === HIGH)?.evidence.some((e) => e.evidence_id.startsWith("computed-calfire-high-"))).toBe(true);
    expect(criterionPromotionBlockers(candidate())).toEqual([]);
    const blocks = parseProgramEvidenceAuthority([], p.records), factIndex = new Map(assessProgramFacts(p.records, [VH]).map((f) => [f.key, f]));
    expect(evaluateProgramCriterion(candidate(), factIndex, AS_OF, { registries: programAuthorityRegistries, blocks, records: p.records }).status).toBe("unknown");
  });
  it.each(["foreign-case", "expired", "superseded", "changed-review", "normalized-hash", "missing-LRA-index"])("private inputs fail closed for %s", async (kind) => {
    const { store, record } = await privateInputs();
    if (kind === "foreign-case") record.case_id = "00000000-0000-4000-8000-000000000099";
    if (kind === "expired") record.review.next_review_on = AS_OF;
    if (kind === "superseded") record.state.status = "superseded";
    if (kind === "changed-review") store.current = false;
    if (kind === "normalized-hash") store.files.set(record.normalized_geometry.file.sha256, new TextEncoder().encode("changed bytes"));
    if (kind === "missing-LRA-index") store.indexes.delete(overlayIndexPinFor(lraSource.package!.members.overlay_dataset)!.index_sha256);
    const overlay = await loadCaseLraOverlay(store, AS_OF);
    expect(overlay.computed.lot_within_features).toBe("not_established"); expect(overlay.inputs).toBeUndefined();
  });
  it.each(["missing-validity", "validity-hash-mismatch", "geometry-mutation"])("private SRA inputs yield unknown for %s", async (kind) => {
    const { store } = await privateInputs();
    const before = await loadCaseOverlay(store, AS_OF);
    expect(before.computed.lot_within_features).toBe("whole_lot");
    const pin = overlayIndexPinFor(sraSource.package!.members.overlay_dataset)!;
    const text = new TextDecoder().decode(store.indexes.get(pin.index_sha256)!);
    const entry = parseOverlayIndex(text).entries[before.computed.candidate_records[0] - 1];
    if (kind === "geometry-mutation") {
      const changed = store.records.get(entry.content_sha256)!.slice();
      new DataView(changed.buffer).setFloat64(48, new DataView(changed.buffer).getFloat64(48, true) + 1, true);
      store.records.set(entry.content_sha256, changed);
    } else {
      const lines = text.split("\n"), at = 11 + entry.record_number - 1;
      lines[at] = kind === "missing-validity" ? lines[at].replace(/ valid null$/, "") : lines[at].replace(entry.content_sha256, "0".repeat(64));
      store.indexes.set(pin.index_sha256, new TextEncoder().encode(lines.join("\n")));
    }
    const unavailable = await loadCaseOverlay(store, AS_OF);
    expect(unavailable.computed.lot_within_features).toBe("not_established"); expect(unavailable.inputs).toBeUndefined();
    const observed = record("test-only-invalid-private-input", VH, true);
    observed.subject.case_id = store.case_id;
    const evaluated = await evaluateStoredCaseProgramScreen(store, { evidence_records: [observed], as_of: AS_OF });
    expect(evaluated.screen.facts.find((f) => f.key === HIGH)?.normalized_value.kind).toBe("unknown");
    expect(evaluated.screen.pathways[0].criteria.find((c) => c.criterion_id === D)?.status).toBe("unknown");
  });
});

// Updated in Phase 3H: the approved projection is now the shipped output. "Before" is the rebuilt
// pre-promotion c; "after" is the shipped packs, which must equal the audited candidate's output.
describe("Phase 3H c-only promotion: shipped output equals the audited projection", () => {
  it.each([
    [fixture.as_of, "156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc", "4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5", "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad", "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070"],
    [AS_OF, "1acccc9755166e99d496775936706e80d8bbf083e772d6f3d5c336685c196be7", "06222298ab94abdec298ee3334eb25badb1544de67489c987c377b9c88c95393", "be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb", "2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e"],
  ])("reproduces hashes/counts as of %s and changes no other criterion/fact/rollup", async (as_of, beforeHash, beforeDemoHash, afterHash, afterDemoHash) => {
    const before = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of, packs: prePromotionPacks() });
    const after = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of });
    const beforeDemo = buildProgramScreenPublicDemoPayload(fixture, { as_of, packs: prePromotionPacks() }), afterDemo = buildProgramScreenPublicDemoPayload(fixture, { as_of });
    expect(JSON.stringify(evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of, packs: projectedPacks() }))).toBe(JSON.stringify(after));
    expect(await sha256Hex(JSON.stringify(before))).toBe(beforeHash); expect(await sha256Hex(JSON.stringify(beforeDemo))).toBe(beforeDemoHash);
    expect(await sha256Hex(JSON.stringify(after))).toBe(afterHash); expect(await sha256Hex(JSON.stringify(afterDemo))).toBe(afterDemoHash);
    const projected = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
    expect(projected.filter((c) => c.verification === "human_verified")).toHaveLength(2); expect(projected.filter((c) => c.verification === "pending_human")).toHaveLength(44); expect(projected.filter((c) => c.predicate === "not_encoded")).toHaveLength(34);
    expect(after.release.blockers).toEqual(before.release.blockers.filter((b) => b.ref !== C)); expect(after.release.blockers).toHaveLength(44);
    expect(after.facts).toEqual(before.facts); expect(after.counts).toEqual(before.counts); expect(after.screen_id).toBe(before.screen_id);
    expect(after.planning_questions).toEqual(before.planning_questions); expect(after.review_tasks).toEqual(before.review_tasks.filter((task) => task.criterion_id !== C));
    for (const [i, pathway] of after.pathways.entries()) {
      expect(pathway.criteria.filter((c) => c.criterion_id !== C)).toEqual(before.pathways[i].criteria.filter((c) => c.criterion_id !== C));
      expect(pathway.rollup).toBe(before.pathways[i].rollup); expect(pathway.statement).toBe(before.pathways[i].statement); expect(pathway.decisive_criteria).toEqual(before.pathways[i].decisive_criteria);
      expect(pathway.program_flags).toEqual(before.pathways[i].program_flags);
    }
    expect(after.pathways[0].criteria.find((c) => c.criterion_id === C)?.status).toBe("conflict");
    expect(shippedC.verification).toBe("human_verified"); expect(typeof shippedC.predicate).toBe("function");
  });
});
