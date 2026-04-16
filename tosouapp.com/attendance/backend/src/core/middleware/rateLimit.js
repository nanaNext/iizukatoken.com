const buckets = new Map();
function key(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const ip = String(req.ip || xf || 'unknown');
  const rawPath = String(req.originalUrl || req.baseUrl || req.url || '');
  const path = rawPath.split('?')[0] || '';
  const method = String(req.method || 'GET').toUpperCase();
  return `${method}:${path}:${ip}`;
}
function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    const bucket = buckets.get(k) || [];
    const fresh = bucket.filter(ts => now - ts < windowMs);
    if (fresh.length >= max) {
      try { require('../metrics').inc('rate_limit_hits', 1); } catch {}
      return res.status(429).json({ message: 'Too many requests' });
    }
    fresh.push(now);
    buckets.set(k, fresh);
    next();
  };
}
function rateLimitNamed(name, defaults = {}) {
  const base = 'RATE_' + String(name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const defW = defaults.windowMs != null ? Number(defaults.windowMs) : 60_000;
  const defM = defaults.max != null ? Number(defaults.max) : 10;
  const w = parseInt(process.env[`${base}_WINDOW_MS`] || process.env.RATE_WINDOW_MS || String(defW), 10) || defW;
  const m = parseInt(process.env[`${base}_MAX`] || process.env.RATE_MAX || String(defM), 10) || defM;
  return rateLimit({ windowMs: w, max: m });
}
module.exports = { rateLimit, rateLimitNamed };
