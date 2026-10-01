import { sraValidityProfile as profile } from "../../src/shared/program-screen/sra-validity-profile";
import type { ProgramCaptureRef } from "../../src/shared/program-screen/authority-policy";
import {
  OverlayInputError, overlayIndexFromShapefile, parseOverlayIndex, shapefileRecordContents,
  shapefileTopologyIndexText, type ShapefileTopologyRecord,
} from "../../src/shared/program-screen/overlay-dataset";
import { sha256Hex, sha256HexBytes } from "../../src/shared/program-screen/source-capture";

export const SRA_DATASET_ID = "calfire-fhszsra-23-3-data";

interface SraValidityManifest {
  schema_version: string;
  tool: typeof profile.tool;
  source: {
    source_id: string; archive_sha256: string; sha256_extracted: string; layer: string; crs_epsg: number;
    class_field: string; members: Record<string, string>;
  };
  counts: typeof profile.counts;
  features: Array<ShapefileTopologyRecord & { fid: number; label: string }>;
}

/** Offline builder/verification only. Runtime consumes only the pinned index.
 * The native verdicts must come from the exact reproduced, reviewed manifest. */
export async function buildSraOverlay(input: {
  dataset: ProgramCaptureRef; layer: string; crs_epsg: number; class_field: string;
  archive_sha256: string; shp: Uint8Array; shx: Uint8Array; dbf: Uint8Array; validity_text: string;
}): Promise<{ index_text: string; records: Array<{ record_number: number; content: Uint8Array }> }> {
  const refuse = (message: string): never => { throw new OverlayInputError(message); };
  if (await sha256Hex(input.validity_text) !== profile.validity_manifest_sha256)
    refuse("SRA validity manifest differs from the pinned SHA-256");
  const manifest = JSON.parse(input.validity_text) as SraValidityManifest;
  if (manifest.schema_version !== "program-screen-sra-validity-v1" ||
    JSON.stringify(manifest.tool) !== JSON.stringify(profile.tool) ||
    JSON.stringify(manifest.counts) !== JSON.stringify(profile.counts) ||
    input.archive_sha256 !== profile.archive_sha256 || manifest.source.archive_sha256 !== input.archive_sha256 ||
    manifest.source.source_id !== input.dataset.source_id || manifest.source.sha256_extracted !== input.dataset.sha256_extracted ||
    manifest.source.layer !== input.layer || manifest.source.crs_epsg !== input.crs_epsg || manifest.source.class_field !== input.class_field)
    refuse("SRA validity source/tool/inventory association differs");
  for (const [name, bytes] of [["shp", input.shp], ["shx", input.shx], ["dbf", input.dbf]] as const)
    if (await sha256HexBytes(bytes) !== manifest.source.members[name]) refuse(`SRA validity ${name} member hash differs`);
  const legacy = await overlayIndexFromShapefile(input);
  const { header, entries } = parseOverlayIndex(legacy);
  if (manifest.features.length !== entries.length || entries.length !== profile.counts.features)
    refuse("SRA validity feature count differs");
  for (const [i, entry] of entries.entries()) {
    const proof = manifest.features[i];
    if (proof.record_number !== entry.record_number || proof.fid !== i || proof.label !== entry.label || proof.geometry_sha256 !== entry.content_sha256)
      refuse(`SRA validity feature ${i + 1} differs from the unchanged source record`);
  }
  const contents = shapefileRecordContents(input.shp, input.shx);
  const index_text = await shapefileTopologyIndexText({
    dataset: input.dataset, layer: input.layer, crs_epsg: input.crs_epsg, class_field: input.class_field,
    members: header.members as { shp: string; shx: string; dbf: string },
    records: contents.map((content, i) => ({ content, label: entries[i].label })),
    topology: { archive_sha256: input.archive_sha256, manifest_sha256: profile.validity_manifest_sha256, records: manifest.features },
  });
  return { index_text, records: contents.map((content, i) => ({ record_number: i + 1, content })) };
}
