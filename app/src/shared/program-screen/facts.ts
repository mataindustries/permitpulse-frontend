import type {
  CanonicalEvidenceRecord,
  EvidenceNormalizedValue,
  EvidenceObservedValue,
} from "../build-week-integrity/types";
import {
  buildClientSafeIntegrityFinding,
  evaluateCanonicalEvidenceClaim,
} from "../build-week-integrity/validation";
import {
  programFactKeys,
  type ProgramFactAssessment,
  type ProgramFactDataClass,
  type ProgramFactKey,
  type ProgramFactSpec,
  type RetiredProgramFactKey,
} from "./types";

const booleanValue = { kind: "boolean" } as const;
const freeText = { kind: "text", allowed: null } as const;

function parcelFact(
  key: ProgramFactKey,
  label: string,
  clientLabel: string,
  dataClass: ProgramFactDataClass,
  value: ProgramFactSpec["value"],
  allowedEvidenceTypes: ProgramFactSpec["allowed_evidence_types"] = null,
): ProgramFactSpec {
  return {
    key,
    label,
    client_label: clientLabel,
    role: "parcel_fact",
    data_class: dataClass,
    value,
    allowed_evidence_types: allowedEvidenceTypes,
    flag: null,
  };
}

function programFlag(
  key: ProgramFactKey,
  label: string,
  clientLabel: string,
  value: ProgramFactSpec["value"],
  flag: NonNullable<ProgramFactSpec["flag"]>,
): ProgramFactSpec {
  return {
    key,
    label,
    client_label: clientLabel,
    role: "program_flag",
    data_class: "source_observation",
    value,
    allowed_evidence_types: ["official_portal", "lookup_attempt"],
    flag,
  };
}

/** Records that come from an adopted instrument or its maps, or a failed lookup of one. */
const adoptedRecordEvidence = ["official_document", "lookup_attempt"] as const;

/**
 * Fact schemas: keys, labels, value shapes, and data classes only; no live
 * value is encoded here. Program-flag facts record what a City display shows
 * and are never inputs to a criterion.
 *
 * Every controlled text value is recorded by a person from the named record.
 * Nothing parses a free-text value into a controlled one, and an incomplete
 * or failed lookup stays unknown: it is never recorded as a "none" value.
 */
