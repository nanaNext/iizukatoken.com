# FAQ Database Fix Script
# This script fixes the faq_user_questions table schema

Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "FAQ Database Schema Fix" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
if (-not (Test-Path $mysqlPath)) {
    $mysqlPath = "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
}

if (-not (Test-Path $mysqlPath)) {
    Write-Host "❌ MySQL not found at expected locations" -ForegroundColor Red
    Write-Host "Trying to use 'mysql' from PATH..." -ForegroundColor Yellow
    $mysqlPath = "mysql"
}

$sqlFile = "c:\tosouapp.com\attendance\backend\fix-faq-table.sql"

Write-Host "Step 1: Fixing database schema..." -ForegroundColor Yellow
Write-Host "MySQL: $mysqlPath" -ForegroundColor Gray
Write-Host "SQL File: $sqlFile" -ForegroundColor Gray
Write-Host ""

try {
    # Run the SQL script
    & $mysqlPath -h localhost -u root -p1234567 attendance_db < $sqlFile 2>&1 | ForEach-Object {
        Write-Host $_
    }
    
    Write-Host ""
    Write-Host "✅ Database fix completed!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try manually running this command:" -ForegroundColor Yellow
    Write-Host "$mysqlPath -h localhost -u root -p1234567 attendance_db < $sqlFile" -ForegroundColor Gray
}

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "1. Restart the server: npm start" -ForegroundColor White
Write-Host "2. Visit: http://localhost:3000/admin/faq" -ForegroundColor White
Write-Host "3. The FAQ page should now load without errors" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
