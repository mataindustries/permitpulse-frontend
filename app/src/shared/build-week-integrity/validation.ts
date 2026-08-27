import {
  canonicalEvidenceRecordsSchema,
  caseIntegrityFixtureSchema,
  clientSafeIntegrityFindingSchema,
  integrityAiInterpretationSchema,
  integrityAnalystOutputSchema,
  integritySynthesisOutputSchema,
} from "./schema";
import type {
  CanonicalEvidenceRecord,
  CaseIntegrityEvalMetrics,
  CaseIntegrityEvalReport,
  CaseIntegrityFixture,
  ClientSafeIntegrityFinding,
  EvidenceNormalizedValue,
  IntegrityAiInterpretation,
  IntegrityAnalystOutput,
  IntegrityClaimAssessment,
  IntegrityDraftItem,
  IntegrityPacketImpact,
  IntegritySeverity,
  IntegrityStageName,
  IntegritySynthesisOutput,
} from "./types";

const prohibitedCertaintyPatterns: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\b(?:permit|application|project)\s+(?:is|has been|will be)\s+approved\b/i,
    label: "permit approval certainty",
  },
  {
    pattern: /\b(?:permit|application|project)\s+was\s+approved\b/i,
    label: "permit approval certainty",
  },
  {
    pattern: /\bapproval\s+(?:is|was|has been)\s+(?:granted|confirmed|secured|obtained)\b/i,
    label: "permit approval certainty",
  },
  {
    pattern: /\bapproval\s+(?:is|appears|seems)\s+(?:certain|guaranteed|assured)\b/i,
    label: "guaranteed approval",
  },
  {
    pattern: /\b(?:entitled to approval|agency (?:must|will) approve|permit will issue)\b/i,
    label: "predicted agency outcome",
  },
  {
    pattern: /\b(?:legally compliant|legal compliance (?:is|has been) confirmed|complies with all applicable laws)\b/i,
    label: "legal certainty",
  },
  {
    pattern: /\b(?:no legal risk|legally guaranteed|guaranteed lawful)\b/i,
    label: "legal guarantee",
  },
];

const severityRank: Record<IntegritySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const packetImpactRank: Record<IntegrityPacketImpact, number> = {
  blocks_release: 4,
  needs_resolution: 3,
  monitor: 2,
  none: 1,
};

const duplicateStopWords = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export class IntegrityValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IntegrityValidationError";
    this.code = code;
  }
}

function itemText(item: IntegrityDraftItem): string {
  return [
    item.title,
    item.verified_fact,
    item.inference ?? "",
    item.unknown ?? "",
    item.rationale,
    item.proposed_corrective_action,
  ].join("\n");
}

export function prohibitedIntegrityLanguage(value: string): string[] {
  return prohibitedCertaintyPatterns
    .filter(({ pattern }) => pattern.test(value))
    .map(({ label }) => label);
}

function normalizedTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 2 && !duplicateStopWords.has(token)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / (left.size + right.size - intersection);
}

function duplicateRecommendation(
  left: IntegrityDraftItem,
  right: IntegrityDraftItem,
): boolean {
  if (
    left.category === "next_best_action" ||
    right.category === "next_best_action"
  ) {
    if (left.category !== right.category) return false;
  }

  const leftTitle = normalizedTokens(left.title);
  const rightTitle = normalizedTokens(right.title);
  const leftAction = normalizedTokens(left.proposed_corrective_action);
  const rightAction = normalizedTokens(right.proposed_corrective_action);

  return (
    jaccard(leftTitle, rightTitle) >= 0.82 ||
    jaccard(leftAction, rightAction) >= 0.76
  );
}

function strongerSeverity(
  left: IntegritySeverity,
  right: IntegritySeverity,
): IntegritySeverity {
  return severityRank[left] >= severityRank[right] ? left : right;
}

function strongerImpact(
  left: IntegrityPacketImpact,
  right: IntegrityPacketImpact,
): IntegrityPacketImpact {
  return packetImpactRank[left] >= packetImpactRank[right] ? left : right;
}

