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
    this.isPublic = data.is_public || data.isPublic;
    this.usageCount = data.usage_count || data.usageCount;
    this.templateData = data.template_data ? JSON.parse(data.template_data) : data.templateData;
    this.thumbnailPath = data.thumbnail_path || data.thumbnailPath;
    this.tags = data.tags ? data.tags.split(',') : [];
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(templateData) {
    const {
      userId,
      name,
      description = '',
      category = 'general',
      isPublic = false,
      templateData: template,
      tags = []
    } = templateData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO envelope_templates (uuid, user_id, name, description, category, is_public, template_data, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, userId, name, description, category, isPublic, JSON.stringify(template), tags.join(',')]
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
      'SELECT category, COUNT(*) as count FROM envelope_templates GROUP BY category ORDER BY count DESC'
    );
    return rows;
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
    
    // Create envelope with template data
    const envelope = await Envelope.create({
      userId: envelopeData.userId,
      title: envelopeData.title || this.templateData.envelope.title,
      subject: envelopeData.subject || this.templateData.envelope.subject,
      message: envelopeData.message || this.templateData.envelope.message,
      priority: this.templateData.envelope.priority,
      reminderFrequency: this.templateData.envelope.reminderFrequency,
      metadata: { templateId: this.id, templateUuid: this.uuid }
    });

    // Add recipients from user input (mapping template placeholders to actual recipients)
    if (envelopeData.recipients) {
      for (let i = 0; i < envelopeData.recipients.length; i++) {
        const recipientData = envelopeData.recipients[i];
        const templateRecipient = this.templateData.recipients[i];
        
        if (templateRecipient) {
          await envelope.addRecipient({
            ...recipientData,
            role: templateRecipient.role,
            routingOrder: templateRecipient.routingOrder,
            permissions: templateRecipient.permissions,
            authenticationMethod: templateRecipient.authenticationMethod,
            customMessage: templateRecipient.customMessage || recipientData.customMessage,
            sendReminders: templateRecipient.sendReminders
          });
        }
      }
    }

    // Add documents from user input
    if (envelopeData.documentIds) {
      for (let i = 0; i < envelopeData.documentIds.length; i++) {
        const documentId = envelopeData.documentIds[i];
        const templateDocument = this.templateData.documents[i];
        
        if (templateDocument) {
          await envelope.addDocument(documentId, templateDocument.order);
        }
      }
    }

    // Add signature fields from template
    if (this.templateData.signatureFields && envelopeData.documentIds && envelopeData.recipients) {
      for (const field of this.templateData.signatureFields) {
        const documentId = envelopeData.documentIds[field.documentReference - 1]; // Adjust for array index
        const recipient = envelopeData.recipients[field.recipientIndex];
        
        if (documentId && recipient) {
          await envelope.addSignatureField({
            documentId,
            recipientEmail: recipient.email,
            fieldType: field.fieldType,
            x: field.position.x,
            y: field.position.y,
            width: field.size.width,
            height: field.size.height,
            page: field.page,
            required: field.required,
            fieldName: field.fieldName,
            defaultValue: field.defaultValue,
            validationRules: field.validationRules
          });
        }
      }
    }

    // Increment template usage
    await this.incrementUsage();

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
      isPublic: this.isPublic,
      usageCount: this.usageCount,
      templateData: this.templateData,
      thumbnailPath: this.thumbnailPath,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = EnvelopeTemplate;
