-- Initial schema for PostgreSQL
-- Creates all core tables for the OnDottedLine e-signature platform
-- PostgreSQL Syntax

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    current_organization_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url VARCHAR(500),
    website VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    billing_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization users relationship
CREATE TABLE IF NOT EXISTS organization_users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '{}',
    invited_by INTEGER,
    invited_at TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    title VARCHAR(255),
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    has_fields BOOLEAN DEFAULT false,
    creator_id INTEGER NOT NULL,
    organization_id INTEGER,
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envelope types
CREATE TABLE IF NOT EXISTS envelope_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150),
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(7),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    default_expiration_days INTEGER DEFAULT 30,
    requires_witness BOOLEAN DEFAULT false,
    requires_notary BOOLEAN DEFAULT false,
    compliance_requirements JSONB DEFAULT '{}',
    suggested_fields JSONB DEFAULT '[]',
    workflow_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates
CREATE TABLE IF NOT EXISTS envelope_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    creator_id INTEGER NOT NULL,
    organization_id INTEGER,
    template_data JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Smart templates
CREATE TABLE IF NOT EXISTS smart_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    industry VARCHAR(100),
    complexity_level VARCHAR(20),
    estimated_time INTEGER,
    difficulty_level VARCHAR(20),
    tags TEXT[],
    is_premium BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    organization_id INTEGER,
    template_structure JSONB DEFAULT '{}',
    ai_suggestions JSONB DEFAULT '{}',
    usage_analytics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template roles
CREATE TABLE IF NOT EXISTS template_roles (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150),
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    signing_order INTEGER DEFAULT 1,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template fields
CREATE TABLE IF NOT EXISTS template_fields (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    label VARCHAR(200),
    placeholder VARCHAR(200),
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}',
    position_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document fields
CREATE TABLE IF NOT EXISTS document_fields (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    x_position DECIMAL(10,4),
    y_position DECIMAL(10,4),
    width DECIMAL(10,4),
    height DECIMAL(10,4),
    page_number INTEGER,
    is_required BOOLEAN DEFAULT false,
    assigned_to VARCHAR(255),
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signatures
CREATE TABLE IF NOT EXISTS signatures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    signature_data TEXT NOT NULL,
    signature_type VARCHAR(50) DEFAULT 'digital',
    ip_address VARCHAR(45),
    user_agent TEXT,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(current_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);
CREATE INDEX IF NOT EXISTS idx_organization_users_org ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_envelope_types_category ON envelope_types(category);
CREATE INDEX IF NOT EXISTS idx_envelope_types_active ON envelope_types(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON envelope_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_templates_organization ON envelope_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_smart_templates_organization ON smart_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_template_roles_template ON template_roles(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_template ON template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_role ON template_fields(role_id);
CREATE INDEX IF NOT EXISTS idx_document_fields_document ON document_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_user ON signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_document ON signatures(document_id);

-- Add foreign key constraints
ALTER TABLE users ADD CONSTRAINT fk_users_current_org FOREIGN KEY (current_organization_id) REFERENCES organizations(id);
ALTER TABLE organization_users ADD CONSTRAINT fk_org_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE organization_users ADD CONSTRAINT fk_org_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE organization_users ADD CONSTRAINT fk_org_users_invited_by FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_creator FOREIGN KEY (creator_id) REFERENCES users(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE envelope_templates ADD CONSTRAINT fk_templates_creator FOREIGN KEY (creator_id) REFERENCES users(id);
ALTER TABLE envelope_templates ADD CONSTRAINT fk_templates_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE smart_templates ADD CONSTRAINT fk_smart_templates_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE template_roles ADD CONSTRAINT fk_template_roles_template FOREIGN KEY (template_id) REFERENCES envelope_templates(id) ON DELETE CASCADE;
ALTER TABLE template_fields ADD CONSTRAINT fk_template_fields_template FOREIGN KEY (template_id) REFERENCES envelope_templates(id) ON DELETE CASCADE;
ALTER TABLE template_fields ADD CONSTRAINT fk_template_fields_role FOREIGN KEY (role_id) REFERENCES template_roles(id) ON DELETE CASCADE;
ALTER TABLE document_fields ADD CONSTRAINT fk_document_fields_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE signatures ADD CONSTRAINT fk_signatures_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE signatures ADD CONSTRAINT fk_signatures_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
