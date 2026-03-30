export function createPayrollService({ fetchJSONAuth }) {
  const computeEmp = async ({ userId, month, payload }) => {
    try {
      return await fetchJSONAuth(`/api/admin/salary/preview-live`, { method: 'POST', body: JSON.stringify({ userId, month, payload }) });
    } catch (e) {
      const m = String((e && e.message) ? e.message : '');
      if (m === 'Not Found' || m === 'HTTP 404') {
        await fetchJSONAuth('/api/admin/salary/input', { method: 'PUT', body: JSON.stringify({ userId, month, payload }) });
        return await fetchJSONAuth(`/api/admin/salary/preview?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}`);
      }
      throw e;
    }
  };

  const loadInput = async ({ userId, month }) => {
    return await fetchJSONAuth(`/api/admin/salary/input?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}`);
  };

  const persistPayload = async ({ userId, month, payload }) => {
    await fetchJSONAuth('/api/admin/salary/input', { method: 'PUT', body: JSON.stringify({ userId, month, payload }) });
  };

  const generatePayslip = async ({ userId, month }) => {
    return await fetchJSONAuth('/api/admin/salary/payslip/generate', { method: 'POST', body: JSON.stringify({ userId, month }) });
  };

  const publishPayslip = async ({ userId, month, is_published }) => {
    return await fetchJSONAuth('/api/admin/salary/publish', { method: 'POST', body: JSON.stringify({ userId, month, is_published: Boolean(is_published) }) });
  };

  const listDeliveries = async ({ userId, month }) => {
    const q = new URLSearchParams();
    if (userId) q.set('userId', String(userId));
    if (month) q.set('month', String(month));
    const qs = q.toString();
    return await fetchJSONAuth(`/api/admin/salary/deliveries${qs ? '?' + qs : ''}`);
  };

  return { computeEmp, loadInput, persistPayload, generatePayslip, publishPayslip, listDeliveries };
}
