@echo off
REM Direct database fix - drops and recreates faq_user_questions table

echo.
echo ========================================
echo  FAQ DATABASE DIRECT FIX
echo ========================================
echo.
echo [*] This will DROP and RECREATE the faq_user_questions table
echo [*] This WILL delete all FAQ questions
echo.
pause

echo.
echo [*] Running database fix...
cd /d c:\tosouapp.com\attendance\backend
node fix-db-direct.js

if %errorlevel% neq 0 (
    echo.
    echo [!] Fix failed - check error above
    echo [!] Press any key to close
    pause
    exit /b 1
)

echo.
echo [*] Database fixed! Now restart the server:
echo.
echo    npm start
echo.
echo [*] Then visit: http://localhost:3000/admin/faq
echo.
pause
