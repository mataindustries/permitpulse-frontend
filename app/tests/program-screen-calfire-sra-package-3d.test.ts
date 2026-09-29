import { describe, expect, inject, it } from "vitest";
import phase3dDoc from "../../docs/PROGRAM_SCREEN_PHASE_3D_CALFIRE_SRA_PACKAGE.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import manifestRaw from "../fixtures/program-screen/authority-packages/calfire-sra-fhsz-2023-09-29.json?raw";
import datasetExtracted from "../fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/extracted.txt?raw";
import datasetMetadataJson from "../fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/metadata.json";
import mapExtracted from "../fixtures/program-screen/official-sources/calfire-sra-fhsz-map-2023-09-29/extracted.txt?raw";
import mapMetadataJson from "../fixtures/program-screen/official-sources/calfire-sra-fhsz-map-2023-09-29/metadata.json";
import regulationExtracted from "../fixtures/program-screen/official-sources/ccr-19-2201-fhsz-sra-final-text/extracted.txt?raw";
import regulationMetadataJson from "../fixtures/program-screen/official-sources/ccr-19-2201-fhsz-sra-final-text/metadata.json";
import testOnlyMapMetadata from "../fixtures/program-screen/test-only-sources/test-only-agency-map-000001/metadata.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import {
  authorityPackageIssues,
  authorityPackageManifestSchema,
  authorityPackageRegistrationIssues,
  printedDate,
  type PackageCapture,
} from "../src/shared/program-screen/authority-package";
import {
  authorityPromotionBlockers,
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  promotionGuardedCriterionIds,
  type ProgramAuthorityRegistries,
  type ProgramCriterionAuthorityRequirement,
} from "../src/shared/program-screen/authority-policy";
import { jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPathway } from "../src/shared/program-screen/criteria/shra";
import { readDatasetArchiveSummary } from "../src/shared/program-screen/dataset-archive";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import {
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  statutoryRouteRecordKinds,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { programFactSpecs } from "../src/shared/program-screen/facts";
import { expectedOfficialSources } from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { criterionAwaitsHumanVerification } from "../src/shared/program-screen/schema";
import {
  authoritySourceCaptureIssues,
  canSupportCriterionRule,
  captureHostBasis,
  officialSourceMetadataSchema,
  parseOfficialSourceMetadata,
  sha256Hex,
  sourceHostExceptions,
  splitExtractedPages,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  programPathwayCompletenessBlockers,
  type CriterionPredicate,
  type ProgramCriterion,
  type ProgramCriterionResult,
  type ProgramFactKey,
} from "../src/shared/program-screen/types";

/**
 * Phase 3D: the first real authority, CAL FIRE / OSFM's PRC §4202 State
 * Responsibility Area Fire Hazard Severity Zone package, captured, validated,
 * and registered. Record: docs/PROGRAM_SCREEN_PHASE_3D_CALFIRE_SRA_PACKAGE.md.
 *
 * The package members and the registry entries are real. Every lot, lot
 * geometry, and case record here is TEST-ONLY and fictional: the package
 * never determines a lot by itself. Criteria that must run are TEST-ONLY
 * synthetic ones outside the 46 atomic criteria.
 */

const AS_OF = "2026-09-29";
const RETRIEVED_AT = "2026-09-28T18:00:00.000Z";
const REVIEWED_ON = "2026-09-29";
const SUBJECT = { case_id: "case-fictional-phase-3d-test", property_id: "property-fictional-phase-3d-test" };
const REVIEWER = { kind: "human", name: "TEST-ONLY Reviewer", role: "Synthetic reviewer" } as const;

const VH: ProgramFactKey = "very-high-fire-hazard-severity-zone";
const HIGH: ProgramFactKey = "high-fire-hazard-severity-zone";
const C = "la_shra.very-high-fire-hazard-severity-zone";
const D = "la_shra.high-fire-hazard-severity-zone";

const PACKAGE_ID = "calfire-sra-fhsz-2023-09-29";
const MAP_ID = "calfire-sra-fhsz-map-2023-09-29";
const REGULATION_ID = "ccr-19-2201-fhsz-sra-final-text";
const DATASET_ID = "calfire-fhszsra-23-3-data";
const OFFICIAL_DIR = "app/fixtures/program-screen/official-sources/";

const mapMetadata = parseOfficialSourceMetadata(mapMetadataJson);
const regulationMetadata = parseOfficialSourceMetadata(regulationMetadataJson);
const datasetMetadata = parseOfficialSourceMetadata(datasetMetadataJson);
const manifestJson = JSON.parse(manifestRaw) as unknown;
const manifest = authorityPackageManifestSchema.parse(manifestJson);
const registeredSource = programAuthorityRegistries.sources.find((source) => source.authority_source_id === PACKAGE_ID);
if (registeredSource?.package === undefined) throw new Error("The Phase 3D package is not registered.");
const pack = registeredSource.package;
const officialByteChecks = inject("programScreenOfficialCaptureByteChecks");

function packageCaptures(change: (captures: Map<string, PackageCapture>) => void = () => {}): Map<string, PackageCapture> {
  const captures = new Map<string, PackageCapture>([
    [MAP_ID, { metadata: mapMetadata, extracted: mapExtracted }],
    [REGULATION_ID, { metadata: regulationMetadata, extracted: regulationExtracted }],
    [DATASET_ID, { metadata: datasetMetadata, extracted: datasetExtracted }],
  ]);
  change(captures);
  return captures;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;
function edited<T>(value: T, change: (draft: Draft) => void): T {
  const draft = structuredClone(value) as Draft;
  change(draft);
  return draft as T;
}

/* ------------------------------------------------------------ evidence */

function record(id: string, key: ProgramFactKey, value: boolean | null, evidenceType: CanonicalEvidenceRecord["evidence_type"] = "official_map"): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const known = value !== null;
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: "TEST-ONLY lot overlay on the CAL FIRE SRA package",
      title: `TEST-ONLY ${key} lot result ${id}`,
      description: "FICTIONAL lot result.",
      url: `https://records.example.test/phase-3d-tests/${id}`,
      authority: "official",
      retrieved_at: RETRIEVED_AT,
    },
    raw_observed_value: known ? { kind: "text", value: value ? "YES" : "NO" } : { kind: "not_observed", value: null },
    normalized_value: known ? { kind: "boolean", value } : { kind: "unknown", value: null, reason: "insufficient_evidence" },
    evidence_type: evidenceType,
    classification: known ? "source_observation" : "unknown",
    confidence: 99,
    conflicts_with: [],
    review_status: "reviewed",
    notes: [],
    limitations: [],
    provenance: { source_record_id: `test-${id}`, capture_method: "manual_research", is_ai_generated: false },
  };
}

