# OnDottedLine Legal & Security Implementation Plan
## Integrating Advanced Legal and Security Features

### Overview
This document outlines the practical implementation of our comprehensive legal and security framework into the existing OnDottedLine platform. We'll build upon our current envelope system to create a truly enterprise-grade, legally binding e-signature solution.

## Current System Enhancement Strategy

### 1. Database Schema Enhancements

#### 1.1 Legal Compliance Tables
```sql
-- Legal compliance tracking
CREATE TABLE legal_compliance_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    jurisdiction TEXT NOT NULL, -- 'US', 'EU', 'CA', etc.
    compliance_framework TEXT NOT NULL, -- 'ESIGN', 'eIDAS', 'PIPEDA', etc.
    compliance_level TEXT NOT NULL, -- 'standard', 'hipaa', 'sox', 'gdpr'
    requirements_met TEXT NOT NULL, -- JSON array of met requirements
    certification_data TEXT, -- JSON with certification details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Digital certificates and PKI
CREATE TABLE digital_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    certificate_data TEXT NOT NULL, -- X.509 certificate in PEM format
    public_key TEXT NOT NULL,
    private_key_hash TEXT NOT NULL, -- Hash of encrypted private key
    issuer TEXT NOT NULL, -- Certificate Authority
    serial_number TEXT NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    is_revoked BOOLEAN DEFAULT 0,
    revocation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Authentication methods and verification
CREATE TABLE authentication_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    authentication_method TEXT NOT NULL,
    verification_level TEXT NOT NULL, -- 'basic', 'enhanced', 'high'
    verification_data TEXT NOT NULL, -- JSON with verification details
    biometric_data TEXT, -- Encrypted biometric signature data
    device_fingerprint TEXT NOT NULL,
    geolocation_data TEXT, -- JSON with location information
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    risk_assessment_score REAL DEFAULT 0,
    verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);

-- Document integrity and tamper detection
CREATE TABLE document_integrity_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    envelope_id INTEGER NOT NULL,
    original_hash TEXT NOT NULL, -- SHA-256 of original document
    current_hash TEXT NOT NULL, -- Current hash for integrity checking
    hash_algorithm TEXT DEFAULT 'SHA-256',
    integrity_chain TEXT, -- JSON array of hash chain
    last_integrity_check DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_tampered BOOLEAN DEFAULT 0,
    tamper_detection_details TEXT, -- JSON with tamper detection info
    blockchain_anchor_hash TEXT, -- Optional blockchain anchor
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);
```

#### 1.2 Enhanced Audit Trail
```sql
-- Enhanced audit logs with legal requirements
CREATE TABLE enhanced_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL, -- 'authentication', 'signing', 'access', 'modification'
    user_identifier TEXT NOT NULL, -- Email or user ID
    user_name TEXT,
    timestamp_utc DATETIME NOT NULL,
    timestamp_local DATETIME NOT NULL,
    timezone TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    geolocation TEXT, -- JSON with location data
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    event_details TEXT NOT NULL, -- JSON with detailed event information
    previous_event_hash TEXT, -- Hash of previous event for chain integrity
    current_event_hash TEXT NOT NULL, -- Hash of current event
    legal_significance TEXT, -- Description of legal significance
    compliance_flags TEXT, -- JSON array of compliance requirements met
    evidence_package_id TEXT, -- Reference to evidence package
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id) ON DELETE CASCADE
);
```

### 2. Backend Model Enhancements

