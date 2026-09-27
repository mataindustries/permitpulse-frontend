import { IntegrityValidationError } from "../build-week-integrity/validation";
import { evaluateProgramScreen, programScreenPathwayPacks } from "./evaluate";
import { parseProgramScreenFixture } from "./schema";
import {
  releaseBlockerCodes,
  type ProgramPathwayPack,
  type ProgramScreenResult,
  type ReleaseBlockerCode,
} from "./types";

export interface ProgramScreenPublicDemoPayload {
  schema_version: "program-screen-public-demo-v1";
  demo_kind: "fixture_powered";
  fictional: true;
  fixture_id: string;
  fixture_label: string;
  disclosure: string;
  integrity_boundary: {
    canonical_evidence_evaluator: true;
    deterministic_evaluation: true;
    live_data_used: false;
    ai_used: false;
  };
  screen_scope: ProgramScreenResult["screen_scope"];
  screen_id: string;
  as_of: string;
  release: {
    client_releasable: boolean;
    blocker_counts: Record<ReleaseBlockerCode, number>;
  };
  facts: Array<
    Pick<
      ProgramScreenResult["facts"][number],
      "key" | "label" | "classification" | "statement"
    > & {
      sources: Array<{
        source_agency: string;
        source_title: string;
        source_url: string | null;
        retrieved_at: string;
        observed_display_value: string;
      }>;
    }
  >;
  pathways: Array<{
    pathway: string;
    label: string;
    rollup: ProgramScreenResult["pathways"][number]["rollup"];
    classification: ProgramScreenResult["pathways"][number]["classification"];
    statement: string;
    decisive_criteria: string[];
    criteria: Array<{
      criterion_id: string;
      label: string;
      status: ProgramScreenResult["pathways"][number]["criteria"][number]["status"];
      classification: ProgramScreenResult["pathways"][number]["criteria"][number]["classification"];
      verification: ProgramScreenResult["pathways"][number]["criteria"][number]["verification"];
      statement: string;
      fact_keys: string[];
      citation: ProgramScreenResult["pathways"][number]["criteria"][number]["citation"];
    }>;
    program_flags: Array<{
      label: string;
      treated_as: "observation_only";
      crosscheck: ProgramScreenResult["pathways"][number]["program_flags"][number]["crosscheck"];
      statement: string;
    }>;
  }>;
  planning_questions: ProgramScreenResult["planning_questions"];
}

export interface ProgramScreenPublicDemoOptions {
  /** Date the demo is generated. Stale criteria as of this date fail the build. */
  as_of: string;
  packs?: readonly ProgramPathwayPack[];
}

/**
 * Narrow, fictional projection of a Program Screen for a static public demo.
 * Evaluation stays in `evaluateProgramScreen`; this only refuses unsafe
 * input (non-fictional fixture, stale criterion, prohibited wording) and
 * drops internal fields. A private report consumes the full result instead.
 */
export function buildProgramScreenPublicDemoPayload(
  fixtureValue: unknown,
  options: ProgramScreenPublicDemoOptions,
): ProgramScreenPublicDemoPayload {
  const fixture = parseProgramScreenFixture(fixtureValue);
  const result = evaluateProgramScreen({
    evidence_records: fixture.evidence_records,
    as_of: options.as_of,
    packs: options.packs ?? programScreenPathwayPacks,
  });

  const stale = result.release.blockers.filter((blocker) => blocker.code === "stale_criterion");
  if (stale.length > 0) {
    throw new IntegrityValidationError(
      "PUBLIC_DEMO_STALE_CRITERION",
      `Reverify stale criteria before publishing the demo: ${stale.map((blocker) => blocker.ref).join(", ")}.`,
    );
  }
  const language = result.release.blockers.filter(
    (blocker) => blocker.code === "prohibited_language",
  );
  if (language.length > 0) {
    throw new IntegrityValidationError(
      "PUBLIC_DEMO_PROHIBITED_LANGUAGE",
      `Prohibited client-facing wording in: ${language.map((blocker) => blocker.ref).join(", ")}.`,
    );
  }

  const blockerCounts = Object.fromEntries(
    releaseBlockerCodes.map((code) => [
      code,
      result.release.blockers.filter((blocker) => blocker.code === code).length,
    ]),
  ) as Record<ReleaseBlockerCode, number>;

  return {
    schema_version: "program-screen-public-demo-v1",
    demo_kind: "fixture_powered",
    fictional: true,
    fixture_id: fixture.id,
    fixture_label: fixture.label,
    disclosure:
      "FICTIONAL sample parcel. This screen replays invented fixture records through the deterministic Program Screen core. It does not query live City systems and is not a Planning determination.",
    integrity_boundary: {
      canonical_evidence_evaluator: true,
      deterministic_evaluation: true,
      live_data_used: false,
      ai_used: false,
    },
    screen_scope: result.screen_scope,
    screen_id: result.screen_id,
    as_of: result.as_of,
    release: {
      client_releasable: result.release.client_releasable,
      blocker_counts: blockerCounts,
    },
    facts: result.facts.map((fact) => ({
      key: fact.key,
      label: fact.label,
      classification: fact.classification,
      statement: fact.statement,
      sources: fact.evidence.map((citation) => ({
        source_agency: citation.source_agency,
        source_title: citation.source_title,
        source_url: citation.source_url,
        retrieved_at: citation.retrieved_at,
        observed_display_value:
          fact.observations.find(
            (observation) => observation.evidence_id === citation.evidence_id,
          )?.observed_display_value ?? "NOT OBSERVED",
      })),
    })),
    pathways: result.pathways.map((pathway) => ({
      pathway: pathway.pathway,
      label: pathway.label,
      rollup: pathway.rollup,
      classification: pathway.classification,
      statement: pathway.statement,
      decisive_criteria: pathway.decisive_criteria,
      criteria: pathway.criteria.map((criterion) => ({
        criterion_id: criterion.criterion_id,
        label: criterion.label,
        status: criterion.status,
        classification: criterion.classification,
        verification: criterion.verification,
        statement: criterion.statement,
        fact_keys: criterion.facts.map((fact) => fact.key),
        citation: criterion.citation,
      })),
      program_flags: pathway.program_flags.map((flag) => ({
        label: flag.label,
        treated_as: flag.treated_as,
        crosscheck: flag.crosscheck,
        statement: flag.statement,
      })),
    })),
    planning_questions: result.planning_questions,
  };
}
