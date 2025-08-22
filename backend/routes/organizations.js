const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const { authMiddleware } = require('../middleware/auth');

// Get all organizations (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can view all organizations'
      });
    }

    const { isActive, subscriptionStatus, limit } = req.query;
    
    const options = {};
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (subscriptionStatus) options.subscriptionStatus = subscriptionStatus;
    if (limit) options.limit = parseInt(limit);

    const organizations = await Organization.findAll(options);
    
    res.json({
      success: true,
      data: organizations.map(org => org.toJSON())
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: error.message
    });
  }
});

// Get current user's organization
router.get('/current', authMiddleware, async (req, res) => {
  try {
    console.log('Debug - User object:', req.user);
    console.log('Debug - Current org ID:', req.user.currentOrganizationId);
    
    const organization = await Organization.findById(req.user.currentOrganizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get user's role in this organization
    const userOrg = await req.user.getOrganizationRole(organization.id);
    const stats = await organization.getStats();

    res.json({
      success: true,
      data: {
        ...organization.toJSON(),
        userRole: userOrg?.role || 'member',
        userPermissions: userOrg?.permissions || {},
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching current organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization',
      error: error.message
    });
  }
});

// Get single organization
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user belongs to this organization or is admin
    if (req.user.role !== 'admin' && req.user.current_organization_id !== organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const stats = await organization.getStats();

    res.json({
      success: true,
      data: {
        ...organization.toJSON(),
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization',
      error: error.message
    });
  }
});

// Create new organization
router.post('/', authMiddleware, async (req, res) => {
  try {
    const organization = await Organization.create(req.body);
    
    // Add the creator as owner
    await organization.addUser(req.user.id, 'owner');
    
    res.status(201).json({
      success: true,
      data: organization.toJSON(),
      message: 'Organization created successfully'
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: error.message
    });
  }
});

// Update organization
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission to update (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const updatedOrganization = await organization.update(req.body);
    
    res.json({
      success: true,
      data: updatedOrganization.toJSON(),
      message: 'Organization updated successfully'
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organization',
      error: error.message
    });
  }
});

// Delete organization (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || userOrg.role !== 'owner')) {
      return res.status(403).json({
        success: false,
        message: 'Only organization owners or administrators can delete organizations'
      });
    }

    await organization.delete();
    
    res.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete organization',
      error: error.message
    });
  }
});

// Get organization users
router.get('/:id/users', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user belongs to this organization or is admin
    if (req.user.role !== 'admin' && req.user.current_organization_id !== organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { role, isActive } = req.query;
    const options = {};
    if (role) options.role = role;
    if (isActive !== undefined) options.isActive = isActive === 'true';

    const users = await organization.getUsers(options);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching organization users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Add user to organization
router.post('/:id/users', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member', permissions = {} } = req.body;
    
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await organization.addUser(userId, role, permissions);
    
    res.json({
      success: true,
      message: 'User added to organization successfully'
    });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add user to organization',
      error: error.message
    });
  }
});

// Update user role in organization
router.put('/:id/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role, permissions = {} } = req.body;
    
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await organization.updateUserRole(userId, role, permissions);
    
    res.json({
      success: true,
      message: 'User role updated successfully'
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// Remove user from organization
router.delete('/:id/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await organization.removeUser(userId);
    
    res.json({
      success: true,
      message: 'User removed from organization successfully'
    });
  } catch (error) {
    console.error('Error removing user from organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user from organization',
      error: error.message
    });
  }
});

// Get organization family (all related organizations)
router.get('/:id/family', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user belongs to this organization or is admin
    if (req.user.role !== 'admin' && req.user.currentOrganizationId !== organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const family = await organization.getOrganizationFamily();
    
    res.json({
      success: true,
      data: {
        organization: organization.toJSON(),
        family
      }
    });
  } catch (error) {
    console.error('Error fetching organization family:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization family',
      error: error.message
    });
  }
});

// Get related organizations by type
router.get('/:id/related/:type', authMiddleware, async (req, res) => {
  try {
    const { id, type } = req.params;
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user belongs to this organization or is admin
    if (req.user.role !== 'admin' && req.user.currentOrganizationId !== organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const validTypes = ['sister', 'subsidiary', 'division', 'partner', 'affiliate', 'parent'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid relationship type'
      });
    }

    const related = await organization.getRelatedOrganizations(type);
    
    res.json({
      success: true,
      data: related
    });
  } catch (error) {
    console.error('Error fetching related organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch related organizations',
      error: error.message
    });
  }
});

// Add relationship between organizations
router.post('/:id/relationships', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      relatedOrganizationId, 
      relationshipType, 
      relationshipName, 
      permissions = {},
      isBidirectional = true 
    } = req.body;

    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Validate relationship type
    const validTypes = ['sister', 'subsidiary', 'division', 'partner', 'affiliate'];
    if (!validTypes.includes(relationshipType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid relationship type'
      });
    }

    // Check if related organization exists
    const relatedOrg = await Organization.findById(relatedOrganizationId);
    if (!relatedOrg) {
      return res.status(404).json({
        success: false,
        message: 'Related organization not found'
      });
    }

    await organization.addRelationship(relatedOrganizationId, relationshipType, {
      relationshipName,
      permissions,
      isBidirectional,
      createdBy: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Organization relationship created successfully'
    });
  } catch (error) {
    console.error('Error creating organization relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization relationship',
      error: error.message
    });
  }
});

// Remove relationship between organizations
router.delete('/:id/relationships/:relatedId/:type', authMiddleware, async (req, res) => {
  try {
    const { id, relatedId, type } = req.params;
    
    const organization = await Organization.findById(id);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if user has permission (owner/admin of org or global admin)
    const userOrg = await req.user.getOrganizationRole(organization.id);
    if (req.user.role !== 'admin' && (!userOrg || !['owner', 'admin'].includes(userOrg.role))) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await organization.removeRelationship(relatedId, type);
    
    res.json({
      success: true,
      message: 'Organization relationship removed successfully'
    });
  } catch (error) {
    console.error('Error removing organization relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove organization relationship',
      error: error.message
    });
  }
});

module.exports = router;
