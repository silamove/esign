#!/usr/bin/env node

require('dotenv').config();
const db = require('../models/database');

async function tableExists(name) {
  try {
    const res = await db.query(`SELECT to_regclass($1) AS reg`, [name]);
    return !!res.rows[0].reg;
  } catch {
    return false;
  }
}

async function countRows(name) {
  try {
    const res = await db.query(`SELECT COUNT(*)::int AS c FROM ${name}`);
    return res.rows[0].c;
  } catch {
    return null;
  }
}

async function columnExists(table, column) {
  const res = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column]
  );
  return res.rowCount > 0;
}

async function validate() {
  try {
    await db.initialize();

    const checks = [
      { name: 'envelopes' },
      { name: 'documents' },
      { name: 'envelope_documents' },
      { name: 'envelope_recipients' },
      { name: 'envelope_signatures' },
      { name: 'recipients' },
      { name: 'fields' },
      { name: 'audit_events' },
      { name: 'signature_evidences' },
      { name: 'templates' },
    ];

    console.log('Schema checks:');
    for (const t of checks) {
      const exists = await tableExists(t.name);
      const count = exists ? await countRows(t.name) : null;
      console.log(` - ${t.name.padEnd(22)}: ${exists ? 'present' : 'MISSING'}${exists ? ` (${count} rows)` : ''}`);
    }

    // Column checks
    const colChecks = [
      { table: 'documents', column: 'envelope_id' },
      { table: 'recipients', column: 'access_token' },
      { table: 'audit_events', column: 'prev_event_hash' },
      { table: 'audit_events', column: 'event_hash' },
    ];
    console.log('\nColumn checks:');
    for (const c of colChecks) {
      const ok = await columnExists(c.table, c.column);
      console.log(` - ${c.table}.${c.column}: ${ok ? 'present' : 'MISSING'}`);
    }

    // Backfill sanity comparisons
    async function safeCount(q) {
      try { const r = await db.query(q); return r.rows[0].c; } catch { return null; }
    }

    const counts = {
      envRecipients: await safeCount('SELECT COUNT(*)::int AS c FROM envelope_recipients'),
      recipients: await safeCount('SELECT COUNT(*)::int AS c FROM recipients'),
      envSigs: await safeCount('SELECT COUNT(*)::int AS c FROM envelope_signatures'),
      fields: await safeCount("SELECT COUNT(*)::int AS c FROM fields WHERE envelope_id IS NOT NULL")
    };

    console.log('\nBackfill sanity:');
    console.log(` - envelope_recipients -> recipients: ${counts.envRecipients} -> ${counts.recipients}`);
    console.log(` - envelope_signatures -> fields: ${counts.envSigs} -> ${counts.fields}`);

    await db.close();
    console.log('\n✅ Migration validation complete');
  } catch (err) {
    console.error('❌ Validation failed:', err.message);
    try { await db.close(); } catch {}
    process.exit(1);
  }
}

if (require.main === module) validate();

module.exports = validate;
