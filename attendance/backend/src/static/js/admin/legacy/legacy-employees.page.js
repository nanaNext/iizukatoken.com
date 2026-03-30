// @ts-nocheck
import { delegate } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';
import { createPage } from '../../shared/page/createPage.js';
import { createCleanup } from '../../shared/page/createCleanup.js';

let employeesRenderSeq = 0;

async function mountEmployeesImpl({
  content,
  profile,
  listEmployees,
  listUsers,
  listDepartments,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  showNavSpinner,
  hideNavSpinner,
  renderEmployees
}) {
  const cleanup = createCleanup();
  const done = () => cleanup.run();
  let isCurrent = true;
  const controller = new AbortController();
  const signal = controller.signal;
  cleanup.add(() => { isCurrent = false; });
  cleanup.add(() => controller.abort());
  cleanup.add(() => { try { content.innerHTML = ''; } catch { } });

  try {
    const brand = document.querySelector('.topbar .brand');
    const brandHTML = brand ? brand.innerHTML : null;
    cleanup.add(() => {
      try {
        if (brand && brandHTML !== null) brand.innerHTML = brandHTML;
      } catch { }
    });
  } catch { }

  try {
    const contentEl = document.querySelector('#adminContent');
    const contentPaddingTop = contentEl ? contentEl.style.paddingTop : '';
    const contentMarginTop = contentEl ? contentEl.style.marginTop : '';
    const subbarEl = document.querySelector('.subbar');
    const subbarDisplay = subbarEl ? subbarEl.style.display : '';
    cleanup.add(() => {
      try {
        if (contentEl) {
          contentEl.style.paddingTop = contentPaddingTop;
          contentEl.style.marginTop = contentMarginTop;
        }
        if (subbarEl) subbarEl.style.display = subbarDisplay;
      } catch { }
      try {
        document.body.classList.remove('emp-delete-mode');
        document.documentElement.classList.remove('emp-delete-mode');
      } catch { }
    });
  } catch { }
  function renderEmployeesTopbar(mode) {
    try {
      const brand = document.querySelector('.topbar .brand');
      if (brand && document.body.classList.contains('employees-wide')) {
        brand.innerHTML = `
          <img src="/static/images/logo1.png" alt="logo" class="icon">
          <span class="logo">IIZUKA</span>
          <div class="brand-menu" style="display:inline-block;position:relative;margin-left:10px;">
            <button id="brandMenuBtn" class="brand-link">社員管理 ▾</button>
            <div class="dropdown" id="brandDropdown" hidden>
              <a href="#list" class="item" id="brandList">社員一覧</a>
              <a href="#add" class="item" id="brandAdd">社員追加</a>
              <a href="#edit" class="item" id="brandEdit" aria-disabled="true">社員編集</a>
              <a href="#delete" class="item" id="brandDelete">社員削除</a>
            </div>
          </div>
        `;
        const menuBtn = brand.querySelector('#brandMenuBtn');
        const dd = brand.querySelector('#brandDropdown');
        if (menuBtn && dd) {
          menuBtn.addEventListener('click', () => {
            const open = !dd.hasAttribute('hidden');
            if (open) dd.setAttribute('hidden', '');
            else dd.removeAttribute('hidden');
          });
          const onDocClick = (e) => {
            if (!dd) return;
            const inside = e.target.closest('.brand-menu');
            if (!inside) dd.setAttribute('hidden', '');
          };
          document.addEventListener('click', onDocClick);
          cleanup.add(() => { try { document.removeEventListener('click', onDocClick); } catch { } });
          dd.addEventListener('click', async (e) => {
            const a = e.target.closest('a.item');
            if (!a) return;
            e.preventDefault();
            const idSel = Array.from(document.querySelectorAll('.empSel:checked')).map(i => i.value);
            const href = a.getAttribute('href') || '#list';
            if (href === '#list') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#list`); } catch { window.location.href = `/ui/admin?tab=employees#list`; return; }
              await renderEmployees();
            } else if (href === '#add') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#add`); } catch { window.location.href = `/ui/admin?tab=employees#add`; return; }
              await renderEmployees();
            } else if (href === '#edit') {
              if (idSel.length === 1) {
                const id = idSel[0];
                try { history.pushState(null, '', `/ui/admin?tab=employees&edit=${id}`); } catch { window.location.href = `/ui/admin?tab=employees&edit=${id}`; return; }
              } else {
                try { history.pushState(null, '', `/ui/admin?tab=employees#edit`); } catch { window.location.href = `/ui/admin?tab=employees#edit`; return; }
              }
              await renderEmployees();
            } else if (href === '#delete') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#delete`); } catch { window.location.href = `/ui/admin?tab=employees#delete`; return; }
              await renderEmployees();
            }
            dd.setAttribute('hidden', '');
          });
        }
      }
    } catch {}
  }

  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1') showNavSpinner();
  } catch {}
  const seq = ++employeesRenderSeq;
  const params = new URLSearchParams(location.search);
  const detailId = params.get('detail');
  const editId = params.get('edit');
  const createFlag = params.get('create');
  const role2 = String((profile && profile.role) || '').toLowerCase();
  const hash = location.hash || (detailId || editId || createFlag ? '' : '#list');
  let mode = 'list';
  if (editId) mode = 'edit';
  else if (createFlag || hash === '#add') mode = 'add';
  else if (hash === '#delete') mode = 'delete';
  else if (hash === '#edit') mode = 'edit';
  try {
    if (mode === 'list' && location.hash !== '#list') {
      history.replaceState(null, '', '#list');
    }
  } catch {}
  try {
    const contentEl = document.querySelector('#adminContent');
    if (contentEl) {
      contentEl.style.paddingTop = mode === 'delete' ? '0' : '';
      contentEl.style.marginTop = mode === 'delete' ? '-12px' : '';
    }
    const subbarEl = document.querySelector('.subbar');
    if (subbarEl) subbarEl.style.display = mode === 'delete' ? 'none' : '';
    try {
      if (mode === 'delete') {
        document.body.classList.add('emp-delete-mode');
        document.documentElement.classList.add('emp-delete-mode');
      } else {
        document.body.classList.remove('emp-delete-mode');
        document.documentElement.classList.remove('emp-delete-mode');
      }
    } catch {}
    if (mode === 'delete') {
      try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
    }
  } catch {}
  if (detailId) {
    const u = await getEmployee(detailId, { signal });
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    let depts2 = [];
    try { depts2 = role2 === 'manager' ? await api.get('/api/manager/departments', { signal }) : await listDepartments({ signal }); } catch (e) { if (e && e.name === 'AbortError') return done; depts2 = []; }
    if (!isCurrent || seq !== employeesRenderSeq) return done;
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
      if (!d || String(d) === '-' || String(d) === '0000-00-00') return '未登録';
      const raw = String(d);
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}/${m[2]}/${m[3]}`;
      try {
        const x = new Date(raw);
        if (!isNaN(x.getTime())) return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}`;
      } catch {}
      return raw;
    };
    content.innerHTML = '<h3 class="excel-header">社員詳細</h3>';
    const panel = document.createElement('div');
    panel.className = 'card detail-card';
    const roleV = String(u.role || '').toLowerCase();
    const roleJa3 = roleV === 'admin' ? '管理者' : roleV === 'manager' ? 'マネージャー' : roleV === 'employee' ? '従業員' : (u.role || '');
    const roleCls3 = roleV === 'admin' ? 'admin' : roleV === 'manager' ? 'manager' : 'employee';
    const typeV = String(u.employment_type || '').toLowerCase();
    const typeJa3 = typeV === 'full_time' ? '正社員' : typeV === 'part_time' ? 'パート・アルバイト' : typeV === 'contract' ? '契約社員' : (u.employment_type || '');
    const typeCls3 = typeV === 'full_time' ? 'full' : typeV === 'part_time' ? 'part' : typeV === 'contract' ? 'contract' : '';
    const statusV = String(u.employment_status || '').toLowerCase();
    const statusCls3 = statusV === 'retired' ? 'retired' : statusV === 'inactive' ? 'inactive' : 'active';
    const name3 = (u.username || u.email || '').trim();
    const ini3 = name3 ? name3[0].toUpperCase() : '?';
    let mgrName3 = '';
    try {
      const allUsers3 = role2 === 'manager' ? await api.get('/api/manager/users', { signal }) : await listUsers({ signal });
      const mgr3 = allUsers3.find(x => String(x.id) === String(u.manager_id));
      mgrName3 = mgr3 ? (mgr3.username || mgr3.email) : '';
    } catch (e) { if (e && e.name === 'AbortError') return done; }
    const avatarBlock3 = u.avatar_url ? `<img class="avatar-img" src="${u.avatar_url}" alt="avatar">` : `<div class="avatar">${ini3}</div>`;
    panel.innerHTML = `
      <div class="head">
        ${avatarBlock3}
        <div class="info">
          <div class="title">${u.username || ''}</div>
          <div class="subtitle">${u.email || ''}</div>
        </div>
        <span class="status-pill ${statusCls3}">${statusJa2(u.employment_status)}</span>
      </div>
      <div class="detail-row"><div class="label">社員番号</div><div class="value">${u.employee_code || ('EMP' + String(u.id).padStart(3, '0'))}</div></div>
      <div class="detail-row"><div class="label">氏名</div><div class="value">${u.username || ''}</div></div>
      <div class="detail-row"><div class="label">Email</div><div class="value">${u.email || ''}</div></div>
      <div class="detail-row"><div class="label">電話番号</div><div class="value">${u.phone || ''}</div></div>
      <div class="detail-row"><div class="label">生年月日</div><div class="value">${fmtDate2(u.birth_date)}</div></div>
      <div class="detail-row"><div class="label">部署</div><div class="value">${deptName2(u.departmentId)}</div></div>
      <div class="detail-row"><div class="label">直属マネージャー</div><div class="value">${mgrName3}</div></div>
      <div class="detail-row"><div class="label">レベル</div><div class="value">${u.level || ''}</div></div>
      <div class="detail-row"><div class="label">役割</div><div class="value"><span class="role-pill ${roleCls3}">${roleJa3}</span></div></div>
      <div class="detail-row"><div class="label">雇用形態</div><div class="value"><span class="type-pill ${typeCls3}">${typeJa3}</span></div></div>
      <div class="detail-row"><div class="label">入社日</div><div class="value">${fmtDate2(u.hire_date)}</div></div>
      <div class="detail-row"><div class="label">試用開始</div><div class="value">${fmtDate2(u.probation_date)}</div></div>
      <div class="detail-row"><div class="label">正社員化</div><div class="value">${fmtDate2(u.official_date)}</div></div>
      <div class="detail-row"><div class="label">契約終了</div><div class="value">${fmtDate2(u.contract_end)}</div></div>
      <div class="detail-row"><div class="label">基本給</div><div class="value">${u.base_salary == null ? '' : u.base_salary}</div></div>
      <div class="detail-row"><div class="label">状態</div><div class="value"><span class="status-pill ${statusCls3}">${statusJa2(u.employment_status)}</span></div></div>
      <div class="detail-actions form-actions"><a class="btn" href="/ui/admin?tab=employees&edit=${u.id}">編集</a><a class="btn" href="/ui/admin?tab=employees">一覧へ</a></div>
    `;
    content.appendChild(panel);
    try {
      const listKeys = ['q', 'dept', 'role', 'status', 'hireFrom', 'hireTo', 'sortKey', 'sortDir', 'page'];
      const keep = new URLSearchParams();
      for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
      const qsKeep = keep.toString();
      const backHref = `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`;
      const editHref = `/ui/admin?tab=employees&edit=${u.id}${qsKeep ? '&' + qsKeep : ''}`;
      const aEls = panel.querySelectorAll('a.btn');
      if (aEls && aEls.length >= 2) {
        aEls[0].setAttribute('href', editHref);
        aEls[1].setAttribute('href', backHref);
      }
    } catch {}
    hideNavSpinner();
    return done;
  }

  content.innerHTML = ``;
  renderEmployeesTopbar(mode);
  let users = [];
  let depts = [];
  let errMsgs = [];
  try {
    users = role2 === 'manager' ? await api.get('/api/manager/users', { signal }) : await listEmployees({ signal });
  } catch (e1) {
    if (e1 && e1.name === 'AbortError') return done;
    errMsgs.push(`一覧: ${(e1 && e1.message) ? e1.message : 'unknown'}`);
    if (role2 !== 'manager') {
      try { users = await listUsers({ signal }); } catch (e2) { if (e2 && e2.name === 'AbortError') return done; errMsgs.push(`一覧(予備): ${(e2 && e2.message) ? e2.message : 'unknown'}`); users = []; }
    } else {
      users = [];
    }
  }
  if (!isCurrent || seq !== employeesRenderSeq) return done;
  try {
    depts = role2 === 'manager' ? await api.get('/api/manager/departments', { signal }) : await listDepartments({ signal });
  } catch (e3) {
    if (e3 && e3.name === 'AbortError') return done;
    errMsgs.push(`部署: ${(e3 && e3.message) ? e3.message : 'unknown'}`);
    depts = [];
  }
  if (!isCurrent || seq !== employeesRenderSeq) return done;
  if (errMsgs.length) {
    const msg = document.createElement('div');
    msg.style.color = '#b00020';
    msg.style.margin = '8px 0';
    msg.textContent = `読み込みエラー: ${errMsgs.join(' / ')}`;
    content.appendChild(msg);
  }
  if (editId) {
    const u = await getEmployee(editId, { signal });
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    content.innerHTML = ``;
    renderEmployeesTopbar('edit');
    const formEdit = document.createElement('form');
    formEdit.innerHTML = `
      <div style="margin-bottom:8px;"><a id="editBack" class="btn" href="#list">← 社員一覧へ戻る</a></div>
      <h4>社員編集（${u.employee_code || ('EMP' + String(u.id).padStart(3, '0'))}）</h4>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">基本情報</th></tr></thead>
        <tbody>
          <tr><td style="width:180px;">社員番号</td><td>${u.employee_code || ('EMP' + String(u.id).padStart(3, '0'))}</td></tr>
          <tr><td>氏名</td><td><input id="empName" style="width:240px" value="${u.username || ''}"></td></tr>
          <tr><td>メール</td><td><input id="empEmail" style="width:240px" value="${u.email || ''}"></td></tr>
          <tr><td>パスワード</td><td><input id="empPw" type="password" style="width:240px" placeholder="空欄なら変更なし"></td></tr>
        </tbody>
      </table>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">職務情報</th></tr></thead>
        <tbody>
          <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d => `<option value="${d.id}" ${String(u.departmentId || '') === String(d.id) ? 'selected' : ''}>${d.name}</option>`).join('')}</select></td></tr>
          <tr><td>役割</td><td>
            <select id="empRole" style="width:240px">
              <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>従業員</option>
              <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>マネージャー</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理者</option>
            </select>
          </td></tr>
          <tr><td>雇用形態</td><td>
            <select id="empType" style="width:240px">
              <option value="full_time" ${u.employment_type === 'full_time' ? 'selected' : ''}>正社員</option>
              <option value="part_time" ${u.employment_type === 'part_time' ? 'selected' : ''}>パート・アルバイト</option>
              <option value="contract" ${u.employment_type === 'contract' ? 'selected' : ''}>契約社員</option>
            </select>
          </td></tr>
          <tr><td>状態</td><td>
            <select id="empStatus" style="width:240px">
              <option value="active" ${String(u.employment_status || '') === 'active' ? 'selected' : ''}>在職</option>
              <option value="inactive" ${String(u.employment_status || '') === 'inactive' ? 'selected' : ''}>無効/休職</option>
              <option value="retired" ${String(u.employment_status || '') === 'retired' ? 'selected' : ''}>退職</option>
            </select>
          </td></tr>
          <tr><td>直属マネージャー</td><td>
            <select id="empManager" style="width:240px"><option value="">未設定</option>${users.filter(x => x.role === 'manager').map(m => `<option value="${m.id}" ${String(u.manager_id || '') === String(m.id) ? 'selected' : ''}>${m.username || m.email}</option>`).join('')}</select>
          </td></tr>
          <tr><td>レベル</td><td><input id="empLevel" style="width:180px" value="${u.level || ''}" placeholder="例: L1/L2/Senior"></td></tr>
          <tr><td>入社日</td><td><input id="empHireDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.hire_date || u.join_date || ''}"></td></tr>
          <tr><td>試用開始</td><td><input id="empProbDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.probation_date || ''}"></td></tr>
          <tr><td>正社員化</td><td><input id="empOfficialDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.official_date || ''}"></td></tr>
          <tr><td>契約終了</td><td><input id="empContractEnd" placeholder="YYYY-MM-DD" style="width:180px" value="${u.contract_end || ''}"></td></tr>
          <tr><td>基本給</td><td><input id="empBaseSalary" type="number" step="0.01" style="width:180px" value="${u.base_salary == null ? '' : u.base_salary}" placeholder="円"></td></tr>
        </tbody>
      </table>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">その他</th></tr></thead>
        <tbody>
          <tr><td style="width:180px;">生年月日</td><td><input id="empBirth" placeholder="YYYY-MM-DD" style="width:180px" value="${u.birth_date || ''}"></td></tr>
          <tr><td>性別</td><td><select id="empGender" style="width:180px"><option value="">未設定</option><option value="male" ${u.gender === 'male' ? 'selected' : ''}>男</option><option value="female" ${u.gender === 'female' ? 'selected' : ''}>女</option><option value="other" ${u.gender === 'other' ? 'selected' : ''}>その他</option></select></td></tr>
          <tr><td>電話番号</td><td><input id="empPhone" style="width:240px" value="${u.phone || ''}"></td></tr>
          <tr><td>住所</td><td><input id="empAddr" style="width:320px" value="${u.address || ''}"></td></tr>
          <tr><td>プロフィール写真（アップロード）</td><td><input id="empAvatarFile" type="file" accept="image/*"> <button type="button" id="btnAvatarUpload">アップロード</button> <span id="avatarUploadStatus" style="margin-left:8px;color:#334155;"></span></td></tr>
        </tbody>
      </table>
      <div class="form-actions" style="justify-content:flex-end;">
        <button type="submit" class="btn-primary">更新</button>
        <a class="btn" id="btnCancelEdit" href="#list">キャンセル</a>
      </div>
    `;
    try {
      const listKeys = ['q', 'dept', 'role', 'status', 'hireFrom', 'hireTo', 'sortKey', 'sortDir', 'page', 'code', 'showAll'];
      const keep = new URLSearchParams();
      for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
      const qsKeep = keep.toString();
      const backHref = `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`;
      const backA = formEdit.querySelector('#editBack');
      const cancelA = formEdit.querySelector('#btnCancelEdit');
      if (backA) backA.setAttribute('href', backHref);
      if (cancelA) cancelA.setAttribute('href', backHref);
    } catch {}
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = {
        username: document.querySelector('#empName').value.trim(),
        email: document.querySelector('#empEmail').value.trim(),
        role: document.querySelector('#empRole').value,
        departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value, 10) : null,
        level: (document.querySelector('#empLevel').value || '').trim() || null,
        managerId: document.querySelector('#empManager').value ? parseInt(document.querySelector('#empManager').value, 10) : null,
        employmentType: document.querySelector('#empType').value,
        hireDate: document.querySelector('#empHireDate').value.trim() || null,
        probationDate: document.querySelector('#empProbDate').value.trim() || null,
        officialDate: document.querySelector('#empOfficialDate').value.trim() || null,
        contractEnd: document.querySelector('#empContractEnd').value.trim() || null,
        baseSalary: (document.querySelector('#empBaseSalary').value || '').trim() || null,
        birthDate: document.querySelector('#empBirth').value.trim() || null,
        gender: document.querySelector('#empGender').value || null,
        phone: (document.querySelector('#empPhone').value || '').trim() || null,
        employmentStatus: document.querySelector('#empStatus').value,
        address: (document.querySelector('#empAddr').value || '').trim() || null
      };
      await updateEmployee(u.id, b, { signal });
      const newPw = document.querySelector('#empPw').value;
      if (newPw && newPw.length >= 6) {
        await api.patch(`/api/admin/users/${u.id}/password`, { password: newPw }, { signal });
      }
      try {
        const listKeys = ['q', 'dept', 'role', 'status', 'hireFrom', 'hireTo', 'sortKey', 'sortDir', 'page', 'code', 'showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees();
    });
    const btnAvatar = formEdit.querySelector('#btnAvatarUpload');
    if (btnAvatar) {
      btnAvatar.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const fileEl = formEdit.querySelector('#empAvatarFile');
          const statusEl = formEdit.querySelector('#avatarUploadStatus');
          if (!fileEl || !fileEl.files || !fileEl.files[0]) { if (statusEl) statusEl.textContent = 'ファイル未選択'; return; }
          const fd = new FormData();
          fd.append('file', fileEl.files[0]);
          await api.upload(`/api/admin/employees/${encodeURIComponent(u.id)}/avatar`, fd, { signal });
          if (statusEl) statusEl.textContent = 'アップロード完了';
        } catch (err) {}
      });
    }
    formEdit.querySelector('#editBack').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const listKeys = ['q', 'dept', 'role', 'status', 'hireFrom', 'hireTo', 'sortKey', 'sortDir', 'page', 'code', 'showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees();
    });
    formEdit.querySelector('#btnCancelEdit').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const listKeys = ['q', 'dept', 'role', 'status', 'hireFrom', 'hireTo', 'sortKey', 'sortDir', 'page', 'code', 'showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees();
    });
    content.appendChild(formEdit);
    hideNavSpinner();
    return done;
  }

  if (mode === 'edit') {
    content.innerHTML = ``;
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
        <div id="editKeyErr" style="color:#b00020;display:none;margin-top:8px;"></div>
        <div class="form-actions" style="margin-top:8px;">
          <button type="submit">編集へ</button>
        </div>
      </div>
    `;
    prompt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = prompt.querySelector('#editKeyErr');
      const key = (document.querySelector('#editKey').value || '').trim();
      if (!key) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = '社員番号を入力してください。'; }
        try { const el = document.querySelector('#editKey'); if (el && el.focus) el.focus(); } catch {}
        return;
      }
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      let id = null;
      if (/^\d+$/.test(key)) {
        id = parseInt(key, 10);
      } else {
        try {
          showNavSpinner();
          const list = await Promise.race([
              api.get(role2 === 'manager' ? '/api/manager/users' : '/api/admin/employees', { signal }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
          ]);
          const f = list.find(u => {
            const code = String(u.employee_code || '').toUpperCase();
            const gen = ('EMP' + String(u.id).padStart(3, '0')).toUpperCase();
            return code === key.toUpperCase() || gen === key.toUpperCase();
          });
          if (f) id = f.id;
        } catch (err) {
          alert(String((err && err.message) ? err.message : '読み込みエラー'));
        } finally {
          hideNavSpinner();
        }
      }
      if (!id) return alert('対象が見つかりません');
      window.location.href = `/ui/admin?tab=employees&edit=${id}`;
    });
    content.appendChild(prompt);
    try { const el = document.querySelector('#editKey'); if (el && el.focus) el.focus(); } catch {}
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
          try { history.pushState(null, '', `/ui/admin?tab=employees${target}`); } catch { window.location.href = `/ui/admin?tab=employees${target}`; return; }
          await renderEmployees();
        }
      });
    }
    hideNavSpinner();
    return done;
  }

  if (mode === 'add') {
    const form = document.createElement('form');
    form.id = 'add';
    let managers = [];
    try { managers = await listUsers({ signal }); } catch (e) { if (e && e.name === 'AbortError') return done; managers = []; }
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    const managerOptions = managers.filter(m => String(m.role) === 'manager').map(m => `<option value="${m.id}">${m.username || m.email}</option>`).join('');
    form.innerHTML = `
      <div class="form-title">【新規社員】</div>
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
          <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select></td></tr>
          <tr><td>役割</td><td>
            <select id="empRole" style="width:240px">
              <option value="employee">従業員</option>
              <option value="manager">マネージャー</option>
              <option value="admin">管理者</option>
            </select>
          </td></tr>
          <tr><td>直属マネージャー</td><td><select id="empManager" style="width:240px"><option value="">未設定</option>${managerOptions}</select></td></tr>
          <tr><td>レベル</td><td><input id="empLevel" style="width:180px" placeholder="例: L1/L2/Senior"></td></tr>
          <tr><td>雇用形態</td><td>
            <select id="empType" style="width:240px">
              <option value="full_time">正社員</option>
              <option value="part_time">パート・アルバイト</option>
              <option value="contract">契約社員</option>
            </select>
          </td></tr>
          <tr><td>入社日</td><td><input id="empJoinDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
          <tr><td>試用開始</td><td><input id="empProbDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
          <tr><td>正社員化</td><td><input id="empOfficialDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
          <tr><td>契約終了日（任意）</td><td><input id="empContractEnd" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
          <tr><td>基本給</td><td><input id="empBaseSalary" type="number" step="0.01" style="width:180px" placeholder="円"></td></tr>
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
          <tr><td style="width:180px;">プロフィール写真URL（任意）</td><td><input id="empAvatarUrl" style="width:320px" placeholder="https://..."></td></tr>
          <tr><td>プロフィール写真（アップロード）</td><td><input id="empAvatarFile" type="file" accept="image/*"></td></tr>
        </tbody>
      </table>
      <div class="form-actions" style="justify-content:flex-end;">
        <button type="submit" class="btn-primary">作成</button>
      </div>
      <div id="empCreateMsg" style="margin-top:10px;color:#0f172a;font-weight:600;"></div>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgEl = form.querySelector('#empCreateMsg');
      const btn = form.querySelector('button[type="submit"]');
      const b = {
        employeeCode: document.querySelector('#empCode').value.trim(),
        username: document.querySelector('#empName').value.trim(),
        email: document.querySelector('#empEmail').value.trim(),
        password: document.querySelector('#empPass').value,
        role: document.querySelector('#empRole').value,
        departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value, 10) : null,
        level: (document.querySelector('#empLevel').value || '').trim() || null,
        managerId: document.querySelector('#empManager').value ? parseInt(document.querySelector('#empManager').value, 10) : null,
        employmentType: document.querySelector('#empType').value,
        hireDate: document.querySelector('#empJoinDate').value.trim() || null,
        probationDate: document.querySelector('#empProbDate').value.trim() || null,
        officialDate: document.querySelector('#empOfficialDate').value.trim() || null,
        contractEnd: document.querySelector('#empContractEnd').value.trim() || null,
        baseSalary: (document.querySelector('#empBaseSalary').value || '').trim() || null,
        birthDate: document.querySelector('#empBirth').value.trim() || null,
        gender: document.querySelector('#empGender').value || null,
        phone: (document.querySelector('#empPhone').value || '').trim() || null,
        address: (document.querySelector('#empAddr').value || '').trim() || null,
        employmentStatus: document.querySelector('#empStatus').value,
        avatarUrl: (document.querySelector('#empAvatarUrl').value || '').trim() || null
      };
      if (!b.username || !b.email || !b.password) {
        if (msgEl) { msgEl.style.color = '#b00020'; msgEl.textContent = '氏名・メール・パスワードは必須です。'; }
        return;
      }
      const ok = window.confirm('保存しますか？');
      if (!ok) return;
      if (msgEl) { msgEl.style.color = '#0f172a'; msgEl.textContent = '保存中…'; }
      if (btn) btn.disabled = true;
      try {
        const r = await createEmployee(b, { signal });
        try {
          const fileEl = document.querySelector('#empAvatarFile');
          if (fileEl && fileEl.files && fileEl.files[0] && r && r.id) {
            const fd = new FormData();
            fd.append('file', fileEl.files[0]);
              await api.upload(`/api/admin/employees/${encodeURIComponent(r.id)}/avatar`, fd, { signal });
          }
        } catch {}
        if (msgEl) { msgEl.style.color = '#0f172a'; msgEl.textContent = '保存しました（1名追加）'; }
        try { sessionStorage.setItem('navSpinner', '1'); } catch {}
        setTimeout(() => { window.location.href = '/ui/admin?tab=employees#list'; }, 350);
      } catch (err) {
        const m = String((err && err.message) ? err.message : '');
        const low = m.toLowerCase();
        if (msgEl) {
          msgEl.style.color = '#b00020';
          if (m.includes('社員番号') || low.includes('uniq_employee_code') || low.includes('duplicate entry')) {
            msgEl.textContent = '社員番号が既に存在します。別の番号を入力してください。';
            try { const el = document.querySelector('#empCode'); if (el && el.focus) el.focus(); } catch {}
          } else if (m.includes('Email') || low.includes('email')) {
            msgEl.textContent = m;
            try { const el = document.querySelector('#empEmail'); if (el && el.focus) el.focus(); } catch {}
          } else {
            msgEl.textContent = '保存失敗: ' + (m || 'error');
          }
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    content.appendChild(form);
    hideNavSpinner();
    return done;
  }

  const filterWrap = document.createElement('div');
  filterWrap.style.margin = mode === 'delete' ? '0 0 8px' : '12px 0';
  filterWrap.className = mode === 'delete' ? 'emp-filters emp-del-wrap' : 'emp-filters filter-bar';
  const deptOptions = `<option value="">全て</option>${depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}`;
  if (mode === 'delete') {
    filterWrap.innerHTML = `
      <table class="excel-table emp-del-filter" style="margin:0 0 10px; width:720px; min-width:680px;">
        <thead>
          <tr>
            <th colspan="2">
              <div class="del-head"><div class="form-title">【社員削除】</div></div>
            </th>
          </tr>
          <tr>
            <th colspan="2">
              <div class="del-tabs">
                <button type="button" id="tabSearch" class="tab active">社員検索</button>
                <button type="button" id="tabShowAll" class="tab">全員表示</button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="width:120px;">社員番号</td>
            <td><input id="empSearchCode" placeholder="EMP番号/コード" style="width: 240px;"></td>
          </tr>
          <tr>
            <td style="width:120px;">名前</td>
            <td><input id="empSearchName" placeholder="名前" style="width: 240px;"></td>
          </tr>
          <tr>
            <td>部署</td>
            <td><select id="empDeptFilter">${deptOptions}</select></td>
          </tr>
          <tr>
            <td>役割</td>
            <td><select id="empRoleFilter"><option value="">全て</option><option value="employee">従業員</option><option value="manager">マネージャー</option><option value="admin">管理者</option></select></td>
          </tr>
          <tr style="display:none;">
            <td>状態</td>
            <td><select id="empStatusFilter"><option value="">全て</option><option value="active">在職</option><option value="inactive">無効</option><option value="retired">退職</option></select></td>
          </tr>
          <tr>
            <td>入社日</td>
            <td>
              <div class="date-range">
                <input id="empHireFrom" placeholder="YYYY-MM-DD">
                <span class="tilde">〜</span>
                <input id="empHireTo" placeholder="YYYY-MM-DD">
              </div>
            </td>
          </tr>
          <tr>
            <td></td>
            <td class="actions"><button type="button" id="btnEmpSearch" class="btn btn-search">検索</button></td>
          </tr>
        </tbody>
      </table>
      <div id="empListBox" style="display:none"></div>
    `;
  } else {
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
          <select id="empRoleFilter" class="fi-role"><option value="">全て</option><option value="employee">従業員</option><option value="manager">マネージャー</option><option value="admin">管理者</option></select>
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
  }

  try {
    const subnav = document.querySelector('.subbar .subnav');
    if (subnav) {
      if (mode === 'delete') {
        subnav.innerHTML = '';
        subnav.style.display = 'none';
        filterWrap.style.position = 'static';
        filterWrap.style.zIndex = 'auto';
        content.appendChild(filterWrap);
        try {
          let style = document.querySelector('#empDelFilterStyle');
          if (!style) {
            style = document.createElement('style');
            style.id = 'empDelFilterStyle';
            style.textContent = `
              html.emp-delete-mode, body.emp-delete-mode { height: 100%; overflow: hidden; }
              .admin.emp-delete-mode .content { height: 100vh; overflow: hidden; box-sizing: border-box; }
              .admin.emp-delete-mode #adminContent { height: calc(100vh - var(--topbar-height) - 24px); overflow: hidden; }
              .emp-del-wrap { display: flex; flex-direction: column; max-width: 1300px; width: 100%; margin: 0 auto; padding: 8px 12px; height: 100%; box-sizing: border-box; }
              .del-head { display: inline-flex; margin-bottom: 0; }
              .del-tabs { display: inline-flex; gap: 8px; margin-bottom: 0; }
              .del-tabs .tab { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid #d0d8e4; background: #f3f6fb; color: #1f3b63; }
              .del-tabs .tab.active { background: #2b6cb0; color: #fff; border-color: #1e4e8c; }

              .emp-del-filter { table-layout: fixed; border-collapse: separate; border-spacing: 0; background: #fff; border: 1px solid #e5eaf0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
              .emp-del-filter thead th { background: #eaf2ff; color:#0d2c5b; font-weight:600; border-bottom:1px solid #e1e8f5; }
              .emp-del-filter tbody tr { height: 42px; }
              .emp-del-filter tbody tr td:first-child { width: 140px; white-space: nowrap; color: #0d2c5b; background:#f8fbff; border-right:1px solid #e3edf8; }
              .emp-del-filter tbody tr td:not(.actions) > * { width: 100%; }
              .emp-del-filter tbody td { padding: 10px 12px; vertical-align: middle; border-top: 1px solid #eef2f7; }
              .emp-del-filter input,
              .emp-del-filter select {
                height: 36px;
                border-radius: 10px;
                background: #fcfdff;
                border: 1.5px solid #bcd0e6;
                padding: 6px 12px;
                box-sizing: border-box;
                display: block;
              }
              .emp-del-filter input::placeholder { color: #94a3b8; }
              .emp-del-filter input:focus,
              .emp-del-filter select:focus {
                border-color: #2b67b3;
                box-shadow: 0 0 0 3px rgba(43,103,179,.12);
                outline: none;
              }
              .emp-del-filter td.actions { text-align: center; }
              .emp-del-filter .date-range { display: flex; align-items: center; gap: 6px; }
              .emp-del-filter .date-range input { flex: 1 1 0; display: inline-block; min-width: 160px; }
              .emp-del-filter .date-range .tilde { width: 12px; text-align: center; color: #64748b; }
              .emp-del-filter .btn-search {
                height: 36px;
                border-radius: 10px;
                padding: 0 16px;
                background: #2b6cb0;
                border: 1px solid #1e4e8c;
                color: #fff;
                transition: background-color .15s ease, border-color .15s ease;
              }
              .emp-del-filter .btn-search:hover { background: #255ea7; border-color: #1e4e8c; }
              .emp-del-filter .btn-search:active { background: #1f4e8a; border-color: #163b6e; }
              .emp-del-filter .btn.full { width: 100%; }

              #empListBox { display:block; width:100%; margin-top:0; overflow: auto; flex: 1 1 auto; min-height: 0; }

              .emp-del-list {
                width: 100%;
                table-layout: fixed;
                border-collapse: separate;
                border-spacing: 0;
                background: #f5f5f5;
                border: 1px solid #9ca3af;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 1px 2px rgba(16,24,40,.06);
              }
              .emp-del-list thead { position: static; }
              .emp-del-list thead th {
                background: #f3f4f6;
                text-align: center !important;
                vertical-align: middle;
                color: #111827;
                font-weight: 600;
                border-bottom: 2px solid #9ca3af;
                position: static;
                box-shadow: 0 1px 0 rgba(16,24,40,.06);
              }
              .emp-del-list thead th > * { margin-left: auto; margin-right: auto; }
              .emp-del-list tbody td {
                padding: 4px 8px;
                text-align: left;
                vertical-align: middle;
                background: #fff;
                border-bottom: 1px solid #9ca3af;
                border-right: 1px solid #d1d5db;
                color: #0f172a;
                font-size: 12px;
              }
              .emp-del-list tbody tr:hover td { background: #fff; }
              .emp-del-list tbody tr:last-child td { border-bottom: 0; }
              .emp-del-list tbody tr td:first-child { border-left: 2px solid #9ca3af; }
              .emp-del-list tbody tr td:last-child { border-right: 0; }
              .emp-del-list th, .emp-del-list td { white-space: nowrap; overflow: visible; text-overflow: clip; }
              .emp-del-list td:last-child > div { justify-content: flex-start; }

              .emp-del-list thead th:nth-child(1), .emp-del-list tbody td:nth-child(1) { width: 32px; text-align: center; }
              .emp-del-list thead th:nth-child(2), .emp-del-list tbody td:nth-child(2) { width: 92px; }
              .emp-del-list thead th:nth-child(3), .emp-del-list tbody td:nth-child(3) { width: 140px; }
              .emp-del-list thead th:nth-child(4), .emp-del-list tbody td:nth-child(4) { width: 240px; }
              .emp-del-list thead th:nth-child(5), .emp-del-list tbody td:nth-child(5) { width: 180px; }
              .emp-del-list thead th:nth-child(1), .emp-del-list tbody td:nth-child(1) { width: 40px; text-align: center; }
              .emp-del-list thead th:nth-child(6), .emp-del-list tbody td:nth-child(6) { width: 96px; text-align: center; }
              .emp-del-list thead th:nth-child(7), .emp-del-list tbody td:nth-child(7) { width: 110px; text-align: center; }
              .emp-del-list thead th:nth-child(8), .emp-del-list tbody td:nth-child(8) { width: 90px; text-align: center; }
              .emp-del-list thead th:nth-child(9), .emp-del-list tbody td:nth-child(9) { width: 110px; text-align: center; }
              .emp-del-list thead th:nth-child(10), .emp-del-list tbody td:nth-child(10) { width: 190px; }

              .emp-del-list tbody td:nth-child(1) { padding: 2px 4px; line-height: 1; }
              .emp-del-list td:nth-child(1) input[type="checkbox"] { display:block; margin:0 auto; width:16px; height:16px; appearance:auto; }
              .status-pill { display: inline-flex; align-items: center; justify-content: flex-start; min-height: auto; padding: 0; border-radius: 0; border: none; font-weight: 400; font-size: 14px !important; line-height: 1.4; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; background: transparent; }
              .status-pill.active { color: #1b7c3f; }
              .status-pill.inactive { color: #8a6d00; }
              .status-pill.retired { color: #6b7280; }

              .emp-action-group { display:flex; gap:8px; align-items:center; flex-wrap:nowrap; }
              .emp-action {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                height: 34px;
                padding: 0 16px;
                border-radius: 8px;
                border: 1px solid #d0d8e4;
                background: #fff;
                color: #1f3b63;
                text-decoration: none;
                font-size: 16px;
                cursor: pointer;
              }
              .emp-action:hover { background: #f3f7ff; border-color: #c3d2ea; }
              .emp-action:active { background: #eaf2ff; border-color: #b6c8e5; }
              .emp-action.danger { background: #eef2ff; border-color: #c7d2fe; color: #1e40af; }
              .emp-action.danger:hover { background: #e0e7ff; border-color: #a5b4fc; }
              .admin .card .excel-table .emp-action-group .emp-action { font-size: 16px !important; height: 34px !important; padding: 0 16px !important; gap: 8px !important; }
              .admin .card .excel-table .emp-action-group .emp-action.danger { font-size: 16px !important; }
              .pager-right { margin-left: auto; display: inline-flex; align-items: center; }
              .emp-del-toolbar { display: flex; justify-content: flex-end; margin: 8px 0 0; position: static; top: auto; z-index: auto; background: transparent; }
              .emp-bulk-disable {
                height: 36px;
                border-radius: 10px;
                padding: 0 16px;
                background: linear-gradient(180deg, #2b6cb0 0%, #255ea7 100%);
                border: 1px solid #1e4e8c;
                color: #fff;
                font-weight: 600;
                letter-spacing: .03em;
                box-shadow: 0 1px 2px rgba(16,24,40,.06);
                transition: background-color .15s ease, border-color .15s ease, transform .02s ease;
              }
              .emp-bulk-disable:hover { background: linear-gradient(180deg, #336fb3 0%, #2b62a9 100%); border-color: #1e4e8c; }
              .emp-bulk-disable:active { transform: translateY(1px); }
              .emp-bulk-disable:focus { outline: 3px solid rgba(43,103,179,.20); outline-offset: 2px; }
              .admin .card { --emp-pill-width: max-content; }
              .admin .card table#list { width: 100%; }

              .text-pill { display:inline-flex; align-items:center; min-height:auto; padding:0; border-radius:0; border:none; background:transparent; color:#1f2937; font-size:14px !important; line-height:1.4; box-sizing:border-box; justify-content:flex-start; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
              .text-pill.neutral { background:transparent; border:none; color:#1f2937; }
              .text-pill a { color: #1e40af; text-decoration: none; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; display:block; width:100%; line-height:inherit; }
              .text-pill a:hover { text-decoration: underline; color: #1e3a8a; }
              .admin .card table#list tbody td .text-pill,
              .admin .card table#list tbody td .status-pill,
              .admin .card table#list tbody td .role-pill,
              .admin .card table#list tbody td .type-pill { width: auto; }
              .admin .card .excel-table th[data-sort="username"],
              .admin .card .excel-table td.col-name { min-width: 140px; }
              .admin .card .excel-table th[data-sort="email"],
              .admin .card .excel-table td.col-email { min-width: 180px; }
              .admin .card .excel-table th[data-sort="department"],
              .admin .card .excel-table td.col-dept { min-width: 140px; }
              .admin .card .excel-table th[data-sort="id"],
              .admin .card .excel-table td.col-code { min-width: 120px; }
              .admin .card .excel-table tbody td.col-name a { font-size: 13px !important; font-weight: 700 !important; color: #1151ac !important; text-decoration: underline !important; display: inline-block; padding: 4px 8px; margin: -4px -8px; border-radius: 4px; transition: background-color 0.2s, color 0.2s; }
              .admin .card .excel-table tbody td.col-name a:hover { text-decoration: none !important; background-color: #1151ac !important; color: #ffffff !important; }
              .admin .card .excel-table th.sel-col,
              .admin .card .excel-table td.sel-col { width: 56px; min-width: 56px; text-align: center; }
              .admin .card .excel-table input.empSel { width: 18px !important; height: 18px !important; padding: 0 !important; margin: 0 !important; }

              .role-pill { display:inline-flex; align-items:center; justify-content:flex-start; min-height:auto; padding:0; border-radius:0; border:none; font-size:14px !important; font-weight:400; line-height:1.4; box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; background:transparent; }
              .role-pill.admin { color:#b00020; }
              .role-pill.manager { color:#b45309; }
              .role-pill.employee { color:#1151ac; }

              .type-pill { display:inline-flex; align-items:center; justify-content:flex-start; min-height:auto; padding:0; border-radius:0; border:none; font-size:14px !important; font-weight:400; line-height:1.4; box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; background:transparent; }
              .type-pill.full { color:#1b7c3f; }
              .type-pill.part { color:#0f766e; }
              .type-pill.contract { color:#6b21a8; }
              @media (max-width: 640px) {
                .admin.employees-wide .card table#list:not(.emp-del-list) thead,
                .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead,
                .admin.employees-wide .card table#list:not(.emp-del-list) thead th,
                .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead th {
                  top: auto !important;
                  position: static !important;
                }
              }
            `;
            document.head.appendChild(style);
          }
        } catch {}
      } else {
        subnav.style.display = '';
        subnav.innerHTML = '';
        subnav.appendChild(filterWrap);
      }
    } else {
      filterWrap.style.position = 'static';
      filterWrap.style.zIndex = 'auto';
      content.appendChild(filterWrap);
    }
  } catch {
    filterWrap.style.position = 'static';
    filterWrap.style.zIndex = 'auto';
    content.appendChild(filterWrap);
  }

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

  const state = { showAll: false, searchVisible: false, code: '', q: '', dept: '', role: '', status: '', hireFrom: '', hireTo: '', sortKey: 'id', sortDir: 'desc', page: 1, pageSize: 10 };
  try {
    state.showAll = ((params.get('showAll') || '') === '1' || (params.get('showAll') || '').toLowerCase() === 'true');
    state.searchVisible = ((params.get('search') || '') === '1' || (params.get('search') || '').toLowerCase() === 'true');
    state.code = (params.get('code') || '').trim().toLowerCase();
    state.q = (params.get('q') || '').trim().toLowerCase();
    state.dept = params.get('dept') || '';
    state.role = params.get('role') || '';
    state.status = params.get('status') || '';
    state.hireFrom = params.get('hireFrom') || '';
    state.hireTo = params.get('hireTo') || '';
    state.sortKey = params.get('sortKey') || state.sortKey;
    state.sortDir = params.get('sortDir') || state.sortDir;
    state.page = parseInt(params.get('page') || String(state.page), 10) || state.page;
  } catch {}

  const table = document.createElement('table');
  table.id = 'list';
  table.className = 'excel-table' + (mode === 'delete' ? ' emp-del-list' : '');
  table.style.tableLayout = 'auto';
  if (mode === 'delete') {
    table.style.width = '100%';
    table.style.minWidth = '100%';
  } else {
    table.style.width = '100%';
    table.style.minWidth = '100%';
  }
  table.innerHTML = `
    <thead>
      <tr>
        ${mode === 'delete' ? '<th class="sel-col">選択</th>' : ''}
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
  pager.style.display = 'flex';
  pager.style.alignItems = 'center';
  pager.style.justifyContent = 'space-between';
  pager.innerHTML = `
    <div class="pager-left">
      <button type="button" id="empPrev">前へ</button>
      <span id="empPageInfo" style="margin:0 8px;"></span>
      <button type="button" id="empNext">次へ</button>
    </div>
    ${mode === 'delete' ? '' : ''}
  `;

  if (mode === 'delete') {
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    const toolbar = document.createElement('div');
    toolbar.className = 'emp-del-toolbar';
    toolbar.innerHTML = '<div class="pager-right" id="empBulkBox"><button type="button" id="empBulkDisable" class="emp-bulk-disable" aria-label="選択を無効化">選択を無効化</button></div>';
    toolbar.style.display = '';
    const listBox = filterWrap.querySelector('#empListBox');
    if (listBox) {
      listBox.appendChild(table);
      listBox.appendChild(pager);
      filterWrap.appendChild(toolbar);
    } else {
      filterWrap.appendChild(table);
      filterWrap.appendChild(pager);
      filterWrap.appendChild(toolbar);
    }
  } else {
    if (!isCurrent || seq !== employeesRenderSeq) return done;
    const hdr = document.createElement('div');
    hdr.className = 'form-title';
    hdr.textContent = '【社員一覧】';
    content.appendChild(hdr);
    content.appendChild(table);
    content.appendChild(pager);
  }

  if (mode === 'delete') {
    table.style.display = '';
    if (!state.showAll && !state.searchVisible) { pager.style.display = 'none'; }
    const alignBulk = () => {
      try {
        if (table.style.display === 'none') return;
        const th = table.querySelector('thead th:last-child');
        const box = filterWrap.querySelector('#empBulkBox');
        if (!th || !box) return;
        const tb = table.getBoundingClientRect();
        const thb = th.getBoundingClientRect();
        const left = Math.max(0, Math.round(thb.left - tb.left));
        box.style.marginLeft = `${left}px`;
      } catch {}
    };
    if (state.showAll || state.searchVisible) {
      alignBulk();
      try { window.addEventListener('resize', alignBulk, { once: true }); } catch {}
    }
  }

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
  const statusPill = (s) => {
    const v = String(s || '').toLowerCase();
    const cls = v === 'inactive' ? 'inactive' : (v === 'retired' ? 'retired' : 'active');
    return `<span class="status-pill ${cls}">${statusJa(v)}</span>`;
  };
  const roleJa = (r) => {
    const v = String(r || '').toLowerCase();
    if (v === 'admin') return '管理者';
    if (v === 'manager') return 'マネージャー';
    if (v === 'employee') return '従業員';
    return r || '';
  };
  const empTypeJa = (t) => {
    const v = String(t || '').toLowerCase();
    if (v === 'full_time') return '正社員';
    if (v === 'part_time') return 'パート・アルバイト';
    if (v === 'contract') return '契約社員';
    return t || '';
  };
  const rolePill = (r) => {
    const v = String(r || '').toLowerCase();
    const cls = v === 'admin' ? 'admin' : (v === 'manager' ? 'manager' : 'employee');
    return `<span class="role-pill ${cls}">${roleJa(v)}</span>`;
  };
  const typePill = (t) => {
    const v = String(t || '').toLowerCase();
    const cls = v === 'full_time' ? 'full' : (v === 'part_time' ? 'part' : (v === 'contract' ? 'contract' : 'other'));
    return `<span class="type-pill ${cls}">${empTypeJa(v)}</span>`;
  };
  const normText = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return (s && s !== '-') ? s : '';
  };
  const dispOrUnreg = (v) => {
    const s = normText(v);
    return s ? s : `<span class="unreg" title="未登録">—</span>`;
  };
  const escAttr = (v) => String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const fmtDate = (d) => {
    if (!d || String(d) === '-' || String(d) === '0000-00-00') return `<span class="unreg" title="未登録">—</span>`;
    const raw = String(d);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
    try {
      const x = new Date(raw);
      if (!isNaN(x.getTime())) return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}`;
    } catch {}
    return raw;
  };

  const applyFilterSort = () => {
    let arr = users.slice();
    if (state.code) {
      arr = arr.filter(u => {
        const raw = String(u.employee_code || '').toLowerCase();
        const gen = ('emp' + String(u.id).padStart(3, '0')).toLowerCase();
        return raw.includes(state.code) || gen.includes(state.code);
      });
    }
    if (state.q) arr = arr.filter(u => String(u.username || '').toLowerCase().includes(state.q));
    if (state.dept) arr = arr.filter(u => String(u.departmentId || '') === String(state.dept));
    if (state.role) arr = arr.filter(u => String(u.role || '') === String(state.role));
    if (state.status) arr = arr.filter(u => String(u.employment_status || '') === String(state.status));
    if (state.hireFrom) {
      arr = arr.filter(u => {
        const d = u.hire_date;
        return d && String(d) >= state.hireFrom;
      });
    }
    if (state.hireTo) {
      arr = arr.filter(u => {
        const d = u.hire_date;
        return d && String(d) <= state.hireTo;
      });
    }
    const key = state.sortKey;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = key === 'department' ? deptName(a.departmentId) : (key === 'hire_date' ? (a.hire_date || '') : (a[key] || ''));
      const vb = key === 'department' ? deptName(b.departmentId) : (key === 'hire_date' ? (b.hire_date || '') : (b[key] || ''));
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
      const rowStatus = String(u.employment_status || '').toLowerCase();
      tr.className = `emp-row ${rowStatus || 'active'}`;
      const emailVal = normText(u.email);
      const deptVal = normText(deptName(u.departmentId));
      const detailBtn = `<a class="emp-action" href="/ui/admin?tab=employees&detail=${u.id}">👁 詳細</a>`;
      const editBtn = `<a class="emp-action" href="/ui/admin?tab=employees&edit=${u.id}">✏️ 編集</a>`;
      const disableBtn = role2 === 'admin' ? `<button type="button" class="emp-action danger" data-action="disable" data-id="${u.id}">🚫 無効化</button>` : ``;
      const ops = mode === 'delete' ? `${detailBtn}${disableBtn}` : `${detailBtn}${editBtn}${disableBtn}`;
      tr.innerHTML = `
        ${mode === 'delete' ? `<td class="sel-col"><input type="checkbox" class="empSel" value="${u.id}"></td>` : ''}
        <td class="col-code"><span class="text-pill neutral">${u.employee_code || fmtEmpNo(u.id)}</span></td>
        <td class="col-name"><span class="text-pill"><a href="/ui/admin?tab=employees&detail=${u.id}">${u.username || ''}</a></span></td>
        <td class="col-email"${emailVal ? ` title="${escAttr(emailVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(emailVal)}</span></td>
        <td class="col-dept"${deptVal ? ` title="${escAttr(deptVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(deptVal)}</span></td>
        <td>${rolePill(u.role)}</td>
        <td>${typePill(u.employment_type)}</td>
        <td>${statusPill(u.employment_status)}</td>
        <td>${fmtDate(u.hire_date)}</td>
        <td>
          <div class="emp-action-group">
            ${ops}
          </div>
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

  const updateBrandActions = () => {
    try {
      const dd = document.querySelector('.topbar .brand #brandDropdown');
      if (!dd) return;
      const sel = Array.from(content.querySelectorAll('.empSel:checked'));
      const editBtn = document.querySelector('.topbar .brand #brandEdit');
      if (editBtn) {
        const ok = sel.length === 1;
        editBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
      }
    } catch {}
  };
  table.addEventListener('change', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('empSel')) {
      updateBrandActions();
    }
  });
  table.addEventListener('click', (e) => {
    const t = e && e.target;
    const td = (t && t.closest) ? t.closest('td') : null;
    if (!td) return;
    if (e.target.closest('.emp-action-group')) return;
    if (e.target.closest('a')) return;
    if (e.target.matches('input, button, select, label')) return;
    const tr = td.closest('tr');
    const cb = tr ? tr.querySelector('.empSel') : null;
    if (cb) {
      cb.checked = !cb.checked;
      updateBrandActions();
    }
  });
  updateBrandActions();

  try {
    const tabSearch = filterWrap.querySelector('#tabSearch');
    const tabShowAll = filterWrap.querySelector('#tabShowAll');
    if (tabSearch && tabShowAll) {
      const setActive = () => {
        const listBox = filterWrap.querySelector('#empListBox');
        const formBody = filterWrap.querySelector('.emp-del-filter tbody');
        const tb = filterWrap.querySelector('.emp-del-toolbar');
        if (state.showAll) {
          tabSearch.classList.remove('active');
          tabShowAll.classList.add('active');
          table.style.display = '';
          pager.style.display = '';
          if (formBody) formBody.style.display = 'none';
          if (listBox) listBox.style.display = '';
          if (tb) tb.style.display = '';
        } else {
          tabSearch.classList.add('active');
          tabShowAll.classList.remove('active');
          const showSearchList = !!state.searchVisible;
          table.style.display = showSearchList ? '' : 'none';
          pager.style.display = showSearchList ? '' : 'none';
          if (formBody) formBody.style.display = '';
          if (listBox) listBox.style.display = showSearchList ? '' : 'none';
          if (tb) tb.style.display = showSearchList ? '' : 'none';
        }
      };
      setActive();
      tabSearch.addEventListener('click', () => {
        state.showAll = false;
        state.searchVisible = false;
        setActive();
        try {
          const p = new URLSearchParams();
          if (state.code) p.set('code', state.code);
          if (state.q) p.set('q', state.q);
          if (state.dept) p.set('dept', state.dept);
          if (state.role) p.set('role', state.role);
          if (state.status) p.set('status', state.status);
          if (state.hireFrom) p.set('hireFrom', state.hireFrom);
          if (state.hireTo) p.set('hireTo', state.hireTo);
          if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
          if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
          if (state.page && state.page > 1) p.set('page', String(state.page));
          const s = p.toString();
          history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#delete');
        } catch {}
      });
      tabShowAll.addEventListener('click', () => {
        state.showAll = true;
        state.searchVisible = false;
        setActive();
        renderRows();
        try {
          const p = new URLSearchParams();
          if (state.code) p.set('code', state.code);
          if (state.q) p.set('q', state.q);
          if (state.dept) p.set('dept', state.dept);
          if (state.role) p.set('role', state.role);
          if (state.status) p.set('status', state.status);
          if (state.hireFrom) p.set('hireFrom', state.hireFrom);
          if (state.hireTo) p.set('hireTo', state.hireTo);
          if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
          if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
          if (state.page && state.page > 1) p.set('page', String(state.page));
          p.set('showAll', '1');
          const s = p.toString();
          history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#delete');
        } catch {}
      });
    }
    const tbEl = filterWrap.querySelector('.emp-del-toolbar'); if (tbEl) tbEl.style.display = (state.showAll || state.searchVisible) ? '' : 'none';
    const codeEl = filterWrap.querySelector('#empSearchCode'); if (codeEl) codeEl.value = (params.get('code') || '');
    const nameEl = filterWrap.querySelector('#empSearchName'); if (nameEl) nameEl.value = (params.get('q') || '');
    const deptEl = filterWrap.querySelector('#empDeptFilter'); if (deptEl) deptEl.value = params.get('dept') || '';
    const roleEl = filterWrap.querySelector('#empRoleFilter'); if (roleEl) roleEl.value = params.get('role') || '';
    const statusEl = filterWrap.querySelector('#empStatusFilter'); if (statusEl) statusEl.value = params.get('status') || '';
    const hireFromEl = filterWrap.querySelector('#empHireFrom'); if (hireFromEl) hireFromEl.value = params.get('hireFrom') || '';
    const hireToEl = filterWrap.querySelector('#empHireTo'); if (hireToEl) hireToEl.value = params.get('hireTo') || '';
  } catch {}

  filterWrap.querySelector('#btnEmpSearch').addEventListener('click', () => {
    const codeEl = filterWrap.querySelector('#empSearchCode');
    state.code = String((codeEl && codeEl.value != null) ? codeEl.value : '').trim().toLowerCase();
    state.q = (filterWrap.querySelector('#empSearchName').value || '').trim().toLowerCase();
    state.dept = filterWrap.querySelector('#empDeptFilter').value || '';
    state.role = filterWrap.querySelector('#empRoleFilter').value || '';
    state.status = filterWrap.querySelector('#empStatusFilter').value || '';
    state.hireFrom = (filterWrap.querySelector('#empHireFrom').value || '').trim();
    state.hireTo = (filterWrap.querySelector('#empHireTo').value || '').trim();
    state.page = 1;
    const hasAny = !!(state.code || state.q || state.dept || state.role || state.status || state.hireFrom || state.hireTo);
    state.searchVisible = hasAny;
    if (!hasAny) {
      try {
        const listBox = filterWrap.querySelector('#empListBox');
        if (listBox) {
          table.style.display = 'none';
          pager.style.display = 'none';
          listBox.style.display = 'none';
        }
      } catch {}
      alert('検索条件を入力してください');
      return;
    }
    renderRows();
    try {
      const listBox = filterWrap.querySelector('#empListBox');
      if (listBox) {
        table.style.display = '';
        pager.style.display = '';
        listBox.style.display = '';
      }
    } catch {}
    try {
      const p = new URLSearchParams();
      if (state.code) p.set('code', state.code);
      if (state.showAll) p.set('showAll', '1');
      if (state.searchVisible) p.set('search', '1');
      if (state.q) p.set('q', state.q);
      if (state.dept) p.set('dept', state.dept);
      if (state.role) p.set('role', state.role);
      if (state.status) p.set('status', state.status);
      if (state.hireFrom) p.set('hireFrom', state.hireFrom);
      if (state.hireTo) p.set('hireTo', state.hireTo);
      if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
      if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
      if (state.page && state.page > 1) p.set('page', String(state.page));
      const s = p.toString();
      history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
    } catch {}
  });

  if (mode === 'delete') {
    const bulkHandler = async (e) => {
      if (e.target && e.target.id === 'empBulkDisable') {
        const ids = Array.from(content.querySelectorAll('.empSel:checked')).map(i => i.value);
        if (!ids.length) { alert('対象を選択してください'); return; }
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'modal';
        const listRows = ids.map(id => {
          const u = users.find(x => String(x.id) === String(id));
          const code = (u && u.employee_code) ? u.employee_code : fmtEmpNo(id);
          const name = (u && u.username) ? u.username : '';
          const dept = deptName(u && u.departmentId ? u.departmentId : null);
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
            <button type="button" class="btn" id="modalConfirmDisable">無効化する</button>
            <button type="button" class="btn" id="modalCancelDisable">キャンセル</button>
          </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const close = () => { try { document.body.removeChild(overlay); } catch {} };
        cleanup.add(close);
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
        modal.querySelector('#modalCancelDisable').addEventListener('click', close);
        modal.querySelector('#modalConfirmDisable').addEventListener('click', async () => {
          const btn = modal.querySelector('#modalConfirmDisable');
          btn.disabled = true;
          try {
            for (const id of ids) {
              try { await deleteEmployee(id, { signal }); } catch {}
            }
            for (const id of ids) {
              const u = users.find(x => String(x.id) === String(id));
              if (u) u.employment_status = 'inactive';
            }
            renderRows();
          } finally {
            close();
            alert('無効化しました（状態: 無効/休職）');
          }
        });
      }
    };
    pager.addEventListener('click', bulkHandler);
    filterWrap.addEventListener('click', bulkHandler);
  }

  const prev = pager.querySelector('#empPrev');
  const next = pager.querySelector('#empNext');
  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderRows();
      try {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.dept) p.set('dept', state.dept);
        if (state.role) p.set('role', state.role);
        if (state.status) p.set('status', state.status);
        if (state.hireFrom) p.set('hireFrom', state.hireFrom);
        if (state.hireTo) p.set('hireTo', state.hireTo);
        if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
        if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
        if (state.page && state.page > 1) p.set('page', String(state.page));
        const s = p.toString();
        history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
      } catch {}
    }
    try { const tb = filterWrap.querySelector('.emp-del-toolbar'); if (tb) tb.style.display = content.querySelectorAll('.empSel').length ? '' : 'none'; } catch {}
  });
  next.addEventListener('click', () => {
    const total = applyFilterSort().length;
    const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page < maxPage) {
      state.page += 1;
      renderRows();
      try {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.dept) p.set('dept', state.dept);
        if (state.role) p.set('role', state.role);
        if (state.status) p.set('status', state.status);
        if (state.hireFrom) p.set('hireFrom', state.hireFrom);
        if (state.hireTo) p.set('hireTo', state.hireTo);
        if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
        if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
        if (state.page && state.page > 1) p.set('page', String(state.page));
        const s = p.toString();
        history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
      } catch {}
    }
    try { const tb = filterWrap.querySelector('.emp-del-toolbar'); if (tb) tb.style.display = table.querySelectorAll('.empSel').length ? '' : 'none'; } catch {}
  });

  cleanup.add(delegate(table, 'button[data-action="disable"]', 'click', async (e, btn) => {
    e.preventDefault();
    try { e.stopPropagation(); } catch {}
    const delId = btn.dataset.id || '';
    if (!delId) return;
    if (confirm('この社員を無効化しますか？')) {
      try {
        await deleteEmployee(delId, { signal });
        if (!isCurrent) return;
        const u = users.find(x => String(x.id) === String(delId));
        if (u) u.employment_status = 'inactive';
        alert('無効化しました（状態: 無効/休職）');
        renderRows();
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        alert(String((err && err.message) ? err.message : '無効化に失敗しました'));
      }
    }
  }));

  table.addEventListener('click', async (e) => {
    const t = e && e.target;
    const a = (t && t.closest) ? t.closest('a') : null;
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('/ui/admin?tab=employees&detail=') || href.startsWith('/ui/admin?tab=employees&edit=')) {
        e.preventDefault();
        const p = new URLSearchParams();
        const nameEl = filterWrap.querySelector('#empSearchName');
        const deptEl = filterWrap.querySelector('#empDeptFilter');
        const roleEl = filterWrap.querySelector('#empRoleFilter');
        const stEl = filterWrap.querySelector('#empStatusFilter');
        const hfEl = filterWrap.querySelector('#empHireFrom');
        const htEl = filterWrap.querySelector('#empHireTo');
        const qv = String((nameEl && nameEl.value != null) ? nameEl.value : '').trim().toLowerCase();
        const dv = (deptEl && deptEl.value != null) ? deptEl.value : '';
        const rv = (roleEl && roleEl.value != null) ? roleEl.value : '';
        const sv = (stEl && stEl.value != null) ? stEl.value : '';
        const hf = (hfEl && hfEl.value != null) ? hfEl.value : '';
        const ht = (htEl && htEl.value != null) ? htEl.value : '';
        if (qv) p.set('q', qv);
        if (dv) p.set('dept', dv);
        if (rv) p.set('role', rv);
        if (sv) p.set('status', sv);
        if (hf) p.set('hireFrom', hf);
        if (ht) p.set('hireTo', ht);
        if (state && state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
        if (state && state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
        if (state && state.page && state.page > 1) p.set('page', String(state.page));
        const s = p.toString();
        const url = href + (s ? '&' + s : '');
        window.location.href = url;
        return;
      }
    }
  });

  hideNavSpinner();
  return done;
}

export const employeesPage = createPage({ mount: mountEmployeesImpl });

export async function mountEmployees(ctx) {
  return employeesPage.mount(ctx);
}
