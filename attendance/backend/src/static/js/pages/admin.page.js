import { me, refresh, logout } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureAdmin() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) {
    try { profile = await me(token); } catch {}
  }
  if (!profile) {
    try {
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      const r = await refresh(rt || undefined);
      sessionStorage.setItem('accessToken', r.accessToken);
      try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
      token = r.accessToken;
      profile = await me(token);
    } catch {}
  }
  if (!profile) {
    try {
      const rt2 = localStorage.getItem('refreshToken') || '';
      if (rt2) {
        const r2 = await refresh(rt2);
        sessionStorage.setItem('accessToken', r2.accessToken);
        try { sessionStorage.setItem('refreshToken', r2.refreshToken || rt2); } catch {}
        token = r2.accessToken;
        profile = await me(token);
      }
    } catch {}
  }
  if (!profile) {
    const err = document.querySelector('#error');
    if (err) { err.style.display = 'block'; err.textContent = 'ログインが必要です。もう一度ログインしてください。'; }
    setTimeout(() => { try { window.location.replace('/ui/login'); } catch {} }, 200);
    return null;
  }
  const role = String(profile.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    const err = document.querySelector('#error');
    if (err) { err.style.display = 'block'; err.textContent = '管理者権限が必要です。従業員ポータルへ移動してください。'; }
    return null;
  }
  return profile;
}

