const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * TemplateBuilder - Real-time collaborative template builder
 * Unique features:
 * 1. Real-time collaborative editing with live cursors
 * 2. Smart field suggestions based on document content
 * 3. Drag-and-drop with snap-to-grid and alignment guides
 * 4. Template versioning with branching and merging
 * 5. AI-powered layout optimization
 * 6. Industry-specific template recommendations
 */
class TemplateBuilder {
  constructor(templateId, userId, sessionId = null) {
    this.templateId = templateId;
    this.userId = userId;
    this.sessionId = sessionId || uuidv4();
    this.collaborators = new Map();
    this.changeBuffer = [];
    this.version = 1;
  }

  // Initialize collaborative session
  async initializeSession() {
    // Register this user as a collaborator
    await db.run(
      `INSERT OR REPLACE INTO template_collaborations 
       (template_id, user_id, session_id, collaboration_type, is_online, last_heartbeat)
       VALUES (?, ?, ?, 'edit', 1, CURRENT_TIMESTAMP)`,
      [this.templateId, this.userId, this.sessionId]
    );

    // Get other active collaborators
    const collaborators = await db.all(
      `SELECT tc.*, u.email, u.first_name, u.last_name
       FROM template_collaborations tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.template_id = ? AND tc.is_online = 1 AND tc.user_id != ?`,
      [this.templateId, this.userId]
    );

    return collaborators;
  }

  // Real-time field addition with AI suggestions
  async addFieldWithAI(fieldData, documentContent = null) {
    const field = {
      id: uuidv4(),
      ...fieldData,
      aiSuggested: false,
      confidenceScore: 1.0,
      timestamp: Date.now()
    };

    // If document content is provided, get AI suggestions for positioning
    if (documentContent) {
      const smartTemplate = await this.getSmartTemplate();
      if (smartTemplate) {
        const suggestions = await smartTemplate.analyzeDocumentForFields(documentContent);
        const relevantSuggestion = suggestions.find(s => s.fieldType === fieldData.fieldType);
        
        if (relevantSuggestion && relevantSuggestion.confidence > 0.7) {
          field.x = relevantSuggestion.estimatedPosition.x;
          field.y = relevantSuggestion.estimatedPosition.y;
          field.width = relevantSuggestion.estimatedPosition.width;
          field.height = relevantSuggestion.estimatedPosition.height;
          field.aiSuggested = true;
          field.confidenceScore = relevantSuggestion.confidence;
        }
      }
    }

    // Add to database
    const TemplateField = require('./TemplateField');
    const createdField = await TemplateField.create({
      templateId: this.templateId,
      ...field,
      aiSuggested: field.aiSuggested,
      confidenceScore: field.confidenceScore
    });

    // Broadcast to collaborators
    await this.broadcastChange({
      type: 'field_added',
      field: createdField.toJSON(),
      userId: this.userId,
      timestamp: Date.now()
    });

    return createdField;
  }

  // Smart field positioning with snap-to-grid and alignment
  async updateFieldPosition(fieldId, newPosition) {
    const { x, y, width, height } = newPosition;
    
    // Apply smart positioning logic
    const optimizedPosition = await this.optimizeFieldPosition({
      x, y, width, height,
      fieldId
    });

    // Update field
    const TemplateField = require('./TemplateField');
    const field = await TemplateField.findById(fieldId);
    if (!field) throw new Error('Field not found');

    const updatedField = await field.update(optimizedPosition);

    // Broadcast change
    await this.broadcastChange({
      type: 'field_moved',
      fieldId,
      oldPosition: { x: field.x, y: field.y, width: field.width, height: field.height },
      newPosition: optimizedPosition,
      userId: this.userId,
      timestamp: Date.now()
    });

    return updatedField;
  }

