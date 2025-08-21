-- Migration 007: Smart Template AI System
-- Unique AI-powered features that differentiate us from DocuSign

-- Smart Templates - AI-powered template intelligence
CREATE TABLE IF NOT EXISTS smart_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    template_id INTEGER NOT NULL UNIQUE,
    ai_model TEXT DEFAULT 'smart-v1',
    learning_data TEXT DEFAULT '{}', -- JSON: AI learning data and patterns
    optimization_score INTEGER DEFAULT 0, -- 0-100 score for template optimization
    usage_patterns TEXT DEFAULT '{}', -- JSON: usage pattern analysis
    field_suggestions TEXT DEFAULT '[]', -- JSON: AI-suggested fields based on document analysis
    recipient_intelligence TEXT DEFAULT '{}', -- JSON: learned recipient behavior and preferences
    performance_metrics TEXT DEFAULT '{}', -- JSON: completion times, error rates, success metrics
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Collaboration - Real-time collaborative editing
CREATE TABLE IF NOT EXISTS template_collaborations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    collaboration_type TEXT DEFAULT 'edit' CHECK (collaboration_type IN ('edit', 'review', 'approve', 'view')),
    current_action TEXT DEFAULT 'idle', -- 'editing_field', 'moving_field', 'adding_role', etc.
    cursor_position TEXT DEFAULT '{}', -- JSON: current cursor/selection position
    live_changes TEXT DEFAULT '[]', -- JSON: array of real-time changes
    is_online BOOLEAN DEFAULT 1,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Dynamic Field Groups - Smart field grouping and conditional logic
CREATE TABLE IF NOT EXISTS template_field_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    template_id INTEGER NOT NULL,
    group_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_type TEXT DEFAULT 'logical' CHECK (group_type IN ('logical', 'visual', 'conditional', 'repeatable')),
    conditional_logic TEXT DEFAULT '{}', -- JSON: show/hide conditions
    styling TEXT DEFAULT '{}', -- JSON: visual styling options
    is_repeatable BOOLEAN DEFAULT 0, -- Can this group be repeated by users?
    max_repetitions INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Performance Analytics - Detailed usage analytics
CREATE TABLE IF NOT EXISTS template_performance_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL, -- 'completion_time', 'abandonment_rate', 'error_count', 'user_satisfaction'
    metric_value REAL NOT NULL,
    measurement_date DATE NOT NULL,
    user_segment TEXT DEFAULT 'all', -- 'power_users', 'new_users', 'enterprise', etc.
    device_type TEXT DEFAULT 'unknown', -- 'desktop', 'mobile', 'tablet'
    metadata TEXT DEFAULT '{}', -- JSON: additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Learning Events - Track AI learning opportunities
CREATE TABLE IF NOT EXISTS template_learning_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'field_suggestion_accepted', 'role_suggestion_used', 'optimization_applied'
    event_data TEXT NOT NULL, -- JSON: detailed event information
    confidence_score REAL DEFAULT 0.5, -- AI confidence in the suggestion
    user_feedback TEXT, -- 'helpful', 'not_helpful', 'partially_helpful'
    learning_outcome TEXT DEFAULT '{}', -- JSON: what the AI learned from this event
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Smart Role Suggestions - AI-powered role recommendations
CREATE TABLE IF NOT EXISTS smart_role_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    suggested_for_email TEXT NOT NULL,
    suggested_role TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    reasoning TEXT NOT NULL, -- Human-readable explanation
    usage_history TEXT DEFAULT '{}', -- JSON: historical usage patterns
    domain_intelligence TEXT DEFAULT '{}', -- JSON: intelligence about the email domain
    was_accepted BOOLEAN DEFAULT NULL, -- NULL = not responded, 1 = accepted, 0 = rejected
    alternative_roles TEXT DEFAULT '[]', -- JSON: array of alternative role suggestions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Automation Rules - Smart automation beyond basic workflows
CREATE TABLE IF NOT EXISTS template_automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    template_id INTEGER NOT NULL,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('field_auto_fill', 'role_auto_assign', 'document_auto_add', 'notification_smart_timing')),
    trigger_conditions TEXT NOT NULL, -- JSON: conditions that trigger the rule
    actions TEXT NOT NULL, -- JSON: actions to perform
    confidence_threshold REAL DEFAULT 0.8, -- Minimum AI confidence to trigger
    is_active BOOLEAN DEFAULT 1,
    success_rate REAL DEFAULT 0, -- Track how often the rule helps vs. hinders
    usage_count INTEGER DEFAULT 0,
    last_triggered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Optimization Suggestions - AI-generated improvement recommendations
