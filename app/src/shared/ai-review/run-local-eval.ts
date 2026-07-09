import { createBaselinePacketReviewDraft } from "./baseline-reviewer";
import { evaluatePacketReviewDraft } from "./evaluate-review";
import { packetReviewFixtures } from "./fixtures";
import type { PacketReviewEvaluation } from "./types";

export interface LocalAiReviewEvalSummary {
  fixture_count: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  results: PacketReviewEvaluation[];
}

export function runLocalAiReviewEvaluation(): LocalAiReviewEvalSummary {
  const results = packetReviewFixtures.map((fixture) =>
    evaluatePacketReviewDraft(
      fixture,
      createBaselinePacketReviewDraft(fixture.packet),
    ),
  );
  const scoreTotal = results.reduce((sum, result) => sum + result.total_score, 0);
  const passCount = results.filter((result) => result.passed).length;

  return {
    fixture_count: packetReviewFixtures.length,
    average_score:
      results.length === 0 ? 0 : Math.round((scoreTotal / results.length) * 10) / 10,
    pass_count: passCount,
    fail_count: results.length - passCount,
    results,
  };
}

export function formatLocalAiReviewEvaluation(
  summary: LocalAiReviewEvalSummary,
): string {
  const lines = [
    "PermitPulse Packet Review Assistant local evaluation",
    `fixtures: ${summary.fixture_count}`,
    `average_score: ${summary.average_score}`,
    `pass_count: ${summary.pass_count}`,
    `fail_count: ${summary.fail_count}`,
    "per_fixture:",
  ];

  for (const result of summary.results) {
    lines.push(
      `- ${result.fixture_id}: ${result.passed ? "PASS" : "FAIL"} score=${result.total_score} groundedness=${result.groundedness_score} citations=${result.citation_validity_score} missing=${result.missing_information_score} warnings=${result.safety_warnings.length}`,
    );
  }

  lines.push("external_calls: none");
  lines.push("secrets_required: none");

  return lines.join("\n");
}
