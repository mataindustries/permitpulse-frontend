PRAGMA foreign_keys = OFF;

CREATE TABLE "user_next" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  image TEXT,
  created_at INTEGER NOT NULL
    DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL
    DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  role TEXT NOT NULL DEFAULT 'client'
    CONSTRAINT user_role_reviewed_check CHECK (role IN ('client', 'admin')),
  banned INTEGER NOT NULL DEFAULT 0
    CHECK (banned IN (0, 1)),
  ban_reason TEXT,
  ban_expires INTEGER
);

INSERT INTO "user_next" (
  id,
  name,
  email,
  email_verified,
  image,
  created_at,
  updated_at,
  role,
  banned,
  ban_reason,
  ban_expires
)
SELECT
  id,
  name,
  email,
  email_verified,
  image,
  created_at,
  updated_at,
  CASE role
    WHEN 'admin' THEN 'admin'
    ELSE 'client'
  END,
  0,
  NULL,
  NULL
FROM "user";

DROP TABLE "user";
ALTER TABLE "user_next" RENAME TO "user";

PRAGMA foreign_keys = ON;

ALTER TABLE "session"
  ADD COLUMN impersonated_by TEXT;

CREATE INDEX user_role_idx
  ON "user" (role);

CREATE INDEX user_banned_idx
  ON "user" (banned);

CREATE INDEX session_impersonated_by_idx
  ON "session" (impersonated_by);

CREATE TABLE admin_bootstrap_claim (
  id INTEGER PRIMARY KEY NOT NULL
    CHECK (id = 1),
  created_at INTEGER NOT NULL
    DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);

PRAGMA foreign_key_check;
