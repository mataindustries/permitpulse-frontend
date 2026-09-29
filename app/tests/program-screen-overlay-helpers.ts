import { inject } from "vitest";
import type { ProgramLotOverlayInputs } from "../src/shared/program-screen/authority-gate";
import type { ProgramCaptureRef } from "../src/shared/program-screen/authority-policy";
import { loadReviewedLotGeometry, type ReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import {
  loadOverlayDatasetView,
  overlayIndexText,
  type OverlayDatasetView,
  type OverlayIndexPin,
} from "../src/shared/program-screen/overlay-dataset";
import { sha256Hex } from "../src/shared/program-screen/source-capture";

/**
 * Lot overlay inputs for the Program Screen tests (Phase 3E). Every lot and
 * lot geometry here is TEST-ONLY and fictional.
 *
 * - `realLotOverlay`: the real CAL FIRE FHSZSRA_23_3 overlay index and the
 *   records the TEST-ONLY lots need, derived from the pinned archive in Node
 *   (program-screen-overlay.global-setup.ts) and verified here against the
 *   shipped index pin. The lots are fictional squares placed at real
 *   locations in the dataset.
 * - `syntheticLotOverlay`: a TEST-ONLY dataset of four square features for
 *   TEST-ONLY packages, pinned by TEST-ONLY index pins passed like registries.
 */

/** What an authority block names: the lot geometry file in the case evidence store. */
export interface LotGeometryRef {
  store: "case_evidence_file";
  file_id: string;
  sha256: string;
}

export interface LotOverlayFixture<Name extends string> {
  inputs: ProgramLotOverlayInputs;
  view: OverlayDatasetView;
  lots: Readonly<Record<Name, LotGeometryRef>>;
  geometries: Readonly<Record<Name, ReviewedLotGeometry>>;
}

async function loadLots<Name extends string>(files: Record<Name, Uint8Array>) {
  const lots = {} as Record<Name, LotGeometryRef>;
  const geometries = {} as Record<Name, ReviewedLotGeometry>;
  for (const [name, bytes] of Object.entries(files) as Array<[Name, Uint8Array]>) {
    const geometry = await loadReviewedLotGeometry({ file_id: `test-only-lot-${name}`, bytes });
    geometries[name] = geometry;
    lots[name] = { store: "case_evidence_file", file_id: geometry.file_id, sha256: geometry.sha256 };
  }
  return { lots, geometries };
}

/* -------------------------------------------------------- the real dataset */

const realLotFiles = import.meta.glob("../fixtures/program-screen/test-only-lot-geometries/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const REAL_LOT_NAMES = [
  "whole-high",
  "whole-very-high",
  "whole-moderate",
  "very-high-moderate",
  "high-moderate",
  "high-very-high",
  "part-moderate-outside-sra",
  "part-high-outside-sra",
  "outside-sra",
  "outside-sra-near-features",
  "whole-high-l-shape-with-hole",
  "invalid-bow-tie",
  "invalid-other-crs",
] as const;
export type RealLotName = (typeof REAL_LOT_NAMES)[number];

/** The real FHSZSRA_23_3 overlay: verified against the shipped index pin, never TEST-ONLY pins. */
export async function realLotOverlay(): Promise<LotOverlayFixture<RealLotName>> {
  const provided = inject("programScreenOverlayDataset");
  if (provided.index_text === null) throw new Error(`The overlay index was not derived: ${provided.error}`);
  const view = await loadOverlayDatasetView({
    index_text: provided.index_text,
    records: Object.entries(provided.records).map(([recordNumber, base64]) => ({
      record_number: Number(recordNumber),
      content: Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)),
    })),
  });
  const files = {} as Record<RealLotName, Uint8Array>;
  for (const name of REAL_LOT_NAMES) {
    const text = realLotFiles[`../fixtures/program-screen/test-only-lot-geometries/test-only-lot-${name}.json`];
    if (text === undefined) throw new Error(`No TEST-ONLY lot geometry ${name}.`);
    files[name] = new TextEncoder().encode(text);
  }
  const { lots, geometries } = await loadLots(files);
  return { inputs: { datasets: [view], lot_geometries: Object.values(geometries) }, view, lots, geometries };
}

/* --------------------------------------------------- the synthetic dataset */

