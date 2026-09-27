import { describe, expect, it, vi } from "vitest";
import syntheticCapture from "../fixtures/program-screen/test-only-sources/synthetic-ordinance.txt?raw";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import {
  jurisdictionCriterion,
  parcelMatchCriterion,
} from "../src/shared/program-screen/criteria/common";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import {
  criterionAwaitsHumanVerification,
  hasCompleteHumanVerification,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import {
  excerptAppearsInCapture,
  humanRecordCaptureIssues,
  OFFICIAL_SOURCE_CAPTURE_DIR,
  sha256Hex,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  humanVerificationRequiredCriterionIds,
  type ProgramCriterion,
  type ProgramCriterionHumanVerification,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "../src/shared/program-screen/types";

const AS_OF = "2026-09-27";
const SUBJECT = {
  case_id: "case-fictional-program-screen-verification-test",
  property_id: "property-fictional-program-screen-verification-test",
};

/** Captured official-source text, keyed by repo path ("app/fixtures/..."). */
const officialCaptures: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).map(([path, text]) => [path.replace(/^\.\.\//, "app/"), text]),
);

/** Capture metadata, keyed by the repo path of the capture's extracted text. */
const officialCaptureMetadata: Record<string, OfficialSourceMetadata> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", {
      import: "default",
      eager: true,
    }) as Record<string, OfficialSourceMetadata>,
  ).map(([path, metadata]) => [
    path.replace(/^\.\.\//, "app/").replace(/metadata\.json$/, "extracted.txt"),
    metadata,
  ]),
);

/** Hosts whose text a shipped human-verified criterion may cite. */
const officialSourceHosts = [
  "cityclerk.lacity.org",
  "planning.lacity.gov",
  "leginfo.legislature.ca.gov",
];

function expectValidationCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected Program Screen validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