function consolidatePair(
  existing: IntegrityDraftItem,
  candidate: IntegrityDraftItem,
): IntegrityDraftItem {
  const preferred =
    severityRank[candidate.severity] > severityRank[existing.severity] ||
    (candidate.severity === existing.severity &&
      candidate.confidence > existing.confidence)
      ? candidate
      : existing;

  return {
    ...preferred,
    severity: strongerSeverity(existing.severity, candidate.severity),
    confidence: Math.max(existing.confidence, candidate.confidence),
    evidence_ids: [...new Set([...existing.evidence_ids, ...candidate.evidence_ids])].sort(),
    packet_readiness_impact: strongerImpact(
      existing.packet_readiness_impact,
      candidate.packet_readiness_impact,
    ),
    source_analysts: [
      ...new Set([...existing.source_analysts, ...candidate.source_analysts]),
    ].sort(),
  };
}

export function consolidateIntegrityRecommendations(
  items: IntegrityDraftItem[],
): IntegrityDraftItem[] {
  const consolidated: IntegrityDraftItem[] = [];

  for (const item of items) {
    const normalizedItem = {
      ...item,
      evidence_ids: [...new Set(item.evidence_ids)].sort(),
      source_analysts: [...new Set(item.source_analysts)].sort(),
    };
    const duplicateIndex = consolidated.findIndex((candidate) =>
      duplicateRecommendation(candidate, normalizedItem),
    );

    if (duplicateIndex === -1) {
      consolidated.push(normalizedItem);
    } else {
      consolidated[duplicateIndex] = consolidatePair(
        consolidated[duplicateIndex],
        normalizedItem,
      );
    }
  }

  return consolidated;
}

function validateItems(
  items: IntegrityDraftItem[],
  evidenceIds: ReadonlySet<string>,
): void {
  for (const [index, item] of items.entries()) {
    if (item.evidence_ids.length === 0) {
      throw new IntegrityValidationError(
        "MISSING_CITATION",
        `Integrity observation ${index + 1} has no evidence citation.`,
      );
    }

    const invalidIds = item.evidence_ids.filter((id) => !evidenceIds.has(id));
    if (invalidIds.length > 0) {
      throw new IntegrityValidationError(
        "INVALID_CITATION",
        `Integrity observation ${index + 1} cites evidence outside the current case.`,
      );
    }

    const unsafe = prohibitedIntegrityLanguage(itemText(item));
    if (unsafe.length > 0) {
      throw new IntegrityValidationError(
        "PROHIBITED_CERTAINTY_LANGUAGE",
        `Integrity observation ${index + 1} contains prohibited ${unsafe[0]} language.`,
      );
    }

    if (
      (item.category === "evidence_contradiction" ||
        item.category === "missing_record_or_confirmation") &&
      item.unknown === null
    ) {
      throw new IntegrityValidationError(
        item.category === "evidence_contradiction"
          ? "CONFLICT_MUST_REMAIN_UNRESOLVED"
          : "MISSING_RECORD_MUST_REMAIN_UNKNOWN",
        `Integrity observation ${index + 1} must state the unresolved unknown explicitly.`,
      );
    }
  }
}

export function validateIntegrityAnalystOutput(
  value: unknown,
  evidenceIds: ReadonlySet<string>,
  analyst: Exclude<IntegrityStageName, "synthesis">,
): IntegrityAnalystOutput {
  const parsed = integrityAnalystOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_STRUCTURED_OUTPUT",
      "A Terra analyst response did not match the strict schema.",
    );
  }

  const output = parsed.data;
  const unsafeSummary = prohibitedIntegrityLanguage(output.analyst_summary);
  if (unsafeSummary.length > 0) {
    throw new IntegrityValidationError(
      "PROHIBITED_CERTAINTY_LANGUAGE",
      "A Terra analyst summary contains prohibited certainty language.",
    );
  }

  if (
    output.observations.some(
      (item) =>
        item.source_analysts.length !== 1 || item.source_analysts[0] !== analyst,
    )
  ) {
    throw new IntegrityValidationError(
      "INVALID_ANALYST_ATTRIBUTION",
      "A Terra observation has invalid analyst attribution.",
    );
  }

  validateItems(output.observations, evidenceIds);
  return output;
}

