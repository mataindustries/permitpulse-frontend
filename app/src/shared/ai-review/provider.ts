import { createBaselinePacketReviewDraft } from "./baseline-reviewer";
import {
  evaluatePacketReviewDraftForPacket,
  invalidPacketReviewCitations,
} from "./evaluate-review";
import { mockLivePacketReviewProvider } from "./mock-provider";
import {
  createLiveModelPacketReviewProvider,
  type LiveModelTransport,
} from "./live-model-provider";
import {
  isTestOnlyApiKey,
  type PacketReviewProviderConfig,
} from "./config";
import { buildPacketReviewPromptContract } from "./prompt";
import { scanPacketReviewSafety } from "./redaction";
import {
  packetReviewDraftSchema,
  parsePacketReviewDraftResponseData,
} from "./schema";
import type {
  PacketReviewDraft,
  PacketReviewDraftResponseData,
  PacketReviewProviderName,
} from "./types";
import type { PacketModel } from "../packet/types";
import type { PacketReviewPromptContract } from "./prompt";

export interface PacketReviewProvider {
  name: PacketReviewProviderName;
  liveAi: boolean;
  externalCalls: boolean;
  createDraft(
    packet: PacketModel,
    prompt: PacketReviewPromptContract,
  ): PacketReviewDraft | Promise<PacketReviewDraft>;
}

export interface PacketReviewProviderFailure {
  ok: false;
  code:
    | "INPUT_SAFETY_BLOCKED"
    | "PROMPT_SAFETY_BLOCKED"
    | "INVALID_PROVIDER_OUTPUT"
    | "INVALID_CITATIONS"
    | "EVALUATION_FAILED"
    | "INVALID_PROVIDER_CONFIG"
    | "LIVE_PROVIDER_DISABLED"
    | "EXTERNAL_CALLS_DISABLED"
    | "MISSING_API_KEY";
  safety_blocked: boolean;
  warnings: string[];
}

export type PacketReviewProviderResult =
  | { ok: true; data: PacketReviewDraftResponseData }
  | PacketReviewProviderFailure;

const deterministicBaselineProvider: PacketReviewProvider = {
  name: "deterministic-baseline",
  liveAi: false,
  externalCalls: false,
  createDraft(packet) {
    return createBaselinePacketReviewDraft(packet);
  },
};

const localProviders = {
  "deterministic-baseline": deterministicBaselineProvider,
  "mock-live-provider": mockLivePacketReviewProvider,
};

export function packetReviewProvider(
  name: PacketReviewProviderName,
): PacketReviewProvider {
  if (name === "live-model-provider") {
    throw new Error("Live provider configuration is required.");
  }

  return localProviders[name];
}

export function configuredPacketReviewProvider(
  name: PacketReviewProviderName,
  config: PacketReviewProviderConfig,
  transport?: LiveModelTransport,
): PacketReviewProvider | PacketReviewProviderFailure {
  if (name !== "live-model-provider") {
    return packetReviewProvider(name);
  }

  if (
    config.appEnvironment !== "local" ||
    !config.localTestEnabled ||
    !config.liveEnabled ||
    config.provider !== "live-model-provider"
  ) {
    return {
      ok: false,
      code: "LIVE_PROVIDER_DISABLED",
      safety_blocked: true,
      warnings: ["The live model provider is disabled."],
    };
  }

  if (!config.externalCallsEnabled) {
    return {
      ok: false,
      code: "EXTERNAL_CALLS_DISABLED",
      safety_blocked: true,
      warnings: ["External model calls are disabled."],
    };
  }

  if (!config.apiKey || !isTestOnlyApiKey(config.apiKey)) {
    return {
      ok: false,
      code: "MISSING_API_KEY",
      safety_blocked: true,
      warnings: ["A test-only local provider key is required."],
    };
  }

  return createLiveModelPacketReviewProvider({
    apiKey: config.apiKey,
    endpoint: config.modelEndpoint,
    model: config.modelName,
    transport,
  });
}

export async function runPacketReviewProvider(
  packet: PacketModel,
  provider: PacketReviewProvider,
): Promise<PacketReviewProviderResult> {
  const inputScan = scanPacketReviewSafety(packet);

  if (inputScan.blocked) {
    return {
      ok: false,
      code: "INPUT_SAFETY_BLOCKED",
      safety_blocked: true,
      warnings: inputScan.warnings.map((warning) => warning.message),
    };
  }

  const prompt = buildPacketReviewPromptContract(packet);
  const promptScan = scanPacketReviewSafety(prompt);

  if (promptScan.blocked) {
    return {
      ok: false,
      code: "PROMPT_SAFETY_BLOCKED",
      safety_blocked: true,
      warnings: promptScan.warnings.map((warning) => warning.message),
    };
  }

  let candidate: unknown;

  try {
    candidate = await provider.createDraft(packet, prompt);
  } catch {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      safety_blocked: true,
      warnings: ["Provider output could not be parsed safely."],
    };
  }

  const parsedDraft = packetReviewDraftSchema.safeParse(candidate);

  if (!parsedDraft.success) {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      safety_blocked: true,
      warnings: ["Provider output did not match PacketReviewDraft."],
    };
  }

  const review = parsedDraft.data;
  const invalidCitations = invalidPacketReviewCitations(packet, review);

  if (invalidCitations.length > 0) {
    return {
      ok: false,
      code: "INVALID_CITATIONS",
      safety_blocked: true,
      warnings: invalidCitations.map(
        (citation) => `Provider output cited a nonexistent record: ${citation}.`,
      ),
    };
  }

  const evaluation = evaluatePacketReviewDraftForPacket(packet, review);

  if (!evaluation.passed || evaluation.safety_warnings.length > 0) {
    return {
      ok: false,
      code: "EVALUATION_FAILED",
      safety_blocked: true,
      warnings:
        evaluation.safety_warnings.length > 0
          ? evaluation.safety_warnings
          : ["Provider output did not pass the local evaluator."],
    };
  }

  const warnings = evaluation.safety_warnings;

  return {
    ok: true,
    data: parsePacketReviewDraftResponseData({
      review,
      evaluation: {
        score: evaluation.total_score,
        passed: evaluation.passed,
        warnings,
        citation_validity: {
          score: evaluation.citation_validity_score,
          passed: true,
          invalid_citations: [],
        },
        safety: {
          passed: true,
          warnings,
        },
      },
      metadata: {
        provider: provider.name,
        reviewer: provider.name,
        live_ai: provider.liveAi,
        external_calls: provider.externalCalls,
        evaluation_passed: evaluation.passed,
        safety_blocked: false,
        warnings_count: warnings.length,
      },
    }),
  };
}
