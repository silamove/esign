const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * TemplateRole - Reusable roles for templates (like DocuSign's template roles)
 * Defines recipient roles that can be reused across templates and envelopes
 */
class TemplateRole {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.templateId = data.template_id || data.templateId;
    this.roleName = data.role_name || data.roleName;
    this.displayName = data.display_name || data.displayName;
    this.description = data.description;
    this.roleType = data.role_type || data.roleType; // 'signer', 'viewer', 'approver', 'form_filler', 'editor'
    this.routingOrder = data.routing_order || data.routingOrder;
    this.permissions = data.permissions ? JSON.parse(data.permissions) : {};
    this.authenticationMethod = data.authentication_method || data.authenticationMethod;
    this.isRequired = data.is_required || data.isRequired;
    this.customMessage = data.custom_message || data.customMessage;
    this.sendReminders = data.send_reminders || data.sendReminders;
    this.language = data.language || 'en';
    this.timezone = data.timezone || 'UTC';
    this.accessRestrictions = data.access_restrictions ? JSON.parse(data.access_restrictions) : {};
    this.notificationSettings = data.notification_settings ? JSON.parse(data.notification_settings) : {};
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(roleData) {
    const {
      templateId,
      roleName,
      displayName,
      description = '',
      roleType = 'signer',
      routingOrder = 1,
      permissions = {},
      authenticationMethod = 'email',
      isRequired = true,
      customMessage = '',
      sendReminders = true,
      language = 'en',
      timezone = 'UTC',
      accessRestrictions = {},
      notificationSettings = {}
    } = roleData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO template_roles (
        uuid, template_id, role_name, display_name, description, role_type,
        routing_order, permissions, authentication_method, is_required,
        custom_message, send_reminders, language, timezone,
        access_restrictions, notification_settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, templateId, roleName, displayName, description, roleType,
        routingOrder, JSON.stringify(permissions), authenticationMethod, isRequired,
        customMessage, sendReminders, language, timezone,
        JSON.stringify(accessRestrictions), JSON.stringify(notificationSettings)
      ]
    );
    
    return this.findById(result.id);
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM template_roles WHERE id = ?', [id]);
    return row ? new TemplateRole(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM template_roles WHERE uuid = ?', [uuid]);
    return row ? new TemplateRole(row) : null;
  }

  static async findByTemplateId(templateId) {
    const rows = await db.all(
      'SELECT * FROM template_roles WHERE template_id = ? ORDER BY routing_order ASC',
      [templateId]
    );
    return rows.map(row => new TemplateRole(row));
  }

  static async findByRoleName(templateId, roleName) {
    const row = await db.get(
      'SELECT * FROM template_roles WHERE template_id = ? AND role_name = ?',
      [templateId, roleName]
    );
    return row ? new TemplateRole(row) : null;
  }

  async update(updates) {
    const allowedFields = [
      'roleName', 'displayName', 'description', 'roleType', 'routingOrder',
      'permissions', 'authenticationMethod', 'isRequired', 'customMessage',
      'sendReminders', 'language', 'timezone', 'accessRestrictions', 'notificationSettings'
    ];
    
    const fieldMapping = {
      'roleName': 'role_name',
      'displayName': 'display_name',
      'description': 'description',
      'roleType': 'role_type',
      'routingOrder': 'routing_order',
      'permissions': 'permissions',
      'authenticationMethod': 'authentication_method',
      'isRequired': 'is_required',
      'customMessage': 'custom_message',
      'sendReminders': 'send_reminders',
      'language': 'language',
      'timezone': 'timezone',
      'accessRestrictions': 'access_restrictions',
      'notificationSettings': 'notification_settings'
    };
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key];
        if (['permissions', 'accessRestrictions', 'notificationSettings'].includes(key)) {
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
      `UPDATE template_roles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return TemplateRole.findById(this.id);
  }

  async delete() {
    // Also delete associated template fields
    await db.run('DELETE FROM template_fields WHERE role_id = ?', [this.id]);
    await db.run('DELETE FROM template_roles WHERE id = ?', [this.id]);
  }

  // Get all fields assigned to this role
  async getFields() {
    const TemplateField = require('./TemplateField');
    return await TemplateField.findByRoleId(this.id);
  }

  // Assign this role to a recipient in an envelope
  async assignToRecipient(envelopeId, recipientData) {
    const db = require('./database');
    
    const result = await db.run(
      `INSERT INTO envelope_recipients (
        envelope_id, email, name, role, routing_order, permissions,
        authentication_method, custom_message, send_reminders,
        language, timezone, template_role_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        envelopeId,
        recipientData.email,
        recipientData.name,
        this.roleType,
        this.routingOrder,
        JSON.stringify(this.permissions),
        this.authenticationMethod,
        recipientData.customMessage || this.customMessage,
        this.sendReminders,
        this.language,
        this.timezone,
        this.id
      ]
    );

    return result.id;
  }

  toJSON() {
    return {
      id: this.id,
      uuid: this.uuid,
      templateId: this.templateId,
      roleName: this.roleName,
      displayName: this.displayName,
      description: this.description,
      roleType: this.roleType,
      routingOrder: this.routingOrder,
      permissions: this.permissions,
      authenticationMethod: this.authenticationMethod,
      isRequired: this.isRequired,
      customMessage: this.customMessage,
      sendReminders: this.sendReminders,
      language: this.language,
      timezone: this.timezone,
      accessRestrictions: this.accessRestrictions,
      notificationSettings: this.notificationSettings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TemplateRole;
