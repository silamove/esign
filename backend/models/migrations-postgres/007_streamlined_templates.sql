-- Migration 007: Streamlined Templates (PostgreSQL)
-- Consolidate envelope_templates, smart_templates, envelope_types into a unified templates model.
-- Keep legacy tables for compatibility; new code should use templates + fields(template_id) + recipients.

-- 1) Core templates table
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','smart')),
  category VARCHAR(100),
  is_public BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  creator_id INTEGER,
  organization_id INTEGER,
  template_data JSONB DEFAULT '{}'::jsonb,
  roles JSONB DEFAULT '[]'::jsonb,            -- simplified roles stored on the template
  tags TEXT[],
  thumbnail_path TEXT,
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,         -- holds extras from smart_templates/envelope_types
  legacy_envelope_template_id INTEGER,        -- link to old envelope_templates.id for backfill
  legacy_smart_template_id INTEGER,           -- link to old smart_templates.id for backfill
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_templates_org ON templates(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_templates_name_org_type ON templates(name, organization_id, type);

-- 2) Add template support to fields and relax NOT NULLs to allow template-level fields
ALTER TABLE fields ADD COLUMN IF NOT EXISTS template_id INTEGER;
ALTER TABLE fields ALTER COLUMN envelope_id DROP NOT NULL;
ALTER TABLE fields ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE fields
  ADD CONSTRAINT fk_fields_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;

-- Ensure at least one of (template_id, envelope_id) is present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fields_target_not_null'
  ) THEN
    ALTER TABLE fields
      ADD CONSTRAINT fields_target_not_null CHECK (
        template_id IS NOT NULL OR envelope_id IS NOT NULL
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fields_template_id ON fields(template_id);

-- 3) Import data from legacy envelope_templates -> templates (type = 'standard')
INSERT INTO templates (
  name, description, type, category, is_public, is_active, creator_id, organization_id,
  template_data, tags, thumbnail_path, usage_count, metadata, legacy_envelope_template_id, created_at, updated_at
)
SELECT 
  et.name,
  et.description,
  'standard' AS type,
  et.category,
  et.is_public,
  et.is_active,
  et.creator_id,
  et.organization_id,
  COALESCE(et.template_data, '{}'::jsonb),
  et.tags,
  et.thumbnail_path,
  et.usage_count,
  '{}'::jsonb AS metadata,
  et.id AS legacy_envelope_template_id,
  et.created_at,
  et.updated_at
FROM envelope_templates et
ON CONFLICT (name, organization_id, type) DO NOTHING;

-- 4) Import data from legacy smart_templates -> templates (type = 'smart')
INSERT INTO templates (
  name, description, type, category, is_public, is_active, creator_id, organization_id,
  template_data, tags, usage_count, metadata, legacy_smart_template_id, created_at, updated_at
)
SELECT 
  st.name,
  st.description,
  'smart' AS type,
  st.category,
  false AS is_public,
  st.is_active,
  NULL::INTEGER AS creator_id,
  st.organization_id,
  COALESCE(st.template_structure, '{}'::jsonb) AS template_data,
  st.tags,
  0 AS usage_count,
  jsonb_build_object(
    'industry', st.industry,
    'complexity_level', st.complexity_level,
    'estimated_time', st.estimated_time,
    'difficulty_level', st.difficulty_level,
    'ai_suggestions', st.ai_suggestions,
    'usage_analytics', st.usage_analytics,
    'is_premium', st.is_premium
  ) AS metadata,
  st.id AS legacy_smart_template_id,
  st.created_at,
  st.updated_at
FROM smart_templates st
ON CONFLICT (name, organization_id, type) DO NOTHING;

-- 4c) Import data from legacy envelope_types -> templates (store specifics in metadata)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS legacy_envelope_type_id INTEGER;

INSERT INTO templates (
  name, description, type, category, is_public, is_active, creator_id, organization_id,
  template_data, tags, usage_count, metadata, legacy_envelope_type_id, created_at, updated_at
)
SELECT 
  COALESCE(et.display_name, et.name) AS name,
  et.description,
  'standard' AS type,
  et.category,
  false AS is_public,
  et.is_active,
  NULL::INTEGER AS creator_id,
  NULL::INTEGER AS organization_id,
  '{}'::jsonb AS template_data,
  NULL::TEXT[] AS tags,
  0 AS usage_count,
  jsonb_build_object(
    'legacy_name', et.name,
    'display_name', et.display_name,
    'icon', et.icon,
    'color', et.color,
    'sort_order', et.sort_order,
    'default_expiration_days', et.default_expiration_days,
    'requires_witness', et.requires_witness,
    'requires_notary', et.requires_notary,
    'compliance_requirements', COALESCE(et.compliance_requirements, '{}'::jsonb),
    'suggested_fields', COALESCE(et.suggested_fields, '[]'::jsonb),
    'workflow_settings', COALESCE(et.workflow_settings, '{}'::jsonb),
    'legacy_source', 'envelope_type'
  ) AS metadata,
  et.id AS legacy_envelope_type_id,
  et.created_at,
  et.updated_at
