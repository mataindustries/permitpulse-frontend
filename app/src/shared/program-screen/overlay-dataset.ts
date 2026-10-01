import type { ProgramCaptureRef } from "./authority-policy";
import type { FileGdbCapture } from "./filegdb-capture";

/**
 * The overlay dataset (Phase 3E, docs/PROGRAM_SCREEN_PHASE_3E_D_PROMOTION_REVIEW.md).
 *
 * An authority package proves what a hazard dataset is: its capture is pinned
 * by the SHA-256 of its extracted text, which lists the SHA-256 of every
 * archive member. This module only makes that dataset's polygons usable for a
 * lot overlay without loading the whole archive: an overlay index derived
 * deterministically from the pinned `.shp`, `.shx`, and `.dbf` members, and a
 * verified view holding the index and the records a lot overlay needs.
 *
 * `program-screen-overlay-index` 1.0.0, one line each:
 *
 *   program-screen-overlay-index 1.0.0
 *   dataset <source_id> <sha256_extracted>
 *   layer <name>
 *   crs EPSG:<code>
 *   class_field <field>
 *   member shp|shx|dbf <sha256 of the member bytes>
 *   records <count>
 *   record <n> <shape type> <xmin> <ymin> <xmax> <ymax> <content bytes> <content sha256> <label as JSON>
 *
 * The extent is computed from the record's points, never read from its
 * header box (in FHSZSRA_23_3 the header box can miss the points by a few
 * nanometres). Coordinates print as the shortest decimal that round-trips to
 * the same double, so the index is exact. A null shape records "-" for its
 * extent. The label is the class field's text value, never a numeric code.
 *
 * The index is pinned by SHA-256 in `overlayIndexPins`, keyed by the dataset
 * capture it is derived from; tests re-derive it from the archive bytes.
 * Changing a rule here means a new version and a new pin.
 */

export const OVERLAY_INDEX_FORMAT = "program-screen-overlay-index" as const;
export const OVERLAY_INDEX_VERSION = "1.0.0" as const;

/** Overlay inputs that cannot be verified. Never recovered from: the caller must supply the pinned bytes. */
export class OverlayInputError extends Error {}

function fail(message: string): never {
  throw new OverlayInputError(message);
}

/** The overlay index derived from one pinned dataset capture. */
export interface OverlayIndexPin {
  dataset: ProgramCaptureRef;
  index_sha256: string;
}

/**
 * Shipped index pins. Deny-by-default like the authority registries: a
 * dataset without a pin can never be overlaid, so no lot result can rest on it.
 */
export const overlayIndexPins: readonly OverlayIndexPin[] = [
  {
    // CAL FIRE FHSZSRA_23_3, the overlay dataset of calfire-sra-fhsz-2023-09-29 (Phase 3D).
    dataset: {
      source_id: "calfire-fhszsra-23-3-data",
      sha256_extracted: "a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a",
    },
    index_sha256: "caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff",
  },
  {
    dataset: {
      source_id: "calfire-fhszlra-25-1-all-data",
      sha256_extracted: "5724d4a456ddbf7845a116d162d96fc51b4a295c4c05a92d91fb2049cd4f1dad",
    },
    index_sha256: "5167cbf7029ea3fc051331d2c2de4d1611feb88783e38a852f678b94b275a716",
  },
];

export function overlayIndexPinFor(
  dataset: ProgramCaptureRef,
  pins: readonly OverlayIndexPin[] = overlayIndexPins,
): OverlayIndexPin | undefined {
  return pins.find(
    (pin) => pin.dataset.source_id === dataset.source_id && pin.dataset.sha256_extracted === dataset.sha256_extracted,
  );
}

export interface OverlayIndexHeader {
  dataset: ProgramCaptureRef;
  layer: string;
  crs_epsg: number;
  class_field: string;
  members: Record<string, string>;
  format?: "filegdb";
  records: number;
}

export type OverlayExtent = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

