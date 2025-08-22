-- Migration 010: Signature Evidences and Audit Chain (PostgreSQL)
-- Adds a first-class signature evidence store tied to envelopes/recipients
-- and introduces optional tamper-evident chaining to audit_events.

-- 1) Signature evidences
CREATE TABLE signature_evidences (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  provider TEXT,                         -- e.g., 'azure_key_vault', 'aws_kms', 'entrust', 'internal_dev'
  payload_json JSONB NOT NULL,           -- canonical payload that was signed
  signature_blob TEXT NOT NULL,          -- detached signature (hex/base64/JWS)
  tsa_token TEXT,                        -- RFC 3161 token or provider timestamp artifact
  cert_chain JSONB,                      -- provider certificate chain/metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE signature_evidences
  ADD CONSTRAINT fk_sig_evidence_env FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE signature_evidences
  ADD CONSTRAINT fk_sig_evidence_recipient FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sig_evidences_envelope_id ON signature_evidences(envelope_id);
CREATE INDEX IF NOT EXISTS idx_sig_evidences_recipient_id ON signature_evidences(recipient_id);

-- 2) Optional audit chain columns (tamper-evident)
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS prev_event_hash TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_events_chain ON audit_events(envelope_id, created_at);

-- 3) Recipient access token (optional, for external signing links)
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS access_token TEXT;
CREATE INDEX IF NOT EXISTS idx_recipients_access_token ON recipients(access_token);
