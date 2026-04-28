@echo off
REM Run SQL to fix FAQ table schema

echo.
echo ========================================
echo Fixing FAQ Table Schema
echo ========================================
echo.
echo This will:
echo  1. Drop old faq_user_questions table
echo  2. Create new table with correct schema
echo.

cd /d c:\tosouapp.com\attendance\backend

mysql -h localhost -u root -p1234567 attendance_db < fix-faq-schema.sql

echo.
echo ========================================
echo FAQ table fixed!
echo ========================================
echo.
echo Next: Restart the server
echo.
pause
