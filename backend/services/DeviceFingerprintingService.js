const crypto = require('crypto');
const geoip = require('geoip-lite');

class DeviceFingerprintingService {
  /**
   * Generate a unique device fingerprint from client data
   */
  static generateFingerprint(deviceData) {
    const {
      userAgent,
      screen,
      timezone,
      language,
      platform,
      hardwareConcurrency,
      deviceMemory,
      colorDepth,
      pixelRatio,
      touchSupport,
      fonts,
      plugins,
      webglRenderer,
      canvasFingerprint,
      audioFingerprint
    } = deviceData;

    // Create a composite fingerprint string
    const fingerprintData = [
      userAgent || '',
      `${screen?.width}x${screen?.height}x${colorDepth}`,
      timezone || '',
      language || '',
      platform || '',
      hardwareConcurrency || 0,
      deviceMemory || 0,
      pixelRatio || 1,
      touchSupport ? 'touch' : 'no-touch',
      (fonts || []).sort().join(','),
      (plugins || []).sort().join(','),
      webglRenderer || '',
      canvasFingerprint || '',
      audioFingerprint || ''
    ].join('|');

    // Generate SHA-256 hash of the fingerprint data
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Parse User-Agent string to extract device information
   */
  static parseUserAgent(userAgent) {
    if (!userAgent) return {};

    const browserRegex = /(Chrome|Firefox|Safari|Edge|Opera)\/?([\d.]+)/i;
    const osRegex = /(Windows|MacOS|Linux|iOS|Android)[^;)]*([^;)]*)/i;
    const deviceRegex = /(Mobile|Tablet|Desktop)/i;

    const browserMatch = userAgent.match(browserRegex);
    const osMatch = userAgent.match(osRegex);
    const deviceMatch = userAgent.match(deviceRegex);

