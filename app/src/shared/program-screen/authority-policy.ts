import { z } from "zod";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import {
  authorityFactProfiles,
  authorityHumanReviewerSchema,
  authorityRecordKinds,
  DECIMAL_FIGURE,
  editionDateKinds,
  hazardClasses,
  isExactSquareFeetConversion,
  isIsoCalendarDate,
  lotAreaBases,
  type AuthorityRecordKind,
  type EditionDateKind,
  type HazardClass,
  type LotAreaBasis,
} from "./evidence-authority";
import { programFactSpecs } from "./facts";
import {
  criterionPromotionGates,
  humanVerificationRequiredCriterionIds,
  programFactKeys,
  type CriterionPromotionGate,
  type ProgramCriterion,
  type ProgramDecisionRef,
  type ProgramFactKey,
} from "./types";

/**
 * Evidence-authority registries. Design and review decisions D1-D12:
 * docs/PROGRAM_SCREEN_EVIDENCE_AUTHORITY.md.
 *
 * Four registries decide whether a record can establish a parcel fact. All
 * four ship deny-by-default: no issuing authority and no authority source is
 * registered, and every fact policy has no establishing entries. Registering
 * a real authority is a separately reviewed change, made only after the
 * source is captured and a named human reviewer approves it.
 */

export interface ProgramAuthorityHumanReview {
  reviewer: { kind: "human"; name: string; role: string };
  reviewed_on: string;
  decision_ref: ProgramDecisionRef | null;
}

/** An agency or office a reviewer accepted as able to issue an establishing record. */
export interface ReviewedIssuingAuthority {
  issuer_id: string;
  name: string;
  /** Captured official text showing the issuer's role. */
  basis_capture: { source_id: string; sha256_extracted: string };
  review: ProgramAuthorityHumanReview;
}

/** One specific edition of a map, plan, or other document, captured and reviewed. */
export interface ReviewedAuthoritySource {
  authority_source_id: string;
  record_kind: AuthorityRecordKind;
  issuer_id: string;
  title: string;
  edition: { label: string; date: string; date_kind: EditionDateKind };
  capture: { source_id: string; sha256_extracted: string };
  fact_keys: readonly ProgramFactKey[];
  superseded_by: string | null;
  review: ProgramAuthorityHumanReview;
}

export interface ProgramFactAuthorityEstablishingEntry {
  record_kind: AuthorityRecordKind;
  /**
   * `registered_authority_source`: the block names a registered source by ID
   * (a specific map or plan edition). `recorded_instrument_identity`: the
   * block identifies a parcel-specific instrument or map by number and date.
   */
  identity: "registered_authority_source" | "recorded_instrument_identity";
  issuer_ids: readonly string[];
  authority_source_ids: readonly string[];
  /** Values this entry may establish: "true"/"false", an allowed text value, or "number". */
  values: readonly string[];
  /** Days a currency check stays valid before the screen date. */
  currency_max_age_days: number | null;
}

export type ProgramFactFamilyPolicy =
  | { family: "lot_area"; accepted_area_bases: readonly LotAreaBasis[] }
  | { family: "zone_record" }
  | { family: "map_history"; required_search_repositories: readonly string[]; search_max_age_days: number | null }
  | { family: "hazard_map"; hazard_class: HazardClass; require_legend_class: boolean }
  | { family: "adopted_plan" }
  | { family: "recorded_instrument"; required_release_search_repositories: readonly string[] };

/** One policy per fact, shared by every pathway that reads it (D12). */
export interface ProgramFactAuthorityPolicy {
  fact_key: ProgramFactKey;
  family_policy: ProgramFactFamilyPolicy | null;
  requires_legal_lot_identity: boolean;
  /** Empty: nothing can establish this fact. */
  establishing: readonly ProgramFactAuthorityEstablishingEntry[];
  /** Kinds a reviewer ruled out as establishing; never listed as establishing. */
  prohibited_establishing_kinds: readonly AuthorityRecordKind[];
  decision_refs: readonly ProgramDecisionRef[];
}

export interface ProgramNumericBoundary {
  fact_key: ProgramFactKey;
  /** The threshold as the captured source words it, e.g. "under 1.5 acres". */
  source_text: string;
  /** The threshold figure and unit the source uses. */
  boundary: { figure: string; unit: "acres" | "sq_ft" };
  /** The same threshold in the fact's unit, by exact arithmetic only. */
  normalized_equivalent: { value: number; unit: "sq ft"; derivation: string };
}

