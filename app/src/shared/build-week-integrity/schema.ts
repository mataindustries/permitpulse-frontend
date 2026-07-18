import { z } from "zod";
import {
  integrityCategories,
  integrityPacketImpacts,
  integritySeverities,
  integrityStageNames,
} from "./types";

const conciseText = z.string().trim().min(1).max(3000);
const nullableObservationText = z.string().trim().min(1).max(2000).nullable();
const specialistNames = integrityStageNames.filter(
  (stage): stage is Exclude<(typeof integrityStageNames)[number], "synthesis"> =>
    stage !== "synthesis",
);

export const integrityDraftItemSchema = z
  .object({
    category: z.enum(integrityCategories),
    severity: z.enum(integritySeverities),
    confidence: z.number().int().min(0).max(100),
    title: z.string().trim().min(1).max(200),
    verified_fact: z.string().trim().min(1).max(2000),
    inference: nullableObservationText,
    unknown: nullableObservationText,
    rationale: conciseText,
    evidence_ids: z.array(z.string().trim().min(1).max(64)).min(1).max(25),
    proposed_corrective_action: conciseText,
    packet_readiness_impact: z.enum(integrityPacketImpacts),
    source_analysts: z.array(z.enum(specialistNames)).min(1).max(3),
  })
  .strict();

export const integrityAnalystOutputSchema = z
  .object({
    analyst_summary: z.string().trim().min(1).max(3000),
    observations: z.array(integrityDraftItemSchema).max(12),
  })
  .strict();

export const integritySynthesisOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(4000),
    items: z.array(integrityDraftItemSchema).min(1).max(12),
  })
  .strict();

export const integrityRunRequestSchema = z.object({}).strict();

export const integrityDecisionInputSchema = z
  .object({
    decision: z.enum(["accepted", "edited", "rejected"]),
    expected_version: z.number().int().min(1),
    reviewer_edited_text: z.string().trim().min(1).max(3000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "edited" && !value.reviewer_edited_text) {
      context.addIssue({
        code: "custom",
        message: "Edited decisions require reviewer-edited text.",
        path: ["reviewer_edited_text"],
      });
    }

    if (value.decision !== "edited" && value.reviewer_edited_text !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Reviewer-edited text is only allowed for an edited decision.",
        path: ["reviewer_edited_text"],
      });
    }
  });

export const integrityDemoResetRequestSchema = z
  .object({ confirmation: z.literal("reset-arroyo-vista-integrity-v1") })
  .strict();

const nullableTextJsonSchema = {
  anyOf: [
    { type: "string", minLength: 1, maxLength: 2000 },
    { type: "null" },
  ],
} as const;

export const integrityDraftItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: [...integrityCategories] },
    severity: { type: "string", enum: [...integritySeverities] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    verified_fact: { type: "string", minLength: 1, maxLength: 2000 },
    inference: nullableTextJsonSchema,
    unknown: nullableTextJsonSchema,
    rationale: { type: "string", minLength: 1, maxLength: 3000 },
    evidence_ids: {
      type: "array",
      minItems: 1,
      maxItems: 25,
      items: { type: "string", minLength: 1, maxLength: 64 },
    },
    proposed_corrective_action: {
      type: "string",
      minLength: 1,
      maxLength: 3000,
    },
    packet_readiness_impact: {
      type: "string",
      enum: [...integrityPacketImpacts],
    },
    source_analysts: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: [...specialistNames] },
    },
  },
  required: [
    "category",
    "severity",
    "confidence",
    "title",
    "verified_fact",
    "inference",
    "unknown",
    "rationale",
    "evidence_ids",
    "proposed_corrective_action",
    "packet_readiness_impact",
    "source_analysts",
  ],
} as const;

export const integrityAnalystOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    analyst_summary: { type: "string", minLength: 1, maxLength: 3000 },
    observations: {
      type: "array",
      maxItems: 12,
      items: integrityDraftItemJsonSchema,
    },
  },
  required: ["analyst_summary", "observations"],
} as const;

export const integritySynthesisOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 4000 },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: integrityDraftItemJsonSchema,
    },
  },
  required: ["summary", "items"],
} as const;
