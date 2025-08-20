const User = require('../models/User');
const db = require('../models/database');

async function checkUsers() {
  try {
    await db.initialize();
    console.log('📊 Database initialized');
    
    // Get raw data from database
    const rawUsers = await db.all('SELECT * FROM users');
    console.log(`\n👥 Found ${rawUsers.length} users in database (raw data):`);
    
    for (const user of rawUsers) {
      console.log(`\n🔍 User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.is_active}`);
      console.log(`   Password Hash: ${user.password ? user.password.substring(0, 20) + '...' : 'MISSING'}`);
      console.log(`   Created: ${user.created_at}`);
    }
    
    // Test User.findAll method
    const users = await User.findAll();
    console.log(`\n🔧 User.findAll() returned ${users.length} users`);
    
    // Test authentication
    const testAuth = await User.authenticate('demo@pdfsign.com', 'demo123');
    console.log(`\n� Authentication test: ${testAuth ? 'SUCCESS' : 'FAILED'}`);
    if (testAuth) {
      console.log(`   User: ${testAuth.firstName} ${testAuth.lastName}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUsers();
