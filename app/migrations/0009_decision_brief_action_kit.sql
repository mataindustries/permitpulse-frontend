CREATE TABLE reviewer_action_kits (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL UNIQUE REFERENCES cases(id) ON DELETE RESTRICT,
  current_position TEXT NOT NULL CHECK(length(trim(current_position)) BETWEEN 1 AND 2000),
  confirmed_record TEXT NOT NULL CHECK(length(trim(confirmed_record)) BETWEEN 1 AND 4000),
  unconfirmed_record TEXT NOT NULL CHECK(length(trim(unconfirmed_record)) BETWEEN 1 AND 4000),
  primary_blocker TEXT NOT NULL CHECK(length(trim(primary_blocker)) BETWEEN 1 AND 2000),
  why_appropriate TEXT NOT NULL CHECK(length(trim(why_appropriate)) BETWEEN 1 AND 2000),
  evidence_readiness TEXT NOT NULL CHECK(length(trim(evidence_readiness)) BETWEEN 1 AND 1000),
  review_readiness TEXT NOT NULL CHECK(length(trim(review_readiness)) BETWEEN 1 AND 1000),
  email_subject TEXT NOT NULL CHECK(length(trim(email_subject)) BETWEEN 1 AND 300),
  recipient_role TEXT NOT NULL CHECK(length(trim(recipient_role)) BETWEEN 1 AND 300),
  message_body TEXT NOT NULL CHECK(length(trim(message_body)) BETWEEN 1 AND 5000),
  call_checklist_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(call_checklist_json)),
  requested_confirmations_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(requested_confirmations_json)),
  documents_ready_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(documents_ready_json)),
  escalation_trigger TEXT NOT NULL CHECK(length(trim(escalation_trigger)) BETWEEN 1 AND 2000),
  follow_up_date TEXT CHECK(follow_up_date IS NULL OR length(follow_up_date) = 10),
  internal_note TEXT NOT NULL DEFAULT '' CHECK(length(internal_note) <= 8000),
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE reviewer_action_kit_evidence (
  action_kit_id TEXT NOT NULL REFERENCES reviewer_action_kits(id) ON DELETE RESTRICT,
  evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
  PRIMARY KEY(action_kit_id,evidence_item_id)
);
CREATE TABLE reviewer_action_kit_timeline (
  action_kit_id TEXT NOT NULL REFERENCES reviewer_action_kits(id) ON DELETE RESTRICT,
  timeline_entry_id TEXT NOT NULL REFERENCES timeline_entries(id) ON DELETE RESTRICT,
  PRIMARY KEY(action_kit_id,timeline_entry_id)
);
DROP INDEX reviewer_revisions_case_idx;
CREATE TABLE reviewer_revisions_next (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  object_type TEXT NOT NULL CHECK(object_type IN ('finding','question','action','note','action_kit')),
  object_id TEXT NOT NULL, previous_value_json TEXT NOT NULL CHECK(json_valid(previous_value_json)),
  new_value_json TEXT NOT NULL CHECK(json_valid(new_value_json)), created_at TEXT NOT NULL
);
INSERT INTO reviewer_revisions_next SELECT * FROM reviewer_revisions;
DROP TABLE reviewer_revisions;
ALTER TABLE reviewer_revisions_next RENAME TO reviewer_revisions;
CREATE INDEX reviewer_revisions_case_idx ON reviewer_revisions(case_id,created_at DESC,id DESC);
