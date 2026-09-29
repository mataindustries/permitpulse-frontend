import { z } from "zod";
import { canonicalEvidenceRecordsSchema } from "../build-week-integrity/schema";
import type { CanonicalEvidenceRecord } from "../build-week-integrity/types";
import { IntegrityValidationError } from "../build-week-integrity/validation";
import {
  authorityPromotionBlockers,
  programAuthorityRegistries,
  programDecisionRefSchema,
  promotionGuardedCriterionIds,
  type ProgramAuthorityRegistries,
  type ProgramPromotionBlocker,
} from "./authority-policy";
import { programFactSpecs, retiredProgramFacts } from "./facts";
import { authorityFactProfiles, hazardClassStatutoryRoutes } from "./evidence-authority";
import {
  citationVolatilities,
  criterionVerifications,
  fireHazardStatutoryRoutes,
  humanVerificationRequiredCriterionIds,
  operativeSourceTypes,
  predicateOutcomes,
  programConfirmers,
  programFactKeys,
  programPathwayIds,
  retiredProgramCriterionIds,
  retiredProgramFactKeys,
  sourceCaptureMethods,
  type CitationVolatility,
  type ProgramCriterion,
  type ProgramFactKey,
  type ProgramPathwayPack,
  type RetiredProgramFactKey,
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

/**
 * Official captures: `official-sources/<source-id>/extracted.txt`. Test-only
 * captures: `test-only-sources/<name>.txt` or
 * `test-only-sources/test-only-<name>/extracted.txt`.
 */
const sourceCaptureRepoPath =
  /^app\/fixtures\/program-screen\/(?:official-sources\/[a-z0-9]+(?:-[a-z0-9]+)*\/extracted\.txt|test-only-sources\/(?:[a-z0-9-]+\.txt|test-only-[a-z0-9]+(?:-[a-z0-9]+)*\/extracted\.txt))$/;

export const programSourceCaptureSchema = z
  .object({
    repo_path: z
      .string()
      .regex(
        sourceCaptureRepoPath,
        "Source captures must be extracted text under app/fixtures/program-screen/official-sources/<source-id>/.",
      ),
    retrieved_at: z.string().datetime({ offset: true }),
    capture_method: z.enum(sourceCaptureMethods),
    sha256: z.string().regex(/^[0-9a-f]{64}$/, "Source captures need a SHA-256 hex digest."),
    is_ai_generated: z.literal(false),
    source_type: z.enum(operativeSourceTypes, {
      error: "Only an adopted ordinance or official memo can support a rule; a proposed draft cannot.",
    }),
    operative_status: z.literal("operative", {
      error: "Only an operative source can support a rule.",
    }),
  })
  .strict();

export const programCriterionHumanVerificationSchema = z
  .object({
    reviewer: z
      .object({
        kind: z.literal("human"),
        name: nonEmptyText,
        role: nonEmptyText,
      })
      .strict(),
    verified_at: programIsoDateSchema,
    next_review_at: programIsoDateSchema,
    source_title: nonEmptyText,
    source_url: httpsUrl,
    instrument: nonEmptyText,
    pinpoint: nonEmptyText,
    supporting_excerpt: nonEmptyText,
    source_capture: programSourceCaptureSchema,
    /** A Round 1 decision, or the Phase 3B decision that superseded it. */
    decision_ref: programDecisionRefSchema.optional(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.source_capture.retrieved_at.slice(0, 10) > record.verified_at) {
      context.addIssue({
        code: "custom",
        message: "A source must be captured on or before the date it is verified.",
        path: ["source_capture", "retrieved_at"],
      });
    }
  });

const humanVerificationRequired = new Set<string>(humanVerificationRequiredCriterionIds);

/** Formerly pending criteria, and any marked human_verified, need a human record. */
export function requiresHumanVerification(criterion: Pick<ProgramCriterion, "id" | "verification">): boolean {
  return criterion.verification === "human_verified" || humanVerificationRequired.has(criterion.id);
}

/**
 * The record matches the criterion citation field for field. Dates must match
 * too, so the record's review date drives the same staleness gate.
 */
function humanVerificationMismatch(criterion: ProgramCriterion): string | null {
  const record = criterion.human_verification;
  if (record === null || record === undefined) return "is missing";
  const citation = criterion.citation;
  if (record.source_title !== citation?.title) return "source_title must match the citation title";
  if (record.source_url !== citation?.url) return "source_url must match the citation URL";
  if (record.pinpoint !== citation?.pinpoint) return "pinpoint must match the citation pinpoint";
  if (record.verified_at !== citation?.verified_at) return "verified_at must match the citation";
  if (record.next_review_at !== citation?.next_review_at) {
    return "next_review_at must match the citation";
  }
  return null;
}

/**
 * Defense in depth for callers that skip `parseProgramPathwayPacks`: a
 * criterion that needs human verification runs its rule only with a complete,
 * well-formed human record that matches its citation.
 */
export function hasCompleteHumanVerification(criterion: ProgramCriterion): boolean {
  if (criterion.verification !== "human_verified") return false;
  if (!programCriterionHumanVerificationSchema.safeParse(criterion.human_verification).success) {
    return false;
  }
  return humanVerificationMismatch(criterion) === null;
}

/**
 * The promotion gates still unmet for one of the 46 atomic criteria (D7):
 * computed from the evidence-authority registries and the criterion, never
 * from a note. Empty for any other criterion.
 */
export function criterionPromotionBlockers(
  criterion: ProgramCriterion,
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
): ProgramPromotionBlocker[] {
  if (!promotionGuardedCriterionIds.has(criterion.id)) return [];
  return authorityPromotionBlockers(criterion, registries, hasCompleteHumanVerification(criterion));
}

/**
 * True when the criterion's rule must not run and must block release. An
 * atomic criterion with a complete human record still waits while any
 * promotion gate is unmet, including a missing authority requirement.
 */
export function criterionAwaitsHumanVerification(
  criterion: ProgramCriterion,
  registries: ProgramAuthorityRegistries = programAuthorityRegistries,
): boolean {
  if (criterion.verification === "pending_human") return true;
  if (!requiresHumanVerification(criterion)) return false;
  if (!hasCompleteHumanVerification(criterion)) return true;
  return criterionPromotionBlockers(criterion, registries).length > 0;
}

const parcelFactKeys = programFactKeys.filter(
  (key) => programFactSpecs[key].role === "parcel_fact",
);
const retiredCriterionIds = new Set<string>(retiredProgramCriterionIds);

export const programCriterionExceptionSchema = z
  .object({
    label: nonEmptyText,
    pinpoint: nonEmptyText,
    fact_keys: z.array(z.enum(programFactKeys)),
  })
  .strict();

export const programCriterionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9-]+$/),
    pathway: z.enum(programPathwayIds),
    label: nonEmptyText,
    gating: z.boolean(),
    fact_keys: z
      .array(z.enum(programFactKeys))
      .refine((keys) => new Set(keys).size === keys.length, "Fact keys must be unique."),
    predicate: z.union([
      z.literal("professional_judgment"),
      z.literal("not_encoded"),
      z.custom<(...args: unknown[]) => unknown>(
        (value) => typeof value === "function",
        "Predicates must be functions.",
      ),
    ]),
    permitted_outcomes: z
      .array(z.enum(predicateOutcomes))
      .refine((outcomes) => new Set(outcomes).size === outcomes.length, "Permitted outcomes must be unique.")
      .refine(
        (outcomes) => outcomes.includes("requires_judgment"),
        "Every criterion may route to judgment; requires_judgment must be permitted.",
      ),
    exception_paths: z.array(programCriterionExceptionSchema),
    statutory_routes: z
      .object({
        fact_key: z.enum(programFactKeys),
        routes: z.array(z.enum(fireHazardStatutoryRoutes)).min(2),
      })
      .strict()
      .optional(),
    rule_summary: nonEmptyText,
    citation: programCriterionCitationSchema,
    confirmer: z.enum(programConfirmers),
    question_if_unknown: nonEmptyText,
    question_if_conflict: nonEmptyText,
    question_if_judgment: nonEmptyText.nullable(),
    verification: z.enum(criterionVerifications),
    human_verification: programCriterionHumanVerificationSchema.nullable(),
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
    if (retiredCriterionIds.has(criterion.id)) {
      context.addIssue({
        code: "custom",
        message: `${criterion.id} is a retired broad criterion; ship its atomic replacements instead.`,
        path: ["id"],
      });
    }
    if (criterion.fact_keys.length === 0 && criterion.predicate !== "professional_judgment") {
      context.addIssue({
        code: "custom",
        message: "Only a professional-judgment criterion may have no fact inputs.",
        path: ["fact_keys"],
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
    // A rule, encoded now or after verification, reads controlled values only:
    // never a free-text observation or a professional-judgment input.
    if (criterion.predicate !== "professional_judgment") {
      const uncontrolled = criterion.fact_keys.filter(
        (key) => programFactSpecs[key].data_class !== "controlled_value",
      );
      if (uncontrolled.length > 0) {
        context.addIssue({
          code: "custom",
          message: `A rule may read only controlled values; ${uncontrolled.join(", ")} can inform only a professional judgment.`,
          path: ["fact_keys"],
        });
      }
    }
    if (
      criterion.predicate === "professional_judgment" &&
      (criterion.permitted_outcomes.length !== 1 || criterion.permitted_outcomes[0] !== "requires_judgment")
    ) {
      context.addIssue({
        code: "custom",
        message: "A professional-judgment criterion may only route to judgment.",
        path: ["permitted_outcomes"],
      });
    }
    if (criterion.permitted_outcomes.includes("disqualifying_per_source")) {
      for (const exception of criterion.exception_paths) {
        const unread = exception.fact_keys.filter((key) => !criterion.fact_keys.includes(key));
        if (exception.fact_keys.length === 0 || unread.length > 0) {
          context.addIssue({
            code: "custom",
            message: `A criterion cannot block without reading its exception (${exception.label}).`,
            path: ["permitted_outcomes"],
          });
        }
      }
    }
    if (criterion.statutory_routes !== undefined) {
      // Only a fire-hazard fact has statutory routes, and the routes are exactly
      // the ones its class rests on (Phase 3B c): never a subset that would let
      // one route clear the criterion alone.
      const { fact_key: routeFact, routes } = criterion.statutory_routes;
      const hazardClass = authorityFactProfiles[routeFact].hazard_class;
      const expected = hazardClass === null ? [] : hazardClassStatutoryRoutes[hazardClass];
      if (
        !criterion.fact_keys.includes(routeFact) ||
        new Set(routes).size !== routes.length ||
        routes.length !== expected.length ||
        !expected.every((route) => routes.includes(route))
      ) {
        context.addIssue({
          code: "custom",
          message: "A route-separated criterion reads the fact and assesses every statutory route its class rests on.",
          path: ["statutory_routes"],
        });
      }
    }
    if (criterion.predicate === "not_encoded" && criterion.verification !== "pending_human") {
      context.addIssue({
        code: "custom",
        message: "A criterion without an encoded rule must remain pending human verification.",
        path: ["verification"],
      });
    }
    if (criterion.verification === "human_verified") {
      const mismatch = humanVerificationMismatch(criterion as ProgramCriterion);
      if (mismatch !== null) {
        context.addIssue({
          code: "custom",
          message: `A human-verified criterion's verification record ${mismatch}.`,
          path: ["human_verification"],
        });
      }
    } else if (criterion.human_verification !== null) {
      context.addIssue({
        code: "custom",
        message: "Only a human-verified criterion may carry a human-verification record.",
        path: ["human_verification"],
      });
    }
    if (humanVerificationRequired.has(criterion.id) && criterion.verification === "repo_sourced") {
      context.addIssue({
        code: "custom",
        message:
          "A criterion that was pending human verification can only leave that state as human_verified, with a verification record.",
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
      if ((retiredProgramFactKeys as readonly string[]).includes(record.claim.key)) {
        const retired = retiredProgramFacts[record.claim.key as RetiredProgramFactKey];
        context.addIssue({
          code: "custom",
          message: `Fact key ${retired.key} is retired: ${retired.reason}`,
          path: [index, "claim", "key"],
        });
        return;
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

/**
 * An explicit change to a fictional fixture record when a fact key was
 * retired. `rename` keeps the evidence ID, source, and value under the
 * replacement key; `drop` removes the record. Nothing else is migrated.
 */
export const programScreenFixtureMigrationSchema = z
  .object({
    evidence_id: z.string().trim().min(1),
    from_fact_key: z.enum(retiredProgramFactKeys),
    action: z.enum(["rename", "drop"]),
    to_fact_key: z.enum(programFactKeys).nullable(),
    note: z.string().trim().min(1).max(600),
  })
  .strict();

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
    migrations: z.array(programScreenFixtureMigrationSchema).optional(),
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
    (fixture.migrations ?? []).forEach((migration, index) => {
      const issue = (message: string) =>
        context.addIssue({ code: "custom", message, path: ["migrations", index] });
      const retired = retiredProgramFacts[migration.from_fact_key];
      const record = fixture.evidence_records.find((candidate) => candidate.id === migration.evidence_id);
      if (migration.action !== retired.migration) {
        issue(`${migration.from_fact_key} is retired as a ${retired.migration}, not a ${migration.action}.`);
      }
      if (migration.action === "drop") {
        if (migration.to_fact_key !== null) issue("A dropped record has no replacement key.");
        if (record !== undefined) issue(`Dropped record ${migration.evidence_id} is still present.`);
      } else {
        if (migration.to_fact_key !== retired.replaced_by[0]) {
          issue(`${migration.from_fact_key} is renamed to ${retired.replaced_by[0]}.`);
        }
        if (record?.claim.key !== migration.to_fact_key) {
          issue(`Renamed record ${migration.evidence_id} must carry ${migration.to_fact_key}.`);
        }
      }
    });
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
  migrations?: Array<z.infer<typeof programScreenFixtureMigrationSchema>>;
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