export interface OverlayIndexEntry {
  record_number: number;
  shape_type: number;
  /** The extent of the record's points; null for a null shape. */
  extent: OverlayExtent | null;
  content_bytes: number;
  content_sha256: string;
  label: string;
  geometry_state?: "valid" | "invalid" | "unreadable";
  source_validity?: "valid" | "invalid" | "unreadable";
}

/** One polygon record: its rings as flat [x0, y0, x1, y1, ...] arrays, in dataset coordinates. */
export interface OverlayFeature {
  record_number: number;
  label: string;
  extent: OverlayExtent;
  rings: ReadonlyArray<readonly number[]>;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const HEX64 = /^[0-9a-f]{64}$/;
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LAYER = /^[A-Za-z0-9_-]{1,64}$/;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/* --------------------------------------------------------- shapefile records */

/** Shape types this overlay reads: Polygon, PolygonZ, PolygonM. Only x and y are used. */
const POLYGON_TYPES: ReadonlySet<number> = new Set([5, 15, 25]);

export interface ParsedPolygonRecord {
  shape_type: number;
  /** Null for a null shape. */
  extent: OverlayExtent | null;
  rings: ReadonlyArray<readonly number[]>;
}

/**
 * Parses one shapefile record's content (the bytes after its 8-byte record
 * header). Refuses anything it cannot read exactly: a non-polygon type, a
 * length that fits no polygon layout, a part list out of order, an unclosed
 * or degenerate ring, or a non-finite coordinate.
 */
export function parsePolygonRecordContent(content: Uint8Array, where: string): ParsedPolygonRecord {
  if (content.length < 4) fail(`${where}: the record content is truncated`);
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const shapeType = view.getInt32(0, true);
  if (shapeType === 0) {
    if (content.length !== 4) fail(`${where}: a null shape has content`);
    return { shape_type: 0, extent: null, rings: [] };
  }
  if (!POLYGON_TYPES.has(shapeType)) fail(`${where}: shape type ${shapeType} is not a polygon`);
  if (content.length < 44) fail(`${where}: the polygon header is truncated`);
  const parts = view.getInt32(36, true);
  const points = view.getInt32(40, true);
  if (parts < 1 || points < 4 || parts > points) fail(`${where}: the part or point count is invalid`);
  const pointsAt = 44 + 4 * parts;
  const base = pointsAt + 16 * points;
  const measured = 16 + 8 * points;
  const layouts =
    shapeType === 5 ? [base] : shapeType === 15 ? [base + measured, base + 2 * measured] : [base, base + measured];
  if (!layouts.includes(content.length)) fail(`${where}: the content length fits no ${shapeType} polygon layout`);

  const starts: number[] = [];
  for (let index = 0; index < parts; index += 1) starts.push(view.getInt32(44 + 4 * index, true));
  if (starts[0] !== 0 || starts.some((start, index) => index > 0 && start <= starts[index - 1]) || starts[parts - 1] >= points) {
    fail(`${where}: the part list is out of order`);
  }
  starts.push(points);
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;
  const rings: number[][] = [];
  for (let part = 0; part < parts; part += 1) {
    const ring: number[] = [];
    for (let point = starts[part]; point < starts[part + 1]; point += 1) {
      const x = view.getFloat64(pointsAt + 16 * point, true);
      const y = view.getFloat64(pointsAt + 16 * point + 8, true);
      if (!Number.isFinite(x) || !Number.isFinite(y)) fail(`${where}: a coordinate is not finite`);
      ring.push(x, y);
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (ring.length < 8) fail(`${where}: a ring has fewer than four points`);
    if (ring[0] !== ring[ring.length - 2] || ring[1] !== ring[ring.length - 1]) fail(`${where}: a ring is not closed`);
    rings.push(ring);
  }
  return { shape_type: shapeType, extent: [xmin, ymin, xmax, ymax], rings };
}

/* ----------------------------------------------------------- the dBASE table */

/** The text value of one character field, per record, in record order. */
function dbfCharacterValues(bytes: Uint8Array, field: string): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33) fail("dbf: the header is truncated");
  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  let offset = 32;
  let position = 1;
  let found: { start: number; length: number; type: string } | null = null;
  for (; offset < headerLength - 1 && bytes[offset] !== 0x0d; offset += 32) {
    const raw = bytes.subarray(offset, offset + 11);
    const end = raw.indexOf(0);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(raw.subarray(0, end < 0 ? 11 : end));
    const length = bytes[offset + 16];
    if (name === field) found = { start: position, length, type: String.fromCharCode(bytes[offset + 11]) };
    position += length;
  }
  if (bytes[offset] !== 0x0d) fail("dbf: the field descriptors are not terminated");
  if (position !== recordLength) fail("dbf: the record length does not match the fields");
  if (headerLength + records * recordLength > bytes.length) fail("dbf: the records run past the end of the table");
  if (found === null) fail(`dbf: no field ${field}`);
  if (found.type !== "C") fail(`dbf: ${field} is not a character field`);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const values: string[] = [];
  for (let record = 0; record < records; record += 1) {
    const at = headerLength + record * recordLength;
    if (bytes[at] === 0x2a) fail(`dbf: record ${record + 1} is deleted`);
    values.push(decoder.decode(bytes.subarray(at + found.start, at + found.start + found.length)).replace(/[ \u0000]+$/, ""));
  }
  return values;
}

