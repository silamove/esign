#!/usr/bin/env node

// Seeds a minimal envelope + document + recipient + field, then performs a test sign
// to populate signature_evidences and audit_events.

require('dotenv').config();
const path = require('path');
const db = require('../models/database');
const Envelope = require('../models/Envelope');
const Document = require('../models/Document');
const EnvelopeSignatureController = require('../controllers/envelopeSignatureController');
const { generateSampleDocuments } = require('../scripts/generate-sample-documents');
const EnvelopeCertificate = require('../models/EnvelopeCertificate');

async function ensureDemoUser() {
  // Try to find demo user; if not present, create a simple one
  let user = await db.get('SELECT * FROM users WHERE email = ?', ['demo@pdfsign.com']);
  if (!user) {
    console.log('Demo user not found, creating one quickly...');
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('demo123', 10);
    // Use query builder to be Postgres-safe and get id
    const insert = db.buildInsertQuery('users', {
      email: 'demo@pdfsign.com',
      password: passwordHash,
      first_name: 'Demo',
      last_name: 'Account',
      role: 'user'
    });
    const res = await db.run(insert.query, insert.params);
    // Re-select by email to be robust
    user = await db.get('SELECT * FROM users WHERE email = ?', ['demo@pdfsign.com']);
    console.log('Created demo user id:', user?.id, 'res id:', res.id || res.lastID);
  }
  return user;
}

async function ensureSampleDocument(userId) {
  // Ensure uploads dir has at least one PDF and register it in DB
  // Use the generator to produce a few, then pick the most recent one
  await generateSampleDocuments();
  // Reinitialize DB because the generator closes the pool when finished
  await db.initialize();
  // Prefer documents tied to the user; otherwise pick latest
  let docRow = await db.get(
    'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (!docRow) {
    docRow = await db.get('SELECT * FROM documents ORDER BY created_at DESC LIMIT 1', []);
  }
  if (!docRow) throw new Error('No document found after generation');
  return new Document(docRow);
}

async function seedEnvelopeFlow() {
  try {
    if (process.env.DATABASE_TYPE !== 'postgresql') {
      console.warn('Warning: DATABASE_TYPE is not postgresql. This seeder targets Postgres.');
    }

    await db.initialize();

    const user = await ensureDemoUser();
    if (!user?.id) throw new Error('Demo user not available');
    const doc = await ensureSampleDocument(user.id);

    // Create an envelope
    const env = await Envelope.create({
      userId: user.id,
      organizationId: null,
      title: 'E2E Test Envelope',
      subject: 'Please sign this test document',
      message: 'Automated test flow',
      priority: 'medium',
      expirationDate: null,
      reminderFrequency: 'daily',
      metadata: { seeded: true }
    });

    if (!env || !env.id) throw new Error('Envelope creation failed');

    // Attach document to envelope (use consolidated envelope_id linkage)
    await db.run('UPDATE documents SET envelope_id = ? WHERE id = ?', [env.id, doc.id]);
    // Also register the association in envelope_documents for compatibility/reporting
    try {
      await db.run(
        `INSERT INTO envelope_documents (envelope_id, document_id, document_order)
         SELECT ?, ?, 1 WHERE NOT EXISTS (
           SELECT 1 FROM envelope_documents WHERE envelope_id = ? AND document_id = ?
         )`,
        [env.id, doc.id, env.id, doc.id]
      );
    } catch (e) {
      console.warn('Could not insert into envelope_documents (optional):', e.message);
    }

    // Add one signer
    const recResult = await env.addRecipient({
      email: 'signer1@example.com',
      name: 'Alice Signer',
      role: 'signer',
      routingOrder: 1,
      permissions: { canDecline: true },
      authenticationMethod: 'email',
      customMessage: 'Thanks for helping test!',
      sendReminders: true
    });

    // Fetch recipient row to get token
    let rec = await db.get('SELECT * FROM recipients WHERE envelope_id = ? AND email = ?', [env.id, 'signer1@example.com']);
    const token = rec?.access_token || recResult?.accessToken;

    // Add one signature field on page 1
    await env.addSignatureField({
      documentId: doc.id,
      recipientEmail: 'signer1@example.com',
      fieldType: 'signature',
      fieldName: 'primary_signature',
      x: 0.2, y: 0.8, width: 0.3, height: 0.08,
      page: 1,
      required: true,
      defaultValue: null,
      validationRules: {}
    });

    // Send envelope to set status and log audit before signing
    try {
      await env.send();
    } catch (e) {
      console.warn('Envelope send failed or skipped:', e.message);
    }

    // Perform a test signing via controller to create cryptographic evidence
    const req = {
      params: { uuid: env.uuid, token },
      body: {
        fieldValues:
          // Use coordinate-based insert to be robust
          [{ documentId: doc.id, page: 1, x: 0.2, y: 0.8, width: 0.3, height: 0.08, fieldType: 'signature', fieldName: 'primary_signature', value: 'Alice S.' }]
      },
      ip: '127.0.0.1',
      get: (h) => (h === 'User-Agent' ? 'Seeder/1.0' : undefined)
    };

    const resCapture = { statusCode: 200 };
    const res = {
      status: (code) => {
        resCapture.statusCode = code;
        return { json: (obj) => console.log('HTTP', code, JSON.stringify(obj)) };
      },
      json: (obj) => console.log('HTTP 200', JSON.stringify(obj))
    };

    await EnvelopeSignatureController.signEnvelope(req, res, (err) => { if (err) throw err; });

    // Verify evidence and audit entries
    const evCount = await db.get('SELECT COUNT(*)::int AS c FROM signature_evidences WHERE envelope_id = ?', [env.id]);
    const auditCount = await db.get("SELECT COUNT(*)::int AS c FROM audit_events WHERE envelope_id = ? AND event_type = 'recipient_signed'", [env.id]);

    // If completed, generate certificate
    const envAfter = await Envelope.findById(env.id);
    let certInfo = {};
    if (envAfter?.status === 'completed') {
      try {
        const cert = await EnvelopeCertificate.generateCertificate(env.id);
        const pdfPath = await cert.generatePDF();
        certInfo = { certificateUuid: cert.certificateUuid, pdfPath };
      } catch (e) {
        console.warn('Certificate generation skipped:', e.message);
      }
    }

    console.log('\nSeed complete. Summary:');
    console.log(' - Envelope ID:', env.id, 'UUID:', env.uuid, 'Status:', envAfter?.status);
    console.log(' - Document ID:', doc.id, 'Filename:', doc.filename);
    console.log(' - Recipient:', 'signer1@example.com');
    console.log(' - Access Token:', token);
    console.log(' - Signing URL path: /api/envelopes/' + env.uuid + '/recipients/' + token + '/sign');
    console.log(' - signature_evidences rows for envelope:', evCount?.c);
    console.log(" - audit_events 'recipient_signed' rows:", auditCount?.c);
    if (certInfo.certificateUuid) {
      console.log(' - Certificate UUID:', certInfo.certificateUuid);
      console.log(' - Certificate PDF:', certInfo.pdfPath);
    }

    await db.close();
    return 0;
  } catch (err) {
    console.error('Seeder failed:', err);
    try { await db.close(); } catch {}
    return 1;
  }
}

if (require.main === module) {
  seedEnvelopeFlow().then((code) => process.exit(code));
}

module.exports = { seedEnvelopeFlow };
