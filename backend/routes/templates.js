const express = require('express');
const router = express.Router();
const EnvelopeTemplate = require('../models/EnvelopeTemplate');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all templates for user (including public ones)
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      includePublic = 'true', 
      limit = 50, 
      offset = 0 
    } = req.query;

    let templates;

    if (search) {
      templates = await EnvelopeTemplate.search(
        search, 
        req.user.id, 
        includePublic === 'true',
        parseInt(limit)
      );
    } else if (category) {
      if (includePublic === 'true') {
        const [userTemplates, publicTemplates] = await Promise.all([
          EnvelopeTemplate.findByUserId(req.user.id, parseInt(limit), parseInt(offset)),
          EnvelopeTemplate.findPublic(category, parseInt(limit), parseInt(offset))
        ]);
        templates = [...userTemplates, ...publicTemplates.filter(t => 
          !userTemplates.some(ut => ut.id === t.id)
        )];
      } else {
        templates = await EnvelopeTemplate.findByUserId(req.user.id, parseInt(limit), parseInt(offset));
        templates = templates.filter(t => t.category === category);
      }
    } else {
      if (includePublic === 'true') {
        const [userTemplates, publicTemplates] = await Promise.all([
          EnvelopeTemplate.findByUserId(req.user.id, parseInt(limit), parseInt(offset)),
          EnvelopeTemplate.findPublic(null, parseInt(limit), parseInt(offset))
        ]);
        templates = [...userTemplates, ...publicTemplates.filter(t => 
          !userTemplates.some(ut => ut.id === t.id)
        )];
      } else {
        templates = await EnvelopeTemplate.findByUserId(req.user.id, parseInt(limit), parseInt(offset));
      }
    }

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get public templates only
router.get('/public', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    const templates = await EnvelopeTemplate.findPublic(category, parseInt(limit), parseInt(offset));
    res.json(templates);
  } catch (error) {
    console.error('Error fetching public templates:', error);
    res.status(500).json({ error: 'Failed to fetch public templates' });
  }
});

// Get template categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await EnvelopeTemplate.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get template by ID
router.get('/:id', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access (owner or public template)
    if (template.userId !== req.user.id && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', async (req, res) => {
  try {
    const { name, description, category, isPublic, templateData, tags } = req.body;

    if (!name || !templateData) {
      return res.status(400).json({ error: 'Name and template data are required' });
    }

    const template = await EnvelopeTemplate.create({
      userId: req.user.id,
      name,
      description,
      category,
      isPublic,
      templateData,
      tags
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, category, isPublic, templateData, tags } = req.body;
    
    const updatedTemplate = await template.update({
      name,
      description,
      category,
      isPublic,
      templateData,
      tags
    });

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await template.delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Clone template (create a copy for current user)
router.post('/:id/clone', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const originalTemplate = await EnvelopeTemplate.findById(req.params.id);
    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access (owner or public template)
    if (originalTemplate.userId !== req.user.id && !originalTemplate.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const clonedTemplate = await EnvelopeTemplate.create({
      userId: req.user.id,
      name: name || `${originalTemplate.name} (Copy)`,
      description: description || originalTemplate.description,
      category: originalTemplate.category,
      isPublic: false, // Cloned templates are private by default
      templateData: originalTemplate.templateData,
      tags: [...originalTemplate.tags, 'cloned']
    });

    res.status(201).json(clonedTemplate);
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// Preview template (get template data without creating envelope)
router.get('/:id/preview', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access (owner or public template)
    if (template.userId !== req.user.id && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return template structure for preview
    const preview = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      envelope: template.templateData.envelope,
      documentsRequired: template.templateData.documents?.length || 0,
      recipientsRequired: template.templateData.recipients?.length || 0,
      signatureFieldsCount: template.templateData.signatureFields?.length || 0,
      estimatedTime: template.templateData.signatureFields?.length * 2 || 5 // Rough estimate in minutes
    };

    res.json(preview);
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// Get template usage statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get envelopes created from this template
    const db = require('../models/database');
    const envelopes = await db.all(
      `SELECT status, created_at FROM envelopes 
       WHERE JSON_EXTRACT(metadata, '$.templateId') = ?`,
      [template.id]
    );

    const stats = {
      totalUsage: template.usageCount,
      envelopesCreated: envelopes.length,
      statusBreakdown: envelopes.reduce((acc, env) => {
        acc[env.status] = (acc[env.status] || 0) + 1;
        return acc;
      }, {}),
      recentUsage: envelopes.filter(env => 
        new Date(env.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({ error: 'Failed to fetch template stats' });
  }
});

module.exports = router;
