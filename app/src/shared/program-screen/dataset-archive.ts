/**
 * `program-screen-zip-manifest` 1.0.0: the deterministic text of a GIS data
 * archive captured as the exact ZIP bytes the official host served (Phase 3D,
 * docs/PROGRAM_SCREEN_PHASE_3D_CALFIRE_SRA_PACKAGE.md).
 *
 * The ZIP itself is the capture; nothing is extracted to disk or re-zipped.
 * This code reads it in memory and writes one text "page" per section:
 *
 *   page 1   the sorted member manifest: every entry's name, size, CRC-32, and
 *            the SHA-256 of its uncompressed bytes;
 *   page 2+  one page per described member, in the same sorted order:
 *            `.cpg` and `.prj` as text, `.xml` as element text, `.dbf` as its
 *            attribute schema and a character-field value summary, `.shp` as
 *            its header, `.shx` as its record count.
 *
 * Every other member (a geodatabase copy, symbology, spatial indexes) is
 * pinned by its manifest line only. Pure code, so every check re-derives the
 * text from the bytes and compares it with `extracted.txt`. Changing a rule
 * means a new version, a recapture, and a human re-review.
 */

export const ZIP_MANIFEST_EXTRACTOR = "program-screen-zip-manifest" as const;
export const ZIP_MANIFEST_EXTRACTOR_VERSION = "1.0.0" as const;

/** Why an archive cannot be read by this extractor. */
export class DatasetArchiveError extends Error {}

export interface ZipEntry {
  name: string;
  directory: boolean;
  method: number;
  crc32: number;
  compressed_size: number;
  size: number;
  local_header_offset: number;
  name_bytes: Uint8Array;
}

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_STORED = 0;
const ZIP_DEFLATED = 8;

/** A ZIP starts with a local file header ("PK\x03\x04"). */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function fail(message: string): never {
  throw new DatasetArchiveError(message);
}

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (!utf8Flag && bytes.some((byte) => byte > 0x7f)) fail("a member name is neither ASCII nor flagged UTF-8");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("a member name is not valid UTF-8");
  }
}

/**
 * The central directory, in archive order. Refuses anything this extractor
 * does not read exactly: multi-disk, ZIP64, encryption, a compression method
 * other than stored or deflate, a duplicate or unsafe name, or a directory
 * that does not end where the end record says.
 */
export function readZipCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!isZip(bytes)) fail("the file is not a ZIP archive");
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) fail("no end-of-central-directory record");
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 8, true) !== count) {
    fail("multi-disk archives are not supported");
  }
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) fail("ZIP64 archives are not supported");
  if (directoryOffset + directorySize !== end) fail("the central directory does not end at the end record");

  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== ZIP_CENTRAL_HEADER) fail("a central directory header is malformed");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    if ((flags & 0x1) !== 0) fail("encrypted members are not supported");
    if (method !== ZIP_STORED && method !== ZIP_DEFLATED) fail(`compression method ${method} is not supported`);
    if (compressedSize === 0xffffffff || size === 0xffffffff || localHeaderOffset === 0xffffffff) fail("ZIP64 members are not supported");
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = decodeName(nameBytes, (flags & 0x800) !== 0);
    const segments = name.replace(/\/$/, "").split("/");
    if (name === "" || name.startsWith("/") || name.includes("\\") || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      fail(`member name ${JSON.stringify(name)} is not a safe relative path`);
    }
    entries.push({
      name,
      directory: name.endsWith("/"),
      method,
      crc32,
      compressed_size: compressedSize,
      size,
      local_header_offset: localHeaderOffset,
      name_bytes: nameBytes,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) fail("the central directory size does not match its entries");
  if (new Set(entries.map((entry) => entry.name)).size !== entries.length) fail("the archive has duplicate member names");
  return entries;
}

let crcTable: Uint32Array | null = null;

