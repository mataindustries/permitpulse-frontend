import { z } from "zod";
import type { PacketReviewDraft } from "./types";

const nonEmptyReviewText = z.string().trim().min(1).max(2000);

export const packetReviewCitationSchema = z
  .object({
    source_type: z.enum(["evidence", "timeline", "activity"]),
    record_id: z.string().trim().min(1).max(160),
    note: nonEmptyReviewText,
  })
  .strict();

export const packetReviewDraftSchema = z
  .object({
    summary: nonEmptyReviewText,
    missing_information: z.array(nonEmptyReviewText).max(50),
    recommended_next_actions: z.array(nonEmptyReviewText).max(50),
    evidence_citations: z.array(packetReviewCitationSchema).max(100),
    unsupported_claims: z.array(nonEmptyReviewText).max(50),
    confidence_notes: z.array(nonEmptyReviewText).max(50),
    model_metadata: z
      .object({
        reviewer: z.string().trim().min(1).max(120),
        generated_at: z.string().trim().min(1).max(80),
        local_only: z.literal(true),
        version: z.string().trim().min(1).max(40).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function parsePacketReviewDraft(value: unknown): PacketReviewDraft {
  return packetReviewDraftSchema.parse(value);
}