export const programFactSpecs: Readonly<Record<ProgramFactKey, ProgramFactSpec>> = {
  "parcel-match": parcelFact(
    "parcel-match",
    "Address-to-parcel match",
    "whether the address matches a single City parcel record",
    "controlled_value",
    booleanValue,
  ),
  jurisdiction: parcelFact(
    "jurisdiction",
    "Land-use jurisdiction",
    "the parcel's land-use jurisdiction",
    "controlled_value",
    {
      kind: "text",
      allowed: [
        "City of Los Angeles",
        "Unincorporated Los Angeles County",
        "Other incorporated city",
      ],
    },
  ),
  /** Kept as displayed. Zone groups are separate controlled facts; this string is never parsed. */
  zoning: parcelFact(
    "zoning",
    "Zoning designation",
    "the parcel's full zoning designation",
    "source_observation",
    freeText,
  ),
  hpoz: parcelFact(
    "hpoz",
    "Historic Preservation Overlay Zone",
    "whether the parcel is within a Historic Preservation Overlay Zone",
    "controlled_value",
    booleanValue,
  ),
  /** Which designation is not stated, so it can only inform a professional judgment. */
  "historic-designation": parcelFact(
    "historic-designation",
    "Historic designation",
    "whether the parcel carries a historic designation",
    "professional_input",
    booleanValue,
  ),
  "historic-cultural-monument": parcelFact(
    "historic-cultural-monument",
    "Historic Cultural Monument designation",
    "whether the parcel is designated a Historic Cultural Monument",
    "controlled_value",
    booleanValue,
  ),
  "zoning-code-chapter": parcelFact(
    "zoning-code-chapter",
    "Zoning Code chapter",
    "whether Zoning Code Chapter 1 or Chapter 1A applies to the parcel",
    "controlled_value",
    { kind: "text", allowed: ["Chapter 1", "Chapter 1A"] },
  ),
  "lot-area": parcelFact(
    "lot-area",
    "Lot area",
    "the parcel's recorded lot area",
    "controlled_value",
    { kind: "number", unit: "sq ft" },
  ),
  /**
   * The SHRA memo (FAQ Q.1) lists the single-family zones and gives no list of
   * multifamily zones, so the only controlled values are "on the list" and
   * "not on the list". Whether an unlisted zone is multifamily-zoned stays
   * unresolved; no value claims it.
   */
  "shra-zone-category": parcelFact(
    "shra-zone-category",
    "SHRA zone category (memo single-family zone list)",
    "whether the parcel's base zone is on the SHRA memo's single-family zone list",
    "controlled_value",
    { kind: "text", allowed: ["single_family_listed_zone", "zone_not_on_single_family_list"] },
  ),
  /** Very High only. A NO here says nothing about a High zone; see high-fire-hazard-severity-zone. */
  "very-high-fire-hazard-severity-zone": parcelFact(
    "very-high-fire-hazard-severity-zone",
    "Very High Fire Hazard Severity Zone",
    "the property's fire-hazard designation",
    "controlled_value",
    booleanValue,
  ),
  /** High only, never Very High: the two designations stay separate facts. */
  "high-fire-hazard-severity-zone": parcelFact(
    "high-fire-hazard-severity-zone",
    "High Fire Hazard Severity Zone",
    "whether the parcel is mapped in a High Fire Hazard Severity Zone, in a state or local responsibility area",
    "controlled_value",
    booleanValue,
  ),
  "state-responsibility-area": parcelFact(
    "state-responsibility-area",
    "State responsibility area",
    "whether the parcel is within the state responsibility area",
    "controlled_value",
    booleanValue,
  ),
  "hillside-area": parcelFact(
    "hillside-area",
    "Hillside area",
    "whether the parcel is mapped in a hillside area",
    "controlled_value",
    booleanValue,
  ),
  "coastal-zone": parcelFact(
    "coastal-zone",
    "Coastal zone",
    "whether the parcel is mapped in the coastal zone",
    "controlled_value",
    booleanValue,
  ),
  /** The Municipal Code term used by Ordinance 188967 (c)(6). */
  "sea-level-rise-area": parcelFact(
    "sea-level-rise-area",
    "Sea Level Rise Area",
    "whether the parcel is within a Sea Level Rise Area as the Municipal Code defines it",
    "controlled_value",
    booleanValue,
  ),
  /** The different test in Ordinance 188968 Sec. 2.G; not interchangeable with sea-level-rise-area. */
  "sb79-sea-level-rise-vulnerability": parcelFact(
    "sb79-sea-level-rise-vulnerability",
    "Vulnerability to one foot of sea level rise",
    "whether an assessment named in Ordinance 188968 records the parcel as vulnerable to one foot of sea level rise",
    "controlled_value",
    booleanValue,
  ),
  "prime-or-statewide-farmland": parcelFact(
    "prime-or-statewide-farmland",
    "Prime farmland or farmland of statewide importance",
    "whether the parcel is mapped as prime farmland or farmland of statewide importance",
    "controlled_value",
    booleanValue,
  ),
  wetlands: parcelFact(
    "wetlands",
    "Wetlands",
    "whether wetlands are recorded on the parcel",
    "controlled_value",
    booleanValue,
  ),
  "nccp-conservation-land": parcelFact(
    "nccp-conservation-land",
    "Natural community conservation plan land",
    "whether the parcel is identified for conservation in an adopted natural community conservation plan",
    "controlled_value",
    booleanValue,
  ),
  "conservation-easement": parcelFact(
    "conservation-easement",
    "Conservation easement",
    "whether the parcel is under a recorded conservation easement",
    "controlled_value",
    booleanValue,
  ),
  "hazardous-waste-site": parcelFact(
    "hazardous-waste-site",
    "Hazardous waste site",
    "whether the parcel is recorded as a hazardous waste site",
    "controlled_value",
    booleanValue,
  ),
  "special-flood-hazard-area": parcelFact(
    "special-flood-hazard-area",
    "Special flood hazard area",
    "whether the parcel is mapped in a special flood hazard area",
    "controlled_value",
    booleanValue,
  ),
  "regulatory-floodway": parcelFact(
    "regulatory-floodway",
    "Regulatory floodway",
    "whether the parcel is mapped in a regulatory floodway",
    "controlled_value",
    booleanValue,
  ),
  "earthquake-fault-zone": parcelFact(
    "earthquake-fault-zone",
    "Earthquake fault zone",
    "whether the parcel is mapped in an earthquake fault zone",
    "controlled_value",
    booleanValue,
  ),
  /** A count of structures has no rule of its own: a structure is never a blocker by itself. */
  "existing-structures": parcelFact(
    "existing-structures",
    "Existing structures",
    "the number of existing structures recorded on the parcel",
    "professional_input",
    { kind: "number", unit: "structures" },
  ),
  /** RSO is one example of price control; price-controlled-housing records the memo's category. */
  "rso-status": parcelFact(
    "rso-status",
    "Rent Stabilization Ordinance status",
    "whether the parcel is recorded as subject to the Rent Stabilization Ordinance",
    "source_observation",
    booleanValue,
  ),
  "occupancy-history": parcelFact(
    "occupancy-history",
    "Residential occupancy history",
    "the parcel's residential occupancy history",
    "professional_input",
    freeText,
  ),
  "affordability-restricted-housing": parcelFact(
    "affordability-restricted-housing",
    "Rent-restricted affordable housing on the parcel",
    "whether housing on the parcel is subject to a recorded covenant, ordinance, or law restricting rents to lower-income levels",
    "controlled_value",
    booleanValue,
  ),
  "price-controlled-housing": parcelFact(
    "price-controlled-housing",
    "Rent- or price-controlled housing on the parcel",
    "whether housing on the parcel is subject to rent or sales-price control by a local public entity, such as the Rent Stabilization Ordinance",
    "controlled_value",
    booleanValue,
  ),
  /** Whether any withdrawal is recorded; its date and the application date are not modeled. */
  "ellis-act-withdrawal-recorded": parcelFact(
    "ellis-act-withdrawal-recorded",
    "Ellis Act withdrawal record",
    "whether a Los Angeles Housing Department record shows an Ellis Act withdrawal of units on the parcel",
    "controlled_value",
    booleanValue,
  ),
  /**
   * The map that created the lot, recorded from the recorded maps: the first
   * value that applies, in list order. A recorded map whose statute is not
   * known, or an incomplete map history, stays unknown.
   */
  "prior-shra-or-sb9-map": parcelFact(
    "prior-shra-or-sb9-map",
    "Prior SHRA or SB 9 map for the lot",
    "whether a map under the SHRA or SB 9 (2021) was recorded for the lot, and under which statute",
    "controlled_value",
    {
      kind: "text",
      allowed: [
        "shra_map_recorded",
        "sb9_map_recorded",
        "shra_or_sb9_tentative_map_not_recorded",
        "other_basis_map_recorded",
        "no_map_recorded",
      ],
    },
  ),
  "housing-element-site-listing": parcelFact(
    "housing-element-site-listing",
    "2021-2029 Housing Element site listing (Appendices 4.1-4.3)",
    "whether the parcel is listed in Appendix 4.1, 4.2, or 4.3 of the City's 2021-2029 Housing Element",
    "controlled_value",
    { kind: "text", allowed: ["appendix_4_1", "appendix_4_2", "appendix_4_3", "not_listed"] },
  ),
  /** Only an affirmative showing. A NO is not a finding that the parcel is not exempt. */
  "sb79-permanent-exemption-shown": parcelFact(
    "sb79-permanent-exemption-shown",
    "SB 79 permanent exemption shown in the adopted Phased Implementation record",
    "whether the adopted Phased Implementation record affirmatively shows the parcel as permanently exempt",
    "controlled_value",
    booleanValue,
    adoptedRecordEvidence,
  ),
  /** Only an affirmative showing. Ordinance 188968 Sec. 4 may reach every parcel regardless. */
  "sb79-temporary-exemption-shown": parcelFact(
    "sb79-temporary-exemption-shown",
    "SB 79 temporary exemption shown in the adopted Phased Implementation record",
    "whether the adopted Phased Implementation record affirmatively shows the parcel as temporarily exempt",
    "controlled_value",
    booleanValue,
    adoptedRecordEvidence,
  ),
  /** The end event of the temporary exemption. Its date is not modeled. */
  "seventh-housing-element-revision-adopted": parcelFact(
    "seventh-housing-element-revision-adopted",
    "Seventh Housing Element revision adopted",
    "whether the City has adopted the seventh revision of its Housing Element",
    "controlled_value",
    booleanValue,
    adoptedRecordEvidence,
  ),
  "tod-alternative-plan-area": parcelFact(
    "tod-alternative-plan-area",
    "Local TOD alternative plan area",
    "whether the parcel is covered by a local transit-oriented development alternative plan adopted by the City",
    "controlled_value",
    booleanValue,
  ),
  "hcm-or-hpoz-designated-by-2025-01-01": parcelFact(
    "hcm-or-hpoz-designated-by-2025-01-01",
    "Historic Cultural Monument or HPOZ designation in effect by January 1, 2025",
    "whether the parcel had a Historic Cultural Monument or Historic Preservation Overlay Zone designation in effect on or before January 1, 2025",
    "controlled_value",
    booleanValue,
  ),
  /** From the Director's map (LAMC 12.22 A.38(j)(7)); never derived from distances or zoning. */
  "low-rise-incentive-area-map-subarea": parcelFact(
    "low-rise-incentive-area-map-subarea",
    "Low-Rise Incentive Area map subarea",
    "the Low-Rise subarea the Director's Low-Rise Incentive Area map shows for the site",
    "controlled_value",
    { kind: "text", allowed: ["lr_1", "lr_2", "not_mapped"] },
  ),
  "low-rise-transportation-row": parcelFact(
    "low-rise-transportation-row",
    "Low-Rise subarea table row",
    "the Table 12.22 A.38.(g)(1)(i) row (Opportunity Corridor, Tier 2 TOD Stop, or Tier 1 TOD Stop) that places the site in its Low-Rise subarea",
    "controlled_value",
    { kind: "text", allowed: ["opportunity_corridor", "tier_2_tod_stop", "tier_1_tod_stop"] },
  ),
  /**
   * rd_or_r2: the corridor row's zones. other_listed_residential_zone: another
   * zone LAMC 12.22 A.38(j)(16) lists (R5 and more restrictive R and A zones,
   * R1P-R5P), placed by a person using the LAMC zone order, which is not
   * captured. zone_not_listed: anything else; (j)(16) is not exhaustive.
   */
  "low-rise-zone-class": parcelFact(
    "low-rise-zone-class",
    "Low-Rise underlying zone group",
    "which Low-Rise zone group the site's underlying zone falls in",
    "controlled_value",
    { kind: "text", allowed: ["rd_or_r2", "other_listed_residential_zone", "zone_not_listed"] },
  ),
  "low-rise-manufacturing-zone-lot": parcelFact(
    "low-rise-manufacturing-zone-lot",
    "Manufacturing-zone lots in the site",
    "whether the site includes a lot in an M1, M2, M3, MR1, MR2, or CM zone",
    "controlled_value",
    { kind: "text", allowed: ["m1_m2_m3_mr1_or_mr2_lot", "cm_lot", "no_m_mr_or_cm_lot"] },
  ),
  "low-rise-single-family-zone-lot": parcelFact(
    "low-rise-single-family-zone-lot",
    "Single-family or more restrictive zone lots in the site",
    "whether the site includes a lot in RW1 or a more restrictive zone",
    "controlled_value",
    booleanValue,
  ),
  "low-rise-excluded-plan-area": parcelFact(
    "low-rise-excluded-plan-area",
    "Low-Rise excluded plan area",
    "whether the site is in the Boyle Heights, Harbor Gateway, or Wilmington-Harbor City Community Plan area or the Cornfield Arroyo Seco Specific Plan",
    "controlled_value",
    {
      kind: "text",
      allowed: [
        "boyle_heights_community_plan",
        "harbor_gateway_community_plan",
        "wilmington_harbor_city_community_plan",
        "cornfield_arroyo_seco_specific_plan",
        "none_of_these",
      ],
    },
  ),
  "zimas-shra-program-field": programFlag(
    "zimas-shra-program-field",
    "ZIMAS SHRA / SB 684 program field",
    "the ZIMAS SHRA / SB 684 program field as displayed",
    booleanValue,
    {
      pathway: "la_shra",
      signal_when_true: "indicates_no_blocker",
      signal_when_false: "indicates_blocker",
    },
  ),
  "zimas-sb79-category": programFlag(
    "zimas-sb79-category",
    "ZIMAS SB 79 category",
    "the SB 79 category displayed in ZIMAS",
    freeText,
    { pathway: "la_sb79", signal_when_true: "no_signal", signal_when_false: "no_signal" },
  ),
  "zimas-sb79-tier": programFlag(
    "zimas-sb79-tier",
    "ZIMAS SB 79 tier",
    "the SB 79 tier displayed in ZIMAS",
    freeText,
    { pathway: "la_sb79", signal_when_true: "no_signal", signal_when_false: "no_signal" },
  ),
  "zimas-sb79-exemption": programFlag(
    "zimas-sb79-exemption",
    "ZIMAS SB 79 exemption display",
    "whether ZIMAS displays an SB 79 exemption or exclusion for the parcel",
    booleanValue,
    {
      pathway: "la_sb79",
      signal_when_true: "indicates_blocker",
      signal_when_false: "indicates_no_blocker",
    },
  ),
  "zimas-low-rise-category": programFlag(
    "zimas-low-rise-category",
    "ZIMAS Low-Rise category",
    "the Low-Rise category displayed in ZIMAS",
    freeText,
    { pathway: "la_low_rise", signal_when_true: "no_signal", signal_when_false: "no_signal" },
  ),
};

