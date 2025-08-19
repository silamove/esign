const express = require('express');
const { body, param, validationResult } = require('express-validator');
const signatureController = require('../controllers/signatureController');

const router = express.Router();

// Validation middleware
const validateCreateSignature = [
  body('name').trim().isLength({ min: 1 }).withMessage('Signature name is required'),
  body('signatureData').exists().withMessage('Signature data is required'),
  body('type').optional().isIn(['signature', 'initials']).withMessage('Invalid signature type')
];

const validateUpdateSignature = [
  param('id').isInt().withMessage('Invalid signature ID'),
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Signature name cannot be empty'),
  body('signatureData').optional().exists().withMessage('Signature data cannot be empty'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean')
];

const validateSignatureId = [
  param('id').isInt().withMessage('Invalid signature ID')
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

// Routes
router.get('/', signatureController.getSignatures);
router.post('/', validateCreateSignature, handleValidationErrors, signatureController.createSignature);
router.get('/default', signatureController.getDefault);
router.get('/:id', validateSignatureId, handleValidationErrors, signatureController.getSignature);
router.put('/:id', validateUpdateSignature, handleValidationErrors, signatureController.updateSignature);
router.delete('/:id', validateSignatureId, handleValidationErrors, signatureController.deleteSignature);
router.post('/:id/default', validateSignatureId, handleValidationErrors, signatureController.setDefault);

module.exports = router;
