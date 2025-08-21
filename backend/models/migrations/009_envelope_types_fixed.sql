-- Migration 009: Envelope Types System (Fixed)
-- Adds predefined envelope types for better categorization and workflow management

-- Envelope Types - Predefined categories for different types of agreements
CREATE TABLE IF NOT EXISTS envelope_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    color TEXT DEFAULT '#3B82F6',
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    default_expiration_days INTEGER DEFAULT 30,
    requires_witness BOOLEAN DEFAULT 0,
    requires_notary BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined envelope types
INSERT OR IGNORE INTO envelope_types (name, display_name, description, icon, color, category, sort_order) VALUES
-- Business & Partnership
('joint_venture_agreement', 'Joint Venture Agreement', 'Joint business venture partnerships', '🤝', '#8B5CF6', 'partnership', 1),
('franchise_agreement', 'Franchise Agreement', 'Franchise licensing and operations', '🏪', '#F59E0B', 'partnership', 2),
('partnership_agreement', 'Partnership Agreement', 'Business partnership contracts', '🤝', '#DC2626', 'partnership', 3),
('merger_agreement', 'Merger & Acquisition Agreement', 'Business merger and acquisition contracts', '🔄', '#DC2626', 'partnership', 4),

-- Financial
('loan_agreement', 'Loan Agreement', 'Personal and business loan documents', '💰', '#DC2626', 'financial', 10),
('promissory_note', 'Promissory Note', 'Debt and payment promise documents', '📋', '#EF4444', 'financial', 11),
('mortgage_agreement', 'Mortgage Agreement', 'Home mortgage and refinancing documents', '🏠', '#3B82F6', 'financial', 12),
('credit_agreement', 'Credit Agreement', 'Credit line and financing agreements', '💳', '#059669', 'financial', 13),
('guaranty_agreement', 'Guaranty Agreement', 'Personal and corporate guarantees', '🛡️', '#6366F1', 'financial', 14),
('security_agreement', 'Security Agreement', 'Collateral and security interest documents', '🔒', '#7C3AED', 'financial', 15),
('investment_agreement', 'Investment Agreement', 'Investment and funding contracts', '📈', '#7C3AED', 'financial', 16),

-- Legal Documents
('non_disclosure_agreement', 'Non-Disclosure Agreement (NDA)', 'Confidentiality agreements', '🔒', '#DC2626', 'legal', 20),
('service_agreement', 'Service Agreement', 'Professional services contracts', '🤝', '#059669', 'legal', 21),
('consulting_agreement', 'Consulting Agreement', 'Independent contractor agreements', '💼', '#7C3AED', 'legal', 22),
('power_of_attorney', 'Power of Attorney', 'Legal authorization documents', '⚖️', '#DC2626', 'legal', 23),
('settlement_agreement', 'Settlement Agreement', 'Legal dispute resolutions', '🤝', '#059669', 'legal', 24),
('release_agreement', 'Release Agreement', 'Legal release and waiver documents', '📋', '#6B7280', 'legal', 25),
('contract_amendment', 'Contract Amendment', 'Modifications to existing contracts', '✏️', '#7C3AED', 'legal', 26),

-- HR & Employment
('employment_contract', 'Employment Contract', 'New employee hiring agreements', '👔', '#3B82F6', 'hr', 30),
('offer_letter', 'Job Offer Letter', 'Employment offer acceptance', '📄', '#10B981', 'hr', 31),
('non_compete_agreement', 'Non-Compete Agreement', 'Employee non-compete and non-solicitation', '🚫', '#EF4444', 'hr', 32),
('stock_option_agreement', 'Stock Option Agreement', 'Employee stock options and equity', '📈', '#10B981', 'hr', 33),
('severance_agreement', 'Severance Agreement', 'Employment separation and benefits', '📄', '#DC2626', 'hr', 34),
('performance_review', 'Performance Review', 'Employee evaluation documents', '📊', '#F59E0B', 'hr', 35),
('termination_agreement', 'Termination Agreement', 'Employment separation documents', '📋', '#EF4444', 'hr', 36),
('employee_handbook', 'Employee Handbook Acknowledgment', 'Company policy acknowledgments', '📖', '#3B82F6', 'hr', 37),

