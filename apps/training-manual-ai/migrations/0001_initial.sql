CREATE TABLE users (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'employee')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, email)
);

CREATE TABLE manuals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  caution TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX manuals_company_active_updated ON manuals(company_id, active, updated_at DESC);

CREATE TABLE manual_chunks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  manual_id TEXT NOT NULL REFERENCES manuals(id),
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX manual_chunks_company_manual ON manual_chunks(company_id, manual_id);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  manual_id TEXT NOT NULL REFERENCES manuals(id),
  r2_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX attachments_company_manual ON attachments(company_id, manual_id);
