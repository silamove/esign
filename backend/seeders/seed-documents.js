#!/usr/bin/env node

const database = require('../models/database');
const Document = require('../models/Document');
const { v4: uuidv4 } = require('uuid');

async function seedDocuments() {
  try {
    console.log('Seeding test documents...');
    
    await database.initialize();
    
    // Get test users
    const users = await database.all('SELECT * FROM users');
    if (users.length === 0) {
      console.log('No users found. Run user seeder first.');
      return;
    }
    
    const testUser = users[0]; // Use first user
    console.log(`Creating documents for user: ${testUser.email}`);
    
    // Create test documents with different statuses
    const testDocuments = [
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Contract_Agreement.pdf',
        filename: 'contract_agreement_001.pdf',
        file_size: 256000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 3,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'NDA_Document.pdf',
        filename: 'nda_document_002.pdf',
        file_size: 128000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 2,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Service_Agreement.pdf',
        filename: 'service_agreement_003.pdf',
        file_size: 340000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 5,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Employment_Contract.pdf',
        filename: 'employment_contract_004.pdf',
        file_size: 512000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 4,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Invoice_Template.pdf',
        filename: 'invoice_template_005.pdf',
        file_size: 89000,
        mime_type: 'application/pdf',
        status: 'in_progress',
        total_pages: 1,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Lease_Agreement.pdf',
        filename: 'lease_agreement_006.pdf',
        file_size: 412000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 8,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Purchase_Order.pdf',
        filename: 'purchase_order_007.pdf',
        file_size: 156000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 2,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Partnership_Agreement.pdf',
        filename: 'partnership_agreement_008.pdf',
        file_size: 678000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 12,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Consulting_Contract.pdf',
        filename: 'consulting_contract_009.pdf',
        file_size: 245000,
        mime_type: 'application/pdf',
        status: 'completed',
        total_pages: 3,
        metadata: JSON.stringify({ uploaded: true })
      },
      {
        uuid: uuidv4(),
        user_id: testUser.id,
        original_name: 'Vendor_Agreement.pdf',
        filename: 'vendor_agreement_010.pdf',
        file_size: 298000,
        mime_type: 'application/pdf',
        status: 'draft',
        total_pages: 6,
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
    
    // Create some test templates
    await database.run(`
      INSERT OR IGNORE INTO envelope_templates (user_id, name, description, category, is_public, template_data, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testUser.id,
      'Standard NDA Template',
      'Non-disclosure agreement for business partnerships',
      'Legal',
      1,
      JSON.stringify({
        envelope: { title: 'NDA Signing Request' },
        documents: [{ name: 'NDA.pdf' }],
        recipients: [{ role: 'signer' }],
        signatureFields: [{ type: 'signature', required: true }]
      }),
      15
    ]);
    
    await database.run(`
      INSERT OR IGNORE INTO envelope_templates (user_id, name, description, category, is_public, template_data, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testUser.id,
      'Employment Contract Template',
      'Standard employment agreement template',
      'Business',
      1,
      JSON.stringify({
        envelope: { title: 'Employment Contract' },
        documents: [{ name: 'Employment_Contract.pdf' }],
        recipients: [{ role: 'signer' }],
        signatureFields: [{ type: 'signature', required: true }]
      }),
      8
    ]);
    
    await database.run(`
      INSERT OR IGNORE INTO envelope_templates (user_id, name, description, category, is_public, template_data, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testUser.id,
      'Invoice Template',
      'Professional invoice template',
      'Finance',
      0,
      JSON.stringify({
        envelope: { title: 'Invoice for Signature' },
        documents: [{ name: 'Invoice.pdf' }],
        recipients: [{ role: 'signer' }],
        signatureFields: [{ type: 'signature', required: true }]
      }),
      25
    ]);
    
    console.log('✅ Created 3 templates');
    
    // Show final counts
    const docCount = await database.get('SELECT COUNT(*) as count FROM documents WHERE user_id = ?', [testUser.id]);
    const templateCount = await database.get('SELECT COUNT(*) as count FROM envelope_templates WHERE user_id = ?', [testUser.id]);
    
    console.log(`\n📊 Final counts for ${testUser.email}:`);
    console.log(`   Documents: ${docCount.count}`);
    console.log(`   Templates: ${templateCount.count}`);
    
    console.log('\n✅ Document seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding documents:', error);
  } finally {
    await database.close();
  }
}

seedDocuments();
