import { describe, expect, inject, it, vi } from "vitest";
import phase3hPromotionDoc from "../../docs/PROGRAM_SCREEN_PHASE_3H_C_PROMOTION_REVIEW.md?raw";
import fixture from "../fixtures/program-screen/fictional-la-parcel.json";
import decisionRecord from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json";
import memoMetadataJson from "../fixtures/program-screen/official-sources/shra-2025-10-28/metadata.json";
import memoText from "../fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt?raw";
import reviewedLotJson from "../fixtures/program-screen/phase-3f-test-only/test-only-reviewed-lot.json";
import sraSourceText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-source.json?raw";
import sourceMetadataText from "../fixtures/program-screen/phase-3f-test-only/test-only-metadata.json?raw";
import sraReceiptText from "../fixtures/program-screen/phase-3f-test-only/test-only-sra-normalization-receipt.json?raw";
import normalizedSraText from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-phase-3f-normalized-sra.json?raw";
import veryHighModerateText from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-very-high-moderate.json?raw";
import wholeVeryHighText from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-whole-very-high.json?raw";
import otherCrsText from "../fixtures/program-screen/test-only-lot-geometries/test-only-lot-invalid-other-crs.json?raw";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import type { ProgramLotOverlayInputs } from "../src/shared/program-screen/authority-gate";
import {
  authorityPromotionBlockers,
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
} from "../src/shared/program-screen/authority-policy";
import { booleanFact, jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPathway } from "../src/shared/program-screen/criteria/shra";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import {
  parseProgramEvidenceAuthority,
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { computeLotOverlay, loadReviewedLotGeometry, type ReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import {
  fileGdbOverlayIndexText,
  loadOverlayDatasetView,
  overlayIndexPinFor,
  overlayIndexPins,
  parseOverlayIndex,
  shapefileTopologyIndexText,
  type FileGdbFeatureInput,
  type OverlayDatasetView,
  type OverlayIndexPin,
} from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { bytesSha256, reviewedLotRecordSchema, type CaseFileRef } from "../src/shared/program-screen/reviewed-lot";
import {
  addDays,
  criterionAwaitsHumanVerification,
  criterionPromotionBlockers,
  hasCompleteHumanVerification,
  parseProgramPathwayPacks,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import {
  humanRecordCaptureIssues,
  locateExcerptPages,
  parseOfficialSourceMetadata,
  sha256Hex,
} from "../src/shared/program-screen/source-capture";
import { sraValidityProfile } from "../src/shared/program-screen/sra-validity-profile";
import {
  programPathwayCompletenessBlockers,
  type CriterionPredicate,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramCriterionResult,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";
import type { ProgramScreenCaseEvidenceStore } from "../src/worker/program-screen/case-evidence";
import {
  evaluateStoredCaseProgramScreen,
  loadCaseLraOverlay,
  loadCaseOverlay,
} from "../src/worker/program-screen/evaluate-case";
import { prePromotionC, prePromotionPacks } from "./program-screen-c-pre-promotion";

/**
 * TEST-ONLY independent Phase 3H re-audit of criterion c after PR #30, kept as
 * the post-promotion regression test for the approved c-only promotion
 * (docs/PROGRAM_SCREEN_PHASE_3H_C_PROMOTION_REVIEW.md).
 *
 * The audited candidate below must equal the SHIPPED c field for field; the
 * adversarial cases mutate copies of it, never production. It runs against the
 * SHIPPED authority registries. Real SRA geometry comes from the pinned index
 * re-derived by global setup from the original archive. Synthetic geometry is
 * explicitly TEST-ONLY and reaches the gate only through TEST-ONLY index pins
 * passed like registries. Builders are written here, not shared with the
 * earlier Phase 3H audit, so this audit does not inherit its assumptions.
 */

const AS_OF = "2026-10-01";
const C = "la_shra.very-high-fire-hazard-severity-zone";
const D = "la_shra.high-fire-hazard-severity-zone";
const E = "la_shra.prime-or-statewide-farmland";
const F = "la_shra.natural-community-conservation-plan-land";
const G = "la_shra.conservation-easement";
const VH = "very-high-fire-hazard-severity-zone" as const;
const HIGH = "high-fire-hazard-severity-zone" as const;
type Route = "gov_51178" | "prc_4202";

const shippedCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const shipped = (id: string) => shippedCriteria.find((criterion) => criterion.id === id)!;
const shippedC = shipped(C);
const shippedD = shipped(D);
const LRA = programAuthorityRegistries.sources.find((source) => source.package?.statutory_basis === "gov_51178")!;
const SRA = programAuthorityRegistries.sources.find((source) => source.package?.statutory_basis === "prc_4202")!;
const cDecision = decisionRecord.decisions.find((decision) => decision.letter === "c")!;
const memoMetadata = parseOfficialSourceMetadata(memoMetadataJson);
const clone = <T>(value: T, change: (draft: any) => void = () => {}): T => {
  const draft = structuredClone(value);
  change(draft);
  return draft;
};
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

/* ------------------------------------------------------- proposed promotion */

const VERIFIED_AT = AS_OF;
const NEXT_REVIEW_AT = addDays(VERIFIED_AT, 30); // high-volatility memo citation: 30-day cadence
const MEMO_EXCERPT = "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.";
const PROPOSED_SUMMARY =
  "Phase 3B decision c. Disqualifying per source when, on either separately assessed route, a reviewed CAL FIRE / OSFM record (GOV §51178 2025 LRA identification or PRC §4202 adopted SRA map), a deterministic overlay of the reviewed legal-lot geometry on that route's registered dataset, shows the whole lot proposed to be subdivided in Very High. Consistent with source only when both routes each show no part of the lot in Very High. Partial or mixed coverage, invalid source geometry, a one-route negative, an unclear legal lot, and any other source stay unknown; no threshold. High is criterion d.";
const PROPOSED_QUESTION =
  "How does Planning apply the SHRA Very High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?";
const proposedPredicate: CriterionPredicate = (facts) =>
  booleanFact(facts, VH) ? "disqualifying_per_source" : "consistent_with_source";
const proposedCitation = { ...shippedC.citation, verified_at: VERIFIED_AT, next_review_at: NEXT_REVIEW_AT };
const proposedRecord: ProgramCriterionHumanVerification = {
  reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
  verified_at: VERIFIED_AT,
  next_review_at: NEXT_REVIEW_AT,
  source_title: proposedCitation.title,
  source_url: proposedCitation.url,
  instrument: "City of Los Angeles SHRA implementation memo, October 28, 2025",
  pinpoint: proposedCitation.pinpoint,
  supporting_excerpt: MEMO_EXCERPT,
  source_capture: {
    repo_path: "app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt",
    retrieved_at: "2026-09-27T16:19:20Z",
    capture_method: "pdf_text_extraction",
    sha256: "f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2",
    is_ai_generated: false,
    source_type: "official_memo",
    operative_status: "operative",
  },
  decision_ref: { phase: "3B", letter: "c" },
};
function promotedC(overrides: Partial<ProgramCriterion> = {}): ProgramCriterion {
  return {
    ...shippedC,
    predicate: proposedPredicate,
    rule_summary: PROPOSED_SUMMARY,
    question_if_judgment: PROPOSED_QUESTION,
    citation: proposedCitation,
    verification: "human_verified",
    human_verification: proposedRecord,
    ...overrides,
  };
}
const projectedPacks = (): ProgramPathwayPack[] =>
  programScreenPathwayPacks.map((pack) => ({
    ...pack,
    criteria: pack.criteria.map((criterion) => (criterion.id === C ? promotedC() : criterion)),
  }));

/* ---------------------------------------------------------- record builders */

function evidence(id: string, key: string, value: boolean | string): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key as keyof typeof programFactSpecs];
  const normalized = typeof value === "boolean" ? { kind: "boolean" as const, value } : { kind: "text" as const, value };
  return {
    id,
    subject: { case_id: "test-only-reaudit-3h", property_id: "test-only-reaudit-3h" },
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: "TEST-ONLY",
      title: "TEST-ONLY re-audit record",
      description: "TEST-ONLY",
      url: `https://records.example.test/${id}`,
      authority: "official",
      retrieved_at: `${AS_OF}T00:00:00Z`,
    },
    raw_observed_value: normalized,
    normalized_value: normalized,
    evidence_type: "official_map",
    classification: "source_observation",
    confidence: 99,
    conflicts_with: [],
    review_status: "reviewed",
    notes: ["TEST-ONLY"],
    limitations: [],
    provenance: { source_record_id: id, capture_method: "manual_research", is_ai_generated: false },
  } as CanonicalEvidenceRecord;
}

const LEGAL_LOT = "TEST-ONLY re-audit Tract 0, Lot 1 (one legal lot for both routes)";
function authority(record: CanonicalEvidenceRecord, route: Route, lot: ReviewedLotGeometry): ProgramEvidenceAuthority {
  const source = route === "gov_51178" ? LRA : SRA;
  const yes = record.normalized_value.kind === "boolean" && record.normalized_value.value;
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION,
    evidence_id: record.id,
    fact_key: record.claim.key as typeof VH,
    record_kind: "agency_hazard_map",
    issuer: { name: "CAL FIRE / Office of the State Fire Marshal", issuer_id: "calfire-osfm" },
    source_identifier: { scheme: "authority_source_id", value: source.authority_source_id },
    document_title: source.title,
    edition: { ...source.edition, currency: "current_on_as_of", currency_checked_on: AS_OF },
    retrieved_at: record.source.retrieved_at,
    source_url: record.source.url,
    capture: { store: "repo_official_source", ...source.capture },
    parcel_relationship: {
      matched_by: "spatial_overlay",
      parcel_identifier: "0000000000",
      legal_lot_reference: LEGAL_LOT,
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage: yes ? "whole_parcel" : "none_of_parcel",
    qualifiers: {
      family: "hazard_map",
      hazard_class: record.claim.key === VH ? "very_high" : "high",
      statutory_basis: route,
      // Route 1 never needs local adoption (GOV §51179); Route 2 needs an adopted map.
      adoption_status: route === "prc_4202" ? "adopted" : "not_established",
      named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: "not_established",
      legend_defines_class_for_lot: "not_established",
      responsibility_area_as_stated: "not_stated",
      lot_overlay: {
        method: "deterministic_spatial_overlay",
        dataset: source.package!.members.overlay_dataset,
        lot_geometry: { store: "case_evidence_file", file_id: lot.file_id, sha256: lot.sha256 },
      },
    },
    authority_review: {
      status: "reviewed",
      reviewer: { kind: "human", name: "TEST-ONLY Reviewer", role: "TEST-ONLY" },
      reviewed_on: AS_OF,
    },
    notes: ["TEST-ONLY"],
    is_ai_generated: false,
  };
}

/* -------------------------------------------- TEST-ONLY synthetic geometry */

const square = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [
  [x0, y0],
  [x0, y1],
  [x1, y1],
  [x1, y0],
  [x0, y0],
];
const bowTie = (x0: number, x1: number): Array<[number, number]> => [
  [x0, 0],
  [x1, 100],
  [x1, 0],
  [x0, 100],
  [x0, 0],
];
/** One shapefile Polygon (type 5) record content, written here independently. */
function shpPolygon(ring: Array<[number, number]>): Uint8Array {
  const bytes = new Uint8Array(48 + 16 * ring.length);
  const view = new DataView(bytes.buffer);
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  view.setInt32(0, 5, true);
  [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((v, i) => view.setFloat64(4 + 8 * i, v, true));
  view.setInt32(36, 1, true);
  view.setInt32(40, ring.length, true);
  view.setInt32(44, 0, true);
  ring.forEach(([x, y], i) => {
    view.setFloat64(48 + 16 * i, x, true);
    view.setFloat64(56 + 16 * i, y, true);
  });
  return bytes;
}
const SHP_NULL = new Uint8Array([0, 0, 0, 0]);

type State = "valid" | "invalid" | "unreadable";
interface SynthFeature {
  label: string;
  ring: Array<[number, number]> | null;
  state?: State;
}
interface SynthView {
  view: OverlayDatasetView;
  pin: OverlayIndexPin;
}

async function sraSynthetic(features: SynthFeature[], options: { omit?: number[]; crs?: number } = {}): Promise<SynthView> {
  const pack = SRA.package!;
  const records = features.map((f) => ({ label: f.label, content: f.ring === null ? SHP_NULL : shpPolygon(f.ring) }));
  const index = await shapefileTopologyIndexText({
    dataset: pack.members.overlay_dataset,
    layer: pack.overlay.dataset_name,
    crs_epsg: options.crs ?? 3310,
    class_field: pack.overlay.class_field,
    members: { shp: "a".repeat(64), shx: "b".repeat(64), dbf: "c".repeat(64) },
    records,
    topology: {
      archive_sha256: "d".repeat(64),
      manifest_sha256: "e".repeat(64),
      records: await Promise.all(
        records.map(async (r, i) => ({
          record_number: i + 1,
          geometry_sha256: await bytesSha256(r.content),
          state: features[i].state ?? "valid",
          diagnostic: (features[i].state ?? "valid") === "valid" ? null : "TEST-ONLY diagnostic",
        })),
      ),
    },
  });
  const pin = { dataset: pack.members.overlay_dataset, index_sha256: await sha256Hex(index) };
  const view = await loadOverlayDatasetView(
    {
      index_text: index,
      records: records.map((r, i) => ({ record_number: i + 1, content: r.content })).filter((r) => !(options.omit ?? []).includes(r.record_number)),
    },
    [pin],
  );
  return { view, pin };
}

const LRA_CODES: Record<string, number> = { "Very High": 3, High: 2, Moderate: 1, NonWildland: -3 };
async function lraSynthetic(features: SynthFeature[], options: { omit?: number[]; crs?: number; layer?: string } = {}): Promise<SynthView> {
  const pack = LRA.package!;
  const records: FileGdbFeatureInput[] = features.map((f, i) => {
    const state = f.state ?? "valid";
    if (f.ring === null) {
      // Curved/unreadable: native WKB retained, never linearized or evaluated.
      return { fid: i + 1, label: f.label, code: LRA_CODES[f.label], area: "LRA", state: "unreadable", source_validity: "unreadable", native_wkb: "010a00000000000000", extent: [0, 0, 100, 100], coordinates: [] };
    }
    const xs = f.ring.map(([x]) => x);
    const ys = f.ring.map(([, y]) => y);
    return {
      fid: i + 1,
      label: f.label,
      code: LRA_CODES[f.label],
      area: "LRA",
      state,
      source_validity: state,
      native_wkb: null,
      extent: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      coordinates: [[f.ring]],
    };
  });
  const derived = await fileGdbOverlayIndexText({
    dataset: pack.members.overlay_dataset,
    layer: options.layer ?? pack.overlay.dataset_name,
    crs_epsg: options.crs ?? 3310,
    class_field: pack.overlay.class_field,
    members: { archive: "0".repeat(64), metadata: "1".repeat(64), association: "2".repeat(64), feature_table: "3".repeat(64) },
    records,
  });
  const pin = { dataset: pack.members.overlay_dataset, index_sha256: await sha256Hex(derived.index_text) };
  const view = await loadOverlayDatasetView(
    { index_text: derived.index_text, records: derived.records.filter((r) => !(options.omit ?? []).includes(r.record_number)) },
    [pin],
  );
  return { view, pin };
}

/** The ONE reviewed legal-lot geometry both routes use, in synthetic space. */
const LOT = await loadReviewedLotGeometry({
  file_id: "test-only-reaudit-3h-lot",
  bytes: encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [square(10, 20, 90, 80)] }),
});

