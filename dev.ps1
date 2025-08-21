# Quick Start Development Script (PowerShell)

Write-Host "🚀 Starting PDF Signature App in development mode..." -ForegroundColor Cyan

# Check if dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Dependencies not found. Running setup..." -ForegroundColor Yellow
    .\setup.ps1
}

if (!(Test-Path "frontend\node_modules")) {
    Write-Host "📦 Frontend dependencies not found. Installing..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

# Start development servers
Write-Host "🌟 Starting development servers..." -ForegroundColor Green
Write-Host "Backend: http://localhost:4000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

npm run dev
