import { describe, expect, it } from "vitest";
import fireConflictFixtureJson from "../fixtures/case-integrity/fire-hazard-official-source-conflict.json";
import unknownLookupFixtureJson from "../fixtures/case-integrity/record-lookup-unknown.json";
import { caseIntegrityFixtureSchema } from "../src/shared/build-week-integrity/schema";
import type {
  CaseIntegrityFixture,
  ClientSafeIntegrityFinding,
} from "../src/shared/build-week-integrity/types";
import {
  buildClientSafeIntegrityFinding,
  evaluateCanonicalEvidenceClaim,
  IntegrityValidationError,
  validateClientSafeIntegrityFinding,
  validateIntegrityAiInterpretation,
} from "../src/shared/build-week-integrity/validation";

const fireFixture = caseIntegrityFixtureSchema.parse(
  fireConflictFixtureJson,
) as CaseIntegrityFixture;
const unknownFixture = caseIntegrityFixtureSchema.parse(
  unknownLookupFixtureJson,
) as CaseIntegrityFixture;

function expectValidationCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected evidence-integrity validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrityValidationError);
    expect(error).toMatchObject({ code });
  }
}

function fireAssessment() {
  return evaluateCanonicalEvidenceClaim(fireFixture.evidence_records);
}

describe("Case Integrity V2 canonical evidence", () => {
  it("preserves both official fire-hazard observations and detects their conflict", () => {
    const assessment = fireAssessment();

    expect(assessment).toMatchObject({
      classification: "conflict",
      normalized_value: {
        kind: "unresolved",
        value: null,
        reason: "conflicting_evidence",
      },
      confidence: { classification: 100, conclusion: null },
      human_review_required: true,
      review_status: "review_required",
      client_safe_statement:
        "Official sources conflict regarding the property's fire-hazard designation.",
    });
    expect(assessment.evidence_ids).toEqual([
      "evidence-fire-cal-fire",
      "evidence-fire-zimas-city",
    ]);
    expect(assessment.evidence_records).toHaveLength(2);
    expect(
      assessment.evidence_records.find(
        (record) => record.id === "evidence-fire-cal-fire",
      ),
    ).toMatchObject({
      raw_observed_value: { kind: "text", value: "YES" },
      normalized_value: { kind: "boolean", value: true },
      conflicts_with: ["evidence-fire-zimas-city"],
      source: {
        agency: "CAL FIRE",
        retrieved_at: "2026-07-10T16:05:00.000Z",
      },
    });
    expect(
      assessment.evidence_records.find(
        (record) => record.id === "evidence-fire-zimas-city",
      ),
    ).toMatchObject({
      raw_observed_value: { kind: "text", value: "NO" },
      normalized_value: { kind: "boolean", value: false },
      conflicts_with: ["evidence-fire-cal-fire"],
      source: {
        agency: "ZIMAS / City source",
        retrieved_at: "2026-07-10T16:12:00.000Z",
      },
    });
  });

  it("carries complete source identity and retrieval time into the client-safe projection", () => {
    const finding = buildClientSafeIntegrityFinding(fireAssessment());

    expect(finding.classification).toBe("conflict");
    expect(finding.evidence).toEqual([
      expect.objectContaining({
        evidence_id: "evidence-fire-cal-fire",
        source_agency: "CAL FIRE",
        source_title: "Fire Hazard Severity Zone map observation",
        source_url:
          "https://records.example.test/case-integrity/cal-fire/fire-hazard-map",
        retrieved_at: "2026-07-10T16:05:00.000Z",
        record_origin: "source_evidence",
      }),
      expect.objectContaining({
        evidence_id: "evidence-fire-zimas-city",
        source_agency: "ZIMAS / City source",
        source_title: "City parcel hazard-layer observation",
        source_url:
          "https://records.example.test/case-integrity/city/property-hazard-layer",
        retrieved_at: "2026-07-10T16:12:00.000Z",
        record_origin: "source_evidence",
      }),
    ]);
  });

  it("rejects an AI-generated object at the canonical evidence boundary", () => {
    const unsafe = structuredClone(fireConflictFixtureJson);
    unsafe.evidence_records[0].provenance.is_ai_generated = true;

    expectValidationCode(
      () => evaluateCanonicalEvidenceClaim(unsafe.evidence_records),
      "INVALID_CANONICAL_EVIDENCE",
    );
  });
});

