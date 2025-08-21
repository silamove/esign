-- Migration 009: Envelope Types System
-- Adds predefined envelope types for better categorization and workflow management

-- Envelope Types - Predefined categories for different types of agreements
CREATE TABLE IF NOT EXISTS envelope_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL, -- Internal name (e.g., 'employment_contract')
    display_name TEXT NOT NULL, -- User-friendly name (e.g., 'Employment Contract')
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '', -- Icon class or emoji for UI
    color TEXT DEFAULT '#3B82F6', -- Color hex code for UI theming
    category TEXT DEFAULT 'general' CHECK (category IN (
        'legal', 'hr', 'real_estate', 'financial', 'healthcare', 'education', 
        'technology', 'sales', 'procurement', 'partnership', 'general'
    )),
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    default_expiration_days INTEGER DEFAULT 30, -- Default expiration for this type
    requires_witness BOOLEAN DEFAULT 0, -- Whether this type typically requires witnesses
    requires_notary BOOLEAN DEFAULT 0, -- Whether this type typically requires notarization
    compliance_requirements TEXT DEFAULT '{}', -- JSON: GDPR, HIPAA, SOX compliance needs
    suggested_fields TEXT DEFAULT '[]', -- JSON: commonly used fields for this type
    workflow_settings TEXT DEFAULT '{}', -- JSON: default routing, reminders, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add envelope_type_id to envelopes table (if not exists)
ALTER TABLE envelopes ADD COLUMN envelope_type_id INTEGER REFERENCES envelope_types(id);

-- Add envelope_type_id to envelope_templates table (if not exists)
ALTER TABLE envelope_templates ADD COLUMN envelope_type_id INTEGER REFERENCES envelope_types(id);

-- Insert predefined envelope types
INSERT INTO envelope_types (name, display_name, description, icon, color, category, default_expiration_days, requires_witness, requires_notary, suggested_fields, workflow_settings) VALUES

