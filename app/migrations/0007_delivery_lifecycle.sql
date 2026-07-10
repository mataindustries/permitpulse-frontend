CREATE TABLE packet_generations (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL REFERENCES cases (id) ON DELETE RESTRICT,
  case_version INTEGER NOT NULL CHECK (case_version >= 1),
  generated_by_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE RESTRICT,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object'),
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX packet_generations_case_created_idx
  ON packet_generations (case_id, created_at DESC, id DESC);

CREATE TABLE delivery_lifecycle_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL REFERENCES cases (id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('packet_generated','review_started','changes_requested','approved_for_delivery','delivery_recorded','delivery_confirmed')),
  actor_user_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR length(trim(note)) BETWEEN 1 AND 1000),
  packet_generation_id TEXT REFERENCES packet_generations (id) ON DELETE RESTRICT,
  previous_state TEXT NOT NULL CHECK (previous_state IN ('draft','packet_generated','under_review','changes_required','approved_for_delivery','delivered','delivery_confirmed')),
  resulting_state TEXT NOT NULL CHECK (resulting_state IN ('draft','packet_generated','under_review','changes_required','approved_for_delivery','delivered','delivery_confirmed')),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 1 AND 128),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (case_id, sequence),
  UNIQUE (case_id, idempotency_key)
);

CREATE INDEX delivery_events_case_created_idx
  ON delivery_lifecycle_events (case_id, sequence DESC);
CREATE INDEX delivery_events_packet_idx
  ON delivery_lifecycle_events (packet_generation_id, sequence DESC);
