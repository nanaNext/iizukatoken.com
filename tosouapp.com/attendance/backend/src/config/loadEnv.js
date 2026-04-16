const fs = require('fs');
const path = require('path');
function tryLoad(p, override) {
  if (!fs.existsSync(p)) return false;
  try { require('dotenv').config({ path: p, override: !!override }); } catch {}
  return true;
}
const appEnv = String(process.env.APP_ENV || '').trim();
const nodeEnv = String(process.env.NODE_ENV || '').trim();
const bases = [
  path.join(__dirname, '../'),
  path.join(__dirname, '../../'),
  process.cwd()
];
const files = ['.env'];
if (nodeEnv) files.push(`.env.${nodeEnv}`);
if (appEnv) files.push(`.env.${appEnv}`);
files.push('.env.local');
const seen = new Set();
let loadedAppEnvFile = false;
for (const base of bases) {
  for (const f of files) {
    const p = path.join(base, f);
    if (seen.has(p)) continue;
    seen.add(p);
    const loaded = (f === '.env') ? tryLoad(p, false) : tryLoad(p, true);
    if (loaded && appEnv && f === `.env.${appEnv}`) loadedAppEnvFile = true;
  }
}
try {
  if (appEnv && !loadedAppEnvFile) {
    console.warn(`[env] APP_ENV=${appEnv} but .env.${appEnv} not found; falling back to .env`);
  }
} catch {}
module.exports = {};
