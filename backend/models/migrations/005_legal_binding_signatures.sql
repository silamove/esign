-- Migration 005: Legal Binding Signature System
-- Implements comprehensive legal framework for digital signatures

-- Legal signatures table with full PKI support
CREATE TABLE IF NOT EXISTS legal_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT UNIQUE NOT NULL,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    signature_data TEXT NOT NULL, -- Base64 signature image
    document_hash TEXT NOT NULL, -- SHA-256 hash of original document
    digital_signature TEXT NOT NULL, -- RSA digital signature
    signature_payload TEXT NOT NULL, -- JSON with complete signature data
    authentication_method TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    consent_timestamp DATETIME NOT NULL,
    compliance_level TEXT DEFAULT 'esign_compliant',
    is_revoked BOOLEAN DEFAULT 0,
    revocation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- User cryptographic keys for PKI
CREATE TABLE IF NOT EXISTS user_crypto_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    public_key TEXT NOT NULL, -- PEM format RSA public key
    encrypted_private_key TEXT NOT NULL, -- Encrypted RSA private key
    key_algorithm TEXT DEFAULT 'RSA-2048',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_revoked BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Digital certificates for advanced compliance
CREATE TABLE IF NOT EXISTS digital_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    certificate_data TEXT NOT NULL, -- X.509 certificate in PEM format
    public_key TEXT NOT NULL,
    issuer TEXT NOT NULL, -- Certificate Authority
    serial_number TEXT NOT NULL,
    subject_dn TEXT NOT NULL, -- Distinguished Name
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    certificate_type TEXT DEFAULT 'self_signed', -- 'self_signed', 'ca_issued', 'qualified'
    is_revoked BOOLEAN DEFAULT 0,
    revocation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Certificate of completion for signatures
CREATE TABLE IF NOT EXISTS signature_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_uuid TEXT UNIQUE NOT NULL,
    signature_uuid TEXT NOT NULL,
    certificate_data TEXT NOT NULL, -- JSON with complete certificate details
    pdf_path TEXT, -- Path to generated PDF certificate
    blockchain_hash TEXT, -- Optional blockchain verification
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE CASCADE
);

-- Authentication records for identity verification
CREATE TABLE IF NOT EXISTS authentication_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    authentication_method TEXT NOT NULL, -- 'email', 'sms', 'phone', 'id_verification'
    verification_level TEXT NOT NULL, -- 'basic', 'enhanced', 'high'
    verification_data TEXT NOT NULL, -- JSON with verification details
    verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT 1,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Legal compliance profiles
CREATE TABLE IF NOT EXISTS legal_compliance_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT NOT NULL,
    jurisdiction TEXT NOT NULL, -- 'US', 'EU', 'CA', etc.
    compliance_framework TEXT NOT NULL, -- 'ESIGN', 'eIDAS', 'PIPEDA', etc.
    compliance_level TEXT NOT NULL, -- 'standard', 'advanced', 'qualified'
    requirements_met TEXT NOT NULL, -- JSON array of met requirements
    certification_data TEXT, -- JSON with certification details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE CASCADE
);

-- Timestamping authority records
CREATE TABLE IF NOT EXISTS timestamp_authorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT NOT NULL,
    tsa_url TEXT NOT NULL,
    timestamp_token TEXT NOT NULL, -- RFC 3161 timestamp token
    timestamp_data TEXT NOT NULL, -- JSON with timestamp details
    verification_status TEXT DEFAULT 'verified',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE CASCADE
);

-- Signature audit logs for comprehensive audit trail
CREATE TABLE IF NOT EXISTS signature_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT,
    user_id INTEGER,
    event_type TEXT NOT NULL, -- 'created', 'verified', 'accessed', 'revoked'
    event_data TEXT NOT NULL, -- JSON with event details
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Document integrity verification
CREATE TABLE IF NOT EXISTS document_integrity_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    original_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    integrity_status TEXT NOT NULL, -- 'intact', 'modified', 'corrupted'
    check_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

-- Non-repudiation evidence
CREATE TABLE IF NOT EXISTS non_repudiation_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_uuid TEXT NOT NULL,
    evidence_type TEXT NOT NULL, -- 'signature_evidence', 'delivery_evidence', 'timestamp_evidence'
    evidence_data TEXT NOT NULL, -- JSON with evidence details
    evidence_hash TEXT NOT NULL, -- Hash of evidence for integrity
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_uuid) REFERENCES legal_signatures (signature_uuid) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_legal_signatures_uuid ON legal_signatures(signature_uuid);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_document_id ON legal_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_user_id ON legal_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_timestamp ON legal_signatures(consent_timestamp);
CREATE INDEX IF NOT EXISTS idx_user_crypto_keys_user_id ON user_crypto_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_certificates_user_id ON digital_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_certificates_signature_uuid ON signature_certificates(signature_uuid);
CREATE INDEX IF NOT EXISTS idx_authentication_records_signature_uuid ON authentication_records(signature_uuid);
CREATE INDEX IF NOT EXISTS idx_legal_compliance_profiles_signature_uuid ON legal_compliance_profiles(signature_uuid);
CREATE INDEX IF NOT EXISTS idx_signature_audit_logs_signature_uuid ON signature_audit_logs(signature_uuid);
CREATE INDEX IF NOT EXISTS idx_signature_audit_logs_timestamp ON signature_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_document_integrity_checks_document_id ON document_integrity_checks(document_id);
