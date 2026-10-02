import { describe, expect, inject, it, vi } from "vitest";
import phase3eDoc from "../../docs/PROGRAM_SCREEN_PHASE_3E_D_PROMOTION_REVIEW.md?raw";
import phase3hDoc from "../../docs/PROGRAM_SCREEN_PHASE_3H_SRA_TOPOLOGY_SAFETY_FIX.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import manifestRaw from "../fixtures/program-screen/authority-packages/calfire-sra-fhsz-2023-09-29.json?raw";
import datasetExtracted from "../fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/extracted.txt?raw";
import datasetMetadataJson from "../fixtures/program-screen/official-sources/calfire-fhszsra-23-3-data/metadata.json";
import mapExtracted from "../fixtures/program-screen/official-sources/calfire-sra-fhsz-map-2023-09-29/extracted.txt?raw";
import mapMetadataJson from "../fixtures/program-screen/official-sources/calfire-sra-fhsz-map-2023-09-29/metadata.json";
import regulationExtracted from "../fixtures/program-screen/official-sources/ccr-19-2201-fhsz-sra-final-text/extracted.txt?raw";
import regulationMetadataJson from "../fixtures/program-screen/official-sources/ccr-19-2201-fhsz-sra-final-text/metadata.json";
import statuteExtracted from "../fixtures/program-screen/official-sources/gcs-66499-41/extracted.txt?raw";
import statuteMetadataJson from "../fixtures/program-screen/official-sources/gcs-66499-41/metadata.json";
import memoExtracted from "../fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt?raw";
import memoMetadataJson from "../fixtures/program-screen/official-sources/shra-2025-10-28/metadata.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import type { ProgramAuthorityContext, ProgramLotOverlayInputs } from "../src/shared/program-screen/authority-gate";
import {
  authorityPackageIssues,
  authorityPackageManifestSchema,
  authorityPackageRegistrationIssues,
  type PackageCapture,
} from "../src/shared/program-screen/authority-package";
import {
  authorityPromotionBlockers,
  parseProgramAuthorityRegistries,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
} from "../src/shared/program-screen/authority-policy";
import { booleanFact, jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPack, shraPathway } from "../src/shared/program-screen/criteria/shra";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import {
  authorityRecordKindEvidenceTypes,
  authorityRecordKinds,
  parseProgramEvidenceAuthority,
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  type AuthorityRecordKind,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { computeLotOverlay, type LotWithinFeatures } from "../src/shared/program-screen/lot-overlay";
import {
  loadOverlayDatasetView,
  overlayIndexPinFor,
  overlayIndexPins,
  parseOverlayIndex,
} from "../src/shared/program-screen/overlay-dataset";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  criterionAwaitsHumanVerification,
  criterionPromotionBlockers,
  hasCompleteHumanVerification,
  parseProgramPathwayPacks,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import {
  excerptAppearsInCapture,
  humanRecordCaptureIssues,
  parseOfficialSourceMetadata,
  sha256Hex,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  programPathwayCompletenessBlockers,
  type CriterionPredicate,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramCriterionResult,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";
import { prePromotionC, prePromotionPacks } from "./program-screen-c-pre-promotion";
import { REAL_LOT_NAMES, realLotOverlay, syntheticLotOverlay, type RealLotName } from "./program-screen-overlay-helpers";

/**
 * Phase 3E: the first production promotion, of
 * la_shra.high-fire-hazard-severity-zone (d) only. The reviewer kept d pending
 * until F1 was fixed, then approved the promotion ("APPROVE D PROMOTION",
 * 2026-09-29). The approved rule, rule summary, judgment question, citation
 * dates, and human-verification record are written out below as constants;
 * section 1 checks that the shipped d is exactly them. `promotedD()` is the
 * shipped d; `pendingD()` is d as it shipped before, for comparison.
 *
 * Every check runs d against its real Phase 3B requirement and the SHIPPED
 * registries (the real CAL FIRE / OSFM package), never a TEST-ONLY
 * requirement. Every lot, lot geometry, and case record is TEST-ONLY and
 * fictional.
 *
 * F1 (Phase 3E): whole-lot coverage and the classes on the lot are computed
 * by the gate's lot overlay from a reviewed lot geometry and the pinned
 * FHSZSRA_23_3 polygons, never read from the block. The TEST-ONLY lots are
 * fictional squares placed at real locations in that dataset
 * (fixtures/program-screen/test-only-lot-geometries).
 */

const AS_OF = "2026-09-29";
const RETRIEVED_AT = "2026-09-28T18:00:00.000Z";
const REVIEWED_ON = "2026-09-29";
const SUBJECT = { case_id: "case-fictional-phase-3e-test", property_id: "property-fictional-phase-3e-test" };
const BLOCK_REVIEWER = { kind: "human", name: "TEST-ONLY Reviewer", role: "Synthetic reviewer" } as const;

const VH: ProgramFactKey = "very-high-fire-hazard-severity-zone";
const HIGH: ProgramFactKey = "high-fire-hazard-severity-zone";
const C = "la_shra.very-high-fire-hazard-severity-zone";
const D = "la_shra.high-fire-hazard-severity-zone";
const E = "la_shra.prime-or-statewide-farmland";
const F = "la_shra.natural-community-conservation-plan-land";
const G = "la_shra.conservation-easement";

const PACKAGE_ID = "calfire-sra-fhsz-2023-09-29";
const MAP_ID = "calfire-sra-fhsz-map-2023-09-29";
const REGULATION_ID = "ccr-19-2201-fhsz-sra-final-text";
const DATASET_ID = "calfire-fhszsra-23-3-data";
const MEMO_PATH = "app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt";
const OFFICIAL_DIR = "app/fixtures/program-screen/official-sources/";

const REVIEWER_GATES = ["reviewer_confirms_encoded_rule", "human_verification_record"] as const;
const D_GATES = [
  "evidence_provenance_enforced_or_fails_closed",
  "map_identity_and_edition_recorded",
  "statutory_route_recorded",
  "prc_4202_map_coverage_and_legend_class_recorded",
  "legal_lot_identity_fails_closed",
  ...REVIEWER_GATES,
] as const;

// The shipped output before the promotion (Phase 3D, PR #26, and the F1 fix, which changed no output).
const EVALUATOR_OUTPUT_SHA256 = "68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a";
const PUBLIC_DEMO_OUTPUT_SHA256 = "11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1";
// After the approved promotion of d: the projections the reviewer approved, reproduced exactly.
const PROMOTED_EVALUATOR_OUTPUT_SHA256 = "156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc";
const PROMOTED_PUBLIC_DEMO_OUTPUT_SHA256 = "4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5";
// Updated in Phase 3H: the approved c-only promotion moved the shipped output again. d's approved projection
// above is still reproduced exactly with c rebuilt in its pre-promotion form.
const PHASE_3H_EVALUATOR_OUTPUT_SHA256 = "1341fea59e307fed23ec1cd32fcdb2467d0fa3519bd07dd134fa9ddfee6deaad";
const PHASE_3H_PUBLIC_DEMO_OUTPUT_SHA256 = "23aaee06e51b42a4c1001d6253504f2f932d591315af468ada21345d888a5070";

const mapMetadata = parseOfficialSourceMetadata(mapMetadataJson);
const regulationMetadata = parseOfficialSourceMetadata(regulationMetadataJson);
const datasetMetadata = parseOfficialSourceMetadata(datasetMetadataJson);
const memoMetadata = parseOfficialSourceMetadata(memoMetadataJson);
const statuteMetadata = parseOfficialSourceMetadata(statuteMetadataJson);
const manifestJson = JSON.parse(manifestRaw) as unknown;
const manifest = authorityPackageManifestSchema.parse(manifestJson);
const registeredSource = programAuthorityRegistries.sources.find((source) => source.authority_source_id === PACKAGE_ID);
if (registeredSource?.package === undefined) throw new Error("The Phase 3D package is not registered.");
const pack = registeredSource.package;
const registeredIssuer = programAuthorityRegistries.issuers.find((issuer) => issuer.issuer_id === "calfire-osfm");
const overlay = await realLotOverlay();

const shippedCriteria = programScreenPathwayPacks.flatMap((entry) => entry.criteria);
const shipped = (id: string) => shippedCriteria.find((criterion) => criterion.id === id) as ProgramCriterion;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;
function edited<T>(value: T, change: (draft: Draft) => void): T {
  const draft = structuredClone(value) as Draft;
  change(draft);
  return draft as T;
}

/* ------------------------------------------------ the proposed promotion */

/** Human verification date: the day the reviewer answers. Proposed as the review date. */
const PROPOSED_VERIFIED_AT = "2026-09-29";
/** High-volatility citation: at most 30 days (citationReviewCadenceDays.high). */
const PROPOSED_NEXT_REVIEW_AT = "2026-10-29";

/**
 * The encoded Phase 3B d rule. Every source, coverage, and lot-identity
 * condition is enforced before it runs, by the authority gate over the fact.
 */
const proposedPredicate: CriterionPredicate = (facts) =>
  booleanFact(facts, HIGH) ? "disqualifying_per_source" : "consistent_with_source";

const PROPOSED_RULE_SUMMARY =
  "Phase 3B decision d. Disqualifying per source when a reviewed CAL FIRE / State Fire Marshal record under PRC §4202, a deterministic overlay of the reviewed legal-lot geometry on the registered SRA dataset, shows the whole lot proposed to be subdivided in High. Consistent with source when SRA features cover the whole lot, the legend defines High there, and no part of the lot is High. Partial coverage, land outside the SRA, an unclear legal lot, GOV §51178, and any other source stay unknown. Very High is criterion c.";

const PROPOSED_QUESTION_IF_JUDGMENT =
  "How does Planning apply the SHRA High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?";

function proposedRecord(citation: ProgramCriterion["citation"]): ProgramCriterionHumanVerification {
  return {
    reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
    verified_at: citation.verified_at,
    next_review_at: citation.next_review_at,
    source_title: citation.title,
    source_url: citation.url,
    instrument: "City of Los Angeles SHRA implementation memo, October 28, 2025",
    pinpoint: citation.pinpoint,
    supporting_excerpt:
      "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.",
    source_capture: {
      repo_path: MEMO_PATH,
      retrieved_at: memoMetadata.retrieved_at,
      capture_method: "pdf_text_extraction",
      sha256: memoMetadata.sha256_extracted,
      is_ai_generated: false,
      source_type: "official_memo",
      operative_status: "operative",
    },
    decision_ref: { phase: "3B", letter: "d" },
  };
}

/**
 * The shipped d. Since the reviewer approved the promotion ("APPROVE D
 * PROMOTION", 2026-09-29), it is exactly the proposal above; section 1 checks
 * that field by field.
 */
function promotedD(overrides: Partial<ProgramCriterion> = {}): ProgramCriterion {
  return { ...shipped(D), ...overrides };
}

/** d as it shipped before the promotion: pending, no rule, no record (TEST-ONLY, for comparison). */
function pendingD(): ProgramCriterion {
  return { ...shipped(D), predicate: "not_encoded", question_if_judgment: null, verification: "pending_human", human_verification: null };
}

const withPromotedD = (criterion: ProgramCriterion = promotedD(), packs: readonly ProgramPathwayPack[] = programScreenPathwayPacks): ProgramPathwayPack[] =>
  packs.map((entry) => ({
    ...entry,
    criteria: entry.criteria.map((candidate) => (candidate.id === D ? criterion : candidate)),
  }));

/* ------------------------------------------------------------ evidence */

function record(
  id: string,
  key: ProgramFactKey,
  value: boolean | null,
  evidenceType: CanonicalEvidenceRecord["evidence_type"] = "official_map",
): CanonicalEvidenceRecord {
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
      url: `https://records.example.test/phase-3e-tests/${id}`,
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
  const base = record("anchor-parcel-match", "parcel-match", true, "official_portal");
  const spec = (key: ProgramFactKey) => programFactSpecs[key];
  return [
    { ...base, claim: { key: "parcel-match", label: spec("parcel-match").label, client_label: spec("parcel-match").client_label } },
    {
      ...base,
      id: "anchor-jurisdiction",
      claim: { key: "jurisdiction", label: spec("jurisdiction").label, client_label: spec("jurisdiction").client_label },
      raw_observed_value: { kind: "text", value: "City of Los Angeles" },
      normalized_value: { kind: "text", value: "City of Los Angeles" },
      source: { ...base.source, url: "https://records.example.test/phase-3e-tests/anchor-jurisdiction" },
    },
  ];
}

interface BlockOptions {
  /** The TEST-ONLY lot the block names; by default a lot whose computed overlay supports the recorded value. */
  lot?: RealLotName;
  basis?: string;
  /** The reviewer's own reading of map coverage: context only, never read by the gate. */
  attested?: "yes" | "no" | "not_established";
}

/** The TEST-ONLY lot whose computed overlay supports a record's value by default. */
function defaultLot(key: ProgramFactKey, value: boolean | null): RealLotName {
  if (value === null) return "high-moderate";
  if (!value) return "whole-moderate";
  return key === VH ? "whole-very-high" : "whole-high";
}

/**
 * A reviewed block for a fictional lot on the registered package. It names
 * the lot geometry and the pinned dataset; the gate computes the overlay.
 */
function block(evidence: CanonicalEvidenceRecord, options: BlockOptions = {}): ProgramEvidenceAuthority {
  const key = evidence.claim.key as ProgramFactKey;
  const value = evidence.normalized_value.kind === "boolean" ? evidence.normalized_value.value : null;
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
      currency_checked_on: "2026-09-28",
    },
    retrieved_at: evidence.source.retrieved_at,
    source_url: evidence.source.url,
    capture: { store: "repo_official_source", source_id: MAP_ID, sha256_extracted: mapMetadata.sha256_extracted },
    parcel_relationship: {
      matched_by: "spatial_overlay",
      parcel_identifier: "TEST-ONLY-APN-3E00",
      legal_lot_reference: "TEST-ONLY Tract 3E, Lot 1",
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage: value === true ? "whole_parcel" : value === false ? "none_of_parcel" : "partial_parcel",
    qualifiers: {
      family: "hazard_map",
      hazard_class: key === VH ? "very_high" : "high",
      statutory_basis: (options.basis ?? "prc_4202") as "prc_4202",
      adoption_status: "adopted",
      named_agency: "department_of_forestry_and_fire_protection",
      map_covers_lot: options.attested ?? "yes",
      legend_defines_class_for_lot: "yes",
      responsibility_area_as_stated: "state",
      lot_overlay: {
        method: "deterministic_spatial_overlay",
        dataset: { source_id: DATASET_ID, sha256_extracted: datasetMetadata.sha256_extracted },
        lot_geometry: overlay.lots[options.lot ?? defaultLot(key, value)],
      },
    },
    authority_review: { status: "reviewed", reviewer: BLOCK_REVIEWER, reviewed_on: REVIEWED_ON },
    notes: ["TEST-ONLY fictional lot result."],
    is_ai_generated: false,
  };
}

/** A City/ZIMAS display of the High fact: never authority, still Layer 1 evidence. */
function zimasDisplay(id: string, value: boolean): { evidence: CanonicalEvidenceRecord; authority: ProgramEvidenceAuthority } {
  const evidence = record(id, HIGH, value, "official_portal");
  const authority = edited(block(record(id, HIGH, value)), (draft) => {
    draft.record_kind = "city_parcel_display";
    draft.issuer = { name: "City of Los Angeles ZIMAS", issuer_id: null };
    draft.source_identifier = { scheme: "portal_url_only", value: "ZIMAS" };
    draft.capture = null;
    draft.source_url = evidence.source.url;
  });
  return { evidence, authority };
}

/** Evaluates d (the proposed promotion by default) on one lot, against the SHIPPED registries. */
function screenD(
  records: CanonicalEvidenceRecord[],
  blocks: ProgramEvidenceAuthority[],
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
  criterion: ProgramCriterion = promotedD(),
  lotOverlay: ProgramLotOverlayInputs | null = overlay.inputs,
): ProgramCriterionResult {
  const result = evaluateProgramScreen({
    evidence_records: [...anchors(), ...records],
    as_of: AS_OF,
    packs: [{ pathway: shraPathway, criteria: [parcelMatchCriterion("la_shra"), jurisdictionCriterion("la_shra"), criterion] }],
    evidence_authority: blocks,
    authority_registries: registries,
    ...(lotOverlay === null ? {} : { lot_overlay: lotOverlay }),
  });
  return result.pathways[0].criteria[2];
}

/** One lot result on the High fact. */
function dLot(
  value: boolean | null,
  options: BlockOptions = {},
  change: (draft: Draft) => void = () => {},
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
  lotOverlay: ProgramLotOverlayInputs | null = overlay.inputs,
): ProgramCriterionResult {
  const evidence = record(`high-${String(value)}`, HIGH, value);
  return screenD([evidence], [edited(block(evidence, options), change)], registries, promotedD(), lotOverlay);
}

function failureCodes(result: ProgramCriterionResult): string[] {
  return (result.authority?.facts ?? []).flatMap((fact) => fact.non_establishing.flatMap((entry) => entry.failures));
}

/**
 * Runs d directly on a lot wholly in High, against registries the schema
 * might refuse. An encoded rule is replaced by a spy; `not_encoded` is kept.
 */
function runWithSpy(criterion: ProgramCriterion, registries: ProgramAuthorityRegistries) {
  const spy = vi.fn(proposedPredicate);
  const evidence = record("high-true", HIGH, true);
  const records = [evidence];
  const context: ProgramAuthorityContext = {
    registries,
    blocks: parseProgramEvidenceAuthority([block(evidence)], records),
    records,
    overlay: overlay.inputs,
  };
  const facts = new Map(assessProgramFacts(records, [HIGH]).map((fact) => [fact.key, fact]));
  const predicate = typeof criterion.predicate === "function" ? spy : criterion.predicate;
  const result = evaluateProgramCriterion({ ...criterion, predicate }, facts, AS_OF, context);
  return { result, spy };
}

function packageCaptures(change: (captures: Map<string, PackageCapture>) => void = () => {}): Map<string, PackageCapture> {
  const captures = new Map<string, PackageCapture>([
    [MAP_ID, { metadata: mapMetadata, extracted: mapExtracted }],
    [REGULATION_ID, { metadata: regulationMetadata, extracted: regulationExtracted }],
    [DATASET_ID, { metadata: datasetMetadata, extracted: datasetExtracted }],
  ]);
  change(captures);
  return captures;
}

/* ======================================================================== */

describe("1. The shipped state after the approved promotion of d", () => {
  it("ships exactly the approved rule, rule summary, judgment question, citation, and human-verification record", () => {
    const d = shipped(D);
    const citation = { ...shipped(C).citation, pinpoint: d.citation.pinpoint, verified_at: PROPOSED_VERIFIED_AT, next_review_at: PROPOSED_NEXT_REVIEW_AT };
    expect(d).toMatchObject({
      verification: "human_verified",
      rule_summary: PROPOSED_RULE_SUMMARY,
      question_if_judgment: PROPOSED_QUESTION_IF_JUDGMENT,
      citation,
      permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      fact_keys: [HIGH],
      exception_paths: [],
    });
    expect(d.human_verification).toEqual(proposedRecord(citation));
    expect(d.human_verification).toMatchObject({ verified_at: "2026-09-29", next_review_at: "2026-10-29", decision_ref: { phase: "3B", letter: "d" } });
    const rule = d.predicate as CriterionPredicate;
    expect(typeof rule).toBe("function");
    for (const value of [true, false]) {
      expect(rule({ [HIGH]: { kind: "boolean", value } }), String(value)).toBe(proposedPredicate({ [HIGH]: { kind: "boolean", value } }));
    }
    expect(() => rule({ [VH]: { kind: "boolean", value: true } })).toThrow();
  });

  it("meets every d gate with its record: the reviewer gates were the only two left", () => {
    const d = shipped(D);
    const requirement = programAuthorityRegistries.criterion_requirements[D];
    expect(requirement).toMatchObject({ applicability: "enforced", decision_ref: { phase: "3B", letter: "d" } });
    expect(requirement.promotion_gates).toEqual([...D_GATES]);
    expect(criterionPromotionBlockers(d)).toEqual([]);
    expect(authorityPromotionBlockers(pendingD(), programAuthorityRegistries, false)).toEqual([...REVIEWER_GATES]);
    expect(criterionAwaitsHumanVerification(d)).toBe(false);
  });

  // Updated in Phase 3H: c, then blocked by GOV §51178, was later promoted on its own audited record.
  it("keeps d promoted; c is the only later promotion: human_verified 2 and pending_human 44", () => {
    expect(shippedCriteria.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual([C, D]);
    expect(shippedCriteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(44);
    for (const id of [E, F, G]) expect(shipped(id), id).toMatchObject({ verification: "pending_human", human_verification: null, predicate: "not_encoded" });
    expect(shipped(C).human_verification?.decision_ref).toEqual({ phase: "3B", letter: "c" });
    expect(criterionPromotionBlockers(shipped(C))).toEqual([]);
    expect(criterionPromotionBlockers(prePromotionC())).toEqual(REVIEWER_GATES);
  });

  it("pins the evaluator and public-demo output to the approved projections", async () => {
    // Updated in Phase 3H: with c rebuilt pre-promotion, d's approved projection is reproduced exactly.
    const packs = prePromotionPacks();
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of, packs });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of, packs });
    expect(await sha256Hex(JSON.stringify(result))).toBe(PROMOTED_EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PROMOTED_PUBLIC_DEMO_OUTPUT_SHA256);
    // Before the promotion, the same fixture gave the Phase 3D output.
    const before = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of, packs: withPromotedD(pendingD(), packs) });
    expect(await sha256Hex(JSON.stringify(before))).not.toBe(PROMOTED_EVALUATOR_OUTPUT_SHA256);
    // The shipped output is the approved Phase 3H projection.
    const shippedResult = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const shippedDemo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(shippedResult))).toBe(PHASE_3H_EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(shippedDemo))).toBe(PHASE_3H_PUBLIC_DEMO_OUTPUT_SHA256);
  });
});

