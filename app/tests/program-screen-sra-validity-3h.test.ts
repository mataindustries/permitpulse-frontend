import { describe, expect, inject, it } from "vitest";
import { computeLotOverlay, loadReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import { parseProgramEvidenceAuthority } from "../src/shared/program-screen/evidence-authority";
import {
  loadOverlayDatasetView, overlayIndexPinFor, overlayIndexText, parseOverlayIndex, shapefileTopologyIndexText,
  type OverlayIndexInput, type ShapefileTopologyRecord,
} from "../src/shared/program-screen/overlay-dataset";
import { sraValidityProfile } from "../src/shared/program-screen/sra-validity-profile";
import { sha256Hex, sha256HexBytes } from "../src/shared/program-screen/source-capture";
import { block, encode, failures, record, registries, ring, screen, source as lra, sra, VH } from "./program-screen-lra-helpers";
import { polygonRecordContent, realLotOverlay, testOnlySraIndexText } from "./program-screen-overlay-helpers";

type State = ShapefileTopologyRecord["state"];
const square = ring(0, 0, 100, 100) as Array<[number, number]>;
// One invalid ring with a tiny self-intersecting loop outside the reviewed lot.
// Its large square still covers the lot, so ignoring validity would wrongly
// support either positive or negative evidence. These are TEST-ONLY bytes.
const invalid = [...square, [4, 4], [4, 0], [0, 4], [0, 0]] as Array<[number, number]>;
const dataset = sra.package!.members.overlay_dataset;

function indexInput(label = "Very High", content = polygonRecordContent(square)): OverlayIndexInput {
  return { dataset, layer: sra.package!.overlay.dataset_name, crs_epsg: 3310, class_field: sra.package!.overlay.class_field,
    members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) }, records: [{ label, content }] };
}
async function synthetic(label: string, state: State = "valid", legacy = false, remoteInvalid = false) {
  const input = indexInput(label, polygonRecordContent(state === "invalid" ? invalid : square));
  if (remoteInvalid) input.records = [...input.records, { label: "Very High", content: polygonRecordContent(ring(1000, 1000, 1100, 1100) as Array<[number, number]>) }];
  const text = legacy ? await overlayIndexText(input) : await testOnlySraIndexText(input, remoteInvalid ? [state, "invalid"] : [state]);
  const pin = { dataset, index_sha256: await sha256Hex(text) };
  const records = input.records.map((r, i) => ({ record_number: i + 1, content: r.content }));
  const view = await loadOverlayDatasetView({ index_text: text, records }, [pin]);
  const lot = await loadReviewedLotGeometry({ file_id: "test-only-phase-3h-topology-lot", bytes: encode({
    schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [ring(10, 20, 90, 80)],
  }) });
  return { input, derived: { index_text: text, records }, pin, view, lot, inputs: { datasets: [view], lot_geometries: [lot], index_pins: [pin] } };
}
function sraResult(o: Awaited<ReturnType<typeof synthetic>>, value: boolean) {
  const evidence = record("test-only-sra-validity-observation", VH, value);
  const authority = block(evidence, o, "prc_4202");
  return { result: screen([evidence], [authority], o, registries(), VH, false), evidence, authority };
}

