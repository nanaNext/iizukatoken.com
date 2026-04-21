#!/usr/bin/env node
require('../src/config/loadEnv');

const mysql = require('mysql2/promise');

const fails = [];
const warns = [];
const passes = [];

function get(name) {
  return String(process.env[name] || '').trim();
}

function isTrue(name) {
  return get(name).toLowerCase() === 'true';
}

function isPlaceholder(v) {
  const s = String(v || '').toLowerCase();
  return !s
    || s.includes('change_me')
    || s.includes('change-me')
    || s.includes('example')
    || s.includes('dev-secret')
    || s === '1234567'
    || s === 'password'
    || s === 'secret';
}

function pass(msg) { passes.push(msg); }
function fail(msg) { fails.push(msg); }
function warn(msg) { warns.push(msg); }

function requireNonEmpty(name, label) {
  const v = get(name);
  if (!v) fail(`${label} (${name}) is missing`);
  else pass(`${label} is set`);
  return v;
}

function requireAnyNonEmpty(names, label) {
  for (const name of names) {
    const v = get(name);
    if (v) {
      pass(`${label} is set via ${name}`);
      return v;
    }
  }
  fail(`${label} is missing (${names.join(' or ')})`);
  return '';
}

function requireStrongSecret(name, label) {
  const v = requireNonEmpty(name, label);
  if (!v) return;
  if (isPlaceholder(v) || v.length < 24) fail(`${label} (${name}) is weak/placeholder`);
  else pass(`${label} looks non-placeholder`);
}

async function checkDbConnection() {
  const host = get('DB_HOST');
  const user = get('DB_USER');
  const password = get('DB_PASS') || get('DB_PASSWORD');
  const database = get('DB_NAME');
  const port = Number.parseInt(get('DB_PORT') || '3306', 10);
  if (!host || !user || !database) return;
  try {
    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      connectTimeout: 5000
    });
    await conn.ping();
    await conn.end();
    pass('DB connection ping OK');
  } catch (err) {
    fail(`DB connection failed: ${err.message}`);
  }
}

async function main() {
  const nodeEnv = get('NODE_ENV');
  if (nodeEnv !== 'production') fail(`NODE_ENV must be production (current: ${nodeEnv || 'empty'})`);
  else pass('NODE_ENV=production');

  requireStrongSecret('JWT_SECRET_CURRENT', 'JWT access secret');
  const prev = get('JWT_SECRET_PREVIOUS');
  if (prev && isPlaceholder(prev)) warn('JWT_SECRET_PREVIOUS is set but looks placeholder');
  else if (prev) pass('JWT_SECRET_PREVIOUS is set');
  else warn('JWT_SECRET_PREVIOUS is empty (ok if not rotating)');

  requireNonEmpty('DB_HOST', 'DB host');
  requireNonEmpty('DB_USER', 'DB user');
  const dbPass = requireAnyNonEmpty(['DB_PASS', 'DB_PASSWORD'], 'DB password');
  requireNonEmpty('DB_NAME', 'DB name');
  if (dbPass && isPlaceholder(dbPass)) fail('DB password looks weak/default');

  if (!isTrue('ENFORCE_CSRF')) fail('ENFORCE_CSRF must be true');
  else pass('ENFORCE_CSRF=true');
  if (!isTrue('ENABLE_HSTS')) fail('ENABLE_HSTS must be true');
  else pass('ENABLE_HSTS=true');

  const hops = Number.parseInt(get('TRUST_PROXY_HOPS') || '0', 10);
  if (!Number.isFinite(hops) || hops < 1) fail('TRUST_PROXY_HOPS should be >= 1 behind reverse proxy');
  else pass(`TRUST_PROXY_HOPS=${hops}`);

  if (isTrue('ENABLE_DEBUG_ROUTES')) fail('ENABLE_DEBUG_ROUTES must be false in production');
  else pass('Debug routes are disabled');
  if (isTrue('ENABLE_SUPER_ADMIN_RECOVERY')) fail('ENABLE_SUPER_ADMIN_RECOVERY must be false (enable only for emergency)');
  else pass('Super admin recovery is disabled');

  if (isTrue('ENABLE_WEBAUTHN')) warn('ENABLE_WEBAUTHN=true: ensure passkey UAT done before opening to all users');
  else pass('WebAuthn is disabled by default');

  const origins = get('ALLOWED_ORIGINS');
  if (!origins) warn('ALLOWED_ORIGINS is empty (ok only if same-origin deployment)');
  else pass('ALLOWED_ORIGINS is configured');

  const appBaseUrl = get('APP_BASE_URL');
  if (!appBaseUrl) warn('APP_BASE_URL is empty (password reset link will fallback from request host)');
  else if (!/^https:\/\//i.test(appBaseUrl)) fail('APP_BASE_URL must use https:// in production');
  else pass('APP_BASE_URL uses https');

  await checkDbConnection();

  console.log('=== PRE-FLIGHT PRODUCTION CHECK ===');
  for (const m of passes) console.log(`PASS: ${m}`);
  for (const m of warns) console.log(`WARN: ${m}`);
  for (const m of fails) console.log(`FAIL: ${m}`);
  console.log(`Summary -> PASS:${passes.length} WARN:${warns.length} FAIL:${fails.length}`);

  if (fails.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('preflight_failed', err && err.message ? err.message : err);
  process.exit(1);
});
