CREATE TABLE evidence_items (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL
    CHECK (length(case_id) BETWEEN 1 AND 64)
    REFERENCES cases (id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL
    REFERENCES "user" (id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL
    CHECK (
      evidence_type IN (
        'document',
        'portal',
        'email',
        'phone_call',
        'meeting',
        'inspection',
        'code_reference',
        'photo',
        'other'
      )
    ),
  title TEXT NOT NULL
    CHECK (length(trim(title)) BETWEEN 1 AND 160),
  summary TEXT NOT NULL
    CHECK (length(trim(summary)) BETWEEN 1 AND 2000),
  source_url TEXT
    CHECK (
      source_url IS NULL
      OR length(source_url) BETWEEN 1 AND 2048
    ),
  source_label TEXT
    CHECK (
      source_label IS NULL
      OR length(trim(source_label)) BETWEEN 1 AND 160
    ),
  source_date TEXT
    CHECK (
      source_date IS NULL
      OR (
        length(source_date) = 10
        AND source_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      )
    ),
  verification_status TEXT NOT NULL
    DEFAULT 'unverified'
    CHECK (
      verification_status IN (
        'unverified',
        'verified',
        'disputed'
      )
    ),
  version INTEGER NOT NULL
    DEFAULT 1
    CHECK (version >= 1),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX evidence_items_case_list_idx
  ON evidence_items (
    case_id,
    deleted_at,
    source_date DESC,
    created_at DESC,
    id DESC
  );

CREATE INDEX evidence_items_case_source_date_idx
  ON evidence_items (case_id, source_date DESC, created_at DESC, id DESC);

CREATE INDEX evidence_items_created_by_idx
  ON evidence_items (created_by_user_id, created_at DESC, id DESC);

CREATE TABLE timeline_entries (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 64),
  case_id TEXT NOT NULL
    CHECK (length(case_id) BETWEEN 1 AND 64)
    REFERENCES cases (id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL
    REFERENCES "user" (id) ON DELETE RESTRICT,
  occurred_on TEXT NOT NULL
    CHECK (
      length(occurred_on) = 10
      AND occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    ),
  timeline_type TEXT NOT NULL
    CHECK (
      timeline_type IN (
        'submission',
        'resubmission',
        'correction',
        'reviewer_contact',
        'applicant_contact',
        'inspection',
        'approval',
        'rejection',
        'status_update',
        'deadline',
        'other'
      )
    ),
  title TEXT NOT NULL
    CHECK (length(trim(title)) BETWEEN 1 AND 160),
  details TEXT NOT NULL
    CHECK (length(trim(details)) BETWEEN 1 AND 4000),
  is_canonical INTEGER NOT NULL
    DEFAULT 0
    CHECK (is_canonical IN (0, 1)),
  version INTEGER NOT NULL
    DEFAULT 1
    CHECK (version >= 1),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX timeline_entries_case_list_idx
  ON timeline_entries (
    case_id,
    deleted_at,
    occurred_on DESC,
    created_at DESC,
    id DESC
  );

CREATE INDEX timeline_entries_case_canonical_idx
  ON timeline_entries (case_id, is_canonical, occurred_on DESC, id DESC);

CREATE INDEX timeline_entries_created_by_idx
  ON timeline_entries (created_by_user_id, created_at DESC, id DESC);

CREATE TABLE timeline_entry_evidence (
  timeline_entry_id TEXT NOT NULL
    REFERENCES timeline_entries (id) ON DELETE CASCADE,
  evidence_item_id TEXT NOT NULL
    REFERENCES evidence_items (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (timeline_entry_id, evidence_item_id)
);

CREATE INDEX timeline_entry_evidence_evidence_idx
  ON timeline_entry_evidence (evidence_item_id, timeline_entry_id);