  // Smart positioning optimization
  async optimizeFieldPosition(position) {
    const { x, y, width, height, fieldId } = position;
    
    // Get all other fields on the same page
    const TemplateField = require('./TemplateField');
    const fields = await TemplateField.findByTemplateId(this.templateId);
    const currentField = fields.find(f => f.id === fieldId);
    const otherFields = fields.filter(f => f.id !== fieldId && f.page === currentField?.page);

    let optimizedX = x;
    let optimizedY = y;

    // Snap to grid (8px grid)
    const gridSize = 8 / 1000; // Relative to page size
    optimizedX = Math.round(optimizedX / gridSize) * gridSize;
    optimizedY = Math.round(optimizedY / gridSize) * gridSize;

    // Alignment guides - snap to other fields
    const snapThreshold = 5 / 1000; // 5px tolerance

    for (const field of otherFields) {
      // Horizontal alignment
      if (Math.abs(optimizedX - field.x) < snapThreshold) {
        optimizedX = field.x; // Left align
      } else if (Math.abs(optimizedX + width - (field.x + field.width)) < snapThreshold) {
        optimizedX = field.x + field.width - width; // Right align
      } else if (Math.abs(optimizedX + width/2 - (field.x + field.width/2)) < snapThreshold) {
        optimizedX = field.x + field.width/2 - width/2; // Center align
      }

      // Vertical alignment
      if (Math.abs(optimizedY - field.y) < snapThreshold) {
        optimizedY = field.y; // Top align
      } else if (Math.abs(optimizedY + height - (field.y + field.height)) < snapThreshold) {
        optimizedY = field.y + field.height - height; // Bottom align
      } else if (Math.abs(optimizedY + height/2 - (field.y + field.height/2)) < snapThreshold) {
        optimizedY = field.y + field.height/2 - height/2; // Middle align
      }
    }

    // Ensure field stays within page bounds
    optimizedX = Math.max(0, Math.min(1 - width, optimizedX));
    optimizedY = Math.max(0, Math.min(1 - height, optimizedY));

    return {
      x: optimizedX,
      y: optimizedY,
      width,
      height
    };
  }

  // AI-powered role suggestions
  async generateRoleAssignmentSuggestions(recipientEmails) {
    const smartTemplate = await this.getSmartTemplate();
    if (!smartTemplate) return [];

    const suggestions = await smartTemplate.suggestRoleAssignments(recipientEmails);
    
    // Store suggestions for learning
    for (const suggestion of suggestions) {
      await db.run(
        `INSERT INTO smart_role_suggestions (
          template_id, suggested_for_email, suggested_role, confidence_score,
          reasoning, alternative_roles
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          this.templateId,
          suggestion.email,
          suggestion.suggestedRole,
          suggestion.confidence,
          suggestion.reasoning,
          JSON.stringify(suggestion.alternativeRoles)
        ]
      );
    }

    return suggestions;
  }

  // Template branching for A/B testing
  async createBranch(branchName, description = '') {
    const EnvelopeTemplate = require('./EnvelopeTemplate');
    const template = await EnvelopeTemplate.findById(this.templateId);
    
    if (!template) throw new Error('Template not found');

    // Clone template with new version
    const branchedTemplate = await template.clone({
      userId: this.userId,
      name: `${template.name} - ${branchName}`,
      description: description || `Branch: ${branchName}`
    });

    // Create version record
    await branchedTemplate.createVersion({
      versionName: branchName,
      changesSummary: `Created branch: ${branchName}`,
      createdBy: this.userId
    });

    return branchedTemplate;
  }

  // Get template optimization suggestions
  async getOptimizationSuggestions() {
    const smartTemplate = await this.getSmartTemplate();
    if (!smartTemplate) return [];

    const suggestions = await smartTemplate.generateOptimizationSuggestions();
    
    // Store suggestions in database
    for (const suggestion of suggestions) {
      await db.run(
        `INSERT OR REPLACE INTO template_optimization_suggestions (
          template_id, suggestion_type, priority, title, description,
          impact_description, estimated_improvement, suggested_actions, ai_confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.templateId,
          suggestion.type,
          suggestion.priority,
          suggestion.title,
          suggestion.description,
          suggestion.impact,
          JSON.stringify({}),
          JSON.stringify([suggestion.action]),
          0.8
        ]
      );
    }

    return suggestions;
  }

