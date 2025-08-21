-- Migration 005: Enhanced Legal Signature System with Geolocation and Device Fingerprinting
-- Comprehensive implementation for legally binding electronic signatures

-- Create document_hashes table for integrity verification
CREATE TABLE IF NOT EXISTS document_hashes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
    hash_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    UNIQUE(document_id, hash_algorithm)
);

-- Create enhanced authentication_records table with geolocation and device fingerprinting
CREATE TABLE IF NOT EXISTS authentication_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    envelope_id INTEGER,
    document_id INTEGER,
    session_id TEXT NOT NULL,
    authentication_method TEXT NOT NULL, -- 'password', 'sms', 'email', 'phone', 'access_code', 'biometric'
    authentication_level TEXT NOT NULL DEFAULT 'standard', -- 'basic', 'standard', 'high', 'qualified'
    
    -- Device Information & Fingerprinting
    device_fingerprint TEXT NOT NULL, -- Composite fingerprint hash
    user_agent TEXT,
    browser_name TEXT,
    browser_version TEXT,
    operating_system TEXT,
    device_type TEXT, -- 'desktop', 'mobile', 'tablet'
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    platform TEXT,
    hardware_concurrency INTEGER, -- Number of CPU cores
    device_memory INTEGER, -- Available device memory in GB
    
    -- Network & Location Information
    ip_address TEXT NOT NULL,
    isp_name TEXT,
    connection_type TEXT, -- 'wifi', 'cellular', 'ethernet', 'unknown'
    
    -- Geolocation Data
    latitude REAL,
    longitude REAL,
    accuracy REAL, -- GPS accuracy in meters
    altitude REAL,
    heading REAL, -- Direction of travel
    speed REAL, -- Speed in m/s
    country_code TEXT,
    country_name TEXT,
    region TEXT,
    city TEXT,
    postal_code TEXT,
    geolocation_method TEXT, -- 'gps', 'network', 'ip', 'manual'
    geolocation_consent BOOLEAN DEFAULT 0,
    
    -- Security Verification
    verification_code TEXT,
    verification_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Timestamps and Status
    authenticated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'failed')),
    
    -- Compliance and Audit
    compliance_level TEXT DEFAULT 'standard', -- 'basic', 'standard', 'advanced', 'qualified'
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    fraud_indicators TEXT DEFAULT '[]', -- JSON array of fraud indicators
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL
);

-- Create digital_certificates table for PKI integration
CREATE TABLE IF NOT EXISTS digital_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    certificate_type TEXT NOT NULL, -- 'self_signed', 'ca_issued', 'qualified'
    certificate_pem TEXT NOT NULL,
    private_key_encrypted TEXT, -- Encrypted private key (if stored)
    public_key_pem TEXT NOT NULL,
    serial_number TEXT,
    issuer_dn TEXT, -- Distinguished Name of issuer
    subject_dn TEXT, -- Distinguished Name of subject
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    key_usage TEXT, -- JSON array of key usage flags
    extended_key_usage TEXT, -- JSON array of extended key usage
    ca_name TEXT, -- Certificate Authority name
    ca_url TEXT, -- CA validation URL
    ocsp_url TEXT, -- OCSP responder URL
    crl_url TEXT, -- Certificate Revocation List URL
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'suspended')),
    revocation_reason TEXT,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create legal_signatures table for cryptographic signatures
CREATE TABLE IF NOT EXISTS legal_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    authentication_record_id INTEGER NOT NULL,
    certificate_id INTEGER,
    
    -- Signature Data
    signature_algorithm TEXT NOT NULL DEFAULT 'RSA-SHA256',
    signature_value TEXT NOT NULL, -- Base64 encoded signature
    signature_format TEXT NOT NULL DEFAULT 'PKCS7', -- 'PKCS7', 'CAdES', 'XAdES', 'PAdES'
    
    -- Document Information at Time of Signing
    document_hash TEXT NOT NULL,
    document_hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
    document_size INTEGER NOT NULL,
    document_version INTEGER DEFAULT 1,
    pages_signed TEXT, -- JSON array of page numbers
    
    -- Visual Signature Information
    visual_signature_data TEXT, -- Base64 image data
    signature_field_id TEXT, -- Reference to signature field
    signature_bounds TEXT, -- JSON: {x, y, width, height, page}
    
    -- Timestamping
    timestamp_token TEXT, -- RFC 3161 timestamp token
    timestamp_authority TEXT, -- TSA name/URL
    timestamp_algorithm TEXT DEFAULT 'SHA-256',
    timestamp_value DATETIME,
    
    -- Biometric Data (if available)
    biometric_data TEXT, -- Encrypted biometric signature data
    biometric_type TEXT, -- 'pressure', 'speed', 'acceleration', 'tilt'
    signing_duration INTEGER, -- Time taken to sign in milliseconds
    
    -- Legal and Compliance
    signing_intent TEXT NOT NULL, -- "I agree to sign this document"
    consent_text TEXT, -- Full consent text shown to signer
    legal_warnings TEXT, -- Legal warnings shown
    disclosure_accepted BOOLEAN DEFAULT 1,
    
    -- Status and Validation
    signature_status TEXT DEFAULT 'valid' CHECK (signature_status IN ('valid', 'invalid', 'revoked', 'expired', 'unknown')),
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warning')),
    validation_errors TEXT DEFAULT '[]', -- JSON array of validation errors
    validation_warnings TEXT DEFAULT '[]', -- JSON array of validation warnings
    last_validated_at DATETIME,
    
    -- Timestamps
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (authentication_record_id) REFERENCES authentication_records (id),
    FOREIGN KEY (certificate_id) REFERENCES digital_certificates (id)
);

