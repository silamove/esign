const bcrypt = require('bcryptjs');
const db = require('../models/database');

async function testAuth() {
  try {
    await db.initialize();
    console.log('📊 Testing authentication step by step...');
    
    const email = 'demo@pdfsign.com';
    const password = 'demo123';
    
    // Step 1: Find user by email
    console.log(`\n1️⃣ Looking for user: ${email}`);
    const rawUser = await db.get('SELECT * FROM users WHERE email = ? AND is_active = ?', [email.toLowerCase(), true]);
    
    if (!rawUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   ID: ${rawUser.id}`);
    console.log(`   Email: ${rawUser.email}`);
    console.log(`   Name: ${rawUser.first_name} ${rawUser.last_name}`);
    console.log(`   Active: ${rawUser.is_active}`);
    console.log(`   Password hash: ${rawUser.password.substring(0, 30)}...`);
    
    // Step 2: Test password comparison
    console.log(`\n2️⃣ Testing password comparison...`);
    console.log(`   Input password: "${password}"`);
    console.log(`   Stored hash: ${rawUser.password.substring(0, 30)}...`);
    
    const isValid = await bcrypt.compare(password, rawUser.password);
    console.log(`   Comparison result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    // Step 3: Test creating a new hash with same password
    console.log(`\n3️⃣ Creating new hash for comparison...`);
    const newHash = await bcrypt.hash(password, 12);
    console.log(`   New hash: ${newHash.substring(0, 30)}...`);
    
    const newComparison = await bcrypt.compare(password, newHash);
    console.log(`   New hash comparison: ${newComparison ? '✅ VALID' : '❌ INVALID'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAuth();
