import { z } from "zod";
import { actionPriorities, confidenceLevels, findingSeverities, questionStatuses } from "../../shared/reviewer/types";

const id = z.string().uuid();
const ids = z.array(id).max(50).default([]);
const version = z.number().int().positive();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const findingInputSchema = z.object({
  title: z.string().trim().min(1).max(160), finding_type: z.enum(["risk","strength"]).default("risk"), severity: z.enum(findingSeverities),
  summary: z.string().trim().min(1).max(4000), evidence_ids: ids, timeline_ids: ids,
  confidence: z.enum(confidenceLevels), recommended_resolution: z.string().trim().min(1).max(4000),
  internal_notes: z.string().max(8000).default(""), approved: z.boolean().default(false), version: version.optional(),
});
export const questionInputSchema = z.object({
  question: z.string().trim().min(1).max(1000), why_it_matters: z.string().trim().min(1).max(2000),
  evidence_requested: z.string().trim().min(1).max(2000), assigned_reviewer: z.string().trim().min(1).max(160),
  status: z.enum(questionStatuses), publishable: z.boolean().default(true), version: version.optional(),
});
export const actionInputSchema = z.object({
  priority: z.enum(actionPriorities), description: z.string().trim().min(1).max(4000), evidence_ids: ids,
  estimated_impact: z.string().trim().min(1).max(2000), responsible_party: z.string().trim().min(1).max(160),
  due_date: optionalDate, approved: z.boolean().default(false), version: version.optional(),
});
export const noteInputSchema = z.object({
  commentary: z.string().trim().min(1).max(8000), publishable: z.boolean().default(false), version: version.optional(),
});

export type FindingInput = z.infer<typeof findingInputSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type ActionInput = z.infer<typeof actionInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
