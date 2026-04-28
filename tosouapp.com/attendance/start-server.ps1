#!/usr/bin/env pwsh

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   FAQ Server Startup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to attendance folder
cd c:\tosouapp.com\attendance

Write-Host "Starting Node.js server..." -ForegroundColor Green
Write-Host "Location: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Server will be at: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

# Start npm
npm start

# If npm start exits, show message
Write-Host "`nServer stopped" -ForegroundColor Red
Read-Host "Press Enter to close"
