import { describe, expect, it, vi } from "vitest";
import { createBaselinePacketReviewDraft } from "../src/shared/ai-review/baseline-reviewer";
import { packetReviewFixtures } from "../src/shared/ai-review/fixtures";
import { mockLivePacketReviewProvider } from "../src/shared/ai-review/mock-provider";
import {
  packetReviewProvider,
  runPacketReviewProvider,
  type PacketReviewProvider,
} from "../src/shared/ai-review/provider";
import {
  buildPacketReviewPromptContract,
  packetReviewPromptRules,
} from "../src/shared/ai-review/prompt";
import { scanPacketReviewSafety } from "../src/shared/ai-review/redaction";
import { packetReviewDraftSchema } from "../src/shared/ai-review/schema";

function fixture(id = "verified-evidence") {
  const item = packetReviewFixtures.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`Missing fixture ${id}`);
  }

  return item;
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(objectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...objectKeys(child),
  ]);
}

describe("packet review prompt contract", () => {
  it("includes required safety instructions and safe citation IDs", () => {
    const packet = fixture().packet;
    const prompt = buildPacketReviewPromptContract(packet);
    const rules = prompt.rules.join("\n");

    expect(prompt.rules).toEqual(packetReviewPromptRules);
    expect(rules).toMatch(/cite only evidence, timeline, or activity record IDs/i);
    expect(rules).toMatch(/do not invent agencies, reviewer names, code sections, dates, or outcomes/i);
    expect(rules).toMatch(/do not predict permit approval/i);
    expect(rules).toMatch(/do not provide legal guarantees/i);
    expect(rules).toMatch(/do not treat unverified or disputed evidence as verified/i);
    expect(rules).toMatch(/strict JSON matching PacketReviewDraft/i);
    expect(prompt.citation_record_ids).toEqual({
      evidence: packet.evidence_summaries.map((item) => item.id),
      timeline: packet.timeline_summaries.map((item) => item.id),
      activity: packet.recent_activity_summaries.map((item) => item.id),
    });
  });

  it("copies an explicit safe allowlist and excludes private or arbitrary fields", () => {
    const packet = Object.assign({}, fixture().packet, {
      password: "not-allowed",
      token: "not-allowed",
      cookie: "not-allowed",
      session: { id: "not-allowed" },
      account: { id: "not-allowed" },
      authorization: "not-allowed",
      request_id: "not-allowed",
      created_by_user_id: "not-allowed",
      lifecycle_mutation_nonce: "not-allowed",
      raw_database_row: { private: true },
    });
    const prompt = buildPacketReviewPromptContract(packet);
    const keys = objectKeys(prompt);

    for (const forbidden of [
      "password",
      "token",
      "cookie",
      "session",
      "account",
      "authorization",
      "request_id",
      "created_by_user_id",
      "lifecycle_mutation_nonce",
      "raw_database_row",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("packet review structured safety scanner", () => {
  it("blocks forbidden structured keys and reports their paths", () => {
    const result = scanPacketReviewSafety({
      auth: {
        passwordHash: "not-allowed",
        api_key: "not-allowed",
        session_token: "not-allowed",
      },
      requestId: "not-allowed",
    });

    expect(result.blocked).toBe(true);
    expect(result.warnings.map((warning) => warning.matched_label)).toEqual(
      expect.arrayContaining(["hash", "api_key", "token", "request_id"]),
    );
    expect(result.warnings.map((warning) => warning.path)).toContain(
      "auth.session_token",
    );
  });

  it("does not flag forbidden words that appear only in normal explanatory text", () => {
    const result = scanPacketReviewSafety({
      summary:
        "Ask the account liaison whether the session mentioned a token cookie or password reset.",
      notes: ["No authorization conclusion or secret guarantee is implied."],
    });

    expect(result).toEqual({ blocked: false, warnings: [] });
  });
});

describe("local packet review providers and result gate", () => {
  it("returns strict deterministic mock output without external calls", () => {
    const packet = fixture().packet;
    const prompt = buildPacketReviewPromptContract(packet);
    const fetchStub = vi.fn(() => {
      throw new Error("External calls are not allowed.");
    });
    vi.stubGlobal("fetch", fetchStub);

    try {
      const candidate = mockLivePacketReviewProvider.createDraft(packet, prompt);

      expect(packetReviewDraftSchema.safeParse(candidate).success).toBe(true);
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("runs mock output through schema, citation, evaluator, and metadata gates", async () => {
    const result = await runPacketReviewProvider(
      fixture().packet,
      packetReviewProvider("mock-live-provider"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.code);
    }

    expect(result.data.evaluation.passed).toBe(true);
    expect(result.data.evaluation.citation_validity.passed).toBe(true);
    expect(result.data.evaluation.safety.passed).toBe(true);
    expect(result.data.metadata).toMatchObject({
      provider: "mock-live-provider",
      live_ai: false,
      external_calls: false,
      evaluation_passed: true,
      safety_blocked: false,
    });
  });

  it("fails closed when provider output cites a nonexistent packet record", async () => {
    const invalidCitationProvider: PacketReviewProvider = {
      name: "mock-live-provider",
      liveAi: false,
      externalCalls: false,
      createDraft(packet) {
        const draft = createBaselinePacketReviewDraft(packet);
        draft.evidence_citations.push({
          source_type: "evidence",
          record_id: "nonexistent-evidence-id",
          note: "This citation does not exist.",
        });
        return draft;
      },
    };
    const result = await runPacketReviewProvider(
      fixture().packet,
      invalidCitationProvider,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_CITATIONS",
      safety_blocked: true,
    });
  });

  it("fails closed when provider output predicts permit approval", async () => {
    const approvalPredictionProvider: PacketReviewProvider = {
      name: "mock-live-provider",
      liveAi: false,
      externalCalls: false,
      createDraft(packet) {
        return {
          ...createBaselinePacketReviewDraft(packet),
          summary: "The permit will be approved.",
        };
      },
    };
    const result = await runPacketReviewProvider(
      fixture().packet,
      approvalPredictionProvider,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "EVALUATION_FAILED",
      safety_blocked: true,
    });
  });

  it("fails closed on forbidden packet fields before provider execution", async () => {
    const provider = packetReviewProvider("mock-live-provider");
    const createDraft = vi.spyOn(provider, "createDraft");
    const packet = Object.assign({}, fixture().packet, {
      authorization_token: "not-allowed",
    });
    const result = await runPacketReviewProvider(packet, provider);

    expect(result).toMatchObject({
      ok: false,
      code: "INPUT_SAFETY_BLOCKED",
      safety_blocked: true,
    });
    expect(createDraft).not.toHaveBeenCalled();
    createDraft.mockRestore();
  });
});
