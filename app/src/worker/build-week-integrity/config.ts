import type { Bindings } from "../types";
import {
  integritySpecialistModel,
  integritySynthesizerModel,
} from "../../shared/build-week-integrity/prompt";
import type { IntegrityReviewConfig } from "../../shared/build-week-integrity/types";

function enabled(value: string | undefined): boolean {
  return value === "true";
}

function usableApiKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    value.trim().length >= 16 &&
    !normalized.includes("replace-with") &&
    !normalized.includes("placeholder")
  );
}

export function readIntegrityReviewConfig(
  bindings: Bindings,
): IntegrityReviewConfig {
  const extensionEnabled = enabled(bindings.BUILD_WEEK_INTEGRITY_ENABLED);
  const liveEnabled = enabled(bindings.BUILD_WEEK_INTEGRITY_LIVE_ENABLED);

  return {
    enabled: extensionEnabled,
    demo_mode: enabled(bindings.BUILD_WEEK_DEMO_MODE),
    live_available: Boolean(
      extensionEnabled && liveEnabled && usableApiKey(bindings.OPENAI_API_KEY),
    ),
    human_review_required: true,
    specialist_model: integritySpecialistModel,
    synthesizer_model: integritySynthesizerModel,
  };
}

export function requireIntegrityApiKey(bindings: Bindings): string | null {
  const config = readIntegrityReviewConfig(bindings);
  if (!config.live_available) return null;
  return usableApiKey(bindings.OPENAI_API_KEY) ? bindings.OPENAI_API_KEY : null;
}
