const express = require('express');
const router = express.Router();
const SmartTemplate = require('../models/SmartTemplate');
const TemplateBuilder = require('../models/TemplateBuilder');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Initialize smart template for a template
router.post('/:id/smart/initialize', async (req, res) => {
  try {
    const templateId = req.params.id;
    
    // Check if smart template already exists
    let smartTemplate = await SmartTemplate.findByTemplateId(templateId);
    
    if (!smartTemplate) {
      smartTemplate = await SmartTemplate.create({
        templateId,
        aiModel: 'smart-v1',
        learningData: {},
        usagePatterns: {},
        fieldSuggestions: [],
        recipientIntelligence: {},
        performanceMetrics: {
          totalCompletions: 0,
          averageCompletionTime: 0,
          errorRate: 0,
          completionRate: 1.0
        }
      });
    }

    res.json(smartTemplate.toJSON());
  } catch (error) {
    console.error('Error initializing smart template:', error);
    res.status(500).json({ error: 'Failed to initialize smart template' });
  }
});

// Analyze document for AI field suggestions
router.post('/:id/smart/analyze-document', async (req, res) => {
  try {
    const { documentContent, documentType = 'pdf' } = req.body;
    
    if (!documentContent) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    const smartTemplate = await SmartTemplate.findByTemplateId(req.params.id);
    if (!smartTemplate) {
      return res.status(404).json({ error: 'Smart template not found' });
    }

    const suggestions = await smartTemplate.analyzeDocumentForFields(documentContent, documentType);
    
    res.json({
      suggestions,
      confidence: suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length,
      totalSuggestions: suggestions.length
    });
  } catch (error) {
    console.error('Error analyzing document:', error);
    res.status(500).json({ error: 'Failed to analyze document' });
  }
});

// Get smart role assignment suggestions
router.post('/:id/smart/suggest-roles', async (req, res) => {
  try {
    const { recipientEmails } = req.body;
    
    if (!recipientEmails || !Array.isArray(recipientEmails)) {
      return res.status(400).json({ error: 'Recipient emails array is required' });
    }

    const smartTemplate = await SmartTemplate.findByTemplateId(req.params.id);
    if (!smartTemplate) {
      return res.status(404).json({ error: 'Smart template not found' });
    }

    const suggestions = await smartTemplate.suggestRoleAssignments(recipientEmails);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating role suggestions:', error);
    res.status(500).json({ error: 'Failed to generate role suggestions' });
  }
});

// Get template optimization suggestions
router.get('/:id/smart/optimization-suggestions', async (req, res) => {
  try {
    const smartTemplate = await SmartTemplate.findByTemplateId(req.params.id);
    if (!smartTemplate) {
      return res.status(404).json({ error: 'Smart template not found' });
    }

    const suggestions = await smartTemplate.generateOptimizationSuggestions();
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating optimization suggestions:', error);
    res.status(500).json({ error: 'Failed to generate optimization suggestions' });
  }
});

// Template Builder Routes

// Initialize collaborative template builder session
router.post('/:id/builder/session', async (req, res) => {
  try {
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    const collaborators = await templateBuilder.initializeSession();
    
    res.json({
      sessionId: templateBuilder.sessionId,
      collaborators,
      userId: req.user.id
    });
  } catch (error) {
    console.error('Error initializing builder session:', error);
    res.status(500).json({ error: 'Failed to initialize builder session' });
  }
});

// Add field with AI positioning
router.post('/:id/builder/fields', async (req, res) => {
  try {
    const { fieldData, documentContent } = req.body;
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    
    const field = await templateBuilder.addFieldWithAI(fieldData, documentContent);
    
    res.status(201).json(field.toJSON());
  } catch (error) {
    console.error('Error adding field:', error);
    res.status(500).json({ error: 'Failed to add field' });
  }
});

// Update field position with smart positioning
router.put('/:id/builder/fields/:fieldId/position', async (req, res) => {
  try {
    const { position } = req.body;
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    
    const updatedField = await templateBuilder.updateFieldPosition(req.params.fieldId, position);
    
    res.json(updatedField.toJSON());
  } catch (error) {
    console.error('Error updating field position:', error);
    res.status(500).json({ error: 'Failed to update field position' });
  }
});