export interface RetiredProgramFactSpec {
  key: RetiredProgramFactKey;
  reason: string;
  /**
   * `rename`: the same record and value under a corrected name; exactly one
   * replacement with the same value shape. `drop`: the evidence is not carried
   * over, because the replacement (if any) asks a narrower question.
   */
  migration: "rename" | "drop";
  replaced_by: readonly ProgramFactKey[];
}

/** Keys removed when the broad criteria were split. Evidence for them is rejected. */
export const retiredProgramFacts: Readonly<Record<RetiredProgramFactKey, RetiredProgramFactSpec>> = {
  "general-plan-land-use": {
    key: "general-plan-land-use",
    reason: "Ordinance 188967 states no General Plan land-use test for Low-Rise geography, and no other criterion used it.",
    migration: "drop",
    replaced_by: [],
  },
  "specific-plan-area": {
    key: "specific-plan-area",
    reason: "A yes/no cannot name the one Specific Plan that Ordinance 188967 (c)(9) lists, and Ordinance 188968 states no Specific Plan test.",
    migration: "drop",
    replaced_by: ["low-rise-excluded-plan-area"],
  },
  "landslide-area": {
    key: "landslide-area",
    reason: "The SHRA memo names no landslide-area site limit, and no other criterion used it.",
    migration: "drop",
    replaced_by: [],
  },
  "flood-zone": {
    key: "flood-zone",
    reason: "Broader than the memo's designations: a mapped flood zone is not necessarily a special flood hazard area or a regulatory floodway.",
    migration: "drop",
    replaced_by: ["special-flood-hazard-area", "regulatory-floodway"],
  },
  "fault-zone": {
    key: "fault-zone",
    reason: "Broader than the memo's earthquake fault zone designation.",
    migration: "drop",
    replaced_by: ["earthquake-fault-zone"],
  },
  "existing-dwelling-units": {
    key: "existing-dwelling-units",
    reason: "Ordinance 188968 states no existing-housing test, and SB 79's own text is not captured.",
    migration: "drop",
    replaced_by: [],
  },
  "prior-subdivisions": {
    key: "prior-subdivisions",
    reason: "A yes/no for any prior subdivision shows neither whether a map was recorded nor the statute it was recorded under; the memo restricts only SHRA and SB 9 maps.",
    migration: "drop",
    replaced_by: ["prior-shra-or-sb9-map"],
  },
  "housing-element-site-status": {
    key: "housing-element-site-status",
    reason: "Free text; replaced by the controlled Housing Element appendix listing.",
    migration: "drop",
    replaced_by: ["housing-element-site-listing"],
  },
  "sb79-permanent-exclusion": {
    key: "sb79-permanent-exclusion",
    reason: "Ordinance 188968 Section 1 says \"permanently exempt\". Renamed from exclusion to exemption; same record, same value.",
    migration: "rename",
    replaced_by: ["sb79-permanent-exemption-shown"],
  },
  "sb79-temporary-exemption": {
    key: "sb79-temporary-exemption",
    reason: "Renamed to say that it records only an affirmative showing; same record, same value.",
    migration: "rename",
    replaced_by: ["sb79-temporary-exemption-shown"],
  },
};

