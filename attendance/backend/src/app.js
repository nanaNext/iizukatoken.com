const path = require('path');
const crypto = require('crypto');
require('./config/loadEnv');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { cors } = require('./core/middleware/cors');
const cookieParser = require('cookie-parser');
const security = require('./core/middleware/security');

const app = express();
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
app.use(express.json());
app.use(cookieParser());
app.use(cors());
security(app);
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
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
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  const cspItems = [
    process.env.CSP_DEFAULT_SRC || "default-src 'self'",
    process.env.CSP_IMG_SRC || "img-src 'self' data:",
    process.env.CSP_STYLE_SRC || "style-src 'self' 'unsafe-inline'",
    process.env.CSP_SCRIPT_SRC || "script-src 'self'",
    process.env.CSP_OBJECT_SRC || "object-src 'none'",
    process.env.CSP_FRAME_ANCESTORS || "frame-ancestors 'none'",
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
const chatbotRoutes = require('./modules/chatbot/chatbot.routes');
app.use('/api/chatbot', chatbotRoutes);
const chatbotRepo = require('./modules/chatbot/chatbot.repository');
app.get('/api/chatbot/categories', async (req, res) => {
  try {
    await chatbotRepo.init();
    await chatbotRepo.ensureSeedCategories();
    await chatbotRepo.ensureSeedFaqs();
    const rows = await chatbotRepo.getCategories();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get('/api/chatbot/questions', async (req, res) => {
  try {
    const categoryId = parseInt(String(req.query.categoryId || ''), 10);
    if (!categoryId) return res.status(400).json({ message: 'Missing categoryId' });
    const rows = await chatbotRepo.listQuestions(categoryId);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get('/api/chatbot/answer/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const row = await chatbotRepo.getAnswerById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.post('/api/chatbot/search', async (req, res) => {
  try {
    const text = String((req.body?.text ?? req.query?.text) || '').trim();
    if (!text) return res.status(400).json({ message: 'Missing text' });
    const rows = await chatbotRepo.search(text);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.post('/api/chatbot/question', async (req, res) => {
  try {
    const categoryId = req.body?.categoryId ? parseInt(String(req.body.categoryId), 10) : null;
    const question = String((req.body?.question ?? req.query?.question) || '').trim();
    if (!question) return res.status(400).json({ message: 'Missing question' });
    const userId = req.user?.id || null;
    const r = await chatbotRepo.submitQuestion(userId, categoryId, question);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get('/api/chatbot/debug/faqs', async (req, res) => {
  try {
    const [rows] = await require('./core/database/mysql').query('SELECT id, category_id, question, popularity, status FROM chatbot_faq ORDER BY id ASC LIMIT 100');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.post('/api/chatbot/dev/seed', async (req, res) => {
  try {
    await chatbotRepo.init();
    await chatbotRepo.ensureSeedCategories();
    await chatbotRepo.seedFaqsForce();
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});
app.get('/api/chatbot-test', (req, res) => {
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
// Serve other static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } }));
app.use('/static', express.static(path.join(__dirname, 'static'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } }));
app.use('/ui', express.static(path.join(__dirname, 'static', 'html'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } }));
app.use('/', express.static(path.join(__dirname, 'static', 'html'), { setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } }));
app.get('/ui/login', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'login.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'login.html')); });
app.get('/ui-check', (req, res) => {
  const fs = require('fs');
  const file = path.join(__dirname, 'static', 'html', 'login.html');
  res.status(200).json({ exists: fs.existsSync(file), file });
});
app.get('/ui/attendance', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'attendance.html')); });
app.get('/ui/admin', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'admin.html')); });
app.get('/ui/overtime', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'overtime.html')); });
app.get('/ui/salary', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'salary.html')); });
app.get('/ui/chatbot', (req, res) => { res.sendFile(path.join(__dirname, 'static', 'html', 'chatbot.html')); });
app.get('/ui/:page', (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  const file = path.join(__dirname, 'static', 'html', `${page}.html`);
  res.sendFile(file, (err) => {
    if (err) res.status(404).json({ message: 'Not Found', path: req.path });
  });
});
app.get('/api/metrics', (req, res) => {
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
