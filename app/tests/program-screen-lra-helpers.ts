import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import type { PackageCapture } from "../src/shared/program-screen/authority-package";
import {
  authorityPromotionBlockers,
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
} from "../src/shared/program-screen/authority-policy";
import { jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPathway } from "../src/shared/program-screen/criteria/shra";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import {
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  statutoryRouteRecordKinds,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { programFactSpecs } from "../src/shared/program-screen/facts";
import {
  lraAuthorityPackageIssues,
  lraAuthorityRegistrationIssues,
  lraPackageManifestSchema,
  LRA_PACKAGE_ID,
  LRA_DATASET_ID,
} from "../src/shared/program-screen/lra-authority-package";
import { computeLotOverlay, loadReviewedLotGeometry } from "../src/shared/program-screen/lot-overlay";
import {
  fileGdbOverlayIndexText,
  loadOverlayDatasetView,
  overlayIndexPinFor,
  parseOverlayIndex,
  type FileGdbFeatureInput,
} from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  authoritySourceCaptureIssues,
  parseOfficialSourceMetadata,
  sha256Hex,
  splitExtractedPages,
  datasetMetadataLine,
} from "../src/shared/program-screen/source-capture";
import {
  programPathwayCompletenessBlockers,
  type ProgramCriterion,
  type ProgramFactKey,
  type ProgramCriterionResult,
} from "../src/shared/program-screen/types";
import { realLotOverlay } from "./program-screen-overlay-helpers";

const VH = "very-high-fire-hazard-severity-zone",
  HIGH = "high-fire-hazard-severity-zone",
  C = "la_shra.very-high-fire-hazard-severity-zone",
  D = "la_shra.high-fire-hazard-severity-zone";
const AS_OF = "2026-09-30",
  MODEL = "la_shra.test-only-phase-3g-c",
  DMODEL = "la_shra.test-only-phase-3g-d";
const source = programAuthorityRegistries.sources.find((s) => s.authority_source_id === LRA_PACKAGE_ID)!;
const sra = programAuthorityRegistries.sources.find((s) => s.package?.statutory_basis === "prc_4202")!;
const edit = <T>(x: T, change: (draft: any) => void): T => {
  const draft = structuredClone(x);
  change(draft);
  return draft;
};
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) + "\n");

