import { z } from "zod";
import type {
  CanonicalEvidenceRecord,
  EvidenceIntegrityType,
  EvidenceNormalizedValue,
} from "../build-week-integrity/types";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import { programFactKeys, type ProgramFactKey } from "./types";

/**
 * Evidence authority: which records may establish a parcel fact.
 *
 * Canonical evidence records are unchanged. Authority metadata travels
 * beside them in a sidecar keyed by `evidence_id` (design decision D1,
 * docs/PROGRAM_SCREEN_EVIDENCE_AUTHORITY.md). A block describes what a record
 * is and where it came from; it never says that the record is authoritative.
 * Whether a record can establish a fact is worked out from the code
 * registries in authority-policy.ts, which start deny-by-default.
 *
 * Two ways to fail closed (D3):
 * - A malformed, contradictory, duplicated, or falsely linked block is
 *   rejected: `INVALID_PROGRAM_EVIDENCE_AUTHORITY`.
 * - A valid block that is insufficient (no block, unreviewed, incomplete,
 *   stale, unsupported, unregistered) leaves the criterion `unknown`. That
 *   is decided by the authority gate, not here.
 */

export const PROGRAM_EVIDENCE_AUTHORITY_VERSION = "program-screen-evidence-authority-v1" as const;

/**
 * What a record is. Declared by the person recording it and reviewed; it
 * does not make the record establishing by itself.
 */
export const authorityRecordKinds = [
  "agency_hazard_map",
  "adopted_plan_document",
  "recorded_instrument",
  "recorded_subdivision_map",
  "subdivision_case_record",
  "legal_lot_record",
  "director_issued_map",
  "city_zoning_record",
  "city_parcel_display",
  "assessor_record",
  "title_summary",
  "generic_gis_layer",
  "search_result",
  "other_secondary",
] as const;

export type AuthorityRecordKind = (typeof authorityRecordKinds)[number];

/** Canonical evidence types each record kind may be recorded as. */
export const authorityRecordKindEvidenceTypes: Readonly<
  Record<AuthorityRecordKind, readonly EvidenceIntegrityType[]>
> = {
  agency_hazard_map: ["official_map"],
  adopted_plan_document: ["official_document", "official_map"],
  recorded_instrument: ["official_document"],
  recorded_subdivision_map: ["official_map", "official_document"],
  subdivision_case_record: ["official_document"],
  legal_lot_record: ["official_document", "official_map"],
  director_issued_map: ["official_map", "official_document"],
  city_zoning_record: ["official_map", "official_document"],
  city_parcel_display: ["official_portal"],
  assessor_record: ["official_portal", "official_document"],
  title_summary: ["other", "correspondence"],
  generic_gis_layer: ["official_map", "official_portal", "other"],
  search_result: ["lookup_attempt", "other"],
  other_secondary: [
    "official_map",
    "official_portal",
    "official_document",
    "lookup_attempt",
    "correspondence",
    "research_note",
    "other",
  ],
};

export const sourceIdentifierSchemes = [
  "authority_source_id",
  "recorder_document_number",
  "map_book_page",
  "city_case_number",
  "portal_url_only",
] as const;
export const editionDateKinds = ["effective", "adopted", "published", "recorded", "issued"] as const;
export const editionCurrencies = ["current_on_as_of", "superseded", "not_established"] as const;
export const parcelMatchMethods = [
  "parcel_identifier",
  "legal_description",
  "spatial_overlay",
  "address_only",
  "not_established",
] as const;
export const legalLotIdentities = [
  "parcel_is_one_legal_lot",
  "parcel_and_legal_lot_differ",
  "tied_or_multiple_lots",
  "merger_or_resubdivision_pending_or_proposed",
  "not_established",
] as const;
export const parcelCoverages = [
  "whole_parcel",
  "partial_parcel",
  "none_of_parcel",
  "not_applicable",
  "not_established",
] as const;

