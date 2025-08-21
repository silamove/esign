#!/usr/bin/env node

const database = require('../models/database');

async function runMigrations() {
  try {
    console.log('Starting migration process...');
    
    await database.initialize();
    
    console.log('All migrations completed successfully!');
    
    // Show current schema info
    const tables = await database.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('\nCurrent database tables:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // Show migrations executed
    const migrations = await database.all('SELECT * FROM migrations ORDER BY version');
    console.log('\nExecuted migrations:');
    migrations.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name} (${migration.executed_at})`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
}

runMigrations();
