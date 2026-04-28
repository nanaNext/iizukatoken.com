# ⚡ FAQ FIX - COPY & PASTE COMMANDS

**Status**: ✅ All code fixes applied - Ready to test

---

## 🚀 Option 1: PowerShell (Recommended)

### Copy this entire block and paste into PowerShell:

```powershell
# Stop all Node processes
Write-Host "🛑 Stopping Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# Navigate to backend folder
Write-Host "📂 Going to backend folder..." -ForegroundColor Yellow
Set-Location "c:\tosouapp.com\attendance\backend"

# Start server
Write-Host "🚀 Starting server..." -ForegroundColor Green
npm start
```

**Expected output**:
```
Server listening on port 3000
✅ FAQ tables initialized successfully
```

---

## 🚀 Option 2: Command Prompt

### Copy this entire block and paste into Command Prompt:

```cmd
@echo off
echo 🛑 Stopping Node processes...
taskkill /IM node.exe /F /T 2>nul
timeout /t 3

echo 📂 Going to backend folder...
cd /d "c:\tosouapp.com\attendance\backend"

echo 🚀 Starting server...
npm start

pause
```

**Expected output**:
```
Server listening on port 3000
✅ FAQ tables initialized successfully
```

---

## 🚀 Option 3: Batch File (One Click)

### Run this file directly:
```
c:\tosouapp.com\attendance\backend\restart-and-test.bat
```

**Or create your own**:
1. Right-click on desktop
2. New → Text Document
3. Paste code from Option 2 above
4. Save as `restart-faq.bat`
5. Double-click to run

---

## ✅ After Server Starts

### 1. Open Browser
```
http://localhost:3000/admin/faq
```

### 2. Clear Cache (if needed)
```
Ctrl + Shift + Delete
```

### 3. Check for Success
✅ Page loads (no "Page not found")  
✅ Title "FAQ管理" appears  
✅ Questions displayed  
✅ No red errors in F12  

---

## 🔍 Verify Server is Running

### Check port 3000 is listening:
```powershell
netstat -ano | findstr :3000
```

### Check Node process exists:
```powershell
Get-Process node
```

### Both should show output if server is running ✓

---

## 🆘 If Server Won't Start

### Kill all Node processes and try again:
```powershell
# Kill all Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait
Start-Sleep -Seconds 5

# Check they're gone
Get-Process node -ErrorAction SilentlyContinue
```

**Should show no output** (meaning no Node processes)

### Then start server:
```powershell
cd c:\tosouapp.com\attendance\backend
npm start
```

---

## 📋 Complete Checklist

### Before Starting
- [ ] All documentation read
- [ ] Terminal ready (PowerShell or Command Prompt)
- [ ] Browser ready

### During Startup
- [ ] Pasted command into terminal
- [ ] Server starting message appears
- [ ] Wait for "Server listening on port 3000"

### After Startup
- [ ] Clear browser cache: `Ctrl+Shift+Delete`
- [ ] Visit: `http://localhost:3000/admin/faq`
- [ ] Check page loads without errors
- [ ] Check F12 console for errors

### Success Verification
- [ ] Page title shows "FAQ管理"
- [ ] Questions are displayed
- [ ] User names visible
- [ ] No red error messages
- [ ] Can scroll through questions

---

## 💡 Pro Tips

### Keep Server Running
While testing, keep the terminal window open. This shows live logs:
- ✅ API requests (GET questions)
- ✅ Database queries
- ✅ Any error messages
- ✅ Important: Look for "Unknown column" errors

### Monitor Logs in Real-Time
The terminal will show live output while you use the page:
```
GET /admin/faq
✅ Query result: 15 questions found
POST /api/faq/answer
✅ Answer updated
```

### If You See Errors
1. Read the error message carefully
2. Screenshot it
3. Check `README_FAQ_FIX.md` troubleshooting section
4. Try restart again

---

## ⏱️ Time Guide

| Step | Time |
|------|------|
| Kill processes | 5 sec |
| Start server | 3 sec |
| Wait for ready | 2 sec |
| Clear browser cache | 5 sec |
| Load page | 3 sec |
| **Total** | **~20 sec** |

---

## 🔄 Restart Multiple Times?

No problem! You can restart server as many times as needed:

1. In terminal: `Ctrl + C` (stops server)
2. Run: `npm start` again
3. Repeat

Each restart loads fresh code from disk.

---

## 📝 Save These Commands

### For future reference, save these URLs:
```
Testing: http://localhost:3000/admin/faq
API: http://localhost:3000/api/faq/questions
```

### For future restarts:
```powershell
# Quick restart (copy this)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; 
Start-Sleep -Seconds 2; 
cd c:\tosouapp.com\attendance\backend; 
npm start
```

---

## ✨ Ready?

### Copy and paste one of the commands above, then:

1. ✅ Wait for "Server listening on port 3000"
2. ✅ Open browser to `http://localhost:3000/admin/faq`
3. ✅ Verify it works!

---

**Status**: ✅ Code fixes complete  
**Next**: Copy a command from above and run it  
**Expected**: FAQ page works perfectly  
**Time needed**: ~20 seconds
