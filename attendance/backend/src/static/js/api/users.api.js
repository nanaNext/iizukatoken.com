import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/users';

export async function listUsers() {
  return fetchJSONAuth(`${BASE}`);
}

export async function getUser(id) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`);
}

export async function updateUser(id, body) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteUser(id) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function resetUserPassword(id, newPassword) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPassword }) });
}
