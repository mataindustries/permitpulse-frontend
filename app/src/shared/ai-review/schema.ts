import { z } from "zod";
import type {
  PacketReviewDraft,
  PacketReviewDraftResponseData,
} from "./types";

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

export const packetReviewDraftEvaluationReportSchema = z
  .object({
    score: z.number().min(0).max(100),
    passed: z.boolean(),
    warnings: z.array(nonEmptyReviewText).max(100),
    citation_validity: z
      .object({
        score: z.number().min(0).max(100),
        passed: z.boolean(),
        invalid_citations: z.array(nonEmptyReviewText).max(100),
      })
      .strict(),
    safety: z
      .object({
        passed: z.boolean(),
        warnings: z.array(nonEmptyReviewText).max(100),
      })
      .strict(),
  })
  .strict();

export const packetReviewProviderNameSchema = z.enum([
  "deterministic-baseline",
  "mock-live-provider",
]);

export const packetReviewProviderRequestSchema = z
  .object({
    provider: packetReviewProviderNameSchema.optional(),
  })
  .strict();

export const packetReviewDraftResponseDataSchema = z
  .object({
    review: packetReviewDraftSchema,
    evaluation: packetReviewDraftEvaluationReportSchema,
    metadata: z
      .object({
        provider: packetReviewProviderNameSchema,
        reviewer: packetReviewProviderNameSchema,
        live_ai: z.literal(false),
        external_calls: z.literal(false),
        evaluation_passed: z.boolean(),
        safety_blocked: z.boolean(),
        warnings_count: z.number().int().min(0).max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.metadata.provider !== data.metadata.reviewer) {
      context.addIssue({
        code: "custom",
        message: "Provider and reviewer metadata must match.",
        path: ["metadata", "reviewer"],
      });
    }

    if (data.metadata.evaluation_passed !== data.evaluation.passed) {
      context.addIssue({
        code: "custom",
        message: "Evaluation metadata must match the evaluation report.",
        path: ["metadata", "evaluation_passed"],
      });
    }

    if (data.metadata.safety_blocked) {
      context.addIssue({
        code: "custom",
        message: "A blocked review cannot be returned as response data.",
        path: ["metadata", "safety_blocked"],
      });
    }

    const warningCount = new Set([
      ...data.evaluation.warnings,
      ...data.evaluation.safety.warnings,
    ]).size;

    if (data.metadata.warnings_count !== warningCount) {
      context.addIssue({
        code: "custom",
        message: "Warning metadata must match the evaluation report.",
        path: ["metadata", "warnings_count"],
      });
    }
  });

export function parsePacketReviewDraft(value: unknown): PacketReviewDraft {
  return packetReviewDraftSchema.parse(value);
}

export function parsePacketReviewDraftResponseData(
  value: unknown,
): PacketReviewDraftResponseData {
  return packetReviewDraftResponseDataSchema.parse(value);
}