function anchors(): CanonicalEvidenceRecord[] {
  const base = record("anchor-parcel-match", "parcel-match" as ProgramFactKey, true, "official_portal");
  const spec = (key: ProgramFactKey) => programFactSpecs[key];
  return [
    { ...base, claim: { key: "parcel-match", label: spec("parcel-match").label, client_label: spec("parcel-match").client_label } },
    {
      ...base,
      id: "anchor-jurisdiction",
      claim: { key: "jurisdiction", label: spec("jurisdiction").label, client_label: spec("jurisdiction").client_label },
      raw_observed_value: { kind: "text", value: "City of Los Angeles" },
      normalized_value: { kind: "text", value: "City of Los Angeles" },
      source: { ...base.source, url: "https://records.example.test/phase-3d-tests/anchor-jurisdiction" },
    },
  ];
}

/**
 * A reviewed block for a fictional lot compared with the registered package:
 * `classes` are the dataset's FHSZ_Descr labels of every feature the lot
 * intersects; `covered` is whether SRA features cover the whole lot.
 */
function block(
  evidence: CanonicalEvidenceRecord,
  options: { classes?: string[]; covered?: "yes" | "no" | "not_established"; basis?: string } = {},
): ProgramEvidenceAuthority {
  const key = evidence.claim.key as ProgramFactKey;
  const value = evidence.normalized_value.kind === "boolean" ? evidence.normalized_value.value : null;
  const own = key === VH ? "Very High" : "High";
  const other = key === VH ? "High" : "Very High";
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION,
    evidence_id: evidence.id,
    fact_key: key,
    record_kind: "agency_hazard_map",
    issuer: { name: "Office of the State Fire Marshal", issuer_id: "calfire-osfm" },
    source_identifier: { scheme: "authority_source_id", value: PACKAGE_ID },
    document_title: "State Responsibility Area Fire Hazard Severity Zones",
    edition: {
      label: "dated September 29, 2023",
      date: "2023-09-29",
      date_kind: "dated",
      currency: "current_on_as_of",
      // Until superseded (D7): an old currency check is still current; only its date must not be after the screen.
      currency_checked_on: "2024-06-01",
    },
    retrieved_at: evidence.source.retrieved_at,
    source_url: evidence.source.url,
    capture: { store: "repo_official_source", source_id: MAP_ID, sha256_extracted: mapMetadata.sha256_extracted },
    parcel_relationship: {
      matched_by: "spatial_overlay",
      parcel_identifier: "TEST-ONLY-APN-3D00",
      legal_lot_reference: "TEST-ONLY Tract 3D, Lot 1",
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage: value === true ? "whole_parcel" : value === false ? "none_of_parcel" : "partial_parcel",
    qualifiers: {
      family: "hazard_map",
      hazard_class: key === VH ? "very_high" : "high",
      statutory_basis: (options.basis ?? "prc_4202") as "prc_4202",
      adoption_status: "adopted",
      named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: options.covered ?? "yes",
      legend_defines_class_for_lot: "yes",
      responsibility_area_as_stated: "state",
      lot_overlay: {
        method: "deterministic_spatial_overlay",
        dataset: { source_id: DATASET_ID, sha256_extracted: datasetMetadata.sha256_extracted },
        lot_geometry: { store: "case_evidence_file", file_id: "TEST-ONLY-lot-geometry-3d", sha256: "a".repeat(64) },
        classes_on_lot: options.classes ?? (value === true ? [own] : value === false ? ["Moderate", other] : [own, "Moderate"]),
      },
    },
    authority_review: { status: "reviewed", reviewer: REVIEWER, reviewed_on: REVIEWED_ON },
    notes: ["TEST-ONLY fictional lot result."],
    is_ai_generated: false,
  };
}

/* ------------------------------------------------------------ criteria */

const booleanRule =
  (key: ProgramFactKey): CriterionPredicate =>
  (facts) => {
    const value = facts[key];
    return value?.kind === "boolean" && value.value ? "disqualifying_per_source" : "consistent_with_source";
  };

function synthetic(id: string, key: ProgramFactKey, extra: Partial<ProgramCriterion> = {}): ProgramCriterion {
  return {
    id,
    pathway: "la_shra",
    label: "TEST-ONLY synthetic Phase 3D criterion",
    gating: false,
    fact_keys: [key],
    predicate: booleanRule(key),
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "TEST-ONLY synthetic rule used to exercise the Phase 3D package.",
    citation: {
      title: "TEST-ONLY synthetic citation",
      url: "https://records.example.test/phase-3d-tests/citation",
      pinpoint: "Section T",
      verified_at: "2026-09-20",
      volatility: "low",
      next_review_at: "2026-12-01",
    },
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Which record establishes the synthetic fact for this parcel?",
    question_if_conflict: "Which record governs the synthetic fact for this parcel?",
    question_if_judgment: "How does Planning apply the synthetic rule to this parcel?",
    verification: "repo_sourced",
    human_verification: null,
    basis: { repo_path: "app/fixtures/program-screen/test-only-sources/synthetic-ordinance.txt", excerpts: ["TEST-ONLY"] },
    ...extra,
  };
}

const C_MODEL = "la_shra.test-only-3d-vh-routes";
const D_MODEL = "la_shra.test-only-3d-high";
/** The c model: Very High assessed per statutory route, as the shipped c declares. */
const cModel = () => synthetic(C_MODEL, VH, { statutory_routes: { fact_key: VH, routes: ["gov_51178", "prc_4202"] } });
const dModel = () => synthetic(D_MODEL, HIGH);

function requirement(id: string): ProgramCriterionAuthorityRequirement {
  return {
    criterion_id: id,
    applicability: "enforced",
    decision_ref: { round: 99, letter: "z" },
    promotion_gates: ["reviewer_confirms_encoded_rule", "human_verification_record"],
    scope_preconditions: [],
    numeric_boundaries: [],
  };
}

/** The SHIPPED registries: the real issuer, package, and entries, plus TEST-ONLY requirements for the models. */
const shipped = (): ProgramAuthorityRegistries => ({
  ...programAuthorityRegistries,
  criterion_requirements: { ...programAuthorityRegistries.criterion_requirements, [C_MODEL]: requirement(C_MODEL), [D_MODEL]: requirement(D_MODEL) },
});

