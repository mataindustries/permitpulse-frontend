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

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
