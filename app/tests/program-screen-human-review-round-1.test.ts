import { describe, expect, it, vi } from "vitest";
import packet from "../../docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md?raw";
import decisionsDoc from "../../docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1_DECISIONS.md?raw";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import roundJson from "../fixtures/program-screen/human-review-rounds/round-1.json";
import decisionsJson from "../fixtures/program-screen/human-review-rounds/round-1-decisions.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import { jurisdictionCriterion, parcelMatchCriterion } from "../src/shared/program-screen/criteria/common";
import { retiredProgramCriteria } from "../src/shared/program-screen/criteria/retired";
import { sb79Pathway } from "../src/shared/program-screen/criteria/sb79-low-rise";
import { shraPack } from "../src/shared/program-screen/criteria/shra";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  candidateRuleOutcome,
  humanReviewCaptureIssues,
  humanReviewDecisionLabels,
  humanReviewDecisionsSchema,
  humanReviewRoundSchema,
  proposedVerificationSchema,
  type HumanReviewCandidate,
  type ProposedVerification,
} from "../src/shared/program-screen/proposed-verification";
import { criterionAwaitsHumanVerification, programCriterionSchema } from "../src/shared/program-screen/schema";
import {
  canSupportCriterionRule,
  excerptAppearsInCapture,
  normalizeSourceText,
  sha256Hex,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  humanVerificationRequiredCriterionIds,
  retiredProgramCriterionIds,
  retiredProgramFactKeys,
  type CriterionPredicate,
  type PredicateOutcome,
  type ProgramCriterion,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";

/**
 * Human review Round 1 (2026-09-28): eight atomic criteria prepared for a
 * named human reviewer. The packet and its manifest are preparation only.
 * These tests prove that their existence changes nothing in production, that
 * every quotation is pinned to an operative capture, and that each proposed
 * rule stays inside its criterion's ceiling and below the evaluator's
 * unknown, conflict, and unreviewed gates.
 */

const AS_OF = fixtureJson.as_of;
const SUBJECT = {
  case_id: "case-fictional-program-screen-round-1-test",
  property_id: "property-fictional-program-screen-round-1-test",
};

const ROUND_1_IDS = [
  "la_shra.single-family-lot-area-threshold",
  "la_shra.prior-shra-or-sb9-map",
  "la_shra.very-high-fire-hazard-severity-zone",
  "la_shra.high-fire-hazard-severity-zone",
  "la_shra.prime-or-statewide-farmland",
  "la_shra.natural-community-conservation-plan-land",
  "la_shra.conservation-easement",
  "la_sb79.permanent-exemption-shown",
];
const SB79_PERMANENT = "la_sb79.permanent-exemption-shown";

const round = humanReviewRoundSchema.parse(roundJson);
const decisions = humanReviewDecisionsSchema.parse(decisionsJson);
const candidates = round.candidates;
const candidateFor = (id: string) => candidates.find((candidate) => candidate.criterion_id === id) as HumanReviewCandidate;

const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const byId = new Map(shipped.map((criterion) => [criterion.id, criterion]));
const criterionFor = (id: string) => byId.get(id) as ProgramCriterion;

/* ---------------------------------------------------------------- captures */

interface Capture {
  metadata: OfficialSourceMetadata;
  extracted: string;
}

const captures: Record<string, Capture> = (() => {
  const metadata = import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", {
    import: "default",
    eager: true,
  }) as Record<string, OfficialSourceMetadata>;
  const texts = import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  return Object.fromEntries(
    Object.entries(metadata).map(([path, value]) => [
      value.source_id,
      { metadata: value, extracted: texts[path.replace(/metadata\.json$/, "extracted.txt")] },
    ]),
  );
})();
const DRAFT_ID = "low-rise-draft-2026-09-24";
const operativeCaptures = Object.values(captures).filter((capture) => canSupportCriterionRule(capture.metadata));