    return {
      browserName: browserMatch ? browserMatch[1] : 'Unknown',
      browserVersion: browserMatch ? browserMatch[2] : 'Unknown',
      operatingSystem: osMatch ? osMatch[0] : 'Unknown',
      deviceType: deviceMatch ? deviceMatch[1].toLowerCase() : 'desktop',
      userAgent: userAgent
    };
  }

  /**
   * Get geolocation data from IP address
   */
  static getIPGeolocation(ipAddress) {
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
      return {
        country_code: 'LOCAL',
        country_name: 'Local Development',
        region: 'Local',
        city: 'Local',
        latitude: null,
        longitude: null,
        accuracy: null,
        method: 'ip'
      };
    }

    const geo = geoip.lookup(ipAddress);
    if (!geo) {
      return {
        country_code: 'UNKNOWN',
        country_name: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        latitude: null,
        longitude: null,
        accuracy: null,
        method: 'ip'
      };
    }

    return {
      country_code: geo.country,
      country_name: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.ll ? geo.ll[0] : null,
      longitude: geo.ll ? geo.ll[1] : null,
      accuracy: 10000, // IP geolocation is typically accurate to ~10km
      method: 'ip'
    };
  }

  /**
   * Validate GPS coordinates
   */
  static validateGPSCoordinates(latitude, longitude, accuracy) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return false;
    }

    // Check if coordinates are within valid ranges
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;

    // Check if accuracy is reasonable (0-10000 meters)
    if (accuracy !== null && (accuracy < 0 || accuracy > 10000)) return false;

    return true;
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Assess risk based on device and location data
   */
  static assessRisk(authRecord, previousRecords = []) {
    let riskScore = 0;
    const riskFactors = [];

    // Device fingerprint analysis
    if (previousRecords.length === 0) {
      riskScore += 20;
      riskFactors.push('new_device');
    } else {
      const knownDevice = previousRecords.some(record => 
        record.device_fingerprint === authRecord.device_fingerprint
      );
      if (!knownDevice) {
        riskScore += 15;
        riskFactors.push('unknown_device');
      }
    }

    // IP address analysis
    const knownIP = previousRecords.some(record => 
      record.ip_address === authRecord.ip_address
    );
    if (!knownIP) {
      riskScore += 10;
      riskFactors.push('new_ip_address');
    }

    // Location analysis
    if (authRecord.latitude && authRecord.longitude && previousRecords.length > 0) {
      const recentLocations = previousRecords
        .filter(record => record.latitude && record.longitude)
        .slice(-10); // Check last 10 locations

      if (recentLocations.length > 0) {
        const distances = recentLocations.map(record => 
          this.calculateDistance(
            authRecord.latitude, authRecord.longitude,
            record.latitude, record.longitude
          )
        );

        const minDistance = Math.min(...distances);
        
        // Risk increases with distance from usual locations
        if (minDistance > 100000) { // 100km
          riskScore += 25;
          riskFactors.push('unusual_location');
        } else if (minDistance > 50000) { // 50km
          riskScore += 15;
          riskFactors.push('distant_location');
        }
      }
    }

    // Time-based analysis
    if (previousRecords.length > 0) {
      const lastRecord = previousRecords[previousRecords.length - 1];
      const timeDiff = new Date() - new Date(lastRecord.authenticated_at);
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Rapid successive logins from different locations
      if (hoursDiff < 1 && authRecord.ip_address !== lastRecord.ip_address) {
        riskScore += 30;
        riskFactors.push('rapid_location_change');
      }
    }

    // Browser/OS consistency
    const knownBrowser = previousRecords.some(record => 
      record.browser_name === authRecord.browser_name &&
      record.operating_system === authRecord.operating_system
    );
    if (!knownBrowser && previousRecords.length > 0) {
      riskScore += 10;
      riskFactors.push('new_browser_os');
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    return {
      riskScore,
      riskFactors,
      riskLevel: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high'
    };
  }

  /**
   * Generate fraud indicators based on device and behavior patterns
   */
  static generateFraudIndicators(authRecord, userHistory = []) {
    const indicators = [];

    // Check for VPN/Proxy usage
    if (authRecord.isp_name && authRecord.isp_name.toLowerCase().includes('vpn')) {
      indicators.push({
        type: 'vpn_usage',
        severity: 'medium',
        description: 'Connection appears to be through VPN'
      });
    }

    // Check for rapid device changes
    const recentDevices = userHistory
      .filter(record => {
        const timeDiff = new Date() - new Date(record.authenticated_at);
        return timeDiff < (24 * 60 * 60 * 1000); // Last 24 hours
      })
      .map(record => record.device_fingerprint);

    const uniqueDevices = [...new Set(recentDevices)];
    if (uniqueDevices.length > 3) {
      indicators.push({
        type: 'multiple_devices',
        severity: 'high',
        description: `Used ${uniqueDevices.length} different devices in 24 hours`
      });
    }

    // Check for impossible travel
    if (authRecord.latitude && authRecord.longitude && userHistory.length > 0) {
      const lastLocation = userHistory
        .filter(record => record.latitude && record.longitude)
        .pop();

      if (lastLocation) {
        const distance = this.calculateDistance(
          authRecord.latitude, authRecord.longitude,
          lastLocation.latitude, lastLocation.longitude
        );
        const timeDiff = new Date(authRecord.authenticated_at) - new Date(lastLocation.authenticated_at);
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Assume maximum travel speed of 1000 km/h (commercial flight)
        const maxPossibleDistance = hoursDiff * 1000 * 1000; // meters
        
        if (distance > maxPossibleDistance && hoursDiff < 12) {
          indicators.push({
            type: 'impossible_travel',
            severity: 'high',
            description: `Travel of ${Math.round(distance/1000)}km in ${Math.round(hoursDiff)}h is unlikely`
          });
        }
      }
    }

    // Check for automation indicators
    if (authRecord.user_agent) {
      const automationKeywords = ['bot', 'crawler', 'spider', 'automated', 'headless'];
      const hasAutomationIndicators = automationKeywords.some(keyword => 
        authRecord.user_agent.toLowerCase().includes(keyword)
      );
      
      if (hasAutomationIndicators) {
        indicators.push({
          type: 'automation_detected',
          severity: 'high',
          description: 'User agent suggests automated access'
        });
      }
    }

    return indicators;
  }

  /**
   * Create a comprehensive authentication record
   */
  static async createAuthenticationRecord(userData, requestData, geolocationData = null) {
    const deviceInfo = this.parseUserAgent(requestData.userAgent);
    const deviceFingerprint = this.generateFingerprint(userData.deviceData || {});
    const ipGeolocation = this.getIPGeolocation(requestData.ipAddress);

    // Use provided geolocation if available and valid, otherwise fall back to IP geolocation
    let finalGeolocation = ipGeolocation;
    if (geolocationData && 
        this.validateGPSCoordinates(geolocationData.latitude, geolocationData.longitude, geolocationData.accuracy)) {
      finalGeolocation = {
        ...geolocationData,
        method: 'gps'
      };
    }

    const authRecord = {
      user_id: userData.userId,
      envelope_id: userData.envelopeId || null,
      document_id: userData.documentId || null,
      session_id: userData.sessionId,
      authentication_method: userData.authMethod || 'password',
      authentication_level: userData.authLevel || 'standard',
      
      // Device fingerprinting
      device_fingerprint: deviceFingerprint,
      user_agent: requestData.userAgent,
      browser_name: deviceInfo.browserName,
      browser_version: deviceInfo.browserVersion,
      operating_system: deviceInfo.operatingSystem,
      device_type: deviceInfo.deviceType,
      screen_resolution: userData.deviceData?.screen ? `${userData.deviceData.screen.width}x${userData.deviceData.screen.height}` : null,
      timezone: userData.deviceData?.timezone || null,
      language: userData.deviceData?.language || null,
      platform: userData.deviceData?.platform || null,
      hardware_concurrency: userData.deviceData?.hardwareConcurrency || null,
      device_memory: userData.deviceData?.deviceMemory || null,
      
      // Network information
      ip_address: requestData.ipAddress,
      isp_name: requestData.ispName || null,
      connection_type: userData.deviceData?.connectionType || null,
      
      // Geolocation
      latitude: finalGeolocation.latitude,
      longitude: finalGeolocation.longitude,
      accuracy: finalGeolocation.accuracy,
      altitude: geolocationData?.altitude || null,
      heading: geolocationData?.heading || null,
      speed: geolocationData?.speed || null,
      country_code: finalGeolocation.country_code,
      country_name: finalGeolocation.country_name,
      region: finalGeolocation.region,
      city: finalGeolocation.city,
      postal_code: finalGeolocation.postal_code || null,
      geolocation_method: finalGeolocation.method,
      geolocation_consent: userData.geolocationConsent || false,
      
      // Security
      verification_code: userData.verificationCode || null,
      compliance_level: userData.complianceLevel || 'standard',
      
      // Timestamps
      authenticated_at: new Date().toISOString(),
      expires_at: userData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return authRecord;
  }
}

module.exports = DeviceFingerprintingService;
