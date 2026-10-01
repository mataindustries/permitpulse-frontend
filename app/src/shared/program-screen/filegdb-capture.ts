import { extractDatasetArchivePages, readZipCentralDirectory, readZipMember, xmlTextLines } from "./dataset-archive";

/** Narrow, lossless reader for the two reviewed FileGDB table layouts. It reads
 * active tablx slots, never scans deleted metadata copies for matching text. */
export const FILEGDB_EXTRACTOR = "program-screen-filegdb-manifest";
export const FILEGDB_VERSION = "1.0.0";
export const LRA_LAYER = "FHSALRA25_v1_All";
export const LRA_DIRECTORY = "FHSZLRA25_1_All.gdb";
export const LRA_METADATA_SHA256 = "1bbf01d7df12ebaf60376c95a23305dcfc63d81d49e3661ac4395c17591bfbbb";
const SCHEMAS = {
  catalog: "9835b86b9c18de4ea809ca6f128ffde5a381b07c6ccae48f299968dde5b77c85",
  items: "cd4fcf6b15071868ced5a5941af0e373b8d14bb35234a4368fd1881dc4b3a938",
  features: "407b092fff41237cbb616a7c41ff155b9343eb89d312df1f05ae8a1505774e2b",
};
const fail = (message: string): never => {
  throw new Error(`FileGDB: ${message}`);
};
export async function gdbSha(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
class Row {
  offset = 0;
  constructor(readonly bytes: Uint8Array) {}
  take(n: number): Uint8Array {
    if (!Number.isSafeInteger(n) || n < 0 || this.offset + n > this.bytes.length) fail("truncated row");
    const b = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return b;
  }
  integer(n: number): number {
    const b = this.take(n);
    const v = new DataView(b.buffer);
    return n === 2 ? v.getInt16(0, true) : v.getInt32(0, true);
  }
  variable(): number {
    let v = 0,
      multiplier = 1;
    for (let n = 0; n < 8; n++) {
      const b = this.take(1)[0];
      v += (b & 127) * multiplier;
      if (!(b & 128)) {
        if (!Number.isSafeInteger(v)) fail("unsafe length");
        return v;
      }
      multiplier *= 128;
    }
    return fail("invalid length");
  }
  blob(): Uint8Array {
    return this.take(this.variable());
  }
  string(): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(this.blob());
  }
}
async function rows(
  table: Uint8Array,
  index: Uint8Array,
  schema: string,
): Promise<Array<{ fid: number; bytes: Uint8Array }>> {
  const v = new DataView(table.buffer, table.byteOffset, table.byteLength),
    x = new DataView(index.buffer, index.byteOffset, index.byteLength);
  if (v.getUint32(0, true) !== 3 || x.getUint32(0, true) !== 3 || x.getUint32(12, true) !== 5)
    fail("unreviewed table/index version");
  const fieldOffset = Number(v.getBigUint64(32, true));
  const length = v.getUint32(fieldOffset, true);
  if ((await gdbSha(table.slice(fieldOffset, fieldOffset + 4 + length))) !== schema) fail("unreviewed field layout");
  const count = x.getUint32(8, true);
  const result = [];
  for (let fid = 1; fid <= count; fid++) {
    const slot = 16 + (fid - 1) * 5;
    if (slot + 5 > index.length) fail("truncated active slot index");
    let offset = 0;
    for (let j = 4; j >= 0; j--) offset = offset * 256 + index[slot + j];
    if (offset === 0) continue;
    if (offset + 4 > table.length) fail("active slot outside table");
    const size = v.getInt32(offset, true);
    if (size < 0 || offset + 4 + size > table.length) fail("active slot points at deleted/truncated row");
    result.push({ fid, bytes: table.slice(offset + 4, offset + 4 + size) });
  }
  return result;
}
export interface FileGdbCapture {
  metadata_xml: Uint8Array;
  association: {
    fid: number;
    name: string;
    physical_name: string;
    path: string;
    definition_sha256: string;
    metadata_sha256: string;
  };
  features: Array<{
    fid: number;
    label: string;
    code: number;
    area: string;
    native_sha256: string;
  }>;
}
export async function readLraFileGdb(bytes: Uint8Array): Promise<FileGdbCapture> {
  const entries = readZipCentralDirectory(bytes);
  const member = async (name: string) => {
    const e = entries.find((e) => e.name === `${LRA_DIRECTORY}/${name}`);
    if (!e) fail(`missing ${name}`);
    return readZipMember(bytes, e!);
  };
  const items = await rows(await member("a00000004.gdbtable"), await member("a00000004.gdbtablx"), SCHEMAS.items);
  const catalog = await rows(await member("a00000001.gdbtable"), await member("a00000001.gdbtablx"), SCHEMAS.catalog);
  const layerTables = catalog.filter((row) => new Row(row.bytes).string() === LRA_LAYER);
  if (layerTables.length !== 1 || layerTables[0].fid !== 9) fail("active layer is not the indexed feature table");
  const selected = [];
  for (const item of items) {
    const r = new Row(item.bytes);
    const mask = r.integer(2) & 65535;
    r.take(32);
    const fields: Array<string | number | null> = [];
    for (let i = 0; i < 10; i++) {
      fields.push(mask & (1 << i) ? null : i === 3 || i === 4 ? r.integer(4) : r.string());
    }
    if (fields[0] === LRA_LAYER) selected.push({ item, fields });
  }
  if (selected.length !== 1) fail("the active layer must have exactly one metadata row");
  const { item, fields } = selected[0];
  const [name, physical, path] = fields as string[];
  if (physical !== LRA_LAYER.toUpperCase() || path !== `\\${LRA_LAYER}`) fail("metadata-to-layer identity differs");
  const definition = fields[8] as string,
    documentation = fields[9] as string;
  if (
    !definition.includes(`<Name>${LRA_LAYER}</Name>`) ||
    !definition.includes(`<CatalogPath>\\${LRA_LAYER}</CatalogPath>`) ||
    !definition.includes("<DSID>3</DSID>")
  )
    fail("metadata definition is not the active feature class");
  const match = /<metadata\b[\s\S]*?<\/metadata>/.exec(documentation);
  if (!match) fail("missing active metadata XML");
  const xml = new TextEncoder().encode(match![0]);
  const metadataHash = await gdbSha(xml);
  if (metadataHash !== LRA_METADATA_SHA256) fail("active metadata XML differs from approved bytes");
  const features = [];
  for (const feature of await rows(
    await member("a00000009.gdbtable"),
    await member("a00000009.gdbtablx"),
    SCHEMAS.features,
  )) {
    const r = new Row(feature.bytes),
      mask = r.take(1)[0];
    if (mask & 15) fail(`feature ${feature.fid} has null geometry/class/area`);
    r.blob();
    const area = r.string(),
      code = r.integer(2),
      label = r.string();
    features.push({
      fid: feature.fid,
      area,
      code,
      label,
      native_sha256: await gdbSha(feature.bytes),
    });
  }
  return {
    metadata_xml: xml,
    association: {
      fid: item.fid,
      name,
      physical_name: physical,
      path,
      definition_sha256: await gdbSha(new TextEncoder().encode(definition)),
      metadata_sha256: metadataHash,
    },
    features,
  };
}
export function isFileGdbArchive(bytes: Uint8Array): boolean {
  const entries = readZipCentralDirectory(bytes);
  return (
    entries.some((e) => e.name === `${LRA_DIRECTORY}/a00000004.gdbtable`) &&
    !entries.some((e) => /\.shp$/i.test(e.name))
  );
}
export async function extractFileGdbPages(bytes: Uint8Array): Promise<string[]> {
  const base = await extractDatasetArchivePages(bytes),
    gdb = await readLraFileGdb(bytes);
  const values = (field: "label" | "area") => {
    const counts = new Map<string, number>();
    for (const f of gdb.features) counts.set(f[field], (counts.get(f[field]) ?? 0) + 1);
    return [...counts]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([v, n]) => `${JSON.stringify(v)} ${n}`)
      .join("; ");
  };
  const summary = [
    `${FILEGDB_EXTRACTOR} ${FILEGDB_VERSION}`,
    `layer ${LRA_LAYER}`,
    `active metadata association ${JSON.stringify(gdb.association)}`,
    `records ${gdb.features.length}`,
    "shape type MultiPolygon",
    "crs EPSG:3310",
    `values FHSZ_Description: ${values("label")}`,
    `values SRA: ${values("area")}`,
    ...xmlTextLines(new TextDecoder().decode(gdb.metadata_xml), "active FileGDB metadata"),
  ];
  return [...base, summary.join("\n")];
}