describe("Case Integrity V2 false-resolution guardrail", () => {
  it("rejects a downstream representation that drops either conflicting source", () => {
    const assessment = fireAssessment();
    const candidate = buildClientSafeIntegrityFinding(assessment);
    candidate.evidence = candidate.evidence.slice(0, 1);

    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, candidate),
      "LOST_EVIDENCE_RECORD",
    );
  });

  it("rejects changing a conflict into a verified fact", () => {
    const assessment = fireAssessment();
    const candidate = buildClientSafeIntegrityFinding(assessment);
    candidate.classification = "verified_fact";

    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, candidate),
      "CONFLICT_SILENTLY_RESOLVED",
    );
  });

  it.each([true, false])(
    "rejects resolving the official-source conflict to boolean %s",
    (value) => {
      const assessment = fireAssessment();
      const candidate = buildClientSafeIntegrityFinding(assessment);
      candidate.normalized_value = { kind: "boolean", value };

      expectValidationCode(
        () => validateClientSafeIntegrityFinding(assessment, candidate),
        "CONFLICT_SILENTLY_RESOLVED",
      );
    },
  );

  it("rejects stronger client wording than the deterministic neutral statement", () => {
    const assessment = fireAssessment();
    const candidate = buildClientSafeIntegrityFinding(assessment);
    candidate.statement = "The property is in a very high fire-hazard zone.";

    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, candidate),
      "CLIENT_CERTAINTY_CHANGED",
    );
  });

  it("rejects loss or alteration of source identity", () => {
    const assessment = fireAssessment();
    const missing = structuredClone(
      buildClientSafeIntegrityFinding(assessment),
    ) as unknown as {
      evidence: Array<
        Partial<ClientSafeIntegrityFinding["evidence"][number]>
      >;
    };
    delete missing.evidence[0].source_agency;
    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, missing),
      "INVALID_CLIENT_REPRESENTATION",
    );

    const changed = buildClientSafeIntegrityFinding(assessment);
    changed.evidence[0].source_agency = "A different source";
    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, changed),
      "PROVENANCE_CHANGED",
    );
  });

  it("rejects loss or alteration of retrieval time", () => {
    const assessment = fireAssessment();
    const missing = structuredClone(
      buildClientSafeIntegrityFinding(assessment),
    ) as unknown as {
      evidence: Array<
        Partial<ClientSafeIntegrityFinding["evidence"][number]>
      >;
    };
    delete missing.evidence[0].retrieved_at;
    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, missing),
      "INVALID_CLIENT_REPRESENTATION",
    );

    const changed = buildClientSafeIntegrityFinding(assessment);
    changed.evidence[0].retrieved_at = "2026-07-12T00:00:00.000Z";
    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, changed),
      "PROVENANCE_CHANGED",
    );
  });

  it("rejects presenting an AI explanation as a new source record", () => {
    const assessment = fireAssessment();
    const candidate = buildClientSafeIntegrityFinding(assessment);
    candidate.evidence.push({
      evidence_id: "ai-generated-explanation",
      source_agency: "AI",
      source_title: "Generated explanation",
      source_description: "This text was generated from the supplied records.",
      source_url: null,
      retrieved_at: "2026-07-12T00:00:00.000Z",
      evidence_type: "research_note",
      record_origin: "source_evidence",
    });

    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, candidate),
      "AI_REPORTED_AS_EVIDENCE",
    );
  });

  it("keeps a structured, abstaining AI explanation separate from evidence", () => {
    const assessment = fireAssessment();
    const interpretation = {
      assessment_id: assessment.id,
      explanation:
        "The supplied official observations disagree, so the underlying designation remains unresolved.",
      abstained: true,
      evidence_ids: assessment.evidence_ids,
      generated_by: "ai",
      is_evidence: false,
    } as const;
    const finding = buildClientSafeIntegrityFinding(
      assessment,
      interpretation,
    );

    expect(finding.ai_interpretation).toEqual(interpretation);
    expect(finding.evidence).toHaveLength(2);
    expect(
      finding.evidence.some(
        (citation) => citation.evidence_id === "ai-generated-explanation",
      ),
    ).toBe(false);
  });

  it("requires AI to abstain and rejects source-record fields in AI output", () => {
    const assessment = fireAssessment();
    const base = {
      assessment_id: assessment.id,
      explanation: "The supplied official observations disagree.",
      abstained: false,
      evidence_ids: assessment.evidence_ids,
      generated_by: "ai",
      is_evidence: false,
    } as const;

    expectValidationCode(
      () => validateIntegrityAiInterpretation(base, assessment),
      "AI_FAILED_TO_ABSTAIN",
    );
    expectValidationCode(
      () =>
        validateIntegrityAiInterpretation(
          { ...base, abstained: true, source_records: assessment.evidence_records },
          assessment,
        ),
      "INVALID_AI_INTERPRETATION",
    );
  });
});

describe("Case Integrity V2 unknown is not absent", () => {
  it("preserves a failed lookup as unknown rather than false or nonexistent", () => {
    const assessment = evaluateCanonicalEvidenceClaim(
      unknownFixture.evidence_records,
    );
    const finding = buildClientSafeIntegrityFinding(assessment);

    expect(assessment).toMatchObject({
      classification: "unknown",
      normalized_value: {
        kind: "unknown",
        value: null,
        reason: "retrieval_failed",
      },
      confidence: { classification: 100, conclusion: null },
      human_review_required: true,
    });
    expect(finding.statement).toBe(
      "Available evidence is insufficient to determine whether an active code-enforcement record exists.",
    );
    expect(JSON.stringify(finding)).not.toContain("does_not_exist");
  });

  it("rejects converting an unknown lookup result to false", () => {
    const assessment = evaluateCanonicalEvidenceClaim(
      unknownFixture.evidence_records,
    );
    const candidate = buildClientSafeIntegrityFinding(assessment);
    candidate.normalized_value = { kind: "boolean", value: false };

    expectValidationCode(
      () => validateClientSafeIntegrityFinding(assessment, candidate),
      "UNKNOWN_TO_FALSE",
    );
  });
});
