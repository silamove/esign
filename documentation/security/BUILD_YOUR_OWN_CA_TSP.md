# Building Your Own Certificate Authority (CA) and Trust Service Provider (TSP)

## Overview
Building your own CA/TSP API for OnDottedLine provides complete control over the certificate lifecycle, enhanced security, and cost savings at scale. This guide outlines the technical implementation, security considerations, and regulatory compliance requirements.

## Why Build Your Own CA/TSP?

### Advantages
- **Complete Control**: Full control over certificate policies, validation procedures, and issuance criteria
- **Cost Efficiency**: Significant cost savings when issuing thousands of certificates
- **Custom Integration**: Seamless integration with OnDottedLine's envelope system
- **Enhanced Security**: Direct control over private keys and security procedures
- **Compliance Flexibility**: Ability to meet specific industry or regional compliance requirements
- **Performance**: Reduced latency and dependency on third-party services

### Challenges
- **Regulatory Compliance**: Must comply with various international standards (eIDAS, ESIGN Act, etc.)
- **Security Responsibility**: Full responsibility for securing root keys and infrastructure
- **Audit Requirements**: Regular security audits and compliance certifications
- **Legal Liability**: Potential liability for certificate misuse or security breaches

## Technical Architecture

### Core Components

#### 1. Root Certificate Authority (Root CA)
```
OnDottedLine Root CA
├── Hardware Security Module (HSM)
├── Root Certificate (Self-Signed)
├── Certificate Revocation List (CRL)
└── Online Certificate Status Protocol (OCSP) Responder
```

#### 2. Intermediate Certificate Authorities
```
OnDottedLine Intermediate CA
├── Document Signing CA
├── User Authentication CA
├── Timestamp Authority CA
└── Code Signing CA (for platform security)
```

#### 3. Certificate Management System
```
Certificate Management API
├── Certificate Issuance
├── Certificate Validation
├── Certificate Revocation
├── Key Escrow (if required)
└── Audit Logging
```

## Implementation Plan

### Phase 1: Core PKI Infrastructure

#### 1.1 Root CA Setup
```bash
# Using OpenSSL for initial setup
# Generate Root CA private key (4096-bit RSA)
openssl genrsa -aes256 -out rootCA.key 4096

# Create Root CA certificate
openssl req -x509 -new -nodes -key rootCA.key -sha512 -days 7300 -out rootCA.crt \
    -subj "/C=US/ST=CA/L=San Francisco/O=OnDottedLine Inc/OU=PKI Department/CN=OnDottedLine Root CA"
```

#### 1.2 HSM Integration
```javascript
// Example HSM integration using AWS CloudHSM
const { CloudHSMV2Client } = require('@aws-sdk/client-cloudhsmv2');

class HSMManager {
  constructor() {
    this.hsmClient = new CloudHSMV2Client({ region: 'us-west-2' });
  }

  async generateKeyPair(keySpec = 'RSA_4096') {
    // Generate key pair in HSM
    const command = new GenerateKeyPairCommand({
      ClusterId: process.env.HSM_CLUSTER_ID,
      KeySpec: keySpec,
      KeyUsage: 'SIGN_VERIFY'
    });
    
    return await this.hsmClient.send(command);
  }

  async signData(keyId, data, algorithm = 'RSASSA_PKCS1_V1_5_SHA_256') {
    // Sign data using HSM
    const command = new SignCommand({
      KeyId: keyId,
      Message: data,
      SigningAlgorithm: algorithm
    });
    
    return await this.hsmClient.send(command);
  }
}
```

### Phase 2: Certificate Management API