-- Real Estate
('purchase_agreement', 'Real Estate Purchase Agreement', 'Property buying/selling contracts', '🏠', '#059669', 'real_estate', 40),
('lease_agreement', 'Lease Agreement', 'Rental property contracts', '🏘️', '#3B82F6', 'real_estate', 41),
('rental_agreement', 'Rental Agreement', 'Short-term rental properties', '🏘️', '#F59E0B', 'real_estate', 42),
('property_management_agreement', 'Property Management Agreement', 'Property management services', '🏢', '#7C3AED', 'real_estate', 43),
('construction_contract', 'Construction Contract', 'Building and construction agreements', '🏗️', '#F59E0B', 'real_estate', 44),
('property_disclosure', 'Property Disclosure', 'Property condition disclosures', '📝', '#F59E0B', 'real_estate', 45),

-- Sales & Marketing
('sales_contract', 'Sales Contract', 'Product/service sales agreements', '💼', '#10B981', 'sales', 50),
('distribution_agreement', 'Distribution Agreement', 'Product distribution and reseller contracts', '📦', '#10B981', 'sales', 51),
('commission_agreement', 'Commission Agreement', 'Sales commission and affiliate contracts', '💰', '#10B981', 'sales', 52),
('marketing_agreement', 'Marketing Agreement', 'Advertising and promotion contracts', '📢', '#F59E0B', 'sales', 53),
('reseller_agreement', 'Reseller Agreement', 'Product reselling partnerships', '🔄', '#7C3AED', 'sales', 54),
('vendor_agreement', 'Vendor Agreement', 'Supplier and vendor contracts', '🏪', '#7C3AED', 'sales', 55),

-- Technology
('software_license', 'Software License Agreement', 'Software licensing contracts', '💻', '#6366F1', 'technology', 60),
('saas_agreement', 'SaaS Agreement', 'Software as a Service subscriptions', '☁️', '#10B981', 'technology', 61),
('api_agreement', 'API Agreement', 'API access and integration contracts', '🔗', '#6366F1', 'technology', 62),
('hosting_agreement', 'Hosting Agreement', 'Web hosting and server agreements', '🌐', '#3B82F6', 'technology', 63),
('licensing_agreement', 'Licensing Agreement', 'Intellectual property licensing', '🔑', '#7C3AED', 'technology', 64),
('data_processing_agreement', 'Data Processing Agreement', 'GDPR and data handling agreements', '🔐', '#DC2626', 'technology', 65),

-- Healthcare
('patient_consent', 'Patient Consent Form', 'Medical treatment consent', '🏥', '#EF4444', 'healthcare', 70),
('hipaa_authorization', 'HIPAA Authorization', 'Health information release forms', '🔐', '#DC2626', 'healthcare', 71),
('medical_release', 'Medical Release Form', 'Medical information release authorization', '🏥', '#DC2626', 'healthcare', 72),
('treatment_consent', 'Treatment Consent', 'Medical treatment authorization', '💊', '#EF4444', 'healthcare', 73),

-- Insurance
('insurance_policy', 'Insurance Policy', 'Insurance coverage agreements', '🛡️', '#059669', 'financial', 80),
('liability_waiver', 'Liability Waiver', 'Activity and service liability waivers', '⚠️', '#EF4444', 'general', 81),

-- Education
('enrollment_form', 'Enrollment Form', 'Student enrollment and registration', '🎓', '#F59E0B', 'education', 90),
('tuition_agreement', 'Tuition Agreement', 'Educational payment agreements', '📚', '#3B82F6', 'education', 91),

-- General
('general_contract', 'General Contract', 'Miscellaneous agreements', '📄', '#6B7280', 'general', 100),
('waiver_form', 'Waiver Form', 'Liability waivers and releases', '⚠️', '#EF4444', 'general', 101),
('authorization_form', 'Authorization Form', 'General authorization documents', '✅', '#10B981', 'general', 102),
('application_form', 'Application Form', 'Various application forms', '📝', '#3B82F6', 'general', 103),
('consent_form', 'Consent Form', 'Permission and consent documents', '✅', '#10B981', 'general', 104);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_envelope_types_category ON envelope_types(category);
CREATE INDEX IF NOT EXISTS idx_envelope_types_active ON envelope_types(is_active);
CREATE INDEX IF NOT EXISTS idx_envelope_types_sort ON envelope_types(sort_order);
