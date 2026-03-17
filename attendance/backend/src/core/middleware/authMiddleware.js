const jwt = require('jsonwebtoken');
const userRepo = require('../../modules/users/user.repository');
// Middleware xác thực và phân quyền dựa trên JWT

// Xác thực token
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
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
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
  try {
    const user = await userRepo.getUserById(decoded.id);
    const dbVersion = user?.token_version || 1;
    const tokenVersion = decoded?.v || 1;
    if (!user || dbVersion !== tokenVersion) {
      return res.status(401).json({ message: 'Invalid token version' });
    }
  } catch (e) {
    try { console.error('auth_db_error', e && e.message ? e.message : e); } catch {}
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.user = decoded;
  next();
}


// Phân quyền theo role
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
