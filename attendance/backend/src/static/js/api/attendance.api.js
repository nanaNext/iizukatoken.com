import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/admin/attendance';

export async function getTimesheet(userId, from, to) {
  const q = `userId=${encodeURIComponent(userId)}&from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}`;
  const options = arguments.length >= 4 ? arguments[3] : undefined;
  return fetchJSONAuth(`${BASE}/timesheet?${q}`, options);
}

export async function getAttendanceDay(userId, date) {
  const q = `userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`;
  const options = arguments.length >= 3 ? arguments[2] : undefined;
  return fetchJSONAuth(`${BASE}/day?${q}`, options);
}

export async function updateAttendanceSegment(id, body) {
  const options = arguments.length >= 3 ? arguments[2] : undefined;
  return fetchJSONAuth(`${BASE}/${encodeURIComponent(id)}`, { ...(options || {}), method: 'PATCH', body: JSON.stringify(body) });
}

export function buildTimesheetExportURL(userIds, from, to) {
  const p = new URLSearchParams();
  p.set('userIds', Array.isArray(userIds) ? userIds.join(',') : String(userIds));
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  return `/api/admin/export/timesheet.csv?${p.toString()}`;
}
