-- OpenAI Build Week 2026 extension: PermitPulse Case Integrity Engine.
-- These tables are intentionally isolated from the canonical packet model.

CREATE TABLE build_week_integrity_runs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  requested_by_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input_hash TEXT NOT NULL CHECK (length(input_hash) = 64),
  input_snapshot_json TEXT NOT NULL
    CHECK (json_valid(input_snapshot_json) AND json_type(input_snapshot_json) = 'object'),
  case_version INTEGER NOT NULL CHECK (case_version >= 1),
  packet_input_revision_json TEXT NOT NULL
    CHECK (json_valid(packet_input_revision_json) AND json_type(packet_input_revision_json) = 'object'),
  prompt_version TEXT NOT NULL CHECK (length(trim(prompt_version)) BETWEEN 1 AND 80),
  schema_version TEXT NOT NULL CHECK (length(trim(schema_version)) BETWEEN 1 AND 80),
  specialist_model TEXT NOT NULL CHECK (length(trim(specialist_model)) BETWEEN 1 AND 120),
  synthesizer_model TEXT NOT NULL CHECK (length(trim(synthesizer_model)) BETWEEN 1 AND 120),
  summary TEXT CHECK (summary IS NULL OR length(trim(summary)) BETWEEN 1 AND 4000),
  failure_code TEXT CHECK (failure_code IS NULL OR length(trim(failure_code)) BETWEEN 1 AND 120),
  cached_from_run_id TEXT REFERENCES build_week_integrity_runs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  archived_at TEXT
);

CREATE INDEX build_week_integrity_runs_case_created_idx
  ON build_week_integrity_runs(case_id, created_at DESC, id DESC);

CREATE INDEX build_week_integrity_runs_cache_idx
  ON build_week_integrity_runs(
    case_id,
    input_hash,
    prompt_version,
    schema_version,
    specialist_model,
    synthesizer_model,
    status
  );

CREATE UNIQUE INDEX build_week_integrity_runs_active_input_uidx
  ON build_week_integrity_runs(
    case_id,
    input_hash,
    prompt_version,
    schema_version,
    specialist_model,
    synthesizer_model
  )
  WHERE status = 'completed' AND archived_at IS NULL;

CREATE UNIQUE INDEX build_week_integrity_runs_one_running_case_uidx
  ON build_week_integrity_runs(case_id)
  WHERE status = 'running' AND archived_at IS NULL;

CREATE TABLE build_week_integrity_stages (
  run_id TEXT NOT NULL REFERENCES build_week_integrity_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL
    CHECK (stage IN ('evidence_auditor', 'chronology_analyst', 'skeptical_reviewer', 'synthesis')),
  model_id TEXT NOT NULL CHECK (length(trim(model_id)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  response_id TEXT CHECK (response_id IS NULL OR length(trim(response_id)) BETWEEN 1 AND 160),
  output_json TEXT
    CHECK (output_json IS NULL OR (json_valid(output_json) AND json_type(output_json) = 'object')),
  failure_code TEXT CHECK (failure_code IS NULL OR length(trim(failure_code)) BETWEEN 1 AND 120),
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (run_id, stage)
);

CREATE TABLE build_week_integrity_items (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  run_id TEXT NOT NULL REFERENCES build_week_integrity_runs(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN (
    'evidence_contradiction',
    'unsupported_finding',
    'timeline_gap_or_stale_status',
    'missing_record_or_confirmation',
    'unresolved_dependency',
    'next_best_action'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  verified_fact TEXT NOT NULL CHECK (length(trim(verified_fact)) BETWEEN 1 AND 2000),
  inference TEXT CHECK (inference IS NULL OR length(trim(inference)) BETWEEN 1 AND 2000),
  unknown_text TEXT CHECK (unknown_text IS NULL OR length(trim(unknown_text)) BETWEEN 1 AND 2000),
  rationale TEXT NOT NULL CHECK (length(trim(rationale)) BETWEEN 1 AND 3000),
  proposed_corrective_action TEXT NOT NULL
    CHECK (length(trim(proposed_corrective_action)) BETWEEN 1 AND 3000),
  packet_readiness_impact TEXT NOT NULL
    CHECK (packet_readiness_impact IN ('blocks_release', 'needs_resolution', 'monitor', 'none')),
  source_analysts_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(source_analysts_json) AND json_type(source_analysts_json) = 'array'),
  decision_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision_status IN ('pending', 'accepted', 'edited', 'rejected')),
  reviewer_edited_text TEXT
    CHECK (reviewer_edited_text IS NULL OR length(trim(reviewer_edited_text)) BETWEEN 1 AND 3000),
  decided_by_user_id TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
  decided_at TEXT,
  decision_request_id TEXT
    CHECK (decision_request_id IS NULL OR length(trim(decision_request_id)) BETWEEN 1 AND 128),
  packet_generation_id TEXT REFERENCES packet_generations(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX build_week_integrity_items_run_idx
  ON build_week_integrity_items(run_id, severity, created_at, id);

CREATE INDEX build_week_integrity_items_case_decision_idx
  ON build_week_integrity_items(case_id, decision_status, updated_at DESC);

CREATE TABLE build_week_integrity_item_evidence (
  item_id TEXT NOT NULL REFERENCES build_week_integrity_items(id) ON DELETE CASCADE,
  evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (item_id, evidence_item_id)
);

CREATE INDEX build_week_integrity_item_evidence_evidence_idx
  ON build_week_integrity_item_evidence(evidence_item_id, item_id);

CREATE TABLE build_week_integrity_decision_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  item_id TEXT NOT NULL REFERENCES build_week_integrity_items(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES build_week_integrity_runs(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  reviewer_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  previous_decision TEXT NOT NULL
    CHECK (previous_decision IN ('pending', 'accepted', 'edited', 'rejected')),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'edited', 'rejected')),
  reviewer_edited_text TEXT
    CHECK (reviewer_edited_text IS NULL OR length(trim(reviewer_edited_text)) BETWEEN 1 AND 3000),
  packet_generation_id TEXT REFERENCES packet_generations(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL CHECK (length(trim(request_id)) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX build_week_integrity_decisions_item_created_idx
  ON build_week_integrity_decision_events(item_id, created_at DESC, id DESC);

CREATE INDEX build_week_integrity_decisions_case_created_idx
  ON build_week_integrity_decision_events(case_id, created_at DESC, id DESC);
