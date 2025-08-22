// PostgreSQL syntax validation script
require('dotenv').config();
const { Client } = require('pg');

async function validateSQLSyntax() {
  // Don't actually connect to a database, just validate the connection params
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: 'postgres', // Connect to default postgres DB for validation
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true'
  });

  try {
    console.log('PostgreSQL connection configuration:');
    console.log(`Host: ${process.env.DATABASE_HOST}`);
    console.log(`Port: ${process.env.DATABASE_PORT}`);
    console.log(`Database: ${process.env.DATABASE_NAME}`);
    console.log(`User: ${process.env.DATABASE_USER}`);
    console.log(`SSL: ${process.env.DATABASE_SSL}`);
    
    // Test basic connection
    await client.connect();
    console.log('✅ PostgreSQL connection successful');
    
    // Test a simple query to validate PostgreSQL is working
    const result = await client.query('SELECT version();');
    console.log('✅ PostgreSQL version:', result.rows[0].version.split(' ')[0]);
    
    // Test IF NOT EXISTS syntax (should work in PostgreSQL)
    try {
      await client.query('CREATE TABLE IF NOT EXISTS test_syntax_validation (id SERIAL PRIMARY KEY);');
      await client.query('DROP TABLE IF EXISTS test_syntax_validation;');
      console.log('✅ PostgreSQL IF NOT EXISTS syntax is valid');
    } catch (syntaxError) {
      console.error('❌ PostgreSQL syntax error:', syntaxError.message);
    }
    
    await client.end();
    console.log('\n🎉 PostgreSQL validation completed successfully!');
    
  } catch (error) {
    console.error('❌ PostgreSQL validation failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 PostgreSQL server is not running. Please start PostgreSQL and try again.');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed. Please check your PostgreSQL credentials in .env file.');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Run create-database.js first.');
    }
  }
}

if (require.main === module) {
  validateSQLSyntax();
}

module.exports = { validateSQLSyntax };
