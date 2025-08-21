const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.testAccount = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (process.env.NODE_ENV === 'development') {
        // Check if MailHog is configured (preferred for local development)
        if (process.env.USE_MAILHOG === 'true') {
          this.transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT) || 1025,
            secure: false,
            ignoreTLS: true,
            auth: false
          });

          console.log('📧 Development Email Service: MailHog SMTP configured');
          console.log(`   - SMTP: ${process.env.SMTP_HOST || 'localhost'}:${process.env.SMTP_PORT || 1025}`);
          console.log(`   - Web UI: http://localhost:${process.env.MAILHOG_WEB_PORT || 8025}`);
          console.log('   - Start MailHog: docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog');
        } else {
          // Fallback to Ethereal Email
          this.testAccount = await nodemailer.createTestAccount();
          
          this.transporter = nodemailer.createTransporter({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: this.testAccount.user,
              pass: this.testAccount.pass,
            },
          });

          console.log('📧 Development Email Service: Ethereal Email initialized');
          console.log(`📨 Ethereal Email UI: https://ethereal.email/login`);
          console.log(`👤 Test Email User: ${this.testAccount.user}`);
          console.log(`🔑 Test Email Pass: ${this.testAccount.pass}`);
        }
      } else {
        // Production email configuration
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      }

      // Verify transporter
      await this.transporter.verify();
      this.initialized = true;
      console.log('✅ Email service ready');
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      throw error;
    }
  }

  async sendEmail({ to, subject, html, text, attachments = [] }) {
    if (!this.initialized) {
      await this.initialize();
    }

    const mailOptions = {
      from: process.env.NODE_ENV === 'development' 
        ? this.testAccount.user 
        : process.env.SMTP_FROM || 'noreply@ondottedline.com',
      to,
      subject,
      html,
      text: text || this.stripHtml(html),
      attachments
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Development email sent successfully');
        console.log(`📨 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        return {
          success: true,
          messageId: info.messageId,
          previewUrl: nodemailer.getTestMessageUrl(info)
        };
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  // Envelope-related email templates
  async sendEnvelopeInvitation({ recipientEmail, recipientName, envelope, senderName, signingUrl }) {
    const subject = `${senderName} has sent you a document to sign: ${envelope.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Signing Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OnDottedLine</h1>
            <p>Document Signing Request</p>
          </div>
          <div class="content">
            <h2>Hello ${recipientName},</h2>
            <p>${senderName} has sent you a document that requires your signature.</p>
            
            <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4f46e5;">
              <h3>${envelope.title}</h3>
              ${envelope.subject ? `<p><strong>Subject:</strong> ${envelope.subject}</p>` : ''}
              ${envelope.message ? `<p><strong>Message:</strong> ${envelope.message}</p>` : ''}
            </div>
            
            <p>To review and sign the document, please click the button below:</p>
            <a href="${signingUrl}" class="button">Review & Sign Document</a>
            
            <p><small>This link will expire in 30 days. If you have any questions, please contact ${senderName}.</small></p>
          </div>
          <div class="footer">
            <p>This email was sent by OnDottedLine on behalf of ${senderName}</p>
            <p>Secure • Legal • Compliant</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  async sendEnvelopeReminder({ recipientEmail, recipientName, envelope, senderName, signingUrl, daysOverdue = 0 }) {
    const subject = daysOverdue > 0 
      ? `Reminder: Overdue signature request - ${envelope.title}`
      : `Reminder: Please sign - ${envelope.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Signature Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .button { background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          .urgent { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 15px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OnDottedLine</h1>
            <p>Signature Reminder</p>
          </div>
          <div class="content">
            <h2>Hello ${recipientName},</h2>
            
            ${daysOverdue > 0 ? `
              <div class="urgent">
                <strong>⚠️ This signature request is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue</strong>
              </div>
            ` : ''}
            
            <p>This is a friendly reminder that you have a document waiting for your signature from ${senderName}.</p>
            
            <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3>${envelope.title}</h3>
              ${envelope.subject ? `<p><strong>Subject:</strong> ${envelope.subject}</p>` : ''}
            </div>
            
            <p>Please take a moment to review and sign the document:</p>
            <a href="${signingUrl}" class="button">Sign Document Now</a>
            
            <p><small>If you have any questions or concerns, please contact ${senderName} directly.</small></p>
          </div>
          <div class="footer">
            <p>This reminder was sent by OnDottedLine on behalf of ${senderName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  async sendEnvelopeCompleted({ recipientEmails, envelope, senderName, completedBy }) {
    const subject = `Document completed: ${envelope.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Completed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          .success { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; margin: 15px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OnDottedLine</h1>
            <p>✅ Document Completed</p>
          </div>
          <div class="content">
            <div class="success">
              <strong>🎉 Great news! The document has been completed.</strong>
            </div>
            
            <div style="background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3>${envelope.title}</h3>
              <p><strong>Completed by:</strong> ${completedBy}</p>
              <p><strong>Completed on:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>All required signatures have been collected. A certificate of completion will be generated and made available to all parties.</p>
          </div>
          <div class="footer">
            <p>This notification was sent by OnDottedLine</p>
            <p>Secure • Legal • Compliant</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to all recipients
    const promises = recipientEmails.map(email => 
      this.sendEmail({
        to: email,
        subject,
        html
      })
    );

    return Promise.all(promises);
  }

  async sendSecurityAlert({ userEmail, alertType, details, ipAddress, userAgent }) {
    const subject = `Security Alert: ${alertType}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 15px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 OnDottedLine Security</h1>
            <p>Security Alert</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ Security Alert: ${alertType}</strong>
            </div>
            
            <p><strong>Details:</strong> ${details}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${ipAddress}</p>
            <p><strong>Device:</strong> ${userAgent}</p>
            
            <p>If this activity was not performed by you, please contact our support team immediately and change your password.</p>
          </div>
          <div class="footer">
            <p>OnDottedLine Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Get email service status and test account info for development
  getServiceInfo() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    if (process.env.NODE_ENV === 'development' && this.testAccount) {
      return {
        status: 'ready',
        mode: 'development',
        testAccount: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
          webInterface: 'https://ethereal.email/login'
        }
      };
    }

    return {
      status: 'ready',
      mode: 'production'
    };
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