FROM envelope_types et
ON CONFLICT (name, organization_id, type) DO NOTHING;

-- 5) Backfill roles JSON from template_roles into templates.roles for legacy envelope templates
UPDATE templates t
SET roles = sub.roles
FROM (
  SELECT 
    tr.template_id AS legacy_id,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', tr.id,
      'name', tr.name,
      'display_name', tr.display_name,
      'description', tr.description,
      'is_required', tr.is_required,
      'signing_order', tr.signing_order,
      'permissions', tr.permissions
    ) ORDER BY tr.signing_order ASC), '[]'::jsonb) AS roles
  FROM template_roles tr
  GROUP BY tr.template_id
) sub
WHERE t.legacy_envelope_template_id = sub.legacy_id
  AND (t.roles IS NULL OR t.roles = '[]'::jsonb);

-- 6) Backfill fields from template_fields into fields with template_id
INSERT INTO fields (
  template_id, envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required,
  default_value, validation_rules, value, signed_at, created_at, updated_at
)
SELECT 
  t.id AS template_id,
  NULL::INTEGER AS envelope_id,
  NULL::INTEGER AS document_id,
  NULL::INTEGER AS recipient_id,
  tf.field_type AS type,
  tf.field_name AS name,
  tf.label,
  NULLIF(tf.position_data->>'x','')::numeric,
  NULLIF(tf.position_data->>'y','')::numeric,
  NULLIF(tf.position_data->>'width','')::numeric,
  NULLIF(tf.position_data->>'height','')::numeric,
  NULLIF(tf.position_data->>'page','')::integer,
  tf.is_required,
  tf.placeholder AS default_value,
  COALESCE(tf.validation_rules, '{}'::jsonb) AS validation_rules,
  NULL::TEXT AS value,
  NULL::TIMESTAMP AS signed_at,
  tf.created_at,
  tf.updated_at
FROM template_fields tf
JOIN templates t ON t.legacy_envelope_template_id = tf.template_id
ON CONFLICT DO NOTHING;

-- 7) Convenience view to align naming with streamlined "organization_members"
CREATE OR REPLACE VIEW organization_members AS
SELECT 
  ou.id,
  ou.organization_id,
  ou.user_id,
  ou.role,
  ou.permissions,
  ou.invited_by,
  ou.invited_at,
  ou.joined_at,
  ou.is_active,
  ou.created_at,
  ou.updated_at
FROM organization_users ou;

-- 8) Compatibility view for legacy envelope_types consumers (read-only)
CREATE OR REPLACE VIEW envelope_types_compat AS
SELECT 
  t.legacy_envelope_type_id AS id,
  COALESCE(t.metadata->>'legacy_name', t.name) AS name,
  COALESCE(t.metadata->>'display_name', t.name) AS display_name,
  t.description,
  t.metadata->>'icon' AS icon,
  t.metadata->>'color' AS color,
  t.category,
  t.is_active,
  (t.metadata->>'sort_order')::integer AS sort_order,
  (t.metadata->>'default_expiration_days')::integer AS default_expiration_days,
  (t.metadata->>'requires_witness')::boolean AS requires_witness,
  (t.metadata->>'requires_notary')::boolean AS requires_notary,
  COALESCE(t.metadata->'compliance_requirements', '{}'::jsonb) AS compliance_requirements,
  COALESCE(t.metadata->'suggested_fields', '[]'::jsonb) AS suggested_fields,
  COALESCE(t.metadata->'workflow_settings', '{}'::jsonb) AS workflow_settings,
  t.created_at,
  t.updated_at
FROM templates t
WHERE t.legacy_envelope_type_id IS NOT NULL;

-- 9) Unified, writable envelope types view backed by templates
-- Exposes an envelope_types-like interface while keeping templates as the source of truth.
-- New records are stored as templates with metadata.is_envelope_type = true
CREATE INDEX IF NOT EXISTS idx_templates_is_envelope_type_true
ON templates ((metadata->>'is_envelope_type'))
WHERE (metadata->>'is_envelope_type') = 'true';

