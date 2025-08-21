#!/usr/bin/env node

const database = require('../models/database');
const { v4: uuidv4 } = require('uuid');

async function seedDocumentsForDemo() {
  try {
    console.log('Seeding documents for demo user...');
    
    await database.initialize();
    
    // Get the demo user
    const demoUser = await database.get('SELECT * FROM users WHERE email = ?', ['demo@pdfsign.com']);
    if (!demoUser) {
      console.log('Demo user not found.');
      return;
    }
    
    console.log(`Creating documents for demo user: ${demoUser.email} (ID: ${demoUser.id})`);
    
    // Create test documents for demo user
    const testDocuments = [
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_Contract.pdf',
        filename: 'demo_contract_001.pdf',
        file_size: 256000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 3,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_NDA.pdf',
        filename: 'demo_nda_002.pdf',
        file_size: 128000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 2,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_Agreement.pdf',
        filename: 'demo_agreement_003.pdf',
        file_size: 340000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 5,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_Invoice.pdf',
        filename: 'demo_invoice_004.pdf',
        file_size: 89000,
        mime_type: 'application/pdf',
        status: 'draft',
        total_pages: 1,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_Completed_Doc.pdf',
        filename: 'demo_completed_005.pdf',
        file_size: 412000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 8,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: demoUser.id,
        original_name: 'Demo_Signed_Contract.pdf',
        filename: 'demo_signed_006.pdf',
        file_size: 156000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 2,
        metadata: JSON.stringify({ uploaded: true })
      }
    ];
    
    // Insert documents
    for (const doc of testDocuments) {
      await database.run(`
        INSERT INTO documents (uuid, user_id, original_name, filename, file_size, mime_type, status, total_pages, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        doc.uuid,
        doc.user_id,
        doc.original_name,
        doc.filename,
        doc.file_size,
        doc.mime_type,
        doc.status,
        doc.total_pages,
        doc.metadata
      ]);
      
      console.log(`✅ Created: ${doc.original_name} (${doc.status})`);
    }
    
    // Create some templates for demo user
    await database.run(`
      INSERT OR IGNORE INTO envelope_templates (user_id, name, description, category, is_public, template_data, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      demoUser.id,
      'Demo NDA Template',
      'Demo non-disclosure agreement template',
      'Legal',
      0,
      JSON.stringify({
        envelope: { title: 'Demo NDA Signing' },
        documents: [{ name: 'NDA.pdf' }],
        recipients: [{ role: 'signer' }],
        signatureFields: [{ type: 'signature', required: true }]
      }),
      5
    ]);
    
    await database.run(`
      INSERT OR IGNORE INTO envelope_templates (user_id, name, description, category, is_public, template_data, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      demoUser.id,
      'Demo Contract Template',
      'Demo contract template',
      'Business',
      0,
      JSON.stringify({
        envelope: { title: 'Demo Contract' },
        documents: [{ name: 'Contract.pdf' }],
        recipients: [{ role: 'signer' }],
        signatureFields: [{ type: 'signature', required: true }]
      }),
      3
    ]);
    
    console.log('✅ Created 2 templates');
    
    // Show final counts
    const docCount = await database.get('SELECT COUNT(*) as count FROM documents WHERE user_id = ?', [demoUser.id]);
    const templateCount = await database.get('SELECT COUNT(*) as count FROM envelope_templates WHERE user_id = ?', [demoUser.id]);
    
    console.log(`\n📊 Final counts for ${demoUser.email}:`);
    console.log(`   Documents: ${docCount.count}`);
    console.log(`   Templates: ${templateCount.count}`);
    
    console.log('\n✅ Demo user seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding documents:', error);
  } finally {
    await database.close();
  }
}

seedDocumentsForDemo();
