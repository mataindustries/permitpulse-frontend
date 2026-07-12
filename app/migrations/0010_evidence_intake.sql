CREATE TABLE evidence_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_size INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  detected_type TEXT NOT NULL,
  category TEXT NOT NULL,
  classification_reasons TEXT NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  queue_state TEXT NOT NULL DEFAULT 'waiting',
  permit_number TEXT,
  jurisdiction TEXT,
  address TEXT,
  document_date TEXT,
  reviewer TEXT,
  discipline TEXT,
  evidence_confidence INTEGER NOT NULL DEFAULT 0,
  detected_issues TEXT NOT NULL DEFAULT '[]',
  reviewed_at TEXT,
  moved_to_evidence_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (owner_user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (moved_to_evidence_id) REFERENCES evidence_items(id) ON DELETE SET NULL,
  CHECK (length(trim(filename)) BETWEEN 1 AND 255),
  CHECK (length(storage_key) BETWEEN 1 AND 512),
  CHECK (file_size BETWEEN 1 AND 20971520),
  CHECK (length(media_type) BETWEEN 1 AND 160),
  CHECK (category IN ('portal_screenshot', 'correction_notice', 'resubmittal_receipt', 'structural_response', 'energy_documents', 'email', 'permit_application', 'plan_sheets', 'other')),
  CHECK (json_valid(classification_reasons) AND json_type(classification_reasons) = 'array'),
  CHECK (extraction_status IN ('pending', 'placeholder_complete', 'placeholder_limited')),
  CHECK (queue_state IN ('waiting', 'processing', 'ready_for_review', 'needs_attention')),
  CHECK (document_date IS NULL OR (length(document_date) = 10 AND document_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
  CHECK (evidence_confidence BETWEEN 0 AND 100),
  CHECK (json_valid(detected_issues) AND json_type(detected_issues) = 'array')
);

CREATE INDEX evidence_drafts_owner_queue_created_idx
  ON evidence_drafts(owner_user_id, queue_state, created_at DESC, id DESC);

CREATE INDEX evidence_drafts_moved_evidence_idx
  ON evidence_drafts(moved_to_evidence_id)
  WHERE moved_to_evidence_id IS NOT NULL;