/** CRC-32 (ISO 3309), as ZIP records it. */
export function crc32(bytes: Uint8Array): number {
  if (crcTable === null) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The uncompressed bytes of one member, checked against its size and CRC-32. */
export async function readZipMember(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.local_header_offset;
  if (offset + 30 > bytes.length || view.getUint32(offset, true) !== ZIP_LOCAL_HEADER) fail(`${entry.name}: the local header is malformed`);
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const localName = bytes.subarray(offset + 30, offset + 30 + nameLength);
  if (localName.length !== entry.name_bytes.length || localName.some((byte, index) => byte !== entry.name_bytes[index])) {
    fail(`${entry.name}: the local header names another member`);
  }
  const start = offset + 30 + nameLength + extraLength;
  if (start + entry.compressed_size > bytes.length) fail(`${entry.name}: the member data runs past the end of the archive`);
  const data = bytes.subarray(start, start + entry.compressed_size);
  const member = entry.method === ZIP_STORED ? data.slice() : await inflateRaw(data);
  if (member.length !== entry.size) fail(`${entry.name}: the uncompressed size does not match the central directory`);
  if (crc32(member) !== entry.crc32) fail(`${entry.name}: the CRC-32 does not match the central directory`);
  return member;
}

async function sha256Of(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function utf8Text(bytes: Uint8Array, name: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return fail(`${name} is not valid UTF-8`);
  }
}

/** Codepoint order, so the manifest never depends on a locale. */
function byName(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/* ------------------------------------------------------------ XML text */

const XML_ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const RICH_TEXT_ENTITIES: Readonly<Record<string, string>> = { ...XML_ENTITIES, nbsp: " " };

function decodeEntities(text: string, named: Readonly<Record<string, string>>): string {
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g, (reference, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "�";
      return String.fromCodePoint(code);
    }
    return named[body] ?? reference;
  });
}

const RICH_TEXT_BLOCK_TAGS: ReadonlySet<string> = new Set([
  "br", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "table", "td", "th", "tr", "ul",
]);

/**
 * Esri metadata stores rich text as escaped HTML inside an element. Once the
 * XML references are decoded, a block tag becomes a line break, every other
 * tag is removed, and the rich-text references are decoded once more.
 */
