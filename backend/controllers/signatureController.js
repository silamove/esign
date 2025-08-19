const db = require('../models/database');

class SignatureController {
  // Get user's signatures
  async getSignatures(req, res, next) {
    try {
      const signatures = await db.all(
        'SELECT * FROM signatures WHERE userId = ? ORDER BY createdAt DESC',
        [req.user.id]
      );
      
      res.json({
        success: true,
        data: signatures
      });
    } catch (error) {
      next(error);
    }
  }

  // Create a new signature
  async createSignature(req, res, next) {
    try {
      const { name, signatureData, type = 'signature', isDefault = false } = req.body;

      // If this is set as default, unset other defaults
      if (isDefault) {
        await db.run(
          'UPDATE signatures SET isDefault = false WHERE userId = ? AND type = ?',
          [req.user.id, type]
        );
      }

      const result = await db.run(
        `INSERT INTO signatures (userId, name, signatureData, type, isDefault)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, name, signatureData, type, isDefault]
      );

      const signature = await db.get(
        'SELECT * FROM signatures WHERE id = ?',
        [result.id]
      );

      res.status(201).json({
        success: true,
        data: signature,
        message: 'Signature created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Update signature
  async updateSignature(req, res, next) {
    try {
      const signatureId = req.params.id;
      
      // Check if signature belongs to user
      const signature = await db.get(
        'SELECT * FROM signatures WHERE id = ? AND userId = ?',
        [signatureId, req.user.id]
      );

      if (!signature) {
        return res.status(404).json({
          success: false,
          error: 'Signature not found'
        });
      }

      const { name, signatureData, isDefault } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }

      if (signatureData !== undefined) {
        updates.push('signatureData = ?');
        values.push(signatureData);
      }

      if (isDefault !== undefined) {
        updates.push('isDefault = ?');
        values.push(isDefault);
        
        // If setting as default, unset others
        if (isDefault) {
          await db.run(
            'UPDATE signatures SET isDefault = false WHERE userId = ? AND type = ? AND id != ?',
            [req.user.id, signature.type, signatureId]
          );
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      values.push(signatureId);
      
      await db.run(
        `UPDATE signatures SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updatedSignature = await db.get(
        'SELECT * FROM signatures WHERE id = ?',
        [signatureId]
      );

      res.json({
        success: true,
        data: updatedSignature,
        message: 'Signature updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete signature
  async deleteSignature(req, res, next) {
    try {
      const signatureId = req.params.id;
      
      // Check if signature belongs to user
      const signature = await db.get(
        'SELECT * FROM signatures WHERE id = ? AND userId = ?',
        [signatureId, req.user.id]
      );

      if (!signature) {
        return res.status(404).json({
          success: false,
          error: 'Signature not found'
        });
      }

      await db.run('DELETE FROM signatures WHERE id = ?', [signatureId]);

      res.json({
        success: true,
        message: 'Signature deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get signature by ID
  async getSignature(req, res, next) {
    try {
      const signatureId = req.params.id;
      
      const signature = await db.get(
        'SELECT * FROM signatures WHERE id = ? AND userId = ?',
        [signatureId, req.user.id]
      );

      if (!signature) {
        return res.status(404).json({
          success: false,
          error: 'Signature not found'
        });
      }

      res.json({
        success: true,
        data: signature
      });
    } catch (error) {
      next(error);
    }
  }

  // Set signature as default
  async setDefault(req, res, next) {
    try {
      const signatureId = req.params.id;
      
      // Check if signature belongs to user
      const signature = await db.get(
        'SELECT * FROM signatures WHERE id = ? AND userId = ?',
        [signatureId, req.user.id]
      );

      if (!signature) {
        return res.status(404).json({
          success: false,
          error: 'Signature not found'
        });
      }

      // Unset all other defaults for this type
      await db.run(
        'UPDATE signatures SET isDefault = false WHERE userId = ? AND type = ?',
        [req.user.id, signature.type]
      );

      // Set this one as default
      await db.run(
        'UPDATE signatures SET isDefault = true WHERE id = ?',
        [signatureId]
      );

      const updatedSignature = await db.get(
        'SELECT * FROM signatures WHERE id = ?',
        [signatureId]
      );

      res.json({
        success: true,
        data: updatedSignature,
        message: 'Default signature updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get default signature for type
  async getDefault(req, res, next) {
    try {
      const { type = 'signature' } = req.query;
      
      const signature = await db.get(
        'SELECT * FROM signatures WHERE userId = ? AND type = ? AND isDefault = true',
        [req.user.id, type]
      );

      if (!signature) {
        return res.status(404).json({
          success: false,
          error: 'No default signature found'
        });
      }

      res.json({
        success: true,
        data: signature
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SignatureController();