/** Route state vocabulary for the combined matrix. */
type RouteState =
  | "YES"
  | "NO"
  | "unknown"
  | "partial"
  | "mixed"
  | "invalid"
  | "invalidNonVH"
  | "unreadable"
  | "outside"
  | "missing"
  | "High"
  | "NonWildland"
  | "unrelatedInvalidYES";

function featuresFor(state: RouteState, route: Route): { features: SynthFeature[]; omit?: number[] } {
  const negative = "Moderate";
  switch (state) {
    case "YES":
      return { features: [{ label: "Very High", ring: square(0, 0, 100, 100) }] };
    case "NO":
      return { features: [{ label: negative, ring: square(0, 0, 100, 100) }] };
    case "High":
      return { features: [{ label: "High", ring: square(0, 0, 100, 100) }] };
    case "NonWildland":
      return { features: [{ label: route === "gov_51178" ? "NonWildland" : negative, ring: square(0, 0, 100, 100) }] };
    case "partial":
      return { features: [{ label: "Very High", ring: square(0, 0, 50, 100) }] };
    case "mixed":
      return { features: [{ label: "Very High", ring: square(0, 0, 50, 100) }, { label: negative, ring: square(50, 0, 100, 100) }] };
    case "invalid":
      return { features: [{ label: "Very High", ring: bowTie(0, 100), state: "invalid" }] };
    case "invalidNonVH":
      return { features: [{ label: "High", ring: square(0, 0, 100, 100), state: "invalid" }] };
    case "unreadable":
      return { features: [{ label: "Very High", ring: null, state: "unreadable" }] };
    case "outside":
      return { features: [{ label: negative, ring: square(200, 0, 300, 100) }] };
    case "missing":
      return { features: [{ label: "Very High", ring: square(0, 0, 100, 100) }], omit: [1] };
    case "unrelatedInvalidYES":
      return {
        features: [
          { label: "Very High", ring: square(0, 0, 100, 100) },
          { label: "Very High", ring: bowTie(5000, 5100), state: "invalid" },
        ],
      };
    case "unknown":
      return { features: [{ label: "Very High", ring: square(0, 0, 100, 100) }] };
  }
}
/** The value the record CLAIMS; the gate must check it against the computed overlay. */
function claimed(state: RouteState): boolean | null {
  if (state === "unknown") return null;
  return ["NO", "High", "NonWildland", "outside", "invalidNonVH"].includes(state) ? false : true;
}

interface Case {
  records: CanonicalEvidenceRecord[];
  blocks: ProgramEvidenceAuthority[];
  overlay: ProgramLotOverlayInputs;
}
async function routeCase(route: Route, state: RouteState, value: boolean | null = claimed(state)): Promise<Case> {
  const { features, omit } = featuresFor(state, route);
  const built = route === "gov_51178" ? await lraSynthetic(features, { omit }) : await sraSynthetic(features, { omit });
  if (value === null) return { records: [], blocks: [], overlay: { datasets: [built.view], lot_geometries: [LOT], index_pins: [built.pin] } };
  const record = evidence(`test-only-reaudit-${route}`, VH, value);
  return { records: [record], blocks: [authority(record, route, LOT)], overlay: { datasets: [built.view], lot_geometries: [LOT], index_pins: [built.pin] } };
}
function merge(...cases: Case[]): Case {
  return {
    records: cases.flatMap((c) => c.records),
    blocks: cases.flatMap((c) => c.blocks),
    overlay: {
      datasets: cases.flatMap((c) => c.overlay.datasets),
      lot_geometries: [LOT],
      index_pins: cases.flatMap((c) => c.overlay.index_pins ?? []),
    },
  };
}
async function pair(r1: RouteState, r2: RouteState): Promise<Case> {
  return merge(await routeCase("gov_51178", r1), await routeCase("prc_4202", r2));
}
function run(c: Case, criterion: ProgramCriterion = promotedC(), registries: ProgramAuthorityRegistries = programAuthorityRegistries): ProgramCriterionResult {
  const result = evaluateProgramScreen({
    evidence_records: [evidence("test-only-anchor-jurisdiction", "jurisdiction", "City of Los Angeles"), evidence("test-only-anchor-match", "parcel-match", true), ...c.records],
    evidence_authority: c.blocks,
    as_of: AS_OF,
    authority_registries: registries,
    lot_overlay: c.overlay,
    packs: [{ pathway: shraPathway, criteria: [jurisdictionCriterion("la_shra"), parcelMatchCriterion("la_shra"), criterion] }],
  });
  return result.pathways[0].criteria.find((entry) => entry.criterion_id === criterion.id)!;
}
const failureCodes = (result: ProgramCriterionResult) =>
  result.authority?.facts.flatMap((fact) => fact.non_establishing.flatMap((entry) => entry.failures)) ?? [];

/* -------------------------------------------------- real pinned SRA dataset */

async function realSraView(): Promise<OverlayDatasetView> {
  const provided = inject("programScreenOverlayDataset");
  if (provided.index_text === null) throw new Error(`Real SRA index unavailable: ${provided.error}`);
  return loadOverlayDatasetView({
    index_text: provided.index_text,
    records: Object.entries(provided.records).map(([n, b64]) => ({ record_number: Number(n), content: Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)) })),
  });
}
const lotFromText = (fileId: string, text: string) => loadReviewedLotGeometry({ file_id: fileId, bytes: new TextEncoder().encode(text) });
const lotSquare = (fileId: string, x0: number, y0: number, x1: number, y1: number) =>
  loadReviewedLotGeometry({ file_id: fileId, bytes: encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [square(x0, y0, x1, y1)] }) });
function realRoute2(record: CanonicalEvidenceRecord, lot: ReviewedLotGeometry, view: OverlayDatasetView, extra: Case | null = null): Case {
  const own: Case = { records: [record], blocks: [authority(record, "prc_4202", lot)], overlay: { datasets: [view], lot_geometries: [lot] } };
  if (extra === null) return own;
  return { records: [...extra.records, record], blocks: [...extra.blocks, ...own.blocks], overlay: { datasets: [...extra.overlay.datasets, view], lot_geometries: [lot], index_pins: [...(extra.overlay.index_pins ?? []), overlayIndexPinFor(SRA.package!.members.overlay_dataset)!] } };
}
/** A TEST-ONLY Route 1 dataset at real EPSG:3310 coordinates around a real lot, so both routes see the SAME lot. */
async function route1Around(lot: ReviewedLotGeometry, label: string, value: boolean, box: [number, number, number, number]): Promise<Case> {
  const { view, pin } = await lraSynthetic([{ label, ring: square(...box) }]);
  const record = evidence(`test-only-reaudit-route1-${label}`, VH, value);
  return { records: [record], blocks: [authority(record, "gov_51178", lot)], overlay: { datasets: [view], lot_geometries: [lot], index_pins: [pin] } };
}