function richText(text: string): string {
  if (!text.includes("<")) return text;
  const stripped = text.replace(/<\/?([A-Za-z][A-Za-z0-9]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g, (_tag, name: string) =>
    RICH_TEXT_BLOCK_TAGS.has(name.toLowerCase()) ? "\n" : "",
  );
  return decodeEntities(stripped, RICH_TEXT_ENTITIES);
}

const XML_TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!(?!--|\[CDATA\[)[^>]*>|<\/([A-Za-z_][\w.:-]*)\s*>|<([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gy;
const XML_ATTRIBUTE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * One line per attribute (`/path@name: value`) and per non-blank text node
 * (`/path: text`), in document order. Comments, declarations, and processing
 * instructions are dropped. Malformed XML is refused, never repaired.
 */
export function xmlTextLines(xml: string, name: string): string[] {
  const lines: string[] = [];
  const stack: string[] = [];
  const path = () => `/${stack.join("/")}`;
  XML_TOKEN.lastIndex = 0;
  let consumed = 0;
  for (let match = XML_TOKEN.exec(xml); match !== null; match = XML_TOKEN.exec(xml)) {
    consumed = XML_TOKEN.lastIndex;
    const [, cdata, endName, startName, attributes, selfClosing, text] = match;
    if (endName !== undefined) {
      if (stack.pop() !== endName) fail(`${name}: mismatched end tag </${endName}>`);
    } else if (startName !== undefined) {
      stack.push(startName);
      for (const attribute of (attributes ?? "").matchAll(XML_ATTRIBUTE)) {
        lines.push(`${path()}@${attribute[1]}: ${decodeEntities(attribute[2] ?? attribute[3], XML_ENTITIES)}`);
      }
      if (selfClosing === "/") stack.pop();
    } else if (cdata !== undefined || text !== undefined) {
      const value = cdata ?? decodeEntities(text as string, XML_ENTITIES);
      if (value.trim() === "") continue;
      if (stack.length === 0) fail(`${name}: text outside the root element`);
      lines.push(`${path()}: ${richText(value)}`);
    }
  }
  if (consumed !== xml.length) fail(`${name}: malformed XML at offset ${consumed}`);
  if (stack.length > 0) fail(`${name}: unclosed element <${stack[stack.length - 1]}>`);
  return lines;
}

/* ------------------------------------------------------- dBASE and shapefile */

/** Character fields with more distinct values than this are counted, not listed. */
const MAX_LISTED_VALUES = 50;

interface DbfField {
  name: string;
  type: string;
  length: number;
  decimals: number;
}

function dbfLines(bytes: Uint8Array, name: string): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33) fail(`${name}: the dBASE header is truncated`);
  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const fields: DbfField[] = [];
  let offset = 32;
  for (; offset < headerLength - 1 && bytes[offset] !== 0x0d; offset += 32) {
    const rawName = bytes.subarray(offset, offset + 11);
    const end = rawName.indexOf(0);
    fields.push({
      name: utf8Text(rawName.subarray(0, end < 0 ? 11 : end), name),
      type: String.fromCharCode(bytes[offset + 11]),
      length: bytes[offset + 16],
      decimals: bytes[offset + 17],
    });
  }
  if (bytes[offset] !== 0x0d) fail(`${name}: the field descriptors are not terminated`);
  if (1 + fields.reduce((sum, field) => sum + field.length, 0) !== recordLength) fail(`${name}: the record length does not match the fields`);
  if (headerLength + records * recordLength > bytes.length) fail(`${name}: the records run past the end of the table`);

  const counts = fields.map(() => new Map<string, number>());
  let deleted = 0;
  for (let record = 0; record < records; record += 1) {
    let position = headerLength + record * recordLength;
    if (bytes[position] === 0x2a) {
      deleted += 1;
      continue;
    }
    position += 1;
    fields.forEach((field, index) => {
      if (field.type === "C") {
        const value = utf8Text(bytes.subarray(position, position + field.length), name).replace(/[ \u0000]+$/, "");
        counts[index].set(value, (counts[index].get(value) ?? 0) + 1);
      }
      position += field.length;
    });
  }
  const lines = [`records ${records} (deleted ${deleted})`];
  for (const field of fields) {
    lines.push(`field ${field.name} type ${field.type} length ${field.length} decimals ${field.decimals}`);
  }
  fields.forEach((field, index) => {
    if (field.type !== "C") {
      lines.push(`values ${field.name}: not summarized (type ${field.type})`);
      return;
    }
    const values = [...counts[index].entries()].sort(([left], [right]) => byName(left, right));
    lines.push(
      values.length > MAX_LISTED_VALUES
        ? `values ${field.name}: ${values.length} distinct values, not listed`
        : `values ${field.name}: ${values.map(([value, count]) => `${JSON.stringify(value)} ${count}`).join("; ")}`,
    );
  });
  return lines;
}

const SHAPE_TYPES: Readonly<Record<number, string>> = {
  0: "Null",
  1: "Point",
  3: "PolyLine",
  5: "Polygon",
  8: "MultiPoint",
  11: "PointZ",
  13: "PolyLineZ",
  15: "PolygonZ",
  18: "MultiPointZ",
  21: "PointM",
  23: "PolyLineM",
  25: "PolygonM",
  28: "MultiPointM",
  31: "MultiPatch",
};

function shapefileHeader(bytes: Uint8Array, name: string): { type: number; bbox: number[]; length: number } {
  if (bytes.length < 100) fail(`${name}: the shapefile header is truncated`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getInt32(0, false) !== 9994) fail(`${name}: not a shapefile (file code)`);
  const length = view.getInt32(24, false) * 2;
  if (length !== bytes.length) fail(`${name}: the header file length does not match the member size`);
  return {
    type: view.getInt32(32, true),
    bbox: [view.getFloat64(36, true), view.getFloat64(44, true), view.getFloat64(52, true), view.getFloat64(60, true)],
    length,
  };
}

function shapeTypeName(type: number, name: string): string {
  return SHAPE_TYPES[type] ?? fail(`${name}: unknown shape type ${type}`);
}

/* --------------------------------------------------------------- pages */

type Describer = { kind: string; lines: (bytes: Uint8Array, name: string) => string[] };

/** The members this extractor describes on their own page, chosen by name suffix alone. */
function describerFor(name: string): Describer | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".cpg") || lower.endsWith(".prj")) return { kind: "text", lines: (bytes, member) => [utf8Text(bytes, member)] };
  if (lower.endsWith(".xml")) return { kind: "xml text", lines: (bytes, member) => xmlTextLines(utf8Text(bytes, member), member) };
  if (lower.endsWith(".dbf")) return { kind: "dBASE table", lines: dbfLines };
  if (lower.endsWith(".shp")) {
    return {
      kind: "shapefile header",
      lines: (bytes, member) => {
        const header = shapefileHeader(bytes, member);
        const [xmin, ymin, xmax, ymax] = header.bbox;
        return [
          `shape type ${header.type} (${shapeTypeName(header.type, member)})`,
          `bounding box xmin ${xmin} ymin ${ymin} xmax ${xmax} ymax ${ymax}`,
        ];
      },
    };
  }
  if (lower.endsWith(".shx")) {
    return {
      kind: "shapefile index",
      lines: (bytes, member) => {
        const header = shapefileHeader(bytes, member);
        if ((header.length - 100) % 8 !== 0) fail(`${member}: the index length is not a whole number of records`);
        return [`shape type ${header.type} (${shapeTypeName(header.type, member)})`, `records ${(header.length - 100) / 8}`];
      },
    };
  }
  return null;
}

