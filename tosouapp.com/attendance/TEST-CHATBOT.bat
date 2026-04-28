@echo off
REM Start server for testing chatbot page

cd /d c:\tosouapp.com\attendance

echo.
echo ========================================
echo Starting Server for Chatbot Testing
echo ========================================
echo.
echo URL: http://localhost:3000/ui/chatbot
echo.

npm start

pause