export function validateIntegritySynthesisOutput(
  value: unknown,
  evidenceIds: ReadonlySet<string>,
): IntegritySynthesisOutput {
  const parsed = integritySynthesisOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_STRUCTURED_OUTPUT",
      "The Sol synthesis response did not match the strict schema.",
    );
  }

  const unsafeSummary = prohibitedIntegrityLanguage(parsed.data.summary);
  if (unsafeSummary.length > 0) {
    throw new IntegrityValidationError(
      "PROHIBITED_CERTAINTY_LANGUAGE",
      "The Sol synthesis summary contains prohibited certainty language.",
    );
  }

  validateItems(parsed.data.items, evidenceIds);
  const items = consolidateIntegrityRecommendations(parsed.data.items);
  validateItems(items, evidenceIds);

  const nextActions = items.filter((item) => item.category === "next_best_action");
  if (nextActions.length !== 1) {
    throw new IntegrityValidationError(
      "INVALID_NEXT_BEST_ACTION",
      "The synthesis must contain exactly one next-best question or action.",
    );
  }

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (duplicateRecommendation(items[left], items[right])) {
        throw new IntegrityValidationError(
          "DUPLICATE_RECOMMENDATION",
          "Duplicate recommendations remained after consolidation.",
        );
      }
    }
  }

  return { summary: parsed.data.summary, items };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizedValueKey(value: EvidenceNormalizedValue): string | null {
  if (value.kind === "unknown" || value.kind === "unresolved") return null;
  if (value.kind === "number") {
    return JSON.stringify([value.kind, value.value, value.unit]);
  }
  return JSON.stringify([value.kind, value.value]);
}

function isKnownValue(value: EvidenceNormalizedValue): boolean {
  return normalizedValueKey(value) !== null;
}

function stableAssessmentId(records: readonly CanonicalEvidenceRecord[]): string {
  const seed = [
    records[0].subject.case_id,
    records[0].subject.property_id ?? "",
    records[0].claim.key,
    ...records.map((record) => record.id).sort(),
  ].join("|");
  let hash = 0xcbf29ce484222325n;
  for (const character of seed) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `integrity-claim-${hash.toString(16).padStart(16, "0")}`;
}

function claimScopeKey(record: CanonicalEvidenceRecord): string {
  return JSON.stringify([record.subject, record.claim]);
}

function comparableRecords(records: readonly CanonicalEvidenceRecord[]) {
  return records.filter(
    (record) =>
      (record.classification === "source_observation" ||
        record.classification === "verified_fact") &&
      isKnownValue(record.normalized_value),
  );
}

