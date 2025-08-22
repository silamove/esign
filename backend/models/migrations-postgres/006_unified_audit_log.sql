-- Migration 006: Unified Audit Log (PostgreSQL)
-- Consolidates disparate legal/compliance/audit tables into a single robust audit log.
-- Provides a compatibility view and insert redirection for existing code that writes to audit_logs.

-- 1) Canonical audit table
CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER,
  envelope_id INTEGER,
  document_id INTEGER,
  signature_id INTEGER,
  user_id INTEGER,
  target_type VARCHAR(50),          -- 'envelope', 'document', 'signature', etc.
  target_id INTEGER,                -- ID of the target entity
  event_type VARCHAR(100) NOT NULL, -- e.g. 'envelope_sent', 'signed', 'viewed', 'auth_pass', 'hash_verified'
  event_category VARCHAR(50),       -- 'user_action', 'security', 'compliance', 'system'
  event_description TEXT,
  status VARCHAR(30),               -- optional status (e.g. 'valid','failed')
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  auth_method VARCHAR(30),          -- 'email','sms','phone','access_code','biometric'
  geolocation JSONB,                -- { latitude, longitude, accuracy, ... }
  risk_score INTEGER,               -- 0-100
  certificate_info JSONB,           -- CA / TSA / certificate metadata
  hash_info JSONB,                  -- document hash details
  tsa_info JSONB,                   -- timestamp authority data
  metadata JSONB DEFAULT '{}'::jsonb, -- arbitrary event-specific payload
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys (nullable)
ALTER TABLE audit_events
  ADD CONSTRAINT fk_audit_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE audit_events
  ADD CONSTRAINT fk_audit_events_env FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE SET NULL;
ALTER TABLE audit_events
  ADD CONSTRAINT fk_audit_events_doc FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE audit_events
  ADD CONSTRAINT fk_audit_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_envelope_id ON audit_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_document_id ON audit_events(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_category ON audit_events(event_category);

-- 2) Back-compat view for existing code using audit_logs
-- Maps audit_events -> a minimal audit_logs shape expected by the app
CREATE OR REPLACE VIEW audit_logs AS
SELECT 
  ae.id,
  ae.user_id,
  ae.document_id,
  ae.envelope_id,
  ae.event_type AS action,
  COALESCE(ae.metadata::text, '{}') AS details, -- existing code expects text JSON
  ae.ip_address,
  ae.user_agent,
  ae.created_at
FROM audit_events ae;

-- 3) INSERT rule so existing INSERT INTO audit_logs(...) keeps working
CREATE OR REPLACE RULE audit_logs_insert AS
ON INSERT TO audit_logs DO INSTEAD
INSERT INTO audit_events (
  user_id, document_id, envelope_id, event_type, metadata, ip_address, user_agent, created_at
) VALUES (
  NEW.user_id,
  NEW.document_id,
  NEW.envelope_id,
  NEW.action,
  COALESCE(NULLIF(NEW.details, '')::jsonb, '{}'::jsonb),
  NEW.ip_address,
  NEW.user_agent,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
);
