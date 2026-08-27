import { describe, expect, it } from "vitest";
import generatedPublicDemo from "../../dist/assets/case-integrity-demo-data.json";
import fireConflictFixture from "../fixtures/case-integrity/fire-hazard-official-source-conflict.json";
import unknownLookupFixture from "../fixtures/case-integrity/record-lookup-unknown.json";
import { buildPublicCaseIntegrityDemoPayload } from "../src/shared/build-week-integrity/public-demo";

describe("public Case Integrity demo projection", () => {
  it("matches the checked-in payload to current deterministic V2 output", () => {
    const expected = buildPublicCaseIntegrityDemoPayload(
      fireConflictFixture,
      unknownLookupFixture,
    );

    expect(generatedPublicDemo).toEqual(expected);
  });

  it("preserves both conflicting observations and their full client-safe provenance", () => {
    const payload = buildPublicCaseIntegrityDemoPayload(
      fireConflictFixture,
      unknownLookupFixture,
    );

    expect(payload.integrity_boundary).toEqual({
      deterministic_validation: true,
      ai_used: false,
      client_safe_projection_validated: true,
    });
    expect(payload.conflict).toMatchObject({
      classification: "conflict",
      normalized_value: {
        kind: "unresolved",
        value: null,
        reason: "conflicting_evidence",
      },
      confidence: { classification: 100, conclusion: null },
      human_review_required: true,
      statement:
        "Official sources conflict regarding the property's fire-hazard designation.",
      ai_interpretation: null,
    });
    expect(payload.conflict.evidence).toHaveLength(2);
    expect(payload.conflict.evidence.map((record) => record.observed_display_value)).toEqual([
      "YES",
      "NO",
    ]);
    expect(payload.conflict.evidence).toEqual([
      expect.objectContaining({
        id: "evidence-fire-cal-fire",
        source_authority: "official",
        source: expect.objectContaining({
          source_agency: "CAL FIRE",
          retrieved_at: "2026-07-10T16:05:00.000Z",
          record_origin: "source_evidence",
        }),
        provenance: expect.objectContaining({ is_ai_generated: false }),
      }),
      expect.objectContaining({
        id: "evidence-fire-zimas-city",
        source_authority: "official",
        source: expect.objectContaining({
          source_agency: "ZIMAS / City source",
          retrieved_at: "2026-07-10T16:12:00.000Z",
          record_origin: "source_evidence",
        }),
        provenance: expect.objectContaining({ is_ai_generated: false }),
      }),
    ]);
  });

  it("keeps the secondary failed lookup separate and unknown", () => {
    const payload = buildPublicCaseIntegrityDemoPayload(
      fireConflictFixture,
      unknownLookupFixture,
    );

    expect(payload.unknown_example).toMatchObject({
      separate_sample: true,
      classification: "unknown",
      normalized_value: {
        kind: "unknown",
        value: null,
        reason: "retrieval_failed",
      },
      confidence: { classification: 100, conclusion: null },
      human_review_required: true,
      ai_interpretation: null,
    });
    expect(JSON.stringify(payload.unknown_example)).not.toMatch(
      /does_not_exist|"value":false/,
    );
  });
});
