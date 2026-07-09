import { describe, expect, it, vi } from "vitest";
import { createBaselinePacketReviewDraft } from "../src/shared/ai-review/baseline-reviewer";
import {
  evaluatePacketReviewDraft,
  invalidPacketReviewCitations,
  packetReviewRecordIds,
} from "../src/shared/ai-review/evaluate-review";
import { packetReviewFixtures } from "../src/shared/ai-review/fixtures";
import {
  formatLocalAiReviewEvaluation,
  runLocalAiReviewEvaluation,
} from "../src/shared/ai-review/run-local-eval";
import { packetReviewDraftSchema } from "../src/shared/ai-review/schema";
import type { PacketReviewDraft } from "../src/shared/ai-review/types";

function fixture(id: string) {
  const item = packetReviewFixtures.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`Missing fixture ${id}`);
  }

  return item;
}

function textOfDraft(draft: PacketReviewDraft): string {
  return [
    draft.summary,
    ...draft.missing_information,
    ...draft.recommended_next_actions,
    ...draft.evidence_citations.map((citation) => citation.note),
    ...draft.unsupported_claims,
    ...draft.confidence_notes,
  ].join("\n");
}

describe("PacketReviewDraft schema", () => {
  it("rejects unknown fields", () => {
    const draft = createBaselinePacketReviewDraft(fixture("verified-evidence").packet);

    expect(
      packetReviewDraftSchema.safeParse({
        ...draft,
        arbitrary_field: "not allowed",
      }).success,
    ).toBe(false);
  });

  it("accepts deterministic baseline output", () => {
    const draft = createBaselinePacketReviewDraft(fixture("verified-evidence").packet);

    expect(packetReviewDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("packet review citation validation", () => {
  it("rejects nonexistent IDs", () => {
    const baseFixture = fixture("verified-evidence");
    const draft = createBaselinePacketReviewDraft(baseFixture.packet);

    draft.evidence_citations.push({
      source_type: "evidence",
      record_id: "not-a-real-evidence-id",
      note: "Invalid citation.",
    });

    expect(invalidPacketReviewCitations(baseFixture.packet, draft)).toEqual([
      "evidence:not-a-real-evidence-id",
    ]);
  });

  it("baseline reviewer cites only existing records", () => {
    for (const item of packetReviewFixtures) {
      const ids = packetReviewRecordIds(item.packet).all;
      const draft = createBaselinePacketReviewDraft(item.packet);

      expect(
        draft.evidence_citations.every((citation) => ids.has(citation.record_id)),
      ).toBe(true);
    }
  });
});

describe("packet review evaluator", () => {
  it("detects unsupported claims", () => {
    const baseFixture = fixture("high-risk-unsupported-next-action");
    const draft = createBaselinePacketReviewDraft(baseFixture.packet);

    draft.recommended_next_actions.push(
      "Tell the client the permit will be approved.",
    );

    const result = evaluatePacketReviewDraft(baseFixture, draft);

    expect(result.safety_warnings.join("\n")).toContain("permit will be approved");
    expect(result.unsupported_claim_penalty).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it("penalizes treating unverified evidence as verified", () => {
    const baseFixture = fixture("unverified-evidence");
    const draft = createBaselinePacketReviewDraft(baseFixture.packet);

    draft.summary = "Client-uploaded intake photo is verified and confirmed.";

    const result = evaluatePacketReviewDraft(baseFixture, draft);

    expect(result.safety_warnings.join("\n")).toContain(
      "unverified evidence as verified",
    );
    expect(result.unsupported_claim_penalty).toBeGreaterThan(0);
  });

  it("detects missing permit number and source fields", () => {
    const permitResult = evaluatePacketReviewDraft(
      fixture("missing-permit-number"),
      {
        ...createBaselinePacketReviewDraft(fixture("missing-permit-number").packet),
        missing_information: [],
      },
    );
    const sourceResult = evaluatePacketReviewDraft(fixture("missing-source-url"), {
      ...createBaselinePacketReviewDraft(fixture("missing-source-url").packet),
      missing_information: [],
    });

    expect(permitResult.missing_information_score).toBe(0);
    expect(sourceResult.missing_information_score).toBe(0);
  });
});

describe("deterministic baseline packet reviewer", () => {
  it("does not invent dates, agencies, reviewer names, or code sections", () => {
    const draft = createBaselinePacketReviewDraft(
      fixture("high-risk-unsupported-next-action").packet,
    );
    const text = textOfDraft(draft);

    expect(text).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
    expect(text).not.toMatch(/\bagency confirmed\b/i);
    expect(text).not.toMatch(/\breviewer\s+[A-Z][a-z]+\b/);
    expect(text).not.toMatch(/\b(code section|section)\s+\d/i);
  });

  it("runs all 20 fixtures through the baseline", () => {
    const summary = runLocalAiReviewEvaluation();

    expect(packetReviewFixtures).toHaveLength(20);
    expect(summary.fixture_count).toBe(20);
    expect(summary.fail_count).toBe(0);
    expect(summary.pass_count).toBe(20);
  });

  it("requires no API keys or external calls", () => {
    const fetchStub = vi.fn(() => {
      throw new Error("external calls are not allowed");
    });

    vi.stubGlobal("fetch", fetchStub);

    const summary = runLocalAiReviewEvaluation();
    const output = formatLocalAiReviewEvaluation(summary);

    expect(summary.fail_count).toBe(0);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(output).toContain("external_calls: none");
    expect(output).toContain("secrets_required: none");

    vi.unstubAllGlobals();
  });

  it("local eval script passes", () => {
    const summary = runLocalAiReviewEvaluation();
    const output = formatLocalAiReviewEvaluation(summary);

    expect(summary.fail_count).toBe(0);
    expect(output).toContain("fixtures: 20");
    expect(output).toContain("fail_count: 0");
    expect(output).toContain("external_calls: none");
  });
});
