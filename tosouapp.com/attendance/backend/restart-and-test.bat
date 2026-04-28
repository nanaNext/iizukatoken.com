@echo off
REM Stop all Node processes
echo [*] Stopping existing Node processes...
taskkill /IM node.exe /F /T 2>nul
timeout /t 2 /nobreak

REM Start the server
echo [*] Starting server...
cd /d "c:\tosouapp.com\attendance\backend"
npm start

REM Keep window open if there's an error
if %errorlevel% neq 0 (
    echo.
    echo [!] ERROR - Press any key to close
    pause
)
