import { api } from '../../shared/api/client.js';

export async function mountShifts({ content }) {
  content.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'admin-shifts';

  const head = document.createElement('div');
  head.className = 'form-title';
  head.textContent = 'シフト管理';
  wrap.appendChild(head);

  const defCard = document.createElement('div');
  defCard.className = 'form-card';
  const defTitle = document.createElement('div');
  defTitle.className = 'form-title';
  defTitle.textContent = 'シフト定義';
  defCard.appendChild(defTitle);
  const defTable = document.createElement('table');
  defTable.className = 'excel-table';
  defTable.innerHTML = `
    <thead><tr>
      <th style="width:160px;">名称</th>
      <th style="width:120px;">開始</th>
      <th style="width:120px;">終了</th>
      <th style="width:120px;">休憩</th>
      <th style="width:140px;">所定時間</th>
      <th style="width:120px;">削除</th>
    </tr></thead>
    <tbody></tbody>
  `;
  let defs = [];
  const normalizeName = (v) => String(v || '').trim();
  const findDefByName = (name) => {
    const n = normalizeName(name);
    if (!n) return null;
    return (Array.isArray(defs) ? defs : []).find(d => normalizeName(d?.name) === n) || null;
  };
  let nameIn = null;
  let sIn = null;
  let eIn = null;
  let brSel = null;
  const renderDefs = (rows) => {
    const tb = defTable.querySelector('tbody');
    tb.innerHTML = '';
    for (const d of (Array.isArray(rows) ? rows : [])) {
      const tr = document.createElement('tr');
      const tdN = document.createElement('td'); tdN.textContent = d.name || '';
      const tdS = document.createElement('td'); tdS.textContent = d.start_time || '';
      const tdE = document.createElement('td'); tdE.textContent = d.end_time || '';
      const tdB = document.createElement('td'); tdB.textContent = String(d.break_minutes ?? 0);
      const tdM = document.createElement('td'); tdM.textContent = String(d.standard_minutes ?? '');
      const tdDel = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(d.id);
        if (!id) {
          alert('削除できません: IDがありません');
          return;
        }
        if (!confirm(`${d.name || ''} を削除しますか？`)) return;
        try {
          await api.del(`/attendance/shifts/definitions/${id}`);
          const rows2 = await api.get('/attendance/shifts/definitions');
          defs = Array.isArray(rows2) ? rows2 : [];
          renderDefs(rows2);
        } catch (err) {
          const msg = String(err?.message || err || '');
          if (msg.toLowerCase().includes('409')) {
            alert('このシフトは使用中のため削除できません');
            return;
          }
          alert('削除に失敗しました');
        }
      });
      tdDel.appendChild(delBtn);
      tr.appendChild(tdN); tr.appendChild(tdS); tr.appendChild(tdE); tr.appendChild(tdB); tr.appendChild(tdM); tr.appendChild(tdDel);
      tr.addEventListener('click', () => {
        try {
          if (!nameIn || !sIn || !eIn || !brSel) return;
          nameIn.value = d.name || '';
          sIn.value = d.start_time || '';
          eIn.value = d.end_time || '';
          brSel.value = String(d.break_minutes ?? 0);
        } catch {}
      });
      tb.appendChild(tr);
    }
  };
  try {
    defs = await api.get('/attendance/shifts/definitions');
  } catch { defs = []; }
  renderDefs(defs);
  defCard.appendChild(defTable);

  const addWrap = document.createElement('div');
  addWrap.className = 'form-actions';
  nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.placeholder = '例: day_8_17'; nameIn.style.minWidth = '160px';
  sIn = document.createElement('input');
  sIn.type = 'time'; sIn.value = '08:00';
  eIn = document.createElement('input');
  eIn.type = 'time'; eIn.value = '17:00';
  brSel = document.createElement('select');
  brSel.innerHTML = '<option value="60">1:00</option><option value="45">0:45</option><option value="30">0:30</option><option value="0">0:00</option>';
  const buildPayload = () => ({
    name: normalizeName(nameIn.value),
    start_time: String(sIn.value || '').trim(),
    end_time: String(eIn.value || '').trim(),
    break_minutes: parseInt(String(brSel.value || '0'), 10)
  });
  const validatePayload = (payload) => {
    if (!payload.name) return false;
    if (!/^\d{2}:\d{2}$/.test(payload.start_time)) return false;
    if (!/^\d{2}:\d{2}$/.test(payload.end_time)) return false;
    return true;
  };
  const refresh = async () => {
    const rows = await api.get('/attendance/shifts/definitions');
    defs = Array.isArray(rows) ? rows : [];
    renderDefs(defs);
  };
  const clearInputs = () => {
    nameIn.value = '';
  };

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.textContent = '追加';
  addBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validatePayload(payload)) {
      alert('名称・開始・終了を入力してください');
      return;
    }
    if (findDefByName(payload.name)) {
      alert('同じ名称のシフトが既に存在します。更新する場合は「更新」を押してください。');
      return;
    }
    await api.post('/attendance/shifts/definitions', payload);
    await refresh();
    clearInputs();
  });

  const updateBtn = document.createElement('button');
  updateBtn.className = 'btn-primary';
  updateBtn.textContent = '更新';
  updateBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validatePayload(payload)) {
      alert('名称・開始・終了を入力してください');
      return;
    }
    if (!findDefByName(payload.name)) {
      alert('更新できません: 対象のシフトが見つかりません。追加する場合は「追加」を押してください。');
      return;
    }
    await api.post('/attendance/shifts/definitions', payload);
    await refresh();
  });
  addWrap.appendChild(nameIn);
  addWrap.appendChild(sIn);
  addWrap.appendChild(eIn);
  addWrap.appendChild(brSel);
  addWrap.appendChild(addBtn);
  addWrap.appendChild(updateBtn);
  defCard.appendChild(addWrap);

  wrap.appendChild(defCard);

  content.innerHTML = '';
  content.appendChild(wrap);
}