CREATE OR REPLACE VIEW envelope_types_view AS
SELECT 
  t.id AS id,
  COALESCE(t.metadata->>'legacy_name', t.name) AS name,
  COALESCE(t.metadata->>'display_name', t.name) AS display_name,
  t.description,
  t.metadata->>'icon' AS icon,
  t.metadata->>'color' AS color,
  t.category,
  t.is_active,
  (t.metadata->>'sort_order')::integer AS sort_order,
  (t.metadata->>'default_expiration_days')::integer AS default_expiration_days,
  (t.metadata->>'requires_witness')::boolean AS requires_witness,
  (t.metadata->>'requires_notary')::boolean AS requires_notary,
  COALESCE(t.metadata->'compliance_requirements', '{}'::jsonb) AS compliance_requirements,
  COALESCE(t.metadata->'suggested_fields', '[]'::jsonb) AS suggested_fields,
  COALESCE(t.metadata->'workflow_settings', '{}'::jsonb) AS workflow_settings,
  t.created_at,
  t.updated_at
FROM templates t
WHERE (t.metadata ? 'is_envelope_type' AND (t.metadata->>'is_envelope_type')::boolean = true)
   OR t.legacy_envelope_type_id IS NOT NULL;

-- INSERT rule: create a template row marked as an envelope type
CREATE OR REPLACE RULE envelope_types_view_insert AS
ON INSERT TO envelope_types_view DO INSTEAD
INSERT INTO templates (
  name, description, type, category, is_public, is_active, organization_id, template_data, metadata, created_at, updated_at
) VALUES (
  COALESCE(NEW.display_name, NEW.name),
  NEW.description,
  'standard',
  NEW.category,
  false,
  COALESCE(NEW.is_active, true),
  NULL::integer,
  '{}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'is_envelope_type', true,
    'legacy_name', NEW.name,
    'display_name', NEW.display_name,
    'icon', NEW.icon,
    'color', NEW.color,
    'sort_order', NEW.sort_order,
    'default_expiration_days', NEW.default_expiration_days,
    'requires_witness', NEW.requires_witness,
    'requires_notary', NEW.requires_notary,
    'compliance_requirements', NEW.compliance_requirements,
    'suggested_fields', NEW.suggested_fields,
    'workflow_settings', NEW.workflow_settings,
    'legacy_source', 'envelope_type'
  )),
  COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
  COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
)
RETURNING 
  id,
  COALESCE(metadata->>'legacy_name', name) AS name,
  COALESCE(metadata->>'display_name', name) AS display_name,
  description,
  metadata->>'icon' AS icon,
  metadata->>'color' AS color,
  category,
  is_active,
  (metadata->>'sort_order')::integer AS sort_order,
  (metadata->>'default_expiration_days')::integer AS default_expiration_days,
  (metadata->>'requires_witness')::boolean AS requires_witness,
  (metadata->>'requires_notary')::boolean AS requires_notary,
  COALESCE(metadata->'compliance_requirements', '{}'::jsonb) AS compliance_requirements,
  COALESCE(metadata->'suggested_fields', '[]'::jsonb) AS suggested_fields,
  COALESCE(metadata->'workflow_settings', '{}'::jsonb) AS workflow_settings,
  created_at,
  updated_at;

-- UPDATE rule: update the underlying template and merge metadata
CREATE OR REPLACE RULE envelope_types_view_update AS
ON UPDATE TO envelope_types_view DO INSTEAD
UPDATE templates t SET
  name = COALESCE(NEW.display_name, NEW.name, t.name),
  description = COALESCE(NEW.description, t.description),
  category = COALESCE(NEW.category, t.category),
  is_active = COALESCE(NEW.is_active, t.is_active),
  metadata = jsonb_strip_nulls(
    COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
      'is_envelope_type', true,
      'legacy_name', NEW.name,
      'display_name', NEW.display_name,
      'icon', NEW.icon,
      'color', NEW.color,
      'sort_order', NEW.sort_order,
      'default_expiration_days', NEW.default_expiration_days,
      'requires_witness', NEW.requires_witness,
      'requires_notary', NEW.requires_notary,
      'compliance_requirements', NEW.compliance_requirements,
      'suggested_fields', NEW.suggested_fields,
      'workflow_settings', NEW.workflow_settings,
      'legacy_source', 'envelope_type'
    )
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE t.id = OLD.id
RETURNING 
  id,
  COALESCE(metadata->>'legacy_name', name) AS name,
  COALESCE(metadata->>'display_name', name) AS display_name,
  description,
  metadata->>'icon' AS icon,
  metadata->>'color' AS color,
  category,
  is_active,
  (metadata->>'sort_order')::integer AS sort_order,
  (metadata->>'default_expiration_days')::integer AS default_expiration_days,
  (metadata->>'requires_witness')::boolean AS requires_witness,
  (metadata->>'requires_notary')::boolean AS requires_notary,
  COALESCE(metadata->'compliance_requirements', '{}'::jsonb) AS compliance_requirements,
  COALESCE(metadata->'suggested_fields', '[]'::jsonb) AS suggested_fields,
  COALESCE(metadata->'workflow_settings', '{}'::jsonb) AS workflow_settings,
  created_at,
  updated_at;

