const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Seed Smart Templates with AI-powered features
 * This showcases our unique differentiators from DocuSign
 */
async function seedSmartTemplates() {
  console.log('🧠 Seeding Smart Templates with AI features...');

  try {
    // Initialize database connection
    await db.initialize();
    
    // Get admin and demo users
    const adminUser = await db.get('SELECT * FROM users WHERE email = ?', ['admin@pdfsign.com']);
    const demoUser = await db.get('SELECT * FROM users WHERE email = ?', ['demo@pdfsign.com']);

    if (!adminUser || !demoUser) {
      console.log('❌ Admin or demo user not found. Please run user seeder first.');
      return;
    }

    // Smart Template 1: AI-Optimized NDA with Collaborative Features
    const ndaTemplate = await createSmartTemplate({
      userId: adminUser.id,
      name: 'AI-Optimized Non-Disclosure Agreement',
      description: 'Intelligent NDA template with AI-powered field positioning, collaborative editing, and industry-specific optimizations. Features automatic role detection and smart compliance suggestions.',
      category: 'legal',
      categoryId: 4, // Legal category
      isPublic: true,
      isPublished: true,
      smartTemplateEnabled: true,
      aiOptimizationLevel: 'enterprise',
      templateData: {
        envelope: {
          title: 'Non-Disclosure Agreement',
          subject: 'Please review and sign the NDA',
          message: 'This NDA has been optimized using AI for faster completion and better compliance.',
          priority: 'medium',
          reminderFrequency: 'daily',
          isSequential: false,
          autoReminderEnabled: true,
          complianceLevel: 'standard'
        }
      },
      tags: ['nda', 'legal', 'ai-optimized', 'collaborative'],
      requiresAuthentication: false,
      complianceFeatures: {
        gdprCompliant: true,
        hipaaReady: false,
        soxCompliant: false,
        auditTrail: true
      },
      estimatedTime: 3,
      difficultyLevel: 'easy'
    });

    // Add smart template intelligence
    await createSmartTemplateIntelligence(ndaTemplate.id, {
      aiModel: 'smart-v1',
      learningData: {
        documentAnalysis: [
          {
            documentType: 'pdf',
            analysisDate: new Date().toISOString(),
            suggestionsCount: 8,
            patterns: ['signature', 'date', 'name', 'company']
          }
        ]
      },
      optimizationScore: 95,
      usagePatterns: {
        averageCompletionTime: 180,
        peakUsageHours: [9, 10, 14, 15],
        commonModifications: ['title_field', 'term_length']
      },
      fieldSuggestions: [
        {
          fieldType: 'signature',
          confidence: 0.95,
          suggestedLabel: 'Company Representative Signature',
          estimatedPosition: { page: 1, x: 0.7, y: 0.8, width: 0.2, height: 0.05 }
        },
        {
          fieldType: 'date',
          confidence: 0.88,
          suggestedLabel: 'Agreement Date',
          estimatedPosition: { page: 1, x: 0.7, y: 0.85, width: 0.15, height: 0.04 }
        }
      ],
      recipientIntelligence: {
        'legal@company.com': {
          totalAssignments: 15,
          roleHistory: { 'legal_reviewer': 12, 'signer': 3 },
          mostCommonRole: 'legal_reviewer',
          roleConfidence: 0.8,
          averageCompletionTime: 240
        }
      },
      performanceMetrics: {
        totalCompletions: 150,
        averageCompletionTime: 180,
        errorRate: 0.05,
        completionRate: 0.96,
        averageFieldInteractions: 8
      }
    });

    // Add roles for NDA template
    const companyRole = await addTemplateRole(ndaTemplate.id, {
      roleName: 'company_representative',
      displayName: 'Company Representative',
      description: 'Person signing on behalf of the company',
      roleType: 'signer',
      routingOrder: 1,
      permissions: { canSign: true, canView: true, canDownload: true },
      authenticationMethod: 'email',
      isRequired: true,
      customMessage: 'Please sign this NDA to proceed with our business discussions.',
      sendReminders: true
    });

    const recipientRole = await addTemplateRole(ndaTemplate.id, {
      roleName: 'receiving_party',
      displayName: 'Receiving Party',
      description: 'Individual or organization receiving confidential information',
      roleType: 'signer',
      routingOrder: 2,
      permissions: { canSign: true, canView: true, canDownload: true },
      authenticationMethod: 'email',
      isRequired: true,
      customMessage: 'Please review and sign this NDA agreement.',
      sendReminders: true
    });

    // Add smart fields with AI positioning
    await addTemplateField(ndaTemplate.id, companyRole.id, {
      fieldType: 'signature',
      fieldName: 'company_signature',
      displayName: 'Company Signature',
      x: 0.1, y: 0.75, width: 0.25, height: 0.06, page: 1,
      isRequired: true,
      aiSuggested: true,
      confidenceScore: 0.95,
      autoPositioning: true
    });

    await addTemplateField(ndaTemplate.id, companyRole.id, {
      fieldType: 'full_name',
      fieldName: 'company_rep_name',
      displayName: 'Company Representative Name',
      x: 0.1, y: 0.82, width: 0.25, height: 0.04, page: 1,
      isRequired: true,
      aiSuggested: true,
      confidenceScore: 0.92
    });

    await addTemplateField(ndaTemplate.id, recipientRole.id, {
      fieldType: 'signature',
      fieldName: 'recipient_signature',
      displayName: 'Recipient Signature',
      x: 0.6, y: 0.75, width: 0.25, height: 0.06, page: 1,
      isRequired: true,
      aiSuggested: true,
      confidenceScore: 0.95,
      autoPositioning: true
    });

    await addTemplateField(ndaTemplate.id, recipientRole.id, {
      fieldType: 'date',
      fieldName: 'signature_date',
      displayName: 'Date Signed',
      x: 0.6, y: 0.82, width: 0.15, height: 0.04, page: 1,
      isRequired: true,
      defaultValue: 'Today',
      aiSuggested: true,
      confidenceScore: 0.88
    });

    console.log('✅ Created AI-Optimized NDA template with smart features');

    // Smart Template 2: Real Estate Purchase Agreement with Industry Intelligence
    const realEstateTemplate = await createSmartTemplate({
      userId: adminUser.id,
      name: 'Smart Real Estate Purchase Agreement',
      description: 'Industry-optimized real estate template with AI-powered compliance checking, collaborative buyer-seller workflow, and intelligent field validation.',
      category: 'real_estate',
      categoryId: 1, // Real Estate category
      isPublic: true,
      isPublished: true,
      smartTemplateEnabled: true,
      aiOptimizationLevel: 'advanced',
      templateData: {
        envelope: {
          title: 'Real Estate Purchase Agreement',
          subject: 'Purchase Agreement - Property at [Property Address]',
          message: 'This purchase agreement has been optimized for real estate transactions with smart validation and compliance features.',
          priority: 'high',
          reminderFrequency: 'daily',
          isSequential: true,
          autoReminderEnabled: true,
          complianceLevel: 'standard'
        }
      },
      tags: ['real-estate', 'purchase-agreement', 'ai-optimized', 'industry-specific'],
      requiresAuthentication: true,
      complianceFeatures: {
        stateComplianceChecking: true,
        propertyDisclosureValidation: true,
        titleInsuranceIntegration: true
      },
      estimatedTime: 8,
      difficultyLevel: 'medium'
    });

    // Add roles for real estate template
    const buyerRole = await addTemplateRole(realEstateTemplate.id, {
      roleName: 'buyer',
      displayName: 'Property Buyer',
      description: 'Individual or entity purchasing the property',
      roleType: 'signer',
      routingOrder: 1,
      permissions: { canSign: true, canView: true, canDownload: true, canEdit: false },
      authenticationMethod: 'email',
      isRequired: true,
      customMessage: 'Please review the purchase terms and sign to proceed with the property acquisition.',
      sendReminders: true
    });

    const sellerRole = await addTemplateRole(realEstateTemplate.id, {
      roleName: 'seller',
      displayName: 'Property Seller',
      description: 'Current owner of the property being sold',
      roleType: 'signer',
      routingOrder: 2,
      permissions: { canSign: true, canView: true, canDownload: true },
      authenticationMethod: 'email',
      isRequired: true,
      customMessage: 'Please review and sign to confirm the sale of your property.',
      sendReminders: true
    });

    const agentRole = await addTemplateRole(realEstateTemplate.id, {
      roleName: 'real_estate_agent',
      displayName: 'Real Estate Agent',
      description: 'Licensed real estate professional facilitating the transaction',
      roleType: 'viewer',
      routingOrder: 3,
      permissions: { canView: true, canDownload: true },
      authenticationMethod: 'email',
      isRequired: false,
      customMessage: 'Please witness this real estate transaction.',
      sendReminders: false
    });

    console.log('✅ Created Smart Real Estate template with industry optimization');

    // Smart Template 3: Employment Agreement with HR Intelligence
    const employmentTemplate = await createSmartTemplate({
      userId: demoUser.id,
      name: 'AI-Enhanced Employment Agreement',
      description: 'HR-optimized employment contract with intelligent onboarding workflow, automated compliance checking, and smart benefit calculations.',
      category: 'hr',
      categoryId: 3, // HR category
      isPublic: false,
      isPublished: false,
      smartTemplateEnabled: true,
      aiOptimizationLevel: 'standard',
      templateData: {
        envelope: {
          title: 'Employment Agreement - [Employee Name]',
          subject: 'Welcome to the team! Please complete your employment agreement.',
          message: 'This employment agreement includes smart features for faster onboarding and compliance.',
          priority: 'medium',
          reminderFrequency: 'daily',
          isSequential: false,
          autoReminderEnabled: true,
          complianceLevel: 'hipaa'
        }
      },
      tags: ['employment', 'hr', 'onboarding', 'ai-enhanced'],
      requiresAuthentication: false,
      complianceFeatures: {
        i9Compliance: true,
        equalOpportunityCompliance: true,
        benefitsEligibilityCheck: true
      },
      estimatedTime: 6,
      difficultyLevel: 'easy'
    });

    console.log('✅ Created AI-Enhanced Employment Agreement template');

    // Smart Template 4: Business Contract with Collaborative Features
    const businessTemplate = await createSmartTemplate({
      userId: adminUser.id,
      name: 'Collaborative Business Service Agreement',
      description: 'Advanced business contract template with real-time collaborative editing, AI-powered clause suggestions, and intelligent negotiation tracking.',
      category: 'business',
      categoryId: 2, // Business category
      isPublic: true,
      isPublished: true,
      smartTemplateEnabled: true,
      aiOptimizationLevel: 'enterprise',
      templateData: {
        envelope: {
          title: 'Business Service Agreement',
          subject: 'Service Agreement for [Project Name]',
          message: 'Collaborative business agreement with AI-powered features for efficient negotiations.',
          priority: 'medium',
          reminderFrequency: 'weekly',
          isSequential: false,
          autoReminderEnabled: true,
          complianceLevel: 'sox'
        }
      },
      tags: ['business', 'service-agreement', 'collaborative', 'ai-powered'],
      requiresAuthentication: true,
      complianceFeatures: {
        contractAnalytics: true,
        clauseIntelligence: true,
        negotiationTracking: true
      },
      estimatedTime: 12,
      difficultyLevel: 'hard'
    });

    console.log('✅ Created Collaborative Business Service Agreement template');

    // Create some template optimization suggestions
    await createOptimizationSuggestions(ndaTemplate.id);
    await createOptimizationSuggestions(realEstateTemplate.id);

    console.log('🎯 Smart Templates seeded successfully with AI features!');
    console.log(`   📋 Templates created: 4`);
    console.log(`   🤖 AI optimizations: Active`);
    console.log(`   👥 Collaborative features: Enabled`);
    console.log(`   📊 Industry intelligence: Integrated`);
    
  } catch (error) {
    console.error('❌ Error seeding smart templates:', error);
  }
}

