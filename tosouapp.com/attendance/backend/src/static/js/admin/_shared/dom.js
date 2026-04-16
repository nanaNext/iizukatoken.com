export const $ = (sel, root = document) => root.querySelector(sel);

export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const on = (el, type, handler, options) => {
  if (!el) return;
  el.addEventListener(type, handler, options);
};

export function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function delegate(root, selector, type, handler, options) {
  if (!root) return () => {};
  const listener = (e) => {
    const t = e && e.target;
    const el = (t && t.closest) ? t.closest(selector) : null;
    if (!el) return;
    if (!root.contains(el)) return;
    handler(e, el);
  };
  root.addEventListener(type, listener, options);
  return () => {
    try { root.removeEventListener(type, listener, options); } catch { }
  };
}
