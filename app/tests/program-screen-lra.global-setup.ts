import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import type { TestProject } from "vitest/node";
import { crc32, readZipCentralDirectory, readZipMember } from "../src/shared/program-screen/dataset-archive";
import { readLraFileGdb, LRA_DIRECTORY } from "../src/shared/program-screen/filegdb-capture";
import {
  buildLraOverlay,
  parseOverlayIndex,
  type FileGdbFeatureInput,
} from "../src/shared/program-screen/overlay-dataset";
import { sha256HexBytes, officialSourceCaptureIssues } from "../src/shared/program-screen/source-capture";

export interface ProvidedLraDataset {
  error: string | null;
  index_text: string | null;
  records: Record<string, string>;
  active_xml: string;
  association: unknown;
  native_mutations: Record<string, string>;
  source_counts: Record<string, number>;
  invalid_counts: Record<string, number>;
  curve_count: number;
  multipart_count: number;
  hole_count: number;
}
declare module "vitest" {
  export interface ProvidedContext {
    programScreenLraDataset: ProvidedLraDataset;
  }
}

/** Repackage only TEST-ONLY mutations in memory, with correct ZIP CRCs. The
 * preserved official ZIP is never rewritten or replaced. */
function testZip(members: Array<{ name: string; bytes: Uint8Array }>): Uint8Array {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const m of members) {
    const name = Buffer.from(m.name),
      body = deflateRawSync(m.bytes),
      crc = crc32(m.bytes);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(body.length, 18);
    h.writeUInt32LE(m.bytes.length, 22);
    h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(m.bytes.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    local.push(h, name, body);
    central.push(c, name);
    offset += h.length + name.length + body.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directory, end]));
}

export default async function setup(project: TestProject): Promise<void> {
  const root = resolve(project.config.root, ".."),
    cache = resolve(project.config.root, "node_modules/.cache/permitpulse/lra");
  const p: ProvidedLraDataset = {
    error: null,
    index_text: null,
    records: {},
    active_xml: "",
    association: null,
    native_mutations: {},
    source_counts: {},
    invalid_counts: {},
    curve_count: 0,
    multipart_count: 0,
    hole_count: 0,
  };
  try {
    const directory = resolve(root, "app/fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data"),
      archive = resolve(directory, "original.zip");
    const metadata = JSON.parse(await readFile(resolve(directory, "metadata.json"), "utf8"));
    await mkdir(cache, { recursive: true });
    const stream = resolve(cache, "features.ndjson");
    execFileSync(
      process.env.PP_LRA_PYTHON ?? "/usr/bin/python3",
      [resolve(root, "tools/program-screen/export-lra-filegdb.py"), archive, stream],
      { timeout: 60000, stdio: "pipe" },
    );
    const decoded: FileGdbFeatureInput[] = (await readFile(stream, "utf8"))
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));
    const zip = new Uint8Array(await readFile(archive)),
      entries = readZipCentralDirectory(zip),
      native = await readLraFileGdb(zip);
    const mutatedArchive = zip.slice();
    mutatedArchive[10] ^= 1; // ZIP timestamp only: member CRCs and extracted text still match.
    p.native_mutations.archive_hash =
      (
        await officialSourceCaptureIssues({
          directory: "app/fixtures/program-screen/official-sources/calfire-fhszlra-25-1-all-data",
          metadata,
          original: mutatedArchive,
          extracted: await readFile(resolve(directory, "extracted.txt"), "utf8"),
        })
      ).join("\n") || "ACCEPTED";
    const table = entries.find((e) => e.name === `${LRA_DIRECTORY}/a00000009.gdbtable`)!;
    const derived = await buildLraOverlay({
      dataset: {
        source_id: metadata.source_id,
        sha256_extracted: metadata.sha256_extracted,
      },
      native,
      decoded,
      archive_sha256: await sha256HexBytes(zip),
      feature_table_sha256: await sha256HexBytes(await readZipMember(zip, table)),
    });
    p.index_text = derived.index_text;
    p.active_xml = new TextDecoder().decode(native.metadata_xml);
    p.association = native.association;
    await writeFile(resolve(cache, "index.txt"), derived.index_text);
    const selected = new Set<number>();
    for (const f of decoded) {
      p.source_counts[f.label] = (p.source_counts[f.label] ?? 0) + 1;
      if (f.source_validity !== "valid") p.invalid_counts[f.label] = (p.invalid_counts[f.label] ?? 0) + 1;
      if (f.native_wkb !== null) p.curve_count++;
      if (f.coordinates.length > 1) p.multipart_count++;
      p.hole_count += f.coordinates.reduce((n, poly) => n + Math.max(0, poly.length - 1), 0);
    }
    // Small, real records exercise runtime coordinate/grouping preservation.
    for (const label of ["Very High", "High", "Moderate", "NonWildland"]) {
      const f = decoded
        .filter((f) => f.label === label && f.state === "valid")
        .sort((a, b) => JSON.stringify(a.coordinates).length - JSON.stringify(b.coordinates).length)[0];
      selected.add(f.fid);
    }
    for (const predicate of [
      (f: FileGdbFeatureInput) => f.coordinates.length > 1,
      (f: FileGdbFeatureInput) => f.coordinates.some((poly) => poly.length > 1),
      (f: FileGdbFeatureInput) => f.native_wkb !== null,
      (f: FileGdbFeatureInput) => f.state === "invalid",
    ]) {
      const f = decoded.filter(predicate).sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length)[0];
      selected.add(f.fid);
    }
    const index = parseOverlayIndex(derived.index_text);
    for (const record of derived.records) {
      await writeFile(resolve(cache, `${index.entries[record.record_number - 1].content_sha256}.json`), record.content);
      if (selected.has(record.record_number))
        p.records[String(record.record_number)] = Buffer.from(record.content).toString("base64");
    }
    const members = await Promise.all(
      entries
        .filter((e) => /\/a0000000[149]\.gdbtabl(?:e|x)$/.test(e.name))
        .map(async (e) => ({
          name: e.name,
          bytes: await readZipMember(zip, e),
        })),
    );
    // Correct CRCs prevent a corrupt ZIP check from hiding the metadata and
    // association checks these mutations must reach.
    for (const kind of ["metadata_xml", "metadata_to_layer"]) {
      const mutated = members.map((m) => ({
          name: m.name,
          bytes: m.bytes.slice(),
        })),
        items = mutated.find((m) => m.name.endsWith("a00000004.gdbtable"))!;
      const pattern = Buffer.from(kind === "metadata_xml" ? p.active_xml : "FHSALRA25_V1_ALL"),
        at = Buffer.from(items.bytes).indexOf(pattern);
      if (at < 0) throw new Error("Mutation target absent");
      items.bytes[at + (kind === "metadata_xml" ? 200 : 0)] ^= 1;
      try {
        await readLraFileGdb(testZip(mutated));
        p.native_mutations[kind] = "ACCEPTED";
      } catch (e) {
        p.native_mutations[kind] = e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    p.error = e instanceof Error ? e.message : String(e);
  }
  project.provide("programScreenLraDataset", p);
}
