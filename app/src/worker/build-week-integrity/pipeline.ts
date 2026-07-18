import {
  integrityAnalystOutputJsonSchema,
  integritySynthesisOutputJsonSchema,
} from "../../shared/build-week-integrity/schema";
import {
  buildIntegrityAnalystPrompt,
  buildIntegritySynthesisPrompt,
  integritySpecialistModel,
  integritySynthesizerModel,
} from "../../shared/build-week-integrity/prompt";
import type {
  IntegrityAnalystOutput,
  IntegrityCanonicalSnapshot,
} from "../../shared/build-week-integrity/types";
import {
  IntegrityValidationError,
  validateIntegrityAnalystOutput,
  validateIntegritySynthesisOutput,
} from "../../shared/build-week-integrity/validation";
import type { Bindings } from "../types";
import {
  OpenAIIntegrityError,
  requestOpenAIStructuredOutput,
} from "./openai-provider";
import {
  completeIntegrityStage,
  failIntegrityRun,
  failIntegrityStage,
  markIntegrityStageRunning,
  persistCompletedIntegrityRun,
} from "./repository";
import { integritySnapshotIsCurrent, stableIntegrityJson } from "./snapshot";

const specialistStages = [
  "evidence_auditor",
  "chronology_analyst",
  "skeptical_reviewer",
] as const;

interface AnalystSuccess {
  ok: true;
  output: IntegrityAnalystOutput;
  stage: (typeof specialistStages)[number];
}

interface AnalystFailure {
  ok: false;
  code: string;
  stage: (typeof specialistStages)[number];
}

function failureCode(error: unknown): string {
  if (
    error instanceof OpenAIIntegrityError ||
    error instanceof IntegrityValidationError
  ) {
    return error.code;
  }
  return "INTEGRITY_PIPELINE_FAILED";
}

export async function executeIntegrityPipeline(input: {
  apiKey: string;
  caseId: string;
  database: Bindings["DB"];
  evidenceIds: ReadonlySet<string>;
  runId: string;
  snapshot: IntegrityCanonicalSnapshot;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const analystOutcomes = await Promise.all(
    specialistStages.map(
      async (stage): Promise<AnalystSuccess | AnalystFailure> => {
        await markIntegrityStageRunning(
          input.database,
          input.runId,
          stage,
          new Date().toISOString(),
        );

        try {
          const prompt = buildIntegrityAnalystPrompt(stage, input.snapshot);
          const response = await requestOpenAIStructuredOutput({
            apiKey: input.apiKey,
            instructions: prompt.instructions,
            input: prompt.input,
            jsonSchema: { ...integrityAnalystOutputJsonSchema },
            maxOutputTokens: 6_000,
            model: integritySpecialistModel,
            schemaName: `permitpulse_${stage}_v1`,
            parse: (value) =>
              validateIntegrityAnalystOutput(value, input.evidenceIds, stage),
          });

          await completeIntegrityStage({
            database: input.database,
            outputJson: stableIntegrityJson(response.output),
            responseId: response.responseId,
            runId: input.runId,
            stage,
            timestamp: new Date().toISOString(),
          });
          return { ok: true, output: response.output, stage };
        } catch (error) {
          const code = failureCode(error);
          await failIntegrityStage({
            code,
            database: input.database,
            runId: input.runId,
            stage,
            timestamp: new Date().toISOString(),
          });
          return { ok: false, code, stage };
        }
      },
    ),
  );

  const analystFailure = analystOutcomes.find(
    (outcome): outcome is AnalystFailure => !outcome.ok,
  );
  if (analystFailure) {
    await failIntegrityRun({
      code: analystFailure.code,
      database: input.database,
      runId: input.runId,
      timestamp: new Date().toISOString(),
    });
    return { ok: false, code: analystFailure.code };
  }

  const evidenceAuditor = analystOutcomes[0];
  const chronologyAnalyst = analystOutcomes[1];
  const skepticalReviewer = analystOutcomes[2];
  if (!evidenceAuditor.ok || !chronologyAnalyst.ok || !skepticalReviewer.ok) {
    throw new Error("Validated analyst outputs were unavailable.");
  }

  const analyses = {
    evidence_auditor: evidenceAuditor.output,
    chronology_analyst: chronologyAnalyst.output,
    skeptical_reviewer: skepticalReviewer.output,
  };
  await markIntegrityStageRunning(
    input.database,
    input.runId,
    "synthesis",
    new Date().toISOString(),
  );

  try {
    const prompt = buildIntegritySynthesisPrompt(input.snapshot, analyses);
    const response = await requestOpenAIStructuredOutput({
      apiKey: input.apiKey,
      instructions: prompt.instructions,
      input: prompt.input,
      jsonSchema: { ...integritySynthesisOutputJsonSchema },
      maxOutputTokens: 9_000,
      model: integritySynthesizerModel,
      schemaName: "permitpulse_integrity_synthesis_v1",
      parse: (value) =>
        validateIntegritySynthesisOutput(value, input.evidenceIds),
    });

    if (
      !(await integritySnapshotIsCurrent({
        caseId: input.caseId,
        database: input.database,
        snapshot: input.snapshot,
      }))
    ) {
      throw new IntegrityValidationError(
        "INPUT_CHANGED_BEFORE_PERSIST",
        "Case inputs changed before the Integrity Review could be persisted.",
      );
    }

    await completeIntegrityStage({
      database: input.database,
      outputJson: stableIntegrityJson(response.output),
      responseId: response.responseId,
      runId: input.runId,
      stage: "synthesis",
      timestamp: new Date().toISOString(),
    });
    await persistCompletedIntegrityRun({
      caseId: input.caseId,
      database: input.database,
      items: response.output.items,
      runId: input.runId,
      summary: response.output.summary,
      timestamp: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    const code = failureCode(error);
    await failIntegrityStage({
      code,
      database: input.database,
      runId: input.runId,
      stage: "synthesis",
      timestamp: new Date().toISOString(),
    });
    await failIntegrityRun({
      code,
      database: input.database,
      runId: input.runId,
      timestamp: new Date().toISOString(),
    });
    return { ok: false, code };
  }
}
