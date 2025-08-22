// Simple test script to verify PostgreSQL connection and setup
require('dotenv').config();
const db = require('./models/database');

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    
    // Test basic connection and initialize
    await db.initialize();
    console.log('✅ Database connected and initialized successfully');
    
    // Test query
    const result = await db.query('SELECT version();');
    console.log('✅ PostgreSQL version:', result.rows[0].version);
    
    // Check if organizations table exists
    const orgResult = await db.query('SELECT COUNT(*) as count FROM organizations;');
    console.log('✅ Organizations table exists with', orgResult.rows[0].count, 'records');
    
    // Check if users table exists
    const userResult = await db.query('SELECT COUNT(*) as count FROM users;');
    console.log('✅ Users table exists with', userResult.rows[0].count, 'records');
    
    console.log('\n🎉 PostgreSQL setup is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing connection:', error.message);
    process.exit(1);
  }
}

testConnection();
