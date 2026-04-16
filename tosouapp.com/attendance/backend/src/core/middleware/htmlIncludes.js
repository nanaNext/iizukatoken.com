const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const includeRe = /<!--\s*#include\s+file="([^"]+)"\s*-->/g;

const fileCache = new Map();
async function readFileCached(filePath) {
  const p = String(filePath || '');
  const st = await fsp.stat(p);
  const cached = fileCache.get(p);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.content;
  const content = await fsp.readFile(p, 'utf8');
  fileCache.set(p, { mtimeMs: st.mtimeMs, content });
  return content;
}

function readFileCachedSync(filePath) {
  const p = String(filePath || '');
  const st = fs.statSync(p);
  const cached = fileCache.get(p);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.content;
  const content = fs.readFileSync(p, 'utf8');
  fileCache.set(p, { mtimeMs: st.mtimeMs, content });
  return content;
}

function resolveInclude({ baseDir, htmlRoot, rel }) {
  const base = String(baseDir || '');
  const root = String(htmlRoot || '');
  const r = String(rel || '').trim();
  if (!r) return null;
  const resolved = path.resolve(base, r);
  const normResolved = path.normalize(resolved);
  const normRoot = path.normalize(root);
  if (!normResolved.toLowerCase().startsWith(normRoot.toLowerCase() + path.sep) && normResolved.toLowerCase() !== normRoot.toLowerCase()) {
    return null;
  }
  return resolved;
}

async function renderWithIncludes(entryPath, { htmlRoot, maxDepth = 10 } = {}) {
  const root = String(htmlRoot || '');
  const entry = path.resolve(String(entryPath || ''));
  const normEntry = path.normalize(entry);
  const normRoot = path.normalize(root);
  if (!normEntry.toLowerCase().startsWith(normRoot.toLowerCase() + path.sep) && normEntry.toLowerCase() !== normRoot.toLowerCase()) {
    throw new Error('Invalid HTML path');
  }

  const stack = new Set();
  const walk = async (filePath, depth) => {
    if (depth > maxDepth) throw new Error('Include depth exceeded');
    const key = path.normalize(filePath).toLowerCase();
    if (stack.has(key)) throw new Error('Include cycle detected');
    stack.add(key);
    let html = await readFileCached(filePath);
    const baseDir = path.dirname(filePath);
    try { includeRe.lastIndex = 0; } catch {}
    html = await replaceAsync(html, includeRe, async (_m, rel) => {
      const incPath = resolveInclude({ baseDir, htmlRoot: root, rel });
      if (!incPath) throw new Error('Invalid include path');
      return await walk(incPath, depth + 1);
    });
    stack.delete(key);
    return html;
  };

  return await walk(entry, 0);
}

function renderWithIncludesSync(entryPath, { htmlRoot, maxDepth = 10 } = {}) {
  const root = String(htmlRoot || '');
  const entry = path.resolve(String(entryPath || ''));
  const normEntry = path.normalize(entry);
  const normRoot = path.normalize(root);
  if (!normEntry.toLowerCase().startsWith(normRoot.toLowerCase() + path.sep) && normEntry.toLowerCase() !== normRoot.toLowerCase()) {
    throw new Error('Invalid HTML path');
  }

  const stack = new Set();
  const walk = (filePath, depth) => {
    if (depth > maxDepth) throw new Error('Include depth exceeded');
    const key = path.normalize(filePath).toLowerCase();
    if (stack.has(key)) throw new Error('Include cycle detected');
    stack.add(key);
    let html = readFileCachedSync(filePath);
    const baseDir = path.dirname(filePath);
    try { includeRe.lastIndex = 0; } catch {}
    html = replaceSync(html, includeRe, (_m, rel) => {
      const incPath = resolveInclude({ baseDir, htmlRoot: root, rel });
      if (!incPath) throw new Error('Invalid include path');
      return walk(incPath, depth + 1);
    });
    stack.delete(key);
    return html;
  };
  return walk(entry, 0);
}

