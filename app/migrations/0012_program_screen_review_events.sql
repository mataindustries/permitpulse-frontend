CREATE TABLE program_screen_review_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  case_id TEXT NOT NULL REFERENCES cases (id) ON DELETE RESTRICT,
  actor_user_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('publish', 'invalidate')),
  review_id TEXT NOT NULL CHECK (length(review_id) = 36),
  prior_revision TEXT CHECK (prior_revision IS NULL OR length(prior_revision) BETWEEN 1 AND 128),
  new_manifest_sha256 TEXT NOT NULL CHECK (length(new_manifest_sha256) = 64 AND new_manifest_sha256 NOT GLOB '*[^0-9a-f]*'),
  new_revision TEXT CHECK (new_revision IS NULL OR length(new_revision) BETWEEN 1 AND 128),
  reason TEXT CHECK (reason IS NULL OR reason IN ('evidence_withdrawn', 'geometry_error', 'legal_identity_changed', 'source_superseded', 'other')),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'committed', 'conflict', 'failed')),
  request_id TEXT NOT NULL CHECK (length(trim(request_id)) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  CHECK ((action = 'invalidate') = (reason IS NOT NULL))
);

CREATE INDEX program_screen_review_events_case_created_idx
  ON program_screen_review_events (case_id, created_at DESC, id DESC);
