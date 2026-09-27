import type { ProgramCriterion, ProgramCriterionException, ProgramPathwayPack } from "../types";
import {
  cite,
  jurisdictionCriterion,
  parcelMatchCriterion,
  pendingAtomicCriterion,
  professionalAtomicCriterion,
  repoSourceNotes,
} from "./common";

/**
 * SB 79 and Low-Rise are separate pathways: the repo source notes say they are
 * related but distinct and that an SB 79 result is not a Low-Rise result.
 *
 * Repo-sourced (unchanged): Low-Rise overlay review is judgment.
 *
 * Atomic criteria (pending human verification), split on 2026-09-27 from the
 * captured Ordinances 188968 and 188967 (official-sources/). SB 79 speaks of
 * exemptions, not exclusions. Only an affirmative showing on the adopted
 * record can count for a permanent exemption; a parcel not shown is never
 * treated as outside it. Low-Rise site exclusions carry their exceptions,
 * and none can block while an exception is unmodeled. The September 24, 2026
 * Low-Rise draft is proposed, not operative, and is never a basis here.
 */

// SB 79 TEMPORARY EXEMPTION: HIGHEST-RISK UNRESOLVED ITEM.
// Ordinance 188968 Sec. 4 says every parcel in the City is "subject to
// temporarily exempt status". Read literally, that would block the SB 79
// pathway citywide. Whether it exempts every parcel now, or only makes every
// parcel mappable under Sec. 2, is unresolved, and it must be reconciled with
// Ordinance 188967 (c)(10) and (g)(1)(iii)b, which refer to sites "not exempt"
// under this ordinance, and with GCS 65912.161(b). None of the temporary-
// exemption criteria below may become a production disqualifier merely from
// this refactor: each one's permitted_outcomes excludes
// "disqualifying_per_source", the evaluator rejects any other outcome, and a
// test pins it. Changing that needs a named human reviewer's verification of
// the Sec. 4 reading and a deliberate, reviewed change to these ceilings.

const ord188968Section1 =
  "Section 1. Pursuant to California Government Code Section 65912.160(e), the City Council adopts this ordinance on eligible sites meeting one of the criteria referenced below, making the sites permanently exempt from Senate Bill 79, codified at Government Code, Title 7, Division 1, Chapter 4.1.5 (Senate Bill 79):";
const ord188968Section2Lead =
  "Sec. 2. Pursuant to California Government Code Section 65912.161(b), the City Council adopts this ordinance temporarily exempting certain parcels from Senate Bill 79, for the period that is prior to one year following the adoption of the seventh revision of the City’s Housing Element.";
const ord188968Section2Criteria =
  "This ordinance is adopted on eligible sites meeting any one of the criteria referenced below making the sites temporarily exempt from Government Code, Title 7, Division 1, Chapter 4.1.5:";
const ord188968Section3 =
  "By enacting this ordinance, the City Council grants the Director of Planning with the power and duty, consistent with City Charter Section 553, to issue and update maps with eligible transit-oriented development sites meeting the criteria for permanent or temporarily exempt status";
const ord188968ScagRecital =
  "WHEREAS, eligibility for the Phased Implementation Ordinance is contingent on the availability of a final map which has not yet been produced and approved by the Southern California Association of Governments";

/** No temporary-exemption criterion may block in this branch; see the note above. */
const temporaryExemptionCeiling: ProgramCriterion["permitted_outcomes"] = [
  "consistent_with_source",
  "requires_judgment",
];

function temporaryExemptionCriterion(input: {
  id: string;
  label: string;
  fact_keys: ProgramCriterion["fact_keys"];
  pinpoint: string;
  excerpts: readonly string[];
  summary: string;
  question_if_unknown: string;
  question_if_conflict: string;
}): ProgramCriterion {
  return pendingAtomicCriterion({
    ...input,
    pathway: "la_sb79",
    source: "phasedImplementationOrdinance",
    permitted_outcomes: temporaryExemptionCeiling,
  });
}

const ord188967C6 =
  "(6) The project site does not include any lots located within a Fire Restriction Area, the Coastal Zone, or a Sea Level Rise Area. Except that a project site that is located within a Fire Restriction Area or the Coastal Zone shall be eligible if properties that are abutting, across the street or alley, or have a common corner with the subject property, are not in a Fire Restriction Area or Coastal Zone, and are eligible for Incentives contained in this subdivision.";

/** Ordinance 188967 (c)(10): overrides exclusions (4), (5), (6), and (9). Not modeled by any fact. */
const c10Exception: ProgramCriterionException = {
  label: "(c)(10) path for an SB 79 site not exempt under the Phased Implementation Ordinance",
  pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(10), page 7",
  fact_keys: [],
};
/** Ordinance 188967 (c)(6): neighboring properties outside a Fire Restriction Area or the Coastal Zone. */
const neighboringPropertiesException: ProgramCriterionException = {
  label: "(c)(6) exception when abutting, across-the-street, and corner properties are outside a Fire Restriction Area or the Coastal Zone",
  pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6",
  fact_keys: [],
};

