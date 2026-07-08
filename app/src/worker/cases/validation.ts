import { z } from "zod";
import {
  caseStatuses,
  evidenceTypes,
  evidenceVerificationStatuses,
  timelineTypes,
} from "../db/schema";

export const createCaseSchema = z
  .object({
    project_name: z.string().trim().min(1).max(120),
    client_name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(240),
    city: z.string().trim().min(1).max(120),
    jurisdiction: z.string().trim().min(1).max(160),
    permit_number: z.string().trim().min(1).max(80).nullable().default(null),
    current_status: z.enum(caseStatuses).default("intake"),
  })
  .strict();

export const caseIdSchema = z.string().uuid();

export const caseListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const caseActivityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const evidenceTimelinePaginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

const expectedVersionSchema = z.number().int().min(1);
const trimmedNullable = (maximumLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .nullable();
const optionalTrimmedNullable = (maximumLength: number) =>
  trimmedNullable(maximumLength).default(null);

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isoDateSchema = z.string().trim().refine(isIsoDate, {
  message: "Expected a valid ISO date.",
});

const nullableIsoDateSchema = isoDateSchema.nullable();
const optionalNullableIsoDateSchema = nullableIsoDateSchema.default(null);

const nullableHttpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);

      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Expected an absolute http or https URL.")
  .nullable();
const optionalNullableHttpUrlSchema = nullableHttpUrlSchema.default(null);

const editableCaseFields = {
  project_name: z.string().trim().min(1).max(120).optional(),
  client_name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().min(1).max(240).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  jurisdiction: z.string().trim().min(1).max(160).optional(),
  permit_number: z.string().trim().min(1).max(80).nullable().optional(),
};

export const updateCaseMetadataSchema = z
  .object({
    expected_version: expectedVersionSchema,
    ...editableCaseFields,
  })
  .strict()
  .refine(
    ({ expected_version: _expectedVersion, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    {
      message: "At least one editable case field is required.",
    },
  );

export const updateCaseStatusSchema = z
  .object({
    expected_version: expectedVersionSchema,
    current_status: z.enum(caseStatuses),
  })
  .strict();

export const createEvidenceSchema = z
  .object({
    evidence_type: z.enum(evidenceTypes),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(2000),
    source_url: optionalNullableHttpUrlSchema,
    source_label: optionalTrimmedNullable(160),
    source_date: optionalNullableIsoDateSchema,
  })
  .strict();

const editableEvidenceFields = {
  evidence_type: z.enum(evidenceTypes).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
  source_url: nullableHttpUrlSchema.optional(),
  source_label: trimmedNullable(160).optional(),
  source_date: nullableIsoDateSchema.optional(),
  verification_status: z.enum(evidenceVerificationStatuses).optional(),
};

export const updateEvidenceSchema = z
  .object({
    expected_version: expectedVersionSchema,
    ...editableEvidenceFields,
  })
  .strict()
  .refine(
    ({ expected_version: _expectedVersion, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    {
      message: "At least one editable evidence field is required.",
    },
  );

export const createTimelineSchema = z
  .object({
    occurred_on: isoDateSchema,
    timeline_type: z.enum(timelineTypes),
    title: z.string().trim().min(1).max(160),
    details: z.string().trim().min(1).max(4000),
    is_canonical: z.boolean().default(false),
    evidence_ids: z
      .array(caseIdSchema)
      .max(20)
      .optional()
      .default([])
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Evidence IDs must be unique.",
      ),
  })
  .strict();

export const updateTimelineSchema = z
  .object({
    expected_version: expectedVersionSchema,
    occurred_on: isoDateSchema.optional(),
    timeline_type: z.enum(timelineTypes).optional(),
    title: z.string().trim().min(1).max(160).optional(),
    details: z.string().trim().min(1).max(4000).optional(),
    is_canonical: z.boolean().optional(),
  })
  .strict()
  .refine(
    ({ expected_version: _expectedVersion, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    {
      message: "At least one editable timeline field is required.",
    },
  );

export const linkEvidenceSchema = z
  .object({
    evidence_id: caseIdSchema,
  })
  .strict();

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;
export type CaseActivityQuery = z.infer<typeof caseActivityQuerySchema>;
export type EvidenceTimelinePagination = z.infer<
  typeof evidenceTimelinePaginationSchema
>;
export type UpdateCaseMetadataInput = z.infer<
  typeof updateCaseMetadataSchema
>;
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;
export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;
export type CreateTimelineInput = z.infer<typeof createTimelineSchema>;
export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>;
