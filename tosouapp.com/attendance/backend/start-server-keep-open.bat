@echo off
REM Start FAQ Server and Keep Window Open
cd /d "c:\tosouapp.com\attendance\backend"

echo.
echo ======================================
echo Starting Node.js FAQ Server...
echo ======================================
echo.

REM Start server
npm start

pause
