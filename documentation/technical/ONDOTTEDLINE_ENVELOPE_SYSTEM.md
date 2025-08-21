# OnDottedLine Envelope System Technical Documentation

## Overview

The OnDottedLine Envelope System is the core of our electronic signature platform, implementing industry-standard document workflow management that rivals and exceeds DocuSign's capabilities.

## What is an OnDottedLine Envelope?

An OnDottedLine Envelope is a digital container that holds:
- **Documents**: One or more PDF documents to be signed
- **Recipients**: Signers, viewers, approvers, and form fillers
- **Signature Fields**: Placement of signature, initial, text, date, and other form fields
- **Workflow**: Sequential or parallel signing order
- **Metadata**: Titles, messages, priority, expiration dates
- **Audit Trail**: Complete history of all actions and events

## Key Features

### 📄 Document Management
- Multiple documents per envelope
- Document ordering and organization
- PDF processing and manipulation
- Secure document storage and retrieval

### 👥 Recipient Management
- Multiple recipient types (signer, viewer, approver, form_filler)
- Routing order control (sequential/parallel signing)
- Custom authentication methods
- Personalized messages per recipient

### ✍️ Signature Field Types
- **Signature**: Hand-drawn or typed signatures
- **Initial**: Initials placement
- **Text**: Text input fields
- **Date**: Date picker fields
- **Checkbox**: Boolean selections
- **Dropdown**: Single selection from options
- **Radio**: Multiple choice selections

### 🔄 Workflow States
- **Draft**: Envelope being prepared
- **Sent**: Envelope sent to recipients
- **In Progress**: Recipients are signing
- **Completed**: All signatures obtained
- **Voided**: Envelope cancelled
- **Expired**: Envelope past expiration date

## Database Schema

### Core Tables

#### Envelopes
```sql
CREATE TABLE envelopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    priority TEXT DEFAULT 'medium',
    expiration_date DATETIME,
    reminder_frequency TEXT DEFAULT 'daily',
    is_sequential BOOLEAN DEFAULT 0,
    auto_reminder_enabled BOOLEAN DEFAULT 1,
    language_code TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    compliance_level TEXT DEFAULT 'standard',
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    completed_at DATETIME
);
```

#### Envelope Documents
```sql
CREATE TABLE envelope_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    document_order INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (envelope_id) REFERENCES envelopes (id),
    FOREIGN KEY (document_id) REFERENCES documents (id)
);
```

#### Envelope Recipients
```sql
CREATE TABLE envelope_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'signer',
    routing_order INTEGER DEFAULT 1,
    permissions TEXT DEFAULT '{}',
    authentication_method TEXT DEFAULT 'email',
    custom_message TEXT DEFAULT '',
    send_reminders BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'pending',
    signed_at DATETIME,
    viewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Envelope Signatures
```sql
CREATE TABLE envelope_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    field_type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    page INTEGER NOT NULL DEFAULT 1,
    required BOOLEAN DEFAULT 1,
    field_name TEXT DEFAULT '',
    default_value TEXT DEFAULT '',
    validation_rules TEXT DEFAULT '{}',
    value TEXT DEFAULT '',
    signed_at DATETIME,
    signature_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Advanced Features

### 📜 Certificate of Completion
- Automatically generated when envelope is completed
- Contains full audit trail and verification data
- PDF export with digital watermark
- Blockchain hash verification (optional)

### 📝 Template System
- Create reusable envelope templates
- Template marketplace (public/private)
- Template cloning and customization
- Usage analytics and statistics

### 🤝 Collaboration
- Multiple users can collaborate on envelope preparation
- Permission levels (view, edit, admin)
- Internal comments and annotations
- Version control and change tracking

### 📊 Analytics & Tracking
- View events, download tracking
- Engagement metrics (time spent, views)
- Geolocation tracking (optional)
- Custom event tracking

### 🔄 Workflow Automation
- Trigger-based actions
- Email notifications and reminders
- Status change automations
- Integration webhooks

### 🔗 Third-Party Integrations
- Salesforce, HubSpot, Google Drive
- Custom API integrations
- Webhook notifications
- Bulk operations support

## API Endpoints

### Envelope CRUD Operations
```javascript
GET    /api/envelopes          // List envelopes
POST   /api/envelopes          // Create envelope
GET    /api/envelopes/:id      // Get envelope details
PUT    /api/envelopes/:id      // Update envelope
DELETE /api/envelopes/:id      // Delete envelope
```

### Envelope Actions
```javascript
POST   /api/envelopes/:id/send           // Send envelope
POST   /api/envelopes/:id/void           // Void envelope
GET    /api/envelopes/:id/progress       // Get progress
GET    /api/envelopes/:id/audit          // Get audit trail
```

### Document Management
```javascript
POST   /api/envelopes/:id/documents      // Add document
DELETE /api/envelopes/:id/documents/:docId // Remove document
GET    /api/envelopes/:id/documents      // List documents
```

