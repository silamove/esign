#!/bin/bash

# PDF Signature App - Development Setup Script

echo "🚀 PDF Signature App - Setting up development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js v18 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) is installed${NC}"

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# Install frontend dependencies
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd frontend
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️ Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created. Please edit it with your configuration.${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p database
mkdir -p uploads

echo -e "${GREEN}✅ Directories created${NC}"

echo ""
echo -e "${GREEN}🎉 Setup complete! You can now start the application:${NC}"
echo ""
echo -e "${YELLOW}For development (both backend and frontend):${NC}"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}For backend only:${NC}"
echo "  npm run dev:backend"
echo ""
echo -e "${YELLOW}For frontend only:${NC}"
echo "  npm run dev:frontend"
echo ""
echo -e "${YELLOW}Backend will run on: http://localhost:3001${NC}"
echo -e "${YELLOW}Frontend will run on: http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
