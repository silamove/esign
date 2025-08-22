const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const isPostgres = (process.env.DATABASE_TYPE === 'postgresql');

class EnvelopeTemplate {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid; // legacy/SQLite only
    this.userId = data.user_id || data.userId || data.creator_id; // PG uses creator_id
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.categoryId = data.category_id || data.categoryId; // legacy only
    this.isPublic = data.is_public || data.isPublic;
    this.isPublished = data.is_published || data.isPublished; // legacy only
    this.publishedAt = data.published_at || data.publishedAt;
    this.usageCount = data.usage_count || data.usageCount;
    this.version = data.version || 1;
    this.templateData = data.template_data ? (typeof data.template_data === 'string' ? JSON.parse(data.template_data) : data.template_data) : data.templateData;
    this.thumbnailPath = data.thumbnail_path || data.thumbnailPath;
    // tags: SQLite stores comma-separated, Postgres is text[]
    if (Array.isArray(data.tags)) {
      this.tags = data.tags;
    } else {
      this.tags = data.tags ? String(data.tags).split(',') : [];
    }
    this.requiresAuthentication = data.requires_authentication || data.requiresAuthentication;
    this.complianceFeatures = data.compliance_features ? (typeof data.compliance_features === 'string' ? JSON.parse(data.compliance_features) : data.compliance_features) : {};
    this.estimatedTime = data.estimated_time || data.estimatedTime || 5;
    this.difficultyLevel = data.difficulty_level || data.difficultyLevel || 'easy';
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
    // PG-specific
    this.type = data.type; // 'standard' | 'smart'
    this.organizationId = data.organization_id || data.organizationId;
    this.metadata = data.metadata ? (typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata) : {};
    this.rolesJson = data.roles ? (typeof data.roles === 'string' ? JSON.parse(data.roles) : data.roles) : undefined;
  }

  static async create(templateData) {
    const {
      userId,
      organizationId = null,
      name,
      description = '',
      category = 'general',
      categoryId = null, // legacy only
      isPublic = false,
      isPublished = false, // legacy only
      templateData: template,
      tags = [],
      requiresAuthentication = false,
      complianceFeatures = {},
      estimatedTime = 5,
      difficultyLevel = 'easy',
      type = 'standard',
      metadata = {},
    } = templateData;

    if (isPostgres) {
      const { query, params } = {
        query: `INSERT INTO templates (name, description, type, category, is_public, is_active, creator_id, organization_id, template_data, tags, thumbnail_path, usage_count, metadata, roles)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id`,
        params: [
          name, description, type, category, isPublic, true, userId, organizationId,
          JSON.stringify(template || {}), Array.isArray(tags) ? `{${tags.map(t => '"' + t.replace(/"/g,'\"') + '"').join(',')}}` : null, null, 0,
          JSON.stringify(metadata || {}), JSON.stringify([])
        ]
      };
      const res = await db.query(query, params);
      return this.findById(res.rows?.[0]?.id || res.lastID || res.id);
    }

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
      isPostgres
        ? `SELECT role, routing_order, permissions, authentication_method, custom_message, send_reminders
             FROM recipients 
             WHERE envelope_id = ? 
             ORDER BY routing_order ASC`
        : `SELECT role, routing_order, permissions, authentication_method, custom_message, send_reminders
             FROM envelope_recipients 
             WHERE envelope_id = ? 
             ORDER BY routing_order ASC`,
      [envelopeId]
    );

    // Get signature fields (without actual signatures)
    const signatureFields = await db.all(
      isPostgres
        ? `SELECT document_id, type AS field_type, x, y, width, height, page, required, name AS field_name, default_value, validation_rules
             FROM fields 
             WHERE envelope_id = ?
             ORDER BY page ASC NULLS LAST, y ASC NULLS LAST, x ASC NULLS LAST`
        : `SELECT document_id, field_type, x, y, width, height, page, required, field_name, default_value, validation_rules
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
        permissions: typeof recipient.permissions === 'string' ? JSON.parse(recipient.permissions || '{}') : (recipient.permissions || {}),
        authenticationMethod: recipient.authentication_method,
        customMessage: recipient.custom_message,
        sendReminders: recipient.send_reminders
      })),
      signatureFields: signatureFields.map(field => ({
        documentReference: field.document_id,
        position: { x: field.x, y: field.y },
        size: { width: field.width, height: field.height },
        page: field.page,
        required: field.required,
        fieldName: field.field_name,
        defaultValue: field.default_value,
        validationRules: typeof field.validation_rules === 'string' ? JSON.parse(field.validation_rules || '{}') : (field.validation_rules || {})
      }))
    };

    return this.create({
      userId: envelope.user_id || envelope.creator_id,
      organizationId: envelope.organization_id,
      name: templateName,
      description,
      category: 'custom',
      isPublic,
      templateData,
      tags: ['custom', 'user-created']
    });
  }

  static async findById(id) {
    if (isPostgres) {
      const row = await db.get('SELECT * FROM templates WHERE id = ?', [id]);
      return row ? new EnvelopeTemplate(row) : null;
    }
    const row = await db.get('SELECT * FROM envelope_templates WHERE id = ?', [id]);
    return row ? new EnvelopeTemplate(row) : null;
  }

  static async findByUuid(uuid) {
    if (isPostgres) {
      // templates do not have uuid in PG; support lookup via metadata.uuid if present
      const row = await db.get("SELECT * FROM templates WHERE (metadata->>'uuid') = ?", [uuid]);
      return row ? new EnvelopeTemplate(row) : null;
    }
    const row = await db.get('SELECT * FROM envelope_templates WHERE uuid = ?', [uuid]);
    return row ? new EnvelopeTemplate(row) : null;
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    if (isPostgres) {
      const rows = await db.all(
        'SELECT * FROM templates WHERE creator_id = ? AND is_active = true ORDER BY updated_at DESC LIMIT ? OFFSET ?',
        [userId, limit, offset]
      );
      return rows.map(row => new EnvelopeTemplate(row));
    }
    const rows = await db.all(
      'SELECT * FROM envelope_templates WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(row => new EnvelopeTemplate(row));
  }

  static async findPublic(category = null, limit = 50, offset = 0) {
    if (isPostgres) {
      let query = 'SELECT * FROM templates WHERE is_public = true AND is_active = true';
      const params = [];
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      const rows = await db.all(query, params);
      return rows.map(row => new EnvelopeTemplate(row));
    }

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
    if (isPostgres) {
      let query = `SELECT * FROM templates WHERE (name ILIKE ? OR description ILIKE ?)`;
      const params = [`%${searchTerm}%`, `%${searchTerm}%`];
      if (userId && includePublic) {
        query += ' AND (creator_id = ? OR is_public = true)';
        params.push(userId);
      } else if (userId) {
        query += ' AND creator_id = ?';
        params.push(userId);
      } else if (includePublic) {
        query += ' AND is_public = true';
      }
      query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ?';
      params.push(limit);
      const rows = await db.all(query, params);
      return rows.map(row => new EnvelopeTemplate(row));
    }

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
    if (isPostgres) {
      const rows = await db.all(
        `SELECT category AS display_name, COUNT(id) AS template_count
         FROM templates WHERE is_active = true AND category IS NOT NULL
         GROUP BY category
         ORDER BY display_name ASC`
      );
      return rows;
    }

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
    if (isPostgres) {
      // roles are stored as JSONB on templates
      const roles = Array.isArray(this.rolesJson) ? this.rolesJson : [];
      // Normalize to a simple structure resembling legacy roles
      return roles.map((r, idx) => ({
        id: r.id || idx + 1,
        roleName: r.name || r.role_name || `role_${idx + 1}`,
        displayName: r.display_name || r.displayName || r.name || `Role ${idx + 1}`,
        description: r.description || '',
        roleType: r.role_type || r.roleType || 'signer',
        routingOrder: r.signing_order || r.routing_order || idx + 1,
        permissions: r.permissions || {},
        authenticationMethod: r.authentication_method || 'email',
        isRequired: (r.is_required !== undefined) ? r.is_required : true,
        customMessage: r.custom_message || '',
        sendReminders: (r.send_reminders !== undefined) ? r.send_reminders : true,
        language: r.language || 'en',
        timezone: r.timezone || 'UTC',
        accessRestrictions: r.access_restrictions || {},
        notificationSettings: r.notification_settings || {}
      }));
    }
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
    if (isPostgres) {
      const current = await db.get('SELECT roles FROM templates WHERE id = ?', [this.id]);
      const roles = (current && current.roles) ? (typeof current.roles === 'string' ? JSON.parse(current.roles) : current.roles) : [];
      const newRole = {
        id: roleData.id || (roles.length ? Math.max(...roles.map(r => r.id || 0)) + 1 : 1),
        name: roleData.roleName || roleData.name,
        display_name: roleData.displayName || roleData.display_name,
        description: roleData.description || '',
        role_type: roleData.roleType || 'signer',
        routing_order: roleData.routingOrder || 1,
        permissions: roleData.permissions || {},
        authentication_method: roleData.authenticationMethod || 'email',
        is_required: (roleData.isRequired !== undefined) ? roleData.isRequired : true,
        custom_message: roleData.customMessage || '',
        send_reminders: (roleData.sendReminders !== undefined) ? roleData.sendReminders : true,
        language: roleData.language || 'en',
        timezone: roleData.timezone || 'UTC',
        access_restrictions: roleData.accessRestrictions || {},
        notification_settings: roleData.notificationSettings || {}
      };
      roles.push(newRole);
      await db.run('UPDATE templates SET roles = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(roles), this.id]);
      return newRole;
    }
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
    if (isPostgres) {
      await db.run(
        `UPDATE templates 
         SET is_active = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [this.id]
      );
      return;
    }
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
    if (isPostgres) {
      await db.run(
        `UPDATE templates 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [this.id]
      );
      return;
    }
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
        JSON.stringify(this.templateData || {}), JSON.stringify(roles), JSON.stringify(fields)
      ]
    );
    
    // Update template version number
    if (!isPostgres) {
      await db.run(
        'UPDATE envelope_templates SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextVersion, this.id]
      );
      this.version = nextVersion;
    } else {
      await db.run('UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [this.id]);
      this.version = nextVersion;
    }
    
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
      organizationId: this.organizationId,
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
      difficultyLevel: this.difficultyLevel,
      type: this.type || 'standard',
      metadata: this.metadata || {}
    });
    
    // Clone roles
    const roles = await this.getRoles();
    const roleMapping = new Map(); // Map original role ID/Name to new role identifier
    
    for (const role of roles) {
      const clonedRole = await clonedTemplate.addRole({
        roleName: role.roleName || role.name,
        displayName: role.displayName || role.display_name,
        description: role.description,
        roleType: role.roleType || role.role_type,
        routingOrder: role.routingOrder || role.routing_order,
        permissions: role.permissions,
        authenticationMethod: role.authenticationMethod || role.authentication_method,
        isRequired: role.isRequired !== undefined ? role.isRequired : role.is_required,
        customMessage: role.customMessage || role.custom_message,
        sendReminders: role.sendReminders !== undefined ? role.sendReminders : role.send_reminders,
        language: role.language,
        timezone: role.timezone,
        accessRestrictions: role.accessRestrictions,
        notificationSettings: role.notificationSettings
      });
      // Prefer mapping by roleName for PG
      roleMapping.set(role.roleId || role.id || role.roleName || role.name, clonedRole.id || clonedRole.roleName || clonedRole.name);
    }
    
    // Clone fields
    const fields = await this.getFields();
    for (const field of fields) {
      const newRoleKey = field.roleId || field.roleName; // legacy or PG hint
      const mapped = newRoleKey ? roleMapping.get(newRoleKey) : null;
      await field.clone(clonedTemplate.id, mapped || null);
    }
    
    return clonedTemplate;
  }

  async update(updates) {
    const allowedFields = ['name', 'description', 'category', 'isPublic', 'templateData', 'tags'];
    const fieldMappingSqlite = {
      'name': 'name',
      'description': 'description',
      'category': 'category',
      'isPublic': 'is_public',
      'templateData': 'template_data',
      'tags': 'tags'
    };
    const fieldMappingPg = {
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
        const dbField = (isPostgres ? fieldMappingPg : fieldMappingSqlite)[key];
        if (key === 'templateData') {
          fields.push(`${dbField} = ?`);
          values.push(JSON.stringify(value || {}));
        } else if (key === 'tags') {
          fields.push(`${dbField} = ?`);
          if (isPostgres) {
            values.push(Array.isArray(value) ? `{${value.map(t => '"' + String(t).replace(/"/g,'\\"') + '"').join(',')}}` : null);
          } else {
            values.push(Array.isArray(value) ? value.join(',') : value);
          }
        } else {
          fields.push(`${dbField} = ?`);
          values.push(value);
        }
      }
    }
    
    if (fields.length === 0) return this;
    
    values.push(this.id);
    
    if (isPostgres) {
      await db.run(
        `UPDATE templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
      return EnvelopeTemplate.findById(this.id);
    }
    
    await db.run(
      `UPDATE envelope_templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return EnvelopeTemplate.findById(this.id);
  }

  async incrementUsage() {
    if (isPostgres) {
      await db.run(
        'UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?',
        [this.id]
      );
      this.usageCount = (this.usageCount || 0) + 1;
      return;
    }
    await db.run(
      'UPDATE envelope_templates SET usage_count = usage_count + 1 WHERE id = ?',
      [this.id]
    );
    this.usageCount = (this.usageCount || 0) + 1;
  }

  async delete() {
    if (isPostgres) {
      // fields(template_id) has ON DELETE CASCADE
      await db.run('DELETE FROM templates WHERE id = ?', [this.id]);
      return;
    }
    await db.run('DELETE FROM envelope_templates WHERE id = ?', [this.id]);
  }

  async createEnvelopeFromTemplate(envelopeData) {
    const Envelope = require('./Envelope');
    
    // Validate required roles
    const roles = await this.getRoles();
    const requiredRoles = roles.filter(role => role.isRequired || role.is_required);
    
    if (!envelopeData.roleAssignments) {
      throw new Error('Role assignments are required');
    }
    
    // In PG, match by roleName if provided
    for (const requiredRole of requiredRoles) {
      const rid = requiredRole.id;
      const rname = requiredRole.roleName || requiredRole.name;
      const assignment = envelopeData.roleAssignments.find(a => a.roleId === rid || a.roleName === rname);
      if (!assignment || !assignment.email) {
        throw new Error(`Required role "${requiredRole.displayName || requiredRole.display_name || rname}" must be assigned`);
      }
    }
    
    // Create envelope with template data
    const envelope = await Envelope.create({
      userId: envelopeData.userId,
      organizationId: envelopeData.organizationId,
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
    const recipientMapping = new Map(); // key: roleName or roleId -> recipient ID
    
    for (const assignment of envelopeData.roleAssignments) {
      const role = roles.find(r => r.id === assignment.roleId || (r.roleName || r.name) === assignment.roleName);
      if (!role) continue;
      const result = await envelope.addRecipient({
        email: assignment.email,
        name: assignment.name || assignment.email,
        role: role.roleType || role.role_type || 'signer',
        routingOrder: role.routingOrder || role.routing_order || 1,
        permissions: role.permissions || {},
        authenticationMethod: role.authenticationMethod || role.authentication_method || 'email',
        customMessage: assignment.customMessage || role.customMessage || role.custom_message || '',
        sendReminders: role.sendReminders !== undefined ? role.sendReminders : (role.send_reminders !== undefined ? role.send_reminders : true)
      });
      const recipientId = result.id || result.lastID || result.lastId;
      recipientMapping.set(role.id || role.roleName || role.name, recipientId);
    }

    // Add fields from template
    const TemplateField = require('./TemplateField');
    const fields = await this.getFields();
    for (const field of fields) {
      // Determine recipient by role hint if available
      const roleKey = field.roleId || field.roleName; // legacy id or PG role name stored in validationRules
      const recipientId = roleKey ? (recipientMapping.get(roleKey) || null) : null;
      const documentId = envelopeData.documentIds[field.documentIndex || 0];
      if (documentId) {
        await TemplateField.toEnvelopeFieldStatic(field, envelope.id, documentId, recipientId);
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
      organizationId: this.organizationId,
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
      updatedAt: this.updatedAt,
      type: this.type,
      metadata: this.metadata,
      roles: this.rolesJson
    };
  }
}

module.exports = EnvelopeTemplate;
