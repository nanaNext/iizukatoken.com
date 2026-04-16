module.exports = (app) => {
  const crypto = require('crypto');
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const isBrowserUA = (ua) => {
    const s = String(ua || '').toLowerCase();
    if (!s) return false;
    if (/(postman|insomnia|curl|httpie)/i.test(s)) return false;
    return /(mozilla|applewebkit|chrome|safari|android|iphone|ipad|edg|edge)/i.test(s);
  };
  const isAllowedOrigin = (req, origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    try {
      const u = new URL(origin);
      const host = String(req.headers.host || '').toLowerCase();
      return host && u.host.toLowerCase() === host;
    } catch { return false; }
  };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      const has = req.cookies && req.cookies.csrfToken;
      if (!has) {
        const token = crypto.randomBytes(16).toString('hex');
        try {
          const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
          const isHttps = xfProto.includes('https') || (req.protocol === 'https');
          res.cookie('csrfToken', token, {
            httpOnly: false,
            sameSite: 'Lax',
            secure: isHttps,
            path: '/'
          });
        } catch {}
      }
    }
    next();
  });
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const enforceCsrf = String(process.env.ENFORCE_CSRF || '').toLowerCase() === 'true';
      const ua = req.headers['user-agent'] || '';
      const origin = req.headers.origin || '';
      const host = String(req.headers.host || '').toLowerCase();
      const path = String(req.path || '');
      const original = String(req.originalUrl || req.url || '');
      if (path.includes('/api/auth/login') || original.includes('/api/auth/login')) {
        return next();
      }
      const skipCsrf =
        path.startsWith('/api/auth') ||
        original.includes('/api/auth/');
      let sameHost = false;
      try {
        const u = new URL(origin || `http://${host}`);
        sameHost = !!(host && u.host.toLowerCase() === host);
      } catch {}
      if (!isBrowserUA(ua) && !sameHost) {
        return res.status(403).json({ message: 'Forbidden: browser user-agent required' });
      }
      if (!isAllowedOrigin(req, origin)) {
        return res.status(403).json({ message: 'Forbidden: invalid origin' });
      }
      if (enforceCsrf && !skipCsrf) {
        const csrfHeader = req.headers['x-csrf-token'];
        const csrfCookie = req.cookies?.csrfToken;
        if (!sameHost) {
          if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
            return res.status(401).json({ message: 'CSRF validation failed' });
          }
        } // same-origin: bỏ qua CSRF check
      }
    }
    next();
  });
};
