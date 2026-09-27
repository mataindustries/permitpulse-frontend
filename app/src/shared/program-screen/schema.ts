import { z } from "zod";
import { canonicalEvidenceRecordsSchema } from "../build-week-integrity/schema";
import type { CanonicalEvidenceRecord } from "../build-week-integrity/types";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import { programFactSpecs } from "./facts";
import {
  citationVolatilities,
  criterionVerifications,
  programConfirmers,
  programFactKeys,
  programPathwayIds,
  type CitationVolatility,
  type ProgramCriterion,
  type ProgramFactKey,
  type ProgramPathwayPack,
} from "./types";

/**
 * Maximum days between a citation's verification and its next review. The
 * Paper Trail Loop treats any note as stale after 90 days without a more
 * specific cadence; more volatile sources get a shorter cadence.
 */
export const citationReviewCadenceDays: Readonly<Record<CitationVolatility, number>> = {
  high: 30,
  medium: 60,
  low: 90,
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export const programIsoDateSchema = z
  .string()
  .refine(isIsoDate, { message: "Dates must be valid ISO calendar dates." });

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const nonEmptyText = z.string().trim().min(1).max(600);
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "Criterion citations must use HTTPS.");

export const programCriterionCitationSchema = z
  .object({
    title: nonEmptyText,
    url: httpsUrl,
    pinpoint: nonEmptyText,
    verified_at: programIsoDateSchema,
    volatility: z.enum(citationVolatilities),
    next_review_at: programIsoDateSchema,
  })
  .strict()
  .superRefine((citation, context) => {
    if (citation.next_review_at <= citation.verified_at) {
      context.addIssue({
        code: "custom",
        message: "A citation's next review must follow its verification date.",
        path: ["next_review_at"],
      });
    }
    const latest = addDays(
      citation.verified_at,
      citationReviewCadenceDays[citation.volatility],
    );
    if (citation.next_review_at > latest) {
      context.addIssue({
        code: "custom",
        message: `A ${citation.volatility}-volatility citation must be reviewed by ${latest}.`,
        path: ["next_review_at"],
      });
    }
  });

const parcelFactKeys = programFactKeys.filter(
  (key) => programFactSpecs[key].role === "parcel_fact",
);

