@echo off
REM Fix FAQ Database Schema
REM This script will:
REM 1. Drop the old faq_user_questions table
REM 2. Create a new one with the correct schema
REM 3. Verify the fix

echo.
echo ============================================
echo FAQ Database Schema Fix
echo ============================================
echo.

cd /d c:\tosouapp.com\attendance\backend

echo Running SQL fix script...
echo.

mysql -h localhost -u root -p1234567 attendance_db < fix-faq-table.sql

echo.
echo ============================================
echo Fix Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Restart the server: npm start
echo 2. Visit: http://localhost:3000/admin/faq
echo 3. The FAQ page should now load without errors
echo.
pause
