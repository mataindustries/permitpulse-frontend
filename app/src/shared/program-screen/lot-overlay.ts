import { z } from "zod";
import {
  isVerifiedOverlayDatasetView,
  overlayCandidates,
  type OverlayDatasetView,
  type OverlayExtent,
} from "./overlay-dataset";

/**
 * The lot overlay (Phase 3E, docs/PROGRAM_SCREEN_PHASE_3E_D_PROMOTION_REVIEW.md).
 *
 * The authority package proves what a hazard dataset is; this module computes
 * how one reviewed legal-lot geometry intersects that dataset. Nothing here is
 * typed by a person: the evaluator computes the result itself, from a lot
 * geometry verified against its SHA-256 and a dataset view verified against
 * its pins.
 *
 * The computation is exact. Every coordinate is a double, and every double is
 * a dyadic rational, so the lot and the candidate features are scaled to
 * integers by one power of two and every test below is exact integer or
 * rational arithmetic (BigInt). There is no tolerance, overlap percentage, or
 * sampling. The plane inside the lot's x-range is cut into vertical slabs at
 * every vertex and every edge crossing inside the lot's box; inside a slab no
 * two edges cross, so the vertical line through the slab's middle meets every
 * region of positive area. Walking that line upward, the even-odd count of
 * each polygon's edges tells whether each open gap lies in the lot and in
 * which features. A gap between two edges that coincide there has no area and
 * is skipped, so a feature that only touches the lot along its edge or at a
 * point never counts.
 *
 * `lot_within_features`:
 * - `whole_lot`: every part of the lot with area lies inside some feature;
 * - `part_of_lot`: some part does, some does not;
 * - `none`: no part does;
 * - `not_established`: the geometry is invalid, its CRS differs from the
 *   dataset's, or a record that could touch the lot is not in the view.
 */

export const LOT_GEOMETRY_VERSION = "program-screen-lot-geometry-v1" as const;
export const lotWithinFeaturesValues = ["whole_lot", "part_of_lot", "none", "not_established"] as const;
export type LotWithinFeatures = (typeof lotWithinFeaturesValues)[number];

/** Upper bound on a lot geometry's positions, which keeps the exact checks bounded. */
export const MAX_LOT_POSITIONS = 2000;

const lotGeometrySchema = z
  .object({
    schema_version: z.literal(LOT_GEOMETRY_VERSION),
    crs: z.string().regex(/^EPSG:[1-9]\d{0,5}$/),
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1).max(50),
  })
  .strict();

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------ exact arithmetic */

const float = new DataView(new ArrayBuffer(8));

/** A finite double as m * 2^e with m odd (or zero). Exact. */
function dyadic(value: number): { m: bigint; e: number } {
  float.setFloat64(0, value);
  const high = float.getUint32(0);
  const low = float.getUint32(4);
  const biased = (high >>> 20) & 0x7ff;
  let m = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  let e: number;
  if (biased === 0) e = -1074;
  else {
    m |= 1n << 52n;
    e = biased - 1075;
  }
  if (m === 0n) return { m: 0n, e: 0 };
  while ((m & 1n) === 0n) {
    m >>= 1n;
    e += 1;
  }
  return { m: high >>> 31 === 1 ? -m : m, e };
}

/** The smallest power-of-two exponent that makes every value an integer. */
function scaleFor(values: Iterable<number>): number {
  let scale = 0;
  for (const value of values) scale = Math.max(scale, -dyadic(value).e);
  return scale;
}

function scaled(value: number, scale: number): bigint {
  const { m, e } = dyadic(value);
  return m << BigInt(e + scale);
}

