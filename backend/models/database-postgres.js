const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class PostgresDatabase {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 5432,
      database: process.env.DATABASE_NAME || 'ondottedline_dev',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  async initialize() {
    try {
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();
      
      // Run migrations
      await this.runMigrations();
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async runMigrations() {
    // Create migrations table if it doesn't exist
    await this.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations-postgres');
    try {
      const migrationFiles = await fs.readdir(migrationsDir);
      const sqlFiles = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort((a, b) => {
          const aVersion = parseInt(a.split('_')[0]);
          const bVersion = parseInt(b.split('_')[0]);
          return aVersion - bVersion;
        });

      // Get executed migrations
      const executedMigrations = await this.query('SELECT version FROM migrations ORDER BY version');
      const executedVersions = new Set(executedMigrations.rows.map(row => row.version));

      // Run pending migrations
      for (const file of sqlFiles) {
        const version = parseInt(file.split('_')[0]);
        const name = file.replace('.sql', '');

        if (!executedVersions.has(version)) {
          console.log(`Running migration ${version}: ${name}`);
          
          try {
            const migrationPath = path.join(migrationsDir, file);
            const migrationSQL = await fs.readFile(migrationPath, 'utf8');
            
            // Execute migration in transaction
            const client = await this.pool.connect();
            try {
              await client.query('BEGIN');
              
              // Split by semicolon and execute each statement
              const statements = migrationSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
              
              for (const statement of statements) {
                if (statement.trim()) {
                  await client.query(statement);
                }
              }
              
              // Record migration
              await client.query('INSERT INTO migrations (version, name) VALUES ($1, $2)', [version, name]);
              
              await client.query('COMMIT');
              console.log(`✅ Migration ${version} completed successfully`);
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            } finally {
              client.release();
            }
          } catch (error) {
            console.error(`Migration error: ${error.message}`);
            console.error(`Query: ${error.query || 'Unknown'}`);
            console.error(`Params: ${error.params || 'None'}`);
            throw new Error(`Migration ${version} failed: ${error.message}`);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No migrations directory found, skipping migrations');
      } else {
        throw error;
      }
    }
  }

  async query(text, params = []) {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  async get(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  async all(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  async run(text, params = []) {
    const result = await this.query(text, params);
    return {
      lastID: result.rows[0]?.id,
      changes: result.rowCount
    };
  }

  // Query builder methods for compatibility with existing code
  buildSelectQuery(table, options = {}) {
    let query = `SELECT * FROM ${table}`;
    const params = [];
    let paramIndex = 1;

    if (options.where) {
      const whereConditions = [];
      for (const [key, value] of Object.entries(options.where)) {
        whereConditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    return { query, params };
  }

  buildInsertQuery(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const params = Object.values(data);

    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders.join(', ')}) 
      RETURNING id
    `;

    return { query, params };
  }

  buildUpdateQuery(table, data, where) {
    const columns = Object.keys(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`);
    const params = Object.values(data);
    
    let paramIndex = params.length + 1;
    const whereConditions = [];
    
    for (const [key, value] of Object.entries(where)) {
      whereConditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    const query = `
      UPDATE ${table} 
      SET ${setClause.join(', ')} 
      WHERE ${whereConditions.join(' AND ')}
      RETURNING *
    `;

    return { query, params };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }
}

// Create singleton instance
const database = new PostgresDatabase();

module.exports = database;
