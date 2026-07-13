import { z } from "zod";
import { actionPriorities, confidenceLevels, findingSeverities, questionStatuses } from "../../shared/reviewer/types";

const id = z.string().uuid();
const ids = z
  .array(id)
  .max(50)
  .refine((values) => new Set(values).size === values.length, {
    message: "Reference IDs must be unique.",
  })
  .default([]);
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
const lines = z.array(z.string().trim().min(1).max(500)).max(20).default([]);
export const actionKitInputSchema = z.object({
  current_position:z.string().trim().min(1).max(2000), confirmed_record:z.string().trim().min(1).max(4000), unconfirmed_record:z.string().trim().min(1).max(4000),
  primary_blocker:z.string().trim().min(1).max(2000), why_appropriate:z.string().trim().min(1).max(2000), evidence_readiness:z.string().trim().min(1).max(1000), review_readiness:z.string().trim().min(1).max(1000),
  email_subject:z.string().trim().min(1).max(300), recipient_role:z.string().trim().min(1).max(300), message_body:z.string().trim().min(1).max(5000),
  call_checklist:lines, requested_confirmations:lines, documents_ready:lines, escalation_trigger:z.string().trim().min(1).max(2000), follow_up_date:optionalDate,
  evidence_ids:ids, timeline_ids:ids, internal_note:z.string().max(8000).default(""), approved:z.boolean().default(false), version:version.optional(),
});

export type FindingInput = z.infer<typeof findingInputSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type ActionInput = z.infer<typeof actionInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type ActionKitInput = z.infer<typeof actionKitInputSchema>;