#### 2.1 Certificate Issuance Service
```javascript
const forge = require('node-forge');
const { HSMManager } = require('./hsmManager');

class CertificateAuthority {
  constructor() {
    this.hsm = new HSMManager();
    this.rootCertificate = this.loadRootCertificate();
    this.intermediateCertificate = this.loadIntermediateCertificate();
  }

  async issueCertificate(certificateRequest) {
    const {
      commonName,
      organization,
      country,
      email,
      keyUsage = ['digitalSignature', 'nonRepudiation'],
      validityPeriod = 365 // days
    } = certificateRequest;

    // Generate certificate
    const cert = forge.pki.createCertificate();
    
    // Set certificate fields
    cert.publicKey = certificateRequest.publicKey;
    cert.serialNumber = this.generateSerialNumber();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validityPeriod);

    // Set subject
    cert.setSubject([
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: organization },
      { name: 'countryName', value: country },
      { name: 'emailAddress', value: email }
    ]);

    // Set issuer (intermediate CA)
    cert.setIssuer(this.intermediateCertificate.subject.attributes);

    // Add extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false
      },
      {
        name: 'keyUsage',
        digitalSignature: keyUsage.includes('digitalSignature'),
        nonRepudiation: keyUsage.includes('nonRepudiation'),
        keyEncipherment: keyUsage.includes('keyEncipherment')
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
        emailProtection: true
      },
      {
        name: 'subjectAltName',
        altNames: [{
          type: 1, // email
          value: email
        }]
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: this.intermediateCertificate.publicKey
      },
      {
        name: 'subjectKeyIdentifier'
      },
      {
        name: 'cRLDistributionPoints',
        altNames: [{
          type: 6, // URI
          value: 'https://pki.ondottedline.com/crl/intermediate.crl'
        }]
      }
    ]);

    // Sign certificate using HSM
    const certAsn1 = forge.pki.certificateToAsn1(cert);
    const certDer = forge.asn1.toDer(certAsn1).getBytes();
    
    const signature = await this.hsm.signData(
      process.env.INTERMEDIATE_CA_KEY_ID,
      Buffer.from(certDer)
    );

    // Apply signature to certificate
    cert.signature = signature;

    return {
      certificate: forge.pki.certificateToPem(cert),
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter
    };
  }

  generateSerialNumber() {
    // Generate cryptographically secure serial number
    return forge.util.bytesToHex(forge.random.getBytesSync(16));
  }
}
```

#### 2.2 Certificate Validation Service
```javascript
class CertificateValidator {
  constructor() {
    this.ocspResponder = new OCSPResponder();
    this.crlManager = new CRLManager();
  }

  async validateCertificate(certificatePem) {
    const cert = forge.pki.certificateFromPem(certificatePem);
    
    const validationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      details: {}
    };

    // 1. Check certificate validity period
    const now = new Date();
    if (now < cert.validity.notBefore) {
      validationResult.errors.push('Certificate is not yet valid');
    }
    if (now > cert.validity.notAfter) {
      validationResult.errors.push('Certificate has expired');
    }

    // 2. Verify certificate chain
    const chainValid = await this.verifyCertificateChain(cert);
    if (!chainValid) {
      validationResult.errors.push('Certificate chain validation failed');
    }

    // 3. Check revocation status (OCSP)
    const revocationStatus = await this.checkRevocationStatus(cert);
    if (revocationStatus.revoked) {
      validationResult.errors.push(`Certificate revoked: ${revocationStatus.reason}`);
    }

    // 4. Validate certificate policies
    const policyValidation = this.validateCertificatePolicies(cert);
    if (!policyValidation.valid) {
      validationResult.warnings.push(...policyValidation.warnings);
    }

    validationResult.isValid = validationResult.errors.length === 0;
    validationResult.details = {
      serialNumber: cert.serialNumber,
      issuer: cert.issuer,
      subject: cert.subject,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      keyUsage: this.extractKeyUsage(cert),
      revocationStatus
    };

    return validationResult;
  }

  async verifyCertificateChain(cert) {
    try {
      // Create certificate store with root and intermediate CAs
      const store = forge.pki.createCertificateStore();
      store.addCertificate(this.rootCertificate);
      store.addCertificate(this.intermediateCertificate);

      // Verify certificate against store
      return forge.pki.verifyCertificateChain(store, [cert]);
    } catch (error) {
      console.error('Certificate chain verification failed:', error);
      return false;
    }
  }

  async checkRevocationStatus(cert) {
    // First try OCSP
    try {
      return await this.ocspResponder.checkStatus(cert);
    } catch (error) {
      // Fallback to CRL
      return await this.crlManager.checkStatus(cert);
    }
  }
}
```