/** A Low-Rise site exclusion: an exclusion never blocks while its exceptions are unmodeled. */
function lowRiseExclusion(input: {
  id: string;
  label: string;
  fact_keys: ProgramCriterion["fact_keys"];
  pinpoint: string;
  excerpts: readonly string[];
  summary: string;
  exceptions: readonly ProgramCriterionException[];
  question_if_unknown: string;
  question_if_conflict: string;
}): ProgramCriterion {
  return pendingAtomicCriterion({
    id: input.id,
    pathway: "la_low_rise",
    label: input.label,
    fact_keys: input.fact_keys,
    source: "lowRiseOrdinance",
    pinpoint: input.pinpoint,
    excerpts: input.excerpts,
    summary: input.summary,
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    exception_paths: input.exceptions,
    question_if_unknown: input.question_if_unknown,
    question_if_conflict: input.question_if_conflict,
  });
}

export const sb79Pathway = {
  id: "la_sb79",
  label: "SB 79 phased implementation — City of Los Angeles",
  confirmer: "Los Angeles City Planning",
} as const satisfies ProgramPathwayPack["pathway"];

export const lowRisePathway = {
  id: "la_low_rise",
  label: "Low-Rise (Mixed Income Incentive Program) — City of Los Angeles",
  confirmer: "Los Angeles City Planning",
} as const satisfies ProgramPathwayPack["pathway"];