/** A Polygon (type 5) record's content: one closed ring. */
export function polygonRecordContent(ring: ReadonlyArray<readonly [number, number]>): Uint8Array {
  const bytes = new Uint8Array(44 + 4 + 16 * ring.length);
  const view = new DataView(bytes.buffer);
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  view.setInt32(0, 5, true);
  [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((value, index) => view.setFloat64(4 + 8 * index, value, true));
  view.setInt32(36, 1, true);
  view.setInt32(40, ring.length, true);
  view.setInt32(44, 0, true);
  ring.forEach(([x, y], index) => {
    view.setFloat64(48 + 16 * index, x, true);
    view.setFloat64(56 + 16 * index, y, true);
  });
  return bytes;
}

const square = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [
  [x0, y0],
  [x0, y1],
  [x1, y1],
  [x1, y0],
  [x0, y0],
];

function lotFile(ring: Array<[number, number]>, crs = "EPSG:3310"): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify({ schema_version: "program-screen-lot-geometry-v1", crs, type: "Polygon", coordinates: [ring] })}\n`,
  );
}

export const SYNTHETIC_LOT_NAMES = [
  "in-very-high",
  "in-high",
  "in-moderate",
  "very-high-and-high",
  "high-and-moderate",
  "very-high-and-moderate",
  "moderate-and-outside",
  "very-high-and-outside",
  "high-and-outside",
  "outside",
  "in-numeric-label",
  "invalid-bow-tie",
] as const;
export type SyntheticLotName = (typeof SYNTHETIC_LOT_NAMES)[number];

/**
 * A TEST-ONLY dataset for a TEST-ONLY package whose overlay dataset is
 * `dataset`: Very High [0,100]x[0,100], High [100,200]x[0,100], Moderate
 * [200,300]x[0,100], Moderate [0,100]x[100,200] above the Very High one,
 * and a feature labelled with the numeric code "2" at [0,100]x[300,400].
 */
export async function syntheticLotOverlay(dataset: ProgramCaptureRef, classField = "CLASS"): Promise<LotOverlayFixture<SyntheticLotName>> {
  const features: Array<[string, Array<[number, number]>]> = [
    ["Very High", square(0, 0, 100, 100)],
    ["High", square(100, 0, 200, 100)],
    ["Moderate", square(200, 0, 300, 100)],
    ["Moderate", square(0, 100, 100, 200)],
    ["2", square(0, 300, 100, 400)],
  ];
  const records = features.map(([label, ring]) => ({ label, content: polygonRecordContent(ring) }));
  const indexText = await overlayIndexText({
    dataset,
    layer: "TEST_ONLY_FHSZ",
    crs_epsg: 3310,
    class_field: classField,
    members: { shp: "1".repeat(64), shx: "2".repeat(64), dbf: "3".repeat(64) },
    records,
  });
  const pins: OverlayIndexPin[] = [{ dataset, index_sha256: await sha256Hex(indexText) }];
  const view = await loadOverlayDatasetView(
    { index_text: indexText, records: records.map((record, index) => ({ record_number: index + 1, content: record.content })) },
    pins,
  );
  const { lots, geometries } = await loadLots<SyntheticLotName>({
    "in-very-high": lotFile(square(45, 45, 55, 55)),
    "in-high": lotFile(square(145, 45, 155, 55)),
    "in-moderate": lotFile(square(245, 45, 255, 55)),
    "very-high-and-high": lotFile(square(95, 45, 105, 55)),
    "high-and-moderate": lotFile(square(195, 45, 205, 55)),
    "very-high-and-moderate": lotFile(square(45, 95, 55, 105)),
    "moderate-and-outside": lotFile(square(295, 45, 305, 55)),
    "very-high-and-outside": lotFile(square(-5, 45, 5, 55)),
    "high-and-outside": lotFile(square(145, -5, 155, 5)),
    outside: lotFile(square(500, 500, 510, 510)),
    "in-numeric-label": lotFile(square(45, 345, 55, 355)),
    "invalid-bow-tie": lotFile([[45, 45], [55, 55], [55, 45], [45, 55], [45, 45]]),
  });
  return { inputs: { datasets: [view], lot_geometries: Object.values(geometries), index_pins: pins }, view, lots, geometries };
}