describe("Phase 3H offline SRA inventory and preserved native behavior", () => {
  it("freshly derives all 233 invalid native features and the exact manifest/index pins", async () => {
    const provided = inject("programScreenOverlayDataset");
    expect(provided.error).toBeNull();
    expect(provided.validity_manifest_sha256).toBe(sraValidityProfile.validity_manifest_sha256);
    expect(provided.validity_counts).toEqual({ invalid: 233, valid: 18190 });
    expect(provided.invalid_counts).toEqual({ High: 70, Moderate: 24, "Very High": 139 });
    const { header, entries } = parseOverlayIndex(provided.index_text!);
    expect(header).toMatchObject({ layer: "FHSZSRA_23_3", crs_epsg: 3310, class_field: "FHSZ_Descr", format: "shapefile-topology",
      topology: { tool: "GDAL-3.10.3-GEOS-3.13.1", manifest_sha256: sraValidityProfile.validity_manifest_sha256 } });
    expect(header.members.archive).toBe(sraValidityProfile.archive_sha256);
    expect(entries).toHaveLength(18423);
    expect(entries.filter((e) => e.geometry_state === "invalid")).toHaveLength(233);
    expect(entries.filter((e) => e.geometry_state === undefined)).toEqual([]);
    expect(await sha256Hex(provided.index_text!)).toBe(sraValidityProfile.index_sha256);
    expect(overlayIndexPinFor(dataset)?.index_sha256).toBe(sraValidityProfile.index_sha256);
    expect(entries[10976]).toMatchObject({ record_number: 10977, label: "Very High", geometry_state: "invalid",
      content_sha256: "a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13",
      topology_diagnostic: "Ring Self-intersection at or near point 237657.61459999904 -405236.31659999955" });
    expect(overlayIndexPinFor(lra.package!.members.overlay_dataset)?.index_sha256).toBe("5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716");
    expect(sra.package!.statutory_basis).toBe("prc_4202"); expect(lra.package!.statutory_basis).toBe("gov_51178");
  });
  it.each([
    ["whole-high", ["High"]], ["whole-very-high", ["Very High"]], ["whole-moderate", ["Moderate"]],
    ["whole-high-l-shape-with-hole", ["High"]],
  ] as const)("native valid lot %s is unaffected by invalid features elsewhere", async (name, labels) => {
    const real = await realLotOverlay();
    const computed = computeLotOverlay(real.view, real.geometries[name]);
    expect(computed.lot_within_features).toBe("whole_lot"); expect(computed.classes_on_lot).toEqual(labels); expect(computed.issues).toEqual([]);
    expect(real.view.entries().filter((e) => e.geometry_state === "invalid")).toHaveLength(233);
    expect(computed.candidate_records.every((id) => real.view.entries()[id - 1].geometry_state === "valid")).toBe(true);
  });
});

