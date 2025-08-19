# PDF Signature App - Development Setup Script (PowerShell)

Write-Host "🚀 PDF Signature App - Setting up development environment..." -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js v18 or higher." -ForegroundColor Red
    exit 1
}

# Check Node.js version
$nodeVersionNumber = [int]($nodeVersion.Substring(1).Split('.')[0])
if ($nodeVersionNumber -lt 18) {
    Write-Host "❌ Node.js version must be 18 or higher. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Install backend dependencies
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend dependencies installed" -ForegroundColor Green

# Install frontend dependencies
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green

# Check if .env file exists
if (!(Test-Path .env)) {
    Write-Host "⚙️ Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env file created. Please edit it with your configuration." -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path database | Out-Null
New-Item -ItemType Directory -Force -Path uploads | Out-Null

Write-Host "✅ Directories created" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Setup complete! You can now start the application:" -ForegroundColor Green
Write-Host ""
Write-Host "For development (both backend and frontend):" -ForegroundColor Yellow
Write-Host "  npm run dev"
Write-Host ""
Write-Host "For backend only:" -ForegroundColor Yellow
Write-Host "  npm run dev:backend"
Write-Host ""
Write-Host "For frontend only:" -ForegroundColor Yellow
Write-Host "  npm run dev:frontend"
Write-Host ""
Write-Host "Backend will run on: http://localhost:3001" -ForegroundColor Yellow
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green
