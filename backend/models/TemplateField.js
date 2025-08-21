const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * TemplateField - Signature and form fields for templates
 * Defines positioned fields that recipients will interact with
 */
class TemplateField {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.templateId = data.template_id || data.templateId;
    this.roleId = data.role_id || data.roleId;
    this.documentIndex = data.document_index || data.documentIndex;
    this.fieldType = data.field_type || data.fieldType;
    this.fieldName = data.field_name || data.fieldName;
    this.displayName = data.display_name || data.displayName;
    this.description = data.description;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.page = data.page;
    this.isRequired = data.is_required || data.isRequired;
    this.defaultValue = data.default_value || data.defaultValue;
    this.placeholder = data.placeholder;
    this.validationRules = data.validation_rules ? JSON.parse(data.validation_rules) : {};
    this.fieldOptions = data.field_options ? JSON.parse(data.field_options) : {};
    this.formatting = data.formatting ? JSON.parse(data.formatting) : {};
    this.conditionalLogic = data.conditional_logic ? JSON.parse(data.conditional_logic) : {};
    this.groupId = data.group_id || data.groupId;
    this.zIndex = data.z_index || data.zIndex;
    this.isLocked = data.is_locked || data.isLocked;
    this.tooltip = data.tooltip;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(fieldData) {
    const {
      templateId,
      roleId,
      documentIndex = 0,
      fieldType,
      fieldName,
      displayName,
      description = '',
      x,
      y,
      width,
      height,
      page = 1,
      isRequired = false,
      defaultValue = '',
      placeholder = '',
      validationRules = {},
      fieldOptions = {},
      formatting = {},
      conditionalLogic = {},
      groupId = null,
      zIndex = 1,
      isLocked = false,
      tooltip = ''
    } = fieldData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO template_fields (
        uuid, template_id, role_id, document_index, field_type, field_name,
        display_name, description, x, y, width, height, page, is_required,
        default_value, placeholder, validation_rules, field_options,
        formatting, conditional_logic, group_id, z_index, is_locked, tooltip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, templateId, roleId, documentIndex, fieldType, fieldName,
        displayName, description, x, y, width, height, page, isRequired,
        defaultValue, placeholder, JSON.stringify(validationRules), JSON.stringify(fieldOptions),
        JSON.stringify(formatting), JSON.stringify(conditionalLogic), groupId, zIndex, isLocked, tooltip
      ]
    );
    
    return this.findById(result.id);
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM template_fields WHERE id = ?', [id]);
    return row ? new TemplateField(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM template_fields WHERE uuid = ?', [uuid]);
    return row ? new TemplateField(row) : null;
  }

  static async findByTemplateId(templateId) {
    const rows = await db.all(
      `SELECT tf.*, tr.role_name, tr.display_name as role_display_name
       FROM template_fields tf
       LEFT JOIN template_roles tr ON tf.role_id = tr.id
       WHERE tf.template_id = ? 
       ORDER BY tf.document_index ASC, tf.page ASC, tf.y ASC, tf.x ASC`,
      [templateId]
    );
    return rows.map(row => new TemplateField(row));
  }

  static async findByRoleId(roleId) {
    const rows = await db.all(
      'SELECT * FROM template_fields WHERE role_id = ? ORDER BY document_index ASC, page ASC, y ASC, x ASC',
      [roleId]
    );
    return rows.map(row => new TemplateField(row));
  }

  static async findByDocumentAndPage(templateId, documentIndex, page) {
    const rows = await db.all(
      `SELECT tf.*, tr.role_name, tr.display_name as role_display_name
       FROM template_fields tf
       LEFT JOIN template_roles tr ON tf.role_id = tr.id
       WHERE tf.template_id = ? AND tf.document_index = ? AND tf.page = ?
       ORDER BY tf.y ASC, tf.x ASC`,
      [templateId, documentIndex, page]
    );
    return rows.map(row => new TemplateField(row));
  }

  // Field types that are supported
  static get FIELD_TYPES() {
    return {
      SIGNATURE: 'signature',
      INITIAL: 'initial',
      TEXT: 'text',
      EMAIL: 'email',
      DATE: 'date',
      CHECKBOX: 'checkbox',
      RADIO: 'radio',
      DROPDOWN: 'dropdown',
      NUMBER: 'number',
      PHONE: 'phone',
      SSN: 'ssn',
      TITLE: 'title',
      COMPANY: 'company',
      FULL_NAME: 'full_name',
      FIRST_NAME: 'first_name',
      LAST_NAME: 'last_name',
      ZIP: 'zip',
      ADDRESS: 'address',
      CITY: 'city',
      STATE: 'state',
      COUNTRY: 'country',
      NOTE: 'note',
      FORMULA: 'formula',
      ATTACHMENT: 'attachment'
    };
  }

