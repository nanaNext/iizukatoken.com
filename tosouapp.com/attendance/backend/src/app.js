const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
require('./config/loadEnv');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { cors } = require('./core/middleware/cors');
const cookieParser = require('cookie-parser');
const security = require('./core/middleware/security');

const app = express();
function resolveBuildId() {
  const explicit = String(process.env.BUILD_ID || process.env.APP_BUILD_ID || process.env.GIT_COMMIT || '').trim();
  if (explicit) return explicit;
  try {
    const sha = String(execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim();
    if (sha) return `git-${sha}`;
  } catch {}
  return `runtime-${Date.now()}`;
}
const BUILD_ID = resolveBuildId();
const STARTED_AT = Date.now();
process.env.BUILD_ID = BUILD_ID;
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
app.use(express.json());
app.use(cookieParser());
app.use(cors());
security(app);
app.use((req, res, next) => {
  try {
    const forceDisableCanonical = ['1', 'true', 'yes', 'on'].includes(String(process.env.DISABLE_CANONICAL_HOST || '').toLowerCase());
    if (forceDisableCanonical) return next();
    const enforceCanonical = String(process.env.ENFORCE_CANONICAL_HOST || 'true').toLowerCase() === 'true';
    const inProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!enforceCanonical || !inProd) return next();

    const canonicalHost = String(process.env.CANONICAL_HOST || 'tosouapp.com').trim().toLowerCase();
    if (!canonicalHost) return next();

    const directHostRaw = String(req.headers.host || '').split(',')[0].trim();
    const forwardedHostRaw = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const directHost = directHostRaw.split(':')[0].toLowerCase();
    const forwardedHost = forwardedHostRaw.split(':')[0].toLowerCase();
    // On local development, some tools/extensions may inject x-forwarded-host.
    // Prefer direct Host header when it points to localhost.
    const host = (directHost === 'localhost' || directHost === '127.0.0.1' || directHost === '::1' || directHost.endsWith('.local'))
      ? directHost
      : (forwardedHost || directHost);
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
    if (isLocalHost) return next();
    if (!host || host === canonicalHost) return next();

    // Keep health checks and APIs unaffected.
    if (req.path === '/ping' || req.path === '/healthz' || String(req.path || '').startsWith('/api/')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const target = `https://${canonicalHost}${req.originalUrl || req.url || '/'}`;
    try {
      console.warn(`[canonical] redirect host=${host} direct=${directHost} forwarded=${forwardedHost} enforce=${enforceCanonical} inProd=${inProd} -> ${target}`);
    } catch {}
    return res.redirect(308, target);
  } catch {}
  return next();
});
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Build-Id', BUILD_ID);
  res.setHeader('X-Started-At', String(STARTED_AT));
  res.setHeader('X-Process-Id', String(process.pid));
  next();
});
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    if (ms > 500) {
      try {
        console.warn(JSON.stringify({ level: 'warn', type: 'slow_request', request_id: req.id, method: req.method, path: req.path, duration_ms: Math.round(ms) }));
      } catch {}
    }
  });
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (String(req.path || '').startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    const p = String(req.path || '');
    const accept = String(req.headers.accept || '');
    const wantsHtml = accept.includes('text/html') || accept.includes('*/*');
    const isHtmlRoute = p === '/' || p.startsWith('/admin') || p.startsWith('/ui') || p.endsWith('.html');
    if (req.method === 'GET' && wantsHtml && isHtmlRoute) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
  const cspItems = [
    process.env.CSP_DEFAULT_SRC || "default-src 'self'",
    process.env.CSP_IMG_SRC || "img-src 'self' data:",
    process.env.CSP_STYLE_SRC || "style-src 'self' 'unsafe-inline'",
    process.env.CSP_SCRIPT_SRC || "script-src 'self'",
    process.env.CSP_OBJECT_SRC || "object-src 'none'",
    process.env.CSP_FRAME_ANCESTORS || "frame-ancestors 'self'",
    process.env.CSP_CONNECT_SRC || "connect-src 'self'",
    process.env.CSP_BASE_URI || "base-uri 'self'",
    process.env.CSP_FORM_ACTION || "form-action 'self'",
    process.env.CSP_FRAME_SRC || "frame-src 'self'"
  ];
  const csp = cspItems.join('; ');
  const cspHeader = String(process.env.CSP_REPORT_ONLY || '').toLowerCase() === 'true'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  res.setHeader(cspHeader, csp);
  const isHttps = req.secure || (req.headers['x-forwarded-proto'] || '').includes('https');
  const enableHsts = String(process.env.ENABLE_HSTS || '').toLowerCase() === 'true';
  if (isHttps && enableHsts) {
    res.setHeader('Strict-Transport-Security', process.env.HSTS_VALUE || 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'iizuka.it.com Attendance API',
    version: '1.0.0',
    description: 'API documentation for the Attendance System',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/modules/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
if (process.env.NODE_ENV !== 'production') {
  const devCsp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self'"
  ].join('; ');
  const devCspHeader = String(process.env.CSP_REPORT_ONLY || '').toLowerCase() === 'true'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  app.use('/api-docs', (req, res, next) => { res.setHeader(devCspHeader, devCsp); next(); }, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

const routes = require('./routes');
routes(app);
const uiRoutes = require('./routes/ui.routes');
app.use('/', uiRoutes);
const { authenticate, authorize } = require('./core/middleware/authMiddleware');
app.get('/api/version', (req, res) => {
  res.status(200).json({ buildId: BUILD_ID, startedAt: STARTED_AT, pid: process.pid });
});
app.get('/version', (req, res) => {
  res.status(200).json({ buildId: BUILD_ID, startedAt: STARTED_AT, pid: process.pid });
});
app.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});
// Log mounted routes at startup to verify availability
try {
  const stack = (app._router?.stack || []);
  const list = [];
  for (const layer of stack) {
    if (layer.route) {
      list.push({ path: layer.route.path, methods: Object.keys(layer.route.methods || {}) });
    } else if (layer?.name === 'router' && layer?.handle?.stack) {
      const base = layer?.regexp?.fast_star ? '' : (layer?.regexp?.source || '').replace('^\\', '').replace('\\/?(?=\\/|$)', '');
      for (const l2 of layer.handle.stack) {
        if (l2.route) {
          list.push({ path: (base || '') + l2.route.path, methods: Object.keys(l2.route.methods || {}) });
        }
      }
    }
  }
  console.log(JSON.stringify({ mounted_routes: list }, null, 2));
} catch (e) {
  console.warn('Route listing failed: ' + (e?.message || String(e)));
}
// Block public access to payslips; must use secure endpoints
app.use('/uploads/payslips', (req, res) => {
  res.status(403).json({ message: 'Use secureUrl endpoints to download payslips' });
});
// Backward-compatible resolver for legacy upload filenames (mojibake/encoded names on old records).
app.get('/uploads/:name', (req, res, next) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const raw = String(req.params?.name || '');
    const safeBase = path.basename(raw);
    if (!safeBase) return next();
    const candidates = [safeBase];
    try {
      const d1 = decodeURIComponent(safeBase);
      if (d1 && !candidates.includes(d1)) candidates.push(d1);
      try {
        const d2 = decodeURIComponent(d1);
        if (d2 && !candidates.includes(d2)) candidates.push(d2);
      } catch {}
    } catch {}
    for (const name of candidates) {
      const p = path.join(uploadsDir, name);
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    // Fallback by stable upload prefix: "<timestamp>-<random>-"
    const m = safeBase.match(/^(\d+-\d+-)/);
    if (m) {
      const prefix = m[1];
      const files = fs.readdirSync(uploadsDir);
      const hit = files.find((f) => String(f).startsWith(prefix));
      if (hit) return res.sendFile(path.join(uploadsDir, hit));
    }
  } catch {}
  return next();
});
// Serve other static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } }));
app.use('/static', express.static(path.join(__dirname, 'static'), {
  setHeaders: (res, p) => {
    const ext = String(p || '').toLowerCase();
    const isScriptOrStyle = ext.endsWith('.js') || ext.endsWith('.css');
    const isImageAsset = ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp') || ext.endsWith('.svg') || ext.endsWith('.ico');
    if (isScriptOrStyle) {
      // Avoid stale frontend bundles after hotfix deploys.
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (isImageAsset) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));
app.get('/static/css/base.css', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'css', 'base.css')); });
app.get('/static/js/pages/login.page.js', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'js', 'pages', 'login.page.js')); });
app.get('/static/js/api/auth.api.js', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'js', 'api', 'auth.api.js')); });
app.get('/static/html/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'login.html')); });
app.get('/static/css/login.css', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'css', 'login.css')); });
app.get('/static/js/pages/dashboard.page.js', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'js', 'pages', 'dashboard.page.js')); });
app.get('/static/css/portal.css', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'css', 'portal.css')); });
app.get('/static/js/pages/portal.page.js', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'js', 'pages', 'portal.page.js')); });
app.get('/static/js/pages/portal.debug.js', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'js', 'pages', 'portal.debug.js')); });
app.get('/robots.txt', (req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Sitemap: https://tosouapp.com/sitemap.xml'
    ].join('\n')
  );
});
app.get('/sitemap.xml', (req, res) => {
  const now = new Date().toISOString();
  const urls = [
    'https://tosouapp.com/',
    'https://tosouapp.com/ui/login',
    'https://tosouapp.com/ui/portal'
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => [
      '<url>',
      `<loc>${u}</loc>`,
      `<lastmod>${now}</lastmod>`,
      '<changefreq>daily</changefreq>',
      '<priority>0.8</priority>',
      '</url>'
    ].join('')),
    '</urlset>'
  ].join('');
  res.type('application/xml; charset=utf-8');
  res.send(xml);
});
app.get('/api/metrics', authenticate, authorize('admin'), (req, res) => {
  try {
    const m = require('./core/metrics').snapshot();
    res.status(200).json(m);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const notFound = require('./core/middleware/notFoundHandler');
app.use(notFound);

const errorHandler = require('./core/middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
