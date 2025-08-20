const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class Document {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.userId = data.user_id || data.userId;
    this.originalName = data.original_name || data.originalName;
    this.filename = data.filename;
    this.fileSize = data.file_size || data.fileSize;
    this.mimeType = data.mime_type || data.mimeType;
    this.status = data.status;
    this.totalPages = data.total_pages || data.totalPages;
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  static async create(documentData) {
    const {
      userId,
      originalName,
      filename,
      fileSize,
      mimeType,
      totalPages = 1,
      metadata = {}
    } = documentData;

    const uuid = uuidv4();
    
    const result = await db.run(
      `INSERT INTO documents (uuid, user_id, original_name, filename, file_size, mime_type, total_pages, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, userId, originalName, filename, fileSize, mimeType, totalPages, JSON.stringify(metadata)]
    );
    
    return this.findById(result.id);
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
    const allowedFields = ['originalName', 'status', 'totalPages', 'metadata'];
    const fieldMapping = {
      'originalName': 'original_name',
      'status': 'status', 
      'totalPages': 'total_pages',
      'metadata': 'metadata'
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
    await db.run('DELETE FROM documents WHERE id = ?', [this.id]);
  }

  async getFields() {
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
    
    return { id: result.id, accessToken };
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
