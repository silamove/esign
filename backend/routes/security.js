const express = require('express');
const router = express.Router();
const db = require('../models/database');
const DeviceFingerprintingService = require('../services/DeviceFingerprintingService');
const GeolocationVerificationService = require('../services/GeolocationVerificationService');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get user's device fingerprints and trust scores
router.get('/devices', async (req, res) => {
  try {
    const devices = await db.all(
      `SELECT 
        ar.device_fingerprint,
        ar.browser_name,
        ar.browser_version,
        ar.operating_system,
        ar.device_type,
        dts.trust_score,
        dts.sign_count,
        dts.first_seen,
        dts.last_seen,
        dts.status,
        COUNT(ar.id) as usage_count,
        MAX(ar.authenticated_at) as last_used
       FROM authentication_records ar
       LEFT JOIN device_trust_scores dts ON ar.device_fingerprint = dts.device_fingerprint
       WHERE ar.user_id = ?
       GROUP BY ar.device_fingerprint
       ORDER BY last_used DESC`,
      [req.user.id]
    );

    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch device information' });
  }
});

// Get device trust score and details
router.get('/devices/:fingerprint', async (req, res) => {
  try {
    const { fingerprint } = req.params;
    
    // Verify user has access to this device
    const userDevice = await db.get(
      'SELECT COUNT(*) as count FROM authentication_records WHERE user_id = ? AND device_fingerprint = ?',
      [req.user.id, fingerprint]
    );

    if (userDevice.count === 0) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    const trustScore = await db.get(
      'SELECT * FROM device_trust_scores WHERE device_fingerprint = ?',
      [fingerprint]
    );

    const recentActivity = await db.all(
      `SELECT authenticated_at, ip_address, country_name, city, risk_score
       FROM authentication_records 
       WHERE device_fingerprint = ? AND user_id = ?
       ORDER BY authenticated_at DESC LIMIT 20`,
      [fingerprint, req.user.id]
    );

    res.json({
      trustScore,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching device details:', error);
    res.status(500).json({ error: 'Failed to fetch device details' });
  }
});

// Update device trust status (block/unblock device)
router.patch('/devices/:fingerprint/status', async (req, res) => {
  try {
    const { fingerprint } = req.params;
    const { status, notes } = req.body;

    if (!['active', 'suspicious', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify user has access to this device
    const userDevice = await db.get(
      'SELECT COUNT(*) as count FROM authentication_records WHERE user_id = ? AND device_fingerprint = ?',
      [req.user.id, fingerprint]
    );

    if (userDevice.count === 0) {
      return res.status(403).json({ error: 'Access denied to this device' });
    }

    await db.run(
      `INSERT OR REPLACE INTO device_trust_scores (
        device_fingerprint, status, notes, last_seen
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [fingerprint, status, notes]
    );

    // Log the status change
    await db.run(
      `INSERT INTO compliance_audit_trail (
        user_id, event_type, event_category, event_description,
        event_data, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 'device_status_change', 'security',
        `Device trust status changed to ${status}`,
        JSON.stringify({ fingerprint, status, notes }),
        req.ip, req.get('User-Agent')
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

// Get user's location history
router.get('/locations', async (req, res) => {
  try {
    const { days = 30, limit = 100 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const locations = await db.all(
      `SELECT 
        ar.authenticated_at,
        ar.latitude,
        ar.longitude,
        ar.accuracy,
        ar.country_name,
        ar.region,
        ar.city,
        ar.geolocation_method,
        ar.risk_score,
        gv.verification_confidence,
        gv.location_match
       FROM authentication_records ar
       LEFT JOIN geolocation_verification gv ON ar.id = gv.authentication_record_id
       WHERE ar.user_id = ? AND ar.authenticated_at >= ?
       ORDER BY ar.authenticated_at DESC
       LIMIT ?`,
      [req.user.id, cutoffDate.toISOString(), parseInt(limit)]
    );

    res.json(locations);
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({ error: 'Failed to fetch location history' });
  }
});

// Get location risk assessment
router.post('/locations/assess-risk', async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const riskAssessment = await GeolocationVerificationService.calculateLocationRiskScore(
      req.user.id,
      { latitude, longitude, accuracy }
    );

    res.json(riskAssessment);
  } catch (error) {
    console.error('Error assessing location risk:', error);
    res.status(500).json({ error: 'Failed to assess location risk' });
  }
});

// Get suspicious location patterns
router.get('/locations/suspicious-patterns', async (req, res) => {
  try {
    const patterns = await GeolocationVerificationService.detectSuspiciousPatterns(req.user.id);
    res.json(patterns);
  } catch (error) {
    console.error('Error detecting suspicious patterns:', error);
    res.status(500).json({ error: 'Failed to detect suspicious patterns' });
  }
});

// Verify current location
router.post('/locations/verify', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, method = 'gps' } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Get or create authentication record for this request
    let authRecordId = req.authRecord?.id;
    
    if (!authRecordId) {
      // Create a basic auth record for verification
      const authRecord = await DeviceFingerprintingService.createAuthenticationRecord(
        {
          userId: req.user.id,
          sessionId: req.sessionID || 'verification-session',
          authMethod: 'location_verification'
        },
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        },
        { latitude, longitude, accuracy, method }
      );

      const result = await db.run(
        `INSERT INTO authentication_records (
          user_id, session_id, authentication_method, device_fingerprint,
          user_agent, ip_address, latitude, longitude, accuracy, geolocation_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          authRecord.user_id, authRecord.session_id, authRecord.authentication_method,
          authRecord.device_fingerprint, authRecord.user_agent, authRecord.ip_address,
          authRecord.latitude, authRecord.longitude, authRecord.accuracy, authRecord.geolocation_method
        ]
      );

      authRecordId = result.id;
    }

    const verification = await GeolocationVerificationService.verifyLocation(
      authRecordId,
      { latitude, longitude, accuracy },
      method
    );

    res.json(verification);
  } catch (error) {
    console.error('Error verifying location:', error);
    res.status(500).json({ error: 'Failed to verify location' });
  }
});

// Get authentication history with risk analysis
router.get('/authentication-history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const records = await db.all(
      `SELECT 
        ar.*,
        dts.trust_score,
        gv.verification_confidence,
        gv.location_match
       FROM authentication_records ar
       LEFT JOIN device_trust_scores dts ON ar.device_fingerprint = dts.device_fingerprint
       LEFT JOIN geolocation_verification gv ON ar.id = gv.authentication_record_id
       WHERE ar.user_id = ?
       ORDER BY ar.authenticated_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    // Parse JSON fields
    const processedRecords = records.map(record => ({
      ...record,
      fraud_indicators: record.fraud_indicators ? JSON.parse(record.fraud_indicators) : []
    }));

    res.json(processedRecords);
  } catch (error) {
    console.error('Error fetching authentication history:', error);
    res.status(500).json({ error: 'Failed to fetch authentication history' });
  }
});

// Generate device fingerprint from client data
router.post('/fingerprint/generate', async (req, res) => {
  try {
    const { deviceData } = req.body;
    
    if (!deviceData) {
      return res.status(400).json({ error: 'Device data is required' });
    }

    const fingerprint = DeviceFingerprintingService.generateFingerprint(deviceData);
    const deviceInfo = DeviceFingerprintingService.parseUserAgent(req.get('User-Agent'));

    res.json({
      fingerprint,
      deviceInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    res.status(500).json({ error: 'Failed to generate device fingerprint' });
  }
});

// Get comprehensive security dashboard data
router.get('/security-dashboard', async (req, res) => {
  try {
    const [
      deviceCount,
      locationCount,
      recentRiskEvents,
      trustScoreSummary
    ] = await Promise.all([
      // Device count
      db.get(
        'SELECT COUNT(DISTINCT device_fingerprint) as count FROM authentication_records WHERE user_id = ?',
        [req.user.id]
      ),
      
      // Location count (last 30 days)
      db.get(
        `SELECT COUNT(DISTINCT latitude || ',' || longitude) as count 
         FROM authentication_records 
         WHERE user_id = ? AND authenticated_at >= datetime('now', '-30 days')`,
        [req.user.id]
      ),
      
      // Recent high-risk events
      db.all(
        `SELECT authenticated_at, risk_score, fraud_indicators, country_name, city
         FROM authentication_records 
         WHERE user_id = ? AND risk_score > 50
         ORDER BY authenticated_at DESC LIMIT 10`,
        [req.user.id]
      ),
      
      // Trust score summary
      db.all(
        `SELECT dts.status, COUNT(*) as count
         FROM device_trust_scores dts
         JOIN authentication_records ar ON dts.device_fingerprint = ar.device_fingerprint
         WHERE ar.user_id = ?
         GROUP BY dts.status`,
        [req.user.id]
      )
    ]);

    const suspiciousPatterns = await GeolocationVerificationService.detectSuspiciousPatterns(req.user.id);

    res.json({
      deviceCount: deviceCount.count,
      locationCount: locationCount.count,
      recentRiskEvents: recentRiskEvents.map(event => ({
        ...event,
        fraud_indicators: event.fraud_indicators ? JSON.parse(event.fraud_indicators) : []
      })),
      trustScoreSummary,
      suspiciousPatterns
    });
  } catch (error) {
    console.error('Error fetching security dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch security dashboard data' });
  }
});

module.exports = router;