-- Create signature_validation_log for ongoing validation tracking
CREATE TABLE IF NOT EXISTS signature_validation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_id INTEGER NOT NULL,
    validation_type TEXT NOT NULL, -- 'certificate', 'timestamp', 'revocation', 'integrity'
    validation_result TEXT NOT NULL, -- 'pass', 'fail', 'warning', 'unknown'
    validation_details TEXT, -- JSON with detailed results
    validator_info TEXT, -- Information about who/what performed validation
    validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_id) REFERENCES legal_signatures (id) ON DELETE CASCADE
);

-- Create device_trust_scores for risk assessment
CREATE TABLE IF NOT EXISTS device_trust_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_fingerprint TEXT NOT NULL UNIQUE,
    trust_score INTEGER DEFAULT 50, -- 0-100 trust score
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    sign_count INTEGER DEFAULT 0,
    fraud_reports INTEGER DEFAULT 0,
    verification_successes INTEGER DEFAULT 0,
    verification_failures INTEGER DEFAULT 0,
    risk_factors TEXT DEFAULT '[]', -- JSON array of risk factors
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspicious', 'blocked'))
);

-- Create geolocation_verification for location-based security
CREATE TABLE IF NOT EXISTS geolocation_verification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authentication_record_id INTEGER NOT NULL,
    verification_type TEXT NOT NULL, -- 'gps', 'network', 'ip_geolocation', 'manual'
    requested_location TEXT, -- JSON: {lat, lng, accuracy, timestamp}
    verified_location TEXT, -- JSON: {lat, lng, accuracy, source}
    distance_variance REAL, -- Distance between requested and verified in meters
    location_match BOOLEAN DEFAULT 0,
    verification_confidence REAL, -- 0.0 - 1.0 confidence score
    verification_source TEXT, -- Source of verification
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (authentication_record_id) REFERENCES authentication_records (id) ON DELETE CASCADE
);

-- Create compliance_audit_trail for regulatory compliance
CREATE TABLE IF NOT EXISTS compliance_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER,
    document_id INTEGER,
    signature_id INTEGER,
    user_id INTEGER,
    event_type TEXT NOT NULL, -- 'signature_created', 'document_opened', 'auth_attempt', etc.
    event_category TEXT NOT NULL, -- 'security', 'compliance', 'user_action', 'system'
    event_description TEXT NOT NULL,
    compliance_framework TEXT, -- 'ESIGN', 'UETA', 'eIDAS', 'GDPR', 'HIPAA'
    legal_basis TEXT, -- Legal basis for processing
    data_subject_id INTEGER, -- For GDPR compliance
    retention_period INTEGER, -- Days to retain this record
    event_data TEXT, -- JSON with event details
    ip_address TEXT,
    user_agent TEXT,
    geolocation TEXT, -- JSON with location data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL,
    FOREIGN KEY (signature_id) REFERENCES legal_signatures (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_hashes_document_id ON document_hashes(document_id);
CREATE INDEX IF NOT EXISTS idx_authentication_records_user_id ON authentication_records(user_id);
CREATE INDEX IF NOT EXISTS idx_authentication_records_envelope_id ON authentication_records(envelope_id);
CREATE INDEX IF NOT EXISTS idx_authentication_records_device_fingerprint ON authentication_records(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_authentication_records_ip_address ON authentication_records(ip_address);
CREATE INDEX IF NOT EXISTS idx_authentication_records_session_id ON authentication_records(session_id);
CREATE INDEX IF NOT EXISTS idx_digital_certificates_user_id ON digital_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_certificates_serial_number ON digital_certificates(serial_number);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_envelope_id ON legal_signatures(envelope_id);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_document_id ON legal_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_user_id ON legal_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_signatures_signed_at ON legal_signatures(signed_at);
CREATE INDEX IF NOT EXISTS idx_signature_validation_log_signature_id ON signature_validation_log(signature_id);
CREATE INDEX IF NOT EXISTS idx_device_trust_scores_fingerprint ON device_trust_scores(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_geolocation_verification_auth_record ON geolocation_verification(authentication_record_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_trail_envelope_id ON compliance_audit_trail(envelope_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_trail_user_id ON compliance_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_trail_created_at ON compliance_audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_trail_event_type ON compliance_audit_trail(event_type);