interface RequirementBase {
  criterion_id: string;
  decision_ref: ProgramDecisionRef;
  /** The gates the decision lists. Each maps to a check below. */
  promotion_gates: readonly CriterionPromotionGate[];
}

/**
 * A reviewed authority requirement for one criterion. Every one of the 46
 * atomic criteria needs one before it can be `human_verified` (D7), even if
 * the entry says authority gating does not apply.
 */
export type ProgramCriterionAuthorityRequirement =
  | (RequirementBase & {
      applicability: "enforced";
      scope_preconditions: ReadonlyArray<{ fact_key: ProgramFactKey; must_equal: string | boolean }>;
      numeric_boundaries: readonly ProgramNumericBoundary[];
    })
  | (RequirementBase & { applicability: "not_applicable"; reason: string });

export type EnforcedAuthorityRequirement = Extract<ProgramCriterionAuthorityRequirement, { applicability: "enforced" }>;

export interface ProgramAuthorityRegistries {
  issuers: readonly ReviewedIssuingAuthority[];
  sources: readonly ReviewedAuthoritySource[];
  fact_policies: Readonly<Partial<Record<ProgramFactKey, ProgramFactAuthorityPolicy>>>;
  criterion_requirements: Readonly<Record<string, ProgramCriterionAuthorityRequirement>>;
}

/* ----------------------------------- reviewer rulings pinned into the code */

/**
 * Kinds the Round 1 reviewer ruled out as establishing each fact. A policy
 * must list at least these; the registry schema rejects any establishing
 * entry that names one. Removing one is a reviewed change to this table.
 */
export const pinnedProhibitedEstablishingKinds: Readonly<Partial<Record<ProgramFactKey, readonly AuthorityRecordKind[]>>> = {
  // c, d: no City display is independently authoritative for YES or NO.
  "very-high-fire-hazard-severity-zone": ["city_parcel_display"],
  "high-fire-hazard-severity-zone": ["city_parcel_display"],
  // e: not a ZIMAS field, generic GIS layer, or search result.
  "prime-or-statewide-farmland": ["city_parcel_display", "generic_gis_layer", "search_result"],
  // f: not a ZIMAS field, generic GIS layer, or unsupported secondary source.
  "nccp-conservation-land": ["city_parcel_display", "generic_gis_layer", "other_secondary"],
  // g: not a ZIMAS field, title summary, GIS layer, or other secondary source.
  "conservation-easement": ["city_parcel_display", "title_summary", "generic_gis_layer", "other_secondary"],
  // h: a ZIMAS covered / not covered display is not enough.
  "sb79-permanent-exemption-shown": ["city_parcel_display"],
};

/** Facts whose NO can never be established: absence never clears (decisions e, f, g, h). */
export const blockOnlyAuthorityFacts: readonly ProgramFactKey[] = [
  "prime-or-statewide-farmland",
  "nccp-conservation-land",
  "conservation-easement",
  "sb79-permanent-exemption-shown",
];

/* -------------------------------------------------- shipped registries */

function denyPolicy(
  factKey: ProgramFactKey,
  familyPolicy: ProgramFactFamilyPolicy | null,
  letters: readonly string[],
  requiresLegalLotIdentity = false,
): ProgramFactAuthorityPolicy {
  return {
    fact_key: factKey,
    family_policy: familyPolicy,
    requires_legal_lot_identity: requiresLegalLotIdentity,
    establishing: [],
    prohibited_establishing_kinds: pinnedProhibitedEstablishingKinds[factKey] ?? [],
    decision_refs: letters.map((letter) => ({ round: 1, letter })),
  };
}

function enforced(
  criterionId: string,
  letter: string,
  promotionGates: readonly CriterionPromotionGate[],
  extra: Partial<Pick<EnforcedAuthorityRequirement, "scope_preconditions" | "numeric_boundaries">> = {},
): EnforcedAuthorityRequirement {
  return {
    criterion_id: criterionId,
    applicability: "enforced",
    decision_ref: { round: 1, letter },
    promotion_gates: promotionGates,
    scope_preconditions: extra.scope_preconditions ?? [],
    numeric_boundaries: extra.numeric_boundaries ?? [],
  };
}

const reviewerGates = ["reviewer_confirms_encoded_rule", "human_verification_record"] as const;
const provenanceGate = "evidence_provenance_enforced_or_fails_closed" as const;

