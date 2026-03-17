import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/employees';

export async function listEmployees() {
  return fetchJSONAuth(`${BASE}`);
}

export async function getEmployee(id) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createEmployee(body) {
  return fetchJSONAuth(`${BASE}`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateEmployee(id, body) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteEmployee(id) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
