@echo off
REM Final restart script - completely fresh start

echo.
echo ========================================
echo Complete Server Restart
echo ========================================
echo.
echo Step 1: Kill all Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Step 2: Starting server fresh...
echo.

cd /d c:\tosouapp.com\attendance
npm start

echo.
echo Server stopped
pause