/* ------------------------------------------------------ shapefile main files */

function shapefileLength(bytes: Uint8Array, name: string): number {
  if (bytes.length < 100) fail(`${name}: the header is truncated`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getInt32(0, false) !== 9994 || view.getInt32(28, true) !== 1000) fail(`${name}: not a shapefile`);
  if (view.getInt32(24, false) * 2 !== bytes.length) fail(`${name}: the header length does not match the file`);
  if (!POLYGON_TYPES.has(view.getInt32(32, true))) fail(`${name}: not a polygon shapefile`);
  return bytes.length;
}

/** Every record's content bytes, in record order, located through the `.shx` index and checked against the `.shp` record headers. */
export function shapefileRecordContents(shp: Uint8Array, shx: Uint8Array): Uint8Array[] {
  shapefileLength(shp, "shp");
  const indexLength = shapefileLength(shx, "shx");
  if ((indexLength - 100) % 8 !== 0) fail("shx: the index is not a whole number of records");
  const shpView = new DataView(shp.buffer, shp.byteOffset, shp.byteLength);
  const shxView = new DataView(shx.buffer, shx.byteOffset, shx.byteLength);
  const contents: Uint8Array[] = [];
  for (let record = 0; record < (indexLength - 100) / 8; record += 1) {
    const offset = shxView.getInt32(100 + 8 * record, false) * 2;
    const length = shxView.getInt32(104 + 8 * record, false) * 2;
    if (offset < 100 || offset + 8 + length > shp.length) fail(`shx: record ${record + 1} points outside the shapefile`);
    if (shpView.getInt32(offset, false) !== record + 1 || shpView.getInt32(offset + 4, false) * 2 !== length) {
      fail(`shp: record ${record + 1} does not match its index entry`);
    }
    contents.push(shp.subarray(offset + 8, offset + 8 + length));
  }
  return contents;
}

/* ------------------------------------------------------------------ index */

export interface OverlayIndexInput {
  dataset: ProgramCaptureRef;
  layer: string;
  crs_epsg: number;
  class_field: string;
  members: { shp: string; shx: string; dbf: string };
  records: ReadonlyArray<{ content: Uint8Array; label: string }>;
}

function validateHeaderFields(header: Omit<OverlayIndexHeader, "records">): void {
  if (!KEBAB_ID.test(header.dataset.source_id) || !HEX64.test(header.dataset.sha256_extracted)) fail("index: the dataset pin is malformed");
  if (!LAYER.test(header.layer)) fail("index: the layer name is malformed");
  if (!Number.isInteger(header.crs_epsg) || header.crs_epsg <= 0) fail("index: the CRS is malformed");
  if (!FIELD.test(header.class_field)) fail("index: the class field is malformed");
  for (const sha of Object.values(header.members)) if (!HEX64.test(sha)) fail("index: a member digest is malformed");
}

