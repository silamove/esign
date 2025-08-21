-- Migration 001: Initial Schema
-- Base schema for OnDottedLine signature platform

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
    total_pages INTEGER DEFAULT 1 CHECK (total_pages > 0),
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Signatures table
CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    signature_data TEXT NOT NULL,
    type TEXT DEFAULT 'signature' CHECK (type IN ('signature', 'initials')),
    is_default BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Document fields table
CREATE TABLE IF NOT EXISTS document_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initials', 'text', 'date', 'checkbox')),
    field_data TEXT NOT NULL,
    x REAL NOT NULL CHECK (x >= 0),
    y REAL NOT NULL CHECK (y >= 0),
    width REAL NOT NULL CHECK (width > 0),
    height REAL NOT NULL CHECK (height > 0),
    page INTEGER NOT NULL CHECK (page >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

-- Document sharing table
CREATE TABLE IF NOT EXISTS document_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    shared_by INTEGER NOT NULL,
    shared_with TEXT NOT NULL,
    permissions TEXT DEFAULT 'view' CHECK (permissions IN ('view', 'edit', 'sign')),
    expires_at DATETIME,
    access_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    document_id INTEGER,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_document_fields_document_id ON document_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_document_fields_type ON document_fields(field_type);
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(access_token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON signatures(user_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users 
BEGIN 
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_documents_timestamp 
AFTER UPDATE ON documents 
BEGIN 
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_signatures_timestamp 
AFTER UPDATE ON signatures 
BEGIN 
    UPDATE signatures SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
