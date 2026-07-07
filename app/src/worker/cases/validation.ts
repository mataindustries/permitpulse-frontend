import { z } from "zod";
import { caseStatuses } from "../db/schema";

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

const expectedVersionSchema = z.number().int().min(1);

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

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;
export type CaseActivityQuery = z.infer<typeof caseActivityQuerySchema>;
export type UpdateCaseMetadataInput = z.infer<
  typeof updateCaseMetadataSchema
>;
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;
