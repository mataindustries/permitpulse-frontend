import {
  integrityPromptVersion,
  integritySchemaVersion,
  integritySpecialistModel,
  integritySynthesizerModel,
} from "../../shared/build-week-integrity/prompt";
import type { IntegrityReviewRun } from "../../shared/build-week-integrity/types";
import type { CaseResponse } from "../cases/repository";
import type { Bindings } from "../types";
import { requireIntegrityApiKey } from "./config";
import { executeIntegrityPipeline } from "./pipeline";
import {
  createIntegrityRun,
  findCachedIntegrityRunId,
  integrityThrottleState,
  hasRunningIntegrityRun,
  readIntegrityRun,
} from "./repository";
import { buildIntegritySnapshot, stableIntegrityJson } from "./snapshot";

const throttleMilliseconds = 60_000;

export type RunIntegrityReviewResult =
  | { outcome: "completed" | "failed" | "cached"; run: IntegrityReviewRun }
  | { outcome: "live_unavailable" }
  | { outcome: "running" | "throttled" };

export async function runIntegrityReview(input: {
  bindings: Bindings;
  caseRecord: CaseResponse;
  requestedByUserId: string;
}): Promise<RunIntegrityReviewResult> {
  const snapshot = await buildIntegritySnapshot({
    caseRecord: input.caseRecord,
    database: input.bindings.DB,
  });
  const cachedId = await findCachedIntegrityRunId({
    caseId: input.caseRecord.id,
    database: input.bindings.DB,
    inputHash: snapshot.inputHash,
    promptVersion: integrityPromptVersion,
    schemaVersion: integritySchemaVersion,
    specialistModel: integritySpecialistModel,
    synthesizerModel: integritySynthesizerModel,
  });
  if (cachedId) {
    const cached = await readIntegrityRun({
      cacheHit: true,
      caseId: input.caseRecord.id,
      database: input.bindings.DB,
      runId: cachedId,
    });
    if (cached) return { outcome: "cached", run: cached };
  }

  const apiKey = requireIntegrityApiKey(input.bindings);
  if (!apiKey) return { outcome: "live_unavailable" };

  const now = new Date();
  const throttle = await integrityThrottleState(
    input.bindings.DB,
    input.caseRecord.id,
    new Date(now.getTime() - throttleMilliseconds).toISOString(),
  );
  if (throttle.running) return { outcome: "running" };
  if (throttle.throttled) return { outcome: "throttled" };

  const runId = crypto.randomUUID();
  try {
    await createIntegrityRun({
      caseId: input.caseRecord.id,
      caseVersion: input.caseRecord.version,
      database: input.bindings.DB,
      inputHash: snapshot.inputHash,
      inputSnapshotJson: stableIntegrityJson(snapshot.snapshot),
      packetInputRevisionJson: stableIntegrityJson(
        snapshot.snapshot.packet_input_revision,
      ),
      promptVersion: integrityPromptVersion,
      requestedByUserId: input.requestedByUserId,
      runId,
      schemaVersion: integritySchemaVersion,
      specialistModel: integritySpecialistModel,
      synthesizerModel: integritySynthesizerModel,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    if (await hasRunningIntegrityRun(input.bindings.DB, input.caseRecord.id)) {
      return { outcome: "running" };
    }
    throw error;
  }

  const pipeline = await executeIntegrityPipeline({
    apiKey,
    caseId: input.caseRecord.id,
    database: input.bindings.DB,
    evidenceIds: snapshot.evidenceIds,
    runId,
    snapshot: snapshot.snapshot,
  });
  const run = await readIntegrityRun({
    caseId: input.caseRecord.id,
    database: input.bindings.DB,
    runId,
  });
  if (!run) throw new Error("Integrity review run could not be reloaded.");

  return { outcome: pipeline.ok ? "completed" : "failed", run };
}
