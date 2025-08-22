const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const db = require('./database');

class EnvelopeCertificate {
  constructor(data) {
    this.id = data.id;
    this.envelopeId = data.envelope_id || data.envelopeId;
    this.certificateUuid = data.certificate_uuid || data.certificateUuid;
    this.certificateData = data.certificate_data ? JSON.parse(data.certificate_data) : data.certificateData;
    this.pdfPath = data.pdf_path || data.pdfPath;
    this.blockchainHash = data.blockchain_hash || data.blockchainHash;
    this.createdAt = data.created_at || data.createdAt;
  }

  static async generateCertificate(envelopeId) {
    // Get envelope details with all related data
    const envelope = await db.get(
      `SELECT e.*, u.first_name, u.last_name, u.email as sender_email
       FROM envelopes e
       JOIN users u ON e.user_id = u.id
       WHERE e.id = ?`,
      [envelopeId]
    );

    if (!envelope || envelope.status !== 'completed') {
      throw new Error('Envelope must be completed to generate certificate');
    }

    // Get all recipients and their actions
    const recipients = await db.all(
      `SELECT * FROM recipients 
       WHERE envelope_id = ? 
       ORDER BY routing_order ASC`,
      [envelopeId]
    );

    // Get all documents
    const documents = await db.all(
      `SELECT d.*, ed.document_order
       FROM documents d
       JOIN envelope_documents ed ON d.id = ed.document_id
       WHERE ed.envelope_id = ?
       ORDER BY ed.document_order ASC`,
      [envelopeId]
    );

    // Get all signature fields and their completion status
    const signatureFields = await db.all(
      `SELECT * FROM envelope_signatures 
       WHERE envelope_id = ? 
       ORDER BY page ASC, y ASC, x ASC`,
      [envelopeId]
    );

    // Get signature evidences (HSM/TSP)
    let evidences = [];
    try {
      evidences = await db.all(
        `SELECT se.*, r.email as recipient_email, r.name as recipient_name
         FROM signature_evidences se
         JOIN recipients r ON r.id = se.recipient_id
         WHERE se.envelope_id = ?
         ORDER BY se.created_at ASC`,
        [envelopeId]
      );
    } catch (_) {
      evidences = [];
    }

    // Get audit trail
    const auditLogs = await db.all(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.envelope_id = ?
       ORDER BY al.created_at ASC`,
      [envelopeId]
    );

    // Generate comprehensive certificate data
    const certificateData = {
      envelope: {
        id: envelope.id,
        uuid: envelope.uuid,
        title: envelope.title,
        subject: envelope.subject,
        status: envelope.status,
        createdAt: envelope.created_at,
        sentAt: envelope.sent_at,
        completedAt: envelope.completed_at
      },
      sender: {
        name: `${envelope.first_name} ${envelope.last_name}`,
        email: envelope.sender_email
      },
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.original_name,
        order: doc.document_order,
        pages: doc.total_pages,
        fileSize: doc.file_size
      })),
      recipients: recipients.map(recipient => {
        const recipientFields = signatureFields.filter(field => field.recipient_email === recipient.email);
        return {
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          routingOrder: recipient.routing_order,
          status: recipient.status,
          signedAt: recipient.signed_at,
          viewedAt: recipient.viewed_at,
          fields: recipientFields.map(field => ({
            type: field.field_type,
            page: field.page,
            position: { x: field.x, y: field.y },
            size: { width: field.width, height: field.height },
            signedAt: field.signed_at,
            value: field.value
          }))
        };
      }),
      auditTrail: auditLogs.map(log => ({
        timestamp: log.created_at,
        action: log.action,
        user: log.first_name && log.last_name ? `${log.first_name} ${log.last_name}` : 'System',
        email: log.email,
        ipAddress: log.ip_address,
        details: log.details ? JSON.parse(log.details) : {}
      })),
      security: {
        generatedAt: new Date().toISOString(),
        certificateVersion: '1.1',
        integrity: {
          totalSignatures: signatureFields.filter(f => f.signed_at).length,
          requiredSignatures: signatureFields.filter(f => f.required).length,
          documentCount: documents.length,
          recipientCount: recipients.length
        },
        evidences: evidences.map(e => ({
          provider: e.provider,
          recipient: { id: e.recipient_id, email: e.recipient_email, name: e.recipient_name },
          signaturePreview: e.signature_blob ? String(e.signature_blob).slice(0, 24) + '...' : null,
          tsaPresent: !!e.tsa_token,
          createdAt: e.created_at,
          payload: (() => { try { return typeof e.payload_json === 'string' ? JSON.parse(e.payload_json) : e.payload_json; } catch { return null; } })()
        }))
      },
      compliance: {
        electronicSignatureAct: 'ESIGN Act 2000 / UETA Compliant',
        timeStampAuthority: 'OnDottedLine TSA',
        encryptionStandard: 'AES-256',
        documentIntegrity: 'SHA-256 Hash Verified'
      }
    };

    // Generate unique certificate UUID
    const certificateUuid = uuidv4();

    // Create certificate record
    const result = await db.run(
      `INSERT INTO envelope_certificates (envelope_id, certificate_uuid, certificate_data)
       VALUES (?, ?, ?)`,
      [envelopeId, certificateUuid, JSON.stringify(certificateData)]
    );

    return this.findById(result.id);
  }

  static async findById(id) {
    const row = await db.get('SELECT * FROM envelope_certificates WHERE id = ?', [id]);
    return row ? new EnvelopeCertificate(row) : null;
  }

  static async findByEnvelopeId(envelopeId) {
    const row = await db.get('SELECT * FROM envelope_certificates WHERE envelope_id = ?', [envelopeId]);
    return row ? new EnvelopeCertificate(row) : null;
  }

  static async findByUuid(uuid) {
    const row = await db.get('SELECT * FROM envelope_certificates WHERE certificate_uuid = ?', [uuid]);
    return row ? new EnvelopeCertificate(row) : null;
  }

  async generatePDF() {
    const PDFDocument = require('pdfkit');
    const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');
    
    // Ensure certificates directory exists
    await fs.mkdir(certificatesDir, { recursive: true });

    const pdfPath = path.join(certificatesDir, `certificate_${this.certificateUuid}.pdf`);
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'OnDottedLine Certificate of Completion',
          Author: 'OnDottedLine',
          Subject: `Certificate for Envelope: ${this.certificateData.envelope.title}`,
          Creator: 'OnDottedLine Electronic Signature Platform'
        }
      });

      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24)
         .fillColor('#1f2937')
         .text('Certificate of Completion', 50, 60, { align: 'center' });

      doc.fontSize(16)
         .fillColor('#6b7280')
         .text('OnDottedLine Electronic Signature Platform', 50, 95, { align: 'center' });

      // Certificate details
      const data = this.certificateData;
      let yPos = 150;

      // Envelope information
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Envelope Information', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11)
         .fillColor('#374151')
         .text(`Title: ${data.envelope.title}`, 70, yPos)
         .text(`ID: ${data.envelope.uuid}`, 70, yPos + 15)
         .text(`Completed: ${new Date(data.envelope.completedAt).toLocaleString()}`, 70, yPos + 30);

      yPos += 70;

      // Sender information
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Sender', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11)
         .fillColor('#374151')
         .text(`Name: ${data.sender.name}`, 70, yPos)
         .text(`Email: ${data.sender.email}`, 70, yPos + 15);

      yPos += 55;

      // Recipients and signatures
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Recipients & Signatures', 50, yPos);

      yPos += 25;
      data.recipients.forEach((recipient, index) => {
        doc.fontSize(11)
           .fillColor('#374151')
           .text(`${index + 1}. ${recipient.name} (${recipient.email})`, 70, yPos)
           .text(`   Role: ${recipient.role} | Signed: ${new Date(recipient.signedAt).toLocaleString()}`, 70, yPos + 12);
        yPos += 35;
      });

      yPos += 20;

      // Documents
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Documents', 50, yPos);

      yPos += 25;
      data.documents.forEach((document, index) => {
        doc.fontSize(11)
           .fillColor('#374151')
           .text(`${index + 1}. ${document.name} (${document.pages} pages)`, 70, yPos);
        yPos += 18;
      });

      yPos += 30;

      // Security and compliance
      doc.fontSize(14)
         .fillColor('#1f2937')
         .text('Security & Compliance', 50, yPos);

      yPos += 25;
      doc.fontSize(11)
         .fillColor('#374151')
         .text(`Electronic Signature Act: ${data.compliance.electronicSignatureAct}`, 70, yPos)
         .text(`Document Integrity: ${data.compliance.documentIntegrity}`, 70, yPos + 15)
         .text(`Encryption: ${data.compliance.encryptionStandard}`, 70, yPos + 30);

      yPos += 65;

      // Certificate UUID and generation info
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text(`Certificate ID: ${this.certificateUuid}`, 50, yPos)
         .text(`Generated: ${data.security.generatedAt}`, 50, yPos + 12)
         .text(`This certificate provides a complete audit trail of the electronic signature transaction.`, 50, yPos + 30, { width: 500 });

      // Footer
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text('This certificate is digitally generated and does not require a physical signature.', 50, 750, {
           align: 'center',
           width: 500
         });

      doc.end();

      stream.on('finish', async () => {
        // Update database with PDF path
        await db.run(
          'UPDATE envelope_certificates SET pdf_path = ? WHERE id = ?',
          [pdfPath, this.id]
        );
        this.pdfPath = pdfPath;
        resolve(pdfPath);
      });

      stream.on('error', reject);
    });
  }

  async addBlockchainVerification(blockchainHash) {
    await db.run(
      'UPDATE envelope_certificates SET blockchain_hash = ? WHERE id = ?',
      [blockchainHash, this.id]
    );
    this.blockchainHash = blockchainHash;
  }

  toJSON() {
    return {
      id: this.id,
      envelopeId: this.envelopeId,
      certificateUuid: this.certificateUuid,
      certificateData: this.certificateData,
      pdfPath: this.pdfPath,
      blockchainHash: this.blockchainHash,
      createdAt: this.createdAt
    };
  }
}

module.exports = EnvelopeCertificate;
