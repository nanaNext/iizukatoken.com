import http from 'k6/http';
import { sleep, check } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;
const USER_ID = __ENV.USER_ID || '5';
const MONTH = __ENV.MONTH || '2026-03';
const VUS = parseInt(__ENV.VUS || '50', 10);
const DURATION = __ENV.DURATION || '60s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<800'],
  },
};

function login() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD');
  }
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'login 200': r => r.status === 200 });
  const access = res.json('accessToken');
  return access;
}

function samplePdf() {
  return '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF';
}

export default function () {
  const access = login();
  const pdf = samplePdf();
  const uploadPayload = { file: http.file(pdf, 'payslip.pdf', 'application/pdf'), userId: USER_ID, month: MONTH };
  const headers = { Authorization: `Bearer ${access}` };
  const up = http.post(`${BASE}/api/payslips/admin/upload`, uploadPayload, { headers });
  check(up, { 'upload ok': r => r.status === 201 || r.status === 429 || r.status === 503 });
  const id = up.status === 201 ? (up.json('id') || null) : null;
  const repPayload = { file: http.file(pdf, 'payslip.pdf', 'application/pdf'), userId: USER_ID, month: MONTH, reason: 'test' };
  const rep = http.post(`${BASE}/api/payslips/admin/replace-by-month`, repPayload, { headers });
  check(rep, { 'replace ok': r => r.status === 200 || r.status === 404 || r.status === 429 || r.status === 503 });
  if (id) {
    const dl = http.get(`${BASE}/api/payslips/admin/file/${id}`, { headers });
    check(dl, { 'download ok': r => r.status === 200 || r.status === 404 || r.status === 503 });
  }
  sleep(1);
}
