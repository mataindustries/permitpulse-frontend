import { describe, expect, it, vi } from "vitest";
import rereviewDoc from "../../docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md?raw";
import phase3cDoc from "../../docs/PROGRAM_SCREEN_PHASE_3C_PROMOTION_GATES.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import rereviewRaw from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json?raw";
import rereviewJson from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json";
import testOnlyCapture from "../fixtures/program-screen/test-only-sources/test-only-adopted-ordinance-000001/metadata.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import {
  authorityPromotionBlockers,
  legalLotIdentityFacts,
  parseProgramAuthorityRegistries,
  pinnedProhibitedEstablishingKinds,
  programAuthorityRegistries,
  promotionGuardedCriterionIds,
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
  rollUpProgramPathway,
} from "../src/shared/program-screen/evaluate";
import {
  authorityFactProfiles,
  authorityRecordFailureCodes,
  hazardClassStatutoryRoutes,
  PROGRAM_EVIDENCE_AUTHORITY_VERSION,
  statutoryRouteRecordKinds,
  type ProgramEvidenceAuthority,
} from "../src/shared/program-screen/evidence-authority";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { humanRereviewDecisionsSchema, rereviewIntroducedPromotionGates } from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  criterionAwaitsHumanVerification,
  hasCompleteHumanVerification,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import { sha256Hex, sourceHostExceptions } from "../src/shared/program-screen/source-capture";
import {
  criterionPromotionGates,
  programPathwayCompletenessBlockers,
  retiredCriterionPromotionGates,
  type CriterionPredicate,
  type CriterionStatus,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramCriterionResult,
  type ProgramDecisionRef,
  type ProgramFactKey,
} from "../src/shared/program-screen/types";
import { syntheticLotOverlay } from "./program-screen-overlay-helpers";

/**
 * Phase 3C: the Phase 3B promotion gates and the fact-model changes they need
 * for criteria c-g, made enforceable and fail-closed. Nothing is promoted,
 * registered, or captured. Record: docs/PROGRAM_SCREEN_PHASE_3C_PROMOTION_GATES.md.
 *
 * Criteria that must run are TEST-ONLY synthetic ones outside the 46 atomic
 * criteria, and registries that can establish anything are TEST-ONLY ones
 * passed like `packs`. Every agency, map, plan, and instrument is fictional.
 */

const AS_OF = "2026-09-27";
const RETRIEVED_AT = "2026-09-18T12:00:00.000Z";
const REVIEWED_ON = "2026-09-20";
const EDITION_DATE = "2026-01-15";
const SUBJECT = { case_id: "case-fictional-phase-3c-test", property_id: "property-fictional-phase-3c-test" };
const REVIEWER = { kind: "human", name: "TEST-ONLY Reviewer", role: "Synthetic reviewer" } as const;
const TEST_CAPTURE = { source_id: testOnlyCapture.source_id, sha256_extracted: testOnlyCapture.sha256_extracted };
// Phase 3E: the TEST-ONLY package's overlay dataset, with TEST-ONLY lots; the gate computes every overlay.
const overlay = await syntheticLotOverlay(TEST_CAPTURE);

const VH: ProgramFactKey = "very-high-fire-hazard-severity-zone";
const HIGH: ProgramFactKey = "high-fire-hazard-severity-zone";
const FARM: ProgramFactKey = "prime-or-statewide-farmland";
const NCCP: ProgramFactKey = "nccp-conservation-land";
const EASEMENT: ProgramFactKey = "conservation-easement";

const C = "la_shra.very-high-fire-hazard-severity-zone";
const D = "la_shra.high-fire-hazard-severity-zone";
const E = "la_shra.prime-or-statewide-farmland";
const F = "la_shra.natural-community-conservation-plan-land";
const G = "la_shra.conservation-easement";
const C_TO_G = [C, D, E, F, G];
const LETTER: Readonly<Record<string, string>> = { [C]: "c", [D]: "d", [E]: "e", [F]: "f", [G]: "g" };

const rereview = humanRereviewDecisionsSchema.parse(rereviewJson);
const decidedGates = Object.fromEntries(rereview.decisions.map((entry) => [entry.criterion_id, entry.promotion_gates]));
const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const shippedById = new Map(shipped.map((criterion) => [criterion.id, criterion]));
const shippedCriterion = (id: string) => shippedById.get(id) as ProgramCriterion;

/* ------------------------------------------------------------ evidence */

