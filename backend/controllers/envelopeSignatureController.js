const db = require('../models/database');
const hsm = require('../services/hsmService');

/**
 * Envelope-centric signing controller
 * - Validates recipient access token and routing order
 * - Hashes documents in the envelope
 * - Requests a detached signature from HSM/TSP
 * - Persists signature evidence and field values via envelope_signatures view
 * - Emits audit_events and advances workflow
 */
class EnvelopeSignatureController {
  async signEnvelope(req, res, next) {
    try {
      const { uuid } = req.params; // envelope uuid
      const { token } = req.params; // recipient access token
      const { fieldValues = [] } = req.body; // [{fieldId or {documentId,page,x,y,...}}, value]

      // 1) Resolve envelope
      const envelope = await db.get('SELECT * FROM envelopes WHERE uuid = ?', [uuid]);
      if (!envelope) return res.status(404).json({ success: false, message: 'Envelope not found' });

      // 2) Resolve recipient by token and envelope
      const recipient = await db.get(
        'SELECT * FROM recipients WHERE envelope_id = ? AND access_token = ?',
        [envelope.id, token]
      );
      if (!recipient) return res.status(403).json({ success: false, message: 'Invalid or expired link' });

      // 3) Enforce routing order: ensure this recipient is next pending
      const nextRecipient = await db.get(
        `SELECT * FROM recipients 
         WHERE envelope_id = ? AND status IN ('pending','sent','viewed')
         ORDER BY routing_order ASC, id ASC LIMIT 1`,
        [envelope.id]
      );
      if (!nextRecipient || nextRecipient.id !== recipient.id) {
        return res.status(409).json({ success: false, message: 'Not your turn to sign yet' });
      }

      // 4) Hash all documents in the envelope
      const docs = await db.all(
        `SELECT d.* FROM documents d
         WHERE d.envelope_id = ? OR d.id IN (
           SELECT document_id FROM envelope_documents WHERE envelope_id = ?
         )
         ORDER BY d.id ASC`,
        [envelope.id, envelope.id]
      );

      const fs = require('fs').promises;
      const path = require('path');
      const crypto = require('crypto');

      const docHashes = [];
      for (const d of docs) {
        const filePath = path.join(process.cwd(), 'uploads', d.filename);
        const buf = await fs.readFile(filePath);
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
        docHashes.push({ documentId: d.id, sha256 });
      }

      // 5) Build canonical signing payload
      const payload = {
        envelopeId: envelope.id,
        envelopeUuid: envelope.uuid,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        intent: 'approve_and_sign',
        docHashes,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // 6) Call HSM/TSP to sign payload
      const signed = await hsm.signPayload(payload);

      // 7) Persist signature evidence
      await db.run(
        `INSERT INTO signature_evidences (envelope_id, recipient_id, provider, payload_json, signature_blob, tsa_token, cert_chain)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          envelope.id,
          recipient.id,
          signed.provider,
          JSON.stringify(payload),
          signed.signatureBlob,
          signed.tsaToken,
          JSON.stringify(signed.certChain)
        ]
      );

      // 8) Persist field values via compatibility view (if provided)
      for (const fv of fieldValues) {
        if (fv.fieldId) {
          await db.run(
            `UPDATE envelope_signatures SET value = ?, signed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [fv.value, fv.fieldId]
          );
        } else if (fv.documentId && fv.page != null && fv.x != null && fv.y != null) {
          await db.run(
            `INSERT INTO envelope_signatures (envelope_id, document_id, recipient_email, field_type, field_name, x, y, width, height, page, required, value, signed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              envelope.id,
              fv.documentId,
              recipient.email,
              fv.fieldType || 'signature',
              fv.fieldName || 'signature',
              fv.x, fv.y, fv.width || 0.2, fv.height || 0.05,
              fv.page,
              fv.required != null ? fv.required : true,
              fv.value
            ]
          );
        }
      }

      // 9) Audit event with tamper-evident chain
      const prev = await db.get(
        `SELECT event_hash FROM audit_events WHERE envelope_id = ? ORDER BY created_at DESC LIMIT 1`,
        [envelope.id]
      );
      const eventMeta = { recipientId: recipient.id, docHashes };
      const prevHash = prev?.event_hash || '';
      const eventPayloadStr = JSON.stringify({ type: 'recipient_signed', meta: eventMeta, ts: new Date().toISOString() });
      const eventHash = crypto.createHash('sha256').update(prevHash + eventPayloadStr).digest('hex');
      await db.run(
        `INSERT INTO audit_events (envelope_id, event_type, event_category, event_description, metadata, ip_address, user_agent, prev_event_hash, event_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          envelope.id,
          'recipient_signed',
          'user_action',
          null,
          JSON.stringify(eventMeta),
          req.ip,
          req.get('User-Agent'),
          prevHash,
          eventHash
        ]
      );

      // 10) Advance recipient status and possibly complete the envelope
      await db.run(
        `UPDATE recipients SET status = 'signed', signed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [recipient.id]
      );

      const remaining = await db.get(
        `SELECT COUNT(*) as cnt FROM recipients WHERE envelope_id = ? AND status != 'signed' AND role IN ('signer','approver')`,
        [envelope.id]
      );

      const remainingCount = Number(remaining?.cnt ?? remaining?.count ?? 0);

      if (remainingCount === 0) {
        await db.run(`UPDATE envelopes SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [envelope.id]);
      } else {
        const next = await db.get(
          `SELECT id FROM recipients WHERE envelope_id = ? AND status IN ('pending','sent','viewed') ORDER BY routing_order ASC, id ASC LIMIT 1`,
          [envelope.id]
        );
        if (next) {
          await db.run(`UPDATE recipients SET status = 'sent' WHERE id = ?`, [next.id]);
        }
      }

      res.json({ success: true, data: { envelopeId: envelope.id, recipientId: recipient.id, docHashes } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EnvelopeSignatureController();