#### 2.3 OCSP Responder
```javascript
class OCSPResponder {
  async checkStatus(certificate) {
    const serialNumber = certificate.serialNumber;
    
    // Query certificate status from database
    const status = await db.get(
      'SELECT status, revocation_date, revocation_reason FROM certificate_status WHERE serial_number = ?',
      [serialNumber]
    );

    if (!status) {
      return {
        status: 'unknown',
        revoked: false
      };
    }

    return {
      status: status.status,
      revoked: status.status === 'revoked',
      revocationDate: status.revocation_date,
      revocationReason: status.revocation_reason
    };
  }

  async generateOCSPResponse(request) {
    // Parse OCSP request
    const ocspRequest = forge.pki.ocsp.createRequest();
    // ... OCSP request parsing logic

    // Generate OCSP response
    const response = forge.pki.ocsp.createResponse();
    // ... OCSP response generation logic

    return response;
  }
}
```

### Phase 3: Trust Service Provider (TSP) Features

#### 3.1 Timestamp Authority
```javascript
class TimestampAuthority {
  constructor() {
    this.hsm = new HSMManager();
    this.tsCertificate = this.loadTimestampCertificate();
  }

  async createTimestamp(dataHash, hashAlgorithm = 'SHA256') {
    const timestamp = {
      version: 1,
      policy: '1.2.3.4.5.6.7.8.9', // OnDottedLine TSA Policy OID
      messageImprint: {
        hashAlgorithm: {
          algorithm: hashAlgorithm
        },
        hashedMessage: dataHash
      },
      serialNumber: this.generateSerialNumber(),
      genTime: new Date(),
      accuracy: {
        seconds: 1
      },
      ordering: true,
      tsa: {
        directoryName: this.tsCertificate.subject
      }
    };

    // Create ASN.1 structure
    const timestampAsn1 = this.createTimestampAsn1(timestamp);
    
    // Sign timestamp using HSM
    const signature = await this.hsm.signData(
      process.env.TIMESTAMP_KEY_ID,
      timestampAsn1
    );

    return {
      timestamp: timestampAsn1,
      signature: signature,
      certificate: this.tsCertificate
    };
  }

  async verifyTimestamp(timestampToken) {
    // Verify timestamp signature and integrity
    // ... verification logic
  }
}
```

#### 3.2 Advanced Electronic Signature (AdES) Support
```javascript
class AdESService {
  constructor() {
    this.ca = new CertificateAuthority();
    this.tsa = new TimestampAuthority();
  }

  async createPAdESSignature(document, signerCertificate, signerPrivateKey) {
    // Create PAdES (PDF Advanced Electronic Signature)
    const pdfDoc = await PDFDocument.load(document);
    
    // Add signature field
    const signatureField = pdfDoc.getForm().createSignature('OnDottedLineSignature');
    
    // Create signature dictionary
    const signatureDict = {
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'adbe.pkcs7.detached',
      ByteRange: [0, 0, 0, 0], // Will be updated
      Contents: null, // Will be updated with signature
      Reason: 'Document approval',
      Location: 'OnDottedLine Platform',
      ContactInfo: 'support@ondottedline.com',
      M: new Date()
    };

    // Generate PKCS#7 signature
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(document);
    p7.addCertificate(signerCertificate);
    
    // Add timestamp
    const timestamp = await this.tsa.createTimestamp(
      forge.md.sha256.create().update(document).digest().toHex()
    );
    
    p7.addAttribute({
      type: forge.pki.oids.timestampToken,
      value: timestamp.timestamp
    });

    // Sign with private key
    p7.addSigner({
      key: signerPrivateKey,
      certificate: signerCertificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [{
        type: forge.pki.oids.contentTypes,
        value: forge.pki.oids.data
      }, {
        type: forge.pki.oids.messageDigest,
        value: forge.md.sha256.create().update(document).digest()
      }, {
        type: forge.pki.oids.signingTime,
        value: new Date()
      }]
    });

    p7.sign();

    return {
      signedDocument: pdfDoc.save(),
      signature: forge.asn1.toDer(p7.toAsn1()).getBytes(),
      timestamp: timestamp
    };
  }

  async createXAdESSignature(xmlDocument, signerCertificate, signerPrivateKey) {
    // Create XAdES (XML Advanced Electronic Signature)
    // ... XAdES implementation
  }

  async createCAdESSignature(data, signerCertificate, signerPrivateKey) {
    // Create CAdES (CMS Advanced Electronic Signature)
    // ... CAdES implementation
  }
}
```