-- Legal Documents
('non_disclosure_agreement', 'Non-Disclosure Agreement (NDA)', 'Confidentiality agreements between parties', '🔒', '#DC2626', 'legal', 90, 0, 0, '["signature", "date", "full_name", "company", "title"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('service_agreement', 'Service Agreement', 'Professional services contracts', '🤝', '#059669', 'legal', 365, 0, 0, '["signature", "date", "full_name", "company", "email", "phone"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('consulting_agreement', 'Consulting Agreement', 'Independent contractor agreements', '💼', '#7C3AED', 'legal', 365, 0, 0, '["signature", "date", "full_name", "ssn", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('partnership_agreement', 'Partnership Agreement', 'Business partnership contracts', '🤝', '#DC2626', 'partnership', 365, 1, 1, '["signature", "initial", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- HR & Employment
('employment_contract', 'Employment Contract', 'New employee hiring agreements', '👔', '#3B82F6', 'hr', 180, 0, 0, '["signature", "date", "full_name", "ssn", "address", "email", "phone", "title"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('offer_letter', 'Job Offer Letter', 'Employment offer acceptance', '📄', '#10B981', 'hr', 14, 0, 0, '["signature", "date", "full_name", "email", "phone"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('performance_review', 'Performance Review', 'Employee evaluation documents', '📊', '#F59E0B', 'hr', 30, 0, 0, '["signature", "date", "full_name", "title", "text"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('termination_agreement', 'Termination Agreement', 'Employment separation documents', '📋', '#EF4444', 'hr', 30, 1, 0, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Real Estate
('purchase_agreement', 'Real Estate Purchase Agreement', 'Property buying/selling contracts', '🏠', '#059669', 'real_estate', 60, 1, 1, '["signature", "initial", "date", "full_name", "address", "email", "phone"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('lease_agreement', 'Lease Agreement', 'Rental property contracts', '🏘️', '#3B82F6', 'real_estate', 90, 0, 0, '["signature", "date", "full_name", "address", "email", "phone"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('property_disclosure', 'Property Disclosure', 'Property condition disclosures', '📝', '#F59E0B', 'real_estate', 30, 0, 0, '["signature", "date", "full_name", "checkbox"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Financial
('loan_agreement', 'Loan Agreement', 'Lending and borrowing contracts', '💰', '#DC2626', 'financial', 180, 1, 1, '["signature", "initial", "date", "full_name", "ssn", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('investment_agreement', 'Investment Agreement', 'Investment and funding contracts', '📈', '#7C3AED', 'financial', 90, 1, 1, '["signature", "initial", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('bank_authorization', 'Bank Authorization', 'Banking and payment authorizations', '🏦', '#059669', 'financial', 365, 0, 0, '["signature", "date", "full_name", "ssn"]', '{"routing_order": "parallel", "reminders": "daily"}'),

-- Healthcare
('patient_consent', 'Patient Consent Form', 'Medical treatment consent', '🏥', '#EF4444', 'healthcare', 365, 0, 0, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('hipaa_authorization', 'HIPAA Authorization', 'Health information release forms', '🔐', '#DC2626', 'healthcare', 365, 0, 0, '["signature", "date", "full_name", "ssn"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Sales & Procurement
('sales_contract', 'Sales Contract', 'Product/service sales agreements', '💼', '#10B981', 'sales', 60, 0, 0, '["signature", "date", "full_name", "company", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('purchase_order', 'Purchase Order', 'Procurement and ordering documents', '📦', '#3B82F6', 'procurement', 30, 0, 0, '["signature", "date", "full_name", "company", "title"]', '{"routing_order": "parallel", "reminders": "daily"}'),
('vendor_agreement', 'Vendor Agreement', 'Supplier and vendor contracts', '🏪', '#7C3AED', 'procurement', 365, 0, 0, '["signature", "date", "full_name", "company", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Technology
('software_license', 'Software License Agreement', 'Software licensing contracts', '💻', '#6366F1', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('data_processing_agreement', 'Data Processing Agreement', 'GDPR and data handling agreements', '🔐', '#DC2626', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "title"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Education
('enrollment_form', 'Enrollment Form', 'Student enrollment and registration', '🎓', '#F59E0B', 'education', 90, 0, 0, '["signature", "date", "full_name", "address", "email", "phone"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('tuition_agreement', 'Tuition Agreement', 'Educational payment agreements', '📚', '#3B82F6', 'education', 180, 0, 0, '["signature", "date", "full_name", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- General
('general_contract', 'General Contract', 'Miscellaneous agreements', '📄', '#6B7280', 'general', 60, 0, 0, '["signature", "date", "full_name"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('waiver_form', 'Waiver Form', 'Liability waivers and releases', '⚠️', '#EF4444', 'general', 365, 1, 0, '["signature", "date", "full_name", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('authorization_form', 'Authorization Form', 'General authorization documents', '✅', '#10B981', 'general', 90, 0, 0, '["signature", "date", "full_name"]', '{"routing_order": "parallel", "reminders": "weekly"}'),

-- Additional Business & Partnership Documents
('joint_venture_agreement', 'Joint Venture Agreement', 'Joint business venture partnerships', '🤝', '#8B5CF6', 'partnership', 365, 1, 1, '["signature", "initial", "date", "full_name", "company", "title", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('franchise_agreement', 'Franchise Agreement', 'Franchise licensing and operations', '🏪', '#F59E0B', 'partnership', 365, 1, 1, '["signature", "initial", "date", "full_name", "company", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('distribution_agreement', 'Distribution Agreement', 'Product distribution and reseller contracts', '📦', '#10B981', 'sales', 365, 0, 0, '["signature", "date", "full_name", "company", "address", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('licensing_agreement', 'Licensing Agreement', 'Intellectual property licensing', '🔑', '#7C3AED', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "title"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('merger_agreement', 'Merger & Acquisition Agreement', 'Business merger and acquisition contracts', '🔄', '#DC2626', 'partnership', 180, 1, 1, '["signature", "initial", "date", "full_name", "company", "title"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Additional Financial Documents
('promissory_note', 'Promissory Note', 'Debt and payment promise documents', '📋', '#EF4444', 'financial', 365, 1, 1, '["signature", "date", "full_name", "address", "ssn"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('mortgage_agreement', 'Mortgage Agreement', 'Home mortgage and refinancing documents', '🏠', '#3B82F6', 'financial', 180, 1, 1, '["signature", "initial", "date", "full_name", "address", "ssn", "email"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('credit_agreement', 'Credit Agreement', 'Credit line and financing agreements', '💳', '#059669', 'financial', 365, 0, 1, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('guaranty_agreement', 'Guaranty Agreement', 'Personal and corporate guarantees', '🛡️', '#6366F1', 'financial', 365, 1, 1, '["signature", "initial", "date", "full_name", "address", "ssn"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('security_agreement', 'Security Agreement', 'Collateral and security interest documents', '🔒', '#7C3AED', 'financial', 365, 1, 1, '["signature", "initial", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Additional HR & Employment Documents
('non_compete_agreement', 'Non-Compete Agreement', 'Employee non-compete and non-solicitation', '🚫', '#EF4444', 'hr', 365, 0, 0, '["signature", "date", "full_name", "title", "company"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('stock_option_agreement', 'Stock Option Agreement', 'Employee stock options and equity', '📈', '#10B981', 'hr', 365, 0, 0, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('severance_agreement', 'Severance Agreement', 'Employment separation and benefits', '📄', '#DC2626', 'hr', 60, 0, 0, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('employee_handbook', 'Employee Handbook Acknowledgment', 'Company policy acknowledgments', '📖', '#3B82F6', 'hr', 365, 0, 0, '["signature", "date", "full_name", "title"]', '{"routing_order": "parallel", "reminders": "weekly"}'),

-- Additional Real Estate Documents
('rental_agreement', 'Rental Agreement', 'Short-term rental properties', '🏘️', '#F59E0B', 'real_estate', 30, 0, 0, '["signature", "date", "full_name", "address", "email", "phone"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('property_management_agreement', 'Property Management Agreement', 'Property management services', '🏢', '#7C3AED', 'real_estate', 365, 0, 0, '["signature", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('construction_contract', 'Construction Contract', 'Building and construction agreements', '🏗️', '#F59E0B', 'real_estate', 180, 1, 0, '["signature", "initial", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Additional Legal Documents
('power_of_attorney', 'Power of Attorney', 'Legal authorization documents', '⚖️', '#DC2626', 'legal', 365, 1, 1, '["signature", "date", "full_name", "address", "ssn"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('settlement_agreement', 'Settlement Agreement', 'Legal dispute resolutions', '🤝', '#059669', 'legal', 90, 1, 1, '["signature", "initial", "date", "full_name", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('release_agreement', 'Release Agreement', 'Legal release and waiver documents', '📋', '#6B7280', 'legal', 365, 1, 0, '["signature", "date", "full_name", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('contract_amendment', 'Contract Amendment', 'Modifications to existing contracts', '✏️', '#7C3AED', 'legal', 60, 0, 0, '["signature", "date", "full_name", "title"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Additional Technology Documents
('saas_agreement', 'SaaS Agreement', 'Software as a Service subscriptions', '☁️', '#10B981', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('api_agreement', 'API Agreement', 'API access and integration contracts', '🔗', '#6366F1', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "title"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('hosting_agreement', 'Hosting Agreement', 'Web hosting and server agreements', '🌐', '#3B82F6', 'technology', 365, 0, 0, '["signature", "date", "full_name", "company", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Additional Insurance Documents
('insurance_policy', 'Insurance Policy', 'Insurance coverage agreements', '🛡️', '#059669', 'financial', 365, 0, 0, '["signature", "date", "full_name", "address", "ssn"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('liability_waiver', 'Liability Waiver', 'Activity and service liability waivers', '⚠️', '#EF4444', 'general', 365, 1, 0, '["signature", "date", "full_name", "address", "phone"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Additional Sales & Marketing Documents
('commission_agreement', 'Commission Agreement', 'Sales commission and affiliate contracts', '💰', '#10B981', 'sales', 365, 0, 0, '["signature", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('marketing_agreement', 'Marketing Agreement', 'Advertising and promotion contracts', '📢', '#F59E0B', 'sales', 180, 0, 0, '["signature", "date", "full_name", "company", "email"]', '{"routing_order": "sequential", "reminders": "weekly"}'),
('reseller_agreement', 'Reseller Agreement', 'Product reselling partnerships', '🔄', '#7C3AED', 'sales', 365, 0, 0, '["signature", "date", "full_name", "company", "address"]', '{"routing_order": "sequential", "reminders": "weekly"}'),

-- Additional Healthcare Documents
('medical_release', 'Medical Release Form', 'Medical information release authorization', '🏥', '#DC2626', 'healthcare', 365, 0, 0, '["signature", "date", "full_name", "ssn", "address"]', '{"routing_order": "sequential", "reminders": "daily"}'),
('treatment_consent', 'Treatment Consent', 'Medical treatment authorization', '💊', '#EF4444', 'healthcare', 180, 0, 0, '["signature", "date", "full_name", "address", "phone"]', '{"routing_order": "sequential", "reminders": "daily"}'),

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_envelope_types_category ON envelope_types(category);
CREATE INDEX IF NOT EXISTS idx_envelope_types_active ON envelope_types(is_active);
CREATE INDEX IF NOT EXISTS idx_envelopes_type ON envelopes(envelope_type_id);
CREATE INDEX IF NOT EXISTS idx_envelope_templates_type ON envelope_templates(envelope_type_id);