/** A rational with a positive denominator. */
interface Q {
  n: bigint;
  d: bigint;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rational(n: bigint, d: bigint): Q {
  if (d === 0n) throw new Error("zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return divisor > 1n ? { n: n / divisor, d: d / divisor } : { n, d };
}

function compare(left: Q, right: Q): number {
  const a = left.n * right.d;
  const b = right.n * left.d;
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ------------------------------------------------------------ segments */

interface Point {
  x: bigint;
  y: bigint;
}

function cross(ax: bigint, ay: bigint, bx: bigint, by: bigint): bigint {
  return ax * by - ay * bx;
}

function orientation(p: Point, q: Point, r: Point): number {
  const value = cross(q.x - p.x, q.y - p.y, r.x - p.x, r.y - p.y);
  return value > 0n ? 1 : value < 0n ? -1 : 0;
}

function within(value: bigint, a: bigint, b: bigint): boolean {
  return (a <= value && value <= b) || (b <= value && value <= a);
}

/** Whether closed segments pq and rs share any point. */
function segmentsMeet(p: Point, q: Point, r: Point, s: Point): boolean {
  const o1 = orientation(p, q, r);
  const o2 = orientation(p, q, s);
  const o3 = orientation(r, s, p);
  const o4 = orientation(r, s, q);
  if (o1 !== o2 && o3 !== o4) return true;
  const onPq = (t: Point) => within(t.x, p.x, q.x) && within(t.y, p.y, q.y);
  const onRs = (t: Point) => within(t.x, r.x, s.x) && within(t.y, r.y, s.y);
  return (o1 === 0 && onPq(r)) || (o2 === 0 && onPq(s)) || (o3 === 0 && onRs(p)) || (o4 === 0 && onRs(q));
}

/* --------------------------------------------------- the reviewed lot geometry */

const lotToken = Symbol("ReviewedLotGeometry");
const verifiedLots = new WeakSet<object>();

/**
 * A lot geometry file, verified against its SHA-256 and checked for validity.
 * Only `loadReviewedLotGeometry` can create one. Which legal lot it draws is
 * part of the human review of the authority block that names it.
 */
export class ReviewedLotGeometry {
  readonly file_id: string;
  readonly sha256: string;
  /** Null when the file does not state a readable CRS. */
  readonly crs_epsg: number | null;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly #rings: ReadonlyArray<readonly number[]>;

  constructor(
    token: symbol,
    fields: { file_id: string; sha256: string; crs_epsg: number | null; issues: string[]; rings: number[][] },
  ) {
    if (token !== lotToken) throw new Error("A reviewed lot geometry is created only by loadReviewedLotGeometry.");
    this.file_id = fields.file_id;
    this.sha256 = fields.sha256;
    this.crs_epsg = fields.crs_epsg;
    this.issues = Object.freeze([...fields.issues]);
    this.valid = fields.issues.length === 0;
    this.#rings = Object.freeze(fields.rings.map((ring) => Object.freeze([...ring])));
    Object.freeze(this);
  }

  /** Rings as flat [x0, y0, x1, y1, ...] arrays, each closed. Empty for an invalid geometry. */
  rings(): ReadonlyArray<readonly number[]> {
    return this.valid ? this.#rings : [];
  }
}

export function isVerifiedLotGeometry(value: unknown): value is ReviewedLotGeometry {
  return typeof value === "object" && value !== null && verifiedLots.has(value);
}

/** Every reason a parsed lot polygon is not a valid, simple polygon with area. */
function lotPolygonIssues(rings: readonly (readonly number[])[]): string[] {
  const issues: string[] = [];
  const all = rings.flat();
  if (all.some((value) => !Number.isFinite(value))) return ["A coordinate is not finite."];
  const positions = all.length / 2;
  if (positions > MAX_LOT_POSITIONS) return [`The geometry has more than ${MAX_LOT_POSITIONS} positions.`];
  const scale = scaleFor(all);
  interface Edge {
    ring: number;
    index: number;
    count: number;
    a: Point;
    b: Point;
    box: [number, number, number, number];
  }
  const edges: Edge[] = [];
  rings.forEach((ring, ringIndex) => {
    const count = ring.length / 2 - 1;
    if (ring[0] !== ring[ring.length - 2] || ring[1] !== ring[ring.length - 1]) issues.push(`Ring ${ringIndex + 1} is not closed.`);
    let area = 0n;
    for (let index = 0; index < count; index += 1) {
      const [ax, ay, bx, by] = [ring[2 * index], ring[2 * index + 1], ring[2 * index + 2], ring[2 * index + 3]];
      if (ax === bx && ay === by) issues.push(`Ring ${ringIndex + 1} repeats a position.`);
      const a = { x: scaled(ax, scale), y: scaled(ay, scale) };
      const b = { x: scaled(bx, scale), y: scaled(by, scale) };
      area += cross(a.x, a.y, b.x, b.y);
      edges.push({ ring: ringIndex, index, count, a, b, box: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)] });
    }
    if (area === 0n) issues.push(`Ring ${ringIndex + 1} encloses no area.`);
  });
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const [e, f] = [edges[i], edges[j]];
      if (e.box[0] > f.box[2] || f.box[0] > e.box[2] || e.box[1] > f.box[3] || f.box[1] > e.box[3]) continue;
      const adjacent = e.ring === f.ring && (f.index === e.index + 1 || (e.index === 0 && f.index === e.count - 1));
      if (adjacent) {
        // Adjacent edges share one vertex; they must not fold back over each other.
        const [first, second] = f.index === e.index + 1 ? [e, f] : [f, e];
        const [p, q, r] = [first.a, first.b, second.b];
        if (orientation(p, q, r) === 0 && (q.x - p.x) * (r.x - q.x) + (q.y - p.y) * (r.y - q.y) < 0n) {
          issues.push(`Ring ${e.ring + 1} folds back on itself.`);
          return issues;
        }
        continue;
      }
      if (segmentsMeet(e.a, e.b, f.a, f.b)) {
        issues.push(e.ring === f.ring ? `Ring ${e.ring + 1} intersects itself.` : `Rings ${e.ring + 1} and ${f.ring + 1} intersect.`);
        return issues;
      }
    }
  }
  return issues;
}