const proposals = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/proposed-verifications/*.json", {
      import: "default",
      eager: true,
    }) as Record<string, unknown>,
  ).map(([path, value]) => [path.replace(/^.*\//, ""), proposedVerificationSchema.parse(value) as ProposedVerification]),
);

/** Every production source file, raw, keyed by its path relative to this test. */
const sourceFiles = import.meta.glob("../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/* ---------------------------------------------------------------- helpers */

function expectValidationCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected Program Screen validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

type Value = boolean | number | string;

function evidence(
  id: string,
  key: ProgramFactKey,
  value: Value | null,
  options: { agency?: string } = {},
): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const known = value !== null;
  const normalized: CanonicalEvidenceRecord["normalized_value"] = !known
    ? { kind: "unknown", value: null, reason: "record_not_returned" }
    : typeof value === "boolean"
      ? { kind: "boolean", value }
      : typeof value === "number"
        ? { kind: "number", value, unit: spec.value.kind === "number" ? spec.value.unit : null }
        : { kind: "text", value };
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: options.agency ?? "Fictional City source",
      title: `Fictional ${key} observation`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/program-screen-round-1/${id}`,
      authority: "official",
      retrieved_at: "2026-09-18T12:00:00.000Z",
    },
    raw_observed_value: !known ? { kind: "not_observed", value: null } : { kind: "text", value: String(value) },
    normalized_value: normalized,
    evidence_type: !known
      ? "lookup_attempt"
      : spec.allowed_evidence_types !== null
        ? spec.allowed_evidence_types[0]
        : "official_portal",
    classification: known ? "source_observation" : "unknown",
    confidence: 99,
    conflicts_with: [],
    review_status: known ? "reviewed" : "review_required",
    notes: [],
    limitations: [],
    provenance: {
      source_record_id: `test-${id}`,
      capture_method: known ? "manual_research" : "provider_retrieval",
      is_ai_generated: false,
    },
  };
}

function anchors(): CanonicalEvidenceRecord[] {
  return [evidence("a-parcel", "parcel-match", true), evidence("a-jurisdiction", "jurisdiction", "City of Los Angeles")];
}

/** The candidate rule exactly as the manifest states it, as a predicate. */
function candidatePredicate(candidate: HumanReviewCandidate): CriterionPredicate {
  return (facts) =>
    candidateRuleOutcome(
      candidate.candidate_rule,
      Object.fromEntries(
        Object.entries(facts).map(([key, value]) => [key, (value as { value: Value }).value]),
      ),
    );
}

/**
 * TEST-ONLY: a copy of the shipped criterion under a test ID, running the
 * manifest's candidate rule, with the shipped ceiling and exceptions. It can
 * never ship: the real ID requires a human-verification record.
 */
function runnableCandidate(id: string) {
  const candidate = candidateFor(id);
  const original = criterionFor(id);
  const spy = vi.fn(candidatePredicate(candidate));
  const copy: ProgramCriterion = {
    ...original,
    id: `${original.pathway}.test-only-round-1-${id.slice(id.indexOf(".") + 1)}`,
    predicate: spy,
    verification: "repo_sourced",
    question_if_judgment: "TEST-ONLY: How does Planning apply this criterion?",
  };
  return { candidate, copy, spy };
}

function run(criterion: ProgramCriterion, records: CanonicalEvidenceRecord[]) {
  const facts = new Map(assessProgramFacts(records, criterion.fact_keys).map((fact) => [fact.key, fact]));
  return evaluateProgramCriterion(criterion, facts, AS_OF);
}

function valuesRecords(values: Partial<Record<ProgramFactKey, Value>>): CanonicalEvidenceRecord[] {
  return Object.entries(values).map(([key, value], index) => evidence(`v-${index}`, key as ProgramFactKey, value as Value));
}

/** Every established value a controlled fact can take (numbers at the thresholds that matter). */
function domain(key: ProgramFactKey): Value[] {
  const spec = programFactSpecs[key].value;
  if (spec.kind === "boolean") return [true, false];
  if (spec.kind === "text") return [...(spec.allowed ?? [])];
  return [1, 7500, 43560, 65339, 65339.99, 65340, 65340.01, 217800, 1_000_000];
}

function combinations(keys: readonly ProgramFactKey[]): Array<Partial<Record<ProgramFactKey, Value>>> {
  return keys.reduce<Array<Partial<Record<ProgramFactKey, Value>>>>(
    (rows, key) => rows.flatMap((row) => domain(key).map((value) => ({ ...row, [key]: value }))),
    [{}],
  );
}

function statusFor(outcome: PredicateOutcome): string {
  return outcome === "requires_judgment" ? "professional" : outcome;
}

function pathwayPackWith(copy: ProgramCriterion): ProgramPathwayPack {
  return {
    pathway: copy.pathway === "la_sb79" ? sb79Pathway : shraPack.pathway,
    criteria: [parcelMatchCriterion(copy.pathway), jurisdictionCriterion(copy.pathway), copy],
  };
}

function screenWith(copy: ProgramCriterion, records: CanonicalEvidenceRecord[]) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchors(), ...records],
    as_of: AS_OF,
    packs: [pathwayPackWith(copy)],
  });
  return { result, pathway: result.pathways[0], criterion: result.pathways[0].criteria[2] };
}

/** Curly-quoted segments of a string: the only place a candidate's own text may quote the source. */
function quotedSegments(text: string): string[] {
  return [...text.matchAll(/“([^”]*)”/g)].map((match) => match[1]);
}

/** Every string the preparer wrote in a candidate (everything but the quoted excerpt texts). */
function ownText(value: unknown, key = ""): string[] {
  if (typeof value === "string") return key === "text" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => ownText(item, key));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([child, item]) => ownText(item, child));
  }
  return [];
}

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [key, ...keysDeep(item)]);
  }
  return [];
}

function stringsDeep(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsDeep);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(stringsDeep);
  return [];
}

/** The packet with every blockquote (an exact source quotation) removed. */
const packetProse = packet
  .split("\n")
  .filter((line) => !line.trimStart().startsWith(">"))
  .join("\n");
const packetQuotations = packet
  .split("\n")
  .filter((line) => line.trimStart().startsWith(">"))
  .map((line) => line.trimStart().replace(/^>\s?/, ""))
  .filter((line) => line.length > 0);

/* ------------------------------------------------------------------ manifest */

describe("Round 1 human review manifest", () => {
  it("parses and names exactly the eight Round 1 criteria, awaiting human review", () => {
    expect(humanReviewRoundSchema.safeParse(roundJson).success).toBe(true);
    expect(round).toMatchObject({
      record_kind: "human_review_round",
      round: 1,
      status: "awaiting_human_review",
      packet: "docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md",
    });
    expect(candidates.map((candidate) => candidate.criterion_id)).toEqual(ROUND_1_IDS);
  });

  it("carries no reviewer, decision, review date, or verification status anywhere", () => {
    const forbidden = [
      "reviewer",
      "reviewed_at",
      "reviewed_by",
      "approved",
      "approval",
      "decision",
      "verified_at",
      "verification",
      "human_verification",
    ];
    const keys = new Set(keysDeep(roundJson));
    for (const key of forbidden) expect(keys.has(key), key).toBe(false);
    for (const value of stringsDeep(roundJson)) expect(value).not.toBe("human_verified");

    const [first] = roundJson.candidates;
    const variants: Array<[string, unknown]> = [
      ["a reviewer", { ...roundJson, reviewer: { kind: "human", name: "Any Person", role: "Reviewer" } }],
      ["a review date", { ...roundJson, reviewed_at: "2026-09-28" }],
      ["an approval", { ...roundJson, approved: true }],
      ["a human_verified status", { ...roundJson, status: "human_verified" }],
      ["an approved status", { ...roundJson, status: "approved" }],
      ["a candidate reviewer", { ...roundJson, candidates: [{ ...first, reviewer: "Claude" }] }],
      ["a candidate decision", { ...roundJson, candidates: [{ ...first, decision: "APPROVE EXACTLY AS WRITTEN" }] }],
      ["a candidate verification", { ...roundJson, candidates: [{ ...first, verification: "human_verified" }] }],
    ];
    for (const [name, value] of variants) {
      expect(humanReviewRoundSchema.safeParse(value).success, name).toBe(false);
    }
  });

  it("records each criterion's shipped pinpoint, ceiling, facts, and proposal component unchanged", () => {
    for (const candidate of candidates) {
      const criterion = criterionFor(candidate.criterion_id);
      expect(candidate.current_pinpoint, candidate.criterion_id).toBe(criterion.citation.pinpoint);
      expect(candidate.current_outcome_ceiling, candidate.criterion_id).toEqual([...criterion.permitted_outcomes]);
      expect(candidate.facts.map((fact) => fact.fact_key), candidate.criterion_id).toEqual([...criterion.fact_keys]);
      for (const fact of candidate.facts) {
        const spec = programFactSpecs[fact.fact_key];
        expect(fact.data_class, fact.fact_key).toBe(spec.data_class);
        expect(fact.value, fact.fact_key).toEqual(spec.value);
      }
      const proposal = proposals[candidate.proposal_file];
      expect(proposal, candidate.proposal_file).toBeDefined();
      expect(
        proposal.candidate_components.map((component) => component.component_id),
        candidate.criterion_id,
      ).toContain(candidate.criterion_id);
      expect(criterion.citation.url).toBe(captures[candidate.source.source_id].metadata.official_url);
    }
  });

  it("uses no conclusion language outside attributed source quotations", () => {
    for (const candidate of candidates) {
      const capture = captures[candidate.source.source_id];
      for (const text of ownText(candidate)) {
        const quoted = quotedSegments(text);
        for (const segment of quoted) {
          expect(excerptAppearsInCapture(segment, capture.extracted), `${candidate.criterion_id}: “${segment}”`).toBe(true);
        }
        expect(findProhibitedClientLanguage(text, quoted), `${candidate.criterion_id}: ${text}`).toEqual([]);
      }
    }
    for (const text of ownText({ ...roundJson, candidates: [] })) {
      expect(findProhibitedClientLanguage(text, quotedSegments(text)), text).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------------ 1 */

describe("1. No Round 1 criterion becomes human_verified because this packet exists", () => {
  it("keeps every Round 1 criterion pending_human, without a record, and release-blocking", () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: AS_OF });
    for (const id of ROUND_1_IDS) {
      const criterion = criterionFor(id);
      expect(criterion, id).toMatchObject({ verification: "pending_human", human_verification: null });
      expect(criterionAwaitsHumanVerification(criterion), id).toBe(true);
      expect(result.release.blockers).toContainEqual(
        expect.objectContaining({ code: "pending_human_criterion", ref: id }),
      );
    }
  });

  it("leaves 0 human-verified and 46 pending_human criteria", () => {
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(shipped.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
    expect(humanVerificationRequiredCriterionIds).toHaveLength(46);
  });

  it("ticks exactly one decision per candidate in the packet, matching the decisions record", () => {
    const boxLabel: Record<string, string> = {
      approve_as_written: "APPROVE EXACTLY AS WRITTEN",
      approve_with_revision: "APPROVE WITH EDIT",
      keep_pending: "KEEP PENDING",
    };
    expect(packet.match(/^- \[x\] /gm)).toHaveLength(ROUND_1_IDS.length);
    expect(packet.match(/^- \[ \] /gm)).toHaveLength(3 * ROUND_1_IDS.length);
    expect(packet).not.toMatch(/\[X\]/);
    const sections = packet.split(/^(?=### \d+\. `)/m).slice(1);
    expect(sections).toHaveLength(ROUND_1_IDS.length);
    decisions.decisions.forEach((entry, index) => {
      const section = sections[index];
      expect(section.split("\n", 1)[0], entry.criterion_id).toContain(`\`${entry.criterion_id}\``);
      expect(section.match(/^- \[x\] (.+)$/gm), entry.criterion_id).toEqual([`- [x] ${boxLabel[entry.decision]}`]);
      expect(section).toContain(`section ${entry.letter}.`);
      expect(section).not.toContain("____________________________");
    });
  });
});

