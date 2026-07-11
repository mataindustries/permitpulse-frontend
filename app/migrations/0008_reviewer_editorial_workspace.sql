CREATE TABLE reviewer_findings (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
  finding_type TEXT NOT NULL DEFAULT 'risk' CHECK(finding_type IN ('risk','strength')),
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),
  summary TEXT NOT NULL CHECK(length(trim(summary)) BETWEEN 1 AND 4000),
  confidence TEXT NOT NULL CHECK(confidence IN ('high','medium','low')),
  recommended_resolution TEXT NOT NULL CHECK(length(trim(recommended_resolution)) BETWEEN 1 AND 4000),
  internal_notes TEXT NOT NULL DEFAULT '' CHECK(length(internal_notes) <= 8000),
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviewer_findings_case_idx ON reviewer_findings(case_id, updated_at DESC, id DESC);

CREATE TABLE reviewer_finding_evidence (
  finding_id TEXT NOT NULL REFERENCES reviewer_findings(id) ON DELETE RESTRICT,
  evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
  PRIMARY KEY(finding_id, evidence_item_id)
);
CREATE TABLE reviewer_finding_timeline (
  finding_id TEXT NOT NULL REFERENCES reviewer_findings(id) ON DELETE RESTRICT,
  timeline_entry_id TEXT NOT NULL REFERENCES timeline_entries(id) ON DELETE RESTRICT,
  PRIMARY KEY(finding_id, timeline_entry_id)
);

CREATE TABLE reviewer_questions (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  question TEXT NOT NULL CHECK(length(trim(question)) BETWEEN 1 AND 1000),
  why_it_matters TEXT NOT NULL CHECK(length(trim(why_it_matters)) BETWEEN 1 AND 2000),
  evidence_requested TEXT NOT NULL CHECK(length(trim(evidence_requested)) BETWEEN 1 AND 2000),
  assigned_reviewer TEXT NOT NULL CHECK(length(trim(assigned_reviewer)) BETWEEN 1 AND 160),
  status TEXT NOT NULL CHECK(status IN ('open','waiting','answered','closed')),
  publishable INTEGER NOT NULL DEFAULT 1 CHECK(publishable IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviewer_questions_case_idx ON reviewer_questions(case_id, updated_at DESC, id DESC);

CREATE TABLE reviewer_actions (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  priority TEXT NOT NULL CHECK(priority IN ('critical','high','medium','low')),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 4000),
  estimated_impact TEXT NOT NULL CHECK(length(trim(estimated_impact)) BETWEEN 1 AND 2000),
  responsible_party TEXT NOT NULL CHECK(length(trim(responsible_party)) BETWEEN 1 AND 160),
  due_date TEXT CHECK(due_date IS NULL OR length(due_date) = 10), approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviewer_actions_case_idx ON reviewer_actions(case_id, updated_at DESC, id DESC);
CREATE TABLE reviewer_action_evidence (
  action_id TEXT NOT NULL REFERENCES reviewer_actions(id) ON DELETE RESTRICT,
  evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
  PRIMARY KEY(action_id, evidence_item_id)
);

CREATE TABLE reviewer_notes (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  commentary TEXT NOT NULL CHECK(length(trim(commentary)) BETWEEN 1 AND 8000),
  publishable INTEGER NOT NULL DEFAULT 0 CHECK(publishable IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviewer_notes_case_idx ON reviewer_notes(case_id, updated_at DESC, id DESC);

CREATE TABLE reviewer_revisions (
  id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  object_type TEXT NOT NULL CHECK(object_type IN ('finding','question','action','note')),
  object_id TEXT NOT NULL, previous_value_json TEXT NOT NULL CHECK(json_valid(previous_value_json)),
  new_value_json TEXT NOT NULL CHECK(json_valid(new_value_json)),
  created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviewer_revisions_case_idx ON reviewer_revisions(case_id, created_at DESC, id DESC);
