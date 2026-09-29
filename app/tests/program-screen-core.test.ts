import { describe, expect, it, vi } from "vitest";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
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
  rollUpProgramPathway,
} from "../src/shared/program-screen/evaluate";
import { assessProgramFacts, programFactSpecs } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage, quote } from "../src/shared/program-screen/language";
import {
  parseProgramPathwayPacks,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import type {
  CriterionStatus,
  ProgramCriterion,
  ProgramCriterionResult,
  ProgramFactKey,
  ProgramPathwayPack,
  ProgramScreenResult,
} from "../src/shared/program-screen/types";

const FIXTURE_AS_OF = fixtureJson.as_of;
const SUBJECT = {
  case_id: "case-fictional-program-screen-test",
  property_id: "property-fictional-program-screen-test",
};

function fixtureRecords(): CanonicalEvidenceRecord[] {
  return structuredClone(fixtureJson.evidence_records) as CanonicalEvidenceRecord[];
}

function evaluateFixture(
  records: CanonicalEvidenceRecord[] = fixtureRecords(),
  asOf = FIXTURE_AS_OF,
): ProgramScreenResult {
  return evaluateProgramScreen({ evidence_records: records, as_of: asOf });
}

function pathwayOf(result: ProgramScreenResult, id: string) {
  const pathway = result.pathways.find((candidate) => candidate.pathway === id);
  if (!pathway) throw new Error(`Missing pathway ${id}`);
  return pathway;
}

function criterionOf(result: ProgramScreenResult, id: string) {
  const criterion = result.pathways
    .flatMap((pathway) => pathway.criteria)
    .find((candidate) => candidate.criterion_id === id);
  if (!criterion) throw new Error(`Missing criterion ${id}`);
  return criterion;
}

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
  value: boolean | string | null,
  options: {
    reviewStatus?: CanonicalEvidenceRecord["review_status"];
    agency?: string;
    title?: string;
    evidenceType?: CanonicalEvidenceRecord["evidence_type"];
  } = {},
): CanonicalEvidenceRecord {
  const spec = programFactSpecs[key];
  const known = value !== null;
  return {
    id,
    subject: SUBJECT,
    claim: { key, label: spec.label, client_label: spec.client_label },
    source: {
      agency: options.agency ?? "Fictional City source",
      title: options.title ?? `Fictional ${key} observation`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/program-screen-tests/${id}`,
      authority: "official",
      retrieved_at: "2026-09-18T12:00:00.000Z",
    },
    raw_observed_value: !known
      ? { kind: "not_observed", value: null }
      : typeof value === "boolean"
        ? { kind: "text", value: value ? "YES" : "NO" }
        : { kind: "text", value },
    normalized_value: !known
      ? { kind: "unknown", value: null, reason: "retrieval_failed" }
      : typeof value === "boolean"
        ? { kind: "boolean", value }
        : { kind: "text", value },
    evidence_type: options.evidenceType ?? (known ? "official_portal" : "lookup_attempt"),
    classification: known ? "source_observation" : "unknown",
    confidence: 99,
    conflicts_with: [],
    review_status: options.reviewStatus ?? (known ? "reviewed" : "review_required"),
    notes: [],
    limitations: [],
    provenance: {
      source_record_id: `test-${id}`,
      capture_method: "manual_research",
      is_ai_generated: false,
    },
  };
}

function testCriterion(
  overrides: Partial<ProgramCriterion> & Pick<ProgramCriterion, "id" | "fact_keys">,
): ProgramCriterion {
  return {
    pathway: "la_shra",
    label: "Synthetic test criterion",
    gating: false,
    predicate: () => "consistent_with_source",
    permitted_outcomes:
      overrides.predicate === "professional_judgment"
        ? ["requires_judgment"]
        : ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    exception_paths: [],
    rule_summary: "Synthetic rule used only in tests.",
    citation: {
      title: "Synthetic test citation",
      url: "https://records.example.test/program-screen-tests/citation",
      pinpoint: "Section T",
      verified_at: "2026-09-17",
      volatility: "medium",
      next_review_at: "2026-11-16",
    },
    confirmer: "Los Angeles City Planning",
    question_if_unknown: "Which record shows this fact for the parcel?",
    question_if_conflict: "Which record governs for the parcel?",
    question_if_judgment: "How does Planning apply this criterion to the parcel?",
    verification: "repo_sourced",
    human_verification: null,
    basis: { repo_path: "app/tests/program-screen-core.test.ts", excerpts: ["Synthetic."] },
    ...overrides,
  };
}

/** A synthetic SHRA pack whose anchors are the real repo-sourced gates. */
function testPack(
  criteria: ProgramCriterion[],
  pathway: ProgramPathwayPack["pathway"]["id"] = "la_shra",
): ProgramPathwayPack {
  return {
    pathway: {
      id: pathway,
      label: "Synthetic test pathway",
      confirmer: "Los Angeles City Planning",
    },
    criteria: [parcelMatchCriterion(pathway), jurisdictionCriterion(pathway), ...criteria],
  };
}

/**
 * TEST-ONLY synthetic blocking criterion. It proves the documented-disqualifier
 * roll-up works; no shipped criterion encodes this rule.
 */
function testOnlyBlocker(): ProgramCriterion {
  return testCriterion({
    id: "la_sb79.test-only-blocker",
    pathway: "la_sb79",
    label: "TEST-ONLY synthetic blocking criterion",
    fact_keys: ["sb79-permanent-exemption-shown"],
    predicate: (facts) =>
      facts["sb79-permanent-exemption-shown"]?.kind === "boolean" &&
      facts["sb79-permanent-exemption-shown"].value
        ? "disqualifying_per_source"
        : "consistent_with_source",
  });
}

function testOnlyBlockerEvidence(zimasExemptionShown: boolean): CanonicalEvidenceRecord[] {
  return [
    ...anchorEvidence(),
    evidence("x", "sb79-permanent-exemption-shown", true, { evidenceType: "official_document" }),
    evidence("z", "zimas-sb79-exemption", zimasExemptionShown),
  ];
}

function anchorEvidence(): CanonicalEvidenceRecord[] {
  return [
    evidence("t-parcel", "parcel-match", true),
    evidence("t-jurisdiction", "jurisdiction", "City of Los Angeles"),
  ];
}

function stubResult(
  id: string,
  status: CriterionStatus,
  gating = false,
): ProgramCriterionResult {
  return { criterion_id: id, status, gating } as ProgramCriterionResult;
}

describe("Program Screen criterion status precedence", () => {
  const combos = [false, true].flatMap((conflict) =>
    [false, true].flatMap((missing) =>
      [false, true].flatMap((professional) =>
        [false, true].flatMap((pending) =>
          [false, true].map((unreviewedEvidence) => ({
            conflict,
            missing,
            professional,
            pending,
            unreviewedEvidence,
          })),
        ),
      ),
    ),
  );

  function expectedStatus(row: (typeof combos)[number]): CriterionStatus {
    if (row.conflict) return "conflict";
    if (row.missing) return "unknown";
    if (row.professional) return "professional";
    if (row.pending || row.unreviewedEvidence) return "unreviewed";
    return "disqualifying_per_source";
  }

  it.each(combos)(
    "conflict=$conflict missing=$missing professional=$professional pending=$pending unreviewedEvidence=$unreviewedEvidence",
    (row) => {
      const reviewStatus = row.unreviewedEvidence ? "unreviewed" : "reviewed";
      const records = row.conflict
        ? [
            evidence("a-1", "hillside-area", true, { reviewStatus }),
            evidence("a-2", "hillside-area", false, { reviewStatus, agency: "Second source" }),
          ]
        : [evidence("a-1", "hillside-area", true, { reviewStatus })];
      if (!row.missing) records.push(evidence("b-1", "coastal-zone", false));

      const facts = new Map(
        assessProgramFacts(records, ["hillside-area", "coastal-zone"]).map((fact) => [
          fact.key,
          fact,
        ]),
      );
      const predicate = vi.fn(() => "disqualifying_per_source" as const);
      const criterion = testCriterion({
        id: "la_shra.truth-table",
        fact_keys: ["hillside-area", "coastal-zone"],
        predicate: row.professional ? "professional_judgment" : predicate,
        verification: row.pending ? "pending_human" : "repo_sourced",
      });

      const result = evaluateProgramCriterion(criterion, facts, FIXTURE_AS_OF);
      const expected = expectedStatus(row);

      expect(result.status).toBe(expected);
      // The rule only runs on established, reviewed facts with a verified rule.
      expect(predicate).toHaveBeenCalledTimes(expected === "disqualifying_per_source" ? 1 : 0);
      if (expected === "unreviewed") {
        expect(result.unreviewed_reasons).toEqual([
          ...(row.pending ? ["criterion_pending_human"] : []),
          ...(row.unreviewedEvidence ? ["evidence_unreviewed"] : []),
        ]);
      }
      expect(result.classification).toBe(
        expected === "conflict"
          ? "conflict"
          : expected === "disqualifying_per_source"
            ? "inference"
            : "unknown",
      );
    },
  );

  it("maps a predicate's requires_judgment outcome to professional", () => {
    const facts = new Map(
      assessProgramFacts([evidence("c-1", "zoning-code-chapter", "Chapter 1A")], [
        "zoning-code-chapter",
      ]).map((fact) => [fact.key, fact]),
    );
    const scope = programScreenPathwayPacks[0].criteria.find(
      (criterion) => criterion.id === "la_shra.implementation-memo-scope",
    ) as ProgramCriterion;

    expect(evaluateProgramCriterion(scope, facts, FIXTURE_AS_OF).status).toBe("professional");
  });

  it("lets a conflict outrank an unverified rule on the same fact", () => {
    const records = fixtureRecords();
    // Two reviewed official records disagree on the SB 79 permanent exemption itself.
    const second = structuredClone(
      records.find((record) => record.id === "ps-sb79-permanent-exclusion"),
    ) as CanonicalEvidenceRecord;
    second.id = "ps-sb79-permanent-exclusion-second-source";
    second.source.agency = "Second fictional City source";
    second.raw_observed_value = { kind: "text", value: "NO" };
    second.normalized_value = { kind: "boolean", value: false };
    records.push(second);

    const result = evaluateFixture(records);

    expect(criterionOf(result, "la_sb79.permanent-exemption-shown").status).toBe("conflict");
    expect(pathwayOf(result, "la_sb79").rollup).toBe("contested");
    expect(
      result.facts.find((fact) => fact.key === "sb79-permanent-exemption-shown"),
    ).toMatchObject({
      classification: "conflict",
      normalized_value: { kind: "unresolved", value: null, reason: "conflicting_evidence" },
    });
  });
});

describe("Program Screen pathway roll-up precedence", () => {
  const anchors = [
    stubResult("p.parcel-match", "consistent_with_source", true),
    stubResult("p.jurisdiction", "consistent_with_source", true),
  ];

  it.each<[string, CriterionStatus[], string]>([
    ["disqualifier beats every other status", ["disqualifying_per_source", "conflict", "unknown", "professional", "unreviewed", "consistent_with_source"], "documented_disqualifier"],
    ["conflict beats unknown and professional", ["conflict", "unknown", "professional", "unreviewed", "consistent_with_source"], "contested"],
    ["unknown is undetermined", ["unknown", "consistent_with_source"], "undetermined"],
    ["professional is undetermined", ["professional", "consistent_with_source"], "undetermined"],
    ["unreviewed is undetermined", ["unreviewed", "consistent_with_source"], "undetermined"],
    ["all consistent finds no disqualifier", ["consistent_with_source", "consistent_with_source"], "no_disqualifier_found_in_reviewed_sources"],
  ])("%s", (_name, statuses, rollup) => {
    const results = [
      ...anchors,
      ...statuses.map((status, index) => stubResult(`p.c${index}`, status)),
    ];
    const rolled = rollUpProgramPathway(results);
    expect(rolled.rollup).toBe(rollup);
    expect(rolled.anchored).toBe(true);
    expect(rolled.decisive_criteria.length).toBeGreaterThan(0);
  });

  it("treats a program-flag divergence as contested, never as a resolution", () => {
    const consistent = [...anchors, stubResult("p.c", "consistent_with_source")];
    expect(rollUpProgramPathway(consistent, { flagDivergence: true }).rollup).toBe("contested");
    const blocked = [...anchors, stubResult("p.c", "disqualifying_per_source")];
    expect(rollUpProgramPathway(blocked, { flagDivergence: true }).rollup).toBe(
      "documented_disqualifier",
    );
  });

  it("lets an anchor gate document a blocker once earlier anchors are consistent", () => {
    const rolled = rollUpProgramPathway([
      stubResult("p.parcel-match", "consistent_with_source", true),
      stubResult("p.jurisdiction", "disqualifying_per_source", true),
      stubResult("p.c", "unknown"),
    ]);
    expect(rolled).toMatchObject({
      rollup: "documented_disqualifier",
      anchored: true,
      decisive_criteria: ["p.jurisdiction"],
    });
  });

  it("draws no pathway result from an unanchored parcel", () => {
    const unmatched = stubResult("p.parcel-match", "unknown", true);
    expect(
      rollUpProgramPathway([
        unmatched,
        stubResult("p.jurisdiction", "disqualifying_per_source", true),
        stubResult("p.c", "disqualifying_per_source"),
      ]),
    ).toMatchObject({ rollup: "undetermined", anchored: false });
    expect(
      rollUpProgramPathway([
        unmatched,
        stubResult("p.jurisdiction", "consistent_with_source", true),
        stubResult("p.c", "conflict"),
      ]),
    ).toMatchObject({ rollup: "contested", anchored: false });
  });

  it("rejects an empty pathway", () => {
    expectValidationCode(() => rollUpProgramPathway([]), "EMPTY_PROGRAM_PATHWAY");
  });
});

describe("Program Screen unknown is never false", () => {
  it("keeps the failed occupancy lookup unknown in every criterion that reads it", () => {
    const result = evaluateFixture();
    const occupancy = result.facts.find((fact) => fact.key === "occupancy-history");

    expect(occupancy).toMatchObject({
      classification: "unknown",
      normalized_value: { kind: "unknown", value: null, reason: "retrieval_failed" },
    });
    const readers = programScreenPathwayPacks
      .flatMap((pack) => pack.criteria)
      .filter((criterion) => criterion.fact_keys.includes("occupancy-history"))
      .map((criterion) => criterion.id);
    expect(readers).toEqual(["la_shra.vacant-site-definition", "la_shra.protected-housing-tenant-occupancy"]);
    for (const id of readers) {
      const criterion = criterionOf(result, id);
      expect(criterion.status).toBe("unknown");
      expect(criterion.statement).toContain("missing evidence is not treated as a no");
    }
  });

  it("does not turn a missing SB 79 permanent-exemption record into either a blocker or a clear result", () => {
    const records = fixtureRecords().filter(
      (record) => record.claim.key !== "sb79-permanent-exemption-shown",
    );
    const result = evaluateFixture(records);
    const sb79 = pathwayOf(result, "la_sb79");

    expect(criterionOf(result, "la_sb79.permanent-exemption-shown").status).toBe("unknown");
    expect(["documented_disqualifier", "no_disqualifier_found_in_reviewed_sources"]).not.toContain(sb79.rollup);
    expect(sb79.planning_questions).toContainEqual(
      expect.objectContaining({
        trigger: "unknown",
        criterion_ids: ["la_sb79.permanent-exemption-shown"],
        why_confirmation_needed: expect.stringContaining("No source record was supplied."),
      }),
    );
    // The ZIMAS exemption display is not promoted to a blocker; it is asked about.
    expect(sb79.planning_questions).toContainEqual(
      expect.objectContaining({
        trigger: "program_flag_unexplained",
        id: "la_sb79:zimas-sb79-exemption:program_flag_unexplained",
      }),
    );
  });

  it("does not read a missing program flag as a negative display", () => {
    const records = fixtureRecords().filter(
      (record) => record.claim.key !== "zimas-shra-program-field",
    );
    const flag = pathwayOf(evaluateFixture(records), "la_shra").program_flags[0];

    expect(flag).toMatchObject({ signal: "no_signal", crosscheck: "not_observed" });
  });

  it("treats inference-only evidence as unknown rather than an established fact", () => {
    const records = fixtureRecords();
    const exemption = records.find(
      (record) => record.id === "ps-sb79-permanent-exclusion",
    ) as CanonicalEvidenceRecord;
    exemption.classification = "inference";

    const result = evaluateFixture(records);
    expect(criterionOf(result, "la_sb79.permanent-exemption-shown").status).toBe("unknown");
    expect(pathwayOf(result, "la_sb79").rollup).not.toBe("documented_disqualifier");
  });
});

describe("Program Screen professional judgment", () => {
  it("never auto-resolves a judgment criterion even with complete reviewed facts", () => {
    const judgment = testCriterion({
      id: "la_shra.judgment",
      fact_keys: ["hillside-area"],
      predicate: "professional_judgment",
    });
    const result = evaluateProgramScreen({
      evidence_records: [...anchorEvidence(), evidence("h", "hillside-area", true)],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([judgment])],
    });
    const pathway = result.pathways[0];

    expect(pathway.criteria[2].status).toBe("professional");
    expect(pathway.rollup).toBe("undetermined");
    expect(pathway.decisive_criteria).toEqual(["la_shra.judgment"]);
    expect(pathway.planning_questions).toEqual([
      expect.objectContaining({
        trigger: "professional",
        question: "How does Planning apply this criterion to the parcel?",
        criterion_ids: ["la_shra.judgment"],
      }),
    ]);
  });

  it("routes a Chapter 1A parcel to Planning instead of resolving memo scope", () => {
    const records = fixtureRecords();
    const chapter = records.find((record) => record.id === "ps-zoning-code-chapter") as CanonicalEvidenceRecord;
    chapter.raw_observed_value = { kind: "text", value: "Chapter 1A" };
    chapter.normalized_value = { kind: "text", value: "Chapter 1A" };

    const result = evaluateFixture(records);
    expect(criterionOf(result, "la_shra.implementation-memo-scope").status).toBe("professional");
    expect(result.planning_questions).toContainEqual(
      expect.objectContaining({
        id: "la_shra:la_shra.implementation-memo-scope:professional",
        question: expect.stringContaining("Chapter 1A parcel"),
      }),
    );
  });
});

describe("Program Screen release gates", () => {
  it("never runs a pending-human rule and blocks the final conclusion", () => {
    const draft = vi.fn(() => "consistent_with_source" as const);
    const pending = testCriterion({
      id: "la_shra.pending",
      fact_keys: ["hillside-area"],
      predicate: draft,
      verification: "pending_human",
    });
    const result = evaluateProgramScreen({
      evidence_records: [...anchorEvidence(), evidence("h", "hillside-area", false)],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([pending])],
    });

    expect(draft).not.toHaveBeenCalled();
    expect(result.pathways[0].criteria[2]).toMatchObject({
      status: "unreviewed",
      unreviewed_reasons: ["criterion_pending_human"],
    });
    expect(result.pathways[0].rollup).toBe("undetermined");
    expect(result.release.client_releasable).toBe(false);
    expect(result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "pending_human_criterion", ref: "la_shra.pending" }),
    );
    expect(result.review_tasks).toContainEqual(
      expect.objectContaining({ kind: "verify_criterion_rule", criterion_id: "la_shra.pending" }),
    );
  });

  it("keeps every real pending-human criterion unresolved and release-blocking", () => {
    const result = evaluateFixture();
    const pending = programScreenPathwayPacks
      .flatMap((pack) => pack.criteria)
      .filter((criterion) => criterion.verification === "pending_human");

    expect(pending.length).toBeGreaterThan(0);
    for (const criterion of pending) {
      expect(["consistent_with_source", "disqualifying_per_source"]).not.toContain(
        criterionOf(result, criterion.id).status,
      );
      expect(result.release.blockers).toContainEqual(
        expect.objectContaining({ code: "pending_human_criterion", ref: criterion.id }),
      );
    }
    expect(result.release.client_releasable).toBe(false);
  });

  it("can release a fully reviewed, repo-sourced, current screen", () => {
    // Low-Rise: the SHRA pathway is held at undetermined while its Phase 3B
    // completeness blockers are open (program-screen-promotion-gates-3c.test.ts).
    const clear = testCriterion({ id: "la_low_rise.clear", pathway: "la_low_rise", fact_keys: ["hillside-area"] });
    const result = evaluateProgramScreen({
      evidence_records: [...anchorEvidence(), evidence("h", "hillside-area", false)],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([clear], "la_low_rise")],
    });

    expect(result.pathways[0].rollup).toBe("no_disqualifier_found_in_reviewed_sources");
    expect(result.pathways[0].statement).toContain(
      "This is not a determination that the pathway is available",
    );
    expect(result.release).toEqual({ client_releasable: true, blockers: [] });
  });

  it("blocks release once a criterion citation reaches its review date", () => {
    const base = testCriterion({ id: "la_shra.clear", fact_keys: ["hillside-area"] });
    const volatile = {
      ...base,
      citation: { ...base.citation, volatility: "high" as const, next_review_at: "2026-10-17" },
    };
    const input = {
      evidence_records: [...anchorEvidence(), evidence("h", "hillside-area", false)],
      packs: [testPack([volatile])],
    };

    expect(evaluateProgramScreen({ ...input, as_of: "2026-10-16" }).release.client_releasable).toBe(true);
    const stale = evaluateProgramScreen({ ...input, as_of: "2026-10-17" });
    expect(stale.release.client_releasable).toBe(false);
    expect(stale.release.blockers).toEqual([
      expect.objectContaining({ code: "stale_criterion", ref: "la_shra.clear" }),
    ]);
    // Staleness blocks release; it does not rewrite the evaluated status.
    expect(stale.pathways[0].criteria[2]).toMatchObject({
      stale: true,
      status: "consistent_with_source",
    });
    expect(stale.review_tasks).toContainEqual(
      expect.objectContaining({ kind: "reverify_stale_citation", criterion_id: "la_shra.clear" }),
    );
  });

  it("marks every high-volatility fixture criterion stale on its review date", () => {
    const result = evaluateFixture(fixtureRecords(), "2026-10-17");
    const staleRefs = result.release.blockers
      .filter((blocker) => blocker.code === "stale_criterion")
      .map((blocker) => blocker.ref);

    expect(staleRefs).toContain("la_sb79.permanent-exemption-shown");
    expect(staleRefs).toContain("la_shra.implementation-memo-scope");
    expect(staleRefs).not.toContain("la_shra.jurisdiction");
  });

  it("blocks release when a gating fact lacks human review", () => {
    const records = fixtureRecords();
    const jurisdiction = records.find((record) => record.id === "ps-jurisdiction") as CanonicalEvidenceRecord;
    jurisdiction.classification = "source_observation";
    jurisdiction.review_status = "unreviewed";

    const result = evaluateFixture(records);
    expect(criterionOf(result, "la_shra.jurisdiction")).toMatchObject({
      status: "unreviewed",
      unreviewed_reasons: ["evidence_unreviewed"],
    });
    // Unanchored, so no pathway result; the fire-hazard conflict (Sec. 2.F) keeps it contested.
    expect(pathwayOf(result, "la_sb79")).toMatchObject({ rollup: "contested", anchored: false });
    expect(pathwayOf(result, "la_sb79").statement).toContain("draws no pathway result");
    expect(result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "unreviewed_gating_fact", ref: "jurisdiction", pathway: "la_sb79" }),
    );
  });

  it("blocks release when generated client-facing text uses prohibited language", () => {
    const unsafe = testCriterion({
      id: "la_shra.unsafe",
      fact_keys: ["hillside-area"],
      label: "Parcel qualifies for SHRA",
    });
    const result = evaluateProgramScreen({
      evidence_records: [...anchorEvidence(), evidence("h", "hillside-area", false)],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([unsafe])],
    });

    expect(result.release.client_releasable).toBe(false);
    expect(result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "prohibited_language", ref: "la_shra.unsafe.label" }),
    );
  });
});

describe("Program Screen client-language guard", () => {
  it.each([
    "The parcel is eligible for SHRA.",
    "The site qualifies under SB 79.",
    "This is a qualified site.",
    "Development is by-right.",
    "Housing is allowed by right.",
    "The lot is buildable.",
    "The project will be approved.",
    "Approval is guaranteed.",
    "The owner is entitled to build.",
    "Maximum units: 10.",
    "Estimated unit yield is 8.",
    "The parcel is ineligible.",
    "The zone permits 12 units.",
  ])("flags %s", (text) => {
    expect(findProhibitedClientLanguage(text).length).toBeGreaterThan(0);
  });

  it("allows registered source metadata only inside quotes", () => {
    const title = "ZIMAS Planning and Zoning — SHRA / SB 684 Eligibility field observation";
    expect(
      findProhibitedClientLanguage(`Consulted: ${quote(title)} (${quote("ZIMAS / City source")}).`, [title]),
    ).toEqual([]);
    expect(findProhibitedClientLanguage(`Consulted: ${quote(title)}.`)).toContain("eligibility claim");
    expect(findProhibitedClientLanguage(`Consulted: ${title}.`, [title])).toContain("eligibility claim");
    expect(
      findProhibitedClientLanguage(`The parcel is eligible per ${quote(title)}.`, [title]),
    ).toContain("eligibility claim");
  });

  it("does not reject source titles that contain program words", () => {
    const records = fixtureRecords();
    const lookup = records.find((record) => record.id === "ps-occupancy-history-lookup") as CanonicalEvidenceRecord;
    lookup.source.title = "SHRA / SB 684 Eligibility occupancy lookup attempt";

    const result = evaluateFixture(records);
    const question = result.planning_questions.find(
      (candidate) => candidate.id === "la_shra:la_shra.vacant-site-definition:unknown",
    );

    expect(question?.why_confirmation_needed).toContain(
      quote("SHRA / SB 684 Eligibility occupancy lookup attempt"),
    );
    expect(result.release.blockers.filter((blocker) => blocker.code === "prohibited_language")).toEqual([]);
  });

  it("keeps every generated fixture text free of prohibited language", () => {
    const result = evaluateFixture();
    expect(result.release.blockers.filter((blocker) => blocker.code === "prohibited_language")).toEqual([]);
    const generated = [
      ...result.pathways.flatMap((pathway) => [
        pathway.label,
        pathway.statement,
        ...pathway.criteria.flatMap((criterion) => [criterion.label, criterion.statement, criterion.rule_summary]),
        ...pathway.program_flags.map((flag) => flag.statement),
      ]),
      ...result.planning_questions.map((question) => question.question),
      ...result.review_tasks.map((task) => task.instruction),
    ].join("\n");
    expect(generated).not.toMatch(/\b(?:eligible|qualifies|qualified|by[- ]right|buildable|approved|guaranteed|entitled)\b/i);
  });
});

describe("Program Screen criterion citations", () => {
  const criteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);

  it("requires every shipped criterion to carry a current, pinpointed HTTPS citation", () => {
    expect(() => parseProgramPathwayPacks(programScreenPathwayPacks)).not.toThrow();
    for (const criterion of criteria) {
      expect(criterion.citation.url).toMatch(/^https:\/\//);
      expect(criterion.citation.pinpoint.length).toBeGreaterThan(0);
      // Updated in Phase 3E: d's citation carries its human verification date.
      expect(criterion.citation.verified_at).toBe(criterion.id === "la_shra.high-fire-hazard-severity-zone" ? "2026-09-29" : "2026-09-17");
      expect(criterion.citation.next_review_at > criterion.citation.verified_at).toBe(true);
      expect(criterion.basis.excerpts.length).toBeGreaterThan(0);
    }
  });

  it.each<[string, (criterion: ProgramCriterion) => unknown]>([
    ["a missing citation", (criterion) => ({ ...criterion, citation: undefined })],
    ["a missing pinpoint", (criterion) => ({ ...criterion, citation: { ...criterion.citation, pinpoint: "" } })],
    ["a non-HTTPS URL", (criterion) => ({ ...criterion, citation: { ...criterion.citation, url: "http://example.com/ordinance" } })],
    ["a review date beyond its volatility cadence", (criterion) => ({ ...criterion, citation: { ...criterion.citation, next_review_at: "2027-06-01" } })],
    ["a missing repo basis", (criterion) => ({ ...criterion, basis: { repo_path: "x", excerpts: [] } })],
    ["an unencoded rule marked repo-sourced", (criterion) => ({ ...criterion, predicate: "not_encoded", verification: "repo_sourced" })],
    ["a ZIMAS program flag used as a criterion input", (criterion) => ({ ...criterion, fact_keys: ["zimas-shra-program-field"] })],
  ])("rejects %s", (_name, mutate) => {
    const base = testCriterion({ id: "la_shra.citation-test", fact_keys: ["hillside-area"] });
    expect(programCriterionSchema.safeParse(mutate(base)).success).toBe(false);
    expectValidationCode(
      () =>
        evaluateProgramScreen({
          evidence_records: anchorEvidence(),
          as_of: FIXTURE_AS_OF,
          packs: [testPack([mutate(base) as ProgramCriterion])],
        }),
      "INVALID_PROGRAM_CRITERION",
    );
  });
});

describe("Program Screen documented disqualifiers fail closed", () => {
  it("never turns the unverified SB 79 permanent-exemption rule into a documented disqualifier", () => {
    const result = evaluateFixture();
    const exemptionFact = result.facts.find((fact) => fact.key === "sb79-permanent-exemption-shown");
    const sb79 = pathwayOf(result, "la_sb79");

    // The observation is kept and reviewed, but its effect is not concluded.
    expect(exemptionFact).toMatchObject({
      classification: "source_observation",
      reviewed: true,
      normalized_value: { kind: "boolean", value: true },
    });
    expect(criterionOf(result, "la_sb79.permanent-exemption-shown")).toMatchObject({
      verification: "pending_human",
      rule_kind: "not_encoded",
      status: "unreviewed",
      unreviewed_reasons: ["criterion_pending_human"],
    });
    expect(sb79.rollup).not.toBe("documented_disqualifier");
    expect(result.pathways.map((pathway) => pathway.rollup)).not.toContain("documented_disqualifier");
    expect(result.counts.criteria.disqualifying_per_source).toBe(0);
    expect(result.release.blockers).toContainEqual(
      expect.objectContaining({ code: "pending_human_criterion", ref: "la_sb79.permanent-exemption-shown" }),
    );
    expect(result.review_tasks).toContainEqual(
      expect.objectContaining({
        kind: "verify_criterion_rule",
        criterion_id: "la_sb79.permanent-exemption-shown",
      }),
    );
  });

  it.each([
    "la_sb79.permanent-exemption-shown",
    "la_sb79.temporary-exemption-all-parcels",
    "la_sb79.temporary-exemption-period",
    "la_sb79.temporary-exemption-shown",
  ])(
    "keeps %s unencoded rather than repo-sourced",
    (id) => {
      const criterion = programScreenPathwayPacks
        .flatMap((pack) => pack.criteria)
        .find((candidate) => candidate.id === id) as ProgramCriterion;

      expect(criterion.verification).toBe("pending_human");
      expect(criterion.predicate).toBe("not_encoded");
      expect(criterion.rule_summary).toContain(
        "record the reviewer, verification date, exact section, and exact supporting excerpt",
      );
    },
  );

  it("draws no SB 79 result from a shown or absent temporary exemption", () => {
    for (const shown of [true, false]) {
      const records = fixtureRecords();
      const exemption = records.find(
        (record) => record.id === "ps-sb79-temporary-exemption",
      ) as CanonicalEvidenceRecord;
      exemption.raw_observed_value = { kind: "text", value: shown ? "YES" : "NO" };
      exemption.normalized_value = { kind: "boolean", value: shown };

      const result = evaluateFixture(records);
      expect(criterionOf(result, "la_sb79.temporary-exemption-shown")).toMatchObject({
        status: "unreviewed",
        unreviewed_reasons: ["criterion_pending_human"],
      });
      expect(pathwayOf(result, "la_sb79").rollup).not.toBe("documented_disqualifier");
      expect(result.release.blockers).toContainEqual(
        expect.objectContaining({ code: "pending_human_criterion", ref: "la_sb79.temporary-exemption-shown" }),
      );
    }
  });

  it("pins exactly which shipped criteria may run an encoded rule", () => {
    const runnable = programScreenPathwayPacks
      .flatMap((pack) => pack.criteria)
      .filter((criterion) => criterion.verification !== "pending_human")
      .map((criterion) => criterion.id);

    // Changing this list means a person verified a new rule; review it as such.
    // Updated in Phase 3E: d, human-verified by Sergio Mata on 2026-09-29.
    expect(runnable).toEqual([
      "la_shra.parcel-match",
      "la_shra.jurisdiction",
      "la_shra.implementation-memo-scope",
      "la_shra.vacant-site-definition",
      "la_shra.high-fire-hazard-severity-zone",
      "la_sb79.parcel-match",
      "la_sb79.jurisdiction",
      "la_low_rise.parcel-match",
      "la_low_rise.jurisdiction",
      "la_low_rise.overlay-review",
    ]);
  });

  it("proves the documented-disqualifier roll-up with a TEST-ONLY synthetic criterion", () => {
    const result = evaluateProgramScreen({
      evidence_records: testOnlyBlockerEvidence(true),
      as_of: FIXTURE_AS_OF,
      packs: [testPack([testOnlyBlocker()], "la_sb79")],
    });
    const sb79 = result.pathways[0];

    expect(sb79).toMatchObject({
      rollup: "documented_disqualifier",
      classification: "inference",
      anchored: true,
      decisive_criteria: ["la_sb79.test-only-blocker"],
    });
    expect(sb79.statement).toContain("treats as blocking this pathway");
    expect(sb79.statement).toContain("Los Angeles City Planning makes the governing determination");
    expect(sb79.program_flags.find((flag) => flag.fact_key === "zimas-sb79-exemption")).toMatchObject({
      crosscheck: "no_divergence",
    });
    expect(result.release).toEqual({ client_releasable: true, blockers: [] });
  });

  it("documents a blocker from the jurisdiction scope gate for a parcel outside the City", () => {
    const outside = testCriterion({ id: "la_shra.clear", fact_keys: ["hillside-area"] });
    const result = evaluateProgramScreen({
      evidence_records: [
        evidence("t-parcel", "parcel-match", true),
        evidence("t-jurisdiction", "jurisdiction", "Unincorporated Los Angeles County"),
        evidence("h", "hillside-area", false),
      ],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([outside])],
    });

    expect(result.pathways[0]).toMatchObject({
      rollup: "documented_disqualifier",
      decisive_criteria: ["la_shra.jurisdiction"],
    });
  });
});

describe("Program Screen ZIMAS program flags", () => {
  it("treats the SHRA program field as an observation that never changes a criterion", () => {
    const affirmative = evaluateFixture();
    const records = fixtureRecords();
    const field = records.find((record) => record.id === "ps-zimas-shra-program-field") as CanonicalEvidenceRecord;
    field.raw_observed_value = { kind: "text", value: "NO" };
    field.normalized_value = { kind: "boolean", value: false };
    const negative = evaluateFixture(records);

    const statuses = (result: ProgramScreenResult) =>
      result.pathways.flatMap((pathway) =>
        pathway.criteria.map((criterion) => [criterion.criterion_id, criterion.status]),
      );
    expect(statuses(negative)).toEqual(statuses(affirmative));
    expect(pathwayOf(negative, "la_shra").rollup).toBe(pathwayOf(affirmative, "la_shra").rollup);

    expect(pathwayOf(affirmative, "la_shra").program_flags[0]).toMatchObject({
      treated_as: "observation_only",
      classification: "source_observation",
      signal: "indicates_no_blocker",
      crosscheck: "no_divergence",
    });
    expect(pathwayOf(negative, "la_shra").program_flags[0]).toMatchObject({
      treated_as: "observation_only",
      signal: "indicates_blocker",
      crosscheck: "not_explained_by_criteria",
    });
    expect(pathwayOf(negative, "la_shra").planning_questions).toContainEqual(
      expect.objectContaining({ trigger: "program_flag_unexplained" }),
    );
  });

  it("never decides a pathway from program flags alone", () => {
    const flagsOnly = fixtureRecords().filter(
      (record) => programFactSpecs[record.claim.key as ProgramFactKey].role === "program_flag",
    );
    const result = evaluateFixture(flagsOnly);

    for (const pathway of result.pathways) {
      expect(pathway.anchored).toBe(false);
      expect(pathway.rollup).toBe("undetermined");
    }
    expect(pathwayOf(result, "la_sb79").program_flags.map((flag) => flag.crosscheck)).toEqual([
      "recorded_only",
      "recorded_only",
      "not_explained_by_criteria",
    ]);
  });

  it("keeps a divergence between a program flag and a documented blocker visible", () => {
    const result = evaluateProgramScreen({
      evidence_records: testOnlyBlockerEvidence(false),
      as_of: FIXTURE_AS_OF,
      packs: [testPack([testOnlyBlocker()], "la_sb79")],
    });
    const sb79 = result.pathways[0];
    const flag = sb79.program_flags.find((candidate) => candidate.fact_key === "zimas-sb79-exemption");

    expect(sb79.rollup).toBe("documented_disqualifier");
    expect(sb79.statement).toContain("point in different directions");
    expect(flag).toMatchObject({ signal: "indicates_no_blocker", crosscheck: "diverges_from_criteria" });
    expect(sb79.release.blockers).toContainEqual(
      expect.objectContaining({ code: "program_flag_divergence", ref: "zimas-sb79-exemption" }),
    );
    expect(sb79.planning_questions).toContainEqual(
      expect.objectContaining({
        trigger: "program_flag_divergence",
        criterion_ids: ["la_sb79.test-only-blocker"],
        sources: [expect.objectContaining({ evidence_id: "z", observed_display_value: "NO" })],
      }),
    );
    // The documented record is still shown; neither side was dropped.
    expect(sb79.criteria[2].status).toBe("disqualifying_per_source");
  });

  it("escalates an otherwise clear result to contested when a flag points to a blocker", () => {
    const clear = testCriterion({ id: "la_shra.clear", fact_keys: ["hillside-area"] });
    const result = evaluateProgramScreen({
      evidence_records: [
        ...anchorEvidence(),
        evidence("h", "hillside-area", false),
        evidence("f", "zimas-shra-program-field", false),
      ],
      as_of: FIXTURE_AS_OF,
      packs: [testPack([clear])],
    });

    expect(result.pathways[0]).toMatchObject({ rollup: "contested", classification: "conflict" });
    expect(result.pathways[0].program_flags[0].crosscheck).toBe("diverges_from_criteria");
    expect(result.release.client_releasable).toBe(false);
  });
});

describe("Program Screen determinism", () => {
  it("returns identical output for identical input and any record order", () => {
    const first = evaluateFixture();
    const second = evaluateFixture();
    const reversed = evaluateFixture(fixtureRecords().reverse());

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(reversed).toEqual(first);
    expect(first.screen_id).toBe("program-screen-3b829b017eb2036c");
  });

  it("requires an explicit evaluation date rather than reading a clock", () => {
    expectValidationCode(
      () => evaluateProgramScreen({ evidence_records: fixtureRecords(), as_of: "" }),
      "INVALID_PROGRAM_SCREEN_DATE",
    );
  });

  it("rejects evidence with uncontrolled claim wording or a second parcel", () => {
    const relabeled = fixtureRecords();
    relabeled[0].claim.client_label = "whether the parcel is eligible";
    expectValidationCode(() => evaluateFixture(relabeled), "INVALID_PROGRAM_SCREEN_EVIDENCE");

    const mixed = fixtureRecords();
    mixed[1].subject = { case_id: "case-fictional-other", property_id: "property-fictional-other" };
    expectValidationCode(() => evaluateFixture(mixed), "INVALID_PROGRAM_SCREEN_EVIDENCE");
  });

  it("only accepts the adopted-record evidence type for the SB 79 permanent-exemption fact", () => {
    const records = fixtureRecords();
    const exclusion = records.find((record) => record.id === "ps-sb79-permanent-exclusion") as CanonicalEvidenceRecord;
    exclusion.evidence_type = "official_portal";
    expectValidationCode(() => evaluateFixture(records), "INVALID_PROGRAM_SCREEN_EVIDENCE");
  });
});
