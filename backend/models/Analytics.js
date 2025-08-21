const db = require('./database');

class Analytics {
    // Track user events
    static async trackUserEvent(userId, eventType, eventData = {}, ipAddress = null, userAgent = null) {
        try {
            const query = `
                INSERT INTO user_analytics (user_id, event_type, event_data, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const stmt = db.prepare(query);
            const result = stmt.run(
                userId,
                eventType,
                JSON.stringify(eventData),
                ipAddress,
                userAgent
            );
            
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            console.error('Error tracking user event:', error);
            return { success: false, error: error.message };
        }
    }

    // Track document actions
    static async trackDocumentAction(documentId, userId, action, metadata = {}, ipAddress = null, sessionId = null) {
        try {
            const query = `
                INSERT INTO document_analytics (document_id, user_id, action, metadata, ip_address, session_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const stmt = db.prepare(query);
            const result = stmt.run(
                documentId,
                userId,
                action,
                JSON.stringify(metadata),
                ipAddress,
                sessionId
            );
            
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            console.error('Error tracking document action:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user dashboard metrics
    static async getUserDashboardMetrics(userId) {
        try {
            // Total documents
            const totalDocsQuery = `
                SELECT COUNT(*) as total_documents
                FROM documents 
                WHERE user_id = ?
            `;
            const totalDocs = db.prepare(totalDocsQuery).get(userId);

            // Documents this month
            const thisMonthQuery = `
                SELECT COUNT(*) as documents_this_month
                FROM documents 
                WHERE user_id = ? 
                AND created_at >= date('now', 'start of month')
            `;
            const thisMonth = db.prepare(thisMonthQuery).get(userId);

            // Pending signatures (documents with fields but no signatures)
            const pendingQuery = `
                SELECT COUNT(DISTINCT d.id) as pending_signatures
                FROM documents d
                INNER JOIN document_fields df ON d.id = df.document_id
                LEFT JOIN document_analytics da ON d.id = da.document_id AND da.action = 'signed'
                WHERE d.user_id = ? AND da.id IS NULL
            `;
            const pending = db.prepare(pendingQuery).get(userId);

            // Completion rate (documents with signatures / documents with fields)
            const completionQuery = `
                SELECT 
                    COUNT(DISTINCT CASE WHEN da.action = 'signed' THEN d.id END) as completed,
                    COUNT(DISTINCT d.id) as total_with_fields
                FROM documents d
                INNER JOIN document_fields df ON d.id = df.document_id
                LEFT JOIN document_analytics da ON d.id = da.document_id AND da.action = 'signed'
                WHERE d.user_id = ?
            `;
            const completion = db.prepare(completionQuery).get(userId);

            // Recent activity
            const activityQuery = `
                SELECT 
                    da.action,
                    da.timestamp,
                    d.title as document_title,
                    d.id as document_id
                FROM document_analytics da
                INNER JOIN documents d ON da.document_id = d.id
                WHERE da.user_id = ?
                ORDER BY da.timestamp DESC
                LIMIT 10
            `;
            const recentActivity = db.prepare(activityQuery).all(userId);

            // Format activity for display
            const formattedActivity = recentActivity.map(activity => ({
                id: `${activity.document_id}-${activity.timestamp}`,
                type: activity.action,
                title: this.getActivityTitle(activity.action, activity.document_title),
                description: this.getActivityDescription(activity.action, activity.document_title),
                timestamp: new Date(activity.timestamp),
                documentId: activity.document_id
            }));

            const completionRate = completion.total_with_fields > 0 
                ? Math.round((completion.completed / completion.total_with_fields) * 100)
                : 0;

            return {
                success: true,
                metrics: {
                    totalDocuments: totalDocs.total_documents || 0,
                    documentsThisMonth: thisMonth.documents_this_month || 0,
                    pendingSignatures: pending.pending_signatures || 0,
                    completionRate: completionRate,
                    recentActivity: formattedActivity
                }
            };
        } catch (error) {
            console.error('Error getting dashboard metrics:', error);
            return { success: false, error: error.message };
        }
    }

    // Get system-wide analytics (for admin users)
    static async getSystemAnalytics() {
        try {
            // Total users
            const totalUsersQuery = `SELECT COUNT(*) as total_users FROM users`;
            const totalUsers = db.prepare(totalUsersQuery).get();

            // Active users (last 30 days)
            const activeUsersQuery = `
                SELECT COUNT(DISTINCT user_id) as active_users
                FROM user_analytics
                WHERE timestamp >= datetime('now', '-30 days')
            `;
            const activeUsers = db.prepare(activeUsersQuery).get();

            // Total documents
            const totalDocsQuery = `SELECT COUNT(*) as total_documents FROM documents`;
            const totalDocs = db.prepare(totalDocsQuery).get();

            // Documents created this month
            const docsThisMonthQuery = `
                SELECT COUNT(*) as documents_this_month
                FROM documents
                WHERE created_at >= date('now', 'start of month')
            `;
            const docsThisMonth = db.prepare(docsThisMonthQuery).get();

            // Signatures this month
            const signaturesThisMonthQuery = `
                SELECT COUNT(*) as signatures_this_month
                FROM document_analytics
                WHERE action = 'signed' AND timestamp >= date('now', 'start of month')
            `;
            const signaturesThisMonth = db.prepare(signaturesThisMonthQuery).get();

            // Daily activity for last 30 days
            const dailyActivityQuery = `
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as activity_count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM user_analytics
                WHERE timestamp >= datetime('now', '-30 days')
                GROUP BY DATE(timestamp)
                ORDER BY date
            `;
            const dailyActivity = db.prepare(dailyActivityQuery).all();

            return {
                success: true,
                analytics: {
                    totalUsers: totalUsers.total_users || 0,
                    activeUsers: activeUsers.active_users || 0,
                    totalDocuments: totalDocs.total_documents || 0,
                    documentsThisMonth: docsThisMonth.documents_this_month || 0,
                    signaturesThisMonth: signaturesThisMonth.signatures_this_month || 0,
                    dailyActivity: dailyActivity
                }
            };
        } catch (error) {
            console.error('Error getting system analytics:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user dashboard widget configuration
    static async getUserDashboardWidgets(userId) {
        try {
            const query = `
                SELECT 
                    widget_type,
                    widget_config,
                    position_x,
                    position_y,
                    width,
                    height,
                    is_visible
                FROM dashboard_widgets
                WHERE user_id = ?
                ORDER BY position_y, position_x
            `;
            
            const widgets = db.prepare(query).all(userId);
            
            return {
                success: true,
                widgets: widgets.map(widget => ({
                    type: widget.widget_type,
                    config: widget.widget_config ? JSON.parse(widget.widget_config) : {},
                    position: {
                        x: widget.position_x,
                        y: widget.position_y
                    },
                    size: {
                        width: widget.width,
                        height: widget.height
                    },
                    visible: Boolean(widget.is_visible)
                }))
            };
        } catch (error) {
            console.error('Error getting dashboard widgets:', error);
            return { success: false, error: error.message };
        }
    }

    // Update dashboard widget configuration
    static async updateDashboardWidget(userId, widgetType, config) {
        try {
            const query = `
                UPDATE dashboard_widgets
                SET 
                    widget_config = ?,
                    position_x = ?,
                    position_y = ?,
                    width = ?,
                    height = ?,
                    is_visible = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND widget_type = ?
            `;
            
            const stmt = db.prepare(query);
            const result = stmt.run(
                JSON.stringify(config.config || {}),
                config.position?.x || 0,
                config.position?.y || 0,
                config.size?.width || 1,
                config.size?.height || 1,
                config.visible !== false ? 1 : 0,
                userId,
                widgetType
            );
            
            return { success: true, changes: result.changes };
        } catch (error) {
            console.error('Error updating dashboard widget:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper methods for activity formatting
    static getActivityTitle(action, documentTitle) {
        const actions = {
            'created': 'Document Created',
            'viewed': 'Document Viewed',
            'edited': 'Document Edited',
            'signed': 'Document Signed',
            'downloaded': 'Document Downloaded',
            'shared': 'Document Shared'
        };
        
        return actions[action] || 'Document Activity';
    }

    static getActivityDescription(action, documentTitle) {
        const actions = {
            'created': `Created "${documentTitle}"`,
            'viewed': `Viewed "${documentTitle}"`,
            'edited': `Edited "${documentTitle}"`,
            'signed': `Signed "${documentTitle}"`,
            'downloaded': `Downloaded "${documentTitle}"`,
            'shared': `Shared "${documentTitle}"`
        };
        
        return actions[action] || `Activity on "${documentTitle}"`;
    }

    // Record system metrics (for background tasks)
    static async recordSystemMetric(metricName, metricValue, additionalData = {}) {
        try {
            const query = `
                INSERT INTO system_metrics (metric_name, metric_value, metric_date, additional_data)
                VALUES (?, ?, DATE('now'), ?)
                ON CONFLICT(metric_name, metric_date) 
                DO UPDATE SET 
                    metric_value = excluded.metric_value,
                    additional_data = excluded.additional_data,
                    recorded_at = CURRENT_TIMESTAMP
            `;
            
            const stmt = db.prepare(query);
            const result = stmt.run(
                metricName,
                metricValue,
                JSON.stringify(additionalData)
            );
            
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            console.error('Error recording system metric:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = Analytics;
