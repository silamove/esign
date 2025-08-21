-- Migration 004: Enhanced Envelope Features
-- Additional enterprise features beyond DocuSign standard

-- Add Certificate of Completion table
CREATE TABLE IF NOT EXISTS envelope_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL UNIQUE,
    certificate_uuid TEXT UNIQUE NOT NULL,
    certificate_data TEXT NOT NULL, -- JSON with full audit trail
    pdf_path TEXT, -- Path to generated PDF certificate
    blockchain_hash TEXT, -- Optional: blockchain verification hash
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Add envelope versions for collaborative editing
CREATE TABLE IF NOT EXISTS envelope_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    changes_summary TEXT,
    version_data TEXT NOT NULL, -- Full envelope state snapshot
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id),
    UNIQUE(envelope_id, version_number)
);

-- Add envelope templates for reusability
CREATE TABLE IF NOT EXISTS envelope_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    is_public BOOLEAN DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    template_data TEXT NOT NULL, -- JSON with envelope structure
    thumbnail_path TEXT,
    tags TEXT DEFAULT '', -- Comma-separated tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Add envelope sharing and collaboration
CREATE TABLE IF NOT EXISTS envelope_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission_level TEXT DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
    invited_by INTEGER NOT NULL,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users (id),
    UNIQUE(envelope_id, user_id)
);

-- Add envelope comments and annotations
CREATE TABLE IF NOT EXISTS envelope_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    document_id INTEGER, -- Optional: comment on specific document
    page_number INTEGER, -- Optional: comment on specific page
    x REAL, -- Optional: positioned comment
    y REAL, -- Optional: positioned comment
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT 0, -- Internal team comments vs public recipient comments
    parent_comment_id INTEGER, -- For threaded replies
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL,
    FOREIGN KEY (parent_comment_id) REFERENCES envelope_comments (id) ON DELETE CASCADE
);

-- Add envelope workflow automation
CREATE TABLE IF NOT EXISTS envelope_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    workflow_name TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('status_change', 'time_based', 'user_action', 'external_event')),
    trigger_conditions TEXT NOT NULL, -- JSON with conditions
    actions TEXT NOT NULL, -- JSON with actions to perform
    is_active BOOLEAN DEFAULT 1,
    execution_count INTEGER DEFAULT 0,
    last_executed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Add envelope integrations tracking
CREATE TABLE IF NOT EXISTS envelope_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    integration_type TEXT NOT NULL, -- 'salesforce', 'hubspot', 'google_drive', etc.
    external_id TEXT, -- ID in external system
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'disabled')),
    sync_data TEXT DEFAULT '{}', -- JSON with sync details
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Add envelope analytics tracking
CREATE TABLE IF NOT EXISTS envelope_analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'view', 'download', 'print', 'forward', 'sign', 'decline'
    user_identifier TEXT, -- Email or user ID
    ip_address TEXT,
    user_agent TEXT,
    location_data TEXT, -- JSON with geolocation if available
    duration INTEGER, -- Time spent (for view events)
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Add bulk envelope operations
CREATE TABLE IF NOT EXISTS envelope_bulk_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('bulk_send', 'bulk_reminder', 'bulk_void', 'bulk_download')),
    envelope_ids TEXT NOT NULL, -- JSON array of envelope IDs
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    progress_count INTEGER DEFAULT 0,
    total_count INTEGER NOT NULL,
    error_log TEXT DEFAULT '[]', -- JSON array of errors
    result_data TEXT DEFAULT '{}', -- JSON with operation results
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Enhance envelopes table with additional fields
ALTER TABLE envelopes ADD COLUMN template_id INTEGER REFERENCES envelope_templates(id);
ALTER TABLE envelopes ADD COLUMN is_sequential BOOLEAN DEFAULT 0; -- Sequential vs parallel signing
ALTER TABLE envelopes ADD COLUMN auto_reminder_enabled BOOLEAN DEFAULT 1;
ALTER TABLE envelopes ADD COLUMN language_code TEXT DEFAULT 'en';
ALTER TABLE envelopes ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE envelopes ADD COLUMN brand_id TEXT; -- For white-labeling
ALTER TABLE envelopes ADD COLUMN compliance_level TEXT DEFAULT 'standard' CHECK (compliance_level IN ('standard', 'hipaa', 'sox', 'gdpr'));
ALTER TABLE envelopes ADD COLUMN retention_policy TEXT DEFAULT 'standard'; -- Document retention policy
ALTER TABLE envelopes ADD COLUMN watermark_text TEXT; -- Optional watermark for documents

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_envelope_certificates_envelope_id ON envelope_certificates(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_versions_envelope_id ON envelope_versions(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_user_id ON envelope_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_category ON envelope_templates(category);
CREATE INDEX IF NOT EXISTS idx_envelope_collaborators_envelope_id ON envelope_collaborators(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_collaborators_user_id ON envelope_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_envelope_comments_envelope_id ON envelope_comments(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_workflows_envelope_id ON envelope_workflows(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_integrations_envelope_id ON envelope_integrations(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_analytics_events_envelope_id ON envelope_analytics_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_bulk_operations_user_id ON envelope_bulk_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_template_id ON envelopes(template_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_brand_id ON envelopes(brand_id);