/* ========================================================================== */
/* 1. Recon and protected state                                               */
/* ========================================================================== */

// The output before the promotion (recorded first by the audit) and the approved projection now shipped.
const PROTECTED_EVALUATOR_SHA256 = "156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc";
const PROTECTED_DEMO_SHA256 = "4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5";
const PROMOTED_EVALUATOR_SHA256 = "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad";
const PROMOTED_DEMO_SHA256 = "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070";

describe("Re-audit 1: recon and shipped state after the c-only promotion", () => {
  it("reproduces the pre-promotion hashes recorded first, and ships exactly the audited projection", async () => {
    expect(fixture.as_of).toBe("2026-09-27");
    const before = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: fixture.as_of, packs: prePromotionPacks() });
    const beforeDemo = buildProgramScreenPublicDemoPayload(fixture, { as_of: fixture.as_of, packs: prePromotionPacks() });
    expect(await sha256Hex(JSON.stringify(before))).toBe(PROTECTED_EVALUATOR_SHA256);
    expect(await sha256Hex(JSON.stringify(beforeDemo))).toBe(PROTECTED_DEMO_SHA256);
    const result = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: fixture.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixture, { as_of: fixture.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(PROMOTED_EVALUATOR_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PROMOTED_DEMO_SHA256);
  });

  it("c and d are the only human_verified criteria; counts are 2 / 44; e/f/g pending", () => {
    expect(shippedCriteria.filter((c) => c.verification === "human_verified").map((c) => c.id)).toEqual([C, D]);
    expect(shippedCriteria.filter((c) => c.verification === "pending_human")).toHaveLength(44);
    expect(shippedCriteria.filter((c) => c.predicate === "not_encoded")).toHaveLength(34);
    for (const id of [E, F, G]) expect(shipped(id), id).toMatchObject({ verification: "pending_human", predicate: "not_encoded", human_verification: null });
  });

  it("the shipped c is exactly the audited candidate: rule, summary, question, citation, record", () => {
    const audited = promotedC();
    for (const key of Object.keys(audited) as Array<keyof ProgramCriterion>) {
      if (key === "predicate") continue;
      expect(shippedC[key], key).toEqual(audited[key]);
    }
    expect(Object.keys(shippedC).sort()).toEqual(Object.keys(audited).sort());
    expect(shippedC.rule_summary).toBe(PROPOSED_SUMMARY);
    expect(shippedC.question_if_judgment).toBe(PROPOSED_QUESTION);
    expect(shippedC.human_verification).toEqual(proposedRecord);
    expect(shippedC.citation).toMatchObject({ verified_at: "2026-10-01", next_review_at: "2026-10-31" });
    expect(shippedC.citation.verified_at).not.toBe(shippedD.citation.verified_at);
    const rule = shippedC.predicate as CriterionPredicate;
    for (const value of [true, false]) {
      expect(rule({ [VH]: { kind: "boolean", value } } as never)).toBe(proposedPredicate({ [VH]: { kind: "boolean", value } } as never));
    }
    expect(() => rule({ [HIGH]: { kind: "boolean", value: true } } as never)).toThrow();
    expect(prePromotionC()).toMatchObject({ verification: "pending_human", predicate: "not_encoded", human_verification: null });
  });

  it("G1/G2 open; outcome ceilings unchanged; c route-separated over exactly both routes", () => {
    expect(programPathwayCompletenessBlockers.map((b) => [b.id, b.status])).toEqual([["G1", "open"], ["G2", "open"]]);
    expect(shippedC.permitted_outcomes).toEqual(["consistent_with_source", "disqualifying_per_source", "requires_judgment"]);
    expect(shippedD.permitted_outcomes).toEqual(["consistent_with_source", "disqualifying_per_source", "requires_judgment"]);
    expect(cDecision.outcome_ceiling_changed).toBe(false);
    expect(shippedC.statutory_routes).toEqual({ fact_key: VH, routes: ["gov_51178", "prc_4202"] });
    expect(shippedC.fact_keys).toEqual([VH]);
  });

  it("both c authority routes are registered, independently, and High remains SRA-only", () => {
    expect(LRA).toMatchObject({ authority_source_id: "calfire-lra-fhsz-2025-03-24-v1", issuer_id: "calfire-osfm", fact_keys: [VH], superseded_by: null, edition: { date: "2025-03-24" } });
    expect(LRA.package).toMatchObject({ statutory_basis: "gov_51178", identification: { status: "state_identification_recommendation" }, active_metadata: { fid: 3, layer: "FHSALRA25_v1_All" }, overlay: { class_field: "FHSZ_Description" } });
    expect(SRA).toMatchObject({ authority_source_id: "calfire-sra-fhsz-2023-09-29", issuer_id: "calfire-osfm", superseded_by: null, edition: { date: "2023-09-29" } });
    expect(SRA.package).toMatchObject({ statutory_basis: "prc_4202", adoption: { status: "adopted", adoption_date: "2024-01-31" }, overlay: { dataset_name: "FHSZSRA_23_3", class_field: "FHSZ_Descr" } });
    const vhIds = programAuthorityRegistries.fact_policies[VH]!.establishing.map((e) => e.authority_source_ids);
    expect(vhIds).toEqual([[SRA.authority_source_id], [LRA.authority_source_id]]);
    expect(programAuthorityRegistries.fact_policies[HIGH]!.establishing.map((e) => e.authority_source_ids)).toEqual([[SRA.authority_source_id]]);
    expect(programAuthorityRegistries.fact_policies[VH]!.requires_legal_lot_identity).toBe(true);
    expect(programAuthorityRegistries.fact_policies[VH]!.prohibited_establishing_kinds).toContain("city_parcel_display");
  });

  it("Phase 3E/3F reviewed-lot / private-evidence infrastructure is present", () => {
    for (const fn of [computeLotOverlay, loadReviewedLotGeometry, loadCaseOverlay, loadCaseLraOverlay, evaluateStoredCaseProgramScreen]) expect(typeof fn).toBe("function");
    expect(overlayIndexPins.map((pin) => pin.dataset.source_id)).toEqual(["calfire-fhszsra-23-3-data", "calfire-fhszlra-25-1-all-data"]);
    expect(overlayIndexPinFor(SRA.package!.members.overlay_dataset)?.index_sha256).toBe(sraValidityProfile.index_sha256);
  });

  it("the Phase 3H promotion record states exactly what shipped, and the cross-route follow-up", () => {
    for (const text of [shippedC.rule_summary, PROPOSED_QUESTION, MEMO_EXCERPT, proposedRecord.source_capture.sha256, PROMOTED_EVALUATOR_SHA256, PROMOTED_DEMO_SHA256]) {
      expect(phase3hPromotionDoc).toContain(text);
    }
    expect(phase3hPromotionDoc).toContain("`verified_at` 2026-10-01, `next_review_at` 2026-10-31");
    expect(phase3hPromotionDoc).toContain('`decision_ref` `{ phase: "3B", letter: "c" }`');
    expect(phase3hPromotionDoc).toContain("`human_verified` = 2, `pending_human` = 44");
    expect(phase3hPromotionDoc).toContain(
      "Before production c evidence generation is wired, harden the shared evaluator so Route 1 and Route 2 records must refer to the same reviewed legal-lot geometry and identity before two negatives can combine to clear c.",
    );
    expect(phase3hPromotionDoc).not.toContain("VERIFICATION_PLACEHOLDER");
  });

  it("no gate blocks the shipped c; before promotion only the two reviewer gates did", () => {
    expect(criterionPromotionBlockers(shippedC)).toEqual([]);
    expect(criterionAwaitsHumanVerification(shippedC)).toBe(false);
    expect(criterionPromotionBlockers(prePromotionC())).toEqual(["reviewer_confirms_encoded_rule", "human_verification_record"]);
    expect(programAuthorityRegistries.criterion_requirements[C].promotion_gates).toEqual(cDecision.promotion_gates);
  });
});

/* ========================================================================== */
/* 2. The prior relevant-invalid SRA blocker, reproduced first                */
/* ========================================================================== */

describe("Re-audit 2: prior relevant-invalid SRA blocker (FHSZSRA_23_3 record 10977 / GDAL FID 10976)", () => {
  it("the pinned index re-derived from the original archive carries record 10977 as invalid Very High with its GEOS diagnosis", async () => {
    const provided = inject("programScreenOverlayDataset");
    expect(provided.error).toBeNull();
    expect(await sha256Hex(provided.index_text!)).toBe(sraValidityProfile.index_sha256);
    expect(provided.validity_manifest_sha256).toBe(sraValidityProfile.validity_manifest_sha256);
    expect(provided.validity_counts).toEqual({ invalid: 233, valid: 18190 });
    expect(provided.invalid_counts).toEqual({ High: 70, Moderate: 24, "Very High": 139 });
    const entry = parseOverlayIndex(provided.index_text!).entries[10977 - 1];
    expect(entry).toMatchObject({ record_number: 10977, label: "Very High", geometry_state: "invalid", content_sha256: "a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13" });
    expect(entry.topology_diagnostic).toBe("Ring Self-intersection at or near point 237657.61459999904 -405236.31659999955");
  });

  it.each([
    ["original audit witness", 236688, -401049, 236696, -401041],
    ["re-audit witness A", 236690, -401045, 236691, -401044],
    ["re-audit witness B (fixture box corner)", 236687.5, -401049.5, 236688.5, -401048.5],
  ])("relevant invalid Very High cannot establish Route 2 YES: %s", async (_name, x0, y0, x1, y1) => {
    const view = await realSraView();
    const lot = await lotSquare(`test-only-reaudit-10977-${x0}`, x0, y0, x1, y1);
    const computed = computeLotOverlay(view, lot);
    expect(computed.candidate_records).toContain(10977);
    expect(computed.lot_within_features).toBe("not_established");
    expect(computed.classes_on_lot).toEqual([]);
    const result = run(realRoute2(evidence("test-only-reaudit-10977-yes", VH, true), lot, view));
    expect(result.status).toBe("unknown");
    expect(result.authority?.established).toBe(false);
    expect(failureCodes(result)).toContain("lot_overlay_not_established");
    expect(result.statutory_routes?.find((r) => r.route === "prc_4202")?.value).toBe(true); // Layer 1 claim
    expect(result.authority?.facts.find((f) => f.route === "prc_4202")?.established).toBe(false); // Layer 2 refuses it
  });

  it("the PRC §4202 route stays unknown even with a qualifying Route 1 NO; a claimed NO on the same relevant invalid feature cannot clear", async () => {
    const view = await realSraView();
    const lot = await lotSquare("test-only-reaudit-10977-pair", 236688, -401049, 236696, -401041);
    const r1No = await route1Around(lot, "Moderate", false, [236600, -401100, 236800, -401000]);
    expect(run(realRoute2(evidence("test-only-reaudit-10977-yes2", VH, true), lot, view, r1No)).status).toBe("unknown");
    const both = run(realRoute2(evidence("test-only-reaudit-10977-no", VH, false), lot, view, r1No));
    expect(both.status).toBe("unknown");
    expect(both.authority?.facts.find((f) => f.route === "prc_4202")?.established).toBe(false);
    expect(both.authority?.facts.find((f) => f.route === "gov_51178")?.established).toBe(true);
  });

  it.each(["High", "Moderate"])("a relevant invalid %s SRA feature cannot establish Route 2 NO (TEST-ONLY pinned geometry)", async (label) => {
    const { view, pin } = await sraSynthetic([{ label, ring: square(0, 0, 100, 100), state: "invalid" }]);
    expect(computeLotOverlay(view, LOT).lot_within_features).toBe("not_established");
    const r1No = await routeCase("gov_51178", "NO");
    const record = evidence("test-only-reaudit-invalid-nonvh", VH, false);
    const c = merge(r1No, { records: [record], blocks: [authority(record, "prc_4202", LOT)], overlay: { datasets: [view], lot_geometries: [LOT], index_pins: [pin] } });
    const result = run(c);
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("lot_overlay_not_established");
  });

  it("an invalid feature elsewhere in the state does not poison an unrelated real lot", async () => {
    const view = await realSraView();
    const lot = await lotFromText("test-only-reaudit-whole-vh", wholeVeryHighText);
    const computed = computeLotOverlay(view, lot);
    const invalidAnywhere = view.entries().filter((e) => e.geometry_state !== "valid");
    expect(invalidAnywhere).toHaveLength(233);
    expect(computed.candidate_records.some((n) => invalidAnywhere.some((e) => e.record_number === n))).toBe(false);
    expect(computed).toMatchObject({ lot_within_features: "whole_lot", classes_on_lot: ["Very High"] });
    expect(run(realRoute2(evidence("test-only-reaudit-real-vh", VH, true), lot, view)).status).toBe("disqualifying_per_source");
  });

  it("the original 3E very-high-moderate fixture lot (10977 is a candidate) is unknown for YES and NO", async () => {
    const view = await realSraView();
    const lot = await lotFromText("test-only-reaudit-vh-mod", veryHighModerateText);
    expect(computeLotOverlay(view, lot).lot_within_features).toBe("not_established");
    for (const value of [true, false]) expect(run(realRoute2(evidence(`test-only-reaudit-vhm-${value}`, VH, value), lot, view)).status).toBe("unknown");
  });
});

