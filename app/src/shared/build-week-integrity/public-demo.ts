import { caseIntegrityFixtureSchema } from "./schema";
import type {
  CanonicalEvidenceRecord,
  CaseIntegrityFixture,
  ClientSafeIntegrityFinding,
  EvidenceNormalizedValue,
  EvidenceObservedValue,
  EvidenceSourceAuthority,
  IntegrityEvidenceProvenanceCitation,
} from "./types";
import {
  buildClientSafeIntegrityFinding,
  evaluateCanonicalEvidenceClaim,
  IntegrityValidationError,
} from "./validation";

export interface PublicCaseIntegrityEvidence {
  id: string;
  claim_label: string;
  classification: CanonicalEvidenceRecord["classification"];
  observed_value: EvidenceObservedValue;
  observed_display_value: string;
  normalized_value: EvidenceNormalizedValue;
  conflicts_with: string[];
  source_authority: EvidenceSourceAuthority;
  source: IntegrityEvidenceProvenanceCitation;
  provenance: CanonicalEvidenceRecord["provenance"];
}

export interface PublicCaseIntegrityFinding {
  assessment_id: string;
  claim_label: string;
  classification: ClientSafeIntegrityFinding["classification"];
  normalized_value: EvidenceNormalizedValue;
  confidence: ClientSafeIntegrityFinding["confidence"];
  review_status: ClientSafeIntegrityFinding["review_status"];
  human_review_required: boolean;
  statement: string;
  evidence: PublicCaseIntegrityEvidence[];
  ai_interpretation: null;
}

export interface PublicCaseIntegrityDemoPayload {
  schema_version: "case-integrity-public-demo-v1";
  demo_kind: "fixture_powered";
  disclosure: string;
  integrity_boundary: {
    deterministic_validation: true;
    ai_used: false;
    client_safe_projection_validated: true;
  };
  sample_property: {
    address_line_1: string;
    locality: string;
    fictional: true;
    disclosure: string;
  };
  fixture_ids: {
    conflict: string;
    unknown: string;
  };
  conflict: PublicCaseIntegrityFinding & {
    next_question: string;
  };
  unknown_example: PublicCaseIntegrityFinding & {
    separate_sample: true;
  };
}

function parseFixture(value: unknown): CaseIntegrityFixture {
  const parsed = caseIntegrityFixtureSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_PUBLIC_DEMO_FIXTURE",
      "The public Case Integrity demo fixture did not match the canonical schema.",
    );
  }
  return parsed.data as CaseIntegrityFixture;
}

function observedDisplayValue(value: EvidenceObservedValue): string {
  if (value.kind === "boolean") return value.value ? "YES" : "NO";
  if (value.kind === "number") {
    return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
  }
  if (value.kind === "text" || value.kind === "date") return value.value;
  return "NOT OBSERVED";
}

function projectEvidence(
  records: readonly CanonicalEvidenceRecord[],
  finding: ClientSafeIntegrityFinding,
): PublicCaseIntegrityEvidence[] {
  const citations = new Map(
    finding.evidence.map((citation) => [citation.evidence_id, citation]),
  );

  return records.map((record) => {
    const citation = citations.get(record.id);
    if (!citation) {
      throw new IntegrityValidationError(
        "PUBLIC_DEMO_PROVENANCE_LOST",
        "The public Case Integrity projection lost a validated evidence citation.",
      );
    }

    return {
      id: record.id,
      claim_label: record.claim.label,
      classification: record.classification,
      observed_value: record.raw_observed_value,
      observed_display_value: observedDisplayValue(record.raw_observed_value),
      normalized_value: record.normalized_value,
      conflicts_with: record.conflicts_with,
      source_authority: record.source.authority,
      source: citation,
      provenance: record.provenance,
    };
  });
}

function projectFinding(
  fixture: CaseIntegrityFixture,
  requiredClassification: "conflict" | "unknown",
): PublicCaseIntegrityFinding {
  const assessment = evaluateCanonicalEvidenceClaim(fixture.evidence_records);
  const finding = buildClientSafeIntegrityFinding(assessment);

  if (finding.classification !== requiredClassification) {
    throw new IntegrityValidationError(
      "PUBLIC_DEMO_STATE_CHANGED",
      `The public demo requires a deterministic ${requiredClassification} fixture.`,
    );
  }
  if (
    (requiredClassification === "conflict" &&
      finding.normalized_value.kind !== "unresolved") ||
    (requiredClassification === "unknown" &&
      finding.normalized_value.kind !== "unknown")
  ) {
    throw new IntegrityValidationError(
      "PUBLIC_DEMO_CERTAINTY_CHANGED",
      "The public demo fixture no longer preserves its unresolved evidence state.",
    );
  }
  if (finding.ai_interpretation !== null) {
    throw new IntegrityValidationError(
      "PUBLIC_DEMO_AI_BOUNDARY_CHANGED",
      "The fixture-powered public demo must not include AI interpretation.",
    );
  }

  return {
    assessment_id: finding.assessment_id,
    claim_label: assessment.claim.label,
    classification: finding.classification,
    normalized_value: finding.normalized_value,
    confidence: finding.confidence,
    review_status: finding.review_status,
    human_review_required: finding.human_review_required,
    statement: finding.statement,
    evidence: projectEvidence(assessment.evidence_records, finding),
    ai_interpretation: null,
  };
}

/**
 * Produces the narrow, fictional payload consumed by the public sales demo.
 * Conflict detection and client-safe wording remain owned by the canonical V2
 * evaluator; this function only removes internal fields and prepares display
 * values after deterministic validation has passed.
 */
export function buildPublicCaseIntegrityDemoPayload(
  conflictFixtureValue: unknown,
  unknownFixtureValue: unknown,
): PublicCaseIntegrityDemoPayload {
  const conflictFixture = parseFixture(conflictFixtureValue);
  const unknownFixture = parseFixture(unknownFixtureValue);
  const conflict = projectFinding(conflictFixture, "conflict");
  const unknown = projectFinding(unknownFixture, "unknown");

  return {
    schema_version: "case-integrity-public-demo-v1",
    demo_kind: "fixture_powered",
    disclosure:
      "Fictional sample case. This interaction replays validated fixture data and does not query live agency systems.",
    integrity_boundary: {
      deterministic_validation: true,
      ai_used: false,
      client_safe_projection_validated: true,
    },
    sample_property: {
      address_line_1: "1428 Arroyo Vista",
      locality: "Los Angeles, CA",
      fictional: true,
      disclosure:
        "Fictional public display alias for the anonymized conflict fixture.",
    },
    fixture_ids: {
      conflict: conflictFixture.id,
      unknown: unknownFixture.id,
    },
    conflict: {
      ...conflict,
      next_question:
        "Which hazard designation should govern this property, and what source should be relied on for project review?",
    },
    unknown_example: {
      ...unknown,
      separate_sample: true,
    },
  };
}