  // Industry-specific template recommendations
  async getIndustryRecommendations(industry, documentType) {
    const intelligence = await db.get(
      `SELECT * FROM template_market_intelligence 
       WHERE template_category = ? AND industry_sector = ?`,
      [documentType, industry]
    );

    if (!intelligence) return null;

    const bestPractices = JSON.parse(intelligence.best_practices);
    const commonPatterns = JSON.parse(intelligence.common_patterns);

    return {
      recommendedFields: this.generateFieldRecommendations(bestPractices, commonPatterns),
      roleDistribution: commonPatterns.role_distribution,
      estimatedCompletionTime: commonPatterns.completion_time,
      complianceRequirements: JSON.parse(intelligence.compliance_requirements || '{}'),
      optimizationTips: this.generateOptimizationTips(bestPractices)
    };
  }

  // Template performance analytics
  async getTemplateAnalytics(timeRange = '30d') {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(timeRange));

    const analytics = await db.all(
      `SELECT 
         metric_type,
         AVG(metric_value) as avg_value,
         MIN(metric_value) as min_value,
         MAX(metric_value) as max_value,
         COUNT(*) as measurement_count
       FROM template_performance_analytics 
       WHERE template_id = ? AND measurement_date >= ?
       GROUP BY metric_type`,
      [this.templateId, dateThreshold.toISOString()]
    );

    const usageAnalytics = await db.all(
      `SELECT 
         action_type,
         COUNT(*) as count,
         AVG(confidence_score) as avg_confidence
       FROM template_learning_events 
       WHERE template_id = ? AND created_at >= ?
       GROUP BY action_type`,
      [this.templateId, dateThreshold.toISOString()]
    );

    return {
      performance: analytics.reduce((acc, item) => {
        acc[item.metric_type] = {
          average: item.avg_value,
          min: item.min_value,
          max: item.max_value,
          measurements: item.measurement_count
        };
        return acc;
      }, {}),
      usage: usageAnalytics.reduce((acc, item) => {
        acc[item.action_type] = {
          count: item.count,
          avgConfidence: item.avg_confidence
        };
        return acc;
      }, {}),
      optimizationScore: await this.calculateOptimizationScore()
    };
  }

  // Helper methods
  async getSmartTemplate() {
    const SmartTemplate = require('./SmartTemplate');
    return await SmartTemplate.findByTemplateId(this.templateId);
  }

  async broadcastChange(change) {
    // In a real implementation, this would use WebSockets
    await db.run(
      `UPDATE template_collaborations 
       SET live_changes = json_insert(live_changes, '$[#]', ?),
           last_heartbeat = CURRENT_TIMESTAMP
       WHERE template_id = ? AND session_id = ?`,
      [JSON.stringify(change), this.templateId, this.sessionId]
    );
  }

  generateFieldRecommendations(bestPractices, commonPatterns) {
    const recommendations = [];
    
    if (bestPractices.required_fields) {
      for (const fieldType of bestPractices.required_fields) {
        recommendations.push({
          fieldType,
          required: true,
          reasoning: 'Industry standard required field',
          confidence: 0.9
        });
      }
    }

    return recommendations;
  }

  generateOptimizationTips(bestPractices) {
    const tips = [];
    
    if (bestPractices.field_placement === 'right_margin_preferred') {
      tips.push('Consider placing signature fields in the right margin for better user experience');
    }
    
    if (bestPractices.mobile_optimization === 'critical') {
      tips.push('Ensure all fields are large enough for mobile devices (minimum 44px touch target)');
    }

    return tips;
  }

  async calculateOptimizationScore() {
    const smartTemplate = await this.getSmartTemplate();
    return smartTemplate ? smartTemplate.optimizationScore : 75;
  }

  // Clean up session
  async endSession() {
    await db.run(
      `UPDATE template_collaborations 
       SET is_online = 0, left_at = CURRENT_TIMESTAMP
       WHERE template_id = ? AND session_id = ?`,
      [this.templateId, this.sessionId]
    );
  }
}

module.exports = TemplateBuilder;
