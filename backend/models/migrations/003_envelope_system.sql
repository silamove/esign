-- Migration 003: Add Envelope System
-- OnDottedLine Envelope functionality for managing document signing workflows

-- Create envelopes table
CREATE TABLE IF NOT EXISTS envelopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'voided', 'expired')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    expiration_date DATETIME,
    reminder_frequency TEXT DEFAULT 'daily' CHECK (reminder_frequency IN ('none', 'daily', 'weekly', 'biweekly')),
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create envelope_documents junction table
CREATE TABLE IF NOT EXISTS envelope_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    document_order INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    UNIQUE(envelope_id, document_id)
);

-- Create envelope_recipients table
CREATE TABLE IF NOT EXISTS envelope_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'signer' CHECK (role IN ('signer', 'viewer', 'approver', 'form_filler')),
    routing_order INTEGER DEFAULT 1,
    permissions TEXT DEFAULT '{}',
    authentication_method TEXT DEFAULT 'email' CHECK (authentication_method IN ('email', 'sms', 'phone', 'access_code')),
    custom_message TEXT DEFAULT '',
    send_reminders BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'completed', 'declined')),
    signed_at DATETIME,
    viewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Create envelope_signatures table (for signature fields)
CREATE TABLE IF NOT EXISTS envelope_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initial', 'text', 'date', 'checkbox', 'dropdown', 'radio')),
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    page INTEGER NOT NULL DEFAULT 1,
    required BOOLEAN DEFAULT 1,
    field_name TEXT DEFAULT '',
    default_value TEXT DEFAULT '',
    validation_rules TEXT DEFAULT '{}',
    value TEXT DEFAULT '',
    signed_at DATETIME,
    signature_data TEXT, -- For storing actual signature image data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

-- Create envelope_notifications table for tracking email/SMS notifications
CREATE TABLE IF NOT EXISTS envelope_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('invitation', 'reminder', 'completion', 'decline')),
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Update audit_logs table to include envelope_id
ALTER TABLE audit_logs ADD COLUMN envelope_id INTEGER REFERENCES envelopes(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_envelopes_user_id ON envelopes(user_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status ON envelopes(status);
CREATE INDEX IF NOT EXISTS idx_envelopes_uuid ON envelopes(uuid);
CREATE INDEX IF NOT EXISTS idx_envelope_documents_envelope_id ON envelope_documents(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_documents_document_id ON envelope_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_envelope_id ON envelope_recipients(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_email ON envelope_recipients(email);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_envelope_id ON envelope_signatures(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_document_id ON envelope_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_envelope_signatures_recipient_email ON envelope_signatures(recipient_email);
CREATE INDEX IF NOT EXISTS idx_envelope_notifications_envelope_id ON envelope_notifications(envelope_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_envelope_id ON audit_logs(envelope_id);
