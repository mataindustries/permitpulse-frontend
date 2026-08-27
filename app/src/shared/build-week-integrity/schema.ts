import { z } from "zod";
import {
  evidenceCaptureMethods,
  evidenceIntegrityClassifications,
  evidenceIntegrityReviewStatuses,
  evidenceIntegrityTypes,
  evidenceSourceAuthorities,
  evidenceUnknownReasons,
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

const evidenceIdentifierSchema = z.string().trim().min(1).max(128);
const evidenceTextSchema = z.string().trim().min(1).max(2000);
const evidenceTextListSchema = z.array(evidenceTextSchema).max(25);
const evidenceIdentifierListSchema = z
  .array(evidenceIdentifierSchema)
  .max(50)
  .refine((values) => new Set(values).size === values.length, {
    message: "Evidence references must be unique.",
  });
const evidenceDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toISOString().slice(0, 10) === value;
    },
    { message: "Evidence dates must be valid ISO calendar dates." },
  );
const evidenceTimestampSchema = z.string().datetime({ offset: true });
const evidenceSourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Evidence source URLs must use HTTP or HTTPS.")
  .nullable();

export const evidenceObservedValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("boolean"), value: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("number"),
      value: z.number().finite(),
      unit: z.string().trim().min(1).max(80).nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("text"), value: evidenceTextSchema }).strict(),
  z.object({ kind: z.literal("date"), value: evidenceDateSchema }).strict(),
  z.object({ kind: z.literal("not_observed"), value: z.null() }).strict(),
]);

export const evidenceNormalizedValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("boolean"), value: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("number"),
      value: z.number().finite(),
      unit: z.string().trim().min(1).max(80).nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("text"), value: evidenceTextSchema }).strict(),
  z.object({ kind: z.literal("date"), value: evidenceDateSchema }).strict(),
  z
    .object({
      kind: z.literal("unknown"),
      value: z.null(),
      reason: z.enum(evidenceUnknownReasons),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unresolved"),
      value: z.null(),
      reason: z.literal("conflicting_evidence"),
    })
    .strict(),
]);

const evidenceSubjectSchema = z
  .object({
    case_id: evidenceIdentifierSchema,
    property_id: evidenceIdentifierSchema.nullable(),
  })
  .strict();

const evidenceClaimSchema = z
  .object({
    key: evidenceIdentifierSchema,
    label: z.string().trim().min(1).max(240),
    client_label: z.string().trim().min(1).max(300),
  })
  .strict();

export const canonicalEvidenceRecordSchema = z
  .object({
    id: evidenceIdentifierSchema,
    subject: evidenceSubjectSchema,
    claim: evidenceClaimSchema,
    source: z
      .object({
        agency: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().min(1).max(1000).nullable(),
        url: evidenceSourceUrlSchema,
        authority: z.enum(evidenceSourceAuthorities),
        retrieved_at: evidenceTimestampSchema,
      })
      .strict(),
    raw_observed_value: evidenceObservedValueSchema,
    normalized_value: evidenceNormalizedValueSchema,
    evidence_type: z.enum(evidenceIntegrityTypes),
    classification: z.enum(evidenceIntegrityClassifications),
    confidence: z.number().int().min(0).max(100).nullable(),
    conflicts_with: evidenceIdentifierListSchema,
    review_status: z.enum(evidenceIntegrityReviewStatuses),
    notes: evidenceTextListSchema,
    limitations: evidenceTextListSchema,
    provenance: z
      .object({
        source_record_id: evidenceIdentifierSchema,
        capture_method: z.enum(evidenceCaptureMethods),
        is_ai_generated: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.conflicts_with.includes(record.id)) {
      context.addIssue({
        code: "custom",
        message: "An evidence record cannot conflict with itself.",
        path: ["conflicts_with"],
      });
    }

    if (
      record.classification === "verified_fact" &&
      !["reviewed", "resolved"].includes(record.review_status)
    ) {
      context.addIssue({
        code: "custom",
        message: "Verified facts require completed review.",
        path: ["review_status"],
      });
    }

    if (
      record.classification === "unknown" &&
      record.normalized_value.kind !== "unknown"
    ) {
      context.addIssue({
        code: "custom",
        message: "Unknown evidence must retain an unknown normalized value.",
        path: ["normalized_value"],
      });
    }

    if (
      record.classification === "conflict" &&
      record.normalized_value.kind !== "unresolved"
    ) {
      context.addIssue({
        code: "custom",
        message: "Conflicting evidence cannot carry a resolved value.",
        path: ["normalized_value"],
      });
    }
  });

export const canonicalEvidenceRecordsSchema = z
  .array(canonicalEvidenceRecordSchema)
  .min(1)
  .max(50)
  .superRefine((records, context) => {
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      context.addIssue({
        code: "custom",
        message: "Canonical evidence IDs must be unique.",
      });
    }
  });

const integrityConfidenceSchema = z
  .object({
    classification: z.number().int().min(0).max(100),
    conclusion: z.number().int().min(0).max(100).nullable(),
  })
  .strict();

export const integrityAiInterpretationSchema = z
  .object({
    assessment_id: evidenceIdentifierSchema,
    explanation: z.string().trim().min(1).max(3000).nullable(),
    abstained: z.boolean(),
    evidence_ids: evidenceIdentifierListSchema.min(1),
    generated_by: z.literal("ai"),
    is_evidence: z.literal(false),
  })
  .strict();

const integrityProvenanceCitationSchema = z
  .object({
    evidence_id: evidenceIdentifierSchema,
    source_agency: z.string().trim().min(1).max(200),
    source_title: z.string().trim().min(1).max(300),
    source_description: z.string().trim().min(1).max(1000).nullable(),
    source_url: evidenceSourceUrlSchema,
    retrieved_at: evidenceTimestampSchema,
    evidence_type: z.enum(evidenceIntegrityTypes),
    record_origin: z.literal("source_evidence"),
  })
  .strict();

export const clientSafeIntegrityFindingSchema = z
  .object({
    assessment_id: evidenceIdentifierSchema,
    classification: z.enum(evidenceIntegrityClassifications),
    statement: z.string().trim().min(1).max(1000),
    normalized_value: evidenceNormalizedValueSchema,
    confidence: integrityConfidenceSchema,
    review_status: z.enum(evidenceIntegrityReviewStatuses),
    human_review_required: z.boolean(),
    evidence: z.array(integrityProvenanceCitationSchema).min(1).max(50),
    ai_interpretation: integrityAiInterpretationSchema.nullable(),
  })
  .strict();

export const caseIntegrityFixtureSchema = z
  .object({
    id: evidenceIdentifierSchema,
    description: z.string().trim().min(1).max(1000),
    evidence_records: canonicalEvidenceRecordsSchema,
    expected: z
      .object({
        classification: z.enum(evidenceIntegrityClassifications),
        evidence_ids: evidenceIdentifierListSchema.min(1),
        client_safe_statement: z.string().trim().min(1).max(1000),
      })
      .strict(),
  })
  .strict();

export const integrityAiInterpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assessment_id: { type: "string", minLength: 1, maxLength: 128 },
    explanation: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 3000 },
        { type: "null" },
      ],
    },
    abstained: { type: "boolean" },
    evidence_ids: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    generated_by: { type: "string", enum: ["ai"] },
    is_evidence: { type: "boolean", enum: [false] },
  },
  required: [
    "assessment_id",
    "explanation",
    "abstained",
    "evidence_ids",
    "generated_by",
    "is_evidence",
  ],
} as const;

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