export const sb79Criteria: readonly ProgramCriterion[] = [
  parcelMatchCriterion("la_sb79"),
  jurisdictionCriterion("la_sb79"),
  /* --------------------------------------------- permanent exemption */
  pendingAtomicCriterion({
    id: "la_sb79.permanent-exemption-shown",
    pathway: "la_sb79",
    label: "SB 79 permanent exemption shown in the adopted Phased Implementation record",
    fact_keys: ["sb79-permanent-exemption-shown"],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Section 1, page 4; Sec. 3, page 5; recital, page 3",
    excerpts: [ord188968Section1, ord188968Section3, ord188968ScagRecital],
    summary:
      "Section 1 makes sites meeting its criteria permanently exempt from SB 79, and Sec. 3 has the Director map them. Only an affirmative showing can count: the maps await SCAG's final TOD map, so a parcel not shown is never treated as outside the exemption.",
    permitted_outcomes: ["disqualifying_per_source", "requires_judgment"],
    question_if_unknown:
      "Does the adopted Phased Implementation record (Ordinance 188968 and the Director's exemption map) affirmatively show this parcel as permanently exempt from SB 79, and what is the map's date?",
    question_if_conflict:
      "Official records disagree on whether this parcel is shown as permanently exempt from SB 79. Which record governs?",
  }),
  professionalAtomicCriterion({
    id: "la_sb79.permanent-exemption-walking-path",
    pathway: "la_sb79",
    label: "SB 79 permanent exemption criterion A: no walking path under one mile to the TOD stop",
    fact_keys: [],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Section 1.A, page 4",
    excerpts: [
      ord188968Section1,
      "A. A site for which there exists no walking path of less than one mile from that location to the transit-oriented development stop (Gov. Code Sec. 65912.160(e)(1));",
    ],
    summary:
      "A site with no walking path of less than one mile to the transit-oriented development stop is permanently exempt. That needs a walking-network analysis to TOD stops SCAG has not finalized; no parcel fact records it, so a parcel missing from the map may still meet it.",
    question_if_unknown:
      "Is there a walking path of less than one mile from this site to the transit-oriented development stop?",
    question_if_conflict:
      "Records disagree on the walking distance from this site to the transit-oriented development stop. Which record governs?",
    question_if_judgment:
      "Is there a walking path of less than one mile from this site to the transit-oriented development stop (Ordinance 188968 Section 1.A)?",
  }),
  professionalAtomicCriterion({
    id: "la_sb79.permanent-exemption-industrial-hub",
    pathway: "la_sb79",
    label: "SB 79 permanent exemption criterion B: industrial employment hub",
    fact_keys: [],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Section 1.B, page 4",
    excerpts: [
      ord188968Section1,
      "B. A site designated as an industrial employment hub if the City has at least 15 transit-oriented development stops.",
      "An industrial employment hub shall be a contiguous area of at least 250 acres designated in the City’s General Plan on or before January 1, 2025, as an employment lands area;",
    ],
    summary:
      "A site in an industrial employment hub (a contiguous area of at least 250 acres designated as employment lands in the General Plan by January 1, 2025) is permanently exempt. The designation, contiguity, and industrial-use tests are analyses no parcel fact records.",
    question_if_unknown: "Is this site within an area the General Plan designates as employment lands?",
    question_if_conflict:
      "Records disagree on whether this site is within a designated industrial employment hub. Which record governs?",
    question_if_judgment:
      "Is this site within an industrial employment hub as Ordinance 188968 Section 1.B describes it?",
  }),

  /* --------------------------------------------- temporary exemption */
  pendingAtomicCriterion({
    id: "la_sb79.temporary-exemption-all-parcels",
    pathway: "la_sb79",
    label: "SB 79 temporary exemption: Sec. 4 statement covering all parcels in the City",
    fact_keys: ["jurisdiction"],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Sec. 4, page 6; Sec. 2, page 4; recital, page 3",
    excerpts: [
      "Sec. 4. Pursuant to the City’s local housing incentive programs, including, without limitation, LAMC Section 12.22 A.38, all parcels within the City’s jurisdiction are subject to temporarily exempt status under Government Code Section 65912.161(b).",
      ord188968Section2Criteria,
      "the City released a draft map identifying all of the City as eligible for permanent and temporary exemption;",
    ],
    summary:
      "Sec. 4 says all parcels in the City are subject to temporarily exempt status. Whether that exempts every parcel now, or only makes every parcel mappable under Sec. 2, is unresolved, as is how it squares with Ordinance 188967's references to sites not exempt. This reading can never block.",
    // Highest risk: judgment only, never a blocker. See the note at the top of this file.
    permitted_outcomes: ["requires_judgment"],
    question_if_unknown:
      "Which agency has land-use jurisdiction over the matched parcel, for the Ordinance 188968 Sec. 4 temporary-exemption statement?",
    question_if_conflict:
      "Official records disagree on the matched parcel's land-use jurisdiction. Which record governs for Ordinance 188968 Sec. 4?",
  }),
  temporaryExemptionCriterion({
    id: "la_sb79.temporary-exemption-period",
    label: "SB 79 temporary exemption period: ends one year after the seventh Housing Element revision",
    fact_keys: ["seventh-housing-element-revision-adopted"],
    pinpoint: "Ordinance 188968, Sec. 2, page 4, with the recital on page 4",
    excerpts: [
      ord188968Section2Lead,
      "exempt from SB 79 provisions, which exemption expires one year after adoption of the jurisdiction’s seventh housing element revision; and",
    ],
    summary:
      "The temporary exemption runs until one year after the City adopts the seventh revision of its Housing Element. The adoption date and the evaluation date are not modeled, so the end date cannot be computed; this criterion can never support a blocker.",
    question_if_unknown: "Has the City adopted the seventh revision of its Housing Element, and on what date?",
    question_if_conflict:
      "Official records disagree on whether or when the City adopted the seventh revision of its Housing Element. Which record governs?",
  }),
  pendingAtomicCriterion({
    id: "la_sb79.temporary-exemption-shown",
    pathway: "la_sb79",
    label: "SB 79 temporary exemption shown in the adopted Phased Implementation record",
    fact_keys: ["sb79-temporary-exemption-shown"],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Sec. 2, page 4; Sec. 3, page 5",
    excerpts: [ord188968Section2Criteria, ord188968Section3],
    summary:
      "Sec. 2 temporarily exempts sites meeting any of its criteria, and Sec. 3 has the Director map them. A showing cannot block until the Sec. 4 reading is resolved, and a parcel not shown may still be reached by Sec. 4.",
    // Judgment only in both directions until Sec. 4 is resolved.
    permitted_outcomes: ["requires_judgment"],
    question_if_unknown:
      "Does the adopted Phased Implementation record (Ordinance 188968 and the Director's exemption map) affirmatively show this parcel as temporarily exempt from SB 79, and what is the map's date?",
    question_if_conflict:
      "Official records disagree on whether this parcel is shown as temporarily exempt from SB 79. Which record governs?",
  }),
  professionalAtomicCriterion({
    id: "la_sb79.temporary-exemption-capacity-criteria",
    pathway: "la_sb79",
    label: "SB 79 temporary exemption criteria A-D: zoned capacity and resource-area tests",
    fact_keys: [],
    source: "phasedImplementationOrdinance",
    pinpoint: "Ordinance 188968, Sec. 2.A-D, pages 4-5",
    excerpts: [
      "A. A site that has been identified by the City which permits density and a residential floor area ratio at no less than 50 percent of the standards specified in subdivision (a) of Government Code Section 65912.157 (Gov. Code Sec. 65912.161(b)(1)(A)).",
      "D. A site in an area designated as low-resource on the most recently adopted version of the opportunity area maps published by the California Tax Credit Allocation Committee and the California Department of Housing and Community Development (HCD), and the City cumulatively allows for at least 50 percent of the total capacity for units and floor area as specified under Government Code Section 65912.157 across all transit-oriented development zones (Gov. Code Sec. 65912.161 (b)(1)(B)(iii)).",
    ],
    summary:
      "Criteria A-D compare permitted density and floor area with SB 79's standards for a site, its TOD zone, or the City, some within low-resource areas. SB 79's standards are not captured, and the comparisons are analyses no parcel fact records.",
    question_if_unknown:
      "Has the City identified this site, or its transit-oriented development zone, under any capacity or resource-area criterion in Ordinance 188968 Sec. 2.A-D?",
    question_if_conflict:
      "Records disagree on whether this site meets a capacity or resource-area criterion in Ordinance 188968 Sec. 2.A-D. Which record governs?",
    question_if_judgment:
      "Does this site meet any of the capacity or resource-area criteria in Ordinance 188968 Sec. 2.A-D?",
  }),
  temporaryExemptionCriterion({
    id: "la_sb79.temporary-exemption-tod-alternative-plan",
    label: "SB 79 temporary exemption criterion E: local TOD alternative plan",
    fact_keys: ["tod-alternative-plan-area"],
    pinpoint: "Ordinance 188968, Sec. 2.E, page 5",
    excerpts: [
      "E. A site that is covered by a local transit-oriented development alternative plan adopted by the City (Gov. Code Sec. 65912.161(b)(1)(C)).",
    ],
    summary:
      "A site covered by a local TOD alternative plan adopted by the City is temporarily exempt. This criterion cannot block while the Sec. 4 reading is unresolved; a site outside such a plan is consistent with criterion E only.",
    question_if_unknown:
      "Is this parcel covered by a local transit-oriented development alternative plan adopted by the City?",
    question_if_conflict:
      "Official records disagree on whether a City-adopted transit-oriented development alternative plan covers this parcel. Which record governs?",
  }),
  temporaryExemptionCriterion({
    id: "la_sb79.temporary-exemption-fire-or-state-responsibility-area",
    label: "SB 79 temporary exemption criterion F: Very High Fire Hazard Severity Zone or state responsibility area",
    fact_keys: ["very-high-fire-hazard-severity-zone", "state-responsibility-area"],
    pinpoint: "Ordinance 188968, Sec. 2.F, page 5",
    excerpts: [
      "F. A site within a very high fire hazard severity zone, as determined by the Department of Forestry and Fire Protection pursuant to Government Code Section 51178, or within the state responsibility area, as defined in Public Resources Code Section 4102 (Gov. Code Sec. 65912.161(b)(1)(D)).",
    ],
    summary:
      "A site in a Very High Fire Hazard Severity Zone (as CAL FIRE determines under GCS 51178) or in the state responsibility area is temporarily exempt. A High zone is not part of this test. This criterion cannot block while the Sec. 4 reading is unresolved.",
    question_if_unknown:
      "Is the parcel mapped in a Very High Fire Hazard Severity Zone as CAL FIRE determines it, and is it within the state responsibility area?",
    question_if_conflict:
      "Official sources disagree on the parcel's fire-hazard designation or state responsibility area status. Which source governs for Ordinance 188968 Sec. 2.F?",
  }),
  temporaryExemptionCriterion({
    id: "la_sb79.temporary-exemption-sea-level-rise",
    label: "SB 79 temporary exemption criterion G: vulnerable to one foot of sea level rise",
    fact_keys: ["sb79-sea-level-rise-vulnerability"],
    pinpoint: "Ordinance 188968, Sec. 2.G, page 5",
    excerpts: [
      "G. A site that is vulnerable to one foot of sea level rise, as determined by the National Oceanic and Atmospheric Administration, the Ocean Protection Council, the United States Geological Survey, the University of California, ora local government’s coastal hazards vulnerability assessment (Gov. Code Sec. 65912.161(b)(1)(E)).",
    ],
    summary:
      "A site vulnerable to one foot of sea level rise, per a listed state, federal, university, or local assessment, is temporarily exempt. This is not the Municipal Code's Sea Level Rise Area. It cannot block while the Sec. 4 reading is unresolved.",
    question_if_unknown:
      "Does an assessment named in Ordinance 188968 Sec. 2.G record this parcel as vulnerable to one foot of sea level rise?",
    question_if_conflict:
      "Assessments disagree on whether this parcel is vulnerable to one foot of sea level rise. Which assessment governs for Ordinance 188968 Sec. 2.G?",
  }),
  temporaryExemptionCriterion({
    id: "la_sb79.temporary-exemption-historic-resource",
    label: "SB 79 temporary exemption criterion H: historic resource designated by January 1, 2025",
    fact_keys: ["hcm-or-hpoz-designated-by-2025-01-01"],
    pinpoint: "Ordinance 188968, Sec. 2.H, page 5, with the recital on page 3",
    excerpts: [
      "H. A site with a historic resource designated as of January 1,2025, on a local register (Gov. Code Sec. 65912.161(b)(1)(F)).",
      "WHEREAS, for the purpose of phasing the implementation, sites with a historic resource designated as of January 1,2025 on a local register shall include Historic Cultural Monuments (HCM) and Historic Preservation Overlay Zones (HPOZ), consistent with Government Code Section 65912.161(b)(1)(F);",
    ],
    summary:
      "A site with a historic resource designated on a local register as of January 1, 2025 is temporarily exempt; a recital reads that as including HCMs and HPOZs. An undated HPOZ record cannot stand in. It cannot block while the Sec. 4 reading is unresolved.",
    question_if_unknown:
      "Did this parcel have a Historic Cultural Monument or Historic Preservation Overlay Zone designation in effect on or before January 1, 2025?",
    question_if_conflict:
      "Official records disagree on whether this parcel had a Historic Cultural Monument or HPOZ designation by January 1, 2025. Which record governs?",
  }),
];

