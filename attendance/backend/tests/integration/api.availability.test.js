const request = require('supertest');
const app = require('../../src/app');

describe('Integration: API availability and headers', () => {
  test('GET /ping returns ok', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(res.headers['x-build-id']).toBeTruthy();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  test('GET /api/version returns build information', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body && res.body.buildId).toBeTruthy();
    expect(res.body && res.body.startedAt).toBeTruthy();
  });

  test('GET /ui/login returns 200 and sets CSP', async () => {
    const res = await request(app).get('/ui/login');
    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'] || res.headers['content-security-policy-report-only'] || '';
    expect(csp).toContain("default-src");
    const setCookie = res.headers['set-cookie']?.join('; ') || '';
    expect(setCookie.toLowerCase()).toContain('csrftoken');
  });
});
