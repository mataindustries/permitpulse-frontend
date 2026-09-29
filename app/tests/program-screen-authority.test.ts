import { describe, expect, it, vi } from "vitest";
import designDoc from "../../docs/PROGRAM_SCREEN_EVIDENCE_AUTHORITY.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import rereviewJson from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json";
import decisionsJson from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json";
import shraMemoText from "../fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt?raw";
import testOnlyCapture from "../fixtures/program-screen/test-only-sources/test-only-adopted-ordinance-000001/metadata.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import { shraMemoSingleFamilyZones } from "../src/shared/program-screen/authority-gate";
import {
  blockOnlyAuthorityFacts,
  parseProgramAuthorityRegistries,
  pinnedProhibitedEstablishingKinds,
  programAuthorityRegistries,
  type ProgramAuthorityRegistries,
  type ProgramCriterionAuthorityRequirement,
  type ProgramFactAuthorityPolicy,
} from "../src/shared/program-screen/authority-policy";
import { jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { shraPathway } from "../src/shared/program-screen/criteria/shra";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import {
  authorityFactProfiles,
  authorityRecordFailureCodes,
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  criterionAwaitsHumanVerification,
  criterionPromotionBlockers,
  hasCompleteHumanVerification,
} from "../src/shared/program-screen/schema";
import { excerptAppearsInCapture, sha256Hex } from "../src/shared/program-screen/source-capture";
import {
  humanVerificationRequiredCriterionIds,
  type CriterionPredicate,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramCriterionResult,
  type ProgramDecisionRef,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";

/**
 * Phase 2: evidence authority and provenance infrastructure.
 *
 * Every registry ships deny-by-default, so nothing here promotes a criterion
 * or changes production output. The gate is exercised through TEST-ONLY
 * synthetic criteria and TEST-ONLY registries passed like `packs`. Every
 * agency, map, plan, and instrument below is fictional.
 */

const AS_OF = "2026-09-27";
const RETRIEVED_AT = "2026-09-18T12:00:00.000Z";
const REVIEWED_ON = "2026-09-20";
const EDITION_DATE = "2026-01-15";
const SUBJECT = {
  case_id: "case-fictional-authority-test",
  property_id: "property-fictional-authority-test",
};
const VH: ProgramFactKey = "very-high-fire-hazard-severity-zone";
const HIGH: ProgramFactKey = "high-fire-hazard-severity-zone";
const REVIEWER = { kind: "human", name: "TEST-ONLY Reviewer", role: "Synthetic reviewer" } as const;
const TEST_CAPTURE = { source_id: testOnlyCapture.source_id, sha256_extracted: testOnlyCapture.sha256_extracted };

const ROUND_1_LETTERS: Readonly<Record<string, string>> = Object.fromEntries(
  decisionsJson.decisions.map((entry) => [entry.criterion_id, entry.letter]),
);
/** Phase 3C: c-g point at the Phase 3B decision that superseded Round 1. */
const PHASE_3B_GATES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  rereviewJson.decisions.map((entry) => [entry.criterion_id, entry.promotion_gates]),
);
const refToken = (ref: { round?: number; phase?: string; letter: string }) =>
  ref.phase === undefined ? `${ref.round}${ref.letter}` : `${ref.phase}${ref.letter}`;

/* ------------------------------------------------------------ evidence */

function record(
  id: string,
  key: ProgramFactKey,
  value: boolean | string | number | null,
  options: {
    evidenceType?: CanonicalEvidenceRecord["evidence_type"];
    agency?: string;
    authority?: CanonicalEvidenceRecord["source"]["authority"];
  } = {},
): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const unit = spec.value.kind === "number" ? spec.value.unit : null;
  const known = value !== null;
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: options.agency ?? "TEST-ONLY fictional agency",
      title: `TEST-ONLY ${key} record`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/authority-tests/${id}`,
      authority: options.authority ?? "official",
      retrieved_at: RETRIEVED_AT,
    },
    raw_observed_value: !known
      ? { kind: "not_observed", value: null }
      : typeof value === "number"
        ? { kind: "number", value, unit }
        : typeof value === "boolean"
          ? { kind: "text", value: value ? "YES" : "NO" }
          : { kind: "text", value },
    normalized_value: !known
      ? { kind: "unknown", value: null, reason: "insufficient_evidence" }
      : typeof value === "number"
        ? { kind: "number", value, unit }
        : typeof value === "boolean"
          ? { kind: "boolean", value }
          : { kind: "text", value },
    evidence_type: options.evidenceType ?? "official_map",
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
  return [
    record("anchor-parcel-match", "parcel-match", true, { evidenceType: "official_portal" }),
    record("anchor-jurisdiction", "jurisdiction", "City of Los Angeles", { evidenceType: "official_portal" }),
  ];
}

/** ZIMAS-like City display: official, but never an establishing record for a gated fact. */
function zimas(id: string, key: ProgramFactKey, value: boolean): CanonicalEvidenceRecord {
  return record(id, key, value, { evidenceType: "official_portal", agency: "TEST-ONLY City parcel display" });
}

/* ------------------------------------------------------ authority blocks */

interface FactSetup {
  kind: ProgramEvidenceAuthority["record_kind"];
  evidenceType: CanonicalEvidenceRecord["evidence_type"];
  issuer: string;
  source: string | null;
}

const factSetup: Partial<Record<ProgramFactKey, FactSetup>> = {
  "lot-area": { kind: "legal_lot_record", evidenceType: "official_document", issuer: "test-only-recorder", source: "test-only-legal-lot-record" },
  "shra-zone-category": { kind: "city_zoning_record", evidenceType: "official_map", issuer: "test-only-zoning-office", source: "test-only-zoning-map" },
  "zoning-code-chapter": { kind: "city_zoning_record", evidenceType: "official_map", issuer: "test-only-zoning-office", source: "test-only-zoning-map" },
  "prior-shra-or-sb9-map": { kind: "recorded_subdivision_map", evidenceType: "official_map", issuer: "test-only-recorder", source: null },
  [VH]: { kind: "agency_hazard_map", evidenceType: "official_map", issuer: "test-only-hazard-agency", source: "test-only-hazard-map" },
  [HIGH]: { kind: "agency_hazard_map", evidenceType: "official_map", issuer: "test-only-hazard-agency", source: "test-only-hazard-map" },
  "prime-or-statewide-farmland": { kind: "other_secondary", evidenceType: "official_map", issuer: "test-only-hazard-agency", source: null },
  "nccp-conservation-land": { kind: "adopted_plan_document", evidenceType: "official_document", issuer: "test-only-plan-agency", source: "test-only-nccp-plan" },
  "conservation-easement": { kind: "recorded_instrument", evidenceType: "official_document", issuer: "test-only-recorder", source: null },
  "sb79-permanent-exemption-shown": { kind: "director_issued_map", evidenceType: "official_document", issuer: "test-only-planning-director", source: "test-only-director-map" },
};

function setupFor(key: ProgramFactKey): FactSetup {
  const setup = factSetup[key];
  if (setup === undefined) throw new Error(`No TEST-ONLY setup for ${key}`);
  return setup;
}

/** A reviewed record of the kind a TEST-ONLY policy would accept for `key`. */
function authoritativeRecord(id: string, key: ProgramFactKey, value: boolean | string | number | null) {
  return record(id, key, value, { evidenceType: setupFor(key).evidenceType });
}

const mapsFor: Record<string, unknown[]> = {
  shra_map_recorded: [
    { map_reference: "TEST-ONLY PM 1", stage: "final", recording: "recorded", statute_basis: "shra", relation: "screened_lot_recorded_pursuant" },
  ],
  sb9_map_recorded: [
    { map_reference: "TEST-ONLY PM 2", stage: "final", recording: "recorded", statute_basis: "sb9_2021", relation: "screened_lot_recorded_pursuant" },
  ],
  other_basis_map_recorded: [
    { map_reference: "TEST-ONLY TR 3", stage: "final", recording: "recorded", statute_basis: "other_statute", relation: "screened_lot_recorded_pursuant" },
  ],
  no_map_recorded: [],
  shra_or_sb9_tentative_map_not_recorded: [
    { map_reference: "TEST-ONLY TPM 4", stage: "tentative", recording: "never_recorded", statute_basis: "shra", relation: "screened_lot_recorded_pursuant" },
  ],
};

function qualifiersFor(key: ProgramFactKey, value: CanonicalEvidenceRecord["normalized_value"]): unknown {
  const family = authorityFactProfiles[key].qualifier_family;
  switch (family) {
    case "lot_area":
      return {
        family,
        as_recorded: { figure: value.kind === "number" ? String(value.value) : "1", unit: "sq_ft" },
        area_basis: "recorded_legal_lot_area",
        area_precision: "exact",
      };
    case "zone_record": {
      const listed = value.kind === "text" && value.value === "single_family_listed_zone";
      const notListed = value.kind === "text" && value.value === "zone_not_on_single_family_list";
      return {
        family,
        base_zone_as_recorded: listed ? "R1" : "C2",
        zone_match: listed ? "listed_zone_exact" : notListed ? "not_on_list" : "not_established",
      };
    }
    case "map_history": {
      const token = value.kind === "text" ? value.value : "no_map_recorded";
      const maps = mapsFor[token] ?? [];
      const shraOrSb9 = token === "shra_map_recorded" || token === "sb9_map_recorded" || token.startsWith("shra_or_sb9");
      return {
        family,
        search: {
          scope: "complete_reviewed_history",
          repositories_searched: ["test-only-county-maps", "test-only-city-cases"],
          searched_on: REVIEWED_ON,
        },
        maps,
        lineage_changed_after_shra_or_sb9_map: shraOrSb9 ? "no" : "not_applicable",
      };
    }
    case "hazard_map":
      // Phase 3C: a PRC §4202 map named as CAL FIRE's, keyed to the lot, not a responsibility area.
      return {
        family,
        hazard_class: authorityFactProfiles[key].hazard_class,
        statutory_basis: "prc_4202",
        adoption_status: "adopted",
        named_agency: "department_of_forestry_and_fire_protection",
        map_covers_lot: "yes",
        legend_defines_class_for_lot: "yes",
        responsibility_area_as_stated: "local",
      };
    case "farmland_map":
      return {
        family,
        map_program: "farmland_mapping_and_monitoring_program",
        designation_class: value.kind === "boolean" && !value.value ? "other_or_none" : "prime_farmland",
        usda_criteria_documentation: TEST_CAPTURE,
      };
    case "adopted_plan":
      return {
        family,
        plan_identifier: "TEST-ONLY NCCP",
        plan_type: "natural_community_conservation_plan",
        statutory_basis: "fish_and_game_code_2800_et_seq",
        adoption_status: "adopted_in_effect",
        adoption_reference: "TEST-ONLY Resolution 1",
        adoption_date: "2020-01-01",
        status_checked_on: REVIEWED_ON,
        map_or_text_reference: "TEST-ONLY Figure 1",
        identification_basis: "explicit_plan_language_or_map",
      };
    case "recorded_instrument":
      return {
        family,
        document_number: "TEST-ONLY-DOC-0001",
        recording_date: "2015-06-01",
        instrument_character: "expressly_conservation_easement",
        in_force: "no_release_or_extinguishment_of_record",
        release_search: {
          scope: "complete_reviewed_history",
          repositories_searched: ["test-only-county-recorder"],
          searched_on: REVIEWED_ON,
        },
      };
    case null:
      return null;
  }
}

/** A complete, reviewed block that a TEST-ONLY policy would accept. */
function completeBlock(source: CanonicalEvidenceRecord): ProgramEvidenceAuthority {
  const key = source.claim.key as ProgramFactKey;
  const setup = setupFor(key);
  const profile = authorityFactProfiles[key];
  const value = source.normalized_value;
  const coverage =
    profile.coverage_semantics === "not_applicable"
      ? "not_applicable"
      : value.kind === "boolean"
        ? value.value
          ? "whole_parcel"
          : "none_of_parcel"
        : "partial_parcel";
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION,
    evidence_id: source.id,
    fact_key: key,
    record_kind: setup.kind,
    issuer: { name: "TEST-ONLY issuing office", issuer_id: setup.issuer },
    source_identifier:
      setup.source === null
        ? { scheme: "recorder_document_number", value: "TEST-ONLY-DOC-0001" }
        : { scheme: "authority_source_id", value: setup.source },
    document_title: "TEST-ONLY authoritative record",
    edition: {
      label: "TEST-ONLY edition",
      date: EDITION_DATE,
      date_kind: "effective",
      currency: "current_on_as_of",
      currency_checked_on: REVIEWED_ON,
    },
    retrieved_at: source.source.retrieved_at,
    source_url: source.source.url,
    capture: { store: "repo_official_source", ...TEST_CAPTURE },
    parcel_relationship: {
      matched_by: "parcel_identifier",
      parcel_identifier: "TEST-ONLY-APN-0000",
      legal_lot_reference: "TEST-ONLY Tract 1, Lot 1",
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage,
    qualifiers: qualifiersFor(key, value) as ProgramEvidenceAuthority["qualifiers"],
    authority_review: { status: "reviewed", reviewer: REVIEWER, reviewed_on: REVIEWED_ON },
    notes: ["TEST-ONLY fictional authority block."],
    is_ai_generated: false,
  };
}

/** A reviewed block that honestly describes a City display. */
function displayBlock(source: CanonicalEvidenceRecord): ProgramEvidenceAuthority {
  const block = completeBlock(authoritativeRecord(source.id, source.claim.key as ProgramFactKey, true));
  return {
    ...block,
    record_kind: "city_parcel_display",
    issuer: { name: "TEST-ONLY City display", issuer_id: null },
    source_identifier: { scheme: "portal_url_only", value: "TEST-ONLY display" },
    capture: null,
    coverage: source.normalized_value.kind === "boolean" && !source.normalized_value.value ? "none_of_parcel" : "whole_parcel",
    retrieved_at: source.source.retrieved_at,
    source_url: source.source.url,
  };
}

function edit(block: ProgramEvidenceAuthority, change: (draft: Record<string, any>) => void): ProgramEvidenceAuthority {
  const draft = structuredClone(block) as Record<string, any>;
  change(draft);
  return draft as ProgramEvidenceAuthority;
}

/* ------------------------------------------------------------ registries */

const review = { reviewer: REVIEWER, reviewed_on: REVIEWED_ON, decision_ref: null };
const issuer = (id: string) => ({ issuer_id: id, name: `TEST-ONLY ${id}`, basis_capture: TEST_CAPTURE, review });
const source = (id: string, kind: ProgramEvidenceAuthority["record_kind"], issuerId: string, facts: ProgramFactKey[]) => ({
  authority_source_id: id,
  record_kind: kind,
  issuer_id: issuerId,
  title: `TEST-ONLY ${id}`,
  edition: { label: "TEST-ONLY edition", date: EDITION_DATE, date_kind: "effective" as const },
  capture: TEST_CAPTURE,
  fact_keys: facts,
  superseded_by: null,
  review,
});

function policy(
  factKey: ProgramFactKey,
  familyPolicy: ProgramFactAuthorityPolicy["family_policy"],
  establishing: ProgramFactAuthorityPolicy["establishing"],
  requiresLegalLotIdentity = false,
): ProgramFactAuthorityPolicy {
  return {
    fact_key: factKey,
    family_policy: familyPolicy,
    requires_legal_lot_identity: requiresLegalLotIdentity,
    establishing,
    prohibited_establishing_kinds: pinnedProhibitedEstablishingKinds[factKey] ?? [],
    decision_refs: [],
  };
}

const viaSource = (
  kind: ProgramEvidenceAuthority["record_kind"],
  issuerId: string,
  sourceId: string,
  values: string[],
) => ({ record_kind: kind, identity: "registered_authority_source" as const, issuer_ids: [issuerId], authority_source_ids: [sourceId], values, currency_max_age_days: 90 });
const viaInstrument = (kind: ProgramEvidenceAuthority["record_kind"], values: string[]) => ({
  record_kind: kind,
  identity: "recorded_instrument_identity" as const,
  issuer_ids: ["test-only-recorder"],
  authority_source_ids: [],
  values,
  currency_max_age_days: null,
});

function enforcedRequirement(
  criterionId: string,
  extra: Partial<Extract<ProgramCriterionAuthorityRequirement, { applicability: "enforced" }>> = {},
): ProgramCriterionAuthorityRequirement {
  return {
    criterion_id: criterionId,
    applicability: "enforced",
    decision_ref: { round: 99, letter: "z" },
    promotion_gates: ["reviewer_confirms_encoded_rule", "human_verification_record"],
    scope_preconditions: [],
    numeric_boundaries: [],
    ...extra,
  };
}

/** TEST-ONLY registries in which fictional authorities can establish every family. */
function testRegistries(requirements: Record<string, ProgramCriterionAuthorityRequirement> = {}): ProgramAuthorityRegistries {
  return {
    issuers: [
      issuer("test-only-recorder"),
      issuer("test-only-zoning-office"),
      issuer("test-only-hazard-agency"),
      issuer("test-only-plan-agency"),
      issuer("test-only-planning-director"),
    ],
    sources: [
      source("test-only-legal-lot-record", "legal_lot_record", "test-only-recorder", ["lot-area"]),
      source("test-only-zoning-map", "city_zoning_record", "test-only-zoning-office", ["shra-zone-category", "zoning-code-chapter"]),
      source("test-only-hazard-map", "agency_hazard_map", "test-only-hazard-agency", [VH, HIGH]),
      source("test-only-nccp-plan", "adopted_plan_document", "test-only-plan-agency", ["nccp-conservation-land"]),
      source("test-only-director-map", "director_issued_map", "test-only-planning-director", ["sb79-permanent-exemption-shown"]),
    ],
    fact_policies: {
      "lot-area": policy("lot-area", { family: "lot_area", accepted_area_bases: ["recorded_legal_lot_area"] }, [
        viaSource("legal_lot_record", "test-only-recorder", "test-only-legal-lot-record", ["number"]),
      ], true),
      "shra-zone-category": policy("shra-zone-category", { family: "zone_record" }, [
        viaSource("city_zoning_record", "test-only-zoning-office", "test-only-zoning-map", ["single_family_listed_zone", "zone_not_on_single_family_list"]),
      ]),
      "zoning-code-chapter": policy("zoning-code-chapter", null, [
        viaSource("city_zoning_record", "test-only-zoning-office", "test-only-zoning-map", ["Chapter 1", "Chapter 1A"]),
      ]),
      "prior-shra-or-sb9-map": policy(
        "prior-shra-or-sb9-map",
        { family: "map_history", required_search_repositories: ["test-only-county-maps", "test-only-city-cases"], search_max_age_days: 90 },
        [viaInstrument("recorded_subdivision_map", Object.keys(mapsFor))],
        true,
      ),
      // Phase 3C: every c-g policy requires legal-lot identity.
      [VH]: policy(VH, { family: "hazard_map", hazard_class: "very_high", require_legend_class: false }, [
        viaSource("agency_hazard_map", "test-only-hazard-agency", "test-only-hazard-map", ["true", "false"]),
      ], true),
      [HIGH]: policy(HIGH, { family: "hazard_map", hazard_class: "high", require_legend_class: true }, [
        viaSource("agency_hazard_map", "test-only-hazard-agency", "test-only-hazard-map", ["true", "false"]),
      ], true),
      "nccp-conservation-land": policy("nccp-conservation-land", { family: "adopted_plan" }, [
        viaSource("adopted_plan_document", "test-only-plan-agency", "test-only-nccp-plan", ["true"]),
      ], true),
      "conservation-easement": policy(
        "conservation-easement",
        { family: "recorded_instrument", required_release_search_repositories: ["test-only-county-recorder"] },
        [viaInstrument("recorded_instrument", ["true"])],
        true,
      ),
    },
    criterion_requirements: requirements,
  };
}

/** The shipped deny-by-default registries, plus one requirement for a TEST-ONLY criterion. */
function shippedRegistriesWith(requirement: ProgramCriterionAuthorityRequirement): ProgramAuthorityRegistries {
  return {
    ...programAuthorityRegistries,
    criterion_requirements: { ...programAuthorityRegistries.criterion_requirements, [requirement.criterion_id]: requirement },
  };
}

/* ------------------------------------------------------------ criteria */

function genericPredicate(key: ProgramFactKey): CriterionPredicate {
  return (facts) => {
    const value = facts[key];
    if (value?.kind === "boolean") return value.value ? "disqualifying_per_source" : "consistent_with_source";
    if (value?.kind === "number") return value.value < 65_340 ? "consistent_with_source" : "disqualifying_per_source";
    return "consistent_with_source";
  };
}

/** TEST-ONLY synthetic criterion: repo_sourced so it runs, outside the 46 atomic criteria. */
function syntheticCriterion(
  id: string,
  factKeys: ProgramFactKey[],
  predicate: ProgramCriterion["predicate"] = genericPredicate(factKeys[0]),
): ProgramCriterion {
  return {
    id,
    pathway: "la_shra",
    label: "TEST-ONLY synthetic authority criterion",
    gating: false,
    fact_keys: factKeys,
    predicate,
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "TEST-ONLY synthetic rule used to exercise the evidence-authority gate.",
    citation: {
      title: "TEST-ONLY synthetic citation",
      url: "https://records.example.test/authority-tests/citation",
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
  };
}

function packFor(criterion: ProgramCriterion): ProgramPathwayPack {
  return { pathway: shraPathway, criteria: [parcelMatchCriterion("la_shra"), jurisdictionCriterion("la_shra"), criterion] };
}

function screen(
  criterion: ProgramCriterion,
  records: CanonicalEvidenceRecord[],
  options: { blocks?: unknown; registries?: ProgramAuthorityRegistries } = {},
) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchors(), ...records],
    as_of: AS_OF,
    packs: [packFor(criterion)],
    evidence_authority: options.blocks,
    authority_registries: options.registries,
  });
  return { result, pathway: result.pathways[0], criterion: result.pathways[0].criteria[2] };
}

const VH_ID = "la_shra.test-only-authority-vh";
const vhCriterion = (predicate?: ProgramCriterion["predicate"]) => syntheticCriterion(VH_ID, [VH], predicate);
const vhRegistries = () => testRegistries({ [VH_ID]: enforcedRequirement(VH_ID) });

function expectCode(action: () => unknown, code: string): void {
  let caught: unknown = null;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(IntegrityValidationError);
  expect(caught).toMatchObject({ code });
}

function nonEstablishingCodes(result: ProgramCriterionResult): string[] {
  return (result.authority?.facts ?? []).flatMap((fact) => fact.non_establishing.flatMap((entry) => entry.failures));
}

/* ======================================================================== */

describe("1. Legacy evidence and deny-by-default registries", () => {
  it("does not throw for legacy evidence with no authority block, and a gated executable criterion becomes unknown", () => {
    const spy = vi.fn(genericPredicate(VH));
    const records = [authoritativeRecord("vh-map", VH, true)];
    for (const blocks of [undefined, []]) {
      const { criterion, pathway } = screen(vhCriterion(spy), records, { blocks, registries: vhRegistries() });
      expect(criterion.status).toBe("unknown");
      expect(criterion.classification).toBe("unknown");
      expect(criterion.authority).toEqual({
        established: false,
        facts: [
          {
            key: VH,
            established: false,
            establishing_evidence_ids: [],
            non_establishing: [{ evidence_id: "vh-map", failures: ["no_authority_block"] }],
            failures: ["no_establishing_record"],
          },
        ],
        criterion_failures: [],
      });
      expect(criterion.statement).toContain("This criterion stays unknown.");
      expect(criterion.statement).toContain("missing authority is not treated as a no");
      expect(pathway.rollup).toBe("undetermined");
      expect(pathway.planning_questions.find((question) => question.criterion_ids.includes(VH_ID))?.trigger).toBe("unknown");
      expect(pathway.review_tasks.map((task) => task.kind)).toContain("review_evidence_authority");
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("leaves a criterion without an authority requirement on the legacy path", () => {
    const { criterion } = screen(vhCriterion(), [authoritativeRecord("vh-map", VH, true)]);
    expect(criterion.status).toBe("disqualifying_per_source");
    expect("authority" in criterion).toBe(false);
  });

  it("ships registries that cannot establish anything", () => {
    expect(programAuthorityRegistries.issuers).toEqual([]);
    expect(programAuthorityRegistries.sources).toEqual([]);
    for (const [key, entry] of Object.entries(programAuthorityRegistries.fact_policies)) {
      expect(entry?.establishing, key).toEqual([]);
    }
    expect(parseProgramAuthorityRegistries(programAuthorityRegistries)).toBe(programAuthorityRegistries);
  });

  it("cannot establish any gated fact from a complete, reviewed block under the shipped registries", () => {
    const values: Partial<Record<ProgramFactKey, boolean | string | number>> = {
      "lot-area": 7405.2,
      "shra-zone-category": "single_family_listed_zone",
      "zoning-code-chapter": "Chapter 1",
      "prior-shra-or-sb9-map": "no_map_recorded",
      [VH]: true,
      [HIGH]: false,
      "prime-or-statewide-farmland": true,
      "nccp-conservation-land": true,
      "conservation-easement": true,
      "sb79-permanent-exemption-shown": true,
    };
    const keys = Object.keys(programAuthorityRegistries.fact_policies) as ProgramFactKey[];
    expect(keys.sort()).toEqual(Object.keys(values).sort());
    for (const key of keys) {
      const id = `la_shra.test-only-deny-${key}`;
      const spy = vi.fn(genericPredicate(key));
      const evidence = authoritativeRecord(`auth-${key}`, key, values[key] as boolean | string | number);
      const { criterion } = screen(syntheticCriterion(id, [key], spy), [evidence], {
        blocks: [completeBlock(evidence)],
        registries: shippedRegistriesWith(enforcedRequirement(id)),
      });
      expect(criterion.status, key).toBe("unknown");
      expect(criterion.authority?.facts[0].failures, key).toEqual(["no_establishing_entries", "no_establishing_record"]);
      expect(nonEstablishingCodes(criterion), key).toContain("record_kind_not_establishing");
      expect(spy, key).not.toHaveBeenCalled();
    }
  });

  it("does not let a declared record kind authorize itself", () => {
    const evidence = authoritativeRecord("vh-map", VH, true);
    const block = completeBlock(evidence);
    const run = (candidate: ProgramEvidenceAuthority, registries = vhRegistries()) =>
      screen(vhCriterion(), [evidence], { blocks: [candidate], registries }).criterion;

    // Positive control: the same block against a TEST-ONLY registry that lists it.
    expect(run(block)).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });

    const cases: Array<[string, ProgramEvidenceAuthority, ProgramAuthorityRegistries, string]> = [
      ["the shipped registries", block, shippedRegistriesWith(enforcedRequirement(VH_ID)), "record_kind_not_establishing"],
      ["an unregistered issuer", edit(block, (draft) => (draft.issuer.issuer_id = "test-only-unknown-agency")), vhRegistries(), "issuer_not_registered"],
      ["an unregistered source", edit(block, (draft) => (draft.source_identifier.value = "test-only-unlisted-map")), vhRegistries(), "authority_source_not_registered"],
      ["a different edition", edit(block, (draft) => (draft.edition.date = "2025-01-15")), vhRegistries(), "authority_source_not_registered"],
      ["an unlisted kind", edit(block, (draft) => (draft.record_kind = "director_issued_map")), vhRegistries(), "record_kind_not_establishing"],
      ["a capture that does not match the source", edit(block, (draft) => (draft.capture.sha256_extracted = "0".repeat(64))), vhRegistries(), "capture_not_verified"],
      ["a case-store capture", edit(block, (draft) => (draft.capture = { store: "case_evidence_file", file_id: "TEST-ONLY-FILE", sha256: "1".repeat(64) })), vhRegistries(), "capture_not_verified"],
    ];
    for (const [name, candidate, registries, code] of cases) {
      const result = run(candidate, registries);
      expect(result.status, name).toBe("unknown");
      expect(nonEstablishingCodes(result), name).toContain(code);
    }
  });
});

/* ======================================================================== */

describe("2. Malformed supplied authority metadata throws", () => {
  const vhTrue = authoritativeRecord("vh-map", VH, true);
  const vhFalse = authoritativeRecord("vh-map-no", VH, false);
  const highTrue = authoritativeRecord("high-map", HIGH, true);
  const lot = authoritativeRecord("lot", "lot-area", 7405.2);
  const zone = authoritativeRecord("zone", "shra-zone-category", "single_family_listed_zone");
  const all = [vhTrue, vhFalse, highTrue, lot, zone];
  const base = completeBlock(vhTrue);

  const cases: Array<[string, unknown]> = [
    ["a sidecar that is not a list", { [vhTrue.id]: base }],
    ["a missing field", [edit(base, (draft) => delete draft.notes)]],
    ["an extra field declaring itself authoritative", [edit(base, (draft) => (draft.authoritative = true))]],
    ["an AI-generated block", [edit(base, (draft) => (draft.is_ai_generated = true))]],
    ["an AI reviewer", [edit(base, (draft) => (draft.authority_review.reviewer = { kind: "ai", name: "Model", role: "Reviewer" }))]],
    ["two blocks for one record", [base, base]],
    ["a block for a record that was not supplied", [edit(base, (draft) => (draft.evidence_id = "not-supplied"))]],
    ["a fact key that differs from the record", [edit(base, (draft) => (draft.fact_key = HIGH))]],
    ["a retrieval time that differs from the record", [edit(base, (draft) => (draft.retrieved_at = "2026-09-19T12:00:00.000Z"))]],
    ["a source URL that differs from the record", [edit(base, (draft) => (draft.source_url = "https://records.example.test/other"))]],
    ["a kind the record's evidence type cannot be", [edit(base, (draft) => (draft.record_kind = "city_parcel_display"))]],
    ["missing qualifiers the fact requires", [edit(base, (draft) => (draft.qualifiers = null))]],
    ["a High map describing the Very High fact", [edit(base, (draft) => (draft.qualifiers.hazard_class = "high"))]],
    ["YES recorded for part of the parcel", [edit(base, (draft) => (draft.coverage = "partial_parcel"))]],
    ["YES recorded with none of the parcel covered", [edit(base, (draft) => (draft.coverage = "none_of_parcel"))]],
    ["NO recorded with the whole parcel covered", [edit(completeBlock(vhFalse), (draft) => (draft.coverage = "whole_parcel"))]],
    ["coverage marked not applicable on a coverage fact", [edit(base, (draft) => (draft.coverage = "not_applicable"))]],
    ["coverage recorded on a fact without coverage", [edit(completeBlock(lot), (draft) => (draft.coverage = "whole_parcel"))]],
    ["a reviewed block without a reviewer", [edit(base, (draft) => (draft.authority_review.reviewer = null))]],
    ["an unreviewed block naming a reviewer", [edit(base, (draft) => (draft.authority_review.status = "unreviewed"))]],
    ["a review before the record was retrieved", [edit(base, (draft) => (draft.authority_review.reviewed_on = "2026-09-01"))]],
    ["an edition date without its kind", [edit(base, (draft) => (draft.edition.date_kind = null))]],
    ["an authority source ID that is not a registry ID", [edit(base, (draft) => (draft.source_identifier.value = "Some Map"))]],
    ["a lot area that is not the exact conversion of the recorded figure", [
      edit(completeBlock(lot), (draft) => (draft.qualifiers.as_recorded = { figure: "0.1701", unit: "acres" })),
    ]],
    ["a listed zone recorded for an R1 variation", [edit(completeBlock(zone), (draft) => (draft.qualifiers.zone_match = "r1_variation_zone"))]],
    ["a High YES with a legend that has no High class", [edit(completeBlock(highTrue), (draft) => (draft.qualifiers.legend_defines_class_for_lot = "no"))]],
  ];

  it.each(cases)("rejects %s", (_name, blocks) => {
    expectCode(() => screen(vhCriterion(), all, { blocks, registries: vhRegistries() }), "INVALID_PROGRAM_EVIDENCE_AUTHORITY");
  });

  it("accepts the exact conversion of a recorded acreage, with no rounding rule", () => {
    const exact = authoritativeRecord("lot-acres", "lot-area", 7405.2);
    const block = edit(completeBlock(exact), (draft) => (draft.qualifiers.as_recorded = { figure: "0.17", unit: "acres" }));
    expect(() => screen(vhCriterion(), [exact, vhTrue], { blocks: [block], registries: vhRegistries() })).not.toThrow();
  });
});

/* ======================================================================== */

describe("3. Conflicts stay conflicts", () => {
  it("keeps an authoritative YES and a ZIMAS NO in conflict", () => {
    const spy = vi.fn(genericPredicate(VH));
    const map = authoritativeRecord("vh-map", VH, true);
    const display = zimas("vh-zimas", VH, false);
    for (const blocks of [[completeBlock(map), displayBlock(display)], [completeBlock(map)]]) {
      const { criterion, pathway, result } = screen(vhCriterion(spy), [map, display], { blocks, registries: vhRegistries() });
      expect(criterion.status).toBe("conflict");
      expect("authority" in criterion).toBe(false);
      expect(result.facts.find((fact) => fact.key === VH)?.classification).toBe("conflict");
      expect(pathway.rollup).toBe("contested");
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps an authoritative NO and a ZIMAS YES in conflict", () => {
    const map = authoritativeRecord("vh-map", VH, false);
    const display = zimas("vh-zimas", VH, true);
    const { criterion } = screen(vhCriterion(), [map, display], {
      blocks: [completeBlock(map), displayBlock(display)],
      registries: vhRegistries(),
    });
    expect(criterion.status).toBe("conflict");
  });

  it("lets a stale or superseded authoritative record still create a conflict", () => {
    const current = authoritativeRecord("vh-map-current", VH, false);
    const old = authoritativeRecord("vh-map-old", VH, true);
    const stale = edit(completeBlock(old), (draft) => (draft.edition.currency = "superseded"));
    const { criterion } = screen(vhCriterion(), [current, old], {
      blocks: [completeBlock(current), stale],
      registries: vhRegistries(),
    });
    expect(criterion.status).toBe("conflict");
  });
});

/* ======================================================================== */

describe("4. Secondary sources cannot establish a gated fact", () => {
  it.each([true, false])("leaves a ZIMAS-only %s unknown", (value) => {
    const spy = vi.fn(genericPredicate(VH));
    const display = zimas("vh-zimas", VH, value);
    for (const blocks of [[displayBlock(display)], undefined]) {
      const { criterion, result } = screen(vhCriterion(spy), [display], { blocks, registries: vhRegistries() });
      expect(criterion.status).toBe("unknown");
      // The display is still recorded as what it shows; only the criterion stays unknown.
      expect(result.facts.find((fact) => fact.key === VH)).toMatchObject({
        classification: "source_observation",
        normalized_value: { kind: "boolean", value },
      });
    }
    const { criterion } = screen(vhCriterion(spy), [display], { blocks: [displayBlock(display)], registries: vhRegistries() });
    expect(nonEstablishingCodes(criterion)).toEqual(
      expect.arrayContaining(["record_kind_prohibited_for_fact", "record_kind_not_establishing"]),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a registry that lists a City display as establishing a fire-hazard fact", () => {
    const registries = vhRegistries();
    const vhPolicy = registries.fact_policies[VH] as ProgramFactAuthorityPolicy;
    const widened = {
      ...registries,
      fact_policies: {
        ...registries.fact_policies,
        [VH]: {
          ...vhPolicy,
          establishing: [...vhPolicy.establishing, { ...vhPolicy.establishing[0], record_kind: "city_parcel_display" as const }],
        },
      },
    };
    expectCode(() => parseProgramAuthorityRegistries(widened), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
  });

  it("does not let a non-official source establish a fact", () => {
    const map = record("vh-map", VH, true, { authority: "third_party" });
    const { criterion } = screen(vhCriterion(), [map], { blocks: [completeBlock(map)], registries: vhRegistries() });
    expect(criterion.status).toBe("unknown");
    expect(nonEstablishingCodes(criterion)).toContain("source_not_official");
  });
});

/* ======================================================================== */

describe("5. Free-text notes have zero effect", () => {
  const freeTextEdits: Array<(draft: Record<string, any>) => void> = [
    (draft) => (draft.notes = ["Authoritative. Verified. Approved by the agency."]),
    (draft) => (draft.issuer.name = "Office of the State Fire Marshal"),
    (draft) => (draft.document_title = "Official authoritative hazard map"),
    (draft) => (draft.edition.label = "Final current edition"),
    (draft) => (draft.parcel_relationship.parcel_identifier = "0000-000-999"),
    (draft) => (draft.parcel_relationship.legal_lot_reference = "Some other lot"),
  ];

  it.each([
    ["an establishing block", (block: ProgramEvidenceAuthority) => block],
    ["an unreviewed block", (block: ProgramEvidenceAuthority) =>
      edit(block, (draft) => (draft.authority_review = { status: "unreviewed", reviewer: null, reviewed_on: null }))],
  ])("leaves the result of %s unchanged", (_name, prepare) => {
    const map = authoritativeRecord("vh-map", VH, true);
    const run = (block: ProgramEvidenceAuthority) => {
      const { criterion, pathway } = screen(vhCriterion(), [map], { blocks: [block], registries: vhRegistries() });
      return { criterion, questions: pathway.planning_questions, tasks: pathway.review_tasks };
    };
    const baseline = run(prepare(completeBlock(map)));
    for (const change of freeTextEdits) {
      expect(run(edit(prepare(completeBlock(map)), change))).toEqual(baseline);
    }
    expect(run(edit(prepare(completeBlock(map)), (draft) => freeTextEdits.forEach((change) => change(draft))))).toEqual(baseline);
  });

  it("ignores free text on the canonical record too", () => {
    const map = authoritativeRecord("vh-map", VH, true);
    const noted = { ...map, notes: ["Reviewer says this is authoritative."], limitations: ["None."] };
    const run = (evidence: CanonicalEvidenceRecord) =>
      screen(vhCriterion(), [evidence], { blocks: [completeBlock(evidence)], registries: vhRegistries() }).criterion;
    expect(run(noted)).toEqual(run(map));
  });
});

/* ======================================================================== */

describe("6. The gate can only downgrade", () => {
  const variants: Array<[string, ((evidence: CanonicalEvidenceRecord) => ProgramEvidenceAuthority) | null]> = [
    ["no block", null],
    ["a complete block", completeBlock],
    ["an unreviewed block", (evidence) => edit(completeBlock(evidence), (draft) => (draft.authority_review = { status: "unreviewed", reviewer: null, reviewed_on: null }))],
    ["a stale currency check", (evidence) => edit(completeBlock(evidence), (draft) => (draft.edition.currency_checked_on = "2026-01-01"))],
    ["a superseded edition", (evidence) => edit(completeBlock(evidence), (draft) => (draft.edition.currency = "superseded"))],
    ["an unregistered issuer", (evidence) => edit(completeBlock(evidence), (draft) => (draft.issuer.issuer_id = "test-only-unknown-agency"))],
    ["an address-only match", (evidence) => edit(completeBlock(evidence), (draft) => (draft.parcel_relationship.matched_by = "address_only"))],
    ["a map that does not cover the lot", (evidence) => edit(completeBlock(evidence), (draft) => (draft.qualifiers.map_covers_lot = "no"))],
  ];
  const displays = ["absent", "agrees", "disagrees"] as const;
  const registrySets: Array<[string, ProgramAuthorityRegistries]> = [
    ["TEST-ONLY registries", vhRegistries()],
    ["shipped registries", shippedRegistriesWith(enforcedRequirement(VH_ID))],
  ];
  const deterministic = new Set(["consistent_with_source", "disqualifying_per_source"]);

  it("never produces a result the ungated rule would not, and never touches a fact", () => {
    let checked = 0;
    for (const value of [true, false]) {
      for (const [variantName, build] of variants) {
        for (const display of displays) {
          const map = authoritativeRecord("vh-map", VH, value);
          const records = [map];
          const blocks: ProgramEvidenceAuthority[] = build === null ? [] : [build(map)];
          if (display !== "absent") {
            const shown = zimas("vh-zimas", VH, display === "agrees" ? value : !value);
            records.push(shown);
            blocks.push(displayBlock(shown));
          }
          const ungated = screen(vhCriterion(), records, { blocks, registries: testRegistries() });
          for (const [registryName, registries] of registrySets) {
            const label = `${value} / ${variantName} / display ${display} / ${registryName}`;
            const gated = screen(vhCriterion(), records, { blocks, registries });
            expect(gated.result.facts, label).toEqual(ungated.result.facts);
            expect([ungated.criterion.status, "unknown"], label).toContain(gated.criterion.status);
            if (ungated.criterion.status === "conflict") {
              expect(gated.criterion, label).toEqual(ungated.criterion);
            }
            if (deterministic.has(gated.criterion.status)) {
              expect(gated.criterion.status, label).toBe(ungated.criterion.status);
              expect(gated.criterion.authority?.established, label).toBe(true);
              expect(variantName, label).toBe("a complete block");
              expect(registryName, label).toBe("TEST-ONLY registries");
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(2 * variants.length * displays.length * registrySets.length);
  });

  it("never turns an unknown fact into NO", () => {
    const partial = authoritativeRecord("vh-map-partial", VH, null);
    const partialBlock = completeBlock(partial);
    expect(partialBlock.coverage).toBe("partial_parcel");

    const alone = screen(vhCriterion(), [partial], { blocks: [partialBlock], registries: vhRegistries() });
    expect(alone.criterion.status).toBe("unknown");
    expect("authority" in alone.criterion).toBe(false);
    expect(alone.result.facts.find((fact) => fact.key === VH)?.normalized_value.kind).toBe("unknown");

    // A partial authoritative record plus a display NO: the fact reads NO from
    // the display alone, which cannot establish it, so the criterion stays unknown.
    const display = zimas("vh-zimas", VH, false);
    const withDisplay = screen(vhCriterion(), [partial, display], {
      blocks: [partialBlock, displayBlock(display)],
      registries: vhRegistries(),
    });
    expect(withDisplay.criterion.status).toBe("unknown");
    expect(withDisplay.criterion.status).not.toBe("consistent_with_source");
    expect(withDisplay.criterion.authority?.established).toBe(false);
  });
});

/* ======================================================================== */

describe("7. Criterion-specific checks under TEST-ONLY registries", () => {
  function runFact(
    key: ProgramFactKey,
    value: boolean | string | number | null,
    change: (draft: Record<string, any>) => void = () => undefined,
    requirement: Partial<Extract<ProgramCriterionAuthorityRequirement, { applicability: "enforced" }>> = {},
  ) {
    const id = `la_shra.test-only-family-${key}`;
    const evidence = authoritativeRecord(`auth-${key}`, key, value);
    return screen(syntheticCriterion(id, [key]), [evidence], {
      blocks: [edit(completeBlock(evidence), change)],
      registries: testRegistries({ [id]: enforcedRequirement(id, requirement) }),
    }).criterion;
  }

  describe("a: lot area (D5: exact values only, compared directly)", () => {
    it("establishes an exact recorded legal-lot area and compares it directly with the threshold", () => {
      expect(runFact("lot-area", 65_339)).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
      expect(runFact("lot-area", 65_340)).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });
      expect(
        runFact("lot-area", 65_340, (draft) => (draft.qualifiers.as_recorded = { figure: "1.5", unit: "acres" })),
      ).toMatchObject({ status: "disqualifying_per_source" });
    });

    it.each(["approximate", "rounded", "estimated", "not_established"])("leaves a %s area unknown", (precision) => {
      const result = runFact("lot-area", 7405.2, (draft) => (draft.qualifiers.area_precision = precision));
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain("lot_area_not_exact");
    });

    it.each(["gis_calculated_area", "assessor_parcel_area", "not_established"])("leaves a %s basis unknown", (basis) => {
      const result = runFact("lot-area", 7405.2, (draft) => (draft.qualifiers.area_basis = basis));
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain("lot_area_basis_not_accepted");
    });

    it.each([
      "parcel_and_legal_lot_differ",
      "tied_or_multiple_lots",
      "merger_or_resubdivision_pending_or_proposed",
      "not_established",
    ])("leaves an area unknown when legal-lot identity is %s", (identity) => {
      const result = runFact("lot-area", 7405.2, (draft) => (draft.parcel_relationship.legal_lot_identity = identity));
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain("legal_lot_identity_not_established");
    });
  });

  describe("a: zone category (D6: exact-match tripwire only)", () => {
    it("establishes a listed zone only when the recorded base zone is exactly one of the nine", () => {
      expect(runFact("shra-zone-category", "single_family_listed_zone").status).toBe("consistent_with_source");
      for (const recorded of ["R1V2", "RE11", "R1-1", " R1", "R1 ", "r1", "[Q]R1"]) {
        const result = runFact("shra-zone-category", "single_family_listed_zone", (draft) => (draft.qualifiers.base_zone_as_recorded = recorded));
        expect(result.status, recorded).toBe("unknown");
        expect(nonEstablishingCodes(result), recorded).toContain("zone_tripwire_refused");
      }
    });

    it("refuses a not-on-list value when the recorded zone is exactly a listed zone", () => {
      expect(runFact("shra-zone-category", "zone_not_on_single_family_list").status).toBe("consistent_with_source");
      const result = runFact("shra-zone-category", "zone_not_on_single_family_list", (draft) => (draft.qualifiers.base_zone_as_recorded = "RS"));
      expect(nonEstablishingCodes(result)).toContain("zone_tripwire_refused");
    });

    it("keeps an R1 variation zone unknown", () => {
      const result = runFact("shra-zone-category", null, (draft) => (draft.qualifiers = { family: "zone_record", base_zone_as_recorded: "R1V2", zone_match: "r1_variation_zone" }));
      expect(result.status).toBe("unknown");
    });
  });

  describe("a: Chapter 1 scope precondition", () => {
    const id = "la_shra.test-only-chapter-scope";
    const run = (chapter: string, readsChapter = true) => {
      const zone = authoritativeRecord("zone", "shra-zone-category", "single_family_listed_zone");
      const code = authoritativeRecord("chapter", "zoning-code-chapter", chapter);
      const keys: ProgramFactKey[] = readsChapter ? ["shra-zone-category", "zoning-code-chapter"] : ["shra-zone-category"];
      return screen(syntheticCriterion(id, keys, () => "consistent_with_source"), [zone, code], {
        blocks: [completeBlock(zone), completeBlock(code)],
        registries: testRegistries({
          [id]: enforcedRequirement(id, { scope_preconditions: [{ fact_key: "zoning-code-chapter", must_equal: "Chapter 1" }] }),
        }),
      }).criterion;
    };

    it("runs for Chapter 1 and stays unknown for Chapter 1A", () => {
      expect(run("Chapter 1").status).toBe("consistent_with_source");
      expect(run("Chapter 1A")).toMatchObject({
        status: "unknown",
        authority: { criterion_failures: [{ code: "scope_precondition_not_met", fact_key: "zoning-code-chapter" }] },
      });
    });

    it("fails closed when the requirement names a fact the criterion does not read", () => {
      expect(run("Chapter 1", false)).toMatchObject({
        status: "unknown",
        authority: { criterion_failures: [{ code: "requirement_fact_not_read", fact_key: "zoning-code-chapter" }] },
      });
    });
  });

  describe("b: prior SHRA or SB 9 map", () => {
    // D10: a parcel's own maps are verified in the case-scoped store, which
    // does not exist yet, so even a complete history cannot establish b today.
    it.each(Object.keys(mapsFor))("leaves only the unbuilt case store outstanding for %s from a complete reviewed history", (value) => {
      const result = runFact("prior-shra-or-sb9-map", value);
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toEqual(["capture_not_verified"]);
    });

    const failures: Array<[string, (draft: Record<string, any>) => void, string]> = [
      ["a partial search", (draft) => (draft.qualifiers.search.scope = "partial"), "map_search_incomplete"],
      ["a single portal result", (draft) => (draft.qualifiers.search.scope = "single_portal_result"), "map_search_incomplete"],
      ["a missing repository", (draft) => (draft.qualifiers.search.repositories_searched = ["test-only-county-maps"]), "map_search_incomplete"],
      ["an old search", (draft) => (draft.qualifiers.search.searched_on = "2026-01-01"), "map_search_incomplete"],
      ["an unestablished statute", (draft) => (draft.qualifiers.maps[0].statute_basis = "not_established"), "map_history_not_established"],
      ["an unestablished recording status", (draft) => (draft.qualifiers.maps[0].recording = "not_established"), "map_history_not_established"],
      ["an unestablished lot relation", (draft) => (draft.qualifiers.maps[0].relation = "not_established"), "map_history_not_established"],
      ["a later lineage change", (draft) => (draft.qualifiers.lineage_changed_after_shra_or_sb9_map = "yes"), "map_lineage_uncertain"],
      ["an uncertain lineage", (draft) => (draft.qualifiers.lineage_changed_after_shra_or_sb9_map = "not_established"), "map_lineage_uncertain"],
      ["a map only earlier in the lineage", (draft) => (draft.qualifiers.maps[0].relation = "earlier_in_lineage"), "map_history_does_not_support_value"],
      ["unclear legal-lot identity", (draft) => (draft.parcel_relationship.legal_lot_identity = "tied_or_multiple_lots"), "legal_lot_identity_not_established"],
      ["a case-store capture", (draft) => (draft.capture = { store: "case_evidence_file", file_id: "TEST-ONLY-FILE", sha256: "1".repeat(64) }), "capture_not_verified"],
    ];
    it.each(failures)("leaves shra_map_recorded unknown for %s", (_name, change, code) => {
      const result = runFact("prior-shra-or-sb9-map", "shra_map_recorded", change);
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain(code);
    });

    it("does not clear no_map_recorded when the history lists a recorded map", () => {
      const result = runFact("prior-shra-or-sb9-map", "no_map_recorded", (draft) => (draft.qualifiers.maps = mapsFor.other_basis_map_recorded));
      expect(nonEstablishingCodes(result)).toContain("map_history_does_not_support_value");
    });

    it("does not clear a never-recorded tentative map when a separate SHRA map was recorded", () => {
      const result = runFact("prior-shra-or-sb9-map", "shra_or_sb9_tentative_map_not_recorded", (draft) =>
        draft.qualifiers.maps.push(mapsFor.shra_map_recorded[0]),
      );
      expect(nonEstablishingCodes(result)).toContain("map_history_does_not_support_value");
    });
  });

  describe("c, d: fire-hazard maps", () => {
    it("establishes Very High without a legend check, and High only when the legend defines a High class", () => {
      expect(runFact(VH, false, (draft) => (draft.qualifiers.legend_defines_class_for_lot = "not_established")).status).toBe(
        "consistent_with_source",
      );
      expect(runFact(HIGH, false).status).toBe("consistent_with_source");
      for (const legend of ["no", "not_established"]) {
        const result = runFact(HIGH, false, (draft) => (draft.qualifiers.legend_defines_class_for_lot = legend));
        expect(result.status, legend).toBe("unknown");
        expect(nonEstablishingCodes(result), legend).toContain("hazard_legend_class_not_defined");
      }
    });

    it.each([
      ["a map that does not cover the lot", (draft: Record<string, any>) => (draft.qualifiers.map_covers_lot = "no")],
      ["an unestablished map coverage", (draft: Record<string, any>) => (draft.qualifiers.map_covers_lot = "not_established")],
    ])("leaves the Very High fact unknown for %s", (_name, change) => {
      const result = runFact(VH, true, change);
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain("hazard_area_not_covered");
    });

    it("treats responsibility area as context only (Phase 3B c point 7, d point 6)", () => {
      for (const area of ["state", "local", "federal", "not_stated"]) {
        expect(runFact(VH, true, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe(
          "disqualifying_per_source",
        );
        expect(runFact(HIGH, false, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe(
          "consistent_with_source",
        );
      }
    });

    it.each([
      ["an unestablished edition date", (draft: Record<string, any>) => Object.assign(draft.edition, { date: null, date_kind: null }), "edition_not_established"],
      ["an edition after the screen date", (draft: Record<string, any>) => (draft.edition.date = "2026-12-01"), "edition_not_established"],
      ["an unestablished currency", (draft: Record<string, any>) => (draft.edition.currency = "not_established"), "edition_not_current"],
      ["no currency check", (draft: Record<string, any>) => (draft.edition.currency_checked_on = null), "edition_not_current"],
    ])("leaves the Very High fact unknown for %s", (_name, change, code) => {
      const result = runFact(VH, true, change);
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain(code);
    });
  });

  describe("f: natural community conservation plan", () => {
    it("establishes YES from an adopted plan and never establishes NO", () => {
      expect(runFact("nccp-conservation-land", true).status).toBe("disqualifying_per_source");
      const no = runFact("nccp-conservation-land", false);
      expect(no.status).toBe("unknown");
      expect(nonEstablishingCodes(no)).toContain("value_not_establishable");
    });

    it.each(["draft", "proposed", "pending", "expired", "superseded", "not_established"])("leaves a %s plan unknown", (status) => {
      const result = runFact("nccp-conservation-land", true, (draft) => (draft.qualifiers.adoption_status = status));
      expect(nonEstablishingCodes(result)).toContain("plan_not_adopted_in_effect");
    });

    it.each([
      ["a label that needs interpretation", (draft: Record<string, any>) => (draft.qualifiers.identification_basis = "requires_interpretation"), "plan_identification_not_explicit"],
      ["no map or text reference", (draft: Record<string, any>) => (draft.qualifiers.map_or_text_reference = null), "plan_reference_incomplete"],
      ["no adoption date", (draft: Record<string, any>) => (draft.qualifiers.adoption_date = null), "plan_reference_incomplete"],
      ["no status check", (draft: Record<string, any>) => (draft.qualifiers.status_checked_on = null), "plan_not_adopted_in_effect"],
    ])("leaves the plan fact unknown for %s", (_name, change, code) => {
      expect(nonEstablishingCodes(runFact("nccp-conservation-land", true, change))).toContain(code);
    });
  });

  describe("g: conservation easement", () => {
    it("leaves only the unbuilt case store outstanding for an express, in-force instrument, and never establishes NO", () => {
      const yes = runFact("conservation-easement", true);
      expect(yes.status).toBe("unknown");
      expect(nonEstablishingCodes(yes)).toEqual(["capture_not_verified"]);
      expect(nonEstablishingCodes(runFact("conservation-easement", false))).toContain("value_not_establishable");
    });

    it.each([
      ["an instrument that needs interpretation", (draft: Record<string, any>) => (draft.qualifiers.instrument_character = "requires_interpretation"), "instrument_not_express"],
      ["a released easement", (draft: Record<string, any>) => (draft.qualifiers.in_force = "released_or_extinguished"), "instrument_not_in_force"],
      ["an unestablished in-force status", (draft: Record<string, any>) => (draft.qualifiers.in_force = "not_established"), "instrument_not_in_force"],
      ["a partial release search", (draft: Record<string, any>) => (draft.qualifiers.release_search.scope = "partial"), "instrument_release_search_incomplete"],
      ["no document number", (draft: Record<string, any>) => (draft.qualifiers.document_number = null), "record_identity_incomplete"],
      ["a portal-only identifier", (draft: Record<string, any>) => (draft.source_identifier = { scheme: "portal_url_only", value: "TEST-ONLY" }), "record_identity_incomplete"],
      ["a case-store capture (D10: not built yet)", (draft: Record<string, any>) => (draft.capture = { store: "case_evidence_file", file_id: "TEST-ONLY-FILE", sha256: "1".repeat(64) }), "capture_not_verified"],
      ["a public repo capture (D10: never a parcel instrument)", (draft: Record<string, any>) => (draft.capture.source_id = "shra-2025-10-28"), "capture_not_verified"],
    ])("leaves the easement fact unknown for %s", (_name, change, code) => {
      const result = runFact("conservation-easement", true, change);
      expect(result.status).toBe("unknown");
      expect(nonEstablishingCodes(result)).toContain(code);
    });
  });

  it("reports only codes from the closed failure lists", () => {
    const known = new Set<string>(authorityRecordFailureCodes);
    for (const result of [runFact(VH, true, (draft) => (draft.authority_review = { status: "unreviewed", reviewer: null, reviewed_on: null })), runFact("lot-area", 1, (draft) => (draft.qualifiers.area_precision = "rounded"))]) {
      for (const code of nonEstablishingCodes(result)) expect(known.has(code), code).toBe(true);
    }
  });
});

/* ======================================================================== */

describe("8. Registry contents and validation", () => {
  const decisionGates = Object.fromEntries(decisionsJson.decisions.map((entry) => [entry.criterion_id, entry.promotion_gates]));

  it("pins the shipped fact policies: deny-by-default, with the reviewer's prohibitions", () => {
    const policies = programAuthorityRegistries.fact_policies;
    expect(Object.fromEntries(Object.entries(policies).map(([key, entry]) => [key, entry?.decision_refs.map(refToken)]))).toEqual({
      "lot-area": ["1a"],
      "shra-zone-category": ["1a"],
      "zoning-code-chapter": ["1a"],
      "prior-shra-or-sb9-map": ["1b"],
      [VH]: ["1c", "3Bc"],
      [HIGH]: ["1d", "3Bd"],
      "prime-or-statewide-farmland": ["1e", "3Be"],
      "nccp-conservation-land": ["1f", "3Bf"],
      "conservation-easement": ["1g", "3Bg"],
      "sb79-permanent-exemption-shown": ["1h"],
    });
    expect(pinnedProhibitedEstablishingKinds).toEqual({
      [VH]: ["city_parcel_display"],
      [HIGH]: ["city_parcel_display"],
      "prime-or-statewide-farmland": ["city_parcel_display", "generic_gis_layer", "search_result"],
      "nccp-conservation-land": ["city_parcel_display", "generic_gis_layer", "other_secondary"],
      "conservation-easement": ["city_parcel_display", "title_summary", "generic_gis_layer", "other_secondary"],
      "sb79-permanent-exemption-shown": ["city_parcel_display"],
    });
    expect(blockOnlyAuthorityFacts).toEqual([
      "prime-or-statewide-farmland",
      "nccp-conservation-land",
      "conservation-easement",
      "sb79-permanent-exemption-shown",
    ]);
    for (const [key, entry] of Object.entries(policies)) {
      expect(entry?.prohibited_establishing_kinds, key).toEqual(pinnedProhibitedEstablishingKinds[key as ProgramFactKey] ?? []);
    }
    expect(policies["lot-area"]).toMatchObject({ requires_legal_lot_identity: true, family_policy: { family: "lot_area", accepted_area_bases: [] } });
    expect(policies["prior-shra-or-sb9-map"]).toMatchObject({
      requires_legal_lot_identity: true,
      family_policy: { family: "map_history", required_search_repositories: [], search_max_age_days: null },
    });
    expect(policies[HIGH]?.family_policy).toEqual({ family: "hazard_map", hazard_class: "high", require_legend_class: true });
    // Phase 3C: the lot identity rule applies to c-g.
    for (const key of [VH, HIGH, "prime-or-statewide-farmland", "nccp-conservation-land", "conservation-easement"] as const) {
      expect(policies[key]?.requires_legal_lot_identity, key).toBe(true);
    }
  });

  it("pins one requirement for each of the eight Round 1 criteria, with the governing decision's gates", () => {
    const requirements = programAuthorityRegistries.criterion_requirements;
    expect(Object.keys(requirements)).toEqual(decisionsJson.decisions.map((entry) => entry.criterion_id));
    for (const [id, requirement] of Object.entries(requirements)) {
      expect((humanVerificationRequiredCriterionIds as readonly string[]).includes(id), id).toBe(true);
      expect(requirement.applicability, id).toBe("enforced");
      // Phase 3C: c-g follow the Phase 3B decision that superseded Round 1.
      const phase3b = PHASE_3B_GATES[id] !== undefined;
      expect(requirement.decision_ref, id).toEqual(
        phase3b ? { phase: "3B", letter: ROUND_1_LETTERS[id] } : { round: 1, letter: ROUND_1_LETTERS[id] },
      );
      expect(requirement.promotion_gates, id).toEqual(phase3b ? PHASE_3B_GATES[id] : decisionGates[id]);
    }
    const a = requirements["la_shra.single-family-lot-area-threshold"];
    expect(a).toMatchObject({
      scope_preconditions: [{ fact_key: "zoning-code-chapter", must_equal: "Chapter 1" }],
      numeric_boundaries: [
        { fact_key: "lot-area", source_text: "under 1.5 acres", boundary: { figure: "1.5", unit: "acres" }, normalized_equivalent: { value: 65_340, unit: "sq ft" } },
      ],
    });
    expect(excerptAppearsInCapture("under 1.5 acres", shraMemoText)).toBe(true);
  });

  it("requires every shipped issuer and source to cite a pinned official capture, and ships none", () => {
    const captures = Object.values(
      import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", { import: "default", eager: true }) as Record<
        string,
        { source_id: string; sha256_extracted: string; test_only: boolean }
      >,
    );
    const pinned = (ref: { source_id: string; sha256_extracted: string }) =>
      captures.some((capture) => !capture.test_only && capture.source_id === ref.source_id && capture.sha256_extracted === ref.sha256_extracted);
    for (const entry of programAuthorityRegistries.issuers) expect(pinned(entry.basis_capture), entry.issuer_id).toBe(true);
    for (const entry of programAuthorityRegistries.sources) expect(pinned(entry.capture), entry.authority_source_id).toBe(true);
    expect([...programAuthorityRegistries.issuers, ...programAuthorityRegistries.sources]).toEqual([]);
    expect(captures.length).toBeGreaterThan(0);
  });

  it("uses exactly the nine zones the captured SHRA memo lists", () => {
    const sentence =
      "Zoned for single-family residential development means sites in the following zones: A1, A2, RA, RE, RS, R1, RU, RZ, and RW1.";
    expect(excerptAppearsInCapture(sentence, shraMemoText)).toBe(true);
    const listed = sentence.slice(sentence.indexOf(":") + 1).replace(/\band\b|\./g, "").split(",").map((zone) => zone.trim());
    expect(shraMemoSingleFamilyZones).toEqual(listed);
  });

  const valid = () => testRegistries({ [VH_ID]: enforcedRequirement(VH_ID) });
  const withPolicy = (key: ProgramFactKey, change: (draft: Record<string, any>) => void) => {
    const registries = structuredClone(valid()) as Record<string, any>;
    change(registries.fact_policies[key]);
    return registries as ProgramAuthorityRegistries;
  };
  const withRegistries = (change: (draft: Record<string, any>) => void) => {
    const registries = structuredClone(valid()) as Record<string, any>;
    change(registries);
    return registries as ProgramAuthorityRegistries;
  };
  const shippedA = () => structuredClone(programAuthorityRegistries.criterion_requirements["la_shra.single-family-lot-area-threshold"]) as Record<string, any>;

  const invalid: Array<[string, ProgramAuthorityRegistries]> = [
    ["a prohibited kind listed as establishing", withPolicy("conservation-easement", (draft) => (draft.establishing[0].record_kind = "title_summary"))],
    ["a dropped pinned prohibition", withPolicy(VH, (draft) => (draft.prohibited_establishing_kinds = []))],
    ["a NO established for a block-only fact", withPolicy("nccp-conservation-land", (draft) => draft.establishing[0].values.push("false"))],
    ["a High policy that does not require the legend", withPolicy(HIGH, (draft) => (draft.family_policy.require_legend_class = false))],
    ["an unregistered issuer", withPolicy(VH, (draft) => (draft.establishing[0].issuer_ids = ["test-only-unknown-agency"]))],
    ["a source registered for another fact", withPolicy("nccp-conservation-land", (draft) => (draft.establishing[0].authority_source_ids = ["test-only-hazard-map"]))],
    ["a registered-source entry with no currency window", withPolicy(VH, (draft) => (draft.establishing[0].currency_max_age_days = null))],
    ["a value the fact does not have", withPolicy(VH, (draft) => draft.establishing[0].values.push("maybe"))],
    ["a family policy that does not match the fact", withPolicy(VH, (draft) => (draft.family_policy = { family: "adopted_plan" }))],
    ["a map-history policy with no required repositories", withPolicy("prior-shra-or-sb9-map", (draft) => (draft.family_policy.required_search_repositories = []))],
    ["an instrument policy with no release-search repositories", withPolicy("conservation-easement", (draft) => (draft.family_policy.required_release_search_repositories = []))],
    ["a non-human reviewer", withRegistries((draft) => (draft.issuers[0].review.reviewer = { kind: "ai", name: "Model", role: "Reviewer" }))],
    ["a source from an unregistered issuer", withRegistries((draft) => (draft.sources[0].issuer_id = "test-only-unknown-agency"))],
    ["a requirement without the reviewer gate", withRegistries((draft) => (draft.criterion_requirements[VH_ID].promotion_gates = ["human_verification_record"]))],
    ["a not-applicable requirement that claims the provenance gate", withRegistries((draft) => {
      draft.criterion_requirements[VH_ID] = {
        criterion_id: VH_ID,
        applicability: "not_applicable",
        decision_ref: { round: 99, letter: "z" },
        promotion_gates: ["evidence_provenance_enforced_or_fails_closed", "reviewer_confirms_encoded_rule", "human_verification_record"],
        reason: "TEST-ONLY",
      };
    })],
    ["a threshold that is not the exact conversion", withRegistries((draft) => {
      const a = shippedA();
      a.numeric_boundaries[0].normalized_equivalent.value = 65_000;
      draft.criterion_requirements[a.criterion_id] = a;
    })],
    ["a precondition value the fact does not have", withRegistries((draft) => {
      const a = shippedA();
      a.scope_preconditions[0].must_equal = "Chapter 2";
      draft.criterion_requirements[a.criterion_id] = a;
    })],
  ];

  it("accepts the TEST-ONLY registries used above", () => {
    expect(() => parseProgramAuthorityRegistries(valid())).not.toThrow();
  });

  it.each(invalid)("rejects %s", (_name, registries) => {
    expectCode(() => parseProgramAuthorityRegistries(registries), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
  });
});

/* ======================================================================== */

describe("9. The promotion guard protects all 46 atomic criteria", () => {
  const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
  const byId = new Map(shipped.map((criterion) => [criterion.id, criterion]));
  const requirements = programAuthorityRegistries.criterion_requirements;

  function completeRecord(criterion: ProgramCriterion, decisionRef = requirements[criterion.id]?.decision_ref ?? { round: 99, letter: "z" }): ProgramCriterionHumanVerification {
    return {
      reviewer: { kind: "human", name: "TEST-ONLY Reviewer", role: "Synthetic reviewer" },
      verified_at: criterion.citation.verified_at,
      next_review_at: criterion.citation.next_review_at,
      source_title: criterion.citation.title,
      source_url: criterion.citation.url,
      instrument: "TEST-ONLY instrument",
      pinpoint: criterion.citation.pinpoint,
      supporting_excerpt: "TEST-ONLY supporting excerpt.",
      source_capture: {
        repo_path: criterion.basis.repo_path,
        retrieved_at: "2026-09-10T00:00:00.000Z",
        capture_method: "pdf_text_extraction",
        sha256: "a".repeat(64),
        is_ai_generated: false,
        source_type: criterion.basis.repo_path.includes("shra-") ? "official_memo" : "adopted_ordinance",
        operative_status: "operative",
      },
      decision_ref: decisionRef,
    };
  }

  function promote(criterion: ProgramCriterion, predicate: CriterionPredicate, decisionRef?: ProgramDecisionRef): ProgramCriterion {
    return {
      ...criterion,
      predicate: criterion.predicate === "professional_judgment" ? criterion.predicate : predicate,
      question_if_judgment: criterion.question_if_judgment ?? "How does Planning apply this criterion?",
      verification: "human_verified",
      human_verification: completeRecord(criterion, decisionRef),
    };
  }

  function establishedFacts(keys: readonly ProgramFactKey[]) {
    const records = keys.map((key) => {
      const spec = programFactSpecs[key];
      const value = spec.value.kind === "boolean" ? true : spec.value.kind === "number" ? 1000 : (spec.value.allowed?.[0] ?? "TEST-ONLY");
      return record(`fact-${key}`, key, value, { evidenceType: "official_document" });
    });
    return new Map(assessProgramFacts(records, keys).map((fact) => [fact.key, fact]));
  }

  it("pins the unmet gates of the eight Round 1 criteria to their governing decisions", () => {
    for (const entry of decisionsJson.decisions) {
      const criterion = byId.get(entry.criterion_id) as ProgramCriterion;
      // Phase 3C: c-g are held to every Phase 3B gate, all unmet.
      expect(criterionPromotionBlockers(criterion), entry.letter).toEqual(PHASE_3B_GATES[entry.criterion_id] ?? entry.promotion_gates);
    }
  });

  it("keeps every one of the 46 waiting, and never runs its rule, even with a complete human record", () => {
    expect(humanVerificationRequiredCriterionIds).toHaveLength(46);
    for (const id of humanVerificationRequiredCriterionIds) {
      const original = byId.get(id) as ProgramCriterion;
      const spy = vi.fn((() => "requires_judgment") as CriterionPredicate);
      const promoted = promote(original, spy);
      expect(hasCompleteHumanVerification(promoted), id).toBe(true);
      expect(criterionAwaitsHumanVerification(promoted), id).toBe(true);
      const blockers = criterionPromotionBlockers(promoted);
      expect(blockers.length, id).toBeGreaterThan(0);
      if (requirements[id] === undefined) {
        expect(blockers, id).toEqual(["authority_requirement_missing"]);
      } else {
        expect(blockers, id).not.toContain("reviewer_confirms_encoded_rule");
        expect(blockers, id).not.toContain("human_verification_record");
      }
      if (typeof promoted.predicate === "function") {
        const result = evaluateProgramCriterion(promoted, establishedFacts(promoted.fact_keys), AS_OF);
        expect(result, id).toMatchObject({ status: "unreviewed", unreviewed_reasons: ["criterion_pending_human"] });
        expect("authority" in result, id).toBe(false);
        expect(spy, id).not.toHaveBeenCalled();
      }
    }
  });

  it("does not let a reviewer's confirmation alone promote a gated criterion", () => {
    const c = byId.get("la_shra.very-high-fire-hazard-severity-zone") as ProgramCriterion;
    const promoted = promote(c, () => "disqualifying_per_source");
    expect(criterionPromotionBlockers(promoted)).toEqual([
      "evidence_provenance_enforced_or_fails_closed",
      "map_identity_and_edition_recorded",
      "statutory_route_recorded",
      "statutory_routes_assessed_separately",
      "legal_lot_identity_fails_closed",
    ]);
    // A human record cannot carry a note at all.
    const noted = { ...promoted, human_verification: { ...promoted.human_verification, note: "Provenance reviewed and approved." } } as ProgramCriterion;
    expect(hasCompleteHumanVerification(noted)).toBe(false);
    expect(criterionAwaitsHumanVerification(noted)).toBe(true);
  });

  it("lifts only through a reviewed registry entry, shown with a TEST-ONLY not-applicable requirement", () => {
    const zone = byId.get("la_shra.zone-category") as ProgramCriterion;
    const registries: ProgramAuthorityRegistries = {
      ...programAuthorityRegistries,
      criterion_requirements: {
        ...programAuthorityRegistries.criterion_requirements,
        [zone.id]: {
          criterion_id: zone.id,
          applicability: "not_applicable",
          decision_ref: { round: 99, letter: "z" },
          promotion_gates: ["reviewer_confirms_encoded_rule", "human_verification_record"],
          reason: "TEST-ONLY: exercises the promotion guard.",
        },
      },
    };
    parseProgramAuthorityRegistries(registries);
    const spy = vi.fn((() => "consistent_with_source") as CriterionPredicate);
    const promoted = promote(zone, spy, { round: 99, letter: "z" });

    expect(criterionAwaitsHumanVerification(promoted)).toBe(true);
    expect(criterionPromotionBlockers(promoted, registries)).toEqual([]);
    expect(criterionAwaitsHumanVerification(promoted, registries)).toBe(false);
    expect(criterionPromotionBlockers(promote(zone, spy, { round: 99, letter: "y" }), registries)).toEqual(["reviewer_confirms_encoded_rule"]);

    const facts = establishedFacts(promoted.fact_keys);
    expect(evaluateProgramCriterion(promoted, facts, AS_OF).status).toBe("unreviewed");
    expect(spy).not.toHaveBeenCalled();
    const lifted = evaluateProgramCriterion(promoted, facts, AS_OF, { registries, blocks: new Map(), records: [] });
    expect(lifted.status).toBe("consistent_with_source");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

/* ======================================================================== */

describe("10. Production output is unchanged while every affected criterion stays pending", () => {
  // The same pins as the Round 1 test: SHA-256 of the full JSON output.
  // Phase 3C moved these pins for the three reviewed client-label changes only
  // (c, d, g; docs/PROGRAM_SCREEN_PHASE_3C_PROMOTION_GATES.md). Every status,
  // roll-up, and release decision is unchanged.
  const EVALUATOR_OUTPUT_SHA256 = "68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1";
  const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);

  it("keeps the evaluator and public-demo output byte-identical", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
    const withEmptySidecar = evaluateProgramScreen({
      evidence_records: fixtureJson.evidence_records,
      as_of: fixtureJson.as_of,
      evidence_authority: [],
    });
    expect(JSON.stringify(withEmptySidecar)).toBe(JSON.stringify(result));
  });

  it("promotes nothing and never runs the gate on the shipped screen", () => {
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(shipped.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    expect(JSON.stringify(result)).not.toContain('"authority"');
    const statuses = new Map(result.pathways.flatMap((pathway) => pathway.criteria).map((criterion) => [criterion.criterion_id, criterion.status]));
    for (const id of Object.keys(programAuthorityRegistries.criterion_requirements)) {
      expect(statuses.get(id), id).toBe(fixtureJson.expected.criterion_statuses[id as keyof typeof fixtureJson.expected.criterion_statuses]);
    }
    expect(result.review_tasks.map((task) => task.kind)).not.toContain("review_evidence_authority");
  });
});

/* ======================================================================== */

describe("11. Authority language and determinism", () => {
  it("writes authority statements, questions, and tasks without prohibited language", () => {
    const cases = [
      screen(vhCriterion(), [authoritativeRecord("vh-map", VH, true)], { registries: vhRegistries() }),
      screen(vhCriterion(), [zimas("vh-zimas", VH, false)], { registries: vhRegistries() }),
    ];
    for (const { result, pathway, criterion } of cases) {
      expect(criterion.statement.startsWith("No record that this criterion accepts as authoritative establishes the recorded")).toBe(true);
      expect(findProhibitedClientLanguage(criterion.statement)).toEqual([]);
      const question = pathway.planning_questions.find((candidate) => candidate.criterion_ids.includes(VH_ID));
      expect(question?.why_confirmation_needed.startsWith(criterion.statement)).toBe(true);
      const task = pathway.review_tasks.find((candidate) => candidate.kind === "review_evidence_authority");
      expect(task?.instruction).toContain(programFactSpecs[VH].label);
      expect(result.release.blockers.filter((blocker) => blocker.code === "prohibited_language")).toEqual([]);
    }
  });

  it("does not depend on sidecar order", () => {
    const map = authoritativeRecord("vh-map", VH, true);
    const display = zimas("vh-zimas", VH, true);
    const blocks = [completeBlock(map), displayBlock(display)];
    const forward = screen(vhCriterion(), [map, display], { blocks, registries: vhRegistries() });
    const reversed = screen(vhCriterion(), [display, map], { blocks: [...blocks].reverse(), registries: vhRegistries() });
    expect(reversed.result).toEqual(forward.result);
    expect(forward.criterion).toMatchObject({
      status: "disqualifying_per_source",
      authority: { facts: [{ establishing_evidence_ids: ["vh-map"], non_establishing: [{ evidence_id: "vh-zimas" }] }] },
    });
  });
});

describe("12. Design record", () => {
  it("records the final D1-D12 decisions", () => {
    for (const decision of [
      "D1 — APPROVE.",
      "D2 — APPROVE.",
      "D3 — APPROVE.",
      "D4 — APPROVE for Phase 2.",
      "D5 — REJECT the proposed ± last-printed-unit rule.",
      "D6 — APPROVE, narrowly.",
      "D7 — APPROVE: apply the promotion guard to all 46 atomic criteria.",
      "D8 — APPROVE.",
      "D9 — DEFER.",
      "D10 — APPROVE.",
      "D11 — APPROVE.",
      "D12 — APPROVE.",
    ]) {
      expect(designDoc).toContain(decision);
    }
  });
});
