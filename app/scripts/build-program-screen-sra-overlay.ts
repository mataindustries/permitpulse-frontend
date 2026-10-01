import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { readZipCentralDirectory, readZipMember } from "../src/shared/program-screen/dataset-archive";
import { overlayIndexPinFor, parseOverlayIndex } from "../src/shared/program-screen/overlay-dataset";
import { buildSraOverlay, SRA_DATASET_ID } from "./lib/build-sra-overlay";
import { officialSourceCaptureIssues, sha256Hex, sha256HexBytes } from "../src/shared/program-screen/source-capture";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--validity" || args[2] !== "--output")
  throw new Error("Usage: build-program-screen-sra-overlay --validity <pinned native manifest> --output <private directory>");
const root = resolve(import.meta.dirname, "../../../.."), output = resolve(args[3]);
if (!output.startsWith(`/tmp${sep}`) && !output.startsWith(`${resolve(root, ".private")}${sep}`))
  throw new Error("Output must be outside the public checkout under /tmp, or under ignored .private/.");
const directory = `app/fixtures/program-screen/official-sources/${SRA_DATASET_ID}`, capture = resolve(root, directory);
const metadata = JSON.parse(await readFile(resolve(capture, "metadata.json"), "utf8"));
const zip = new Uint8Array(await readFile(resolve(capture, "original.zip")));
const extracted = await readFile(resolve(capture, "extracted.txt"), "utf8");
const issues = await officialSourceCaptureIssues({ directory, metadata, original: zip, extracted });
if (issues.length) throw new Error(issues.join("\n"));
const source = programAuthorityRegistries.sources.find((s) => s.authority_source_id === "calfire-sra-fhsz-2023-09-29")!;
const dataset = source.package!.members.overlay_dataset, pin = overlayIndexPinFor(dataset)!;
const entries = readZipCentralDirectory(zip);
const member = async (suffix: string) => {
  const entry = entries.find((candidate) => candidate.name === `${metadata.dataset_archive.dataset_name}.${suffix}`);
  if (entry === undefined) throw new Error(`Missing preserved SRA ${suffix} member`);
  return readZipMember(zip, entry);
};
const derived = await buildSraOverlay({
  dataset, layer: metadata.dataset_archive.dataset_name, crs_epsg: metadata.dataset_archive.crs.epsg,
  class_field: metadata.dataset_archive.class_field.field, archive_sha256: await sha256HexBytes(zip),
  shp: await member("shp"), shx: await member("shx"), dbf: await member("dbf"), validity_text: await readFile(args[1], "utf8"),
});
if (await sha256Hex(derived.index_text) !== pin.index_sha256)
  throw new Error("Derived SRA index differs from the reviewed pin; never publish or repin automatically.");
await mkdir(output, { recursive: true });
const index = parseOverlayIndex(derived.index_text);
for (const r of derived.records) await writeFile(resolve(output, `record-${index.entries[r.record_number - 1].content_sha256}.bin`), r.content);
await writeFile(resolve(output, `index-${pin.index_sha256}.txt`), derived.index_text);
console.log(`Verified ${derived.records.length} unchanged SRA features; topology index SHA-256 ${pin.index_sha256}. Output: ${output}`);
