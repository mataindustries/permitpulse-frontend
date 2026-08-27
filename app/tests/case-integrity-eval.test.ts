import { describe, expect, it } from "vitest";
import fireConflictFixture from "../fixtures/case-integrity/fire-hazard-official-source-conflict.json";
import unknownLookupFixture from "../fixtures/case-integrity/record-lookup-unknown.json";
import { runCaseIntegrityEvaluation } from "../src/shared/build-week-integrity/validation";

describe("PermitPulse Case Integrity evaluation", () => {
  it("reports zero evidence-integrity regressions for the anonymized fixture suite", () => {
    const report = runCaseIntegrityEvaluation([
      fireConflictFixture,
      unknownLookupFixture,
    ]);

    console.info("Case Integrity eval", JSON.stringify(report));
    expect(report.fixture_count).toBe(2);
    expect(report.metrics).toEqual({
      unsupported_definitive_claims: 0,
      lost_evidence_records: 0,
      missed_known_conflicts: 0,
      conflicts_silently_resolved: 0,
      unknown_to_false_conversions: 0,
      missing_provenance: 0,
    });
    expect(report.cases).toEqual([
      expect.objectContaining({
        fixture_id: "fire-hazard-official-source-conflict",
        classification: "conflict",
        evidence_record_count: 2,
      }),
      expect.objectContaining({
        fixture_id: "record-lookup-insufficient-evidence",
        classification: "unknown",
        evidence_record_count: 1,
      }),
    ]);
  });
});