/* ========================================================================== */
/* 3. Rule-to-code matrix (Phase 3B c points 1-8 and the common terms)        */
/* ========================================================================== */

describe("Re-audit 3: Phase 3B c rule-to-code matrix", () => {
  it("pins the decision text the matrix is read against", () => {
    expect(cDecision.rule_as_decided).toHaveLength(8);
    expect(cDecision.decision).toBe("approve_revised_rule");
    expect(decisionRecord.decided_on).toBe("2026-09-28");
    expect(cDecision.rule_as_decided[0]).toContain("Very High only. A High class on any record, including a PRC §4202 map, never establishes c.");
    expect(cDecision.rule_as_decided[4]).toContain("A negative under one route alone gives unknown.");
  });

  it("P1 Very High only: a whole-lot High overlay never establishes c on either route", async () => {
    for (const route of ["gov_51178", "prc_4202"] as const) {
      const yes = run(await routeCase(route, "High", true));
      expect(yes.status, route).toBe("unknown");
      expect(failureCodes(yes)).toContain("lot_overlay_classes_do_not_support_value");
    }
    // A High hazard_map block cannot describe the Very High fact at all.
    const r = evidence("test-only-reaudit-high-class", VH, true);
    const b = clone(authority(r, "prc_4202", LOT), (d) => (d.qualifiers.hazard_class = "high"));
    expect(() => parseProgramEvidenceAuthority([b], [r])).toThrow(/never stand in/);
  });

  it("P2 qualifying records: CAL FIRE agency + route section; City display cannot establish; gate adds no conflict", async () => {
    const yes = await routeCase("prc_4202", "YES");
    for (const change of [
      (d: any) => (d.qualifiers.named_agency = "other_agency"),
      (d: any) => (d.qualifiers.statutory_basis = "other_basis"),
      (d: any) => (d.record_kind = "city_parcel_display"),
    ]) {
      const blocks = yes.blocks.map((b) => clone(b, change));
      const records = change.toString().includes("city_parcel_display") ? yes.records.map((r) => ({ ...r, evidence_type: "official_portal" as const })) : yes.records;
      expect(run({ ...yes, records, blocks }).status).toBe("unknown");
    }
    // Only non-qualifying evidence: unknown, never conflict.
    expect(run({ ...yes, blocks: [] }).status).toBe("unknown");
    // Disagreement between known values is Layer 1 conflict; the gate never runs.
    const city = evidence("test-only-reaudit-city-no", VH, false);
    const disagree = run({ ...yes, records: [...yes.records, city] });
    expect(disagree.status).toBe("conflict");
    expect(disagree.authority).toBeUndefined();
  });

  it("P3 YES on either route; a negative never cancels it", async () => {
    expect(run(await pair("YES", "NO")).status).toBe("disqualifying_per_source");
    expect(run(await pair("NO", "YES")).status).toBe("disqualifying_per_source");
  });

  it("P4 partial coverage per route is unknown and never summed across routes; no threshold", async () => {
    expect(run(await pair("partial", "unknown")).status).toBe("unknown");
    // Complementary halves: each route partial, union whole; still unknown.
    const left = await routeCase("gov_51178", "partial");
    const { view, pin } = await sraSynthetic([{ label: "Very High", ring: square(50, 0, 100, 100) }]);
    const rec = evidence("test-only-reaudit-right-half", VH, true);
    const c = merge(left, { records: [rec], blocks: [authority(rec, "prc_4202", LOT)], overlay: { datasets: [view], lot_geometries: [LOT], index_pins: [pin] } });
    expect(computeLotOverlay(view, LOT).lot_within_features).toBe("part_of_lot");
    expect(run(c).status).toBe("unknown");
    // 99.98% coverage is still partial: no percentage threshold.
    const nearly = await sraSynthetic([{ label: "Very High", ring: square(0, 0, 89.99, 100) }]);
    expect(computeLotOverlay(nearly.view, LOT).lot_within_features).toBe("part_of_lot");
  });

  it("P5 NO only when both routes are qualifying NO; one-route NO is unknown", async () => {
    expect(run(await pair("NO", "NO")).status).toBe("consistent_with_source");
    // Layer 1 alone refuses a one-route NO: the combined fact stays unknown, so the gate never even runs.
    for (const [r1, r2] of [["NO", "unknown"], ["unknown", "NO"]] as const) {
      const result = run(await pair(r1, r2));
      expect(result.status).toBe("unknown");
      expect(result.authority).toBeUndefined();
      expect(result.statutory_routes?.map((r) => r.value)).toEqual(r1 === "NO" ? [false, null] : [null, false]);
    }
  });

  it("P6 required fields: agency, route, record identity, edition (adoption for Route 2) fail closed", async () => {
    for (const route of ["gov_51178", "prc_4202"] as const) {
      const base = await routeCase(route, "YES");
      const mutations: Array<[string, (d: any) => void]> = [
        ["agency", (d) => (d.qualifiers.named_agency = "not_established")],
        ["route", (d) => (d.qualifiers.statutory_basis = "not_established")],
        ["identity", (d) => (d.source_identifier.value = "test-only-unregistered")],
        ["capture", (d) => (d.capture.sha256_extracted = "0".repeat(64))],
        ["edition", (d) => { d.edition.date = null; d.edition.date_kind = null; }],
        ["edition-other", (d) => (d.edition.date = "2020-01-01")],
        ["currency", (d) => (d.edition.currency_checked_on = null)],
        ["currency-superseded", (d) => (d.edition.currency = "superseded")],
        ["review", (d) => { d.authority_review = { status: "unreviewed", reviewer: null, reviewed_on: null }; }],
      ];
      if (route === "prc_4202") mutations.push(["adoption", (d) => (d.qualifiers.adoption_status = "not_established")]);
      for (const [name, change] of mutations) {
        expect(run({ ...base, blocks: base.blocks.map((b) => clone(b, change)) }).status, `${route} ${name}`).toBe("unknown");
      }
    }
  });

  it("P7 responsibility area is context only and never picks or rules out a route", async () => {
    for (const area of ["state", "local", "federal", "not_stated"] as const) {
      for (const route of ["gov_51178", "prc_4202"] as const) {
        const base = await routeCase(route, "YES");
        expect(run({ ...base, blocks: base.blocks.map((b) => clone(b, (d) => (d.qualifiers.responsibility_area_as_stated = area))) }).status).toBe("disqualifying_per_source");
      }
    }
  });

  it("P8 / lot identity rule: APN is not the legal lot; unclear identity or no reference is unknown", async () => {
    for (const identity of ["not_established", "parcel_and_legal_lot_differ", "tied_or_multiple_lots", "merger_or_resubdivision_pending_or_proposed"]) {
      const base = await pair("YES", "YES");
      const result = run({ ...base, blocks: base.blocks.map((b) => clone(b, (d) => (d.parcel_relationship.legal_lot_identity = identity))) });
      expect(result.status, identity).toBe("unknown");
      expect(failureCodes(result)).toContain("legal_lot_identity_not_established");
    }
    const base = await pair("NO", "NO");
    expect(run({ ...base, blocks: base.blocks.map((b) => clone(b, (d) => (d.parcel_relationship.legal_lot_reference = null))) }).status).toBe("unknown");
    // Matching by APN or address alone is not a spatial overlay of the legal lot.
    for (const by of ["parcel_identifier", "legal_description", "address_only", "not_established"]) {
      const yes = await routeCase("prc_4202", "YES");
      const result = run({ ...yes, blocks: yes.blocks.map((b) => clone(b, (d) => (d.parcel_relationship.matched_by = by))) });
      expect(result.status, by).toBe("unknown");
    }
  });

  it("authority gate only downgrades: it never manufactures YES, NO, or conflict", async () => {
    // A Layer 1 unknown is never upgraded, whatever the overlay shows.
    expect(run(await pair("unknown", "unknown")).status).toBe("unknown");
    const whole = await routeCase("prc_4202", "YES", null);
    expect(whole.records).toHaveLength(0);
    expect(run(whole).status).toBe("unknown");
    // A claimed NO over a computed Very High lot is refused, not flipped to YES.
    const wrongNo = await pair("NO", "YES");
    const blocks = wrongNo.blocks;
    const recs = wrongNo.records.map((r) => (r.id.includes("prc_4202") ? evidence(r.id, VH, false) : r));
    const result = run({ ...wrongNo, records: recs, blocks: blocks.map((b, i) => (i === 1 ? authority(recs[1], "prc_4202", LOT) : b)) });
    expect(result.status).toBe("unknown");
  });

  it("outcome ceiling is unchanged by the proposed promotion", () => {
    expect(promotedC().permitted_outcomes).toBe(shippedC.permitted_outcomes);
    expect(promotedC().statutory_routes).toBe(shippedC.statutory_routes);
    expect(promotedC().gating).toBe(shippedC.gating);
    expect(promotedC().exception_paths).toBe(shippedC.exception_paths);
  });
});

/* ========================================================================== */
/* 4. Route 1: calfire-lra-fhsz-2025-03-24-v1 (GOV §51178)                    */
/* ========================================================================== */

