-- Migration 003: Envelope System (PostgreSQL)
-- Core envelope workflow tables, Postgres-compatible and multi-tenant ready

-- Envelopes
CREATE TABLE IF NOT EXISTS envelopes (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','in_progress','completed','voided','expired')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  expiration_date TIMESTAMP,
  reminder_frequency VARCHAR(10) DEFAULT 'daily' CHECK (reminder_frequency IN ('none','daily','weekly','biweekly')),
  metadata JSONB DEFAULT '{}'::jsonb,
  organization_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Envelope documents (many-to-many)
CREATE TABLE IF NOT EXISTS envelope_documents (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  document_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(envelope_id, document_id)
);

-- Envelope recipients
CREATE TABLE IF NOT EXISTS envelope_recipients (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'signer' CHECK (role IN ('signer','viewer','approver','form_filler')),
  routing_order INTEGER DEFAULT 1,
  permissions JSONB DEFAULT '{}'::jsonb,
  authentication_method VARCHAR(20) DEFAULT 'email' CHECK (authentication_method IN ('email','sms','phone','access_code')),
  custom_message TEXT DEFAULT '',
  send_reminders BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','viewed','signed','completed','declined')),
  signed_at TIMESTAMP,
  viewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope signature fields
CREATE TABLE IF NOT EXISTS envelope_signatures (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('signature','initial','text','date','checkbox','dropdown','radio')),
  x NUMERIC(10,4) NOT NULL,
  y NUMERIC(10,4) NOT NULL,
  width NUMERIC(10,4) NOT NULL,
  height NUMERIC(10,4) NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN DEFAULT true,
  field_name TEXT DEFAULT '',
  default_value TEXT DEFAULT '',
  validation_rules JSONB DEFAULT '{}'::jsonb,
  value TEXT,
  signed_at TIMESTAMP,
  signature_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope notifications
CREATE TABLE IF NOT EXISTS envelope_notifications (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('invitation','reminder','completion','decline')),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','delivered','bounced','failed')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_envelopes_user_id ON envelopes(user_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status ON envelopes(status);
CREATE INDEX IF NOT EXISTS idx_envelopes_uuid ON envelopes(uuid);
CREATE INDEX IF NOT EXISTS idx_envelopes_org ON envelopes(organization_id);
CREATE INDEX IF NOT EXISTS idx_envelope_documents_envelope_id ON envelope_documents(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_documents_document_id ON envelope_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_envelope_id ON envelope_recipients(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_email ON envelope_recipients(email);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_envelope_id ON envelope_signatures(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_document_id ON envelope_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_recipient_email ON envelope_signatures(recipient_email);
CREATE INDEX IF NOT EXISTS idx_envelope_notifications_envelope_id ON envelope_notifications(envelope_id);

-- FKs (after table creation to avoid dependency issues)
ALTER TABLE envelopes
  ADD CONSTRAINT fk_envelopes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE envelopes
  ADD CONSTRAINT fk_envelopes_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE envelope_documents
  ADD CONSTRAINT fk_envelope_documents_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_documents
  ADD CONSTRAINT fk_envelope_documents_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE envelope_recipients
  ADD CONSTRAINT fk_envelope_recipients_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_signatures
  ADD CONSTRAINT fk_envelope_signatures_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE envelope_signatures
  ADD CONSTRAINT fk_envelope_signatures_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE envelope_notifications
  ADD CONSTRAINT fk_envelope_notifications_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
