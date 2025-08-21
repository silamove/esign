const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const { authMiddleware } = require('../middleware/auth');

// Get user dashboard metrics
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const result = await Analytics.getUserDashboardMetrics(req.user.id);
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to fetch dashboard metrics',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.metrics
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Get user dashboard widgets configuration
router.get('/dashboard/widgets', authMiddleware, async (req, res) => {
    try {
        const result = await Analytics.getUserDashboardWidgets(req.user.id);
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to fetch dashboard widgets',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.widgets
        });
    } catch (error) {
        console.error('Dashboard widgets error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Update dashboard widget configuration
router.put('/dashboard/widgets/:widgetType', authMiddleware, async (req, res) => {
    try {
        const { widgetType } = req.params;
        const widgetConfig = req.body;
        
        const result = await Analytics.updateDashboardWidget(req.user.id, widgetType, widgetConfig);
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to update dashboard widget',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            message: 'Widget configuration updated',
            changes: result.changes
        });
    } catch (error) {
        console.error('Update widget error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Track user event
router.post('/track/user', authMiddleware, async (req, res) => {
    try {
        const { eventType, eventData } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        const result = await Analytics.trackUserEvent(
            req.user.id,
            eventType,
            eventData,
            ipAddress,
            userAgent
        );
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to track user event',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            message: 'Event tracked successfully'
        });
    } catch (error) {
        console.error('Track user event error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Track document action
router.post('/track/document', authMiddleware, async (req, res) => {
    try {
        const { documentId, action, metadata } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const sessionId = req.sessionID || req.get('X-Session-ID');
        
        const result = await Analytics.trackDocumentAction(
            documentId,
            req.user.id,
            action,
            metadata,
            ipAddress,
            sessionId
        );
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to track document action',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            message: 'Document action tracked successfully'
        });
    } catch (error) {
        console.error('Track document action error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Get system analytics (admin only)
router.get('/system', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin privileges required'
            });
        }
        
        const result = await Analytics.getSystemAnalytics();
        
        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to fetch system analytics',
                details: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.analytics
        });
    } catch (error) {
        console.error('System analytics error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Get user activity summary
router.get('/user/activity', auth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysNum = Math.min(Math.max(parseInt(days), 1), 365); // Limit between 1-365 days
        
        const query = `
            SELECT 
                DATE(timestamp) as date,
                event_type,
                COUNT(*) as count
            FROM user_analytics
            WHERE user_id = ? 
                AND timestamp >= datetime('now', '-${daysNum} days')
            GROUP BY DATE(timestamp), event_type
            ORDER BY date DESC, event_type
        `;
        
        const db = require('../models/database');
        const activities = db.prepare(query).all(req.user.id);
        
        // Group by date
        const groupedActivity = activities.reduce((acc, activity) => {
            if (!acc[activity.date]) {
                acc[activity.date] = {};
            }
            acc[activity.date][activity.event_type] = activity.count;
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: {
                period: `${daysNum} days`,
                activities: groupedActivity
            }
        });
    } catch (error) {
        console.error('User activity error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Get document performance metrics
router.get('/documents/performance', auth, async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id,
                d.title,
                d.created_at,
                COUNT(CASE WHEN da.action = 'viewed' THEN 1 END) as view_count,
                COUNT(CASE WHEN da.action = 'signed' THEN 1 END) as signature_count,
                COUNT(CASE WHEN da.action = 'downloaded' THEN 1 END) as download_count,
                MAX(CASE WHEN da.action = 'signed' THEN da.timestamp END) as last_signed,
                COUNT(DISTINCT da.user_id) as unique_viewers
            FROM documents d
            LEFT JOIN document_analytics da ON d.id = da.document_id
            WHERE d.user_id = ?
            GROUP BY d.id, d.title, d.created_at
            ORDER BY d.created_at DESC
            LIMIT 100
        `;
        
        const db = require('../models/database');
        const performance = db.prepare(query).all(req.user.id);
        
        res.json({
            success: true,
            data: performance.map(doc => ({
                id: doc.id,
                title: doc.title,
                createdAt: doc.created_at,
                metrics: {
                    viewCount: doc.view_count || 0,
                    signatureCount: doc.signature_count || 0,
                    downloadCount: doc.download_count || 0,
                    uniqueViewers: doc.unique_viewers || 0
                },
                lastSigned: doc.last_signed
            }))
        });
    } catch (error) {
        console.error('Document performance error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

module.exports = router;
