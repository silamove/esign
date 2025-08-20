const bcrypt = require('bcryptjs');
const User = require('../models/User');
const db = require('../models/database');

async function seedUsers() {
  try {
    console.log('🌱 Starting database seeding...');

    // Initialize database first
    await db.initialize();
    console.log('📊 Database initialized successfully');

    // Check if users already exist
    const existingUsers = await User.findAll();
    if (existingUsers.length > 0) {
      console.log('📋 Users already exist in database. Skipping seeding.');
      console.log(`Found ${existingUsers.length} existing users:`);
      existingUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
      });
      return;
    }

    // Create test users
    const testUsers = [
      {
        email: 'admin@pdfsign.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      },
      {
        email: 'user@pdfsign.com',
        password: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user'
      },
      {
        email: 'demo@pdfsign.com',
        password: 'demo123',
        firstName: 'Demo',
        lastName: 'Account',
        role: 'user'
      }
    ];

    console.log('👥 Creating test users...');

    for (const userData of testUsers) {
      // Create user using the User model
      const user = await User.create({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });

      console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📝 Test Users Created:');
    console.log('1. Admin User:');
    console.log('   Email: admin@pdfsign.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    console.log('\n2. Regular User:');
    console.log('   Email: user@pdfsign.com');
    console.log('   Password: user123');
    console.log('   Role: user');
    console.log('\n3. Demo Account:');
    console.log('   Email: demo@pdfsign.com');
    console.log('   Password: demo123');
    console.log('   Role: user');
    console.log('\n🚀 You can now login with any of these accounts!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedUsers().then(() => {
    console.log('\n✨ Seeding process completed. You can now start the application.');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { seedUsers };