export function programFlagKeysFor(pathway: string): ProgramFactKey[] {
  return programFactKeys.filter(
    (key) => programFactSpecs[key].flag?.pathway === pathway,
  );
}

export function observedDisplayValue(value: EvidenceObservedValue): string {
  if (value.kind === "boolean") return value.value ? "YES" : "NO";
  if (value.kind === "number") {
    return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
  }
  if (value.kind === "text" || value.kind === "date") return value.value;
  return "NOT OBSERVED";
}

export function isEstablishedFact(fact: ProgramFactAssessment): boolean {
  return (
    (fact.classification === "verified_fact" ||
      fact.classification === "source_observation") &&
    fact.normalized_value.kind !== "unknown" &&
    fact.normalized_value.kind !== "unresolved"
  );
}

function notSuppliedFact(key: ProgramFactKey): ProgramFactAssessment {
  const spec = programFactSpecs[key];
  const normalized: EvidenceNormalizedValue = {
    kind: "unknown",
    value: null,
    reason: "not_observed",
  };
  return {
    key,
    label: spec.label,
    client_label: spec.client_label,
    role: spec.role,
    supplied: false,
    classification: "unknown",
    normalized_value: normalized,
    reviewed: false,
    // Same wording as the canonical evaluator's unknown template.
    statement: `Available evidence is insufficient to determine ${spec.client_label}.`,
    assessment_id: null,
    evidence: [],
    observations: [],
  };
}