export const lowRiseCriteria: readonly ProgramCriterion[] = [
  parcelMatchCriterion("la_low_rise"),
  jurisdictionCriterion("la_low_rise"),
  {
    id: "la_low_rise.overlay-review",
    pathway: "la_low_rise",
    label: "Low-Rise overlay and hazard review (historic, coastal, fire, hillside)",
    gating: false,
    fact_keys: [
      "historic-designation",
      "hpoz",
      "coastal-zone",
      "very-high-fire-hazard-severity-zone",
      "hillside-area",
    ],
    predicate: "professional_judgment",
    permitted_outcomes: ["requires_judgment"],
    exception_paths: [],
    rule_summary:
      "Not a mechanical test: the repo source notes say one overlay label cannot be turned into a universal yes or no. Planning confirms which Low-Rise criteria or exceptions apply.",
    citation: cite("lowRiseOrdinance", "Sections 8–9: criteria and exceptions"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "Which historic, coastal, fire-hazard, and hillside designations do City records show for this parcel?",
    question_if_conflict:
      "Official sources disagree on at least one overlay or hazard designation for this parcel. Which designation governs for Low-Rise review?",
    question_if_judgment:
      "Which Low-Rise criteria or exceptions apply given the historic, coastal, fire-hazard, and hillside designations recorded for this parcel?",
    verification: "repo_sourced",
    human_verification: null,
    basis: {
      repo_path: repoSourceNotes.sb79LowRiseGuide,
      excerpts: [
        "Flag historic designations, coastal or fire/hillside information, and site-specific restrictions for review.",
        "Low-Rise has its own criteria and exceptions; one overlay label cannot safely be turned into a universal yes or no.",
      ],
    },
  },
  /* ----------------------------------------- map, subareas, and zones */
  pendingAtomicCriterion({
    id: "la_low_rise.incentive-area-map-subarea",
    pathway: "la_low_rise",
    label: "Low-Rise Incentive Area map: LR-1 or LR-2 subarea",
    fact_keys: ["low-rise-incentive-area-map-subarea"],
    source: "lowRiseOrdinance",
    pinpoint:
      "Ordinance 188967, Sec. 5 (Low-Rise Incentive Area Project), page 4; Sec. 11, LAMC 12.22 A.38(j)(7)(i), page 18",
    excerpts: [
      "Low-Rise Incentive Area Project. A project on a site located, in whole or in part, within a Low-Rise Incentive Area as set forth in the eligibility map pursuant to Section 12.22.A.38(i)(7) of this this Code, or determined to be eligible pursuant to Section 12.22 A.38(c)(10) of this Code, that involves the construction of, addition to, or remodeling of any building or buildings that result in the creation of five or more residential units.",
      "The Director shall have the authority to issue and update eligibility maps of Transit Oriented Incentive Areas, Opportunity Corridor Incentive Areas, Low Rise Incentive Areas, City’s five-year TCAC Opportunity Areas, and Opportunity Station Areas as specified herein:",
    ],
    summary:
      "A Low-Rise site is one the Director's map places in a Low-Rise Incentive Area, or one the (c)(10) path reaches. A mapped LR-1 or LR-2 subarea is the record; a site not mapped may still take the (c)(10) path, so not mapped can never block.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    exception_paths: [c10Exception],
    question_if_unknown:
      "Which Low-Rise subarea, if any, does the Director's current Low-Rise Incentive Area map show for this site, and what is the map's date?",
    question_if_conflict:
      "Official records disagree on the Low-Rise subarea shown for this site. Which map governs?",
  }),
  professionalAtomicCriterion({
    id: "la_low_rise.subarea-distance-bands",
    pathway: "la_low_rise",
    label: "Low-Rise subarea distance bands from a corridor or TOD stop",
    fact_keys: [],
    source: "lowRiseOrdinance",
    pinpoint:
      "Ordinance 188967, Sec. 9, Table 12.22 A.38.(g)(1)(i) and LAMC 12.22 A.38(g)(1)(ii), pages 7-8",
    excerpts: [
      "Eligibility Subarea Based on Distance LR-1 LR-2 Opportunity Corridor < 250 feet RD and R2",
      "Tier 2 TOD Stop Tier 1 TOD Stop <1/4 mile < 1/2 mile 250 - 750 feet 1/4 mile -1/2 mile",
      "(ii) Property Line Measurement. Measurements from an Opportunity Corridor to determine an eligibility subarea should be based on the distance from the Rear Lot Line of the lot located",
    ],
    summary:
      "The table sets LR-1 and LR-2 bands by distance from an Opportunity Corridor (measured from the rear lot line) or from a Tier 1 or Tier 2 TOD stop. The table's text layer is scattered and SCAG's TOD stops are not final, so the distances are a mapping determination.",
    question_if_unknown:
      "How far is this site from the nearest Opportunity Corridor, measured from the rear lot line, and from the nearest Tier 1 or Tier 2 TOD stop?",
    question_if_conflict:
      "Records disagree on this site's distance from an Opportunity Corridor or TOD stop. Which record governs?",
    question_if_judgment:
      "Which Low-Rise distance band (LR-1 or LR-2) applies to this site, measured as Table 12.22 A.38.(g)(1)(i) and LAMC 12.22 A.38(g)(1)(ii) describe?",
  }),
  professionalAtomicCriterion({
    id: "la_low_rise.subarea-geographic-criteria",
    pathway: "la_low_rise",
    label: "Low-Rise subarea location tests: Higher Opportunity Areas and Opportunity Station Areas",
    fact_keys: [],
    source: "lowRiseOrdinance",
    pinpoint: "Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7; Sec. 5 (Opportunity Station Area), page 4",
    excerpts: [
      "Geographic Criteria Higher Opportunity Areas Tier 2 TOD Stop Tier 1 TOD Stop",
      "Eligible Underlying Project Zones Opportunity Station Areas",
      "Opportunity Station Area. A one-half mile radius surrounding a Tier 1 transit-oriented development stop (Tier 1 TOD Stop) or Tier 2 transit-oriented development stop (Tier 2 TOD Stop), as defined in Government Code Section 65912.156, with a land area that is more than 50 percent designated as a Moderate Opportunity Area or Higher Opportunity Area, alone or combined, pursuant to the City’s five-year California Tax Credit Allocation Committee (TCAC) Opportunity Areas map, as may be amended.",
    ],
    summary:
      "The table ties corridor subareas to Higher Opportunity Areas and TOD-stop subareas to Opportunity Station Areas, which Sec. 5 defines by a TCAC land-area share within one-half mile. Those are map computations no parcel fact records.",
    question_if_unknown:
      "What does the City's five-year TCAC Opportunity Areas map show for this site, and is it within an Opportunity Station Area?",
    question_if_conflict:
      "Records disagree on this site's TCAC opportunity area or Opportunity Station Area status. Which record governs?",
    question_if_judgment:
      "Is this site within a Higher Opportunity Area (corridor subareas) or an Opportunity Station Area (TOD-stop subareas), as Table 12.22 A.38.(g)(1)(i) requires for its row?",
  }),
  pendingAtomicCriterion({
    id: "la_low_rise.underlying-zone",
    pathway: "la_low_rise",
    label: "Low-Rise underlying zone for the subarea's table row",
    fact_keys: ["low-rise-transportation-row", "low-rise-zone-class"],
    source: "lowRiseOrdinance",
    pinpoint: "Ordinance 188967, Table 12.22 A.38.(g)(1)(i), page 7; Sec. 13, LAMC 12.22 A.38(j)(16), page 19",
    excerpts: [
      "Opportunity Corridor < 250 feet RD and R2",
      "Residential Zones must permit primarily residential uses as a main use by right and shall include but not be limited to R5 and more restrictive R and A zones, as well as R1P, R2P, R3P, R4P, and R5P zones.",
    ],
    summary:
      "Corridor rows take RD and R2 zones; TOD-stop rows take Residential Zones, which (j)(16) defines without an exhaustive list. A zone outside a row's list cannot block, because (g)(1)(iii)b reaches some SB 79 sites regardless of zoning.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    exception_paths: [
      {
        label: "(g)(1)(iii)b base incentives regardless of underlying zoning for an SB 79 site not exempt under the Phased Implementation Ordinance",
        pinpoint: "Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1)(iii)b, page 8",
        fact_keys: [],
      },
    ],
    question_if_unknown:
      "Which table row places this site in its Low-Rise subarea, and which zone group does its underlying zone fall in: RD or R2, another Residential Zone listed in LAMC 12.22 A.38(j)(16), or neither?",
    question_if_conflict:
      "Official records disagree on this site's Low-Rise table row or underlying zone group. Which record governs?",
  }),

  /* ------------------------------------------------ site exclusions */
  lowRiseExclusion({
    id: "la_low_rise.manufacturing-zone-exclusion",
    label: "Low-Rise site exclusion (c)(4): manufacturing and CM zone lots",
    fact_keys: ["low-rise-manufacturing-zone-lot"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(4), pages 5-6",
    excerpts: [
      "(4) The project site does not include any lots located in a manufacturing zone that does not allow multiple family residential uses (M1, M2,-M3, MR1, or MR2 Zone); or the CM zones where",
      "residential uses are not permitted by right by any applicable planning overlay, “Q” condition, or “D” limitation.",
    ],
    summary:
      "Sites with a lot in an M1, M2, M3, MR1, or MR2 zone, or in a CM zone where an overlay, Q condition, or D limitation restricts residential use, are excluded unless the (c)(10) path applies. A CM lot needs that overlay record. This cannot block by itself.",
    exceptions: [c10Exception],
    question_if_unknown:
      "Does the site include any lot in an M1, M2, M3, MR1, MR2, or CM zone, and for a CM lot, does a planning overlay, Q condition, or D limitation restrict residential use?",
    question_if_conflict:
      "Official records disagree on whether the site includes a manufacturing or CM zone lot. Which record governs?",
  }),
  lowRiseExclusion({
    id: "la_low_rise.single-family-zone-exclusion",
    label: "Low-Rise site exclusion (c)(5): single-family or more restrictive zone lots",
    fact_keys: ["low-rise-single-family-zone-lot"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(5), page 6",
    excerpts: [
      "(5) The project site does not include any lots located in a single family or more restrictive zone (RW1 and more restrictive), unless the project is a Low-Rise Incentive Area Project located within an Opportunity Station Area.",
    ],
    summary:
      "Sites with a lot in RW1 or a more restrictive zone are excluded unless the project is within an Opportunity Station Area, and the (c)(10) path also applies. The zone order is in the LAMC, not captured. Neither exception is modeled, so this cannot block.",
    exceptions: [
      {
        label: "(c)(5) exception for a Low-Rise project within an Opportunity Station Area",
        pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(5), page 6",
        fact_keys: [],
      },
      c10Exception,
    ],
    question_if_unknown: "Does the site include any lot in RW1 or a more restrictive zone?",
    question_if_conflict:
      "Official records disagree on whether the site includes a lot in RW1 or a more restrictive zone. Which record governs?",
  }),
  lowRiseExclusion({
    id: "la_low_rise.fire-restriction-area-exclusion",
    label: "Low-Rise site exclusion (c)(6): Fire Restriction Area",
    fact_keys: ["very-high-fire-hazard-severity-zone", "hillside-area"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6; Sec. 5 (Fire Restriction Area), page 4",
    excerpts: [
      ord188967C6,
      "Fire Restriction Area. An area of land, in whole or part, that is located in both a Very High Fire Hazard Severity Zone and a Hillside Area, as these terms are defined in Section 12.03 of this Code.",
    ],
    summary:
      "A Fire Restriction Area is land in both a Very High Fire Hazard Severity Zone and a Hillside Area. Such sites are excluded unless neighboring properties are outside one, and the (c)(10) path also applies. Two parcel-level records cannot show the zones overlap the same land.",
    exceptions: [neighboringPropertiesException, c10Exception],
    question_if_unknown:
      "Is the site in both a Very High Fire Hazard Severity Zone and a Hillside Area, as the Municipal Code defines them, on the same land?",
    question_if_conflict:
      "Official sources disagree on the site's fire-hazard or hillside designation. Which source governs for the Low-Rise Fire Restriction Area exclusion?",
  }),
  lowRiseExclusion({
    id: "la_low_rise.coastal-zone-exclusion",
    label: "Low-Rise site exclusion (c)(6): Coastal Zone",
    fact_keys: ["coastal-zone"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6",
    excerpts: [ord188967C6],
    summary:
      "Sites with a lot in the Coastal Zone are excluded unless neighboring properties are outside it, and the (c)(10) path also applies. Neither exception is modeled, so this cannot block.",
    exceptions: [neighboringPropertiesException, c10Exception],
    question_if_unknown: "Does the site include any lot in the Coastal Zone?",
    question_if_conflict:
      "Official records disagree on whether the site is in the Coastal Zone. Which record governs for the Low-Rise Coastal Zone exclusion?",
  }),
  lowRiseExclusion({
    id: "la_low_rise.sea-level-rise-area-exclusion",
    label: "Low-Rise site exclusion (c)(6): Sea Level Rise Area",
    fact_keys: ["sea-level-rise-area"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(6), page 6",
    excerpts: [ord188967C6],
    summary:
      "Sites with a lot in a Sea Level Rise Area are excluded unless the (c)(10) path applies; the neighboring-property exception does not reach this area. The term is defined in the Municipal Code, not in the captured text.",
    exceptions: [c10Exception],
    question_if_unknown: "Does the site include any lot in a Sea Level Rise Area as the Municipal Code defines it?",
    question_if_conflict:
      "Official records disagree on whether the site is in a Sea Level Rise Area. Which record governs?",
  }),
  lowRiseExclusion({
    id: "la_low_rise.excluded-plan-area",
    label: "Low-Rise site exclusion (c)(9): listed community plan and specific plan areas",
    fact_keys: ["low-rise-excluded-plan-area"],
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(9), pages 6-7",
    excerpts: [
      "(9) A project shall not be located in the Boyle Heights Community Plan, the Harbor Gateway Community Plan, the",
      "Wilmington-Harbor City Community Plan, and/or the Cornfield Arroyo Seco Specific Plan.",
    ],
    summary:
      "Projects in the Boyle Heights, Harbor Gateway, or Wilmington-Harbor City Community Plan areas, or the Cornfield Arroyo Seco Specific Plan, are excluded unless the (c)(10) path applies. No other plan area is listed.",
    exceptions: [c10Exception],
    question_if_unknown:
      "Is the site in the Boyle Heights, Harbor Gateway, or Wilmington-Harbor City Community Plan area, or in the Cornfield Arroyo Seco Specific Plan?",
    question_if_conflict:
      "Official records disagree on the site's community plan or specific plan area. Which record governs?",
  }),

  /* ------------------------------------- exception path and historic limit */
  professionalAtomicCriterion({
    id: "la_low_rise.c10-exception-path",
    pathway: "la_low_rise",
    label: "Low-Rise (c)(10) path for SB 79 sites not exempt under the Phased Implementation Ordinance",
    fact_keys: [],
    source: "lowRiseOrdinance",
    pinpoint: "Ordinance 188967, Sec. 8, LAMC 12.22 A.38(c)(10), page 7; LAMC 12.22 A.38(g)(1)(iii)b, page 8",
    excerpts: [
      "(10) Exceptions. Notwithstanding the eligibility criteria listed in Subparagraphs (4), (5), (6) and (9) of this paragraph, a site that meets the eligibility requirements of Government Code Section 65912.157, and either does not meet any of the site or station level criteria specified in Government Code Section 65912.161(b), or is not exempt from Government Code Sections 65912.155 through 65912.162 pursuant to the Phased Implementation Ordinance",
      "Rise Incentive Area Program if the project sets aside the amount of required restricted affordable units consistent with Government Code Section 65912.157(i) and Table 22.22.A.38.(c)(3)(v), whichever is greater.",
      "is a project that is eligible for the base incentives in Table 12.22 A.38.(g)(3)(i) regardless of the site's underlying zoning or Opportunity Station Area status.",
    ],
    summary:
      "Notwithstanding exclusions (4), (5), (6), and (9), a site meeting GCS 65912.157 that meets no GCS 65912.161(b) criterion or is not exempt under the Phased Implementation Ordinance may proceed with the required affordable set-aside. The ordinance number is blank, and who is not exempt turns on Ordinance 188968 Sec. 4.",
    question_if_unknown:
      "Does this site meet GCS 65912.157, and is it outside the temporary exemption under Ordinance 188968?",
    question_if_conflict:
      "Records disagree on whether this site meets GCS 65912.157 or is exempt under Ordinance 188968. Which record governs?",
    question_if_judgment:
      "Does this site meet GCS 65912.157 and either meet no GCS 65912.161(b) criterion or fall outside the temporary exemption under Ordinance 188968, so that Ordinance 188967 (c)(10) applies?",
  }),
  professionalAtomicCriterion({
    id: "la_low_rise.tod-subarea-historic-limit",
    pathway: "la_low_rise",
    label: "Low-Rise historic limit in TOD-stop subareas: HPOZ or Historic Cultural Monument",
    fact_keys: ["hpoz", "historic-cultural-monument"],
    source: "lowRiseOrdinance",
    pinpoint: "Ordinance 188967, Sec. 9, LAMC 12.22 A.38(g)(1)(iii)a, page 8",
    excerpts: [
      "a. A site with a Designated Historic Resource, or Non-Contributor is not eligible for LR-2 Incentives, and is limited to LR-1 Incentives;",
      "furthermore, in Tier 1 or Tier 2 TOD Stop eligibility subareas, a parcel located within a Historic Preservation Overlay Zone, as prescribed in Division 13B.8. of Chapter 1A of this Code, or designated as a Historic Cultural Monument, in accordance with Section 22.171 of Article 1, Chapter 9, Division 22 of the Los Angeles Administrative Code, shall not be eligible for incentives in this paragraph, unless it is also located within an eligibility subarea based on distance from an Opportunity Corridor Transition eligibility subarea based on distance from an Opportunity Corridor.",
    ],
    summary:
      "In Tier 1 or Tier 2 TOD-stop subareas, a parcel in an HPOZ or designated a Historic Cultural Monument is outside these incentives unless it is also in a corridor subarea. The unless-clause repeats itself, apparently a drafting error, so its reach is unclear.",
    question_if_unknown:
      "Is the parcel within a Historic Preservation Overlay Zone, and is it designated a Historic Cultural Monument?",
    question_if_conflict:
      "Official records disagree on the parcel's HPOZ or Historic Cultural Monument status. Which record governs for the Low-Rise historic limit?",
    question_if_judgment:
      "For this HPOZ or Historic Cultural Monument parcel, is it in a Tier 1 or Tier 2 TOD-stop subarea, and does the corridor exception in LAMC 12.22 A.38(g)(1)(iii)a apply?",
  }),
];

export const sb79Pack: ProgramPathwayPack = {
  pathway: sb79Pathway,
  criteria: sb79Criteria,
};

export const lowRisePack: ProgramPathwayPack = {
  pathway: lowRisePathway,
  criteria: lowRiseCriteria,
};
