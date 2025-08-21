const db = require('../models/database');
const DeviceFingerprintingService = require('./DeviceFingerprintingService');

class GeolocationVerificationService {
  /**
   * Verify and store geolocation data for an authentication record
   */
  static async verifyLocation(authRecordId, locationData, verificationMethod = 'gps') {
    try {
      const authRecord = await db.get(
        'SELECT * FROM authentication_records WHERE id = ?',
        [authRecordId]
      );

      if (!authRecord) {
        throw new Error('Authentication record not found');
      }

      let verificationResult = {
        verification_type: verificationMethod,
        requested_location: JSON.stringify({
          lat: locationData.latitude,
          lng: locationData.longitude,
          accuracy: locationData.accuracy,
          timestamp: locationData.timestamp || new Date().toISOString()
        }),
        verified_location: null,
        distance_variance: null,
        location_match: false,
        verification_confidence: 0.0,
        verification_source: verificationMethod
      };

      // Perform verification based on method
      switch (verificationMethod) {
        case 'gps':
          verificationResult = await this.verifyGPSLocation(authRecord, locationData, verificationResult);
          break;
        case 'network':
          verificationResult = await this.verifyNetworkLocation(authRecord, locationData, verificationResult);
          break;
        case 'ip_geolocation':
          verificationResult = await this.verifyIPGeolocation(authRecord, locationData, verificationResult);
          break;
        case 'manual':
          verificationResult = await this.verifyManualLocation(authRecord, locationData, verificationResult);
          break;
        default:
          throw new Error(`Unsupported verification method: ${verificationMethod}`);
      }

      // Store verification result
      const result = await db.run(
        `INSERT INTO geolocation_verification (
          authentication_record_id, verification_type, requested_location, 
          verified_location, distance_variance, location_match, 
          verification_confidence, verification_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          authRecordId,
          verificationResult.verification_type,
          verificationResult.requested_location,
          verificationResult.verified_location,
          verificationResult.distance_variance,
          verificationResult.location_match,
          verificationResult.verification_confidence,
          verificationResult.verification_source
        ]
      );

      return {
        id: result.id,
        ...verificationResult
      };
    } catch (error) {
      console.error('Geolocation verification error:', error);
      throw error;
    }
  }

  /**
   * Verify GPS-provided location
   */
  static async verifyGPSLocation(authRecord, locationData, verificationResult) {
    // GPS is generally the most accurate, so we have high confidence if the data looks valid
    if (DeviceFingerprintingService.validateGPSCoordinates(
      locationData.latitude, 
      locationData.longitude, 
      locationData.accuracy
    )) {
      verificationResult.verified_location = JSON.stringify({
        lat: locationData.latitude,
        lng: locationData.longitude,
        accuracy: locationData.accuracy,
        source: 'gps'
      });
      
      // Compare with IP geolocation for consistency check
      const ipGeo = DeviceFingerprintingService.getIPGeolocation(authRecord.ip_address);
      if (ipGeo.latitude && ipGeo.longitude) {
        const distance = DeviceFingerprintingService.calculateDistance(
          locationData.latitude, locationData.longitude,
          ipGeo.latitude, ipGeo.longitude
        );
        
        verificationResult.distance_variance = distance;
        
        // GPS and IP should be reasonably close (within 100km for most cases)
        if (distance < 100000) {
          verificationResult.location_match = true;
          verificationResult.verification_confidence = Math.max(0.7, 1.0 - (distance / 100000) * 0.3);
        } else {
          verificationResult.location_match = false;
          verificationResult.verification_confidence = 0.3; // Low confidence due to mismatch
        }
      } else {
        // No IP geolocation available for comparison
        verificationResult.location_match = true;
        verificationResult.verification_confidence = 0.8; // High confidence in GPS alone
      }
    } else {
      verificationResult.verification_confidence = 0.0;
      verificationResult.location_match = false;
    }

    return verificationResult;
  }

  /**
   * Verify network-based location (WiFi, cell towers)
   */
  static async verifyNetworkLocation(authRecord, locationData, verificationResult) {
    verificationResult.verified_location = JSON.stringify({
      lat: locationData.latitude,
      lng: locationData.longitude,
      accuracy: locationData.accuracy || 1000, // Network location is typically less accurate
      source: 'network'
    });

    // Compare with IP geolocation
    const ipGeo = DeviceFingerprintingService.getIPGeolocation(authRecord.ip_address);
    if (ipGeo.latitude && ipGeo.longitude) {
      const distance = DeviceFingerprintingService.calculateDistance(
        locationData.latitude, locationData.longitude,
        ipGeo.latitude, ipGeo.longitude
      );
      
      verificationResult.distance_variance = distance;
      
      // Network location should be reasonably close to IP location
      if (distance < 50000) { // 50km
        verificationResult.location_match = true;
        verificationResult.verification_confidence = 0.6 - (distance / 50000) * 0.2;
      } else {
        verificationResult.location_match = false;
        verificationResult.verification_confidence = 0.2;
      }
    } else {
      verificationResult.verification_confidence = 0.4; // Moderate confidence in network location
      verificationResult.location_match = true;
    }

    return verificationResult;
  }

  /**
   * Verify IP-based geolocation
   */
  static async verifyIPGeolocation(authRecord, locationData, verificationResult) {
    const ipGeo = DeviceFingerprintingService.getIPGeolocation(authRecord.ip_address);
    
    verificationResult.verified_location = JSON.stringify({
      lat: ipGeo.latitude,
      lng: ipGeo.longitude,
      accuracy: 10000, // IP geolocation is typically accurate to ~10km
      source: 'ip'
    });

    if (ipGeo.latitude && ipGeo.longitude && locationData.latitude && locationData.longitude) {
      const distance = DeviceFingerprintingService.calculateDistance(
        locationData.latitude, locationData.longitude,
        ipGeo.latitude, ipGeo.longitude
      );
      
      verificationResult.distance_variance = distance;
      verificationResult.location_match = distance < 25000; // 25km tolerance for IP geo
      verificationResult.verification_confidence = verificationResult.location_match ? 0.5 : 0.2;
    } else {
      verificationResult.verification_confidence = 0.3;
      verificationResult.location_match = false;
    }

    return verificationResult;
  }

  /**
   * Verify manually entered location
   */
  static async verifyManualLocation(authRecord, locationData, verificationResult) {
    // For manual location, we rely on IP geolocation for verification
    const ipGeo = DeviceFingerprintingService.getIPGeolocation(authRecord.ip_address);
    
    verificationResult.verified_location = JSON.stringify({
      country: locationData.country,
      region: locationData.region,
      city: locationData.city,
      postal_code: locationData.postalCode,
      source: 'manual'
    });

    // Basic verification against IP geolocation
    let matchScore = 0;
    if (locationData.country === ipGeo.country_code) matchScore += 0.4;
    if (locationData.region === ipGeo.region) matchScore += 0.3;
    if (locationData.city === ipGeo.city) matchScore += 0.3;

    verificationResult.location_match = matchScore >= 0.4;
    verificationResult.verification_confidence = Math.min(matchScore, 0.6); // Cap at 0.6 for manual entry

    return verificationResult;
  }

  /**
   * Get location history for risk assessment
   */
  static async getLocationHistory(userId, days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const records = await db.all(
        `SELECT ar.*, gv.verified_location, gv.verification_confidence
         FROM authentication_records ar
         LEFT JOIN geolocation_verification gv ON ar.id = gv.authentication_record_id
         WHERE ar.user_id = ? AND ar.authenticated_at >= ?
         ORDER BY ar.authenticated_at DESC`,
        [userId, cutoffDate.toISOString()]
      );

      return records.map(record => ({
        ...record,
        verified_location: record.verified_location ? JSON.parse(record.verified_location) : null
      }));
    } catch (error) {
      console.error('Error getting location history:', error);
      return [];
    }
  }

  /**
   * Detect suspicious location patterns
   */
  static async detectSuspiciousPatterns(userId) {
    try {
      const locationHistory = await this.getLocationHistory(userId, 7); // Last 7 days
      const suspiciousPatterns = [];

      if (locationHistory.length < 2) {
        return suspiciousPatterns;
      }

      // Check for rapid location changes
      for (let i = 1; i < locationHistory.length; i++) {
        const current = locationHistory[i - 1];
        const previous = locationHistory[i];

        if (current.latitude && current.longitude && previous.latitude && previous.longitude) {
          const distance = DeviceFingerprintingService.calculateDistance(
            current.latitude, current.longitude,
            previous.latitude, previous.longitude
          );

          const timeDiff = new Date(current.authenticated_at) - new Date(previous.authenticated_at);
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          // Check for impossible travel (faster than 1000 km/h)
          if (hoursDiff > 0 && distance / 1000 / hoursDiff > 1000) {
            suspiciousPatterns.push({
              type: 'impossible_travel',
              description: `Travel of ${Math.round(distance/1000)}km in ${Math.round(hoursDiff)}h`,
              severity: 'high',
              records: [current.id, previous.id]
            });
          }

          // Check for rapid successive logins from distant locations
          if (hoursDiff < 1 && distance > 100000) {
            suspiciousPatterns.push({
              type: 'rapid_location_change',
              description: `${Math.round(distance/1000)}km change in ${Math.round(hoursDiff * 60)}min`,
              severity: 'medium',
              records: [current.id, previous.id]
            });
          }
        }
      }

      // Check for too many different locations in short time
      const uniqueLocations = new Set();
      locationHistory.forEach(record => {
        if (record.latitude && record.longitude) {
          const locationKey = `${Math.round(record.latitude * 100)},${Math.round(record.longitude * 100)}`;
          uniqueLocations.add(locationKey);
        }
      });

      if (uniqueLocations.size > 10) {
        suspiciousPatterns.push({
          type: 'multiple_locations',
          description: `Accessed from ${uniqueLocations.size} different locations in 7 days`,
          severity: 'medium',
          records: locationHistory.map(r => r.id)
        });
      }

      return suspiciousPatterns;
    } catch (error) {
      console.error('Error detecting suspicious patterns:', error);
      return [];
    }
  }

  /**
   * Generate location-based risk score
   */
  static async calculateLocationRiskScore(userId, currentLocation) {
    try {
      const locationHistory = await this.getLocationHistory(userId, 30);
      let riskScore = 0;

      if (locationHistory.length === 0) {
        return { riskScore: 30, reason: 'No location history available' };
      }

      // Check against known safe locations
      const knownLocations = locationHistory.filter(record => 
        record.verification_confidence > 0.6
      );

      if (knownLocations.length === 0) {
        return { riskScore: 50, reason: 'No verified locations in history' };
      }

      // Calculate distance to nearest known location
      const distances = knownLocations.map(record => {
        if (!record.latitude || !record.longitude || !currentLocation.latitude || !currentLocation.longitude) {
          return Infinity;
        }
        return DeviceFingerprintingService.calculateDistance(
          currentLocation.latitude, currentLocation.longitude,
          record.latitude, record.longitude
        );
      });

      const minDistance = Math.min(...distances);

      // Risk increases with distance from known locations
      if (minDistance < 10000) { // Within 10km
        riskScore = 0;
      } else if (minDistance < 50000) { // Within 50km
        riskScore = 10;
      } else if (minDistance < 200000) { // Within 200km
        riskScore = 25;
      } else if (minDistance < 1000000) { // Within 1000km
        riskScore = 40;
      } else { // Over 1000km
        riskScore = 60;
      }

      // Check for suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(userId);
      const highSeverityPatterns = suspiciousPatterns.filter(p => p.severity === 'high');
      const mediumSeverityPatterns = suspiciousPatterns.filter(p => p.severity === 'medium');

      riskScore += highSeverityPatterns.length * 20;
      riskScore += mediumSeverityPatterns.length * 10;

      return {
        riskScore: Math.min(riskScore, 100),
        minDistance,
        suspiciousPatterns,
        reason: riskScore > 50 ? 'High risk due to unusual location or patterns' : 'Normal location pattern'
      };
    } catch (error) {
      console.error('Error calculating location risk score:', error);
      return { riskScore: 50, reason: 'Error calculating risk score' };
    }
  }
}

module.exports = GeolocationVerificationService;