#### 2.1 Enhanced Envelope Model with Legal Features
```javascript
// Add to existing Envelope.js model
class Envelope {
  // ...existing code...

  async setComplianceLevel(complianceLevel, jurisdiction = 'US') {
    const complianceRequirements = this.getComplianceRequirements(complianceLevel, jurisdiction);
    
    await db.run(
      `INSERT INTO legal_compliance_profiles (envelope_id, jurisdiction, compliance_framework, compliance_level, requirements_met)
       VALUES (?, ?, ?, ?, ?)`,
      [this.id, jurisdiction, complianceRequirements.framework, complianceLevel, JSON.stringify(complianceRequirements.requirements)]
    );

    // Update envelope metadata
    await this.update({
      complianceLevel,
      metadata: { ...this.metadata, jurisdiction, complianceRequirements }
    });
  }

  getComplianceRequirements(level, jurisdiction) {
    const requirements = {
      'standard': {
        framework: 'ESIGN',
        requirements: ['email_verification', 'audit_trail', 'intent_to_sign']
      },
      'hipaa': {
        framework: 'HIPAA',
        requirements: ['two_factor_auth', 'encryption_aes256', 'access_controls', 'audit_trail', 'data_retention']
      },
      'sox': {
        framework: 'SOX',
        requirements: ['identity_verification', 'non_repudiation', 'segregation_of_duties', 'audit_trail']
      },
      'eidas': {
        framework: 'eIDAS',
        requirements: ['qualified_certificates', 'timestamp_service', 'signature_validation']
      }
    };

    return requirements[level] || requirements['standard'];
  }

  async enhancedLogAction(action, userId, details = {}, request = null) {
    const deviceFingerprint = this.generateDeviceFingerprint(request);
    const geolocation = await this.getGeolocation(request?.ip);
    
    // Get previous event hash for chain integrity
    const previousEvent = await db.get(
      'SELECT current_event_hash FROM enhanced_audit_logs WHERE envelope_id = ? ORDER BY id DESC LIMIT 1',
      [this.id]
    );

    const eventData = {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ipAddress: request?.ip || 'unknown',
      userAgent: request?.get('User-Agent') || 'unknown',
      deviceFingerprint,
      geolocation,
      details
    };

    const eventHash = this.calculateEventHash(eventData, previousEvent?.current_event_hash);

    await db.run(
      `INSERT INTO enhanced_audit_logs 
       (envelope_id, event_type, event_category, user_identifier, timestamp_utc, 
        ip_address, geolocation, device_fingerprint, user_agent, event_details, 
        previous_event_hash, current_event_hash, legal_significance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.id, action, this.categorizeEvent(action), userId, 
        new Date().toISOString(), request?.ip, JSON.stringify(geolocation),
        deviceFingerprint, request?.get('User-Agent'), JSON.stringify(details),
        previousEvent?.current_event_hash, eventHash, this.getLegalSignificance(action)
      ]
    );
  }

  calculateEventHash(eventData, previousHash = '') {
    const crypto = require('crypto');
    const dataString = JSON.stringify({ ...eventData, previousHash });
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  async generateLegalCertificate() {
    if (this.status !== 'completed') {
      throw new Error('Envelope must be completed to generate legal certificate');
    }

    // Get all compliance and verification data
    const complianceProfile = await this.getComplianceProfile();
    const authenticationRecords = await this.getAuthenticationRecords();
    const integrityRecords = await this.getIntegrityRecords();
    const auditLogs = await this.getEnhancedAuditLogs();

    const certificate = {
      // Certificate identification
      certificateId: uuidv4(),
      envelopeId: this.id,
      generationTimestamp: new Date().toISOString(),
      
      // Legal framework compliance
      legalCompliance: {
        jurisdiction: complianceProfile.jurisdiction,
        framework: complianceProfile.compliance_framework,
        level: complianceProfile.compliance_level,
        requirementsMet: JSON.parse(complianceProfile.requirements_met)
      },
      
      // Digital signature validation
      digitalSignatureEvidence: await this.generateSignatureEvidence(),
      
      // Authentication evidence
      authenticationEvidence: authenticationRecords.map(record => ({
        recipientEmail: record.recipient_email,
        method: record.authentication_method,
        level: record.verification_level,
        timestamp: record.verification_timestamp,
        riskScore: record.risk_assessment_score,
        deviceFingerprint: record.device_fingerprint,
        geolocation: JSON.parse(record.geolocation_data || '{}'),
        biometricVerified: !!record.biometric_data
      })),
      
      // Document integrity proof
      integrityEvidence: integrityRecords.map(record => ({
        documentId: record.document_id,
        originalHash: record.original_hash,
        currentHash: record.current_hash,
        algorithm: record.hash_algorithm,
        integrityVerified: !record.is_tampered,
        blockchainAnchor: record.blockchain_anchor_hash
      })),
      
      // Complete audit trail
      auditTrail: auditLogs.map(log => ({
        timestamp: log.timestamp_utc,
        action: log.event_type,
        category: log.event_category,
        user: log.user_identifier,
        ipAddress: log.ip_address,
        geolocation: JSON.parse(log.geolocation || '{}'),
        deviceFingerprint: log.device_fingerprint,
        legalSignificance: log.legal_significance,
        eventHash: log.current_event_hash
      })),
      
      // Legal declarations
      legalDeclarations: {
        intentToSign: 'All parties demonstrated clear intent to sign electronically',
        consentToElectronicRecords: 'All parties consented to electronic record keeping',
        identityVerification: 'Signer identities verified through appropriate authentication',
        documentIntegrity: 'Document integrity maintained and verified throughout process',
        nonRepudiation: 'Comprehensive audit trail prevents repudiation',
        legallyBinding: `Electronic signatures are legally binding under ${complianceProfile.compliance_framework}`
      }
    };

    // Generate and store certificate
    const EnvelopeCertificate = require('./EnvelopeCertificate');
    return EnvelopeCertificate.createLegalCertificate(this.id, certificate);
  }
}
```

#### 2.2 Digital Certificate Management
```javascript
// New model: DigitalCertificate.js
class DigitalCertificate {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id || data.userId;
    this.certificateData = data.certificate_data;
    this.publicKey = data.public_key;
    this.privateKeyHash = data.private_key_hash;
    this.issuer = data.issuer;
    this.serialNumber = data.serial_number;
    this.validFrom = data.valid_from;
    this.validTo = data.valid_to;
    this.isRevoked = data.is_revoked;
  }

  static async generateCertificate(userId, keyPair) {
    const cert = require('node-forge').pki;
    
    // Create certificate
    const certificate = cert.createCertificate();
    certificate.publicKey = keyPair.publicKey;
    certificate.serialNumber = '01';
    certificate.validity.notBefore = new Date();
    certificate.validity.notAfter = new Date();
    certificate.validity.notAfter.setFullYear(certificate.validity.notBefore.getFullYear() + 1);

    // Set subject and issuer
    const attrs = [{
      name: 'commonName',
      value: `OnDottedLine User ${userId}`
    }, {
      name: 'organizationName',
      value: 'OnDottedLine'
    }];
    
    certificate.setSubject(attrs);
    certificate.setIssuer(attrs);

    // Sign certificate
    certificate.sign(keyPair.privateKey);

    // Convert to PEM format
    const pemCert = cert.certificateToPem(certificate);
    const pemPublicKey = cert.publicKeyToPem(keyPair.publicKey);
    const privateKeyHash = crypto.createHash('sha256')
      .update(cert.privateKeyToPem(keyPair.privateKey))
      .digest('hex');

    // Store in database
    const result = await db.run(
      `INSERT INTO digital_certificates (user_id, certificate_data, public_key, private_key_hash, issuer, serial_number, valid_from, valid_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, pemCert, pemPublicKey, privateKeyHash, 'OnDottedLine CA', '01', 
       certificate.validity.notBefore.toISOString(), certificate.validity.notAfter.toISOString()]
    );

    return this.findById(result.id);
  }

  async validateCertificate() {
    const cert = require('node-forge').pki;
    const certificate = cert.certificateFromPem(this.certificateData);
    
    const now = new Date();
    const isTimeValid = now >= new Date(this.validFrom) && now <= new Date(this.validTo);
    
    return {
      isValid: !this.isRevoked && isTimeValid,
      isRevoked: this.isRevoked,
      isTimeValid,
      issuer: this.issuer,
      serialNumber: this.serialNumber,
      validFrom: this.validFrom,
      validTo: this.validTo
    };
  }
}
```

### 3. Frontend Integration

#### 3.1 Enhanced Authentication Component
```typescript
// components/EnhancedAuthentication.tsx
import React, { useState } from 'react';
import { Shield, Fingerprint, Smartphone, Key } from 'lucide-react';

interface AuthenticationProps {
  complianceLevel: 'standard' | 'hipaa' | 'sox' | 'eidas';
  onAuthenticationComplete: (authData: AuthenticationResult) => void;
}

interface AuthenticationResult {
  method: string;
  level: string;
  biometricData?: string;
  deviceFingerprint: string;
  riskScore: number;
}

export default function EnhancedAuthentication({ complianceLevel, onAuthenticationComplete }: AuthenticationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [authMethods, setAuthMethods] = useState<string[]>([]);

  const getRequiredAuthMethods = (level: string) => {
    switch (level) {
      case 'hipaa':
        return ['email', 'sms', 'device_verification'];
      case 'sox':
        return ['email', 'identity_verification', 'device_verification'];
      case 'eidas':
        return ['qualified_certificate', 'biometric'];
      default:
        return ['email'];
    }
  };

  const performBiometricAuthentication = async () => {
    if ('credentials' in navigator) {
      try {
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: new Uint8Array(32),
            rp: { name: "OnDottedLine" },
            user: {
              id: new Uint8Array(16),
              name: "user@example.com",
              displayName: "User"
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            }
          }
        });

        return {
          biometricData: btoa(JSON.stringify(credential)),
          verified: true
        };
      } catch (error) {
        console.error('Biometric authentication failed:', error);
        return { verified: false };
      }
    }
    return { verified: false };
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <Shield className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Enhanced Authentication</h2>
        <p className="text-gray-600">
          {complianceLevel.toUpperCase()} compliance requires additional verification
        </p>
      </div>

      <div className="space-y-4">
        {/* Authentication methods based on compliance level */}
        {getRequiredAuthMethods(complianceLevel).map((method, index) => (
          <div key={method} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {method === 'biometric' && <Fingerprint className="h-5 w-5 text-green-600" />}
                {method === 'sms' && <Smartphone className="h-5 w-5 text-blue-600" />}
                {method === 'identity_verification' && <Key className="h-5 w-5 text-purple-600" />}
                <span className="font-medium capitalize">{method.replace('_', ' ')}</span>
              </div>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">
                Verify
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Legal Notice</h3>
        <p className="text-sm text-gray-600">
          By proceeding with electronic signature, you agree that your electronic signature 
          will be legally binding under applicable law, including the ESIGN Act and UETA.
        </p>
      </div>
    </div>
  );
}
```

#### 3.2 Legal Compliance Dashboard
```typescript
// components/ComplianceDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface ComplianceData {
  envelopeId: string;
  complianceLevel: string;
  jurisdiction: string;
  framework: string;
  requirementsMet: string[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

export default function ComplianceDashboard() {
  const [complianceData, setComplianceData] = useState<ComplianceData[]>([]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Compliance Dashboard</h2>
        <Shield className="h-6 w-6 text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">Compliant Envelopes</p>
              <p className="text-2xl font-bold text-green-900">245</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">Needs Review</p>
              <p className="text-2xl font-bold text-yellow-900">12</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">Audit Reports</p>
              <p className="text-2xl font-bold text-blue-900">8</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Recent Compliance Activities</h3>
        
        {complianceData.map((item, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Envelope {item.envelopeId}</h4>
                <p className="text-sm text-gray-600">
                  {item.framework} compliance in {item.jurisdiction}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(item.riskAssessment.overallRisk)}`}>
                  {item.riskAssessment.overallRisk.toUpperCase()} RISK
                </span>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
            
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">Requirements Met:</p>
              <div className="flex flex-wrap gap-2">
                {item.requirementsMet.map((req, reqIndex) => (
                  <span key={reqIndex} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {req.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. API Enhancements

#### 4.1 Legal Compliance Endpoints
```javascript
// Add to routes/envelopes.js

// Set compliance level for envelope
router.post('/:id/compliance', async (req, res) => {
  try {
    const { complianceLevel, jurisdiction = 'US' } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await envelope.setComplianceLevel(complianceLevel, jurisdiction);
    
    res.json({ 
      success: true, 
      complianceLevel, 
      jurisdiction,
      requirements: envelope.getComplianceRequirements(complianceLevel, jurisdiction)
    });
  } catch (error) {
    console.error('Error setting compliance level:', error);
    res.status(500).json({ error: 'Failed to set compliance level' });
  }
});

// Generate legal certificate
router.post('/:id/legal-certificate', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const certificate = await envelope.generateLegalCertificate();
    res.json(certificate);
  } catch (error) {
    console.error('Error generating legal certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced authentication verification
router.post('/:id/authenticate', async (req, res) => {
  try {
    const { 
      recipientEmail, 
      authenticationMethod, 
      verificationData,
      biometricData,
      deviceFingerprint
    } = req.body;

    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Perform authentication verification
    const authResult = await envelope.verifyAuthentication({
      recipientEmail,
      authenticationMethod,
      verificationData,
      biometricData,
      deviceFingerprint,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json(authResult);
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Generate compliance report
router.get('/:id/compliance-report', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const report = await envelope.generateComplianceReport();
    res.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});
```

### 5. Security Implementation

#### 5.1 Enhanced Security Middleware
```javascript
// middleware/enhancedSecurity.js
const crypto = require('crypto');
const geoip = require('geoip-lite');

class EnhancedSecurity {
  static generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || '',
      req.body.screenResolution || '',
      req.body.timezone || '',
      req.body.colorDepth || ''
    ];
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  static detectAnomalies(req, userProfile) {
    const riskFactors = [];
    
    // Geographic anomaly detection
    const geo = geoip.lookup(req.ip);
    if (geo && userProfile.typicalLocations) {
      const isUnusualLocation = !userProfile.typicalLocations.some(loc => 
        loc.country === geo.country && loc.region === geo.region
      );
      
      if (isUnusualLocation) {
        riskFactors.push('unusual_location');
      }
    }

    // Device anomaly detection
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    if (!userProfile.knownDevices.includes(deviceFingerprint)) {
      riskFactors.push('unknown_device');
    }

    // Time-based anomaly detection
    const hour = new Date().getHours();
    if (userProfile.typicalSigningHours && 
        !userProfile.typicalSigningHours.includes(hour)) {
      riskFactors.push('unusual_time');
    }

    return {
      riskLevel: this.calculateRiskLevel(riskFactors),
      factors: riskFactors,
      score: this.calculateRiskScore(riskFactors)
    };
  }

  static calculateRiskScore(factors) {
    const weights = {
      'unusual_location': 0.3,
      'unknown_device': 0.4,
      'unusual_time': 0.1,
      'suspicious_behavior': 0.5
    };

    return factors.reduce((score, factor) => {
      return score + (weights[factor] || 0);
    }, 0);
  }
}

module.exports = EnhancedSecurity;
```

### 6. Implementation Timeline

#### Phase 1: Foundation (Weeks 1-2)
- [ ] Database schema implementation
- [ ] Basic legal compliance models
- [ ] Enhanced audit trail system
- [ ] Document integrity verification

#### Phase 2: Authentication & Security (Weeks 3-4)
- [ ] Multi-factor authentication system
- [ ] Biometric signature support
- [ ] Device fingerprinting
- [ ] Risk assessment algorithms

#### Phase 3: Legal Framework (Weeks 5-6)
- [ ] Compliance level enforcement
- [ ] Legal certificate generation
- [ ] Court-admissible evidence packages
- [ ] Regulatory reporting

#### Phase 4: Integration & Testing (Weeks 7-8)
- [ ] Frontend integration
- [ ] API testing and documentation
- [ ] Security penetration testing
- [ ] Legal compliance verification

## OnDottedLine CA/TSP Integration Implementation Plan

### Phase 1: Foundation Setup (Weeks 1-2)

**1. CA Provider Assessment and Selection**
```bash
# Install CA integration dependencies
npm install node-forge
npm install pkijs
npm install @peculiar/asn1-schema
npm install @peculiar/x509
npm install axios
npm install crypto
```

**Database Schema for Certificate Management:**
```sql
-- Certificate Authorities table
CREATE TABLE certificate_authorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    api_endpoint TEXT NOT NULL,
    api_version TEXT DEFAULT '1.0',
    credentials_encrypted TEXT NOT NULL,
    certificate_types TEXT DEFAULT '[]', -- JSON array
    pricing_model TEXT DEFAULT '{}', -- JSON object
    quota_limits TEXT DEFAULT '{}', -- JSON object
    health_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Certificates table
CREATE TABLE user_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ca_provider_id INTEGER NOT NULL,
    certificate_type TEXT NOT NULL, -- standard, EV, QES
    serial_number TEXT UNIQUE NOT NULL,
    subject_dn TEXT NOT NULL,
    issuer_dn TEXT NOT NULL,
    certificate_pem TEXT NOT NULL,
    private_key_encrypted TEXT, -- Only for OnDottedLine-generated keys
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    key_usage TEXT DEFAULT '[]', -- JSON array
    extended_key_usage TEXT DEFAULT '[]', -- JSON array
    status TEXT DEFAULT 'active', -- active, revoked, expired, suspended
    revocation_reason TEXT,
    revocation_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (ca_provider_id) REFERENCES certificate_authorities (id)
);

-- Certificate Requests tracking
CREATE TABLE certificate_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ca_provider_id INTEGER NOT NULL,
    request_id TEXT NOT NULL, -- CA provider's request ID
    certificate_type TEXT NOT NULL,
    subject_info TEXT NOT NULL, -- JSON with certificate subject details
    key_pair_generated BOOLEAN DEFAULT 0,
    public_key_pem TEXT,
    csr_pem TEXT, -- Certificate Signing Request
    status TEXT DEFAULT 'submitted', -- submitted, approved, issued, rejected, failed
    estimated_completion DATETIME,
    cost_estimate DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (ca_provider_id) REFERENCES certificate_authorities (id)
);

-- CA Operations Audit
CREATE TABLE ca_operations_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ca_provider_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL, -- request, validate, revoke, renew
    operation_details TEXT DEFAULT '{}', -- JSON
    request_payload TEXT,
    response_payload TEXT,
    operation_status TEXT NOT NULL, -- success, error, timeout
    response_time_ms INTEGER,
    cost DECIMAL(10,2),
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (ca_provider_id) REFERENCES certificate_authorities (id)
);
```

**2. Core CA Integration Service**
```javascript
// backend/services/CertificateAuthorityService.js
const crypto = require('crypto');
const forge = require('node-forge');
const axios = require('axios');
const db = require('../models/database');

class CertificateAuthorityService {
  constructor() {
    this.providers = new Map();
    this.loadProviders();
  }

  async loadProviders() {
    const caProviders = await db.all(
      'SELECT * FROM certificate_authorities WHERE is_active = 1'
    );
    
    for (const provider of caProviders) {
      this.providers.set(provider.id, {
        ...provider,
        credentials: this.decryptCredentials(provider.credentials_encrypted),
        apiClient: this.createAPIClient(provider)
      });
    }
  }

  async requestUserCertificate(userId, certificateType = 'standard', subjectInfo = {}) {
    // Generate key pair
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    
    // Encrypt private key for storage
    const encryptedPrivateKey = this.encryptPrivateKey(privateKeyPem, userId);
    
    // Create Certificate Signing Request (CSR)
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keyPair.publicKey;
    
    // Set subject
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    csr.setSubject([
      { name: 'commonName', value: user.email },
      { name: 'emailAddress', value: user.email },
      { name: 'organizationName', value: subjectInfo.organization || 'OnDottedLine User' },
      { name: 'countryName', value: subjectInfo.country || 'US' }
    ]);
    
    // Sign CSR
    csr.sign(keyPair.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);
    
    // Select best CA provider
    const provider = await this.selectOptimalProvider(certificateType, 'standard');
    
    // Submit certificate request
    const request = await db.run(
      `INSERT INTO certificate_requests 
       (user_id, ca_provider_id, request_id, certificate_type, subject_info, 
        key_pair_generated, public_key_pem, csr_pem, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        provider.id, 
        '', // Will be updated after CA submission
        certificateType,
        JSON.stringify(subjectInfo),
        1,
        publicKeyPem,
        csrPem,
        'preparing'
      ]
    );

    try {
      const caResponse = await this.submitToCA(provider, {
        csr: csrPem,
        certificateType,
        validityPeriod: 365,
        subject: subjectInfo
      });

      // Update request with CA response
      await db.run(
        `UPDATE certificate_requests 
         SET request_id = ?, status = ?, estimated_completion = ?, cost_estimate = ?
         WHERE id = ?`,
        [
          caResponse.requestId,
          caResponse.status,
          caResponse.estimatedCompletion,
          caResponse.costEstimate,
          request.id
        ]
      );

      return {
        requestId: request.id,
        caRequestId: caResponse.requestId,
        status: caResponse.status,
        estimatedCompletion: caResponse.estimatedCompletion
      };

    } catch (error) {
      await db.run(
        'UPDATE certificate_requests SET status = ?, error_message = ? WHERE id = ?',
        ['failed', error.message, request.id]
      );
      throw error;
    }
  }

  async checkCertificateStatus(requestId) {
    const request = await db.get(
      `SELECT cr.*, ca.provider_name, ca.api_endpoint 
       FROM certificate_requests cr
       JOIN certificate_authorities ca ON cr.ca_provider_id = ca.id
       WHERE cr.id = ?`,
      [requestId]
    );

    if (!request) {
      throw new Error('Certificate request not found');
    }

    const provider = this.providers.get(request.ca_provider_id);
    const status = await this.queryCAStatus(provider, request.request_id);

    // Update local status
    await db.run(
      'UPDATE certificate_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status.status, requestId]
    );

    // If certificate is issued, download and store it
    if (status.status === 'issued' && status.certificateData) {
      await this.storeCertificate(request, status.certificateData);
    }

    return status;
  }

  async storeCertificate(request, certificateData) {
    const cert = forge.pki.certificateFromPem(certificateData.certificate);
    
    await db.run(
      `INSERT INTO user_certificates 
       (user_id, ca_provider_id, certificate_type, serial_number, subject_dn, 
        issuer_dn, certificate_pem, valid_from, valid_to, key_usage, extended_key_usage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.user_id,
        request.ca_provider_id,
        request.certificate_type,
        cert.serialNumber,
        this.formatDN(cert.subject),
        this.formatDN(cert.issuer),
        certificateData.certificate,
        cert.validity.notBefore.toISOString(),
        cert.validity.notAfter.toISOString(),
        JSON.stringify(this.extractKeyUsage(cert)),
        JSON.stringify(this.extractExtendedKeyUsage(cert))
      ]
    );

    // Update request status
    await db.run(
      'UPDATE certificate_requests SET status = ? WHERE id = ?',
      ['completed', request.id]
    );
  }

  async selectOptimalProvider(certificateType, priority = 'cost') {
    const providers = Array.from(this.providers.values())
      .filter(p => {
        const supportedTypes = JSON.parse(p.certificate_types || '[]');
        return supportedTypes.includes(certificateType);
      });

    if (providers.length === 0) {
      throw new Error(`No providers support certificate type: ${certificateType}`);
    }

    // Selection algorithm based on priority
    switch (priority) {
      case 'cost':
        return providers.sort((a, b) => a.cost_per_cert - b.cost_per_cert)[0];
      case 'speed':
        return providers.sort((a, b) => a.avg_processing_time - b.avg_processing_time)[0];
      case 'reliability':
        return providers.sort((a, b) => b.health_score - a.health_score)[0];
      default:
        return providers[0];
    }
  }
}

module.exports = CertificateAuthorityService;
```

### Phase 2: Provider-Specific Implementations (Weeks 3-4)

**DigiCert API Integration:**
```javascript
class DigiCertProvider {
  constructor(apiKey, sandbox = false) {
    this.apiKey = apiKey;
    this.baseUrl = sandbox 
      ? 'https://www.digicert.com/services/v2/test'
      : 'https://www.digicert.com/services/v2';
  }

  async submitCertificateRequest(csrData) {
    const response = await axios.post(`${this.baseUrl}/order/certificate/ssl_plus`, {
      certificate: {
        common_name: csrData.commonName,
        csr: csrData.csr,
        signature_hash: 'sha256'
      },
      organization: {
        id: csrData.organizationId
      },
      validity_years: 1
    }, {
      headers: {
        'X-DC-DEVKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return {
      requestId: response.data.id,
      status: 'submitted',
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      costEstimate: response.data.price
    };
  }

  async getCertificateStatus(requestId) {
    const response = await axios.get(`${this.baseUrl}/order/certificate/${requestId}`, {
      headers: { 'X-DC-DEVKEY': this.apiKey }
    });

    return {
      status: response.data.status,
      certificateData: response.data.certificate ? {
        certificate: response.data.certificate.pem,
        chain: response.data.certificate.intermediate
      } : null
    };
  }
}
```

### Phase 3: Advanced Features (Weeks 5-6)

**Qualified Electronic Signature Support:**
```javascript
class QualifiedSignatureManager {
  async createQESSignature(documentHash, userCertificateId, timestampRequired = true) {
    // Validate certificate is QES-capable
    const certificate = await this.validateQESCertificate(userCertificateId);
    
    // Create signature with timestamp
    const signature = await this.signWithQESCertificate(documentHash, certificate);
    
    if (timestampRequired) {
      signature.timestamp = await this.addQualifiedTimestamp(signature);
    }

    // Generate QES compliance report
    const complianceReport = await this.generateQESComplianceReport(signature);
    
    return {
      signature,
      complianceReport,
      legalLevel: 'QES',
      equivalentToHandwritten: true
    };
  }
}
```

This comprehensive implementation plan provides a roadmap for integrating advanced legal and security features into our existing OnDottedLine platform, ensuring we create a truly enterprise-grade, legally binding e-signature solution that competes with and exceeds the capabilities of DocuSign and other market leaders.
