import type {
  IntegrityDecisionInput,
  IntegrityDraftItem,
  IntegrityReviewItem,
  IntegrityReviewRun,
  IntegrityReviewStage,
  IntegrityStageName,
} from "../../shared/build-week-integrity/types";
import { integrityStageNames } from "../../shared/build-week-integrity/types";
import type { EvidenceResponse } from "../cases/repository";
import type { Bindings } from "../types";

interface RunRow {
  id: string;
  case_id: string;
  status: IntegrityReviewRun["status"];
  input_hash: string;
  case_version: number;
  prompt_version: string;
  schema_version: string;
  specialist_model: string;
  synthesizer_model: string;
  summary: string | null;
  failure_code: string | null;
  cached_from_run_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface StageRow {
  stage: IntegrityReviewStage["stage"];
  model_id: string;
  status: IntegrityReviewStage["status"];
  response_id: string | null;
  failure_code: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ItemRow {
  id: string;
  category: IntegrityReviewItem["category"];
  severity: IntegrityReviewItem["severity"];
  confidence: number;
  title: string;
  verified_fact: string;
  inference: string | null;
  unknown_text: string | null;
  rationale: string;
  proposed_corrective_action: string;
  packet_readiness_impact: IntegrityReviewItem["packet_readiness_impact"];
  source_analysts_json: string;
  decision_status: IntegrityReviewItem["decision_status"];
  reviewer_edited_text: string | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  packet_generation_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface CitationRow {
  item_id: string;
  id: string;
  title: string;
  verification_status: EvidenceResponse["verification_status"];
}

function sourceAnalysts(value: string): IntegrityDraftItem["source_analysts"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }

  const specialists = new Set([
    "evidence_auditor",
    "chronology_analyst",
    "skeptical_reviewer",
  ]);
  return Array.isArray(parsed)
    ? parsed.filter(
        (item): item is IntegrityDraftItem["source_analysts"][number] =>
          typeof item === "string" && specialists.has(item),
      )
    : [];
}

function counts(items: IntegrityReviewItem[]): IntegrityReviewRun["counts"] {
  return {
    total: items.length,
    pending: items.filter((item) => item.decision_status === "pending").length,
    accepted: items.filter((item) => item.decision_status === "accepted").length,
    edited: items.filter((item) => item.decision_status === "edited").length,
    rejected: items.filter((item) => item.decision_status === "rejected").length,
    critical: items.filter((item) => item.severity === "critical").length,
    high: items.filter((item) => item.severity === "high").length,
    medium: items.filter((item) => item.severity === "medium").length,
    low: items.filter((item) => item.severity === "low").length,
  };
}

export async function findCachedIntegrityRunId(input: {
  caseId: string;
  database: Bindings["DB"];
  inputHash: string;
  promptVersion: string;
  schemaVersion: string;
  specialistModel: string;
  synthesizerModel: string;
}): Promise<string | null> {
  const row = await input.database
    .prepare(
      `SELECT id
       FROM build_week_integrity_runs
       WHERE case_id = ?
         AND input_hash = ?
         AND prompt_version = ?
         AND schema_version = ?
         AND specialist_model = ?
         AND synthesizer_model = ?
         AND status = 'completed'
         AND archived_at IS NULL
       ORDER BY completed_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(
      input.caseId,
      input.inputHash,
      input.promptVersion,
      input.schemaVersion,
      input.specialistModel,
      input.synthesizerModel,
    )
    .first<{ id: string }>();

  return row?.id ?? null;
}

export async function latestIntegrityRunId(
  database: Bindings["DB"],
  caseId: string,
): Promise<string | null> {
  const row = await database
    .prepare(
      `SELECT id FROM build_week_integrity_runs
       WHERE case_id = ? AND archived_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .bind(caseId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function integrityThrottleState(
  database: Bindings["DB"],
  caseId: string,
  cutoffIso: string,
): Promise<{ running: boolean; throttled: boolean }> {
  const row = await database
    .prepare(
      `SELECT
        MAX(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
        MAX(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS throttled
       FROM build_week_integrity_runs
       WHERE case_id = ? AND archived_at IS NULL`,
    )
    .bind(cutoffIso, caseId)
    .first<{ running: number | null; throttled: number | null }>();
  return {
    running: row?.running === 1,
    throttled: row?.throttled === 1,
  };
}

export async function createIntegrityRun(input: {
  caseId: string;
  caseVersion: number;
  database: Bindings["DB"];
  inputHash: string;
  inputSnapshotJson: string;
  packetInputRevisionJson: string;
  promptVersion: string;
  requestedByUserId: string;
  runId: string;
  schemaVersion: string;
  specialistModel: string;
  synthesizerModel: string;
  timestamp: string;
}): Promise<void> {
  const statements: D1PreparedStatement[] = [
    input.database
      .prepare(
        `INSERT INTO build_week_integrity_runs (
          id, case_id, requested_by_user_id, status, input_hash,
          input_snapshot_json, case_version, packet_input_revision_json,
          prompt_version, schema_version, specialist_model, synthesizer_model,
          created_at
        ) VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.runId,
        input.caseId,
        input.requestedByUserId,
        input.inputHash,
        input.inputSnapshotJson,
        input.caseVersion,
        input.packetInputRevisionJson,
        input.promptVersion,
        input.schemaVersion,
        input.specialistModel,
        input.synthesizerModel,
        input.timestamp,
      ),
  ];

  for (const stage of integrityStageNames) {
    statements.push(
      input.database
        .prepare(
          `INSERT INTO build_week_integrity_stages
            (run_id, stage, model_id, status)
           VALUES (?, ?, ?, 'queued')`,
        )
        .bind(
          input.runId,
          stage,
          stage === "synthesis" ? input.synthesizerModel : input.specialistModel,
        ),
    );
  }

  await input.database.batch(statements);
}

export async function markIntegrityStageRunning(
  database: Bindings["DB"],
  runId: string,
  stage: IntegrityStageName,
  timestamp: string,
): Promise<void> {
  await database
    .prepare(
      `UPDATE build_week_integrity_stages
       SET status = 'running', started_at = ?, failure_code = NULL
       WHERE run_id = ? AND stage = ? AND status = 'queued'`,
    )
    .bind(timestamp, runId, stage)
    .run();
}

export async function completeIntegrityStage(input: {
  database: Bindings["DB"];
  outputJson: string;
  responseId: string;
  runId: string;
  stage: IntegrityStageName;
  timestamp: string;
}): Promise<void> {
  await input.database
    .prepare(
      `UPDATE build_week_integrity_stages
       SET status = 'completed', response_id = ?, output_json = ?,
           completed_at = ?, failure_code = NULL
       WHERE run_id = ? AND stage = ? AND status = 'running'`,
    )
    .bind(
      input.responseId,
      input.outputJson,
      input.timestamp,
      input.runId,
      input.stage,
    )
    .run();
}

export async function failIntegrityStage(input: {
  code: string;
  database: Bindings["DB"];
  runId: string;
  stage: IntegrityStageName;
  timestamp: string;
}): Promise<void> {
  await input.database
    .prepare(
      `UPDATE build_week_integrity_stages
       SET status = 'failed', failure_code = ?, completed_at = ?
       WHERE run_id = ? AND stage = ? AND status IN ('queued', 'running')`,
    )
    .bind(input.code, input.timestamp, input.runId, input.stage)
    .run();
}

export async function failIntegrityRun(input: {
  code: string;
  database: Bindings["DB"];
  runId: string;
  timestamp: string;
}): Promise<void> {
  await input.database
    .prepare(
      `UPDATE build_week_integrity_runs
       SET status = 'failed', failure_code = ?, completed_at = ?
       WHERE id = ? AND status = 'running'`,
    )
    .bind(input.code, input.timestamp, input.runId)
    .run();
}

export async function persistCompletedIntegrityRun(input: {
  caseId: string;
  database: Bindings["DB"];
  items: IntegrityDraftItem[];
  runId: string;
  summary: string;
  timestamp: string;
}): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  for (const item of input.items) {
    const itemId = crypto.randomUUID();
    statements.push(
      input.database
        .prepare(
          `INSERT INTO build_week_integrity_items (
            id, run_id, case_id, category, severity, confidence, title,
            verified_fact, inference, unknown_text, rationale,
            proposed_corrective_action, packet_readiness_impact,
            source_analysts_json, decision_status, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`,
        )
        .bind(
          itemId,
          input.runId,
          input.caseId,
          item.category,
          item.severity,
          item.confidence,
          item.title,
          item.verified_fact,
          item.inference,
          item.unknown,
          item.rationale,
          item.proposed_corrective_action,
          item.packet_readiness_impact,
          JSON.stringify(item.source_analysts),
          input.timestamp,
          input.timestamp,
        ),
    );

    const placeholders = item.evidence_ids.map(() => "(?, ?)").join(", ");
    statements.push(
      input.database
        .prepare(
          `INSERT INTO build_week_integrity_item_evidence
            (item_id, evidence_item_id) VALUES ${placeholders}`,
        )
        .bind(...item.evidence_ids.flatMap((evidenceId) => [itemId, evidenceId])),
    );
  }

  statements.push(
    input.database
      .prepare(
        `UPDATE build_week_integrity_runs
         SET status = 'completed', summary = ?, failure_code = NULL, completed_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(input.summary, input.timestamp, input.runId),
  );

  const results = await input.database.batch(statements);
  if (results.at(-1)?.meta.changes !== 1) {
    throw new Error("Integrity run completion did not update exactly one run.");
  }
}

export async function readIntegrityRun(input: {
  cacheHit?: boolean;
  caseId: string;
  database: Bindings["DB"];
  runId: string;
}): Promise<IntegrityReviewRun | null> {
  const run = await input.database
    .prepare(
      `SELECT id, case_id, status, input_hash, case_version, prompt_version,
        schema_version, specialist_model, synthesizer_model, summary,
        failure_code, cached_from_run_id, created_at, completed_at
       FROM build_week_integrity_runs
       WHERE id = ? AND case_id = ? AND archived_at IS NULL LIMIT 1`,
    )
    .bind(input.runId, input.caseId)
    .first<RunRow>();
  if (!run) return null;

  const [stageResult, itemResult, citationResult] = await Promise.all([
    input.database
      .prepare(
        `SELECT stage, model_id, status, response_id, failure_code,
          started_at, completed_at
         FROM build_week_integrity_stages WHERE run_id = ?`,
      )
      .bind(run.id)
      .all<StageRow>(),
    input.database
      .prepare(
        `SELECT id, category, severity, confidence, title, verified_fact,
          inference, unknown_text, rationale, proposed_corrective_action,
          packet_readiness_impact, source_analysts_json, decision_status,
          reviewer_edited_text, decided_by_user_id, decided_at,
          packet_generation_id, version, created_at, updated_at
         FROM build_week_integrity_items
         WHERE run_id = ?
         ORDER BY
           CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
             WHEN 'medium' THEN 3 ELSE 4 END,
           CASE category WHEN 'next_best_action' THEN 0 ELSE 1 END,
           created_at, id`,
      )
      .bind(run.id)
      .all<ItemRow>(),
    input.database
      .prepare(
        `SELECT links.item_id, evidence.id, evidence.title,
          evidence.verification_status
         FROM build_week_integrity_item_evidence links
         INNER JOIN build_week_integrity_items items ON items.id = links.item_id
         INNER JOIN evidence_items evidence ON evidence.id = links.evidence_item_id
         WHERE items.run_id = ? AND evidence.deleted_at IS NULL
         ORDER BY links.item_id, evidence.id`,
      )
      .bind(run.id)
      .all<CitationRow>(),
  ]);

  const citationsByItem = new Map<string, CitationRow[]>();
  for (const citation of citationResult.results) {
    citationsByItem.set(citation.item_id, [
      ...(citationsByItem.get(citation.item_id) ?? []),
      citation,
    ]);
  }

  const items: IntegrityReviewItem[] = itemResult.results.map((item) => ({
    id: item.id,
    category: item.category,
    severity: item.severity,
    confidence: item.confidence,
    title: item.title,
    verified_fact: item.verified_fact,
    inference: item.inference,
    unknown: item.unknown_text,
    rationale: item.rationale,
    evidence_ids: (citationsByItem.get(item.id) ?? []).map((citation) => citation.id),
    proposed_corrective_action: item.proposed_corrective_action,
    packet_readiness_impact: item.packet_readiness_impact,
    source_analysts: sourceAnalysts(item.source_analysts_json),
    decision_status: item.decision_status,
    reviewer_edited_text: item.reviewer_edited_text,
    decided_by_user_id: item.decided_by_user_id,
    decided_at: item.decided_at,
    packet_generation_id: item.packet_generation_id,
    version: item.version,
    evidence: (citationsByItem.get(item.id) ?? []).map((citation) => ({
      id: citation.id,
      title: citation.title,
      verification_status: citation.verification_status,
    })),
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  const stageOrder = new Map(integrityStageNames.map((stage, index) => [stage, index]));
  const stages: IntegrityReviewStage[] = stageResult.results
    .map((stage) => ({ ...stage }))
    .sort(
      (left, right) =>
        (stageOrder.get(left.stage) ?? 99) - (stageOrder.get(right.stage) ?? 99),
    );

  return {
    ...run,
    cache_hit: input.cacheHit ?? false,
    stages,
    items,
    counts: counts(items),
  };
}

export async function decideIntegrityItem(input: {
  caseId: string;
  database: Bindings["DB"];
  decision: IntegrityDecisionInput;
  itemId: string;
  requestId: string;
  reviewerUserId: string;
  runId: string;
  timestamp: string;
}): Promise<"success" | "conflict" | "not_found"> {
  const existing = await input.database
    .prepare(
      `SELECT decision_status, version
       FROM build_week_integrity_items
       WHERE id = ? AND run_id = ? AND case_id = ? LIMIT 1`,
    )
    .bind(input.itemId, input.runId, input.caseId)
    .first<{ decision_status: IntegrityReviewItem["decision_status"]; version: number }>();
  if (!existing) return "not_found";
  if (existing.version !== input.decision.expected_version) return "conflict";

  const editedText =
    input.decision.decision === "edited"
      ? input.decision.reviewer_edited_text ?? null
      : null;
  const eventId = crypto.randomUUID();
  const results = await input.database.batch([
    input.database
      .prepare(
        `UPDATE build_week_integrity_items
         SET decision_status = ?, reviewer_edited_text = ?,
           decided_by_user_id = ?, decided_at = ?, decision_request_id = ?,
           version = version + 1, updated_at = ?
         WHERE id = ? AND run_id = ? AND case_id = ? AND version = ?`,
      )
      .bind(
        input.decision.decision,
        editedText,
        input.reviewerUserId,
        input.timestamp,
        input.requestId,
        input.timestamp,
        input.itemId,
        input.runId,
        input.caseId,
        input.decision.expected_version,
      ),
    input.database
      .prepare(
        `INSERT INTO build_week_integrity_decision_events (
          id, item_id, run_id, case_id, reviewer_user_id,
          previous_decision, decision, reviewer_edited_text,
          packet_generation_id, request_id, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM build_week_integrity_items
          WHERE id = ? AND run_id = ? AND case_id = ?
            AND version = ? AND decided_by_user_id = ? AND decided_at = ?
            AND decision_request_id = ?
        )`,
      )
      .bind(
        eventId,
        input.itemId,
        input.runId,
        input.caseId,
        input.reviewerUserId,
        existing.decision_status,
        input.decision.decision,
        editedText,
        input.requestId,
        input.timestamp,
        input.itemId,
        input.runId,
        input.caseId,
        input.decision.expected_version + 1,
        input.reviewerUserId,
        input.timestamp,
        input.requestId,
      ),
  ]);

  return results[0].meta.changes === 1 && results[1].meta.changes === 1
    ? "success"
    : "conflict";
}

export async function archiveIntegrityDemoRuns(input: {
  caseId: string;
  database: Bindings["DB"];
  timestamp: string;
}): Promise<number> {
  const result = await input.database
    .prepare(
      `UPDATE build_week_integrity_runs SET archived_at = ?
       WHERE case_id = ? AND archived_at IS NULL AND status != 'running'`,
    )
    .bind(input.timestamp, input.caseId)
    .run();
  return result.meta.changes;
}

export async function hasRunningIntegrityRun(
  database: Bindings["DB"],
  caseId: string,
): Promise<boolean> {
  const row = await database
    .prepare(
      `SELECT 1 AS present FROM build_week_integrity_runs
       WHERE case_id = ? AND status = 'running' AND archived_at IS NULL LIMIT 1`,
    )
    .bind(caseId)
    .first<{ present: number }>();
  return row?.present === 1;
}
