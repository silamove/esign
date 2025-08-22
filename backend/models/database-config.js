// Database configuration and initialization
// Chooses between SQLite and PostgreSQL based on environment

const databaseType = process.env.DATABASE_TYPE || 'sqlite';

let database;

if (databaseType === 'postgresql') {
  console.log('Using PostgreSQL database');
  database = require('./database-postgres');
} else {
  console.log('Using SQLite database');
  database = require('./database-sqlite');
}

module.exports = database;