/* ------------------------------------------------------------------------ 2 */

describe("2. No Round 1 criterion gains a production rule because this packet exists", () => {
  it("keeps every Round 1 rule not_encoded", () => {
    for (const id of ROUND_1_IDS) expect(criterionFor(id).predicate, id).toBe("not_encoded");
  });

  it("leaves the executable production predicates exactly as before", () => {
    const executable = shipped
      .filter((criterion) => typeof criterion.predicate === "function" && !criterionAwaitsHumanVerification(criterion))
      .map((criterion) => criterion.id);
    expect(executable).toEqual([
      "la_shra.parcel-match",
      "la_shra.jurisdiction",
      "la_shra.implementation-memo-scope",
      "la_sb79.parcel-match",
      "la_sb79.jurisdiction",
      "la_low_rise.parcel-match",
      "la_low_rise.jurisdiction",
    ]);
  });

  it("returns no result from any Round 1 criterion even when every fact documents the blocking case", () => {
    const blocking: Partial<Record<ProgramFactKey, Value>> = {
      "shra-zone-category": "single_family_listed_zone",
      "lot-area": 100_000,
      "prior-shra-or-sb9-map": "shra_map_recorded",
      "very-high-fire-hazard-severity-zone": true,
      "high-fire-hazard-severity-zone": true,
      "prime-or-statewide-farmland": true,
      "nccp-conservation-land": true,
      "conservation-easement": true,
      "sb79-permanent-exemption-shown": true,
    };
    const result = evaluateProgramScreen({ evidence_records: [...anchors(), ...valuesRecords(blocking)], as_of: AS_OF });
    const statuses = new Map(result.pathways.flatMap((pathway) => pathway.criteria).map((c) => [c.criterion_id, c]));
    for (const id of ROUND_1_IDS) {
      expect(statuses.get(id), id).toMatchObject({ status: "unreviewed", unreviewed_reasons: ["criterion_pending_human"] });
    }
    expect(result.counts.criteria.disqualifying_per_source).toBe(0);
    expect(result.pathways.map((pathway) => pathway.rollup)).not.toContain("documented_disqualifier");
  });

  it("leaves the fictional fixture's Round 1 results as the fixture pins them", () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: AS_OF });
    const statuses = Object.fromEntries(
      result.pathways.flatMap((pathway) => pathway.criteria).map((c) => [c.criterion_id, c.status]),
    );
    const expected = fixtureJson.expected.criterion_statuses as Record<string, string>;
    for (const id of ROUND_1_IDS) expect(statuses[id], id).toBe(expected[id]);
    expect(statuses).toEqual(expected);
  });
});

/* ------------------------------------------------------------------------ 3 */

/** Resolves a relative import from a glob key ("../src/.../x.ts") to another glob key. */
function resolveImport(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  const base = parts.join("/");
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (candidate in sourceFiles) return candidate;
  }
  return base;
}

function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const pending = [entry];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = sourceFiles[file];
    if (source === undefined) continue;
    for (const match of source.matchAll(pattern)) pending.push(resolveImport(file, match[1]));
  }
  return seen;
}

