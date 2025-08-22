const express = require('express');
const router = express.Router();
const EnvelopeType = require('../models/EnvelopeType');
const { authMiddleware } = require('../middleware/auth');

// Get all envelope types
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category, active } = req.query;
    
    const options = {};
    if (category) options.category = category;
    if (active !== undefined) options.isActive = active === 'true';

    const envelopeTypes = await EnvelopeType.findAll(options);
    
    res.json({
      success: true,
      data: envelopeTypes
    });
  } catch (error) {
    console.error('Error fetching envelope types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch envelope types',
      error: error.message
    });
  }
});

// Get envelope types by category
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await EnvelopeType.getCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching envelope type categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get envelope types by specific category
router.get('/category/:category', authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const envelopeTypes = await EnvelopeType.findByCategory(category);
    
    res.json({
      success: true,
      data: envelopeTypes
    });
  } catch (error) {
    console.error('Error fetching envelope types by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch envelope types for category',
      error: error.message
    });
  }
});

// Get single envelope type
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const envelopeType = await EnvelopeType.findById(id);
    
    if (!envelopeType) {
      return res.status(404).json({
        success: false,
        message: 'Envelope type not found'
      });
    }

    res.json({
      success: true,
      data: envelopeType
    });
  } catch (error) {
    console.error('Error fetching envelope type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch envelope type',
      error: error.message
    });
  }
});

// Get suggested fields for envelope type
router.get('/:id/suggested-fields', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName = 'signer' } = req.query;
    
    const envelopeType = await EnvelopeType.findById(id);
    
    if (!envelopeType) {
      return res.status(404).json({
        success: false,
        message: 'Envelope type not found'
      });
    }

    const suggestedFields = envelopeType.getSuggestedFieldsForRole(roleName);
    
    res.json({
      success: true,
      data: {
        envelopeType: envelopeType.toJSON(),
        suggestedFields
      }
    });
  } catch (error) {
    console.error('Error fetching suggested fields:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggested fields',
      error: error.message
    });
  }
});

// Create new envelope type (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create envelope types'
      });
    }

    const envelopeType = await EnvelopeType.create(req.body);
    
    res.status(201).json({
      success: true,
      data: envelopeType,
      message: 'Envelope type created successfully'
    });
  } catch (error) {
    console.error('Error creating envelope type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create envelope type',
      error: error.message
    });
  }
});

// Update envelope type (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update envelope types'
      });
    }

    const { id } = req.params;
    const envelopeType = await EnvelopeType.findById(id);
    
    if (!envelopeType) {
      return res.status(404).json({
        success: false,
        message: 'Envelope type not found'
      });
    }

    const updatedEnvelopeType = await envelopeType.update(req.body);
    
    res.json({
      success: true,
      data: updatedEnvelopeType,
      message: 'Envelope type updated successfully'
    });
  } catch (error) {
    console.error('Error updating envelope type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update envelope type',
      error: error.message
    });
  }
});

// Delete envelope type (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete envelope types'
      });
    }

    const { id } = req.params;
    const envelopeType = await EnvelopeType.findById(id);
    
    if (!envelopeType) {
      return res.status(404).json({
        success: false,
        message: 'Envelope type not found'
      });
    }

    await envelopeType.delete();
    
    res.json({
      success: true,
      message: 'Envelope type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting envelope type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete envelope type',
      error: error.message
    });
  }
});

module.exports = router;
