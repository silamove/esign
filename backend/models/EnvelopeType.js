const db = require('./database');

class EnvelopeType {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.displayName = data.display_name || data.displayName;
    this.description = data.description;
    this.icon = data.icon;
    this.color = data.color;
    this.category = data.category;
    this.isActive = data.is_active !== undefined ? data.is_active : data.isActive;
    this.sortOrder = data.sort_order || data.sortOrder;
    this.defaultExpirationDays = data.default_expiration_days || data.defaultExpirationDays;
    this.requiresWitness = data.requires_witness !== undefined ? data.requires_witness : data.requiresWitness;
    this.requiresNotary = data.requires_notary !== undefined ? data.requires_notary : data.requiresNotary;
    this.complianceRequirements = data.compliance_requirements ? JSON.parse(data.compliance_requirements) : data.complianceRequirements || {};
    this.suggestedFields = data.suggested_fields ? JSON.parse(data.suggested_fields) : data.suggestedFields || [];
    this.workflowSettings = data.workflow_settings ? JSON.parse(data.workflow_settings) : data.workflowSettings || {};
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async findAll(options = {}) {
    const { category, isActive = true } = options;
    
    let query = 'SELECT * FROM envelope_types';
    const params = [];
    const conditions = [];

    if (isActive !== null) {
      conditions.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sort_order ASC, display_name ASC';

    const rows = await db.all(query, params);
    return rows.map(row => new EnvelopeType(row));
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM envelope_types WHERE id = ?', [id]);
    return row ? new EnvelopeType(row) : null;
  }

  static async findByName(name) {
    const row = await db.get('SELECT * FROM envelope_types WHERE name = ?', [name]);
    return row ? new EnvelopeType(row) : null;
  }

  static async findByCategory(category) {
    const rows = await db.all(
      'SELECT * FROM envelope_types WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC, display_name ASC',
      [category]
    );
    return rows.map(row => new EnvelopeType(row));
  }

  static async getCategories() {
    const rows = await db.all(
      `SELECT DISTINCT category, COUNT(*) as count 
       FROM envelope_types 
       WHERE is_active = 1 
       GROUP BY category 
       ORDER BY category`
    );
    return rows;
  }

  static async create(typeData) {
    const {
      name,
      displayName,
      description = '',
      icon = '',
      color = '#3B82F6',
      category = 'general',
      isActive = true,
      sortOrder = 0,
      defaultExpirationDays = 30,
      requiresWitness = false,
      requiresNotary = false,
      complianceRequirements = {},
      suggestedFields = [],
      workflowSettings = {}
    } = typeData;

    const result = await db.run(
      `INSERT INTO envelope_types (
        name, display_name, description, icon, color, category, is_active, sort_order,
        default_expiration_days, requires_witness, requires_notary, 
        compliance_requirements, suggested_fields, workflow_settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, displayName, description, icon, color, category, isActive ? 1 : 0, sortOrder,
        defaultExpirationDays, requiresWitness ? 1 : 0, requiresNotary ? 1 : 0,
        JSON.stringify(complianceRequirements), JSON.stringify(suggestedFields), JSON.stringify(workflowSettings)
      ]
    );

    return this.findById(result.id);
  }

  async update(updateData) {
    const allowedFields = [
      'display_name', 'description', 'icon', 'color', 'category', 'is_active', 'sort_order',
      'default_expiration_days', 'requires_witness', 'requires_notary',
      'compliance_requirements', 'suggested_fields', 'workflow_settings'
    ];

    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        updates.push(`${dbKey} = ?`);
        
        // Handle JSON fields
        if (['compliance_requirements', 'suggested_fields', 'workflow_settings'].includes(dbKey)) {
          values.push(JSON.stringify(updateData[key]));
        } else if (typeof updateData[key] === 'boolean') {
          values.push(updateData[key] ? 1 : 0);
        } else {
          values.push(updateData[key]);
        }
      }
    });

    if (updates.length === 0) {
      return this;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);

    await db.run(
      `UPDATE envelope_types SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return EnvelopeType.findById(this.id);
  }

  async delete() {
    // Soft delete by setting is_active to false
    await db.run('UPDATE envelope_types SET is_active = 0 WHERE id = ?', [this.id]);
    return true;
  }

  // Get suggested fields for this envelope type
  getSuggestedFieldsForRole(roleName = 'signer') {
    return this.suggestedFields.map(fieldType => ({
      fieldType,
      roleName,
      required: ['signature', 'date'].includes(fieldType), // Common required fields
      displayName: this.getFieldDisplayName(fieldType)
    }));
  }

  getFieldDisplayName(fieldType) {
    const fieldNames = {
      'signature': 'Signature',
      'initial': 'Initials',
      'date': 'Date',
      'full_name': 'Full Name',
      'first_name': 'First Name',
      'last_name': 'Last Name',
      'email': 'Email Address',
      'phone': 'Phone Number',
      'company': 'Company Name',
      'title': 'Job Title',
      'address': 'Address',
      'city': 'City',
      'state': 'State',
      'zip': 'ZIP Code',
      'ssn': 'Social Security Number',
      'text': 'Text Field',
      'checkbox': 'Checkbox',
      'dropdown': 'Dropdown',
      'number': 'Number'
    };
    return fieldNames[fieldType] || fieldType;
  }

  // Get default expiration date for this type
  getDefaultExpirationDate() {
    const now = new Date();
    now.setDate(now.getDate() + this.defaultExpirationDays);
    return now;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      icon: this.icon,
      color: this.color,
      category: this.category,
      isActive: this.isActive,
      sortOrder: this.sortOrder,
      defaultExpirationDays: this.defaultExpirationDays,
      requiresWitness: this.requiresWitness,
      requiresNotary: this.requiresNotary,
      complianceRequirements: this.complianceRequirements,
      suggestedFields: this.suggestedFields,
      workflowSettings: this.workflowSettings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = EnvelopeType;
