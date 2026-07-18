import type {
  IntegrityDecisionInput,
  IntegrityDemoResetResult,
  IntegrityReviewConfig,
  IntegrityReviewRun,
} from "../../shared/build-week-integrity/types";
import { requestJson } from "./cases";

export type IntegrityStartOutcome = "completed" | "failed" | "cached";

export interface IntegrityReviewClient {
  getConfig: () => Promise<IntegrityReviewConfig>;
  getLatest: (caseId: string) => Promise<IntegrityReviewRun | null>;
  getRun: (caseId: string, runId: string) => Promise<IntegrityReviewRun>;
  startReview: (
    caseId: string,
  ) => Promise<{ outcome: IntegrityStartOutcome; run: IntegrityReviewRun }>;
  decideItem: (
    caseId: string,
    runId: string,
    itemId: string,
    decision: IntegrityDecisionInput,
  ) => Promise<IntegrityReviewRun>;
  resetDemo: () => Promise<IntegrityDemoResetResult>;
}

export async function getIntegrityReviewConfig(): Promise<IntegrityReviewConfig> {
  const data = await requestJson<{ config: IntegrityReviewConfig }>(
    "/api/v1/build-week/integrity/config",
  );
  return data.config;
}

export async function getLatestIntegrityReview(
  caseId: string,
): Promise<IntegrityReviewRun | null> {
  const data = await requestJson<{ run: IntegrityReviewRun | null }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/integrity-reviews/latest`,
  );
  return data.run;
}

export async function getIntegrityReviewRun(
  caseId: string,
  runId: string,
): Promise<IntegrityReviewRun> {
  const data = await requestJson<{ run: IntegrityReviewRun }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/integrity-reviews/${encodeURIComponent(runId)}`,
  );
  return data.run;
}

export async function startIntegrityReview(
  caseId: string,
): Promise<{ outcome: IntegrityStartOutcome; run: IntegrityReviewRun }> {
  return requestJson<{ outcome: IntegrityStartOutcome; run: IntegrityReviewRun }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/integrity-reviews`,
    {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}

export async function decideIntegrityReviewItem(
  caseId: string,
  runId: string,
  itemId: string,
  decision: IntegrityDecisionInput,
): Promise<IntegrityReviewRun> {
  const data = await requestJson<{ run: IntegrityReviewRun }>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/integrity-reviews/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}`,
    {
      body: JSON.stringify(decision),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    },
  );
  return data.run;
}

export async function resetIntegrityDemo(): Promise<IntegrityDemoResetResult> {
  return requestJson<IntegrityDemoResetResult>(
    "/api/v1/build-week/integrity/demo/reset",
    {
      body: JSON.stringify({
        confirmation: "reset-arroyo-vista-integrity-v1",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}

export const integrityReviewClient: IntegrityReviewClient = {
  decideItem: decideIntegrityReviewItem,
  getConfig: getIntegrityReviewConfig,
  getLatest: getLatestIntegrityReview,
  getRun: getIntegrityReviewRun,
  resetDemo: resetIntegrityDemo,
  startReview: startIntegrityReview,
};
