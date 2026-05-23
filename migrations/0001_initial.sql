PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workspace_type TEXT NOT NULL DEFAULT 'personal',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  os TEXT NOT NULL,
  arch TEXT,
  client_version TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  triggers_json TEXT NOT NULL DEFAULT '[]',
  compatibility_json TEXT NOT NULL DEFAULT '{"agents":["generic"]}',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  author TEXT,
  license TEXT,
  current_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trust_level TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  trigger_text TEXT,
  content_summary TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, version)
);

CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE IF NOT EXISTS pack_versions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(pack_id, version)
);

CREATE TABLE IF NOT EXISTS pack_items (
  id TEXT PRIMARY KEY,
  pack_version_id TEXT NOT NULL REFERENCES pack_versions(id) ON DELETE CASCADE,
  skill_version_id TEXT NOT NULL REFERENCES skill_versions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  optional INTEGER NOT NULL DEFAULT 0,
  UNIQUE(pack_version_id, skill_version_id)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  task_context TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE IF NOT EXISTS profile_versions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  agent_type TEXT NOT NULL,
  device_selector_json TEXT NOT NULL DEFAULT '{}',
  task_context TEXT,
  published_manifest_key TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(profile_id, version)
);

CREATE TABLE IF NOT EXISTS profile_pack_items (
  id TEXT PRIMARY KEY,
  profile_version_id TEXT NOT NULL REFERENCES profile_versions(id) ON DELETE CASCADE,
  pack_version_id TEXT NOT NULL REFERENCES pack_versions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(profile_version_id, pack_version_id)
);

CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_version_id TEXT NOT NULL REFERENCES profile_versions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'stable',
  manifest_key TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_profile_bindings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  target_path_hint TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(device_id, profile_id, agent_type)
);

CREATE TABLE IF NOT EXISTS apply_reports (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_summary TEXT,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_runs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_version_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  ruleset_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES quality_runs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  message TEXT NOT NULL,
  recommendation TEXT,
  allowlisted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS skill_fts USING fts5(
  skill_id UNINDEXED,
  name,
  description,
  tags,
  trigger_text,
  content
);

CREATE INDEX IF NOT EXISTS idx_skills_account_status ON skills(account_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_versions_skill_state ON skill_versions(skill_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_pack_versions_pack_state ON pack_versions(pack_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_profile_versions_profile_state ON profile_versions(profile_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_releases_account_created ON releases(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_apply_reports_device ON apply_reports(device_id, applied_at);
