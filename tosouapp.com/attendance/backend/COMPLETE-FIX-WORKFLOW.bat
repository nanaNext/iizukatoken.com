@echo off
REM ===========================================
REM COMPLETE FAQ FIX WORKFLOW
REM ===========================================

echo.
echo ╔════════════════════════════════════════════╗
echo ║  FAQ SYSTEM - COMPLETE FIX WORKFLOW         ║
echo ║  Giải Quyết "Unknown column 'uname'" Error ║
echo ╚════════════════════════════════════════════╝
echo.

REM Step 1: Fix Database
echo [1/3] Fixing database schema...
echo ────────────────────────────────
cd /d c:\tosouapp.com\attendance\backend
node fix-db-direct.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ Database fix failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Database fixed!
echo.

REM Step 2: Kill old server
echo [2/3] Stopping old server process...
echo ────────────────────────────────
taskkill /IM node.exe /F /T 2>nul
timeout /t 2 /nobreak

echo ✅ Done!
echo.

REM Step 3: Start new server
echo [3/3] Starting fresh server...
echo ────────────────────────────────
echo.
echo    npm start
echo.
echo    Wait for: "Server listening on port 3000"
echo.

cd /d c:\tosouapp.com
npm start

if %errorlevel% neq 0 (
    echo.
    echo ❌ Server failed to start
    echo.
    pause
)