/**
 * The shipped registries. Nothing here can establish a fact: no issuer or
 * source is registered and every policy's `establishing` list is empty.
 */
export const programAuthorityRegistries: ProgramAuthorityRegistries = {
  issuers: [],
  sources: [],
  fact_policies: {
    "lot-area": denyPolicy("lot-area", { family: "lot_area", accepted_area_bases: [] }, ["a"], true),
    "shra-zone-category": denyPolicy("shra-zone-category", { family: "zone_record" }, ["a"]),
    "zoning-code-chapter": denyPolicy("zoning-code-chapter", null, ["a"]),
    "prior-shra-or-sb9-map": denyPolicy(
      "prior-shra-or-sb9-map",
      { family: "map_history", required_search_repositories: [], search_max_age_days: null },
      ["b"],
      true,
    ),
    "very-high-fire-hazard-severity-zone": denyPolicy(
      "very-high-fire-hazard-severity-zone",
      { family: "hazard_map", hazard_class: "very_high", require_legend_class: false },
      ["c"],
    ),
    "high-fire-hazard-severity-zone": denyPolicy(
      "high-fire-hazard-severity-zone",
      { family: "hazard_map", hazard_class: "high", require_legend_class: true },
      ["d"],
    ),
    "prime-or-statewide-farmland": denyPolicy("prime-or-statewide-farmland", null, ["e"]),
    "nccp-conservation-land": denyPolicy("nccp-conservation-land", { family: "adopted_plan" }, ["f"]),
    "conservation-easement": denyPolicy(
      "conservation-easement",
      { family: "recorded_instrument", required_release_search_repositories: [] },
      ["g"],
    ),
    "sb79-permanent-exemption-shown": denyPolicy("sb79-permanent-exemption-shown", null, ["h"]),
  },
  criterion_requirements: {
    "la_shra.single-family-lot-area-threshold": enforced(
      "la_shra.single-family-lot-area-threshold",
      "a",
      [
        "lot_area_precision_fails_closed",
        "legal_lot_identity_fails_closed",
        "r1_variation_zone_fails_closed",
        "chapter_1a_fails_closed",
        provenanceGate,
        ...reviewerGates,
      ],
      {
        // Decision a: Chapter 1A parcels stay unknown until separately sourced.
        // The criterion does not read zoning-code-chapter yet, so the gate
        // fails closed on this precondition until a reviewed change adds it.
        scope_preconditions: [{ fact_key: "zoning-code-chapter", must_equal: "Chapter 1" }],
        numeric_boundaries: [
          {
            fact_key: "lot-area",
            source_text: "under 1.5 acres",
            boundary: { figure: "1.5", unit: "acres" },
            normalized_equivalent: {
              value: 65_340,
              unit: "sq ft",
              derivation: "1.5 acres x 43,560 sq ft per acre: an exact arithmetic conversion, not source text",
            },
          },
        ],
      },
    ),
    "la_shra.prior-shra-or-sb9-map": enforced("la_shra.prior-shra-or-sb9-map", "b", [
      "map_history_completeness_fails_closed",
      "legal_lot_identity_fails_closed",
      "applicable_law_fails_closed",
      "search_completeness_fails_closed",
      ...reviewerGates,
    ]),
    "la_shra.very-high-fire-hazard-severity-zone": enforced("la_shra.very-high-fire-hazard-severity-zone", "c", [
      provenanceGate,
      "map_identity_and_edition_recorded",
      ...reviewerGates,
    ]),
    "la_shra.high-fire-hazard-severity-zone": enforced("la_shra.high-fire-hazard-severity-zone", "d", [
      provenanceGate,
      "map_identity_and_edition_recorded",
      "responsibility_area_and_legend_recorded",
      ...reviewerGates,
    ]),
    "la_shra.prime-or-statewide-farmland": enforced("la_shra.prime-or-statewide-farmland", "e", [
      "defining_official_source_captured",
      provenanceGate,
      ...reviewerGates,
    ]),
    "la_shra.natural-community-conservation-plan-land": enforced("la_shra.natural-community-conservation-plan-land", "f", [
      provenanceGate,
      "adopted_plan_identity_adoption_and_map_date_recorded",
      ...reviewerGates,
    ]),
    "la_shra.conservation-easement": enforced("la_shra.conservation-easement", "g", [
      provenanceGate,
      "instrument_identity_in_force_status_and_coverage_recorded",
      ...reviewerGates,
    ]),
    "la_sb79.permanent-exemption-shown": enforced("la_sb79.permanent-exemption-shown", "h", [
      "directors_section_3_map_captured",
      ...reviewerGates,
    ]),
  },
};