### Phase 4: Database Schema for CA/TSP

```sql
-- Certificate management tables
CREATE TABLE certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    subject_dn TEXT NOT NULL,
    issuer_dn TEXT NOT NULL,
    public_key TEXT NOT NULL,
    certificate_pem TEXT NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'revoked', 'expired', 'suspended')),
    key_usage TEXT NOT NULL,
    extended_key_usage TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_revocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id INTEGER NOT NULL,
    revocation_date DATETIME NOT NULL,
    revocation_reason TEXT NOT NULL,
    revoked_by INTEGER NOT NULL,
    crl_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (certificate_id) REFERENCES certificates (id),
    FOREIGN KEY (revoked_by) REFERENCES users (id)
);

CREATE TABLE certificate_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    csr_pem TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'issued')),
    certificate_id INTEGER,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by INTEGER,
    rejection_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (certificate_id) REFERENCES certificates (id),
    FOREIGN KEY (processed_by) REFERENCES users (id)
);

CREATE TABLE timestamps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    message_imprint TEXT NOT NULL,
    hash_algorithm TEXT NOT NULL,
    timestamp_token TEXT NOT NULL,
    accuracy_seconds INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crl_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crl_number INTEGER NOT NULL,
    certificate_serial TEXT NOT NULL,
    revocation_date DATETIME NOT NULL,
    revocation_reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit tables for compliance
CREATE TABLE ca_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    certificate_serial TEXT,
    user_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    event_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### Phase 5: API Endpoints

#### 5.1 Certificate Management API
```javascript
// routes/ca.js
const express = require('express');
const router = express.Router();
const CertificateAuthority = require('../services/CertificateAuthority');
const auth = require('../middleware/auth');

