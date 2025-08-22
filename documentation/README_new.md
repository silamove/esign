# PDF Signature App - Full Stack Application

A modern, full-stack PDF signing application built with Node.js/Express backend and React frontend. This application allows users to upload PDF documents, add various field types (signatures, text, dates, checkboxes), and download the completed documents.

## 🚀 Features

### Authentication & User Management
- JWT-based authentication
- User registration and login
- Password management
- User profiles and settings
- Role-based access control

### Document Management
- PDF upload with validation (up to 50MB)
- Multi-page PDF support
- Document metadata tracking
- Document sharing capabilities
- Audit logging for all actions

### PDF Editing Tools
- **Signature Fields**: Draw and place digital signatures
- **Initial Fields**: Add initials to documents
- **Text Fields**: Add custom text with font size and color options
- **Date Fields**: Add current date or custom dates
- **Checkbox Fields**: Add checkable elements

### Advanced Features
- Drag and drop field placement
- Real-time preview of field positions
- Resizable and deletable fields
- Multiple signature templates per user
- Responsive design for mobile and desktop
- Secure file handling and storage

## 🏗️ Tech Stack

### Backend
- **Node.js** with Express.js framework
- **SQLite** database with proper schema design
- **PDF-lib** for PDF manipulation
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Multer** for file uploads
- **Helmet** for security headers
- **Express Rate Limit** for API protection

### Frontend
- **React 18** with modern hooks
- **React Router** for navigation
- **Axios** for API communication
- **Tailwind CSS** for styling
- **React PDF** for PDF rendering
- **React Hook Form** for form management
- **React Hot Toast** for notifications
- **Lucide React** for icons

## 📁 Project Structure

```
pdf-signature-app/
├── backend/                 # Express.js API server
│   ├── controllers/         # Business logic
│   ├── middleware/          # Authentication & error handling
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   └── server.js           # Main server file
├── frontend/               # React application
│   ├── public/             # Static assets
│   └── src/
│       ├── components/     # React components
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API services
│       └── utils/          # Helper functions
├── database/               # SQLite database files
├── uploads/                # User uploaded files
└── .env.example           # Environment variables template
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdf-signature-app
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers**
   ```bash
   # Start both backend and frontend in development mode
   npm run dev
   
   # Or start them separately:
   npm run dev:backend    # Backend on http://localhost:3001
   npm run dev:frontend   # Frontend on http://localhost:3000
   ```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./database/signature_app.db

# File Upload
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=application/pdf
```

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start both backend and frontend
npm run dev:backend      # Start only backend server
npm run dev:frontend     # Start only frontend development server

# Production
npm run build           # Build frontend for production
npm start               # Start production server

# Utilities
npm run install:all     # Install dependencies for both backend and frontend
npm test                # Run tests
npm run lint            # Run ESLint on codebase
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request

### Documents
- `GET /api/documents` - Get user's documents
- `POST /api/documents/upload` - Upload new PDF
- `GET /api/documents/:uuid` - Get document details
- `GET /api/documents/:uuid/file` - Download original PDF
- `POST /api/documents/:uuid/fields` - Add field to document
- `DELETE /api/documents/:uuid/fields/:fieldId` - Remove field
- `POST /api/documents/:uuid/download` - Download signed PDF

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/password` - Change password
- `GET /api/users/signatures` - Get user's saved signatures

### Signatures
- `GET /api/signatures` - Get user's signature templates
- `POST /api/signatures` - Create new signature template
- `PUT /api/signatures/:id` - Update signature template
- `DELETE /api/signatures/:id` - Delete signature template

## 🗄️ Database Schema

The application uses SQLite with the following main tables:

- **users** - User accounts and authentication
- **documents** - PDF documents and metadata
- **document_fields** - Fields added to documents
- **signatures** - Reusable signature templates
- **document_shares** - Document sharing permissions
- **audit_logs** - Action tracking and audit trail

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt (12 rounds)
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- SQL injection prevention
- File type validation for uploads
- Secure file serving
- Audit logging for all actions

## 🚀 Deployment

### Production Build

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Set production environment**
   ```bash
   export NODE_ENV=production
   ```

3. **Start the production server**
   ```bash
   npm start
   ```

### Environment Setup for Production

- Set `NODE_ENV=production`
- Configure a strong `JWT_SECRET`
- Set up proper CORS origins
- Configure file upload limits
- Set up database backups
- Configure logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed description
3. Provide error logs and environment details

## 🔄 Changelog

### Version 1.0.0
- Initial release with full-stack architecture
- User authentication and management
- PDF upload and field management
- Signature, text, date, and checkbox fields
- Document sharing and audit logging
- Responsive React frontend
- Comprehensive API with security features
