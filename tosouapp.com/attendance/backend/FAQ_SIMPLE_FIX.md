# 🎯 FAQ FIX - SIMPLE 3-STEP GUIDE

## Step 1: Fix the Database (COPY & PASTE)

**Open MySQL Workbench:**
1. Start → MySQL Workbench
2. Double-click your `localhost` connection
3. Click the "+" icon to create NEW QUERY
4. **Copy and paste this entire block:**

```sql
USE attendance_db;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS faq_user_questions;
CREATE TABLE faq_user_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  question VARCHAR(500) NOT NULL,
  detail LONGTEXT NULL,
  category VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '未回答',
  admin_answer LONGTEXT NULL,
  admin_answer_by BIGINT UNSIGNED NULL,
  answered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_created (created_at),
  CONSTRAINT fk_faq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET FOREIGN_KEY_CHECKS=1;
SELECT 'FAQ Table Created Successfully!' as result;
```

5. Press Ctrl+Enter (or click the Lightning Bolt ⚡)
6. ✅ You should see: `FAQ Table Created Successfully!`

---

## Step 2: Restart the Server

**In Command Prompt / PowerShell:**

```bash
cd c:\tosouapp.com\attendance
npm start
```

Wait for this message:
```
✅ Server is running on http://localhost:3000
```

---

## Step 3: Test the Page

1. Open Browser
2. Go to: **http://localhost:3000/admin/faq**
3. You should see:
   - FAQ Management heading
   - Statistics boxes (Total, Unanswered, Answered)
   - Tab buttons
   - Question list

---

## ✅ Done!

That's it! The FAQ admin page should now work perfectly.

### If it doesn't work:

**Clear browser cache:**
- Press Ctrl+Shift+Delete
- Select "All time"
- Click "Delete now"
- Reload the page

**Check for errors:**
- Press F12 (Developer Tools)
- Click "Console" tab
- Look for red error messages

---

## Alternative Methods (If MySQL Workbench doesn't work)

### Method 2: Batch File
Double-click: `c:\tosouapp.com\attendance\backend\RUN-FIX.bat`

### Method 3: Command Line
```bash
cd c:\tosouapp.com\attendance\backend
mysql -h localhost -u root -p1234567 attendance_db < fix-faq-table.sql
```

---

## 🎓 What Was Fixed?

- ✅ Route detection for `/admin/faq`
- ✅ Page module loading
- ✅ Database table schema
- ✅ Query logic for correct columns

## ❌ Common Errors & Solutions

| Error | Fix |
|-------|-----|
| "Unknown column 'uname'" | Run the SQL script above |
| "Page not found" | Clear browser cache |
| "Cannot GET /admin/faq" | Restart server (npm start) |
| MySQL not found | Use MySQL Workbench instead |

---

**Questions? Check these files:**
- `FAQ-DATABASE-FIX-GUIDE.md`
- `FAQ_COMPLETE_FIX_STATUS.md`