/**
 * Assesses each fact key through the canonical Case Integrity evaluator.
 * Conflict detection, unknown handling, and client-safe provenance are owned
 * by `evaluateCanonicalEvidenceClaim` and `buildClientSafeIntegrityFinding`.
 */
export function assessProgramFacts(
  records: readonly CanonicalEvidenceRecord[],
  keys: Iterable<ProgramFactKey>,
): ProgramFactAssessment[] {
  const wanted = new Set<ProgramFactKey>(keys);
  for (const record of records) wanted.add(record.claim.key as ProgramFactKey);

  return programFactKeys
    .filter((key) => wanted.has(key))
    .map((key) => {
      const group = records.filter((record) => record.claim.key === key);
      if (group.length === 0) return notSuppliedFact(key);

      const spec = programFactSpecs[key];
      const assessment = evaluateCanonicalEvidenceClaim(group);
      const finding = buildClientSafeIntegrityFinding(assessment);
      return {
        key,
        label: spec.label,
        client_label: spec.client_label,
        role: spec.role,
        supplied: true,
        classification: assessment.classification,
        normalized_value: assessment.normalized_value,
        reviewed: assessment.evidence_records.every(
          (record) =>
            record.review_status === "reviewed" ||
            record.review_status === "resolved",
        ),
        statement: finding.statement,
        assessment_id: assessment.id,
        evidence: finding.evidence,
        observations: assessment.evidence_records.map((record) => ({
          evidence_id: record.id,
          raw_observed_value: record.raw_observed_value,
          observed_display_value: observedDisplayValue(record.raw_observed_value),
          normalized_value: record.normalized_value,
          review_status: record.review_status,
        })),
      };
    });
}
