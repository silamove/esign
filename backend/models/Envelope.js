const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const isPostgres = (process.env.DATABASE_TYPE === 'postgresql');

class Envelope {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.userId = data.user_id || data.userId;
    this.organizationId = data.organization_id || data.organizationId; // added for enterprise features
    this.title = data.title;
    this.subject = data.subject;
    this.message = data.message;
    this.status = data.status; // draft, sent, in_progress, completed, voided, expired
    this.priority = data.priority; // low, medium, high, urgent
    this.expirationDate = data.expiration_date || data.expirationDate;
    this.reminderFrequency = data.reminder_frequency || data.reminderFrequency;
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
    this.sentAt = data.sent_at || data.sentAt;
    this.completedAt = data.completed_at || data.completedAt;
  }

  static async create(envelopeData) {
    const {
      userId,
      organizationId = null,
      title,
      subject = '',
      message = '',
      priority = 'medium',
      expirationDate = null,
      reminderFrequency = 'daily',
      metadata = {}
    } = envelopeData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO envelopes (uuid, user_id, organization_id, title, subject, message, priority, expiration_date, reminder_frequency, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, userId, organizationId, title, subject, message, priority, expirationDate, reminderFrequency, JSON.stringify(metadata)]
    );
    
    return this.findById(result.id);
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM envelopes WHERE id = ?', [id]);
    return row ? new Envelope(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM envelopes WHERE uuid = ?', [uuid]);
    return row ? new Envelope(row) : null;
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    const rows = await db.all(
      'SELECT * FROM envelopes WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(row => new Envelope(row));
  }

  static async findByStatus(status, userId = null, limit = 50, offset = 0) {
    let query = 'SELECT * FROM envelopes WHERE status = ?';
    let params = [status];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const rows = await db.all(query, params);
    return rows.map(row => new Envelope(row));
  }

  async update(updates) {
    const allowedFields = ['title', 'subject', 'message', 'status', 'priority', 'expirationDate', 'reminderFrequency', 'metadata', 'sentAt', 'completedAt'];
    const fieldMapping = {
      'title': 'title',
      'subject': 'subject',
      'message': 'message',
      'status': 'status',
      'priority': 'priority',
      'expirationDate': 'expiration_date',
      'reminderFrequency': 'reminder_frequency',
      'metadata': 'metadata',
      'sentAt': 'sent_at',
      'completedAt': 'completed_at'
    };
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key];
        if (key === 'metadata') {
          fields.push(`${dbField} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${dbField} = ?`);
          values.push(value);
        }
      }
    }
    
    if (fields.length === 0) return this;
    
    values.push(this.id);
    
    await db.run(
      `UPDATE envelopes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return Envelope.findById(this.id);
  }

  async delete() {
    if (isPostgres) {
      // New unified tables; FKs are ON DELETE CASCADE, but be explicit
      await db.run('DELETE FROM fields WHERE envelope_id = ?', [this.id]);
      await db.run('DELETE FROM recipients WHERE envelope_id = ?', [this.id]);
    } else {
      await db.run('DELETE FROM envelope_recipients WHERE envelope_id = ?', [this.id]);
      await db.run('DELETE FROM envelope_documents WHERE envelope_id = ?', [this.id]);
      await db.run('DELETE FROM envelope_signatures WHERE envelope_id = ?', [this.id]);
    }
    await db.run('DELETE FROM envelopes WHERE id = ?', [this.id]);
  }

  // Document management
  async addDocument(documentId, order = 1) {
    const result = await db.run(
      `INSERT INTO envelope_documents (envelope_id, document_id, document_order)
       VALUES (?, ?, ?)`,
      [this.id, documentId, order]
    );
    return result;
  }

  async removeDocument(documentId) {
    await db.run('DELETE FROM envelope_documents WHERE envelope_id = ? AND document_id = ?', [this.id, documentId]);
  }

  async getDocuments() {
    const rows = await db.all(
      `SELECT d.*, ed.document_order, ed.created_at as added_at
       FROM documents d
       INNER JOIN envelope_documents ed ON d.id = ed.document_id
       WHERE ed.envelope_id = ?
       ORDER BY ed.document_order ASC`,
      [this.id]
    );
    return rows;
  }

  // Recipient management
  async addRecipient(recipientData) {
    const {
      email,
      name,
      role = 'signer', // signer, viewer, approver, form_filler
      routingOrder = 1,
      permissions = {},
      authenticationMethod = 'email',
      customMessage = '',
      sendReminders = true
    } = recipientData;

    if (isPostgres) {
      const result = await db.run(
        `INSERT INTO recipients (envelope_id, email, name, role, routing_order, permissions, authentication_method, custom_message, send_reminders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.id, email, name, role, routingOrder, JSON.stringify(permissions), authenticationMethod, customMessage, sendReminders]
      );
      return result;
    } else {
      const result = await db.run(
        `INSERT INTO envelope_recipients (envelope_id, email, name, role, routing_order, permissions, authentication_method, custom_message, send_reminders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.id, email, name, role, routingOrder, JSON.stringify(permissions), authenticationMethod, customMessage, sendReminders]
      );
      return result;
    }
  }

  async removeRecipient(recipientId) {
    if (isPostgres) {
      await db.run('DELETE FROM recipients WHERE id = ? AND envelope_id = ?', [recipientId, this.id]);
    } else {
      await db.run('DELETE FROM envelope_recipients WHERE id = ? AND envelope_id = ?', [recipientId, this.id]);
    }
  }

  async getRecipients() {
    if (isPostgres) {
      const rows = await db.all(
        'SELECT * FROM recipients WHERE envelope_id = ? ORDER BY routing_order ASC',
        [this.id]
      );
      return rows.map(row => ({
        ...row,
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '{}') : row.permissions || {}
      }));
    } else {
      const rows = await db.all(
        'SELECT * FROM envelope_recipients WHERE envelope_id = ? ORDER BY routing_order ASC',
        [this.id]
      );
      return rows.map(row => ({
        ...row,
        permissions: JSON.parse(row.permissions || '{}')
      }));
    }
  }

  // Signature field management
  async addSignatureField(fieldData) {
    const {
      documentId,
      recipientEmail,
      fieldType, // signature, initial, text, date, checkbox
      x, y, width, height, page,
      required = true,
      fieldName = '',
      defaultValue = '',
      validationRules = {}
    } = fieldData;

    if (isPostgres) {
      const result = await db.run(
        `INSERT INTO fields (envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required, default_value, validation_rules)
         VALUES (?, ?, (SELECT id FROM recipients WHERE envelope_id = ? AND email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          this.id,
          documentId,
          this.id,
          recipientEmail,
          fieldType,
          fieldName,
          fieldName,
          x, y, width, height,
          page,
          required,
          defaultValue,
          JSON.stringify(validationRules)
        ]
      );
      return result;
    } else {
      const result = await db.run(
        `INSERT INTO envelope_signatures (envelope_id, document_id, recipient_email, field_type, x, y, width, height, page, required, field_name, default_value, validation_rules)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.id, documentId, recipientEmail, fieldType, x, y, width, height, page, required, fieldName, defaultValue, JSON.stringify(validationRules)]
      );
      return result;
    }
  }

  async getSignatureFields(documentId = null) {
    if (isPostgres) {
      let query = `
        SELECT f.*, r.email AS recipient_email
        FROM fields f
        LEFT JOIN recipients r ON r.id = f.recipient_id
        WHERE f.envelope_id = ?`;
      const params = [this.id];
      
      if (documentId) {
        query += ' AND f.document_id = ?';
        params.push(documentId);
      }
      
      query += ' ORDER BY f.page ASC NULLS LAST, f.y ASC NULLS LAST, f.x ASC NULLS LAST';
      const rows = await db.all(query, params);
      return rows.map(row => ({
        id: row.id,
        envelope_id: row.envelope_id,
        document_id: row.document_id,
        recipient_id: row.recipient_id,
        recipient_email: row.recipient_email,
        field_type: row.type,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        page: row.page,
        required: row.required,
        field_name: row.name || row.label,
        default_value: row.default_value,
        validation_rules: typeof row.validation_rules === 'string' ? JSON.parse(row.validation_rules || '{}') : row.validation_rules || {},
        value: row.value,
        signed_at: row.signed_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } else {
      let query = 'SELECT * FROM envelope_signatures WHERE envelope_id = ?';
      let params = [this.id];
      
      if (documentId) {
        query += ' AND document_id = ?';
        params.push(documentId);
      }
      
      query += ' ORDER BY page ASC, y ASC, x ASC';
      
      const rows = await db.all(query, params);
      return rows.map(row => ({
        ...row,
        validationRules: JSON.parse(row.validation_rules || '{}')
      }));
    }
  }

  // Envelope Types (templates-backed) helpers
  static async listEnvelopeTypes({ activeOnly = true } = {}) {
    if (!isPostgres) {
      // Legacy SQLite table
      const rows = await db.all(
        `SELECT * FROM envelope_types ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY sort_order ASC, display_name ASC`
      );
      return rows;
    }
    const rows = await db.all(
      `SELECT * FROM envelope_types_view ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY sort_order NULLS LAST, display_name`
    );
    return rows;
  }

  async setEnvelopeType(typeId) {
    if (!isPostgres) {
      // Store on envelopes table if present, else in metadata
      try {
        await db.run('UPDATE envelopes SET envelope_type_id = ? WHERE id = ?', [typeId, this.id]);
      } catch (_) {
        // fallback to metadata
        const type = await db.get('SELECT * FROM envelope_types WHERE id = ?', [typeId]);
        this.metadata = { ...(this.metadata || {}), envelope_type_id: typeId, envelope_type_name: type?.display_name, category: type?.category };
        await this.update({ metadata: this.metadata });
      }
      return this;
    }
    const type = await db.get('SELECT * FROM envelope_types_view WHERE id = ?', [typeId]);
    if (!type) throw new Error('Envelope type not found');
    this.metadata = {
      ...(this.metadata || {}),
      envelope_type_id: type.id,
      envelope_type_name: type.display_name,
      category: type.category,
      default_expiration_days: type.default_expiration_days
    };
    await this.update({ metadata: this.metadata });
    return this;
  }

  async getEnvelopeType() {
    if (this.metadata?.envelope_type_id) {
      if (!isPostgres) {
        return db.get('SELECT * FROM envelope_types WHERE id = ?', [this.metadata.envelope_type_id]);
      }
      return db.get('SELECT * FROM envelope_types_view WHERE id = ?', [this.metadata.envelope_type_id]);
    }
    return null;
  }

  // Workflow management
  async send() {
    if (this.status !== 'draft') {
      throw new Error('Only draft envelopes can be sent');
    }

    const recipients = await this.getRecipients();
    const documents = await this.getDocuments();
    
    if (recipients.length === 0) {
      throw new Error('Envelope must have at least one recipient');
    }
    
    if (documents.length === 0) {
      throw new Error('Envelope must have at least one document');
    }

    await this.update({
      status: 'sent',
      sentAt: new Date().toISOString()
    });

    // Execute org-level workflows for Postgres
    try {
      await this.executeWorkflows('on_send', { recipientsCount: recipients.length, documentsCount: documents.length });
    } catch (e) {
      console.warn('Workflow execution on send failed:', e.message);
    }

    // Trigger notifications (placeholder)
    await this.logAction('envelope_sent', this.userId, {
      recipientCount: recipients.length,
      documentCount: documents.length
    });

    return this;
  }

  async complete() {
    await this.update({
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    await this.logAction('envelope_completed', this.userId);
    return this;
  }

  async void(reason = '') {
    await this.update({
      status: 'voided',
      metadata: { ...this.metadata, voidReason: reason }
    });

    await this.logAction('envelope_voided', this.userId, { reason });
    return this;
  }

  // Progress tracking
  async getProgress() {
    const recipients = await this.getRecipients();
    const signatureFields = await this.getSignatureFields();
    
    const totalRequired = signatureFields.filter(field => field.required).length;
    const completed = signatureFields.filter(field => field.signed_at).length;
    
    const recipientProgress = recipients.map(recipient => {
      const recipientFields = signatureFields.filter(field => field.recipient_email === recipient.email);
      const recipientCompleted = recipientFields.filter(field => field.signed_at).length;
      
      return {
        ...recipient,
        totalFields: recipientFields.length,
        completedFields: recipientCompleted,
        percentage: recipientFields.length > 0 ? (recipientCompleted / recipientFields.length) * 100 : 0,
        status: recipientCompleted === recipientFields.length ? 'completed' : 
                recipientCompleted > 0 ? 'in_progress' : 'pending'
      };
    });

    return {
      overall: {
        totalFields: totalRequired,
        completedFields: completed,
        percentage: totalRequired > 0 ? (completed / totalRequired) * 100 : 0
      },
      recipients: recipientProgress
    };
  }

  // Audit logging
  async logAction(action, userId, details = {}, ipAddress = null, userAgent = null) {
    await db.run(
      `INSERT INTO audit_logs (user_id, envelope_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, this.id, action, JSON.stringify(details), ipAddress, userAgent]
    );
  }

  async getAuditLogs() {
    const rows = await db.all(
      `SELECT al.*, u.first_name, u.last_name, u.email 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       WHERE al.envelope_id = ? 
       ORDER BY al.created_at DESC`,
      [this.id]
    );
    return rows;
  }

  // Advanced workflow and template features
  static async createFromTemplate(templateId, envelopeData) {
    const EnvelopeTemplate = require('./EnvelopeTemplate');
    const template = await EnvelopeTemplate.findById(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    return template.createEnvelopeFromTemplate(envelopeData);
  }

  async generateCertificate() {
    if (this.status !== 'completed') {
      throw new Error('Envelope must be completed to generate certificate');
    }

    const EnvelopeCertificate = require('./EnvelopeCertificate');
    return EnvelopeCertificate.generateCertificate(this.id);
  }

  async getCertificate() {
    const EnvelopeCertificate = require('./EnvelopeCertificate');
    return EnvelopeCertificate.findByEnvelopeId(this.id);
  }

  async addCollaborator(userId, permissionLevel = 'view', invitedBy) {
    const result = await db.run(
      `INSERT INTO envelope_collaborators (envelope_id, user_id, permission_level, invited_by)
       VALUES (?, ?, ?, ?)`,
      [this.id, userId, permissionLevel, invitedBy]
    );
    return result;
  }

  async getCollaborators() {
    const rows = await db.all(
      `SELECT ec.*, u.first_name, u.last_name, u.email, u.profile_picture
       FROM envelope_collaborators ec
       JOIN users u ON ec.user_id = u.id
       WHERE ec.envelope_id = ?
       ORDER BY ec.invited_at ASC`,
      [this.id]
    );
    return rows;
  }

  async addComment(userId, commentText, documentId = null, pageNumber = null, x = null, y = null, isInternal = false, parentCommentId = null) {
    const result = await db.run(
      `INSERT INTO envelope_comments (envelope_id, user_id, document_id, page_number, x, y, comment_text, is_internal, parent_comment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.id, userId, documentId, pageNumber, x, y, commentText, isInternal, parentCommentId]
    );
    return result;
  }

  async getComments(includeInternal = true) {
    let query = `
      SELECT ec.*, u.first_name, u.last_name, u.email, u.profile_picture
      FROM envelope_comments ec
      JOIN users u ON ec.user_id = u.id
      WHERE ec.envelope_id = ?
    `;
    let params = [this.id];

    if (!includeInternal) {
      query += ' AND ec.is_internal = 0';
    }

    query += ' ORDER BY ec.created_at ASC';

    const rows = await db.all(query, params);
    return rows;
  }

  // For Postgres, create org-level workflow from legacy-style parts; for SQLite keep envelope_workflows
  async addWorkflow(workflowName, triggerType, triggerConditions, actions) {
    if (isPostgres) {
      if (!this.organizationId) throw new Error('Envelope organization_id is required to add a workflow');
      const definition = {
        name: workflowName,
        triggers: [triggerType],
        conditions: triggerConditions || [],
        actions: actions || []
      };
      const res = await db.run(
        `INSERT INTO workflows (organization_id, name, description, definition)
         VALUES (?, ?, ?, ?)`,
        [this.organizationId, workflowName, null, JSON.stringify(definition)]
      );
      return res;
    }
    const result = await db.run(
      `INSERT INTO envelope_workflows (envelope_id, workflow_name, trigger_type, trigger_conditions, actions)
       VALUES (?, ?, ?, ?, ?)`,
      [this.id, workflowName, triggerType, JSON.stringify(triggerConditions), JSON.stringify(actions)]
    );
    return result;
  }

  async executeWorkflows(triggerType, eventData = {}) {
    if (isPostgres) {
      // Evaluate org-level workflows
      if (!this.organizationId) return; // nothing to run
      const rows = await db.all(
        'SELECT id, name, definition FROM workflows WHERE organization_id = ? AND is_active = true',
        [this.organizationId]
      );
      for (const row of rows) {
        let def;
        try {
          def = typeof row.definition === 'string' ? JSON.parse(row.definition || '{}') : row.definition || {};
        } catch (_) {
          def = {};
        }
        const triggers = def.triggers || [];
        if (triggers.length && !triggers.includes(triggerType)) continue;
        const conditions = def.conditions || [];
        const actions = def.actions || [];

        if (this.checkWorkflowConditions(conditions, eventData)) {
          await this.executeWorkflowActions(actions, row.id);
          await this.logAction('workflow_executed', this.userId, { workflowId: row.id, triggerType });
        }
      }
      return;
    }

    const workflows = await db.all(
      'SELECT * FROM envelope_workflows WHERE envelope_id = ? AND trigger_type = ? AND is_active = 1',
      [this.id, triggerType]
    );

    for (const workflow of workflows) {
      const conditions = JSON.parse(workflow.trigger_conditions);
      const actions = JSON.parse(workflow.actions);

      // Check if conditions are met
      if (this.checkWorkflowConditions(conditions, eventData)) {
        await this.executeWorkflowActions(actions, workflow.id);
        
        // Update execution count
        await db.run(
          'UPDATE envelope_workflows SET execution_count = execution_count + 1, last_executed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [workflow.id]
        );
      }
    }
  }

  checkWorkflowConditions(conditions, eventData) {
    // Simple condition checking - can be enhanced
    for (const condition of conditions) {
      if (!condition || !condition.type) continue;
      switch (condition.type) {
        case 'status_equals':
          if (this.status !== condition.value) return false;
          break;
        case 'always':
          break;
        // Example numeric condition: { type: 'gt', key: 'total', value: 10000 }
        case 'gt': {
          const v = Number(eventData?.[condition.key]);
          if (!(v > Number(condition.value))) return false;
          break;
        }
        default:
          // Unknown condition types are treated as pass-through for now
          break;
      }
    }
    return true;
  }

  async executeWorkflowActions(actions, workflowId) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_email':
            await this.sendWorkflowEmail(action.config);
            break;
          case 'update_status':
            await this.update({ status: action.config.status });
            break;
          case 'add_reminder':
            await this.scheduleReminder(action.config);
            break;
          case 'webhook':
            await this.triggerWebhook(action.config);
            break;
          default:
            console.log(`Unknown workflow action: ${action.type}`);
        }
      } catch (error) {
        console.error(`Workflow action failed:`, error);
        await this.logAction('workflow_action_failed', this.userId, {
          workflowId,
          actionType: action.type,
          error: error.message
        });
      }
    }
  }

  async addIntegration(integrationType, externalId, syncData = {}) {
    const result = await db.run(
      `INSERT INTO envelope_integrations (envelope_id, integration_type, external_id, sync_data)
       VALUES (?, ?, ?, ?)`,
      [this.id, integrationType, externalId, JSON.stringify(syncData)]
    );
    return result;
  }

  async updateIntegrationStatus(integrationType, syncStatus, syncData = {}) {
    await db.run(
      `UPDATE envelope_integrations 
       SET sync_status = ?, sync_data = ?, last_synced_at = CURRENT_TIMESTAMP 
       WHERE envelope_id = ? AND integration_type = ?`,
      [syncStatus, JSON.stringify(syncData), this.id, integrationType]
    );
  }

  async trackAnalyticsEvent(eventType, userIdentifier, ipAddress = null, userAgent = null, metadata = {}) {
    await db.run(
      `INSERT INTO envelope_analytics_events (envelope_id, event_type, user_identifier, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [this.id, eventType, userIdentifier, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  }

  async getAnalyticsEvents() {
    const rows = await db.all(
      'SELECT * FROM envelope_analytics_events WHERE envelope_id = ? ORDER BY created_at DESC',
      [this.id]
    );
    return rows;
  }

  async createVersion(userId, changesSummary = '') {
    const versionData = {
      envelope: this.toJSON(),
      documents: await this.getDocuments(),
      recipients: await this.getRecipients(),
      signatureFields: await this.getSignatureFields()
    };

    const latestVersion = await db.get(
      'SELECT MAX(version_number) as max_version FROM envelope_versions WHERE envelope_id = ?',
      [this.id]
    );

    const versionNumber = (latestVersion?.max_version || 0) + 1;

    const result = await db.run(
      `INSERT INTO envelope_versions (envelope_id, version_number, created_by, changes_summary, version_data)
       VALUES (?, ?, ?, ?, ?)`,
      [this.id, versionNumber, userId, changesSummary, JSON.stringify(versionData)]
    );

    return result;
  }

  async getVersions() {
    const rows = await db.all(
      `SELECT ev.*, u.first_name, u.last_name, u.email
       FROM envelope_versions ev
       JOIN users u ON ev.created_by = u.id
       WHERE ev.envelope_id = ?
       ORDER BY ev.version_number DESC`,
      [this.id]
    );
    return rows;
  }

  // Enhanced progress tracking with detailed analytics
  async getDetailedProgress() {
    const baseProgress = await this.getProgress();
    const events = await this.getAnalyticsEvents();
    const comments = await this.getComments();

    // Calculate engagement metrics
    const viewEvents = events.filter(e => e.event_type === 'view');
    const uniqueViewers = [...new Set(viewEvents.map(e => e.user_identifier))];
    
    return {
      ...baseProgress,
      engagement: {
        totalViews: viewEvents.length,
        uniqueViewers: uniqueViewers.length,
        averageViewDuration: this.calculateAverageViewDuration(events),
        commentsCount: comments.length,
        lastActivity: events[0]?.created_at
      },
      timeline: this.buildTimeline(events, comments)
    };
  }

  calculateAverageViewDuration(events) {
    const viewEvents = events.filter(e => e.event_type === 'view' && e.duration);
    if (viewEvents.length === 0) return 0;
    
    const totalDuration = viewEvents.reduce((sum, event) => sum + (event.duration || 0), 0);
    return Math.round(totalDuration / viewEvents.length);
  }

  buildTimeline(events, comments) {
    const timelineItems = [
      ...events.map(e => ({
        type: 'event',
        timestamp: e.created_at,
        data: e
      })),
      ...comments.map(c => ({
        type: 'comment',
        timestamp: c.created_at,
        data: c
      }))
    ];

    return timelineItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Bulk operations support
  static async bulkUpdate(envelopeIds, updates, userId) {
    const bulkOpUuid = uuidv4();
    let successCount = 0;
    let errorLog = [];

    // Create bulk operation record
    const bulkOp = await db.run(
      `INSERT INTO envelope_bulk_operations (uuid, user_id, operation_type, envelope_ids, total_count)
       VALUES (?, ?, ?, ?, ?)`,
      [bulkOpUuid, userId, 'bulk_update', JSON.stringify(envelopeIds), envelopeIds.length]
    );

    // Update status to in_progress
    await db.run(
      'UPDATE envelope_bulk_operations SET status = ? WHERE id = ?',
      ['in_progress', bulkOp.id]
    );

    for (const envelopeId of envelopeIds) {
      try {
        const envelope = await this.findById(envelopeId);
        if (envelope) {
          await envelope.update(updates);
          successCount++;
        } else {
          errorLog.push({ envelopeId, error: 'Envelope not found' });
        }
      } catch (error) {
        errorLog.push({ envelopeId, error: error.message });
      }
    }

    // Update bulk operation status
    await db.run(
      `UPDATE envelope_bulk_operations 
       SET status = ?, progress_count = ?, error_log = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['completed', successCount, JSON.stringify(errorLog), bulkOp.id]
    );

    return {
      bulkOpUuid,
      successCount,
      errorCount: errorLog.length,
      errors: errorLog
    };
  }

  toJSON() {
    return {
      id: this.id,
      uuid: this.uuid,
      userId: this.userId,
      organizationId: this.organizationId,
      title: this.title,
      subject: this.subject,
      message: this.message,
      status: this.status,
      priority: this.priority,
      expirationDate: this.expirationDate,
      reminderFrequency: this.reminderFrequency,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      sentAt: this.sentAt,
      completedAt: this.completedAt
    };
  }
}

module.exports = Envelope;
