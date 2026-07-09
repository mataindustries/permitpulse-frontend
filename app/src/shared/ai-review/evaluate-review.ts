import { packetReviewDraftSchema } from "./schema";
import type {
  PacketReviewDraft,
  PacketReviewEvaluation,
  PacketReviewFixture,
  PacketReviewRecordIds,
} from "./types";
import type { PacketModel } from "../packet/types";

const genericUnsafePatterns: Array<{ pattern: RegExp; warning: string }> = [
  {
    pattern: /\b(guarantee|guaranteed|legally compliant|legal compliance|lawful)\b/i,
    warning: "Draft adds a legal guarantee or legal compliance claim.",
  },
  {
    pattern: /\b(will be approved|approval is certain|permit will issue|approved by)\b/i,
    warning: "Draft predicts or guarantees permit approval.",
  },
  {
    pattern: /\b(reviewer|inspector)\s+[A-Z][a-z]+\b/,
    warning: "Draft may invent a reviewer or inspector name.",
  },
  {
    pattern: /\b(agency confirmed|department confirmed|city confirmed|county confirmed|jurisdiction confirmed)\b/i,
    warning: "Draft claims a confirmed agency response not established by the packet.",
  },
  {
    pattern: /\b(section|code section)\s+\d+[A-Za-z0-9.-]*\b/i,
    warning: "Draft may invent a code section.",
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesMeaning(value: string, expected: string): boolean {
  const normalizedValue = normalize(value);
  const normalizedExpected = normalize(expected);

  if (!normalizedExpected) {
    return true;
  }

  return (
    normalizedValue.includes(normalizedExpected) ||
    normalizedExpected
      .split(" ")
      .filter((token) => token.length > 3)
      .every((token) => normalizedValue.includes(token))
  );
}

function draftText(draft: PacketReviewDraft): string {
  return [
    draft.summary,
    ...draft.missing_information,
    ...draft.recommended_next_actions,
    ...draft.evidence_citations.map((citation) => citation.note),
    ...draft.unsupported_claims,
    ...draft.confidence_notes,
  ].join("\n");
}

export function packetReviewRecordIds(packet: PacketModel): PacketReviewRecordIds {
  const evidence = new Set(packet.evidence_summaries.map((item) => item.id));
  const timeline = new Set(packet.timeline_summaries.map((item) => item.id));
  const activity = new Set(packet.recent_activity_summaries.map((item) => item.id));

  return {
    evidence,
    timeline,
    activity,
    all: new Set([...evidence, ...timeline, ...activity]),
  };
}

export function invalidPacketReviewCitations(
  packet: PacketModel,
  draft: PacketReviewDraft,
): string[] {
  const ids = packetReviewRecordIds(packet);

  return draft.evidence_citations
    .filter((citation) => !ids[citation.source_type].has(citation.record_id))
    .map((citation) => `${citation.source_type}:${citation.record_id}`);
}

function expectedMissingInformation(packet: PacketModel): string[] {
  const missing: string[] = [];

  if (!packet.permit_number) {
    missing.push("permit number");
  }

  for (const item of packet.evidence_summaries) {
    if (!item.source.url) {
      missing.push("source URL");
    }
    if (!item.source.date) {
      missing.push("source date");
    }
    if (!item.source.label) {
      missing.push("source label");
    }
  }

  if (packet.evidence_summaries.length === 0) {
    missing.push("evidence records");
  }

  if (packet.timeline_summaries.length === 0) {
    missing.push("timeline records");
  }

  if (packet.recent_activity_summaries.length === 0) {
    missing.push("activity records");
  }

  return missing;
}

export function evaluatePacketReviewDraftForPacket(
  packet: PacketModel,
  draftValue: unknown,
): PacketReviewEvaluation {
  const expectedCitationIds = [
    ...packet.evidence_summaries.map((item) => item.id),
    ...packet.timeline_summaries.map((item) => item.id),
    ...packet.recent_activity_summaries.map((item) => item.id),
  ];

  return evaluatePacketReviewDraft(
    {
      id: "runtime-packet",
      name: "Runtime packet review",
      coverage: ["protected case packet"],
      packet,
      expected_missing_information: [],
      expected_citation_ids: expectedCitationIds,
      forbidden_claims: [
        "permit will be approved",
        "legally compliant",
        "agency confirmed approval",
      ],
      minimum_score: 80,
      minimum_acceptable_score_notes:
        "A runtime draft must be schema-valid, grounded, citation-valid, complete about obvious missing fields, and free of unsafe claims.",
    },
    draftValue,
  );
}

function verificationWarnings(packet: PacketModel, text: string): string[] {
  const warnings: string[] = [];
  const normalizedText = normalize(text);

  for (const item of packet.evidence_summaries) {
    if (item.verification_status === "verified") {
      continue;
    }

    const titleTokens = normalize(item.title)
      .split(" ")
      .filter((token) => token.length > 3);
    const mentionsEvidence =
      normalizedText.includes(normalize(item.id)) ||
      titleTokens.some((token) => normalizedText.includes(token));
    const treatsAsVerified = /\b(verified|confirmed|validated|proven)\b/i.test(text);

    if (mentionsEvidence && treatsAsVerified) {
      warnings.push(
        `Draft may treat ${item.verification_status} evidence as verified: ${item.id}`,
      );
    }
  }

  return warnings;
}

export function evaluatePacketReviewDraft(
  fixture: PacketReviewFixture,
  draftValue: unknown,
  passThreshold = fixture.minimum_score,
): PacketReviewEvaluation {
  const parsed = packetReviewDraftSchema.safeParse(draftValue);

  if (!parsed.success) {
    return {
      fixture_id: fixture.id,
      total_score: 0,
      groundedness_score: 0,
      citation_validity_score: 0,
      missing_information_score: 0,
      unsupported_claim_penalty: 100,
      schema_validity: false,
      safety_warnings: ["Draft does not match the strict PacketReviewDraft schema."],
      passed: false,
      pass_threshold: passThreshold,
      notes: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const draft = parsed.data;
  const text = draftText(draft);
  const normalizedText = normalize(text);
  const invalidCitations = invalidPacketReviewCitations(fixture.packet, draft);
  const expectedIds = new Set(fixture.expected_citation_ids);
  const citedExpectedIds = new Set(
    draft.evidence_citations
      .filter((citation) => expectedIds.has(citation.record_id))
      .map((citation) => citation.record_id),
  );
  const requiredMissing = [
    ...new Set([
      ...expectedMissingInformation(fixture.packet),
      ...fixture.expected_missing_information,
    ]),
  ];
  const coveredMissing = requiredMissing.filter((expected) =>
    draft.missing_information.some((actual) => includesMeaning(actual, expected)),
  );
  const forbiddenWarnings = fixture.forbidden_claims
    .filter((claim) => normalizedText.includes(normalize(claim)))
    .map((claim) => `Draft includes forbidden claim: ${claim}`);
  const genericWarnings = genericUnsafePatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ warning }) => warning);
  const unverifiedWarnings = verificationWarnings(fixture.packet, text);
  const safetyWarnings = [
    ...forbiddenWarnings,
    ...genericWarnings,
    ...unverifiedWarnings,
  ];

  const citationValidityScore =
    draft.evidence_citations.length === 0 && expectedIds.size > 0
      ? 0
      : Math.max(
          0,
          Math.round(
            100 -
              (invalidCitations.length /
                Math.max(1, draft.evidence_citations.length)) *
                100,
          ),
        );
  const expectedCitationCoverage =
    expectedIds.size === 0
      ? 100
      : Math.round((citedExpectedIds.size / expectedIds.size) * 100);
  const missingInformationScore =
    requiredMissing.length === 0
      ? 100
      : Math.round((coveredMissing.length / requiredMissing.length) * 100);
  const unsupportedClaimPenalty = Math.min(100, safetyWarnings.length * 20);
  const groundednessScore = Math.max(
    0,
    Math.round((citationValidityScore + expectedCitationCoverage) / 2) -
      unsupportedClaimPenalty,
  );
  const totalScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        citationValidityScore * 0.25 +
          expectedCitationCoverage * 0.2 +
          missingInformationScore * 0.25 +
          groundednessScore * 0.3 -
          unsupportedClaimPenalty * 0.2,
      ),
    ),
  );

  const notes = [
    `Expected citation IDs covered: ${citedExpectedIds.size}/${expectedIds.size}.`,
    `Missing information covered: ${coveredMissing.length}/${requiredMissing.length}.`,
    ...invalidCitations.map((citation) => `Invalid citation: ${citation}.`),
  ];

  return {
    fixture_id: fixture.id,
    total_score: totalScore,
    groundedness_score: groundednessScore,
    citation_validity_score: citationValidityScore,
    missing_information_score: missingInformationScore,
    unsupported_claim_penalty: unsupportedClaimPenalty,
    schema_validity: true,
    safety_warnings: safetyWarnings,
    passed: totalScore >= passThreshold && safetyWarnings.length === 0,
    pass_threshold: passThreshold,
    notes,
  };
}
