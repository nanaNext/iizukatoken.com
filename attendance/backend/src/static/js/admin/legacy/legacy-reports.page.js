// @ts-nocheck
import { delegate } from '../_shared/dom.js';
import { downloadWithAuth } from '../../shared/api/client.js';

export async function mountReports({ content }) {
  content.innerHTML = '<h3>レポート</h3>';
  const block = document.createElement('div');
  block.innerHTML = `
    <h4>勤怠CSV</h4>
    <input id="repUserIds" placeholder="userIds (comma)">
    <input id="repFrom" placeholder="From(YYYY-MM-DD)">
    <input id="repTo" placeholder="To(YYYY-MM-DD)">
    <button data-action="export-timesheet">エクスポート</button>
    <h4>休日ICS/CSV</h4>
    <input id="repYear" placeholder="Year" value="${new Date().getUTCFullYear()}">
    <button data-action="export-ics">ICS</button>
    <button data-action="export-csv">CSV</button>
  `;

  delegate(block, '[data-action]', 'click', (e, el) => {
    const action = el.dataset.action;
    if (action === 'export-timesheet') {
      const ids = block.querySelector('#repUserIds').value.trim();
      const from = block.querySelector('#repFrom').value.trim();
      const to = block.querySelector('#repTo').value.trim();
      if (!ids || !from || !to) {
        alert('userIds, From, To をすべて入力してください。');
        return;
      }
      const url = `/api/admin/export/timesheet.csv?userIds=${encodeURIComponent(ids)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      downloadWithAuth(url, 'timesheet.csv').catch(err => alert('エクスポート失敗: ' + err.message));
    } else if (action === 'export-ics') {
      const year = parseInt(block.querySelector('#repYear').value, 10);
      if (!year) { alert('Year を入力してください。'); return; }
      const url = `/api/admin/calendar/export?year=${year}`;
      downloadWithAuth(url, `holidays_${year}.ics`).catch(err => alert('エクスポート失敗: ' + err.message));
    } else if (action === 'export-csv') {
      const year = parseInt(block.querySelector('#repYear').value, 10);
      if (!year) { alert('Year を入力してください。'); return; }
      const url = `/api/admin/calendar/export.csv?year=${year}`;
      downloadWithAuth(url, `holidays_${year}.csv`).catch(err => alert('エクスポート失敗: ' + err.message));
    }
  });

  content.appendChild(block);
}
