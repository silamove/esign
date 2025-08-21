const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authMiddleware } = require('../middleware/auth');
const Envelope = require('../models/Envelope');
const Document = require('../models/Document');
const router = express.Router();

// Get all envelopes for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let envelopes;
    
    if (status) {
      envelopes = await Envelope.findByStatus(status, req.user.id, parseInt(limit), parseInt(offset));
    } else {
      envelopes = await Envelope.findByUserId(req.user.id, parseInt(limit), parseInt(offset));
    }

    // Get additional data for each envelope
    const envelopesWithDetails = await Promise.all(
      envelopes.map(async (envelope) => {
        const documents = await envelope.getDocuments();
        const recipients = await envelope.getRecipients();
        const progress = await envelope.getProgress();
        
        return {
          ...envelope.toJSON(),
          documents,
          recipients,
          progress
        };
      })
    );

    res.json({
      success: true,
      data: envelopesWithDetails,
      total: envelopesWithDetails.length
    });
  } catch (error) {
    console.error('Error fetching envelopes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch envelopes',
      error: error.message
    });
  }
});

// Get a specific envelope by UUID
router.get('/:uuid', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user has access to this envelope
    if (envelope.userId !== req.user.id) {
      // Check if user is a recipient
      const recipients = await envelope.getRecipients();
      const isRecipient = recipients.some(r => r.email === req.user.email);
      
      if (!isRecipient) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const documents = await envelope.getDocuments();
    const recipients = await envelope.getRecipients();
    const signatureFields = await envelope.getSignatureFields();
    const progress = await envelope.getProgress();

    res.json({
      success: true,
      data: {
        ...envelope.toJSON(),
        documents,
        recipients,
        signatureFields,
        progress
      }
    });
  } catch (error) {
    console.error('Error fetching envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch envelope',
      error: error.message
    });
  }
});

// Create a new envelope
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title,
      subject = '',
      message = '',
      priority = 'medium',
      expirationDate,
      reminderFrequency = 'daily',
      documents = [],
      recipients = [],
      signatureFields = []
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Create the envelope
    const envelope = await Envelope.create({
      userId: req.user.id,
      title,
      subject,
      message,
      priority,
      expirationDate,
      reminderFrequency
    });

    // Add documents to the envelope
    for (let i = 0; i < documents.length; i++) {
      const docId = documents[i];
      await envelope.addDocument(docId, i + 1);
    }

    // Add recipients
    for (const recipient of recipients) {
      await envelope.addRecipient(recipient);
    }

    // Add signature fields
    for (const field of signatureFields) {
      await envelope.addSignatureField(field);
    }

    // Log the creation
    await envelope.logAction('envelope_created', req.user.id, {
      documentCount: documents.length,
      recipientCount: recipients.length,
      fieldCount: signatureFields.length
    }, req.ip, req.get('User-Agent'));

    const envelopeWithDetails = {
      ...envelope.toJSON(),
      documents: await envelope.getDocuments(),
      recipients: await envelope.getRecipients(),
      signatureFields: await envelope.getSignatureFields()
    };

    res.status(201).json({
      success: true,
      data: envelopeWithDetails,
      message: 'Envelope created successfully'
    });
  } catch (error) {
    console.error('Error creating envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create envelope',
      error: error.message
    });
  }
});

// Update an envelope
router.put('/:uuid', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if envelope can be modified
    if (envelope.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft envelopes can be modified'
      });
    }

    const updatedEnvelope = await envelope.update(req.body);
    
    await envelope.logAction('envelope_updated', req.user.id, {
      changes: Object.keys(req.body)
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      data: updatedEnvelope.toJSON(),
      message: 'Envelope updated successfully'
    });
  } catch (error) {
    console.error('Error updating envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update envelope',
      error: error.message
    });
  }
});

// Send an envelope
router.post('/:uuid/send', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await envelope.send();

    res.json({
      success: true,
      data: envelope.toJSON(),
      message: 'Envelope sent successfully'
    });
  } catch (error) {
    console.error('Error sending envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send envelope',
      error: error.message
    });
  }
});

// Void an envelope
router.post('/:uuid/void', authMiddleware, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await envelope.void(reason);

    res.json({
      success: true,
      data: envelope.toJSON(),
      message: 'Envelope voided successfully'
    });
  } catch (error) {
    console.error('Error voiding envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void envelope',
      error: error.message
    });
  }
});

// Add a document to an envelope
router.post('/:uuid/documents', authMiddleware, async (req, res) => {
  try {
    const { documentId, order = 1 } = req.body;
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if envelope can be modified
    if (envelope.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft envelopes can be modified'
      });
    }

    // Verify document exists and user owns it
    const document = await Document.findById(documentId);
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    await envelope.addDocument(documentId, order);

    await envelope.logAction('document_added', req.user.id, {
      documentId,
      documentName: document.originalName
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Document added to envelope successfully'
    });
  } catch (error) {
    console.error('Error adding document to envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add document to envelope',
      error: error.message
    });
  }
});

// Add a recipient to an envelope
router.post('/:uuid/recipients', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if envelope can be modified
    if (envelope.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft envelopes can be modified'
      });
    }

    await envelope.addRecipient(req.body);

    await envelope.logAction('recipient_added', req.user.id, {
      recipientEmail: req.body.email,
      recipientName: req.body.name,
      role: req.body.role
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Recipient added to envelope successfully'
    });
  } catch (error) {
    console.error('Error adding recipient to envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add recipient to envelope',
      error: error.message
    });
  }
});

