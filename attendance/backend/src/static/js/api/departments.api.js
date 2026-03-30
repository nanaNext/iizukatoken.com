import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/departments';

export async function listDepartments(options) {
  return fetchJSONAuth(`${BASE}`, options);
}
