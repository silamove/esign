const db = require('./database');

class Organization {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.domain = data.domain;
    this.logoUrl = data.logo_url || data.logoUrl;
    this.website = data.website;
    this.phone = data.phone;
    this.address = data.address;
    this.city = data.city;
    this.state = data.state;
    this.country = data.country;
    this.postalCode = data.postal_code || data.postalCode;
    this.timezone = data.timezone || 'UTC';
    this.settings = data.settings ? JSON.parse(data.settings) : data.settings || {};
    this.subscriptionPlan = data.subscription_plan || data.subscriptionPlan;
    this.subscriptionStatus = data.subscription_status || data.subscriptionStatus;
    this.billingEmail = data.billing_email || data.billingEmail;
    this.isActive = data.is_active !== undefined ? data.is_active : data.isActive;
    this.parentOrganizationId = data.parent_organization_id || data.parentOrganizationId;
    this.organizationType = data.organization_type || data.organizationType || 'company';
    this.legalEntityType = data.legal_entity_type || data.legalEntityType;
    this.taxId = data.tax_id || data.taxId;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  // Static methods
  static async findAll(options = {}) {
    try {
      let query = 'SELECT * FROM organizations WHERE 1=1';
      const params = [];

      if (options.isActive !== undefined) {
        query += ' AND is_active = ?';
        params.push(options.isActive);
      }

      if (options.subscriptionStatus) {
        query += ' AND subscription_status = ?';
        params.push(options.subscriptionStatus);
      }

      query += ' ORDER BY created_at DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      const rows = await db.all(query, params);
      return rows.map(row => new Organization(row));
    } catch (error) {
      console.error('Error finding organizations:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const row = await db.get('SELECT * FROM organizations WHERE id = ?', [id]);
      return row ? new Organization(row) : null;
    } catch (error) {
      console.error('Error finding organization by ID:', error);
      throw error;
    }
  }

  static async findBySlug(slug) {
    try {
      const row = await db.get('SELECT * FROM organizations WHERE slug = ?', [slug]);
      return row ? new Organization(row) : null;
    } catch (error) {
      console.error('Error finding organization by slug:', error);
      throw error;
    }
  }

  static async findByDomain(domain) {
    try {
      const row = await db.get('SELECT * FROM organizations WHERE domain = ?', [domain]);
      return row ? new Organization(row) : null;
    } catch (error) {
      console.error('Error finding organization by domain:', error);
      throw error;
    }
  }

  static async create(data) {
    try {
      const {
        name,
        slug,
        domain,
        logoUrl,
        website,
        phone,
        address,
        city,
        state,
        country,
        postalCode,
        timezone = 'UTC',
        settings = {},
        subscriptionPlan = 'free',
        subscriptionStatus = 'active',
        billingEmail,
        isActive = true
      } = data;

      const result = await db.run(`
        INSERT INTO organizations (
          name, slug, domain, logo_url, website, phone, address, city, state, 
          country, postal_code, timezone, settings, subscription_plan, 
          subscription_status, billing_email, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name, slug, domain, logoUrl, website, phone, address, city, state,
        country, postalCode, timezone, JSON.stringify(settings), subscriptionPlan,
        subscriptionStatus, billingEmail, isActive
      ]);

      return await Organization.findById(result.lastID);
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  // Instance methods
  async update(data) {
    try {
      const fields = [];
      const values = [];

      const allowedFields = [
        'name', 'slug', 'domain', 'logoUrl', 'website', 'phone', 'address',
        'city', 'state', 'country', 'postalCode', 'timezone', 'settings',
        'subscriptionPlan', 'subscriptionStatus', 'billingEmail', 'isActive'
      ];

      const fieldMap = {
        logoUrl: 'logo_url',
        postalCode: 'postal_code',
        subscriptionPlan: 'subscription_plan',
        subscriptionStatus: 'subscription_status',
        billingEmail: 'billing_email',
        isActive: 'is_active'
      };

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          const dbField = fieldMap[field] || field;
          fields.push(`${dbField} = ?`);
          
          if (field === 'settings') {
            values.push(JSON.stringify(data[field]));
          } else {
            values.push(data[field]);
          }
        }
      });

      if (fields.length === 0) {
        return this;
      }

      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(this.id);

      await db.run(
        `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return await Organization.findById(this.id);
    } catch (error) {
      console.error('Error updating organization:', error);
      throw error;
    }
  }

  async delete() {
    try {
      await db.run('UPDATE organizations SET is_active = false WHERE id = ?', [this.id]);
      return true;
    } catch (error) {
      console.error('Error deleting organization:', error);
      throw error;
    }
  }

  async getUsers(options = {}) {
    try {
      let query = `
        SELECT u.*, ou.role, ou.permissions, ou.joined_at as org_joined_at, ou.is_active as org_active
        FROM users u
        JOIN organization_users ou ON u.id = ou.user_id
        WHERE ou.organization_id = ?
      `;
      const params = [this.id];

      if (options.role) {
        query += ' AND ou.role = ?';
        params.push(options.role);
      }

      if (options.isActive !== undefined) {
        query += ' AND ou.is_active = ?';
        params.push(options.isActive);
      }

      query += ' ORDER BY ou.joined_at DESC';

      const rows = await db.all(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting organization users:', error);
      throw error;
    }
  }

  async addUser(userId, role = 'member', permissions = {}) {
    try {
      await db.run(`
        INSERT OR REPLACE INTO organization_users (organization_id, user_id, role, permissions)
        VALUES (?, ?, ?, ?)
      `, [this.id, userId, role, JSON.stringify(permissions)]);

      return true;
    } catch (error) {
      console.error('Error adding user to organization:', error);
      throw error;
    }
  }

  async removeUser(userId) {
    try {
      await db.run(`
        UPDATE organization_users 
        SET is_active = false 
        WHERE organization_id = ? AND user_id = ?
      `, [this.id, userId]);

      return true;
    } catch (error) {
      console.error('Error removing user from organization:', error);
      throw error;
    }
  }

  async updateUserRole(userId, role, permissions = {}) {
    try {
      await db.run(`
        UPDATE organization_users 
        SET role = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ? AND user_id = ?
      `, [role, JSON.stringify(permissions), this.id, userId]);

      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const [userCount, documentCount, templateCount] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM organization_users WHERE organization_id = ? AND is_active = true', [this.id]),
        db.get('SELECT COUNT(*) as count FROM documents WHERE organization_id = ?', [this.id]),
        db.get('SELECT COUNT(*) as count FROM envelope_templates WHERE organization_id = ?', [this.id])
      ]);

      return {
        users: userCount.count,
        documents: documentCount.count,
        templates: templateCount.count
      };
    } catch (error) {
      console.error('Error getting organization stats:', error);
      throw error;
    }
  }

  // Sister company and relationship methods
  async getRelatedOrganizations(relationshipType = null) {
    try {
      let query = `
        SELECT 
          o.*,
          r.relationship_type,
          r.relationship_name,
          r.permissions,
          r.is_bidirectional,
          r.created_at as relationship_created_at
        FROM organizations o
        JOIN organization_relationships r ON o.id = r.related_organization_id
        WHERE r.organization_id = ? AND r.is_active = true
      `;
      const params = [this.id];

      if (relationshipType) {
        query += ' AND r.relationship_type = ?';
        params.push(relationshipType);
      }

      query += ' ORDER BY r.relationship_type, o.name';

      const rows = await db.all(query, params);
      return rows.map(row => ({
        organization: new Organization(row),
        relationship: {
          type: row.relationship_type,
          name: row.relationship_name,
          permissions: row.permissions ? JSON.parse(row.permissions) : {},
          isBidirectional: row.is_bidirectional,
          createdAt: row.relationship_created_at
        }
      }));
    } catch (error) {
      console.error('Error getting related organizations:', error);
      throw error;
    }
  }

  async getSisterCompanies() {
    return await this.getRelatedOrganizations('sister');
  }

  async getSubsidiaries() {
    return await this.getRelatedOrganizations('subsidiary');
  }

  async getDivisions() {
    return await this.getRelatedOrganizations('division');
  }

  async getPartners() {
    return await this.getRelatedOrganizations('partner');
  }

  async getParentCompany() {
    try {
      const rows = await this.getRelatedOrganizations('parent');
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting parent company:', error);
      throw error;
    }
  }

  async addRelationship(relatedOrgId, relationshipType, options = {}) {
    try {
      const {
        relationshipName = null,
        permissions = {},
        isBidirectional = true,
        createdBy
      } = options;

      await db.run(`
        INSERT OR REPLACE INTO organization_relationships (
          organization_id, related_organization_id, relationship_type,
          relationship_name, permissions, is_bidirectional, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        this.id, relatedOrgId, relationshipType,
        relationshipName, JSON.stringify(permissions), isBidirectional, createdBy
      ]);

      // Create bidirectional relationship if specified
      if (isBidirectional) {
        const reverseType = this.getReverseRelationshipType(relationshipType);
        if (reverseType) {
          await db.run(`
            INSERT OR REPLACE INTO organization_relationships (
              organization_id, related_organization_id, relationship_type,
              relationship_name, permissions, is_bidirectional, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            relatedOrgId, this.id, reverseType,
            relationshipName, JSON.stringify(permissions), isBidirectional, createdBy
          ]);
        }
      }

      return true;
    } catch (error) {
      console.error('Error adding organization relationship:', error);
      throw error;
    }
  }

  getReverseRelationshipType(relationshipType) {
    const reverseMap = {
      'sister': 'sister',
      'subsidiary': 'parent',
      'parent': 'subsidiary',
      'division': 'parent',
      'partner': 'partner',
      'affiliate': 'affiliate'
    };
    return reverseMap[relationshipType] || relationshipType;
  }

  async removeRelationship(relatedOrgId, relationshipType) {
    try {
      await db.run(`
        UPDATE organization_relationships 
        SET is_active = false 
        WHERE organization_id = ? AND related_organization_id = ? AND relationship_type = ?
      `, [this.id, relatedOrgId, relationshipType]);

      // Also remove reverse relationship
      const reverseType = this.getReverseRelationshipType(relationshipType);
      await db.run(`
        UPDATE organization_relationships 
        SET is_active = false 
        WHERE organization_id = ? AND related_organization_id = ? AND relationship_type = ?
      `, [relatedOrgId, this.id, reverseType]);

      return true;
    } catch (error) {
      console.error('Error removing organization relationship:', error);
      throw error;
    }
  }

  async getOrganizationFamily() {
    try {
      // Get all related organizations in one query
      const allRelations = await this.getRelatedOrganizations();
      
      // Organize by relationship type
      const family = {
        parent: null,
        subsidiaries: [],
        divisions: [],
        sisters: [],
        partners: [],
        affiliates: []
      };

      allRelations.forEach(relation => {
        const type = relation.relationship.type;
        switch (type) {
          case 'parent':
            family.parent = relation;
            break;
          case 'subsidiary':
            family.subsidiaries.push(relation);
            break;
          case 'division':
            family.divisions.push(relation);
            break;
          case 'sister':
            family.sisters.push(relation);
            break;
          case 'partner':
            family.partners.push(relation);
            break;
          case 'affiliate':
            family.affiliates.push(relation);
            break;
        }
      });

      return family;
    } catch (error) {
      console.error('Error getting organization family:', error);
      throw error;
    }
  }

  // Check if this organization can access resources from another organization
  async canAccessOrganization(targetOrgId, accessType = 'view') {
    try {
      const relationship = await db.get(`
        SELECT permissions FROM organization_relationships
        WHERE organization_id = ? AND related_organization_id = ? AND is_active = true
      `, [this.id, targetOrgId]);

      if (!relationship) {
        return false;
      }

      const permissions = JSON.parse(relationship.permissions || '{}');
      
      // Check specific permission based on access type
      switch (accessType) {
        case 'shareTemplates':
          return permissions.shareTemplates === true;
        case 'shareUsers':
          return permissions.shareUsers === true;
        case 'shareDocuments':
          return permissions.shareDocuments === true;
        case 'viewReports':
          return permissions.viewReports === true;
        default:
          return true; // Basic access granted if relationship exists
      }
    } catch (error) {
      console.error('Error checking organization access:', error);
      return false;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      domain: this.domain,
      logoUrl: this.logoUrl,
      website: this.website,
      phone: this.phone,
      address: this.address,
      city: this.city,
      state: this.state,
      country: this.country,
      postalCode: this.postalCode,
      timezone: this.timezone,
      settings: this.settings,
      subscriptionPlan: this.subscriptionPlan,
      subscriptionStatus: this.subscriptionStatus,
      billingEmail: this.billingEmail,
      isActive: this.isActive,
      parentOrganizationId: this.parentOrganizationId,
      organizationType: this.organizationType,
      legalEntityType: this.legalEntityType,
      taxId: this.taxId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Organization;
