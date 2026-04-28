@echo off
REM Start server for FAQ chatbot fix
cd /d c:\tosouapp.com\attendance
echo.
echo ========================================
echo Starting Server - FAQ moved to Chatbot
echo ========================================
echo.
echo New URL: http://localhost:3000/admin/chatbot/faq
echo.
npm start
