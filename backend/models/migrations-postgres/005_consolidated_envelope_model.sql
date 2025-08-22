-- Migration 005: Consolidated Envelope-Centric Model (PostgreSQL)
-- Goal: Make Envelope the central record. Documents belong to an envelope.
-- Introduce unified recipients and fields tables.

-- 1) Documents belong directly to an envelope (non-destructive, nullable for backfill)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS envelope_id INTEGER;

-- Add FK to envelopes (runs once because migrations table ensures single execution)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_envelope FOREIGN KEY (envelope_id)
  REFERENCES envelopes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_envelope_id ON documents(envelope_id);

-- Optional helper: for documents that appear in exactly one envelope, backfill envelope_id
-- This copies the association from envelope_documents where unique.
WITH single_use_docs AS (
  SELECT ed.document_id, MIN(ed.envelope_id) AS envelope_id
  FROM envelope_documents ed
  GROUP BY ed.document_id
  HAVING COUNT(*) = 1
)
UPDATE documents d
SET envelope_id = s.envelope_id
FROM single_use_docs s
WHERE d.id = s.document_id AND d.envelope_id IS NULL;

-- 2) Recipients (replacement for envelope_recipients). Kept side-by-side, legacy table remains.
CREATE TABLE IF NOT EXISTS recipients (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  user_id INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_recipients_envelope_id ON recipients(envelope_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
CREATE UNIQUE INDEX IF NOT EXISTS ux_recipients_envelope_email ON recipients(envelope_id, email);

-- Backfill recipients from envelope_recipients
INSERT INTO recipients (
  envelope_id, email, name, role, routing_order, permissions, authentication_method,
  custom_message, send_reminders, status, signed_at, viewed_at, created_at, updated_at
)
SELECT
  er.envelope_id, er.email, er.name, er.role, er.routing_order, er.permissions,
  er.authentication_method, er.custom_message, er.send_reminders, er.status,
  er.signed_at, er.viewed_at, er.created_at, er.updated_at
FROM envelope_recipients er
ON CONFLICT (envelope_id, email) DO NOTHING;

-- 3) Fields (unifies document_fields, template_fields, envelope_signatures)
CREATE TABLE IF NOT EXISTS fields (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  recipient_id INTEGER, -- nullable for prefill/agent fields
  type VARCHAR(30) NOT NULL CHECK (type IN ('signature','initial','text','date','checkbox','dropdown','radio','currency','number','email','phone')),
  name VARCHAR(100),
  label VARCHAR(200),
  x NUMERIC(10,4),
  y NUMERIC(10,4),
  width NUMERIC(10,4),
  height NUMERIC(10,4),
  page INTEGER,
  required BOOLEAN DEFAULT true,
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  value TEXT,
  signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fields_envelope_id ON fields(envelope_id);
CREATE INDEX IF NOT EXISTS idx_fields_document_id ON fields(document_id);
CREATE INDEX IF NOT EXISTS idx_fields_recipient_id ON fields(recipient_id);
CREATE INDEX IF NOT EXISTS idx_fields_type ON fields(type);

ALTER TABLE fields
  ADD CONSTRAINT fk_fields_envelope FOREIGN KEY (envelope_id) REFERENCES envelopes(id) ON DELETE CASCADE;
ALTER TABLE fields
  ADD CONSTRAINT fk_fields_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE fields
  ADD CONSTRAINT fk_fields_recipient FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE SET NULL;

-- Backfill fields from envelope_signatures (primary signature fields)
INSERT INTO fields (
  envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required,
  default_value, validation_rules, value, signed_at, created_at, updated_at
)
SELECT
  es.envelope_id,
  es.document_id,
  r.id AS recipient_id,
  es.field_type AS type,
  es.field_name AS name,
  es.field_name AS label,
  es.x, es.y, es.width, es.height,
  es.page,
  es.required,
  es.default_value,
  es.validation_rules,
  es.value,
  es.signed_at,
  es.created_at,
  es.updated_at
FROM envelope_signatures es
LEFT JOIN recipients r
  ON r.envelope_id = es.envelope_id AND r.email = es.recipient_email;

-- Optional backfill: document_fields -> fields (for docs already inside envelopes)
-- This will duplicate fields per envelope if a document is used in multiple envelopes.
INSERT INTO fields (
  envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required,
  default_value, validation_rules, value, signed_at, created_at, updated_at
)
SELECT
  ed.envelope_id,
  df.document_id,
  NULL::INTEGER AS recipient_id,
  df.field_type AS type,
  df.field_name AS name,
  df.field_name AS label,
  df.x_position, df.y_position, df.width, df.height,
  df.page_number,
  df.is_required,
  NULL::TEXT AS default_value,
  '{}'::jsonb AS validation_rules,
  df.field_value,
  NULL::TIMESTAMP AS signed_at,
  df.created_at,
  df.updated_at
FROM document_fields df
JOIN envelope_documents ed ON ed.document_id = df.document_id;

-- Notes:
-- - Legacy tables remain (envelope_recipients, envelope_signatures, envelope_documents, document_fields) for compatibility.
-- - Application code can gradually move to recipients and fields.
-- - Once fully migrated, envelope_documents can be deprecated in favor of documents.envelope_id.
