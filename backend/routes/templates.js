const express = require('express');
const router = express.Router();
const EnvelopeTemplate = require('../models/EnvelopeTemplate');
const TemplateRole = require('../models/TemplateRole');
const TemplateField = require('../models/TemplateField');
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

// Create new template with roles and fields
router.post('/', async (req, res) => {
  try {
    const { 
      name, description, category, categoryId, isPublic, templateData, tags,
      requiresAuthentication, complianceFeatures, estimatedTime, difficultyLevel,
      roles, fields
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const template = await EnvelopeTemplate.create({
      userId: req.user.id,
      name,
      description,
      category,
      categoryId,
      isPublic,
      templateData: templateData || {},
      tags,
      requiresAuthentication,
      complianceFeatures,
      estimatedTime,
      difficultyLevel
    });

    // Add roles if provided
    if (roles && Array.isArray(roles)) {
      for (const roleData of roles) {
        await template.addRole(roleData);
      }
    }

    // Add fields if provided
    if (fields && Array.isArray(fields)) {
      for (const fieldData of fields) {
        await template.addField(fieldData);
      }
    }

    // Return template with roles and fields
    const [templateRoles, templateFields] = await Promise.all([
      template.getRoles(),
      template.getFields()
    ]);

    const result = {
      ...template.toJSON(),
      roles: templateRoles.map(role => role.toJSON()),
      fields: templateFields.map(field => field.toJSON())
    };

    res.status(201).json(result);
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

    const clonedTemplate = await originalTemplate.clone({
      userId: req.user.id,
      name: name || `${originalTemplate.name} (Copy)`,
      description: description || originalTemplate.description
    });

    res.status(201).json(clonedTemplate);
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// Get template by ID with roles and fields
router.get('/:id', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access (owner or public template)
    if (template.userId !== req.user.id && !template.isPublic && !template.isPublished) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get roles and fields
    const [roles, fields] = await Promise.all([
      template.getRoles(),
      template.getFields()
    ]);

    const result = {
      ...template.toJSON(),
      roles: roles.map(role => role.toJSON()),
      fields: fields.map(field => field.toJSON())
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Template Roles Management

// Get template roles
router.get('/:id/roles', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const roles = await template.getRoles();
    res.json(roles.map(role => role.toJSON()));
  } catch (error) {
    console.error('Error fetching template roles:', error);
    res.status(500).json({ error: 'Failed to fetch template roles' });
  }
});

// Add role to template
router.post('/:id/roles', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const role = await template.addRole(req.body);
    res.status(201).json(role.toJSON());
  } catch (error) {
    console.error('Error adding template role:', error);
    res.status(500).json({ error: 'Failed to add template role' });
  }
});

// Update template role
router.put('/:templateId/roles/:roleId', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const role = await TemplateRole.findById(req.params.roleId);
    if (!role || role.templateId !== template.id) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const updatedRole = await role.update(req.body);
    res.json(updatedRole.toJSON());
  } catch (error) {
    console.error('Error updating template role:', error);
    res.status(500).json({ error: 'Failed to update template role' });
  }
});

// Delete template role
router.delete('/:templateId/roles/:roleId', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const role = await TemplateRole.findById(req.params.roleId);
    if (!role || role.templateId !== template.id) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await role.delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template role:', error);
    res.status(500).json({ error: 'Failed to delete template role' });
  }
});

// Template Fields Management

// Get template fields
router.get('/:id/fields', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id && !template.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fields = await template.getFields();
    res.json(fields.map(field => field.toJSON()));
  } catch (error) {
    console.error('Error fetching template fields:', error);
    res.status(500).json({ error: 'Failed to fetch template fields' });
  }
});

// Add field to template
router.post('/:id/fields', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const field = await template.addField(req.body);
    res.status(201).json(field.toJSON());
  } catch (error) {
    console.error('Error adding template field:', error);
    res.status(500).json({ error: 'Failed to add template field' });
  }
});

// Update template field
router.put('/:templateId/fields/:fieldId', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const field = await TemplateField.findById(req.params.fieldId);
    if (!field || field.templateId !== template.id) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const updatedField = await field.update(req.body);
    res.json(updatedField.toJSON());
  } catch (error) {
    console.error('Error updating template field:', error);
    res.status(500).json({ error: 'Failed to update template field' });
  }
});

// Delete template field
router.delete('/:templateId/fields/:fieldId', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const field = await TemplateField.findById(req.params.fieldId);
    if (!field || field.templateId !== template.id) {
      return res.status(404).json({ error: 'Field not found' });
    }

    await field.delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template field:', error);
    res.status(500).json({ error: 'Failed to delete template field' });
  }
});

// Create envelope from template
router.post('/:id/create-envelope', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access (owner or public template)
    if (template.userId !== req.user.id && !template.isPublic && !template.isPublished) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const envelopeData = {
      ...req.body,
      userId: req.user.id
    };

    const envelope = await template.createEnvelopeFromTemplate(envelopeData);
    res.status(201).json(envelope.toJSON());
  } catch (error) {
    console.error('Error creating envelope from template:', error);
    res.status(500).json({ error: error.message || 'Failed to create envelope from template' });
  }
});

// Publish template
router.post('/:id/publish', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await template.publish();
    res.json({ message: 'Template published successfully' });
  } catch (error) {
    console.error('Error publishing template:', error);
    res.status(500).json({ error: 'Failed to publish template' });
  }
});

// Unpublish template
router.post('/:id/unpublish', async (req, res) => {
  try {
    const template = await EnvelopeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await template.unpublish();
    res.json({ message: 'Template unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing template:', error);
    res.status(500).json({ error: 'Failed to unpublish template' });
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
