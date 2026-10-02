import { describe, expect, it, vi } from "vitest";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import type { CanonicalEvidenceRecord } from "../src/shared/build-week-integrity/types";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import { capturedOperativeSources } from "../src/shared/program-screen/criteria/common";
import { retiredProgramCriteria } from "../src/shared/program-screen/criteria/retired";
import {
  evaluateProgramCriterion,
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import { assessProgramFacts, programFactSpecs, retiredProgramFacts } from "../src/shared/program-screen/facts";
import { findProhibitedClientLanguage } from "../src/shared/program-screen/language";
import {
  proposedVerificationSchema,
  shippedComponentDispositions,
  type ProposedVerification,
} from "../src/shared/program-screen/proposed-verification";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import {
  criterionAwaitsHumanVerification,
  parseProgramScreenEvidence,
  parseProgramScreenFixture,
  programCriterionSchema,
} from "../src/shared/program-screen/schema";
import {
  canSupportCriterionRule,
  excerptAppearsInCapture,
  locateExcerptPages,
  type OfficialSourceMetadata,
} from "../src/shared/program-screen/source-capture";
import {
  humanVerificationRequiredCriterionIds,
  programFactKeys,
  retiredProgramCriterionIds,
  retiredProgramFactKeys,
  type PredicateOutcome,
  type ProgramCriterion,
  type ProgramFactKey,
  type ProgramScreenResult,
} from "../src/shared/program-screen/types";

/**
 * The atomic criterion split (2026-09-27): the nine broad pending criteria are
 * retired, and each atomic replacement rests on one proposition in a captured
 * operative source, reads controlled facts only, and carries an outcome
 * ceiling. Nothing here is human-verified; these tests keep it that way.
 */

const AS_OF = fixtureJson.as_of;
const SUBJECT = {
  case_id: "case-fictional-program-screen-atomic-test",
  property_id: "property-fictional-program-screen-atomic-test",
};

const criteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
const atomicIds = [...humanVerificationRequiredCriterionIds] as string[];
const atomic = atomicIds.map((id) => byId.get(id) as ProgramCriterion);

const captureText: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).map(([path, text]) => [path.replace(/^\.\.\//, "app/"), text]),
);
const captureMetadata: Record<string, OfficialSourceMetadata> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/official-sources/*/metadata.json", {
      import: "default",
      eager: true,
    }) as Record<string, OfficialSourceMetadata>,
  ).map(([path, metadata]) => [path.replace(/^\.\.\//, "app/").replace(/metadata\.json$/, "extracted.txt"), metadata]),
);
const proposals = (
  Object.values(
    import.meta.glob("../fixtures/program-screen/proposed-verifications/*.json", {
      import: "default",
      eager: true,
    }) as Record<string, unknown>,
  ) as unknown[]
).map((value) => proposedVerificationSchema.parse(value) as ProposedVerification);
const components = proposals.flatMap((proposal) =>
  proposal.candidate_components.map((component) => ({ proposal, component })),
);
const criteriaSources = import.meta.glob("../src/shared/program-screen/criteria/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
/** Production Program Screen modules, except the proposal registry (never imported by the evaluator). */
const productionSources = Object.fromEntries(
  Object.entries(
    import.meta.glob("../src/shared/program-screen/**/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).filter(([path]) => !path.endsWith("/proposed-verification.ts")),
);

function fixtureRecords(): CanonicalEvidenceRecord[] {
  return structuredClone(fixtureJson.evidence_records) as CanonicalEvidenceRecord[];
}

function evaluateFixture(records = fixtureRecords()): ProgramScreenResult {
  return evaluateProgramScreen({ evidence_records: records, as_of: AS_OF });
}

function statusOf(result: ProgramScreenResult, id: string) {
  const found = result.pathways.flatMap((pathway) => pathway.criteria).find((c) => c.criterion_id === id);
  if (!found) throw new Error(`Missing criterion ${id}`);
  return found.status;
}

function statuses(result: ProgramScreenResult): Array<[string, string]> {
  return result.pathways.flatMap((pathway) =>
    pathway.criteria.map((criterion) => [criterion.criterion_id, criterion.status] as [string, string]),
  );
}

function evidence(
  id: string,
  key: ProgramFactKey,
  value: boolean | string | number | null,
  options: { evidenceType?: CanonicalEvidenceRecord["evidence_type"] } = {},
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
      agency: "Fictional City source",
      title: `Fictional ${key} observation`,
      description: "FICTIONAL test record.",
      url: `https://records.example.test/program-screen-atomic/${id}`,
      authority: "official",
      retrieved_at: "2026-09-18T12:00:00.000Z",
    },
    raw_observed_value: !known ? { kind: "not_observed", value: null } : { kind: "text", value: String(value) },
    normalized_value: normalized,
    evidence_type:
      options.evidenceType ??
      (!known
        ? "lookup_attempt"
        : spec.allowed_evidence_types !== null
          ? spec.allowed_evidence_types[0]
          : "official_portal"),
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
  return [
    evidence("a-parcel", "parcel-match", true),
    evidence("a-jurisdiction", "jurisdiction", "City of Los Angeles"),
  ];
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

/**
 * TEST-ONLY: a copy of a shipped criterion relabeled with a test ID and a
 * runnable rule, so the evaluator's outcome ceiling can be exercised. Such a
 * copy could never ship: the real IDs require human verification.
 */
function runnableCopy(id: string, outcome: PredicateOutcome) {
  const original = byId.get(id) as ProgramCriterion;
  const spy = vi.fn(() => outcome);
  const copy: ProgramCriterion = {
    ...original,
    id: `${original.pathway}.test-only-ceiling`,
    predicate: spy,
    verification: "repo_sourced",
    question_if_judgment: "How does Planning apply this criterion?",
  };
  return { copy, spy };
}

/** Runs a criterion with reviewed, established values for its facts. */
function runWith(criterion: ProgramCriterion, values: Partial<Record<ProgramFactKey, boolean | string | number>>) {
  const records = criterion.fact_keys.map((key, index) => evidence(`v-${index}`, key, values[key] ?? null));
  const facts = new Map(assessProgramFacts(records, criterion.fact_keys).map((fact) => [fact.key, fact]));
  return evaluateProgramCriterion(criterion, facts, AS_OF);
}

const restrictedSiteCategories = [
  "la_shra.hazardous-waste-site",
  "la_shra.special-flood-hazard-area",
  "la_shra.regulatory-floodway",
  "la_shra.earthquake-fault-zone",
];
const lowRiseExclusions = [
  "la_low_rise.manufacturing-zone-exclusion",
  "la_low_rise.single-family-zone-exclusion",
  "la_low_rise.fire-restriction-area-exclusion",
  "la_low_rise.coastal-zone-exclusion",
  "la_low_rise.sea-level-rise-area-exclusion",
  "la_low_rise.excluded-plan-area",
];
const temporaryExemptionIds = atomicIds.filter((id) => id.startsWith("la_sb79.temporary-exemption"));

/* ------------------------------------------------------------------ 1 */

describe("Retired broad criteria", () => {
  it("ships none of the nine and maps each to its atomic replacements", () => {
    expect(retiredProgramCriterionIds).toHaveLength(9);
    for (const id of retiredProgramCriterionIds) expect(byId.has(id), id).toBe(false);
    expect(Object.keys(retiredProgramCriteria).sort()).toEqual([...retiredProgramCriterionIds].sort());
    // The replacements partition the atomic criteria exactly: none lost, none shared.
    const replacements = Object.values(retiredProgramCriteria).flatMap((entry) => entry.replaced_by);
    expect([...replacements].sort()).toEqual([...atomicIds].sort());
    expect(new Set(replacements).size).toBe(replacements.length);
    for (const entry of Object.values(retiredProgramCriteria)) expect(entry.removed.length).toBeGreaterThan(0);
  });

  it("matches the proposal that records each split", () => {
    for (const proposal of proposals) {
      const shippedComponents = proposal.candidate_components
        .filter((component) => (shippedComponentDispositions as readonly string[]).includes(component.disposition))
        .map((component) => component.component_id);
      expect([...shippedComponents].sort(), proposal.retired_criterion_id).toEqual(
        [...retiredProgramCriteria[proposal.retired_criterion_id].replaced_by].sort(),
      );
    }
  });

  it("rejects a criterion that reuses a retired ID", () => {
    for (const id of retiredProgramCriterionIds) {
      const reused = { ...(byId.get(atomicIds[0]) as ProgramCriterion), id, pathway: id.split(".")[0] };
      expect(programCriterionSchema.safeParse(reused).success, id).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ 2 */

describe("Atomic criteria are source-traceable", () => {
  it("rests every atomic criterion on an operative capture it quotes exactly", () => {
    const operativePaths = Object.values(capturedOperativeSources) as string[];
    expect(operativePaths).toHaveLength(3);
    expect(operativePaths.join(" ")).not.toContain("low-rise-draft");
    for (const criterion of atomic) {
      const path = criterion.basis.repo_path;
      expect(operativePaths, criterion.id).toContain(path);
      const metadata = captureMetadata[path];
      expect(canSupportCriterionRule(metadata), criterion.id).toBe(true);
      expect(metadata.source_type).not.toBe("proposed_draft");
      expect(criterion.citation.url, criterion.id).toBe(metadata.official_url);
      expect(criterion.citation.pinpoint, criterion.id).toMatch(/page/);
      expect(criterion.basis.excerpts.length).toBeGreaterThan(0);
      for (const excerpt of criterion.basis.excerpts) {
        expect(excerptAppearsInCapture(excerpt, captureText[path]), `${criterion.id}: ${excerpt}`).toBe(true);
      }
    }
  });

  it("pins every excerpt to its page through exactly one proposal component with a reviewer question", () => {
    for (const criterion of atomic) {
      const matches = components.filter(({ component }) => component.component_id === criterion.id);
      expect(matches, criterion.id).toHaveLength(1);
      const [{ proposal, component }] = matches;
      expect(captureMetadata[criterion.basis.repo_path].source_id).toBe(proposal.source_id);
      expect(component.pinpoint).toBe(criterion.citation.pinpoint);
      expect(component.excerpts.map((excerpt) => excerpt.text)).toEqual([...criterion.basis.excerpts]);
      for (const { page, text } of component.excerpts) {
        expect(locateExcerptPages(text, captureText[criterion.basis.repo_path]), `${criterion.id} p. ${page}`).toContain(page);
      }
      expect(component.reviewer_question).toMatch(/\?/);
    }
  });
});

/* ------------------------------------------------------------------ 3 */

// Updated in Phase 3E: d (la_shra.high-fire-hazard-severity-zone) is the one human-verified atomic
// criterion (docs/PROGRAM_SCREEN_PHASE_3E_D_PROMOTION_REVIEW.md). Every other one is unchanged.
const PHASE_3E_PROMOTED = "la_shra.high-fire-hazard-severity-zone";
// Updated in Phase 3H: c (la_shra.very-high-fire-hazard-severity-zone) is human-verified as well
// (docs/PROGRAM_SCREEN_PHASE_3H_C_PROMOTION_REVIEW.md).
const PHASE_3H_PROMOTED = "la_shra.very-high-fire-hazard-severity-zone";
const PROMOTED: readonly string[] = [PHASE_3H_PROMOTED, PHASE_3E_PROMOTED];

describe("Only c and d are human-verified", () => {
  it("keeps the other 44 pending, with no rule and no record, and blocks release on each", () => {
    expect(atomic).toHaveLength(46);
    const result = evaluateFixture();
    for (const criterion of atomic.filter((candidate) => !PROMOTED.includes(candidate.id))) {
      expect(criterion, criterion.id).toMatchObject({ verification: "pending_human", human_verification: null });
      expect(typeof criterion.predicate, criterion.id).not.toBe("function");
      expect(criterionAwaitsHumanVerification(criterion)).toBe(true);
      expect(result.release.blockers).toContainEqual(
        expect.objectContaining({ code: "pending_human_criterion", ref: criterion.id }),
      );
    }
    for (const id of PROMOTED) {
      const promoted = byId.get(id) as ProgramCriterion;
      expect(promoted.verification, id).toBe("human_verified");
      expect(typeof promoted.predicate, id).toBe("function");
      expect(criterionAwaitsHumanVerification(promoted), id).toBe(false);
      expect(result.release.blockers).not.toContainEqual(expect.objectContaining({ code: "pending_human_criterion", ref: id }));
    }
    expect(criteria.filter((criterion) => criterion.verification === "human_verified").map((criterion) => criterion.id)).toEqual([...PROMOTED]);
  });

  it("pins which atomic criteria are professional judgment and which have no encoded rule", () => {
    const professional = atomic.filter((criterion) => criterion.predicate === "professional_judgment");
    const notEncoded = atomic.filter((criterion) => criterion.predicate === "not_encoded");
    // Updated in Phase 3E: d's rule is encoded. Updated in Phase 3H: c's rule is encoded.
    expect(notEncoded).toHaveLength(34);
    expect(notEncoded.map((criterion) => criterion.id)).not.toContain(PHASE_3E_PROMOTED);
    expect(notEncoded.map((criterion) => criterion.id)).not.toContain(PHASE_3H_PROMOTED);
    expect(professional.map((criterion) => criterion.id)).toEqual([
      "la_shra.protected-housing-tenant-occupancy",
      "la_shra.protected-housing-demolition-or-alteration",
      "la_shra.protected-species-habitat",
      "la_sb79.permanent-exemption-walking-path",
      "la_sb79.permanent-exemption-industrial-hub",
      "la_sb79.temporary-exemption-capacity-criteria",
      "la_low_rise.subarea-distance-bands",
      "la_low_rise.subarea-geographic-criteria",
      "la_low_rise.c10-exception-path",
      "la_low_rise.tod-subarea-historic-limit",
    ]);
  });

  it("refuses to run an atomic rule marked human-verified without a record", () => {
    const original = byId.get("la_shra.single-family-lot-area-threshold") as ProgramCriterion;
    const spy = vi.fn(() => "disqualifying_per_source" as const);
    const promoted = {
      ...original,
      predicate: spy,
      verification: "human_verified" as const,
      question_if_judgment: "How does Planning apply this criterion?",
    };
    expect(programCriterionSchema.safeParse(promoted).success).toBe(false);
    const result = runWith(promoted, { "shra-zone-category": "single_family_listed_zone", "lot-area": 100000 });
    expect(result).toMatchObject({ status: "unreviewed", unreviewed_reasons: ["criterion_pending_human"] });
    expect(spy).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ 4 */

describe("Unsupported facts never feed a rule", () => {
  it("classifies every fact and keeps free text and displays out of the controlled class", () => {
    for (const key of programFactKeys) {
      const spec = programFactSpecs[key];
      if (spec.value.kind === "text" && spec.value.allowed === null) {
        expect(spec.data_class, key).not.toBe("controlled_value");
      }
      if (spec.role === "program_flag") expect(spec.data_class, key).toBe("source_observation");
    }
    const byClass = (dataClass: string) =>
      programFactKeys.filter((key) => programFactSpecs[key].data_class === dataClass);
    expect(byClass("source_observation")).toEqual([
      "zoning",
      "rso-status",
      "zimas-shra-program-field",
      "zimas-sb79-category",
      "zimas-sb79-tier",
      "zimas-sb79-exemption",
      "zimas-low-rise-category",
    ]);
    expect(byClass("professional_input")).toEqual(["historic-designation", "existing-structures", "occupancy-history"]);
  });

  it("lets every encoded or pending rule read controlled values only", () => {
    for (const criterion of criteria.filter((candidate) => candidate.predicate !== "professional_judgment")) {
      for (const key of criterion.fact_keys) {
        expect(programFactSpecs[key].data_class, `${criterion.id} reads ${key}`).toBe("controlled_value");
      }
    }
  });

  it.each(["zoning", "occupancy-history", "existing-structures", "historic-designation", "rso-status"] as const)(
    "rejects a rule that reads %s, but lets a professional judgment consider it",
    (key) => {
      const base = byId.get("la_shra.zone-category") as ProgramCriterion;
      expect(programCriterionSchema.safeParse({ ...base, fact_keys: [key] }).success).toBe(false);
      expect(
        programCriterionSchema.safeParse({
          ...base,
          fact_keys: [key],
          predicate: () => "consistent_with_source",
          verification: "repo_sourced",
          id: "la_shra.test-only-rule",
          question_if_judgment: "How does Planning apply this criterion?",
        }).success,
      ).toBe(false);
      const professional = byId.get("la_shra.protected-housing-tenant-occupancy") as ProgramCriterion;
      expect(programCriterionSchema.safeParse({ ...professional, fact_keys: [key] }).success).toBe(true);
    },
  );

  it("retires ten keys with a reason, and rejects evidence for any of them", () => {
    expect(retiredProgramFactKeys).toHaveLength(10);
    expect(Object.keys(retiredProgramFacts).sort()).toEqual([...retiredProgramFactKeys].sort());
    for (const key of retiredProgramFactKeys) {
      expect((programFactKeys as readonly string[]).includes(key), key).toBe(false);
      const retired = retiredProgramFacts[key];
      if (retired.migration === "rename") {
        expect(retired.replaced_by).toHaveLength(1);
      }
      const record = { ...evidence("r", "parcel-match", true), claim: { key, label: key, client_label: key } };
      try {
        parseProgramScreenEvidence([record]);
        throw new Error(`Retired key ${key} was accepted.`);
      } catch (error) {
        expect(error).toMatchObject({ code: "INVALID_PROGRAM_SCREEN_EVIDENCE" });
        expect((error as Error).message).toContain(`Fact key ${key} is retired`);
      }
    }
  });

  it("keeps a renamed fact's value shape and evidence types", () => {
    for (const retired of Object.values(retiredProgramFacts).filter((entry) => entry.migration === "rename")) {
      const replacement = programFactSpecs[retired.replaced_by[0]];
      expect(replacement.value).toEqual({ kind: "boolean" });
      expect(replacement.allowed_evidence_types).toEqual(["official_document", "lookup_attempt"]);
    }
  });
});

/* ------------------------------------------------------------------ 5 */

describe("No zoning string is parsed", () => {
  it("never reads the zoning string in any criterion", () => {
    expect(programFactSpecs.zoning).toMatchObject({ data_class: "source_observation", value: { kind: "text", allowed: null } });
    expect(criteria.filter((criterion) => criterion.fact_keys.includes("zoning"))).toEqual([]);
    for (const [path, source] of Object.entries(criteriaSources)) {
      expect(source, path).not.toMatch(/textFact\(\s*facts,\s*"zoning"\s*\)/);
      expect(source, path).not.toMatch(/facts\[\s*"zoning"\s*\]/);
    }
  });

  it("gives the same result whatever the zoning string says", () => {
    const baseline = statuses(evaluateFixture());
    for (const value of ["R1-1", "M2-1", "RD1.5-1XL", "CM-1-HPOZ", "[Q]R3-1", "Fictional zone B"]) {
      const records = fixtureRecords();
      const zoning = records.find((record) => record.id === "ps-zoning") as CanonicalEvidenceRecord;
      zoning.raw_observed_value = { kind: "text", value };
      zoning.normalized_value = { kind: "text", value };
      expect(statuses(evaluateFixture(records)), value).toEqual(baseline);
    }
  });

  it("records zone groups as separate controlled facts a person enters", () => {
    for (const key of [
      "shra-zone-category",
      "low-rise-zone-class",
      "low-rise-manufacturing-zone-lot",
      "low-rise-single-family-zone-lot",
    ] as const) {
      expect(programFactSpecs[key].data_class, key).toBe("controlled_value");
    }
    expect(programFactSpecs["shra-zone-category"].value).toEqual({
      kind: "text",
      allowed: ["single_family_listed_zone", "zone_not_on_single_family_list"],
    });
  });
});

/* ------------------------------------------------------------------ 6 */

describe("High and Very High fire hazard stay distinct", () => {
  it("keeps separate facts and separate SHRA criteria", () => {
    expect(programFactSpecs["very-high-fire-hazard-severity-zone"].label).toBe("Very High Fire Hazard Severity Zone");
    expect(programFactSpecs["high-fire-hazard-severity-zone"].label).toBe("High Fire Hazard Severity Zone");
    expect(byId.get("la_shra.very-high-fire-hazard-severity-zone")?.fact_keys).toEqual([
      "very-high-fire-hazard-severity-zone",
    ]);
    expect(byId.get("la_shra.high-fire-hazard-severity-zone")?.fact_keys).toEqual(["high-fire-hazard-severity-zone"]);
    for (const criterion of criteria) {
      const both =
        criterion.fact_keys.includes("very-high-fire-hazard-severity-zone") &&
        criterion.fact_keys.includes("high-fire-hazard-severity-zone");
      expect(both, criterion.id).toBe(false);
    }
    // SB 79 Sec. 2.F names Very High only; a High zone is not part of that test.
    expect(byId.get("la_sb79.temporary-exemption-fire-or-state-responsibility-area")?.fact_keys).toEqual([
      "very-high-fire-hazard-severity-zone",
      "state-responsibility-area",
    ]);
  });

  it("never lets a Very High record of no stand in for the High designation", () => {
    const result = evaluateProgramScreen({
      evidence_records: [...anchors(), evidence("vh", "very-high-fire-hazard-severity-zone", false)],
      as_of: AS_OF,
    });
    // Updated in Phase 3H: c runs, but an unattested record establishes no route, so c stays unknown.
    expect(statusOf(result, "la_shra.very-high-fire-hazard-severity-zone")).toBe("unknown");
    expect(statusOf(result, "la_shra.high-fire-hazard-severity-zone")).toBe("unknown");
    const high = result.facts.find((fact) => fact.key === "high-fire-hazard-severity-zone");
    expect(high).toMatchObject({ supplied: false, classification: "unknown" });
  });

  it("keeps High unknown in the fixture while Very High stays in conflict", () => {
    const result = evaluateFixture();
    expect(statusOf(result, "la_shra.very-high-fire-hazard-severity-zone")).toBe("conflict");
    expect(statusOf(result, "la_shra.high-fire-hazard-severity-zone")).toBe("unknown");
  });
});

/* ------------------------------------------------------------------ 7 */

describe("A conditional hazard is never a blocker by itself", () => {
  it.each(restrictedSiteCategories)("caps %s below blocking and declares its unmodeled conditions", (id) => {
    const criterion = byId.get(id) as ProgramCriterion;
    expect(criterion.permitted_outcomes).toEqual(["consistent_with_source", "requires_judgment"]);
    expect(criterion.exception_paths).toHaveLength(1);
    expect(criterion.exception_paths[0].fact_keys).toEqual([]);

    // Present and reviewed: no result while pending.
    const [key] = criterion.fact_keys;
    expect(runWith(criterion, { [key]: true }).status).toBe("unreviewed");

    // A runnable copy that tries to block is rejected by the evaluator.
    const { copy, spy } = runnableCopy(id, "disqualifying_per_source");
    expectValidationCode(() => runWith(copy, { [key]: true }), "PREDICATE_OUTCOME_NOT_PERMITTED");
    expect(spy).toHaveBeenCalledTimes(1);

    // Widening the ceiling without a modeled condition fact fails validation.
    const widened = {
      ...criterion,
      permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    };
    expect(programCriterionSchema.safeParse(widened).success).toBe(false);
  });

  it("lets a runnable copy of a restricted category report a present hazard only as judgment", () => {
    const { copy } = runnableCopy("la_shra.special-flood-hazard-area", "requires_judgment");
    expect(runWith(copy, { "special-flood-hazard-area": true }).status).toBe("professional");
  });
});

/* ------------------------------------------------------------------ 8 */

describe("Missing prior-subdivision history stays unknown", () => {
  it("leaves the fixture's map history unknown after dropping the old yes/no", () => {
    const result = evaluateFixture();
    expect(statusOf(result, "la_shra.prior-shra-or-sb9-map")).toBe("unknown");
    expect(result.facts.find((fact) => fact.key === "prior-shra-or-sb9-map")).toMatchObject({
      supplied: false,
      classification: "unknown",
    });
  });

  it("keeps an incomplete map-history lookup unknown, never a none value", () => {
    const result = evaluateProgramScreen({
      evidence_records: [...anchors(), evidence("m", "prior-shra-or-sb9-map", null)],
      as_of: AS_OF,
    });
    expect(statusOf(result, "la_shra.prior-shra-or-sb9-map")).toBe("unknown");
    expect(result.planning_questions).toContainEqual(
      expect.objectContaining({
        id: "la_shra:la_shra.prior-shra-or-sb9-map:unknown",
        why_confirmation_needed: expect.stringContaining("Missing or incomplete evidence is not treated as a no."),
      }),
    );
  });

  it("records whether a map was recorded and under which statute, with no value for an incomplete history", () => {
    expect(programFactSpecs["prior-shra-or-sb9-map"].value).toEqual({
      kind: "text",
      allowed: [
        "shra_map_recorded",
        "sb9_map_recorded",
        "shra_or_sb9_tentative_map_not_recorded",
        "other_basis_map_recorded",
        "no_map_recorded",
      ],
    });
    // The retired yes/no cannot be supplied at all.
    const old = { ...evidence("p", "parcel-match", false), claim: { key: "prior-subdivisions", label: "Prior subdivisions", client_label: "x" } };
    expectValidationCode(() => parseProgramScreenEvidence([old]), "INVALID_PROGRAM_SCREEN_EVIDENCE");
  });
});

/* ------------------------------------------------------------------ 9 */

describe("Housing Element site status alone cannot disqualify", () => {
  it.each(["la_shra.housing-element-projected-units", "la_shra.housing-element-lower-income-units"])(
    "caps %s below blocking for every listing value",
    (id) => {
      const criterion = byId.get(id) as ProgramCriterion;
      expect(criterion.fact_keys).toEqual(["housing-element-site-listing"]);
      expect(criterion.permitted_outcomes).toEqual(["consistent_with_source", "requires_judgment"]);
      for (const listing of ["appendix_4_1", "appendix_4_2", "appendix_4_3", "not_listed"]) {
        expect(runWith(criterion, { "housing-element-site-listing": listing }).status, listing).toBe("unreviewed");
        const { copy } = runnableCopy(id, "disqualifying_per_source");
        expectValidationCode(
          () => runWith(copy, { "housing-element-site-listing": listing }),
          "PREDICATE_OUTCOME_NOT_PERMITTED",
        );
      }
    },
  );

  it("has no project unit count to compare with, so no rule can reach a blocker", () => {
    for (const key of programFactKeys) expect(key).not.toMatch(/proposed-units|unit-count/);
  });
});

/* ----------------------------------------------------------------- 10 */

describe("SB 79 permanent exemption: a parcel not shown is never clear", () => {
  const shown = "la_sb79.permanent-exemption-shown";

  it("permits only the affirmative direction", () => {
    const criterion = byId.get(shown) as ProgramCriterion;
    expect(criterion.permitted_outcomes).toEqual(["disqualifying_per_source", "requires_judgment"]);
    expect(runWith(criterion, { "sb79-permanent-exemption-shown": false }).status).toBe("unreviewed");
    const { copy } = runnableCopy(shown, "consistent_with_source");
    expectValidationCode(
      () => runWith(copy, { "sb79-permanent-exemption-shown": false }),
      "PREDICATE_OUTCOME_NOT_PERMITTED",
    );
  });

  it("keeps Section 1.A and 1.B as standing professional judgments", () => {
    for (const id of ["la_sb79.permanent-exemption-walking-path", "la_sb79.permanent-exemption-industrial-hub"]) {
      expect(byId.get(id), id).toMatchObject({ predicate: "professional_judgment", fact_keys: [] });
    }
    const result = evaluateProgramScreen({
      evidence_records: [...anchors(), evidence("s", "sb79-permanent-exemption-shown", false)],
      as_of: AS_OF,
    });
    expect(statusOf(result, "la_sb79.permanent-exemption-walking-path")).toBe("professional");
    expect(result.pathways.find((pathway) => pathway.pathway === "la_sb79")?.rollup).not.toBe(
      "no_disqualifier_found_in_reviewed_sources",
    );
  });
});

/* ----------------------------------------------------------------- 11 */

describe("SB 79 temporary exemption cannot become a production disqualifier", () => {
  it("caps every temporary-exemption criterion below blocking", () => {
    expect(temporaryExemptionIds).toEqual([
      "la_sb79.temporary-exemption-all-parcels",
      "la_sb79.temporary-exemption-period",
      "la_sb79.temporary-exemption-shown",
      "la_sb79.temporary-exemption-capacity-criteria",
      "la_sb79.temporary-exemption-tod-alternative-plan",
      "la_sb79.temporary-exemption-fire-or-state-responsibility-area",
      "la_sb79.temporary-exemption-sea-level-rise",
      "la_sb79.temporary-exemption-historic-resource",
    ]);
    for (const id of temporaryExemptionIds) {
      expect(byId.get(id)?.permitted_outcomes, id).not.toContain("disqualifying_per_source");
    }
    // The Sec. 4 statement and the map showing may only route to judgment.
    expect(byId.get("la_sb79.temporary-exemption-all-parcels")?.permitted_outcomes).toEqual(["requires_judgment"]);
    expect(byId.get("la_sb79.temporary-exemption-shown")?.permitted_outcomes).toEqual(["requires_judgment"]);
  });

  it("states the rule in the source next to the criteria", () => {
    const source = Object.entries(criteriaSources).find(([path]) => path.endsWith("/sb79-low-rise.ts"))?.[1] ?? "";
    expect(source).toContain("SB 79 TEMPORARY EXEMPTION: HIGHEST-RISK UNRESOLVED ITEM.");
    expect(source).toContain("may become a production disqualifier merely from");
  });

  it.each(temporaryExemptionIds.filter((id) => byId.get(id)?.predicate === "not_encoded"))(
    "rejects a runnable copy of %s that tries to block",
    (id) => {
      const criterion = byId.get(id) as ProgramCriterion;
      const { copy } = runnableCopy(id, "disqualifying_per_source");
      const values = Object.fromEntries(
        criterion.fact_keys.map((key) => [key, key === "jurisdiction" ? "City of Los Angeles" : true]),
      );
      expectValidationCode(() => runWith(copy, values), "PREDICATE_OUTCOME_NOT_PERMITTED");
    },
  );

  it("draws no blocker for a City parcel with every temporary-exemption fact present", () => {
    const result = evaluateProgramScreen({
      evidence_records: [
        ...anchors(),
        evidence("t1", "sb79-temporary-exemption-shown", true),
        evidence("t2", "seventh-housing-element-revision-adopted", false),
        evidence("t3", "tod-alternative-plan-area", true),
        evidence("t4", "very-high-fire-hazard-severity-zone", true),
        evidence("t5", "state-responsibility-area", true),
        evidence("t6", "sb79-sea-level-rise-vulnerability", true),
        evidence("t7", "hcm-or-hpoz-designated-by-2025-01-01", true),
      ],
      as_of: AS_OF,
    });
    const sb79 = result.pathways.find((pathway) => pathway.pathway === "la_sb79");
    for (const id of temporaryExemptionIds) {
      expect(["unreviewed", "professional"], id).toContain(statusOf(result, id));
    }
    expect(sb79?.rollup).not.toBe("documented_disqualifier");
    expect(result.counts.criteria.disqualifying_per_source).toBe(0);
  });
});

/* ----------------------------------------------------------------- 12 */

describe("Low-Rise exclusions cannot block without their exceptions", () => {
  it.each(lowRiseExclusions)("carries the (c)(10) exception on %s and caps it below blocking", (id) => {
    const criterion = byId.get(id) as ProgramCriterion;
    expect(criterion.permitted_outcomes).toEqual(["consistent_with_source", "requires_judgment"]);
    expect(criterion.exception_paths.map((exception) => exception.label)).toContain(
      "(c)(10) path for an SB 79 site not exempt under the Phased Implementation Ordinance",
    );
    const widened = {
      ...criterion,
      permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
    };
    expect(programCriterionSchema.safeParse(widened).success).toBe(false);
  });

  it("requires every exception fact to be read before a criterion may block", () => {
    const base = byId.get("la_low_rise.single-family-zone-exclusion") as ProgramCriterion;
    const exception = { label: "TEST-ONLY exception", pinpoint: "TEST-ONLY", fact_keys: ["coastal-zone"] as ProgramFactKey[] };
    const testOnly = {
      ...base,
      id: "la_low_rise.test-only-exclusion",
      verification: "repo_sourced" as const,
      predicate: () => "consistent_with_source" as const,
      question_if_judgment: "How does Planning apply this criterion?",
      permitted_outcomes: ["consistent_with_source", "disqualifying_per_source", "requires_judgment"] as PredicateOutcome[],
      exception_paths: [exception],
    };
    // Declared but not read: rejected.
    expect(programCriterionSchema.safeParse(testOnly).success).toBe(false);
    // Read: the ceiling may include a blocker.
    expect(
      programCriterionSchema.safeParse({ ...testOnly, fact_keys: ["low-rise-single-family-zone-lot", "coastal-zone"] })
        .success,
    ).toBe(true);
  });

  it("keeps a triggered exclusion unresolved and a (c)(10) path open", () => {
    const result = evaluateProgramScreen({
      evidence_records: [
        ...anchors(),
        evidence("m", "low-rise-manufacturing-zone-lot", "m1_m2_m3_mr1_or_mr2_lot"),
        evidence("p", "low-rise-excluded-plan-area", "boyle_heights_community_plan"),
      ],
      as_of: AS_OF,
    });
    expect(statusOf(result, "la_low_rise.manufacturing-zone-exclusion")).toBe("unreviewed");
    expect(statusOf(result, "la_low_rise.excluded-plan-area")).toBe("unreviewed");
    expect(statusOf(result, "la_low_rise.c10-exception-path")).toBe("professional");
    expect(result.pathways.find((pathway) => pathway.pathway === "la_low_rise")?.rollup).not.toBe(
      "documented_disqualifier",
    );
  });
});

/* ----------------------------------------------------------------- 13 */

describe("The September 24, 2026 draft cannot affect production results", () => {
  it("is never a criterion basis and never named by a production module", () => {
    for (const criterion of criteria) expect(criterion.basis.repo_path, criterion.id).not.toContain("low-rise-draft");
    for (const [path, source] of Object.entries(productionSources)) {
      expect(source, path).not.toContain("low-rise-draft-2026-09-24");
    }
  });

  it("leaves every Low-Rise criterion resting on the adopted ordinance", () => {
    for (const criterion of criteria.filter((candidate) => candidate.pathway === "la_low_rise")) {
      if (criterion.verification === "repo_sourced") continue;
      expect(criterion.basis.repo_path, criterion.id).toBe(capturedOperativeSources.lowRiseOrdinance);
      expect(captureMetadata[criterion.basis.repo_path]).toMatchObject({
        source_type: "adopted_ordinance",
        operative_status: "operative",
      });
    }
  });
});

/* ----------------------------------------------------------------- 14 */

describe("Release safety", () => {
  it("keeps the fictional fixture and the public demo non-releasable", () => {
    const fixture = parseProgramScreenFixture(fixtureJson);
    const result = evaluateFixture();
    expect(fixture.expected.client_releasable).toBe(false);
    expect(result.release.client_releasable).toBe(false);
    expect(result.counts.criteria.disqualifying_per_source).toBe(0);
    const payload = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: AS_OF });
    expect(payload.release).toMatchObject({ client_releasable: false });
    // Updated in Phase 3E: d is human-verified. Updated in Phase 3H: c is human-verified.
    expect(payload.release.blocker_counts.pending_human_criterion).toBe(44);
    expect(payload.release.blocker_counts.prohibited_language).toBe(0);
  });

  it("generates no conclusion language from any atomic criterion", () => {
    for (const criterion of atomic) {
      for (const text of [
        criterion.label,
        criterion.citation.pinpoint,
        criterion.rule_summary,
        criterion.question_if_unknown,
        criterion.question_if_conflict,
        criterion.question_if_judgment ?? "",
        ...criterion.exception_paths.map((exception) => exception.label),
      ]) {
        expect(findProhibitedClientLanguage(text), `${criterion.id}: ${text}`).toEqual([]);
      }
    }
    for (const key of programFactKeys) {
      expect(findProhibitedClientLanguage(programFactSpecs[key].label), key).toEqual([]);
      expect(findProhibitedClientLanguage(programFactSpecs[key].client_label), key).toEqual([]);
    }
  });
});

/* ----------------------------------------------------------------- fixture */

describe("Fictional fixture migration", () => {
  const fixture = parseProgramScreenFixture(fixtureJson);
  const migrations = fixture.migrations ?? [];

  it("records every retired key once, as a rename or a drop", () => {
    expect(migrations.map((migration) => migration.from_fact_key).sort()).toEqual([...retiredProgramFactKeys].sort());
    expect(migrations.filter((migration) => migration.action === "rename").map((migration) => migration.evidence_id)).toEqual([
      "ps-sb79-permanent-exclusion",
      "ps-sb79-temporary-exemption",
    ]);
    for (const migration of migrations) {
      const record = fixture.evidence_records.find((candidate) => candidate.id === migration.evidence_id);
      if (migration.action === "drop") expect(record, migration.evidence_id).toBeUndefined();
      else expect(record?.claim.key).toBe(migration.to_fact_key);
    }
  });

  it("keeps renamed values unchanged and converts no dropped value", () => {
    const record = (id: string) => fixture.evidence_records.find((candidate) => candidate.id === id);
    expect(record("ps-sb79-permanent-exclusion")?.normalized_value).toEqual({ kind: "boolean", value: true });
    expect(record("ps-sb79-temporary-exemption")?.normalized_value).toEqual({ kind: "boolean", value: false });
    const supplied = new Set(fixture.evidence_records.map((candidate) => candidate.claim.key));
    for (const key of [
      "special-flood-hazard-area",
      "regulatory-floodway",
      "earthquake-fault-zone",
      "prior-shra-or-sb9-map",
      "housing-element-site-listing",
      "low-rise-excluded-plan-area",
    ]) {
      expect(supplied.has(key), key).toBe(false);
    }
  });

  it("rejects a fixture that re-adds a retired record or misstates a migration", () => {
    const readded = structuredClone(fixtureJson) as Record<string, unknown> & { evidence_records: unknown[] };
    readded.evidence_records.push({
      ...fixtureJson.evidence_records[0],
      id: "ps-flood-zone",
      claim: { key: "flood-zone", label: "Flood zone", client_label: "whether the parcel is mapped in a flood zone" },
    });
    expectValidationCode(() => parseProgramScreenFixture(readded), "INVALID_PROGRAM_SCREEN_FIXTURE");

    const wrongAction = structuredClone(fixtureJson);
    wrongAction.migrations[0].action = "drop";
    expectValidationCode(() => parseProgramScreenFixture(wrongAction), "INVALID_PROGRAM_SCREEN_FIXTURE");

    const unrenamed = structuredClone(fixtureJson);
    unrenamed.migrations[0].to_fact_key = "sb79-temporary-exemption-shown";
    expectValidationCode(() => parseProgramScreenFixture(unrenamed), "INVALID_PROGRAM_SCREEN_FIXTURE");
  });
});

/* ----------------------------------------------------------------- 16 */

describe("Program Screen stays deterministic after the split", () => {
  it("returns the same output for the same input in any record order", () => {
    const first = evaluateFixture();
    const again = evaluateFixture();
    const shuffled = fixtureRecords();
    shuffled.push(shuffled.shift() as CanonicalEvidenceRecord);
    shuffled.reverse();
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    expect(evaluateFixture(shuffled)).toEqual(first);
  });
});

/* -------------------------------------------------------------- ceilings */

describe("Atomic outcome ceilings", () => {
  it("pins every atomic criterion's permitted outcomes", () => {
    // Changing a ceiling changes what a verified rule could ever conclude; review it as such.
    expect(Object.fromEntries(atomic.map((criterion) => [criterion.id, criterion.permitted_outcomes]))).toEqual({
      "la_shra.zone-category": ["consistent_with_source", "requires_judgment"],
      "la_shra.multifamily-lot-area-threshold": ["consistent_with_source", "requires_judgment"],
      "la_shra.single-family-lot-area-threshold": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.single-family-vacancy-condition": ["consistent_with_source", "requires_judgment"],
      "la_shra.ellis-act-withdrawal": ["consistent_with_source", "requires_judgment"],
      "la_shra.protected-housing-affordability-covenant": ["consistent_with_source", "requires_judgment"],
      "la_shra.protected-housing-price-control": ["consistent_with_source", "requires_judgment"],
      "la_shra.protected-housing-tenant-occupancy": ["requires_judgment"],
      "la_shra.protected-housing-demolition-or-alteration": ["requires_judgment"],
      "la_shra.prior-shra-or-sb9-map": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.housing-element-projected-units": ["consistent_with_source", "requires_judgment"],
      "la_shra.housing-element-lower-income-units": ["consistent_with_source", "requires_judgment"],
      "la_shra.prime-or-statewide-farmland": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.wetlands": ["disqualifying_per_source", "requires_judgment"],
      "la_shra.very-high-fire-hazard-severity-zone": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.high-fire-hazard-severity-zone": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.natural-community-conservation-plan-land": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.protected-species-habitat": ["requires_judgment"],
      "la_shra.conservation-easement": ["consistent_with_source", "disqualifying_per_source", "requires_judgment"],
      "la_shra.hazardous-waste-site": ["consistent_with_source", "requires_judgment"],
      "la_shra.special-flood-hazard-area": ["consistent_with_source", "requires_judgment"],
      "la_shra.regulatory-floodway": ["consistent_with_source", "requires_judgment"],
      "la_shra.earthquake-fault-zone": ["consistent_with_source", "requires_judgment"],
      "la_sb79.permanent-exemption-shown": ["disqualifying_per_source", "requires_judgment"],
      "la_sb79.permanent-exemption-walking-path": ["requires_judgment"],
      "la_sb79.permanent-exemption-industrial-hub": ["requires_judgment"],
      "la_sb79.temporary-exemption-all-parcels": ["requires_judgment"],
      "la_sb79.temporary-exemption-period": ["consistent_with_source", "requires_judgment"],
      "la_sb79.temporary-exemption-shown": ["requires_judgment"],
      "la_sb79.temporary-exemption-capacity-criteria": ["requires_judgment"],
      "la_sb79.temporary-exemption-tod-alternative-plan": ["consistent_with_source", "requires_judgment"],
      "la_sb79.temporary-exemption-fire-or-state-responsibility-area": ["consistent_with_source", "requires_judgment"],
      "la_sb79.temporary-exemption-sea-level-rise": ["consistent_with_source", "requires_judgment"],
      "la_sb79.temporary-exemption-historic-resource": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.incentive-area-map-subarea": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.subarea-distance-bands": ["requires_judgment"],
      "la_low_rise.subarea-geographic-criteria": ["requires_judgment"],
      "la_low_rise.underlying-zone": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.manufacturing-zone-exclusion": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.single-family-zone-exclusion": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.fire-restriction-area-exclusion": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.coastal-zone-exclusion": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.sea-level-rise-area-exclusion": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.excluded-plan-area": ["consistent_with_source", "requires_judgment"],
      "la_low_rise.c10-exception-path": ["requires_judgment"],
      "la_low_rise.tod-subarea-historic-limit": ["requires_judgment"],    });
  });
});
