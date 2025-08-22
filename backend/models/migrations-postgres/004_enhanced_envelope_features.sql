-- Migration 004: Enhanced Envelope Features (PostgreSQL)

-- Envelope certificates
CREATE TABLE IF NOT EXISTS envelope_certificates (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL UNIQUE,
  certificate_uuid VARCHAR(36) UNIQUE NOT NULL,
  certificate_data JSONB NOT NULL,
  pdf_path TEXT,
  blockchain_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope versions
CREATE TABLE IF NOT EXISTS envelope_versions (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  changes_summary TEXT,
  version_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(envelope_id, version_number)
);

-- Add extra columns to envelope_templates for parity (if missing)
ALTER TABLE envelope_templates ADD COLUMN IF NOT EXISTS uuid VARCHAR(36);
ALTER TABLE envelope_templates ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
ALTER TABLE envelope_templates ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Envelope collaborators
CREATE TABLE IF NOT EXISTS envelope_collaborators (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  permission_level VARCHAR(10) DEFAULT 'view' CHECK (permission_level IN ('view','edit','admin')),
  invited_by INTEGER NOT NULL,
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(envelope_id, user_id)
);

-- Envelope comments
CREATE TABLE IF NOT EXISTS envelope_comments (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  document_id INTEGER,
  page_number INTEGER,
  x NUMERIC(10,4),
  y NUMERIC(10,4),
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  parent_comment_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope workflows
CREATE TABLE IF NOT EXISTS envelope_workflows (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  workflow_name TEXT NOT NULL,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('status_change','time_based','user_action','external_event')),
  trigger_conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope integrations
CREATE TABLE IF NOT EXISTS envelope_integrations (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  integration_type TEXT NOT NULL,
  external_id TEXT,
  sync_status VARCHAR(10) DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','disabled')),
  sync_data JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope analytics events
CREATE TABLE IF NOT EXISTS envelope_analytics_events (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  user_identifier TEXT,
  ip_address TEXT,
  user_agent TEXT,
  location_data JSONB,
  duration INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bulk envelope operations
CREATE TABLE IF NOT EXISTS envelope_bulk_operations (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('bulk_send','bulk_reminder','bulk_void','bulk_download','bulk_update')),
  envelope_ids JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  progress_count INTEGER DEFAULT 0,
  total_count INTEGER NOT NULL,
  error_log JSONB DEFAULT '[]'::jsonb,
  result_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_envelope_certificates_envelope_id ON envelope_certificates(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_versions_envelope_id ON envelope_versions(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_creator_id ON envelope_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_category ON envelope_templates(category);
CREATE INDEX IF NOT EXISTS idx_envelope_collaborators_envelope_id ON envelope_collaborators(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_collaborators_user_id ON envelope_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_envelope_comments_envelope_id ON envelope_comments(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_workflows_envelope_id ON envelope_workflows(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_integrations_envelope_id ON envelope_integrations(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_analytics_events_envelope_id ON envelope_analytics_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_bulk_operations_user_id ON envelope_bulk_operations(user_id);

-- FKs
ALTER TABLE envelope_certificates
  ADD CONSTRAINT fk_env_certs_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_versions
  ADD CONSTRAINT fk_env_versions_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_versions
  ADD CONSTRAINT fk_env_versions_user FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE envelope_collaborators
  ADD CONSTRAINT fk_env_collab_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_collaborators
  ADD CONSTRAINT fk_env_collab_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE envelope_collaborators
  ADD CONSTRAINT fk_env_collab_invited_by FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE envelope_comments
  ADD CONSTRAINT fk_env_comments_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_comments
  ADD CONSTRAINT fk_env_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE envelope_comments
  ADD CONSTRAINT fk_env_comments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE envelope_comments
  ADD CONSTRAINT fk_env_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES envelope_comments(id) ON DELETE CASCADE;
ALTER TABLE envelope_workflows
  ADD CONSTRAINT fk_env_workflows_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_integrations
  ADD CONSTRAINT fk_env_integrations_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_analytics_events
  ADD CONSTRAINT fk_env_analytics_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_bulk_operations
  ADD CONSTRAINT fk_env_bulk_ops_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