describe("3. Review manifests are never imported by the evaluator", () => {
  const entries = ["../src/shared/program-screen/evaluate.ts", "../src/shared/program-screen/public-demo.ts"];

  it("follows every import from the evaluator and the public demo without reaching a review file", () => {
    for (const entry of entries) {
      expect(entry in sourceFiles, entry).toBe(true);
      const graph = [...importGraph(entry)];
      // The walk is real: it reaches the criteria and the fact schemas.
      expect(graph).toContain("../src/shared/program-screen/criteria/shra.ts");
      expect(graph).toContain("../src/shared/program-screen/facts.ts");
      for (const file of graph) {
        expect(file, entry).not.toMatch(/proposed-verification|human-review-rounds|proposed-verifications|\.json$|\.md$/);
      }
    }
  });

  it("keeps every production source file free of any reference to a review round", () => {
    expect(Object.keys(sourceFiles).length).toBeGreaterThan(20);
    for (const [path, source] of Object.entries(sourceFiles)) {
      if (path.endsWith("/program-screen/proposed-verification.ts")) continue;
      expect(source, path).not.toMatch(
        /human-review-rounds|round-1\.json|round-1-decisions|HUMAN_REVIEW_ROUND|HUMAN_REVIEW_DECISIONS|humanReviewRound|humanReviewDecision|candidateRuleOutcome|PROGRAM_SCREEN_HUMAN_REVIEW/,
      );
      expect(source, path).not.toMatch(/proposed-verification/);
    }
  });
});

/* ------------------------------------------------------------------------ 4 */