// Generate role assignment suggestions for builder
router.post('/:id/builder/suggest-role-assignments', async (req, res) => {
  try {
    const { recipientEmails } = req.body;
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    
    const suggestions = await templateBuilder.generateRoleAssignmentSuggestions(recipientEmails);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating role assignment suggestions:', error);
    res.status(500).json({ error: 'Failed to generate role assignment suggestions' });
  }
});

// Create template branch for A/B testing
router.post('/:id/builder/branch', async (req, res) => {
  try {
    const { branchName, description } = req.body;
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    
    const branchedTemplate = await templateBuilder.createBranch(branchName, description);
    
    res.status(201).json(branchedTemplate.toJSON());
  } catch (error) {
    console.error('Error creating template branch:', error);
    res.status(500).json({ error: 'Failed to create template branch' });
  }
});

// Get optimization suggestions for builder
router.get('/:id/builder/optimization', async (req, res) => {
  try {
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    const suggestions = await templateBuilder.getOptimizationSuggestions();
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting optimization suggestions:', error);
    res.status(500).json({ error: 'Failed to get optimization suggestions' });
  }
});

// Get industry recommendations
router.get('/:id/builder/industry-recommendations', async (req, res) => {
  try {
    const { industry, documentType } = req.query;
    
    if (!industry || !documentType) {
      return res.status(400).json({ error: 'Industry and document type are required' });
    }

    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    const recommendations = await templateBuilder.getIndustryRecommendations(industry, documentType);
    
    res.json(recommendations || { message: 'No specific recommendations found for this industry/document type combination' });
  } catch (error) {
    console.error('Error getting industry recommendations:', error);
    res.status(500).json({ error: 'Failed to get industry recommendations' });
  }
});

// Get template analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id);
    
    const analytics = await templateBuilder.getTemplateAnalytics(timeRange);
    
    res.json(analytics);
  } catch (error) {
    console.error('Error getting template analytics:', error);
    res.status(500).json({ error: 'Failed to get template analytics' });
  }
});

// Record template learning event
router.post('/:id/smart/learning-event', async (req, res) => {
  try {
    const { eventType, eventData, confidenceScore, userFeedback } = req.body;
    
    if (!eventType || !eventData) {
      return res.status(400).json({ error: 'Event type and data are required' });
    }

    const db = require('../models/database');
    await db.run(
      `INSERT INTO template_learning_events (
        template_id, event_type, event_data, confidence_score, user_feedback
      ) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, eventType, JSON.stringify(eventData), confidenceScore || 0.5, userFeedback]
    );

    res.json({ message: 'Learning event recorded successfully' });
  } catch (error) {
    console.error('Error recording learning event:', error);
    res.status(500).json({ error: 'Failed to record learning event' });
  }
});

// Get available template categories with AI insights
router.get('/categories/smart', async (req, res) => {
  try {
    const db = require('../models/database');
    
    // Get categories with market intelligence
    const categories = await db.all(`
      SELECT 
        tc.*,
        tmi.best_practices,
        tmi.common_patterns,
        tmi.compliance_requirements,
        COUNT(et.id) as template_count,
        AVG(st.optimization_score) as avg_optimization_score
      FROM template_categories tc
      LEFT JOIN template_market_intelligence tmi ON tc.name = tmi.template_category
      LEFT JOIN envelope_templates et ON tc.id = et.category_id
      LEFT JOIN smart_templates st ON et.id = st.template_id
      WHERE tc.is_active = 1
      GROUP BY tc.id
      ORDER BY tc.sort_order ASC
    `);

    const result = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      displayName: cat.display_name,
      description: cat.description,
      icon: cat.icon,
      templateCount: cat.template_count || 0,
      avgOptimizationScore: cat.avg_optimization_score || 75,
      marketIntelligence: {
        bestPractices: cat.best_practices ? JSON.parse(cat.best_practices) : {},
        commonPatterns: cat.common_patterns ? JSON.parse(cat.common_patterns) : {},
        complianceRequirements: cat.compliance_requirements ? JSON.parse(cat.compliance_requirements) : {}
      }
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching smart categories:', error);
    res.status(500).json({ error: 'Failed to fetch smart categories' });
  }
});

// End builder session
router.delete('/:id/builder/session/:sessionId', async (req, res) => {
  try {
    const templateBuilder = new TemplateBuilder(req.params.id, req.user.id, req.params.sessionId);
    await templateBuilder.endSession();
    
    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('Error ending builder session:', error);
    res.status(500).json({ error: 'Failed to end builder session' });
  }
});

module.exports = router;
