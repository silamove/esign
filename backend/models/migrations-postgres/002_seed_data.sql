-- Seed data for PostgreSQL database
-- Creates initial users, organizations, and envelope types

-- Insert Demo Organization (idempotent)
INSERT INTO organizations (
    name, 
    slug, 
    domain,
    settings,
    subscription_plan,
    subscription_status
) VALUES (
    'Demo Organization',
    'demo-org',
    'demo.pdfsign.com',
    '{"branding":{"primaryColor":"#6366f1","allowCustomBranding":true},"features":{"maxUsers":50,"maxDocumentsPerMonth":1000,"customTemplates":true,"apiAccess":true}}',
    'enterprise',
    'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Insert users (idempotent) and associate to Demo Organization by slug
INSERT INTO users (email, password, first_name, last_name, role, current_organization_id) 
SELECT 'admin@pdfsign.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyWoBl0pBhOF3S', 'Admin', 'User', 'admin',
       (SELECT id FROM organizations WHERE slug = 'demo-org')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@pdfsign.com');

INSERT INTO users (email, password, first_name, last_name, role, current_organization_id) 
SELECT 'user@pdfsign.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyWoBl0pBhOF3S', 'Regular', 'User', 'user',
       (SELECT id FROM organizations WHERE slug = 'demo-org')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'user@pdfsign.com');

INSERT INTO users (email, password, first_name, last_name, role, current_organization_id) 
SELECT 'demo@pdfsign.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyWoBl0pBhOF3S', 'Demo', 'Account', 'user',
       (SELECT id FROM organizations WHERE slug = 'demo-org')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@pdfsign.com');

-- Insert organization-user relationships (idempotent)
INSERT INTO organization_users (organization_id, user_id, role)
SELECT 
  (SELECT id FROM organizations WHERE slug = 'demo-org'),
  u.id,
  CASE WHEN u.role = 'admin' THEN 'owner' ELSE 'admin' END
FROM users u
WHERE u.email IN ('admin@pdfsign.com', 'user@pdfsign.com', 'demo@pdfsign.com')
  AND NOT EXISTS (
    SELECT 1 FROM organization_users ou 
    WHERE ou.organization_id = (SELECT id FROM organizations WHERE slug = 'demo-org')
      AND ou.user_id = u.id
  );

-- Ensure unique constraint for envelope_types.name to support ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS ux_envelope_types_name ON envelope_types(name);

-- Insert envelope types
INSERT INTO envelope_types (
    name, display_name, description, icon, color, category, 
    default_expiration_days, compliance_requirements, suggested_fields, workflow_settings
) VALUES
    ('joint_venture', 'Joint Venture Agreement', 'Partnership agreements between two or more businesses', 'handshake', '#3B82F6', 'business', 60, 
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Company A Signature"}, {"type": "signature", "label": "Company B Signature"}, {"type": "date", "label": "Agreement Date"}]',
     '{"autoReminders": true, "reminderInterval": 7, "escalationPath": ["manager", "legal"]}'),
     
    ('loan_agreement', 'Loan Agreement', 'Financial lending agreements and promissory notes', 'dollar-sign', '#10B981', 'financial', 90,
     '{"requiredSignatures": 2, "witnessRequired": true, "notaryRequired": true}',
     '[{"type": "signature", "label": "Borrower Signature"}, {"type": "signature", "label": "Lender Signature"}, {"type": "currency", "label": "Loan Amount"}]',
     '{"autoReminders": true, "reminderInterval": 3, "escalationPath": ["finance", "legal"]}'),
     
    ('franchise_agreement', 'Franchise Agreement', 'Licensing agreements for franchise operations', 'store', '#8B5CF6', 'business', 45,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": true}',
     '[{"type": "signature", "label": "Franchisor Signature"}, {"type": "signature", "label": "Franchisee Signature"}, {"type": "text", "label": "Territory"}]',
     '{"autoReminders": true, "reminderInterval": 5, "escalationPath": ["operations", "legal"]}'),
     
    ('employment_contract', 'Employment Contract', 'Job offers and employment agreements', 'briefcase', '#F59E0B', 'hr', 30,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Employee Signature"}, {"type": "signature", "label": "HR Signature"}, {"type": "date", "label": "Start Date"}]',
     '{"autoReminders": true, "reminderInterval": 2, "escalationPath": ["hr", "manager"]}'),
     
    ('real_estate', 'Real Estate Purchase Agreement', 'Property buying and selling agreements', 'home', '#EF4444', 'real_estate', 45,
     '{"requiredSignatures": 2, "witnessRequired": true, "notaryRequired": true}',
     '[{"type": "signature", "label": "Buyer Signature"}, {"type": "signature", "label": "Seller Signature"}, {"type": "currency", "label": "Purchase Price"}]',
     '{"autoReminders": true, "reminderInterval": 3, "escalationPath": ["agent", "broker", "legal"]}'),
     
    ('nda', 'Non-Disclosure Agreement', 'Confidentiality and non-disclosure agreements', 'shield-check', '#6366F1', 'legal', 30,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Disclosing Party"}, {"type": "signature", "label": "Receiving Party"}, {"type": "date", "label": "Effective Date"}]',
     '{"autoReminders": true, "reminderInterval": 5, "escalationPath": ["legal"]}'),
     
    ('service_agreement', 'Service Agreement', 'Professional service contracts and consulting agreements', 'wrench', '#14B8A6', 'services', 60,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Service Provider"}, {"type": "signature", "label": "Client Signature"}, {"type": "currency", "label": "Service Fee"}]',
     '{"autoReminders": true, "reminderInterval": 7, "escalationPath": ["account_manager", "legal"]}'),
     
    ('vendor_agreement', 'Vendor/Supplier Agreement', 'Supply chain and vendor partnership contracts', 'truck', '#F97316', 'procurement', 45,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Vendor Signature"}, {"type": "signature", "label": "Procurement Signature"}, {"type": "text", "label": "Delivery Terms"}]',
     '{"autoReminders": true, "reminderInterval": 7, "escalationPath": ["procurement", "legal"]}'),
     
    ('lease_agreement', 'Lease Agreement', 'Property rental and leasing contracts', 'key', '#84CC16', 'real_estate', 60,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": true}',
     '[{"type": "signature", "label": "Landlord Signature"}, {"type": "signature", "label": "Tenant Signature"}, {"type": "currency", "label": "Monthly Rent"}]',
     '{"autoReminders": true, "reminderInterval": 5, "escalationPath": ["property_manager", "legal"]}'),
     
    ('licensing_agreement', 'Licensing Agreement', 'Intellectual property and software licensing contracts', 'file-text', '#A855F7', 'intellectual_property', 90,
     '{"requiredSignatures": 2, "witnessRequired": false, "notaryRequired": false}',
     '[{"type": "signature", "label": "Licensor Signature"}, {"type": "signature", "label": "Licensee Signature"}, {"type": "text", "label": "Licensed Property"}]',
     '{"autoReminders": true, "reminderInterval": 10, "escalationPath": ["ip_manager", "legal"]}')
ON CONFLICT (name) DO NOTHING;
