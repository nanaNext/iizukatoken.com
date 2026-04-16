import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/employees';

export async function listEmployees() {
  const options = arguments.length >= 1 ? arguments[0] : undefined;
  return fetchJSONAuth(`${BASE}`, options);
}

export async function getEmployee(id) {
  const options = arguments.length >= 2 ? arguments[1] : undefined;
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, options);
}

export async function createEmployee(body) {
  const options = arguments.length >= 2 ? arguments[1] : undefined;
  return fetchJSONAuth(`${BASE}`, { ...(options || {}), method: 'POST', body: JSON.stringify(body) });
}

export async function updateEmployee(id, body) {
  const options = arguments.length >= 3 ? arguments[2] : undefined;
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { ...(options || {}), method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteEmployee(id) {
  const options = arguments.length >= 2 ? arguments[1] : undefined;
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { ...(options || {}), method: 'DELETE' });
}
