const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const isPostgres = (process.env.DATABASE_TYPE === 'postgresql');

class Document {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.userId = data.user_id || data.userId;
    this.envelopeId = data.envelope_id || data.envelopeId; // new linkage in PG
    this.originalName = data.original_name || data.originalName;
    // Prefer unified filename, fallback to legacy file_name
    this.filename = data.filename || data.file_name;
    this.fileSize = data.file_size || data.fileSize;
    this.mimeType = data.mime_type || data.mimeType;
    this.status = data.status;
    this.totalPages = data.total_pages || data.totalPages;
    // Safely handle JSONB (object) vs TEXT (string)
    if (data.metadata === null || data.metadata === undefined) {
      this.metadata = {};
    } else if (typeof data.metadata === 'string') {
      try { this.metadata = JSON.parse(data.metadata || '{}'); } catch { this.metadata = {}; }
    } else {
      this.metadata = data.metadata; // assume object from PG JSONB
    }
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(documentData) {
    const {
      userId,
      envelopeId = null,
      originalName,
      filename,
      fileSize,
      mimeType,
      totalPages = 1,
      metadata = {}
    } = documentData;

    const uuid = uuidv4();

    if (isPostgres) {
      // In Postgres we can persist envelope_id if provided
      const result = await db.run(
        `INSERT INTO documents (uuid, user_id, envelope_id, original_name, filename, file_size, mime_type, total_pages, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid, userId, envelopeId, originalName, filename, fileSize, mimeType, totalPages, JSON.stringify(metadata)]
      );
      return this.findById(result.lastID || result.id);
    }

    // SQLite legacy schema (no envelope_id)
    const result = await db.run(
      `INSERT INTO documents (uuid, user_id, original_name, filename, file_size, mime_type, total_pages, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      , [uuid, userId, originalName, filename, fileSize, mimeType, totalPages, JSON.stringify(metadata)]
    );
    return this.findById(result.lastID || result.id);
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM documents WHERE id = ?', [id]);
    return row ? new Document(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM documents WHERE uuid = ?', [uuid]);
    return row ? new Document(row) : null;
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    const rows = await db.all(
      'SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(row => new Document(row));
  }

  static async findAll(limit = 50, offset = 0) {
    const rows = await db.all(
      'SELECT * FROM documents ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows.map(row => new Document(row));
  }

  async update(updates) {
    const allowedFields = ['originalName', 'status', 'totalPages', 'metadata', 'envelopeId'];
    const fieldMapping = {
      'originalName': 'original_name',
      'status': 'status', 
      'totalPages': 'total_pages',
      'metadata': 'metadata',
      'envelopeId': 'envelope_id'
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
      `UPDATE documents SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    return Document.findById(this.id);
  }

  async delete() {
    // Note: cascading deletes are handled at the envelope/fields level in PG; here we just remove the document
    await db.run('DELETE FROM documents WHERE id = ?', [this.id]);
  }

  async getFields() {
    if (isPostgres) {
      let query = `
        SELECT f.*, r.email AS recipient_email
        FROM fields f
        LEFT JOIN recipients r ON r.id = f.recipient_id
        WHERE f.document_id = ?
        ORDER BY f.page ASC NULLS LAST, f.y ASC NULLS LAST, f.x ASC NULLS LAST`;
      const rows = await db.all(query, [this.id]);
      return rows.map(row => ({
        id: row.id,
        envelope_id: row.envelope_id,
        document_id: row.document_id,
        recipient_id: row.recipient_id,
        recipient_email: row.recipient_email,
        field_type: row.type,
        name: row.name,
        label: row.label,
        x: row.x, y: row.y, width: row.width, height: row.height,
        page: row.page,
        required: row.required,
        default_value: row.default_value,
        validation_rules: typeof row.validation_rules === 'string' ? JSON.parse(row.validation_rules || '{}') : (row.validation_rules || {}),
        value: row.value,
        signed_at: row.signed_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    }

    // SQLite legacy document_fields
    const rows = await db.all(
      'SELECT * FROM document_fields WHERE document_id = ? ORDER BY created_at ASC',
      [this.id]
    );
    return rows.map(row => ({
      ...row,
      fieldData: JSON.parse(row.field_data || row.fieldData)
    }));
  }

  async addField(fieldData) {
    if (isPostgres) {
      // Support both old and new shapes
      const fieldType = fieldData.fieldType || fieldData.type || (fieldData.data && fieldData.data.type) || 'text';
      const name = fieldData.fieldName || fieldData.name || (fieldData.data && (fieldData.data.name || fieldData.data.label)) || null;
      const label = fieldData.label || name || null;
      const x = fieldData.x ?? fieldData.left ?? (fieldData.data && fieldData.data.x);
      const y = fieldData.y ?? fieldData.top ?? (fieldData.data && fieldData.data.y);
      const width = fieldData.width ?? (fieldData.data && fieldData.data.width);
      const height = fieldData.height ?? (fieldData.data && fieldData.data.height);
      const page = fieldData.page ?? (fieldData.data && fieldData.data.page) ?? null;
      const required = (fieldData.required !== undefined) ? fieldData.required : (fieldData.data ? fieldData.data.required !== false : true);
      const defaultValue = fieldData.defaultValue ?? (fieldData.data && fieldData.data.defaultValue) ?? null;
      const defaultValueNormalized = (defaultValue && typeof defaultValue === 'object') ? JSON.stringify(defaultValue) : defaultValue;
      const validationRules = fieldData.validationRules || (fieldData.data && fieldData.data.validationRules) || {};
      const recipientEmail = fieldData.recipientEmail || fieldData.recipient_email || null;
      const explicitEnvelopeId = fieldData.envelopeId || fieldData.envelope_id || null;

      // Resolve envelope_id: prefer explicit -> document.envelopeId -> unique association via envelope_documents
      let envelopeId = explicitEnvelopeId || this.envelopeId || null;
      if (!envelopeId) {
        const candidates = await db.all('SELECT DISTINCT envelope_id FROM envelope_documents WHERE document_id = ?', [this.id]);
        if (candidates.length === 1) envelopeId = candidates[0].envelope_id;
      }
      if (!envelopeId) {
        throw new Error('Envelope ID is required to add a field to a document in PostgreSQL. Pass envelopeId to addField or associate the document to a single envelope.');
      }

      const result = await db.run(
        `INSERT INTO fields (envelope_id, document_id, recipient_id, type, name, label, x, y, width, height, page, required, default_value, validation_rules)
         VALUES (?, ?, ${recipientEmail ? '(SELECT id FROM recipients WHERE envelope_id = ? AND email = ?)' : 'NULL'}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        recipientEmail
          ? [
              envelopeId,
              this.id,
              envelopeId, recipientEmail,
              fieldType,
              name, label,
              x, y, width, height,
              page,
              required,
              defaultValueNormalized,
              JSON.stringify(validationRules)
            ]
          : [
              envelopeId,
              this.id,
              fieldType,
              name, label,
              x, y, width, height,
              page,
              required,
              defaultValueNormalized,
              JSON.stringify(validationRules)
            ]
      );

      // Update document status hint
      if (this.status === 'draft') {
        await this.update({ status: 'in_progress' });
      }

      return result;
    }

    // SQLite legacy path
    const { fieldType, data, x, y, width, height, page } = fieldData;
    
    const result = await db.run(
      `INSERT INTO document_fields (document_id, field_type, field_data, x, y, width, height, page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.id, fieldType, JSON.stringify(data), x, y, width, height, page]
    );
    
    // Update document status to indicate it has fields
    if (this.status === 'draft') {
      await this.update({ status: 'in_progress' });
    }
    
    return result;
  }

  async removeField(fieldId) {
    if (isPostgres) {
      await db.run('DELETE FROM fields WHERE id = ? AND document_id = ?', [fieldId, this.id]);
      return;
    }
    await db.run('DELETE FROM document_fields WHERE id = ? AND document_id = ?', [fieldId, this.id]);
  }

  async getShares() {
    const rows = await db.all(
      'SELECT * FROM document_shares WHERE documentId = ? ORDER BY createdAt DESC',
      [this.id]
    );
    return rows;
  }

  async share(shareData) {
    const { sharedBy, sharedWith, permissions = 'view', expiresAt } = shareData;
    const accessToken = uuidv4();
    
    const result = await db.run(
      `INSERT INTO document_shares (documentId, sharedBy, sharedWith, permissions, expiresAt, accessToken)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [this.id, sharedBy, sharedWith, permissions, expiresAt, accessToken]
    );
    
    return { id: result.id || result.lastID, accessToken };
  }

  async getAuditLogs() {
    const rows = await db.all(
      `SELECT al.*, u.first_name, u.last_name, u.email 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       WHERE al.document_id = ? 
       ORDER BY al.created_at DESC`,
      [this.id]
    );
    return rows;
  }

  async logAction(action, userId, details = {}, ipAddress = null, userAgent = null) {
    await db.run(
      `INSERT INTO audit_logs (user_id, document_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, this.id, action, JSON.stringify(details), ipAddress, userAgent]
    );
  }

  toJSON() {
    return {
      id: this.id,
      uuid: this.uuid,
      userId: this.userId,
      envelopeId: this.envelopeId,
      originalName: this.originalName,
      filename: this.filename,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      status: this.status,
      totalPages: this.totalPages,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Document;