function evidence(
  id: string,
  key: ProgramFactKey,
  value: boolean | string,
  options: {
    reviewStatus?: CanonicalEvidenceRecord["review_status"];
    agency?: string;
  } = {},
): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: options.agency ?? "Fictional City source",
      title: `Fictional ${key} observation`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/program-screen-verification/${id}`,
      authority: "official",
      retrieved_at: "2026-09-18T12:00:00.000Z",
    },
    raw_observed_value: {
      kind: "text",
      value: typeof value === "boolean" ? (value ? "YES" : "NO") : value,
    },
    normalized_value:
      typeof value === "boolean" ? { kind: "boolean", value } : { kind: "text", value },
    evidence_type: "official_portal",
    classification: "source_observation",
    confidence: 99,
    conflicts_with: [],
    review_status: options.reviewStatus ?? "reviewed",
    notes: [],
    limitations: [],
    provenance: {
      source_record_id: `test-${id}`,
      capture_method: "manual_research",
      is_ai_generated: false,
    },
  };
}

function anchorEvidence(): CanonicalEvidenceRecord[] {
  return [
    evidence("t-parcel", "parcel-match", true),
    evidence("t-jurisdiction", "jurisdiction", "City of Los Angeles"),
  ];
}

function packFor(criterion: ProgramCriterion): ProgramPathwayPack {
  return {
    pathway: {
      id: criterion.pathway,
      label: "Synthetic verification test pathway",
      confirmer: "Los Angeles City Planning",
    },
    criteria: [
      parcelMatchCriterion(criterion.pathway),
      jurisdictionCriterion(criterion.pathway),
      criterion,
    ],
  };
}

/* ------------------------------------------ TEST-ONLY synthetic criterion */

const SYNTHETIC_CAPTURE_PATH =
  "app/fixtures/program-screen/test-only-sources/synthetic-ordinance.txt";
const SYNTHETIC_CAPTURE_SHA256 =
  "380a273a3e01638517f15cec8aff1f2d3ba6f494831db5aacf1d5539bceb1d0c";
const SYNTHETIC_EXCERPT =
  "A parcel mapped within a synthetic flood zone is excluded from the Synthetic Test Pathway.";

const syntheticCitation = {
  title: "TEST-ONLY Fictional Ordinance 000000",
  url: "https://records.example.test/program-screen-verification/fictional-ordinance-000000",
  pinpoint: "Sec. 99(a)",
  verified_at: "2026-09-20",
  volatility: "high",
  next_review_at: "2026-10-20",
} as const;

function syntheticVerification(): ProgramCriterionHumanVerification {
  return {
    reviewer: {
      kind: "human",
      name: "TEST-ONLY Fictional Reviewer",
      role: "Synthetic test fixture",
    },
    verified_at: syntheticCitation.verified_at,
    next_review_at: syntheticCitation.next_review_at,
    source_title: syntheticCitation.title,
    source_url: syntheticCitation.url,
    instrument: "Fictional Ordinance 000000",
    pinpoint: syntheticCitation.pinpoint,
    supporting_excerpt: SYNTHETIC_EXCERPT,
    source_capture: {
      repo_path: SYNTHETIC_CAPTURE_PATH,
      retrieved_at: "2026-09-19T17:00:00.000Z",
      capture_method: "manual_transcription",
      sha256: SYNTHETIC_CAPTURE_SHA256,
      is_ai_generated: false,
      source_type: "adopted_ordinance",
      operative_status: "operative",
    },
  };
}

/**
 * TEST-ONLY synthetic human-verified criterion. It exercises the verification
 * record and the verified-criterion checks; no shipped criterion encodes it.
 */
function syntheticVerifiedCriterion(
  predicate: ProgramCriterion["predicate"] = (facts) =>
    facts["special-flood-hazard-area"]?.kind === "boolean" && facts["special-flood-hazard-area"].value
      ? "disqualifying_per_source"
      : "consistent_with_source",
): ProgramCriterion {
  return {
    id: "la_shra.test-only-verified-flood",
    pathway: "la_shra",
    label: "TEST-ONLY synthetic human-verified criterion",
    gating: false,
    fact_keys: ["special-flood-hazard-area"],
    predicate,
    permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "TEST-ONLY synthetic rule: a mapped synthetic flood zone blocks the synthetic pathway.",
    citation: { ...syntheticCitation },
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Which record shows the synthetic flood-zone mapping for the parcel?",
    question_if_conflict: "Which record governs the synthetic flood-zone mapping for the parcel?",
    question_if_judgment: "How does Planning apply the synthetic rule to the parcel?",
    verification: "human_verified",
    human_verification: syntheticVerification(),
    basis: { repo_path: SYNTHETIC_CAPTURE_PATH, excerpts: [SYNTHETIC_EXCERPT] },
  };
}

/* --------------------------------------- verified-criterion test runner */

interface VerifiedCriterionCase {
  /** Reviewed evidence for exactly the criterion's facts, consistent with the source. */
  positive: () => CanonicalEvidenceRecord[];
  /** Reviewed evidence documenting the blocking condition, when the rule has one. */
  blocking: (() => CanonicalEvidenceRecord[]) | null;
  /** Captured text of the cited source, keyed by repo path. */
  captures: Readonly<Record<string, string>>;
}

function screen(criterion: ProgramCriterion, records: CanonicalEvidenceRecord[], asOf = AS_OF) {
  const result = evaluateProgramScreen({
    evidence_records: [...anchorEvidence(), ...records],
    as_of: asOf,
    packs: [packFor(criterion)],
  });
  return { result, pathway: result.pathways[0], criterion: result.pathways[0].criteria[2] };
}

/**
 * The checks every human-verified criterion must pass. Applied below to the
 * TEST-ONLY synthetic criterion and to every shipped human-verified criterion.
 */
function exerciseVerifiedCriterion(
  build: (predicate?: ProgramCriterion["predicate"]) => ProgramCriterion,
  testCase: VerifiedCriterionCase,
): void {
  const criterion = build();
  const spied = () => {
    const rule = criterion.predicate as Exclude<ProgramCriterion["predicate"], string>;
    const spy = vi.fn(rule);
    return { spy, criterion: build(spy) };
  };

  it("carries a complete human-verification record and runs its rule", () => {
    expect(programCriterionSchema.safeParse(criterion).success).toBe(true);
    expect(typeof criterion.predicate).toBe("function");
    expect(criterion.verification).toBe("human_verified");
    expect(criterion.human_verification?.reviewer.kind).toBe("human");
    expect(hasCompleteHumanVerification(criterion)).toBe(true);
    expect(criterionAwaitsHumanVerification(criterion)).toBe(false);
  });

  it("returns consistent_with_source for the exact positive case", () => {
    const { spy, criterion: spiedCriterion } = spied();
    const { result, pathway, criterion: evaluated } = screen(spiedCriterion, testCase.positive());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(evaluated).toMatchObject({
      status: "consistent_with_source",
      classification: "inference",
      verification: "human_verified",
      unreviewed_reasons: [],
    });
    expect(pathway.rollup).toBe("no_disqualifier_found_in_reviewed_sources");
    expect(pathway.statement).toContain("This is not a determination that the pathway is available");
    expect(result.release).toEqual({ client_releasable: true, blockers: [] });
  });

  if (testCase.blocking !== null) {
    const blocking = testCase.blocking;
    it("returns disqualifying_per_source for the exact blocking case", () => {
      const { pathway, criterion: evaluated } = screen(criterion, blocking());
      expect(evaluated.status).toBe("disqualifying_per_source");
      expect(pathway).toMatchObject({
        rollup: "documented_disqualifier",
        decisive_criteria: [criterion.id],
      });
      expect(pathway.statement).toContain("Los Angeles City Planning makes the governing determination");
    });
  }

  it("stays unknown when a required fact is missing, without running the rule", () => {
    for (const key of criterion.fact_keys) {
      const { spy, criterion: spiedCriterion } = spied();
      const records = testCase.positive().filter((record) => record.claim.key !== key);
      const { pathway, criterion: evaluated } = screen(spiedCriterion, records);
      expect(spy).not.toHaveBeenCalled();
      expect(evaluated.status).toBe("unknown");
      expect(evaluated.statement).toContain("missing evidence is not treated as a no");
      expect(pathway.rollup).toBe("undetermined");
    }
  });

  it("stays in conflict when official sources disagree, without running the rule", () => {
    const { spy, criterion: spiedCriterion } = spied();
    const records = testCase.positive();
    const first = records.find((record) => record.claim.key === criterion.fact_keys[0]);
    const second = structuredClone(first) as CanonicalEvidenceRecord;
    second.id = `${second.id}-second-source`;
    second.source.agency = "Second fictional City source";
    if (second.normalized_value.kind === "boolean") {
      const flipped = !second.normalized_value.value;
      second.raw_observed_value = { kind: "text", value: flipped ? "YES" : "NO" };
      second.normalized_value = { kind: "boolean", value: flipped };
    } else {
      second.raw_observed_value = { kind: "text", value: "Second source value" };
      second.normalized_value = { kind: "text", value: "Second source value" };
    }
    const { pathway, criterion: evaluated } = screen(spiedCriterion, [...records, second]);
    expect(spy).not.toHaveBeenCalled();
    expect(evaluated.status).toBe("conflict");
    expect(pathway.rollup).toBe("contested");
  });

  it("stays unreviewed when evidence lacks human review, without running the rule", () => {
    const { spy, criterion: spiedCriterion } = spied();
    const records = testCase.positive().map((record) => ({
      ...record,
      review_status: "unreviewed" as const,
    }));
    const { result, pathway, criterion: evaluated } = screen(spiedCriterion, records);
    expect(spy).not.toHaveBeenCalled();
    expect(evaluated).toMatchObject({
      status: "unreviewed",
      unreviewed_reasons: ["evidence_unreviewed"],
    });
    expect(pathway.rollup).toBe("undetermined");
    expect(result.review_tasks).toContainEqual(
      expect.objectContaining({ kind: "review_evidence", fact_key: criterion.fact_keys[0] }),
    );
  });

  it("blocks release once its citation reaches the review date", () => {
    const record = criterion.human_verification as ProgramCriterionHumanVerification;
    const dueDate = record.next_review_at;
    const { result, criterion: evaluated } = screen(criterion, testCase.positive(), dueDate);
    expect(evaluated.stale).toBe(true);
    expect(result.release.client_releasable).toBe(false);
    expect(result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "stale_criterion", ref: criterion.id }),
    );
    expect(result.review_tasks).toContainEqual(
      expect.objectContaining({ kind: "reverify_stale_citation", criterion_id: criterion.id }),
    );
  });

  it("does not run its rule without the human-verification record", () => {
    const { spy, criterion: spiedCriterion } = spied();
    const stripped = { ...spiedCriterion, human_verification: null };
    expect(programCriterionSchema.safeParse(stripped).success).toBe(false);
    expectValidationCode(
      () =>
        evaluateProgramScreen({
          evidence_records: [...anchorEvidence(), ...testCase.positive()],
          as_of: AS_OF,
          packs: [packFor(stripped)],
        }),
      "INVALID_PROGRAM_CRITERION",
    );
    // A caller that skips pack validation still gets no result from the rule.
    const facts = new Map(
      assessProgramFacts(testCase.positive(), stripped.fact_keys).map((fact) => [fact.key, fact]),
    );
    expect(evaluateProgramCriterion(stripped, facts, AS_OF)).toMatchObject({
      status: "unreviewed",
      unreviewed_reasons: ["criterion_pending_human"],
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("quotes a supporting excerpt that still appears in the pinned source capture", async () => {
    const record = criterion.human_verification as ProgramCriterionHumanVerification;
    const capture = testCase.captures[record.source_capture.repo_path];
    expect(capture, record.source_capture.repo_path).toBeDefined();
    expect(await sha256Hex(capture)).toBe(record.source_capture.sha256);
    expect(excerptAppearsInCapture(record.supporting_excerpt, capture)).toBe(true);
    expect(criterion.basis.repo_path).toBe(record.source_capture.repo_path);
    for (const excerpt of criterion.basis.excerpts) {
      expect(excerptAppearsInCapture(excerpt, capture), excerpt).toBe(true);
    }
  });
}

/* ------------------------------------------------------------------ tests */

describe("Program Screen human-verified criterion (TEST-ONLY synthetic)", () => {
  exerciseVerifiedCriterion(syntheticVerifiedCriterion, {
    positive: () => [evidence("f", "special-flood-hazard-area", false)],
    blocking: () => [evidence("f", "special-flood-hazard-area", true)],
    captures: { [SYNTHETIC_CAPTURE_PATH]: syntheticCapture },
  });

  it("marks the citation stale when the record's own review date arrives first", () => {
    // Pack validation forbids this mismatch; staleness still fails closed without it.
    const base = syntheticVerifiedCriterion();
    const early = {
      ...base,
      human_verification: { ...syntheticVerification(), next_review_at: "2026-10-01" },
    };
    expect(programCriterionSchema.safeParse(early).success).toBe(false);
    const facts = new Map(
      assessProgramFacts([evidence("f", "special-flood-hazard-area", false)], ["special-flood-hazard-area"]).map((fact) => [
        fact.key,
        fact,
      ]),
    );
    expect(evaluateProgramCriterion(early, facts, "2026-10-01").stale).toBe(true);
    expect(evaluateProgramCriterion(base, facts, "2026-10-01").stale).toBe(false);
  });

  it.each<[string, (record: ProgramCriterionHumanVerification) => unknown]>([
    ["an AI reviewer", (record) => ({ ...record, reviewer: { ...record.reviewer, kind: "ai" } })],
    ["an unnamed reviewer", (record) => ({ ...record, reviewer: { ...record.reviewer, name: " " } })],
    ["a reviewer without a role", (record) => ({ ...record, reviewer: { kind: "human", name: "Reviewer" } })],
    ["a missing reviewer", (record) => ({ ...record, reviewer: undefined })],
    ["an invalid verification date", (record) => ({ ...record, verified_at: "2026-02-30" })],
    ["a missing instrument", (record) => ({ ...record, instrument: "" })],
    ["a missing pinpoint", (record) => ({ ...record, pinpoint: "" })],
    ["a missing supporting excerpt", (record) => ({ ...record, supporting_excerpt: "" })],
    ["a non-HTTPS source URL", (record) => ({ ...record, source_url: "http://records.example.test/x" })],
    ["a source URL that differs from the citation", (record) => ({ ...record, source_url: "https://records.example.test/other" })],
    ["a source title that differs from the citation", (record) => ({ ...record, source_title: "Other title" })],
    ["a pinpoint that differs from the citation", (record) => ({ ...record, pinpoint: "Sec. 98" })],
    ["a verification date that differs from the citation", (record) => ({ ...record, verified_at: "2026-09-21" })],
    ["a review date that differs from the citation", (record) => ({ ...record, next_review_at: "2026-10-19" })],
    ["a missing source capture", (record) => ({ ...record, source_capture: undefined })],
    ["an AI-generated source capture", (record) => ({ ...record, source_capture: { ...record.source_capture, is_ai_generated: true } })],
    ["a capture without a SHA-256 digest", (record) => ({ ...record, source_capture: { ...record.source_capture, sha256: "abc" } })],
    ["a capture outside the fixture directory", (record) => ({ ...record, source_capture: { ...record.source_capture, repo_path: "dist/resources/notes.txt" } })],
    ["a capture retrieved after verification", (record) => ({ ...record, source_capture: { ...record.source_capture, retrieved_at: "2026-09-21T00:00:00.000Z" } })],
    ["an unknown capture method", (record) => ({ ...record, source_capture: { ...record.source_capture, capture_method: "search_summary" } })],
    ["a proposed-draft source", (record) => ({ ...record, source_capture: { ...record.source_capture, source_type: "proposed_draft" } })],
    ["a proposed draft recorded as not operative", (record) => ({ ...record, source_capture: { ...record.source_capture, source_type: "proposed_draft", operative_status: "proposed_not_operative" } })],
    ["a source whose operative status is unconfirmed", (record) => ({ ...record, source_capture: { ...record.source_capture, operative_status: "status_unconfirmed" } })],
    ["a superseded source", (record) => ({ ...record, source_capture: { ...record.source_capture, operative_status: "superseded" } })],
    ["a source without a declared type", (record) => ({ ...record, source_capture: { ...record.source_capture, source_type: undefined } })],
    ["a capture in a flat official-sources file", (record) => ({ ...record, source_capture: { ...record.source_capture, repo_path: "app/fixtures/program-screen/official-sources/ordinance-188968.txt" } })],
    ["a capture pointing at a proposed verification", (record) => ({ ...record, source_capture: { ...record.source_capture, repo_path: "app/fixtures/program-screen/proposed-verifications/la_sb79.permanent-exclusion.txt" } })],
    ["an extra field", (record) => ({ ...record, confidence: "high" })],
  ])("rejects a verification record with %s", (_name, mutate) => {
    const spy = vi.fn(() => "consistent_with_source" as const);
    const criterion = {
      ...syntheticVerifiedCriterion(spy),
      human_verification: mutate(syntheticVerification()),
    } as ProgramCriterion;

    expect(programCriterionSchema.safeParse(criterion).success).toBe(false);
    expect(hasCompleteHumanVerification(criterion)).toBe(false);
    expectValidationCode(
      () =>
        evaluateProgramScreen({
          evidence_records: [...anchorEvidence(), evidence("f", "special-flood-hazard-area", false)],
          as_of: AS_OF,
          packs: [packFor(criterion)],
        }),
      "INVALID_PROGRAM_CRITERION",
    );
    const facts = new Map(
      assessProgramFacts([evidence("f", "special-flood-hazard-area", false)], ["special-flood-hazard-area"]).map((fact) => [
        fact.key,
        fact,
      ]),
    );
    expect(evaluateProgramCriterion(criterion, facts, AS_OF).status).toBe("unreviewed");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a verification record on a criterion that is not human-verified", () => {
    for (const verification of ["repo_sourced", "pending_human"] as const) {
      const criterion = { ...syntheticVerifiedCriterion(), verification };
      expect(programCriterionSchema.safeParse(criterion).success, verification).toBe(false);
    }
  });

  it("matches excerpts across wrapped lines but not altered wording", async () => {
    // The excerpt spans a line break in the capture.
    expect(syntheticCapture).toContain("synthetic flood\nzone");
    expect(excerptAppearsInCapture(SYNTHETIC_EXCERPT, syntheticCapture)).toBe(true);
    expect(
      excerptAppearsInCapture(SYNTHETIC_EXCERPT.replace("is excluded", "may be excluded"), syntheticCapture),
    ).toBe(false);
    expect(excerptAppearsInCapture("   ", syntheticCapture)).toBe(false);
    // An edited capture no longer matches the pinned digest.
    expect(await sha256Hex(`${syntheticCapture} `)).not.toBe(SYNTHETIC_CAPTURE_SHA256);
  });
});

describe("Program Screen criteria awaiting human verification", () => {
  const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
  const byId = new Map(shipped.map((criterion) => [criterion.id, criterion]));

  it("keeps each formerly pending criterion pending and release-blocking until human-verified", () => {
    for (const id of humanVerificationRequiredCriterionIds) {
      const criterion = byId.get(id) as ProgramCriterion;
      expect(criterion, id).toBeDefined();
      if (criterion.verification === "human_verified") {
        // Checked in full by "Shipped human-verified Program Screen criteria".
        expect(hasCompleteHumanVerification(criterion), id).toBe(true);
        continue;
      }
      expect(criterion).toMatchObject({ verification: "pending_human", human_verification: null });
      // A pending atomic criterion either has no rule or routes to professional judgment.
      expect(["not_encoded", "professional_judgment"]).toContain(criterion.predicate);
      expect(criterionAwaitsHumanVerification(criterion)).toBe(true);
      expect(criterion.rule_summary).toContain(
        "record the reviewer, verification date, exact section, and exact supporting excerpt",
      );
    }
  });

  it.each([...humanVerificationRequiredCriterionIds])(
    "refuses to run %s when relabeled repo-sourced or verified without a record",
    (id) => {
      const spy = vi.fn(() => "disqualifying_per_source" as const);
      const original = byId.get(id) as ProgramCriterion;
      const relabeled = {
        ...original,
        predicate: spy,
        question_if_judgment: "How does Planning apply this criterion?",
        permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"] as const,
        verification: "repo_sourced" as const,
      };
      const unrecorded = { ...relabeled, verification: "human_verified" as const };

      for (const candidate of [relabeled, unrecorded]) {
        expect(programCriterionSchema.safeParse(candidate).success).toBe(false);
        expect(criterionAwaitsHumanVerification(candidate)).toBe(true);
        const facts = new Map(
          assessProgramFacts([], candidate.fact_keys).map((fact) => [fact.key, fact]),
        );
        // With no evidence the rule could not run anyway; force established facts.
        for (const [key, fact] of facts) {
          facts.set(key, {
            ...fact,
            supplied: true,
            reviewed: true,
            classification: "source_observation",
            normalized_value:
              programFactSpecs[key].value.kind === "number"
                ? { kind: "number", value: 1, unit: (programFactSpecs[key].value as { unit: string }).unit }
                : programFactSpecs[key].value.kind === "boolean"
                  ? { kind: "boolean", value: true }
                  : { kind: "text", value: "Fictional value" },
          });
        }
        expect(evaluateProgramCriterion(candidate, facts, AS_OF)).toMatchObject({
          status: "unreviewed",
          unreviewed_reasons: ["criterion_pending_human"],
        });
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it("never ships a draft predicate on a pending criterion", () => {
    for (const criterion of shipped.filter((candidate) => candidate.verification === "pending_human")) {
      expect(typeof criterion.predicate, criterion.id).not.toBe("function");
    }
  });
});

describe("Shipped human-verified Program Screen criteria", () => {
  const shipped = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
  const verified = shipped.filter((criterion) => criterion.verification === "human_verified");

  /**
   * Behavior cases for each shipped human-verified criterion. Adding a
   * verified criterion without a case here fails the pin below.
   */
  const verifiedCases: Record<string, Omit<VerifiedCriterionCase, "captures">> = {};

  it("pins exactly which shipped criteria have been human-verified", () => {
    // Empty: the official sources were captured on 2026-09-27, but no human
    // reviewer has approved a proposal yet. See
    // docs/PROGRAM_SCREEN_CRITERION_VERIFICATION.md.
    expect(verified.map((criterion) => criterion.id)).toEqual([]);
    expect(Object.keys(verifiedCases).sort()).toEqual(
      verified.map((criterion) => criterion.id).sort(),
    );
  });

  it("pins exactly which shipped criteria may execute a production predicate", () => {
    const executable = shipped
      .filter(
        (criterion) =>
          typeof criterion.predicate === "function" && !criterionAwaitsHumanVerification(criterion),
      )
      .map((criterion) => criterion.id);

    // Changing this list means a person verified a new rule; review it as such.
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

  it("cites only official sources, captured in the official-source directory", async () => {
    for (const criterion of verified) {
      const record = criterion.human_verification as ProgramCriterionHumanVerification;
      expect(officialSourceHosts).toContain(new URL(record.source_url).hostname);
      expect(record.source_capture.repo_path.startsWith(OFFICIAL_SOURCE_CAPTURE_DIR)).toBe(true);
      expect(record.reviewer.kind).toBe("human");
    }
  });

  it("rests every record on an operative capture whose metadata it matches", () => {
    // Capture integrity (hashes, layout, registry) is checked in
    // program-screen-source-capture.test.ts; this ties each record to it.
    for (const criterion of verified) {
      const record = criterion.human_verification as ProgramCriterionHumanVerification;
      const metadata = officialCaptureMetadata[record.source_capture.repo_path];
      expect(metadata, record.source_capture.repo_path).toBeDefined();
      expect(
        humanRecordCaptureIssues(record, {
          metadata,
          extracted: officialCaptures[record.source_capture.repo_path],
        }),
        criterion.id,
      ).toEqual([]);
    }
  });

  for (const criterion of verified) {
    const testCase = verifiedCases[criterion.id];
    if (!testCase) continue;
    describe(criterion.id, () => {
      exerciseVerifiedCriterion(
        (predicate) => (predicate === undefined ? criterion : { ...criterion, predicate }),
        { ...testCase, captures: officialCaptures },
      );
    });
  }
});
