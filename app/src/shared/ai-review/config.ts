import { z } from "zod";
import { packetReviewProviderNameSchema } from "./schema";
import type { PacketReviewProviderName } from "./types";

export interface PacketReviewConfigBindings {
  AI_REVIEW_EXTERNAL_CALLS_ENABLED?: string;
  AI_REVIEW_LIVE_ENABLED?: string;
  AI_REVIEW_LOCAL_TEST_ENABLED?: string;
  AI_REVIEW_PROVIDER?: string;
  AI_REVIEW_API_KEY?: string;
  AI_REVIEW_MODEL_ENDPOINT?: string;
  AI_REVIEW_MODEL_NAME?: string;
  APP_ENV?: string;
}

export interface PacketReviewProviderConfig {
  appEnvironment: string;
  externalCallsEnabled: boolean;
  liveEnabled: boolean;
  localTestEnabled: boolean;
  provider: PacketReviewProviderName;
  apiKey?: string;
  modelEndpoint: string;
  modelName: string;
}

export type PacketReviewConfigResult =
  | { ok: true; config: PacketReviewProviderConfig }
  | { ok: false; code: "INVALID_PROVIDER_CONFIG" };

const booleanFlagSchema = z.enum(["true", "false"]).optional();
const loopbackEndpointSchema = z
  .string()
  .url()
  .refine((value) => {
    const hostname = new URL(value).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  });

function enabled(value: "true" | "false" | undefined): boolean {
  return value === "true";
}

export function readPacketReviewProviderConfig(
  bindings: PacketReviewConfigBindings,
): PacketReviewConfigResult {
  const parsed = z
    .object({
      AI_REVIEW_EXTERNAL_CALLS_ENABLED: booleanFlagSchema,
      AI_REVIEW_LIVE_ENABLED: booleanFlagSchema,
      AI_REVIEW_LOCAL_TEST_ENABLED: booleanFlagSchema,
      AI_REVIEW_PROVIDER: packetReviewProviderNameSchema.optional(),
      AI_REVIEW_API_KEY: z.string().min(1).optional(),
      AI_REVIEW_MODEL_ENDPOINT: loopbackEndpointSchema.optional(),
      AI_REVIEW_MODEL_NAME: z.string().trim().min(1).max(120).optional(),
      APP_ENV: z.string().optional(),
    })
    .safeParse(bindings);

  if (!parsed.success) {
    return { ok: false, code: "INVALID_PROVIDER_CONFIG" };
  }

  return {
    ok: true,
    config: {
      appEnvironment: parsed.data.APP_ENV ?? "local",
      externalCallsEnabled: enabled(
        parsed.data.AI_REVIEW_EXTERNAL_CALLS_ENABLED,
      ),
      liveEnabled: enabled(parsed.data.AI_REVIEW_LIVE_ENABLED),
      localTestEnabled: enabled(parsed.data.AI_REVIEW_LOCAL_TEST_ENABLED),
      provider: parsed.data.AI_REVIEW_PROVIDER ?? "deterministic-baseline",
      apiKey: parsed.data.AI_REVIEW_API_KEY,
      modelEndpoint:
        parsed.data.AI_REVIEW_MODEL_ENDPOINT ??
        "http://127.0.0.1:8788/v1/packet-review",
      modelName: parsed.data.AI_REVIEW_MODEL_NAME ?? "permitpulse-local-test",
    },
  };
}

export function isTestOnlyApiKey(value: string): boolean {
  return /^(fake|test)(?:[-_:]|$)/i.test(value);
}