document.addEventListener('DOMContentLoaded', async () => {
  let _topbarH = 64;
  let _raf = null;
  let _measureDisabled = false;
  const isMobile = () => (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  const setTopbarHeightVar = () => {
    try {
      if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
      const topbar = document.querySelector('.topbar');
      if (!topbar) return;
      const rect = topbar.getBoundingClientRect();
      let h = Math.round(rect?.height || 64);
      if (!(h > 40 && h < 200)) {
        const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 64;
        h = Math.min(120, Math.max(48, cur));
      }
      if (_topbarH !== h) {
        _topbarH = h;
        document.documentElement.style.setProperty('--topbar-height', `${h}px`);
      }
    } catch {}
  };
  const scheduleTopbarMeasure = () => {
    if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
    if (_raf) return;
    _raf = requestAnimationFrame(() => {
      _raf = null;
      setTopbarHeightVar();
    });
  };
  if (isMobile()) {
    _measureDisabled = true;
    try {
      const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 56;
      document.documentElement.style.setProperty('--topbar-height', `${Math.min(120, Math.max(48, cur))}px`);
    } catch {}
  } else {
    scheduleTopbarMeasure();
  }
  window.addEventListener('resize', scheduleTopbarMeasure);
  try {
    const tb = document.querySelector('.topbar');
    if (tb && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        scheduleTopbarMeasure();
      });
      ro.observe(tb);
    }
  } catch {}
  const status = $('#status');
  if (status) status.textContent = '認証を確認しています…';
  let profile = null;
  try {
    profile = await ensureAdmin();
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '認証エラー: ' + (e?.message || 'unknown'); }
  }
  if (!profile) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: Invalid or expired token'; }
    setTimeout(() => { try { window.location.href = '/ui/login'; } catch {} }, 200);
    return;
  }
  $('#userName').textContent = profile.username || profile.email || '管理者';
  const token = sessionStorage.getItem('accessToken');
  const content = $('#adminContent');
  const params = new URLSearchParams(window.location.search);
  let tab = params.get('tab') || '';
  if (!tab && window.location.pathname.startsWith('/ui/employees')) {
    tab = 'employees';
  }
  if (content) {
    content.className = tab === 'employees' ? 'card wide' : 'card';
  }
  function renderEmployeesTopbar(mode) {
    try {
      const brand = document.querySelector('.topbar .brand');
      if (brand && document.body.classList.contains('employees-wide')) {
        brand.innerHTML = `
          <span class="brand-title">社員管理</span>
          <nav class="brand-tabs" style="margin-left:12px;">
            <a class="btn ${mode==='list'?'active':''}" href="#list">社員一覧</a>
            <a class="btn ${mode==='add'?'active':''}" href="#add">社員追加</a>
            <a class="btn ${mode==='edit'?'active':''}" href="#edit">社員編集</a>
            <a class="btn ${mode==='delete'?'active':''}" href="#delete">社員削除</a>
          </nav>
        `;
        const tabs = brand.querySelector('.brand-tabs');
        if (tabs) {
          tabs.addEventListener('click', async (e) => {
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href') || '#list';
            if (href.startsWith('#')) {
              e.preventDefault();
              try { window.location.hash = href; } catch {}
              await renderEmployees();
            }
          });
        }
      }
    } catch {}
  }
  try {
    const map = {
      employees: '#nav-employees',
      users: '#nav-users',
      departments: '#nav-departments',
      attendance: '#nav-attendance',
      approvals: '#nav-approvals',
      reports: '#nav-reports',
      settings: '#nav-settings',
      audit: '#nav-audit',
      refresh: '#nav-refresh',
      calendar: '#nav-calendar',
      shifts: '#nav-shifts',
      routes: '#nav-routes'
    };
    const sel = map[tab];
    if (sel) {
      document.querySelectorAll('.sidebar .sidebar-nav a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(sel);
      if (link) link.classList.add('active');
    }
    const logoutBtn = document.querySelector('#nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          await logout(rt);
        } catch {}
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
        window.location.replace('/ui/login');
      });
    }
  } catch {}
  try {
    if (tab === 'employees') {
      document.body.classList.add('employees-wide');
    } else {
      document.body.classList.remove('employees-wide');
    }
  } catch {}
  
  function ensureSpinnerStyle() {
    try {
      if (!document.querySelector('#spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `
          .page-spinner{background:#fff;display:flex;align-items:center;justify-content:center}
          .dot-spinner{position:relative;width:64px;height:64px}
          .dot-spinner div{position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#666;opacity:.2;animation:dotfade 1s linear infinite}
          @keyframes dotfade{0%{opacity:1}100%{opacity:.2}}
          .dot-spinner div:nth-child(1){transform:rotate(0deg) translate(24px);animation-delay:-0.92s}
          .dot-spinner div:nth-child(2){transform:rotate(30deg) translate(24px);animation-delay:-0.84s}
          .dot-spinner div:nth-child(3){transform:rotate(60deg) translate(24px);animation-delay:-0.76s}
          .dot-spinner div:nth-child(4){transform:rotate(90deg) translate(24px);animation-delay:-0.68s}
          .dot-spinner div:nth-child(5){transform:rotate(120deg) translate(24px);animation-delay:-0.60s}
          .dot-spinner div:nth-child(6){transform:rotate(150deg) translate(24px);animation-delay:-0.52s}
          .dot-spinner div:nth-child(7){transform:rotate(180deg) translate(24px);animation-delay:-0.44s}
          .dot-spinner div:nth-child(8){transform:rotate(210deg) translate(24px);animation-delay:-0.36s}
          .dot-spinner div:nth-child(9){transform:rotate(240deg) translate(24px);animation-delay:-0.28s}
          .dot-spinner div:nth-child(10){transform:rotate(270deg) translate(24px);animation-delay:-0.20s}
          .dot-spinner div:nth-child(11){transform:rotate(300deg) translate(24px);animation-delay:-0.12s}
          .dot-spinner div:nth-child(12){transform:rotate(330deg) translate(24px);animation-delay:-0.04s}
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }
  const showNavSpinner = () => {
    try {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      let el = document.querySelector('#pageSpinner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pageSpinner';
        el.className = 'page-spinner';
        el.innerHTML = '<div class="lds-spinner" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
        el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.background = '#fff';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.zIndex = '9999';
        document.body.appendChild(el);
      } else {
        el.removeAttribute('hidden');
        el.style.background = '#fff';
        el.style.display = 'flex';
      }
      const c = document.querySelector('#adminContent');
      if (c) c.style.visibility = 'hidden';
    } catch {}
  };
  const hideNavSpinner = () => {
    try {
      try { sessionStorage.removeItem('navSpinner'); } catch {}
      const el = document.querySelector('#pageSpinner');
      if (el) {
        el.setAttribute('hidden', 'true');
        el.style.display = 'none';
      }
      const c = document.querySelector('#adminContent');
      if (c) c.style.visibility = '';
    } catch {}
  };
  
  if (isMobile()) {
    _measureDisabled = true;
    try { window.removeEventListener('resize', scheduleTopbarMeasure); } catch {}
    document.documentElement.style.setProperty('--topbar-height', `${Math.min(60, Math.max(48, _topbarH))}px`);
  } else {
    _measureDisabled = false;
    try { window.addEventListener('resize', scheduleTopbarMeasure); } catch {}
  }
  const tilesSection = document.querySelector('.tiles');
  if (tilesSection) tilesSection.style.display = tab ? 'none' : '';
  const subBrand = document.querySelector('.brand .sub');
  if (subBrand) {
    subBrand.style.display = tab === 'settings' ? 'none' : '';
    setTopbarHeightVar();
  }
  async function fetchJSONAuth(url, options) {
    let tok = sessionStorage.getItem('accessToken') || token;
    const csrf = getCookie('csrfToken');
    let res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options });
    if (res.status === 401 || res.status === 403) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refresh(rt);
        sessionStorage.setItem('accessToken', r.accessToken);
        try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
        tok = r.accessToken;
        res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options });
      } catch {}
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      const m = String(msg || '').toLowerCase();
      if (res.status === 403 && m.includes('forbidden')) {
        const el = document.querySelector('#error');
        if (el) { el.style.display = 'block'; el.textContent = '管理者権限が必要です。アクセスが拒否されました。'; }
      } else if (res.status === 401 && (m.includes('no token provided') || m.includes('missing refresh token') || m.includes('csrf validation failed'))) {
        const el = document.querySelector('#error');
        if (el) { el.style.display = 'block'; el.textContent = 'ログインが必要です。もう一度ログインしてください。'; }
        setTimeout(() => { try { window.location.href = '/ui/login'; } catch {} }, 200);
      }
      throw new Error(msg);
    }
    return res.json();
  }
  const userBtn = document.querySelector('.user .user-btn');
  const dropdown = document.querySelector('#userDropdown');
  if (userBtn && dropdown) {
    userBtn.addEventListener('click', () => {
      const hidden = dropdown.hasAttribute('hidden');
      if (hidden) {
        dropdown.removeAttribute('hidden');
        userBtn.setAttribute('aria-expanded', 'true');
        const firstItem = dropdown.querySelector('.item, a, button');
        if (firstItem && typeof firstItem.focus === 'function') {
          try { firstItem.focus(); } catch {}
        }
      } else {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
    const btnLogout = document.querySelector('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try {
          const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          await logout(rt);
        } catch {}
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.replace('/ui/login');
      });
    }
    const items = dropdown.querySelectorAll('.item, a, button');
    items.forEach(el => {
      el.addEventListener('click', () => {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/ui/portal') || href.startsWith('/ui/admin?')) {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      showNavSpinner();
      if (a.classList.contains('tile')) {
        e.preventDefault();
        setTimeout(() => { window.location.href = href; }, 600);
      }
    }
  });
  const mobileBtn = document.querySelector('#mobileMenuBtn');
  const mobileDrawer = document.querySelector('#mobileDrawer');
  const mobileClose = document.querySelector('#mobileClose');
  const mobileBackdrop = document.querySelector('#drawerBackdrop');
  if (mobileBtn && mobileDrawer) {
    const toggleDrawer = (open) => {
      const isHidden = mobileDrawer.hasAttribute('hidden');
      const shouldOpen = typeof open === 'boolean' ? open : isHidden;
      if (shouldOpen) {
        mobileDrawer.removeAttribute('hidden');
        mobileBtn.setAttribute('aria-expanded', 'true');
        try {
          const w = Math.round(mobileDrawer.getBoundingClientRect().width || 280);
          document.documentElement.style.setProperty('--drawer-offset', `${w}px`);
          document.body.classList.add('drawer-open');
        } catch {}
        if (mobileBackdrop) { mobileBackdrop.removeAttribute('hidden'); }
      } else {
        mobileDrawer.setAttribute('hidden', '');
        mobileBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        if (mobileBackdrop) { mobileBackdrop.setAttribute('hidden', ''); }
      }
    };
    mobileBtn.addEventListener('click', () => toggleDrawer());
    if (mobileClose) mobileClose.addEventListener('click', () => toggleDrawer(false));
    /* backdrop không đóng, chỉ nút X mới đóng */
  }
  async function renderUsers() {
    const rows = await fetchJSONAuth('/api/admin/users');
    content.innerHTML = '<h3>ユーザー一覧</h3>';
    const table = document.createElement('table');
    table.style.width = 'auto';
    table.style.minWidth = '640px';
    table.style.tableLayout = 'auto';
    table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>Email</th><th>Role</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.username || ''}</td>
        <td>${r.email || ''}</td>
        <td>${r.role || ''}</td>
        <td>
          <button data-detail="${r.id}">詳細</button>
          <button data-resetpw="${r.id}">PWリセット</button>
          <button data-lock="${r.id}">ロック</button>
          <button data-unlock="${r.id}">ロック解除</button>
          <button data-delete="${r.id}">削除</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    content.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-delete');
      const rid = e.target?.getAttribute?.('data-resetpw');
      const lid = e.target?.getAttribute?.('data-lock');
      const uid = e.target?.getAttribute?.('data-unlock');
      const did = e.target?.getAttribute?.('data-detail');
      if (id) {
        if (confirm('削除しますか？')) {
          await fetchJSONAuth(`/api/admin/users/${id}`, { method: 'DELETE' });
          await renderUsers();
        }
      } else if (rid) {
        const newPw = prompt('新しいパスワードを入力');
        if (newPw && newPw.length >= 6) {
          await fetchJSONAuth(`/api/admin/users/${rid}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPw }) });
          alert('PW更新しました');
        }
      } else if (lid) {
        const minsStr = prompt('ロック分数 (既定: 60)');
        const minutes = parseInt(minsStr || '60', 10);
        await fetchJSONAuth(`/api/admin/users/${lid}/lock`, { method: 'PATCH', body: JSON.stringify({ minutes }) });
        alert('ロックしました');
      } else if (uid) {
        await fetchJSONAuth(`/api/admin/users/${uid}/unlock`, { method: 'PATCH' });
        alert('ロック解除しました');
      } else if (did) {
        const u = rows.find(x => String(x.id) === String(did));
        if (u) {
          alert(`ID: ${u.id}\n名前: ${u.username || ''}\nEmail: ${u.email || ''}\nRole: ${u.role || ''}`);
        }
      }
    });
  }
  async function renderDepartments() {
    const rows = await fetchJSONAuth('/api/admin/departments');
    const users = await fetchJSONAuth('/api/admin/users');
    content.innerHTML = '<h3>部門管理</h3>';
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="deptName" placeholder="部門名">
      <button type="submit">作成</button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.querySelector('#deptName').value.trim();
      if (!name) return;
      await fetchJSONAuth('/api/admin/departments', { method: 'POST', body: JSON.stringify({ name }) });
      await renderDepartments();
    });
    content.appendChild(form);
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const d of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.id}</td>
        <td><input data-dept-name="${d.id}" value="${d.name}"></td>
        <td>
          <button data-dept-save="${d.id}">保存</button>
          <button data-dept-del="${d.id}">削除</button>
          <button data-dept-users="${d.id}">社員一覧</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    const listDiv = document.createElement('div');
    content.appendChild(listDiv);
    content.addEventListener('click', async (e) => {
      const sid = e.target?.getAttribute?.('data-dept-save');
      const did = e.target?.getAttribute?.('data-dept-del');
      const uid = e.target?.getAttribute?.('data-dept-users');
      if (sid) {
        const name = content.querySelector(`input[data-dept-name="${sid}"]`).value.trim();
        await fetchJSONAuth(`/api/admin/departments/${sid}`, { method: 'PATCH', body: JSON.stringify({ name }) });
        alert('保存しました');
      } else if (did) {
        if (confirm('削除しますか？')) {
          await fetchJSONAuth(`/api/admin/departments/${did}`, { method: 'DELETE' });
          await renderDepartments();
        }
      } else if (uid) {
        const list = users.filter(u => String(u.departmentId || '') === String(uid));
        listDiv.innerHTML = '<h4>所属社員</h4>';
        const ul = document.createElement('ul');
        for (const u of list) {
          const li = document.createElement('li');
          li.textContent = `${u.id} ${u.username || u.email}`;
          ul.appendChild(li);
        }
        listDiv.appendChild(ul);
      }
    });
  }
  async function renderSettings() {
    const prefs = (() => { try { return JSON.parse(localStorage.getItem('prefs') || '{}'); } catch { return {}; } })();
    const mailPrefs = {}; // không hiển thị sẵn các checkbox thông báo
    content.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'card wide';
    wrap.innerHTML = `
      <h3>各種設定</h3>
      <div class="two-cols">
        <div class="left">
          <form id="formUser" class="section">
            <div class="section-head">
              <h4>ユーザ情報</h4>
              <div class="actions"><button type="button" id="btnCancelUser">キャンセル</button><button type="submit" id="btnSaveUser">保存</button></div>
            </div>
            <div class="row"><label>ユーザー名</label><input id="setName" placeholder="氏名" value="${profile.username || ''}"></div>
            <div class="row"><label>メールアドレス <span style="color:#b00020;">＊必須情報</span></label><input id="setEmail" placeholder="email@example.com" value="${profile.email || ''}"></div>
            <div class="row"><label>パスワード</label><input id="setPass" type="password" placeholder="新しいパスワード"></div>
          </form>
          <form id="formLang" class="section">
            <div class="section-head">
              <h4>言語設定</h4>
              <div class="actions"><button type="button" id="btnCancelPrefs">キャンセル</button><button type="submit" id="btnSavePrefs">保存</button></div>
            </div>
            <div class="row">
              <label>言語</label>
              <select id="langSel">
                <option value="ja" ${prefs.lang==='ja'?'selected':''}>日本語</option>
                <option value="en" ${prefs.lang==='en'?'selected':''}>English</option>
                <option value="vi" ${prefs.lang==='vi'?'selected':''}>Tiếng Việt</option>
              </select>
            </div>
            <div class="row">
              <label>地域</label>
              <select id="regionSel">
                <option value="ja-JP" ${prefs.region==='ja-JP'?'selected':''}>日本語 (日本)</option>
                <option value="en-US" ${prefs.region==='en-US'?'selected':''}>English (United States)</option>
                <option value="vi-VN" ${prefs.region==='vi-VN'?'selected':''}>Tiếng Việt (Việt Nam)</option>
              </select>
            </div>
            <div class="row">
              <label>タイムゾーン</label>
              <select id="tzSel">
                <option value="Asia/Tokyo" ${prefs.tz==='Asia/Tokyo'?'selected':''}>GMT+09:00 日本標準時 (Asia/Tokyo)</option>
                <option value="UTC" ${prefs.tz==='UTC'?'selected':''}>UTC</option>
                <option value="Asia/Ho_Chi_Minh" ${prefs.tz==='Asia/Ho_Chi_Minh'?'selected':''}>GMT+07:00 (Asia/Ho_Chi_Minh)</option>
              </select>
            </div>
          </form>
        </div>
        <div class="right">
          <form id="formMail" class="section">
            <div class="section-head">
              <h4>メール設定</h4>
              <div class="actions"><button type="button" id="btnCancelMail">キャンセル</button><button type="submit" id="btnSaveMail">保存</button></div>
            </div>
            <div class="row single"><label><input type="checkbox" id="mail_enabled">メール通知を有効にする</label></div>
            <div style="margin:8px 16px;color:#3a6ea5;">VITEアカウントの設定変更を通知して、重要な変更を見逃さないようにしましょう。</div>
            <div class="row single"><label><input type="checkbox" id="mail_topic">トピックの作成を通知</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_profile_update">プロフィールの更新を通知</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_my_comment">私の投稿へのコメント</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_file_comment">ファイルへのコメント</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_mention">メンションされた時</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_reply">返信が付いた時</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_like_comment">私のコメントに「いいね」が付いた</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_reply_comment">私のコメントに返信が付いた</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_blog_update">自分のブログのアップデート</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_page_update">自分のプロファイルページのアップデート</label></div>
          </form>
        </div>
      </div>
    `;
    content.appendChild(wrap);
    const formUser = wrap.querySelector('#formUser');
    formUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailVal = wrap.querySelector('#setEmail').value.trim();
      const emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(emailVal);
      if (!emailOk) { alert('メールアドレスの形式が正しくありません'); return; }
      const b = {
        username: wrap.querySelector('#setName').value.trim() || null,
        email: emailVal || null
      };
      await fetchJSONAuth(`/api/users/me`, { method: 'PATCH', body: JSON.stringify(b) });
      const pass = wrap.querySelector('#setPass').value;
      if (pass && pass.length >= 6) {
        if ((profile.role || '').toLowerCase() === 'admin') {
          await fetchJSONAuth(`/api/admin/users/${encodeURIComponent(profile.id)}/password`, { method: 'PATCH', body: JSON.stringify({ password: pass }) });
        } else {
          alert('パスワード変更は現在のパスワードが必要です'); 
        }
      }
      alert('保存しました');
    });
    const btnCancelUser = wrap.querySelector('#btnCancelUser');
    if (btnCancelUser) btnCancelUser.addEventListener('click', () => { window.location.href = '/ui/admin'; });
    const formLang = wrap.querySelector('#formLang');
    formLang.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPrefs = {
        lang: wrap.querySelector('#langSel').value,
        region: wrap.querySelector('#regionSel').value,
        tz: wrap.querySelector('#tzSel').value
      };
      localStorage.setItem('prefs', JSON.stringify(newPrefs));
      await fetchJSONAuth(`/api/users/me`, { method: 'PATCH', body: JSON.stringify({ lang: newPrefs.lang, region: newPrefs.region, timezone: newPrefs.tz }) });
      alert('保存しました');
    });
    const btnCancelPrefs = wrap.querySelector('#btnCancelPrefs');
    if (btnCancelPrefs) btnCancelPrefs.addEventListener('click', () => { window.location.href = '/ui/admin'; });
    const formMail = wrap.querySelector('#formMail');
    formMail.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newMail = {
        enabled: wrap.querySelector('#mail_enabled').checked,
        topic: wrap.querySelector('#mail_topic').checked,
        profile_update: wrap.querySelector('#mail_profile_update').checked,
        my_comment: wrap.querySelector('#mail_my_comment').checked,
        file_comment: wrap.querySelector('#mail_file_comment').checked,
        mention: wrap.querySelector('#mail_mention').checked,
        reply: wrap.querySelector('#mail_reply').checked,
        like_comment: wrap.querySelector('#mail_like_comment').checked,
        reply_comment: wrap.querySelector('#mail_reply_comment').checked,
        blog_update: wrap.querySelector('#mail_blog_update').checked,
        page_update: wrap.querySelector('#mail_page_update').checked
      };
      localStorage.setItem('mailPrefs', JSON.stringify(newMail));
      alert('保存しました');
    });
    const btnCancelMail = wrap.querySelector('#btnCancelMail');
    if (btnCancelMail) btnCancelMail.addEventListener('click', () => { window.location.href = '/ui/admin'; });
  }
  async function renderAudit() {
    const r = await fetchJSONAuth('/api/admin/audit');
    content.innerHTML = '<h3>監査ログ</h3>';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(r, null, 2);
    content.appendChild(pre);
  }
  async function renderRefresh() {
    content.innerHTML = '<h3>トークン管理</h3>';
    const q = await fetchJSONAuth(`/api/admin/auth/refresh/list?userId=${encodeURIComponent(profile.id)}&page=1&pageSize=20`);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(q, null, 2);
    content.appendChild(pre);
  }
  async function renderCalendar() {
    const year = new Date().getUTCFullYear();
    const ping = await fetchJSONAuth(`/api/admin/calendar/ping?year=${year}`);
    const data = await fetchJSONAuth(`/api/admin/calendar/holidays?year=${year}`);
    content.innerHTML = '<h3>カレンダー</h3>';
    const info = document.createElement('div');
    info.textContent = `Ping: ${ping?.version || 'ok'}, Year: ${ping?.year || year}, 件数: ${(data?.rows || data)?.length || 0}`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    content.appendChild(info);
    content.appendChild(pre);
  }
  async function renderShifts() {
    const defs = await fetchJSONAuth('/api/admin/shifts/definitions');
    content.innerHTML = '<h3>シフト定義</h3>';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>開始</th><th>終了</th><th>休憩(分)</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const s of defs) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.id}</td><td>${s.name||''}</td><td>${s.start_time||''}</td><td>${s.end_time||''}</td><td>${s.break_minutes||0}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    const form = document.createElement('form');
    form.innerHTML = `
      <h4>新規シフト</h4>
      <input id="shiftName" placeholder="名前">
      <input id="shiftStart" placeholder="開始(HH:MM)">
      <input id="shiftEnd" placeholder="終了(HH:MM)">
      <input id="shiftBreak" type="number" placeholder="休憩(分)" value="0">
      <button type="submit">作成</button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = {
        name: document.querySelector('#shiftName').value.trim(),
        start_time: document.querySelector('#shiftStart').value.trim(),
        end_time: document.querySelector('#shiftEnd').value.trim(),
        break_minutes: parseInt(document.querySelector('#shiftBreak').value || '0', 10)
      };
      await fetchJSONAuth('/api/admin/shifts/definitions', { method: 'POST', body: JSON.stringify(b) });
      await renderShifts();
    });
    content.appendChild(form);
    const assign = document.createElement('form');
    assign.innerHTML = `
      <h4>シフト割当</h4>
      <input id="assignUserId" type="number" placeholder="userId">
      <input id="assignShiftId" type="number" placeholder="shiftId">
      <input id="assignStart" placeholder="開始日(YYYY-MM-DD)">
      <input id="assignEnd" placeholder="終了日(YYYY-MM-DD)">
      <button type="submit">割当</button>
    `;
    assign.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = {
        userId: parseInt(document.querySelector('#assignUserId').value, 10),
        shiftId: parseInt(document.querySelector('#assignShiftId').value, 10),
        startDate: document.querySelector('#assignStart').value.trim(),
        endDate: document.querySelector('#assignEnd').value.trim() || null
      };
      await fetchJSONAuth('/api/admin/shifts/assign', { method: 'POST', body: JSON.stringify(b) });
      alert('割当完了');
    });
    content.appendChild(assign);
  }
  async function renderRoutes() {
    const r = await fetchJSONAuth('/api/debug/routes');
    content.innerHTML = '<h3>API一覧</h3>';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>Path</th><th>Methods</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const it of (r.routes || [])) {
      const tr = document.createElement('tr');
      const methods = Array.isArray(it.methods) ? it.methods.join(', ').toUpperCase() : Object.keys(it.methods||{}).join(', ').toUpperCase();
      tr.innerHTML = `<td>${it.path}</td><td>${methods}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }
  async function renderEmployees() {
    showNavSpinner();
    const params = new URLSearchParams(location.search);
    try {
      if (!location.hash || location.hash === '#') {
        history.replaceState(null, '', '#list');
      }
    } catch {}
    const detailId = params.get('detail');
    const editId = params.get('edit');
    const createFlag = params.get('create');
    const role2 = String((profile && profile.role) || '').toLowerCase();
    const hash = location.hash || '#list';
    let mode = 'list';
    if (editId) mode = 'edit';
    else if (createFlag || hash === '#add') mode = 'add';
    else if (hash === '#delete') mode = 'delete';
    else if (hash === '#edit') mode = 'edit';
    if (detailId) {
      const u = await fetchJSONAuth(`/api/admin/employees/${encodeURIComponent(detailId)}`);
      let depts2 = [];
      try { depts2 = await fetchJSONAuth(role2==='manager' ? '/api/manager/departments' : '/api/admin/departments'); } catch { depts2 = []; }
      const deptName2 = (id) => {
        const d = depts2.find(x => String(x.id) === String(id));
        return d ? d.name : '';
      };
      const statusJa2 = (s) => {
        const v = String(s || '').toLowerCase();
        if (v === 'inactive') return '無効';
        if (v === 'retired') return '退職';
        return '在職';
      };
      const fmtDate2 = (d) => {
        if (!d) return '-';
        try { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; } catch { return String(d); }
      };
      content.innerHTML = '<h3>社員詳細</h3>';
      const panel = document.createElement('div');
      panel.innerHTML = `
        <div><strong>社員番号:</strong> ${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}</div>
        <div><strong>氏名:</strong> ${u.username || ''}</div>
        <div><strong>Email:</strong> ${u.email || ''}</div>
        <div><strong>部署:</strong> ${deptName2(u.departmentId)}</div>
        <div><strong>役割:</strong> ${u.role || ''}</div>
        <div><strong>雇用形態:</strong> ${u.employment_type || ''}</div>
        <div><strong>入社日:</strong> ${fmtDate2(u.hire_date || u.join_date)}</div>
        <div><strong>状態:</strong> ${statusJa2(u.employment_status)}</div>
        <div style="margin-top:12px;"><a class="btn" href="/ui/admin?tab=employees&edit=${u.id}">編集</a> <a class="btn" href="/ui/admin?tab=employees">一覧へ</a></div>
      `;
      content.appendChild(panel);
      hideNavSpinner();
      return;
    }
    content.innerHTML = ``;
    renderEmployeesTopbar(mode);
    let users = [];
    let depts = [];
    let errMsgs = [];
    // load users
    try {
      users = await fetchJSONAuth(role2==='manager' ? '/api/manager/users' : '/api/admin/employees');
    } catch (e1) {
      errMsgs.push(`一覧: ${e1?.message || 'unknown'}`);
      if (role2 !== 'manager') {
        try { users = await fetchJSONAuth('/api/admin/users'); } catch (e2) { errMsgs.push(`一覧(予備): ${e2?.message || 'unknown'}`); users = []; }
      } else {
        users = [];
      }
    }
    // load departments
    try {
      depts = await fetchJSONAuth(role2==='manager' ? '/api/manager/departments' : '/api/admin/departments');
    } catch (e3) {
      errMsgs.push(`部署: ${e3?.message || 'unknown'}`);
      depts = [];
    }
    if (errMsgs.length) {
      const msg = document.createElement('div');
      msg.style.color = '#b00020';
      msg.style.margin = '8px 0';
      msg.textContent = `読み込みエラー: ${errMsgs.join(' / ')}`;
      content.appendChild(msg);
    }
    if (editId) {
      const u = await fetchJSONAuth(`/api/admin/employees/${encodeURIComponent(editId)}`);
      content.innerHTML = ``;
      renderEmployeesTopbar('edit');
      const formEdit = document.createElement('form');
      formEdit.innerHTML = `
        <div style="margin-bottom:8px;"><a id="editBack" class="btn" href="#list">← 社員一覧へ戻る</a></div>
        <h4>社員編集（${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}）</h4>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">基本情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">社員番号</td><td>${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}（編集不可）</td></tr>
            <tr><td>氏名</td><td><input id="empName" style="width:240px" value="${u.username || ''}"></td></tr>
            <tr><td>メール</td><td><input id="empEmail" style="width:240px" value="${u.email || ''}"></td></tr>
            <tr><td>パスワード</td><td><input id="empPw" type="password" style="width:240px" placeholder="空欄なら変更なし"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">職務情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d=>`<option value="${d.id}" ${String(u.departmentId||'')===String(d.id)?'selected':''}>${d.name}</option>`).join('')}</select></td></tr>
            <tr><td>役割</td><td>
              <select id="empRole" style="width:240px">
                <option value="employee" ${u.role==='employee'?'selected':''}>employee</option>
                <option value="manager" ${u.role==='manager'?'selected':''}>manager</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
              </select>
            </td></tr>
            <tr><td>雇用形態</td><td>
              <select id="empType" style="width:240px">
                <option value="full_time" ${u.employment_type==='full_time'?'selected':''}>full_time</option>
                <option value="part_time" ${u.employment_type==='part_time'?'selected':''}>part_time</option>
                <option value="contract" ${u.employment_type==='contract'?'selected':''}>contract</option>
              </select>
            </td></tr>
            <tr><td>状態</td><td>
              <select id="empStatus" style="width:240px">
                <option value="active" ${String(u.employment_status||'')==='active'?'selected':''}>在職</option>
                <option value="inactive" ${String(u.employment_status||'')==='inactive'?'selected':''}>無効/休職</option>
                <option value="retired" ${String(u.employment_status||'')==='retired'?'selected':''}>退職</option>
              </select>
            </td></tr>
            <tr><td>入社日</td><td><input id="empHireDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.hire_date || u.join_date || ''}"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">その他</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">備考</td><td><textarea id="empNote" rows="3" style="width:360px">${u.address || ''}</textarea></td></tr>
          </tbody>
        </table>
        <button type="submit">更新</button> <a class="btn" id="btnCancelEdit" href="#list">キャンセル</a>
      `;
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = {
          username: document.querySelector('#empName').value.trim(),
          email: document.querySelector('#empEmail').value.trim(),
          role: document.querySelector('#empRole').value,
          departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value,10) : null,
          employmentType: document.querySelector('#empType').value,
          hireDate: document.querySelector('#empHireDate').value.trim() || null,
          employmentStatus: document.querySelector('#empStatus').value,
          address: (document.querySelector('#empNote').value || '').trim() || null
        };
        await fetchJSONAuth(`/api/admin/employees/${u.id}`, { method: 'PATCH', body: JSON.stringify(b) });
        const newPw = document.querySelector('#empPw').value;
        if (newPw && newPw.length >= 6) {
          await fetchJSONAuth(`/api/admin/users/${u.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPw }) });
        }
        try { history.replaceState(null, '', '#list'); } catch {}
        await renderEmployees();
      });
      formEdit.querySelector('#editBack').addEventListener('click', async (e) => {
        e.preventDefault();
        try { history.replaceState(null, '', '#list'); } catch {}
        await renderEmployees();
      });
      formEdit.querySelector('#btnCancelEdit').addEventListener('click', async (e) => {
        e.preventDefault();
        try { history.replaceState(null, '', '#list'); } catch {}
        await renderEmployees();
      });
      content.appendChild(formEdit);
      hideNavSpinner();
      return;
    }
    if (mode === 'edit') {
      content.innerHTML = `
        <h3 class="excel-header">社員管理</h3>
        <div class="tabs excel">
          <a class="btn" href="#list">社員一覧</a>
          <a class="btn" href="#add">社員追加</a>
          <a class="btn active" href="#edit">社員編集</a>
          <a class="btn" href="#delete">社員削除</a>
          <a class="btn home-btn" id="btnGoHome" href="/ui/portal" style="margin-left:12px;">ホームへ</a>
        </div>
      `;
      const prompt = document.createElement('form');
      prompt.innerHTML = `
        <div class="form-card form-compact form-sm form-narrow">
          <div class="form-title">【社員編集】</div>
          <div class="form-sep"></div>
          <div class="form-grid">
            <div class="form-label">社員番号</div>
            <div class="form-input">
              <span class="bracket"><input id="editKey" placeholder="EMP001 または ID 数字"></span>
            </div>
          </div>
          <div class="form-actions" style="margin-top:8px;">
            <button type="submit">編集へ</button>
          </div>
        </div>
      `;
      prompt.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = (document.querySelector('#editKey').value || '').trim();
        if (!key) return;
        let id = null;
        if (/^\d+$/.test(key)) {
          id = parseInt(key, 10);
        } else {
          try {
            showNavSpinner();
            const list = await Promise.race([
              fetchJSONAuth(role2==='manager' ? '/api/manager/users' : '/api/admin/employees'),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
            ]);
            const f = list.find(u => {
              const code = String(u.employee_code||'').toUpperCase();
              const gen = ('EMP' + String(u.id).padStart(3,'0')).toUpperCase();
              return code === key.toUpperCase() || gen === key.toUpperCase();
            });
            if (f) id = f.id;
          } catch (err) {
            alert(String(err?.message || '読み込みエラー'));
          } finally {
            hideNavSpinner();
          }
        }
        if (!id) return alert('対象が見つかりません');
        window.location.href = `/ui/admin?tab=employees&edit=${id}`;
      });
      content.appendChild(prompt);
      try { document.querySelector('#editKey')?.focus(); } catch {}
      const tabsEl2 = content.querySelector('.tabs');
      if (tabsEl2) {
        tabsEl2.addEventListener('click', async (e) => {
          const a = e.target.closest('.btn');
          if (!a) return;
          const target = a.getAttribute('href') || '#list';
          if (a.id === 'btnGoHome') {
            e.preventDefault();
            try { sessionStorage.setItem('navSpinner', '1'); } catch {}
            showNavSpinner();
            setTimeout(() => { window.location.href = '/ui/portal'; }, 300);
            return;
          }
          if (target.startsWith('#')) {
            e.preventDefault();
            try { history.replaceState(null, '', target); } catch {}
            await renderEmployees();
          }
        });
      }
      hideNavSpinner();
      return;
    }
    if (mode === 'add') {
      const form = document.createElement('form');
      form.id = 'add';
      form.innerHTML = `
        <h4>新規社員</h4>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">基本情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">社員番号</td><td><input id="empCode" style="width:240px"></td></tr>
            <tr><td>氏名</td><td><input id="empName" style="width:240px"></td></tr>
            <tr><td>メール</td><td><input id="empEmail" style="width:240px"></td></tr>
            <tr><td>パスワード</td><td><input id="empPass" type="password" style="width:240px"></td></tr>
            <tr><td>生年月日</td><td><input id="empBirth" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>性別</td><td>
              <select id="empGender" style="width:180px">
                <option value="">未選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </td></tr>
            <tr><td>電話番号</td><td><input id="empPhone" style="width:240px"></td></tr>
            <tr><td>住所</td><td><input id="empAddr" style="width:320px"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">職務情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}</select></td></tr>
            <tr><td>役割</td><td>
              <select id="empRole" style="width:240px">
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </td></tr>
            <tr><td>雇用形態</td><td>
              <select id="empType" style="width:240px">
                <option value="full_time">full_time</option>
                <option value="part_time">part_time</option>
                <option value="contract">contract</option>
              </select>
            </td></tr>
            <tr><td>入社日</td><td><input id="empJoinDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>雇用開始日</td><td><input id="empStartDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>契約終了日（任意）</td><td><input id="empContractEnd" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>給与タイプ</td><td>
              <select id="empSalaryType" style="width:240px">
                <option value="">未選択</option>
                <option value="monthly">月給</option>
                <option value="hourly">時給</option>
                <option value="contract">契約</option>
              </select>
            </td></tr>
            <tr><td>給与額</td><td><input id="empSalaryAmount" type="number" step="0.01" style="width:180px"></td></tr>
            <tr><td>状態</td><td>
              <select id="empStatus" style="width:240px">
                <option value="active">在職</option>
                <option value="inactive">休職/無効</option>
                <option value="retired">退職</option>
              </select>
            </td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">その他</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">プロフィール写真（任意）</td><td><input id="empPhoto" type="file" accept="image/*"></td></tr>
            <tr><td>備考</td><td><textarea id="empNote" rows="3" style="width:360px"></textarea></td></tr>
          </tbody>
        </table>
        <button type="submit">作成</button>
      `;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = {
          employeeCode: document.querySelector('#empCode').value.trim(),
          username: document.querySelector('#empName').value.trim(),
          email: document.querySelector('#empEmail').value.trim(),
          password: document.querySelector('#empPass').value,
          role: document.querySelector('#empRole').value,
          departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value,10) : null,
          employmentType: document.querySelector('#empType').value,
          hireDate: document.querySelector('#empJoinDate').value.trim() || null
        };
        const created = await fetchJSONAuth('/api/admin/employees', { method: 'POST', body: JSON.stringify(b) });
        const id = created?.id;
        const addr = (document.querySelector('#empAddr').value || '').trim();
        const status = document.querySelector('#empStatus').value;
        const patch = {};
        if (addr) patch.address = addr;
        if (status && status !== 'active') patch.employmentStatus = status;
        if (Object.keys(patch).length && id) {
          await fetchJSONAuth(`/api/admin/employees/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
        }
        window.location.href = '/ui/admin?tab=employees#list';
      });
      content.appendChild(form);
      hideNavSpinner();
      return;
    }
    const filterWrap = document.createElement('div');
    filterWrap.style.margin = '12px 0';
    filterWrap.className = 'emp-filters filter-bar';
    const deptOptions = `<option value="">全て</option>${depts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}`;
    filterWrap.innerHTML = `
      <div class="fi">
        <div class="fi-label">検索</div>
        <input id="empSearchName" class="fi-name" placeholder="名前">
      </div>
      <div class="fi">
        <div class="fi-label">部署</div>
        <select id="empDeptFilter" class="fi-dept">${deptOptions}</select>
      </div>
      <div class="fi">
        <button id="toggleAdv" class="toggle-adv" type="button">詳細フィルター</button>
      </div>
      <div class="adv" hidden>
        <div class="fi">
          <div class="fi-label">役割</div>
          <select id="empRoleFilter" class="fi-role"><option value="">全て</option><option value="employee">employee</option><option value="manager">manager</option><option value="admin">admin</option></select>
        </div>
        <div class="fi">
          <div class="fi-label">状態</div>
          <select id="empStatusFilter" class="fi-status"><option value="">全て</option><option value="active">在職</option><option value="inactive">無効</option><option value="retired">退職</option></select>
        </div>
        <div class="fi fi-range">
          <div class="fi-label">入社日</div>
          <input id="empHireFrom" class="fi-date" placeholder="YYYY-MM-DD">
          <span class="fi-sep">〜</span>
          <input id="empHireTo" class="fi-date" placeholder="YYYY-MM-DD">
        </div>
      </div>
      <div class="fi fi-action">
        <button type="button" id="btnEmpSearch" class="btn">検索</button>
      </div>
    `;
    try {
      const subnav = document.querySelector('.subbar .subnav');
      if (subnav) {
        subnav.innerHTML = '';
        subnav.appendChild(filterWrap);
      } else {
        content.appendChild(filterWrap);
      }
    } catch { content.appendChild(filterWrap); }
    const toggleBtn = filterWrap.querySelector('#toggleAdv');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const adv = filterWrap.querySelector('.adv');
        if (!adv) return;
        const hidden = adv.hasAttribute('hidden');
        if (hidden) {
          adv.removeAttribute('hidden');
          filterWrap.classList.add('open');
          toggleBtn.textContent = '簡易表示';
        } else {
          adv.setAttribute('hidden', '');
          filterWrap.classList.remove('open');
          toggleBtn.textContent = '詳細フィルター';
        }
      });
    }
    const state = { q: '', dept: '', role: '', status: '', hireFrom: '', hireTo: '', sortKey: 'id', sortDir: 'desc', page: 1, pageSize: 10 };
    const table = document.createElement('table');
    table.id = 'list';
    table.className = 'excel-table';
    table.style.width = 'auto';
    table.style.minWidth = '640px';
    table.style.tableLayout = 'auto';
    table.innerHTML = `
      <thead>
        <tr>
          ${mode==='delete' ? '<th>選択</th>' : ''}
          <th data-sort="id">社員番号</th>
          <th data-sort="username">氏名</th>
          <th data-sort="email">メール</th>
          <th data-sort="department">部署</th>
          <th data-sort="role">役割</th>
          <th data-sort="employment_type">雇用形態</th>
          <th data-sort="employment_status">状態</th>
          <th data-sort="hire_date">入社日</th>
          <th>操作</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    const pager = document.createElement('div');
    pager.style.margin = '8px 0';
    pager.innerHTML = `
      <button type="button" id="empPrev">前へ</button>
      <span id="empPageInfo" style="margin:0 8px;"></span>
      <button type="button" id="empNext">次へ</button>
      ${mode==='delete' ? '<button type="button" id="empBulkDisable" style="margin-left:12px;background:#b00020;color:#fff;">選択を無効化</button>' : ''}
    `;
    content.appendChild(table);
    content.appendChild(pager);
    const fmtEmpNo = (id) => 'EMP' + String(id).padStart(3, '0');
    const deptName = (id) => {
      const d = depts.find(x => String(x.id) === String(id));
      return d ? d.name : '';
    };
    const statusJa = (s) => {
      const v = String(s || '').toLowerCase();
      if (v === 'inactive') return '無効';
      if (v === 'retired') return '退職';
      return '在職';
    };
    const fmtDate = (d) => {
      if (!d) return '-';
      try { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; } catch { return String(d); }
    };
    const applyFilterSort = () => {
      let arr = users.slice();
      if (state.q) arr = arr.filter(u => String(u.username||'').toLowerCase().includes(state.q));
      if (state.dept) arr = arr.filter(u => String(u.departmentId||'') === String(state.dept));
      if (state.role) arr = arr.filter(u => String(u.role||'') === String(state.role));
      if (state.status) arr = arr.filter(u => String(u.employment_status||'') === String(state.status));
      if (state.hireFrom) {
        arr = arr.filter(u => {
          const d = u.hire_date || u.join_date;
          return d && String(d) >= state.hireFrom;
        });
      }
      if (state.hireTo) {
        arr = arr.filter(u => {
          const d = u.hire_date || u.join_date;
          return d && String(d) <= state.hireTo;
        });
      }
      const key = state.sortKey;
      const dir = state.sortDir === 'asc' ? 1 : -1;
      arr.sort((a,b) => {
        const va = key==='department' ? deptName(a.departmentId) : (key==='hire_date' ? (a.hire_date||'') : (a[key]||''));
        const vb = key==='department' ? deptName(b.departmentId) : (key==='hire_date' ? (b.hire_date||'') : (b[key]||''));
        return (String(va).localeCompare(String(vb))) * dir;
      });
      return arr;
    };
    const renderRows = () => {
      const all = applyFilterSort();
      const total = all.length;
      const start = (state.page - 1) * state.pageSize;
      const pageItems = all.slice(start, start + state.pageSize);
      tbody.innerHTML = '';
      for (const u of pageItems) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          ${mode==='delete' ? `<td><input type="checkbox" class="empSel" value="${u.id}"></td>` : ''}
          <td>${u.employee_code || fmtEmpNo(u.id)}</td>
          <td><a href="/ui/admin?tab=employees&detail=${u.id}">${u.username||''}</a></td>
          <td>${u.email||''}</td>
          <td>${deptName(u.departmentId)}</td>
          <td>${u.role||''}</td>
          <td>${u.employment_type||''}</td>
          <td>${statusJa(u.employment_status)}</td>
          <td>${fmtDate(u.hire_date || u.join_date)}</td>
          <td>
            <a class="btn" href="/ui/admin?tab=employees&detail=${u.id}">詳細</a>
            <a class="btn" href="/ui/admin?tab=employees&edit=${u.id}">編集</a>
            ${role2==='admin' ? `<button class="danger" data-delete="${u.id}">無効化</button>` : ``}
          </td>
        `;
        tbody.appendChild(tr);
      }
      const from = Math.min(total, start + 1);
      const to = Math.min(total, start + pageItems.length);
      const pageInfo = content.querySelector('#empPageInfo');
      if (pageInfo) {
        const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
        pageInfo.textContent = `${from}-${to} / ${total}`;
        if (maxPage <= 1) {
          pageInfo.style.display = 'none';
          const prevEl = content.querySelector('#empPrev');
          const nextEl = content.querySelector('#empNext');
          if (prevEl) prevEl.style.display = 'none';
          if (nextEl) nextEl.style.display = 'none';
        } else {
          pageInfo.style.display = '';
          const prevEl = content.querySelector('#empPrev');
          const nextEl = content.querySelector('#empNext');
          if (prevEl) prevEl.style.display = '';
          if (nextEl) nextEl.style.display = '';
        }
      }
    };
    renderRows();
    table.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      renderRows();
    });
    filterWrap.querySelector('#btnEmpSearch').addEventListener('click', () => {
      state.q = (filterWrap.querySelector('#empSearchName').value || '').trim().toLowerCase();
      state.dept = filterWrap.querySelector('#empDeptFilter').value || '';
      state.role = filterWrap.querySelector('#empRoleFilter').value || '';
      state.status = filterWrap.querySelector('#empStatusFilter').value || '';
      state.hireFrom = (filterWrap.querySelector('#empHireFrom').value || '').trim();
      state.hireTo = (filterWrap.querySelector('#empHireTo').value || '').trim();
      state.page = 1;
      renderRows();
    });
    if (mode === 'delete') {
      pager.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'empBulkDisable') {
          const ids = Array.from(content.querySelectorAll('.empSel:checked')).map(i => i.value);
          if (!ids.length) { alert('対象を選択してください'); return; }
          const overlay = document.createElement('div');
          overlay.className = 'modal-overlay';
          const modal = document.createElement('div');
          modal.className = 'modal';
          const listRows = ids.map(id => {
            const u = users.find(x => String(x.id) === String(id));
            const code = u?.employee_code || fmtEmpNo(id);
            const name = u?.username || '';
            const dept = deptName(u?.departmentId);
            return `<div class="row"><div>${code}</div><div>${name}　${dept}</div></div>`;
          }).join('');
          modal.innerHTML = `
            <div class="modal-head">⚠️　社員無効化の確認</div>
            <div class="modal-body">
              <div>以下の社員を無効化しますか？</div>
              <div class="modal-list">${listRows}</div>
              <div>この操作は取り消すことができません。</div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-danger" id="modalConfirmDisable">無効化する</button>
              <button type="button" class="btn" id="modalCancelDisable">キャンセル</button>
            </div>
          `;
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
          const close = () => { try { document.body.removeChild(overlay); } catch {} };
          overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
          modal.querySelector('#modalCancelDisable').addEventListener('click', close);
          modal.querySelector('#modalConfirmDisable').addEventListener('click', async () => {
            const btn = modal.querySelector('#modalConfirmDisable');
            btn.disabled = true;
            try {
              for (const id of ids) {
                try { await fetchJSONAuth(`/api/admin/employees/${id}`, { method: 'DELETE' }); } catch {}
              }
              users = users.filter(u => !ids.includes(String(u.id)));
              renderRows();
            } finally {
              close();
              alert('無効化しました');
            }
          });
        }
      });
    }
    const prev = pager.querySelector('#empPrev');
    const next = pager.querySelector('#empNext');
    prev.addEventListener('click', () => {
      if (state.page > 1) { state.page -= 1; renderRows(); }
    });
    next.addEventListener('click', () => {
      const total = applyFilterSort().length;
      const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page < maxPage) { state.page += 1; renderRows(); }
    });
    content.addEventListener('click', async (e) => {
      const delId = e.target?.getAttribute?.('data-delete');
      if (delId) {
        if (confirm('この社員を無効化しますか？')) {
          try {
            await fetchJSONAuth(`/api/admin/employees/${delId}`, { method: 'DELETE' });
            alert('無効化しました');
            const idx = users.findIndex(x => String(x.id) === String(delId));
            if (idx >= 0) users.splice(idx,1);
            renderRows();
          } catch (err) {
            alert(String(err?.message || '無効化に失敗しました'));
          }
        }
      }
    });
    hideNavSpinner();
  }
  async function renderAttendance() {
    const users = await fetchJSONAuth('/api/admin/users');
    content.innerHTML = '<h3>勤怠管理</h3>';
    const form = document.createElement('form');
    form.innerHTML = `
      <select id="tsUser">${users.map(u=>`<option value="${u.id}">${u.id} ${u.username||u.email}</option>`).join('')}</select>
      <input id="tsFrom" placeholder="From(YYYY-MM-DD)">
      <input id="tsTo" placeholder="To(YYYY-MM-DD)">
      <button type="submit">表示</button>
      <button type="button" id="tsExport">CSV</button>
    `;
    const resultDiv = document.createElement('div');
    const detailDiv = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = parseInt(document.querySelector('#tsUser').value, 10);
      const from = document.querySelector('#tsFrom').value.trim();
      const to = document.querySelector('#tsTo').value.trim();
      const r = await fetchJSONAuth(`/api/admin/attendance/timesheet?userId=${userId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      resultDiv.innerHTML = '';
      detailDiv.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>日付</th><th>通常</th><th>残業</th><th>深夜</th><th>操作</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const d of (r.days||[])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.date}</td><td>${d.regularMinutes}</td><td>${d.overtimeMinutes}</td><td>${d.nightMinutes}</td><td><button data-day="${d.date}">詳細</button></td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      resultDiv.appendChild(table);
      resultDiv.addEventListener('click', async (ev) => {
        const date = ev.target?.getAttribute?.('data-day');
        if (date) {
          const q = await fetchJSONAuth(`/api/admin/attendance/day?userId=${userId}&date=${encodeURIComponent(date)}`);
          detailDiv.innerHTML = `<h4>${date} 編集</h4>`;
          const t2 = document.createElement('table');
          t2.style.width = '100%';
          t2.innerHTML = '<thead><tr><th>ID</th><th>出勤</th><th>退勤</th><th>保存</th></tr></thead>';
          const b2 = document.createElement('tbody');
          for (const seg of (q.segments||[])) {
            const tr2 = document.createElement('tr');
            tr2.innerHTML = `
              <td>${seg.id}</td>
              <td><input data-in="${seg.id}" value="${seg.checkIn || ''}"></td>
              <td><input data-out="${seg.id}" value="${seg.checkOut || ''}"></td>
              <td><button data-save-att="${seg.id}">保存</button></td>
            `;
            b2.appendChild(tr2);
          }
          t2.appendChild(b2);
          detailDiv.appendChild(t2);
        }
      });
    });
    form.querySelector('#tsExport').addEventListener('click', () => {
      const userId = parseInt(document.querySelector('#tsUser').value, 10);
      const from = document.querySelector('#tsFrom').value.trim();
      const to = document.querySelector('#tsTo').value.trim();
      const url = `/api/admin/export/timesheet.csv?userIds=${userId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      window.open(url, '_blank');
    });
    content.appendChild(form);
    content.appendChild(resultDiv);
    content.appendChild(detailDiv);
    content.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-save-att');
      if (id) {
        const inVal = content.querySelector(`input[data-in="${id}"]`)?.value || null;
        const outVal = content.querySelector(`input[data-out="${id}"]`)?.value || null;
        await fetchJSONAuth(`/api/admin/attendance/${id}`, { method: 'PATCH', body: JSON.stringify({ checkIn: inVal, checkOut: outVal }) });
        alert('保存しました');
      }
    });
  }
  async function renderPayslipUpload() {
    content.innerHTML = '<h3>給与アップロード</h3>';
    const users = await fetchJSONAuth('/api/admin/users');
    const form = document.createElement('form');
    form.enctype = 'multipart/form-data';
    form.innerHTML = `
      <select id="payUser">${users.map(u=>`<option value="${u.id}">${u.id} ${u.username||u.email}</option>`).join('')}</select>
      <input id="payMonth" placeholder="YYYY-MM">
      <input id="payFile" type="file" accept="application/pdf">
      <button type="submit">アップロード</button>
    `;
    const result = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = parseInt(document.querySelector('#payUser').value, 10);
      const month = document.querySelector('#payMonth').value.trim();
      const fileEl = document.querySelector('#payFile');
      if (!fileEl.files || !fileEl.files[0]) return alert('ファイルを選択してください');
      const fd = new FormData();
      fd.append('userId', String(userId));
      fd.append('month', month);
      fd.append('file', fileEl.files[0]);
      let tok = sessionStorage.getItem('accessToken') || '';
      const res = await fetch('/api/payslips/admin/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok }, body: fd, credentials: 'include' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.message || msg; } catch {}
        alert(msg); return;
      }
      const r = await res.json();
      result.textContent = `OK: id=${r.id}, user=${r.userId}, month=${r.month}`;
    });
    content.appendChild(form);
    content.appendChild(result);
  }
  async function renderHome() {
    const r = await fetchJSONAuth('/api/admin/home/stats');
    content.innerHTML = '<h3>ホーム</h3>';
    const box = document.createElement('div');
    box.innerHTML = `
      <div>今日の出勤人数: ${r.todayCheckin}</div>
      <div>遅刻人数: ${r.lateCount}</div>
      <div>休暇人数: ${r.leaveCount}</div>
      <div>未承認申請: ${r.pendingCount}</div>
    `;
    content.appendChild(box);
  }
  async function renderApprovals() {
    content.innerHTML = '<h3>承認フロー</h3>';
    const rows = await fetchJSONAuth('/api/leave/pending');
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>期間</th><th>種類</th><th>状態</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.id}</td><td>${r.userId}</td><td>${r.startDate}〜${r.endDate}</td><td>${r.type}</td><td>${r.status}</td><td><button data-app="${r.id}" data-s="approved">承認</button> <button data-app="${r.id}" data-s="rejected">却下</button></td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    content.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-app');
      const s = e.target?.getAttribute?.('data-s');
      if (id && s) {
        await fetchJSONAuth(`/api/leave/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
        await renderApprovals();
      }
    });
  }
  async function renderReports() {
    content.innerHTML = '<h3>レポート</h3>';
    const block = document.createElement('div');
    block.innerHTML = `
      <h4>勤怠CSV</h4>
      <input id="repUserIds" placeholder="userIds (comma)">
      <input id="repFrom" placeholder="From(YYYY-MM-DD)">
      <input id="repTo" placeholder="To(YYYY-MM-DD)">
      <button id="repExport">エクスポート</button>
      <h4>休日ICS/CSV</h4>
      <input id="repYear" placeholder="Year" value="${new Date().getUTCFullYear()}">
      <button id="repHolidaysIcs">ICS</button>
      <button id="repHolidaysCsv">CSV</button>
    `;
    block.querySelector('#repExport').addEventListener('click', () => {
      const ids = document.querySelector('#repUserIds').value.trim();
      const from = document.querySelector('#repFrom').value.trim();
      const to = document.querySelector('#repTo').value.trim();
      const url = `/api/admin/export/timesheet.csv?userIds=${encodeURIComponent(ids)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      window.open(url, '_blank');
    });
    block.querySelector('#repHolidaysIcs').addEventListener('click', () => {
      const year = parseInt(document.querySelector('#repYear').value, 10);
      const url = `/api/admin/calendar/export?year=${year}`;
      window.open(url, '_blank');
    });
    block.querySelector('#repHolidaysCsv').addEventListener('click', () => {
      const year = parseInt(document.querySelector('#repYear').value, 10);
      const url = `/api/admin/calendar/export.csv?year=${year}`;
      window.open(url, '_blank');
    });
    content.appendChild(block);
  }
  async function renderSalaryList() {
    content.innerHTML = '<h3>給与一覧</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="salUserId" type="number" placeholder="userId(任意)">
      <input id="salMonth" placeholder="YYYY-MM(任意)">
      <button type="submit">表示</button>
    `;
    const result = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.querySelector('#salUserId').value.trim();
      const month = document.querySelector('#salMonth').value.trim();
      const qs = [];
      if (userId) qs.push(`userId=${encodeURIComponent(userId)}`);
      if (month) qs.push(`month=${encodeURIComponent(month)}`);
      const r = await fetchJSONAuth(`/api/admin/salary/history${qs.length ? '?' + qs.join('&') : ''}`);
      result.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>Month</th><th>Created</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const row of (r.data || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.id}</td><td>${row.userId}</td><td>${row.month}</td><td>${row.created_at}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      result.appendChild(table);
    });
    content.appendChild(form);
    content.appendChild(result);
  }
  async function renderSalaryCalc() {
    content.innerHTML = '<h3>給与計算</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const users = await fetchJSONAuth('/api/admin/users');
    const sel = document.createElement('select');
    sel.id = 'salaryUserIds';
    sel.multiple = true;
    sel.style.minWidth = '280px';
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.id} ${u.username || u.email}`;
      sel.appendChild(opt);
    }
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="salaryMonth" placeholder="YYYY-MM">
      <button type="submit">プレビュー</button>
      <button type="button" id="btnCloseMonth">月締め</button>
      <button type="button" id="btnExportCsv">CSV</button>
    `;
    content.appendChild(sel);
    content.appendChild(form);
    const result = document.createElement('div');
    content.appendChild(result);
    function getSelectedIds() {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ids = getSelectedIds();
      const month = document.querySelector('#salaryMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const r = await fetchJSONAuth(`/api/admin/salary?userIds=${encodeURIComponent(ids.join(','))}&month=${encodeURIComponent(month)}`);
      result.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>User</th><th>氏名</th><th>月</th><th>総支給額</th><th>差引支給額</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const e1 of (r.employees || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${e1.userId}</td><td>${e1.氏名 || ''}</td><td>${e1.対象年月}</td><td>${e1.合計?.総支給額 || 0}</td><td>${e1.合計?.差引支給額 || 0}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      result.appendChild(table);
      result.dataset.csv = JSON.stringify(r.employees || []);
    });
    form.querySelector('#btnCloseMonth').addEventListener('click', async () => {
      const ids = getSelectedIds();
      const month = document.querySelector('#salaryMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const r = await fetchJSONAuth('/api/admin/salary/close-month', { method: 'POST', body: JSON.stringify({ userIds: ids.join(','), month }) });
      alert(`締め処理: ${r.closed} 件`);
    });
    form.querySelector('#btnExportCsv').addEventListener('click', () => {
      try {
        const arr = JSON.parse(result.dataset.csv || '[]');
        let csv = 'userId,name,month,total_gross,total_net\n';
        for (const e1 of arr) {
          csv += `${e1.userId},${e1.氏名 || ''},${e1.対象年月},${e1.合計?.総支給額 || 0},${e1.合計?.差引支給額 || 0}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'salary.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    });
  }
  async function renderPayslipSend() {
    content.innerHTML = '<h3>給与明細送信</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const users = await fetchJSONAuth('/api/admin/users');
    const sel = document.createElement('select');
    sel.id = 'sendUserIds';
    sel.multiple = true;
    sel.style.minWidth = '280px';
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.id} ${u.username || u.email}`;
      sel.appendChild(opt);
    }
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="sendMonth" placeholder="YYYY-MM">
      <button type="submit">検索</button>
      <button type="button" id="btnOpenAll">全て開く</button>
      <button type="button" id="btnExportLinks">CSVリンク</button>
    `;
    const result = document.createElement('div');
    const list = document.createElement('ul');
    result.appendChild(list);
    content.appendChild(sel);
    content.appendChild(form);
    content.appendChild(result);
    function getSelectedIds() {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      list.innerHTML = '';
      const ids = getSelectedIds();
      const month = document.querySelector('#sendMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const links = [];
      for (const id of ids) {
        try {
          const r = await fetchJSONAuth(`/api/payslips/admin/list?userId=${encodeURIComponent(id)}&month=${encodeURIComponent(month)}&page=1&pageSize=1`);
          const it = (r.data || [])[0];
          if (it) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = it.secureUrl;
            a.target = '_blank';
            a.textContent = `${id} ${it.originalName || it.month}`;
            li.appendChild(a);
            list.appendChild(li);
            links.push({ userId: id, month: it.month, url: location.origin + it.secureUrl });
          } else {
            const li = document.createElement('li');
            li.textContent = `${id} 該当月の明細なし`;
            list.appendChild(li);
          }
        } catch (err) {
          const li = document.createElement('li');
          li.textContent = `${id} 取得失敗: ${err?.message || 'error'}`;
          list.appendChild(li);
        }
      }
      result.dataset.links = JSON.stringify(links);
    });
    form.querySelector('#btnOpenAll').addEventListener('click', () => {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        for (const l of links) {
          window.open(l.url, '_blank');
        }
      } catch {}
    });
    form.querySelector('#btnExportLinks').addEventListener('click', () => {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        let csv = 'userId,month,url\n';
        for (const l of links) {
          csv += `${l.userId},${l.month},${l.url}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payslip_links.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    });
  }
  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1') {
      showNavSpinner();
    }
  } catch {}
  try {
    if (tab === 'employees') await renderEmployees();
    else if (tab === 'users') await renderUsers();
    else if (tab === 'departments') await renderDepartments();
    else if (tab === 'attendance') await renderAttendance();
    else if (tab === 'approvals') await renderApprovals();
    else if (tab === 'reports') await renderReports();
    else if (tab === 'settings') await renderSettings();
    else if (tab === 'audit') await renderAudit();
    else if (tab === 'refresh') await renderRefresh();
    else if (tab === 'calendar') await renderCalendar();
    else if (tab === 'shifts') await renderShifts();
    else if (tab === 'routes') await renderRoutes();
    else if (tab === 'salary_list') await renderSalaryList();
    else if (tab === 'salary_calc') await renderSalaryCalc();
    else if (tab === 'salary_send') await renderPayslipSend();
    else if (tab === 'payslip_upload') await renderPayslipUpload();
    else {
      await renderHome();
    }
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: ' + (e?.message || 'unknown'); }
  } finally {
    hideNavSpinner();
    try { sessionStorage.removeItem('navSpinner'); } catch {}
  }
  if (status) status.textContent = '';
});