function screen(criterion: ProgramCriterion, records: CanonicalEvidenceRecord[], blocks: ProgramEvidenceAuthority[], registries = shipped()) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchors(), ...records],
    as_of: AS_OF,
    packs: [{ pathway: shraPathway, criteria: [parcelMatchCriterion("la_shra"), jurisdictionCriterion("la_shra"), criterion] }],
    evidence_authority: blocks,
    authority_registries: registries,
  });
  return result.pathways[0].criteria[2];
}

function failureCodes(result: ProgramCriterionResult): string[] {
  return (result.authority?.facts ?? []).flatMap((fact) => fact.non_establishing.flatMap((entry) => entry.failures));
}

/** d model: one lot result on the High fact. */
function dResult(value: boolean | null, options: Parameters<typeof block>[1] = {}, change: (draft: Draft) => void = () => {}) {
  const evidence = record(`high-${String(value)}`, HIGH, value);
  return screen(dModel(), [evidence], [edited(block(evidence, options), change)]);
}

/** c model: a lot result on PRC §4202 (Route 2) and, optionally, a record naming GOV §51178 (Route 1). */
function cResult(route2: boolean | null, route1?: boolean) {
  const records = [record("vh-route-2", VH, route2)];
  const blocks = [block(records[0])];
  if (route1 !== undefined) {
    const r1 = record("vh-route-1", VH, route1);
    records.push(r1);
    blocks.push(block(r1, { basis: "gov_51178" }));
  }
  return screen(cModel(), records, blocks);
}

/* ======================================================================== */

