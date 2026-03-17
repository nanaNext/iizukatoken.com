import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/departments';

export async function listDepartments() {
  return fetchJSONAuth(`${BASE}`);
}
