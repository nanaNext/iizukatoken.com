import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/users';

export async function listUsers(options) {
  return fetchJSONAuth(`${BASE}`, options);
}

export async function getUser(id, options) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, options);
}

export async function updateUser(id, body, options) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { ...(options || {}), method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteUser(id, options) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { ...(options || {}), method: 'DELETE' });
}

export async function resetUserPassword(id, newPassword, options) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}/password`, { ...(options || {}), method: 'PATCH', body: JSON.stringify({ password: newPassword }) });
}
