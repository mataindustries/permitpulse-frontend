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
  type ProgramFactKey,
  type ProgramFactSpec,
} from "./types";

const booleanValue = { kind: "boolean" } as const;
const freeText = { kind: "text", allowed: null } as const;

function parcelFact(
  key: ProgramFactKey,
  label: string,
  clientLabel: string,
  value: ProgramFactSpec["value"],
  allowedEvidenceTypes: ProgramFactSpec["allowed_evidence_types"] = null,
): ProgramFactSpec {
  return {
    key,
    label,
    client_label: clientLabel,
    role: "parcel_fact",
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
    value,
    allowed_evidence_types: ["official_portal", "lookup_attempt"],
    flag,
  };
}

/**
 * v1 fact schemas. These are keys, labels, and value shapes only; no live
 * value is encoded here. Program-flag facts record what a City display shows
 * and are never inputs to a criterion.
 */
export const programFactSpecs: Readonly<Record<ProgramFactKey, ProgramFactSpec>> = {
  "parcel-match": parcelFact(
    "parcel-match",
    "Address-to-parcel match",
    "whether the address matches a single City parcel record",
    booleanValue,
  ),
  jurisdiction: parcelFact(
    "jurisdiction",
    "Land-use jurisdiction",
    "the parcel's land-use jurisdiction",
    {
      kind: "text",
      allowed: [
        "City of Los Angeles",
        "Unincorporated Los Angeles County",
        "Other incorporated city",
      ],
    },
  ),
  zoning: parcelFact(
    "zoning",
    "Zoning designation",
    "the parcel's full zoning designation",
    freeText,
  ),
  "general-plan-land-use": parcelFact(
    "general-plan-land-use",
    "General Plan land use",
    "the parcel's General Plan land-use designation",
    freeText,
  ),
  "specific-plan-area": parcelFact(
    "specific-plan-area",
    "Specific Plan area",
    "whether the parcel is within a Specific Plan area",
    booleanValue,
  ),
  hpoz: parcelFact(
    "hpoz",
    "Historic Preservation Overlay Zone",
    "whether the parcel is within a Historic Preservation Overlay Zone",
    booleanValue,
  ),
  "historic-designation": parcelFact(
    "historic-designation",
    "Historic designation",
    "whether the parcel carries a historic designation",
    booleanValue,
  ),
  "zoning-code-chapter": parcelFact(
    "zoning-code-chapter",
    "Zoning Code chapter",
    "whether Zoning Code Chapter 1 or Chapter 1A applies to the parcel",
    { kind: "text", allowed: ["Chapter 1", "Chapter 1A"] },
  ),
  "lot-area": parcelFact(
    "lot-area",
    "Lot area",
    "the parcel's recorded lot area",
    { kind: "number", unit: "sq ft" },
  ),
  "very-high-fire-hazard-severity-zone": parcelFact(
    "very-high-fire-hazard-severity-zone",
    "Very High Fire Hazard Severity Zone",
    "the property's fire-hazard designation",
    booleanValue,
  ),
  "hillside-area": parcelFact(
    "hillside-area",
    "Hillside area",
    "whether the parcel is mapped in a hillside area",
    booleanValue,
  ),
  "coastal-zone": parcelFact(
    "coastal-zone",
    "Coastal zone",
    "whether the parcel is mapped in the coastal zone",
    booleanValue,
  ),
  "fault-zone": parcelFact(
    "fault-zone",
    "Fault zone",
    "whether the parcel is mapped in a fault zone",
    booleanValue,
  ),
  "landslide-area": parcelFact(
    "landslide-area",
    "Landslide area",
    "whether the parcel is mapped in a landslide area",
    booleanValue,
  ),
  "flood-zone": parcelFact(
    "flood-zone",
    "Flood zone",
    "whether the parcel is mapped in a flood zone",
    booleanValue,
  ),
  "existing-dwelling-units": parcelFact(
    "existing-dwelling-units",
    "Existing dwelling units",
    "the number of existing dwelling units recorded on the parcel",
    { kind: "number", unit: "dwelling units" },
  ),
  "existing-structures": parcelFact(
    "existing-structures",
    "Existing structures",
    "the number of existing structures recorded on the parcel",
    { kind: "number", unit: "structures" },
  ),
  "rso-status": parcelFact(
    "rso-status",
    "Rent Stabilization Ordinance status",
    "whether the parcel is recorded as subject to the Rent Stabilization Ordinance",
    booleanValue,
  ),
  "occupancy-history": parcelFact(
    "occupancy-history",
    "Residential occupancy history",
    "the parcel's residential occupancy history",
    freeText,
  ),
  "prior-subdivisions": parcelFact(
    "prior-subdivisions",
    "Prior subdivisions",
    "whether a prior subdivision of the parcel is recorded",
    booleanValue,
  ),
  "housing-element-site-status": parcelFact(
    "housing-element-site-status",
    "Housing Element site status",
    "the parcel's Housing Element site status",
    freeText,
  ),
  "sb79-permanent-exclusion": parcelFact(
    "sb79-permanent-exclusion",
    "SB 79 permanent exclusion in the adopted Phased Implementation record",
    "whether the adopted Phased Implementation record shows a permanent exclusion for the parcel",
    booleanValue,
    ["official_document", "lookup_attempt"],
  ),
  "sb79-temporary-exemption": parcelFact(
    "sb79-temporary-exemption",
    "SB 79 temporary exemption in the adopted Phased Implementation record",
    "whether the adopted Phased Implementation record shows a temporary exemption for the parcel",
    booleanValue,
    ["official_document", "lookup_attempt"],
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
