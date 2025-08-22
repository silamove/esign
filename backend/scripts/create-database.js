#!/usr/bin/env node

const { Pool } = require('pg');

async function createDatabase() {
  const config = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: 'postgres', // Connect to default postgres database
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  };

  const pool = new Pool(config);
  const databaseName = process.env.DATABASE_NAME || 'ondottedline_dev';

  try {
    console.log('Connecting to PostgreSQL...');
    
    // Check if database exists
    const result = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );

    if (result.rows.length === 0) {
      console.log(`Creating database "${databaseName}"...`);
      await pool.query(`CREATE DATABASE ${databaseName}`);
      console.log(`✅ Database "${databaseName}" created successfully`);
    } else {
      console.log(`✅ Database "${databaseName}" already exists`);
    }

  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = createDatabase;
