import { fetchJSONAuth } from './http.api.js';

const BASE = '/api/leave';

export async function myPaidBalance() {
  return await fetchJSONAuth(`${BASE}/my-balance`);
}

export async function applyPaidLeave({ startDate, endDate, reason }) {
  return await fetchJSONAuth(`${BASE}/paid`, {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate, reason })
  });
}

export async function listPendingLeaves() {
  return await fetchJSONAuth(`${BASE}/pending`);
}

export async function updateLeaveStatus(id, status) {
  return await fetchJSONAuth(`${BASE}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function getUserBalance(userId) {
  const qs = `userId=${encodeURIComponent(userId)}`;
  return await fetchJSONAuth(`${BASE}/user-balance?${qs}`);
}

export async function listMyRequests() {
  return await fetchJSONAuth(`${BASE}/my`);
}

export async function getSummaryAll() {
  return await fetchJSONAuth(`${BASE}/summary`);
}
