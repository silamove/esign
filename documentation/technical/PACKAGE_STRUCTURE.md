# PDF Signature App - Clean Package Structure

## 📁 Project Structure

```
c:\workspace\sign\
├── backend/                 # Backend API (Node.js/Express)
│   ├── package.json        # Backend dependencies only
│   ├── node_modules/       # Backend packages
│   └── server.js           # Entry point
├── frontend-new/           # Frontend (React Router v7 + Vite)
│   ├── package.json        # Frontend dependencies only  
│   ├── node_modules/       # Frontend packages
│   └── app/                # React app source
├── package.json            # Root workspace (concurrently only)
├── node_modules/           # Only concurrently & its deps
└── package-lock.json       # Root lock file
```

## 🚀 Development Commands

### From Root Directory

```bash
# Start both backend and frontend in development mode
npm run dev

# Install all dependencies (backend + frontend)
npm run install:all

# Run tests for both projects
npm run test

# Lint both projects  
npm run lint

# Build for production
npm run build
```

### Individual Commands

```bash
# Backend only
npm run dev:backend          # Start backend dev server
npm run start:backend        # Start backend in production mode
npm run install:backend      # Install backend dependencies
npm run test:backend         # Run backend tests
npm run lint:backend         # Lint backend code

# Frontend only  
npm run dev:frontend         # Start frontend dev server
npm run start:frontend       # Start frontend preview server
npm run install:frontend     # Install frontend dependencies
npm run test:frontend        # Run frontend tests
npm run lint:frontend        # Lint frontend code

# Database
npm run seed                 # Seed the database with test users
```

## 📦 Package Management

### ✅ Clean Separation

- **Root**: Only workspace management tools (`concurrently`)
- **Backend**: Only backend dependencies (Express, SQLite, PDF-lib, etc.)
- **Frontend**: Only frontend dependencies (React Router, Vite, Tailwind, etc.)

### 🔧 How It Works

1. **Root package.json** defines workspace scripts that delegate to sub-projects
2. **Each sub-project** manages its own dependencies independently
3. **Concurrently** runs both dev servers simultaneously with `npm run dev`

### 🎯 Benefits

- **Clean separation** of concerns
- **No dependency conflicts** between frontend/backend
- **Independent versioning** for each part
- **Easier maintenance** and debugging
- **Smaller node_modules** per project

## 🌐 Development Servers

- **Frontend**: http://localhost:3000 (React Router v7 + Vite HMR)
- **Backend**: http://localhost:4000 (Express + Nodemon auto-reload)

Both servers support hot reload and will automatically restart when you make changes to the code.

## 🔧 Git Repository Structure

### ✅ Single Repository

- **Root Git**: `c:\workspace\sign\.git` (main project repository)
- **No Sub-repos**: Removed separate `.git` from `frontend-new/`
- **Unified Tracking**: All changes tracked in single repository

### 🚫 Previous Issues Fixed

- ❌ **Dual Git Tracking**: frontend-new had its own `.git` repository
- ❌ **Conflicting .gitignore**: Separate ignore rules causing confusion
- ❌ **Split Commits**: Changes could be committed to wrong repository

### ✅ Clean Solution

- ✅ **Single source of truth**: One git repository for entire project
- ✅ **Unified .gitignore**: Handles backend, frontend, and workspace files
- ✅ **Consistent commits**: All changes committed together
- ✅ **Proper monorepo**: Standard structure for multi-package projects
