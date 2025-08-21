const express = require('express');
const { body, param, validationResult } = require('express-validator');
const legalSignatureController = require('../controllers/legalSignatureController');

const router = express.Router();

// Validation middleware
const validateLegalSignature = [
  body('documentId').isInt().withMessage('Document ID is required'),
  body('signatureData').exists().withMessage('Signature data is required'),
  body('signatureFields').isArray().withMessage('Signature fields must be an array'),
  body('consentToSign').isBoolean().equals(true).withMessage('Consent to sign is required'),
  body('authenticationMethod').optional().isIn(['email', 'sms', 'phone', 'id_verification']).withMessage('Invalid authentication method')
];

const validateSignatureId = [
  param('signatureId').isUUID().withMessage('Invalid signature ID format')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Routes for legally binding signatures

// Create a legally binding signature
router.post('/legal', validateLegalSignature, handleValidationErrors, legalSignatureController.createLegalSignature);

// Verify a digital signature
router.get('/legal/:signatureId/verify', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const verification = await legalSignatureController.verifyDigitalSignature(req.params.signatureId);
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    next(error);
  }
});

// Get legal signature with verification
router.get('/legal/:signatureId', validateSignatureId, handleValidationErrors, legalSignatureController.getLegalSignature);

// Get certificate of completion
router.get('/legal/:signatureId/certificate', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const certificate = await legalSignatureController.getCertificate(req.params.signatureId);
    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
    }
    res.json({
      success: true,
      data: certificate
    });
  } catch (error) {
    next(error);
  }
});

// Download certificate as PDF
router.get('/legal/:signatureId/certificate/pdf', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const pdfPath = await legalSignatureController.generateCertificatePDF(req.params.signatureId);
    res.download(pdfPath, `certificate_${req.params.signatureId}.pdf`);
  } catch (error) {
    next(error);
  }
});

// Revoke a signature (for legal compliance)
router.post('/legal/:signatureId/revoke', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const { reason } = req.body;
    await legalSignatureController.revokeSignature(req.params.signatureId, reason, req.user.id);
    res.json({
      success: true,
      message: 'Signature revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get audit trail for signature
router.get('/legal/:signatureId/audit', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const auditTrail = await legalSignatureController.getAuditTrail(req.params.signatureId);
    res.json({
      success: true,
      data: auditTrail
    });
  } catch (error) {
    next(error);
  }
});

// Bulk verify signatures
router.post('/legal/verify/bulk', async (req, res, next) => {
  try {
    const { signatureIds } = req.body;
    
    if (!Array.isArray(signatureIds) || signatureIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'signatureIds must be a non-empty array'
      });
    }

    const verifications = await Promise.all(
      signatureIds.map(id => legalSignatureController.verifyDigitalSignature(id))
    );

    res.json({
      success: true,
      data: verifications
    });
  } catch (error) {
    next(error);
  }
});

// Get user's certificates
router.get('/certificates', async (req, res, next) => {
  try {
    const certificates = await legalSignatureController.getUserCertificates(req.user.id);
    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    next(error);
  }
});

// Check document integrity
router.get('/integrity/:documentId', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const integrity = await legalSignatureController.checkDocumentIntegrity(documentId);
    res.json({
      success: true,
      data: integrity
    });
  } catch (error) {
    next(error);
  }
});

// Generate compliance report
router.get('/compliance/:signatureId', validateSignatureId, handleValidationErrors, async (req, res, next) => {
  try {
    const complianceReport = await legalSignatureController.generateComplianceReport(req.params.signatureId);
    res.json({
      success: true,
      data: complianceReport
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