function withDetectedConflicts(
  records: readonly CanonicalEvidenceRecord[],
): CanonicalEvidenceRecord[] {
  const comparable = comparableRecords(records);
  const derived = new Map<string, Set<string>>(
    records.map((record) => [record.id, new Set(record.conflicts_with)]),
  );

  for (let left = 0; left < comparable.length; left += 1) {
    for (let right = left + 1; right < comparable.length; right += 1) {
      if (
        normalizedValueKey(comparable[left].normalized_value) ===
        normalizedValueKey(comparable[right].normalized_value)
      ) {
        continue;
      }
      derived.get(comparable[left].id)?.add(comparable[right].id);
      derived.get(comparable[right].id)?.add(comparable[left].id);
    }
  }

  return records
    .map((record) => ({
      ...record,
      conflicts_with: sortedUnique([...(derived.get(record.id) ?? [])]),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function readableNormalizedValue(value: EvidenceNormalizedValue): string {
  if (value.kind === "boolean") return value.value ? "YES" : "NO";
  if (value.kind === "number") {
    return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
  }
  if (value.kind === "text" || value.kind === "date") return value.value;
  return value.kind;
}

function minimumConclusionConfidence(
  records: readonly CanonicalEvidenceRecord[],
): number | null {
  const values = records
    .map((record) => record.confidence)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

export function evaluateCanonicalEvidenceClaim(
  value: unknown,
): IntegrityClaimAssessment {
  const parsed = canonicalEvidenceRecordsSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_CANONICAL_EVIDENCE",
      "Canonical evidence did not match the strict evidence schema.",
    );
  }

  const records = parsed.data as CanonicalEvidenceRecord[];
  const scope = claimScopeKey(records[0]);
  if (records.some((record) => claimScopeKey(record) !== scope)) {
    throw new IntegrityValidationError(
      "MIXED_EVIDENCE_CLAIMS",
      "A deterministic claim assessment can evaluate only one case, property, and claim.",
    );
  }

  const evidenceIds = new Set(records.map((record) => record.id));
  if (
    records.some((record) =>
      record.conflicts_with.some((id) => !evidenceIds.has(id)),
    )
  ) {
    throw new IntegrityValidationError(
      "INVALID_CONFLICT_REFERENCE",
      "Canonical evidence contains a conflict relationship outside the claim evidence set.",
    );
  }

  const evidenceRecords = withDetectedConflicts(records);
  const comparable = comparableRecords(evidenceRecords);
  const distinctValues = new Set(
    comparable
      .map((record) => normalizedValueKey(record.normalized_value))
      .filter((key): key is string => key !== null),
  );
  const explicitConflict = evidenceRecords.some(
    (record) =>
      record.classification === "conflict" ||
      record.normalized_value.kind === "unresolved",
  );
  const base = {
    id: stableAssessmentId(evidenceRecords),
    subject: evidenceRecords[0].subject,
    claim: evidenceRecords[0].claim,
    evidence_ids: evidenceRecords.map((record) => record.id),
    evidence_records: evidenceRecords,
  };

  if (explicitConflict || distinctValues.size > 1) {
    const conflictingRecords = comparable.filter(
      (record) => record.conflicts_with.length > 0,
    );
    const official =
      conflictingRecords.length > 0 &&
      conflictingRecords.every((record) => record.source.authority === "official");
    return {
      ...base,
      classification: "conflict",
      normalized_value: {
        kind: "unresolved",
        value: null,
        reason: "conflicting_evidence",
      },
      confidence: { classification: 100, conclusion: null },
      review_status: "review_required",
      human_review_required: true,
      client_safe_statement: `${official ? "Official" : "Available"} sources conflict regarding ${evidenceRecords[0].claim.client_label}.`,
    };
  }

  if (comparable.length === 0) {
    const inferred = evidenceRecords.find(
      (record) =>
        record.classification === "inference" &&
        isKnownValue(record.normalized_value),
    );
    if (inferred) {
      return {
        ...base,
        classification: "inference",
        normalized_value: inferred.normalized_value,
        confidence: {
          classification: 100,
          conclusion: minimumConclusionConfidence([inferred]),
        },
        review_status: "review_required",
        human_review_required: true,
        client_safe_statement: `Available material supports only an inference regarding ${evidenceRecords[0].claim.client_label}.`,
      };
    }

    const unknown = evidenceRecords.find(
      (record) => record.normalized_value.kind === "unknown",
    );
    return {
      ...base,
      classification: "unknown",
      normalized_value:
        unknown?.normalized_value.kind === "unknown"
          ? unknown.normalized_value
          : {
              kind: "unknown",
              value: null,
              reason: "insufficient_evidence",
            },
      confidence: { classification: 100, conclusion: null },
      review_status: "review_required",
      human_review_required: true,
      client_safe_statement: `Available evidence is insufficient to determine ${evidenceRecords[0].claim.client_label}.`,
    };
  }

  const representative = comparable[0].normalized_value;
  const verified = comparable.every(
    (record) =>
      record.classification === "verified_fact" &&
      (record.review_status === "reviewed" || record.review_status === "resolved"),
  );
  return {
    ...base,
    classification: verified ? "verified_fact" : "source_observation",
    normalized_value: representative,
    confidence: {
      classification: 100,
      conclusion: minimumConclusionConfidence(comparable),
    },
    review_status: verified ? "reviewed" : "review_required",
    human_review_required: !verified,
    client_safe_statement: verified
      ? `Reviewed evidence verifies ${evidenceRecords[0].claim.client_label} as ${readableNormalizedValue(representative)}.`
      : `Source observations record ${evidenceRecords[0].claim.client_label} as ${readableNormalizedValue(representative)}.`,
  };
}

export function validateIntegrityAiInterpretation(
  value: unknown,
  assessment: IntegrityClaimAssessment,
): IntegrityAiInterpretation {
  const parsed = integrityAiInterpretationSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_AI_INTERPRETATION",
      "AI interpretation did not match the strict non-evidence schema.",
    );
  }

  if (parsed.data.assessment_id !== assessment.id) {
    throw new IntegrityValidationError(
      "AI_ASSESSMENT_MISMATCH",
      "AI interpretation references a different deterministic assessment.",
    );
  }
  if (!sameIds(parsed.data.evidence_ids, assessment.evidence_ids)) {
    throw new IntegrityValidationError(
      "AI_EVIDENCE_SCOPE_CHANGED",
      "AI interpretation must retain exactly the supplied evidence IDs.",
    );
  }
  if (
    (assessment.classification === "conflict" ||
      assessment.classification === "unknown") &&
    !parsed.data.abstained
  ) {
    throw new IntegrityValidationError(
      "AI_FAILED_TO_ABSTAIN",
      "AI must abstain from resolving a deterministic conflict or unknown.",
    );
  }
  if (
    parsed.data.explanation &&
    prohibitedIntegrityLanguage(parsed.data.explanation).length > 0
  ) {
    throw new IntegrityValidationError(
      "PROHIBITED_CERTAINTY_LANGUAGE",
      "AI interpretation contains prohibited certainty language.",
    );
  }

  return parsed.data;
}

export function validateClientSafeIntegrityFinding(
  assessment: IntegrityClaimAssessment,
  value: unknown,
): ClientSafeIntegrityFinding {
  const parsed = clientSafeIntegrityFindingSchema.safeParse(value);
  if (!parsed.success) {
    throw new IntegrityValidationError(
      "INVALID_CLIENT_REPRESENTATION",
      "The downstream integrity representation did not match the strict client-safe schema.",
    );
  }
  const candidate = parsed.data as ClientSafeIntegrityFinding;

  if (candidate.assessment_id !== assessment.id) {
    throw new IntegrityValidationError(
      "ASSESSMENT_ID_CHANGED",
      "The downstream representation references a different assessment.",
    );
  }
  if (candidate.classification !== assessment.classification) {
    throw new IntegrityValidationError(
      assessment.classification === "conflict"
        ? "CONFLICT_SILENTLY_RESOLVED"
        : assessment.classification === "unknown"
          ? "UNKNOWN_TO_FALSE"
          : "CLASSIFICATION_CHANGED",
      "The downstream representation changed the deterministic evidence classification.",
    );
  }
  if (!sameValue(candidate.normalized_value, assessment.normalized_value)) {
    throw new IntegrityValidationError(
      assessment.classification === "conflict"
        ? "CONFLICT_SILENTLY_RESOLVED"
        : assessment.classification === "unknown"
          ? "UNKNOWN_TO_FALSE"
          : "NORMALIZED_VALUE_CHANGED",
      "The downstream representation changed the deterministic normalized value.",
    );
  }
  if (candidate.statement !== assessment.client_safe_statement) {
    throw new IntegrityValidationError(
      "CLIENT_CERTAINTY_CHANGED",
      "The downstream representation changed the approved certainty-bounded wording.",
    );
  }
  if (
    !sameValue(candidate.confidence, assessment.confidence) ||
    candidate.review_status !== assessment.review_status ||
    candidate.human_review_required !== assessment.human_review_required
  ) {
    throw new IntegrityValidationError(
      "REVIEW_BOUNDARY_CHANGED",
      "The downstream representation changed confidence or human-review requirements.",
    );
  }

  const candidateIds = candidate.evidence.map((citation) => citation.evidence_id);
  if (!sameIds(candidateIds, assessment.evidence_ids)) {
    const lost = assessment.evidence_ids.some((id) => !candidateIds.includes(id));
    throw new IntegrityValidationError(
      lost ? "LOST_EVIDENCE_RECORD" : "AI_REPORTED_AS_EVIDENCE",
      lost
        ? "The downstream representation dropped source evidence."
        : "The downstream representation introduced a non-source evidence record.",
    );
  }
  if (candidate.evidence.length !== assessment.evidence_records.length) {
    throw new IntegrityValidationError(
      "LOST_EVIDENCE_RECORD",
      "The downstream representation changed the number of source evidence records.",
    );
  }

  const evidenceById = new Map(
    assessment.evidence_records.map((record) => [record.id, record]),
  );
  for (const citation of candidate.evidence) {
    const source = evidenceById.get(citation.evidence_id);
    if (!source) {
      throw new IntegrityValidationError(
        "AI_REPORTED_AS_EVIDENCE",
        "Only canonical source records may appear as downstream evidence.",
      );
    }
    if (
      citation.source_agency !== source.source.agency ||
      citation.source_title !== source.source.title ||
      citation.source_description !== source.source.description ||
      citation.source_url !== source.source.url ||
      citation.retrieved_at !== source.source.retrieved_at ||
      citation.evidence_type !== source.evidence_type
    ) {
      throw new IntegrityValidationError(
        "PROVENANCE_CHANGED",
        "Source identity or retrieval time changed downstream.",
      );
    }
  }

  if (candidate.ai_interpretation) {
    validateIntegrityAiInterpretation(candidate.ai_interpretation, assessment);
  }
  return candidate;
}

export function buildClientSafeIntegrityFinding(
  assessment: IntegrityClaimAssessment,
  aiInterpretation?: unknown,
): ClientSafeIntegrityFinding {
  const interpretation =
    aiInterpretation === undefined
      ? null
      : validateIntegrityAiInterpretation(aiInterpretation, assessment);
  const candidate: ClientSafeIntegrityFinding = {
    assessment_id: assessment.id,
    classification: assessment.classification,
    statement: assessment.client_safe_statement,
    normalized_value: assessment.normalized_value,
    confidence: assessment.confidence,
    review_status: assessment.review_status,
    human_review_required: assessment.human_review_required,
    evidence: assessment.evidence_records.map((record) => ({
      evidence_id: record.id,
      source_agency: record.source.agency,
      source_title: record.source.title,
      source_description: record.source.description,
      source_url: record.source.url,
      retrieved_at: record.source.retrieved_at,
      evidence_type: record.evidence_type,
      record_origin: "source_evidence",
    })),
    ai_interpretation: interpretation,
  };
  return validateClientSafeIntegrityFinding(assessment, candidate);
}

const emptyEvalMetrics = (): CaseIntegrityEvalMetrics => ({
  unsupported_definitive_claims: 0,
  lost_evidence_records: 0,
  missed_known_conflicts: 0,
  conflicts_silently_resolved: 0,
  unknown_to_false_conversions: 0,
  missing_provenance: 0,
});

export function runCaseIntegrityEvaluation(
  values: readonly unknown[],
): CaseIntegrityEvalReport {
  const metrics = emptyEvalMetrics();
  const cases: CaseIntegrityEvalReport["cases"] = [];

  for (const value of values) {
    const parsed = caseIntegrityFixtureSchema.safeParse(value);
    if (!parsed.success) {
      throw new IntegrityValidationError(
        "INVALID_CASE_INTEGRITY_FIXTURE",
        "A Case Integrity evaluation fixture did not match the strict schema.",
      );
    }
    const fixture = parsed.data as CaseIntegrityFixture;
    const assessment = evaluateCanonicalEvidenceClaim(fixture.evidence_records);
    const clientFinding = buildClientSafeIntegrityFinding(assessment);
    const sourceIds = fixture.evidence_records.map((record) => record.id);
    const assessmentIds = new Set(assessment.evidence_ids);
    const clientIds = new Set(
      clientFinding.evidence.map((citation) => citation.evidence_id),
    );

    metrics.lost_evidence_records += sourceIds.filter(
      (id) => !assessmentIds.has(id) || !clientIds.has(id),
    ).length;
    if (
      fixture.expected.classification === "conflict" &&
      assessment.classification !== "conflict"
    ) {
      metrics.missed_known_conflicts += 1;
    }
    if (
      fixture.expected.classification === "conflict" &&
      (clientFinding.classification !== "conflict" ||
        clientFinding.normalized_value.kind !== "unresolved")
    ) {
      metrics.conflicts_silently_resolved += 1;
    }
    if (
      fixture.expected.classification === "unknown" &&
      (clientFinding.classification === "verified_fact" ||
        (clientFinding.normalized_value.kind === "boolean" &&
          clientFinding.normalized_value.value === false))
    ) {
      metrics.unknown_to_false_conversions += 1;
    }
    if (
      (fixture.expected.classification === "conflict" ||
        fixture.expected.classification === "unknown") &&
      isKnownValue(clientFinding.normalized_value)
    ) {
      metrics.unsupported_definitive_claims += 1;
    }
    metrics.missing_provenance += clientFinding.evidence.filter(
      (citation) =>
        !citation.source_agency ||
        !citation.source_title ||
        !citation.retrieved_at ||
        citation.record_origin !== "source_evidence",
    ).length;

    if (
      assessment.classification !== fixture.expected.classification ||
      !sameIds(assessment.evidence_ids, fixture.expected.evidence_ids) ||
      clientFinding.statement !== fixture.expected.client_safe_statement
    ) {
      throw new IntegrityValidationError(
        "CASE_INTEGRITY_EXPECTATION_MISMATCH",
        `Case Integrity fixture ${fixture.id} did not produce its expected safe result.`,
      );
    }

    cases.push({
      fixture_id: fixture.id,
      classification: assessment.classification,
      evidence_record_count: assessment.evidence_records.length,
      client_safe_statement: clientFinding.statement,
    });
  }

  return { fixture_count: cases.length, metrics, cases };
}