/** The overlay index text for records already read from a pinned dataset. */
export async function overlayIndexText(input: OverlayIndexInput): Promise<string> {
  validateHeaderFields(input);
  const lines = [
    `${OVERLAY_INDEX_FORMAT} ${OVERLAY_INDEX_VERSION}`,
    `dataset ${input.dataset.source_id} ${input.dataset.sha256_extracted}`,
    `layer ${input.layer}`,
    `crs EPSG:${input.crs_epsg}`,
    `class_field ${input.class_field}`,
    `member shp ${input.members.shp}`,
    `member shx ${input.members.shx}`,
    `member dbf ${input.members.dbf}`,
    `records ${input.records.length}`,
  ];
  for (const [index, record] of input.records.entries()) {
    const parsed = parsePolygonRecordContent(record.content, `record ${index + 1}`);
    if (record.label.length === 0 || /[\r\n]/.test(record.label)) fail(`record ${index + 1}: the label is empty or multi-line`);
    const extent = parsed.extent === null ? "- - - -" : parsed.extent.map((value) => String(value)).join(" ");
    lines.push(
      `record ${index + 1} ${parsed.shape_type} ${extent} ${record.content.length} ${await sha256Bytes(record.content)} ${JSON.stringify(record.label)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Derives the overlay index from a dataset's `.shp`, `.shx`, and `.dbf` member bytes. */
export async function overlayIndexFromShapefile(input: {
  dataset: ProgramCaptureRef;
  layer: string;
  crs_epsg: number;
  class_field: string;
  shp: Uint8Array;
  shx: Uint8Array;
  dbf: Uint8Array;
}): Promise<string> {
  const contents = shapefileRecordContents(input.shp, input.shx);
  const labels = dbfCharacterValues(input.dbf, input.class_field);
  if (labels.length !== contents.length) fail("dbf: the table and the shapefile hold different record counts");
  return overlayIndexText({
    dataset: input.dataset,
    layer: input.layer,
    crs_epsg: input.crs_epsg,
    class_field: input.class_field,
    members: { shp: await sha256Bytes(input.shp), shx: await sha256Bytes(input.shx), dbf: await sha256Bytes(input.dbf) },
    records: contents.map((content, index) => ({ content, label: labels[index] })),
  });
}

const RECORD_LINE =
  /^record (\d+) (\d+) (?:(\S+) (\S+) (\S+) (\S+)) (\d+) ([0-9a-f]{64}) ("(?:[^"\\]|\\.)*")$/;

function exactNumber(text: string, where: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || String(value) !== text) fail(`${where}: a coordinate is not in canonical form`);
  return value;
}

/** Parses overlay index text. Anything not exactly in the 1.0.0 form is refused. */
export function parseOverlayIndex(text: string): { header: OverlayIndexHeader; entries: OverlayIndexEntry[];
} {
  if (text.startsWith(`${OVERLAY_INDEX_FORMAT} 2.0.0\n`)) return parseFileGdbOverlayIndex(text);
  if (!text.endsWith("\n")) fail("index: the text does not end with a newline");
  const lines = text.slice(0, -1).split("\n");
  const take = (index: number, pattern: RegExp): RegExpExecArray => pattern.exec(lines[index] ?? "") ?? fail(`index: line ${index + 1} is malformed`);
  if (lines[0] !== `${OVERLAY_INDEX_FORMAT} ${OVERLAY_INDEX_VERSION}`) fail("index: not a 1.0.0 overlay index");
  const dataset = take(1, /^dataset (\S+) (\S+)$/);
  const layer = take(2, /^layer (\S+)$/);
  const crs = take(3, /^crs EPSG:(\d+)$/);
  const field = take(4, /^class_field (\S+)$/);
  const shp = take(5, /^member shp (\S+)$/);
  const shx = take(6, /^member shx (\S+)$/);
  const dbf = take(7, /^member dbf (\S+)$/);
  const count = take(8, /^records (\d+)$/);
  const header: OverlayIndexHeader = {
    dataset: { source_id: dataset[1], sha256_extracted: dataset[2] },
    layer: layer[1],
    crs_epsg: Number(crs[1]),
    class_field: field[1],
    members: { shp: shp[1], shx: shx[1], dbf: dbf[1] },
    records: Number(count[1]),
  };
  validateHeaderFields(header);
  if (lines.length !== 9 + header.records) fail("index: the record count does not match the record lines");
  const entries: OverlayIndexEntry[] = [];
  for (let index = 0; index < header.records; index += 1) {
    const where = `index: record line ${index + 1}`;
    const match = RECORD_LINE.exec(lines[9 + index]) ?? fail(`${where} is malformed`);
    if (Number(match[1]) !== index + 1) fail(`${where} is out of order`);
    const shapeType = Number(match[2]);
    const isNull = match.slice(3, 7).every((part) => part === "-");
    if (shapeType === 0 ? !isNull : !POLYGON_TYPES.has(shapeType) || isNull) fail(`${where}: the shape type and extent disagree`);
    const extent = isNull ? null : (match.slice(3, 7).map((part) => exactNumber(part, where)) as unknown as OverlayExtent);
    if (extent !== null && (extent[0] > extent[2] || extent[1] > extent[3])) fail(`${where}: the extent is inverted`);
    const label = JSON.parse(match[9]) as string;
    if (JSON.stringify(label) !== match[9] || label.length === 0) fail(`${where}: the label is not in canonical form`);
    entries.push({
      record_number: index + 1,
      shape_type: shapeType,
      extent,
      content_bytes: Number(match[7]),
      content_sha256: match[8],
      label,
    });
  }
  return { header, entries };
}

/** Index entries whose extent meets a box (closed intervals): every record that could touch a lot inside it. */
export function overlayCandidates(entries: readonly OverlayIndexEntry[], box: OverlayExtent): OverlayIndexEntry[] {
  return entries.filter(
    (entry) =>
      (entry.geometry_state === "unreadable" && entry.extent === null) ||
      (entry.extent !== null &&
      entry.extent[0] <= box[2] &&
      entry.extent[2] >= box[0] &&
      entry.extent[1] <= box[3] &&
      entry.extent[3] >= box[1]),
  );
}

/* ------------------------------------------------------------ verified view */

const constructionToken = Symbol("OverlayDatasetView");
const verifiedViews = new WeakSet<object>();

function freezeDeep<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as object)) freezeDeep(item);
  }
  return value;
}

/**
 * A dataset's overlay index and some of its records, each checked against a
 * pin. Only `loadOverlayDatasetView` can create one; the evaluator accepts no
 * other object as a dataset, so an overlay can never rest on typed values.
 */
export class OverlayDatasetView {
  readonly dataset: Readonly<ProgramCaptureRef>;
  readonly index_sha256: string;
  readonly layer: string;
  readonly crs_epsg: number;
  readonly class_field: string;
  readonly #entries: readonly OverlayIndexEntry[];
  readonly #features: ReadonlyMap<number, OverlayFeature>;

  constructor(
    token: symbol,
    header: OverlayIndexHeader,
    indexSha256: string,
    entries: readonly OverlayIndexEntry[],
    features: ReadonlyMap<number, OverlayFeature>,
  ) {
    if (token !== constructionToken) fail("An overlay dataset view is created only by loadOverlayDatasetView.");
    this.dataset = freezeDeep({ ...header.dataset });
    this.index_sha256 = indexSha256;
    this.layer = header.layer;
    this.crs_epsg = header.crs_epsg;
    this.class_field = header.class_field;
    this.#entries = freezeDeep([...entries]);
    this.#features = new Map(features);
    Object.freeze(this);
  }

  /** Every index entry, in record order. */
  entries(): readonly OverlayIndexEntry[] {
    return this.#entries;
  }

  /** A verified record, or undefined when the view does not hold it. */
  feature(recordNumber: number): OverlayFeature | undefined {
    return this.#features.get(recordNumber);
  }

  /** The record numbers this view holds, ascending. */
  recordNumbers(): number[] {
    return [...this.#features.keys()].sort((left, right) => left - right);
  }
}

export function isVerifiedOverlayDatasetView(value: unknown): value is OverlayDatasetView {
  return typeof value === "object" && value !== null && verifiedViews.has(value);
}

/**
 * Verifies an overlay index against its pin and each supplied record against
 * the index, and returns the view. Throws `OverlayInputError` for anything
 * that does not match: an unpinned or changed index, an unknown record, or a
 * record whose bytes, length, or extent differ from the index.
 */
export async function loadOverlayDatasetView(
  input: { index_text: string; records: Iterable<{ record_number: number; content: Uint8Array }> },
  pins: readonly OverlayIndexPin[] = overlayIndexPins,
): Promise<OverlayDatasetView> {
  const indexSha256 = await sha256Bytes(new TextEncoder().encode(input.index_text));
  const { header, entries } = parseOverlayIndex(input.index_text);
  const pin = overlayIndexPinFor(header.dataset, pins);
  if (pin === undefined) fail(`index: no overlay index is pinned for ${header.dataset.source_id}`);
  if (pin.index_sha256 !== indexSha256) fail(`index: the index text is not the one pinned for ${header.dataset.source_id}`);
  const features = new Map<number, OverlayFeature>();
  for (const record of input.records) {
    const entry = entries[record.record_number - 1];
    const where = `record ${record.record_number}`;
    if (entry === undefined || entry.record_number !== record.record_number) fail(`${where} is not in the index`);
    if (features.has(record.record_number)) fail(`${where} is supplied twice`);
    if (record.content.length !== entry.content_bytes || (await sha256Bytes(record.content)) !== entry.content_sha256) {
      fail(`${where} does not match the index`);
    }
    const parsed =
      header.format === "filegdb"
        ? parseFileGdbFeature(record.content, entry)
        : parsePolygonRecordContent(record.content, where);
    if (parsed.extent === null) continue;
    if (entry.extent === null || parsed.extent.some((value, index) => value !== entry.extent?.[index])) fail(`${where}: the extent differs from the index`);
    features.set(
      record.record_number,
      freezeDeep({ record_number: record.record_number, label: entry.label, extent: parsed.extent, rings: parsed.rings.map((ring) => [...ring]) }),
    );
  }
  const view = new OverlayDatasetView(constructionToken, header, indexSha256, entries, features);
  verifiedViews.add(view);
  return view;
}

/** v2 records retain source polygon/ring grouping, decoded double coordinates,
 * semantic labels, and source validity. GDAL is offline only. */
export interface FileGdbFeatureInput {
  fid: number;
  label: string;
  code: number;
  area: string;
  state: "valid" | "invalid" | "unreadable";
  source_validity: "valid" | "invalid" | "unreadable";
  native_wkb: string | null;
  extent: OverlayExtent | null;
  coordinates: number[][][][];
}
export async function fileGdbOverlayIndexText(input: {
  dataset: ProgramCaptureRef;
  layer: string;
  crs_epsg: number;
  class_field: string;
  members: Record<string, string>;
  records: readonly FileGdbFeatureInput[];
}): Promise<{
  index_text: string;
  records: Array<{ record_number: number; content: Uint8Array }>;
}> {
  validateHeaderFields(input);
  const lines = [
    `${OVERLAY_INDEX_FORMAT} 2.0.0`,
    `dataset ${input.dataset.source_id} ${input.dataset.sha256_extracted}`,
    `layer ${input.layer}`,
    `crs EPSG:${input.crs_epsg}`,
    `class_field ${input.class_field}`,
    `origin ${JSON.stringify(input.members)}`,
    "decoder GDAL-3.10.3-GEOS-3.13.1",
    `records ${input.records.length}`,
  ];
  const records = [];
  for (const [i, f] of input.records.entries()) {
    if (f.fid !== i + 1) fail("FileGDB active FIDs must be contiguous and ordered");
    const content = new TextEncoder().encode(
      JSON.stringify({
        fid: f.fid,
        label: f.label,
        state: f.state,
        source_validity: f.source_validity,
        native_wkb: f.native_wkb,
        coordinates: f.coordinates,
      }) + "\n",
    );
    const entry: OverlayIndexEntry = {
      record_number: f.fid,
      shape_type: 5,
      extent: f.extent,
      content_bytes: content.length,
      content_sha256: await sha256Bytes(content),
      label: f.label,
      geometry_state: f.state,
      source_validity: f.source_validity,
    };
    parseFileGdbFeature(content, entry);
    lines.push(
      `record ${f.fid} ${f.state} ${f.source_validity} ${f.extent === null ? "- - - -" : f.extent.map(String).join(" ")} ${content.length} ${entry.content_sha256} ${JSON.stringify(f.label)}`,
    );
    records.push({ record_number: f.fid, content });
  }
  return { index_text: lines.join("\n") + "\n", records };
}
export async function buildLraOverlay(input: {
  dataset: ProgramCaptureRef;
  native: FileGdbCapture;
  decoded: readonly FileGdbFeatureInput[];
  archive_sha256: string;
  feature_table_sha256: string;
}) {
  if (input.decoded.length !== input.native.features.length)
    fail("FileGDB derived feature count differs from native table");
  const expected: Record<string, number> = {
    "Very High": 3,
    High: 2,
    Moderate: 1,
    NonWildland: -3,
  };
  const invalid: Record<string, number> = {};
  for (const [i, f] of input.decoded.entries()) {
    const native = input.native.features[i];
    if (
      f.fid !== native.fid ||
      f.label !== native.label ||
      f.code !== native.code ||
      f.area !== native.area ||
      f.area !== "LRA" ||
      expected[f.label] !== f.code
    )
      fail("FileGDB decoded/native association or semantics differs");
    if (f.source_validity !== "valid") invalid[f.label] = (invalid[f.label] ?? 0) + 1;
  }
  if (
    JSON.stringify(Object.entries(invalid).sort()) !==
    JSON.stringify(
      Object.entries({
        "Very High": 11,
        High: 20,
        Moderate: 70,
        NonWildland: 18,
      }).sort(),
    )
  )
    fail("FileGDB validity inventory differs");
  return fileGdbOverlayIndexText({
    dataset: input.dataset,
    layer: input.native.association.name,
    crs_epsg: 3310,
    class_field: "FHSZ_Description",
    members: {
      archive: input.archive_sha256,
      metadata: input.native.association.metadata_sha256,
      association: await sha256Bytes(new TextEncoder().encode(JSON.stringify(input.native.association))),
      feature_table: input.feature_table_sha256,
    },
    records: input.decoded,
  });
}
function parseFileGdbOverlayIndex(text: string): {
  header: OverlayIndexHeader;
  entries: OverlayIndexEntry[];
} {
  if (!text.endsWith("\n")) fail("FileGDB index must end in newline");
  const lines = text.slice(0, -1).split("\n");
  const take = (i: number, r: RegExp) => r.exec(lines[i] ?? "") ?? fail(`FileGDB index line ${i + 1} is malformed`);
  const dataset = take(1, /^dataset (\S+) (\S+)$/),
    layer = take(2, /^layer (\S+)$/),
    crs = take(3, /^crs EPSG:(\d+)$/),
    field = take(4, /^class_field (\S+)$/);
  const origin = JSON.parse(take(5, /^origin (.+)$/)[1]) as Record<string, string>;
  if (
    Object.keys(origin).sort().join(",") !== "archive,association,feature_table,metadata" ||
    lines[6] !== "decoder GDAL-3.10.3-GEOS-3.13.1"
  )
    fail("FileGDB index origin/decoder differs");
  const count = Number(take(7, /^records (\d+)$/)[1]);
  const header: OverlayIndexHeader = {
    dataset: { source_id: dataset[1], sha256_extracted: dataset[2] },
    layer: layer[1],
    crs_epsg: Number(crs[1]),
    class_field: field[1],
    members: origin,
    records: count,
    format: "filegdb",
  };
  validateHeaderFields(header);
  if (lines.length !== 8 + count) fail("FileGDB index feature count differs");
  const entries: OverlayIndexEntry[] = [];
  for (let i = 0; i < count; i++) {
    const m = take(
      i + 8,
      /^record (\d+) (valid|invalid|unreadable) (valid|invalid|unreadable) (\S+) (\S+) (\S+) (\S+) (\d+) ([0-9a-f]{64}) ("(?:[^"\\]|\\.)*")$/,
    );
    if (Number(m[1]) !== i + 1) fail("FileGDB index FIDs are out of order");
    const state = m[2] as FileGdbFeatureInput["state"],
      validity = m[3] as FileGdbFeatureInput["source_validity"],
      empty = m.slice(4, 8).every((v) => v === "-");
    const extent = empty
      ? null
      : (m.slice(4, 8).map((v) => exactNumber(v, "FileGDB extent")) as unknown as OverlayExtent);
    if (
      (extent === null && state !== "unreadable") ||
      (extent !== null && (extent[0] > extent[2] || extent[1] > extent[3]))
    )
      fail("FileGDB index extent/state differs");
    if (state === "valid" && validity !== "valid") fail("Invalid source validity cannot become valid geometry");
    const label = JSON.parse(m[10]);
    if (typeof label !== "string" || !label || JSON.stringify(label) !== m[10])
      fail("FileGDB semantic label is malformed");
    entries.push({
      record_number: i + 1,
      shape_type: 5,
      geometry_state: state,
      source_validity: validity,
      extent,
      content_bytes: Number(m[8]),
      content_sha256: m[9],
      label,
    });
  }
  return { header, entries };
}
function parseFileGdbFeature(
  content: Uint8Array,
  entry: OverlayIndexEntry,
): { extent: OverlayExtent | null; rings: number[][] } {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  const f = JSON.parse(text) as {
    fid: number;
    label: string;
    state: string;
    source_validity: string;
    native_wkb: string | null;
    coordinates: number[][][][];
  };
  if (
    JSON.stringify(f) + "\n" !== text ||
    Object.keys(f).join(",") !== "fid,label,state,source_validity,native_wkb,coordinates" ||
    f.fid !== entry.record_number ||
    f.label !== entry.label ||
    f.state !== entry.geometry_state ||
    f.source_validity !== entry.source_validity ||
    !Array.isArray(f.coordinates)
  )
    fail("FileGDB record differs from indexed identity/state");
  if (f.native_wkb !== null) {
    if (f.state === "valid" || !/^(?:[0-9a-f]{2})+$/.test(f.native_wkb) || f.coordinates.length !== 0)
      fail("Unsupported curved geometry was altered or marked evaluable");
    return { extent: entry.extent, rings: [] };
  }
  const rings: number[][] = [];
  for (const polygon of f.coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0) fail("FileGDB polygon lacks rings");
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) fail("FileGDB ring is malformed");
      for (const p of ring)
        if (!Array.isArray(p) || p.length !== 2 || p.some((v) => typeof v !== "number" || !Number.isFinite(v)))
          fail("FileGDB position is malformed");
      if (ring[0].some((v, i) => v !== ring.at(-1)![i])) fail("FileGDB ring is not closed");
      rings.push(ring.flat());
    }
  }
  if (rings.length === 0) {
    if (f.state !== "unreadable" || entry.extent !== null) fail("FileGDB empty geometry is not marked unreadable");
    return { extent: null, rings };
  }
  let xmin = Infinity,
    ymin = Infinity,
    xmax = -Infinity,
    ymax = -Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i += 2) {
      xmin = Math.min(xmin, ring[i]);
      xmax = Math.max(xmax, ring[i]);
      ymin = Math.min(ymin, ring[i + 1]);
      ymax = Math.max(ymax, ring[i + 1]);
    }
  const extent: [number, number, number, number] = [xmin, ymin, xmax, ymax];
  if (entry.extent === null || extent.some((v, i) => v !== entry.extent![i]))
    fail("FileGDB coordinate extent differs from pinned extent");
  return { extent, rings };
}
