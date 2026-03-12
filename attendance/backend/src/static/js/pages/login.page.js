import { login, me, refresh } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function setError(msg) {
  const el = $('#error'); el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none';
}

function saveAuth({ accessToken, refreshToken, username, email, role }) {
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('user', JSON.stringify({ username, email, role }));
  try { sessionStorage.setItem('refreshToken', refreshToken || ''); } catch {}
  try {
    localStorage.setItem('user', JSON.stringify({ username, email, role }));
    localStorage.setItem('refreshToken', refreshToken || '');
  } catch {}
}

async function tryRefresh() {
  try {
    const rt = sessionStorage.getItem('refreshToken') || '';
    if (!rt) return null;
    const r = await refresh(rt);
    sessionStorage.setItem('accessToken', r.accessToken);
    try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
    return r.accessToken;
  } catch (e) { return null; }
}

function getCookie(name) { return null; }

function roleRedirect(role) {
  try { sessionStorage.setItem('navSpinner', '1'); } catch {}
  try {
    const ps = document.querySelector('#pageSpinner');
    if (ps) { ps.removeAttribute('hidden'); }
  } catch {}
  window.location.replace('/ui/portal');
}

async function handleSubmit(e) {
  e.preventDefault();
  setError('');
  const statusEl = document.querySelector('#status');
  let pageSpinner = document.querySelector('#pageSpinner');
  if (!pageSpinner) {
    pageSpinner = document.createElement('div');
    pageSpinner.id = 'pageSpinner';
    pageSpinner.className = 'page-spinner';
    pageSpinner.innerHTML = '<div class="lds-spinner" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
    document.body.appendChild(pageSpinner);
  }
  try { pageSpinner.removeAttribute('hidden'); } catch {}
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const form = $('#loginForm');
  if (form && !form.checkValidity()) {
    try { form.reportValidity(); } catch {}
    setError('メール/パスワードを正しく入力してください');
    return;
  }
  if (!email || !password) { setError('メール/パスワードを入力してください'); return; }
  const btn = $('#loginBtn');
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  if (statusEl) { statusEl.textContent = ''; }
  try {
    const data = await login(email, password);
    saveAuth(data);
    roleRedirect(data.role);
  } catch (err) {
    const msg = String(err.message || '').toLowerCase();
    if (msg.includes('invalid') || msg.includes('not found') || msg.includes('unauthorized')) {
      setError('メールまたはパスワードが正しくありません');
    } else if (msg.includes('locked')) {
      setError('アカウントが一時的にロックされています。しばらくしてからお試しください');
    } else if (msg.startsWith('http')) {
      setError('サーバーが応答しません ( ' + err.message + ' )');
    } else {
      setError('ログインに失敗しました: ' + (err.message || 'unknown'));
    }
  }
  finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ログイン'; btn.removeAttribute('aria-busy'); }
    if (statusEl) { statusEl.textContent = ''; }
    try {
      const ps = document.querySelector('#pageSpinner');
      const willNavigate = sessionStorage.getItem('navSpinner') === '1';
      if (ps && !willNavigate) { ps.setAttribute('hidden', ''); }
    } catch {}
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {}
  try {
    const ref = document.referrer || '';
    if (ref.includes('/ui/portal') || ref.includes('/ui/admin') || ref.includes('/ui/dashboard')) {
      try { history.pushState(null, '', window.location.href); } catch {}
    }
  } catch {}
  try {
    window.addEventListener('pageshow', () => {
      try {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } catch {}
      try {
        const ref = document.referrer || '';
        if (ref.includes('/ui/portal') || ref.includes('/ui/admin') || ref.includes('/ui/dashboard')) {
          try { history.pushState(null, '', window.location.href); } catch {}
        }
      } catch {}
    });
  } catch {}
  const form = $('#loginForm');
  if (form) { try { form.setAttribute('autocomplete', 'off'); } catch {} }
  const emailInput = $('#email');
  const passwordInput = $('#password');
  try {
    if (emailInput) { emailInput.setAttribute('autocomplete', 'off'); emailInput.name = 'login_email'; }
    if (passwordInput) { passwordInput.setAttribute('autocomplete', 'off'); passwordInput.name = 'login_password'; }
    if (emailInput) { emailInput.readOnly = false; emailInput.disabled = false; if (localStorage.getItem('remember') !== '1') { emailInput.value = ''; } }
    if (passwordInput) { passwordInput.readOnly = false; passwordInput.disabled = false; if (localStorage.getItem('remember') !== '1') { passwordInput.value = ''; } }
  } catch {}
  form.addEventListener('submit', handleSubmit);
  const btn = $('#loginBtn');
  const updateBtnState = () => {
    const ok = !!(emailInput?.value.trim() && passwordInput?.value);
    if (btn) { btn.disabled = !ok; btn.setAttribute('aria-disabled', (!ok).toString()); }
  };
  updateBtnState();
  if (emailInput) emailInput.addEventListener('input', updateBtnState);
  if (passwordInput) passwordInput.addEventListener('input', updateBtnState);
  const toggle = $('#togglePassword');
  const EYE_ON = `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.73 5.08A10.47 10.47 0 0 1 12 5c7 0 11 7 11 7a19.54 19.54 0 0 1-4.21 4.62"/><path d="M6.11 6.11A19.45 19.45 0 0 0 1 12s4 7 11 7a10.65 10.65 0 0 0 3.89-.73"/><circle cx="12" cy="12" r="3"/></svg>`;
  toggle.innerHTML = EYE_OFF;
  toggle.addEventListener('click', () => {
    const input = $('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
    toggle.innerHTML = input.type === 'password' ? EYE_OFF : EYE_ON;
    toggle.setAttribute('aria-label', input.type === 'password' ? '表示' : '非表示');
    input.focus();
  });
  const remember = $('#remember');
  if (remember) {
    remember.addEventListener('change', () => {
      localStorage.setItem('remember', remember.checked ? '1' : '0');
    });
  }
});
