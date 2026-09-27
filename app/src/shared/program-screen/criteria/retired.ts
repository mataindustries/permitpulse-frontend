import type { RetiredProgramCriterionId } from "../types";

export interface RetiredProgramCriterion {
  /** The atomic criteria that now carry the parts the captured source supports. */
  replaced_by: readonly string[];
  /** What was removed rather than carried over, and why. */
  removed: readonly string[];
}

/**
 * The nine broad pending criteria, split on 2026-09-27 into atomic criteria
 * that each rest on one proposition in a captured operative source. None of
 * the nine may ship again (the criterion schema rejects their IDs), and no
 * replacement is human-verified. See docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md.
 */
export const retiredProgramCriteria: Readonly<Record<RetiredProgramCriterionId, RetiredProgramCriterion>> = {
  "la_shra.lot-area-and-zoning": {
    replaced_by: [
      "la_shra.zone-category",
      "la_shra.multifamily-lot-area-threshold",
      "la_shra.single-family-lot-area-threshold",
      "la_shra.single-family-vacancy-condition",
    ],
    removed: [
      "The free-text zoning fact no longer feeds this criterion; zone groups are a separate controlled fact.",
    ],
  },
  "la_shra.existing-structures-and-occupancy": {
    replaced_by: [
      "la_shra.ellis-act-withdrawal",
      "la_shra.protected-housing-affordability-covenant",
      "la_shra.protected-housing-price-control",
      "la_shra.protected-housing-tenant-occupancy",
      "la_shra.protected-housing-demolition-or-alteration",
    ],
    removed: ["A structure count is no longer read by any SHRA demolition criterion."],
  },
  "la_shra.prior-subdivisions": {
    replaced_by: ["la_shra.prior-shra-or-sb9-map"],
    removed: [
      "prior-subdivisions (yes/no for any subdivision) is retired.",
      "No adjacency test: the memo (FAQ Q.26) states none.",
    ],
  },
  "la_shra.housing-element-site-status": {
    replaced_by: ["la_shra.housing-element-projected-units", "la_shra.housing-element-lower-income-units"],
    removed: ["housing-element-site-status (free text) is retired."],
  },
  "la_shra.environmental-constraints": {
    replaced_by: [
      "la_shra.prime-or-statewide-farmland",
      "la_shra.wetlands",
      "la_shra.very-high-fire-hazard-severity-zone",
      "la_shra.high-fire-hazard-severity-zone",
      "la_shra.natural-community-conservation-plan-land",
      "la_shra.protected-species-habitat",
      "la_shra.conservation-easement",
      "la_shra.hazardous-waste-site",
      "la_shra.special-flood-hazard-area",
      "la_shra.regulatory-floodway",
      "la_shra.earthquake-fault-zone",
    ],
    removed: [
      "hillside-area is no longer an SHRA input: the memo names no hillside site limit.",
      "landslide-area, flood-zone, and fault-zone are retired.",
    ],
  },
  "la_sb79.permanent-exclusion": {
    replaced_by: [
      "la_sb79.permanent-exemption-shown",
      "la_sb79.permanent-exemption-walking-path",
      "la_sb79.permanent-exemption-industrial-hub",
    ],
    removed: ["sb79-permanent-exclusion is renamed sb79-permanent-exemption-shown."],
  },
  "la_sb79.temporary-exemption": {
    replaced_by: [
      "la_sb79.temporary-exemption-all-parcels",
      "la_sb79.temporary-exemption-period",
      "la_sb79.temporary-exemption-shown",
      "la_sb79.temporary-exemption-capacity-criteria",
      "la_sb79.temporary-exemption-tod-alternative-plan",
      "la_sb79.temporary-exemption-fire-or-state-responsibility-area",
      "la_sb79.temporary-exemption-sea-level-rise",
    ],
    removed: ["sb79-temporary-exemption is renamed sb79-temporary-exemption-shown."],
  },
  "la_sb79.site-and-overlay-standards": {
    replaced_by: ["la_sb79.temporary-exemption-historic-resource"],
    removed: [
      "Dissolved: Ordinance 188968 states no zoning, Specific Plan, overlay, or existing-housing standard.",
      "zoning is no longer an SB 79 input; specific-plan-area and existing-dwelling-units are retired.",
      "The historic-resource test moved to the temporary-exemption provision that governs it (Sec. 2.H).",
    ],
  },
  "la_low_rise.geographic-criteria": {
    replaced_by: [
      "la_low_rise.incentive-area-map-subarea",
      "la_low_rise.subarea-distance-bands",
      "la_low_rise.subarea-geographic-criteria",
      "la_low_rise.underlying-zone",
      "la_low_rise.manufacturing-zone-exclusion",
      "la_low_rise.single-family-zone-exclusion",
      "la_low_rise.fire-restriction-area-exclusion",
      "la_low_rise.coastal-zone-exclusion",
      "la_low_rise.sea-level-rise-area-exclusion",
      "la_low_rise.excluded-plan-area",
      "la_low_rise.c10-exception-path",
      "la_low_rise.tod-subarea-historic-limit",
    ],
    removed: [
      "general-plan-land-use and specific-plan-area are retired.",
      "zoning (free text) is no longer a Low-Rise input; zone groups are controlled facts.",
    ],
  },
};
