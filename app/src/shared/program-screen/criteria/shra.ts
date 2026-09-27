import type { ProgramCriterion, ProgramPathwayPack } from "../types";
import {
  cite,
  jurisdictionCriterion,
  parcelMatchCriterion,
  repoSourceNotes,
  textFact,
} from "./common";

/**
 * SHRA (as amended by SB 684 / SB 1123), City of Los Angeles implementation.
 *
 * Encoded from repo source notes: which memo scope applies (Chapter 1 vs 1A)
 * and that "vacant" is a legal-definition judgment. SHRA site thresholds are
 * not stated in the repo, so each is `pending_human` with `not_encoded`; its
 * fact keys come from the guide's "Have ready" list. A pending criterion can
 * run a rule only as `human_verified`, with a human-verification record whose
 * excerpt appears in captured official-source text (see
 * docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md).
 */
const haveReady =
  "Pre-subdivision lot area and zoning; existing structures and occupancy history; proposed lots, units, and ownership structure; prior subdivisions; Housing Element site status; environmental constraints and access.";

const pendingBasis = {
  repo_path: repoSourceNotes.housingProgramsGuide,
  excerpts: [haveReady],
} as const;

function pendingShraCriterion(
  slug: string,
  label: string,
  factKeys: ProgramCriterion["fact_keys"],
  questions: { unknown: string; conflict: string },
): ProgramCriterion {
  return {
    id: `la_shra.${slug}`,
    pathway: "la_shra",
    label,
    gating: false,
    fact_keys: factKeys,
    predicate: "not_encoded",
    rule_summary:
      "Rule not encoded. The repo source notes name these facts as SHRA review inputs but do not state the criterion; a PermitPulse reviewer must verify it against the City's current SHRA materials and record the reviewer, verification date, exact section, and exact supporting excerpt before this criterion can produce a result.",
    citation: cite("shraPage", "Filing checklists and implementation memo"),
    confirmer: "Los Angeles City Planning",
    question_if_unknown: questions.unknown,
    question_if_conflict: questions.conflict,
    question_if_judgment: null,
    verification: "pending_human",
    human_verification: null,
    basis: pendingBasis,
  };
}

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
  pendingShraCriterion(
    "lot-area-and-zoning",
    "SHRA pre-subdivision lot area and zoning criteria",
    ["lot-area", "zoning"],
    {
      unknown:
        "What pre-subdivision lot area and full zoning designation do City records show for this parcel?",
      conflict:
        "Official records disagree on the parcel's lot area or zoning. Which record governs for SHRA review?",
    },
  ),
  pendingShraCriterion(
    "existing-structures-and-occupancy",
    "SHRA existing-structure and occupancy criteria",
    ["existing-structures", "occupancy-history"],
    {
      unknown:
        "What existing structures and residential occupancy history do City records show for this parcel?",
      conflict:
        "Official records disagree about existing structures or occupancy on this parcel. Which record governs for SHRA review?",
    },
  ),
  pendingShraCriterion(
    "prior-subdivisions",
    "SHRA prior-subdivision criteria",
    ["prior-subdivisions"],
    {
      unknown: "Do City records show any prior subdivision of this parcel?",
      conflict:
        "Official records disagree on prior subdivisions of this parcel. Which record governs for SHRA review?",
    },
  ),
  pendingShraCriterion(
    "housing-element-site-status",
    "SHRA Housing Element site-status criteria",
    ["housing-element-site-status"],
    {
      unknown: "What Housing Element site status do the City's current records show for this parcel?",
      conflict:
        "Official records disagree on the parcel's Housing Element site status. Which record governs for SHRA review?",
    },
  ),
  pendingShraCriterion(
    "environmental-constraints",
    "SHRA environmental-constraint criteria",
    [
      "very-high-fire-hazard-severity-zone",
      "hillside-area",
      "fault-zone",
      "landslide-area",
      "flood-zone",
    ],
    {
      unknown:
        "Which fire-hazard, hillside, fault, landslide, and flood designations do City records map on this parcel?",
      conflict:
        "Official sources disagree on at least one mapped environmental constraint for this parcel. Which designation governs for SHRA review, and which source should be relied on?",
    },
  ),
];

export const shraPack: ProgramPathwayPack = {
  pathway: shraPathway,
  criteria: shraCriteria,
};
