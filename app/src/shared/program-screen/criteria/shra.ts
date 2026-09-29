import type {
  ProgramCriterion,
  ProgramCriterionException,
  ProgramCriterionHumanVerification,
  ProgramPathwayPack,
} from "../types";
import {
  booleanFact,
  cite,
  jurisdictionCriterion,
  parcelMatchCriterion,
  pendingAtomicCriterion,
  professionalAtomicCriterion,
  repoSourceNotes,
  textFact,
} from "./common";

/**
 * SHRA (as amended by SB 684 / SB 1123), City of Los Angeles implementation.
 *
 * Repo-sourced (unchanged): which memo scope applies (Chapter 1 vs 1A) and
 * that "vacant" is a legal-definition judgment.
 *
 * Atomic criteria (pending human verification): the five broad SHRA criteria
 * were split on the captured October 28, 2025 memo
 * (official-sources/shra-2025-10-28). Each quotes one proposition, reads one
 * controlled fact or a tightly coupled set, and never runs until a named
 * human reviewer verifies it. `permitted_outcomes` records which direction a
 * verified rule could ever take: a restricted (conditional) site category, a
 * protected-housing category, and a Housing Element listing can never block
 * by themselves. The memo's hillside and landslide terms set no site limit,
 * so neither is an SHRA input.
 */
const memoLotSize =
  'To qualify, multifamily-zoned lots must be less than 5 acres, and single-family zoned lots must be under 1.5 acres and "vacant." (See FAQ Section, Q.1.)';
const memoSingleFamilyZones =
  "Zoned for single-family residential development means sites in the following zones: A1, A2, RA, RE, RS, R1, RU, RZ, and RW1.";
const memoDemolitionIntro =
  "Specifically, a project may not be approved if it would require the demolition or alteration of any of the following types of housing:";
const memoProhibitedIntro = "First, SHRA projects may not be located on the following site categories:";
const memoRestrictedIntro =
  "The following site categories may only utilize SHRA streamlining if applicable conditions or standards have been met:";
const memoRestrictedConditions =
  "Please see GCS 66499.41(a)(9) for more information about these site limitations as well as any specific conditions or standards needed to verify eligibility.";
const memoFireCategory =
  "3) High or very high fire hazard severity zones, as referenced in GCS 51178 and Public Resources Code Section 42021.";
const memoFireFootnote = "1 Please note this includes both state and local responsibility areas.";

/** A restricted site category: presence is a condition to check, never a blocker by itself. */
const restrictedCategoryConditions: ProgramCriterionException = {
  label: "Conditions or standards in GCS 66499.41(a)(9) met (statute not captured)",
  pinpoint: "Memo Part I, Environmental Criteria, pages 4-5",
  fact_keys: [],
};

/** The four SHRA site-category criteria that read a single yes/no map designation. */
function shraSiteCategory(input: {
  id: string;
  label: string;
  fact: ProgramCriterion["fact_keys"][number];
  pinpoint: string;
  excerpts: readonly string[];
  summary: string;
  permitted: ProgramCriterion["permitted_outcomes"];
  exception?: ProgramCriterionException;
  designation: string;
}): ProgramCriterion {
  return pendingAtomicCriterion({
    id: input.id,
    pathway: "la_shra",
    label: input.label,
    fact_keys: [input.fact],
    source: "shraMemo",
    pinpoint: input.pinpoint,
    excerpts: input.excerpts,
    summary: input.summary,
    permitted_outcomes: input.permitted,
    exception_paths: input.exception === undefined ? [] : [input.exception],
    question_if_unknown: `Is the parcel mapped in ${input.designation}, and on which official map or record?`,
    question_if_conflict: `Official sources disagree on whether the parcel is in ${input.designation}. Which source governs for SHRA review?`,
  });
}