export const qualifierFamilies = [
  "lot_area",
  "zone_record",
  "map_history",
  "hazard_map",
  "adopted_plan",
  "recorded_instrument",
] as const;
export const lotAreaBases = [
  "recorded_legal_lot_area",
  "assessor_parcel_area",
  "gis_calculated_area",
  "survey",
  "not_established",
] as const;
/**
 * D5: only an exact area can be compared with a threshold. Approximate,
 * rounded, estimated, or unestablished precision never establishes a value.
 */
export const lotAreaPrecisions = ["exact", "approximate", "rounded", "estimated", "not_established"] as const;
export const zoneMatches = [
  "listed_zone_exact",
  "listed_zone_with_suffix",
  "r1_variation_zone",
  "other_variation_or_supplemental",
  "not_on_list",
  "not_established",
] as const;
export const hazardClasses = ["very_high", "high"] as const;

export type SourceIdentifierScheme = (typeof sourceIdentifierSchemes)[number];
export type EditionDateKind = (typeof editionDateKinds)[number];
export type ParcelCoverage = (typeof parcelCoverages)[number];
export type LegalLotIdentity = (typeof legalLotIdentities)[number];
export type QualifierFamily = (typeof qualifierFamilies)[number];
export type LotAreaBasis = (typeof lotAreaBases)[number];
export type HazardClass = (typeof hazardClasses)[number];

/**
 * How authority metadata is shaped for each fact. `whole_or_none` facts
 * record YES only for the whole parcel and NO only for none of it; partial
 * or unestablished coverage is an unknown value (Round 1 decisions c, d, e,
 * f, g). Every other fact records coverage as `not_applicable`.
 */
export interface AuthorityFactProfile {
  qualifier_family: QualifierFamily | null;
  hazard_class: HazardClass | null;
  coverage_semantics: "whole_or_none" | "not_applicable";
}

const plainProfile: AuthorityFactProfile = {
  qualifier_family: null,
  hazard_class: null,
  coverage_semantics: "not_applicable",
};

const profileOverrides: Partial<Record<ProgramFactKey, AuthorityFactProfile>> = {
  "lot-area": { qualifier_family: "lot_area", hazard_class: null, coverage_semantics: "not_applicable" },
  "shra-zone-category": { qualifier_family: "zone_record", hazard_class: null, coverage_semantics: "not_applicable" },
  "prior-shra-or-sb9-map": { qualifier_family: "map_history", hazard_class: null, coverage_semantics: "not_applicable" },
  "very-high-fire-hazard-severity-zone": {
    qualifier_family: "hazard_map",
    hazard_class: "very_high",
    coverage_semantics: "whole_or_none",
  },
  "high-fire-hazard-severity-zone": { qualifier_family: "hazard_map", hazard_class: "high", coverage_semantics: "whole_or_none" },
  "prime-or-statewide-farmland": { qualifier_family: null, hazard_class: null, coverage_semantics: "whole_or_none" },
  "nccp-conservation-land": { qualifier_family: "adopted_plan", hazard_class: null, coverage_semantics: "whole_or_none" },
  "conservation-easement": { qualifier_family: "recorded_instrument", hazard_class: null, coverage_semantics: "whole_or_none" },
};

export const authorityFactProfiles: Readonly<Record<ProgramFactKey, AuthorityFactProfile>> = Object.fromEntries(
  programFactKeys.map((key) => [key, profileOverrides[key] ?? plainProfile]),
) as Record<ProgramFactKey, AuthorityFactProfile>;

/* ------------------------------------------------------------ helpers */

export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

/** Whole days from one ISO date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const toTime = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toTime(to) - toTime(from)) / 86_400_000);
}

interface ExactDecimal {
  digits: bigint;
  scale: number;
}

/** A plain decimal figure, optionally with thousands commas. No exponent, no sign. */
export const DECIMAL_FIGURE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

