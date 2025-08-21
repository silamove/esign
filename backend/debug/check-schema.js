const database = require('../models/database');

async function checkSchema() {
  try {
    await database.initialize();
    const schema = await database.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'`);
    console.log('Documents table schema:');
    console.log(schema.sql);
    await database.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