/**
 * The pages of `extracted.txt` for a data archive, before
 * `program-screen-text-v1` normalization. Throws `DatasetArchiveError` for
 * any archive it cannot read exactly.
 */
export async function extractDatasetArchivePages(bytes: Uint8Array): Promise<string[]> {
  const entries = readZipCentralDirectory(bytes).sort((left, right) => byName(left.name, right.name));
  const manifest = [`${ZIP_MANIFEST_EXTRACTOR} ${ZIP_MANIFEST_EXTRACTOR_VERSION}`, `archive entries ${entries.length}`];
  const described: string[] = [];
  for (const entry of entries) {
    if (entry.directory) {
      if (entry.size !== 0) fail(`${entry.name}: a directory entry has content`);
      manifest.push(`directory ${entry.name}`);
      continue;
    }
    const member = await readZipMember(bytes, entry);
    manifest.push(
      `member ${entry.name} bytes ${entry.size} crc32 ${entry.crc32.toString(16).padStart(8, "0")} sha256 ${await sha256Of(member)}`,
    );
    const describer = describerFor(entry.name);
    if (describer !== null) described.push([`member ${entry.name} (${describer.kind})`, ...describer.lines(member, entry.name)].join("\n"));
  }
  return [manifest.join("\n"), ...described];
}

/* ------------------------------------------ reading the extracted text back */

export interface DatasetArchiveSummary {
  /** Manifest lines by member name. */
  members: ReadonlyMap<string, { bytes: number; crc32: string; sha256: string }>;
  /** 1-based page of each described member. */
  pages: ReadonlyMap<string, number>;
  tables: ReadonlyMap<string, { records: number; deleted: number; values: ReadonlyMap<string, ReadonlyArray<[string, number]> | null> }>;
  shapes: ReadonlyMap<string, { type: string; records: number | null }>;
}

/**
 * Reads the extractor's own output back, for context checks. Assumes text the
 * extractor wrote; anything it cannot read is simply absent.
 */
export function readDatasetArchiveSummary(pages: readonly string[]): DatasetArchiveSummary {
  const members = new Map<string, { bytes: number; crc32: string; sha256: string }>();
  for (const line of (pages[0] ?? "").split("\n")) {
    const match = /^member (.+) bytes (\d+) crc32 ([0-9a-f]{8}) sha256 ([0-9a-f]{64})$/.exec(line);
    if (match) members.set(match[1], { bytes: Number(match[2]), crc32: match[3], sha256: match[4] });
  }
  const pageOf = new Map<string, number>();
  const tables = new Map<string, { records: number; deleted: number; values: Map<string, Array<[string, number]> | null> }>();
  const shapes = new Map<string, { type: string; records: number | null }>();
  pages.forEach((page, index) => {
    if (index === 0) return;
    const lines = page.split("\n");
    const head = /^member (.+) \(([^)]+)\)$/.exec(lines[0] ?? "");
    if (!head) return;
    const [, name, kind] = head;
    pageOf.set(name, index + 1);
    if (kind === "dBASE table") {
      const counts = /^records (\d+) \(deleted (\d+)\)$/.exec(lines[1] ?? "");
      const values = new Map<string, Array<[string, number]> | null>();
      for (const line of lines) {
        const listed = /^values ([^:]+): (".*)$/.exec(line);
        if (listed) {
          const entries: Array<[string, number]> = [];
          for (const entry of listed[2].matchAll(/("(?:[^"\\]|\\.)*") (\d+)(?:; |$)/g)) {
            entries.push([JSON.parse(entry[1]) as string, Number(entry[2])]);
          }
          values.set(listed[1], entries);
        } else {
          const other = /^values ([^:]+): /.exec(line);
          if (other) values.set(other[1], null);
        }
      }
      if (counts) tables.set(name, { records: Number(counts[1]), deleted: Number(counts[2]), values });
    }
    if (kind === "shapefile header" || kind === "shapefile index") {
      const type = /^shape type \d+ \(([A-Za-z]+)\)$/.exec(lines[1] ?? "");
      const records = /^records (\d+)$/.exec(lines[2] ?? "");
      const previous = shapes.get(name.replace(/\.(shp|shx)$/i, "")) ?? { type: "", records: null };
      shapes.set(name.replace(/\.(shp|shx)$/i, ""), {
        type: type ? type[1] : previous.type,
        records: records ? Number(records[1]) : previous.records,
      });
    }
  });
  return { members, pages: pageOf, tables, shapes };
}
