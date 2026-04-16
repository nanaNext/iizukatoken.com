import { fetchJSONAuth } from './http.api.js';

export async function listMyRequests(q = '') {
  const qs = q ? ('?q=' + encodeURIComponent(q)) : '';
  return fetchJSONAuth('/api/requests' + qs, { method: 'GET' });
}

export async function listMyRecentAppliedTypes(limit = 20) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  return fetchJSONAuth('/api/requests/recent/applied-types?limit=' + encodeURIComponent(lim), { method: 'GET' });
}

export async function createRequest(payload) {
  return fetchJSONAuth('/api/requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
