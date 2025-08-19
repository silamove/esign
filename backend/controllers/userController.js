const User = require('../models/User');

class UserController {
  // Get current user profile
  async getProfile(req, res, next) {
    try {
      res.json({
        success: true,
        data: req.user.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user profile
  async updateProfile(req, res, next) {
    try {
      const allowedFields = ['firstName', 'lastName', 'email'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      const updatedUser = await req.user.update(updates);

      res.json({
        success: true,
        data: updatedUser.toJSON(),
        message: 'Profile updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Change password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await User.authenticate(req.user.email, currentPassword);
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      await user.updatePassword(newPassword);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user's signatures
  async getSignatures(req, res, next) {
    try {
      const signatures = await req.user.getSignatures();
      
      res.json({
        success: true,
        data: signatures
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user's documents with pagination
  async getDocuments(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const documents = await req.user.getDocuments(parseInt(limit), offset);
      
      res.json({
        success: true,
        data: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: documents.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user statistics
  async getStats(req, res, next) {
    try {
      const documents = await req.user.getDocuments(1000, 0); // Get all for stats
      const signatures = await req.user.getSignatures();

      const stats = {
        totalDocuments: documents.length,
        documentsByStatus: {
          draft: documents.filter(d => d.status === 'draft').length,
          in_progress: documents.filter(d => d.status === 'in_progress').length,
          completed: documents.filter(d => d.status === 'completed').length
        },
        totalSignatures: signatures.length,
        recentActivity: documents
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, 5)
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get all users
  async getAllUsers(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const users = await User.findAll(parseInt(limit), offset);
      
      res.json({
        success: true,
        data: users.map(user => user.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update user
  async updateUser(req, res, next) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const allowedFields = ['firstName', 'lastName', 'email', 'role', 'isActive'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      const updatedUser = await user.update(updates);

      res.json({
        success: true,
        data: updatedUser.toJSON(),
        message: 'User updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete user
  async deleteUser(req, res, next) {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Soft delete
      await user.delete();

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
