@echo off
REM Restart FAQ Server
cd /d c:\tosouapp.com\attendance\backend
echo.
echo ======================================
echo Restarting Node.js Server...
echo ======================================
echo.

REM Kill any existing node process on port 3000 or 8080
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Killing process %%a on port 3000
    taskkill /PID %%a /F
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080" ^| find "LISTENING"') do (
    echo Killing process %%a on port 8080
    taskkill /PID %%a /F
)

REM Wait a bit
timeout /t 2 /nobreak

REM Start server
echo.
echo Starting server...
npm start

pause