describe("4. SB 79 permanent exemption: not shown cannot clear the pathway", () => {
  const candidate = candidateFor(SB79_PERMANENT);

  it("proposes no clearing direction", () => {
    expect(candidate.classification).toBe("block_only");
    expect(candidate.proposed_outcome_ceiling).toEqual(["disqualifying_per_source", "requires_judgment"]);
    expect(candidate.candidate_rule.cases.map((ruleCase) => ruleCase.outcome)).not.toContain("consistent_with_source");
    expect(candidateRuleOutcome(candidate.candidate_rule, { "sb79-permanent-exemption-shown": false })).toBe(
      "requires_judgment",
    );
    expect(candidateRuleOutcome(candidate.candidate_rule, { "sb79-permanent-exemption-shown": true })).toBe(
      "disqualifying_per_source",
    );
    expect(candidate.direction_safety.consistent.safe).toBe(false);
  });

  it("leaves the pathway undetermined when the parcel is not shown, even with the proposed rule running", () => {
    const { copy } = runnableCandidate(SB79_PERMANENT);
    const notShown = screenWith(copy, [evidence("s", "sb79-permanent-exemption-shown", false)]);
    expect(notShown.criterion.status).toBe("professional");
    expect(notShown.pathway.rollup).toBe("undetermined");
    expect(notShown.pathway.rollup).not.toBe("no_disqualifier_found_in_reviewed_sources");

    const shown = screenWith(copy, [evidence("s", "sb79-permanent-exemption-shown", true)]);
    expect(shown.criterion.status).toBe("disqualifying_per_source");
    expect(shown.pathway.rollup).toBe("documented_disqualifier");
  });

  it("never clears with the shipped criterion either", () => {
    const result = evaluateProgramScreen({
      evidence_records: [...anchors(), evidence("s", "sb79-permanent-exemption-shown", false)],
      as_of: AS_OF,
    });
    const sb79 = result.pathways.find((pathway) => pathway.pathway === "la_sb79");
    expect(sb79?.criteria.find((c) => c.criterion_id === SB79_PERMANENT)?.status).toBe("unreviewed");
    expect(sb79?.rollup).not.toBe("no_disqualifier_found_in_reviewed_sources");
  });

  it("rejects a rule that tries to clear on not shown, in the evaluator and in the manifest", () => {
    const { copy } = runnableCandidate(SB79_PERMANENT);
    const clearing = { ...copy, predicate: () => "consistent_with_source" as const };
    expectValidationCode(
      () => run(clearing, [evidence("s", "sb79-permanent-exemption-shown", false)]),
      "PREDICATE_OUTCOME_NOT_PERMITTED",
    );
    const sb79 = roundJson.candidates.find((c) => c.criterion_id === SB79_PERMANENT) as (typeof roundJson.candidates)[number];
    const inverted = {
      ...sb79,
      proposed_outcome_ceiling: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      candidate_rule: {
        ...sb79.candidate_rule,
        cases: [
          sb79.candidate_rule.cases[0],
          { when: [{ fact_key: "sb79-permanent-exemption-shown", equals: false }], outcome: "consistent_with_source" },
        ],
      },
    };
    expect(
      humanReviewRoundSchema.safeParse({ ...roundJson, candidates: [inverted] }).success,
      "a clearing case outside the shipped ceiling",
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------------ 5 */

describe("5. SB 79 temporary-exemption criteria remain non-blocking", () => {
  const temporary = humanVerificationRequiredCriterionIds.filter((id) => id.startsWith("la_sb79.temporary-exemption"));

  it("keeps every temporary-exemption criterion out of the round and below blocking", () => {
    expect(temporary).toHaveLength(8);
    for (const id of temporary) {
      expect(candidates.map((candidate) => candidate.criterion_id)).not.toContain(id);
      expect(criterionFor(id).permitted_outcomes, id).not.toContain("disqualifying_per_source");
      expect(criterionFor(id).predicate, id).not.toBeTypeOf("function");
    }
    expect(round.not_in_this_round.map((entry) => entry.topic).join(" ")).toContain(
      "la_sb79.temporary-exemption-all-parcels",
    );
  });

  it("refuses a temporary-exemption criterion as a review candidate", () => {
    const sb79 = roundJson.candidates.find((c) => c.criterion_id === SB79_PERMANENT) as (typeof roundJson.candidates)[number];
    for (const id of temporary) {
      const swapped = { ...sb79, criterion_id: id };
      expect(humanReviewRoundSchema.safeParse({ ...roundJson, candidates: [swapped] }).success, id).toBe(false);
    }
  });

  it("draws no SB 79 blocker from temporary-exemption facts, with the Round 1 rule running on not shown", () => {
    const { copy } = runnableCandidate(SB79_PERMANENT);
    const sb79Criteria = programScreenPathwayPacks[1].criteria.map((criterion) =>
      criterion.id === SB79_PERMANENT ? copy : criterion,
    );
    const result = evaluateProgramScreen({
      evidence_records: [
        ...anchors(),
        evidence("p", "sb79-permanent-exemption-shown", false),
        evidence("t1", "sb79-temporary-exemption-shown", true),
        evidence("t2", "seventh-housing-element-revision-adopted", false),
        evidence("t3", "tod-alternative-plan-area", true),
        evidence("t4", "very-high-fire-hazard-severity-zone", true),
        evidence("t5", "state-responsibility-area", true),
        evidence("t6", "sb79-sea-level-rise-vulnerability", true),
        evidence("t7", "hcm-or-hpoz-designated-by-2025-01-01", true),
      ],
      as_of: AS_OF,
      packs: [{ pathway: sb79Pathway, criteria: sb79Criteria }],
    });
    const [sb79] = result.pathways;
    for (const id of temporary) {
      expect(["unreviewed", "professional"], id).toContain(sb79.criteria.find((c) => c.criterion_id === id)?.status);
    }
    expect(sb79.rollup).not.toBe("documented_disqualifier");
    expect(result.counts.criteria.disqualifying_per_source).toBe(0);
  });
});

/* ------------------------------------------------------------------------ 6 */

describe("6. Proposed rule outcomes stay within each criterion's current ceiling", () => {
  it("pins each candidate's classification and proposed ceiling", () => {
    expect(
      Object.fromEntries(candidates.map((c) => [c.criterion_id, [c.classification, ...c.proposed_outcome_ceiling]])),
    ).toEqual({
      "la_shra.single-family-lot-area-threshold": ["both_directions_safe", "consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.prior-shra-or-sb9-map": ["both_directions_safe", "consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.very-high-fire-hazard-severity-zone": ["both_directions_safe", "consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.high-fire-hazard-severity-zone": ["both_directions_safe", "consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.prime-or-statewide-farmland": ["block_only", "disqualifying_per_source", "requires_judgment"],
      "la_shra.natural-community-conservation-plan-land": ["block_only", "disqualifying_per_source", "requires_judgment"],
      "la_shra.conservation-easement": ["block_only", "disqualifying_per_source", "requires_judgment"],
      "la_sb79.permanent-exemption-shown": ["block_only", "disqualifying_per_source", "requires_judgment"],
    });
  });

  it("keeps every proposed outcome inside the shipped ceiling", () => {
    for (const candidate of candidates) {
      const ceiling = criterionFor(candidate.criterion_id).permitted_outcomes;
      for (const outcome of candidate.proposed_outcome_ceiling) expect(ceiling, candidate.criterion_id).toContain(outcome);
      for (const ruleCase of candidate.candidate_rule.cases) {
        expect(candidate.proposed_outcome_ceiling, candidate.criterion_id).toContain(ruleCase.outcome);
      }
    }
  });

  it.each(ROUND_1_IDS)("maps every established value of %s to exactly one permitted outcome", (id) => {
    const { candidate, copy, spy } = runnableCandidate(id);
    const rows = combinations(copy.fact_keys);
    expect(rows.length).toBeGreaterThan(1);
    for (const values of rows) {
      const outcome = candidateRuleOutcome(candidate.candidate_rule, values);
      expect(candidate.proposed_outcome_ceiling, JSON.stringify(values)).toContain(outcome);
      // The evaluator accepts it under the shipped ceiling and reports it unchanged.
      expect(run(copy, valuesRecords(values)).status, JSON.stringify(values)).toBe(statusFor(outcome));
    }
    expect(spy).toHaveBeenCalledTimes(rows.length);
  });

  it("puts the 1.5-acre boundary at 65,340 sq ft, strictly under", () => {
    const rule = candidateFor("la_shra.single-family-lot-area-threshold").candidate_rule;
    const listed = { "shra-zone-category": "single_family_listed_zone" };
    expect(candidateRuleOutcome(rule, { ...listed, "lot-area": 65339.99 })).toBe("consistent_with_source");
    expect(candidateRuleOutcome(rule, { ...listed, "lot-area": 65340 })).toBe("disqualifying_per_source");
    expect(candidateRuleOutcome(rule, { "shra-zone-category": "zone_not_on_single_family_list", "lot-area": 1 })).toBe(
      "requires_judgment",
    );
    expect(1.5 * 43_560).toBe(65_340);
  });

  it("rejects a candidate whose ceiling, rule, or classification disagree", () => {
    const [lot, , , , farmland] = roundJson.candidates;
    const variants: Array<[string, unknown]> = [
      ["a ceiling wider than the shipped ceiling", { ...farmland, current_outcome_ceiling: ["disqualifying_per_source", "requires_judgment"], proposed_outcome_ceiling: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"] }],
      ["a ceiling without judgment", { ...lot, proposed_outcome_ceiling: ["consistent_with_source", "disqualifying_per_source"] }],
      ["a ceiling wider than the rule", { ...farmland, proposed_outcome_ceiling: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"] }],
      ["a block-only candidate that clears", { ...lot, classification: "block_only" }],
      ["a rule reading a fact it does not review", {
        ...farmland,
        candidate_rule: { ...farmland.candidate_rule, cases: [{ when: [{ fact_key: "wetlands", equals: true }], outcome: "disqualifying_per_source" }, farmland.candidate_rule.cases[1]] },
      }],
    ];
    for (const [name, value] of variants) {
      expect(humanReviewRoundSchema.safeParse({ ...roundJson, candidates: [value] }).success, name).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------------ 7 */

describe("7. Every review excerpt exists in the pinned official capture", () => {
  it("finds every rule and context excerpt on its stated page of an operative capture", () => {
    for (const candidate of candidates) {
      expect(humanReviewCaptureIssues(candidate, captures), candidate.criterion_id).toEqual([]);
    }
  });

  it("rejects an invented excerpt, an excerpt on the wrong page, and an uncaptured source", () => {
    const lot = candidateFor("la_shra.single-family-lot-area-threshold");
    expect(
      humanReviewCaptureIssues({ ...lot, excerpts: [{ page: 2, text: "Single-family zoned lots must be under 2 acres." }] }, captures),
    ).toEqual(["An excerpt does not appear in shra-2025-10-28."]);
    expect(humanReviewCaptureIssues({ ...lot, excerpts: [{ ...lot.excerpts[0], page: 3 }] }, captures)).toEqual([
      "An excerpt is not on page 3 of shra-2025-10-28.",
    ]);
    expect(
      humanReviewCaptureIssues({ ...lot, source: { ...lot.source, source_id: "ordinance-000000" } }, captures),
    ).toEqual(["ordinance-000000 is not captured."]);
  });

  it("keeps the fire excerpt exactly as captured and records the 42021 text-layer discrepancy", () => {
    for (const id of ["la_shra.very-high-fire-hazard-severity-zone", "la_shra.high-fire-hazard-severity-zone"]) {
      const candidate = candidateFor(id);
      expect(candidate.excerpts.map((excerpt) => excerpt.text).join(" "), id).toContain("Public Resources Code Section 42021.");
      expect(candidate.text_layer_check.discrepancies, id).toEqual([
        expect.objectContaining({ page: 4, text_layer_reads: "Public Resources Code Section 42021.", in_rule_excerpt: true }),
      ]);
    }
    expect(candidateFor(SB79_PERMANENT).text_layer_check.discrepancies).toEqual([
      expect.objectContaining({ page: 5, in_rule_excerpt: false }),
    ]);
  });

  it("quotes the packet only from operative captures, and matches the manifest candidate for candidate", () => {
    expect(packetQuotations.length).toBeGreaterThan(50);
    for (const line of packetQuotations) {
      expect(operativeCaptures.some((capture) => excerptAppearsInCapture(line, capture.extracted)), line).toBe(true);
    }
    for (const segment of quotedSegments(packetProse)) {
      expect(operativeCaptures.some((capture) => excerptAppearsInCapture(segment, capture.extracted)), segment).toBe(true);
    }
    const normalized = normalizeSourceText(packet);
    for (const candidate of candidates) {
      expect(packet).toContain(`\`${candidate.criterion_id}\``);
      for (const text of [
        ...candidate.excerpts.map((excerpt) => excerpt.text),
        ...candidate.context_excerpts.map((excerpt) => excerpt.text),
        candidate.candidate_rule.pseudocode,
        candidate.candidate_rule.plain_english,
        ...candidate.review_questions,
        ...candidate.what_could_make_it_wrong,
      ]) {
        expect(normalized, `${candidate.criterion_id}: ${text}`).toContain(normalizeSourceText(text));
      }
    }
  });

  it("uses no conclusion language in the packet outside attributed source quotations", () => {
    expect(findProhibitedClientLanguage(packetProse, quotedSegments(packetProse))).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ 8 */

describe("8. Every source hash matches", () => {
  it("pins each candidate to its capture's extracted text by SHA-256", async () => {
    for (const candidate of candidates) {
      const capture = captures[candidate.source.source_id];
      expect(candidate.source.source_sha256, candidate.criterion_id).toBe(capture.metadata.sha256_extracted);
      expect(await sha256Hex(capture.extracted), candidate.criterion_id).toBe(candidate.source.source_sha256);
      expect(candidate.source).toMatchObject({
        source_type: capture.metadata.source_type,
        operative_status: capture.metadata.operative_status,
      });
    }
  });

  it("reports a hash that does not pin the captured text", () => {
    const lot = candidateFor("la_shra.single-family-lot-area-threshold");
    const wrong = { ...lot, source: { ...lot.source, source_sha256: captures["shra-2025-10-28"].metadata.sha256_original } };
    expect(humanReviewCaptureIssues(wrong, captures)).toEqual(["source_sha256 does not pin the captured extracted text."]);
  });
});

/* ------------------------------------------------------------------------ 9 */

describe("9. Draft Low-Rise material cannot support any Round 1 rule", () => {
  it("rests no candidate or quotation on the draft", () => {
    const draft = captures[DRAFT_ID];
    expect(draft.metadata).toMatchObject({ source_type: "proposed_draft", operative_status: "proposed_not_operative" });
    expect(canSupportCriterionRule(draft.metadata)).toBe(false);
    for (const candidate of candidates) {
      expect(candidate.source.source_id).not.toBe(DRAFT_ID);
      for (const excerpt of candidate.context_excerpts) expect(excerpt.source_id).not.toBe(DRAFT_ID);
      for (const excerpt of [...candidate.excerpts, ...candidate.context_excerpts]) {
        expect(excerptAppearsInCapture(excerpt.text, draft.extracted), excerpt.text).toBe(false);
      }
    }
  });

  it("refuses the draft as a candidate source or as quoted context", () => {
    const [lot] = roundJson.candidates;
    const asSource = { ...lot, source: { ...lot.source, source_id: DRAFT_ID } };
    const asContext = { ...lot, context_excerpts: [{ ...lot.context_excerpts[0], source_id: DRAFT_ID }] };
    for (const value of [asSource, asContext]) {
      expect(humanReviewRoundSchema.safeParse({ ...roundJson, candidates: [value] }).success).toBe(false);
    }
    const parsedLot = candidateFor(lot.criterion_id);
    expect(
      humanReviewCaptureIssues({ ...parsedLot, source: { ...parsedLot.source, source_id: DRAFT_ID } }, captures),
    ).toContain("A proposed_draft recorded as proposed_not_operative cannot support a rule.");
    expect(
      humanReviewCaptureIssues(
        { ...parsedLot, context_excerpts: [{ ...parsedLot.context_excerpts[0], source_id: DRAFT_ID }] },
        captures,
      ),
    ).toEqual([`${DRAFT_ID} cannot support a rule; it cannot be quoted as review context.`]);
  });
});

/* ----------------------------------------------------------------------- 10 */

describe("10. Missing facts remain unknown", () => {
  it.each(ROUND_1_IDS)("keeps %s unknown, without running the proposed rule, when a fact is missing", (id) => {
    const { copy, spy } = runnableCandidate(id);
    const [values] = combinations(copy.fact_keys);
    for (const key of copy.fact_keys) {
      const present = Object.fromEntries(Object.entries(values).filter(([candidate]) => candidate !== key));
      expect(run(copy, valuesRecords(present)).status, key).toBe("unknown");
      const lookup = [...valuesRecords(present), evidence("lookup", key, null)];
      expect(run(copy, lookup).status, `${key} lookup attempt`).toBe("unknown");
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the pathway undetermined when a missing fact is the only open item", () => {
    const { copy } = runnableCandidate("la_shra.very-high-fire-hazard-severity-zone");
    const { criterion, pathway } = screenWith(copy, []);
    expect(criterion.status).toBe("unknown");
    expect(criterion.statement).toContain("missing evidence is not treated as a no");
    expect(pathway.rollup).toBe("undetermined");
  });
});

/* ----------------------------------------------------------------------- 11 */

describe("11. Conflicting evidence still outranks the proposed rule", () => {
  it.each(ROUND_1_IDS)("keeps %s in conflict, without running the proposed rule, when sources disagree", (id) => {
    const { copy, spy } = runnableCandidate(id);
    const rows = combinations(copy.fact_keys);
    const [first, second] = [rows[0], rows.find((row) => row[copy.fact_keys[0]] !== rows[0][copy.fact_keys[0]])];
    const conflicting = [
      ...valuesRecords(first),
      evidence("second-source", copy.fact_keys[0], second?.[copy.fact_keys[0]] as Value, { agency: "Second fictional City source" }),
    ];
    expect(run(copy, conflicting).status).toBe("conflict");
    const { pathway } = screenWith(copy, conflicting);
    expect(pathway.rollup).toBe("contested");
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the fixture's Very High conflict contested with the Round 1 rule swapped in", () => {
    const { copy, spy } = runnableCandidate("la_shra.very-high-fire-hazard-severity-zone");
    const pack: ProgramPathwayPack = {
      pathway: shraPack.pathway,
      criteria: shraPack.criteria.map((criterion) =>
        criterion.id === "la_shra.very-high-fire-hazard-severity-zone" ? copy : criterion,
      ),
    };
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: AS_OF, packs: [pack] });
    const [shra] = result.pathways;
    expect(shra.criteria.find((criterion) => criterion.criterion_id === copy.id)?.status).toBe("conflict");
    expect(shra.rollup).toBe("contested");
    expect(spy).not.toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------------------- 12 */

describe("12. No retired broad criterion is reintroduced", () => {
  it("names only atomic criteria and current facts, each carried by the retired criterion it replaced", () => {
    for (const candidate of candidates) {
      expect(retiredProgramCriterionIds as readonly string[]).not.toContain(candidate.criterion_id);
      for (const fact of candidate.facts) expect(retiredProgramFactKeys as readonly string[]).not.toContain(fact.fact_key);
      const retired = candidate.proposal_file.replace(/\.json$/, "") as keyof typeof retiredProgramCriteria;
      expect(retiredProgramCriteria[retired]?.replaced_by, candidate.criterion_id).toContain(candidate.criterion_id);
    }
    for (const id of retiredProgramCriterionIds) expect(byId.has(id), id).toBe(false);
  });

  it("refuses a retired criterion ID as a candidate or as a shipped criterion", () => {
    const [lot] = roundJson.candidates;
    for (const id of retiredProgramCriterionIds) {
      expect(
        humanReviewRoundSchema.safeParse({ ...roundJson, candidates: [{ ...lot, criterion_id: id }] }).success,
        id,
      ).toBe(false);
      const reused = { ...criterionFor(lot.criterion_id), id, pathway: id.split(".")[0] };
      expect(programCriterionSchema.safeParse(reused).success, id).toBe(false);
    }
  });
});

/* --------------------------------------------------------- Round 1 decisions */

/** The decisions document with every fenced verbatim block removed. */
const decisionsProse = decisionsDoc.replace(/^```text\n[\s\S]*?\n```$/gm, "");

describe("Round 1 decisions record", () => {
  const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const byLetter = new Map(decisions.decisions.map((entry) => [entry.letter, entry]));

  it("records the reviewer, the date, and one decision per Round 1 candidate, in packet order", () => {
    expect(humanReviewDecisionsSchema.safeParse(decisionsJson).success).toBe(true);
    expect(decisions).toMatchObject({
      round: 1,
      manifest: "app/fixtures/program-screen/human-review-rounds/round-1.json",
      packet: "docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1.md",
      decisions_doc: "docs/PROGRAM_SCREEN_HUMAN_REVIEW_ROUND_1_DECISIONS.md",
      reviewer: { kind: "human", name: "Sergio Mata", role: "Project Owner / Human Reviewer" },
      decided_on: "2026-09-27",
      promoted_in_this_round: [],
    });
    expect(decisions.decisions.map((entry) => entry.letter)).toEqual(LETTERS);
    expect(decisions.decisions.map((entry) => entry.criterion_id)).toEqual(ROUND_1_IDS);
  });

  it("pins the eight decisions and their tiers exactly as decided", () => {
    expect(Object.fromEntries(decisions.decisions.map((entry) => [entry.letter, [entry.decision, entry.tier]]))).toEqual({
      a: ["approve_with_revision", "gated_on_enforcement"],
      b: ["approve_with_revision", "gated_on_enforcement"],
      c: ["approve_with_revision", "gated_on_enforcement"],
      d: ["approve_with_revision", "gated_on_enforcement"],
      e: ["keep_pending", "pending_source_capture"],
      f: ["approve_with_revision", "gated_on_enforcement"],
      g: ["approve_with_revision", "gated_on_enforcement"],
      h: ["keep_pending", "pending_source_capture"],
    });
    for (const entry of decisions.decisions) {
      expect(entry.reviewer_text_verbatim.split("\n", 1)[0], entry.letter).toBe(humanReviewDecisionLabels[entry.decision]);
      expect(entry.source_proposition_accepted, entry.letter).toBe(true);
    }
    // a and b were moved to the gated tier by a separate decision, recorded verbatim.
    expect(decisions.decisions.filter((entry) => entry.promotion_tier_text_verbatim !== null).map((entry) => entry.letter)).toEqual([
      "a",
      "b",
    ]);
    expect(byLetter.get("a")?.promotion_tier_text_verbatim).toContain("Do not promote it in Round 1.");
    expect(byLetter.get("b")?.promotion_tier_text_verbatim).toContain("Confirm Tier 2 / gated.");
  });

  it("pins every gate that must be met before any Round 1 criterion can become human_verified", () => {
    const base = ["reviewer_confirms_encoded_rule", "human_verification_record"];
    const provenance = "evidence_provenance_enforced_or_fails_closed";
    expect(Object.fromEntries(decisions.decisions.map((entry) => [entry.letter, entry.promotion_gates]))).toEqual({
      a: ["lot_area_precision_fails_closed", "legal_lot_identity_fails_closed", "r1_variation_zone_fails_closed", "chapter_1a_fails_closed", provenance, ...base],
      b: ["map_history_completeness_fails_closed", "legal_lot_identity_fails_closed", "applicable_law_fails_closed", "search_completeness_fails_closed", ...base],
      c: [provenance, "map_identity_and_edition_recorded", ...base],
      d: [provenance, "map_identity_and_edition_recorded", "responsibility_area_and_legend_recorded", ...base],
      e: ["defining_official_source_captured", provenance, ...base],
      f: [provenance, "adopted_plan_identity_adoption_and_map_date_recorded", ...base],
      g: [provenance, "instrument_identity_in_force_status_and_coverage_recorded", ...base],
      h: ["directors_section_3_map_captured", ...base],
    });
    for (const letter of ["c", "d", "f", "g"]) expect(byLetter.get(letter)?.promotion_gates, letter).toContain(provenance);
    expect(byLetter.get("b")?.completed_in_this_change).toEqual(["prior_shra_or_sb9_map_fact_comment_rewritten"]);
  });

  it("promotes nothing: every Round 1 criterion stays pending_human, without a rule, at the same ceiling", () => {
    for (const entry of decisions.decisions) {
      const criterion = criterionFor(entry.criterion_id);
      expect(entry, entry.letter).toMatchObject({ status_after_review: "pending_human", outcome_ceiling_changed: false });
      expect(criterion, entry.letter).toMatchObject({ verification: "pending_human", human_verification: null, predicate: "not_encoded" });
      expect(criterion.permitted_outcomes, entry.letter).toEqual(candidateFor(entry.criterion_id).current_outcome_ceiling);
    }
    expect(shipped.filter((criterion) => criterion.verification === "human_verified")).toEqual([]);
    expect(shipped.filter((criterion) => criterion.verification === "pending_human")).toHaveLength(46);
  });

  it("keeps the reviewer's texts verbatim in the decisions document", () => {
    for (const entry of decisions.decisions) {
      expect(decisionsDoc, entry.letter).toContain(`\`\`\`text\n${entry.reviewer_text_verbatim}\n\`\`\``);
      if (entry.promotion_tier_text_verbatim !== null) {
        expect(decisionsDoc, entry.letter).toContain(`\`\`\`text\n${entry.promotion_tier_text_verbatim}\n\`\`\``);
      }
      expect(decisionsDoc).toContain(`## ${entry.letter}. \`${entry.criterion_id}\`: ${humanReviewDecisionLabels[entry.decision]}`);
    }
    expect(decisionsDoc).toContain(`\`\`\`text\n${decisions.phase_constraints_verbatim}\n\`\`\``);
    expect(decisions.phase_constraints_verbatim).toContain("human_verified must remain 0");
  });

  it("names the reviewer only as recorded, and uses no conclusion language outside the verbatim texts", () => {
    expect(decisionsDoc).toContain("Decided 2026-09-27 by **Sergio Mata, Project Owner / Human Reviewer**.");
    for (const text of [decisionsProse, packetProse]) {
      expect(text).not.toMatch(/\b(?:attorney|counsel|lawyer|planner|subject[- ]matter expert)\b/i);
    }
    for (const segment of quotedSegments(decisionsProse)) {
      expect(operativeCaptures.some((capture) => excerptAppearsInCapture(segment, capture.extracted)), segment).toBe(true);
    }
    expect(findProhibitedClientLanguage(decisionsProse, quotedSegments(decisionsProse))).toEqual([]);
  });

  it("rejects a decisions record that promotes, drops a gate, or misstates a decision", () => {
    const [first, ...rest] = decisionsJson.decisions;
    const withEntry = (entry: unknown) => ({ ...decisionsJson, decisions: [entry, ...rest] });
    const variants: Array<[string, unknown]> = [
      ["a promoted criterion", { ...decisionsJson, promoted_in_this_round: [first.criterion_id] }],
      ["a human_verified status", withEntry({ ...first, status_after_review: "human_verified" })],
      ["a verification field", withEntry({ ...first, verification: "human_verified" })],
      ["a changed ceiling", withEntry({ ...first, outcome_ceiling_changed: true })],
      ["a dropped reviewer-confirmation gate", withEntry({ ...first, promotion_gates: first.promotion_gates.filter((gate) => gate !== "reviewer_confirms_encoded_rule") })],
      ["a dropped human-verification gate", withEntry({ ...first, promotion_gates: first.promotion_gates.filter((gate) => gate !== "human_verification_record") })],
      ["an unknown gate", withEntry({ ...first, promotion_gates: [...first.promotion_gates, "reviewer_said_so"] })],
      ["a text that opens with another decision", withEntry({ ...first, decision: "approve_as_written" })],
      ["a kept-pending criterion in the gated tier", withEntry({ ...first, decision: "keep_pending", reviewer_text_verbatim: `KEEP PENDING\n${first.reviewer_text_verbatim}` })],
      ["an AI reviewer", { ...decisionsJson, reviewer: { kind: "ai", name: "Claude", role: "Preparer" } }],
      ["a duplicated criterion", { ...decisionsJson, decisions: [first, first, ...rest] }],
    ];
    for (const [name, value] of variants) {
      expect(humanReviewDecisionsSchema.safeParse(value).success, name).toBe(false);
    }
  });
});

/* -------------------------------------------------- no production output change */

describe("Round 1 leaves production output byte-identical", () => {
  // SHA-256 of the full JSON output before Round 1 (main at 4a4a092). A later,
  // separately reviewed promotion must update these pins deliberately.
  const EVALUATOR_OUTPUT_SHA256 = "2b0c6ea651dfc55191090ab0c6129a8c22692a28bfdce3f046425437e1acecca";
  const PUBLIC_DEMO_OUTPUT_SHA256 = "d00a74d195a2749da877775c0204a3435820fd13189f2ae05880b744ab45f57f";

  it("produces the same evaluator and public-demo output for the fictional fixture", async () => {
    const result = evaluateProgramScreen({ evidence_records: fixtureJson.evidence_records, as_of: fixtureJson.as_of });
    const demo = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixtureJson.as_of });
    expect(await sha256Hex(JSON.stringify(result))).toBe(EVALUATOR_OUTPUT_SHA256);
    expect(await sha256Hex(JSON.stringify(demo))).toBe(PUBLIC_DEMO_OUTPUT_SHA256);
  });
});