describe("1. The three package members are captured, pinned, and unchanged", () => {
  const PINS: Record<string, { original: string; extracted: string; bytes: number; type: string }> = {
    [MAP_ID]: {
      original: "6e54c1bb10672d2ca5f307c920f09b874b5f9be671b3fa001df6e9eb7b4729e4",
      extracted: "11830e2c8c29f368e4087ae9ff270ee042673dfd7be6e354750c326579e5b1fe",
      bytes: 16_306_456,
      type: "agency_map",
    },
    [REGULATION_ID]: {
      original: "977abe3a6fc0da2568cabe6bfb164bbb8965e2bc8ef2b01b9012dd8b5517d147",
      extracted: "61aafec5e4a394ffb5724cb894dc570fc28e36e7c7174754016c5e64b8d78657",
      bytes: 67_366,
      type: "regulation",
    },
    [DATASET_ID]: {
      original: "e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2",
      extracted: "a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a",
      bytes: 36_001_656,
      type: "dataset_archive",
    },
  };

  it("pins every member's original and extracted text by SHA-256 and size", async () => {
    for (const [metadata, extracted] of [
      [mapMetadata, mapExtracted],
      [regulationMetadata, regulationExtracted],
      [datasetMetadata, datasetExtracted],
    ] as const) {
      const pin = PINS[metadata.source_id];
      expect(metadata.source_type, metadata.source_id).toBe(pin.type);
      expect(metadata.sha256_original, metadata.source_id).toBe(pin.original);
      expect(metadata.sha256_extracted, metadata.source_id).toBe(pin.extracted);
      expect(metadata.original.bytes, metadata.source_id).toBe(pin.bytes);
      expect(await sha256Hex(extracted), metadata.source_id).toBe(pin.extracted);
      // The Node-side byte check re-hashed each original, and re-derived the archive's text from its bytes.
      expect(officialByteChecks[`${OFFICIAL_DIR}${metadata.source_id}`], metadata.source_id).toMatchObject({
        sha256_original: pin.original,
        bytes: pin.bytes,
        issues: [],
      });
      expect(metadata.test_only).toBe(false);
      expect(canSupportCriterionRule(metadata), metadata.source_id).toBe(false);
    }
  });

  it("keeps the exact raw ZIP as the capture, with a deterministic member manifest", () => {
    expect(datasetMetadata.original).toEqual({ file: "original.zip", media_type: "application/zip", bytes: 36_001_656 });
    expect(datasetMetadata.extraction).toMatchObject({ extractor: "program-screen-zip-manifest", extractor_version: "1.0.0", page_count: 7 });
    const summary = readDatasetArchiveSummary(splitExtractedPages(datasetExtracted));
    expect(summary.members.size).toBe(58);
    expect(summary.members.get("FHSZSRA_23_3.shp")).toEqual({
      bytes: 154_355_596,
      crc32: "b77a5ebd",
      sha256: "3de6625a8fbb53f6f0fbcc4f261b5fd30efd1d7ba3299cee5550778249f024dc",
    });
    expect(summary.members.get("FHSZSRA_23_3.shp.xml")?.sha256).toBe("c4442ead0e6c88222fd339cf10d88b94c0cb7601f159a51ccaea904aae64d74b");
    expect(summary.members.get("FHSZSRA_23_3.prj")?.sha256).toBe("93d3d5f7ff1673dd8228c2fd30c927002c24e73b333ec4fa2d5534d430f53a51");
    // Sorted by name, codepoint order.
    const names = [...summary.members.keys()];
    expect(names).toEqual([...names].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
    expect([...summary.pages.keys()]).toEqual([
      "FHSZSRA_23_3.cpg",
      "FHSZSRA_23_3.dbf",
      "FHSZSRA_23_3.prj",
      "FHSZSRA_23_3.shp",
      "FHSZSRA_23_3.shp.xml",
      "FHSZSRA_23_3.shx",
    ]);
  });

  it("summarizes the attribute schema and the classes by FHSZ_Descr label, never the numeric FHSZ code", () => {
    const table = readDatasetArchiveSummary(splitExtractedPages(datasetExtracted)).tables.get("FHSZSRA_23_3.dbf");
    expect(table?.records).toBe(18_423);
    expect(table?.values.get("FHSZ_Descr")).toEqual([
      ["High", 5_824],
      ["Moderate", 4_188],
      ["Very High", 8_411],
    ]);
    expect(table?.values.get("SRA")).toEqual([["SRA", 18_423]]);
    expect(table?.values.get("FHSZ")).toBeNull();
    expect(datasetExtracted).toContain("field FHSZ type N length 5 decimals 0");
    expect(datasetExtracted).toContain("values FHSZ: not summarized (type N)");
    expect(datasetMetadata.schema_version === "program-screen-official-source-v2" && datasetMetadata.dataset_archive).toMatchObject({
      dataset_name: "FHSZSRA_23_3",
      crs: { epsg: 3310 },
      geometry: { shape_type: "PolygonZ", feature_count: 18_423 },
      class_field: { field: "FHSZ_Descr" },
      extent_field: { field: "SRA", values: [{ label: "SRA", count: 18_423 }] },
    });
  });

  it("keeps the stale metadata fields byte for byte, marked non-authoritative", () => {
    const context = datasetMetadata.schema_version === "program-screen-official-source-v2" ? datasetMetadata.dataset_archive : null;
    expect(context?.non_authoritative.map((field) => field.path)).toEqual([
      "/metadata/dataIdInfo/idCitation/date/pubDate",
      "/metadata/dataIdInfo/idCitation/resEd",
      "/metadata/eainfo/detailed/enttyp/enttypl",
      "/metadata/spatRepInfo/VectSpatRep/geometObjs/geoObjCnt",
      "/metadata/spdoinfo/ptvctinf/esriterm/efeacnt",
    ]);
    for (const line of [
      "/metadata/dataIdInfo/idCitation/date/pubDate: 2022-04-12",
      "/metadata/dataIdInfo/idCitation/resEd: 22_2",
      "/metadata/eainfo/detailed/enttyp/enttypl: FHSZSRA_DRAFT22_1",
    ]) {
      expect(datasetExtracted).toContain(line);
    }
    // Registration and version logic never read them.
    const registry = JSON.stringify(programAuthorityRegistries);
    for (const stale of ["2022-04-12", "22_2", "DRAFT22"]) expect(registry).not.toContain(stale);
  });

  it("records the map date as dated, never issued or adopted, and the undated documents as undated", () => {
    expect(mapMetadata).toMatchObject({ document_date: "2023-09-29", operative_status: "operative" });
    expect(mapMetadata.schema_version === "program-screen-official-source-v2" && mapMetadata.agency_map?.edition).toMatchObject({
      date: "2023-09-29",
      date_kind: "dated",
    });
    expect(regulationMetadata).toMatchObject({ document_date: null, operative_status: "status_unconfirmed" });
    expect(datasetMetadata).toMatchObject({ document_date: null, operative_status: "operative" });
    // Only a regulation or data archive may print no date.
    expect(officialSourceMetadataSchema.safeParse(edited(mapMetadata, (draft) => (draft.document_date = null))).success).toBe(false);
  });

  it("admits each member only through its own exact-path exception, and never the Notice of Approval", () => {
    for (const source of expectedOfficialSources.filter((candidate) => [MAP_ID, REGULATION_ID, DATASET_ID].includes(candidate.source_id))) {
      const host = captureHostBasis(source.official_url as string, { source_id: source.source_id, source_type: source.source_type, test_only: false });
      expect(host.issue, source.source_id).toBeNull();
      expect(typeof host.basis, source.source_id).toBe("object");
      // Another member's exception never covers it.
      const swapped = captureHostBasis(source.official_url as string, { source_id: "calfire-unlisted-file", source_type: source.source_type, test_only: false });
      expect(swapped.issue, source.source_id).toMatch(/no reviewed host exception covers source calfire-unlisted-file/);
    }
    const notice = manifest.excluded_documents[0];
    expect(notice.title).toContain("Notice of Approval");
    const noticePath = new URL(notice.url).pathname;
    expect(sourceHostExceptions.some((exception) => exception.path_prefix === noticePath)).toBe(false);
    expect(captureHostBasis(notice.url, { source_id: MAP_ID, source_type: "agency_map", test_only: false }).issue).toMatch(/covers only/);
  });
});

/* ======================================================================== */

describe("2. The package manifest ties every assertion to an exact member", () => {
  it("validates against the captured members, and the registry pins it by SHA-256", async () => {
    expect(await authorityPackageIssues(manifestJson, packageCaptures())).toEqual([]);
    expect(await sha256Hex(manifestRaw)).toBe(pack.manifest_sha256);
    expect(pack.manifest_sha256).toBe("768930ea3bc874cf06436499219895dd2acb18d970c4ddbba6b5dd88e9d40832");
    const issuer = programAuthorityRegistries.issuers.find((candidate) => candidate.issuer_id === registeredSource.issuer_id);
    expect(authorityPackageRegistrationIssues(registeredSource, issuer, manifest, await sha256Hex(manifestRaw))).toEqual([]);
  });

  it("names the exact member behind each assertion", () => {
    const members = (name: keyof typeof manifest.assertions) =>
      [...new Set(manifest.assertions[name].evidence.map((evidence) => evidence.source_id))].sort();
    expect(members("issuer_identity")).toEqual([MAP_ID, REGULATION_ID].sort());
    expect(members("statutory_basis")).toEqual([REGULATION_ID]);
    expect(members("adopted_status")).toEqual([DATASET_ID]);
    expect(members("map_identity")).toEqual([MAP_ID, REGULATION_ID].sort());
    expect(members("map_date")).toEqual([MAP_ID, REGULATION_ID].sort());
    expect(members("adoption_date")).toEqual([DATASET_ID]);
    expect(members("effective_date")).toEqual([DATASET_ID]);
    expect(members("legend_classes")).toEqual([MAP_ID]);
    expect(members("lot_overlay_dataset")).toEqual([DATASET_ID, MAP_ID].sort());
    for (const entry of Object.values(manifest.assertions)) {
      for (const evidence of entry.evidence) {
        const member = manifest.members.find((candidate) => candidate.source_id === evidence.source_id);
        expect(evidence.sha256_extracted, evidence.text).toBe(member?.sha256_extracted);
      }
    }
  });

  it("establishes PRC §4202 from the section's own authority note, never the repealed §1280.01 or §2200", async () => {
    expect(manifest.assertions.statutory_basis).toMatchObject({ value: "prc_4202", evidence: [{ page: 3, text: "NOTE: Authority cited: Sections 4202, 4203 and 4204, Public Resources Code." }] });
    for (const page of [1, 2]) {
      const moved = edited(manifestJson, (draft) => (draft.assertions.statutory_basis.evidence[0].page = page));
      expect(await authorityPackageIssues(moved, packageCaptures())).toEqual([
        `statutory_basis: "NOTE: Authority cited: Sections 4202, 4203 and 4204, Public " is not inside section 2201 on page ${page}.`,
      ]);
    }
    const otherSection = edited(manifestJson, (draft) => (draft.assertions.statutory_basis.value = "gov_51178"));
    expect(await authorityPackageIssues(otherSection, packageCaptures())).toContain(
      "statutory_basis: the section's authority note must cite Public Resources Code section 4202.",
    );
  });

  it("backs adopted status with the dataset's own statement about the map of this date", async () => {
    expect(manifest.assertions.adopted_status.evidence[0].text).toContain("as adopted on January 31, 2024");
    expect(pack.adoption).toEqual({ status: "adopted", adoption_date: "2024-01-31", effective_date: "2024-04-01" });
    const unbacked = edited(manifestJson, (draft) => {
      draft.assertions.adopted_status.evidence = [draft.assertions.map_identity.evidence[1]];
    });
    expect(await authorityPackageIssues(unbacked, packageCaptures())).toContain(
      "adopted_status: an operative member must state that the map of this date is adopted.",
    );
    // The regulation's own status is unconfirmed; it can never be the adoption statement's member.
    const fromRegulation = edited(manifestJson, (draft) => {
      draft.assertions.adopted_status.evidence = [draft.assertions.map_identity.evidence[0]];
    });
    expect(await authorityPackageIssues(fromRegulation, packageCaptures())).toContain(
      "adopted_status: an operative member must state that the map of this date is adopted.",
    );
  });

  it("pins the map date, adoption date, and effective date separately", async () => {
    expect(manifest.assertions.map_date.value).toEqual({ date: "2023-09-29", date_kind: "dated" });
    expect(manifest.assertions.adoption_date.value).toBe("2024-01-31");
    expect(manifest.assertions.effective_date.value).toBe("2024-04-01");
    expect(registeredSource.edition).toEqual({
      label: "State Responsibility Area Fire Hazard Severity Zones, dated September 29, 2023",
      date: "2023-09-29",
      date_kind: "dated",
    });
    expect(printedDate("2024-04-01")).toBe("April 1, 2024");
    for (const [name, change, message] of [
      ["an effective date the source does not state", (draft: Draft) => (draft.assertions.effective_date.value = "2024-01-01"), "effective_date: the evidence must state the effective date."],
      ["an adoption date the source does not state", (draft: Draft) => (draft.assertions.adoption_date.value = "2024-02-01"), "adoption_date: the evidence must state the adoption date."],
      ["a map date the sources do not print", (draft: Draft) => (draft.assertions.map_date.value.date = "2023-09-30"), "map_date: the regulation must give the map's date and the map must print it."],
    ] as const) {
      expect(await authorityPackageIssues(edited(manifestJson, change), packageCaptures()), name).toContain(message);
    }
    // The map date is never relabeled.
    const issued = edited(manifestJson, (draft) => (draft.assertions.map_date.value.date_kind = "issued"));
    expect((await authorityPackageIssues(issued, packageCaptures()))[0]).toMatch(/^manifest assertions\.map_date\.value\.date_kind/);
  });

  it("pins the High and Very High legend classes to the map, and the same labels to the dataset", async () => {
    expect(manifest.assertions.legend_classes.value).toEqual(["very_high", "high", "moderate"]);
    expect(pack.overlay).toEqual({
      dataset_name: "FHSZSRA_23_3",
      class_field: "FHSZ_Descr",
      class_labels: { "Very High": "very_high", High: "high", Moderate: "moderate" },
    });
    const noHigh = edited(manifestJson, (draft) => (draft.assertions.legend_classes.evidence = draft.assertions.legend_classes.evidence.filter((evidence: { text: string }) => !evidence.text.startsWith("High "))));
    expect(await authorityPackageIssues(noHigh, packageCaptures())).toEqual(["legend_classes: no quotation from the map begins with the High legend entry."]);
    // A numeric code, or a label mapped to another class, is never accepted.
    for (const labels of [{ "3": "very_high", "2": "high", "1": "moderate" }, { "Very High": "high", High: "very_high", Moderate: "moderate" }]) {
      const recoded = edited(manifestJson, (draft) => (draft.assertions.lot_overlay_dataset.value.class_labels = labels));
      expect(await authorityPackageIssues(recoded, packageCaptures()), JSON.stringify(labels)).toContain(
        "lot_overlay_dataset: every dataset label maps to the class of the same name, and nothing else.",
      );
    }
  });

  it("fails closed when a member is missing, changed, test-only, or of the wrong type", async () => {
    expect(await authorityPackageIssues(manifestJson, packageCaptures((captures) => captures.delete(DATASET_ID)))).toEqual([
      "member overlay_dataset: capture calfire-fhszsra-23-3-data is missing.",
      "The package lacks a member; it fails closed.",
    ]);
    const changedText = packageCaptures((captures) => captures.set(REGULATION_ID, { metadata: regulationMetadata, extracted: `${regulationExtracted}x` }));
    expect(await authorityPackageIssues(manifestJson, changedText)).toContain("member adopting_regulation: the extracted text does not match its pin.");
    const repinned = edited(manifestJson, (draft) => (draft.members[0].sha256_extracted = "0".repeat(64)));
    expect(await authorityPackageIssues(repinned, packageCaptures())).toContain(`member adopted_map: the manifest does not pin ${MAP_ID} as captured.`);
    const testOnly = packageCaptures((captures) => captures.set(MAP_ID, { metadata: edited(mapMetadata, (draft) => (draft.test_only = true)), extracted: mapExtracted }));
    expect(await authorityPackageIssues(manifestJson, testOnly)).toContain("member adopted_map: a test-only capture can never be a package member.");
    const swapped = edited(manifestJson, (draft) => (draft.members[1].source_type = "statute"));
    expect((await authorityPackageIssues(swapped, packageCaptures()))[0]).toMatch(/^manifest members\.1\.source_type/);
    const noMember = edited(manifestJson, (draft) => draft.members.pop());
    expect((await authorityPackageIssues(noMember, packageCaptures()))[0]).toMatch(/^manifest members/);
  });

  it("never quotes a non-authoritative metadata field", async () => {
    const stale = edited(manifestJson, (draft) => {
      draft.assertions.adoption_date.evidence.push({
        source_id: DATASET_ID,
        sha256_extracted: datasetMetadata.sha256_extracted,
        page: 6,
        text: "/metadata/dataIdInfo/idCitation/date/pubDate: 2022-04-12",
      });
    });
    expect(await authorityPackageIssues(stale, packageCaptures())).toContain(
      'adoption_date: "/metadata/dataIdInfo/idCitation/date/pubDate: 2022-04-12" quotes the non-authoritative field /metadata/dataIdInfo/idCitation/date/pubDate.',
    );
  });

  it("keeps the registry exactly the manifest's: any divergence is an issue", async () => {
    const sha = await sha256Hex(manifestRaw);
    const issuer = programAuthorityRegistries.issuers[0];
    const cases: Array<[string, (draft: Draft) => void, string]> = [
      ["another manifest", (draft) => (draft.package.manifest_sha256 = "1".repeat(64)), "The registry does not pin this manifest."],
      ["another route", (draft) => (draft.package.statutory_basis = "gov_51178"), "The statutory basis differs."],
      ["another effective date", (draft) => (draft.package.adoption.effective_date = "2024-01-31"), "The adoption record differs."],
      ["another dataset", (draft) => (draft.package.members.overlay_dataset.sha256_extracted = "2".repeat(64)), "The overlay dataset pin differs."],
      ["another edition kind", (draft) => (draft.edition.date_kind = "issued"), "The edition date differs."],
      ["a numeric class label", (draft) => (draft.package.overlay.class_labels = { "3": "very_high", "2": "high", "1": "moderate" }), "The overlay dataset's labels differ."],
    ];
    for (const [name, change, message] of cases) {
      expect(authorityPackageRegistrationIssues(edited(registeredSource, change), issuer, manifest, sha), name).toContain(message);
    }
    expect(authorityPackageRegistrationIssues(registeredSource, undefined, manifest, sha)).toContain("The issuer is not registered.");
  });
});

/* ======================================================================== */

describe("3. Registration: CAL FIRE / OSFM and the PRC §4202 package, and nothing else", () => {
  it("registers exactly the approved issuer, source, and entries", () => {
    expect(programAuthorityRegistries.issuers).toEqual([
      {
        issuer_id: "calfire-osfm",
        name: "California Department of Forestry and Fire Protection, Office of the State Fire Marshal",
        basis_capture: { source_id: REGULATION_ID, sha256_extracted: regulationMetadata.sha256_extracted },
        review: { reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" }, reviewed_on: "2026-09-29", decision_ref: null },
      },
    ]);
    expect(registeredSource).toMatchObject({
      record_kind: "agency_hazard_map",
      issuer_id: "calfire-osfm",
      capture: { source_id: MAP_ID, sha256_extracted: mapMetadata.sha256_extracted },
      fact_keys: [VH, HIGH],
      superseded_by: null,
      package: {
        statutory_basis: "prc_4202",
        currency: "until_superseded",
        members: {
          adopted_map: { source_id: MAP_ID },
          adopting_regulation: { source_id: REGULATION_ID },
          overlay_dataset: { source_id: DATASET_ID, sha256_extracted: datasetMetadata.sha256_extracted },
        },
      },
    });
    for (const key of [VH, HIGH]) {
      expect(programAuthorityRegistries.fact_policies[key]?.establishing, key).toEqual([
        {
          record_kind: "agency_hazard_map",
          identity: "registered_authority_source",
          issuer_ids: ["calfire-osfm"],
          authority_source_ids: [PACKAGE_ID],
          values: ["true", "false"],
          currency_max_age_days: "until_superseded",
        },
      ]);
    }
    const others = Object.entries(programAuthorityRegistries.fact_policies).filter(([key]) => key !== VH && key !== HIGH);
    for (const [key, policy] of others) expect(policy?.establishing, key).toEqual([]);
  });

  it("is ready for registration: the map capture itself shows its agency, dated edition, and both legend classes", async () => {
    expect(await authoritySourceCaptureIssues(registeredSource, { metadata: mapMetadata, extracted: mapExtracted })).toEqual([]);
  });

  it("keeps GOV §51178 unregistered, with no record kind", () => {
    expect(statutoryRouteRecordKinds.gov_51178).toBeNull();
    expect(JSON.stringify(programAuthorityRegistries)).not.toContain("gov_51178");
    // No registry may carry a §51178 package for either hazard fact.
    const route1 = edited(programAuthorityRegistries, (draft) => (draft.sources[0].package.statutory_basis = "gov_51178"));
    expect(() => parseProgramAuthorityRegistries(route1)).toThrow(/A package on gov_51178 is not a agency_hazard_map; that route has no record kind/);
  });

  it("refuses a hazard source without a package, and until_superseded without one", () => {
    const bare = edited(programAuthorityRegistries, (draft) => delete draft.sources[0].package);
    expect(() => parseProgramAuthorityRegistries(bare)).toThrow(/carries no authority package/);
    const noHigh = edited(programAuthorityRegistries, (draft) => (draft.sources[0].package.overlay.class_labels = { "Very High": "very_high", Moderate: "moderate" }));
    expect(() => parseProgramAuthorityRegistries(noHigh)).toThrow(/name both the Very High and the High class/);
  });
});

/* ======================================================================== */

describe("4. c: PRC §4202 is Route 2 only; Route 1 stays unavailable, and c never clears", () => {
  it("establishes a Route 2 YES for a lot wholly inside Very High", () => {
    const result = cResult(true);
    expect(result).toMatchObject({
      status: "disqualifying_per_source",
      authority: { established: true, facts: [{ key: VH, route: "prc_4202", established: true, establishing_evidence_ids: ["vh-route-2"] }] },
    });
  });

  it("establishes Route 2's NO, but c cannot clear on Route 2 alone", () => {
    const result = cResult(false);
    expect(result.status).toBe("unknown");
    expect(result.statutory_routes?.map((route) => [route.route, route.value])).toEqual([
      ["gov_51178", null],
      ["prc_4202", false],
    ]);
  });

  it("fails every GOV §51178 record closed: Route 1 has no record kind", () => {
    const result = cResult(false, false);
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("statutory_route_record_kind_undefined");
    // A §51178 YES never establishes either.
    const route1Yes = cResult(null, true);
    expect(route1Yes.status).toBe("unknown");
    expect(failureCodes(route1Yes)).toContain("statutory_route_record_kind_undefined");
  });

  it("keeps a Route 2 YES when Route 1 carries a NO", () => {
    expect(cResult(true, false).status).toBe("disqualifying_per_source");
  });

  it("keeps c pending: statutory_route_recorded stays unmet", () => {
    const c = programScreenPathwayPacks.flatMap((entry) => entry.criteria).find((criterion) => criterion.id === C) as ProgramCriterion;
    expect(authorityPromotionBlockers(c, programAuthorityRegistries, false)).toEqual([
      "statutory_route_recorded",
      "reviewer_confirms_encoded_rule",
      "human_verification_record",
    ]);
    expect(authorityPromotionBlockers(c, programAuthorityRegistries, true)).toContain("statutory_route_recorded");
  });
});

/* ======================================================================== */

describe("5. d: YES and NO through the package, and only with lot coverage and the legend class", () => {
  it("establishes YES when the whole legal lot lies in High", () => {
    expect(dResult(true)).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });
  });

  it("establishes NO when SRA features cover the lot and none of it is High", () => {
    for (const classes of [["Very High"], ["Moderate"], ["Very High", "Moderate"]]) {
      expect(dResult(false, { classes }), classes.join("+")).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
    }
  });

  it("stays unknown without lot coverage or the legend class", () => {
    for (const covered of ["no", "not_established"] as const) {
      const result = dResult(false, { covered });
      expect(result.status, covered).toBe("unknown");
      expect(failureCodes(result), covered).toContain("hazard_area_not_covered");
    }
    for (const legend of ["no", "not_established"]) {
      const result = dResult(false, {}, (draft) => (draft.qualifiers.legend_defines_class_for_lot = legend));
      expect(result.status, legend).toBe("unknown");
      expect(failureCodes(result), legend).toContain("hazard_legend_class_not_defined");
    }
  });

  it("stays unknown without a reviewed lot geometry compared with the pinned dataset", () => {
    const cases: Array<[string, (draft: Draft) => void]> = [
      ["no overlay", (draft) => delete draft.qualifiers.lot_overlay],
      ["a null overlay", (draft) => (draft.qualifiers.lot_overlay = null)],
      ["no overlay performed", (draft) => (draft.qualifiers.lot_overlay.method = "not_performed")],
      ["no lot geometry", (draft) => (draft.qualifiers.lot_overlay.lot_geometry = null)],
      ["no dataset named", (draft) => (draft.qualifiers.lot_overlay.dataset = null)],
      ["another dataset", (draft) => (draft.qualifiers.lot_overlay.dataset.sha256_extracted = "0".repeat(64))],
      ["a parcel-number match, not an overlay", (draft) => (draft.parcel_relationship.matched_by = "parcel_identifier")],
    ];
    for (const [name, change] of cases) {
      for (const value of [true, false]) {
        const result = dResult(value, {}, change);
        expect(result.status, `${name} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${name} ${value}`).toContain("lot_overlay_not_established");
      }
    }
  });

  it("never establishes a value the overlay's classes do not support", () => {
    const cases: Array<[boolean, string[]]> = [
      [true, ["High", "Moderate"]],
      [true, ["Very High"]],
      [true, []],
      [false, ["High"]],
      [false, ["Moderate", "High"]],
      [false, []],
      // A numeric FHSZ code is never a class.
      [true, ["2"]],
      [false, ["3"]],
    ];
    for (const [value, classes] of cases) {
      const result = dResult(value, { classes });
      expect(result.status, `${value} ${classes.join("+")}`).toBe("unknown");
      expect(failureCodes(result), `${value} ${classes.join("+")}`).toContain("lot_overlay_classes_do_not_support_value");
    }
  });

  it("stays unknown for FRA or LRA land: no SRA feature is never a NO", () => {
    // The lot intersects no SRA feature, so SRA features do not cover it.
    const noFeature = dResult(false, { classes: [], covered: "no" });
    expect(noFeature.status).toBe("unknown");
    expect(failureCodes(noFeature)).toEqual(expect.arrayContaining(["hazard_area_not_covered", "lot_overlay_classes_do_not_support_value"]));
    // Even a record that claims coverage cannot make an empty overlay a NO.
    expect(dResult(false, { classes: [], covered: "yes" }).status).toBe("unknown");
    expect(manifest.assertions.unclassified_areas.value).toBe("no_feature_is_not_a_negative_result");
  });

  it("stays unknown for a lot only partly in High, or only partly covered by SRA", () => {
    // Partial overlap is recorded as unknown, never a YES or NO.
    const partial = dResult(null);
    expect(partial.status).toBe("unknown");
    expect(partial.authority).toBeUndefined();
    // A NO for a lot only partly covered by SRA features is not established.
    const partlySra = dResult(false, { classes: ["Moderate"], covered: "no" });
    expect(partlySra.status).toBe("unknown");
    expect(failureCodes(partlySra)).toContain("hazard_area_not_covered");
  });

  it("fails legal-lot identity closed", () => {
    for (const change of [
      (draft: Draft) => (draft.parcel_relationship.legal_lot_identity = "not_established"),
      (draft: Draft) => (draft.parcel_relationship.legal_lot_identity = "tied_or_multiple_lots"),
      (draft: Draft) => (draft.parcel_relationship.legal_lot_reference = null),
    ]) {
      const result = dResult(true, {}, change);
      expect(result.status).toBe("unknown");
      expect(failureCodes(result)).toContain("legal_lot_identity_not_established");
    }
  });

  it("is current until superseded: no age window, but never superseded and never checked after the screen", () => {
    expect(dResult(true, {}, (draft) => (draft.edition.currency_checked_on = "2024-04-01")).status).toBe("disqualifying_per_source");
    expect(failureCodes(dResult(true, {}, (draft) => (draft.edition.currency_checked_on = "2026-10-01")))).toContain("edition_not_current");
    expect(failureCodes(dResult(true, {}, (draft) => (draft.edition.currency = "superseded")))).toContain("edition_not_current");
    const superseded = edited(shipped(), (draft) => {
      draft.sources.push({ ...structuredClone(draft.sources[0]), authority_source_id: "calfire-sra-fhsz-later-edition" });
      draft.sources[0].superseded_by = "calfire-sra-fhsz-later-edition";
    });
    const evidence = record("high-true", HIGH, true);
    const result = screen(dModel(), [evidence], [block(evidence)], superseded);
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("authority_source_not_registered");
  });

  it("names the adopted, dated edition: another edition or an unadopted map never establishes", () => {
    expect(failureCodes(dResult(true, {}, (draft) => (draft.edition.date = "2024-04-01")))).toContain("authority_source_not_registered");
    expect(failureCodes(dResult(true, {}, (draft) => (draft.qualifiers.adoption_status = "not_established")))).toContain(
      "hazard_map_adoption_not_established",
    );
    expect(failureCodes(dResult(true, {}, (draft) => (draft.qualifiers.named_agency = "other_agency")))).toContain("statutory_agency_not_recorded");
  });

  it("keeps d pending: only the two human gates remain, and the shipped d has no human record", () => {
    const d = programScreenPathwayPacks.flatMap((entry) => entry.criteria).find((criterion) => criterion.id === D) as ProgramCriterion;
    expect(d).toMatchObject({ verification: "pending_human", human_verification: null, predicate: "not_encoded" });
    expect(authorityPromotionBlockers(d, programAuthorityRegistries, false)).toEqual(["reviewer_confirms_encoded_rule", "human_verification_record"]);
    expect(criterionAwaitsHumanVerification(d)).toBe(true);
  });
});

