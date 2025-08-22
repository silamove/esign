-- Migration 009: Compatibility view for envelope_signatures over unified fields
-- Purpose: Maintain read/write compatibility for legacy code by replacing the legacy
-- envelope_signatures table with a view backed by the new fields table. The legacy
-- physical table is preserved as envelope_signatures_legacy for archival purposes.

-- 0) If a legacy table named envelope_signatures exists, rename it to envelope_signatures_legacy
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'envelope_signatures'
  ) THEN
    ALTER TABLE envelope_signatures RENAME TO envelope_signatures_legacy;
  END IF;
END $$;

-- Drop any existing view with the compatibility name (idempotent)
DROP VIEW IF EXISTS envelope_signatures CASCADE;

-- 1) Read compatibility view (match legacy columns)
CREATE VIEW envelope_signatures AS
SELECT 
  f.id,
  f.envelope_id,
  f.document_id,
  COALESCE(r.email, NULL) AS recipient_email,
  f.type AS field_type,
  f.x, f.y, f.width, f.height,
  f.page,
  f.required,
  COALESCE(f.name, f.label, '') AS field_name,
  f.default_value,
  f.validation_rules,
  f.value,
  f.signed_at,
  NULL::text AS signature_data,
  f.created_at,
  f.updated_at
FROM fields f
LEFT JOIN recipients r ON r.id = f.recipient_id
WHERE f.envelope_id IS NOT NULL;

-- 2) Insert redirection rule (best-effort). If recipient_email matches a recipient, map to recipient_id.
CREATE OR REPLACE RULE envelope_signatures_insert AS
ON INSERT TO envelope_signatures DO INSTEAD
INSERT INTO fields (
  envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required, default_value, validation_rules, value, signed_at, created_at, updated_at
) VALUES (
  NEW.envelope_id,
  NEW.document_id,
  (SELECT id FROM recipients WHERE envelope_id = NEW.envelope_id AND email = NEW.recipient_email LIMIT 1),
  NEW.field_type,
  NEW.field_name,
  NEW.field_name,
  NEW.x, NEW.y, NEW.width, NEW.height,
  NEW.page,
  COALESCE(NEW.required, true),
  NEW.default_value,
  COALESCE(NULLIF(NEW.validation_rules::text, '')::jsonb, '{}'::jsonb),
  NEW.value,
  NEW.signed_at,
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
)
RETURNING 
  id, envelope_id, document_id,
  (SELECT email FROM recipients WHERE id = recipient_id) AS recipient_email,
  type AS field_type,
  x, y, width, height,
  page, required,
  COALESCE(name, label) AS field_name,
  default_value, validation_rules, value, signed_at, NULL::text AS signature_data, created_at, updated_at;

-- 3) Update/delete redirection rules for completeness
CREATE OR REPLACE RULE envelope_signatures_update AS
ON UPDATE TO envelope_signatures DO INSTEAD
UPDATE fields f SET
  envelope_id = COALESCE(NEW.envelope_id, f.envelope_id),
  document_id = COALESCE(NEW.document_id, f.document_id),
  recipient_id = COALESCE(
    (SELECT id FROM recipients WHERE envelope_id = COALESCE(NEW.envelope_id, f.envelope_id) AND email = NEW.recipient_email LIMIT 1),
    f.recipient_id
  ),
  type = COALESCE(NEW.field_type, f.type),
  name = COALESCE(NEW.field_name, f.name),
  label = COALESCE(NEW.field_name, f.label),
  x = COALESCE(NEW.x, f.x),
  y = COALESCE(NEW.y, f.y),
  width = COALESCE(NEW.width, f.width),
  height = COALESCE(NEW.height, f.height),
  page = COALESCE(NEW.page, f.page),
  required = COALESCE(NEW.required, f.required),
  default_value = COALESCE(NEW.default_value, f.default_value),
  validation_rules = COALESCE(NULLIF(NEW.validation_rules::text, '')::jsonb, f.validation_rules),
  value = COALESCE(NEW.value, f.value),
  signed_at = COALESCE(NEW.signed_at, f.signed_at),
  updated_at = CURRENT_TIMESTAMP
WHERE f.id = OLD.id
RETURNING 
  id, envelope_id, document_id,
  (SELECT email FROM recipients WHERE id = recipient_id) AS recipient_email,
  type AS field_type,
  x, y, width, height,
  page, required,
  COALESCE(name, label) AS field_name,
  default_value, validation_rules, value, signed_at, NULL::text AS signature_data, created_at, updated_at;

CREATE OR REPLACE RULE envelope_signatures_delete AS
ON DELETE TO envelope_signatures DO INSTEAD
DELETE FROM fields WHERE id = OLD.id;
