import { login, me, refresh } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function setError(msg) {
  const el = $('#error'); el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none';
}

function saveAuth({ accessToken, refreshToken, username, email, role }) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('user', JSON.stringify({ username, email, role }));
}

async function tryRefresh() {
  try {
    const csrf = getCookie('csrfToken');
    const r = await refresh(csrf);
    localStorage.setItem('accessToken', r.accessToken);
    return r.accessToken;
  } catch (e) { return null; }
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function handleSubmit(e) {
  e.preventDefault();
  setError('');
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (!email || !password) { setError('Vui lòng nhập email/mật khẩu'); return; }
  try {
    const data = await login(email, password);
    saveAuth(data);
    $('#success').textContent = 'Đăng nhập thành công';
    const token = data.accessToken || localStorage.getItem('accessToken');
    try { await me(token); } catch {}
    window.location.href = '/ui/attendance';
  } catch (err) {
    setError(err.message || 'Đăng nhập thất bại');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = $('#loginForm');
  form.addEventListener('submit', handleSubmit);
  const toggle = $('#togglePassword');
  toggle.addEventListener('click', () => {
    const input = $('#password');
    input.type = input.type === 'password' ? 'text' : 'password';
    toggle.textContent = input.type === 'password' ? 'Hiện' : 'Ẩn';
  });
});
