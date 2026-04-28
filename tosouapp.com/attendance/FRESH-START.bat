@echo off
REM Start server with NODE_ENV=production to avoid any require cache issues

echo.
echo ========================================
echo Starting Server - Fresh Instance
echo ========================================
echo.

REM Kill any existing Node processes
taskkill /F /IM node.exe >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Navigate to attendance folder
cd /d c:\tosouapp.com\attendance

REM Start fresh server
echo Starting npm...
echo.
npm start

pause