function record(
  id: string,
  key: ProgramFactKey,
  value: boolean | null,
  options: { evidenceType?: CanonicalEvidenceRecord["evidence_type"]; agency?: string; conflictsWith?: string[] } = {},
): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const known = value !== null;
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: options.agency ?? "TEST-ONLY fictional agency",
      title: `TEST-ONLY ${key} record ${id}`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/phase-3c-tests/${id}`,
      authority: "official",
      retrieved_at: RETRIEVED_AT,
    },
    raw_observed_value: known ? { kind: "text", value: value ? "YES" : "NO" } : { kind: "not_observed", value: null },
    normalized_value: known ? { kind: "boolean", value } : { kind: "unknown", value: null, reason: "insufficient_evidence" },
    evidence_type: options.evidenceType ?? evidenceTypeFor(key),
    classification: known ? "source_observation" : "unknown",
    confidence: 99,
    conflicts_with: options.conflictsWith ?? [],
    review_status: "reviewed",
    notes: [],
    limitations: [],
    provenance: { source_record_id: `test-${id}`, capture_method: "manual_research", is_ai_generated: false },
  };
}

function evidenceTypeFor(key: ProgramFactKey): CanonicalEvidenceRecord["evidence_type"] {
  return key === NCCP || key === EASEMENT ? "official_document" : "official_map";
}

function anchors(): CanonicalEvidenceRecord[] {
  const spec = (key: ProgramFactKey) => programFactSpecs[key];
  const base = record("anchor-parcel-match", "parcel-match" as ProgramFactKey, true, { evidenceType: "official_portal" });
  return [
    { ...base, claim: { key: "parcel-match", label: spec("parcel-match").label, client_label: spec("parcel-match").client_label } },
    {
      ...base,
      id: "anchor-jurisdiction",
      claim: { key: "jurisdiction", label: spec("jurisdiction").label, client_label: spec("jurisdiction").client_label },
      raw_observed_value: { kind: "text", value: "City of Los Angeles" },
      normalized_value: { kind: "text", value: "City of Los Angeles" },
      source: { ...base.source, url: "https://records.example.test/phase-3c-tests/anchor-jurisdiction" },
    },
  ];
}

/** A City display: official, never an establishing record, with no statutory route. */
function display(id: string, key: ProgramFactKey, value: boolean): CanonicalEvidenceRecord {
  return record(id, key, value, { evidenceType: "official_portal", agency: "TEST-ONLY City parcel display" });
}

/* ------------------------------------------------------ authority blocks */

const setups: Partial<Record<ProgramFactKey, { kind: ProgramEvidenceAuthority["record_kind"]; issuer: string; source: string | null }>> = {
  [VH]: { kind: "agency_hazard_map", issuer: "test-only-fire-agency", source: "test-only-4202-map" },
  [HIGH]: { kind: "agency_hazard_map", issuer: "test-only-fire-agency", source: "test-only-4202-map" },
  [FARM]: { kind: "agency_farmland_map", issuer: "test-only-conservation-agency", source: "test-only-fmmp-map" },
  [NCCP]: { kind: "adopted_plan_document", issuer: "test-only-plan-agency", source: "test-only-nccp-plan" },
  [EASEMENT]: { kind: "recorded_instrument", issuer: "test-only-recorder", source: null },
};

function qualifiersFor(key: ProgramFactKey, value: boolean | null, route: string): ProgramEvidenceAuthority["qualifiers"] {
  switch (authorityFactProfiles[key].qualifier_family) {
    case "hazard_map":
      return {
        family: "hazard_map",
        hazard_class: authorityFactProfiles[key].hazard_class as "very_high" | "high",
        statutory_basis: route as "prc_4202",
        adoption_status: "adopted",
        named_agency: "department_of_forestry_and_fire_protection",
        map_covers_lot: "yes",
        legend_defines_class_for_lot: "yes",
        responsibility_area_as_stated: "not_stated",
        // Phase 3D: a reviewed lot geometry compared with the package's pinned overlay dataset.
        // Phase 3E: the gate computes the overlay; a YES lot lies wholly in the fact's class, a NO lot in Moderate only.
        lot_overlay: {
          method: "deterministic_spatial_overlay",
          dataset: TEST_CAPTURE,
          lot_geometry:
            overlay.lots[
              value === true ? (authorityFactProfiles[key].hazard_class === "very_high" ? "in-very-high" : "in-high") : value === false ? "in-moderate" : "high-and-moderate"
            ],
        },
      };
    case "farmland_map":
      return {
        family: "farmland_map",
        map_program: "farmland_mapping_and_monitoring_program",
        designation_class: value === false ? "other_or_none" : "prime_farmland",
        usda_criteria_documentation: TEST_CAPTURE,
      };
    case "adopted_plan":
      return {
        family: "adopted_plan",
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
        family: "recorded_instrument",
        document_number: "TEST-ONLY-DOC-0001",
        recording_date: "2015-06-01",
        instrument_character: "expressly_conservation_easement",
        in_force: "no_release_or_extinguishment_of_record",
        release_search: { scope: "complete_reviewed_history", repositories_searched: ["test-only-county-recorder"], searched_on: REVIEWED_ON },
      };
    default:
      return null;
  }
}

/**
 * A complete, reviewed block that a TEST-ONLY policy would accept. A hazard
 * block names `route` as its statutory basis (PRC §4202 unless given).
 */
function block(evidence: CanonicalEvidenceRecord, route = "prc_4202"): ProgramEvidenceAuthority {
  const key = evidence.claim.key as ProgramFactKey;
  const setup = setups[key];
  if (setup === undefined) throw new Error(`No TEST-ONLY setup for ${key}`);
  const value = evidence.normalized_value.kind === "boolean" ? evidence.normalized_value.value : null;
  return {
    schema_version: PROGRAM_EVIDENCE_AUTHORITY_VERSION,
    evidence_id: evidence.id,
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
    retrieved_at: evidence.source.retrieved_at,
    source_url: evidence.source.url,
    capture: { store: "repo_official_source", ...TEST_CAPTURE },
    parcel_relationship: {
      // Phase 3D: a hazard result is a spatial overlay of the lot on the pinned dataset.
      matched_by: authorityFactProfiles[key].qualifier_family === "hazard_map" ? "spatial_overlay" : "parcel_identifier",
      parcel_identifier: "TEST-ONLY-APN-0000",
      legal_lot_reference: "TEST-ONLY Tract 1, Lot 1",
      legal_lot_identity: "parcel_is_one_legal_lot",
    },
    coverage: value === true ? "whole_parcel" : value === false ? "none_of_parcel" : "partial_parcel",
    qualifiers: qualifiersFor(key, value, route),
    authority_review: { status: "reviewed", reviewer: REVIEWER, reviewed_on: REVIEWED_ON },
    notes: ["TEST-ONLY fictional authority block."],
    is_ai_generated: false,
  };
}

function edit(value: ProgramEvidenceAuthority, change: (draft: Record<string, any>) => void): ProgramEvidenceAuthority {
  const draft = structuredClone(value) as Record<string, any>;
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
  edition: { label: "TEST-ONLY edition", date: EDITION_DATE, date_kind: "adopted" as const },
  capture: TEST_CAPTURE,
  fact_keys: facts,
  superseded_by: null,
  review,
});
const viaSource = (kind: ProgramEvidenceAuthority["record_kind"], issuerId: string, sourceId: string, values: string[]) => ({
  record_kind: kind,
  identity: "registered_authority_source" as const,
  issuer_ids: [issuerId],
  authority_source_ids: [sourceId],
  values,
  currency_max_age_days: 90,
});

function policy(
  key: ProgramFactKey,
  family: ProgramFactAuthorityPolicy["family_policy"],
  establishing: ProgramFactAuthorityPolicy["establishing"],
): ProgramFactAuthorityPolicy {
  return {
    fact_key: key,
    family_policy: family,
    requires_legal_lot_identity: true,
    establishing,
    prohibited_establishing_kinds: pinnedProhibitedEstablishingKinds[key] ?? [],
    decision_refs: [],
  };
}

/** TEST-ONLY registries in which fictional authorities can establish every c-g fact that can be established at all. */
function testRegistries(requirements: Record<string, ProgramCriterionAuthorityRequirement> = {}): ProgramAuthorityRegistries {
  return {
    issuers: [
      issuer("test-only-fire-agency"),
      issuer("test-only-conservation-agency"),
      issuer("test-only-plan-agency"),
      issuer("test-only-recorder"),
    ],
    sources: [
      // Phase 3D: a hazard source establishes only through a reviewed authority package.
      {
        ...source("test-only-4202-map", "agency_hazard_map", "test-only-fire-agency", [VH, HIGH]),
        package: {
          manifest_sha256: "0".repeat(64),
          statutory_basis: "prc_4202" as const,
          adoption: { status: "adopted" as const, adoption_date: EDITION_DATE, effective_date: EDITION_DATE },
          currency: "until_superseded" as const,
          members: { adopted_map: TEST_CAPTURE, adopting_regulation: TEST_CAPTURE, overlay_dataset: TEST_CAPTURE },
          overlay: {
            dataset_name: "TEST_ONLY_FHSZ",
            class_field: "CLASS",
            class_labels: { "Very High": "very_high" as const, High: "high" as const, Moderate: "moderate" as const },
          },
        },
      },
      source("test-only-fmmp-map", "agency_farmland_map", "test-only-conservation-agency", [FARM]),
      source("test-only-nccp-plan", "adopted_plan_document", "test-only-plan-agency", [NCCP]),
    ],
    fact_policies: {
      [VH]: policy(VH, { family: "hazard_map", hazard_class: "very_high", require_legend_class: false }, [
        viaSource("agency_hazard_map", "test-only-fire-agency", "test-only-4202-map", ["true", "false"]),
      ]),
      [HIGH]: policy(HIGH, { family: "hazard_map", hazard_class: "high", require_legend_class: true }, [
        viaSource("agency_hazard_map", "test-only-fire-agency", "test-only-4202-map", ["true", "false"]),
      ]),
      [FARM]: policy(FARM, { family: "farmland_map", accepted_usda_criteria_documentation: [TEST_CAPTURE] }, [
        viaSource("agency_farmland_map", "test-only-conservation-agency", "test-only-fmmp-map", ["true"]),
      ]),
      [NCCP]: policy(NCCP, { family: "adopted_plan" }, [
        viaSource("adopted_plan_document", "test-only-plan-agency", "test-only-nccp-plan", ["true"]),
      ]),
      [EASEMENT]: policy(EASEMENT, { family: "recorded_instrument", required_release_search_repositories: ["test-only-county-recorder"] }, [
        {
          record_kind: "recorded_instrument",
          identity: "recorded_instrument_identity",
          issuer_ids: ["test-only-recorder"],
          authority_source_ids: [],
          values: ["true"],
          currency_max_age_days: null,
        },
      ]),
    },
    criterion_requirements: requirements,
  };
}

function enforcedRequirement(criterionId: string): ProgramCriterionAuthorityRequirement {
  return {
    criterion_id: criterionId,
    applicability: "enforced",
    decision_ref: { round: 99, letter: "z" },
    promotion_gates: ["reviewer_confirms_encoded_rule", "human_verification_record"],
    scope_preconditions: [],
    numeric_boundaries: [],
  };
}

/** TEST-ONLY registries plus the shipped c-g requirements, for the promotion gates. */
function populatedWithShippedRequirements(): ProgramAuthorityRegistries {
  return testRegistries(
    Object.fromEntries(C_TO_G.map((id) => [id, programAuthorityRegistries.criterion_requirements[id]])),
  );
}

/* ------------------------------------------------------------ criteria */

const booleanRule =
  (key: ProgramFactKey): CriterionPredicate =>
  (facts) => {
    const value = facts[key];
    return value?.kind === "boolean" && value.value ? "disqualifying_per_source" : "consistent_with_source";
  };

/** TEST-ONLY synthetic criterion: repo_sourced so it runs, outside the 46 atomic criteria. */
function synthetic(id: string, key: ProgramFactKey, extra: Partial<ProgramCriterion> = {}): ProgramCriterion {
  return {
    id,
    pathway: "la_shra",
    label: "TEST-ONLY synthetic Phase 3C criterion",
    gating: false,
    fact_keys: [key],
    predicate: booleanRule(key),
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "TEST-ONLY synthetic rule used to exercise the Phase 3C gates.",
    citation: {
      title: "TEST-ONLY synthetic citation",
      url: "https://records.example.test/phase-3c-tests/citation",
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

const ROUTES_ID = "la_shra.test-only-vh-routes";
/** The c model: the Very High fact assessed per statutory route. */
const routeCriterion = (predicate?: CriterionPredicate) =>
  synthetic(ROUTES_ID, VH, {
    statutory_routes: { fact_key: VH, routes: ["gov_51178", "prc_4202"] },
    ...(predicate === undefined ? {} : { predicate }),
  });

function screen(
  criterion: ProgramCriterion,
  records: CanonicalEvidenceRecord[],
  options: { blocks?: ProgramEvidenceAuthority[]; registries?: ProgramAuthorityRegistries } = {},
) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchors(), ...records],
    as_of: AS_OF,
    packs: [{ pathway: shraPathway, criteria: [parcelMatchCriterion("la_shra"), jurisdictionCriterion("la_shra"), criterion] }],
    evidence_authority: options.blocks,
    authority_registries: options.registries,
    lot_overlay: overlay.inputs,
  });
  return { result, pathway: result.pathways[0], criterion: result.pathways[0].criteria[2] };
}

/** The route criterion, gated by an enforced requirement under TEST-ONLY registries. */
const gatedRoutes = (records: CanonicalEvidenceRecord[], blocks: ProgramEvidenceAuthority[], predicate?: CriterionPredicate) =>
  screen(routeCriterion(predicate), records, { blocks, registries: testRegistries({ [ROUTES_ID]: enforcedRequirement(ROUTES_ID) }) });

function failureCodes(result: ProgramCriterionResult): string[] {
  return (result.authority?.facts ?? []).flatMap((fact) => fact.non_establishing.flatMap((entry) => entry.failures));
}

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

/** Route records: [value on GOV §51178, value on PRC §4202]; undefined means no record on that route. */
function routeRecords(route1: boolean | null | undefined, route2: boolean | null | undefined) {
  const records: CanonicalEvidenceRecord[] = [];
  const blocks: ProgramEvidenceAuthority[] = [];
  const add = (id: string, value: boolean | null | undefined, route: string) => {
    if (value === undefined) return;
    const evidence = record(id, VH, value);
    records.push(evidence);
    blocks.push(block(evidence, route));
  };
  add("route-1-51178", route1, "gov_51178");
  add("route-2-4202", route2, "prc_4202");
  return { records, blocks };
}

/* ======================================================================== */

describe("1. c: the two statutory routes are assessed separately", () => {
  it("keeps a Route 1 YES and a Route 2 NO as two route results, not a generic Layer 1 conflict", () => {
    const { records, blocks } = routeRecords(true, false);
    // The shipped c: pending, so it never runs its rule, but its status is route-separated.
    const shippedScreen = evaluateProgramScreen({
      evidence_records: [...anchors(), ...records],
      as_of: AS_OF,
      evidence_authority: blocks,
    });
    const c = shippedScreen.pathways[0].criteria.find((criterion) => criterion.criterion_id === C) as ProgramCriterionResult;
    expect(c.status).toBe("unreviewed");
    expect(c.statutory_routes).toEqual([
      { route: "gov_51178", fact_key: VH, classification: "source_observation", supplied: true, reviewed: true, value: true, evidence_ids: ["route-1-51178"] },
      { route: "prc_4202", fact_key: VH, classification: "source_observation", supplied: true, reviewed: true, value: false, evidence_ids: ["route-2-4202"] },
    ]);
    // Layer 1 for the shared fact is unchanged: other pathways still see the disagreement.
    expect(shippedScreen.facts.find((fact) => fact.key === VH)?.classification).toBe("conflict");
    // A running route-separated criterion reaches its rule and documents the YES.
    const { criterion } = screen(routeCriterion(), records, { blocks });
    expect(criterion.status).toBe("disqualifying_per_source");
  });

  const cases: Array<[boolean | null | undefined, boolean | null | undefined, CriterionStatus]> = [];
  for (const route1 of [true, false, null, undefined]) {
    for (const route2 of [true, false, null, undefined]) {
      const expected: CriterionStatus =
        route1 === true || route2 === true ? "disqualifying_per_source" : route1 === false && route2 === false ? "consistent_with_source" : "unknown";
      cases.push([route1, route2, expected]);
    }
  }
  it.each(cases)("Route 1 %s and Route 2 %s -> %s (YES on either route; NO only on both)", (route1, route2, expected) => {
    const spy = vi.fn(booleanRule(VH));
    const { records, blocks } = routeRecords(route1, route2);
    const { criterion } = screen(routeCriterion(spy), records, { blocks });
    expect(criterion.status).toBe(expected);
    expect(spy).toHaveBeenCalledTimes(expected === "unknown" ? 0 : 1);
    if (expected === "consistent_with_source") expect(spy.mock.calls[0][0][VH]).toEqual({ kind: "boolean", value: false });
    if (expected === "disqualifying_per_source") expect(spy.mock.calls[0][0][VH]).toEqual({ kind: "boolean", value: true });
  });

  it("never lets a negative on one route alone clear the criterion", () => {
    for (const [route1, route2] of [[false, undefined], [undefined, false], [false, null], [null, false]] as const) {
      const { records, blocks } = routeRecords(route1, route2);
      const { criterion } = screen(routeCriterion(), records, { blocks });
      expect(criterion.status, `${route1} / ${route2}`).toBe("unknown");
      expect(criterion.statement, `${route1} / ${route2}`).toContain("missing evidence is not treated as a no");
    }
  });

  it("keeps contradictory records within one route a Layer 1 conflict, whatever the other route shows", () => {
    for (const other of [true, false, undefined]) {
      const yes = record("route-2-yes", VH, true);
      const no = record("route-2-no", VH, false);
      const { records, blocks } = routeRecords(other, undefined);
      const { criterion } = screen(routeCriterion(), [...records, yes, no], { blocks: [...blocks, block(yes), block(no)] });
      expect(criterion.status, String(other)).toBe("conflict");
      expect(criterion.statutory_routes?.find((route) => route.route === "prc_4202")?.classification).toBe("conflict");
    }
  });

  it("counts a record with no route toward every route, so a City display still conflicts and never lets NO clear", () => {
    const zimasNo = display("zimas-no", VH, false);
    const zimasYes = display("zimas-yes", VH, true);
    const yes = routeRecords(undefined, true);
    expect(screen(routeCriterion(), [...yes.records, zimasNo], { blocks: yes.blocks }).criterion.status).toBe("conflict");
    const bothNo = routeRecords(false, false);
    const shown = screen(routeCriterion(), [...bothNo.records, zimasYes], { blocks: bothNo.blocks }).criterion;
    expect(shown.status).toBe("conflict");
    expect(shown.statutory_routes?.map((route) => route.classification)).toEqual(["conflict", "conflict"]);
  });

  it("reads a record whose block names another basis, or no block at all, as unrouted", () => {
    const other = record("vh-other-basis", VH, true);
    const plain = record("vh-no-block", VH, false);
    const { criterion } = screen(routeCriterion(), [other, plain], { blocks: [block(other, "other_basis")] });
    // No record names a route, so every route holds both records: the single-fact conflict, unchanged.
    expect(criterion.status).toBe("conflict");
    expect("statutory_routes" in criterion).toBe(false);
  });

  it("never combines partial coverage across routes", () => {
    const { records, blocks } = routeRecords(null, null);
    const { criterion } = screen(routeCriterion(), records, { blocks });
    expect(criterion.status).toBe("unknown");
    expect(criterion.statutory_routes?.map((route) => route.value)).toEqual([null, null]);
  });

  it("honours an explicit conflict link between records on different routes", () => {
    const route1 = record("linked-51178", VH, true, { conflictsWith: ["linked-4202"] });
    const route2 = record("linked-4202", VH, false);
    const { criterion } = screen(routeCriterion(), [route1, route2], {
      blocks: [block(route1, "gov_51178"), block(route2, "prc_4202")],
    });
    expect(criterion.status).toBe("conflict");
  });

  it("describes an unknown route by its route in the statement and question", () => {
    const { records, blocks } = routeRecords(undefined, false);
    const { criterion, pathway } = screen(routeCriterion(), records, { blocks });
    expect(criterion.statement).toContain("Under the GOV §51178 route: Available evidence is insufficient to determine");
    const question = pathway.planning_questions.find((candidate) => candidate.criterion_ids.includes(ROUTES_ID));
    expect(question?.trigger).toBe("unknown");
    expect(question?.why_confirmation_needed).toContain("Under the GOV §51178 route");
    expect(findProhibitedClientLanguage(criterion.statement)).toEqual([]);
  });

  it("requires a route-separated criterion to assess every route its class rests on", () => {
    expect(programCriterionSchema.safeParse(routeCriterion()).success).toBe(true);
    for (const statutory_routes of [
      { fact_key: VH, routes: ["prc_4202", "prc_4202"] },
      { fact_key: VH, routes: ["prc_4202"] },
      { fact_key: HIGH, routes: ["gov_51178", "prc_4202"] },
      { fact_key: FARM, routes: ["gov_51178", "prc_4202"] },
    ]) {
      expect(programCriterionSchema.safeParse({ ...routeCriterion(), statutory_routes }).success, JSON.stringify(statutory_routes)).toBe(false);
    }
    expect(hazardClassStatutoryRoutes).toEqual({ very_high: ["gov_51178", "prc_4202"], high: ["prc_4202"] });
    expect(shippedCriterion(C).statutory_routes).toEqual({ fact_key: VH, routes: ["gov_51178", "prc_4202"] });
    for (const id of [D, E, F, G]) expect(shippedCriterion(id).statutory_routes, id).toBeUndefined();
  });
});

/* ======================================================================== */

describe("2. c: route authority fails closed and never manufactures conflict", () => {
  it("establishes a YES on the PRC §4202 route from a registered, reviewed map", () => {
    const { records, blocks } = routeRecords(undefined, true);
    const { criterion } = gatedRoutes(records, blocks);
    expect(criterion).toMatchObject({
      status: "disqualifying_per_source",
      authority: { established: true, facts: [{ key: VH, route: "prc_4202", established: true, establishing_evidence_ids: ["route-2-4202"] }] },
    });
  });

  it("refuses these unregistered GOV §51178 test records after Phase 3G defines its kind", () => {
    expect(statutoryRouteRecordKinds).toEqual({ gov_51178: "agency_hazard_map", prc_4202: "agency_hazard_map" });
    const yesOnRoute1 = routeRecords(true, false);
    const yes = gatedRoutes(yesOnRoute1.records, yesOnRoute1.blocks).criterion;
    expect(yes.status).toBe("unknown");
    expect(yes.authority?.facts.map((fact) => fact.route)).toEqual(["gov_51178"]);
    expect(failureCodes(yes)).toContain("statutory_route_not_accepted");
    expect(yes.statement).toContain("(GOV §51178 route)");

    // These synthetic GOV records lack the newly registered Route 1 package.
    const bothNo = routeRecords(false, false);
    const no = gatedRoutes(bothNo.records, bothNo.blocks).criterion;
    expect(no.status).toBe("unknown");
    expect(no.authority?.facts.map((fact) => [fact.route, fact.established])).toEqual([
      ["gov_51178", false],
      ["prc_4202", true],
    ]);
  });

  it("does not let a NO route cancel an established YES route", () => {
    // Route 1 NO, Route 2 YES: only the YES route is gated, and it establishes.
    const noThenYes = routeRecords(false, true);
    const yes = gatedRoutes(noThenYes.records, noThenYes.blocks).criterion;
    expect(yes.status).toBe("disqualifying_per_source");
    expect(yes.authority?.facts.map((fact) => [fact.route, fact.established])).toEqual([["prc_4202", true]]);
    // YES on both routes: Route 1 cannot establish, Route 2 is enough.
    const both = routeRecords(true, true);
    const either = gatedRoutes(both.records, both.blocks).criterion;
    expect(either.status).toBe("disqualifying_per_source");
    expect(either.authority?.facts.map((fact) => [fact.route, fact.established])).toEqual([
      ["gov_51178", false],
      ["prc_4202", true],
    ]);
  });

  it.each([
    ["no statutory basis recorded", (draft: Record<string, any>) => (draft.qualifiers.statutory_basis = "not_established"), "statutory_route_not_accepted"],
    ["another statutory basis", (draft: Record<string, any>) => (draft.qualifiers.statutory_basis = "other_basis"), "statutory_route_not_accepted"],
    ["another named agency", (draft: Record<string, any>) => (draft.qualifiers.named_agency = "other_agency"), "statutory_agency_not_recorded"],
    ["no named agency", (draft: Record<string, any>) => (draft.qualifiers.named_agency = "not_established"), "statutory_agency_not_recorded"],
    ["a map whose adopted status is not established", (draft: Record<string, any>) => (draft.qualifiers.adoption_status = "not_established"), "hazard_map_adoption_not_established"],
    // Updated in Phase 3E: coverage is computed from the lot geometry, never read from map_covers_lot.
    ["a lot only partly inside the dataset's features", (draft: Record<string, any>) => (draft.qualifiers.lot_overlay.lot_geometry = overlay.lots["very-high-and-outside"]), "hazard_area_not_covered"],
  ])("leaves c unknown for %s", (_name, change, code) => {
    const evidence = record("vh-4202", VH, true);
    const { criterion } = gatedRoutes([evidence], [edit(block(evidence), change)]);
    expect(criterion.status).toBe("unknown");
    expect(failureCodes(criterion)).toContain(code);
  });

  it("only ever downgrades the ungated route result, and never manufactures a conflict", () => {
    const registrySets: Array<[string, ProgramAuthorityRegistries]> = [
      ["TEST-ONLY", testRegistries({ [ROUTES_ID]: enforcedRequirement(ROUTES_ID) })],
      ["shipped", { ...programAuthorityRegistries, criterion_requirements: { [ROUTES_ID]: enforcedRequirement(ROUTES_ID) } }],
    ];
    const values = [true, false, null, undefined] as const;
    let checked = 0;
    for (const route1 of values) {
      for (const route2 of values) {
        for (const withDisplay of [undefined, true, false]) {
          const { records, blocks } = routeRecords(route1, route2);
          if (withDisplay !== undefined) records.push(display("zimas", VH, withDisplay));
          if (records.length === 0) continue;
          const ungated = screen(routeCriterion(), records, { blocks });
          for (const [name, registries] of registrySets) {
            const label = `${route1}/${route2}/display ${withDisplay}/${name}`;
            const gated = screen(routeCriterion(), records, { blocks, registries });
            expect(gated.result.facts, label).toEqual(ungated.result.facts);
            expect([ungated.criterion.status, "unknown"], label).toContain(gated.criterion.status);
            expect(gated.criterion.status === "conflict", label).toBe(ungated.criterion.status === "conflict");
            if (gated.criterion.status === "consistent_with_source" || gated.criterion.status === "disqualifying_per_source") {
              expect(gated.criterion.authority?.established, label).toBe(true);
              expect(name, label).toBe("TEST-ONLY");
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(80);
  });
});

/* ======================================================================== */

describe("3. d: the PRC §4202 route only, decided by lot coverage and the legend's High class", () => {
  const D_ID = "la_shra.test-only-high";
  const run = (value: boolean, change: (draft: Record<string, any>) => void = () => undefined) => {
    const evidence = record("high-4202", HIGH, value);
    return screen(synthetic(D_ID, HIGH), [evidence], {
      blocks: [edit(block(evidence), change)],
      registries: testRegistries({ [D_ID]: enforcedRequirement(D_ID) }),
    }).criterion;
  };

  it("establishes YES and NO from a PRC §4202 map that covers the lot and defines High there", () => {
    expect(run(true)).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });
    expect(run(false)).toMatchObject({ status: "consistent_with_source", authority: { established: true } });
  });

  it.each(["gov_51178", "other_basis", "not_established"])("never accepts a %s record for High", (basis) => {
    for (const value of [true, false]) {
      const result = run(value, (draft) => (draft.qualifiers.statutory_basis = basis));
      expect(result.status, `${basis} ${value}`).toBe("unknown");
      expect(failureCodes(result), `${basis} ${value}`).toContain("statutory_route_not_accepted");
    }
  });

  // Updated in Phase 3E: whether the map covers the lot is computed by the lot overlay; the block's
  // map_covers_lot is context only and can neither create nor remove coverage.
  it.each(["yes", "no", "not_established"])("stays unknown for a lot only partly covered, whatever map_covers_lot says (%s)", (coverage) => {
    for (const [value, lot] of [[true, "high-and-outside"], [false, "moderate-and-outside"]] as const) {
      const result = run(value, (draft) => {
        draft.qualifiers.map_covers_lot = coverage;
        draft.qualifiers.lot_overlay.lot_geometry = overlay.lots[lot];
      });
      expect(result.status).toBe("unknown");
      expect(failureCodes(result)).toContain("hazard_area_not_covered");
    }
    expect(run(true, (draft) => (draft.qualifiers.map_covers_lot = coverage)).status).toBe("disqualifying_per_source");
  });

  it("stays unknown when the legend does not define a High class for the lot's area", () => {
    for (const [value, legend] of [[false, "no"], [false, "not_established"], [true, "not_established"]] as const) {
      const result = run(value, (draft) => (draft.qualifiers.legend_defines_class_for_lot = legend));
      expect(result.status, `${value} ${legend}`).toBe("unknown");
      expect(failureCodes(result), `${value} ${legend}`).toContain("hazard_legend_class_not_defined");
    }
    // A YES inside a class the legend does not define is a contradiction and is rejected.
    const evidence = record("high-4202", HIGH, true);
    expectCode(
      () =>
        screen(synthetic(D_ID, HIGH), [evidence], {
          blocks: [edit(block(evidence), (draft) => (draft.qualifiers.legend_defines_class_for_lot = "no"))],
          registries: testRegistries({ [D_ID]: enforcedRequirement(D_ID) }),
        }),
      "INVALID_PROGRAM_EVIDENCE_AUTHORITY",
    );
  });

  it("records responsibility area as context only: it never changes a result", () => {
    for (const area of ["state", "local", "federal", "not_stated"]) {
      expect(run(true, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe("disqualifying_per_source");
      expect(run(false, (draft) => (draft.qualifiers.responsibility_area_as_stated = area)).status, area).toBe("consistent_with_source");
    }
  });
});

/* ======================================================================== */

describe("3b. PRC §4202: an adopted CAL FIRE map, dated by its edition or its adoption date", () => {
  // Phase 3B d point 6: "map identity, edition or adoption date". Adopted
  // status is its own reviewed field; the date may be of either kind.
  const D_ID = "la_shra.test-only-high-date";
  const subjects: Array<[string, ProgramFactKey, () => ProgramCriterion, readonly boolean[]]> = [
    // c can establish only YES on Route 2: a NO needs GOV §51178 too.
    ["c, Route 2", VH, () => routeCriterion(), [true]],
    ["d", HIGH, () => synthetic(D_ID, HIGH), [true, false]],
  ];
  const run = (build: () => ProgramCriterion, key: ProgramFactKey, value: boolean, change: (draft: Record<string, any>) => void) => {
    const criterion = build();
    const evidence = record(`map-4202-${String(value)}`, key, value);
    return screen(criterion, [evidence], {
      blocks: [edit(block(evidence), change)],
      registries: testRegistries({ [criterion.id]: enforcedRequirement(criterion.id) }),
    }).criterion;
  };
  const byEdition = (draft: Record<string, any>) =>
    Object.assign(draft.edition, { label: "TEST-ONLY 2026 edition", date: EDITION_DATE, date_kind: "effective" });
  const byAdoptionDate = (draft: Record<string, any>) =>
    Object.assign(draft.edition, { label: null, date: EDITION_DATE, date_kind: "adopted" });
  const expected = (value: boolean) => (value ? "disqualifying_per_source" : "consistent_with_source");

  it.each(subjects)("%s: establishes an adopted map identified by its edition and version", (_name, key, build, values) => {
    for (const value of values) {
      expect(run(build, key, value, byEdition), String(value)).toMatchObject({ status: expected(value), authority: { established: true } });
    }
  });

  it.each(subjects)("%s: establishes an adopted map dated by its adoption date", (_name, key, build, values) => {
    for (const value of values) {
      expect(run(build, key, value, byAdoptionDate), String(value)).toMatchObject({ status: expected(value), authority: { established: true } });
    }
  });

  it.each(subjects)("%s: stays unknown when adopted status is not established, whichever date the map carries", (_name, key, build, values) => {
    for (const value of values) {
      for (const [status, dating] of [
        ["not_established", byEdition],
        ["not_established", byAdoptionDate],
        ["not_adopted", byEdition],
      ] as const) {
        const result = run(build, key, value, (draft) => {
          dating(draft);
          draft.qualifiers.adoption_status = status;
        });
        expect(result.status, `${value} ${status}`).toBe("unknown");
        expect(failureCodes(result), `${value} ${status}`).toContain("hazard_map_adoption_not_established");
      }
      // An adoption date on a map recorded as not adopted is a contradiction.
      expectCode(
        () =>
          run(build, key, value, (draft) => {
            byAdoptionDate(draft);
            draft.qualifiers.adoption_status = "not_adopted";
          }),
        "INVALID_PROGRAM_EVIDENCE_AUTHORITY",
      );
    }
  });

  it.each(subjects)("%s: stays unknown without map identity or a dated version", (_name, key, build, values) => {
    for (const value of values) {
      const unidentified = run(build, key, value, (draft) => (draft.source_identifier = { scheme: "portal_url_only", value: "TEST-ONLY map page" }));
      expect(unidentified.status).toBe("unknown");
      expect(failureCodes(unidentified)).toContain("authority_source_not_registered");
      const undated = run(build, key, value, (draft) => Object.assign(draft.edition, { label: "TEST-ONLY 2026 edition", date: null, date_kind: null }));
      expect(undated.status).toBe("unknown");
      expect(failureCodes(undated)).toContain("edition_not_established");
    }
  });
});

/* ======================================================================== */

describe("4. Legal-lot identity fails closed for c-g", () => {
  const cases: Array<[string, ProgramFactKey, () => ProgramCriterion]> = [
    ["c", VH, () => routeCriterion()],
    ["d", HIGH, () => synthetic("la_shra.test-only-lot-d", HIGH)],
    ["e", FARM, () => synthetic("la_shra.test-only-lot-e", FARM)],
    ["f", NCCP, () => synthetic("la_shra.test-only-lot-f", NCCP)],
    ["g", EASEMENT, () => synthetic("la_shra.test-only-lot-g", EASEMENT)],
  ];
  const unclear: Array<[string, (draft: Record<string, any>) => void]> = [
    ["parcel_and_legal_lot_differ", (draft) => (draft.parcel_relationship.legal_lot_identity = "parcel_and_legal_lot_differ")],
    ["tied_or_multiple_lots", (draft) => (draft.parcel_relationship.legal_lot_identity = "tied_or_multiple_lots")],
    ["merger_or_resubdivision_pending_or_proposed", (draft) => (draft.parcel_relationship.legal_lot_identity = "merger_or_resubdivision_pending_or_proposed")],
    ["not_established", (draft) => (draft.parcel_relationship.legal_lot_identity = "not_established")],
    ["no named legal lot", (draft) => (draft.parcel_relationship.legal_lot_reference = null)],
  ];

  function run(criterion: ProgramCriterion, key: ProgramFactKey, change: (draft: Record<string, any>) => void) {
    const evidence = record(`lot-${key}`, key, true);
    return screen(criterion, [evidence], {
      blocks: [edit(block(evidence), change)],
      registries: testRegistries({ [criterion.id]: enforcedRequirement(criterion.id) }),
    }).criterion;
  }

  it.each(cases)("%s: establishes only when the APN/parcel is one named legal lot", (letter, key, build) => {
    const clear = run(build(), key, () => undefined);
    if (letter === "g") {
      // D10: a parcel's own instrument waits on the case-scoped store, so g never establishes yet.
      expect(failureCodes(clear)).toEqual(["capture_not_verified"]);
    } else {
      expect(clear.status).toBe("disqualifying_per_source");
    }
    for (const [name, change] of unclear) {
      const spy = vi.fn(booleanRule(key));
      const criterion = { ...build(), predicate: spy };
      const result = run(criterion, key, change);
      expect(result.status, `${letter}: ${name}`).toBe("unknown");
      expect(failureCodes(result), `${letter}: ${name}`).toContain("legal_lot_identity_not_established");
      expect(spy, `${letter}: ${name}`).not.toHaveBeenCalled();
    }
  });

  it("pins legal-lot identity on every c-g policy, shipped and TEST-ONLY", () => {
    expect(legalLotIdentityFacts).toEqual(["lot-area", "prior-shra-or-sb9-map", VH, HIGH, FARM, NCCP, EASEMENT]);
    for (const key of [VH, HIGH, FARM, NCCP, EASEMENT]) {
      expect(programAuthorityRegistries.fact_policies[key]?.requires_legal_lot_identity, key).toBe(true);
      const loose = structuredClone(testRegistries()) as Record<string, any>;
      loose.fact_policies[key].requires_legal_lot_identity = false;
      expectCode(() => parseProgramAuthorityRegistries(loose as ProgramAuthorityRegistries), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
    }
    expect(() => parseProgramAuthorityRegistries(testRegistries())).not.toThrow();
  });
});

/* ======================================================================== */

describe("5. e: an FMMP map whose legend ties its categories to the USDA criteria", () => {
  const E_ID = "la_shra.test-only-farmland";
  const run = (change: (draft: Record<string, any>) => void = () => undefined, registries = testRegistries({ [E_ID]: enforcedRequirement(E_ID) })) => {
    const evidence = record("fmmp", FARM, true);
    return screen(synthetic(E_ID, FARM), [evidence], { blocks: [edit(block(evidence), change)], registries }).criterion;
  };

  it("establishes YES from a TEST-ONLY FMMP map with reviewed USDA-criteria documentation", () => {
    expect(run()).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });
  });

  it.each([
    ["no USDA-criteria documentation", (draft: Record<string, any>) => (draft.qualifiers.usda_criteria_documentation = null), "farmland_usda_criteria_not_established"],
    ["documentation no reviewer accepted", (draft: Record<string, any>) => (draft.qualifiers.usda_criteria_documentation = { source_id: "shra-2025-10-28", sha256_extracted: "0".repeat(64) }), "farmland_usda_criteria_not_established"],
    ["another map program", (draft: Record<string, any>) => (draft.qualifiers.map_program = "other_program"), "farmland_map_program_not_established"],
    ["an unestablished map program", (draft: Record<string, any>) => (draft.qualifiers.map_program = "not_established"), "farmland_map_program_not_established"],
    ["an unestablished designation", (draft: Record<string, any>) => (draft.qualifiers.designation_class = "not_established"), "farmland_designation_not_established"],
    ["a map without its edition date", (draft: Record<string, any>) => Object.assign(draft.edition, { date: null, date_kind: null }), "edition_not_established"],
  ])("stays unknown with %s", (_name, change, code) => {
    const result = run(change);
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain(code);
  });

  it("stays unknown when the policy accepts no USDA-criteria documentation, and a registry cannot populate it that way", () => {
    const registries = structuredClone(testRegistries({ [E_ID]: enforcedRequirement(E_ID) })) as Record<string, any>;
    registries.fact_policies[FARM].family_policy.accepted_usda_criteria_documentation = [];
    expectCode(() => parseProgramAuthorityRegistries(registries as ProgramAuthorityRegistries), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
    const otherKind = structuredClone(testRegistries()) as Record<string, any>;
    otherKind.fact_policies[FARM].establishing[0].record_kind = "agency_hazard_map";
    expectCode(() => parseProgramAuthorityRegistries(otherKind as ProgramAuthorityRegistries), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
  });

  it("never establishes NO, and rejects a designation that contradicts the recorded value", () => {
    const evidence = record("fmmp-no", FARM, false);
    const no = screen(synthetic(E_ID, FARM), [evidence], {
      blocks: [block(evidence)],
      registries: testRegistries({ [E_ID]: enforcedRequirement(E_ID) }),
    }).criterion;
    expect(no.status).toBe("unknown");
    expect(failureCodes(no)).toContain("value_not_establishable");
    const yes = record("fmmp", FARM, true);
    expectCode(
      () => screen(synthetic(E_ID, FARM), [yes], { blocks: [edit(block(yes), (draft) => (draft.qualifiers.designation_class = "other_or_none"))] }),
      "INVALID_PROGRAM_EVIDENCE_AUTHORITY",
    );
  });

  it("ships the farmland policy with no accepted documentation and nothing establishing", () => {
    expect(programAuthorityRegistries.fact_policies[FARM]).toMatchObject({
      family_policy: { family: "farmland_map", accepted_usda_criteria_documentation: [] },
      establishing: [],
    });
    const shippedGated = run(() => undefined, { ...programAuthorityRegistries, criterion_requirements: { [E_ID]: enforcedRequirement(E_ID) } });
    expect(shippedGated.status).toBe("unknown");
  });
});

/* ======================================================================== */

describe("6. f: only an NCCP adopted under Fish and Game Code §2800 et seq.", () => {
  const F_ID = "la_shra.test-only-nccp";
  const run = (change: (draft: Record<string, any>) => void = () => undefined) => {
    const evidence = record("plan", NCCP, true);
    return screen(synthetic(F_ID, NCCP), [evidence], {
      blocks: [edit(block(evidence), change)],
      registries: testRegistries({ [F_ID]: enforcedRequirement(F_ID) }),
    }).criterion;
  };

  it("establishes YES from an adopted NCCP", () => {
    expect(run()).toMatchObject({ status: "disqualifying_per_source", authority: { established: true } });
  });

  it.each([
    ["a habitat conservation plan", { plan_type: "habitat_conservation_plan", statutory_basis: "federal_endangered_species_act" }],
    ["another natural resource protection plan", { plan_type: "other_natural_resource_protection_plan", statutory_basis: "other_basis" }],
    ["an unestablished plan type", { plan_type: "not_established", statutory_basis: "fish_and_game_code_2800_et_seq" }],
    ["an NCCP label without the Act as its basis", { plan_type: "natural_community_conservation_plan", statutory_basis: "federal_endangered_species_act" }],
    ["an NCCP with an unestablished basis", { plan_type: "natural_community_conservation_plan", statutory_basis: "not_established" }],
  ])("never establishes f from %s", (_name, qualifiers) => {
    const result = run((draft) => Object.assign(draft.qualifiers, qualifiers));
    expect(result.status).toBe("unknown");
    expect(failureCodes(result)).toContain("plan_type_not_nccp");
  });
});

/* ======================================================================== */

describe("7. The Phase 3B promotion gates are wired", () => {
  function humanRecord(criterion: ProgramCriterion, decisionRef: ProgramDecisionRef): ProgramCriterionHumanVerification {
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
        source_type: "official_memo",
        operative_status: "operative",
      },
      decision_ref: decisionRef,
    };
  }
  const promote = (criterion: ProgramCriterion, predicate: CriterionPredicate, decisionRef: ProgramDecisionRef): ProgramCriterion => ({
    ...criterion,
    predicate,
    question_if_judgment: "How does Planning apply this criterion?",
    verification: "human_verified",
    human_verification: humanRecord(criterion, decisionRef),
  });

  it("adds exactly the five Phase 3B gates and retires the responsibility-area gate", () => {
    const introduced = rereviewIntroducedPromotionGates["3B"];
    expect([...introduced].sort()).toEqual(Object.keys(rereview.gate_definitions).sort());
    expect(criterionPromotionGates.slice(-5)).toEqual([...introduced]);
    expect(retiredCriterionPromotionGates).toEqual(["responsibility_area_and_legend_recorded"]);
    for (const requirement of Object.values(programAuthorityRegistries.criterion_requirements)) {
      expect(requirement.promotion_gates, requirement.criterion_id).not.toContain("responsibility_area_and_legend_recorded");
    }
    const withRetired = structuredClone(programAuthorityRegistries) as Record<string, any>;
    withRetired.criterion_requirements[D].promotion_gates.push("responsibility_area_and_legend_recorded");
    expectCode(() => parseProgramAuthorityRegistries(withRetired as ProgramAuthorityRegistries), "INVALID_PROGRAM_AUTHORITY_REGISTRY");
    // A retired gate is never met, even against registries that would have met it.
    expect(authorityPromotionBlockers(shippedCriterion(D), withRetired as ProgramAuthorityRegistries, true)).toContain(
      "responsibility_area_and_legend_recorded",
    );
  });

  it("points c-g at their Phase 3B decisions and requires exactly the decided gates, unmet except where Phase 3D met them", () => {
    // Updated in Phase 3D: the registered PRC §4202 package meets every non-reviewer gate of d,
    // and every gate of c but statutory_route_recorded (GOV §51178 has no record kind).
    const reviewer = ["reviewer_confirms_encoded_rule", "human_verification_record"];
    // Updated in Phase 3E: the shipped d carries a human record citing the Phase 3B d decision, so only the
    // record-completeness flag passed here (false) is unmet; with its real record, no gate of d is unmet.
    const unmet: Record<string, readonly string[]> = {
      ...decidedGates,
      [C]: reviewer,
      [D]: ["human_verification_record"],
    };
    expect(authorityPromotionBlockers(shippedCriterion(D), programAuthorityRegistries, true)).toEqual([]);
    for (const id of C_TO_G) {
      const requirement = programAuthorityRegistries.criterion_requirements[id];
      expect(requirement.decision_ref, id).toEqual({ phase: "3B", letter: LETTER[id] });
      expect(requirement.promotion_gates, id).toEqual(decidedGates[id]);
      expect(authorityPromotionBlockers(shippedCriterion(id), programAuthorityRegistries, false), id).toEqual(unmet[id]);
      const facts = programAuthorityRegistries.fact_policies[shippedCriterion(id).fact_keys[0]];
      expect(facts?.decision_refs, id).toEqual([{ round: 1, letter: LETTER[id] }, { phase: "3B", letter: LETTER[id] }]);
    }
  });

  it("meets each new gate only once its enforcement is configured; c still waits on a GOV §51178 record type", () => {
    const registries = populatedWithShippedRequirements();
    expect(() => parseProgramAuthorityRegistries(registries)).not.toThrow();
    const blockers = (id: string, criterion = shippedCriterion(id)) => authorityPromotionBlockers(criterion, registries, false);
    const reviewer = ["reviewer_confirms_encoded_rule", "human_verification_record"];
    expect(blockers(C)).toEqual(["statutory_route_recorded", ...reviewer]);
    for (const id of [E, F, G]) expect(blockers(id), id).toEqual(reviewer);
    // Updated in Phase 3E: d's shipped record cites the Phase 3B d decision.
    expect(blockers(D, { ...shippedCriterion(D), human_verification: null })).toEqual(reviewer);
    expect(blockers(D)).toEqual(["human_verification_record"]);
    // Without route-separated assessment, c could not meet its route gate.
    const unrouted: ProgramCriterion = { ...shippedCriterion(C) };
    delete unrouted.statutory_routes;
    expect(blockers(C, unrouted)).toContain("statutory_routes_assessed_separately");
    // Without accepted USDA-criteria documentation, e could not meet its gate.
    const noDocs = structuredClone(registries) as Record<string, any>;
    noDocs.fact_policies[FARM].family_policy.accepted_usda_criteria_documentation = [];
    expect(authorityPromotionBlockers(shippedCriterion(E), noDocs as ProgramAuthorityRegistries, false)).toContain(
      "fmmp_categories_tied_to_usda_criteria",
    );
  });

  it("confirms only the Phase 3B rule: a Round 1 decision reference no longer satisfies the reviewer gate", () => {
    const registries = populatedWithShippedRequirements();
    for (const id of [D, E, F, G]) {
      const phase3b = promote(shippedCriterion(id), () => "requires_judgment", { phase: "3B", letter: LETTER[id] });
      expect(hasCompleteHumanVerification(phase3b), id).toBe(true);
      expect(authorityPromotionBlockers(phase3b, registries, true), id).toEqual([]);
      const round1 = promote(shippedCriterion(id), () => "requires_judgment", { round: 1, letter: LETTER[id] });
      expect(authorityPromotionBlockers(round1, registries, true), id).toEqual(["reviewer_confirms_encoded_rule"]);
    }
    const c = promote(shippedCriterion(C), () => "requires_judgment", { phase: "3B", letter: "c" });
    expect(authorityPromotionBlockers(c, registries, true)).toEqual(["statutory_route_recorded"]);
  });

  it("keeps promotion impossible under the shipped registries, even with a complete Phase 3B human record (d excepted since Phase 3D)", () => {
    for (const id of C_TO_G) {
      const spy = vi.fn((() => "requires_judgment") as CriterionPredicate);
      const promoted = promote(shippedCriterion(id), spy, { phase: "3B", letter: LETTER[id] });
      if (id === D) {
        // Phase 3D: the package meets every other gate of d, so only an explicit human
        // verification record could promote it. Updated in Phase 3E: the reviewer supplied it.
        expect(authorityPromotionBlockers(promoted, programAuthorityRegistries, true), id).toEqual([]);
        expect(shippedCriterion(id)).toMatchObject({ verification: "human_verified", human_verification: { decision_ref: { phase: "3B", letter: "d" } } });
        expect(criterionAwaitsHumanVerification(shippedCriterion(id)), id).toBe(false);
        continue;
      }
      if (id === C) {
        expect(authorityPromotionBlockers(promoted, programAuthorityRegistries, true)).toEqual([]);
        expect(shippedCriterion(C)).toMatchObject({ verification: "pending_human", human_verification: null, predicate: "not_encoded" });
        expect(criterionAwaitsHumanVerification(shippedCriterion(C))).toBe(true);
        continue;
      }
      expect(criterionAwaitsHumanVerification(promoted), id).toBe(true);
      const records = promoted.fact_keys.map((key) => record(`fact-${key}`, key, true));
      const factIndex = new Map(assessProgramFacts(records, promoted.fact_keys).map((fact) => [fact.key, fact]));
      expect(evaluateProgramCriterion(promoted, factIndex, AS_OF), id).toMatchObject({ status: "unreviewed", unreviewed_reasons: ["criterion_pending_human"] });
      expect(spy, id).not.toHaveBeenCalled();
    }
  });

  it("still parses the unchanged Phase 3B record now that its gates exist", () => {
    expect(humanRereviewDecisionsSchema.safeParse(rereviewJson).success).toBe(true);
    const redefined = { ...rereviewJson, gate_definitions: { ...rereviewJson.gate_definitions, legal_lot_identity_fails_closed: "Redefined." } };
    expect(humanRereviewDecisionsSchema.safeParse(redefined).success).toBe(false);
  });
});

/* ======================================================================== */

describe("8. G1 and G2 hold the SHRA roll-up short of a clear result", () => {
  const clearCriterion = () => synthetic("la_shra.test-only-clear", "hillside-area" as ProgramFactKey, { predicate: () => "consistent_with_source" });
  const hillside = () => {
    const base = record("hillside", VH, false);
    const spec = programFactSpecs["hillside-area"];
    return { ...base, claim: { key: "hillside-area", label: spec.label, client_label: spec.client_label } };
  };

  it("mirrors the open blockers in the Phase 3B record", () => {
    expect(programPathwayCompletenessBlockers).toEqual(
      rereview.pathway_completeness_blockers.map((blocker) => ({
        id: blocker.id,
        key: blocker.key,
        pathway: blocker.pathway,
        statute_source_id: blocker.statute_source_id,
        statute_pinpoint: blocker.statute_pinpoint,
        related_criterion_id: blocker.related_criterion_id,
        status: blocker.status,
      })),
    );
    for (const blocker of programPathwayCompletenessBlockers) {
      expect(shipped.some((criterion) => criterion.id === blocker.key), blocker.id).toBe(false);
    }
  });

  it("holds an otherwise clear SHRA screen at undetermined, with no new client outcome", () => {
    const { pathway, result } = screen(clearCriterion(), [hillside()]);
    expect(pathway).toMatchObject({ rollup: "undetermined", classification: "unknown", anchored: true, open_completeness_blockers: ["G1", "G2"] });
    expect(pathway.statement).toContain("at least one statutory site category this screen does not yet cover remains open");
    expect(pathway.statement).not.toContain("No blocking condition was found in the reviewed sources for the criteria screened. This is not");
    expect(findProhibitedClientLanguage(pathway.statement)).toEqual([]);
    expect(result.release).toEqual({ client_releasable: true, blockers: [] });
    expect(result.counts.pathways.no_disqualifier_found_in_reviewed_sources).toBe(0);
  });

  it("names the related criteria as decisive, and applies to SHRA only", () => {
    const stub = (id: string, pathway: string) => ({ criterion_id: id, pathway, status: "consistent_with_source", gating: false }) as ProgramCriterionResult;
    const shra = rollUpProgramPathway([stub("la_shra.a", "la_shra"), stub(E, "la_shra"), stub(F, "la_shra")]);
    expect(shra).toMatchObject({ rollup: "undetermined", decisive_criteria: [E, F], completeness_blockers: ["G1", "G2"] });
    for (const other of ["la_sb79", "la_low_rise"]) {
      const rolled = rollUpProgramPathway([stub(`${other}.a`, other)]);
      expect(rolled.rollup, other).toBe("no_disqualifier_found_in_reviewed_sources");
      expect("completeness_blockers" in rolled, other).toBe(false);
    }
  });

  it("never masks a documented disqualifier, a conflict, or a flag divergence", () => {
    const blocking = synthetic("la_shra.test-only-blocking", "hillside-area" as ProgramFactKey, { predicate: () => "disqualifying_per_source" });
    expect(screen(blocking, [hillside()]).pathway.rollup).toBe("documented_disqualifier");
    const flagged = hillside();
    const flag = { ...record("flag", VH, false, { evidenceType: "official_portal" }) };
    const flagSpec = programFactSpecs["zimas-shra-program-field"];
    const { pathway } = screen(clearCriterion(), [flagged, { ...flag, claim: { key: "zimas-shra-program-field", label: flagSpec.label, client_label: flagSpec.client_label } }]);
    expect(pathway.rollup).toBe("contested");
    expect(pathway.program_flags[0].crosscheck).toBe("diverges_from_criteria");
    expect("open_completeness_blockers" in pathway).toBe(false);
  });

  it("never lets the shipped SHRA pathway roll up to a clear result", () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    expect(result.pathways.find((pathway) => pathway.pathway === "la_shra")?.rollup).not.toBe("no_disqualifier_found_in_reviewed_sources");
  });
});

/* ======================================================================== */

describe("9. Invariants", () => {
  // The same pins as the Round 1, Phase 2, Phase 2b, Phase 3A, and Phase 3B tests.
  const EVALUATOR_OUTPUT_SHA256 = "68341529825b41e7dcd3b25a5daec94385fe6641e07cc03d29003c94c256b45a";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "11081860902438dd881cb743c98de30f4b4c3c425675a6e0eb2b6d41474a84a1";
  // Updated in Phase 3E: the reviewed promotion of d moved the output pins (the Phase 3C record keeps the ones above).
  const PHASE_3E_EVALUATOR_OUTPUT_SHA256 = "156dd1f41964ab5beebcf3882e0a0d653cc5d778939033bf2b752dba1e86afbc";
  const PHASE_3E_PUBLIC_DEMO_OUTPUT_SHA256 = "4dd2735bab875ad40b123fec72020e16442737bc6b5052eb55c5fba374b9a8a5";

  // Updated in Phase 3E: d alone is human-verified; every other guarded criterion is blocked.
  it("promotes only d: human_verified is 1 and pending_human is 45, every other guarded criterion blocked", () => {
    expect(shipped.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual([D]);
    expect(shipped.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(45);
    const guarded = shipped.filter((criterion) => promotionGuardedCriterionIds.has(criterion.id));
    expect(guarded).toHaveLength(46);
    for (const criterion of guarded.filter((candidate) => candidate.id !== D)) {
      expect(authorityPromotionBlockers(criterion, programAuthorityRegistries, false).length, criterion.id).toBeGreaterThan(0);
    }
    expect(authorityPromotionBlockers(shippedCriterion(D), programAuthorityRegistries, true)).toEqual([]);
  });

  // Updated in Phase 3D, which registered the CAL FIRE SRA package and nothing else.
  it("registers only the approved SRA/LRA sources and source-specific host exceptions", () => {
    expect(programAuthorityRegistries.issuers.map((issuer) => issuer.issuer_id)).toEqual(["calfire-osfm"]);
    expect(programAuthorityRegistries.sources.map((source) => source.authority_source_id)).toEqual(["calfire-sra-fhsz-2023-09-29", "calfire-lra-fhsz-2025-03-24-v1"]);
    for (const [key, entry] of Object.entries(programAuthorityRegistries.fact_policies)) {
      expect(entry?.establishing.length, key).toBe(key === VH ? 2 : key === HIGH ? 1 : 0);
    }
    expect(sourceHostExceptions).toHaveLength(4);
  });

  it("keeps every fixture status and roll-up; output changes only by the reviewed labels and the reviewed promotion of d", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const statuses = Object.fromEntries(result.pathways.flatMap((pathway) => pathway.criteria).map((criterion) => [criterion.criterion_id, criterion.status]));
    expect(statuses).toEqual(fixtureJson.expected.criterion_statuses);
    expect(Object.fromEntries(result.pathways.map((pathway) => [pathway.pathway, pathway.rollup]))).toEqual(fixtureJson.expected.pathway_rollups);
    const json = JSON.stringify(result);
    for (const key of ['"authority"', '"statutory_routes"', '"open_completeness_blockers"']) expect(json).not.toContain(key);
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(json)).toBe(PHASE_3E_EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PHASE_3E_PUBLIC_DEMO_OUTPUT_SHA256);
  });

  it("makes exactly the three deferred label changes, client-safe and without the retired conditions", () => {
    expect({
      [VH]: programFactSpecs[VH].client_label,
      [HIGH]: programFactSpecs[HIGH].client_label,
      [EASEMENT]: programFactSpecs[EASEMENT].client_label,
    }).toEqual({
      [VH]: "whether the parcel is mapped in a Very High Fire Hazard Severity Zone",
      [HIGH]: "whether the parcel is mapped in a High Fire Hazard Severity Zone",
      [EASEMENT]: "whether the parcel is under a conservation easement",
    });
    const texts = [
      programFactSpecs[VH].client_label,
      programFactSpecs[HIGH].client_label,
      programFactSpecs[EASEMENT].client_label,
      ...[C, D, G].flatMap((id) => [shippedCriterion(id).question_if_unknown, shippedCriterion(id).question_if_conflict]),
    ];
    for (const text of texts) {
      expect(text, text).not.toMatch(/responsibility area|recorded/i);
      expect(findProhibitedClientLanguage(text), text).toEqual([]);
    }
  });

  it("leaves the Phase 3B record and decisions document byte-identical", async () => {
    expect(await sha256Hex(rereviewRaw)).toBe("95ac140cfea7ecbef8c66a5ad3e67ffe0f4615557781041fc6877e8e63e3fcd6");
    expect(await sha256Hex(rereviewDoc)).toBe("bc608129cfdf0b521d5d0d319adb99e303afc8217085558c182ce433d646b32e");
  });

  it("reports only codes from the closed failure list", () => {
    const known = new Set<string>(authorityRecordFailureCodes);
    const { records, blocks } = routeRecords(true, false);
    for (const code of failureCodes(gatedRoutes(records, blocks).criterion)) expect(known.has(code), code).toBe(true);
  });

  it("records the Phase 3C change", () => {
    for (const heading of [
      "## Route-separated assessment for c",
      "## Legal-lot identity",
      "## Qualifier fields",
      "## Promotion gates",
      "## Agency-map capture readiness",
      "## SHRA completeness guard (G1, G2)",
      "## Client labels",
      "## Evaluator and demo output",
    ]) {
      expect(phase3cDoc).toContain(heading);
    }
    expect(phase3cDoc).toContain(EVALUATOR_OUTPUT_SHA256);
    expect(phase3cDoc).toContain(PUBLIC_DEMO_OUTPUT_SHA256);
  });
});
