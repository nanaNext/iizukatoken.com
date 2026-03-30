import { fetchJSONAuth, fetchBlobAuth, fetchResponseAuth } from '../../api/http.api.js';

function normalizeUrl(url) {
  const u = String(url || '');
  if (!u) return '/api';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/api/')) return u;
  if (u.startsWith('/')) return '/api' + u;
  return '/api/' + u;
}

export async function request(url, options) {
  return fetchResponseAuth(normalizeUrl(url), options);
}

export async function json(url, options) {
  return fetchJSONAuth(normalizeUrl(url), options);
}

export async function blob(url, options) {
  return fetchBlobAuth(normalizeUrl(url), options);
}

export async function downloadWithAuth(url, filename) {
  const b = await blob(url);
  const objUrl = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename || 'download';
  a.click();
  setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch {} }, 1000);
}

export const api = {
  get(url, options) {
    return json(url, options);
  },
  post(url, body, options) {
    const hasBody = body !== undefined;
    return json(url, { ...(options || {}), method: 'POST', body: hasBody ? JSON.stringify(body) : undefined });
  },
  patch(url, body, options) {
    const hasBody = body !== undefined;
    return json(url, { ...(options || {}), method: 'PATCH', body: hasBody ? JSON.stringify(body) : undefined });
  },
  del(url, options) {
    return json(url, { ...(options || {}), method: 'DELETE' });
  },
  upload(url, formData, options) {
    return json(url, { ...(options || {}), method: 'POST', body: formData });
  }
};
