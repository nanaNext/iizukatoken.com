export function parseNum(raw, label, { allowEmpty = true } = {}) {
  const s0 = String(raw == null ? '' : raw).trim();
  if (!s0) {
    if (allowEmpty) return null;
    throw new Error(`${label} を入力してください`);
  }
  const s = s0.replace(/,/g, '').replace(/\s+/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label} の数値が不正です: ${s0}`);
  return n;
}

export function fmtYen(n) {
  const v = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat('ja-JP').format(v) + ' 円';
  } catch {
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 円';
  }
}

export function fmtNum(n) {
  const v = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat('ja-JP').format(v);
  } catch {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

export function hmFromMin(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}