CREATE TABLE IF NOT EXISTS template_optimization_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    suggestion_type TEXT NOT NULL, -- 'performance', 'usability', 'layout', 'workflow'
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact_description TEXT DEFAULT '',
    implementation_effort TEXT DEFAULT 'medium' CHECK (implementation_effort IN ('low', 'medium', 'high')),
    estimated_improvement TEXT DEFAULT '{}', -- JSON: estimated metrics improvement
    suggested_actions TEXT DEFAULT '[]', -- JSON: specific actions to take
    ai_confidence REAL DEFAULT 0.5,
    is_implemented BOOLEAN DEFAULT 0,
    implementation_date DATETIME,
    user_feedback TEXT, -- User's response to the suggestion
    actual_improvement TEXT DEFAULT '{}', -- JSON: measured improvement after implementation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES envelope_templates (id) ON DELETE CASCADE
);

-- Template Market Intelligence - Learn from industry patterns
CREATE TABLE IF NOT EXISTS template_market_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_category TEXT NOT NULL,
    industry_sector TEXT DEFAULT 'general',
    best_practices TEXT NOT NULL, -- JSON: industry best practices
    common_patterns TEXT NOT NULL, -- JSON: common field patterns, role distributions
    compliance_requirements TEXT DEFAULT '{}', -- JSON: industry-specific compliance needs
    optimization_benchmarks TEXT DEFAULT '{}', -- JSON: performance benchmarks
    trend_analysis TEXT DEFAULT '{}', -- JSON: emerging trends and patterns
    data_source TEXT DEFAULT 'internal', -- 'internal', 'industry_report', 'public_data'
    confidence_level REAL DEFAULT 0.5,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert market intelligence for common industries
INSERT OR IGNORE INTO template_market_intelligence (template_category, industry_sector, best_practices, common_patterns) VALUES
('real_estate', 'residential', 
 '{"field_placement": "right_margin_preferred", "signature_flow": "buyer_first_seller_second", "required_fields": ["full_legal_name", "date", "signature"]}',
 '{"average_fields": 8, "completion_time": 240, "role_distribution": {"buyer": 0.4, "seller": 0.4, "agent": 0.15, "witness": 0.05}}'),
('business', 'technology', 
 '{"digital_signature_preference": "high", "mobile_optimization": "critical", "security_requirements": "enhanced"}',
 '{"average_fields": 12, "completion_time": 180, "role_distribution": {"signatory": 0.6, "approver": 0.25, "legal": 0.15}}'),
('hr', 'general', 
 '{"privacy_compliance": "required", "employee_self_service": "preferred", "audit_trail": "mandatory"}',
 '{"average_fields": 15, "completion_time": 300, "role_distribution": {"employee": 0.5, "hr": 0.3, "manager": 0.2}}');

-- Add Smart Template reference to envelope_templates
ALTER TABLE envelope_templates ADD COLUMN smart_template_enabled BOOLEAN DEFAULT 1;
ALTER TABLE envelope_templates ADD COLUMN ai_optimization_level TEXT DEFAULT 'basic' CHECK (ai_optimization_level IN ('basic', 'standard', 'advanced', 'enterprise'));

-- Update template_fields to support smart features
ALTER TABLE template_fields ADD COLUMN ai_suggested BOOLEAN DEFAULT 0;
ALTER TABLE template_fields ADD COLUMN confidence_score REAL DEFAULT 1.0;
ALTER TABLE template_fields ADD COLUMN auto_positioning BOOLEAN DEFAULT 0;
ALTER TABLE template_fields ADD COLUMN smart_validation TEXT DEFAULT '{}'; -- JSON: AI-powered validation rules

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_templates_template_id ON smart_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_template_collaborations_template_id ON template_collaborations(template_id);
CREATE INDEX IF NOT EXISTS idx_template_collaborations_session ON template_collaborations(template_id, session_id);
CREATE INDEX IF NOT EXISTS idx_template_field_groups_template_id ON template_field_groups(template_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_analytics_template_id ON template_performance_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_analytics_date ON template_performance_analytics(measurement_date);
CREATE INDEX IF NOT EXISTS idx_template_learning_events_template_id ON template_learning_events(template_id);
CREATE INDEX IF NOT EXISTS idx_smart_role_suggestions_template_id ON smart_role_suggestions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_automation_rules_template_id ON template_automation_rules(template_id);
CREATE INDEX IF NOT EXISTS idx_template_optimization_suggestions_template_id ON template_optimization_suggestions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_market_intelligence_category ON template_market_intelligence(template_category, industry_sector);
