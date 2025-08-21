const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeviceFingerprintingService = require('../services/DeviceFingerprintingService');
const GeolocationVerificationService = require('../services/GeolocationVerificationService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token or user account deactivated.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token.' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired.' 
      });
    } else {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error.' 
      });
    }
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Enhanced authentication middleware with device fingerprinting and geolocation
const enhancedAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;

    // Enhanced security: Create authentication record with device fingerprinting
    if (req.body.deviceData || req.body.geolocationData) {
      try {
        const authRecord = await DeviceFingerprintingService.createAuthenticationRecord(
          {
            userId: user.id,
            sessionId: req.sessionID || 'web-session',
            authMethod: 'token',
            deviceData: req.body.deviceData,
            geolocationConsent: req.body.geolocationConsent
          },
          {
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip || req.connection.remoteAddress,
            ispName: req.get('X-ISP-Name') // Custom header if available
          },
          req.body.geolocationData
        );

        // Get user's previous authentication records for risk assessment
        const previousRecords = await db.all(
          `SELECT * FROM authentication_records 
           WHERE user_id = ? AND authenticated_at > datetime('now', '-30 days')
           ORDER BY authenticated_at DESC LIMIT 50`,
          [user.id]
        );

        // Assess risk
        const riskAssessment = DeviceFingerprintingService.assessRisk(authRecord, previousRecords);
        authRecord.risk_score = riskAssessment.riskScore;
        authRecord.fraud_indicators = JSON.stringify(riskAssessment.riskFactors);

        // Store authentication record
        const result = await db.run(
          `INSERT INTO authentication_records (
            user_id, session_id, authentication_method, authentication_level,
            device_fingerprint, user_agent, browser_name, browser_version,
            operating_system, device_type, screen_resolution, timezone,
            language, platform, hardware_concurrency, device_memory,
            ip_address, isp_name, connection_type, latitude, longitude,
            accuracy, country_code, country_name, region, city,
            geolocation_method, geolocation_consent, risk_score, fraud_indicators
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            authRecord.user_id, authRecord.session_id, authRecord.authentication_method,
            authRecord.authentication_level, authRecord.device_fingerprint, authRecord.user_agent,
            authRecord.browser_name, authRecord.browser_version, authRecord.operating_system,
            authRecord.device_type, authRecord.screen_resolution, authRecord.timezone,
            authRecord.language, authRecord.platform, authRecord.hardware_concurrency,
            authRecord.device_memory, authRecord.ip_address, authRecord.isp_name,
            authRecord.connection_type, authRecord.latitude, authRecord.longitude,
            authRecord.accuracy, authRecord.country_code, authRecord.country_name,
            authRecord.region, authRecord.city, authRecord.geolocation_method,
            authRecord.geolocation_consent, authRecord.risk_score, authRecord.fraud_indicators
          ]
        );

        req.authRecord = { id: result.id, ...authRecord };

        // High risk authentication handling
        if (riskAssessment.riskScore > 70) {
          console.warn(`High risk authentication detected for user ${user.id}:`, riskAssessment);
          
          // For high-risk, you might want to:
          // - Require additional verification
          // - Log security event
          // - Temporarily restrict certain actions
          // - Send security notification to user
          
          await db.run(
            `INSERT INTO compliance_audit_trail (
              user_id, event_type, event_category, event_description,
              compliance_framework, event_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user.id, 'high_risk_authentication', 'security',
              `High risk authentication detected (risk score: ${riskAssessment.riskScore})`,
              'SECURITY', JSON.stringify(riskAssessment), req.ip, req.get('User-Agent')
            ]
          );
        }

        // Verify geolocation if provided
        if (req.body.geolocationData && req.body.geolocationData.latitude) {
          await GeolocationVerificationService.verifyLocation(
            result.id,
            req.body.geolocationData,
            req.body.geolocationData.method || 'gps'
          );
        }

      } catch (authError) {
        console.error('Enhanced authentication error:', authError);
        // Don't fail the request for auth record errors, but log them
      }
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
  adminOnly,
  generateToken,
  enhancedAuth
};