// Request certificate
router.post('/certificates/request', auth, async (req, res) => {
  try {
    const { csr, certificateType } = req.body;
    
    const ca = new CertificateAuthority();
    const request = await ca.submitCertificateRequest({
      userId: req.user.id,
      csr,
      certificateType
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Issue certificate (admin only)
router.post('/certificates/issue/:requestId', auth, requireRole('admin'), async (req, res) => {
  try {
    const ca = new CertificateAuthority();
    const certificate = await ca.issueCertificate(req.params.requestId);

    res.json(certificate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke certificate
router.post('/certificates/:serialNumber/revoke', auth, requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const ca = new CertificateAuthority();
    await ca.revokeCertificate(req.params.serialNumber, reason, req.user.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OCSP responder
router.post('/ocsp', async (req, res) => {
  try {
    const ocspResponder = new OCSPResponder();
    const response = await ocspResponder.generateOCSPResponse(req.body);

    res.set('Content-Type', 'application/ocsp-response');
    res.send(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRL distribution
router.get('/crl/:crlNumber?', async (req, res) => {
  try {
    const crlManager = new CRLManager();
    const crl = await crlManager.generateCRL(req.params.crlNumber);

    res.set('Content-Type', 'application/pkix-crl');
    res.send(crl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### 5.2 Timestamp Authority API
```javascript
// routes/tsa.js
const express = require('express');
const router = express.Router();
const TimestampAuthority = require('../services/TimestampAuthority');

// Create timestamp
router.post('/timestamp', async (req, res) => {
  try {
    const { dataHash, hashAlgorithm } = req.body;
    
    const tsa = new TimestampAuthority();
    const timestamp = await tsa.createTimestamp(dataHash, hashAlgorithm);

    res.set('Content-Type', 'application/timestamp-reply');
    res.json(timestamp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify timestamp
router.post('/timestamp/verify', async (req, res) => {
  try {
    const { timestampToken } = req.body;
    
    const tsa = new TimestampAuthority();
    const verification = await tsa.verifyTimestamp(timestampToken);

    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## Security Considerations

### 1. Key Management
- **Root Key Security**: Root CA private keys must be stored in Hardware Security Modules (HSMs)
- **Key Rotation**: Implement regular key rotation policies
- **Key Escrow**: Consider key escrow for regulatory compliance
- **Multi-person Control**: Require multiple authorized personnel for critical operations

### 2. Physical Security
- **Secure Facilities**: Root CA operations in secure, audited facilities
- **Access Control**: Strict physical and logical access controls
- **Monitoring**: 24/7 monitoring and logging of all CA operations

### 3. Operational Security
- **Separation of Duties**: Different personnel for different CA functions
- **Background Checks**: Thorough background checks for CA personnel
- **Training**: Regular security training and certification
- **Incident Response**: Comprehensive incident response procedures

## Compliance and Certification

### 1. Standards Compliance
- **WebTrust for CAs**: Industry standard for CA operations
- **FIPS 140-2 Level 3**: For HSM requirements
- **Common Criteria**: For security evaluation
- **ISO 27001**: Information security management

### 2. Legal Compliance
- **eIDAS Regulation**: For EU operations
- **ESIGN Act**: For US operations
- **State Laws**: Various state-specific requirements
- **International**: Country-specific regulations

### 3. Regular Audits
- **Annual Audits**: Independent security audits
- **Compliance Audits**: Regulatory compliance verification
- **Penetration Testing**: Regular security testing
- **Vulnerability Assessments**: Ongoing security assessments

## Cost Analysis

### Initial Setup Costs
- HSM Hardware: $50,000 - $200,000
- Secure Facility: $100,000 - $500,000
- Initial Audit/Certification: $50,000 - $150,000
- Development: $200,000 - $500,000

### Ongoing Costs
- Annual Audits: $25,000 - $75,000
- Facility Maintenance: $50,000 - $100,000
- Personnel: $300,000 - $600,000
- HSM Maintenance: $10,000 - $30,000

### Break-even Analysis
- Certificate Cost (Third-party): $50 - $200 per certificate
- Internal Cost: $5 - $20 per certificate
- Break-even: 5,000 - 10,000 certificates per year

## Implementation Timeline

### Phase 1 (Months 1-3): Foundation
- [ ] Infrastructure setup (HSMs, secure facility)
- [ ] Root CA establishment
- [ ] Basic certificate issuance capability

### Phase 2 (Months 4-6): Core Services
- [ ] OCSP responder implementation
- [ ] CRL distribution
- [ ] Certificate validation services

### Phase 3 (Months 7-9): Advanced Features
- [ ] Timestamp Authority
- [ ] AdES signature support
- [ ] API development

### Phase 4 (Months 10-12): Certification
- [ ] Security audits
- [ ] Compliance certification
- [ ] Production deployment

## Conclusion

Building your own CA/TSP provides OnDottedLine with:

1. **Complete Control**: Over certificate policies and issuance procedures
2. **Cost Savings**: Significant savings at scale
3. **Enhanced Security**: Direct control over all security aspects
4. **Compliance Flexibility**: Ability to meet specific regulatory requirements
5. **Competitive Advantage**: Unique selling proposition in the market

The investment is substantial but provides long-term strategic value for an enterprise e-signature platform. The key is careful planning, proper security implementation, and obtaining necessary certifications to ensure legal validity and market acceptance.
