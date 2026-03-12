window.addEventListener('error', (e) => {
  try {
    const el = document.querySelector('#error');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'エラーが発生しました: ' + (e.error?.message || e.message || 'unknown');
    }
    const st = document.querySelector('#status');
    if (st) st.textContent = 'Error';
  } catch {}
});
window.addEventListener('DOMContentLoaded', () => {
  try {
    const st = document.querySelector('#status');
    if (st) st.textContent = '';
  } catch {}
});
