const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const userRoutes = require('./routes/users');
const signatureRoutes = require('./routes/signatures');
const legalSignatureRoutes = require('./routes/legalSignatures');
const analyticsRoutes = require('./routes/analytics');
const envelopeRoutes = require('./routes/envelopes');
const templateRoutes = require('./routes/templates');
const emailRoutes = require('./routes/email');
const securityRoutes = require('./routes/security');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Import database
const db = require('./models/database');

const app = express();
const PORT = process.env.PORT || 4000;

// Run database migrations
const fs = require('fs');
const runMigrations = async () => {
  try {
    const migrationsDir = path.join(__dirname, 'models', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log(`Running migration: ${file}`);
        
        // Split SQL into individual statements and execute them
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0);
        
        for (const statement of statements) {
          if (statement.trim()) {
            await db.run(statement);
          }
        }
        
        console.log(`✓ Migration completed: ${file}`);
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://unpkg.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:", "https://unpkg.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Much more lenient in development
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // More lenient in development
  message: 'Too many authentication attempts, please try again later.',
});

// Basic middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);

// Public document view route (no auth required)
const documentController = require('./controllers/documentController');
app.get('/api/documents/view/:token', async (req, res, next) => {
  await documentController.serveFileWithTempToken(req, res, next);
});

// Protected routes (require authentication)
app.use('/api/documents', authMiddleware, documentRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/signatures', authMiddleware, signatureRoutes);
app.use('/api/signatures', authMiddleware, legalSignatureRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/envelopes', authMiddleware, envelopeRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/security', authMiddleware, securityRoutes);

// Serve frontend for any non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await db.initialize();
    console.log('✅ Database initialized successfully');
    
    // Run migrations after database is initialized
    await runMigrations();
    
    // Initialize email service
    const emailService = require('./services/emailService');
    try {
      await emailService.initialize();
    } catch (error) {
      console.warn('⚠️ Email service initialization failed, continuing without email:', error.message);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📁 Upload directory: ${path.join(__dirname, '../uploads')}`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`🖥️  Frontend served from: ${path.join(__dirname, '../frontend/build')}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

startServer();

module.exports = app;