describe("Phase 3H synthetic topology safety requirements", () => {
  it.each(["Very High", "High", "Moderate"])("relevant invalid %s supports neither YES nor NO", async (label) => {
    const o = await synthetic(label, "invalid");
    expect(computeLotOverlay(o.view, o.lot)).toMatchObject({ lot_within_features: "not_established", classes_on_lot: [] });
    for (const value of [true, false]) {
      const { result } = sraResult(o, value);
      expect(result.status).toBe("unknown"); expect(result.authority?.established).toBe(false);
      expect(failures(result)).toContain("lot_overlay_not_established");
    }
  });
  it.each([true, false])("missing validity cannot establish observed %s", async (value) => {
    const o = await synthetic(value ? "Very High" : "Moderate", "valid", true);
    expect(o.view.entries()[0].geometry_state).toBeUndefined();
    expect(computeLotOverlay(o.view, o.lot).lot_within_features).toBe("not_established");
    expect(sraResult(o, value).result.status).toBe("unknown");
  });
  it.each([true, false])("unreadable candidate cannot establish observed %s", async (value) => {
    const o = await synthetic(value ? "Very High" : "Moderate", "unreadable");
    expect(computeLotOverlay(o.view, o.lot).lot_within_features).toBe("not_established");
    expect(sraResult(o, value).result.status).toBe("unknown");
  });
  it.each([false, true])("unreadable or missing-validity geometry without an extent cannot be excluded (legacy=%s)", async (legacy) => {
    const input = indexInput("Very High", new Uint8Array(4));
    const text = legacy ? await overlayIndexText(input) : await testOnlySraIndexText(input, ["unreadable"]);
    const o = await synthetic("Very High");
    const pin = { dataset, index_sha256: await sha256Hex(text) };
    const view = await loadOverlayDatasetView({ index_text: text, records: [{ record_number: 1, content: input.records[0].content }] }, [pin]);
    expect(computeLotOverlay(view, o.lot)).toMatchObject({ lot_within_features: "not_established", candidate_records: [1] });
  });
  it("unrelated invalid feature does not block a valid lot or its negative", async () => {
    const o = await synthetic("High", "valid", false, true);
    expect(o.view.entries()[1].geometry_state).toBe("invalid");
    expect(computeLotOverlay(o.view, o.lot)).toMatchObject({ lot_within_features: "whole_lot", classes_on_lot: ["High"], candidate_records: [1] });
    expect(sraResult(o, false).result.status).toBe("consistent_with_source");
  });
  it.each([["Very High", true, "disqualifying_per_source"], ["High", false, "consistent_with_source"], ["Moderate", false, "consistent_with_source"]] as const)("valid %s retains the computed class behavior", async (label, value, expected) => {
    const o = await synthetic(label);
    expect(sraResult(o, value).result.status).toBe(expected);
  });
  it.each([true, false])("manual class/coverage claims cannot bypass invalid geometry for %s", async (value) => {
    const o = await synthetic(value ? "Very High" : "Moderate", "invalid");
    const { evidence, authority } = sraResult(o, value);
    authority.coverage = value ? "whole_parcel" : "none_of_parcel";
    if (authority.qualifiers?.family !== "hazard_map") throw new Error("Wrong family");
    authority.qualifiers.map_covers_lot = "yes";
    expect(screen([evidence], [authority], o, registries(), VH, false).status).toBe("unknown");
    const typed = structuredClone(authority);
    if (typed.qualifiers?.family !== "hazard_map") throw new Error("Wrong family");
    Object.assign(typed.qualifiers.lot_overlay!, { classes_on_lot: value ? ["Very High"] : ["High"], map_covers_lot: "yes" });
    expect(() => parseProgramEvidenceAuthority([typed], [evidence])).toThrow();
  });
  it("validity-record geometry hash mismatch prevents building an establishing index", async () => {
    const input = indexInput();
    await expect(shapefileTopologyIndexText({ ...input, topology: { archive_sha256: "0".repeat(64), manifest_sha256: "4".repeat(64),
      records: [{ record_number: 1, geometry_sha256: "f".repeat(64), state: "valid", diagnostic: null }] } })).rejects.toThrow("geometry hash");
  });
  it("geometry mutation after validity derivation cannot become a verified view", async () => {
    // Move a collinear intermediate point without changing extent, layout or length:
    // only the cryptographic check catches this altered source geometry.
    const input = indexInput("Very High", polygonRecordContent([[0,0],[0,100],[50,100],[100,100],[100,0],[0,0]]));
    const text = await testOnlySraIndexText(input);
    const pin = { dataset, index_sha256: await sha256Hex(text) };
    const mutated = input.records[0].content.slice();
    new DataView(mutated.buffer).setFloat64(48 + 16 * 2, 51, true);
    await expect(loadOverlayDatasetView({ index_text: text, records: [{ record_number: 1, content: mutated }] }, [pin])).rejects.toThrow("does not match the index");
  });
  it("changing an invalidity verdict cannot bypass the pinned index hash", async () => {
    const o = await synthetic("Very High", "invalid");
    const tampered = o.derived.index_text.replace(' invalid "TEST-ONLY self-intersection"', " valid null");
    expect(tampered).not.toBe(o.derived.index_text);
    await expect(loadOverlayDatasetView({ index_text: tampered, records: o.derived.records }, [o.pin])).rejects.toThrow("not the one pinned");
  });
  it("every synthetic verdict binds to the unchanged geometry bytes", async () => {
    const input = indexInput();
    const geometry_sha256 = await sha256HexBytes(input.records[0].content);
    const text = await shapefileTopologyIndexText({ ...input, topology: { archive_sha256: "0".repeat(64), manifest_sha256: "4".repeat(64),
      records: [{ record_number: 1, geometry_sha256, state: "valid", diagnostic: null }] } });
    expect(parseOverlayIndex(text).entries[0]).toMatchObject({ content_sha256: geometry_sha256, geometry_state: "valid" });
  });
});
