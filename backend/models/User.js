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
    this.currentOrganizationId = data.current_organization_id;
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

  // Organization-related methods
  async getOrganizations() {
    try {
      const rows = await db.all(`
        SELECT o.*, ou.role, ou.permissions, ou.joined_at as org_joined_at, ou.is_active as org_active
        FROM organizations o
        JOIN organization_users ou ON o.id = ou.organization_id
        WHERE ou.user_id = ? AND ou.is_active = true
        ORDER BY ou.joined_at DESC
      `, [this.id]);
      
      return rows;
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw error;
    }
  }

  async getCurrentOrganization() {
    try {
      if (!this.currentOrganizationId) {
        return null;
      }

      const Organization = require('./Organization');
      return await Organization.findById(this.currentOrganizationId);
    } catch (error) {
      console.error('Error getting current organization:', error);
      throw error;
    }
  }

  async getOrganizationRole(organizationId) {
    try {
      const row = await db.get(`
        SELECT role, permissions, is_active
        FROM organization_users
        WHERE user_id = ? AND organization_id = ?
      `, [this.id, organizationId]);
      
      return row;
    } catch (error) {
      console.error('Error getting organization role:', error);
      throw error;
    }
  }

  async switchOrganization(organizationId) {
    try {
      // Verify user belongs to this organization
      const userOrg = await this.getOrganizationRole(organizationId);
      if (!userOrg || !userOrg.is_active) {
        throw new Error('User does not belong to this organization');
      }

      await db.run(`
        UPDATE users SET current_organization_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [organizationId, this.id]);

      this.currentOrganizationId = organizationId;
      return true;
    } catch (error) {
      console.error('Error switching organization:', error);
      throw error;
    }
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