describe("Re-audit 4: Route 1 GOV §51178 / 2025 LRA", () => {
  const routeOnly = async (state: RouteState, value: boolean | null = claimed(state)) => {
    const c = await routeCase("gov_51178", state, value);
    return { c, result: run(c), fact: () => run(c).authority?.facts.find((f) => f.route === "gov_51178") };
  };

  it("issuer, statute, exact package pins, active metadata, CRS and semantic field are what the registry enforces", () => {
    const pack = LRA.package!;
    if (pack.statutory_basis !== "gov_51178") throw new Error("wrong package");
    expect(pack.members.identification_statute).toEqual({ source_id: "gcs-51178", sha256_extracted: "3eac548aa2e63d82a08fd8996207550e7970715cd17984a7e2a7df4e8cc1fd63" });
    expect(pack.members.local_designation_statute.source_id).toBe("gcs-51179");
    expect(pack.members.overlay_dataset).toEqual({ source_id: "calfire-fhszlra-25-1-all-data", sha256_extracted: "5724d4a456ddbf7845a116d162d96fc51b4a295c4c05a92d91fb2049cd4f1dad" });
    expect(pack.manifest_sha256).toBe("f86e0a2157f3a44594da51fd2ffeb4e1a19c935ca2f00f0cc40e82df0bd86797");
    expect(pack.overlay.class_labels).toEqual({ "Very High": "very_high", High: "high", Moderate: "moderate", NonWildland: "non_wildland" });
    for (const change of [
      (r: any) => (r.sources[1].package.active_metadata.layer = "FHSALRA25_v1_Other"),
      (r: any) => (r.sources[1].package.active_metadata.fid = 4),
      (r: any) => (r.sources[1].package.overlay.class_field = "FHSZ"),
      (r: any) => (r.sources[1].package.overlay.class_labels.NonWildland = "moderate"),
      (r: any) => (r.sources[1].fact_keys = [VH, HIGH]),
      (r: any) => (r.sources[1].edition.date = "2025-03-25"),
    ]) expect(() => parseProgramAuthorityRegistries(clone(programAuthorityRegistries, change))).toThrow();
    const provided = inject("programScreenLraDataset");
    expect(provided.error).toBeNull();
    for (const kind of ["metadata_xml", "metadata_to_layer"]) expect(provided.native_mutations[kind]).not.toBe("ACCEPTED");
  });

  it("Very High supports Route 1 YES", async () => {
    const { result } = await routeOnly("YES");
    expect(result.status).toBe("disqualifying_per_source");
    expect(result.authority?.facts.find((f) => f.route === "gov_51178")?.established).toBe(true);
  });

  it.each(["High", "NO", "NonWildland"] as const)("%s supports only a qualifying Route 1 negative, never a YES", async (state) => {
    const neg = await routeOnly(state, false);
    expect(neg.result.status).toBe("unknown"); // one-route NO
    const both = merge(neg.c, await routeCase("prc_4202", "NO"));
    expect(run(both).status).toBe("consistent_with_source");
    expect(run(both).authority?.facts.find((f) => f.route === "gov_51178")?.established).toBe(true);
    const claimedYes = await routeOnly(state, true);
    expect(claimedYes.result.status).toBe("unknown");
    expect(failureCodes(claimedYes.result)).toContain("lot_overlay_classes_do_not_support_value");
  });

  it("NonWildland is a computed 'not Very High', never a no-wildfire-hazard statement", async () => {
    expect(LRA.package!.overlay.class_labels.NonWildland).toBe("non_wildland");
    const both = run(merge(await routeCase("gov_51178", "NonWildland", false), await routeCase("prc_4202", "NO")));
    expect(both.status).toBe("consistent_with_source");
    expect(both.statement).not.toMatch(/no (wild)?fire hazard|not (a )?fire hazard|no hazard|safe/i);
    expect(findProhibitedClientLanguage(both.statement)).toEqual([]);
  });

  it("mixed Very High + another class is unknown in both directions; partial is unknown", async () => {
    for (const value of [true, false]) expect((await routeOnly("mixed", value)).result.status).toBe("unknown");
    expect(run(merge(await routeCase("gov_51178", "mixed", false), await routeCase("prc_4202", "NO"))).status).toBe("unknown");
    expect((await routeOnly("partial", true)).result.status).toBe("unknown");
  });

  it.each(["invalid", "unreadable", "missing", "outside"] as const)("relevant %s geometry forces Route 1 unknown", async (state) => {
    for (const value of [true, false]) {
      const result = run(merge(await routeCase("gov_51178", state, value), await routeCase("prc_4202", "NO")));
      expect(result.status, String(value)).toBe("unknown");
    }
  });

  it("an unrelated invalid LRA feature does not poison the lot", async () => {
    expect((await routeOnly("unrelatedInvalidYES")).result.status).toBe("disqualifying_per_source");
  });

  it("wrong route, package, issuer, edition, layer or CRS fails closed", async () => {
    const yes = await routeCase("gov_51178", "YES");
    const cases: Array<[string, (d: any) => void]> = [
      ["route", (d) => (d.qualifiers.statutory_basis = "prc_4202")],
      ["package", (d) => { d.source_identifier.value = SRA.authority_source_id; d.capture = { store: "repo_official_source", ...SRA.capture }; d.edition = { ...d.edition, ...SRA.edition }; }],
      ["issuer", (d) => (d.issuer.issuer_id = "test-only-other-issuer")],
      ["edition", (d) => (d.edition.date = "2025-03-23")],
      ["dataset", (d) => (d.qualifiers.lot_overlay.dataset = SRA.package!.members.overlay_dataset)],
    ];
    for (const [name, change] of cases) expect(run({ ...yes, blocks: yes.blocks.map((b) => clone(b, change)) }).status, name).toBe("unknown");
    for (const opts of [{ crs: 2229 }, { layer: "FHSALRA25_v1_Other" }]) {
      const { view, pin } = await lraSynthetic(featuresFor("YES", "gov_51178").features, opts);
      expect(run({ ...yes, overlay: { datasets: [view], lot_geometries: [LOT], index_pins: [pin] } }).status, JSON.stringify(opts)).toBe("unknown");
    }
    const superseded = clone(programAuthorityRegistries, (r) => {
      const next = structuredClone(r.sources[1]);
      next.authority_source_id = "calfire-lra-fhsz-test-only-next";
      r.sources[1].superseded_by = next.authority_source_id;
      r.sources.push(next);
    });
    expect(run(yes, promotedC(), superseded).status).toBe("unknown");
  });

  it("LRA evidence can never establish d (High)", async () => {
    const { view, pin } = await lraSynthetic([{ label: "High", ring: square(0, 0, 100, 100) }]);
    const r = evidence("test-only-reaudit-lra-high", HIGH, true);
    const b = clone(authority(r, "gov_51178", LOT), (d) => (d.qualifiers.legend_defines_class_for_lot = "yes"));
    const screen = evaluateProgramScreen({
      evidence_records: [evidence("a-j", "jurisdiction", "City of Los Angeles"), evidence("a-m", "parcel-match", true), r],
      evidence_authority: [b],
      as_of: AS_OF,
      lot_overlay: { datasets: [view], lot_geometries: [LOT], index_pins: [pin] },
    });
    const d = screen.pathways[0].criteria.find((c) => c.criterion_id === D)!;
    expect(d.status).toBe("unknown");
    expect(d.authority?.facts[0].non_establishing[0].failures).toEqual(expect.arrayContaining(["statutory_route_not_accepted"]));
  });

  it("City adoption under GOV §51179 is not a Route 1 gate", async () => {
    for (const adoption of ["not_adopted", "not_established", "adopted"] as const) {
      const yes = await routeCase("gov_51178", "YES");
      expect(run({ ...yes, blocks: yes.blocks.map((b) => clone(b, (d) => (d.qualifiers.adoption_status = adoption))) }).status, adoption).toBe("disqualifying_per_source");
    }
  });
});

/* ========================================================================== */
/* 5. Route 2: calfire-sra-fhsz-2023-09-29 (PRC §4202)                        */
/* ========================================================================== */

