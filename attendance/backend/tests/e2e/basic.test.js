const http = require('http');
const app = require('../../src/app');

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    }).on('error', reject);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  return { res, body };
}

describe('E2E: basic availability', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    port = started.port;
  });

  afterAll(async () => {
    if (server) await new Promise(r => server.close(r));
  });

  test('GET /ping returns ok', async () => {
    const { res, body } = await fetchJson(`${base()}/ping`);
    expect(res.status).toBe(200);
    expect(body && body.ok).toBe(true);
  });

  test('GET /api/version returns build information', async () => {
    const { res, body } = await fetchJson(`${base()}/api/version`);
    expect(res.status).toBe(200);
    expect(body && body.buildId).toBeTruthy();
    expect(body && body.startedAt).toBeTruthy();
  });

  test('GET /ui/login sets CSRF cookie and CSP header', async () => {
    const resp = await fetch(`${base()}/ui/login`, { redirect: 'manual' });
    expect(resp.status).toBe(200);
    const setCookie = resp.headers.get('set-cookie') || '';
    expect(setCookie.toLowerCase()).toContain('csrftoken');
    const csp = resp.headers.get('content-security-policy') || resp.headers.get('content-security-policy-report-only') || '';
    expect(csp).toContain("default-src");
  });
});
