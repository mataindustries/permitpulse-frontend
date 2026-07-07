ALTER TABLE cases
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1
    CHECK (version >= 1);

ALTER TABLE cases
  ADD COLUMN lifecycle_mutation_nonce TEXT
    CHECK (
      lifecycle_mutation_nonce IS NULL
      OR length(lifecycle_mutation_nonce) BETWEEN 1 AND 64
    );

CREATE UNIQUE INDEX cases_lifecycle_mutation_nonce_uidx
  ON cases (lifecycle_mutation_nonce)
  WHERE lifecycle_mutation_nonce IS NOT NULL;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL
    CHECK (length(case_id) BETWEEN 1 AND 64)
    REFERENCES cases (id) ON DELETE RESTRICT,
  actor_user_id TEXT
    REFERENCES "user" (id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (
      action IN (
        'case_created',
        'case_updated',
        'case_status_changed'
      )
    ),
  changed_fields TEXT NOT NULL
    CHECK (
      json_valid(changed_fields)
      AND json_type(changed_fields) = 'array'
    ),
  from_status TEXT
    CHECK (
      from_status IS NULL
      OR from_status IN (
        'intake',
        'researching',
        'needs_information',
        'ready_for_review'
      )
    ),
  to_status TEXT
    CHECK (
      to_status IS NULL
      OR to_status IN (
        'intake',
        'researching',
        'needs_information',
        'ready_for_review'
      )
    ),
  request_id TEXT NOT NULL
    CHECK (length(trim(request_id)) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX audit_events_case_created_at_idx
  ON audit_events (case_id, created_at DESC, id DESC);

CREATE INDEX audit_events_actor_created_at_idx
  ON audit_events (actor_user_id, created_at DESC, id DESC);
