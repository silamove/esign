const bcrypt = require('bcryptjs');
const db = require('./database');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.role = data.role;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(userData) {
    const { email, password, firstName, lastName, role = 'user' } = userData;
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const { query, params } = db.buildInsertQuery('users', {
      email: email.toLowerCase(),
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role
    });
    
    const result = await db.run(query, params);
    return this.findById(result.id);
  }

  static async findById(id) {
    const { query, params } = db.buildSelectQuery('users', {
      where: { id }
    });
    
    const row = await db.get(query, params);
    return row ? new User(row) : null;
  }

  static async findByEmail(email) {
    const { query, params } = db.buildSelectQuery('users', {
      where: { email: email.toLowerCase() }
    });
    
    const row = await db.get(query, params);
    return row ? new User(row) : null;
  }

  static async findAll(limit = 50, offset = 0) {
    const { query, params } = db.buildSelectQuery('users', {
      orderBy: 'created_at DESC',
      limit,
      offset
    });
    
    const rows = await db.all(query, params);
    return rows.map(row => new User(row));
  }

  static async authenticate(email, password) {
    const { query, params } = db.buildSelectQuery('users', {
      where: { 
        email: email.toLowerCase(),
        is_active: true 
      }
    });
    
    const row = await db.get(query, params);
    if (!row) return null;
    
    const isValid = await bcrypt.compare(password, row.password);
    if (!isValid) return null;
    
    return new User(row);
  }

  async update(updates) {
    const allowedFields = ['first_name', 'last_name', 'email', 'role', 'is_active'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = key === 'email' ? value.toLowerCase() : value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) return this;
    
    const { query, params } = db.buildUpdateQuery('users', filteredUpdates, { id: this.id });
    await db.run(query, params);
    
    return User.findById(this.id);
  }

  async updatePassword(newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const { query, params } = db.buildUpdateQuery('users', 
      { password: hashedPassword }, 
      { id: this.id }
    );
    await db.run(query, params);
  }

  async delete() {
    const { query, params } = db.buildUpdateQuery('users', 
      { is_active: false }, 
      { id: this.id }
    );
    await db.run(query, params);
  }

  async getDocuments(limit = 50, offset = 0) {
    const { query, params } = db.buildSelectQuery('documents', {
      where: { user_id: this.id },
      orderBy: 'updated_at DESC',
      limit,
      offset
    });
    
    return await db.all(query, params);
  }

  async getSignatures() {
    const { query, params } = db.buildSelectQuery('signatures', {
      where: { user_id: this.id },
      orderBy: 'created_at DESC'
    });
    
    return await db.all(query, params);
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;