/**
 * Reads a lot geometry file (`program-screen-lot-geometry-v1`: one Polygon in
 * a stated EPSG CRS, rings as [x, y] positions). The result is verified: its
 * SHA-256 is the file's, and an invalid geometry is kept, marked invalid, so
 * a lot overlay on it is `not_established` rather than an error.
 */
export async function loadReviewedLotGeometry(input: { file_id: string; bytes: Uint8Array }): Promise<ReviewedLotGeometry> {
  if (input.file_id.trim().length === 0) throw new Error("A lot geometry needs a file ID.");
  const sha256 = await sha256Bytes(input.bytes);
  const issues: string[] = [];
  let crs: number | null = null;
  let rings: number[][] = [];
  try {
    const parsed = lotGeometrySchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)));
    if (!parsed.success) issues.push(`The file is not a ${LOT_GEOMETRY_VERSION} polygon.`);
    else {
      crs = Number(parsed.data.crs.slice("EPSG:".length));
      rings = parsed.data.coordinates.map((ring) => ring.flat());
      issues.push(...lotPolygonIssues(rings));
    }
  } catch {
    issues.push("The file is not UTF-8 JSON.");
  }
  const geometry = new ReviewedLotGeometry(lotToken, { file_id: input.file_id, sha256, crs_epsg: crs, issues, rings });
  verifiedLots.add(geometry);
  return geometry;
}

/* --------------------------------------------------------------- overlay */

export interface LotOverlayComputation {
  lot_within_features: LotWithinFeatures;
  /** The dataset labels of every feature covering part of the lot with area, sorted, each once. */
  classes_on_lot: readonly string[];
  /** Records whose extent meets the lot's box: every record that could touch it. */
  candidate_records: readonly number[];
  issues: readonly string[];
}

interface OverlayEdge {
  owner: number; // -1: the lot; otherwise the candidate feature's position
  ax: bigint;
  ay: bigint;
  bx: bigint;
  by: bigint;
}

function notEstablished(issue: string, candidates: readonly number[] = []): LotOverlayComputation {
  return Object.freeze({
    lot_within_features: "not_established" as const,
    classes_on_lot: Object.freeze([]),
    candidate_records: Object.freeze([...candidates]),
    issues: Object.freeze([issue]),
  });
}

const memo = new WeakMap<OverlayDatasetView, WeakMap<ReviewedLotGeometry, LotOverlayComputation>>();

/**
 * Computes how the reviewed lot lies in the dataset's features. Pure and
 * deterministic; the same verified inputs always give the same result.
 */
export function computeLotOverlay(view: OverlayDatasetView, lot: ReviewedLotGeometry): LotOverlayComputation {
  if (!isVerifiedOverlayDatasetView(view)) return notEstablished("The dataset is not a verified overlay view.");
  if (!isVerifiedLotGeometry(lot)) return notEstablished("The lot geometry is not a verified lot geometry.");
  const cached = memo.get(view)?.get(lot);
  if (cached !== undefined) return cached;
  const result = computeUncached(view, lot);
  if (!memo.has(view)) memo.set(view, new WeakMap());
  memo.get(view)?.set(lot, result);
  return result;
}

