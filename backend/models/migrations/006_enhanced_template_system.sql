-- Migration 006: Enhanced Template System (DocuSign-style)
-- Adds support for reusable template roles and positioned fields

-- Template Roles - Reusable recipient roles for templates
CREATE TABLE IF NOT EXISTS template_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    template_id INTEGER NOT NULL,
    role_name TEXT NOT NULL, -- Unique name for the role (e.g., "buyer", "seller", "witness")
    display_name TEXT NOT NULL, -- Human-readable name (e.g., "Property Buyer")
    description TEXT DEFAULT '',
    role_type TEXT DEFAULT 'signer' CHECK (role_type IN ('signer', 'viewer', 'approver', 'form_filler', 'editor')),
    routing_order INTEGER DEFAULT 1,
    permissions TEXT DEFAULT '{}', -- JSON: signing, viewing, downloading permissions
    authentication_method TEXT DEFAULT 'email' CHECK (authentication_method IN ('email', 'sms', 'phone', 'access_code', 'id_verification')),
    is_required BOOLEAN DEFAULT 1, -- Whether this role must be filled when using template
    custom_message TEXT DEFAULT '',
    send_reminders BOOLEAN DEFAULT 1,
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    access_restrictions TEXT DEFAULT '{}', -- JSON: IP restrictions, time restrictions, etc.
    notification_settings TEXT DEFAULT '{}', -- JSON: email preferences, reminder settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    UNIQUE(template_id, role_name)
);

-- Template Fields - Positioned signature and form fields for templates
CREATE TABLE IF NOT EXISTS template_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    template_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL, -- Which template role this field belongs to
    document_index INTEGER DEFAULT 0, -- Which document in the template (0-based)
    field_type TEXT NOT NULL CHECK (field_type IN (
        'signature', 'initial', 'text', 'email', 'date', 'checkbox', 'radio', 'dropdown',
        'number', 'phone', 'ssn', 'title', 'company', 'full_name', 'first_name', 'last_name',
        'zip', 'address', 'city', 'state', 'country', 'note', 'formula', 'attachment'
    )),
    field_name TEXT NOT NULL, -- Unique identifier for the field
    display_name TEXT NOT NULL, -- Label shown to users
    description TEXT DEFAULT '',
    x REAL NOT NULL, -- X position (0-1 relative to page width)
    y REAL NOT NULL, -- Y position (0-1 relative to page height)
    width REAL NOT NULL, -- Width (0-1 relative to page width)
    height REAL NOT NULL, -- Height (0-1 relative to page height)
    page INTEGER DEFAULT 1, -- Page number (1-based)
    is_required BOOLEAN DEFAULT 0,
    default_value TEXT DEFAULT '',
    placeholder TEXT DEFAULT '',
    validation_rules TEXT DEFAULT '{}', -- JSON: regex, min/max length, etc.
    field_options TEXT DEFAULT '{}', -- JSON: dropdown options, checkbox groups, etc.
    formatting TEXT DEFAULT '{}', -- JSON: font, color, alignment settings
    conditional_logic TEXT DEFAULT '{}', -- JSON: show/hide based on other fields
    group_id TEXT, -- For grouping related fields
    z_index INTEGER DEFAULT 1, -- Layer order for overlapping fields
    is_locked BOOLEAN DEFAULT 0, -- Prevent editing in template
    tooltip TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES template_roles (id) ON DELETE CASCADE
);

-- Template Categories - Predefined categories for better organization
CREATE TABLE IF NOT EXISTS template_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '', -- Icon class or URL
    parent_category_id INTEGER, -- For hierarchical categories
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES template_categories (id)
);

