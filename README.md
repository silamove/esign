# PDF Signature Application

A modern, secure PDF signing application built with React (Vite) frontend and Node.js/Express backend. Upload PDFs, add signature fields, text fields, and dates, then download professionally signed documents.

![PDF Signature App](https://img.shields.io/badge/Status-Production%20Ready-green)
![Version](https://img.shields.io/badge/Version-1.2.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with secure token handling
- User registration and login system
- Password hashing with bcrypt
- Rate limiting and CORS protection
- Secure file serving with authentication

### 📄 Document Management
- PDF upload with validation (up to 50MB)
- Multi-page PDF support with thumbnail navigation
- Real-time PDF rendering with PDF.js
- Document metadata tracking and audit logs
- Secure file storage and retrieval

### ✍️ Digital Signature Tools
- **Signature Fields**: Interactive signature canvas for drawing digital signatures
- **Text Fields**: Add custom text with real-time editing
- **Date Fields**: Auto-populate current date or custom dates
- **Drag & Drop**: Intuitive field placement and repositioning
- **Resize & Delete**: Full control over field dimensions and removal
- **Signature Library**: Save and reuse signature templates

### 🎨 Modern UI/UX
- Responsive design with Tailwind CSS v4
- Clean, professional interface
- Real-time preview and editing
- Zoom controls and page navigation
- Tool palette for field types
- Hot module reloading for development

## 🏗️ Technology Stack

### Backend
- **Node.js 18+** with Express.js framework
- **SQLite** database with proper schema and migrations
- **PDF-lib** for server-side PDF manipulation
- **JWT** authentication with secure secret management
- **Multer** for file uploads with validation
- **Express Rate Limit** for API protection
- **Helmet** for security headers

### Frontend
- **React 18** with modern hooks and functional components
- **Vite** for fast development and optimized builds
- **React Router v7** for client-side navigation
- **Tailwind CSS v4** for modern styling
- **React PDF** for client-side PDF rendering
- **PDF.js** worker for reliable PDF processing
- **TypeScript** support for type safety
- **Axios** for API communication
- **Tailwind CSS** for styling
- **React PDF** for PDF rendering
- **React Hook Form** for form management
- **React Hot Toast** for notifications
- **Lucide React** for icons

## 📁 Project Structure

```
pdf-signature-workspace/
├── backend/                 # Express.js API server
│   ├── controllers/         # Business logic controllers
│   ├── middleware/          # Auth, error handling, validation
│   ├── models/             # Database models and migrations
│   ├── routes/             # API route definitions
│   ├── seeders/            # Database seeding scripts
│   └── server.js           # Main server entry point
├── frontend-new/           # React + Vite application
│   ├── app/
│   │   ├── components/     # Reusable React components
│   │   ├── routes/         # Page components and routing
│   │   └── app.css         # Global styles
│   ├── public/             # Static assets
│   └── vite.config.ts      # Vite configuration
├── database/               # SQLite database files
├── uploads/                # User uploaded PDF files
├── .env                    # Environment variables
├── .gitignore             # Git ignore rules
├── package.json           # Workspace package manager
└── PACKAGE_STRUCTURE.md   # Development guide
```

## � Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Git** for version control

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/silamove/esign.git
   cd esign
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # .env file is already configured with secure defaults
   # JWT_SECRET and other settings are ready for development
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```
   
   This starts:
   - Backend server: http://localhost:4000
   - Frontend server: http://localhost:3000
   - Hot reload enabled for both

### Default Test Users
The application comes with seeded test users:

- **Admin**: admin@example.com / password123
- **User**: user@example.com / password123  
- **Demo**: demo@example.com / password123

## �️ Development Commands

```bash
# Development
npm run dev              # Start both backend and frontend with hot reload
npm run dev:backend      # Start only backend server (port 4000)
npm run dev:frontend     # Start only frontend dev server (port 3000)

# Database
npm run seed            # Seed database with test users
npm run db:reset        # Reset and re-seed database

# Production
npm run build           # Build frontend for production
npm start               # Start production servers
```

## � Usage Guide

### 1. **Login/Register**
- Navigate to http://localhost:3000
- Login with test credentials or create a new account
- JWT authentication provides secure session management

### 2. **Upload PDF Document**
- Click "Upload PDF" from the dashboard
- Select a PDF file (up to 50MB)
- Document will appear in your document list

### 3. **Add Signature Fields**
- Click "Sign" on any document to open the editor
- Use the tool palette to select field types:
  - **Signature**: Draw digital signatures with mouse/touch
  - **Text**: Add custom text fields
  - **Date**: Insert current date or custom dates
- Click anywhere on the PDF to place fields
- Drag fields to reposition, resize handles to adjust size

### 4. **Manage Signatures**
- Create reusable signature templates
- Access "Signature Manager" from the dashboard
- Save frequently used signatures for quick access

### 5. **Download Signed Document**
- Click "Download" to generate final signed PDF
- All signature fields are permanently embedded
- Original document structure is preserved

## 📝 Document Signing Workflows

### 🎯 Optimal Signing Flow

#### **Scenario 1: Single User Self-Signing**
```
1. Upload Document
   ├── Drag & drop PDF or click upload
   ├── Automatic validation (size, format)
   └── Instant preview generation

2. Prepare Document
   ├── Open document editor
   ├── Navigate multi-page documents
   ├── Zoom and position for accuracy
   └── Review document content

3. Add Signature Fields
   ├── Select signature tool from palette
   ├── Click to place signature fields
   ├── Drag to reposition if needed
   ├── Resize for proper proportions
   └── Preview field placement

4. Create/Select Signature
   ├── Draw new signature with mouse/stylus
   ├── OR select from saved signature library
   ├── Adjust signature size and position
   └── Apply to all signature fields

5. Add Supporting Information
   ├── Add text fields (name, title, company)
   ├── Insert date fields (auto-current or custom)
   ├── Fill any required form fields
   └── Review all entries

6. Finalize & Download
   ├── Preview final document
   ├── Download signed PDF
   ├── Save signature template for reuse
   └── Document automatically saved to library
```

#### **Scenario 2: Multi-Party Sequential Signing**
```
1. Document Initiator Workflow
   ├── Upload document
   ├── Define signing order (Signer 1 → Signer 2 → Signer 3)
   ├── Place signature fields for each party
   ├── Add labels ("CEO Signature", "Witness", "Date")
   ├── Set required vs optional fields
   └── Generate secure signing links

2. First Signer Experience
   ├── Receive secure email with signing link
   ├── One-click access (no account required)
   ├── Review document and their assigned fields
   ├── Complete signature and required fields
   ├── Submit and forward to next signer
   └── Receive confirmation email

3. Subsequent Signers
   ├── Automatic notification when their turn arrives
   ├── View previous signatures (read-only)
   ├── Complete their assigned fields
   ├── Option to add comments or notes
   └── Forward to next party

4. Final Completion
   ├── All parties notified when complete
   ├── Final signed document distributed
   ├── Audit trail with timestamps
   └── Archive in document management system
```

#### **Scenario 3: Bulk Document Signing**
```
1. Template Creation
   ├── Create master template with common fields
   ├── Define variable fields (names, dates, amounts)
   ├── Set up auto-population rules
   └── Save as reusable template

2. Batch Processing
   ├── Upload multiple documents
   ├── Apply template to all documents
   ├── Bulk assign signature fields
   ├── Review and adjust individual documents
   └── Process all signatures simultaneously

3. Signature Application
   ├── Select signature from library
   ├── Apply to all documents at once
   ├── Customize text fields per document
   ├── Batch validation and error checking
   └── Generate all signed documents

4. Distribution
   ├── Bulk download as ZIP file
   ├── Individual document access
   ├── Automated email distribution
   └── Integration with document management
```

### ⚡ Quick Reference: Common Signing Scenarios

#### **Personal Document (2 minutes)**
```bash
Upload PDF → Place signature field → Draw signature → Download
```

#### **Business Contract (5 minutes)**
```bash
Upload → Add multiple signature fields → Add text fields (name, title, date) 
→ Apply signatures → Review → Download
```

#### **Legal Agreement (10 minutes)**
```bash
Upload → Identity verification → Place all required fields → Witness signature 
→ Notarization (if required) → Generate audit trail → Download with certificates
```

#### **Bulk Processing (15 minutes for 10+ documents)**
```bash
Create template → Upload multiple PDFs → Apply template to all 
→ Batch signature application → Review and adjust → Bulk download
```

### 🎯 Signing Flow Optimization Tips

#### **For Document Creators**
- **Pre-plan Field Placement**: Review document before uploading
- **Use Templates**: Create reusable templates for recurring document types
- **Clear Instructions**: Add field labels and instructions for signers
- **Test the Flow**: Complete a test signing before sending to others

#### **For Signers**
- **Use Appropriate Device**: Tablet/stylus for best signature quality
- **Zoom for Precision**: Use zoom controls for accurate field placement
- **Save Signatures**: Create signature library for faster future signing
- **Review Before Finalizing**: Check all fields before downloading

#### **For Organizations**
- **Standardize Templates**: Create consistent signing experiences
- **Train Users**: Provide clear instructions for common workflows
- **Monitor Analytics**: Track completion rates and optimize pain points
- **Integrate Systems**: Connect with existing business workflows
```

## 🔌 API Documentation

### Authentication Endpoints
```
POST /api/auth/login          # User authentication
POST /api/auth/register       # New user registration
```

### Document Management
```
GET  /api/documents           # List user documents
POST /api/documents/upload    # Upload new PDF
GET  /api/documents/:uuid     # Get document metadata
GET  /api/documents/:uuid/file # Download original PDF
POST /api/documents/:uuid/download # Download signed PDF
```

### Signature Fields
```
GET  /api/documents/:uuid/fields     # Get document fields
POST /api/documents/:uuid/fields     # Add new field
PUT  /api/documents/:uuid/fields/:id # Update field
DELETE /api/documents/:uuid/fields/:id # Remove field
```

### Signature Templates
```
GET  /api/signatures          # Get user signature templates
POST /api/signatures          # Create signature template
PUT  /api/signatures/:id      # Update template
DELETE /api/signatures/:id    # Delete template
```

## 🔧 Configuration

### Environment Variables (.env)
```env
# Server Configuration
PORT=4000                     # Backend server port
NODE_ENV=development          # Environment mode

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-change-in-production-please
JWT_EXPIRES_IN=7d            # Token expiration

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./database/signature_app.db

# File Upload
MAX_FILE_SIZE=52428800       # 50MB limit
ALLOWED_FILE_TYPES=application/pdf
```

### Vite Proxy Configuration
The frontend automatically proxies API requests to the backend:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
```

## 🗄️ Database Schema

SQLite database with the following structure:

### Core Tables
- **users** - User accounts, authentication, and profiles
- **documents** - PDF metadata, upload tracking, and ownership
- **document_fields** - Signature fields with positioning and data
- **signatures** - Reusable signature templates per user
- **audit_logs** - Complete action tracking and security logs
- **migrations** - Database version control and schema updates

### Key Features
- Foreign key constraints for data integrity
- Indexed columns for optimal query performance  
- Automatic timestamps for audit trails
- JSON field storage for flexible data structures

## 🔒 Security Implementation

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with 12 rounds
- **Token Expiration**: Configurable expiration times
- **Secure Headers**: Helmet.js for security headers

### API Security
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Controlled cross-origin requests
- **File Validation**: Strict PDF file type checking

### File Security
- **Authenticated Downloads**: JWT required for file access
- **Secure File Paths**: Prevention of path traversal attacks
- **File Size Limits**: 50MB maximum upload size
- **Temporary Tokens**: Secure PDF viewing with expiring tokens

## 🚀 Production Deployment

### Build for Production
```bash
# Build optimized frontend
npm run build

# Set production environment
export NODE_ENV=production

# Start production servers
npm start
```

### Production Checklist
- [ ] Update JWT_SECRET to a strong, unique value
- [ ] Configure FRONTEND_URL for your domain
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure database backups
- [ ] Set up monitoring and logging
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Enable compression and caching

### Recommended Production Settings
```env
NODE_ENV=production
JWT_SECRET=your-extremely-secure-production-secret-key
FRONTEND_URL=https://yourdomain.com
PORT=4000
MAX_FILE_SIZE=52428800
```

## 🐛 Troubleshooting

### Common Issues & Solutions

#### "No PDF loaded" Error
- **Fixed in v1.2.0**: JWT authentication and .env loading issues resolved
- Ensure backend is running on port 4000
- Check that JWT_SECRET is properly loaded in .env file
- Verify PDF.js worker is configured correctly

#### PDF.js Worker Errors
- Application now uses CDN-based worker for reliability
- If issues persist, check network connectivity
- Worker configuration includes local fallback

#### Authentication Issues
- Clear browser localStorage and re-login
- Verify JWT_SECRET is set in .env file
- Check token expiration (default 7 days)

#### File Upload Problems
- Maximum file size: 50MB
- Only PDF files are supported
- Check uploads/ directory permissions

### Development Issues

#### Hot Reload Not Working
```bash
# Restart development servers
npm run dev
```

#### Database Issues
```bash
# Reset and reseed database
npm run db:reset
npm run seed
```

#### Port Conflicts
- Backend: Change PORT in .env file
- Frontend: Vite will automatically use next available port

## 📚 Recent Updates

### Version 1.2.0 (August 2025)
- ✅ **Fixed PDF Loading**: Resolved JWT authentication and .env configuration
- ✅ **Improved PDF.js**: Updated worker configuration for better reliability  
- ✅ **Enhanced Security**: Proper JWT secret management
- ✅ **Better Debugging**: Comprehensive logging for troubleshooting
- ✅ **Monorepo Structure**: Cleaned up package management
- ✅ **Git Tracking**: Unified repository structure

### Version 1.1.0
- Added signature management page
- Implemented reusable signature templates
- Enhanced document editor UI
- Added field positioning and resize controls

### Version 1.0.0
- Initial release with full-stack architecture
- User authentication and JWT security
- PDF upload and signature field management
- React frontend with Tailwind CSS
- Express.js API with SQLite database

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Guidelines
- Follow existing code style and patterns
- Add comments for complex logic
- Update tests for new features
- Update documentation as needed

## 📞 Support & Documentation

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/silamove/esign/issues)
- **Documentation**: See `PACKAGE_STRUCTURE.md` for detailed development guide
- **Code Structure**: Well-documented components and API endpoints

### Reporting Bugs
Please include:
- Browser and version
- Node.js version
- Steps to reproduce
- Error messages and console logs
- Screenshots if applicable

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using React, Node.js, and modern web technologies**
