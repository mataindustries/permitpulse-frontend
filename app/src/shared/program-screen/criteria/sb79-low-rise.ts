import type { ProgramCriterion, ProgramPathwayPack } from "../types";
import {
  cite,
  jurisdictionCriterion,
  parcelMatchCriterion,
  repoSourceNotes,
} from "./common";

/**
 * SB 79 and Low-Rise are separate pathways: the repo source notes say they are
 * related but distinct and that an SB 79 result is not a Low-Rise result.
 *
 * Encoded: Low-Rise overlay review is judgment.
 * Not encoded (`pending_human`): what a documented permanent exclusion or
 * temporary exemption means for the SB 79 pathway, which parcel conditions
 * trigger either, SB 79 site standards, and Low-Rise geographic criteria.
 *
 * The repo notes establish only that Ordinance 188968 contains permanent
 * exclusion criteria and a temporary-exemption approach. PermitPulse does not
 * bridge "exclusion or exemption observed / not observed" to a pathway result
 * itself: those criteria stay unencoded until a reviewer verifies the
 * ordinance and records the reviewer, verification date, exact ordinance
 * section, and exact supporting excerpt.
 */
const phasedImplementationExcerpts = [
  "The adopted Phased Implementation Ordinance sets out a citywide temporary-exemption approach and permanent exclusion criteria.",
  "Permanent/temporary exemptions and mapping provisions.",
] as const;

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
  {
    id: "la_sb79.permanent-exclusion",
    pathway: "la_sb79",
    label: "Permanent exclusion under Ordinance 188968 (effect not yet verified)",
    gating: false,
    fact_keys: ["sb79-permanent-exclusion"],
    predicate: "not_encoded",
    rule_summary:
      "Rule not encoded. The repo source notes establish that Ordinance 188968 contains permanent exclusion criteria, not what a documented exclusion means for this pathway. A reviewer must verify the ordinance and record the reviewer, verification date, exact section, and exact supporting excerpt before this criterion can produce a result.",
    citation: cite(
      "phasedImplementationOrdinance",
      "Sections 1\u20136: permanent exclusions and mapping provisions",
    ),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "Does the adopted Phased Implementation record (Ordinance 188968) show a permanent exclusion for this parcel?",
    question_if_conflict:
      "Official records disagree on whether Ordinance 188968 shows a permanent exclusion for this parcel. Which record governs?",
    question_if_judgment: null,
    verification: "pending_human",
    basis: {
      repo_path: repoSourceNotes.sb79LowRiseGuide,
      excerpts: phasedImplementationExcerpts,
    },
  },
  {
    id: "la_sb79.temporary-exemption",
    pathway: "la_sb79",
    label: "Temporary exemption under Ordinance 188968 (effect not yet verified)",
    gating: false,
    fact_keys: ["sb79-temporary-exemption"],
    predicate: "not_encoded",
    rule_summary:
      "Rule not encoded. The repo source notes establish that Ordinance 188968 has a temporary-exemption approach tied to the City's next Housing Element revision, not what a shown or absent exemption means for this pathway. A reviewer must verify the ordinance and record the reviewer, verification date, exact section, and exact supporting excerpt before this criterion can produce a result.",
    citation: cite(
      "phasedImplementationOrdinance",
      "Sections 1\u20136: temporary exemptions",
    ),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "Does the adopted Phased Implementation record show a temporary exemption for this parcel?",
    question_if_conflict:
      "Official records disagree on whether a temporary exemption applies to this parcel. Which record governs?",
    question_if_judgment: null,
    verification: "pending_human",
    basis: {
      repo_path: repoSourceNotes.sb79LowRiseGuide,
      excerpts: [
        ...phasedImplementationExcerpts,
        "The temporary-exemption period is tied to adoption of the City\u2019s next Housing Element revision; do not substitute a general implementation target for the applicable rule.",
        "How does phased implementation affect the displayed SB 79 result?",
      ],
    },
  },
  {
    id: "la_sb79.site-and-overlay-standards",
    pathway: "la_sb79",
    label: "SB 79 zoning, overlay, and existing-housing criteria",
    gating: false,
    fact_keys: ["zoning", "specific-plan-area", "hpoz", "existing-dwelling-units"],
    predicate: "not_encoded",
    rule_summary:
      "Rule not encoded. The repo source notes list these facts as SB 79 review inputs but do not state the criteria; a PermitPulse reviewer must verify them against Ordinance 188968 and the City's SB 79 materials.",
    citation: cite("sb79Hub", "Adoption status and current mapping links"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "What zoning, overlays, and existing housing do City records show for this parcel for SB 79 review?",
    question_if_conflict:
      "Official records disagree on the parcel's zoning, overlays, or existing housing. Which record governs for SB 79 review?",
    question_if_judgment: null,
    verification: "pending_human",
    basis: {
      repo_path: repoSourceNotes.housingProgramsGuide,
      excerpts: [
        "Parcel match, zoning and overlays, displayed transit/program category, existing housing, proposed work, and affordability concept.",
      ],
    },
  },
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
    basis: {
      repo_path: repoSourceNotes.sb79LowRiseGuide,
      excerpts: [
        "Flag historic designations, coastal or fire/hillside information, and site-specific restrictions for review.",
        "Low-Rise has its own criteria and exceptions; one overlay label cannot safely be turned into a universal yes or no.",
      ],
    },
  },
  {
    id: "la_low_rise.geographic-criteria",
    pathway: "la_low_rise",
    label: "Low-Rise geographic criteria (Ordinance 188967, Sections 5–9)",
    gating: false,
    fact_keys: ["zoning", "general-plan-land-use", "specific-plan-area"],
    predicate: "not_encoded",
    rule_summary:
      "Rule not encoded. The repo source notes say Low-Rise has geographic criteria but do not state them; a PermitPulse reviewer must verify them against Ordinance 188967.",
    citation: cite("lowRiseOrdinance", "Sections 5–9: geographic criteria"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown:
      "What zoning, General Plan land use, and Specific Plan context do City records show for this parcel?",
    question_if_conflict:
      "Official records disagree on the parcel's zoning, General Plan land use, or Specific Plan context. Which record governs for Low-Rise review?",
    question_if_judgment: null,
    verification: "pending_human",
    basis: {
      repo_path: repoSourceNotes.sb79LowRiseGuide,
      excerpts: [
        "Copy the full zoning designation, General Plan land use, and any Specific Plan.",
        "Low-Rise has project and affordability requirements as well as geographic criteria.",
      ],
    },
  },
];

export const sb79Pack: ProgramPathwayPack = {
  pathway: sb79Pathway,
  criteria: sb79Criteria,
};

export const lowRisePack: ProgramPathwayPack = {
  pathway: lowRisePathway,
  criteria: lowRiseCriteria,
};
