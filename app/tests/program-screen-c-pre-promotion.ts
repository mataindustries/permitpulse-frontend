import { cite } from "../src/shared/program-screen/criteria/common";
import { programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import type { ProgramCriterion, ProgramPathwayPack } from "../src/shared/program-screen/types";

/**
 * TEST-ONLY. Phase 3H promoted c (`la_shra.very-high-fire-hazard-severity-zone`).
 * Tests that compare the output before and after that promotion rebuild the
 * pre-promotion shipped c here: pending, rule not encoded, and the shared memo
 * citation. The rebuild is faithful only if its output reproduces the historical
 * pre-promotion hashes (156dd1f4…afbc, 4dd2735b…a8a5), which the tests assert.
 * Production never imports this file.
 */
export const C = "la_shra.very-high-fire-hazard-severity-zone";

export const PRE_PROMOTION_C_RULE_SUMMARY =
  "Rule not encoded. The memo bars High and Very High Fire Hazard Severity Zones in state and local responsibility areas. This criterion covers Very High only: a record that the parcel is not in a Very High zone says nothing about a High zone, which is its own criterion. A PermitPulse reviewer must verify it against the captured source and record the reviewer, verification date, exact section, and exact supporting excerpt before this criterion can produce a result.";

const shippedC = (): ProgramCriterion =>
  programScreenPathwayPacks.flatMap((pack) => pack.criteria).find((criterion) => criterion.id === C)!;

/** The shipped c as it was before the Phase 3H promotion. */
export function prePromotionC(): ProgramCriterion {
  const c = shippedC();
  return {
    ...c,
    predicate: "not_encoded",
    rule_summary: PRE_PROMOTION_C_RULE_SUMMARY,
    question_if_judgment: null,
    citation: cite("shraMemo", c.citation.pinpoint),
    verification: "pending_human",
    human_verification: null,
  };
}

/** The shipped packs with c replaced by its pre-promotion form; every other criterion is the shipped one. */
export function prePromotionPacks(packs: readonly ProgramPathwayPack[] = programScreenPathwayPacks): ProgramPathwayPack[] {
  return packs.map((pack) => ({
    ...pack,
    criteria: pack.criteria.map((criterion) => (criterion.id === C ? prePromotionC() : criterion)),
  }));
}
