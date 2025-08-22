-- Organization system migration
-- Creates organizations table and updates existing tables to support multi-tenancy

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    settings JSON DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    billing_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create organization_users table for user-organization relationships
CREATE TABLE IF NOT EXISTS organization_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, viewer
    permissions JSON DEFAULT '{}',
    invited_by INTEGER,
    invited_at DATETIME,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    UNIQUE(organization_id, user_id)
);

-- Add organization_id to existing tables
ALTER TABLE users ADD COLUMN current_organization_id INTEGER;

ALTER TABLE documents ADD COLUMN organization_id INTEGER;

ALTER TABLE envelope_templates ADD COLUMN organization_id INTEGER;

ALTER TABLE smart_templates ADD COLUMN organization_id INTEGER;

-- Create indexes for performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organization_users_org ON organization_users(organization_id);
CREATE INDEX idx_organization_users_user ON organization_users(user_id);
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_templates_org ON envelope_templates(organization_id);
CREATE INDEX idx_smart_templates_org ON smart_templates(organization_id);

-- Insert default organization for existing data
INSERT INTO organizations (
    name, 
    slug, 
    domain,
    settings,
    subscription_plan
) VALUES (
    'Demo Organization',
    'demo-org',
    'demo.pdfsign.com',
    '{"branding":{"primaryColor":"#6366f1","allowCustomBranding":true},"features":{"maxUsers":50,"maxDocumentsPerMonth":1000,"customTemplates":true,"apiAccess":true}}',
    'enterprise'
);

-- Assign existing users to the demo organization
UPDATE users SET current_organization_id = 1;

-- Create organization_users relationships for existing users
INSERT INTO organization_users (organization_id, user_id, role)
SELECT 1, id, 
    CASE 
        WHEN role = 'admin' THEN 'owner'
        ELSE 'admin'
    END
FROM users;

-- Update existing documents to belong to the demo organization
UPDATE documents SET organization_id = 1;

-- Update existing templates to belong to the demo organization  
UPDATE envelope_templates SET organization_id = 1;
UPDATE smart_templates SET organization_id = 1;
