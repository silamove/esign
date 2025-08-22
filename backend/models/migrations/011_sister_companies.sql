-- Add sister company relationships to organizations
-- This allows organizations to be linked as related entities (subsidiaries, divisions, partners, etc.)

-- Create organization_relationships table for sister companies
CREATE TABLE IF NOT EXISTS organization_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    related_organization_id INTEGER NOT NULL,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'sister', -- sister, subsidiary, parent, division, partner, affiliate
    relationship_name VARCHAR(100), -- Custom name for the relationship
    is_bidirectional BOOLEAN DEFAULT 1, -- If true, creates reverse relationship automatically
    permissions TEXT DEFAULT '{}', -- What permissions are shared (documents, templates, users, etc.)
    created_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (related_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(organization_id, related_organization_id, relationship_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_relationships_org ON organization_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_related ON organization_relationships(related_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_type ON organization_relationships(relationship_type);

-- Add parent_organization_id to organizations table for simple hierarchy
ALTER TABLE organizations ADD COLUMN parent_organization_id INTEGER;

-- Add some useful organization fields for corporate structure
ALTER TABLE organizations ADD COLUMN organization_type VARCHAR(50) DEFAULT 'company'; -- company, subsidiary, division, branch, etc.
ALTER TABLE organizations ADD COLUMN legal_entity_type VARCHAR(50); -- LLC, Corp, Partnership, etc.
ALTER TABLE organizations ADD COLUMN tax_id VARCHAR(50); -- EIN, VAT number, etc.

-- Insert demo sister companies for the Demo Organization
-- Insert subsidiary organization
INSERT INTO organizations (
    name, 
    slug, 
    domain,
    organization_type,
    legal_entity_type,
    parent_organization_id,
    settings,
    subscription_plan
) VALUES 
(
    'Demo Corp Subsidiary',
    'demo-corp-subsidiary',
    'subsidiary.demo.pdfsign.com',
    'subsidiary',
    'LLC',
    1,
    '{"branding":{"primaryColor":"#8b5cf6","allowCustomBranding":true},"features":{"maxUsers":25,"maxDocumentsPerMonth":500,"customTemplates":true,"apiAccess":false}}',
    'business'
);

-- Get the subsidiary ID and store in a variable (for SQLite, we'll use last_insert_rowid())
-- Insert international division
INSERT INTO organizations (
    name, 
    slug, 
    domain,
    organization_type,
    legal_entity_type,
    parent_organization_id,
    settings,
    subscription_plan
) VALUES 
(
    'Demo International Division',
    'demo-international',
    'intl.demo.pdfsign.com',
    'division',
    'Division',
    1,
    '{"branding":{"primaryColor":"#059669","allowCustomBranding":true},"features":{"maxUsers":30,"maxDocumentsPerMonth":750,"customTemplates":true,"apiAccess":true}}',
    'business'
);

-- Insert partner organization (no parent)
INSERT INTO organizations (
    name, 
    slug, 
    domain,
    organization_type,
    legal_entity_type,
    parent_organization_id,
    settings,
    subscription_plan
) VALUES 
(
    'Demo Partner Solutions',
    'demo-partner',
    'partner.demo.pdfsign.com',
    'company',
    'Corp',
    NULL,
    '{"branding":{"primaryColor":"#dc2626","allowCustomBranding":true},"features":{"maxUsers":15,"maxDocumentsPerMonth":300,"customTemplates":false,"apiAccess":false}}',
    'pro'
);

-- Create sister company relationships using organization names to ensure correct IDs
-- Demo Organization (id=1) <-> Demo Corp Subsidiary (parent-subsidiary)
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
) 
SELECT 
    1 as organization_id,
    o.id as related_organization_id,
    'subsidiary' as relationship_type,
    'Main Subsidiary' as relationship_name,
    '{"shareTemplates":true,"shareUsers":false,"shareDocuments":false,"viewReports":true}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-corp-subsidiary';

-- Demo Organization (id=1) <-> Demo International Division (parent-division)
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
) 
SELECT 
    1 as organization_id,
    o.id as related_organization_id,
    'division' as relationship_type,
    'International Operations' as relationship_name,
    '{"shareTemplates":true,"shareUsers":true,"shareDocuments":false,"viewReports":true}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-international';

-- Demo Organization (id=1) <-> Demo Partner Solutions (partner relationship)
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
) 
SELECT 
    1 as organization_id,
    o.id as related_organization_id,
    'partner' as relationship_type,
    'Strategic Partner' as relationship_name,
    '{"shareTemplates":false,"shareUsers":false,"shareDocuments":false,"viewReports":false}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-partner';

-- Demo Corp Subsidiary <-> Demo International Division (sister companies)
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
) 
SELECT 
    o1.id as organization_id,
    o2.id as related_organization_id,
    'sister' as relationship_type,
    'Sister Division' as relationship_name,
    '{"shareTemplates":true,"shareUsers":false,"shareDocuments":false,"viewReports":false}' as permissions,
    1 as created_by
FROM organizations o1, organizations o2
WHERE o1.slug = 'demo-corp-subsidiary' AND o2.slug = 'demo-international';

-- Create reverse relationships
-- Subsidiary -> Parent
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
)
SELECT 
    o.id as organization_id,
    1 as related_organization_id,
    'parent' as relationship_type,
    'Parent Company' as relationship_name,
    '{"shareTemplates":true,"shareUsers":false,"shareDocuments":false,"inheritSettings":true}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-corp-subsidiary';

-- Division -> Parent
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
)
SELECT 
    o.id as organization_id,
    1 as related_organization_id,
    'parent' as relationship_type,
    'Head Office' as relationship_name,
    '{"shareTemplates":true,"shareUsers":true,"shareDocuments":false,"inheritSettings":true}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-international';

-- Partner -> Partner (bidirectional)
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
)
SELECT 
    o.id as organization_id,
    1 as related_organization_id,
    'partner' as relationship_type,
    'Strategic Partner' as relationship_name,
    '{"shareTemplates":false,"shareUsers":false,"shareDocuments":false,"viewReports":false}' as permissions,
    1 as created_by
FROM organizations o 
WHERE o.slug = 'demo-partner';

-- Sister relationship reverse
INSERT INTO organization_relationships (
    organization_id,
    related_organization_id,
    relationship_type,
    relationship_name,
    permissions,
    created_by
)
SELECT 
    o2.id as organization_id,
    o1.id as related_organization_id,
    'sister' as relationship_type,
    'Sister Subsidiary' as relationship_name,
    '{"shareTemplates":true,"shareUsers":false,"shareDocuments":false,"viewReports":false}' as permissions,
    1 as created_by
FROM organizations o1, organizations o2
WHERE o1.slug = 'demo-corp-subsidiary' AND o2.slug = 'demo-international';
