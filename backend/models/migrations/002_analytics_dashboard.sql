-- Analytics and Dashboard Enhancement Migration
-- Version: 2.0.0
-- Description: Add analytics tables and enhanced dashboard functionality

-- User analytics for tracking user behavior
CREATE TABLE IF NOT EXISTS user_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'login', 'document_upload', 'signature_created', 'dashboard_view'
    event_data TEXT, -- JSON string for additional event data
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Document analytics for tracking document interactions
CREATE TABLE IF NOT EXISTS document_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'created', 'viewed', 'edited', 'signed', 'downloaded', 'shared'
    metadata TEXT, -- JSON string for action-specific data
    ip_address TEXT,
    session_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System metrics for overall platform analytics
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL, -- 'active_users', 'total_documents', 'signatures_today'
    metric_value REAL NOT NULL,
    metric_date DATE NOT NULL,
    additional_data TEXT, -- JSON string for extra metric data
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widgets configuration per user
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    widget_type TEXT NOT NULL, -- 'recent_documents', 'quick_stats', 'activity_feed', 'chart_completion_rate'
    widget_config TEXT, -- JSON string for widget configuration
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_time ON user_analytics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_event_type ON user_analytics(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doc_analytics_document ON document_analytics(document_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doc_analytics_user_action ON document_analytics(user_id, action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_doc_analytics_time ON document_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_date ON system_metrics(metric_date DESC, metric_name);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_id);

-- Insert default dashboard widgets for existing users
INSERT OR IGNORE INTO dashboard_widgets (user_id, widget_type, position_x, position_y, width, height)
SELECT 
    id as user_id,
    'quick_stats' as widget_type,
    0 as position_x,
    0 as position_y,
    2 as width,
    1 as height
FROM users;

INSERT OR IGNORE INTO dashboard_widgets (user_id, widget_type, position_x, position_y, width, height)
SELECT 
    id as user_id,
    'recent_documents' as widget_type,
    2 as position_x,
    0 as position_y,
    2 as width,
    2 as height
FROM users;

INSERT OR IGNORE INTO dashboard_widgets (user_id, widget_type, position_x, position_y, width, height)
SELECT 
    id as user_id,
    'activity_feed' as widget_type,
    0 as position_x,
    1 as position_y,
    2 as width,
    2 as height
FROM users;

INSERT OR IGNORE INTO dashboard_widgets (user_id, widget_type, position_x, position_y, width, height)
SELECT 
    id as user_id,
    'chart_completion_rate' as widget_type,
    2 as position_x,
    2 as position_y,
    2 as width,
    1 as height
FROM users;