/* ======================================================================== */

describe("2. The promoted d is well-formed and meets every gate only through the shipped registries", () => {
  it("parses as a shipped criterion inside the real SHRA pack, and every gate is met", () => {
    const candidate = promotedD();
    expect(programCriterionSchema.safeParse(candidate).success).toBe(true);
    expect(() => parseProgramPathwayPacks(withPromotedD(candidate))).not.toThrow();
    expect(hasCompleteHumanVerification(candidate)).toBe(true);
    expect(authorityPromotionBlockers(candidate, programAuthorityRegistries, true)).toEqual([]);
    expect(criterionAwaitsHumanVerification(candidate)).toBe(false);
  });

  it("rests the record on the operative SHRA memo capture it quotes", async () => {
    const record = promotedD().human_verification as ProgramCriterionHumanVerification;
    expect(humanRecordCaptureIssues(record, { metadata: memoMetadata, extracted: memoExtracted })).toEqual([]);
    expect(await sha256Hex(memoExtracted)).toBe(record.source_capture.sha256);
    expect(excerptAppearsInCapture(record.supporting_excerpt, memoExtracted)).toBe(true);
    expect(record.decision_ref).toEqual(programAuthorityRegistries.criterion_requirements[D].decision_ref);
    // The shared memo citation (2026-09-17) predates the capture (2026-09-27), so a record can
    // match d's citation only because d's citation carries the actual verification date.
    // Updated in Phase 3H: c now carries its own verification date, so the shared citation is read from e.
    expect(shipped(E).citation.verified_at).toBe("2026-09-17");
    expect(memoMetadata.retrieved_at.slice(0, 10) > shipped(E).citation.verified_at).toBe(true);
    expect(shipped(D).citation.verified_at).toBe(record.verified_at);
    expect(record.verified_at >= memoMetadata.retrieved_at.slice(0, 10)).toBe(true);
  });

  it("keeps the outcome ceiling, and the encoded rule returns only YES → disqualifying, NO → consistent", () => {
    const candidate = promotedD();
    expect(candidate.permitted_outcomes).toEqual(shipped(D).permitted_outcomes);
    expect(candidate.fact_keys).toEqual([HIGH]);
    expect(candidate.exception_paths).toEqual([]);
    expect(proposedPredicate({ [HIGH]: { kind: "boolean", value: true } })).toBe("disqualifying_per_source");
    expect(proposedPredicate({ [HIGH]: { kind: "boolean", value: false } })).toBe("consistent_with_source");
    // Never reads Very High.
    expect(() => proposedPredicate({ [VH]: { kind: "boolean", value: true } })).toThrow();
  });

  it("uses no prohibited client-facing wording", () => {
    for (const text of [PROPOSED_RULE_SUMMARY, PROPOSED_QUESTION_IF_JUDGMENT]) expect(findProhibitedClientLanguage(text), text).toEqual([]);
  });
});