/* ------------------------------------------------------ registry schema */

const kebabId = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.string().refine(isIsoCalendarDate, { message: "Dates must be valid ISO calendar dates." });
const shortText = z.string().trim().min(1).max(300);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const decisionRefSchema = z.object({ round: z.number().int().positive(), letter: z.string().regex(/^[a-z]$/) }).strict();
const captureRefSchema = z.object({ source_id: kebabId, sha256_extracted: hex64 }).strict();
const humanReviewSchema = z
  .object({ reviewer: authorityHumanReviewerSchema, reviewed_on: isoDate, decision_ref: decisionRefSchema.nullable() })
  .strict();
const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((values) => new Set(values).size === values.length, "Entries must be unique.");
const positiveDays = z.number().int().positive().max(3650);

const familyPolicySchema = z.discriminatedUnion("family", [
  z.object({ family: z.literal("lot_area"), accepted_area_bases: uniqueList(z.enum(lotAreaBases)) }).strict(),
  z.object({ family: z.literal("zone_record") }).strict(),
  z
    .object({
      family: z.literal("map_history"),
      required_search_repositories: uniqueList(kebabId),
      search_max_age_days: positiveDays.nullable(),
    })
    .strict(),
  z
    .object({ family: z.literal("hazard_map"), hazard_class: z.enum(hazardClasses), require_legend_class: z.boolean() })
    .strict(),
  z.object({ family: z.literal("adopted_plan") }).strict(),
  z.object({ family: z.literal("recorded_instrument"), required_release_search_repositories: uniqueList(kebabId) }).strict(),
]);

const establishingEntrySchema = z
  .object({
    record_kind: z.enum(authorityRecordKinds),
    identity: z.enum(["registered_authority_source", "recorded_instrument_identity"]),
    issuer_ids: uniqueList(kebabId).refine((ids) => ids.length > 0, "An establishing entry names its issuers."),
    authority_source_ids: uniqueList(kebabId),
    values: uniqueList(z.string().min(1)).refine((values) => values.length > 0, "An establishing entry names its values."),
    currency_max_age_days: positiveDays.nullable(),
  })
  .strict();

const factPolicySchema = z
  .object({
    fact_key: z.enum(programFactKeys),
    family_policy: familyPolicySchema.nullable(),
    requires_legal_lot_identity: z.boolean(),
    establishing: z.array(establishingEntrySchema),
    prohibited_establishing_kinds: uniqueList(z.enum(authorityRecordKinds)),
    decision_refs: z.array(decisionRefSchema),
  })
  .strict();

const numericBoundarySchema = z
  .object({
    fact_key: z.enum(programFactKeys),
    source_text: shortText,
    boundary: z.object({ figure: z.string().regex(DECIMAL_FIGURE), unit: z.enum(["acres", "sq_ft"]) }).strict(),
    normalized_equivalent: z
      .object({ value: z.number().positive(), unit: z.literal("sq ft"), derivation: shortText })
      .strict(),
  })
  .strict();

const requirementBase = {
  criterion_id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9-]+$/),
  decision_ref: decisionRefSchema,
  promotion_gates: uniqueList(z.enum(criterionPromotionGates)),
};

const requirementSchema = z.discriminatedUnion("applicability", [
  z
    .object({
      ...requirementBase,
      applicability: z.literal("enforced"),
      scope_preconditions: z.array(
        z.object({ fact_key: z.enum(programFactKeys), must_equal: z.union([z.string().min(1), z.boolean()]) }).strict(),
      ),
      numeric_boundaries: z.array(numericBoundarySchema),
    })
    .strict(),
  z.object({ ...requirementBase, applicability: z.literal("not_applicable"), reason: shortText }).strict(),
]);

