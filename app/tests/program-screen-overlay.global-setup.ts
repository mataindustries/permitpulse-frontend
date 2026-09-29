import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TestProject } from "vitest/node";
import { readZipCentralDirectory, readZipMember } from "../src/shared/program-screen/dataset-archive";
import {
  overlayCandidates,
  overlayIndexFromShapefile,
  parseOverlayIndex,
  shapefileRecordContents,
  type OverlayExtent,
} from "../src/shared/program-screen/overlay-dataset";

/**
 * Phase 3E: the overlay index and records, derived in Node from the exact
 * archive bytes of the CAL FIRE FHSZSRA_23_3 capture.
 *
 * The tests run in workerd, which receives each module over a WebSocket capped
 * at 32 MiB, and the archive is 36 MB (its .shp is 154 MB uncompressed). This
 * setup re-derives the overlay index from the archive with the production
 * code, and extracts every record whose extent meets a TEST-ONLY lot's box.
 * The tests load both through `loadOverlayDatasetView`, which checks the index
 * against its pin and each record against the index, so nothing provided here
 * is trusted as it is.
 */
export interface ProvidedOverlayDataset {
  index_text: string | null;
  error: string | null;
  /** Record content bytes (base64) by record number. */
  records: Record<string, string>;
}

declare module "vitest" {
  export interface ProvidedContext {
    programScreenOverlayDataset: ProvidedOverlayDataset;
  }
}

const DATASET_DIR = "app/fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data";
export const TEST_ONLY_LOT_DIR = "app/fixtures/program-screen/test-only-lot-geometries";

/** The box of every position in a TEST-ONLY lot file, whatever its validity. */
function lotBox(text: string): OverlayExtent | null {
  const positions = (JSON.parse(text) as { coordinates?: number[][][] }).coordinates?.flat() ?? [];
  if (positions.length === 0) return null;
  const xs = positions.map((position) => position[0]);
  const ys = positions.map((position) => position[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export default async function setup(project: TestProject): Promise<void> {
  const repoRoot = resolve(project.config.root, "..");
  const provided: ProvidedOverlayDataset = { index_text: null, error: null, records: {} };
  try {
    const directory = resolve(repoRoot, DATASET_DIR);
    const metadata = JSON.parse(await readFile(resolve(directory, "metadata.json"), "utf8"));
    const context = metadata.dataset_archive;
    const zip = new Uint8Array(await readFile(resolve(directory, "original.zip")));
    const entries = readZipCentralDirectory(zip);
    const member = async (suffix: string) => {
      const entry = entries.find((candidate) => candidate.name === `${context.dataset_name}.${suffix}`);
      if (entry === undefined) throw new Error(`The archive has no ${context.dataset_name}.${suffix}.`);
      return readZipMember(zip, entry);
    };
    const [shp, shx, dbf] = [await member("shp"), await member("shx"), await member("dbf")];
    provided.index_text = await overlayIndexFromShapefile({
      dataset: { source_id: metadata.source_id, sha256_extracted: metadata.sha256_extracted },
      layer: context.dataset_name,
      crs_epsg: context.crs.epsg,
      class_field: context.class_field.field,
      shp,
      shx,
      dbf,
    });
    const { entries: indexEntries } = parseOverlayIndex(provided.index_text);
    const contents = shapefileRecordContents(shp, shx);
    const lotDirectory = resolve(repoRoot, TEST_ONLY_LOT_DIR);
    for (const file of (await readdir(lotDirectory)).filter((name) => name.endsWith(".json")).sort()) {
      const box = lotBox(await readFile(resolve(lotDirectory, file), "utf8"));
      if (box === null) continue;
      for (const entry of overlayCandidates(indexEntries, box)) {
        provided.records[String(entry.record_number)] = Buffer.from(contents[entry.record_number - 1]).toString("base64");
      }
    }
  } catch (error) {
    provided.error = error instanceof Error ? error.message : String(error);
  }
  project.provide("programScreenOverlayDataset", provided);
}
