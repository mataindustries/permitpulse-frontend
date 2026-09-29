import { describe, expect, it } from "vitest";
import housingProgramsGuide from "../../dist/resources/los-angeles-housing-programs-chip-sb79-sb684-sb1123/index.html?raw";
import sb79LowRiseGuide from "../../dist/resources/does-sb79-low-rise-apply-los-angeles-property/index.html?raw";
import fireConflictFixture from "../fixtures/case-integrity/fire-hazard-official-source-conflict.json";
import fixtureJson from "../fixtures/program-screen/fictional-la-parcel.json";
import { IntegrityValidationError } from "../src/shared/build-week-integrity/validation";
import { capturedOperativeSources, repoSourceNotes } from "../src/shared/program-screen/criteria/common";
import {
  evaluateProgramScreen,
  programScreenPathwayPacks,
} from "../src/shared/program-screen/evaluate";
import { buildProgramScreenPublicDemoPayload } from "../src/shared/program-screen/public-demo";
import { parseProgramScreenFixture } from "../src/shared/program-screen/schema";
import {
  humanVerificationRequiredCriterionIds,
  type ProgramCriterion,
} from "../src/shared/program-screen/types";
import { excerptAppearsInCapture } from "../src/shared/program-screen/source-capture";

/** Captured operative source text, keyed by repo path ("app/fixtures/..."). */
const captures: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../fixtures/program-screen/official-sources/*/extracted.txt", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  ).map(([path, text]) => [path.replace(/^\.\.\//, "app/"), text]),
);

const fixture = parseProgramScreenFixture(fixtureJson);

function evaluate() {
  return evaluateProgramScreen({
    evidence_records: fixture.evidence_records,
    as_of: fixture.as_of,
  });
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

/** Same text the guide renders: tags dropped, whitespace collapsed. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:?])/g, "$1");
}

describe("Program Screen fictional LA parcel fixture", () => {
  it("is unmistakably fictional and carries no personal data", () => {
    expect(fixture.fictional).toBe(true);
    expect(fixture.label).toContain("FICTIONAL");
    expect(fixture.description).toContain("FICTIONAL");
    const serialized = JSON.stringify(fixtureJson);
    expect(serialized).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(serialized).not.toMatch(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
    expect(serialized).not.toMatch(/\b\d{4}-\d{3}-\d{3}\b/);
    for (const record of fixture.evidence_records) {
      expect(record.subject.case_id).toContain("fictional");
      expect(record.source.url).toMatch(/^https:\/\/records\.example\.test\//);
    }
  });

  it("rejects a fixture that is not labeled fictional or cites a real URL", () => {
    expectValidationCode(
      () => parseProgramScreenFixture({ ...fixtureJson, fictional: false }),
      "INVALID_PROGRAM_SCREEN_FIXTURE",
    );
    const realUrl = structuredClone(fixtureJson);
    realUrl.evidence_records[0].source.url = "https://zimas.lacity.org/";
    expectValidationCode(() => parseProgramScreenFixture(realUrl), "INVALID_PROGRAM_SCREEN_FIXTURE");
  });

  it("produces one conflict, one failed lookup, consistent anchors, and no verified disqualifier", () => {
    const result = evaluate();

    // Fact level: one canonical official-source conflict and one failed lookup.
    // Every other unknown fact is one the fixture never supplied (a new atomic
    // fact); none is inferred from a retired fixture field.
    expect(result.counts.facts).toMatchObject({ conflict: 1, unknown: 29 });
    expect(result.facts.filter((fact) => fact.classification === "conflict").map((fact) => fact.key)).toEqual([
      "very-high-fire-hazard-severity-zone",
    ]);
    expect(
      result.facts.filter((fact) => fact.supplied && fact.classification === "unknown").map((fact) => fact.key),
    ).toEqual(["occupancy-history"]);
    for (const fact of result.facts.filter((candidate) => !candidate.supplied)) {
      expect(fact, fact.key).toMatchObject({
        classification: "unknown",
        normalized_value: { kind: "unknown", value: null, reason: "not_observed" },
      });
    }
    expect(
      Object.fromEntries(result.facts.map((fact) => [fact.key, fact.classification])),
    ).toEqual(fixture.expected.fact_classifications);

    // Criterion level.
    expect(
      Object.fromEntries(
        result.pathways.flatMap((pathway) =>
          pathway.criteria.map((criterion) => [criterion.criterion_id, criterion.status]),
        ),
      ),
    ).toEqual(fixture.expected.criterion_statuses);
    expect(result.counts.criteria).toEqual({
      conflict: 4,
      unknown: 32,
      professional: 8,
      unreviewed: 4,
      consistent_with_source: 7,
      disqualifying_per_source: 0,
    });

    // Pathway level.
    expect(
      Object.fromEntries(result.pathways.map((pathway) => [pathway.pathway, pathway.rollup])),
    ).toEqual(fixture.expected.pathway_rollups);
    expect(result.counts.pathways).toEqual({
      documented_disqualifier: 0,
      contested: 3,
      undetermined: 0,
      no_disqualifier_found_in_reviewed_sources: 0,
    });
    for (const pathway of result.pathways) {
      expect(pathway.statement).not.toMatch(/eligib|qualif|by[- ]right|buildable|approved|guarantee|entitle/i);
    }
    expect(result.release.client_releasable).toBe(fixture.expected.client_releasable);
  });

  it("reuses the canonical evaluator for the copied fire-hazard conflict", () => {
    const fire = evaluate().facts.find((fact) => fact.key === "very-high-fire-hazard-severity-zone");

    // Same canonical conflict template as the Case Integrity fixture. Phase 3C
    // renamed the Program Screen's Very High client label (Phase 3B deferred
    // change very_high_fire_client_label); the Case Integrity fixture keeps its own.
    const caseIntegrityLabel = fireConflictFixture.evidence_records[0].claim.client_label;
    expect(fireConflictFixture.expected.client_safe_statement).toBe(`Official sources conflict regarding ${caseIntegrityLabel}.`);
    expect(fire?.statement).toBe(`Official sources conflict regarding ${fire?.client_label}.`);
    expect(fire?.client_label).toBe("whether the parcel is mapped in a Very High Fire Hazard Severity Zone");
    expect(fire?.normalized_value).toEqual({
      kind: "unresolved",
      value: null,
      reason: "conflicting_evidence",
    });
    expect(fire?.evidence.map((citation) => [citation.source_agency, citation.retrieved_at])).toEqual([
      ["CAL FIRE", "2026-07-10T16:05:00.000Z"],
      ["ZIMAS / City source", "2026-07-10T16:12:00.000Z"],
    ]);
  });

  it("traces every decisive pathway result to criteria with citations", () => {
    const result = evaluate();
    const criteria = new Map(
      programScreenPathwayPacks.flatMap((pack) => pack.criteria).map((criterion) => [criterion.id, criterion]),
    );

    for (const pathway of result.pathways) {
      expect(pathway.decisive_criteria.length).toBeGreaterThan(0);
      for (const id of pathway.decisive_criteria) {
        const criterion = criteria.get(id) as ProgramCriterion;
        expect(criterion.pathway).toBe(pathway.pathway);
        expect(criterion.citation.url).toMatch(/^https:\/\//);
      }
    }
    // The copied fire-hazard conflict now reaches SB 79 through Ordinance 188968 Sec. 2.F.
    expect(result.pathways.find((pathway) => pathway.pathway === "la_sb79")?.decisive_criteria).toEqual([
      "la_sb79.temporary-exemption-fire-or-state-responsibility-area",
    ]);
  });

  it("generates Planning questions that name the criterion, sources, and reason", () => {
    const questions = evaluate().planning_questions;

    expect(questions.map((question) => question.id)).toEqual([
      "la_shra:la_shra.vacant-site-definition:unknown",
      "la_shra:la_shra.zone-category:unknown",
      "la_shra:la_shra.multifamily-lot-area-threshold:unknown",
      "la_shra:la_shra.single-family-lot-area-threshold:unknown",
      "la_shra:la_shra.single-family-vacancy-condition:unknown",
      "la_shra:la_shra.ellis-act-withdrawal:unknown",
      "la_shra:la_shra.protected-housing-affordability-covenant:unknown",
      "la_shra:la_shra.protected-housing-price-control:unknown",
      "la_shra:la_shra.protected-housing-tenant-occupancy:unknown",
      "la_shra:la_shra.protected-housing-demolition-or-alteration:professional",
      "la_shra:la_shra.prior-shra-or-sb9-map:unknown",
      "la_shra:la_shra.housing-element-projected-units:unknown",
      "la_shra:la_shra.housing-element-lower-income-units:unknown",
      "la_shra:la_shra.prime-or-statewide-farmland:unknown",
      "la_shra:la_shra.wetlands:unknown",
      "la_shra:la_shra.very-high-fire-hazard-severity-zone:conflict",
      "la_shra:la_shra.high-fire-hazard-severity-zone:unknown",
      "la_shra:la_shra.natural-community-conservation-plan-land:unknown",
      "la_shra:la_shra.protected-species-habitat:professional",
      "la_shra:la_shra.conservation-easement:unknown",
      "la_shra:la_shra.hazardous-waste-site:unknown",
      "la_shra:la_shra.special-flood-hazard-area:unknown",
      "la_shra:la_shra.regulatory-floodway:unknown",
      "la_shra:la_shra.earthquake-fault-zone:unknown",
      "la_sb79:la_sb79.permanent-exemption-walking-path:professional",
      "la_sb79:la_sb79.permanent-exemption-industrial-hub:professional",
      "la_sb79:la_sb79.temporary-exemption-period:unknown",
      "la_sb79:la_sb79.temporary-exemption-capacity-criteria:professional",
      "la_sb79:la_sb79.temporary-exemption-tod-alternative-plan:unknown",
      "la_sb79:la_sb79.temporary-exemption-fire-or-state-responsibility-area:conflict",
      "la_sb79:la_sb79.temporary-exemption-sea-level-rise:unknown",
      "la_sb79:la_sb79.temporary-exemption-historic-resource:unknown",
      "la_sb79:zimas-sb79-exemption:program_flag_unexplained",
      "la_low_rise:la_low_rise.overlay-review:conflict",
      "la_low_rise:la_low_rise.incentive-area-map-subarea:unknown",
      "la_low_rise:la_low_rise.subarea-distance-bands:professional",
      "la_low_rise:la_low_rise.subarea-geographic-criteria:professional",
      "la_low_rise:la_low_rise.underlying-zone:unknown",
      "la_low_rise:la_low_rise.manufacturing-zone-exclusion:unknown",
      "la_low_rise:la_low_rise.single-family-zone-exclusion:unknown",
      "la_low_rise:la_low_rise.fire-restriction-area-exclusion:conflict",
      "la_low_rise:la_low_rise.sea-level-rise-area-exclusion:unknown",
      "la_low_rise:la_low_rise.excluded-plan-area:unknown",
      "la_low_rise:la_low_rise.c10-exception-path:professional",
      "la_low_rise:la_low_rise.tod-subarea-historic-limit:unknown",
    ]);
    const criteria = new Map(
      programScreenPathwayPacks.flatMap((pack) => pack.criteria).map((criterion) => [criterion.id, criterion]),
    );
    for (const question of questions) {
      expect(question.directed_to).toBe("Los Angeles City Planning");
      expect(question.criterion_ids.length).toBeGreaterThan(0);
      expect(question.citations.length).toBe(question.criterion_ids.length);
      expect(question.why_confirmation_needed.length).toBeGreaterThan(0);
      if (question.trigger === "conflict") expect(question.sources.length).toBeGreaterThan(1);
      if (question.trigger === "unknown" && question.sources.length === 0) {
        expect(question.why_confirmation_needed).toContain("No source record was supplied.");
      }
      if (question.trigger === "professional" && question.sources.length === 0) {
        // Only a professional-judgment criterion with no parcel fact asks without a source.
        expect(criteria.get(question.criterion_ids[0])?.fact_keys).toEqual([]);
      }
    }
    const fire = questions.find((question) => question.trigger === "conflict");
    expect(fire?.sources.map((source) => source.observed_display_value)).toEqual(["YES", "NO"]);
    expect(fire?.why_confirmation_needed).toContain("does not choose between sources");
  });
});

describe("Program Screen criteria are sourced in this repository", () => {
  const notes: Record<string, string> = {
    [repoSourceNotes.sb79LowRiseGuide]: visibleText(sb79LowRiseGuide),
    [repoSourceNotes.housingProgramsGuide]: visibleText(housingProgramsGuide),
  };

  // Atomic criteria quote captured official text instead (checked below and,
  // page by page, in program-screen-atomic.test.ts); human-verified criteria
  // are checked in program-screen-verification.test.ts.
  const criteria = programScreenPathwayPacks.flatMap((pack) => pack.criteria);
  const capturedPaths = new Set<string>(Object.values(capturedOperativeSources));
  const repoNoteCriteria = criteria.filter(
    (criterion) => criterion.verification !== "human_verified" && !capturedPaths.has(criterion.basis.repo_path),
  );

  it("quotes every atomic criterion basis verbatim from a captured operative source", () => {
    const atomic = criteria.filter((criterion) => capturedPaths.has(criterion.basis.repo_path));
    expect(atomic.map((criterion) => criterion.id)).toEqual([...humanVerificationRequiredCriterionIds]);
    for (const criterion of atomic) {
      const text = captures[criterion.basis.repo_path];
      expect(text, criterion.id).toBeDefined();
      for (const excerpt of criterion.basis.excerpts) {
        expect(excerptAppearsInCapture(excerpt, text), `${criterion.id}: ${excerpt}`).toBe(true);
      }
    }
  });

  it("quotes every other criterion basis verbatim from a reviewed repo source note", () => {
    expect(repoNoteCriteria.map((criterion) => criterion.id)).toEqual([
      "la_shra.parcel-match",
      "la_shra.jurisdiction",
      "la_shra.implementation-memo-scope",
      "la_shra.vacant-site-definition",
      "la_sb79.parcel-match",
      "la_sb79.jurisdiction",
      "la_low_rise.parcel-match",
      "la_low_rise.jurisdiction",
      "la_low_rise.overlay-review",
    ]);
    for (const criterion of repoNoteCriteria) {
      const text = notes[criterion.basis.repo_path];
      expect(text, criterion.id).toBeDefined();
      for (const excerpt of criterion.basis.excerpts) {
        expect(text, `${criterion.id}: ${excerpt}`).toContain(excerpt);
      }
    }
  });

  it("links criterion citations only to official sources listed in those notes", () => {
    for (const criterion of criteria.filter((candidate) => candidate.verification !== "human_verified")) {
      const listed =
        sb79LowRiseGuide.includes(`href="${criterion.citation.url}"`) ||
        housingProgramsGuide.includes(`href="${criterion.citation.url}"`);
      expect(listed, criterion.id).toBe(true);
    }
  });

  it("marks every criterion without an encoded rule as pending human verification", () => {
    for (const criterion of criteria.filter((candidate) => candidate.predicate === "not_encoded")) {
      expect(criterion.verification).toBe("pending_human");
    }
    expect(
      criteria.filter((criterion) => criterion.verification === "pending_human").map((criterion) => criterion.id),
    ).toEqual([...humanVerificationRequiredCriterionIds]);
  });
});

describe("Program Screen public demo projection", () => {
  it("builds a deterministic, fictional, AI-free payload from the core result", () => {
    const first = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixture.as_of });
    const second = buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: fixture.as_of });
    const result = evaluate();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first).toMatchObject({
      schema_version: "program-screen-public-demo-v1",
      demo_kind: "fixture_powered",
      fictional: true,
      integrity_boundary: {
        canonical_evidence_evaluator: true,
        deterministic_evaluation: true,
        live_data_used: false,
        ai_used: false,
      },
      screen_id: result.screen_id,
      release: { client_releasable: false },
    });
    expect(first.disclosure).toContain("FICTIONAL");
    expect(first.release.blocker_counts.pending_human_criterion).toBe(46);
    expect(first.pathways.map((pathway) => pathway.rollup)).toEqual(
      result.pathways.map((pathway) => pathway.rollup),
    );
    expect(first.planning_questions).toEqual(result.planning_questions);
  });

  it("refuses to publish stale criteria", () => {
    expectValidationCode(
      () => buildProgramScreenPublicDemoPayload(fixtureJson, { as_of: "2026-10-17" }),
      "PUBLIC_DEMO_STALE_CRITERION",
    );
  });

  it("refuses to publish prohibited client-facing wording", () => {
    const [shra, ...rest] = programScreenPathwayPacks;
    const unsafe = {
      ...shra,
      criteria: shra.criteria.map((criterion) =>
        criterion.id === "la_shra.jurisdiction"
          ? { ...criterion, label: "Parcel is eligible for SHRA" }
          : criterion,
      ),
    };
    expectValidationCode(
      () =>
        buildProgramScreenPublicDemoPayload(fixtureJson, {
          as_of: fixture.as_of,
          packs: [unsafe, ...rest],
        }),
      "PUBLIC_DEMO_PROHIBITED_LANGUAGE",
    );
  });

  it("refuses a non-fictional fixture", () => {
    expectValidationCode(
      () => buildProgramScreenPublicDemoPayload({ ...fixtureJson, fictional: false }, { as_of: fixture.as_of }),
      "INVALID_PROGRAM_SCREEN_FIXTURE",
    );
  });
});
