# Security Best Practices for OnDottedLine

## Overview

This document outlines comprehensive security best practices for the OnDottedLine electronic signature platform, ensuring the highest levels of security, compliance, and user trust.

## 🔐 Cryptographic Security

### Digital Signatures
- **Algorithm**: RSA-2048 minimum, RSA-4096 recommended
- **Hashing**: SHA-256 minimum, SHA-512 for high-security environments
- **Key Management**: Secure key generation, storage, and rotation
- **Certificate Validation**: Real-time OCSP checking

### Encryption Standards
- **Data at Rest**: AES-256 encryption
- **Data in Transit**: TLS 1.3 minimum
- **Database**: Transparent data encryption (TDE)
- **File Storage**: Server-side encryption with customer-managed keys

### Key Management
```javascript
// Example: Secure key generation
const crypto = require('crypto');
const { generateKeyPair } = crypto;

generateKeyPair('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: process.env.KEY_PASSPHRASE
  }
}, (err, publicKey, privateKey) => {
  // Store keys securely
  storeKeySecurely(publicKey, privateKey);
});
```

## 🛡️ Authentication & Authorization

### Multi-Factor Authentication (MFA)
- **Primary**: Email/password
- **Secondary**: SMS, TOTP, hardware tokens
- **Biometric**: Fingerprint, face recognition (mobile)
- **Implementation**: Time-based OTP with backup codes

### Role-Based Access Control (RBAC)
```javascript
const permissions = {
  admin: ['read', 'write', 'delete', 'manage_users', 'system_config'],
  manager: ['read', 'write', 'manage_team', 'view_analytics'],
  user: ['read', 'write_own', 'sign_documents'],
  viewer: ['read', 'view_documents']
};

// Permission checking middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user.permissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};
```

### Session Management
- **JWT Tokens**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Secure, long-lived rotation
- **Session Storage**: Redis with encryption
- **Logout**: Token blacklisting and cleanup

## 🔒 Data Protection

### Personal Identifiable Information (PII)
```javascript
// PII encryption example
const CryptoJS = require('crypto-js');

class PIIProtection {
  static encrypt(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  }
  
  static decrypt(encryptedData, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }
  
  static hash(data) {
    return CryptoJS.SHA256(data).toString();
  }
}

// Usage in user model
class User {
  constructor(data) {
    this.id = data.id;
    this.email = PIIProtection.hash(data.email); // Store hash for lookup
    this.encryptedEmail = PIIProtection.encrypt(data.email, process.env.PII_KEY);
    this.firstName = PIIProtection.encrypt(data.firstName, process.env.PII_KEY);
    this.lastName = PIIProtection.encrypt(data.lastName, process.env.PII_KEY);
  }
}
```

### Data Classification
- **Public**: Marketing materials, public templates
- **Internal**: System logs, analytics (anonymized)
- **Confidential**: User documents, signatures
- **Restricted**: PII, payment information, audit logs

### Data Retention Policies
```javascript
const retentionPolicies = {
  documents: {
    active: '7 years',
    completed: '10 years', 
    voided: '3 years'
  },
  auditLogs: {
    security: '7 years',
    access: '3 years',
    system: '1 year'
  },
  userSessions: {
    active: '24 hours',
    expired: '30 days'
  }
};

// Automated cleanup job
class DataRetentionManager {
  static async cleanupExpiredData() {
    await this.cleanupExpiredSessions();
    await this.archiveOldDocuments();
    await this.purgeOldLogs();
  }
}
```

## 🚨 Security Monitoring

### Audit Logging
```javascript
class SecurityAuditLogger {
  static logSecurityEvent(event, user, details = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType: event,
      userId: user?.id,
      userEmail: user?.email,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      severity: this.calculateSeverity(event),
      details: JSON.stringify(details),
      sessionId: details.sessionId
    };
    
    // Log to secure audit system
    this.writeToAuditLog(auditEntry);
    
    // Alert on high-severity events
    if (auditEntry.severity === 'HIGH') {
      this.sendSecurityAlert(auditEntry);
    }
  }
  
  static calculateSeverity(event) {
    const highSeverityEvents = [
      'failed_login_multiple',
      'unauthorized_access_attempt',
      'data_breach_suspected',
      'privilege_escalation'
    ];
    
    return highSeverityEvents.includes(event) ? 'HIGH' : 'MEDIUM';
  }
}
```

### Intrusion Detection
- **Failed Login Monitoring**: Rate limiting and account lockout
- **Unusual Activity Detection**: Geolocation, device fingerprinting
- **API Abuse Protection**: Rate limiting, request pattern analysis
- **Real-time Alerts**: Slack, email, SMS notifications

### Security Metrics Dashboard
```javascript
const securityMetrics = {
  authentication: {
    successfulLogins: 0,
    failedLogins: 0,
    mfaChallenges: 0,
    accountLockouts: 0
  },
  dataAccess: {
    documentViews: 0,
    downloads: 0,
    unauthorizedAttempts: 0
  },
  apiSecurity: {
    rateLimitHits: 0,
    suspiciousRequests: 0,
    blockedIPs: 0
  }
};
```

## 🌐 Network Security

