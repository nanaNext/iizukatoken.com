# 🔧 FIX DATABASE COLUMN ERROR

## ❌ Problem
Khi nhấn vào "FAQ管理", hiển thị:
```
Failed to load questions: Unknown column 'uname' in 'field list'
```

## ✅ Cause
Bảng `users` trong database không có column `name`, nó chỉ có `username` hoặc `email`

## ✅ Solution Applied
Đã sửa file `faq.repository.js`:
- Đổi từ: `u.name`
- Thành: `COALESCE(u.username, u.email, 'Unknown') as name`

Cách này sẽ lấy:
1. `username` nếu có
2. `email` nếu không có username
3. 'Unknown' nếu không có cả hai

## 🚀 How to Apply Fix

### Option 1: Tự động (Recommended)
1. Mở PowerShell
2. Chạy lệnh:
```powershell
cd "c:\tosouapp.com\attendance\backend"
npm start
```

### Option 2: Qua File Batch
Double-click file này:
```
c:\tosouapp.com\attendance\backend\start-server-keep-open.bat
```

### Option 3: Thủ công
1. Mở Terminal/PowerShell
2. Chạy:
```powershell
cd c:\tosouapp.com\attendance\backend
npm start
```

## 📋 Verification Steps

Sau khi server khởi động:

1. **Mở browser**: http://localhost:3000/admin/faq
   (hoặc http://localhost:8080/admin/faq nếu dùng cổng khác)

2. **Login nếu cần** - Dùng tài khoản admin

3. **Kiểm tra**:
   - ✅ Trang FAQ admin load không có lỗi
   - ✅ Thấy danh sách câu hỏi
   - ✅ Không thấy error "Unknown column"

## 📊 Console Logs Expected

Bạn sẽ thấy trong console:
```
🎯 Mounting FAQ Admin Page
📥 Loading admin questions...
Response status: 200
✅ Loaded X questions
```

## ⚠️ If Still Getting Error

1. **Kiểm tra port**: Server có thể chạy ở port khác
   ```powershell
   netstat -ano | findstr "LISTENING"
   ```

2. **Kill process cũ**:
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

3. **Restart server**:
   ```powershell
   npm start
   ```

## ✨ Success!

Khi tất cả hoạt động:
- Admin FAQ page sẽ load bình thường
- Hiển thị FAQ stats, tabs, questions
- Có thể trả lời câu hỏi
- Không lỗi database

---

**File sửa**: `src/modules/faq/faq.repository.js` (line 130)
**Status**: ✅ Ready to deploy
