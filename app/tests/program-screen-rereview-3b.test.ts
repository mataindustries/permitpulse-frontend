import { describe, expect, inject, it } from "vitest";
import rereviewDoc from "../../docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md?raw";
import phase3aMemo from "../../docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md?raw";
import round1Packet from "../../docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md?raw";
import round1DecisionsDoc from "../../docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1_DECISIONS.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import rereviewJson from "../fixtures/program-screen/human-review-rounds/phase-3b-rereview-decisions.json";
import round1DecisionsRaw from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json?raw";
import round1DecisionsJson from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json";
import round1Raw from "../fixtures/program-screen/human-review-rounds/round-1.json?raw";
import statuteExtracted from "../fixtures/program-screen/official-sources/gcs-66499-41/extracted.txt?raw";
import statuteMetadataJson from "../fixtures/program-screen/official-sources/gcs-66499-41/metadata.json";
import memoExtracted from "../fixtures/program-screen/official-sources/shra-2025-10-28/extracted.txt?raw";
import {
  authorityPromotionBlockers,
  programAuthorityRegistries,
  promotionGuardedCriterionIds,
} from "../src/shared/program-screen/authority-policy";
import { evaluateProgramScreen, programScreenPathwayPacks } from "../src/shared/program-screen/evaluate";
import { programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import {
  humanReviewDecisionsSchema,
  humanRereviewDecisionLabels,
  humanRereviewDecisionsSchema,
  statuteRereviewWarnings,
} from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  canSupportCriterionRule,
  normalizeSourceText,
  parseOfficialSourceMetadata,
  sha256Hex,
  sourceHostExceptions,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import { criterionPromotionGates } from "../src/shared/program-screen/types";

/**
 * Phase 3B: the named human reviewer's statute-triggered re-review of Round 1
 * decisions c-g, recorded only. Nothing is promoted, wired, registered, or
 * relabelled, and Round 1 history is not edited.
 * Record: docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md.
 */

const C_TO_G = [
  "la_shra.very-high-fire-hazard-severity-zone",
  "la_shra.high-fire-hazard-severity-zone",
  "la_shra.prime-or-statewide-farmland",
  "la_shra.natural-community-conservation-plan-land",
  "la_shra.conservation-easement",
];
const TRIGGER = "gcs_66499_41_a_9_captured";
const PROVENANCE = "evidence_provenance_enforced_or_fails_closed";
const BASE = ["reviewer_confirms_encoded_rule", "human_verification_record"];

const rereview = humanRereviewDecisionsSchema.parse(rereviewJson);
const round1 = humanReviewDecisionsSchema.parse(round1DecisionsJson);
const byLetter = new Map(rereview.decisions.map((entry) => [entry.letter, entry]));
const decisionFor = (letter: string) => {
  const entry = byLetter.get(letter);
  if (entry === undefined) throw new Error(`No Phase 3B decision ${letter}.`);
  return entry;
};
const round1For = (letter: string) => {
  const entry = round1.decisions.find((candidate) => candidate.letter === letter);
  if (entry === undefined) throw new Error(`No Round 1 decision ${letter}.`);
  return entry;
};

const statuteMetadata = parseOfficialSourceMetadata(statuteMetadataJson);
const officialByteChecks = inject("programScreenOfficialCaptureByteChecks");
const officialMetadata = Object.values(
  import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", { import: "default", eager: true }) as Record<
    string,
    unknown
  >,
).map((value) => parseOfficialSourceMetadata(value));
const shippedCriteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const criterionFor = (id: string) => {
  const criterion = shippedCriteria.find((candidate) => candidate.id === id);
  if (criterion === undefined) throw new Error(`No shipped criterion ${id}.`);
  return criterion;
};

const fence = (text: string) => `\`\`\`text\n${text}\n\`\`\``;
/** The record with every fenced verbatim or decided block removed. */
const docProse = rereviewDoc.replace(/^```text\n[\s\S]*?\n```$/gm, "");
const quotedSegments = (text: string) => [...text.matchAll(/“([^”]*)”/g)].map((match) => match[1]);

/** Every text a curly-quoted segment may be traced to: the two sources, the reviewer's words, and the shipped client labels. */
const traceableTexts = [
  memoExtracted,
  statuteExtracted,
  rereview.confirmations_verbatim,
  ...rereview.decisions.map((entry) => entry.reviewer_text_verbatim),
  ...Object.values(programFactSpecs).map((spec) => spec.client_label),
].map(normalizeSourceText);
const traces = (segment: string) => traceableTexts.some((text) => text.includes(normalizeSourceText(segment)));

/* ======================================================================== */

describe("1. The Phase 3B record", () => {
  it("records the reviewer, the corrected date, and one decision per re-reviewed criterion, c-g in order", () => {
    expect(humanRereviewDecisionsSchema.safeParse(rereviewJson).success).toBe(true);
    expect(rereview).toMatchObject({
      record_kind: "human_rereview_decisions",
      schema_version: "program-screen-human-rereview-decisions-v1",
      phase: "3B",
      decisions_doc: "docs/PROGRAM_SCREEN_PHASE_3B_REREVIEW_DECISIONS.md",
      preparation_memo: "docs/PROGRAM_SCREEN_PHASE_3A_GCS_66499_41_A_9_REVIEW.md",
      supersedes_record: "app/fixtures/program-screen/human-review-rounds/round-1-decisions.json",
      reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
      decided_on: "2026-09-28",
      promoted_in_this_review: [],
      source_basis: ["shra-2025-10-28", "gcs-66499-41"],
    });
    expect(rereview.decisions.map((entry) => entry.letter)).toEqual(["c", "d", "e", "f", "g"]);
    expect(rereview.decisions.map((entry) => entry.criterion_id)).toEqual(C_TO_G);
  });

  it("supersedes the Round 1 decision with the same letter and criterion", () => {
    for (const entry of rereview.decisions) {
      expect(entry.supersedes, entry.letter).toEqual({ round: 1, letter: entry.letter });
      expect(round1For(entry.letter).criterion_id, entry.letter).toBe(entry.criterion_id);
    }
  });

  it("pins each decision and tier: e is a candidate rule that stays pending source capture", () => {
    expect(Object.fromEntries(rereview.decisions.map((entry) => [entry.letter, [entry.decision, entry.tier]]))).toEqual({
      c: ["approve_revised_rule", "gated_on_enforcement"],
      d: ["approve_revised_rule", "gated_on_enforcement"],
      e: ["approve_revised_rule", "pending_source_capture"],
      f: ["approve_revised_rule", "gated_on_enforcement"],
      g: ["approve_revised_rule", "gated_on_enforcement"],
    });
    for (const entry of rereview.decisions) {
      expect(entry.reviewer_text_verbatim.startsWith(humanRereviewDecisionLabels[entry.decision]), entry.letter).toBe(true);
      expect(entry, entry.letter).toMatchObject({ status_after_review: "pending_human", outcome_ceiling_changed: false });
    }
  });

  it("applies the reviewer's corrections and confirmations to the rule as decided", () => {
    const rule = (letter: string) => decisionFor(letter).rule_as_decided.join("\n");
    for (const entry of rereview.decisions) {
      expect(rule(entry.letter), entry.letter).not.toMatch(/whole parcel/);
      expect(rule(entry.letter), entry.letter).toContain("whole lot proposed to be subdivided");
    }
    // c: the terminology revision, and point 2 reworded in the reviewer's words (confirmation 1).
    expect(decisionFor("c").rule_as_decided).toHaveLength(8);
    expect(decisionFor("c").rule_as_decided[1]).toContain(
      "“A non-qualifying record cannot establish the fact. Alone, the authority gate returns unknown. Disagreement between known-value records is handled by existing Layer 1 conflict detection. The authority gate does not manufacture conflict.”",
    );
    expect(rule("c")).not.toMatch(/the result is conflict/);
    expect(rule("c")).toContain("A negative under one route alone gives unknown.");
    // d: High only through PRC §4202; responsibility area is context only; no special conflict rule.
    expect(decisionFor("d").rule_as_decided).toHaveLength(8);
    expect(rule("d")).not.toMatch(/the result is conflict/);
    expect(rule("d")).toContain("A §51178 determination never establishes d");
    expect(rule("d")).toContain("Responsibility area is recorded only when the source states it, as context. It is not a condition");
    // e: the USDA-criteria condition, never assumed from the map's source.
    expect(decisionFor("e").rule_as_decided).toHaveLength(8);
    expect(rule("e")).toContain(
      "are the categories defined pursuant to the USDA land inventory and monitoring criteria referenced by §66499.41(a)(9)(A)",
    );
    expect(rule("e")).toContain("That relationship is never assumed merely because the map comes from the program.");
    // f: current status is an evidence requirement, not statutory wording; G2 is not absorbed.
    expect(decisionFor("f").rule_as_decided).toHaveLength(6);
    expect(rule("f")).toContain("is a fail-closed evidence requirement, not wording supplied by §66499.41(a)(9)(H) itself");
    expect(rule("f")).toContain("Passing f never means §66499.41(a)(9)(H) as a whole is satisfied.");
    // g: the proposition is only (J)'s words; recorded is an evidence standard.
    expect(decisionFor("g").rule_as_decided).toHaveLength(7);
    expect(rule("g")).toContain("The source proposition is only “Land under conservation easement.”");
    expect(rule("g")).toContain("a PermitPulse conservative evidence standard for establishing YES");
    for (const letter of ["c", "d", "e", "f", "g"]) {
      expect(rule(letter), letter).toMatch(/NO (?:never clears|→ consistent_with_source only when)/);
    }
  });

  it("quotes only the captured sources, the reviewer's words, or a shipped client label", () => {
    const decided = [...rereview.common_terms, ...rereview.decisions.flatMap((entry) => entry.rule_as_decided)];
    for (const segment of [...decided.flatMap(quotedSegments), ...quotedSegments(docProse)]) {
      expect(traces(segment), segment).toBe(true);
    }
    for (const blocker of rereview.pathway_completeness_blockers) {
      expect(normalizeSourceText(statuteExtracted), blocker.id).toContain(blocker.category_text);
    }
  });

  it("keeps every reviewer text verbatim in the decisions document", () => {
    for (const entry of rereview.decisions) {
      expect(rereviewDoc, entry.letter).toContain(fence(entry.reviewer_text_verbatim));
      expect(rereviewDoc, entry.letter).toContain(fence(entry.rule_as_decided.join("\n")));
      expect(rereviewDoc).toContain(`## ${entry.letter}. \`${entry.criterion_id}\`: ${humanRereviewDecisionLabels[entry.decision]}`);
    }
    expect(rereviewDoc).toContain(fence(rereview.confirmations_verbatim));
    expect(rereviewDoc).toContain(fence(rereview.common_terms.join("\n")));
    for (const blocker of rereview.pathway_completeness_blockers) {
      expect(rereviewDoc, blocker.id).toContain(fence(blocker.reviewer_text_verbatim));
    }
    for (const [gate, definition] of Object.entries(rereview.gate_definitions)) {
      expect(rereviewDoc, gate).toContain(`- \`${gate}\`: ${definition}`);
    }
    expect(rereviewDoc).toContain("Decided 2026-09-28 by **Sergio Mata, Project Owner / Human Reviewer**.");
    expect(rereview.confirmations_verbatim).toContain("record the Phase 3B human-review decision date as 2026-09-28");
  });

  it("uses no conclusion language outside the verbatim and decided texts", () => {
    expect(docProse).not.toMatch(/\b(?:attorney|counsel|lawyer|planner|subject[- ]matter expert)\b/i);
    expect(findProhibitedClientLanguage(docProse, quotedSegments(docProse))).toEqual([]);
    const ownText = [
      ...Object.values(rereview.gate_definitions),
      ...rereview.decisions.flatMap((entry) => entry.restated_gates.map((restated) => restated.restated_as)),
      ...rereview.pathway_completeness_blockers.flatMap((blocker) => blocker.resolution_requires_one_of),
    ];
    for (const text of ownText) expect(findProhibitedClientLanguage(text, quotedSegments(text)), text).toEqual([]);
  });

  it("rejects a record that promotes, drops a gate, or misstates a decision", () => {
    const [first, ...rest] = rereviewJson.decisions;
    const withEntry = (entry: unknown) => ({ ...rereviewJson, decisions: [entry, ...rest] });
    const variants: Array<[string, unknown]> = [
      ["a promoted criterion", { ...rereviewJson, promoted_in_this_review: [first.criterion_id] }],
      ["a human_verified status", withEntry({ ...first, status_after_review: "human_verified" })],
      ["a changed ceiling", withEntry({ ...first, outcome_ceiling_changed: true })],
      ["a dropped reviewer gate", withEntry({ ...first, promotion_gates: first.promotion_gates.filter((gate) => gate !== "reviewer_confirms_encoded_rule") })],
      ["an undefined gate", withEntry({ ...first, promotion_gates: [...first.promotion_gates, "reviewer_said_so"] })],
      ["an unwired gate that is not decided", withEntry({ ...first, gates_not_yet_wired: [...first.gates_not_yet_wired, "chapter_1a_fails_closed"] })],
      ["a retained gate whose replacement is claimed wired", {
        ...rereviewJson,
        decisions: rereviewJson.decisions.map((entry) =>
          entry.letter === "d"
            ? { ...entry, gates_not_yet_wired: entry.gates_not_yet_wired.filter((gate) => gate !== "prc_4202_map_coverage_and_legend_class_recorded") }
            : entry,
        ),
      }],
      ["a text that opens with another decision", withEntry({ ...first, decision: "keep_pending", tier: "pending_source_capture" })],
      ["a mismatched superseded letter", withEntry({ ...first, supersedes: { round: 1, letter: "d" } })],
      ["a decision that does not answer the trigger", withEntry({ ...first, resolves_rereview_triggers: ["some_other_trigger"] })],
      ["an unknown pathway blocker", withEntry({ ...first, pathway_blockers_referenced: ["G9"] })],
      ["a resolved blocker", { ...rereviewJson, pathway_completeness_blockers: rereviewJson.pathway_completeness_blockers.map((blocker) => ({ ...blocker, status: "resolved" })) }],
      ["a redefined existing gate", { ...rereviewJson, gate_definitions: { ...rereviewJson.gate_definitions, human_verification_record: "Redefined." } }],
      ["an AI reviewer", { ...rereviewJson, reviewer: { kind: "ai", name: "Claude", role: "Preparer" } }],
      ["a duplicated criterion", { ...rereviewJson, decisions: [first, first, ...rest] }],
    ];
    for (const [name, value] of variants) {
      expect(humanRereviewDecisionsSchema.safeParse(value).success, name).toBe(false);
    }
  });
});

/* ======================================================================== */

describe("2. The trigger is answered, pinned to the capture", () => {
  it("pins the trigger to the gcs-66499-41 capture's hashes", async () => {
    expect(rereview.trigger).toEqual({
      id: TRIGGER,
      statute_source_id: statuteMetadata.source_id,
      sha256_original: statuteMetadata.sha256_original,
      sha256_extracted: statuteMetadata.sha256_extracted,
    });
    expect(await sha256Hex(statuteExtracted)).toBe(rereview.trigger.sha256_extracted);
    expect(officialByteChecks["app/fixtures/program-screen/official-sources/gcs-66499-41"].sha256_original).toBe(
      rereview.trigger.sha256_original,
    );
  });

  it("answers every criterion the trigger flags, and no other", () => {
    const warnings = statuteRereviewWarnings(officialMetadata as OfficialSourceMetadata[], [round1]);
    expect(warnings).toHaveLength(1);
    const [warning] = warnings;
    expect(warning).toMatchObject({ trigger: TRIGGER, statute_source_id: rereview.trigger.statute_source_id, criterion_ids: C_TO_G });
    const answered = rereview.decisions.filter((entry) => entry.resolves_rereview_triggers.includes(warning.trigger));
    expect(answered.map((entry) => entry.criterion_id)).toEqual(warning.criterion_ids);
  });
});

/* ======================================================================== */

describe("3. Gates: recorded, not wired", () => {
  const registry = programAuthorityRegistries.criterion_requirements;
  const sorted = (values: readonly string[]) => [...values].sort();

  it("pins every gate decided before any c-g criterion can become human_verified", () => {
    expect(Object.fromEntries(rereview.decisions.map((entry) => [entry.letter, entry.promotion_gates]))).toEqual({
      c: [PROVENANCE, "map_identity_and_edition_recorded", "statutory_route_recorded", "statutory_routes_assessed_separately", "legal_lot_identity_fails_closed", ...BASE],
      d: [PROVENANCE, "map_identity_and_edition_recorded", "statutory_route_recorded", "prc_4202_map_coverage_and_legend_class_recorded", "legal_lot_identity_fails_closed", ...BASE],
      e: ["defining_official_source_captured", "fmmp_categories_tied_to_usda_criteria", PROVENANCE, "map_identity_and_edition_recorded", "legal_lot_identity_fails_closed", ...BASE],
      f: [PROVENANCE, "adopted_plan_identity_adoption_and_map_date_recorded", "nccp_plan_type_and_statutory_basis_recorded", "legal_lot_identity_fails_closed", ...BASE],
      g: [PROVENANCE, "instrument_identity_in_force_status_and_coverage_recorded", "legal_lot_identity_fails_closed", ...BASE],
    });
    expect(Object.keys(rereview.gate_definitions).sort()).toEqual([
      "fmmp_categories_tied_to_usda_criteria",
      "nccp_plan_type_and_statutory_basis_recorded",
      "prc_4202_map_coverage_and_legend_class_recorded",
      "statutory_route_recorded",
      "statutory_routes_assessed_separately",
    ]);
    for (const gate of Object.keys(rereview.gate_definitions)) {
      expect((criterionPromotionGates as readonly string[]).includes(gate), gate).toBe(false);
    }
    expect(rereview.gate_definitions.statutory_routes_assessed_separately).toContain("a NO under only one route cannot clear the criterion");
    expect(decisionFor("d").gates_retained_until_replacement_wired).toEqual([
      { gate: "responsibility_area_and_legend_recorded", replaced_by: "prc_4202_map_coverage_and_legend_class_recorded" },
    ]);
    expect(decisionFor("e").restated_gates.map((restated) => restated.gate)).toEqual(["defining_official_source_captured"]);
  });

  it("keeps every Round 1 gate: decided here or retained until its replacement is wired", () => {
    for (const entry of rereview.decisions) {
      const kept = [...entry.promotion_gates, ...entry.gates_retained_until_replacement_wired.map((retained) => retained.gate)];
      for (const gate of round1For(entry.letter).promotion_gates) expect(kept, `${entry.letter}: ${gate}`).toContain(gate);
    }
  });

  it("leaves the authority registry at exactly the wired set, still pointing at Round 1", () => {
    for (const entry of rereview.decisions) {
      const requirement = registry[entry.criterion_id];
      expect(requirement, entry.letter).toBeDefined();
      const wired = [
        ...entry.promotion_gates.filter((gate) => !entry.gates_not_yet_wired.includes(gate)),
        ...entry.gates_retained_until_replacement_wired.map((retained) => retained.gate),
      ];
      expect(sorted(requirement.promotion_gates), entry.letter).toEqual(sorted(wired));
      expect(requirement.promotion_gates, entry.letter).toEqual(round1For(entry.letter).promotion_gates);
      if (requirement.applicability === "enforced") expect(requirement.decision_ref, entry.letter).toEqual({ round: 1, letter: entry.letter });
    }
  });

  it("blocks promotion of c-g while any decided gate is unwired", () => {
    for (const entry of rereview.decisions) {
      const unwired = entry.gates_not_yet_wired.length > 0 || entry.gates_retained_until_replacement_wired.length > 0;
      expect(unwired, entry.letter).toBe(true);
      const criterion = criterionFor(entry.criterion_id);
      if (unwired) {
        expect(criterion, entry.letter).toMatchObject({ verification: "pending_human", human_verification: null, predicate: "not_encoded" });
      }
    }
    // c cannot be promoted until route-separated assessment is implemented and fails closed (confirmation 3).
    expect(decisionFor("c").gates_not_yet_wired).toContain("statutory_routes_assessed_separately");
  });
});

/* ======================================================================== */

describe("4. SHRA pathway completeness blockers G1 and G2", () => {
  it("records G1 and G2 as open blockers the related criteria do not absorb", () => {
    expect(
      rereview.pathway_completeness_blockers.map((blocker) => [blocker.id, blocker.statute_pinpoint, blocker.related_criterion_id, blocker.status]),
    ).toEqual([
      ["G1", "(a)(9)(A)", "la_shra.prime-or-statewide-farmland", "open"],
      ["G2", "(a)(9)(H)", "la_shra.natural-community-conservation-plan-land", "open"],
    ]);
    expect(decisionFor("e").pathway_blockers_referenced).toEqual(["G1"]);
    expect(decisionFor("f").pathway_blockers_referenced).toEqual(["G2"]);
    const [g1, g2] = rereview.pathway_completeness_blockers;
    expect(decisionFor("g").reviewer_text_verbatim).toContain(g1.reviewer_text_verbatim);
    expect(decisionFor("f").reviewer_text_verbatim).toContain(g2.reviewer_text_verbatim);
    expect(rereview.confirmations_verbatim).toContain("G1 and G2 remain SHRA pathway completeness blockers exactly as proposed.");
    for (const blocker of rereview.pathway_completeness_blockers) {
      expect(blocker, blocker.id).toMatchObject({ pathway: "la_shra", blocks_rollup: "no_disqualifier_found_in_reviewed_sources" });
      expect(shippedCriteria.some((criterion) => criterion.id === blocker.key), blocker.id).toBe(false);
    }
  });

  it("never lets the SHRA pathway roll up to no_disqualifier_found_in_reviewed_sources while a blocker is open", () => {
    const open = rereview.pathway_completeness_blockers.filter((blocker) => blocker.status === "open");
    expect(open).toHaveLength(2);
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    for (const pathways of [result.pathways, demo.pathways]) {
      const shra = pathways.find((pathway) => pathway.pathway === "la_shra");
      expect(shra).toBeDefined();
      for (const blocker of open) expect(shra?.rollup, blocker.id).not.toBe(blocker.blocks_rollup);
    }
  });
});

/* ======================================================================== */

describe("5. Invariants: recording only", () => {
  // The same pins as the Round 1, Phase 2, Phase 2b, and Phase 3A tests.
  const EVALUATOR_OUTPUT_SHA256 = "2b0c6ea651dfc55191090ab0c6129a8c22692a28bfdce3f046425437e1acecca";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "d00a74d195a2749da877775c0204a3435820fd13189f2ae05880b744ab45f57f";

  it("keeps human_verified at 0 and pending_human at 46, every guarded criterion blocked", () => {
    expect(shippedCriteria.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(shippedCriteria.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
    const guarded = shippedCriteria.filter((criterion) => promotionGuardedCriterionIds.has(criterion.id));
    expect(guarded).toHaveLength(46);
    for (const criterion of guarded) {
      expect(authorityPromotionBlockers(criterion, programAuthorityRegistries, false).length, criterion.id).toBeGreaterThan(0);
    }
  });

  it("registers no issuer, authority source, fact-policy entry, or host exception", () => {
    expect(programAuthorityRegistries.issuers).toEqual([]);
    expect(programAuthorityRegistries.sources).toEqual([]);
    for (const [key, policy] of Object.entries(programAuthorityRegistries.fact_policies)) {
      expect(policy?.establishing, key).toEqual([]);
    }
    expect(sourceHostExceptions).toEqual([]);
    expect(canSupportCriterionRule(statuteMetadata)).toBe(false);
    expect(JSON.stringify(programAuthorityRegistries)).not.toContain("phase-3b");
  });

  it("keeps the evaluator and public-demo output byte-identical", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
  });

  it("leaves the five official-source captures unchanged", () => {
    const pins: Record<string, [string, number]> = {
      "gcs-66499-41": ["3521eb92f68d966461eb0c7b60ebffad8371b487eff2f014417cd74fc077ec72", 186734],
      "low-rise-draft-2026-09-24": ["c451896908430f573206209c6c154c62c95b2c396ffdebe5a7e8505560a8d9a7", 255876],
      "ordinance-188967": ["d03eda1a3b6d790d1e1331040118c5661b2d87f202e6389839982b9e5a2ed24f", 16689838],
      "ordinance-188968": ["e355179f5e7dfb58626f596d2023549279a53b4a3431f691a599557b5f7519e3", 8296425],
      "shra-2025-10-28": ["c7063b881987dc855bb74a674f0d344233f7b7d2859544850c54176d347d8b5e", 291094],
    };
    const real = Object.fromEntries(
      Object.entries(officialByteChecks)
        .filter(([directory]) => !directory.includes("/test-only-"))
        .map(([directory, check]) => [directory.replace(/^.*\//, ""), [check.sha256_original, check.bytes]]),
    );
    expect(real).toEqual(pins);
    for (const check of Object.values(officialByteChecks)) expect(check.issues).toEqual([]);
  });

  it("leaves Round 1 history and the Phase 3A memo byte-identical", async () => {
    expect(await sha256Hex(round1Raw)).toBe("6b401cf36ac329f305b1299c3e1e84acc7ede15a47f4dd882731dfdb8faa338b");
    expect(await sha256Hex(round1DecisionsRaw)).toBe("235f33fdc553e53ada2d69a0638e9fb03b94b07f779766d460fa186dfd970b33");
    expect(await sha256Hex(round1Packet)).toBe("cdbffa7f3cdd87794a7f0759168bd8389d8bd894df2d3269692002eb95ac684e");
    expect(await sha256Hex(round1DecisionsDoc)).toBe("f7e6f0e253006f6e8a6782173d46c7cbd2e13c76c7f14790240cbd700a76dc76");
    expect(await sha256Hex(phase3aMemo)).toBe("4da16a443ebdf39a6f1b5bd42bcb2e42517b0afd7018e401b9d46be150cb1f58");
  });

  it("makes none of the deferred label changes", () => {
    expect(programFactSpecs["very-high-fire-hazard-severity-zone"].client_label).toBe("the property's fire-hazard designation");
    expect(programFactSpecs["high-fire-hazard-severity-zone"].client_label).toBe(
      "whether the parcel is mapped in a High Fire Hazard Severity Zone, in a state or local responsibility area",
    );
    expect(programFactSpecs["conservation-easement"].client_label).toBe("whether the parcel is under a recorded conservation easement");
    expect(decisionFor("c").deferred_changes).toEqual(["very_high_fire_client_label"]);
    expect(decisionFor("d").deferred_changes).toEqual(["combined_high_or_very_high_coverage_fact_if_needed", "high_fire_client_label"]);
    expect(decisionFor("g").deferred_changes).toEqual(["conservation_easement_client_label"]);
  });
});