/**
 * d, `la_shra.high-fire-hazard-severity-zone`, human-verified in Phase 3E
 * (docs/PROGRAM_SCREEN_PHASE_3E_D_PROMOTION_REVIEW.md): the encoded Phase 3B d
 * rule. It reads only the High fact. Every source, whole-lot coverage, and
 * legal-lot condition is enforced before it runs, by the authority gate, which
 * computes the lot overlay itself from a reviewed lot geometry and the pinned
 * PRC §4202 dataset. No production path supplies reviewed overlay inputs yet,
 * so a real parcel's High fact is never established and d stays unknown for it.
 */
const highFirePinpoint = "Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1";
/** Dated on the verification day: the shared memo citation (2026-09-17) predates the memo capture (2026-09-27). */
const highFireCitation = { ...cite("shraMemo", highFirePinpoint), verified_at: "2026-09-29", next_review_at: "2026-10-29" };
const highFireVerification: ProgramCriterionHumanVerification = {
  reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
  verified_at: "2026-09-29",
  next_review_at: "2026-10-29",
  source_title: "Los Angeles City Planning — SHRA implementation memo (October 28, 2025; SB 684, SB 1123, AB 130)",
  source_url: "https://planning.lacity.gov/odocument/1b081b86-f735-43e8-bba6-c2d73a192db7/SB_684_1123_Memo_Update_ACP.pdf",
  instrument: "City of Los Angeles SHRA implementation memo, October 28, 2025",
  pinpoint: highFirePinpoint,
  supporting_excerpt: memoFireCategory,
  source_capture: {
    repo_path: "app/fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt",
    retrieved_at: "2026-09-27T16:19:20Z",
    capture_method: "pdf_text_extraction",
    sha256: "f44574084091c51419d0475d4b8501d9a2c3577b3a16830fc6ecb2a88b20f6e2",
    is_ai_generated: false,
    source_type: "official_memo",
    operative_status: "operative",
  },
  decision_ref: { phase: "3B", letter: "d" },
};

export const shraPathway = {
  id: "la_shra",
  label: "SHRA (SB 684 / SB 1123) — City of Los Angeles",
  confirmer: "Los Angeles City Planning",
} as const satisfies ProgramPathwayPack["pathway"];