function computeUncached(view: OverlayDatasetView, lot: ReviewedLotGeometry): LotOverlayComputation {
  if (!lot.valid) return notEstablished(`The lot geometry is invalid: ${lot.issues.join(" ")}`);
  if (lot.crs_epsg !== view.crs_epsg) return notEstablished(`The lot geometry is in EPSG:${lot.crs_epsg}, the dataset in EPSG:${view.crs_epsg}.`);

  const lotRings = lot.rings();
  const xs = lotRings.flatMap((ring) => ring.filter((_, index) => index % 2 === 0));
  const ys = lotRings.flatMap((ring) => ring.filter((_, index) => index % 2 === 1));
  const box: OverlayExtent = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const candidates = overlayCandidates(view.entries(), box);
  const candidateNumbers = candidates.map((entry) => entry.record_number);
  const invalid = candidates.filter((entry) => entry.geometry_state !== "valid");
  if (invalid.length > 0)
    return notEstablished(
      `Invalid or unreadable candidate source geometry (including missing validity): ${invalid.map((e) => e.record_number).join(", ")}.`,
      candidateNumbers,
    );
  const missing = candidates.filter((entry) => view.feature(entry.record_number) === undefined);
  if (missing.length > 0) {
    return notEstablished(`Records that could touch the lot are not in the view: ${missing.map((entry) => entry.record_number).join(", ")}.`, candidateNumbers);
  }
  const features = candidates.map((entry) => view.feature(entry.record_number)).filter((feature) => feature !== undefined);

  // Choose the edges that matter, by exact comparison of doubles.
  const [lx0, ly0, lx1, ly1] = box;
  type RawEdge = { owner: number; a: [number, number]; b: [number, number] };
  const lotEdges: RawEdge[] = [];
  const relevant: RawEdge[] = [];
  const below: RawEdge[] = [];
  const edgesOf = (ring: readonly number[], owner: number, sink: (edge: RawEdge) => void) => {
    for (let index = 0; index + 3 < ring.length; index += 2) {
      sink({ owner, a: [ring[index], ring[index + 1]], b: [ring[index + 2], ring[index + 3]] });
    }
  };
  for (const ring of lotRings) edgesOf(ring, -1, (edge) => lotEdges.push(edge));
  features.forEach((feature, owner) => {
    for (const ring of feature.rings) {
      edgesOf(ring, owner, (edge) => {
        const [minX, maxX] = [Math.min(edge.a[0], edge.b[0]), Math.max(edge.a[0], edge.b[0])];
        const [minY, maxY] = [Math.min(edge.a[1], edge.b[1]), Math.max(edge.a[1], edge.b[1])];
        // An edge that cannot meet the open x-range, or lies at or above the lot's top, never bounds or counts under a lot cell.
        if (maxX <= lx0 || minX >= lx1 || minY >= ly1) return;
        if (maxY <= ly0) below.push(edge);
        else relevant.push(edge);
      });
    }
  });

  const all = [...lotEdges, ...relevant, ...below];
  const scale = scaleFor(all.flatMap((edge) => [...edge.a, ...edge.b]));
  const toEdge = (edge: RawEdge): OverlayEdge => ({
    owner: edge.owner,
    ax: scaled(edge.a[0], scale),
    ay: scaled(edge.a[1], scale),
    bx: scaled(edge.b[0], scale),
    by: scaled(edge.b[1], scale),
  });
  const bounded = [...lotEdges, ...relevant].map(toEdge);
  const underneath = below.map(toEdge);
  const [X0, Y0, X1, Y1] = [scaled(lx0, scale), scaled(ly0, scale), scaled(lx1, scale), scaled(ly1, scale)];

  // Slab boundaries: the lot's x-range ends, every vertex inside it, and every crossing inside the lot's box.
  const boundaries = new Map<string, Q>();
  const addBoundary = (value: Q) => boundaries.set(`${value.n}/${value.d}`, value);
  addBoundary(rational(X0, 1n));
  addBoundary(rational(X1, 1n));
  for (const edge of bounded) {
    for (const x of [edge.ax, edge.bx]) if (x > X0 && x < X1) addBoundary(rational(x, 1n));
  }
  for (let i = 0; i < bounded.length; i += 1) {
    const e = bounded[i];
    const [eMinX, eMaxX] = e.ax < e.bx ? [e.ax, e.bx] : [e.bx, e.ax];
    const [eMinY, eMaxY] = e.ay < e.by ? [e.ay, e.by] : [e.by, e.ay];
    for (let j = i + 1; j < bounded.length; j += 1) {
      const f = bounded[j];
      if ((f.ax < eMinX && f.bx < eMinX) || (f.ax > eMaxX && f.bx > eMaxX)) continue;
      if ((f.ay < eMinY && f.by < eMinY) || (f.ay > eMaxY && f.by > eMaxY)) continue;
      const rx = e.bx - e.ax;
      const ry = e.by - e.ay;
      const sx = f.bx - f.ax;
      const sy = f.by - f.ay;
      let denominator = cross(rx, ry, sx, sy);
      if (denominator === 0n) continue; // parallel: any shared stretch ends at vertices already listed
      let t = cross(f.ax - e.ax, f.ay - e.ay, sx, sy);
      let u = cross(f.ax - e.ax, f.ay - e.ay, rx, ry);
      if (denominator < 0n) {
        denominator = -denominator;
        t = -t;
        u = -u;
      }
      if (t < 0n || t > denominator || u < 0n || u > denominator) continue;
      const xn = e.ax * denominator + t * rx;
      const yn = e.ay * denominator + t * ry;
      if (xn <= X0 * denominator || xn >= X1 * denominator || yn < Y0 * denominator || yn > Y1 * denominator) continue;
      addBoundary(rational(xn, denominator));
    }
  }
  const slabs = [...boundaries.values()].sort(compare);

  // Orient each bounded edge left to right; a vertical edge spans no slab.
  const spanning = bounded
    .filter((edge) => edge.ax !== edge.bx)
    .map((edge) => (edge.ax < edge.bx ? edge : { owner: edge.owner, ax: edge.bx, ay: edge.by, bx: edge.ax, by: edge.ay }));

  let lotCells = 0;
  let covered = 0;
  let uncovered = 0;
  const labels = new Set<string>();
  const parity = new Uint8Array(features.length);
  for (let index = 0; index + 1 < slabs.length; index += 1) {
    const [left, right] = [slabs[index], slabs[index + 1]];
    const middle = rational(left.n * right.d + right.n * left.d, 2n * left.d * right.d);
    const { n, d } = middle;
    parity.fill(0);
    // Edges wholly below the lot's box: counted by the half-open rule, so a vertex on the line counts once.
    for (const edge of underneath) {
      if (edge.ax * d <= n !== edge.bx * d <= n) parity[edge.owner] ^= 1;
    }
    const crossing: Array<{ owner: number; y: Q }> = [];
    for (const edge of spanning) {
      if (!(edge.ax * d < n && n < edge.bx * d)) continue;
      const dx = edge.bx - edge.ax;
      crossing.push({ owner: edge.owner, y: { n: edge.ay * dx * d + (n - edge.ax * d) * (edge.by - edge.ay), d: dx * d } });
    }
    crossing.sort((a, b) => compare(a.y, b.y));
    let lotOdd = 0;
    const odd = new Set<number>();
    features.forEach((_, owner) => {
      if (parity[owner] === 1) odd.add(owner);
    });
    for (let k = 0; k < crossing.length; k += 1) {
      const owner = crossing[k].owner;
      if (owner < 0) lotOdd ^= 1;
      else if (odd.has(owner)) odd.delete(owner);
      else odd.add(owner);
      if (k + 1 < crossing.length && lotOdd === 1 && compare(crossing[k].y, crossing[k + 1].y) < 0) {
        lotCells += 1;
        if (odd.size > 0) {
          covered += 1;
          for (const owner of odd) labels.add(features[owner].label);
        } else uncovered += 1;
      }
    }
  }

  if (lotCells === 0) return notEstablished("No part of the lot has area.", candidateNumbers);
  const within: LotWithinFeatures = uncovered === 0 ? "whole_lot" : covered === 0 ? "none" : "part_of_lot";
  return Object.freeze({
    lot_within_features: within,
    classes_on_lot: Object.freeze([...labels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))),
    candidate_records: Object.freeze(candidateNumbers),
    issues: Object.freeze([]),
  });
}