function parseExactDecimal(text: string): ExactDecimal | null {
  if (!DECIMAL_FIGURE.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function numberAsExactDecimal(value: number): ExactDecimal | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return parseExactDecimal(String(value));
}

function sameExactDecimal(left: ExactDecimal, right: ExactDecimal): boolean {
  const scale = Math.max(left.scale, right.scale);
  const widen = (value: ExactDecimal) => value.digits * 10n ** BigInt(scale - value.scale);
  return widen(left) === widen(right);
}

const SQUARE_FEET_PER_ACRE = 43_560n;

/**
 * True when `squareFeet` is exactly the figure in `unit`, by arithmetic
 * alone: acres times 43,560. No rounding, tolerance, or significant-figure
 * rule is applied (D5).
 */
export function isExactSquareFeetConversion(
  figure: string,
  unit: "acres" | "sq_ft",
  squareFeet: number,
): boolean {
  const recorded = parseExactDecimal(figure);
  const value = numberAsExactDecimal(squareFeet);
  if (recorded === null || value === null) return false;
  const inSquareFeet =
    unit === "sq_ft" ? recorded : { digits: recorded.digits * SQUARE_FEET_PER_ACRE, scale: recorded.scale };
  return sameExactDecimal(inSquareFeet, value);
}

/* ------------------------------------------------------------- schema */

const kebabId = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Identifiers are lowercase kebab-case.");
const isoDate = z.string().refine(isIsoCalendarDate, { message: "Dates must be valid ISO calendar dates." });
const shortText = z.string().trim().min(1).max(300);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest.");

export const authorityHumanReviewerSchema = z
  .object({ kind: z.literal("human"), name: shortText, role: shortText })
  .strict();

const searchSchema = z
  .object({
    scope: z.enum(["complete_reviewed_history", "partial", "single_portal_result", "not_established"]),
    repositories_searched: z.array(kebabId).max(20),
    searched_on: isoDate.nullable(),
  })
  .strict();

const qualifiersSchema = z.discriminatedUnion("family", [
  z
    .object({
      family: z.literal("lot_area"),
      /** The figure exactly as the record prints it, and its unit. */
      as_recorded: z.object({ figure: z.string().regex(DECIMAL_FIGURE), unit: z.enum(["acres", "sq_ft"]) }).strict(),
      area_basis: z.enum(lotAreaBases),
      area_precision: z.enum(lotAreaPrecisions),
    })
    .strict(),
  z
    .object({
      family: z.literal("zone_record"),
      /** The base zone exactly as recorded. Never parsed or normalized (D6). */
      base_zone_as_recorded: z.string().min(1).max(80),
      zone_match: z.enum(zoneMatches),
    })
    .strict(),
  z
    .object({
      family: z.literal("map_history"),
      search: searchSchema,
      maps: z
        .array(
          z
            .object({
              map_reference: shortText,
              stage: z.enum(["tentative", "final"]),
              recording: z.enum(["recorded", "never_recorded", "not_established"]),
              statute_basis: z.enum(["shra", "sb9_2021", "other_statute", "not_established"]),
              relation: z.enum(["screened_lot_recorded_pursuant", "earlier_in_lineage", "not_established"]),
            })
            .strict(),
        )
        .max(50),
      lineage_changed_after_shra_or_sb9_map: z.enum(["yes", "no", "not_applicable", "not_established"]),
    })
    .strict(),
  z
    .object({
      family: z.literal("hazard_map"),
      hazard_class: z.enum(hazardClasses),
      parcel_responsibility_area: z.enum(["state", "local", "federal", "not_established"]),
      map_covers_that_area: z.enum(["yes", "no", "not_established"]),
      legend_defines_class_for_area: z.enum(["yes", "no", "not_established"]),
    })
    .strict(),
  z
    .object({
      family: z.literal("adopted_plan"),
      plan_identifier: shortText,
      adoption_status: z.enum([
        "adopted_in_effect",
        "draft",
        "proposed",
        "pending",
        "expired",
        "superseded",
        "not_established",
      ]),
      adoption_reference: shortText.nullable(),
      adoption_date: isoDate.nullable(),
      status_checked_on: isoDate.nullable(),
      map_or_text_reference: shortText.nullable(),
      identification_basis: z.enum(["explicit_plan_language_or_map", "requires_interpretation", "not_established"]),
    })
    .strict(),
  z
    .object({
      family: z.literal("recorded_instrument"),
      document_number: shortText.nullable(),
      recording_date: isoDate.nullable(),
      instrument_character: z.enum(["expressly_conservation_easement", "requires_interpretation", "not_established"]),
      in_force: z.enum(["no_release_or_extinguishment_of_record", "released_or_extinguished", "not_established"]),
      release_search: z
        .object({
          scope: z.enum(["complete_reviewed_history", "partial", "not_performed"]),
          repositories_searched: z.array(kebabId).max(20),
          searched_on: isoDate.nullable(),
        })
        .strict(),
    })
    .strict(),
]);

export const programEvidenceAuthoritySchema = z
  .object({
    schema_version: z.literal(PROGRAM_EVIDENCE_AUTHORITY_VERSION),
    evidence_id: z.string().trim().min(1).max(128),
    fact_key: z.enum(programFactKeys),
    record_kind: z.enum(authorityRecordKinds),
    issuer: z.object({ name: shortText, issuer_id: kebabId.nullable() }).strict(),
    source_identifier: z.object({ scheme: z.enum(sourceIdentifierSchemes), value: shortText }).strict(),
    document_title: shortText,
    edition: z
      .object({
        label: shortText.nullable(),
        date: isoDate.nullable(),
        date_kind: z.enum(editionDateKinds).nullable(),
        currency: z.enum(editionCurrencies),
        currency_checked_on: isoDate.nullable(),
      })
      .strict(),
    retrieved_at: z.string().datetime({ offset: true }),
    source_url: z.string().max(2048).nullable(),
    capture: z
      .discriminatedUnion("store", [
        z.object({ store: z.literal("repo_official_source"), source_id: kebabId, sha256_extracted: hex64 }).strict(),
        z.object({ store: z.literal("case_evidence_file"), file_id: shortText, sha256: hex64 }).strict(),
      ])
      .nullable(),
    parcel_relationship: z
      .object({
        matched_by: z.enum(parcelMatchMethods),
        parcel_identifier: shortText.nullable(),
        legal_lot_reference: shortText.nullable(),
        legal_lot_identity: z.enum(legalLotIdentities),
      })
      .strict(),
    coverage: z.enum(parcelCoverages),
    qualifiers: qualifiersSchema.nullable(),
    authority_review: z
      .object({
        status: z.enum(["unreviewed", "reviewed"]),
        reviewer: authorityHumanReviewerSchema.nullable(),
        reviewed_on: isoDate.nullable(),
      })
      .strict(),
    /** Display only. No check reads free text. */
    notes: z.array(z.string().trim().min(1).max(1000)).max(20),
    is_ai_generated: z.literal(false),
  })
  .strict()
  .superRefine((block, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
    const review = block.authority_review;
    if (review.status === "reviewed" && (review.reviewer === null || review.reviewed_on === null)) {
      issue("authority_review", "A reviewed block names its human reviewer and review date.");
    }
    if (review.status === "unreviewed" && (review.reviewer !== null || review.reviewed_on !== null)) {
      issue("authority_review", "An unreviewed block cannot name a reviewer or review date.");
    }
    if ((block.edition.date === null) !== (block.edition.date_kind === null)) {
      issue("edition", "An edition date and its kind are recorded together or not at all.");
    }
    if (block.source_identifier.scheme === "authority_source_id" && !kebabId.safeParse(block.source_identifier.value).success) {
      issue("source_identifier", "An authority source identifier is a registry ID.");
    }
  });

export type ProgramEvidenceAuthority = z.infer<typeof programEvidenceAuthoritySchema>;
export type AuthorityQualifiers = NonNullable<ProgramEvidenceAuthority["qualifiers"]>;

export const programEvidenceAuthorityListSchema = z.array(programEvidenceAuthoritySchema).max(50);

/* -------------------------------------------- consistency with the record */

type KnownValue = Exclude<EvidenceNormalizedValue, { kind: "unknown" } | { kind: "unresolved" }>;

function knownValue(value: EvidenceNormalizedValue): KnownValue | null {
  return value.kind === "unknown" || value.kind === "unresolved" ? null : value;
}

/**
 * Every way a well-formed block contradicts, or is falsely linked to, the
 * canonical record it describes. Empty means the block may be used.
 */
export function evidenceAuthorityLinkIssues(
  block: ProgramEvidenceAuthority,
  record: CanonicalEvidenceRecord,
): string[] {
  const issues: string[] = [];
  const profile = authorityFactProfiles[block.fact_key];
  const value = knownValue(record.normalized_value);

  if (block.fact_key !== record.claim.key) issues.push(`fact_key ${block.fact_key} differs from the record's ${record.claim.key}.`);
  if (block.retrieved_at !== record.source.retrieved_at) issues.push("retrieved_at differs from the record's retrieval time.");
  if (block.source_url !== record.source.url) issues.push("source_url differs from the record's source URL.");
  if (!authorityRecordKindEvidenceTypes[block.record_kind].includes(record.evidence_type)) {
    issues.push(`A ${block.record_kind} cannot be recorded as ${record.evidence_type} evidence.`);
  }
  if (block.authority_review.reviewed_on !== null && block.authority_review.reviewed_on < record.source.retrieved_at.slice(0, 10)) {
    issues.push("The block was reviewed before the record was retrieved.");
  }

  const family = block.qualifiers?.family ?? null;
  if (family !== profile.qualifier_family) {
    issues.push(`${block.fact_key} takes ${profile.qualifier_family ?? "no"} qualifiers, not ${family ?? "none"}.`);
  }

  if (profile.coverage_semantics === "not_applicable") {
    if (block.coverage !== "not_applicable") issues.push(`${block.fact_key} records coverage as not_applicable.`);
  } else if (block.coverage === "not_applicable") {
    issues.push(`${block.fact_key} must record parcel coverage.`);
  } else if (value?.kind === "boolean") {
    if (value.value && block.coverage !== "whole_parcel") issues.push("YES is recorded only for the whole parcel.");
    if (!value.value && block.coverage !== "none_of_parcel") issues.push("NO is recorded only when no part of the parcel is covered.");
  }

  const qualifiers = block.qualifiers;
  if (qualifiers?.family === "hazard_map") {
    if (qualifiers.hazard_class !== profile.hazard_class) {
      issues.push(`A ${qualifiers.hazard_class} hazard map cannot describe ${block.fact_key}; High and Very High never stand in for each other.`);
    }
    if (value?.kind === "boolean" && value.value && qualifiers.legend_defines_class_for_area === "no") {
      issues.push("A parcel cannot be inside a class the map's legend does not define.");
    }
  }
  if (qualifiers?.family === "zone_record" && value?.kind === "text") {
    const expected =
      value.value === "single_family_listed_zone"
        ? "listed_zone_exact"
        : value.value === "zone_not_on_single_family_list"
          ? "not_on_list"
          : null;
    if (expected !== qualifiers.zone_match) {
      issues.push(`A recorded ${value.value} contradicts zone_match ${qualifiers.zone_match}; an unresolved zone is recorded as unknown.`);
    }
  }
  if (qualifiers?.family === "lot_area" && value?.kind === "number") {
    if (!isExactSquareFeetConversion(qualifiers.as_recorded.figure, qualifiers.as_recorded.unit, value.value)) {
      issues.push("The recorded lot area is not the exact conversion of the figure as recorded.");
    }
  }
  return issues;
}

/**
 * Parses the authority sidecar against the parsed canonical records. An
 * omitted sidecar is valid: every record is then unattested. Anything
 * malformed, contradictory, duplicated, or falsely linked throws.
 */
export function parseProgramEvidenceAuthority(
  value: unknown,
  records: readonly CanonicalEvidenceRecord[],
): ReadonlyMap<string, ProgramEvidenceAuthority> {
  const fail = (message: string): never => {
    throw new IntegrityValidationError("INVALID_PROGRAM_EVIDENCE_AUTHORITY", message);
  };
  if (value === undefined) return new Map();
  const parsed = programEvidenceAuthorityListSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`Evidence authority failed validation at ${issue.path.join(".") || "sidecar"}: ${issue.message}`);
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  const blocks = new Map<string, ProgramEvidenceAuthority>();
  for (const block of parsed.data) {
    if (blocks.has(block.evidence_id)) fail(`Two authority blocks describe evidence ${block.evidence_id}.`);
    const record = byId.get(block.evidence_id);
    if (record === undefined) fail(`Authority block ${block.evidence_id} names no supplied evidence record.`);
    const issues = evidenceAuthorityLinkIssues(block, record as CanonicalEvidenceRecord);
    if (issues.length > 0) fail(`Authority block ${block.evidence_id}: ${issues[0]}`);
    blocks.set(block.evidence_id, block);
  }
  return blocks;
}

