import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import fireConflictFixture from "../fixtures/case-integrity/fire-hazard-official-source-conflict.json";
import unknownLookupFixture from "../fixtures/case-integrity/record-lookup-unknown.json";
import { buildPublicCaseIntegrityDemoPayload } from "../src/shared/build-week-integrity/public-demo";

const fileName = "case-integrity-demo-data.json";
const outputPath = resolve(
  process.cwd(),
  process.argv[2] ?? `../dist/assets/${fileName}`,
);

if (basename(outputPath) !== fileName) {
  throw new Error(`Public Case Integrity demo output must be named ${fileName}.`);
}

const payload = buildPublicCaseIntegrityDemoPayload(
  fireConflictFixture,
  unknownLookupFixture,
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Generated ${outputPath}`);
