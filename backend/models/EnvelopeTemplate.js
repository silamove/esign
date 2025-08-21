const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class EnvelopeTemplate {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.userId = data.user_id || data.userId;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.categoryId = data.category_id || data.categoryId;
    this.isPublic = data.is_public || data.isPublic;
    this.isPublished = data.is_published || data.isPublished;
    this.publishedAt = data.published_at || data.publishedAt;
    this.usageCount = data.usage_count || data.usageCount;
    this.version = data.version || 1;
    this.templateData = data.template_data ? JSON.parse(data.template_data) : data.templateData;
    this.thumbnailPath = data.thumbnail_path || data.thumbnailPath;
    this.tags = data.tags ? data.tags.split(',') : [];
    this.requiresAuthentication = data.requires_authentication || data.requiresAuthentication;
    this.complianceFeatures = data.compliance_features ? JSON.parse(data.compliance_features) : {};
    this.estimatedTime = data.estimated_time || data.estimatedTime || 5;
    this.difficultyLevel = data.difficulty_level || data.difficultyLevel || 'easy';
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(templateData) {
    const {
      userId,
      name,
      description = '',
      category = 'general',
      categoryId = null,
      isPublic = false,
      isPublished = false,
      templateData: template,
      tags = [],
      requiresAuthentication = false,
      complianceFeatures = {},
      estimatedTime = 5,
      difficultyLevel = 'easy'
    } = templateData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO envelope_templates (
        uuid, user_id, name, description, category, category_id, is_public, is_published,
        template_data, tags, requires_authentication, compliance_features, 
        estimated_time, difficulty_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, userId, name, description, category, categoryId, isPublic, isPublished,
        JSON.stringify(template), tags.join(','), requiresAuthentication, 
        JSON.stringify(complianceFeatures), estimatedTime, difficultyLevel
      ]
    );
    
    return this.findById(result.id);
  }

  static async createFromEnvelope(envelopeId, templateName, description = '', isPublic = false) {
    // Get envelope data
    const envelope = await db.get('SELECT * FROM envelopes WHERE id = ?', [envelopeId]);
    if (!envelope) {
      throw new Error('Envelope not found');
    }

    // Get envelope documents
    const documents = await db.all(
      `SELECT d.*, ed.document_order
       FROM documents d
       JOIN envelope_documents ed ON d.id = ed.document_id
       WHERE ed.envelope_id = ?
       ORDER BY ed.document_order ASC`,
      [envelopeId]
    );

    // Get envelope recipients (anonymize for template)
    const recipients = await db.all(
      `SELECT role, routing_order, permissions, authentication_method, custom_message, send_reminders
       FROM envelope_recipients 
       WHERE envelope_id = ? 
       ORDER BY routing_order ASC`,
      [envelopeId]
    );

    // Get signature fields (without actual signatures)
    const signatureFields = await db.all(
      `SELECT document_id, field_type, x, y, width, height, page, required, field_name, default_value, validation_rules
       FROM envelope_signatures 
       WHERE envelope_id = ?
       ORDER BY page ASC, y ASC, x ASC`,
      [envelopeId]
    );

    // Create template data structure
    const templateData = {
      envelope: {
        title: envelope.title,
        subject: envelope.subject,
        message: envelope.message,
        priority: envelope.priority,
        reminderFrequency: envelope.reminder_frequency,
        isSequential: envelope.is_sequential,
        autoReminderEnabled: envelope.auto_reminder_enabled,
        languageCode: envelope.language_code,
        timezone: envelope.timezone,
        complianceLevel: envelope.compliance_level
      },
      documents: documents.map(doc => ({
        templateDocumentId: doc.id, // Reference to use when creating from template
        order: doc.document_order,
        name: doc.original_name,
        pages: doc.total_pages
      })),
      recipients: recipients.map((recipient, index) => ({
        placeholder: `Recipient ${index + 1}`,
        role: recipient.role,
        routingOrder: recipient.routing_order,
        permissions: JSON.parse(recipient.permissions || '{}'),
        authenticationMethod: recipient.authentication_method,
        customMessage: recipient.custom_message,
        sendReminders: recipient.send_reminders
      })),
      signatureFields: signatureFields.map(field => ({
        documentReference: field.document_id,
        recipientIndex: recipients.findIndex(r => r.routing_order === field.routing_order),
        fieldType: field.field_type,
        position: { x: field.x, y: field.y },
        size: { width: field.width, height: field.height },
        page: field.page,
        required: field.required,
        fieldName: field.field_name,
        defaultValue: field.default_value,
        validationRules: JSON.parse(field.validation_rules || '{}')
      }))
    };

    return this.create({
      userId: envelope.user_id,
      name: templateName,
      description,
      category: 'custom',
      isPublic,
      templateData,
      tags: ['custom', 'user-created']
    });
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM envelope_templates WHERE id = ?', [id]);
    return row ? new EnvelopeTemplate(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM envelope_templates WHERE uuid = ?', [uuid]);
    return row ? new EnvelopeTemplate(row) : null;
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    const rows = await db.all(
      'SELECT * FROM envelope_templates WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(row => new EnvelopeTemplate(row));
  }

  static async findPublic(category = null, limit = 50, offset = 0) {
    let query = 'SELECT * FROM envelope_templates WHERE is_public = 1';
    let params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await db.all(query, params);
    return rows.map(row => new EnvelopeTemplate(row));
  }

  static async search(searchTerm, userId = null, includePublic = true, limit = 50) {
    let query = `
      SELECT * FROM envelope_templates 
      WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
    `;
    let params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

    if (userId && includePublic) {
      query += ' AND (user_id = ? OR is_public = 1)';
      params.push(userId);
    } else if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    } else if (includePublic) {
      query += ' AND is_public = 1';
    }

    query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ?';
    params.push(limit);

    const rows = await db.all(query, params);
    return rows.map(row => new EnvelopeTemplate(row));
  }

  static async getCategories() {
    const rows = await db.all(
      `SELECT tc.*, COUNT(et.id) as template_count 
       FROM template_categories tc
       LEFT JOIN envelope_templates et ON tc.id = et.category_id
       WHERE tc.is_active = 1
       GROUP BY tc.id
       ORDER BY tc.sort_order ASC, tc.display_name ASC`
    );
    return rows;
  }

  // Get template roles
  async getRoles() {
    const TemplateRole = require('./TemplateRole');
    return await TemplateRole.findByTemplateId(this.id);
  }

  // Get template fields
  async getFields() {
    const TemplateField = require('./TemplateField');
    return await TemplateField.findByTemplateId(this.id);
  }

  // Add a role to the template
  async addRole(roleData) {
    const TemplateRole = require('./TemplateRole');
    return await TemplateRole.create({
      ...roleData,
      templateId: this.id
    });
  }

  // Add a field to the template
  async addField(fieldData) {
    const TemplateField = require('./TemplateField');
    return await TemplateField.create({
      ...fieldData,
      templateId: this.id
    });
  }

  // Publish template (make it available for use)
  async publish() {
    await db.run(
      `UPDATE envelope_templates 
       SET is_published = 1, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [this.id]
    );
    this.isPublished = true;
    this.publishedAt = new Date().toISOString();
  }

  // Unpublish template
  async unpublish() {
    await db.run(
      `UPDATE envelope_templates 
       SET is_published = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [this.id]
    );
    this.isPublished = false;
  }

  // Create a new version of the template
  async createVersion(versionData) {
    const { versionName = '', changesSummary = '', createdBy } = versionData;
    
    // Get current roles and fields
    const roles = await this.getRoles();
    const fields = await this.getFields();
    
    // Get next version number
    const lastVersion = await db.get(
      'SELECT MAX(version_number) as max_version FROM template_versions WHERE template_id = ?',
      [this.id]
    );
    const nextVersion = (lastVersion?.max_version || 0) + 1;
    
    // Create version record
    const result = await db.run(
      `INSERT INTO template_versions (
        template_id, version_number, created_by, version_name, changes_summary,
        template_data, roles_data, fields_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.id, nextVersion, createdBy, versionName, changesSummary,
        JSON.stringify(this.templateData), JSON.stringify(roles), JSON.stringify(fields)
      ]
    );
    
    // Update template version number
    await db.run(
      'UPDATE envelope_templates SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextVersion, this.id]
    );
    
    this.version = nextVersion;
    return result.id;
  }

  // Get template versions
  async getVersions() {
    const rows = await db.all(
      `SELECT tv.*, u.email as created_by_email
       FROM template_versions tv
       LEFT JOIN users u ON tv.created_by = u.id
       WHERE tv.template_id = ?
       ORDER BY tv.version_number DESC`,
      [this.id]
    );
    return rows;
  }

  // Clone template with roles and fields
  async clone(cloneData) {
    const { userId, name, description } = cloneData;
    
    // Create cloned template
    const clonedTemplate = await EnvelopeTemplate.create({
      userId,
      name: name || `${this.name} (Copy)`,
      description: description || this.description,
      category: this.category,
      categoryId: this.categoryId,
      isPublic: false,
      templateData: this.templateData,
      tags: [...this.tags, 'cloned'],
      requiresAuthentication: this.requiresAuthentication,
      complianceFeatures: this.complianceFeatures,
      estimatedTime: this.estimatedTime,
      difficultyLevel: this.difficultyLevel
    });
    
    // Clone roles
    const roles = await this.getRoles();
    const roleMapping = new Map(); // Map original role ID to new role ID
    
    for (const role of roles) {
      const clonedRole = await clonedTemplate.addRole({
        roleName: role.roleName,
        displayName: role.displayName,
        description: role.description,
        roleType: role.roleType,
        routingOrder: role.routingOrder,
        permissions: role.permissions,
        authenticationMethod: role.authenticationMethod,
        isRequired: role.isRequired,
        customMessage: role.customMessage,
        sendReminders: role.sendReminders,
        language: role.language,
        timezone: role.timezone,
        accessRestrictions: role.accessRestrictions,
        notificationSettings: role.notificationSettings
      });
      roleMapping.set(role.id, clonedRole.id);
    }
    
    // Clone fields
    const fields = await this.getFields();
    for (const field of fields) {
      const newRoleId = roleMapping.get(field.roleId);
      if (newRoleId) {
        await field.clone(clonedTemplate.id, newRoleId);
      }
    }
    
    return clonedTemplate;
  }

  async update(updates) {
    const allowedFields = ['name', 'description', 'category', 'isPublic', 'templateData', 'tags'];
    const fieldMapping = {
      'name': 'name',
      'description': 'description',
      'category': 'category',
      'isPublic': 'is_public',
      'templateData': 'template_data',
      'tags': 'tags'
    };
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key];
        if (key === 'templateData') {
          fields.push(`${dbField} = ?`);
          values.push(JSON.stringify(value));
        } else if (key === 'tags') {
          fields.push(`${dbField} = ?`);
          values.push(Array.isArray(value) ? value.join(',') : value);
        } else {
          fields.push(`${dbField} = ?`);
          values.push(value);
        }
      }
    }
    
    if (fields.length === 0) return this;
    
    values.push(this.id);
    
    await db.run(
      `UPDATE envelope_templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return EnvelopeTemplate.findById(this.id);
  }

  async incrementUsage() {
    await db.run(
      'UPDATE envelope_templates SET usage_count = usage_count + 1 WHERE id = ?',
      [this.id]
    );
    this.usageCount = (this.usageCount || 0) + 1;
  }

  async delete() {
    await db.run('DELETE FROM envelope_templates WHERE id = ?', [this.id]);
  }

  async createEnvelopeFromTemplate(envelopeData) {
    const Envelope = require('./Envelope');
    
    // Validate that all required roles are provided
    const roles = await this.getRoles();
    const requiredRoles = roles.filter(role => role.isRequired);
    
    if (!envelopeData.roleAssignments) {
      throw new Error('Role assignments are required');
    }
    
    for (const requiredRole of requiredRoles) {
      const assignment = envelopeData.roleAssignments.find(a => a.roleId === requiredRole.id);
      if (!assignment || !assignment.email) {
        throw new Error(`Required role "${requiredRole.displayName}" must be assigned`);
      }
    }
    
    // Create envelope with template data
    const envelope = await Envelope.create({
      userId: envelopeData.userId,
      title: envelopeData.title || this.templateData?.envelope?.title || this.name,
      subject: envelopeData.subject || this.templateData?.envelope?.subject || `Please sign: ${this.name}`,
      message: envelopeData.message || this.templateData?.envelope?.message || 'Please review and sign the attached documents.',
      priority: this.templateData?.envelope?.priority || 'medium',
      reminderFrequency: this.templateData?.envelope?.reminderFrequency || 'daily',
      isSequential: this.templateData?.envelope?.isSequential || false,
      autoReminderEnabled: this.templateData?.envelope?.autoReminderEnabled || true,
      complianceLevel: this.templateData?.envelope?.complianceLevel || 'standard',
      metadata: { 
        templateId: this.id, 
        templateUuid: this.uuid,
        templateVersion: this.version 
      }
    });

    // Add documents from user input
    if (!envelopeData.documentIds || envelopeData.documentIds.length === 0) {
      throw new Error('At least one document is required');
    }
    
    for (let i = 0; i < envelopeData.documentIds.length; i++) {
      const documentId = envelopeData.documentIds[i];
      await envelope.addDocument(documentId, i + 1);
    }

    // Add recipients based on role assignments
    const recipientMapping = new Map(); // Map role ID to recipient ID
    
    for (const assignment of envelopeData.roleAssignments) {
      const role = roles.find(r => r.id === assignment.roleId);
      if (!role) continue;
      
      const recipientId = await role.assignToRecipient(envelope.id, {
        email: assignment.email,
        name: assignment.name || assignment.email,
        customMessage: assignment.customMessage
      });
      
      recipientMapping.set(role.id, recipientId);
    }

    // Add signature fields from template
    const fields = await this.getFields();
    for (const field of fields) {
      const recipientId = recipientMapping.get(field.roleId);
      const documentId = envelopeData.documentIds[field.documentIndex];
      
      if (recipientId && documentId) {
        await field.toEnvelopeField(envelope.id, documentId, recipientId);
      }
    }

    // Increment template usage
    await this.incrementUsage();
    
    // Track usage analytics
    await db.run(
      `INSERT INTO template_usage_analytics (template_id, user_id, envelope_id, action_type, metadata)
       VALUES (?, ?, ?, 'use', ?)`,
      [this.id, envelopeData.userId, envelope.id, JSON.stringify({ roleAssignments: envelopeData.roleAssignments })]
    );

    return envelope;
  }

  toJSON() {
    return {
      id: this.id,
      uuid: this.uuid,
      userId: this.userId,
      name: this.name,
      description: this.description,
      category: this.category,
      categoryId: this.categoryId,
      isPublic: this.isPublic,
      isPublished: this.isPublished,
      publishedAt: this.publishedAt,
      usageCount: this.usageCount,
      version: this.version,
      templateData: this.templateData,
      thumbnailPath: this.thumbnailPath,
      tags: this.tags,
      requiresAuthentication: this.requiresAuthentication,
      complianceFeatures: this.complianceFeatures,
      estimatedTime: this.estimatedTime,
      difficultyLevel: this.difficultyLevel,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = EnvelopeTemplate;
