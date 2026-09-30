import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { programAuthorityRegistries } from "../src/shared/program-screen/authority-policy";
import { readZipCentralDirectory, readZipMember } from "../src/shared/program-screen/dataset-archive";
import { readLraFileGdb, LRA_DIRECTORY } from "../src/shared/program-screen/filegdb-capture";
import { LRA_DATASET_ID, LRA_PACKAGE_ID } from "../src/shared/program-screen/lra-authority-package";
import {
  buildLraOverlay,
  overlayIndexPinFor,
  parseOverlayIndex,
  type FileGdbFeatureInput,
} from "../src/shared/program-screen/overlay-dataset";
import { officialSourceCaptureIssues, sha256Hex, sha256HexBytes } from "../src/shared/program-screen/source-capture";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--features" || args[2] !== "--output")
  throw new Error(
    "Usage: build-program-screen-lra-overlay --features <pinned offline NDJSON> --output <private directory>",
  );
const root = resolve(import.meta.dirname, "../../../.."),
  output = resolve(args[3]);
// Bundled CLI runs under app/node_modules/.cache/permitpulse.
const privateRoot = resolve(root, ".private");
if (!output.startsWith(`/tmp${sep}`) && !output.startsWith(`${privateRoot}${sep}`))
  throw new Error("Output must be outside the public checkout under /tmp, or under ignored .private/.");
const directory = `app/fixtures/program-screen/official-sources/${LRA_DATASET_ID}`,
  capture = resolve(root, directory);
const metadata = JSON.parse(await readFile(resolve(capture, "metadata.json"), "utf8")),
  zip = new Uint8Array(await readFile(resolve(capture, "original.zip"))),
  extracted = await readFile(resolve(capture, "extracted.txt"), "utf8");
const issues = await officialSourceCaptureIssues({
  directory,
  metadata,
  original: zip,
  extracted,
});
if (issues.length) throw new Error(issues.join("\n"));
const source = programAuthorityRegistries.sources.find((s) => s.authority_source_id === LRA_PACKAGE_ID)!;
const dataset = source.package!.members.overlay_dataset,
  pin = overlayIndexPinFor(dataset)!;
const native = await readLraFileGdb(zip),
  decoded: FileGdbFeatureInput[] = (await readFile(args[1], "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
const table = readZipCentralDirectory(zip).find((e) => e.name === `${LRA_DIRECTORY}/a00000009.gdbtable`)!;
const derived = await buildLraOverlay({
  dataset,
  native,
  decoded,
  archive_sha256: await sha256HexBytes(zip),
  feature_table_sha256: await sha256HexBytes(await readZipMember(zip, table)),
});
if ((await sha256Hex(derived.index_text)) !== pin.index_sha256)
  throw new Error("Derived index differs from the reviewed pin; never publish or repin automatically.");
await mkdir(output, { recursive: true });
const entries = parseOverlayIndex(derived.index_text).entries;
for (const r of derived.records)
  await writeFile(resolve(output, `record-${entries[r.record_number - 1].content_sha256}.bin`), r.content);
await writeFile(resolve(output, `index-${pin.index_sha256}.txt`), derived.index_text);
console.log(
  `Verified ${derived.records.length} unchanged source features; index SHA-256 ${pin.index_sha256}. Output: ${output}`,
);