// Add signature fields to an envelope
router.post('/:uuid/signature-fields', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if envelope can be modified
    if (envelope.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft envelopes can be modified'
      });
    }

    await envelope.addSignatureField(req.body);

    await envelope.logAction('signature_field_added', req.user.id, {
      fieldType: req.body.fieldType,
      recipientEmail: req.body.recipientEmail,
      page: req.body.page
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Signature field added to envelope successfully'
    });
  } catch (error) {
    console.error('Error adding signature field to envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add signature field to envelope',
      error: error.message
    });
  }
});

// Get envelope audit logs
router.get('/:uuid/audit', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user has access to this envelope
    if (envelope.userId !== req.user.id) {
      const recipients = await envelope.getRecipients();
      const isRecipient = recipients.some(r => r.email === req.user.email);
      
      if (!isRecipient) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const auditLogs = await envelope.getAuditLogs();

    res.json({
      success: true,
      data: auditLogs
    });
  } catch (error) {
    console.error('Error fetching envelope audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
});

// Delete an envelope
router.delete('/:uuid', authMiddleware, async (req, res) => {
  try {
    const envelope = await Envelope.findByUuid(req.params.uuid);
    
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Envelope not found'
      });
    }

    // Check if user owns this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft or voided envelopes
    if (!['draft', 'voided'].includes(envelope.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or voided envelopes can be deleted'
      });
    }

    await envelope.logAction('envelope_deleted', req.user.id, {
      envelopeTitle: envelope.title
    }, req.ip, req.get('User-Agent'));

    await envelope.delete();

    res.json({
      success: true,
      message: 'Envelope deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting envelope:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete envelope',
      error: error.message
    });
  }
});

// Certificate endpoints
router.get('/:id/certificate', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Check if user has access to this envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (envelope.status !== 'completed') {
      return res.status(400).json({ error: 'Envelope must be completed to access certificate' });
    }

    let certificate = await envelope.getCertificate();
    if (!certificate) {
      certificate = await envelope.generateCertificate();
    }

    res.json(certificate);
  } catch (error) {
    console.error('Error getting certificate:', error);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

router.post('/:id/certificate/pdf', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const certificate = await envelope.getCertificate();
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const pdfPath = await certificate.generatePDF();
    res.download(pdfPath, `certificate_${envelope.uuid}.pdf`);
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    res.status(500).json({ error: 'Failed to generate certificate PDF' });
  }
});

// Template endpoints
router.post('/:id/create-template', async (req, res) => {
  try {
    const { name, description, isPublic = false } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const EnvelopeTemplate = require('../models/EnvelopeTemplate');
    const template = await EnvelopeTemplate.createFromEnvelope(
      envelope.id, 
      name, 
      description, 
      isPublic
    );

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.post('/from-template/:templateId', async (req, res) => {
  try {
    const { title, subject, message, recipients, documentIds } = req.body;
    
    const envelope = await Envelope.createFromTemplate(req.params.templateId, {
      userId: req.user.id,
      title,
      subject,
      message,
      recipients,
      documentIds
    });

    res.status(201).json(envelope);
  } catch (error) {
    console.error('Error creating envelope from template:', error);
    res.status(500).json({ error: 'Failed to create envelope from template' });
  }
});

// Collaboration endpoints
router.post('/:id/collaborators', async (req, res) => {
  try {
    const { userId, permissionLevel = 'view' } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await envelope.addCollaborator(userId, permissionLevel, req.user.id);
    const collaborators = await envelope.getCollaborators();

    res.json(collaborators);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

router.get('/:id/collaborators', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const collaborators = await envelope.getCollaborators();
    res.json(collaborators);
  } catch (error) {
    console.error('Error getting collaborators:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

// Comments endpoints
router.post('/:id/comments', async (req, res) => {
  try {
    const { commentText, documentId, pageNumber, x, y, isInternal = false, parentCommentId } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Check access permissions
    if (envelope.userId !== req.user.id) {
      const collaborators = await envelope.getCollaborators();
      const hasAccess = collaborators.some(c => c.user_id === req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await envelope.addComment(
      req.user.id, 
      commentText, 
      documentId, 
      pageNumber, 
      x, 
      y, 
      isInternal, 
      parentCommentId
    );
    
    const comments = await envelope.getComments();
    res.json(comments);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    const { includeInternal = 'true' } = req.query;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    const comments = await envelope.getComments(includeInternal === 'true');
    res.json(comments);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Analytics endpoints
router.post('/:id/analytics/track', async (req, res) => {
  try {
    const { eventType, userIdentifier, metadata = {} } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    await envelope.trackAnalyticsEvent(
      eventType, 
      userIdentifier, 
      req.ip, 
      req.get('User-Agent'), 
      metadata
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error tracking analytics event:', error);
    res.status(500).json({ error: 'Failed to track analytics event' });
  }
});

router.get('/:id/analytics', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const events = await envelope.getAnalyticsEvents();
    res.json(events);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Enhanced progress endpoint
router.get('/:id/progress/detailed', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const progress = await envelope.getDetailedProgress();
    res.json(progress);
  } catch (error) {
    console.error('Error getting detailed progress:', error);
    res.status(500).json({ error: 'Failed to get detailed progress' });
  }
});

// Versioning endpoints
router.post('/:id/versions', async (req, res) => {
  try {
    const { changesSummary = '' } = req.body;
    
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await envelope.createVersion(req.user.id, changesSummary);
    const versions = await envelope.getVersions();
    
    res.json(versions);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const envelope = await Envelope.findById(req.params.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = await envelope.getVersions();
    res.json(versions);
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

// Bulk operations
router.post('/bulk/update', async (req, res) => {
  try {
    const { envelopeIds, updates } = req.body;
    
    if (!Array.isArray(envelopeIds) || envelopeIds.length === 0) {
      return res.status(400).json({ error: 'envelopeIds must be a non-empty array' });
    }

    const result = await Envelope.bulkUpdate(envelopeIds, updates, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

module.exports = router;
