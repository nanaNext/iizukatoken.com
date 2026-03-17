import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/attendance';

export async function getTimesheet(userId, from, to) {
  const q = `userId=${encodeURIComponent(userId)}&from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}`;
  return fetchJSONAuth(`${BASE}/timesheet?${q}`);
}

export async function getAttendanceDay(userId, date) {
  const q = `userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`;
  return fetchJSONAuth(`${BASE}/day?${q}`);
}

export async function updateAttendanceSegment(id, body) {
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function buildTimesheetExportURL(userIds, from, to) {
  const p = new URLSearchParams();
  p.set('userIds', Array.isArray(userIds) ? userIds.join(',') : String(userIds));
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  return `/api/admin/export/timesheet.csv?${p.toString()}`;
}
