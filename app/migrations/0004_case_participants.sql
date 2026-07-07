CREATE TABLE case_participants (
  case_id TEXT NOT NULL
    CHECK (length(case_id) BETWEEN 1 AND 64)
    REFERENCES cases (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL
    REFERENCES "user" (id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL
    CHECK (participant_role = 'owner'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (case_id, user_id)
);

CREATE INDEX case_participants_user_case_idx
  ON case_participants (user_id, case_id);

CREATE INDEX case_participants_case_role_idx
  ON case_participants (case_id, participant_role);