-- DELETE rule: delete the underlying template
CREATE OR REPLACE RULE envelope_types_view_delete AS
ON DELETE TO envelope_types_view DO INSTEAD
DELETE FROM templates t WHERE t.id = OLD.id;

-- 10) Seed common real-world envelope types (idempotent)
WITH seed(name, display_name, description, icon, color, category, default_expiration_days, requires_witness, requires_notary) AS (
  VALUES
    -- Legal
    ('non_disclosure_agreement', 'Non-Disclosure Agreement (NDA)', 'Confidentiality agreements between parties', '🔒', '#DC2626', 'legal', 90, false, false),
    ('service_agreement', 'Service Agreement', 'Professional services contracts', '🤝', '#059669', 'legal', 365, false, false),
    ('consulting_agreement', 'Consulting Agreement', 'Independent contractor agreements', '💼', '#7C3AED', 'legal', 365, false, false),
    ('partnership_agreement', 'Partnership Agreement', 'Business partnership contracts', '🤝', '#DC2626', 'partnership', 365, true, true),

    -- HR
    ('employment_contract', 'Employment Contract', 'New employee hiring agreements', '👔', '#3B82F6', 'hr', 180, false, false),
    ('offer_letter', 'Job Offer Letter', 'Employment offer acceptance', '📄', '#10B981', 'hr', 14, false, false),
    ('termination_agreement', 'Termination Agreement', 'Employment separation documents', '📋', '#EF4444', 'hr', 30, true, false),

    -- Real Estate
    ('purchase_agreement', 'Real Estate Purchase Agreement', 'Property buying/selling contracts', '🏠', '#059669', 'real_estate', 60, true, true), 
    ('lease_agreement', 'Lease Agreement', 'Rental property contracts', '🏘️', '#3B82F6', 'real_estate', 90, false, false),

    -- Financial
    ('loan_agreement', 'Loan Agreement', 'Lending and borrowing contracts', '💰', '#DC2626', 'financial', 180, true, true),
    ('bank_authorization', 'Bank Authorization', 'Banking and payment authorizations', '🏦', '#059669', 'financial', 365, false, false),

    -- Sales & Procurement
    ('sales_contract', 'Sales Contract', 'Product/service sales agreements', '💼', '#10B981', 'sales', 60, false, false),
    ('purchase_order', 'Purchase Order', 'Procurement and ordering documents', '📦', '#3B82F6', 'procurement', 30, false, false),

    -- Technology
    ('software_license', 'Software License Agreement', 'Software licensing contracts', '💻', '#6366F1', 'technology', 365, false, false),
    ('data_processing_agreement', 'Data Processing Agreement', 'GDPR and data handling agreements', '🔐', '#DC2626', 'technology', 365, false, false),

    -- Healthcare
    ('patient_consent', 'Patient Consent Form', 'Medical treatment consent', '🏥', '#EF4444', 'healthcare', 365, false, false),

    -- Education
    ('enrollment_form', 'Enrollment Form', 'Student enrollment and registration', '🎓', '#F59E0B', 'education', 90, false, false),

    -- General
    ('general_contract', 'General Contract', 'Miscellaneous agreements', '📄', '#6B7280', 'general', 60, false, false),
    ('waiver_form', 'Waiver Form', 'Liability waivers and releases', '⚠️', '#EF4444', 'general', 365, true, false)
)
INSERT INTO templates (
  name, description, type, category, is_public, is_active, creator_id, organization_id, template_data, tags, thumbnail_path, usage_count, metadata, created_at, updated_at
)
SELECT 
  s.display_name AS name,
  s.description,
  'standard' AS type,
  s.category,
  false AS is_public,
  true AS is_active,
  NULL::integer AS creator_id,
  NULL::integer AS organization_id,
  '{}'::jsonb AS template_data,
  NULL::text[] AS tags,
  NULL::text AS thumbnail_path,
  0 AS usage_count,
  jsonb_build_object(
    'is_envelope_type', true,
    'legacy_name', s.name,
    'display_name', s.display_name,
    'icon', s.icon,
    'color', s.color,
    'default_expiration_days', s.default_expiration_days,
    'requires_witness', s.requires_witness,
    'requires_notary', s.requires_notary,
    'legacy_source', 'seed'
  ) AS metadata,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM seed s
ON CONFLICT (name, organization_id, type) DO NOTHING;