export const programAuthorityRegistriesSchema = z
  .object({
    issuers: z.array(
      z.object({ issuer_id: kebabId, name: shortText, basis_capture: captureRefSchema, review: humanReviewSchema }).strict(),
    ),
    sources: z.array(
      z
        .object({
          authority_source_id: kebabId,
          record_kind: z.enum(authorityRecordKinds),
          issuer_id: kebabId,
          title: shortText,
          edition: z.object({ label: shortText, date: isoDate, date_kind: z.enum(editionDateKinds) }).strict(),
          capture: captureRefSchema,
          fact_keys: uniqueList(z.enum(programFactKeys)).refine((keys) => keys.length > 0),
          superseded_by: kebabId.nullable(),
          review: humanReviewSchema,
        })
        .strict(),
    ),
    fact_policies: z.record(z.string(), factPolicySchema),
    criterion_requirements: z.record(z.string(), requirementSchema),
  })
  .strict()
  .superRefine((registries, context) => {
    const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path, message });

    const issuerIds = registries.issuers.map((issuer) => issuer.issuer_id);
    if (new Set(issuerIds).size !== issuerIds.length) issue(["issuers"], "Issuer IDs must be unique.");
    const sources = new Map(registries.sources.map((source) => [source.authority_source_id, source]));
    if (sources.size !== registries.sources.length) issue(["sources"], "Authority source IDs must be unique.");
    registries.sources.forEach((source, index) => {
      if (!issuerIds.includes(source.issuer_id)) issue(["sources", index], `${source.issuer_id} is not a registered issuer.`);
      if (source.superseded_by !== null && (source.superseded_by === source.authority_source_id || !sources.has(source.superseded_by))) {
        issue(["sources", index], "A source is superseded only by another registered source.");
      }
    });

    for (const [key, policy] of Object.entries(registries.fact_policies)) {
      const path = ["fact_policies", key];
      if (policy.fact_key !== key) {
        issue(path, "A fact policy is keyed by its own fact.");
        continue;
      }
      const factKey = policy.fact_key;
      const profile = authorityFactProfiles[factKey];
      const spec = programFactSpecs[factKey];
      if ((policy.family_policy?.family ?? null) !== profile.qualifier_family) {
        issue(path, `${factKey} takes the ${profile.qualifier_family ?? "no"} family policy.`);
      }
      if (policy.family_policy?.family === "hazard_map") {
        if (policy.family_policy.hazard_class !== profile.hazard_class) issue(path, "The hazard class must match the fact.");
        // Decision d: a map without a High class for the area never yields NO.
        if (policy.family_policy.hazard_class === "high" && !policy.family_policy.require_legend_class) {
          issue(path, "The High policy must require the legend to define a High class.");
        }
      }
      for (const kind of pinnedProhibitedEstablishingKinds[factKey] ?? []) {
        if (!policy.prohibited_establishing_kinds.includes(kind)) issue(path, `${factKey} must keep ${kind} prohibited.`);
      }
      const populated = policy.establishing.length > 0;
      if (populated && policy.family_policy?.family === "map_history") {
        if (policy.family_policy.required_search_repositories.length === 0 || policy.family_policy.search_max_age_days === null) {
          issue(path, "A map-history policy names its required search repositories and age window before it can establish anything.");
        }
      }
      if (populated && policy.family_policy?.family === "recorded_instrument") {
        if (policy.family_policy.required_release_search_repositories.length === 0) {
          issue(path, "An instrument policy names its required release-search repositories before it can establish anything.");
        }
      }
      policy.establishing.forEach((entry, index) => {
        const entryPath = [...path, "establishing", index];
        if (policy.prohibited_establishing_kinds.includes(entry.record_kind)) {
          issue(entryPath, `${entry.record_kind} is prohibited as establishing ${factKey}.`);
        }
        for (const issuerId of entry.issuer_ids) {
          if (!issuerIds.includes(issuerId)) issue(entryPath, `${issuerId} is not a registered issuer.`);
        }
        if (entry.identity === "registered_authority_source") {
          if (entry.authority_source_ids.length === 0) issue(entryPath, "A registered-source entry names its sources.");
          if (entry.currency_max_age_days === null) issue(entryPath, "A registered-source entry sets a currency window.");
          for (const sourceId of entry.authority_source_ids) {
            const source = sources.get(sourceId);
            if (
              source === undefined ||
              source.record_kind !== entry.record_kind ||
              !entry.issuer_ids.includes(source.issuer_id) ||
              !source.fact_keys.includes(factKey)
            ) {
              issue(entryPath, `${sourceId} is not a registered ${entry.record_kind} for ${factKey} from a listed issuer.`);
            }
          }
        } else if (entry.authority_source_ids.length > 0) {
          issue(entryPath, "A recorded-instrument entry identifies each instrument itself, not a registered source.");
        }
        for (const value of entry.values) {
          const allowed =
            spec.value.kind === "boolean"
              ? value === "true" || value === "false"
              : spec.value.kind === "number"
                ? value === "number"
                : spec.value.allowed !== null && spec.value.allowed.includes(value);
          if (!allowed) issue(entryPath, `${value} is not a value of ${factKey}.`);
        }
        if (blockOnlyAuthorityFacts.includes(factKey) && entry.values.includes("false")) {
          issue(entryPath, `A NO for ${factKey} can never be established; absence never clears.`);
        }
      });
    }

    for (const [id, requirement] of Object.entries(registries.criterion_requirements)) {
      const path = ["criterion_requirements", id];
      if (requirement.criterion_id !== id) issue(path, "A requirement is keyed by its own criterion.");
      for (const gate of ["reviewer_confirms_encoded_rule", "human_verification_record"] as const) {
        if (!requirement.promotion_gates.includes(gate)) issue(path, `Every requirement keeps the ${gate} gate.`);
      }
      if (requirement.applicability === "not_applicable") {
        if (requirement.promotion_gates.includes(provenanceGate)) {
          issue(path, "A requirement that does not gate authority cannot claim the provenance gate.");
        }
        continue;
      }
      for (const precondition of requirement.scope_preconditions) {
        const spec = programFactSpecs[precondition.fact_key];
        const valid =
          spec.value.kind === "boolean"
            ? typeof precondition.must_equal === "boolean"
            : spec.value.kind === "text" &&
              typeof precondition.must_equal === "string" &&
              (spec.value.allowed === null || spec.value.allowed.includes(precondition.must_equal));
        if (!valid) issue(path, `${String(precondition.must_equal)} is not a value of ${precondition.fact_key}.`);
      }
      for (const boundary of requirement.numeric_boundaries) {
        const spec = programFactSpecs[boundary.fact_key];
        if (spec.value.kind !== "number" || spec.value.unit !== boundary.normalized_equivalent.unit) {
          issue(path, `${boundary.fact_key} is not measured in ${boundary.normalized_equivalent.unit}.`);
        }
        // D5: the fact-unit threshold is exact arithmetic on the source figure, nothing more.
        if (!isExactSquareFeetConversion(boundary.boundary.figure, boundary.boundary.unit, boundary.normalized_equivalent.value)) {
          issue(path, `${boundary.normalized_equivalent.value} sq ft is not the exact conversion of ${boundary.boundary.figure} ${boundary.boundary.unit}.`);
        }
      }
    }
  });

