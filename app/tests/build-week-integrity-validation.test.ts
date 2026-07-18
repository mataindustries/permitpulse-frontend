import { describe, expect, it } from "vitest";
import type {
  IntegrityDraftItem,
  IntegritySynthesisOutput,
} from "../src/shared/build-week-integrity/types";
import {
  IntegrityValidationError,
  validateIntegrityAnalystOutput,
  validateIntegritySynthesisOutput,
} from "../src/shared/build-week-integrity/validation";

const evidenceIds = new Set(["evidence-intake", "evidence-portal", "evidence-email"]);

function item(overrides: Partial<IntegrityDraftItem> = {}): IntegrityDraftItem {
  return {
    category: "evidence_contradiction",
    severity: "high",
    confidence: 92,
    title: "Receipt and portal describe different workflow stages",
    verified_fact:
      "The intake receipt records delivery while the portal capture remains at corrections requested.",
    inference:
      "The agency workflow may not have advanced to reassignment in the portal.",
    unknown: "No cited record confirms the current assigned reviewer.",
    rationale:
      "The two cited records support different statements and neither confirms reassignment.",
    evidence_ids: ["evidence-intake", "evidence-portal"],
    proposed_corrective_action:
      "Ask the agency to confirm the current workflow stage and assigned reviewer in writing.",
    packet_readiness_impact: "blocks_release",
    source_analysts: ["evidence_auditor"],
    ...overrides,
  };
}

function synthesis(items: IntegrityDraftItem[]): IntegritySynthesisOutput {
  return {
    summary:
      "The cited record confirms intake, but reviewer assignment remains unconfirmed and needs human review.",
    items,
  };
}

function expectValidationCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected integrity validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

describe("Build Week Integrity Engine deterministic validation", () => {
  it("accepts a strict Terra observation with valid current-case citations", () => {
    const output = validateIntegrityAnalystOutput(
      {
        analyst_summary:
          "The receipt and portal are both valid records but describe different workflow stages.",
        observations: [item()],
      },
      evidenceIds,
      "evidence_auditor",
    );

    expect(output.observations).toHaveLength(1);
    expect(output.observations[0]).toMatchObject({
      category: "evidence_contradiction",
      evidence_ids: ["evidence-intake", "evidence-portal"],
      source_analysts: ["evidence_auditor"],
    });
  });

  it("rejects citations that do not exist in the current case", () => {
    expectValidationCode(
      () =>
        validateIntegrityAnalystOutput(
          {
            analyst_summary: "One cited record is outside this case.",
            observations: [item({ evidence_ids: ["not-in-this-case"] })],
          },
          evidenceIds,
          "evidence_auditor",
        ),
      "INVALID_CITATION",
    );
  });

  it("rejects a material observation with no citations at the strict schema gate", () => {
    expectValidationCode(
      () =>
        validateIntegrityAnalystOutput(
          {
            analyst_summary: "This observation omitted its required support.",
            observations: [item({ evidence_ids: [] })],
          },
          evidenceIds,
          "evidence_auditor",
        ),
      "INVALID_STRUCTURED_OUTPUT",
    );
  });

  it.each([
    "The permit will be approved after intake.",
    "The permit was approved after intake.",
    "The project is legally compliant.",
    "The agency must approve the application.",
  ])("rejects prohibited approval or legal certainty language: %s", (rationale) => {
    expectValidationCode(
      () =>
        validateIntegrityAnalystOutput(
          {
            analyst_summary: "Human confirmation is still required.",
            observations: [item({ rationale })],
          },
          evidenceIds,
          "evidence_auditor",
        ),
      "PROHIBITED_CERTAINTY_LANGUAGE",
    );
  });

  it("consolidates duplicate recommendations while retaining stronger risk and all support", () => {
    const duplicate = item({
      severity: "critical",
      confidence: 95,
      evidence_ids: ["evidence-email", "evidence-portal"],
      packet_readiness_impact: "blocks_release",
      source_analysts: ["skeptical_reviewer"],
    });
    const result = validateIntegritySynthesisOutput(
      synthesis([
        item({
          severity: "medium",
          confidence: 81,
          packet_readiness_impact: "monitor",
        }),
        duplicate,
        item({
          category: "next_best_action",
          severity: "high",
          confidence: 94,
          title: "Confirm reviewer assignment and routing stage",
          evidence_ids: ["evidence-intake", "evidence-portal", "evidence-email"],
          proposed_corrective_action:
            "Ask the agency for written confirmation of the assigned reviewer and current routing stage.",
          source_analysts: ["chronology_analyst", "skeptical_reviewer"],
        }),
      ]),
      evidenceIds,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      severity: "critical",
      confidence: 95,
      packet_readiness_impact: "blocks_release",
      evidence_ids: ["evidence-email", "evidence-intake", "evidence-portal"],
      source_analysts: ["evidence_auditor", "skeptical_reviewer"],
    });
    expect(result.items.filter((candidate) => candidate.category === "next_best_action"))
      .toHaveLength(1);
  });

  it("consolidates the same corrective recommendation across observation categories", () => {
    const result = validateIntegritySynthesisOutput(
      synthesis([
        item(),
        item({
          category: "timeline_gap_or_stale_status",
          title: "Portal and receipt still show different workflow stages",
          evidence_ids: ["evidence-email", "evidence-portal"],
          source_analysts: ["chronology_analyst"],
        }),
        item({
          category: "next_best_action",
          title: "Confirm reviewer assignment and routing stage",
          evidence_ids: ["evidence-intake", "evidence-portal"],
          proposed_corrective_action:
            "Ask the agency for the assigned reviewer and current routing stage in writing.",
        }),
      ]),
      evidenceIds,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].evidence_ids).toEqual([
      "evidence-email",
      "evidence-intake",
      "evidence-portal",
    ]);
    expect(result.items[0].source_analysts).toEqual([
      "chronology_analyst",
      "evidence_auditor",
    ]);
  });

  it.each([
    ["zero", [item()]],
    [
      "two",
      [
        item(),
        item({
          category: "next_best_action",
          title: "Ask the agency to confirm current routing",
          proposed_corrective_action: "Request written routing confirmation.",
        }),
        item({
          category: "next_best_action",
          title: "Ask the client for a reassignment notice",
          proposed_corrective_action: "Request a copy of any reassignment notice.",
        }),
      ],
    ],
  ] satisfies Array<[string, IntegrityDraftItem[]]>) (
    "rejects synthesis with %s next-best actions",
    (_label, items) => {
      expectValidationCode(
        () => validateIntegritySynthesisOutput(synthesis(items), evidenceIds),
        "INVALID_NEXT_BEST_ACTION",
      );
    },
  );
});
