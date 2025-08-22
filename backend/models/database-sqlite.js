// Import the appropriate database based on environment
const databaseType = process.env.DATABASE_TYPE || 'sqlite';

let database;

if (databaseType === 'postgresql') {
  database = require('./database-postgres');
} else {
  // Keep the existing SQLite database class as fallback
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs').promises();

  class Database {
    constructor() {
      this.db = null;
      this.dbPath = path.join(__dirname, '../../database/signature_app.db');
    }

    // ... existing SQLite methods ...
  }

  database = new Database();
}

module.exports = database;

  async initialize() {
    // Ensure database directory exists
    const dbDir = path.dirname(this.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          // Enable foreign keys
          this.db.run('PRAGMA foreign_keys = ON');
          this.runMigrations().then(resolve).catch(reject);
        }
      });
    });
  }

  async runMigrations() {
    // Create migrations table if it doesn't exist
    await this.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    try {
      const migrationFiles = await fs.readdir(migrationsDir);
      const sqlFiles = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort((a, b) => {
          // Extract version numbers from filenames like 001_initial.sql
          const aVersion = parseInt(a.split('_')[0]);
          const bVersion = parseInt(b.split('_')[0]);
          return aVersion - bVersion;
        });

      // Get executed migrations
      const executedMigrations = await this.all('SELECT name FROM migrations ORDER BY version');
      const executedNames = executedMigrations.map(m => m.name);

      // Run pending migrations
      for (const sqlFile of sqlFiles) {
        const migrationName = sqlFile.replace('.sql', '');
        const version = parseInt(sqlFile.split('_')[0]);
        
        if (!executedNames.includes(migrationName)) {
          console.log(`Running migration ${version}: ${migrationName}`);
          
          const migrationPath = path.join(migrationsDir, sqlFile);
          const migrationSql = await fs.readFile(migrationPath, 'utf8');
          
          // Parse SQL statements properly, handling multi-line statements
          let statements = [];
          let currentStatement = '';
          let inTrigger = false;
          
          const lines = migrationSql.split('\n');
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('--')) {
              continue;
            }
            
            currentStatement += line + '\n';
            
            // Check if we're starting a trigger
            if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
              inTrigger = true;
            }
            
            // Check for statement end
            if (trimmedLine.endsWith(';')) {
              if (inTrigger && trimmedLine.toUpperCase().includes('END;')) {
                // End of trigger
                inTrigger = false;
                statements.push(currentStatement.trim());
                currentStatement = '';
              } else if (!inTrigger) {
                // Regular statement
                statements.push(currentStatement.trim());
                currentStatement = '';
              }
            }
          }
          
          // Add any remaining statement
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
          }

          // Run each statement in a transaction
          await this.transaction(async () => {
            for (const statement of statements) {
              try {
                if (statement.trim()) {
                  await this.run(statement);
                }
              } catch (err) {
                console.error(`Migration error: ${err}`);
                console.error(`Query: ${statement}`);
                console.error(`Params: []`);
                
                // Skip errors for duplicate columns/indexes but log them
                if (err.message.includes('duplicate column') || 
                    err.message.includes('already exists') ||
                    err.message.includes('UNIQUE constraint failed') ||
                    err.message.includes('no such column')) {
                  console.log(`Skipping error: ${err.message}`);
                } else {
                  throw err;
                }
              }
            }
          });

          await this.run(
            'INSERT INTO migrations (version, name) VALUES (?, ?)',
            [version, migrationName]
          );
          console.log(`Migration ${version} completed`);
        }
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No migrations directory found, running initial schema only');
        await this.createInitialTables();
        await this.run(
          'INSERT INTO migrations (version, name) VALUES (?, ?)',
          [1, 'initial_schema']
        );
      } else {
        throw err;
      }
    }
  }

  async createInitialTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Documents table
      `CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_size INTEGER NOT NULL CHECK (file_size > 0),
        mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
        total_pages INTEGER DEFAULT 1 CHECK (total_pages > 0),
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // Signatures table
      `CREATE TABLE IF NOT EXISTS signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        signature_data TEXT NOT NULL,
        type TEXT DEFAULT 'signature' CHECK (type IN ('signature', 'initials')),
        is_default BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // Document fields table
      `CREATE TABLE IF NOT EXISTS document_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initials', 'text', 'date', 'checkbox')),
        field_data TEXT NOT NULL,
        x REAL NOT NULL CHECK (x >= 0),
        y REAL NOT NULL CHECK (y >= 0),
        width REAL NOT NULL CHECK (width > 0),
        height REAL NOT NULL CHECK (height > 0),
        page INTEGER NOT NULL CHECK (page >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
      )`,

      // Document sharing table
      `CREATE TABLE IF NOT EXISTS document_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        shared_by INTEGER NOT NULL,
        shared_with TEXT NOT NULL,
        permissions TEXT DEFAULT 'view' CHECK (permissions IN ('view', 'edit', 'sign')),
        expires_at DATETIME,
        access_token TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users (id) ON DELETE CASCADE
      )`,

      // Audit log table
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        document_id INTEGER,
        action TEXT NOT NULL,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid)',
      'CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)',
      'CREATE INDEX IF NOT EXISTS idx_document_fields_document_id ON document_fields(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_document_fields_type ON document_fields(field_type)',
      'CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(access_token)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
      'CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON signatures(user_id)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    // Create triggers for updated_at timestamps
    const triggers = [
      `CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
       AFTER UPDATE ON users 
       BEGIN 
         UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      `CREATE TRIGGER IF NOT EXISTS update_documents_timestamp 
       AFTER UPDATE ON documents 
       BEGIN 
         UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
       
      `CREATE TRIGGER IF NOT EXISTS update_signatures_timestamp 
       AFTER UPDATE ON signatures 
       BEGIN 
         UPDATE signatures SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`
    ];

    for (const trigger of triggers) {
      await this.run(trigger);
    }

    console.log('Database schema created successfully');
  }

  // Enhanced prepared statement methods with better error handling
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          console.error('Database error:', err.message);
          console.error('Query:', query);
          console.error('Params:', params);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('Database error:', err.message);
          console.error('Query:', query);
          console.error('Params:', params);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err.message);
          console.error('Query:', query);
          console.error('Params:', params);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Transaction support
  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  // Query builder helpers
  buildSelectQuery(table, options = {}) {
    const { select = '*', where = {}, orderBy, limit, offset } = options;
    
    let query = `SELECT ${Array.isArray(select) ? select.join(', ') : select} FROM ${table}`;
    const params = [];
    
    // WHERE clause
    const whereConditions = Object.keys(where);
    if (whereConditions.length > 0) {
      const conditions = whereConditions.map(key => `${key} = ?`).join(' AND ');
      query += ` WHERE ${conditions}`;
      params.push(...Object.values(where));
    }
    
    // ORDER BY clause
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    // LIMIT and OFFSET
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
      
      if (offset) {
        query += ` OFFSET ?`;
        params.push(offset);
      }
    }
    
    return { query, params };
  }

  buildInsertQuery(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const params = Object.values(data);
    
    return { query, params };
  }

  buildUpdateQuery(table, data, where) {
    const dataColumns = Object.keys(data);
    const whereColumns = Object.keys(where);
    
    const setClause = dataColumns.map(key => `${key} = ?`).join(', ');
    const whereClause = whereColumns.map(key => `${key} = ?`).join(' AND ');
    
    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    
    return { query, params };
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;