/**
 * Validates registries (the shipped ones, or TEST-ONLY ones passed like
 * `packs`) and returns the originals.
 */
export function parseProgramAuthorityRegistries(value: ProgramAuthorityRegistries): ProgramAuthorityRegistries {
  const parsed = programAuthorityRegistriesSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_AUTHORITY_REGISTRY",
      `Evidence-authority registries failed validation at ${issue.path.join(".") || "registries"}: ${issue.message}`,
    );
  }
  return value;
}

/* ------------------------------------------------------ promotion blockers */

export type ProgramPromotionBlocker = CriterionPromotionGate | "authority_requirement_missing";

const legalLotFacts: readonly ProgramFactKey[] = ["lot-area", "prior-shra-or-sb9-map"];

function sameDecisionRef(left: ProgramDecisionRef | undefined | null, right: ProgramDecisionRef): boolean {
  return left !== undefined && left !== null && left.round === right.round && left.letter === right.letter;
}

/**
 * Whether one promotion gate is met, computed from the registries and the
 * criterion alone. Nothing a reviewer writes in a note can satisfy a gate.
 */
function gateMet(
  gate: CriterionPromotionGate,
  criterion: ProgramCriterion,
  requirement: ProgramCriterionAuthorityRequirement,
  registries: ProgramAuthorityRegistries,
  humanRecordComplete: boolean,
): boolean {
  const reads = criterion.fact_keys;
  const policy = (key: ProgramFactKey) => registries.fact_policies[key];
  const populated = (key: ProgramFactKey) => (policy(key)?.establishing.length ?? 0) > 0;
  const registeredEditions = (key: ProgramFactKey) =>
    populated(key) &&
    (policy(key)?.establishing ?? []).every(
      (entry) => entry.identity === "registered_authority_source" && entry.currency_max_age_days !== null,
    );
  const isEnforced = requirement.applicability === "enforced";
  const liveSources = registries.sources.filter((source) => source.superseded_by === null);

  switch (gate) {
    case "evidence_provenance_enforced_or_fails_closed":
      return isEnforced && reads.length > 0 && reads.every(populated);
    case "map_identity_and_edition_recorded":
      return isEnforced && reads.length > 0 && reads.every(registeredEditions);
    case "responsibility_area_and_legend_recorded":
      return reads.some((key) => {
        const family = policy(key)?.family_policy;
        return populated(key) && family?.family === "hazard_map" && family.require_legend_class;
      });
    case "lot_area_precision_fails_closed":
      return (
        requirement.applicability === "enforced" &&
        reads.includes("lot-area") &&
        populated("lot-area") &&
        policy("lot-area")?.family_policy?.family === "lot_area" &&
        requirement.numeric_boundaries.some((boundary) => boundary.fact_key === "lot-area")
      );
    case "legal_lot_identity_fails_closed": {
      const lotFacts = reads.filter((key) => legalLotFacts.includes(key));
      return lotFacts.length > 0 && lotFacts.every((key) => populated(key) && policy(key)?.requires_legal_lot_identity === true);
    }
    case "r1_variation_zone_fails_closed":
      return (
        reads.includes("shra-zone-category") &&
        populated("shra-zone-category") &&
        policy("shra-zone-category")?.family_policy?.family === "zone_record"
      );
    case "chapter_1a_fails_closed":
      return (
        requirement.applicability === "enforced" &&
        reads.includes("zoning-code-chapter") &&
        populated("zoning-code-chapter") &&
        requirement.scope_preconditions.some(
          (precondition) => precondition.fact_key === "zoning-code-chapter" && precondition.must_equal === "Chapter 1",
        )
      );
    case "map_history_completeness_fails_closed":
    case "search_completeness_fails_closed":
    case "applicable_law_fails_closed": {
      const family = policy("prior-shra-or-sb9-map")?.family_policy;
      return (
        reads.includes("prior-shra-or-sb9-map") &&
        populated("prior-shra-or-sb9-map") &&
        family?.family === "map_history" &&
        family.required_search_repositories.length > 0 &&
        family.search_max_age_days !== null
      );
    }
    case "adopted_plan_identity_adoption_and_map_date_recorded":
      return (
        reads.includes("nccp-conservation-land") &&
        policy("nccp-conservation-land")?.family_policy?.family === "adopted_plan" &&
        registeredEditions("nccp-conservation-land")
      );
    case "instrument_identity_in_force_status_and_coverage_recorded": {
      const family = policy("conservation-easement")?.family_policy;
      return (
        reads.includes("conservation-easement") &&
        populated("conservation-easement") &&
        family?.family === "recorded_instrument" &&
        family.required_release_search_repositories.length > 0
      );
    }
    case "defining_official_source_captured":
      return reads.length > 0 && reads.every((key) => liveSources.some((source) => source.fact_keys.includes(key)));
    case "directors_section_3_map_captured":
      return liveSources.some(
        (source) => source.record_kind === "director_issued_map" && reads.some((key) => source.fact_keys.includes(key)),
      );
    case "reviewer_confirms_encoded_rule":
      return sameDecisionRef(criterion.human_verification?.decision_ref, requirement.decision_ref);
    case "human_verification_record":
      return humanRecordComplete;
  }
}

/**
 * The promotion gates still unmet for a criterion, in the order its
 * requirement lists them, or `authority_requirement_missing` when it has no
 * reviewed authority requirement. A criterion that must be human-verified
 * cannot run its rule while this list is non-empty.
 */
export function authorityPromotionBlockers(
  criterion: ProgramCriterion,
  registries: ProgramAuthorityRegistries,
  humanRecordComplete: boolean,
): ProgramPromotionBlocker[] {
  const requirement = registries.criterion_requirements[criterion.id];
  if (requirement === undefined) {
    return humanRecordComplete ? ["authority_requirement_missing"] : ["authority_requirement_missing", "human_verification_record"];
  }
  return requirement.promotion_gates.filter(
    (gate) => !gateMet(gate, criterion, requirement, registries, humanRecordComplete),
  );
}

/** The 46 atomic criteria the promotion guard protects (D7). */
export const promotionGuardedCriterionIds: ReadonlySet<string> = new Set(humanVerificationRequiredCriterionIds);
