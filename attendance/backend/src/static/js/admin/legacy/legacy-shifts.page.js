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
    </tr></thead>
    <tbody></tbody>
  `;
  const tbody = defTable.querySelector('tbody');
  let defs = [];
  try {
    defs = await api.get('/attendance/shifts/definitions');
  } catch { defs = []; }
  for (const d of (Array.isArray(defs) ? defs : [])) {
    const tr = document.createElement('tr');
    const tdN = document.createElement('td'); tdN.textContent = d.name || '';
    const tdS = document.createElement('td'); tdS.textContent = d.start_time || '';
    const tdE = document.createElement('td'); tdE.textContent = d.end_time || '';
    const tdB = document.createElement('td'); tdB.textContent = String(d.break_minutes ?? 0);
    const tdM = document.createElement('td'); tdM.textContent = String(d.standard_minutes ?? '');
    tr.appendChild(tdN); tr.appendChild(tdS); tr.appendChild(tdE); tr.appendChild(tdB); tr.appendChild(tdM);
    tbody.appendChild(tr);
  }
  defCard.appendChild(defTable);

  const addWrap = document.createElement('div');
  addWrap.className = 'form-actions';
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.placeholder = '例: day_8_17'; nameIn.style.minWidth = '160px';
  const sIn = document.createElement('input');
  sIn.type = 'time'; sIn.value = '08:00';
  const eIn = document.createElement('input');
  eIn.type = 'time'; eIn.value = '17:00';
  const brSel = document.createElement('select');
  brSel.innerHTML = '<option value="60">1:00</option><option value="45">0:45</option><option value="30">0:30</option><option value="0">0:00</option>';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = '追加/更新';
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = {
      name: String(nameIn.value || '').trim(),
      start_time: String(sIn.value || '').trim(),
      end_time: String(eIn.value || '').trim(),
      break_minutes: parseInt(brSel.value, 10)
    };
    if (!payload.name || !/^\d{2}:\d{2}$/.test(payload.start_time) || !/^\d{2}:\d{2}$/.test(payload.end_time)) {
      alert('名称・開始・終了を入力してください');
      return;
    }
    await api.post('/attendance/shifts/definitions', payload);
    const rows = await api.get('/attendance/shifts/definitions');
    const tb = defTable.querySelector('tbody');
    tb.innerHTML = '';
    for (const d of (Array.isArray(rows) ? rows : [])) {
      const tr = document.createElement('tr');
      const tdN = document.createElement('td'); tdN.textContent = d.name || '';
      const tdS = document.createElement('td'); tdS.textContent = d.start_time || '';
      const tdE = document.createElement('td'); tdE.textContent = d.end_time || '';
      const tdB = document.createElement('td'); tdB.textContent = String(d.break_minutes ?? 0);
      const tdM = document.createElement('td'); tdM.textContent = String(d.standard_minutes ?? '');
      tr.appendChild(tdN); tr.appendChild(tdS); tr.appendChild(tdE); tr.appendChild(tdB); tr.appendChild(tdM);
      tb.appendChild(tr);
    }
    nameIn.value = '';
  });
  addWrap.appendChild(nameIn);
  addWrap.appendChild(sIn);
  addWrap.appendChild(eIn);
  addWrap.appendChild(brSel);
  addWrap.appendChild(saveBtn);
  defCard.appendChild(addWrap);

  wrap.appendChild(defCard);

  content.innerHTML = '';
  content.appendChild(wrap);
}
