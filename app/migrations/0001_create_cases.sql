CREATE TABLE cases (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 64),
  project_name TEXT NOT NULL
    CHECK (length(trim(project_name)) BETWEEN 1 AND 120),
  client_name TEXT NOT NULL
    CHECK (length(trim(client_name)) BETWEEN 1 AND 120),
  address TEXT NOT NULL
    CHECK (length(trim(address)) BETWEEN 1 AND 240),
  city TEXT NOT NULL
    CHECK (length(trim(city)) BETWEEN 1 AND 120),
  jurisdiction TEXT NOT NULL
    CHECK (length(trim(jurisdiction)) BETWEEN 1 AND 160),
  permit_number TEXT
    CHECK (
      permit_number IS NULL
      OR length(trim(permit_number)) BETWEEN 1 AND 80
    ),
  current_status TEXT NOT NULL DEFAULT 'intake'
    CHECK (
      current_status IN (
        'intake',
        'researching',
        'needs_information',
        'ready_for_review'
      )
    ),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX cases_current_status_updated_at_idx
  ON cases (current_status, updated_at DESC);

CREATE INDEX cases_city_jurisdiction_idx
  ON cases (city, jurisdiction);
