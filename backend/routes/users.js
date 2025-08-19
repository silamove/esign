const express = require('express');
const { body, validationResult } = require('express-validator');
const { adminOnly } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// Validation middleware
const validateProfileUpdate = [
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail()
];

const validatePasswordChange = [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

// User routes
router.get('/profile', userController.getProfile);
router.put('/profile', validateProfileUpdate, handleValidationErrors, userController.updateProfile);
router.put('/password', validatePasswordChange, handleValidationErrors, userController.changePassword);
router.get('/signatures', userController.getSignatures);
router.get('/documents', userController.getDocuments);
router.get('/stats', userController.getStats);

// Admin routes
router.get('/admin/all', adminOnly, userController.getAllUsers);
router.put('/admin/:id', adminOnly, userController.updateUser);
router.delete('/admin/:id', adminOnly, userController.deleteUser);

module.exports = router;