export const shraCriteria: readonly ProgramCriterion[] = [
  parcelMatchCriterion("la_shra"),
  jurisdictionCriterion("la_shra"),
  {
    id: "la_shra.implementation-memo-scope",
    pathway: "la_shra",
    label: "City SHRA implementation memo covers the parcel's Zoning Code chapter",
    gating: false,
    fact_keys: ["zoning-code-chapter"],
    predicate: (facts) =>
      textFact(facts, "zoning-code-chapter") === "Chapter 1"
        ? "consistent_with_source"
        : "requires_judgment",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    exception_paths: [],
    rule_summary:
      "Consistent for a Chapter 1 parcel, which the memo expressly covers; a Chapter 1A parcel needs Planning to confirm the applicable guidance.",
    citation: cite("shraMemo", "Scope: Chapter 1"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Does Zoning Code Chapter 1 or Chapter 1A apply to the matched parcel?",
    question_if_conflict:
      "Official records disagree on whether Chapter 1 or Chapter 1A applies to the parcel. Which applies?",
    question_if_judgment:
      "The City's October 28, 2025 SHRA implementation memo expressly covers Chapter 1. Which SHRA implementation guidance applies to this Chapter 1A parcel?",
    verification: "repo_sourced",
    human_verification: null,
    basis: {
      repo_path: repoSourceNotes.housingProgramsGuide,
      excerpts: [
        "The memo expressly covers Chapter 1; confirm the applicable guidance for a Chapter 1A site.",
      ],
    },
  },
  {
    id: "la_shra.vacant-site-definition",
    pathway: "la_shra",
    label: "Vacant-site definition (SHRA as amended by SB 1123)",
    gating: false,
    fact_keys: ["existing-structures", "occupancy-history"],
    predicate: "professional_judgment",
    permitted_outcomes: ["requires_judgment"],
    exception_paths: [],
    rule_summary:
      "Not a mechanical test: “vacant” is a legal definition, and an unoccupied site is not necessarily vacant. Planning confirms it.",
    citation: cite("shraMemo", "FAQ 1 (vacancy)"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "What existing structures and residential occupancy history do City records show for this parcel, for the SHRA vacant-site definition?",
    question_if_conflict:
      "Official records disagree about existing structures or occupancy on this parcel. Which record governs for the SHRA vacant-site definition?",
    question_if_judgment:
      "Given the recorded structures and occupancy history, does this parcel meet the SHRA definition of a vacant site (implementation memo, FAQ 1)?",
    verification: "repo_sourced",
    human_verification: null,
    basis: {
      repo_path: repoSourceNotes.housingProgramsGuide,
      excerpts: [
        "SB 1123’s amendments took effect July 1, 2025 and expanded eligibility to qualifying vacant single-family-zoned sites.",
        "“Vacant” is defined by the law; merely unoccupied is insufficient.",
      ],
    },
  },
  /* ---------------------------------------- lot area and zone category */
  pendingAtomicCriterion({
    id: "la_shra.zone-category",
    pathway: "la_shra",
    label: "SHRA zone category: the memo's single-family zone list",
    fact_keys: ["shra-zone-category"],
    source: "shraMemo",
    pinpoint:
      "Memo FAQ Q.1, page 12 (zones for single-family residential development); Part I, page 2 (lot-size paragraph)",
    excerpts: [memoSingleFamilyZones, memoLotSize],
    summary:
      "The memo lists the single-family zones (A1, A2, RA, RE, RS, R1, RU, RZ, RW1) and names multifamily-zoned lots without listing their zones. A zone off the list is not thereby multifamily-zoned; that classification stays unresolved, and the category alone can never block.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Which base zone applies to the parcel, and is it one of the zones the City's SHRA memo lists as zoned for single-family residential development (FAQ Q.1)?",
    question_if_conflict:
      "Official records disagree on whether the parcel's base zone is on the SHRA memo's single-family zone list. Which record governs?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.multifamily-lot-area-threshold",
    pathway: "la_shra",
    label: "SHRA multifamily-zoned lot area: less than 5 acres",
    fact_keys: ["shra-zone-category", "lot-area"],
    source: "shraMemo",
    pinpoint: "Memo Part I (property criteria), page 2 (lot-size paragraph)",
    excerpts: [memoLotSize],
    summary:
      "The memo sets a less-than-5-acre limit (217,800 sq ft) for multifamily-zoned lots. No captured source lists the multifamily zones, so no lot can yet be placed on this path, and this limit cannot block until one can.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "What lot area do City records show for the parcel before any subdivision, and is its base zone on the SHRA memo's single-family zone list?",
    question_if_conflict:
      "Official records disagree on the parcel's lot area or SHRA zone category. Which record governs for the SHRA multifamily lot-area limit?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.single-family-lot-area-threshold",
    pathway: "la_shra",
    label: "SHRA single-family-zoned lot area: under 1.5 acres",
    fact_keys: ["shra-zone-category", "lot-area"],
    source: "shraMemo",
    pinpoint: "Memo Part I (property criteria), page 2 (lot-size paragraph)",
    excerpts: [memoLotSize],
    summary:
      "The memo sets an under-1.5-acre limit (65,340 sq ft) for lots zoned for single-family residential development. This criterion covers the area limit only; the same sentence's vacancy condition is a separate criterion.",
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    question_if_unknown:
      "What lot area do City records show for the parcel before any subdivision, and is its base zone on the SHRA memo's single-family zone list?",
    question_if_conflict:
      "Official records disagree on the parcel's lot area or SHRA zone category. Which record governs for the SHRA single-family lot-area limit?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.single-family-vacancy-condition",
    pathway: "la_shra",
    label: "SHRA single-family-zoned lot must also be vacant",
    fact_keys: ["shra-zone-category"],
    source: "shraMemo",
    pinpoint: "Memo Part I, page 2 (lot-size paragraph); FAQ Q.1, page 12 (definition of vacant)",
    excerpts: [
      memoLotSize,
      "The SHRA defines “vacant” as a site that has no permanent structure at the time of application, unless the existing structure is abandoned and uninhabitable.",
    ],
    summary:
      "The memo attaches a vacancy condition to single-family-zoned lots only. Vacant is a legal definition (no permanent structure at application unless abandoned and uninhabitable), so a listed zone routes to the vacant-site judgment; a structure count never decides it.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Is the parcel's base zone on the SHRA memo's single-family zone list, which carries the vacancy condition?",
    question_if_conflict:
      "Official records disagree on the parcel's SHRA zone category. Which record governs for the SHRA vacancy condition?",
  }),

  /* -------------------------------- demolition protections and occupancy */
  pendingAtomicCriterion({
    id: "la_shra.ellis-act-withdrawal",
    pathway: "la_shra",
    label: "SHRA Ellis Act withdrawal within 15 years of the application",
    fact_keys: ["ellis-act-withdrawal-recorded"],
    source: "shraMemo",
    pinpoint: "Memo Part I, Demolition Protections, page 4",
    excerpts: [
      "In addition, the development may not be located on parcels where an Ellis Act withdrawal of units has occurred within 15 years of the application (see the ZIMAS eligibility checklist noted above).",
    ],
    summary:
      "The memo bars parcels with an Ellis Act withdrawal of units within 15 years of the application. The look-back runs from an application date the screen does not hold, and no withdrawal date is modeled, so a recorded withdrawal can only route to judgment.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Does a Los Angeles Housing Department record show any Ellis Act withdrawal of units on this parcel, and on what date?",
    question_if_conflict:
      "Official records disagree on whether an Ellis Act withdrawal of units is recorded for this parcel. Which record governs?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.protected-housing-affordability-covenant",
    pathway: "la_shra",
    label: "SHRA protected housing: rent-restricted affordable housing on the parcel",
    fact_keys: ["affordability-restricted-housing"],
    source: "shraMemo",
    pinpoint: "Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 1)",
    excerpts: [
      memoDemolitionIntro,
      "1) Housing that is subject to a recorded covenant, ordinance, or law that restricts rents to levels affordable to persons and families of low, very low, or extremely low income;",
    ],
    summary:
      "Covenant- or law-restricted lower-income housing is one category the demolition protection covers. This criterion records only whether such housing exists; whether a project would demolish or alter it is a separate judgment. Presence is never a blocker by itself.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Is any housing on this parcel subject to a recorded covenant, ordinance, or law restricting rents to lower-income levels?",
    question_if_conflict:
      "Official records disagree on whether rent-restricted affordable housing exists on this parcel. Which record governs?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.protected-housing-price-control",
    pathway: "la_shra",
    label: "SHRA protected housing: rent- or price-controlled housing on the parcel",
    fact_keys: ["price-controlled-housing"],
    source: "shraMemo",
    pinpoint: "Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 2)",
    excerpts: [
      memoDemolitionIntro,
      "2) Housing subject to any form of rent or sales price control imposed by a local public entity’s valid exercise of its police power (e.g., the Rent Stabilization Ordinance (RSO)); or",
    ],
    summary:
      "Housing under any local rent or sales-price control, such as the RSO, is one category the demolition protection covers. This criterion records only whether such housing exists; whether a project would demolish or alter it is a separate judgment. Presence is never a blocker by itself.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Is any housing on this parcel subject to rent or sales-price control by a local public entity, such as the Rent Stabilization Ordinance?",
    question_if_conflict:
      "Official records disagree on whether rent- or price-controlled housing exists on this parcel. Which record governs?",
  }),
  professionalAtomicCriterion({
    id: "la_shra.protected-housing-tenant-occupancy",
    pathway: "la_shra",
    label: "SHRA protected housing: tenant occupancy in the five years before the application",
    fact_keys: ["occupancy-history"],
    source: "shraMemo",
    pinpoint: "Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8), category 3)",
    excerpts: [
      memoDemolitionIntro,
      "3) Housing that has been occupied by a tenant within the five years prior to the application date, including, including housing that has been demolished or that tenants have vacated.",
    ],
    summary:
      "Housing occupied by a tenant within five years before the application, including housing since demolished or vacated, is protected. The look-back runs from an application date the screen does not hold, and the occupancy record is free text.",
    question_if_unknown:
      "What residential occupancy history do City records show for this parcel, including any tenant occupancy and any housing demolished or vacated?",
    question_if_conflict:
      "Official records disagree about residential occupancy on this parcel. Which record governs for the SHRA tenant-occupancy protection?",
    question_if_judgment:
      "Given the recorded occupancy history, was any housing on this parcel occupied by a tenant within the five years before the SHRA application date, including housing since demolished or vacated?",
  }),
  professionalAtomicCriterion({
    id: "la_shra.protected-housing-demolition-or-alteration",
    pathway: "la_shra",
    label: "SHRA demolition or alteration of protected housing by the project",
    fact_keys: [],
    source: "shraMemo",
    pinpoint: "Memo Part I, Demolition Protections, page 3 (GCS 66499.41(a)(8)); FAQ Q.14, page 17",
    excerpts: [
      memoDemolitionIntro,
      "A demolition is the tearing down, razing or removal of a building or structure that requires a demolition permit.",
      "Physical alterations include any construction or renovation to an existing structure other than a repair or addition.",
    ],
    summary:
      "The protection applies only if the project would demolish or alter protected housing, as FAQ Q.14 defines those terms. That turns on the project's scope, which no parcel fact records; existing structures never decide it.",
    question_if_unknown: "What would the proposed project demolish or alter on this parcel?",
    question_if_conflict:
      "Records disagree about what the proposed project would demolish or alter on this parcel. Which record governs?",
    question_if_judgment:
      "Would the proposed project demolish or alter any housing in the categories the SHRA protects: rent-restricted, rent- or price-controlled, or tenant-occupied within the five years before the application?",
  }),

  /* ------------------------------------------------------- prior map */
  pendingAtomicCriterion({
    id: "la_shra.prior-shra-or-sb9-map",
    pathway: "la_shra",
    label: "SHRA prior map: lot previously recorded under the SHRA or SB 9 (2021)",
    fact_keys: ["prior-shra-or-sb9-map"],
    source: "shraMemo",
    pinpoint: "Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots)",
    excerpts: [
      "Lots previously recorded pursuant to the SHRA or SB 9 (2021) are ineligible. However, this particular eligibility restriction does not apply if the tentative map has not been recorded.",
    ],
    summary:
      "The memo restricts lots previously recorded under the SHRA or SB 9 (2021), unless the tentative map was never recorded. Maps recorded under another statute are not restricted, an incomplete map history stays unknown, and the memo sets no adjacency limit (FAQ Q.26).",
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [
      {
        label: "Restriction does not apply if the tentative map has not been recorded",
        pinpoint: "Memo Part I (property criteria), page 2 (prior SHRA or SB 9 lots)",
        fact_keys: ["prior-shra-or-sb9-map"],
      },
    ],
    question_if_unknown:
      "Which maps were recorded for this lot, and was any of them recorded under the SHRA or SB 9 (2021)? Is the recorded map history complete?",
    question_if_conflict:
      "Official records disagree on the lot's prior map history. Which recorded map governs for the SHRA prior-map restriction?",
  }),

  /* --------------------------------------------- Housing Element sites */
  pendingAtomicCriterion({
    id: "la_shra.housing-element-projected-units",
    pathway: "la_shra",
    label: "SHRA Housing Element site: projected-unit minimum",
    fact_keys: ["housing-element-site-listing"],
    source: "shraMemo",
    pinpoint:
      "Memo Part I, Minimum Density and Affordability Requirements for Housing Element Sites, pages 2-3; FAQ Q.9, page 15",
    excerpts: [
      "Pursuant to GCS 66499.41(a)(5), all SHRA development projects proposed on sites identified in the City’s 2021-2029 Housing Element must result in at least the number of units projected for that parcel.",
      "(i) Appendix 4.1 - Inventory of Adequate Sites, (ii) Appendix 4.2 - Public Development Pipeline Projects, and (iii) Appendix 4.3 - Private Development Pipeline Projects.",
      "In particular, this SHRA requirement does not apply to the rezoning sites list adopted by the City Council in February 2025 (Council File 21-1230-S6).",
      "If a housing element site is projected to host more than the number of proposed units (including ADU/JADUs), that parcel is ineligible for SHRA streamlining.",
    ],
    summary:
      "Projects on Appendix 4.1-4.3 sites must reach the units projected for the parcel. That compares the projection with the project's proposed units, which the screen does not hold, so a listing is a condition and never a blocker by itself. The February 2025 rezoning list does not count.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Is the parcel listed in Appendix 4.1, 4.2, or 4.3 of the City's 2021-2029 Housing Element, and how many units are projected for it?",
    question_if_conflict:
      "Official records disagree on the parcel's 2021-2029 Housing Element listing. Which record governs for the SHRA projected-unit minimum?",
  }),
  pendingAtomicCriterion({
    id: "la_shra.housing-element-lower-income-units",
    pathway: "la_shra",
    label: "SHRA Housing Element site: lower-income unit minimum",
    fact_keys: ["housing-element-site-listing"],
    source: "shraMemo",
    pinpoint: "Memo Part I, page 3; FAQ Q.9, page 16",
    excerpts: [
      "If a parcel in Appendices 4.1 - 4.3 is identified to accommodate any portion of the City’s Regional Housing Needs Allocation (RHNA) for lower income households, the project must include at least the number of lower income units projected for that site.",
      "Additionally, if a parcel in Appendices 4.1, 4.2, or 4.3 was identified to accommodate any portion of the City’s RHNA for lower income households, the development must result in at least as many lower income units assigned to the parcel.",
    ],
    summary:
      "Where an Appendix 4.1-4.3 parcel is assigned lower-income RHNA units, the project must include at least that many lower-income units. That is a project condition the screen cannot evaluate, so a listing is never a blocker by itself.",
    permitted_outcomes: ["consistent_with_source", "requires_judgment"],
    question_if_unknown:
      "Is the parcel listed in Appendix 4.1, 4.2, or 4.3 of the 2021-2029 Housing Element, and does the listing assign lower-income units to it?",
    question_if_conflict:
      "Official records disagree on the parcel's 2021-2029 Housing Element listing. Which record governs for the SHRA lower-income unit minimum?",
  }),

  /* ---------------------------- environmental criteria: prohibited sites */
  shraSiteCategory({
    id: "la_shra.prime-or-statewide-farmland",
    label: "SHRA prohibited site category: prime farmland or farmland of statewide importance",
    fact: "prime-or-statewide-farmland",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 1",
    excerpts: ["1) Prime farmland or farmland of statewide importance;", memoProhibitedIntro],
    summary:
      "The memo lists prime farmland and farmland of statewide importance among the site categories an SHRA project may not use. It names no defining map.",
    permitted: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    designation: "prime farmland or farmland of statewide importance",
  }),
  shraSiteCategory({
    id: "la_shra.wetlands",
    label: "SHRA prohibited site category: wetlands",
    fact: "wetlands",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 2",
    excerpts: ["2) Wetlands (see CA Department of Fish and Wildlife);", memoProhibitedIntro],
    summary:
      "The memo lists wetlands among the prohibited site categories and points to the California Department of Fish and Wildlife without naming a defining map. A recorded wetland could block once verified; a record showing none cannot show there is none.",
    permitted: ["disqualifying_per_source", "requires_judgment"],
    designation: "a recorded wetland",
  }),
  {
    ...shraSiteCategory({
      id: "la_shra.very-high-fire-hazard-severity-zone",
      label: "SHRA prohibited site category: Very High Fire Hazard Severity Zone",
      fact: "very-high-fire-hazard-severity-zone",
      pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 3 and footnote 1",
      excerpts: [memoFireCategory, memoFireFootnote, memoProhibitedIntro],
      summary:
        "The memo bars High and Very High Fire Hazard Severity Zones in state and local responsibility areas. This criterion covers Very High only: a record that the parcel is not in a Very High zone says nothing about a High zone, which is its own criterion.",
      permitted: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      designation: "a Very High Fire Hazard Severity Zone",
    }),
    // Phase 3B c: GOV §51178 and PRC §4202 are assessed separately. A YES on
    // either route is enough; a NO needs both (statutory_routes_assessed_separately).
    statutory_routes: { fact_key: "very-high-fire-hazard-severity-zone", routes: ["gov_51178", "prc_4202"] },
  },
  {
    ...shraSiteCategory({
      id: "la_shra.high-fire-hazard-severity-zone",
      label: "SHRA prohibited site category: High Fire Hazard Severity Zone",
      fact: "high-fire-hazard-severity-zone",
      pinpoint: highFirePinpoint,
      excerpts: [memoFireCategory, memoFireFootnote, memoProhibitedIntro],
      summary:
        "The memo bars High and Very High Fire Hazard Severity Zones in state and local responsibility areas. This criterion covers High only and reads its own fact; the Very High record never stands in for it.",
      permitted: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      designation: "a High Fire Hazard Severity Zone",
    }),
    // Phase 3E: human-verified. Outcome ceiling unchanged.
    predicate: (facts) =>
      booleanFact(facts, "high-fire-hazard-severity-zone") ? "disqualifying_per_source" : "consistent_with_source",
    rule_summary:
      "Phase 3B decision d. Disqualifying per source when a reviewed CAL FIRE / State Fire Marshal record under PRC §4202, a deterministic overlay of the reviewed legal-lot geometry on the registered SRA dataset, shows the whole lot proposed to be subdivided in High. Consistent with source when SRA features cover the whole lot, the legend defines High there, and no part of the lot is High. Partial coverage, land outside the SRA, an unclear legal lot, GOV §51178, and any other source stay unknown. Very High is criterion c.",
    question_if_judgment:
      "How does Planning apply the SHRA High Fire Hazard Severity Zone site category (memo page 4, prohibited category 3) to the lot proposed to be subdivided?",
    citation: highFireCitation,
    verification: "human_verified",
    human_verification: highFireVerification,
  },
  shraSiteCategory({
    id: "la_shra.natural-community-conservation-plan-land",
    label: "SHRA prohibited site category: land identified for conservation in a natural community conservation plan",
    fact: "nccp-conservation-land",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 4",
    excerpts: ["4) Land identified for conservation in an adopted natural community conservation plan;", memoProhibitedIntro],
    summary:
      "The memo lists land identified for conservation in an adopted natural community conservation plan among the prohibited site categories. It names no defining plan map.",
    permitted: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    designation: "land identified for conservation in an adopted natural community conservation plan",
  }),
  professionalAtomicCriterion({
    id: "la_shra.protected-species-habitat",
    pathway: "la_shra",
    label: "SHRA prohibited site category: habitat for protected species",
    fact_keys: [],
    source: "shraMemo",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 5; FAQ Q.16, page 17",
    excerpts: [
      "5) Habitat for protected species; or",
      memoProhibitedIntro,
      "Properties located in Hillside Areas or the Coastal Zone have been assessed based on the potential presence of biological resources to assist in pre-screening parcels that may need further analysis to determine if habitat exists.",
    ],
    summary:
      "Habitat for protected species is a prohibited category. The City pre-screens Hillside Area and Coastal Zone parcels for further analysis (FAQ Q.16); whether habitat exists is a biological determination no parcel fact records.",
    question_if_unknown:
      "Has the City's SHRA pre-screen flagged this parcel for further analysis of habitat for protected species?",
    question_if_conflict:
      "Records disagree on whether habitat for protected species exists on this parcel. Which record governs?",
    question_if_judgment:
      "Does habitat for protected species exist on this parcel, based on the City's pre-screen and any further analysis (SHRA memo FAQ Q.16)?",
  }),
  shraSiteCategory({
    id: "la_shra.conservation-easement",
    label: "SHRA prohibited site category: land under a conservation easement",
    fact: "conservation-easement",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, prohibited category 6",
    excerpts: ["6) Lands under a conservation easement.", memoProhibitedIntro],
    summary:
      "The memo lists lands under a conservation easement among the prohibited site categories. A recorded easement is the record; the memo names none.",
    permitted: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    designation: "land under a conservation easement",
  }),

  /* ------------------------- environmental criteria: conditional sites */
  shraSiteCategory({
    id: "la_shra.hazardous-waste-site",
    label: "SHRA conditional site category: hazardous waste site",
    fact: "hazardous-waste-site",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, restricted category 1; page 5",
    excerpts: ["1) Hazardous waste sites (see Los Angeles Fire Department CUPA);", memoRestrictedIntro, memoRestrictedConditions],
    summary:
      "The memo lets hazardous waste sites use SHRA streamlining only if applicable conditions or standards are met (GCS 66499.41(a)(9), not captured). A recorded site is a condition to check, never a blocker by itself.",
    permitted: ["consistent_with_source", "requires_judgment"],
    exception: restrictedCategoryConditions,
    designation: "a recorded hazardous waste site",
  }),
  shraSiteCategory({
    id: "la_shra.special-flood-hazard-area",
    label: "SHRA conditional site category: special flood hazard area",
    fact: "special-flood-hazard-area",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, restricted category 2; page 5",
    excerpts: [
      "2) Special flood hazard areas and regulatory floodways (see LADBS Flood Hazard Management Ordinance Bulletin); and",
      memoRestrictedIntro,
      memoRestrictedConditions,
    ],
    summary:
      "The memo lets special flood hazard areas use SHRA streamlining only if applicable conditions or standards are met. A mapped special flood hazard area is a condition to check, never a blocker by itself. A regulatory floodway is its own criterion.",
    permitted: ["consistent_with_source", "requires_judgment"],
    exception: restrictedCategoryConditions,
    designation: "a special flood hazard area",
  }),
  shraSiteCategory({
    id: "la_shra.regulatory-floodway",
    label: "SHRA conditional site category: regulatory floodway",
    fact: "regulatory-floodway",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, restricted category 2; page 5",
    excerpts: [
      "2) Special flood hazard areas and regulatory floodways (see LADBS Flood Hazard Management Ordinance Bulletin); and",
      memoRestrictedIntro,
      memoRestrictedConditions,
    ],
    summary:
      "The memo lets regulatory floodways use SHRA streamlining only if applicable conditions or standards are met. A mapped floodway is a condition to check, never a blocker by itself.",
    permitted: ["consistent_with_source", "requires_judgment"],
    exception: restrictedCategoryConditions,
    designation: "a regulatory floodway",
  }),
  shraSiteCategory({
    id: "la_shra.earthquake-fault-zone",
    label: "SHRA conditional site category: earthquake fault zone",
    fact: "earthquake-fault-zone",
    pinpoint: "Memo Part I, Environmental Criteria, page 4, restricted category 3; page 5",
    excerpts: [
      "3) Earthquake fault zones (see LADBS Information Bulletins P/BC 2023-129 and P/BC 2023-044).",
      memoRestrictedIntro,
      memoRestrictedConditions,
    ],
    summary:
      "The memo lets earthquake fault zones use SHRA streamlining only if applicable conditions or standards are met. A mapped fault zone is a condition to check, never a blocker by itself.",
    permitted: ["consistent_with_source", "requires_judgment"],
    exception: restrictedCategoryConditions,
    designation: "an earthquake fault zone",
  }),
];

export const shraPack: ProgramPathwayPack = {
  pathway: shraPathway,
  criteria: shraCriteria,
};
