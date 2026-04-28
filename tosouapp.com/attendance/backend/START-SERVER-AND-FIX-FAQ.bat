@echo off
REM Restart server and fix FAQ schema automatically

echo.
echo ========================================
echo  FAQ SYSTEM - SERVER RESTART & FIX
echo ========================================
echo.

echo [*] Stopping any existing Node processes...
taskkill /IM node.exe /F /T 2>nul
timeout /t 2 /nobreak

echo.
echo [*] Starting server from c:\tosouapp.com...
cd /d c:\tosouapp.com

echo.
echo [*] Running: npm start
echo [*] Wait for: "Server listening on port 3000"
echo [*] Then visit: http://localhost:3000/admin/faq
echo.

npm start

REM Keep window open if error
if %errorlevel% neq 0 (
    echo.
    echo [!] ERROR - Check logs above
    echo [!] Press any key to close
    pause
)
