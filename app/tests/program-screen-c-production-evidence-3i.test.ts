import { describe, expect, it } from "vitest";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { evaluateProgramScreen } from "../src/shared/program-screen/evaluate";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { loadReviewedLotGeometry, type ReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import { fileGdbOverlayIndexText, loadOverlayDatasetView } from "../src/shared/program-screen/overlay-dataset";
import { sha256Hex } from "../src/shared/program-screen/source-capture";
import { block, encode, feature, record, ring, source as lraSource, sra as sraSource, C, VH } from "./program-screen-lra-helpers";
import { polygonRecordContent, testOnlySraIndexText } from "./program-screen-overlay-helpers";

// All lots, observations, geometry bytes, validity verdicts and index pins in
// these synthetic cases are TEST-ONLY. Registered production data is unchanged.
const AS_OF = "2026-10-01";
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
function directResult(pair: Awaited<ReturnType<typeof directPair>>) {
  return evaluateProgramScreen({ evidence_records: pair.observations, evidence_authority: pair.authorities, as_of: AS_OF,
    authority_registries: programAuthorityRegistries, lot_overlay: pair.inputs }).pathways[0].criteria.find((c) => c.criterion_id === C)!;
}
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
});