### Recipient Management
```javascript
POST   /api/envelopes/:id/recipients     // Add recipient
PUT    /api/envelopes/:id/recipients/:recipientId // Update recipient
DELETE /api/envelopes/:id/recipients/:recipientId // Remove recipient
GET    /api/envelopes/:id/recipients     // List recipients
```

### Signature Fields
```javascript
POST   /api/envelopes/:id/fields         // Add signature field
PUT    /api/envelopes/:id/fields/:fieldId // Update field
DELETE /api/envelopes/:id/fields/:fieldId // Remove field
GET    /api/envelopes/:id/fields         // List fields
```

### Advanced Features
```javascript
GET    /api/envelopes/:id/certificate    // Get certificate
POST   /api/envelopes/:id/certificate/pdf // Download certificate PDF
POST   /api/envelopes/:id/comments       // Add comment
GET    /api/envelopes/:id/comments       // Get comments
POST   /api/envelopes/:id/analytics/track // Track event
GET    /api/envelopes/:id/analytics      // Get analytics
```

## Usage Examples

### Creating an Envelope
```javascript
// 1. Create envelope
const envelope = await fetch('/api/envelopes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Employment Contract - John Doe',
    subject: 'Please sign your employment contract',
    message: 'Dear John, please review and sign your employment contract.',
    priority: 'high',
    expirationDate: '2025-12-31T23:59:59Z'
  })
});

// 2. Add documents
await fetch(`/api/envelopes/${envelope.id}/documents`, {
  method: 'POST',
  body: JSON.stringify({ documentId: 123, order: 1 })
});

// 3. Add recipients
await fetch(`/api/envelopes/${envelope.id}/recipients`, {
  method: 'POST',
  body: JSON.stringify({
    email: 'john.doe@company.com',
    name: 'John Doe',
    role: 'signer',
    routingOrder: 1
  })
});

// 4. Add signature fields
await fetch(`/api/envelopes/${envelope.id}/fields`, {
  method: 'POST',
  body: JSON.stringify({
    documentId: 123,
    recipientEmail: 'john.doe@company.com',
    fieldType: 'signature',
    x: 100, y: 200, width: 200, height: 50,
    page: 1, required: true
  })
});

// 5. Send envelope
await fetch(`/api/envelopes/${envelope.id}/send`, {
  method: 'POST'
});
```

### Tracking Progress
```javascript
const progress = await fetch(`/api/envelopes/${envelope.id}/progress/detailed`);
console.log(progress.overall.percentage); // e.g., 75%
console.log(progress.recipients); // Individual recipient progress
console.log(progress.engagement); // View analytics
```

## Security Features

### Document Integrity
- SHA-256 hash verification
- Tamper-evident audit trail
- Version control and change detection

### Authentication
- Email verification
- SMS verification (planned)
- Access code protection
- Multi-factor authentication (planned)

### Compliance
- ESIGN Act compliance
- UETA compliance
- GDPR compliance features
- HIPAA compliance features (planned)

## Performance Optimizations

### Database Indexes
- Envelope UUID and status indexes
- Recipient email indexes
- Document and signature field indexes
- Analytics event tracking indexes

### Caching Strategy
- Envelope metadata caching
- Document thumbnail caching
- Template data caching
- Analytics aggregation caching

### Scalability Features
- Bulk operations support
- Async processing for large operations
- Database connection pooling
- File storage optimization

## Comparison with DocuSign

| Feature | OnDottedLine | DocuSign |
|---------|--------------|-----------|
| Envelope Container | ✅ Yes | ✅ Yes |
| Multiple Documents | ✅ Yes | ✅ Yes |
| Certificate of Completion | ✅ Enhanced | ✅ Basic |
| Template System | ✅ Advanced | ✅ Basic |
| Collaboration | ✅ Real-time | ❌ Limited |
| Analytics | ✅ Detailed | ✅ Basic |
| Workflow Automation | ✅ Advanced | ✅ Premium |
| Version Control | ✅ Built-in | ❌ No |
| Comments/Annotations | ✅ Yes | ✅ Premium |
| Bulk Operations | ✅ Yes | ✅ Premium |
| Custom Branding | ✅ Yes | ✅ Premium |
| API Integration | ✅ Comprehensive | ✅ Good |

## Future Enhancements

### Planned Features
- Mobile SDK for native apps
- Advanced workflow engine
- Machine learning for field detection
- Blockchain verification
- Advanced reporting and BI
- Multi-tenant architecture
- Advanced compliance features

### Integration Roadmap
- Microsoft Office 365
- Google Workspace
- Salesforce Lightning
- HubSpot CRM
- Box, Dropbox, OneDrive
- Custom API connectors

---

This envelope system provides a robust foundation for enterprise-grade electronic signature workflows while maintaining simplicity and ease of use.