function record(id: string, key: ProgramFactKey, value: boolean | string): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key],
    v = typeof value === "boolean" ? { kind: "boolean" as const, value } : { kind: "text" as const, value };
  return {
    id,
    subject: {
      case_id: "test-only-phase-3g",
      property_id: "test-only-phase-3g",
    },
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: "TEST-ONLY",
      title: "TEST-ONLY fictional lot",
      description: "Synthetic Phase 3G evaluation",
      url: `https://records.example.test/${id}`,
      authority: "official",
      retrieved_at: `${AS_OF}T00:00:00Z`,
    },
    raw_observed_value: v,
    normalized_value: v,
    evidence_type: "official_map",
    classification: "source_observation",
    confidence: 99,
    conflicts_with: [],
    review_status: "reviewed",
    notes: ["TEST-ONLY"],
    limitations: [],
    provenance: {
      source_record_id: id,
      capture_method: "manual_research",
      is_ai_generated: false,
    },
  };
}
function model(key: ProgramFactKey = VH, routeSeparated = true): ProgramCriterion {
  const base = programScreenPathwayPacks.flatMap((p) => p.criteria).find((c) => c.id === C)!;
  return {
    ...base,
    id: key === VH ? MODEL : DMODEL,
    label: "TEST-ONLY Phase 3G model",
    verification: "repo_sourced",
    human_verification: null,
    question_if_judgment: "How does Planning apply this TEST-ONLY rule?",
    statutory_routes: key === VH && routeSeparated ? { fact_key: VH, routes: ["gov_51178", "prc_4202"] } : undefined,
    fact_keys: [key],
    predicate: (f) =>
      f[key]?.kind === "boolean" && f[key]?.value ? "disqualifying_per_source" : "consistent_with_source",
    basis: {
      repo_path: "app/fixtures/program-screen/test-only-sources/synthetic-ordinance.txt",
      excerpts: ["TEST-ONLY"],
    },
  };
}
function registries(): ProgramAuthorityRegistries {
  const req = (id: string) => ({
    criterion_id: id,
    applicability: "enforced" as const,
    decision_ref: { round: 99, letter: "z" },
    promotion_gates: ["reviewer_confirms_encoded_rule", "human_verification_record"] as const,
    scope_preconditions: [],
    numeric_boundaries: [],
  });
  return {
    ...programAuthorityRegistries,
    criterion_requirements: {
      ...programAuthorityRegistries.criterion_requirements,
      [MODEL]: req(MODEL),
      [DMODEL]: req(DMODEL),
    },
  };
}
const ring = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x0, y1],
  [x1, y1],
  [x1, y0],
  [x0, y0],
];
function feature(
  fid: number,
  label: string,
  x0: number,
  x1: number,
  state: FileGdbFeatureInput["state"] = "valid",
): FileGdbFeatureInput {
  return {
    fid,
    label,
    code: label === "Very High" ? 3 : label === "High" ? 2 : label === "Moderate" ? 1 : -3,
    area: "LRA",
    state,
    source_validity: state,
    native_wkb: null,
    extent: [x0, 0, x1, 100],
    coordinates: [[ring(x0, 0, x1, 100)]],
  };
}
const defaultFeatures = () => [
  feature(1, "Very High", 0, 100),
  feature(2, "High", 100, 200),
  feature(3, "Moderate", 200, 300),
  feature(4, "NonWildland", 300, 400),
];
async function overlay(x0: number, x1: number, features = defaultFeatures(), missing: number[] = []) {
  const derived = await fileGdbOverlayIndexText({
    dataset: source.package!.members.overlay_dataset,
    layer: "FHSALRA25_v1_All",
    crs_epsg: 3310,
    class_field: "FHSZ_Description",
    members: {
      archive: "0".repeat(64),
      metadata: "1".repeat(64),
      association: "2".repeat(64),
      feature_table: "3".repeat(64),
    },
    records: features,
  });
  const pin = {
    dataset: source.package!.members.overlay_dataset,
    index_sha256: await sha256Hex(derived.index_text),
  };
  const view = await loadOverlayDatasetView(
    {
      index_text: derived.index_text,
      records: derived.records.filter((r) => !missing.includes(r.record_number)),
    },
    [pin],
  );
  const lot = await loadReviewedLotGeometry({
    file_id: "test-only-3g-lot",
    bytes: encode({
      schema_version: "program-screen-lot-geometry-v1",
      crs: "EPSG:3310",
      type: "Polygon",
      coordinates: [ring(x0, 20, x1, 80)],
    }),
  });
  return {
    derived,
    pin,
    view,
    lot,
    inputs: { datasets: [view], lot_geometries: [lot], index_pins: [pin] },
  };
}
function block(
  e: CanonicalEvidenceRecord,
  o: Awaited<ReturnType<typeof overlay>>,
  route: "gov_51178" | "prc_4202" = "gov_51178",
): ProgramEvidenceAuthority {
  const s = route === "gov_51178" ? source : sra;
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION,
    evidence_id: e.id,
    fact_key: e.claim.key as ProgramFactKey,
    record_kind: "agency_hazard_map",
    issuer: {
      name: "Office of the State Fire Marshal",
      issuer_id: "calfire-osfm",
    },
    source_identifier: {
      scheme: "authority_source_id",
      value: s.authority_source_id,
    },
    document_title: s.title,
    edition: {
      ...s.edition,
      currency: "current_on_as_of",
      currency_checked_on: AS_OF,
    },
    retrieved_at: e.source.retrieved_at,
    source_url: e.source.url,
    capture: { store: "repo_official_source", ...s.capture },
    parcel_relationship: {
      matched_by: "spatial_overlay",
      parcel_identifier: "TEST-ONLY-APN",
      legal_lot_reference: "TEST-ONLY Lot 1",
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage: e.normalized_value.value === true ? "whole_parcel" : "none_of_parcel",
    qualifiers: {
      family: "hazard_map",
      hazard_class: e.claim.key === VH ? "very_high" : "high",
      statutory_basis: route,
      adoption_status: route === "gov_51178" ? "not_established" : "adopted",
      named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: "yes",
      legend_defines_class_for_lot: "yes",
      responsibility_area_as_stated: route === "gov_51178" ? "local" : "state",
      lot_overlay: {
        method: "deterministic_spatial_overlay",
        dataset: s.package!.members.overlay_dataset,
        lot_geometry: {
          store: "case_evidence_file",
          file_id: o.lot.file_id,
          sha256: o.lot.sha256,
        },
      },
    },
    authority_review: {
      status: "reviewed",
      reviewer: {
        kind: "human",
        name: "TEST-ONLY Reviewer",
        role: "Synthetic tests",
      },
      reviewed_on: AS_OF,
    },
    notes: ["TEST-ONLY"],
    is_ai_generated: false,
  };
}
function screen(
  records: CanonicalEvidenceRecord[],
  blocks: ProgramEvidenceAuthority[],
  o: Awaited<ReturnType<typeof overlay>>,
  r = registries(),
  key: ProgramFactKey = VH,
  routeSeparated = true,
) {
  return evaluateProgramScreen({
    evidence_records: [
      record("anchor-jurisdiction", "jurisdiction", "City of Los Angeles"),
      record("anchor-match", "parcel-match", true),
      ...records,
    ],
    evidence_authority: blocks,
    as_of: AS_OF,
    packs: [
      {
        pathway: shraPathway,
        criteria: [jurisdictionCriterion("la_shra"), parcelMatchCriterion("la_shra"), model(key, routeSeparated)],
      },
    ],
    authority_registries: r,
    lot_overlay: o.inputs,
  }).pathways[0].criteria[2];
}
function failures(result: ProgramCriterionResult) {
  return result.authority?.facts.flatMap((f) => f.non_establishing.flatMap((n) => n.failures)) ?? [];
}
async function routeResult(
  x0: number,
  x1: number,
  value: boolean,
  features = defaultFeatures(),
  change: (b: any) => void = () => {},
  missing: number[] = [],
) {
  const o = await overlay(x0, x1, features, missing),
    e = record("test-only-route-1", VH, value),
    b = edit(block(e, o), change);
  return { o, result: screen([e], [b], o, registries(), VH, false), combined: screen([e], [b], o), e, b };
}

export {
  VH,
  HIGH,
  C,
  D,
  AS_OF,
  MODEL,
  DMODEL,
  source,
  sra,
  edit,
  encode,
  record,
  model,
  registries,
  ring,
  feature,
  defaultFeatures,
  overlay,
  block,
  screen,
  failures,
  routeResult,
};