// Helper functions
async function createSmartTemplate(templateData) {
  const uuid = uuidv4();
  const result = await db.run(
    `INSERT INTO envelope_templates (
      uuid, user_id, name, description, category, category_id, is_public, is_published,
      template_data, tags, requires_authentication, compliance_features, 
      estimated_time, difficulty_level, smart_template_enabled, ai_optimization_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid, templateData.userId, templateData.name, templateData.description,
      templateData.category, templateData.categoryId, templateData.isPublic, templateData.isPublished,
      JSON.stringify(templateData.templateData), templateData.tags.join(','), 
      templateData.requiresAuthentication, JSON.stringify(templateData.complianceFeatures),
      templateData.estimatedTime, templateData.difficultyLevel,
      templateData.smartTemplateEnabled, templateData.aiOptimizationLevel
    ]
  );
  
  return { id: result.id, uuid };
}

async function createSmartTemplateIntelligence(templateId, smartData) {
  const uuid = uuidv4();
  await db.run(
    `INSERT INTO smart_templates (
      uuid, template_id, ai_model, learning_data, optimization_score, usage_patterns,
      field_suggestions, recipient_intelligence, performance_metrics
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid, templateId, smartData.aiModel, JSON.stringify(smartData.learningData),
      smartData.optimizationScore, JSON.stringify(smartData.usagePatterns),
      JSON.stringify(smartData.fieldSuggestions), JSON.stringify(smartData.recipientIntelligence),
      JSON.stringify(smartData.performanceMetrics)
    ]
  );
}