/* ------------------------------------------------ gate failures and results */

/** Why one record cannot establish the fact's recorded value. Closed list. */
export const authorityRecordFailureCodes = [
  "no_authority_block",
  "source_not_official",
  "record_kind_prohibited_for_fact",
  "record_kind_not_establishing",
  "value_not_establishable",
  "issuer_not_registered",
  "authority_source_not_registered",
  "record_identity_incomplete",
  "capture_not_verified",
  "authority_review_incomplete",
  "retrieved_after_as_of",
  "edition_not_established",
  "edition_not_current",
  "parcel_match_not_established",
  "legal_lot_identity_not_established",
  "lot_area_basis_not_accepted",
  "lot_area_not_exact",
  "zone_tripwire_refused",
  "map_search_incomplete",
  "map_history_not_established",
  "map_lineage_uncertain",
  "map_history_does_not_support_value",
  "hazard_area_not_covered",
  "hazard_legend_class_not_defined",
  "plan_not_adopted_in_effect",
  "plan_identification_not_explicit",
  "plan_reference_incomplete",
  "instrument_not_express",
  "instrument_not_in_force",
  "instrument_release_search_incomplete",
] as const;

/** Why no record establishes a fact. Closed list. */
export const authorityFactFailureCodes = ["no_fact_policy", "no_establishing_entries", "no_establishing_record"] as const;

/** Criterion-level reasons the gate fails. Closed list. */
export const authorityCriterionFailureCodes = ["requirement_fact_not_read", "scope_precondition_not_met"] as const;

export type AuthorityRecordFailureCode = (typeof authorityRecordFailureCodes)[number];
export type AuthorityFactFailureCode = (typeof authorityFactFailureCodes)[number];
export type AuthorityCriterionFailureCode = (typeof authorityCriterionFailureCodes)[number];

export interface ProgramFactAuthorityResult {
  key: ProgramFactKey;
  established: boolean;
  /** Records that establish the fact's recorded value. */
  establishing_evidence_ids: string[];
  /** Records carrying the same value that cannot establish it, and why. */
  non_establishing: Array<{ evidence_id: string; failures: AuthorityRecordFailureCode[] }>;
  failures: AuthorityFactFailureCode[];
}

export interface ProgramCriterionAuthorityResult {
  established: boolean;
  facts: ProgramFactAuthorityResult[];
  criterion_failures: Array<{ code: AuthorityCriterionFailureCode; fact_key: ProgramFactKey }>;
}
