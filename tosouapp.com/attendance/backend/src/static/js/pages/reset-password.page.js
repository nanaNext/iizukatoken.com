import { resetPassword } from '../api/auth.api.js';

const $ = (s) => document.querySelector(s);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text || '';
}

function getToken() {
  try {
    const qs = new URLSearchParams(window.location.search);
    return String(qs.get('token') || '').trim();
  } catch {
    return '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = $('#resetForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('#status', '');
    setText('#error', '');
    const token = getToken();
    const newPassword = String($('#newPassword')?.value || '');
    const confirmPassword = String($('#confirmPassword')?.value || '');
    if (!token) {
      setText('#error', 'リンクが無効です。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setText('#error', '確認用パスワードが一致しません。');
      return;
    }
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strong.test(newPassword)) {
      setText('#error', 'パスワードは8文字以上で大文字・小文字・数字を含めてください。');
      return;
    }
    const btn = $('#submitBtn');
    if (btn) btn.disabled = true;
    try {
      await resetPassword({ token, newPassword });
      setText('#status', 'パスワードを更新しました。ログインしてください。');
      setTimeout(() => { window.location.href = '/ui/login'; }, 1200);
    } catch (err) {
      setText('#error', String(err?.message || '更新に失敗しました。'));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
