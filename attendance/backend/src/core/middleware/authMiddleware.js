const jwt = require('jsonwebtoken');
const userRepo = require('../../modules/users/user.repository');
// Middleware xác thực và phân quyền dựa trên JWT

const lastActiveTouch = new Map();
const touchMinMs = Math.max(5_000, Number.parseInt(process.env.LAST_ACTIVE_TOUCH_MIN_MS || '60000', 10) || 60_000);
const normalizeRole = (v) => {
  const r = String(v || '').trim().toLowerCase();
  if (r === 'admin' || r === 'manager' || r === 'employee' || r === 'payroll') return r;
  if (r === '管理者' || r === 'administrator' || r === 'quanly' || r === 'quản lý') return 'admin';
  if (r === 'マネージャー' || r === 'supervisor' || r === 'lead') return 'manager';
  if (r === '従業員' || r === 'nhanvien' || r === 'nhân viên' || r === 'staff') return 'employee';
  return r;
};

function nextUrl(req) {
  try {
    return String(req.originalUrl || req.url || '/');
  } catch {
    return '/';
  }
}

function redirectToLogin(req, res) {
  const next = nextUrl(req);
  const target = '/ui/login' + (next ? ('?next=' + encodeURIComponent(next)) : '');
  return res.redirect(302, target);
}

async function authenticateToken(token) {
  const secrets = [
    process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET,
    process.env.JWT_SECRET_PREVIOUS || ''
  ].filter(Boolean);
  let decoded = null;
  for (const s of secrets) {
    try {
      decoded = jwt.verify(token, s);
      break;
    } catch {}
  }
  if (!decoded) {
    const err = new Error('Invalid or expired token');
    err.status = 403;
    throw err;
  }
  const user = await userRepo.getUserById(decoded.id);
  const dbVersion = user?.token_version || 1;
  const tokenVersion = decoded?.v || 1;
  if (!user || dbVersion !== tokenVersion) {
    const err = new Error('Invalid token version');
    err.status = 401;
    throw err;
  }
  return {
    id: user.id,
    role: normalizeRole(user.role || decoded.role),
    v: dbVersion,
    email: user.email,
    username: user.username
  };
}

async function attachUserActivity(req, fallbackDecoded) {
  try {
    const uid = String(req.user?.id || fallbackDecoded?.id || '');
    const now = Date.now();
    const prev = lastActiveTouch.get(uid) || 0;
    if (uid && (now - prev) >= touchMinMs) {
      lastActiveTouch.set(uid, now);
      void userRepo.touchLastActive(uid).catch(() => {});
    }
  } catch {}
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = req.cookies?.session_token || '';
  }
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    req.user = await authenticateToken(token);
  } catch (e) {
    try { console.error('auth_db_error', e && e.message ? e.message : e); } catch {}
    return res.status(Number(e?.status || 401)).json({ message: e?.message || 'Unauthorized' });
  }
  await attachUserActivity(req, req.user);
  next();
}

async function authenticateFromCookie(req, res, next) {
  const token = req.cookies?.session_token;
  if (!token) {
    return redirectToLogin(req, res);
  }
  try {
    req.user = await authenticateToken(token);
  } catch {
    return redirectToLogin(req, res);
  }
  await attachUserActivity(req, req.user);
  next();
}


// Phân quyền theo role
function authorize(...allowedRoles) {
    const allowed = new Set((allowedRoles || []).map(r => normalizeRole(r)));
    return (req, res, next) => {
        const role = normalizeRole(req.user?.role);
        const ok = role && (allowed.has(role) || (role === 'manager' && allowed.has('admin')));
        if (!ok) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }
        next();
    };
}

module.exports = { authenticate, authenticateFromCookie, authorize };
