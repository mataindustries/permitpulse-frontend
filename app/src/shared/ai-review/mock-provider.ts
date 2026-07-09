import { createBaselinePacketReviewDraft } from "./baseline-reviewer";
import type { PacketReviewProvider } from "./provider";

export const mockLivePacketReviewProvider: PacketReviewProvider = {
  name: "mock-live-provider",
  liveAi: false,
  externalCalls: false,
  createDraft(packet, prompt) {
    const draft = createBaselinePacketReviewDraft(packet);
    const citationCount =
      prompt.citation_record_ids.evidence.length +
      prompt.citation_record_ids.timeline.length +
      prompt.citation_record_ids.activity.length;

    return {
      ...draft,
      summary: `Local mock provider reviewed ${citationCount} packet record(s). The packet case is in ${packet.current_status.label}.`,
      confidence_notes: [
        ...draft.confidence_notes,
        "This deterministic model-shaped response was produced by the local mock provider.",
      ],
      model_metadata: {
        reviewer: "mock-live-provider",
        generated_at: packet.generated_at,
        local_only: true,
        version: "2026-07-09",
      },
    };
  },
};
