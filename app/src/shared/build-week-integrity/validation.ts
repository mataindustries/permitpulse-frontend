import {
  integrityAnalystOutputSchema,
  integritySynthesisOutputSchema,
} from "./schema";
import type {
  IntegrityAnalystOutput,
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