export const programCriterionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9-]+$/),
    pathway: z.enum(programPathwayIds),
    label: nonEmptyText,
    gating: z.boolean(),
    fact_keys: z
      .array(z.enum(programFactKeys))
      .min(1)
      .refine((keys) => new Set(keys).size === keys.length, "Fact keys must be unique."),
    predicate: z.union([
      z.literal("professional_judgment"),
      z.literal("not_encoded"),
      z.custom<(...args: unknown[]) => unknown>(
        (value) => typeof value === "function",
        "Predicates must be functions.",
      ),
    ]),
    rule_summary: nonEmptyText,
    citation: programCriterionCitationSchema,
    confirmer: z.enum(programConfirmers),
    question_if_unknown: nonEmptyText,
    question_if_conflict: nonEmptyText,
    question_if_judgment: nonEmptyText.nullable(),
    verification: z.enum(criterionVerifications),
    basis: z
      .object({
        repo_path: nonEmptyText,
        excerpts: z.array(nonEmptyText).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((criterion, context) => {
    if (!criterion.id.startsWith(`${criterion.pathway}.`)) {
      context.addIssue({
        code: "custom",
        message: "Criterion IDs must be namespaced by pathway.",
        path: ["id"],
      });
    }
    const flagKeys = criterion.fact_keys.filter(
      (key) => !(parcelFactKeys as readonly string[]).includes(key),
    );
    if (flagKeys.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Program flags are observations and cannot be criterion inputs: ${flagKeys.join(", ")}.`,
        path: ["fact_keys"],
      });
    }
    if (criterion.predicate === "not_encoded" && criterion.verification !== "pending_human") {
      context.addIssue({
        code: "custom",
        message: "A criterion without an encoded rule must remain pending human verification.",
        path: ["verification"],
      });
    }
    if (criterion.predicate !== "not_encoded" && criterion.question_if_judgment === null) {
      context.addIssue({
        code: "custom",
        message: "An encoded or judgment criterion needs a judgment question template.",
        path: ["question_if_judgment"],
      });
    }
  });

export const programPathwayPackSchema = z
  .object({
    pathway: z
      .object({
        id: z.enum(programPathwayIds),
        label: nonEmptyText,
        confirmer: z.enum(programConfirmers),
      })
      .strict(),
    criteria: z.array(programCriterionSchema).min(1),
  })
  .strict()
  .superRefine((pack, context) => {
    const ids = pack.criteria.map((criterion) => criterion.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Criterion IDs must be unique." });
    }
    if (pack.criteria.some((criterion) => criterion.pathway !== pack.pathway.id)) {
      context.addIssue({
        code: "custom",
        message: "Every criterion must belong to its pack's pathway.",
      });
    }
  });

export function parseProgramPathwayPacks(
  value: readonly ProgramPathwayPack[],
): ProgramPathwayPack[] {
  const ids = value.map((pack) => pack?.pathway?.id);
  if (value.length === 0 || new Set(ids).size !== ids.length) {
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_CRITERION",
      "Program Screen packs must be non-empty with unique pathways.",
    );
  }
  for (const pack of value) {
    const parsed = programPathwayPackSchema.safeParse(pack);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new IntegrityValidationError(
        "INVALID_PROGRAM_CRITERION",
        `Program Screen criteria failed validation at ${issue.path.join(".") || "pack"}: ${issue.message}`,
      );
    }
  }
  // Return the originals: parsing must not detach predicate identity.
  return [...value];
}

function valueMatchesSpec(record: CanonicalEvidenceRecord, key: ProgramFactKey): string | null {
  const spec = programFactSpecs[key];
  const normalized = record.normalized_value;
  if (normalized.kind === "unknown" || normalized.kind === "unresolved") return null;
  if (normalized.kind !== spec.value.kind) {
    return `expects a ${spec.value.kind} value`;
  }
  if (
    spec.value.kind === "number" &&
    normalized.kind === "number" &&
    normalized.unit !== spec.value.unit
  ) {
    return `expects unit ${spec.value.unit}`;
  }
  if (
    spec.value.kind === "text" &&
    spec.value.allowed !== null &&
    normalized.kind === "text" &&
    !spec.value.allowed.includes(normalized.value)
  ) {
    return `expects one of ${spec.value.allowed.join(" | ")}`;
  }
  return null;
}

/**
 * Canonical evidence schema plus Program Screen constraints: one parcel, known
 * fact keys, controlled claim wording, value shapes, and evidence types.
 */
export const programScreenEvidenceRecordsSchema = canonicalEvidenceRecordsSchema.superRefine(
  (records, context) => {
    const subject = JSON.stringify(records[0]?.subject);
    records.forEach((record, index) => {
      if (JSON.stringify(record.subject) !== subject) {
        context.addIssue({
          code: "custom",
          message: "A Program Screen evaluates exactly one parcel subject.",
          path: [index, "subject"],
        });
      }
      if (!(programFactKeys as readonly string[]).includes(record.claim.key)) {
        context.addIssue({
          code: "custom",
          message: `Unknown Program Screen fact key ${record.claim.key}.`,
          path: [index, "claim", "key"],
        });
        return;
      }
      const key = record.claim.key as ProgramFactKey;
      const spec = programFactSpecs[key];
      if (
        record.claim.label !== spec.label ||
        record.claim.client_label !== spec.client_label
      ) {
        context.addIssue({
          code: "custom",
          message: `Evidence for ${key} must use the controlled fact labels.`,
          path: [index, "claim"],
        });
      }
      const mismatch = valueMatchesSpec(record as CanonicalEvidenceRecord, key);
      if (mismatch) {
        context.addIssue({
          code: "custom",
          message: `Evidence for ${key} ${mismatch}.`,
          path: [index, "normalized_value"],
        });
      }
      if (
        spec.allowed_evidence_types !== null &&
        !spec.allowed_evidence_types.includes(record.evidence_type)
      ) {
        context.addIssue({
          code: "custom",
          message: `Evidence for ${key} must be one of ${spec.allowed_evidence_types.join(", ")}.`,
          path: [index, "evidence_type"],
        });
      }
    });
  },
);

export function parseProgramScreenEvidence(value: unknown): CanonicalEvidenceRecord[] {
  const parsed = programScreenEvidenceRecordsSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_SCREEN_EVIDENCE",
      `Program Screen evidence failed validation at ${issue.path.join(".") || "records"}: ${issue.message}`,
    );
  }
  return parsed.data as CanonicalEvidenceRecord[];
}

const fictionalUrl = z
  .string()
  .nullable()
  .refine(
    (value) => value === null || new URL(value).hostname.endsWith(".example.test"),
    "Fictional fixtures may only cite example.test URLs.",
  );

export const programScreenFixtureSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    fictional: z.literal(true),
    label: z.string().refine((value) => value.includes("FICTIONAL"), {
      message: "Fixture labels must say FICTIONAL.",
    }),
    description: z.string().refine((value) => value.includes("FICTIONAL"), {
      message: "Fixture descriptions must say FICTIONAL.",
    }),
    as_of: programIsoDateSchema,
    evidence_records: programScreenEvidenceRecordsSchema,
    expected: z
      .object({
        fact_classifications: z.record(z.string(), z.string()),
        criterion_statuses: z.record(z.string(), z.string()),
        pathway_rollups: z.record(z.string(), z.string()),
        client_releasable: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((fixture, context) => {
    fixture.evidence_records.forEach((record, index) => {
      if (!fictionalUrl.safeParse(record.source.url).success) {
        context.addIssue({
          code: "custom",
          message: "Fictional fixtures may only cite example.test URLs.",
          path: ["evidence_records", index, "source", "url"],
        });
      }
      if (
        !record.subject.case_id.includes("fictional") ||
        !(record.subject.property_id ?? "").includes("fictional")
      ) {
        context.addIssue({
          code: "custom",
          message: "Fictional fixture subjects must be labeled fictional.",
          path: ["evidence_records", index, "subject"],
        });
      }
    });
  });

export interface ProgramScreenFixture {
  id: string;
  fictional: true;
  label: string;
  description: string;
  as_of: string;
  evidence_records: CanonicalEvidenceRecord[];
  expected: {
    fact_classifications: Record<string, string>;
    criterion_statuses: Record<string, string>;
    pathway_rollups: Record<string, string>;
    client_releasable: boolean;
  };
}

export function parseProgramScreenFixture(value: unknown): ProgramScreenFixture {
  const parsed = programScreenFixtureSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new IntegrityValidationError(
      "INVALID_PROGRAM_SCREEN_FIXTURE",
      `Program Screen fixture failed validation at ${issue.path.join(".") || "fixture"}: ${issue.message}`,
    );
  }
  return parsed.data as ProgramScreenFixture;
}
