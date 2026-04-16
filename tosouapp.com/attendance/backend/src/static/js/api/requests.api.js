import { fetchJSONAuth } from './http.api.js';

export async function listMyRequests(q = '') {
  const qs = q ? ('?q=' + encodeURIComponent(q)) : '';
  return fetchJSONAuth('/api/requests' + qs, { method: 'GET' });
}

export async function createRequest(payload) {
  return fetchJSONAuth('/api/requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