-- Insert default template categories
INSERT OR IGNORE INTO template_categories (name, display_name, description, icon, sort_order) VALUES
('real_estate', 'Real Estate', 'Property transactions, leases, and real estate documents', 'home', 1),
('business', 'Business', 'Contracts, agreements, and business documents', 'briefcase', 2),
('hr', 'Human Resources', 'Employment agreements, policies, and HR documents', 'users', 3),
('legal', 'Legal', 'Legal documents, court filings, and attorney forms', 'gavel', 4),
('finance', 'Finance', 'Financial agreements, loans, and investment documents', 'dollar-sign', 5),
('healthcare', 'Healthcare', 'Medical forms, consent forms, and healthcare documents', 'heart', 6),
('education', 'Education', 'Academic forms, enrollment, and educational documents', 'graduation-cap', 7),
('personal', 'Personal', 'Personal documents, wills, and family forms', 'user', 8),
('government', 'Government', 'Government forms and official documents', 'landmark', 9),
('other', 'Other', 'Miscellaneous documents and custom templates', 'file-text', 10);

-- Template Usage Analytics - Track how templates are used
CREATE TABLE IF NOT EXISTS template_usage_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    envelope_id INTEGER, -- Created envelope (if applicable)
    action_type TEXT NOT NULL CHECK (action_type IN ('view', 'preview', 'use', 'clone', 'share')),
    metadata TEXT DEFAULT '{}', -- JSON: additional context
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE SET NULL
);

-- Template Sharing - Share templates with other users or make them public
CREATE TABLE IF NOT EXISTS template_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    shared_by INTEGER NOT NULL,
    shared_with INTEGER, -- NULL for public sharing
    permission_level TEXT DEFAULT 'view' CHECK (permission_level IN ('view', 'use', 'edit', 'admin')),
    expiration_date DATETIME, -- Optional expiration
    access_count INTEGER DEFAULT 0,
    last_accessed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(template_id, shared_with)
);

-- Template Versions - Version control for templates
CREATE TABLE IF NOT EXISTS template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    version_name TEXT DEFAULT '',
    changes_summary TEXT DEFAULT '',
    template_data TEXT NOT NULL, -- Full template snapshot
    roles_data TEXT NOT NULL, -- Template roles snapshot
    fields_data TEXT NOT NULL, -- Template fields snapshot
    is_active BOOLEAN DEFAULT 0, -- Only one version can be active
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id),
    UNIQUE(template_id, version_number)
);

-- Add template reference to envelope recipients (track which template role was used)
ALTER TABLE envelope_recipients ADD COLUMN template_role_id INTEGER REFERENCES template_roles(id);

-- Add template field reference to envelope signatures (track which template field was used)
ALTER TABLE envelope_signatures ADD COLUMN template_field_id INTEGER REFERENCES template_fields(id);

-- Update envelope_templates table with new features
ALTER TABLE envelope_templates ADD COLUMN category_id INTEGER REFERENCES template_categories(id);
ALTER TABLE envelope_templates ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE envelope_templates ADD COLUMN is_published BOOLEAN DEFAULT 0;
ALTER TABLE envelope_templates ADD COLUMN published_at DATETIME;
ALTER TABLE envelope_templates ADD COLUMN requires_authentication BOOLEAN DEFAULT 0;
ALTER TABLE envelope_templates ADD COLUMN compliance_features TEXT DEFAULT '{}'; -- JSON: required compliance features
ALTER TABLE envelope_templates ADD COLUMN estimated_time INTEGER DEFAULT 5; -- Estimated completion time in minutes
ALTER TABLE envelope_templates ADD COLUMN difficulty_level TEXT DEFAULT 'easy' CHECK (difficulty_level IN ('easy', 'medium', 'hard'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_roles_template_id ON template_roles(template_id);
CREATE INDEX IF NOT EXISTS idx_template_roles_role_name ON template_roles(template_id, role_name);
CREATE INDEX IF NOT EXISTS idx_template_fields_template_id ON template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_role_id ON template_fields(role_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_document_page ON template_fields(template_id, document_index, page);
CREATE INDEX IF NOT EXISTS idx_template_categories_parent ON template_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_analytics_template_id ON template_usage_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_analytics_user_id ON template_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_template_shares_template_id ON template_shares(template_id);
CREATE INDEX IF NOT EXISTS idx_template_shares_shared_with ON template_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_template_role ON envelope_recipients(template_role_id);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_template_field ON envelope_signatures(template_field_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_category ON envelope_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_published ON envelope_templates(is_published, published_at);