/* ======================================================================== */

describe("6. Responsibility area, LRA maps, and City displays never stand in for the package", () => {
  it("retains the responsibility area the map states, as context only", () => {
    const context = mapMetadata.schema_version === "program-screen-official-source-v2" ? mapMetadata.agency_map : null;
    expect(context?.responsibility_areas).toEqual([
      {
        area: "state",
        legend_classes: ["very_high", "high", "moderate"],
        excerpts: [
          { page: 1, text: "Fire Hazard Severity Zones in State Responsibility Area (SRA)" },
          { page: 1, text: "Very High 16,913,515 Acres" },
          { page: 1, text: "High 10,137,597 Acres" },
          { page: 1, text: "Moderate 3,944,882 Acres" },
        ],
      },
    ]);
    // Recorded responsibility area never changes a lot result.
    for (const area of ["state", "local", "federal", "not_stated"]) {
      expect(dResult(true, {}, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe("disqualifying_per_source");
    }
  });

  it("does not require a responsibility area when the official map states none", async () => {
    const legendOnly = edited(mapMetadata, (draft) => {
      draft.agency_map.legend = { classes: ["very_high", "high", "moderate"], excerpts: draft.agency_map.responsibility_areas[0].excerpts };
      draft.agency_map.responsibility_areas = [];
    });
    expect(officialSourceMetadataSchema.safeParse(legendOnly).success).toBe(true);
    expect(await authoritySourceCaptureIssues(registeredSource, { metadata: legendOnly, extracted: mapExtracted })).toEqual([]);
    const captures = packageCaptures((map) => map.set(MAP_ID, { metadata: legendOnly, extracted: mapExtracted }));
    expect(await authorityPackageIssues(manifestJson, captures)).toEqual([]);
  });

  it("never lets an LRA recommendation masquerade as the SRA §4202 package", async () => {
    // A recommended (LRA) map is captured as proposed_not_operative: it can back neither a source nor a package.
    const recommended = edited(mapMetadata, (draft) => (draft.operative_status = "proposed_not_operative"));
    expect(await authoritySourceCaptureIssues(registeredSource, { metadata: recommended, extracted: mapExtracted })).toContain(
      "A map recorded as proposed_not_operative can never back an authority source.",
    );
    const captures = packageCaptures((map) => map.set(MAP_ID, { metadata: recommended, extracted: mapExtracted }));
    expect(await authorityPackageIssues(manifestJson, captures)).toContain(
      "member adopted_map: a adopted_map recorded as proposed_not_operative can never back a package.",
    );
    // An LRA determination names GOV §51178, which has no record kind; an unregistered LRA source never matches.
    const lra = dResult(true, { basis: "gov_51178" });
    expect(lra.status).toBe("unknown");
    expect(failureCodes(lra)).toContain("statutory_route_not_accepted");
    const lraSource = dResult(true, {}, (draft) => (draft.source_identifier.value = "lafd-lra-fhsz-recommended-2025"));
    expect(failureCodes(lraSource)).toContain("authority_source_not_registered");
    // The TEST-ONLY map, standing in for any other capture, never backs the package's source.
    expect(testOnlyMapMetadata.source_id).not.toBe(MAP_ID);
  });

  it("never lets a City or ZIMAS display become authority, while it still counts toward conflict", () => {
    const zimas = record("zimas-high", HIGH, true, "official_portal");
    const displayBlock = edited(block(record("zimas-high", HIGH, true)), (draft) => {
      draft.record_kind = "city_parcel_display";
      draft.issuer = { name: "City of Los Angeles ZIMAS", issuer_id: null };
      draft.source_identifier = { scheme: "portal_url_only", value: "ZIMAS" };
      draft.capture = null;
      draft.source_url = zimas.source.url;
    });
    const alone = screen(dModel(), [zimas], [displayBlock]);
    expect(alone.status).toBe("unknown");
    expect(failureCodes(alone)).toContain("record_kind_prohibited_for_fact");
    // Layer 1 still compares it with the package-backed NO, so the disagreement is a conflict, not a clearing NO.
    const no = record("high-false", HIGH, false);
    expect(screen(dModel(), [zimas, no], [displayBlock, block(no)]).status).toBe("conflict");
  });
});

/* ======================================================================== */

describe("7. Invariants", () => {
  // The same pins as every earlier phase: registration changes no fixture output.
  const EVALUATOR_OUTPUT_SHA256 = "68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1";
  const criteria = programScreenPathwayPacks.flatMap((entry) => entry.criteria);

  it("promotes nothing: human_verified is 0 and pending_human is 46, every guarded criterion blocked", () => {
    expect(criteria.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(criteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
    for (const criterion of criteria.filter((candidate) => promotionGuardedCriterionIds.has(candidate.id))) {
      expect(authorityPromotionBlockers(criterion, programAuthorityRegistries, false).length, criterion.id).toBeGreaterThan(0);
    }
  });

  it("keeps the evaluator and public-demo output byte-identical", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
  });

  it("keeps the SHRA completeness blockers G1 and G2 open", () => {
    expect(programPathwayCompletenessBlockers.map((blocker) => [blocker.id, blocker.key, blocker.status])).toEqual([
      ["G1", "shra_a9a_ballot_measure_agricultural_land", "open"],
      ["G2", "shra_a9h_hcp_and_other_resource_protection_plans", "open"],
    ]);
  });

  it("documents the package, the decisions, and every pin", () => {
    for (const text of [
      pack.manifest_sha256,
      mapMetadata.sha256_original,
      mapMetadata.sha256_extracted,
      regulationMetadata.sha256_original,
      regulationMetadata.sha256_extracted,
      datasetMetadata.sha256_original,
      datasetMetadata.sha256_extracted,
      EVALUATOR_OUTPUT_SHA256,
      PUBLIC_DEMO_OUTPUT_SHA256,
      "calfire-osfm",
      PACKAGE_ID,
      "until_superseded",
    ]) {
      expect(phase3dDoc, text).toContain(text);
    }
  });
});

// Keep the typed import of the TEST-ONLY map's metadata used (it only proves another ID never matches).
void (testOnlyMapMetadata as unknown as OfficialSourceMetadata);