/* ======================================================================== */

describe("3. F1: the gate computes whole-lot SRA coverage from the reviewed lot and the pinned polygons", () => {
  const expected: Record<RealLotName, [LotWithinFeatures, string[]]> = {
    "whole-high": ["whole_lot", ["High"]],
    "whole-high-l-shape-with-hole": ["whole_lot", ["High"]],
    "whole-very-high": ["whole_lot", ["Very High"]],
    "whole-moderate": ["whole_lot", ["Moderate"]],
    // Phase 3H: relevant invalid source record 10977 makes this fixture unavailable.
    "very-high-moderate": ["not_established", []],
    "high-moderate": ["whole_lot", ["High", "Moderate"]],
    "high-very-high": ["whole_lot", ["High", "Very High"]],
    "part-moderate-outside-sra": ["part_of_lot", ["Moderate"]],
    "part-high-outside-sra": ["part_of_lot", ["High"]],
    "outside-sra": ["none", []],
    "outside-sra-near-features": ["none", []],
    "invalid-bow-tie": ["not_established", []],
    "invalid-other-crs": ["not_established", []],
  };

  it("computes lot_within_features and the classes on the lot for every TEST-ONLY lot", () => {
    for (const name of REAL_LOT_NAMES) {
      const computed = computeLotOverlay(overlay.view, overlay.geometries[name]);
      expect([computed.lot_within_features, computed.classes_on_lot], name).toEqual(expected[name]);
    }
    // Every record that could touch a lot is in the view: completeness is checked, not assumed.
    expect(computeLotOverlay(overlay.view, overlay.geometries["outside-sra-near-features"]).candidate_records.length).toBeGreaterThan(0);
    expect(overlay.geometries["invalid-bow-tie"].issues).toContain("Ring 1 intersects itself.");
    expect(overlay.geometries["invalid-other-crs"]).toMatchObject({ valid: true, crs_epsg: 4326 });
  });

  it("uses only the pinned index and verified records: a record missing from the view is never read as no feature", async () => {
    const candidates = computeLotOverlay(overlay.view, overlay.geometries["whole-moderate"]).candidate_records;
    expect(candidates.length).toBeGreaterThan(1);
    const provided = inject("programScreenOverlayDataset");
    const partial = await loadOverlayDatasetView({
      index_text: provided.index_text as string,
      records: Object.entries(provided.records)
        .filter(([recordNumber]) => Number(recordNumber) !== candidates[candidates.length - 1])
        .map(([recordNumber, base64]) => ({ record_number: Number(recordNumber), content: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) })),
    });
    expect(computeLotOverlay(partial, overlay.geometries["whole-moderate"])).toMatchObject({ lot_within_features: "not_established" });
    const result = dLot(false, { lot: "whole-moderate" }, () => {}, programAuthorityRegistries, { datasets: [partial], lot_geometries: overlay.inputs.lot_geometries });
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("lot_overlay_not_established");
  });

  it("whole SRA High blocks d (also for an L-shaped lot with a hole)", () => {
    for (const lot of ["whole-high", "whole-high-l-shape-with-hole"] as const) {
      expect(dLot(true, { lot }), lot).toMatchObject({
        status: "disqualifying_per_source",
        authority: { established: true, facts: [{ key: HIGH, established: true, establishing_evidence_ids: ["high-true"] }] },
      });
    }
  });

  it("valid whole SRA Very High and whole SRA Moderate clear d", () => {
    for (const lot of ["whole-very-high", "whole-moderate"] as const) {
      expect(dLot(false, { lot }), lot).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
    }
  });

  it("relevant invalid SRA geometry cannot clear d regardless of a negative attestation", () => {
    expect(dLot(false, { lot: "very-high-moderate" })).toMatchObject({ status: "unknown", authority: { established: false } });
  });

  it("whole SRA High + Moderate and whole SRA High + Very High stay unknown, whatever value is recorded", () => {
    for (const lot of ["high-moderate", "high-very-high"] as const) {
      for (const value of [true, false]) {
        const result = dLot(value, { lot });
        expect(result.status, `${lot} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${lot} ${value}`).toContain("lot_overlay_classes_do_not_support_value");
      }
      expect(dLot(null, { lot }).status, `${lot} partial`).toBe("unknown");
    }
  });

  it("part SRA Moderate + outside SRA can never clear d", () => {
    for (const attested of ["yes", "no", "not_established"] as const) {
      const result = dLot(false, { lot: "part-moderate-outside-sra", attested });
      expect(result.status, attested).toBe("unknown");
      expect(failureCodes(result), attested).toContain("hazard_area_not_covered");
    }
  });

  it("part SRA High + outside SRA can never block d", () => {
    for (const attested of ["yes", "no", "not_established"] as const) {
      const result = dLot(true, { lot: "part-high-outside-sra", attested });
      expect(result.status, attested).toBe("unknown");
      expect(failureCodes(result), attested).toContain("hazard_area_not_covered");
    }
  });

  it("no SRA features is unknown, never a NO: far from the SRA, or beside SRA features", () => {
    for (const lot of ["outside-sra", "outside-sra-near-features"] as const) {
      for (const value of [true, false]) {
        const result = dLot(value, { lot, attested: "yes" });
        expect(result.status, `${lot} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${lot} ${value}`).toContain("hazard_area_not_covered");
      }
    }
  });

  it("cannot be overridden by a conflicting manual attestation", () => {
    // The reviewer's map-coverage reading is context only: it neither creates nor removes coverage.
    for (const attested of ["no", "not_established"] as const) {
      expect(dLot(true, { lot: "whole-high", attested }).status, attested).toBe("disqualifying_per_source");
      expect(dLot(false, { lot: "whole-moderate", attested }).status, attested).toBe("consistent_with_source");
    }
    for (const [value, lot] of [[true, "part-high-outside-sra"], [false, "part-moderate-outside-sra"], [false, "outside-sra"]] as const) {
      expect(dLot(value, { lot, attested: "yes" }).status, lot).toBe("unknown");
    }
    // A block cannot carry an overlay result at all: the schema refuses recorded classes or coverage.
    for (const field of [{ classes_on_lot: ["High"] }, { lot_within_features: "whole_lot" }]) {
      const evidence = record("high-true", HIGH, true);
      const recorded = edited(block(evidence, { lot: "part-high-outside-sra" }), (draft) => Object.assign(draft.qualifiers.lot_overlay, field));
      expect(() => screenD([evidence], [recorded]), JSON.stringify(field)).toThrow(/Evidence authority failed validation/);
    }
    // A whole-parcel coverage claim on a partly covered lot still fails.
    expect(dLot(true, { lot: "part-high-outside-sra" }, (draft) => (draft.coverage = "whole_parcel")).status).toBe("unknown");
  });

  it("stays unknown when the overlay is unavailable or invalid", async () => {
    // No overlay inputs at all.
    for (const value of [true, false]) {
      const result = dLot(value, {}, () => {}, programAuthorityRegistries, null);
      expect(result.status, String(value)).toBe("unknown");
      expect(failureCodes(result)).toContain("lot_overlay_not_established");
    }
    const cases: Array<[string, BlockOptions, (draft: Draft) => void]> = [
      ["an invalid (self-crossing) lot geometry", { lot: "invalid-bow-tie" }, () => {}],
      ["a lot geometry in another CRS", { lot: "invalid-other-crs" }, () => {}],
      ["a lot geometry that was not supplied", {}, (draft) => (draft.qualifiers.lot_overlay.lot_geometry.file_id = "test-only-lot-unsupplied")],
      ["a lot geometry whose bytes differ", {}, (draft) => (draft.qualifiers.lot_overlay.lot_geometry.sha256 = "0".repeat(64))],
      ["no lot geometry", {}, (draft) => (draft.qualifiers.lot_overlay.lot_geometry = null)],
      ["no overlay", {}, (draft) => delete draft.qualifiers.lot_overlay],
      ["overlay not performed", {}, (draft) => (draft.qualifiers.lot_overlay.method = "not_performed")],
      ["no dataset", {}, (draft) => (draft.qualifiers.lot_overlay.dataset = null)],
      ["another dataset capture", {}, (draft) => (draft.qualifiers.lot_overlay.dataset.sha256_extracted = "0".repeat(64))],
      ["a parcel-number match", {}, (draft) => (draft.parcel_relationship.matched_by = "parcel_identifier")],
    ];
    for (const [name, options, change] of cases) {
      for (const value of [true, false]) {
        const result = dLot(value, options, change);
        expect(result.status, `${name} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${name} ${value}`).toContain("lot_overlay_not_established");
      }
    }
    // A view of another dataset, or an index the shipped pins do not name, never stands in for FHSZSRA_23_3.
    const synthetic = await syntheticLotOverlay({ source_id: DATASET_ID, sha256_extracted: "9".repeat(64) });
    expect(dLot(true, {}, () => {}, programAuthorityRegistries, { ...overlay.inputs, datasets: synthetic.inputs.datasets }).status).toBe("unknown");
    const repinned = { ...overlay.inputs, index_pins: [{ dataset: { source_id: DATASET_ID, sha256_extracted: datasetMetadata.sha256_extracted }, index_sha256: "8".repeat(64) }] };
    expect(failureCodes(dLot(true, {}, () => {}, programAuthorityRegistries, repinned))).toContain("lot_overlay_not_established");
    // A typed object is never accepted as a dataset view or a lot geometry.
    const typedView = { ...overlay.view, dataset: overlay.view.dataset, index_sha256: overlay.view.index_sha256 };
    expect(() => dLot(true, {}, () => {}, programAuthorityRegistries, { ...overlay.inputs, datasets: [typedView as never] })).toThrow(/typed values are never accepted/);
    const typedLot = { ...overlay.geometries["whole-high"] };
    expect(() => dLot(true, {}, () => {}, programAuthorityRegistries, { ...overlay.inputs, lot_geometries: [typedLot as never] })).toThrow(/typed values are never accepted/);
  });

  it("stays unknown when High is not a defined legend class for the lot", () => {
    for (const legend of ["no", "not_established"]) {
      const result = dLot(false, {}, (draft) => (draft.qualifiers.legend_defines_class_for_lot = legend));
      expect(result.status, legend).toBe("unknown");
      expect(failureCodes(result), legend).toContain("hazard_legend_class_not_defined");
    }
  });

  it("only downgrades: the gate never flips YES and NO, and every result it refuses is unknown", () => {
    for (const value of [true, false, null]) {
      for (const lot of REAL_LOT_NAMES) {
        for (const attested of ["yes", "no", "not_established"] as const) {
          const result = dLot(value, { lot, attested });
          if (value === true) expect(result.status).not.toBe("consistent_with_source");
          if (value === false) expect(result.status).not.toBe("disqualifying_per_source");
          if (value === null) expect(result.status).toBe("unknown");
          if (result.authority !== undefined && !result.authority.established) expect(result.status).toBe("unknown");
          const [within, classes] = expected[lot];
          const supports = within === "whole_lot" && (value === true ? classes.every((c) => c === "High") : !classes.includes("High"));
          expect(result.status, `${value} ${lot} ${attested}`).toBe(
            value === null || !supports ? "unknown" : value ? "disqualifying_per_source" : "consistent_with_source",
          );
        }
      }
    }
  });
});

