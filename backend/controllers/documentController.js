const Document = require('../models/Document');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument, rgb } = require('pdf-lib');

class DocumentController {
  // Get all user's documents
  async getAllDocuments(req, res, next) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      let documents;
      if (status) {
        // Filter by status if provided
        documents = await Document.findByUserIdAndStatus(
          req.user.id, 
          status, 
          parseInt(limit), 
          offset
        );
      } else {
        documents = await Document.findByUserId(
          req.user.id, 
          parseInt(limit), 
          offset
        );
      }
      
      res.json({
        success: true,
        data: documents.map(doc => doc.toJSON()),
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

  // Upload PDF document
  async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No PDF file uploaded'
        });
      }

      // Get PDF info using pdf-lib
      const pdfBytes = await fs.readFile(req.file.path);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const totalPages = pdfDoc.getPageCount();

      // Create document record
      const document = await Document.create({
        userId: req.user.id,
        originalName: req.file.originalname,
        filename: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        totalPages,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      });

      // Log the upload action
      await document.logAction('upload', req.user.id, {
        originalName: req.file.originalname,
        fileSize: req.file.size,
        totalPages
      }, req.ip, req.get('User-Agent'));

      res.status(201).json({
        success: true,
        data: document.toJSON(),
        message: 'Document uploaded successfully'
      });
    } catch (error) {
      // Clean up uploaded file if document creation fails
      if (req.file) {
        fs.unlink(req.file.path).catch(console.error);
      }
      next(error);
    }
  }

  // Get document by UUID
  async getDocument(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Check if user owns the document or has access
      if (document.userId !== req.user.id) {
        // TODO: Check if document is shared with this user
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get document fields
      const fields = await document.getFields();

      res.json({
        success: true,
        data: {
          ...document.toJSON(),
          fields
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update document
  async updateDocument(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updatedDocument = await document.update(req.body);

      // Log the action
      await document.logAction('update', req.user.id, {
        updates: Object.keys(req.body)
      }, req.ip, req.get('User-Agent'));

      res.json({
        success: true,
        data: updatedDocument.toJSON(),
        message: 'Document updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete document
  async deleteDocument(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Delete file from disk
      const filePath = path.join(__dirname, '../../uploads', document.filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn('File not found on disk:', document.filename);
      }

      // Log the action before deletion
      await document.logAction('delete', req.user.id, {
        filename: document.filename
      }, req.ip, req.get('User-Agent'));

      await document.delete();

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Serve PDF file
  async serveFile(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const filePath = path.join(__dirname, '../../uploads', document.filename);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'File not found on disk'
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  // Add field to document
  async addField(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const { fieldType, data, x, y, width, height, page } = req.body;

      const result = await document.addField({
        fieldType,
        data,
        x,
        y,
        width,
        height,
        page
      });

      // Log the action
      await document.logAction('add_field', req.user.id, {
        fieldType,
        page,
        fieldId: result.id
      }, req.ip, req.get('User-Agent'));

      res.status(201).json({
        success: true,
        data: { id: result.id },
        message: 'Field added successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove field from document
  async removeField(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      await document.removeField(req.params.fieldId);

      // Log the action
      await document.logAction('remove_field', req.user.id, {
        fieldId: req.params.fieldId
      }, req.ip, req.get('User-Agent'));

      res.json({
        success: true,
        message: 'Field removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Download signed PDF
  async downloadSignedPdf(req, res, next) {
    try {
      const document = await Document.findByUuid(req.params.uuid);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const filePath = path.join(__dirname, '../../uploads', document.filename);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'File not found on disk'
        });
      }

      // Get all fields for the document
      const fields = await document.getFields();

      // Load the PDF
      const existingPdfBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Process each field
      for (const field of fields) {
        if (field.page >= pages.length) {
          console.warn(`Skipping field on invalid page ${field.page + 1}`);
          continue;
        }

        const page = pages[field.page];

        switch (field.fieldType) {
          case 'signature':
          case 'initials':
            if (field.fieldData.signature) {
              await this.addSignatureToPage(pdfDoc, page, field.fieldData.signature, field.x, field.y, field.width, field.height);
            }
            break;
            
          case 'text':
          case 'date':
            if (field.fieldData.text) {
              await this.addTextToPage(pdfDoc, page, field.fieldData.text, field.x, field.y, field.fieldData.fontSize || 12, field.fieldData.color || '#000000');
            }
            break;
            
          case 'checkbox':
            await this.addCheckboxToPage(pdfDoc, page, field.x, field.y, field.width, field.height, field.fieldData.checked);
            break;
        }
      }

      // Generate the signed PDF
      const pdfBytes = await pdfDoc.save();

      // Update document status
      await document.update({ status: 'completed' });

      // Log the action
      await document.logAction('download', req.user.id, {
        fieldsCount: fields.length
      }, req.ip, req.get('User-Agent'));

      // Set headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="signed-${document.originalName}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  // Helper method to add signature to page
  async addSignatureToPage(pdfDoc, page, signatureDataUrl, x, y, width, height) {
    try {
      const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
      const signatureImage = await pdfDoc.embedPng(base64Data);
      
      page.drawImage(signatureImage, {
        x: x,
        y: y,
        width: width,
        height: height
      });
    } catch (error) {
      console.error('Error adding signature:', error);
      throw new Error('Failed to add signature to PDF');
    }
  }

  // Helper method to add text to page
  async addTextToPage(pdfDoc, page, text, x, y, fontSize, color) {
    try {
      const hexColor = color.replace('#', '');
      const r = parseInt(hexColor.substr(0, 2), 16) / 255;
      const g = parseInt(hexColor.substr(2, 2), 16) / 255;
      const b = parseInt(hexColor.substr(4, 2), 16) / 255;
      
      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        color: rgb(r, g, b)
      });
    } catch (error) {
      console.error('Error adding text:', error);
      throw new Error('Failed to add text to PDF');
    }
  }

  // Helper method to add checkbox to page
  async addCheckboxToPage(pdfDoc, page, x, y, width, height, checked) {
    try {
      page.drawRectangle({
        x: x,
        y: y,
        width: width,
        height: height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1
      });
      
      if (checked) {
        const checkSize = Math.min(width, height) * 0.6;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        page.drawLine({
          start: { x: centerX - checkSize/3, y: centerY },
          end: { x: centerX - checkSize/6, y: centerY - checkSize/3 },
          thickness: 2,
          color: rgb(0, 0, 0)
        });
        
        page.drawLine({
          start: { x: centerX - checkSize/6, y: centerY - checkSize/3 },
          end: { x: centerX + checkSize/2, y: centerY + checkSize/2 },
          thickness: 2,
          color: rgb(0, 0, 0)
        });
      }
    } catch (error) {
      console.error('Error adding checkbox:', error);
      throw new Error('Failed to add checkbox to PDF');
    }
  }
}

module.exports = new DocumentController();
