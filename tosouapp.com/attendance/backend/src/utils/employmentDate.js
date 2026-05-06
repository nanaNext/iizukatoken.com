function normalizeDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/\//g, '-').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const d = new Date(normalized + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime())) return null;
  return normalized;
}

function resolveEmploymentStartDate(user) {
  const hire = normalizeDateInput(user?.hire_date || user?.hireDate || null);
  const join = normalizeDateInput(user?.join_date || user?.joinDate || null);
  if (hire && join) {
    return hire > join ? hire : join;
  }
  return hire || join || null;
}

module.exports = { normalizeDateInput, resolveEmploymentStartDate };
