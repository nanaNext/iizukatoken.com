# 🏗️ FAQ FIX - ARCHITECTURE DIAGRAM

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER NAVIGATION                              │
│                  http://localhost:3000/admin/faq                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              admin.page.js (Line 723-728)                       │
│           ✅ Route Handler Detection                            │
│                                                                  │
│  if (p2 === '/admin/faq') {                                     │
│    const mod = await loadModule('./faq/faq.page.js');           │
│    await mountModule(mod);                                       │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         faq.page.js (NEW FILE - Entry Point)                   │
│    ✅ Mounts FaqAdminComponent                                  │
│                                                                  │
│  export async function mount() {                                │
│    const component = new FaqAdminComponent(...);                │
│    await component.init();                                       │
│    return cleanupFunction;                                       │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│      faq-admin-component.js (Already Working)                  │
│  ✅ Renders UI, handles interactions                            │
│                                                                  │
│  - Displays list of questions                                   │
│  - Shows user info                                              │
│  - Allows admin to respond                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│      faq.controller.js (Already Working)                       │
│  ✅ Handles API requests                                        │
│                                                                  │
│  - Calls repository methods                                     │
│  - Processes business logic                                     │
│  - Returns JSON responses                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│      faq.repository.js (FIXED - Database Layer)                │
│  ✅ Database query with COALESCE fix                           │
│                                                                  │
│  SELECT                                                         │
│    q.id, q.user_id, q.question, q.detail,                      │
│    q.category, q.status, q.admin_answer,                       │
│    COALESCE(u.username, u.email, 'Unknown') as name,           │
│    u.id as employee_id                                         │
│  FROM faq_user_questions q                                      │
│  LEFT JOIN users u ON q.user_id = u.id                         │
│  ✅ NO MORE "Unknown column 'u.name'" ERROR                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE (MySQL)                              │
│                                                                  │
│  ✅ users table: id, username, email (NO 'name' column)       │
│  ✅ faq_user_questions table: questions with user_id refs     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow with COALESCE Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                User Data from Database                          │
└─────────────────────────────────────────────────────────────────┘

Case 1: User has username
├─ username: 'alice'
├─ email: 'alice@example.com'
└─ COALESCE result: 'alice' ✓

Case 2: User has no username, only email
├─ username: NULL
├─ email: 'bob@example.com'
└─ COALESCE result: 'bob@example.com' ✓

Case 3: User has neither username nor email
├─ username: NULL
├─ email: NULL
└─ COALESCE result: 'Unknown' ✓

┌─────────────────────────────────────────────────────────────────┐
│              Returns to Browser as 'name' field                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
c:\tosouapp.com\attendance\backend\
│
├── src/
│   ├── static/
│   │   ├── js/
│   │   │   └── admin/
│   │   │       ├── admin.page.js               ✅ MODIFIED
│   │   │       │   ├── Route handler added (line 723-728)
│   │   │       │   └── URL mapping added (line 70)
│   │   │       │
│   │   │       └── faq/
│   │   │           ├── faq.page.js             ✅ CREATED (NEW)
│   │   │           │   └── Exports mount() function
│   │   │           │
│   │   │           └── faq-admin-component.js  ✓ Unchanged
│   │   │
│   │   └── html/
│   │       └── admin.html                       ✓ Unchanged
│   │
│   └── modules/
│       └── faq/
│           ├── faq.repository.js               ✅ FIXED
│           │   ├── Database query fixed
│           │   └── Duplicates removed
│           │
│           ├── faq.controller.js               ✓ Unchanged
│           └── faq.routes.js                   ✓ Unchanged
│
└── [documentation files created]
```

---

## State Management

```
┌──────────────────────────┐
│  Window Location Change  │
│  /admin/faq              │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  admin.page.js:                          │
│  toLegacyState() function (Line 70)      │
│  if (p === '/admin/faq')                 │
│    return { tab: 'faq', hash: '' }       │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  State object sent to system             │
│  { tab: 'faq', hash: '' }                │
│                                          │
│  Routes to routeHandler                  │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Route Handler Detects                   │
│  p2 === '/admin/faq'                     │
│                                          │
│  Loads and mounts faq.page.js module     │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  faq.page.js mount() Executes            │
│                                          │
│  1. Setup container                      │
│  2. Instantiate FaqAdminComponent        │
│  3. Call component.init()                │
│  4. Component loads data via API         │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  FAQ Admin Page Displayed                │
│  ✓ Title: "FAQ管理"                      │
│  ✓ Questions list rendered               │
│  ✓ No errors                             │
└──────────────────────────────────────────┘
```

---

## Before vs After

### BEFORE (Broken) ❌

```
User visits: http://localhost:3000/admin/faq
                    ▼
            Route not recognized
                    ▼
            Page not found error
                    ▼
        "ページが見つかりません"
```

### AFTER (Fixed) ✅

```
User visits: http://localhost:3000/admin/faq
                    ▼
        Route handler detects /admin/faq
                    ▼
        Loads faq.page.js module
                    ▼
        Mounts FaqAdminComponent
                    ▼
        Component calls API
                    ▼
        Repository queries database with COALESCE
                    ▼
        Returns questions with user names
                    ▼
    FAQ Admin page displays successfully ✓
```

---

## Critical Query Fix

### The Problem
```sql
-- OLD QUERY (BROKEN):
SELECT u.name FROM users u
       ▲
       └─ ERROR: Column 'name' doesn't exist!

-- Database schema has:
CREATE TABLE users (
  id BIGINT,
  username VARCHAR(255),      ← HERE
  email VARCHAR(255),         ← HERE
  -- NO 'name' column!
)
```

### The Solution
```sql
-- NEW QUERY (FIXED):
SELECT COALESCE(u.username, u.email, 'Unknown') as name FROM users u

-- Fallback logic:
Step 1: Try username
  IF username IS NOT NULL → USE username
  ELSE continue to Step 2
  
Step 2: Try email
  IF email IS NOT NULL → USE email
  ELSE continue to Step 3
  
Step 3: Use default
  USE 'Unknown'

-- Result: ALWAYS returns a value, never NULL
```

---

## Error Resolution Timeline

```
Time: 0:00 - Original Problem
  Error: "Unknown column 'u.name' in 'field list'"
  Cause: Query referenced non-existent column

Time: 0:05 - Root Cause Analysis
  Found: faq.repository.js line ~130
  Found: Column doesn't exist in schema

Time: 0:10 - Fix Applied
  Changed: u.name → COALESCE(u.username, u.email, 'Unknown') as name
  Removed: Duplicate methods

Time: 0:15 - File Verification
  ✓ No syntax errors
  ✓ No duplicates
  ✓ Query correct

Time: NOW - Ready for Testing
  Status: All code changes complete
  Pending: Server restart (manual)
  Next: Browser testing
```

---

## Testing Verification Points

```
┌─────────────────┬──────────┬─────────────────────────────────┐
│ Test Point      │ Status   │ How to Verify                   │
├─────────────────┼──────────┼─────────────────────────────────┤
│ Page Loads      │ F12 > .. │ No 404 error, no red errors     │
│ Questions Show  │ Visual   │ See list of questions           │
│ Names Display   │ Visual   │ User names shown (not empty)    │
│ No DB Error     │ Console  │ No "Unknown column" message    │
│ Component Init  │ Console  │ See "🎯 Mounting FAQ Admin..." │
│ Query Works     │ Console  │ See "✅ Query result: X q..."  │
└─────────────────┴──────────┴─────────────────────────────────┘
```

---

**This architecture ensures:** ✅ Proper routing  
✅ Component loading  
✅ Correct database queries  
✅ No duplicate code  
✅ Fallback values for missing data
