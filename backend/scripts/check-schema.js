const database = require('../models/database');

async function checkSchema() {
  try {
    await database.initialize();
    
    const info = await database.all('PRAGMA table_info(legal_signatures)');
    console.log('legal_signatures table columns:');
    info.forEach(col => {
      console.log(`  ${col.name} (${col.type})`);
    });
    
    // Check if envelope_id and signed_at exist
    const hasEnvelopeId = info.some(col => col.name === 'envelope_id');
    const hasSignedAt = info.some(col => col.name === 'signed_at');
    
    console.log(`\nColumn check:`);
    console.log(`  envelope_id: ${hasEnvelopeId ? 'EXISTS' : 'MISSING'}`);
    console.log(`  signed_at: ${hasSignedAt ? 'EXISTS' : 'MISSING'}`);
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await database.close();
  }
}

checkSchema();
