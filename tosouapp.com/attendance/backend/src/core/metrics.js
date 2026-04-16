const counters = Object.create(null);
const histograms = Object.create(null);
function inc(name, value = 1) {
  counters[name] = (counters[name] || 0) + value;
}
function observe(name, value) {
  const arr = histograms[name] || [];
  arr.push(Number(value) || 0);
  histograms[name] = arr;
}
function snapshot() {
  const h = {};
  for (const k of Object.keys(histograms)) {
    const arr = histograms[k];
    if (!arr.length) {
      h[k] = { count: 0, p50: 0, p95: 0, p99: 0 };
      continue;
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    h[k] = { count: sorted.length, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
  }
  return { counters: { ...counters }, histograms: h, ts: Date.now() };
}
module.exports = { inc, observe, snapshot };