/* ======================================================================== */

describe("3A. Rule to code: every other approved d condition, on the proposed d", () => {
  it("fails closed on legal-lot identity", () => {
    const changes: Array<[string, (draft: Draft) => void]> = [
      ["not established", (draft) => (draft.parcel_relationship.legal_lot_identity = "not_established")],
      ["parcel and legal lot differ", (draft) => (draft.parcel_relationship.legal_lot_identity = "parcel_and_legal_lot_differ")],
      ["tied or multiple lots", (draft) => (draft.parcel_relationship.legal_lot_identity = "tied_or_multiple_lots")],
      ["merger or resubdivision", (draft) => (draft.parcel_relationship.legal_lot_identity = "merger_or_resubdivision_pending_or_proposed")],
      ["no legal lot named", (draft) => (draft.parcel_relationship.legal_lot_reference = null)],
    ];
    for (const [name, change] of changes) {
      for (const value of [true, false]) {
        const result = dLot(value, {}, change);
        expect(result.status, `${name} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${name} ${value}`).toContain("legal_lot_identity_not_established");
      }
    }
  });

  it("is established only by PRC §4202: GOV §51178, another basis, or no basis never establishes d", () => {
    for (const basis of ["gov_51178", "other_basis", "not_established"]) {
      for (const value of [true, false]) {
        const result = dLot(value, { basis });
        expect(result.status, `${basis} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${basis} ${value}`).toContain("statutory_route_not_accepted");
      }
    }
  });

  it("requires CAL FIRE as the adopting agency and an adopted map", () => {
    expect(failureCodes(dLot(true, {}, (draft) => (draft.qualifiers.named_agency = "other_agency")))).toContain("statutory_agency_not_recorded");
    expect(failureCodes(dLot(true, {}, (draft) => (draft.qualifiers.named_agency = "not_established")))).toContain("statutory_agency_not_recorded");
    for (const status of ["not_adopted", "not_established"]) {
      expect(failureCodes(dLot(true, {}, (draft) => (draft.qualifiers.adoption_status = status))), status).toContain(
        "hazard_map_adoption_not_established",
      );
    }
  });

  it("reads the FHSZ_Descr label, never the numeric FHSZ code", async () => {
    const { header, entries } = parseOverlayIndex(inject("programScreenOverlayDataset").index_text as string);
    expect(header.class_field).toBe("FHSZ_Descr");
    expect([...new Set(entries.map((entry) => entry.label))].sort()).toEqual(["High", "Moderate", "Very High"]);
    expect(Object.keys(pack.overlay.class_labels).sort()).toEqual(["High", "Moderate", "Very High"]);
    expect(pack.overlay.class_field).toBe("FHSZ_Descr");
  });

  it("never lets a label the package does not map, such as a numeric code, support a value", async () => {
    // A TEST-ONLY copy of the shipped registries whose package overlays a TEST-ONLY dataset, where one feature is labelled "2".
    const syntheticPin = { source_id: "test-only-numeric-label-dataset", sha256_extracted: "7".repeat(64) };
    const synthetic = await syntheticLotOverlay(syntheticPin, "FHSZ_Descr");
    const registries = edited(programAuthorityRegistries, (draft) => {
      draft.sources[0].package.members.overlay_dataset = syntheticPin;
    });
    const run = (value: boolean, lot: "in-numeric-label" | "in-high" | "in-moderate") => {
      const evidence = record(`high-${value}`, HIGH, value);
      const authority = edited(block(evidence), (draft) => {
        draft.qualifiers.lot_overlay.dataset = syntheticPin;
        draft.qualifiers.lot_overlay.lot_geometry = synthetic.lots[lot];
      });
      return screenD([evidence], [authority], registries, promotedD(), synthetic.inputs);
    };
    expect(computeLotOverlay(synthetic.view, synthetic.geometries["in-numeric-label"])).toMatchObject({ lot_within_features: "whole_lot", classes_on_lot: ["2"] });
    for (const value of [true, false]) {
      expect(failureCodes(run(value, "in-numeric-label")), String(value)).toContain("lot_overlay_classes_do_not_support_value");
    }
    // The same TEST-ONLY dataset still supports its text labels, so the refusal is the label's alone.
    expect(run(true, "in-high").status).toBe("disqualifying_per_source");
    expect(run(false, "in-moderate").status).toBe("consistent_with_source");
  });

  it("treats responsibility area as context only", () => {
    for (const area of ["state", "local", "federal", "not_stated"]) {
      expect(dLot(true, {}, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe("disqualifying_per_source");
      expect(dLot(false, {}, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe("consistent_with_source");
    }
  });

  it("requires the registered source, its dated edition, its map capture, and human review of the block", () => {
    const cases: Array<[string, (draft: Draft) => void, string]> = [
      ["another source", (draft) => (draft.source_identifier.value = "lafd-lra-fhsz-recommended-2025"), "authority_source_not_registered"],
      ["another edition date", (draft) => (draft.edition.date = "2024-01-31"), "authority_source_not_registered"],
      ["no capture", (draft) => (draft.capture = null), "capture_not_verified"],
      ["another capture", (draft) => (draft.capture.sha256_extracted = "0".repeat(64)), "capture_not_verified"],
      ["another issuer", (draft) => (draft.issuer.issuer_id = "lafd"), "issuer_not_registered"],
      ["no issuer", (draft) => (draft.issuer.issuer_id = null), "issuer_not_registered"],
      ["an unreviewed block", (draft) => (draft.authority_review = { status: "unreviewed", reviewer: null, reviewed_on: null }), "authority_review_incomplete"],
      ["a block reviewed after the screen", (draft) => (draft.authority_review.reviewed_on = "2026-09-30"), "authority_review_incomplete"],
      ["a superseded edition", (draft) => (draft.edition.currency = "superseded"), "edition_not_current"],
      ["currency checked after the screen", (draft) => (draft.edition.currency_checked_on = "2026-09-30"), "edition_not_current"],
    ];
    for (const [name, change, code] of cases) {
      for (const value of [true, false]) {
        const result = dLot(value, {}, change);
        expect(result.status, `${name} ${value}`).toBe("unknown");
        expect(failureCodes(result), `${name} ${value}`).toContain(code);
      }
    }
  });

  it("never lets a ZIMAS/City display, GIS layer, or any other record kind establish d", () => {
    for (const kind of authorityRecordKinds.filter((candidate) => candidate !== "agency_hazard_map")) {
      for (const value of [true, false]) {
        const evidence = record(`${kind}-${value}`, HIGH, value, authorityRecordKindEvidenceTypes[kind as AuthorityRecordKind][0]);
        const authority = edited(block(evidence), (draft) => (draft.record_kind = kind));
        const result = screenD([evidence], [authority]);
        expect(result.status, `${kind} ${value}`).toBe("unknown");
        expect(failureCodes(result).some((code) => ["record_kind_not_establishing", "record_kind_prohibited_for_fact"].includes(code)), kind).toBe(
          true,
        );
      }
    }
  });

  it("does not manufacture conflict from non-qualifying evidence; Layer 1 still compares it", () => {
    for (const value of [true, false]) {
      const display = zimasDisplay(`zimas-${value}`, value);
      const alone = screenD([display.evidence], [display.authority]);
      expect(alone.status, `alone ${value}`).toBe("unknown");
      expect(failureCodes(alone)).toContain("record_kind_prohibited_for_fact");
      // Disagreeing with a package-backed record is a Layer 1 conflict, never a clearing NO or a YES.
      const other = record(`package-${!value}`, HIGH, !value);
      expect(screenD([display.evidence, other], [display.authority, block(other)]).status, `against ${!value}`).toBe("conflict");
      // Agreeing with it changes nothing: the package record alone establishes the value.
      const same = record(`package-${value}`, HIGH, value);
      expect(screenD([display.evidence, same], [display.authority, block(same)]).status).toBe(
        value ? "disqualifying_per_source" : "consistent_with_source",
      );
    }
  });
});

/* ======================================================================== */

describe("4. Authority package: d is established only through calfire-osfm's PRC §4202 package", () => {
  it("names one establishing path for the High fact: CAL FIRE / OSFM, the registered package, until superseded", () => {
    expect(programAuthorityRegistries.fact_policies[HIGH]).toMatchObject({
      family_policy: { family: "hazard_map", hazard_class: "high", require_legend_class: true },
      requires_legal_lot_identity: true,
      prohibited_establishing_kinds: ["city_parcel_display"],
      establishing: [
        {
          record_kind: "agency_hazard_map",
          identity: "registered_authority_source",
          issuer_ids: ["calfire-osfm"],
          authority_source_ids: [PACKAGE_ID],
          values: ["true", "false"],
          currency_max_age_days: "until_superseded",
        },
      ],
    });
    expect(registeredSource).toMatchObject({ issuer_id: "calfire-osfm", record_kind: "agency_hazard_map", superseded_by: null });
    expect(pack).toMatchObject({
      statutory_basis: "prc_4202",
      currency: "until_superseded",
      adoption: { status: "adopted", adoption_date: "2024-01-31", effective_date: "2024-04-01" },
      overlay: { dataset_name: "FHSZSRA_23_3", class_field: "FHSZ_Descr" },
    });
    expect(Object.keys(pack.overlay.class_labels).some((label) => /^\d+$/.test(label))).toBe(false);
  });

  it("keeps the overlay separate: its index is derived from the package's own dataset member, and pinned", () => {
    // The package proves what the dataset is; the overlay index only reads that exact dataset.
    const pin = overlayIndexPinFor(pack.members.overlay_dataset);
    expect(pin?.index_sha256).toBe(overlay.view.index_sha256);
    expect(overlay.view.dataset).toEqual(pack.members.overlay_dataset);
    expect([overlay.view.layer, overlay.view.crs_epsg, overlay.view.class_field]).toEqual([pack.overlay.dataset_name, 3310, pack.overlay.class_field]);
    // The index names the .shp, .shx, and .dbf bytes the pinned capture's manifest lists.
    const { header, entries } = parseOverlayIndex(inject("programScreenOverlayDataset").index_text as string);
    expect(header.members.archive).toBe(datasetMetadata.sha256_original);
    for (const [suffix, sha256] of Object.entries(header.members)) {
      if (suffix === "archive") continue; // Original ZIP identity, not a ZIP member.
      expect(datasetExtracted, suffix).toMatch(new RegExp(`^member FHSZSRA_23_3\\.${suffix} bytes \\d+ crc32 [0-9a-f]{8} sha256 ${sha256}$`, "m"));
    }
    expect(entries).toHaveLength(18423);
    expect(inject("programScreenOverlayDataset").error).toBeNull();
  });

  it("checks every package pin: manifest, members, and the registration are exactly as captured", async () => {
    expect(await sha256Hex(manifestRaw)).toBe(pack.manifest_sha256);
    expect(await authorityPackageIssues(manifestJson, packageCaptures())).toEqual([]);
    expect(authorityPackageRegistrationIssues(registeredSource, registeredIssuer, manifest, pack.manifest_sha256)).toEqual([]);
    const byteChecks = inject("programScreenOfficialCaptureByteChecks");
    for (const id of [MAP_ID, REGULATION_ID, DATASET_ID]) {
      expect(byteChecks[`${OFFICIAL_DIR}${id}`]?.issues, id).toEqual([]);
    }
    expect(pack.members).toEqual({
      adopted_map: { source_id: MAP_ID, sha256_extracted: mapMetadata.sha256_extracted },
      adopting_regulation: { source_id: REGULATION_ID, sha256_extracted: regulationMetadata.sha256_extracted },
      overlay_dataset: { source_id: DATASET_ID, sha256_extracted: datasetMetadata.sha256_extracted },
    });
  });
});

/* ======================================================================== */

describe("5. Promotion safety", () => {
  const breakages: Array<[string, (draft: Draft) => void, boolean]> = [
    // [gate that must then be unmet, registry change, whether the registry schema itself refuses the change]
    ["evidence_provenance_enforced_or_fails_closed", (draft) => (draft.fact_policies[HIGH].establishing = []), false],
    [
      "evidence_provenance_enforced_or_fails_closed",
      (draft) =>
        (draft.criterion_requirements[D] = {
          criterion_id: D,
          applicability: "not_applicable",
          reason: "TEST-ONLY",
          decision_ref: { phase: "3B", letter: "d" },
          promotion_gates: [...D_GATES],
        }),
      true,
    ],
    ["map_identity_and_edition_recorded", (draft) => (draft.fact_policies[HIGH].establishing[0].currency_max_age_days = null), true],
    ["map_identity_and_edition_recorded", (draft) => (draft.fact_policies[HIGH].establishing[0].identity = "recorded_instrument_identity"), true],
    ["statutory_route_recorded", (draft) => (draft.fact_policies[HIGH].establishing[0].record_kind = "generic_gis_layer"), true],
    ["prc_4202_map_coverage_and_legend_class_recorded", (draft) => (draft.fact_policies[HIGH].family_policy.require_legend_class = false), true],
    ["legal_lot_identity_fails_closed", (draft) => (draft.fact_policies[HIGH].requires_legal_lot_identity = false), true],
  ];

  it.each(breakages)("cannot promote d when %s is broken", (gate, change, schemaRefuses) => {
    const broken = edited(programAuthorityRegistries, change);
    if (schemaRefuses) expect(() => parseProgramAuthorityRegistries(broken)).toThrow();
    const candidate = promotedD();
    expect(authorityPromotionBlockers(candidate, broken, true)).toContain(gate);
    expect(criterionPromotionBlockers(candidate, broken)).toContain(gate);
    expect(criterionAwaitsHumanVerification(candidate, broken)).toBe(true);
    const { result, spy } = runWithSpy(candidate, broken);
    expect(result).toMatchObject({ status: "unreviewed", unreviewed_reasons: ["criterion_pending_human"] });
    expect(spy).not.toHaveBeenCalled();
  });

  it("cannot promote d without reviewer_confirms_encoded_rule: the record must cite the Phase 3B d decision", () => {
    const refs: Array<[string, ProgramCriterionHumanVerification["decision_ref"]]> = [
      ["no decision reference", undefined],
      ["the superseded Round 1 decision", { round: 1, letter: "d" }],
      ["the c decision", { phase: "3B", letter: "c" }],
      ["another phase", { phase: "3E", letter: "d" }],
    ];
    for (const [name, ref] of refs) {
      const base = promotedD();
      const human = { ...(base.human_verification as ProgramCriterionHumanVerification) };
      if (ref === undefined) delete human.decision_ref;
      else human.decision_ref = ref;
      const candidate = { ...base, human_verification: human };
      expect(hasCompleteHumanVerification(candidate), name).toBe(true);
      expect(authorityPromotionBlockers(candidate, programAuthorityRegistries, true), name).toEqual(["reviewer_confirms_encoded_rule"]);
      expect(criterionAwaitsHumanVerification(candidate), name).toBe(true);
      const { result, spy } = runWithSpy(candidate, programAuthorityRegistries);
      expect(result.status, name).toBe("unreviewed");
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("cannot promote d without a complete human verification record", () => {
    const candidate = promotedD();
    const record = candidate.human_verification as ProgramCriterionHumanVerification;
    const variants: Array<[string, ProgramCriterion]> = [
      ["no record", { ...candidate, human_verification: null }],
      ["the shared memo citation date, before the capture", { ...candidate, human_verification: { ...record, verified_at: "2026-09-17" } }],
      ["a record that does not match the citation", { ...candidate, human_verification: { ...record, next_review_at: "2026-10-20" } }],
      ["an AI-generated capture", { ...candidate, human_verification: { ...record, source_capture: { ...record.source_capture, is_ai_generated: true as false } } }],
      ["a statute as the rule's source", { ...candidate, human_verification: { ...record, source_capture: { ...record.source_capture, source_type: "statute" as "official_memo" } } }],
      ["a machine reviewer", { ...candidate, human_verification: { ...record, reviewer: { ...record.reviewer, kind: "ai" as "human" } } }],
    ];
    for (const [name, variant] of variants) {
      expect(programCriterionSchema.safeParse(variant).success, name).toBe(false);
      expect(hasCompleteHumanVerification(variant), name).toBe(false);
      expect(authorityPromotionBlockers(variant, programAuthorityRegistries, false), name).toContain("human_verification_record");
      expect(criterionAwaitsHumanVerification(variant), name).toBe(true);
      const { result, spy } = runWithSpy(variant, programAuthorityRegistries);
      expect(result.status, name).toBe("unreviewed");
      expect(spy).not.toHaveBeenCalled();
    }
    // A record that rests on the statute or the CAL FIRE map capture cannot support the rule either.
    expect(humanRecordCaptureIssues(record, { metadata: statuteMetadata, extracted: statuteExtracted }).length).toBeGreaterThan(0);
    expect(humanRecordCaptureIssues(record, { metadata: mapMetadata, extracted: mapExtracted }).length).toBeGreaterThan(0);
    // The record alone is not a promotion: without the encoded rule d must stay pending.
    const unencoded = { ...candidate, predicate: "not_encoded" as const };
    expect(programCriterionSchema.safeParse(unencoded).success).toBe(false);
    expect(runWithSpy(unencoded, programAuthorityRegistries).result.status).toBe("unreviewed");
    // Pending with a record is refused too.
    expect(programCriterionSchema.safeParse({ ...candidate, verification: "pending_human" }).success).toBe(false);
  });

  // Updated in Phase 3H: c is promoted on its own audited Phase 3B c record, never through d. The
  // behavior below still holds: d's NO never clears c, and c runs only as its own route-separated rule.
  it("promotes c only on its own record; d's NO never clears c", () => {
    const packs = withPromotedD();
    const c = packs.flatMap((entry) => entry.criteria).find((criterion) => criterion.id === C) as ProgramCriterion;
    expect(c).toMatchObject({ verification: "human_verified", human_verification: { decision_ref: { phase: "3B", letter: "c" } } });
    expect(authorityPromotionBlockers(prePromotionC(), programAuthorityRegistries, false)).toEqual(REVIEWER_GATES);
    const citation = c.citation;
    const cPromoted: ProgramCriterion = {
      ...c,
      predicate: proposedPredicate,
      question_if_judgment: PROPOSED_QUESTION_IF_JUDGMENT,
      citation: { ...citation, verified_at: PROPOSED_VERIFIED_AT, next_review_at: PROPOSED_NEXT_REVIEW_AT },
      verification: "human_verified",
      human_verification: {
        ...proposedRecord({ ...citation, verified_at: PROPOSED_VERIFIED_AT, next_review_at: PROPOSED_NEXT_REVIEW_AT }),
        decision_ref: { phase: "3B", letter: "c" },
      },
    };
    expect(hasCompleteHumanVerification(cPromoted)).toBe(true);
    expect(authorityPromotionBlockers(cPromoted, programAuthorityRegistries, true)).toEqual([]);
    expect(criterionAwaitsHumanVerification(c)).toBe(false);

    // A lot wholly in Very High: c's Route 2 YES stands on its own; d's NO never clears c.
    const vh = record("vh-true", VH, true);
    const high = record("high-false", HIGH, false);
    const result = evaluateProgramScreen({
      evidence_records: [...anchors(), vh, high],
      as_of: AS_OF,
      packs: [{ pathway: shraPathway, criteria: [parcelMatchCriterion("la_shra"), jurisdictionCriterion("la_shra"), c, promotedD()] }],
      evidence_authority: [block(vh, { lot: "whole-very-high" }), block(high, { lot: "whole-very-high" })],
      authority_registries: programAuthorityRegistries,
      lot_overlay: overlay.inputs,
    });
    const [, , cResult, dResult] = result.pathways[0].criteria;
    expect(cResult).toMatchObject({ criterion_id: C, status: "disqualifying_per_source", unreviewed_reasons: [] });
    expect(dResult).toMatchObject({ criterion_id: D, status: "consistent_with_source" });
    expect(result.pathways[0].rollup).not.toBe("no_disqualifier_found_in_reviewed_sources");
  });

  it("keeps e, f, and g exactly as blocked as before", () => {
    const packs = withPromotedD();
    for (const id of [E, F, G]) {
      const criterion = packs.flatMap((entry) => entry.criteria).find((candidate) => candidate.id === id) as ProgramCriterion;
      expect(criterion, id).toBe(shipped(id));
      expect(criterionPromotionBlockers(criterion), id).toEqual(criterionPromotionBlockers(shipped(id)));
      expect(criterionAwaitsHumanVerification(criterion), id).toBe(true);
    }
  });

  it("keeps the SHRA completeness blockers G1 and G2 open and unchanged", () => {
    expect(programPathwayCompletenessBlockers).toEqual([
      {
        id: "G1",
        key: "shra_a9a_ballot_measure_agricultural_land",
        pathway: "la_shra",
        statute_source_id: "gcs-66499-41",
        statute_pinpoint: "(a)(9)(A)",
        related_criterion_id: E,
        status: "open",
      },
      {
        id: "G2",
        key: "shra_a9h_hcp_and_other_resource_protection_plans",
        pathway: "la_shra",
        statute_source_id: "gcs-66499-41",
        statute_pinpoint: "(a)(9)(H)",
        related_criterion_id: F,
        status: "open",
      },
    ]);
  });

  it("changes nothing else on the fixture: every other criterion, fact, and roll-up is identical", () => {
    const before = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of, packs: withPromotedD(pendingD()) });
    const after = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    expect(after.facts).toEqual(before.facts);
    expect(after.screen_id).toBe(before.screen_id);
    expect(after.counts).toEqual(before.counts);
    for (const [index, pathway] of after.pathways.entries()) {
      const was = before.pathways[index];
      expect([pathway.rollup, pathway.decisive_criteria], pathway.pathway).toEqual([was.rollup, was.decisive_criteria]);
      for (const [position, criterion] of pathway.criteria.entries()) {
        if (criterion.criterion_id !== D) expect(criterion, criterion.criterion_id).toEqual(was.criteria[position]);
      }
    }
    const dBefore = before.pathways[0].criteria.find((criterion) => criterion.criterion_id === D);
    const dAfter = after.pathways[0].criteria.find((criterion) => criterion.criterion_id === D);
    // The fixture has no High record, so d stays unknown either way.
    expect([dBefore?.status, dAfter?.status]).toEqual(["unknown", "unknown"]);
    // The only release change: d's own pending_human_criterion blocker is gone.
    const dropped = before.release.blockers.filter((blocker) => !after.release.blockers.some((kept) => JSON.stringify(kept) === JSON.stringify(blocker)));
    expect(dropped).toEqual([{ code: "pending_human_criterion", pathway: "la_shra", ref: D, detail: "The criterion's rule awaits PermitPulse reviewer verification." }]);
    expect(after.release.blockers).toHaveLength(before.release.blockers.length - 1);
    expect(after.release.client_releasable).toBe(false);
  });

  it("breaks establishment when a pinned package member changes", async () => {
    const yes = () => {
      const evidence = record("high-true", HIGH, true);
      return [[evidence], [block(evidence)]] as const;
    };
    const [records, blocks] = yes();
    expect(screenD([...records], [...blocks]).status).toBe("disqualifying_per_source");

    // The adopted map: the registry pins it twice (the source's capture and the package member).
    // The shipped registry shares one pin object between the two, so each is replaced, not edited.
    const repin = (ref: Draft, sha: string) => ({ ...ref, sha256_extracted: sha });
    const otherMap = edited(programAuthorityRegistries, (draft) => {
      draft.sources[0].capture = repin(draft.sources[0].capture, "1".repeat(64));
      draft.sources[0].package.members.adopted_map = repin(draft.sources[0].package.members.adopted_map, "1".repeat(64));
    });
    const mapResult = screenD([...records], [...blocks], otherMap);
    expect(mapResult.status).toBe("unknown");
    expect(failureCodes(mapResult)).toContain("capture_not_verified");
    expect(authorityPackageRegistrationIssues(otherMap.sources[0], registeredIssuer, manifest, pack.manifest_sha256)).toContain("The adopted map pin differs.");
    const halfMap = edited(
      programAuthorityRegistries,
      (draft) => (draft.sources[0].package.members.adopted_map = repin(draft.sources[0].package.members.adopted_map, "1".repeat(64))),
    );
    expect(() => parseProgramAuthorityRegistries(halfMap)).toThrow(/The package's adopted map is the source's own capture/);

    // The overlay dataset.
    const otherDataset = edited(programAuthorityRegistries, (draft) => (draft.sources[0].package.members.overlay_dataset.sha256_extracted = "2".repeat(64)));
    const datasetResult = screenD([...records], [...blocks], otherDataset);
    expect(datasetResult.status).toBe("unknown");
    expect(failureCodes(datasetResult)).toContain("lot_overlay_not_established");
    expect(authorityPackageRegistrationIssues(otherDataset.sources[0], registeredIssuer, manifest, pack.manifest_sha256)).toContain(
      "The overlay dataset pin differs.",
    );

    // The adopting regulation and the manifest are checked at registration, over the shipped registries:
    // the evaluator never reads a capture or a manifest (Phase 3D).
    const otherRegulation = edited(registeredSource, (draft) => (draft.package.members.adopting_regulation.sha256_extracted = "3".repeat(64)));
    expect(authorityPackageRegistrationIssues(otherRegulation, registeredIssuer, manifest, pack.manifest_sha256)).toContain("The regulation pin differs.");
    const otherIssuerBasis = edited(registeredIssuer, (draft) => (draft.basis_capture.sha256_extracted = "3".repeat(64)));
    expect(authorityPackageRegistrationIssues(registeredSource, otherIssuerBasis, manifest, pack.manifest_sha256)).toContain(
      "The issuer's basis capture is not the package's regulation.",
    );
    const otherManifest = edited(registeredSource, (draft) => (draft.package.manifest_sha256 = "4".repeat(64)));
    expect(authorityPackageRegistrationIssues(otherManifest, registeredIssuer, manifest, pack.manifest_sha256)).toContain(
      "The registry does not pin this manifest.",
    );

    // A changed member capture fails the package closed.
    for (const id of [MAP_ID, REGULATION_ID, DATASET_ID]) {
      const changed = packageCaptures((captures) => {
        const capture = captures.get(id) as PackageCapture;
        captures.set(id, { metadata: capture.metadata, extracted: `${capture.extracted} ` });
      });
      expect(await authorityPackageIssues(manifestJson, changed), id).toContainEqual(expect.stringContaining("the extracted text does not match its pin"));
      const repinned = packageCaptures((captures) => {
        const capture = captures.get(id) as PackageCapture;
        captures.set(id, { metadata: { ...capture.metadata, sha256_extracted: "5".repeat(64) } as OfficialSourceMetadata, extracted: capture.extracted });
      });
      expect(await authorityPackageIssues(manifestJson, repinned), id).toContainEqual(expect.stringContaining("does not pin"));
      const missing = packageCaptures((captures) => captures.delete(id));
      expect(await authorityPackageIssues(manifestJson, missing), id).toContain("The package lacks a member; it fails closed.");
    }
  });

  it("fails closed once the authority source is superseded", () => {
    const superseded = edited(programAuthorityRegistries, (draft) => {
      draft.sources.push({ ...structuredClone(draft.sources[0]), authority_source_id: "calfire-sra-fhsz-later-edition" });
      draft.sources[0].superseded_by = "calfire-sra-fhsz-later-edition";
    });
    expect(() => parseProgramAuthorityRegistries(superseded)).not.toThrow();
    for (const value of [true, false]) {
      const result = dLot(value, {}, () => {}, superseded);
      expect(result.status, String(value)).toBe("unknown");
      expect(failureCodes(result), String(value)).toContain("authority_source_not_registered");
    }
    // The package is current until superseded: no age window, but never past the screen date.
    expect(dLot(true, {}, (draft) => (draft.edition.currency_checked_on = "2024-04-01")).status).toBe("disqualifying_per_source");
  });
});

/* ======================================================================== */

describe("6. The Phase 3E record", () => {
  it("preserves the Phase 3E pins and documents the Phase 3H topology replacement", () => {
    expect(overlayIndexPins.filter(pin => pin.dataset.source_id === pack.members.overlay_dataset.source_id)).toEqual([{ dataset: pack.members.overlay_dataset, index_sha256: overlay.view.index_sha256 }]);
    const { header } = parseOverlayIndex(inject("programScreenOverlayDataset").index_text as string);
    expect(phase3eDoc).toContain("caf01fa68e68b3c368538067f504e6f16ccdf7fdeb91f644114d7c86494589ff");
    expect(phase3hDoc).toContain(overlay.view.index_sha256);
    for (const text of [
      pack.members.overlay_dataset.sha256_extracted,
      header.members.shp,
      header.members.shx,
      header.members.dbf,
      EVALUATOR_OUTPUT_SHA256,
      PUBLIC_DEMO_OUTPUT_SHA256,
      PROMOTED_EVALUATOR_OUTPUT_SHA256,
      PROMOTED_PUBLIC_DEMO_OUTPUT_SHA256,
      "APPROVE D PROMOTION",
      "lot_within_features",
      "KEEP D PENDING",
    ]) {
      expect(phase3eDoc, text).toContain(text);
    }
  });
});