### API Security
```javascript
// Rate limiting configuration
const rateLimit = require('express-rate-limit');

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      SecurityAuditLogger.logSecurityEvent('rate_limit_exceeded', req.user, {
        ipAddress: req.ip,
        endpoint: req.path
      });
      res.status(429).json({ error: message });
    }
  });
};

// Different limits for different endpoints
app.use('/api/auth', createRateLimit(15 * 60 * 1000, 5, 'Too many auth attempts'));
app.use('/api/documents', createRateLimit(15 * 60 * 1000, 100, 'Too many requests'));
app.use('/api/envelopes', createRateLimit(15 * 60 * 1000, 200, 'Too many requests'));
```

### Input Validation & Sanitization
```javascript
const validator = require('validator');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

class InputValidator {
  static validateEmail(email) {
    return validator.isEmail(email) && email.length <= 255;
  }
  
  static sanitizeHTML(input) {
    const window = new JSDOM('').window;
    const purify = DOMPurify(window);
    return purify.sanitize(input);
  }
  
  static validateEnvelopeTitle(title) {
    if (!title || typeof title !== 'string') return false;
    if (title.length < 1 || title.length > 255) return false;
    return !/[<>]/g.test(title); // Block HTML tags
  }
  
  static validateSignatureField(field) {
    const requiredFields = ['x', 'y', 'width', 'height', 'page'];
    return requiredFields.every(prop => 
      typeof field[prop] === 'number' && field[prop] >= 0
    );
  }
}
```

### CORS Configuration
```javascript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://app.ondottedline.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
```

## 🏢 Compliance & Governance

### GDPR Compliance
```javascript
class GDPRCompliance {
  // Right to be forgotten
  static async deleteUserData(userId) {
    await User.anonymizeData(userId);
    await AuditLog.retainMinimalData(userId);
    await Document.transferOwnership(userId, 'system');
  }
  
  // Data portability
  static async exportUserData(userId) {
    const userData = await User.findById(userId);
    const documents = await Document.findByUserId(userId);
    const signatures = await Signature.findByUserId(userId);
    
    return {
      personalData: userData.getExportableData(),
      documents: documents.map(doc => doc.getMetadata()),
      signatures: signatures.map(sig => sig.getMetadata())
    };
  }
  
  // Consent management
  static async updateConsent(userId, consentType, granted) {
    await UserConsent.updateConsent(userId, consentType, granted);
    SecurityAuditLogger.logSecurityEvent('consent_updated', { id: userId }, {
      consentType,
      granted
    });
  }
}
```

### SOX Compliance
- **Document Integrity**: Immutable audit trails
- **Access Controls**: Segregation of duties
- **Change Management**: Approved change processes
- **Regular Audits**: Automated compliance reporting

### HIPAA Compliance (Healthcare)
```javascript
class HIPAACompliance {
  static encryptPHI(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), process.env.PHI_KEY).toString();
  }
  
  static logPHIAccess(userId, documentId, action) {
    SecurityAuditLogger.logSecurityEvent('phi_access', { id: userId }, {
      documentId,
      action,
      timestamp: new Date().toISOString(),
      compliance: 'HIPAA'
    });
  }
  
  static async generateBusinessAssociateAgreement(organizationId) {
    // Generate BAA documentation
    return BAA.generate(organizationId);
  }
}
```

## 🔧 Security Configuration

### Environment Variables
```bash
# Security keys (rotate regularly)
JWT_SECRET=your-256-bit-secret
REFRESH_TOKEN_SECRET=your-refresh-secret
PII_ENCRYPTION_KEY=your-pii-key
PHI_ENCRYPTION_KEY=your-phi-key

# Database encryption
DB_ENCRYPTION_KEY=your-db-key
BACKUP_ENCRYPTION_KEY=your-backup-key

# External services
CERTIFICATE_AUTHORITY_API_KEY=your-ca-key
TIMESTAMP_AUTHORITY_URL=https://tsa.example.com

# Security settings
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=900
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=1800

# Monitoring
SECURITY_ALERT_WEBHOOK=https://alerts.example.com/webhook
LOG_RETENTION_DAYS=2555
```

### Security Headers
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true
}));
```

## 🚀 Deployment Security

### Container Security
```dockerfile
# Use minimal base image
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Start application
CMD ["node", "server.js"]
```

### Infrastructure Security
- **Load Balancer**: TLS termination, WAF rules
- **Database**: VPC isolation, encryption at rest
- **File Storage**: Encrypted buckets, access logging
- **Monitoring**: CloudWatch, Datadog, custom alerts

### Secrets Management
```javascript
// AWS Secrets Manager integration
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

class SecretsManager {
  static async getSecret(secretName) {
    try {
      const result = await secretsManager.getSecretValue({
        SecretId: secretName
      }).promise();
      
      return JSON.parse(result.SecretString);
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      throw error;
    }
  }
  
  static async rotateSecret(secretName) {
    await secretsManager.rotateSecret({
      SecretId: secretName
    }).promise();
  }
}
```

## 📋 Security Checklist

### Development
- [ ] Code review process with security focus
- [ ] Static code analysis (SonarQube, ESLint security rules)
- [ ] Dependency vulnerability scanning
- [ ] Security unit tests

### Pre-Production
- [ ] Penetration testing
- [ ] Security scan of container images
- [ ] Infrastructure security review
- [ ] Compliance audit

### Production
- [ ] Real-time monitoring and alerting
- [ ] Regular security assessments
- [ ] Incident response plan testing
- [ ] Security training for staff

### Ongoing
- [ ] Monthly security reviews
- [ ] Quarterly penetration tests
- [ ] Annual compliance audits
- [ ] Security awareness training

---

This comprehensive security framework ensures OnDottedLine meets the highest industry standards for electronic signature platforms while maintaining usability and performance.