async function addTemplateRole(templateId, roleData) {
  const uuid = uuidv4();
  const result = await db.run(
    `INSERT INTO template_roles (
      uuid, template_id, role_name, display_name, description, role_type,
      routing_order, permissions, authentication_method, is_required,
      custom_message, send_reminders
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid, templateId, roleData.roleName, roleData.displayName, roleData.description,
      roleData.roleType, roleData.routingOrder, JSON.stringify(roleData.permissions),
      roleData.authenticationMethod, roleData.isRequired, roleData.customMessage,
      roleData.sendReminders
    ]
  );
  
  return { id: result.id, uuid };
}

async function addTemplateField(templateId, roleId, fieldData) {
  const uuid = uuidv4();
  await db.run(
    `INSERT INTO template_fields (
      uuid, template_id, role_id, field_type, field_name, display_name,
      x, y, width, height, page, is_required, default_value,
      ai_suggested, confidence_score, auto_positioning
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid, templateId, roleId, fieldData.fieldType, fieldData.fieldName,
      fieldData.displayName, fieldData.x, fieldData.y, fieldData.width,
      fieldData.height, fieldData.page, fieldData.isRequired, fieldData.defaultValue,
      fieldData.aiSuggested || false, fieldData.confidenceScore || 1.0,
      fieldData.autoPositioning || false
    ]
  );
}

async function createOptimizationSuggestions(templateId) {
  const suggestions = [
    {
      type: 'performance',
      priority: 'medium',
      title: 'Optimize Field Positioning',
      description: 'AI analysis suggests repositioning signature fields for better mobile experience.',
      impact: 'Could improve completion rate by 15%',
      confidence: 0.82
    },
    {
      type: 'usability',
      priority: 'low',
      title: 'Add Field Tooltips',
      description: 'Consider adding helpful tooltips to complex fields to reduce user confusion.',
      impact: 'Better user experience',
      confidence: 0.75
    }
  ];

  for (const suggestion of suggestions) {
    await db.run(
      `INSERT INTO template_optimization_suggestions (
        template_id, suggestion_type, priority, title, description,
        impact_description, ai_confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId, suggestion.type, suggestion.priority, suggestion.title,
        suggestion.description, suggestion.impact, suggestion.confidence
      ]
    );
  }
}

// Run the seeder
if (require.main === module) {
  seedSmartTemplates().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { seedSmartTemplates };
