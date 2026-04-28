@echo off
REM Complete cleanup and restart
REM This will:
REM 1. Kill all Node processes
REM 2. Clear Node module cache
REM 3. Start fresh server

echo.
echo ========================================
echo FAQ Server - Complete Cleanup & Restart
echo ========================================
echo.

REM Kill all Node processes
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak

REM Clear npm cache (optional)
echo Clearing npm cache...
cd /d c:\tosouapp.com\attendance\backend
call npm cache clean --force 2>nul

REM Start server
echo.
echo Starting fresh server...
echo.
cd /d c:\tosouapp.com\attendance
npm start

pause