  async update(updates) {
    const allowedFields = [
      'roleId', 'documentIndex', 'fieldType', 'fieldName', 'displayName', 'description',
      'x', 'y', 'width', 'height', 'page', 'isRequired', 'defaultValue', 'placeholder',
      'validationRules', 'fieldOptions', 'formatting', 'conditionalLogic', 'groupId',
      'zIndex', 'isLocked', 'tooltip'
    ];
    
    const fieldMapping = {
      'roleId': 'role_id',
      'documentIndex': 'document_index',
      'fieldType': 'field_type',
      'fieldName': 'field_name',
      'displayName': 'display_name',
      'description': 'description',
      'x': 'x',
      'y': 'y',
      'width': 'width',
      'height': 'height',
      'page': 'page',
      'isRequired': 'is_required',
      'defaultValue': 'default_value',
      'placeholder': 'placeholder',
      'validationRules': 'validation_rules',
      'fieldOptions': 'field_options',
      'formatting': 'formatting',
      'conditionalLogic': 'conditional_logic',
      'groupId': 'group_id',
      'zIndex': 'z_index',
      'isLocked': 'is_locked',
      'tooltip': 'tooltip'
    };
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbField = fieldMapping[key];
        if (['validationRules', 'fieldOptions', 'formatting', 'conditionalLogic'].includes(key)) {
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
      `UPDATE template_fields SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return TemplateField.findById(this.id);
  }

  async delete() {
    await db.run('DELETE FROM template_fields WHERE id = ?', [this.id]);
  }

  // Clone this field for a new template
  async clone(newTemplateId, newRoleId = null) {
    const cloneData = {
      templateId: newTemplateId,
      roleId: newRoleId || this.roleId,
      documentIndex: this.documentIndex,
      fieldType: this.fieldType,
      fieldName: this.fieldName,
      displayName: this.displayName,
      description: this.description,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      page: this.page,
      isRequired: this.isRequired,
      defaultValue: this.defaultValue,
      placeholder: this.placeholder,
      validationRules: this.validationRules,
      fieldOptions: this.fieldOptions,
      formatting: this.formatting,
      conditionalLogic: this.conditionalLogic,
      groupId: this.groupId,
      zIndex: this.zIndex,
      isLocked: this.isLocked,
      tooltip: this.tooltip
    };

    return TemplateField.create(cloneData);
  }

  // Convert template field to envelope signature field
  async toEnvelopeField(envelopeId, documentId, recipientId) {
    const db = require('./database');
    
    const result = await db.run(
      `INSERT INTO envelope_signatures (
        envelope_id, document_id, recipient_id, field_type, field_name,
        x, y, width, height, page, required, default_value,
        validation_rules, template_field_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        envelopeId, documentId, recipientId, this.fieldType, this.fieldName,
        this.x, this.y, this.width, this.height, this.page, this.isRequired,
        this.defaultValue, JSON.stringify(this.validationRules), this.id
      ]
    );

    return result.id;
  }

  // Validate field configuration
  validate() {
    const errors = [];

    if (!this.fieldType || !Object.values(TemplateField.FIELD_TYPES).includes(this.fieldType)) {
      errors.push('Invalid field type');
    }

    if (!this.fieldName || this.fieldName.trim() === '') {
      errors.push('Field name is required');
    }

    if (this.x < 0 || this.y < 0) {
      errors.push('Field position must be non-negative');
    }

    if (this.width <= 0 || this.height <= 0) {
      errors.push('Field dimensions must be positive');
    }

    if (this.page < 1) {
      errors.push('Page number must be at least 1');
    }

    // Field-specific validation
    switch (this.fieldType) {
      case TemplateField.FIELD_TYPES.EMAIL:
        if (this.defaultValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.defaultValue)) {
          errors.push('Default email value is invalid');
        }
        break;
      
      case TemplateField.FIELD_TYPES.PHONE:
        if (this.defaultValue && !/^\+?[\d\s\-\(\)]+$/.test(this.defaultValue)) {
          errors.push('Default phone value is invalid');
        }
        break;
      
      case TemplateField.FIELD_TYPES.DATE:
        if (this.defaultValue && isNaN(Date.parse(this.defaultValue))) {
          errors.push('Default date value is invalid');
        }
        break;
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      uuid: this.uuid,
      templateId: this.templateId,
      roleId: this.roleId,
      documentIndex: this.documentIndex,
      fieldType: this.fieldType,
      fieldName: this.fieldName,
      displayName: this.displayName,
      description: this.description,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      page: this.page,
      isRequired: this.isRequired,
      defaultValue: this.defaultValue,
      placeholder: this.placeholder,
      validationRules: this.validationRules,
      fieldOptions: this.fieldOptions,
      formatting: this.formatting,
      conditionalLogic: this.conditionalLogic,
      groupId: this.groupId,
      zIndex: this.zIndex,
      isLocked: this.isLocked,
      tooltip: this.tooltip,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TemplateField;