describe("Re-audit 5: Route 2 PRC §4202 / SRA", () => {
  it("PRC §4202 only, adopted only: adoption status and package adoption are enforced", async () => {
    const yes = await routeCase("prc_4202", "YES");
    expect(run(yes).status).toBe("disqualifying_per_source");
    for (const status of ["not_adopted", "not_established"] as const) {
      const result = run({ ...yes, blocks: yes.blocks.map((b) => clone(b, (d) => (d.qualifiers.adoption_status = status))) });
      expect(result.status).toBe("unknown");
      expect(failureCodes(result)).toContain("hazard_map_adoption_not_established");
    }
    expect(() => parseProgramAuthorityRegistries(clone(programAuthorityRegistries, (r) => (r.sources[0].package.adoption.status = "proposed")))).toThrow();
  });

  it("an LRA/GOV §51178 record cannot masquerade as Route 2 evidence", async () => {
    const yes = await routeCase("prc_4202", "YES");
    const masquerade = yes.blocks.map((b) => clone(b, (d) => { d.source_identifier.value = LRA.authority_source_id; d.capture = { store: "repo_official_source", ...LRA.capture }; d.edition = { ...d.edition, ...LRA.edition }; }));
    const result = run({ ...yes, blocks: masquerade });
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("statutory_route_not_accepted");
  });

  it("exact Very High semantics and complete negative semantics", async () => {
    expect(run(await pair("unknown", "YES")).status).toBe("disqualifying_per_source");
    for (const state of ["High", "NO"] as const) {
      expect(run(await pair("NO", state)).status, state).toBe("consistent_with_source");
      expect(run(await routeCase("prc_4202", state, true)).status, state).toBe("unknown");
    }
    expect(run(await pair("NO", "mixed")).status).toBe("unknown");
    expect(run(await pair("NO", "outside")).status).toBe("unknown");
  });

  it("validity pins are enforced: legacy 1.0.0 cannot load against the shipped pin; missing or tampered validity is refused", async () => {
    const provided = inject("programScreenOverlayDataset");
    const index = provided.index_text!;
    const lines = index.split("\n");
    // Legacy form of the same records, without topology verdicts.
    const legacy = [
      "program-screen-overlay-index 1.0.0",
      ...lines.slice(1, 8),
      lines[10],
      ...lines.slice(11).filter((l) => l.length > 0).map((l) => l.replace(/ (valid|invalid|unreadable) (null|"(?:[^"\\]|\\.)*")$/, "")),
      "",
    ].join("\n");
    // Byte-identical to the historical, replaced SRA index 1.0.0.
    expect(await sha256Hex(legacy)).toBe("caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff");
    await expect(loadOverlayDatasetView({ index_text: legacy, records: [] })).rejects.toThrow(/not the one pinned/);
    const missing = lines.map((l, i) => (i === 10 + 10984 ? l.replace(/ valid null$/, "") : l)).join("\n");
    await expect(loadOverlayDatasetView({ index_text: missing, records: [] })).rejects.toThrow();
    const flipped = lines.map((l, i) => (i === 10 + 10977 ? l.replace(/ invalid "Ring Self-intersection[^"]*"$/, " valid null") : l)).join("\n");
    expect(flipped).not.toBe(index);
    await expect(loadOverlayDatasetView({ index_text: flipped, records: [] })).rejects.toThrow(/not the one pinned/);
  });

  it("a hash-mismatched relevant record is refused; unreadable/null relevant SRA geometry is unknown", async () => {
    const view = await realSraView();
    const provided = inject("programScreenOverlayDataset");
    const bytes = Uint8Array.from(atob(provided.records["10984"]), (ch) => ch.charCodeAt(0));
    bytes[60] ^= 1;
    await expect(loadOverlayDatasetView({ index_text: provided.index_text!, records: [{ record_number: 10984, content: bytes }] })).rejects.toThrow(/does not match the index/);
    expect(view.feature(10977)).toBeDefined(); // retained, never repaired or dropped
    const unreadable = await sraSynthetic([{ label: "Very High", ring: null, state: "unreadable" }, { label: "Moderate", ring: square(0, 0, 100, 100) }]);
    expect(computeLotOverlay(unreadable.view, LOT).lot_within_features).toBe("not_established");
    expect(run(await pair("NO", "unreadable")).status).toBe("unknown");
    expect(run(await pair("NO", "invalid")).status).toBe("unknown");
    expect(run(await pair("NO", "invalidNonVH")).status).toBe("unknown");
    expect(run(await pair("NO", "missing")).status).toBe("unknown");
  });

  it("no source geometry is silently repaired: the view's invalid feature rings equal the original record coordinates", async () => {
    const view = await realSraView();
    const provided = inject("programScreenOverlayDataset");
    const raw = Uint8Array.from(atob(provided.records["10977"]), (ch) => ch.charCodeAt(0));
    const dv = new DataView(raw.buffer);
    const points = dv.getInt32(40, true);
    const parts = dv.getInt32(36, true);
    const base = 44 + 4 * parts;
    const original = Array.from({ length: points * 2 }, (_, i) => dv.getFloat64(base + 8 * i, true));
    expect(view.feature(10977)!.rings.flat()).toEqual(original);
    expect(await bytesSha256(raw)).toBe("a7fa01d2e6d9af7e5c21111c9edb4a8c3eedc1af0545e4aa4d6c1ea97312db13");
  });

  it.each(["gov_51178", "prc_4202"] as const)("a relevant record missing from the %s view cannot let the remaining features establish a NO", async (route) => {
    // Moderate covers the whole lot; a Very High feature also covers it but its record is not supplied.
    const features: SynthFeature[] = [{ label: "Moderate", ring: square(0, 0, 100, 100) }, { label: "Very High", ring: square(0, 0, 100, 100) }];
    const built = route === "gov_51178" ? await lraSynthetic(features, { omit: [2] }) : await sraSynthetic(features, { omit: [2] });
    expect(computeLotOverlay(built.view, LOT).lot_within_features).toBe("not_established");
    const record = evidence(`test-only-reaudit-missing-${route}`, VH, false);
    const own: Case = { records: [record], blocks: [authority(record, route, LOT)], overlay: { datasets: [built.view], lot_geometries: [LOT], index_pins: [built.pin] } };
    const other = await routeCase(route === "gov_51178" ? "prc_4202" : "gov_51178", "NO");
    expect(run(merge(own, other)).status).toBe("unknown");
  });

  it("unrelated invalid SRA features do not poison an unrelated synthetic parcel either", async () => {
    expect(run(await pair("NO", "unrelatedInvalidYES")).status).toBe("disqualifying_per_source");
  });
});

/* ========================================================================== */
/* 6. Combined two-route logic                                                */
/* ========================================================================== */

describe("Re-audit 6: combined two-route truth table (shipped registries, ONE reviewed lot)", () => {
  it.each([
    ["YES", "YES", "disqualifying_per_source"],
    ["YES", "unknown", "disqualifying_per_source"],
    ["unknown", "YES", "disqualifying_per_source"],
    ["YES", "NO", "disqualifying_per_source"],
    ["NO", "YES", "disqualifying_per_source"],
    ["NO", "NO", "consistent_with_source"],
    ["NO", "unknown", "unknown"],
    ["unknown", "NO", "unknown"],
    ["unknown", "unknown", "unknown"],
  ] as const)("Route 1 %s + Route 2 %s => %s", async (r1, r2, expected) => {
    const c = await pair(r1, r2);
    const result = run(c);
    expect(result.status).toBe(expected);
    if (expected !== "unknown") expect(result.authority?.established).toBe(true);
    // Same reviewed lot and legal-lot reference on both routes.
    expect(new Set(c.blocks.map((b) => (b.qualifiers as any).lot_overlay.lot_geometry.sha256))).toEqual(new Set(c.blocks.length ? [LOT.sha256] : []));
    expect(new Set(c.blocks.map((b) => b.parcel_relationship.legal_lot_reference)).size).toBeLessThanOrEqual(1);
  });

  it.each([
    ["partial", "NO", "unknown"],
    ["NO", "partial", "unknown"],
    ["partial", "YES", "disqualifying_per_source"],
    ["YES", "partial", "disqualifying_per_source"],
    ["invalid", "NO", "unknown"],
    ["NO", "invalid", "unknown"],
    ["invalid", "YES", "disqualifying_per_source"],
    ["YES", "invalid", "disqualifying_per_source"],
    ["unreadable", "NO", "unknown"],
    ["NO", "unreadable", "unknown"],
    ["missing", "NO", "unknown"],
    ["High", "NO", "consistent_with_source"],
    ["NonWildland", "NO", "consistent_with_source"],
    ["mixed", "NO", "unknown"],
    ["NO", "mixed", "unknown"],
    ["outside", "NO", "unknown"],
    ["NO", "outside", "unknown"],
    ["outside", "YES", "disqualifying_per_source"],
    ["YES", "outside", "disqualifying_per_source"],
  ] as const)("Route 1 %s + Route 2 %s => %s", async (r1, r2, expected) => {
    expect(run(await pair(r1, r2)).status).toBe(expected);
  });

  it("a conflicts_with link cannot let one route's record establish the other route's NO", async () => {
    // Route 1: qualifying NO. Route 2: a non-qualifying NO (wrong agency), explicitly linked to Route 1.
    const c = await pair("NO", "NO");
    const [r1, r2] = c.records;
    const linked = [{ ...r1, conflicts_with: [r2.id] }, { ...r2, conflicts_with: [r1.id] }];
    const blocks = [c.blocks[0], clone(c.blocks[1], (d) => (d.qualifiers.named_agency = "other_agency"))];
    const result = run({ ...c, records: linked, blocks });
    expect(result.status).toBe("unknown");
    const route2 = result.authority?.facts.find((f) => f.route === "prc_4202");
    expect(route2?.established).toBe(false);
    expect(route2?.non_establishing.find((n) => n.evidence_id === r1.id)?.failures).toContain("statutory_route_not_accepted");
  });

  it("no route infers anything from the other route's geography", async () => {
    // Route 2 YES; Route 1's dataset does not cover the lot at all (outside), and no Route 1 record.
    const r2 = await routeCase("prc_4202", "YES");
    const r1Geo = await routeCase("gov_51178", "outside", null);
    expect(run(merge(r1Geo, r2)).status).toBe("disqualifying_per_source");
    // Route 2 NO where Route 1 has no coverage: never a "Route 1 doesn't apply" NO.
    expect(run(merge(r1Geo, await routeCase("prc_4202", "NO"))).status).toBe("unknown");
    // A Route 1 record cannot be evaluated against the Route 2 dataset (or vice versa).
    const r1 = await routeCase("gov_51178", "YES");
    const crossed = { ...r1, overlay: (await routeCase("prc_4202", "YES")).overlay };
    expect(run(crossed).status).toBe("unknown");
  });

  it("wrong package/route/superseded source and manual attestations cannot create an outcome", async () => {
    const both = await pair("NO", "NO");
    const manual = both.blocks.map((b) => clone(b, (d) => { d.coverage = "none_of_parcel"; d.qualifiers.map_covers_lot = "yes"; d.qualifiers.legend_defines_class_for_lot = "yes"; d.qualifiers.lot_overlay.method = "not_performed"; }));
    expect(run({ ...both, blocks: manual }).status).toBe("unknown");
    const typedClasses = clone(both.blocks, (d) => (d[0].qualifiers.lot_overlay.classes_on_lot = ["Moderate"]));
    expect(() => parseProgramEvidenceAuthority(typedClasses, both.records)).toThrow();
    const swapped = both.blocks.map((b) => clone(b, (d) => (d.qualifiers.statutory_basis = d.qualifiers.statutory_basis === "gov_51178" ? "prc_4202" : "gov_51178")));
    expect(run({ ...both, blocks: swapped }).status).toBe("unknown");
    const superseded = clone(programAuthorityRegistries, (r) => {
      const next = structuredClone(r.sources[0]);
      next.authority_source_id = "calfire-sra-fhsz-test-only-next";
      r.sources[0].superseded_by = next.authority_source_id;
      r.sources.push(next);
    });
    expect(run(both, promotedC(), superseded).status).toBe("unknown");
  });

  it("Phase 3I invariant: the shared evaluator requires both routes' negative records to rest on the same verified lot geometry", async () => {
    // Lot A is wholly Very High on Route 2; lot B (elsewhere) is wholly Moderate on Route 2.
    const lotB = await loadReviewedLotGeometry({
      file_id: "test-only-reaudit-other-lot",
      bytes: encode({ schema_version: "program-screen-lot-geometry-v1", crs: "EPSG:3310", type: "Polygon", coordinates: [square(510, 20, 590, 80)] }),
    });
    const { view, pin } = await sraSynthetic([{ label: "Very High", ring: square(0, 0, 100, 100) }, { label: "Moderate", ring: square(500, 0, 600, 100) }]);
    expect(computeLotOverlay(view, LOT).classes_on_lot).toEqual(["Very High"]);
    const r1 = await routeCase("gov_51178", "NO"); // Route 1 NO on lot A
    const r2 = evidence("test-only-reaudit-r2-other-lot", VH, false); // Route 2 NO, but computed on lot B
    const mismatched: Case = {
      records: [...r1.records, r2],
      blocks: [...r1.blocks, authority(r2, "prc_4202", lotB)],
      overlay: { datasets: [...r1.overlay.datasets, view], lot_geometries: [LOT, lotB], index_pins: [...r1.overlay.index_pins!, pin] },
    };
    // Updated in Phase 3I: two route NOs on different geometries cannot combine.
    const result = run(mismatched);
    expect(result.status).toBe("unknown");
    expect(result.authority?.criterion_failures).toContainEqual({ code: "statutory_routes_lot_geometry_not_shared", fact_key: VH });
    // The production boundary supplies exactly ONE reviewed lot geometry, so a second geometry cannot be named there.
    const { store } = await reauditStore();
    const sra = await loadCaseOverlay(store, AS_OF);
    const lra = await loadCaseLraOverlay(store, AS_OF);
    expect(sra.inputs?.lot_geometries).toHaveLength(1);
    expect(lra.inputs === undefined || lra.inputs.lot_geometries.length === 1).toBe(true);
    // With only lot A available, the mis-pointed Route 2 block cannot establish anything.
    expect(run({ ...mismatched, overlay: { ...mismatched.overlay, lot_geometries: [LOT] } }).status).toBe("unknown");
  });

  it("the other-CRS lot is refused without runtime reprojection", async () => {
    const other = await lotFromText("test-only-reaudit-other-crs", otherCrsText);
    expect(other.crs_epsg).not.toBe(3310);
    const view = await realSraView();
    expect(computeLotOverlay(view, other).lot_within_features).toBe("not_established");
    expect(run(realRoute2(evidence("test-only-reaudit-other-crs", VH, true), other, view)).status).toBe("unknown");
  });
});

/* ========================================================================== */
/* 7. Production-input path                                                   */
/* ========================================================================== */

class ReauditStore implements ProgramScreenCaseEvidenceStore {
  readonly case_id = reviewedLotJson.case_id;
  record: unknown;
  files = new Map<string, Uint8Array>();
  indexes = new Map<string, Uint8Array>();
  records = new Map<string, Uint8Array>();
  current = true;
  async getFile(ref: CaseFileRef) { return this.files.get(ref.sha256) ?? null; }
  async readReview() { return { record: this.record, revision: "test-only-reaudit-revision" }; }
  async revisionIsCurrent() { return this.current; }
  async getOverlayIndex(sha: string) { return this.indexes.get(sha) ?? null; }
  async getOverlayRecord(sha: string) { return this.records.get(sha) ?? null; }
}
async function reauditStore() {
  const store = new ReauditStore();
  const record = reviewedLotRecordSchema.parse(structuredClone(reviewedLotJson));
  for (const [ref, text] of [
    [record.source_geometry.file, sraSourceText],
    [record.source_geometry.metadata_file, sourceMetadataText],
    [record.normalized_geometry.file, normalizedSraText],
    [record.reprojection.receipt_file, sraReceiptText],
  ] as const) store.files.set(ref.sha256, new TextEncoder().encode(text));
  const identity = new TextEncoder().encode("TEST-ONLY legal-lot identity basis for the Phase 3H re-audit.\n");
  const identityRef: CaseFileRef = { store: "case_evidence_file", file_id: "test-only-reaudit-identity", sha256: await bytesSha256(identity), bytes: identity.length };
  store.files.set(identityRef.sha256, identity);
  record.legal_identity_evidence = [identityRef];
  record.legal_lot_identity = "parcel_is_one_legal_lot";
  store.record = record;
  for (const provided of [inject("programScreenOverlayDataset"), inject("programScreenLraDataset")]) {
    store.indexes.set(await sha256Hex(provided.index_text!), new TextEncoder().encode(provided.index_text!));
    for (const b64 of Object.values(provided.records)) {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      store.records.set(await bytesSha256(bytes), bytes);
    }
  }
  return { store, record };
}

describe("Re-audit 7: production-input path", () => {
  it("the same private reviewed EPSG:3310 lot feeds both route loaders; SRA is computed, LRA fails closed when candidates are unavailable", async () => {
    const { store } = await reauditStore();
    const sra = await loadCaseOverlay(store, AS_OF);
    const lra = await loadCaseLraOverlay(store, AS_OF);
    expect(sra.inputs?.lot_geometries[0].crs_epsg).toBe(3310);
    expect(sra.computed.lot_within_features).toBe("whole_lot");
    expect(["not_established", "none", "part_of_lot", "whole_lot"]).toContain(lra.computed.lot_within_features);
    if (lra.inputs !== undefined) expect(lra.inputs.lot_geometries[0].sha256).toBe(sra.inputs!.lot_geometries[0].sha256);
    if (lra.computed.lot_within_features !== "whole_lot") expect(lra.issues.length).toBeGreaterThan(0);
  });

  // Updated in Phase 3I: both production routes use the reviewed snapshot; caller observations still conflict.
  it("production evaluation supplies reviewed-snapshot route evidence and strips caller hazard blocks while retaining conflicts", async () => {
    const { store } = await reauditStore();
    const forged = await pair("YES", "YES");
    const records = forged.records.map((r) => ({ ...r, subject: { ...r.subject, case_id: store.case_id } }));
    const { screen, overlay, route_overlays } = await evaluateStoredCaseProgramScreen(store, { evidence_records: records, evidence_authority: forged.blocks, as_of: AS_OF });
    expect(overlay.inputs?.datasets.map((v) => v.dataset.source_id)).toEqual(["calfire-fhszsra-23-3-data"]);
    const c = screen.pathways[0].criteria.find((x) => x.criterion_id === C)!;
    // Caller YES observations conflict with the computed non-Very-High SRA observation in Layer 1.
    expect(c.verification).toBe("human_verified");
    expect(c.status).toBe("conflict");
    expect(c.authority).toBeUndefined();
    expect(screen.facts.find((f) => f.key === VH)!.evidence.map((e) => e.evidence_id)).toEqual([
      ...records.map((r) => r.id),
      `computed-calfire-very-high-gov_51178-${route_overlays.gov_51178.record?.review_id ?? "unavailable"}`,
      `computed-calfire-very-high-prc_4202-${overlay.record!.review_id}`,
    ].sort());
    expect(overlay.inputs!.lot_geometries[0].sha256).toBe(overlay.record!.normalized_geometry.file.sha256);
    if (route_overlays.gov_51178.inputs !== undefined) expect(route_overlays.gov_51178.inputs.lot_geometries[0]).toBe(overlay.inputs!.lot_geometries[0]);
    expect(screen.facts.find((f) => f.key === HIGH)!.evidence.map((e) => e.evidence_id).some((id) => id.startsWith("computed-calfire-high-"))).toBe(true);
    // The same inputs, evaluated with the PROMOTED c and only the blocks production keeps: unknown.
    const kept = parseProgramEvidenceAuthority([], records);
    const index = new Map(assessProgramFacts(records, [VH]).map((f) => [f.key, f]));
    const promoted = evaluateProgramCriterion(promotedC(), index, AS_OF, { registries: programAuthorityRegistries, blocks: kept, records, overlay: overlay.inputs });
    expect(promoted.status).toBe("unknown");
    expect(promoted.authority?.established).toBe(false);
  });

  it("a caller-supplied hazard block cannot fill the production gap (the worker strips it; shown on d, the only runnable hazard criterion)", async () => {
    const { store, record } = await reauditStore();
    record.legal_lot_identity = "not_established"; // computed High is then unknown
    record.legal_identity_evidence = [];
    const sra = await loadCaseOverlay(store, AS_OF);
    expect(sra.computed.lot_within_features).toBe("whole_lot");
    const geometry = sra.inputs!.lot_geometries[0];
    const forged = evidence("test-only-reaudit-forged-high", HIGH, true);
    forged.subject.case_id = store.case_id;
    const forgedBlock = clone(authority(forged, "prc_4202", geometry), (d) => (d.qualifiers.legend_defines_class_for_lot = "yes"));
    // Outside the worker, the forged block over the real overlay WOULD establish d.
    const direct = evaluateProgramScreen({ evidence_records: [forged], evidence_authority: [forgedBlock], as_of: AS_OF, lot_overlay: sra.inputs });
    expect(direct.pathways[0].criteria.find((c) => c.criterion_id === D)!.status).toBe("disqualifying_per_source");
    // Through the production boundary it cannot.
    const { screen } = await evaluateStoredCaseProgramScreen(store, { evidence_records: [forged], evidence_authority: [forgedBlock], as_of: AS_OF });
    expect(screen.pathways[0].criteria.find((c) => c.criterion_id === D)!.status).toBe("unknown");
  });

  it.each(["foreign-case", "expired", "superseded", "changed-revision", "normalized-hash", "missing-index", "test-only-in-production"])("private inputs fail closed: %s", async (kind) => {
    const { store, record } = await reauditStore();
    if (kind === "foreign-case") record.case_id = "00000000-0000-4000-8000-000000000123";
    if (kind === "expired") record.review.next_review_on = AS_OF;
    if (kind === "superseded") record.state = { status: "superseded", superseded_by: "00000000-0000-4000-8000-000000000124" };
    if (kind === "changed-revision") store.current = false;
    if (kind === "normalized-hash") store.files.set(record.normalized_geometry.file.sha256, new TextEncoder().encode("TEST-ONLY changed"));
    if (kind === "missing-index") store.indexes.clear();
    if (kind === "test-only-in-production") { vi.stubEnv("MODE", "production"); vi.stubEnv("PROD", true); }
    try {
      for (const loader of [loadCaseOverlay, loadCaseLraOverlay]) {
        const result = await loader(store, AS_OF);
        expect(result.computed.lot_within_features, loader.name).toBe("not_established");
        expect(result.inputs).toBeUndefined();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("registry overrides cannot enter production evaluation", async () => {
    const { store } = await reauditStore();
    vi.stubEnv("MODE", "production");
    vi.stubEnv("PROD", true);
    try {
      expect((await loadCaseLraOverlay(store, AS_OF, structuredClone(programAuthorityRegistries))).issues.join(" ")).toMatch(/registry overrides/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

/* ========================================================================== */
/* 8-11. Promotion gates, proposed rule/record, adversarial gate tests        */
/* ========================================================================== */

function directRun(criterion: ProgramCriterion, registries: ProgramAuthorityRegistries = programAuthorityRegistries) {
  const record = evidence("test-only-reaudit-gate", VH, true);
  const index = new Map(assessProgramFacts([record], [VH]).map((f) => [f.key, f]));
  const spy = vi.fn(proposedPredicate);
  const result = evaluateProgramCriterion({ ...criterion, predicate: spy }, index, AS_OF, { registries, records: [record], blocks: new Map() });
  return { result, spy };
}

describe("Re-audit 8: promotion gates for the promoted c", () => {
  it("every shipped gate is met for the proposed c, and only after the human record exists", () => {
    const requirement = programAuthorityRegistries.criterion_requirements[C];
    expect(requirement.promotion_gates).toEqual([
      "evidence_provenance_enforced_or_fails_closed",
      "map_identity_and_edition_recorded",
      "statutory_route_recorded",
      "statutory_routes_assessed_separately",
      "legal_lot_identity_fails_closed",
      "reviewer_confirms_encoded_rule",
      "human_verification_record",
    ]);
    expect(authorityPromotionBlockers(promotedC(), programAuthorityRegistries, true)).toEqual([]);
    expect(authorityPromotionBlockers(promotedC({ human_verification: null }), programAuthorityRegistries, false)).toEqual(["reviewer_confirms_encoded_rule", "human_verification_record"]);
    expect(criterionPromotionBlockers(promotedC())).toEqual([]);
    expect(criterionAwaitsHumanVerification(promotedC())).toBe(false);
    expect(parseProgramPathwayPacks(projectedPacks())).toHaveLength(3);
  });

  const breakages: Array<[string, (r: any) => void]> = [
    ["evidence_provenance_enforced_or_fails_closed", (r) => (r.fact_policies[VH].establishing = [])],
    ["map_identity_and_edition_recorded", (r) => (r.fact_policies[VH].establishing[1].currency_max_age_days = null)],
    ["statutory_route_recorded", (r) => { r.fact_policies[VH].establishing = r.fact_policies[VH].establishing.slice(0, 1); }],
    ["statutory_route_recorded", (r) => { r.sources = r.sources.slice(0, 1); r.fact_policies[VH].establishing = r.fact_policies[VH].establishing.slice(0, 1); }],
    ["statutory_route_recorded", (r) => { r.sources = r.sources.slice(1); r.fact_policies[VH].establishing = r.fact_policies[VH].establishing.slice(1); r.fact_policies[HIGH].establishing = []; }],
    ["legal_lot_identity_fails_closed", (r) => (r.fact_policies[VH].requires_legal_lot_identity = false)],
  ];
  it.each(breakages)("cannot promote with a broken %s gate; the predicate never runs", (gate, change) => {
    const broken = clone(programAuthorityRegistries, change);
    expect(criterionPromotionBlockers(promotedC(), broken)).toContain(gate);
    const { result, spy } = directRun(promotedC(), broken);
    expect(result.status).toBe("unreviewed");
    expect(spy).not.toHaveBeenCalled();
  });

  it("cannot promote without route-separated assessment of both routes", () => {
    const noRoutes = promotedC({ statutory_routes: undefined });
    expect(criterionPromotionBlockers(noRoutes)).toContain("statutory_routes_assessed_separately");
    expect(directRun(noRoutes).spy).not.toHaveBeenCalled();
    expect(programCriterionSchema.safeParse(promotedC({ statutory_routes: { fact_key: VH, routes: ["prc_4202", "gov_51178"].slice(0, 1) as any } })).success).toBe(false);
    expect(programCriterionSchema.safeParse(promotedC({ statutory_routes: { fact_key: VH, routes: ["prc_4202", "prc_4202"] } })).success).toBe(false);
  });

  it("cannot promote without the SRA validity pin: legacy or changed index pins leave no overlay", async () => {
    const yes = await routeCase("prc_4202", "YES");
    const wrongPin = { ...yes, overlay: { ...yes.overlay, index_pins: [{ dataset: SRA.package!.members.overlay_dataset, index_sha256: "f".repeat(64) }] } };
    expect(run(wrongPin).status).toBe("unknown");
    expect(failureCodes(run(wrongPin))).toContain("lot_overlay_not_established");
  });

  it("cannot promote without an encoded rule, the correct decision reference, or a complete human record", () => {
    expect(programCriterionSchema.safeParse(promotedC({ predicate: "not_encoded" })).success).toBe(false);
    expect(evaluateProgramCriterion(promotedC({ predicate: "not_encoded" }), new Map(assessProgramFacts([evidence("x", VH, true)], [VH]).map((f) => [f.key, f])), AS_OF).status).toBe("unreviewed");
    for (const ref of [undefined, { round: 1, letter: "c" }, { phase: "3B", letter: "d" }, { phase: "3C", letter: "c" }]) {
      const record = { ...proposedRecord } as ProgramCriterionHumanVerification;
      if (ref === undefined) delete record.decision_ref; else record.decision_ref = ref as any;
      const changed = promotedC({ human_verification: record });
      expect(criterionPromotionBlockers(changed), JSON.stringify(ref)).toContain("reviewer_confirms_encoded_rule");
      expect(directRun(changed).spy).not.toHaveBeenCalled();
    }
    const records: Array<[string, Partial<ProgramCriterion>]> = [
      ["missing", { human_verification: null }],
      ["ai reviewer", { human_verification: clone(proposedRecord, (r) => (r.reviewer.kind = "ai")) }],
      ["ai capture", { human_verification: clone(proposedRecord, (r) => (r.source_capture.is_ai_generated = true)) }],
      ["d dates", { human_verification: clone(proposedRecord, (r) => { r.verified_at = "2026-09-29"; r.next_review_at = "2026-10-29"; }) }],
      ["citation mismatch", { citation: { ...proposedCitation, next_review_at: "2026-10-30" } }],
      ["draft source", { human_verification: clone(proposedRecord, (r) => (r.source_capture.operative_status = "proposed")) }],
      ["not human_verified", { verification: "pending_human" }],
    ];
    for (const [name, override] of records) {
      const changed = promotedC(override);
      expect(hasCompleteHumanVerification(changed), name).toBe(false);
      expect(criterionAwaitsHumanVerification(changed), name).toBe(true);
      expect(directRun(changed).spy, name).not.toHaveBeenCalled();
    }
  });

  it("legal-lot fail-closed enforcement is required by the registry schema itself", () => {
    expect(() => parseProgramAuthorityRegistries(clone(programAuthorityRegistries, (r) => (r.fact_policies[VH].requires_legal_lot_identity = false)))).toThrow(/legal-lot identity/);
  });

  it("d is unchanged; e/f/g remain pending and blocked; G1/G2 unchanged", () => {
    expect(criterionPromotionBlockers(shippedD)).toEqual([]);
    expect(shippedD.human_verification).toMatchObject({ verified_at: "2026-09-29", next_review_at: "2026-10-29", decision_ref: { phase: "3B", letter: "d" } });
    for (const id of [E, F, G]) expect(criterionPromotionBlockers(shipped(id)).length, id).toBeGreaterThan(2);
    const projected = projectedPacks().flatMap((p) => p.criteria);
    expect(projected.find((c) => c.id === D)).toBe(shippedD);
    for (const id of [E, F, G]) expect(projected.find((c) => c.id === id)).toBe(shipped(id));
    expect(programPathwayCompletenessBlockers.every((b) => b.status === "open")).toBe(true);
  });
});

describe("Re-audit 9-10: the encoded rule and human record shipped for c", () => {
  it("the proposed rule parses within the schema limit and uses no prohibited client language", () => {
    expect(programCriterionSchema.safeParse(promotedC()).success).toBe(true);
    expect(PROPOSED_SUMMARY.length).toBe(598);
    expect(PROPOSED_SUMMARY.length).toBeLessThanOrEqual(600);
    expect(PROPOSED_QUESTION.length).toBeLessThanOrEqual(600);
    expect(findProhibitedClientLanguage(PROPOSED_SUMMARY)).toEqual([]);
    expect(findProhibitedClientLanguage(PROPOSED_QUESTION)).toEqual([]);
    // The predicate reads only the combined route fact; it cannot see High.
    expect(proposedPredicate({ [VH]: { kind: "boolean", value: true } } as any)).toBe("disqualifying_per_source");
    expect(proposedPredicate({ [VH]: { kind: "boolean", value: false } } as any)).toBe("consistent_with_source");
    expect(() => proposedPredicate({ [HIGH]: { kind: "boolean", value: true } } as any)).toThrow();
  });

  it("the exact human record is supported by the captured memo, its hash and retrieval time", async () => {
    expect(humanRecordCaptureIssues(proposedRecord, { metadata: memoMetadata, extracted: memoText })).toEqual([]);
    expect(await sha256Hex(memoText)).toBe(proposedRecord.source_capture.sha256);
    expect(memoMetadata.retrieved_at).toBe(proposedRecord.source_capture.retrieved_at);
    expect(locateExcerptPages(MEMO_EXCERPT, memoText)).toEqual([4]);
    expect(proposedRecord.pinpoint).toBe(shippedC.citation.pinpoint);
    expect(proposedRecord.source_title).toBe(shippedC.citation.title);
    expect(proposedRecord.source_url).toBe(memoMetadata.official_url);
    expect(NEXT_REVIEW_AT).toBe("2026-10-31");
    expect(programCriterionSchema.safeParse(promotedC({ citation: { ...proposedCitation, next_review_at: "2026-11-01" }, human_verification: { ...proposedRecord, next_review_at: "2026-11-01" } })).success).toBe(false);
  });
});

/* ========================================================================== */
/* 12. Projected c-only promotion                                             */
/* ========================================================================== */

describe("Re-audit 12: the shipped c-only promotion equals the audited projection", () => {
  const PROJECTED: Record<string, { evaluator_before: string; evaluator_after: string; demo_before: string; demo_after: string }> = {
    "2026-09-27": { evaluator_before: PROTECTED_EVALUATOR_SHA256, evaluator_after: PROMOTED_EVALUATOR_SHA256, demo_before: PROTECTED_DEMO_SHA256, demo_after: PROMOTED_DEMO_SHA256 },
    "2026-10-01": {
      evaluator_before: "1acccc9755166e99d496775936706e80d8bbf083e772d6f3d5c336685c196be7",
      evaluator_after: "be57c1bf0f9c4c615375eb0c02d48fe9dd37fcd2afda4eb67cb20f99c98544cb",
      demo_before: "06222298ab94abdec298ee3334eb25badb1544de67489c987c377b9c88c95393",
      demo_after: "2a777f2da9b489f8731c933b04d83620230485df58c479a7b2bcb7981f9a369e",
    },
  };
  it.each([fixture.as_of, AS_OF])("as of %s: only c's own result, blocker and review task change", async (asOf) => {
    const before = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: asOf, packs: prePromotionPacks() });
    const after = evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: asOf });
    const beforeDemo = buildProgramScreenPublicDemoPayload(fixture, { as_of: asOf, packs: prePromotionPacks() });
    const afterDemo = buildProgramScreenPublicDemoPayload(fixture, { as_of: asOf });
    // The audited in-memory candidate gives exactly the shipped output.
    expect(JSON.stringify(evaluateProgramScreen({ evidence_records: fixture.evidence_records, as_of: asOf, packs: projectedPacks() }))).toBe(JSON.stringify(after));
    const hashes = {
      evaluator_before: await sha256Hex(JSON.stringify(before)),
      evaluator_after: await sha256Hex(JSON.stringify(after)),
      demo_before: await sha256Hex(JSON.stringify(beforeDemo)),
      demo_after: await sha256Hex(JSON.stringify(afterDemo)),
    };
    expect(hashes).toEqual(PROJECTED[asOf]);
    const projected = programScreenPathwayPacks.flatMap((p) => p.criteria);
    expect(projected.filter((c) => c.verification === "human_verified").map((c) => c.id).sort()).toEqual([D, C].sort());
    expect(projected.filter((c) => c.verification === "pending_human")).toHaveLength(44);
    expect(projected.filter((c) => c.predicate === "not_encoded")).toHaveLength(34);
    expect(before.release.blockers).toHaveLength(45);
    expect(after.release.blockers).toEqual(before.release.blockers.filter((b) => b.ref !== C));
    expect(after.release.blockers).toHaveLength(44);
    expect(after.facts).toEqual(before.facts);
    expect(after.counts).toEqual(before.counts);
    expect(after.screen_id).toBe(before.screen_id);
    expect(after.planning_questions).toEqual(before.planning_questions);
    expect(after.review_tasks).toEqual(before.review_tasks.filter((t) => t.criterion_id !== C));
    after.pathways.forEach((pathway, i) => {
      expect(pathway.criteria.filter((c) => c.criterion_id !== C)).toEqual(before.pathways[i].criteria.filter((c) => c.criterion_id !== C));
      expect(pathway.rollup).toBe(before.pathways[i].rollup);
      expect(pathway.statement).toBe(before.pathways[i].statement);
      expect(pathway.program_flags).toEqual(before.pathways[i].program_flags);
    });
    const cBefore = before.pathways[0].criteria.find((c) => c.criterion_id === C)!;
    const cAfter = after.pathways[0].criteria.find((c) => c.criterion_id === C)!;
    expect(cAfter.status).toBe(cBefore.status); // the fictional fixture's c is a Layer 1 conflict either way
    const changedKeys = Object.keys(cAfter).filter((k) => JSON.stringify((cAfter as any)[k]) !== JSON.stringify((cBefore as any)[k]));
    expect(changedKeys).toEqual(["verification", "rule_kind", "rule_summary", "citation"]);
    expect(shippedC.verification).toBe("human_verified");
  });
});
