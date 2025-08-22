-- Migration 008: Enterprise Feature Tables (PostgreSQL)
-- Adds: workflows, integrations, branding. Designed to be simple, multi-tenant, and idempotent.

-- 1) Workflows: complex, multi-step approval chains stored as JSONB definitions
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workflows_org_name ON workflows(organization_id, name);

ALTER TABLE workflows
  ADD CONSTRAINT fk_workflows_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 2) Integrations: third-party integration configs and credentials (encrypted at the app layer)
CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL, -- e.g. 'salesforce', 'sharepoint', 'google_drive', 'one_drive'
  display_name VARCHAR(100),
  api_credentials_encrypted TEXT NOT NULL, -- store ciphertext; app handles encryption/decryption
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_integrations_org_type ON integrations(organization_id, type);

ALTER TABLE integrations
  ADD CONSTRAINT fk_integrations_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 3) Branding: per-organization branding (one row per org)
CREATE TABLE IF NOT EXISTS branding (
  organization_id INTEGER PRIMARY KEY,
  logo_url TEXT,
  primary_color VARCHAR(7),
  email_footer_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE branding
  ADD CONSTRAINT fk_branding_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
