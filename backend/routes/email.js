const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const auth = require('../middleware/auth');

// Get email service status and test account info (development only)
router.get('/status', auth, async (req, res) => {
  try {
    const serviceInfo = emailService.getServiceInfo();
    res.json(serviceInfo);
  } catch (error) {
    console.error('Error getting email service status:', error);
    res.status(500).json({ error: 'Failed to get email service status' });
  }
});

// Initialize email service (for manual initialization)
router.post('/initialize', auth, async (req, res) => {
  try {
    await emailService.initialize();
    const serviceInfo = emailService.getServiceInfo();
    res.json({ 
      message: 'Email service initialized successfully',
      ...serviceInfo 
    });
  } catch (error) {
    console.error('Error initializing email service:', error);
    res.status(500).json({ error: 'Failed to initialize email service' });
  }
});

// Send test email (development only)
router.post('/test', auth, async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Test emails only available in development' });
    }

    const { to, subject = 'OnDottedLine Test Email', message = 'This is a test email from OnDottedLine.' } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email address is required' });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OnDottedLine</h1>
            <p>Test Email</p>
          </div>
          <div class="content">
            <h2>Test Email Successful! 📧</h2>
            <p>${message}</p>
            <p><strong>Sent from:</strong> ${req.user.email}</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Environment:</strong> Development</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await emailService.sendEmail({
      to,
      subject,
      html
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      ...result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Send envelope invitation email
router.post('/envelope/invitation', auth, async (req, res) => {
  try {
    const { 
      recipientEmail, 
      recipientName, 
      envelopeId, 
      signingUrl 
    } = req.body;

    if (!recipientEmail || !recipientName || !envelopeId || !signingUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: recipientEmail, recipientName, envelopeId, signingUrl' 
      });
    }

    // Get envelope details
    const Envelope = require('../models/Envelope');
    const envelope = await Envelope.findById(envelopeId);
    
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Check if user owns the envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const senderName = `${req.user.first_name} ${req.user.last_name}`;

    const result = await emailService.sendEnvelopeInvitation({
      recipientEmail,
      recipientName,
      envelope: envelope.toJSON(),
      senderName,
      signingUrl
    });

    // Log the invitation
    await envelope.logAction('invitation_sent', req.user.id, {
      recipientEmail,
      recipientName
    });

    res.json({
      success: true,
      message: 'Invitation email sent successfully',
      ...result
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    res.status(500).json({ error: 'Failed to send invitation email' });
  }
});

// Send envelope reminder email
router.post('/envelope/reminder', auth, async (req, res) => {
  try {
    const { 
      recipientEmail, 
      recipientName, 
      envelopeId, 
      signingUrl,
      daysOverdue = 0
    } = req.body;

    if (!recipientEmail || !recipientName || !envelopeId || !signingUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: recipientEmail, recipientName, envelopeId, signingUrl' 
      });
    }

    // Get envelope details
    const Envelope = require('../models/Envelope');
    const envelope = await Envelope.findById(envelopeId);
    
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Check if user owns the envelope
    if (envelope.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const senderName = `${req.user.first_name} ${req.user.last_name}`;

    const result = await emailService.sendEnvelopeReminder({
      recipientEmail,
      recipientName,
      envelope: envelope.toJSON(),
      senderName,
      signingUrl,
      daysOverdue
    });

    // Log the reminder
    await envelope.logAction('reminder_sent', req.user.id, {
      recipientEmail,
      recipientName,
      daysOverdue
    });

    res.json({
      success: true,
      message: 'Reminder email sent successfully',
      ...result
    });
  } catch (error) {
    console.error('Error sending reminder email:', error);
    res.status(500).json({ error: 'Failed to send reminder email' });
  }
});

// Send security alert email
router.post('/security/alert', auth, async (req, res) => {
  try {
    const { alertType, details } = req.body;

    if (!alertType || !details) {
      return res.status(400).json({ 
        error: 'Missing required fields: alertType, details' 
      });
    }

    const result = await emailService.sendSecurityAlert({
      userEmail: req.user.email,
      alertType,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Security alert email sent successfully',
      ...result
    });
  } catch (error) {
    console.error('Error sending security alert email:', error);
    res.status(500).json({ error: 'Failed to send security alert email' });
  }
});

module.exports = router;
