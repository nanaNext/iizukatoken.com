# 🎯 JUST RUN THIS

Copy ONE of these commands and paste into your terminal:

---

## Option 1: PowerShell (Best)
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2; cd c:\tosouapp.com; npm start
```

---

## Option 2: Command Prompt
```cmd
taskkill /IM node.exe /F /T 2>nul & timeout /t 2 & cd /d c:\tosouapp.com & npm start
```

---

## Option 3: Batch File (Easiest - Just Double Click)
```
c:\tosouapp.com\attendance\backend\START-SERVER-AND-FIX-FAQ.bat
```

---

## What to Expect

1. **Old node processes kill** - Takes 2 seconds
2. **Server starts** - Takes 3 seconds
3. **Database auto-fixed** - See: `✅ FAQ table rebuilt with correct schema`
4. **Server ready** - See: `Server listening on port 3000`

---

## Then Test

1. **Clear browser cache**: `Ctrl+Shift+Delete`
2. **Visit**: `http://localhost:3000/admin/faq`
3. **Should see**: FAQ page loads ✅

---

## That's All!

Pick one command above, run it, and done! 🎉