function replaceAsync(str, re, fn) {
  const s = String(str || '');
  try { re.lastIndex = 0; } catch {}
  const matches = [];
  s.replace(re, (m, ...args) => {
    const offset = args[args.length - 2];
    matches.push({ m, args, offset });
    return m;
  });
  if (!matches.length) return Promise.resolve(s);
  const parts = [];
  let last = 0;
  return (async () => {
    for (const it of matches) {
      parts.push(s.slice(last, it.offset));
      parts.push(await fn(it.m, ...it.args));
      last = it.offset + it.m.length;
    }
    parts.push(s.slice(last));
    return parts.join('');
  })();
}

function replaceSync(str, re, fn) {
  const s = String(str || '');
  try { re.lastIndex = 0; } catch {}
  const matches = [];
  s.replace(re, (m, ...args) => {
    const offset = args[args.length - 2];
    matches.push({ m, args, offset });
    return m;
  });
  if (!matches.length) return s;
  const parts = [];
  let last = 0;
  for (const it of matches) {
    parts.push(s.slice(last, it.offset));
    parts.push(fn(it.m, ...it.args));
    last = it.offset + it.m.length;
  }
  parts.push(s.slice(last));
  return parts.join('');
}

function makeHtmlSender({ htmlRoot }) {
  const root = String(htmlRoot || '');
  const addVersion = (html) => {
    const v = String(process.env.BUILD_ID || '').trim();
    if (!v) return html;
    return String(html || '').replace(/(href|src)=["'](\/static\/[^"'?#]+)([^"']*)["']/g, (m, attr, url, rest) => {
      const r = String(rest || '');
      if (r.startsWith('?')) {
        if (r.includes('v=')) return `${attr}="${url}${r}"`;
        return `${attr}="${url}${r}&v=${encodeURIComponent(v)}"`;
      }
      return `${attr}="${url}?v=${encodeURIComponent(v)}${r}"`;
    });
  };
  return async (req, res, fileName) => {
    const p = path.join(root, String(fileName || ''));
    try {
      let rendered = await renderWithIncludes(p, { htmlRoot: root });
      rendered = addVersion(rendered);
      res.setHeader('Cache-Control', 'no-store');
      res.type('html').status(200).send(rendered);
    } catch (e) {
      const code = String(e?.code || '');
      if (code === 'ENOENT') {
        res.status(404).json({ message: 'Not Found', path: req.path });
        return;
      }
      res.status(500).json({ message: e?.message || 'HTML render failed' });
    }
  };
}

function makeHtmlSenderSync({ htmlRoot }) {
  const root = String(htmlRoot || '');
  const addVersion = (html) => {
    const v = String(process.env.BUILD_ID || '').trim();
    if (!v) return html;
    return String(html || '').replace(/(href|src)=["'](\/static\/[^"'?#]+)([^"']*)["']/g, (m, attr, url, rest) => {
      const r = String(rest || '');
      if (r.startsWith('?')) {
        if (r.includes('v=')) return `${attr}="${url}${r}"`;
        return `${attr}="${url}${r}&v=${encodeURIComponent(v)}"`;
      }
      return `${attr}="${url}?v=${encodeURIComponent(v)}${r}"`;
    });
  };
  return (req, res, fileName) => {
    const p = path.join(root, String(fileName || ''));
    try {
      let rendered = renderWithIncludesSync(p, { htmlRoot: root });
      rendered = addVersion(rendered);
      res.setHeader('Cache-Control', 'no-store');
      res.type('html').status(200).send(rendered);
    } catch (e) {
      const code = String(e?.code || '');
      if (code === 'ENOENT') {
        res.status(404).json({ message: 'Not Found', path: req.path });
        return;
      }
      res.status(500).json({ message: e?.message || 'HTML render failed' });
    }
  };
}

module.exports = { renderWithIncludes, renderWithIncludesSync, makeHtmlSender, makeHtmlSenderSync };
