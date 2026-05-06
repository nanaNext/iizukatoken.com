import { fetchJSONAuth, fetchResponseAuth } from '../../api/http.api.js';
import { listUsers } from '../../api/users.api.js';
import { createPayloadController } from './editor.payload.js';
import { createPayrollService } from './editor.service.js';
import { createRealtimeController } from './editor.realtime.js';

let aborter = null;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (n) => Math.round(Number(n) || 0);

const fmtNum = (n) => {
  const v = yen(n);
  try { return new Intl.NumberFormat('ja-JP').format(v); } catch { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
};
const fmtYen = (n) => `${fmtNum(n)} 円`;

const parseNum = (raw, label, { allowEmpty = false } = {}) => {
  const s0 = raw == null ? '' : String(raw);
  const s = s0.replace(/,/g, '').trim();
  if (!s) return allowEmpty ? null : 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${label} が正しくありません`);
  return yen(n);
};

const isMoneyKey = (k) => {
  const s = String(k || '');
  return s.includes('円') || s.includes('額') || s.includes('手当') || s.includes('保険') || s.includes('税') || s.includes('控除') || s.includes('合計') || s.includes('給');
};

const hmFromMin = (min) => {
  const m = Math.max(0, yen(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
};

function mountStyle() {
  if (document.getElementById('payrollEditorStyle')) return;
  const st = document.createElement('style');
  st.id = 'payrollEditorStyle';
  st.textContent = `
    .pe-wrap{width:100%;max-width:1320px;margin:0 auto;padding:8px 12px;font-family:"Noto Sans JP","Noto Sans","Yu Gothic UI","Meiryo UI","Segoe UI",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;font-size:15px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;letter-spacing:.2px;font-weight:400;font-synthesis:none;color:#0e172a}
    .pe-wrap,.pe-wrap *{box-sizing:border-box;font-family:"Noto Sans JP","Noto Sans","Yu Gothic UI","Meiryo UI","Segoe UI",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;font-weight:400}
    .pe-card{background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:10px;box-shadow:0 1px 2px rgba(15,23,42,.06);min-width:0}
    .pe-title{font-size:16px;line-height:1.4;font-weight:400;color:#0b1220;margin:0 0 8px 0}
    .pe-muted{color:#475569;font-weight:400}

    .pe-nav{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px 0}
    .pe-nav a{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#0f172a;font-weight:400;text-decoration:none}
    .pe-nav a:hover{border-color:#94a3b8}
    .pe-nav a.active{background:#0f172a;border-color:#0f172a;color:#fff}

    .pe-money{position:relative}
    .pe-money span{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-weight:400;color:#64748b;pointer-events:none}

    .pe-kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px 26px}
    .pe-kpi > div{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #e5e7eb}
    .pe-kpi > div:nth-child(-n+2){border-top:none}
    .pe-kpi .k{font-size:14px;font-weight:400;color:#1f2937;line-height:1.4}
    .pe-kpi .v{font-size:15px;font-weight:400;color:#0b1220;line-height:1.35;white-space:nowrap}

    .pe-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
    @media (min-width: 980px){.pe-grid{grid-template-columns:1.05fr .95fr}}
    @media (min-width: 1200px){.pe-grid{grid-template-columns:1fr 1fr 1fr}}
    .pe-grid > *{min-width:0}

    .pe-row{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:8px;align-items:end}
    .pe-field{display:flex;flex-direction:column;gap:6px;min-width:0}
    .pe-field>span{font-size:14px;font-weight:400;color:#1f2937;line-height:1.4}
    .pe-field input,.pe-field select{height:42px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-size:15px;line-height:1.5;color:#0b1220;font-weight:400}
    .pe-wrap input,.pe-wrap select,.pe-wrap textarea,.pe-wrap button{font-family:"Noto Sans JP","Noto Sans","Yu Gothic UI","Meiryo UI","Segoe UI",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;font-weight:400}
    .pe-field input[type="month"]{font-family:"Noto Sans JP","Noto Sans","Yu Gothic UI","Meiryo UI","Segoe UI",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;font-size:15px;font-weight:400;letter-spacing:.2px}
    .pe-field input::placeholder{color:#94a3b8;font-weight:400}
    .pe-money input{width:100%;padding-right:34px}

    .pe-lowergrid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:12px}
    @media (min-width: 980px){.pe-lowergrid{grid-template-columns:1fr 1fr}}

    .pe-paygrid{display:grid;grid-template-columns:1fr;gap:10px}
    @media (min-width: 980px){.pe-paygrid{grid-template-columns:repeat(4, minmax(0, 1fr))}}
    @media (min-width: 980px){.pe-span2{grid-column:span 2 / span 2}}

    details{border:none;border-radius:0;padding:0;background:transparent;overflow:visible}
    details + details{margin-top:10px}
    summary.pe-title{cursor:pointer;user-select:none;margin:0;display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px}
    summary{list-style:none}
    summary::-webkit-details-marker{display:none}
    summary::marker{content:''}
    summary.pe-title::before{content:'';width:0;height:0;border-left:6px solid #64748b;border-top:4px solid transparent;border-bottom:4px solid transparent;opacity:.8}
    details[open] > summary.pe-title::before{transform:rotate(90deg)}
    details > summary{position:relative;z-index:1}
    details > *{min-width:0}

    .pe-items{display:flex;flex-direction:column;gap:8px;margin:0;padding:8px 2px 0 2px}
    .pe-item{display:grid;grid-template-columns:minmax(0,1fr) 120px 18px;gap:4px;align-items:center}
    .pe-item-short{grid-template-columns:minmax(0,1fr) 120px 18px}
    .pe-lbl{display:flex;align-items:center;height:38px;font-size:14px;font-weight:400;color:#1f2937;min-width:0}
    .pe-item input{height:42px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-size:15px;line-height:1.5;color:#0b1220;font-weight:400}
    .pe-item span{justify-self:start;text-align:left;color:#4b5563;font-weight:400}
    .pe-item input:disabled{background:#f8fafc;color:#0f172a}
    .pe-item .pe-amt{text-align:right}
    .pe-item button{width:100%;padding:6px 0;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}
    .pe-item button:hover{background:#f1f5f9;border-color:#94a3b8}

    .pe-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px}
    .pe-actions button{height:38px;padding:0 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer;font-weight:400;transition:background-color .15s,border-color .15s,color .15s}
    .pe-actions button:hover{background:#f1f5f9;border-color:#94a3b8}
    .pe-actions button.pe-primary{border-color:#1d4ed8;background:#2563eb;color:#fff}
    .pe-actions button.pe-primary:hover{background:#1d4ed8;border-color:#1e40af}
    #btnSavePayroll:hover{background:#047857;border-color:#065f46;color:#fff}
    #btnPublishPayroll:hover{background:#7c3aed;border-color:#6d28d9;color:#fff}
    .pe-actions button:disabled{cursor:not-allowed}

    .pe-preview{margin-top:12px}
    .pe-previewCard{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;margin-top:12px}
    .pe-previewGrid{display:grid;grid-template-columns:1fr;gap:10px}
    @media (min-width: 980px){.pe-previewGrid{grid-template-columns:1fr 1fr}}
    .pe-table{width:100%;border-collapse:separate;border-spacing:0}
    .pe-table td{padding:8px 10px;border-top:1px solid #f1f5f9;vertical-align:top;font-size:15px;line-height:1.5;font-weight:400}
    .pe-table tr:first-child td{border-top:none}
    .pe-table td:first-child{color:#1f2937;font-weight:400;width:62%}
    .pe-table td:last-child{text-align:right;font-weight:400;color:#0b1220}
    .pe-msg{margin-top:10px;font-weight:400}
  `;
  document.head.appendChild(st);
}

const tabHref = (tab) => {
  const p = String(window.location.pathname || '');
  const base = p.startsWith('/admin/payroll') ? p : '/ui/admin';
  return `${base}?tab=${encodeURIComponent(String(tab || ''))}`;
};

export async function mount() {
  if (aborter) aborter.abort();
  aborter = new AbortController();
  const { signal } = aborter;

  mountStyle();

  const content = document.querySelector('#adminContent');
  if (!content) return;
  content.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'pe-wrap';
  content.appendChild(wrap);

  const summaryCard = document.createElement('div');
  summaryCard.className = 'pe-card';
  summaryCard.innerHTML = `
    <div class="pe-title">総計（リアルタイム）</div>
    <div class="pe-kpi">
      <div><div class="k">支払内訳合計（総支給額）</div><div class="v" id="kpiGross">-</div></div>
      <div><div class="k">控除合計（総控除額）</div><div class="v" id="kpiDeduct">-</div></div>
      <div><div class="k">差引支払額（手取り）</div><div class="v" id="kpiNet">-</div></div>
      <div><div class="k">支払方法合計（振込+現金+現物）</div><div class="v" id="kpiPaySum">-</div></div>
    </div>
    <div id="kpiHint" style="margin-top:8px;color:#64748b;font-weight:400"></div>
  `;
  wrap.appendChild(summaryCard);

  const basicCard = document.createElement('div');
  basicCard.className = 'pe-card';
  basicCard.innerHTML = `
    <div class="pe-title">基本情報</div>
    <div class="pe-row">
      <label class="pe-field">
        <span>社員選択</span>
        <select id="payrollUserId"><option value="">社員選択</option></select>
      </label>
      <label class="pe-field">
        <span>対象年月</span>
        <input id="payrollMonth" type="month">
      </label>
      <label class="pe-field">
        <span>基本給（月給）</span>
        <div class="pe-money"><input id="payrollBaseMonthly" type="text" inputmode="numeric" placeholder="0"><span>円</span></div>
      </label>
      <label class="pe-field">
        <span>自動計算（保険・税）</span>
        <select id="payrollAutoCalc">
          <option value="0">しない</option>
          <option value="1">する</option>
        </select>
      </label>
      <label class="pe-field">
        <span>交通手当</span>
        <div class="pe-money"><input id="payrollTransport" type="text" inputmode="numeric" placeholder="0"><span>円</span></div>
      </label>
      <label class="pe-field">
        <span>出勤日数</span>
        <input id="payrollKWork" type="number" step="1" placeholder="自動">
      </label>
      <label class="pe-field">
        <span>休日出勤日数</span>
        <input id="payrollKHoliday" type="number" step="1" placeholder="自動">
      </label>
      <label class="pe-field">
        <span>半日出勤日数</span>
        <input id="payrollKHalf" type="number" step="1" placeholder="自動">
      </label>
      <label class="pe-field">
        <span>欠勤日数</span>
        <input id="payrollKAbsent" type="number" step="1" placeholder="自動">
      </label>
      <label class="pe-field">
        <span>無給休暇</span>
        <input id="payrollKUnpaid" type="number" step="1" placeholder="自動">
      </label>
    </div>
  `;

  const dedCard = document.createElement('div');
  dedCard.className = 'pe-card';
  dedCard.innerHTML = `
    <details open>
      <summary class="pe-title">控除（固定・上書き）</summary>
      <div class="pe-items">
        <div class="pe-item"><div class="pe-lbl">健康保険料</div><input class="pe-amt" id="ovDedHealth" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">介護保険料</div><input class="pe-amt" id="ovDedCare" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">厚生年金保険</div><input class="pe-amt" id="ovDedPension" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">雇用保険料</div><input class="pe-amt" id="ovDedEmployment" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">所得税</div><input class="pe-amt" id="ovDedIncome" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">住民税</div><input class="pe-amt" id="ovDedResident" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">立替家賃（控除）</div><input class="pe-amt" id="payrollRent" type="text" inputmode="numeric" placeholder="0"><span>円</span></div>
      </div>
    </details>
    <details open>
      <summary class="pe-title">控除（追加）</summary>
      <div id="payrollDeductions" class="pe-items"></div>
      <div style="padding:0 12px 12px 12px">
        <button type="button" id="btnAddDed">＋追加</button>
      </div>
    </details>
  `;

  const earnCard = document.createElement('div');
  earnCard.className = 'pe-card';
  earnCard.innerHTML = `
    <details open>
      <summary class="pe-title">支給（固定・上書き）</summary>
      <div class="pe-items">
        <div class="pe-item"><div class="pe-lbl">夜間出勤手当</div><input class="pe-amt" id="ovEarnNight" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">休日出勤手当</div><input class="pe-amt" id="ovEarnHoliday" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">固定残業手当</div><input class="pe-amt" id="ovEarnFixedOT" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">非課税通勤費</div><input class="pe-amt" id="ovEarnTransit" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">資格手当</div><input class="pe-amt" id="ovEarnCert" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">欠勤控除</div><input class="pe-amt" id="ovEarnAbsent" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">催事協力手当</div><input class="pe-amt" id="ovEarnEvent" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">通信手当</div><input class="pe-amt" id="ovEarnComms" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">誕生日月手当</div><input class="pe-amt" id="ovEarnBirthday" type="number" step="1" placeholder="0"><span>円</span></div>
        <div class="pe-item"><div class="pe-lbl">残業手当</div><input class="pe-amt" id="ovEarnOT" type="number" step="1" placeholder="0"><span>円</span></div>
      </div>
    </details>
    <details open>
      <summary class="pe-title">支給（追加）</summary>
      <div id="payrollEarnings" class="pe-items"></div>
      <div style="padding:0 12px 12px 12px">
        <button type="button" id="btnAddEarn">＋追加</button>
      </div>
    </details>
  `;

  const grid = document.createElement('div');
  grid.className = 'pe-grid';
  grid.appendChild(basicCard);
  grid.appendChild(dedCard);
  grid.appendChild(earnCard);
  wrap.appendChild(grid);

  const lowerGrid = document.createElement('div');
  lowerGrid.className = 'pe-lowergrid';

  const otherCard = document.createElement('div');
  otherCard.className = 'pe-card';
  otherCard.innerHTML = `
    <div class="pe-title">その他</div>
    <div class="pe-items">
      <div class="pe-item pe-item-short"><div class="pe-lbl">差額計算</div><input class="pe-amt" id="payrollOtherDiff" type="number" step="1" placeholder="0"><span>円</span></div>
      <div class="pe-item pe-item-short"><div class="pe-lbl">追加診療費</div><input class="pe-amt" id="payrollOtherMedical" type="number" step="1" placeholder="0"><span>円</span></div>
      <div class="pe-item pe-item-short"><div class="pe-lbl">年末調整徴収</div><input class="pe-amt" id="payrollOtherYec" type="number" step="1" placeholder="0"><span>円</span></div>
      <div class="pe-item pe-item-short"><div class="pe-lbl">年末調整還付</div><input class="pe-amt" id="payrollOtherYer" type="number" step="1" placeholder="0"><span>円</span></div>
    </div>
  `;

  const payCard = document.createElement('div');
  payCard.className = 'pe-card';
  payCard.innerHTML = `
    <div class="pe-title">支払方法（振込・現金・現物）</div>
    <div class="pe-paygrid">
      <label class="pe-field pe-span2"><span>差引支払額（自動/手取り）</span><div class="pe-money"><input id="payrollNetPay" type="text" readonly><span>円</span></div></label>
      <label class="pe-field pe-span2"><span>支払方法合計（振込+現金+現物）</span><div class="pe-money"><input id="payrollPaySum" type="text" readonly><span>円</span></div></label>
      <label class="pe-field pe-span2"><span>銀行名</span><input id="payrollBankName" type="text" placeholder="例: みずほ銀行"></label>
      <label class="pe-field pe-span2"><span>支店名</span><input id="payrollBranchName" type="text" placeholder="例: 渋谷支店"></label>
      <label class="pe-field"><span>種別</span><select id="payrollAccountType"><option value="">選択</option><option value="普通">普通</option><option value="当座">当座</option></select></label>
      <label class="pe-field"><span>口座番号（7桁）</span><input id="payrollAccountNumber" type="text" inputmode="numeric" placeholder="1234567"></label>
      <label class="pe-field pe-span2"><span>名義（カナ）</span><input id="payrollAccountHolder" type="text" placeholder="例: ヤマダタロウ"></label>
      <label class="pe-field pe-span2"><span>振込支給額（任意）</span><div class="pe-money"><input id="payrollPayBank" type="text" inputmode="numeric" placeholder="0（空欄=自動）"><span>円</span></div></label>
      <label class="pe-field"><span>現金支給額</span><div class="pe-money"><input id="payrollPayCash" type="text" inputmode="numeric" placeholder="0"><span>円</span></div></label>
      <label class="pe-field"><span>現物支給額</span><div class="pe-money"><input id="payrollPayKind" type="text" inputmode="numeric" placeholder="0"><span>円</span></div></label>
    </div>
  `;

  lowerGrid.appendChild(otherCard);
  lowerGrid.appendChild(payCard);
  wrap.appendChild(lowerGrid);

  const actionCard = document.createElement('div');
  actionCard.className = 'pe-card';
  actionCard.innerHTML = `
    <div class="pe-title">操作</div>
    <div class="pe-actions">
      <button type="button" id="btnLoadPayroll">読み込み</button>
      <button type="button" id="btnSavePayroll" class="pe-primary" style="background:#059669;border-color:#047857;">保存</button>
      <button type="button" id="btnPreviewPayroll">プレビュー</button>
      <button type="button" id="btnCreatePdf" class="pe-primary">PDF作成</button>
      <button type="button" id="btnDownloadPdf">PDFダウンロード</button>
      <button type="button" id="btnPublishPayroll" class="pe-primary" style="background:#8b5cf6;border-color:#7c3aed;">社員へ送信（公開）</button>
    </div>
    <div id="payrollMsg" class="pe-msg"></div>
  `;
  wrap.appendChild(actionCard);

  const result = document.createElement('div');
  result.className = 'pe-preview';
  wrap.appendChild(result);

  const previewCard = document.createElement('div');
  previewCard.className = 'pe-previewCard';
  previewCard.style.display = 'none';
  result.appendChild(previewCard);

  const debugDetails = document.createElement('details');
  debugDetails.style.marginTop = '10px';
  debugDetails.innerHTML = `<summary class="pe-title">JSON（デバッグ）</summary><pre id="payrollDebugJson" style="white-space:pre-wrap;background:#fff;border:none;border-radius:0;padding:10px 12px;overflow:auto;font-size:12px;line-height:1.4;margin:0;"></pre>`;
  result.appendChild(debugDetails);

  const btnPreview = actionCard.querySelector('#btnPreviewPayroll');
  const setPreviewOpen = (open) => {
    if (!btnPreview) return;
    previewCard.style.display = open ? 'block' : 'none';
    if (!open) {
      try { debugDetails.open = false; } catch {}
      btnPreview.textContent = 'プレビュー';
    } else {
      btnPreview.textContent = 'プレビュー（閉じる）';
    }
  };

  const msgEl = actionCard.querySelector('#payrollMsg');
  const btnCreatePdf = actionCard.querySelector('#btnCreatePdf');
  const btnDownloadPdf = actionCard.querySelector('#btnDownloadPdf');
  if (btnDownloadPdf) btnDownloadPdf.disabled = true;

  const msg = (t, ok = false) => {
    if (!msgEl) return;
    msgEl.textContent = String(t || '');
    msgEl.style.color = ok ? '#065f46' : '#0f172a';
  };

  const users = await listUsers().catch(() => []);
  const sel = basicCard.querySelector('#payrollUserId');
  for (const u of users) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = `${u.id} ${u.username || u.email}`;
    sel.appendChild(opt);
  }

  const monthEl = basicCard.querySelector('#payrollMonth');
  const getKey = () => ({ userId: String(sel.value || '').trim(), month: String(monthEl.value || '').trim() });

  try {
    const lastUserId = String(localStorage.getItem('payroll.lastUserId') || '').trim();
    const lastMonth = String(localStorage.getItem('payroll.lastMonth') || '').trim();
    if (lastUserId) {
      const opt = sel.querySelector(`option[value="${CSS.escape(lastUserId)}"]`);
      if (opt) sel.value = lastUserId;
    }
    if (/^\d{4}-\d{2}$/.test(lastMonth)) {
      monthEl.value = lastMonth;
    }
  } catch {}
  let lastPdfKey = '';
  let lastSecureUrl = '';
  let lastEmpCode = '';
  let lastLoadedPayload = null;
  const clearPdfStateIfKeyChanged = () => {
    const k = getKey();
    const kk = `${k.userId}|${k.month}`;
    if (kk && kk === lastPdfKey) return;
    lastPdfKey = kk;
    lastSecureUrl = '';
    lastEmpCode = '';
    lastLoadedPayload = null;
    if (btnDownloadPdf) btnDownloadPdf.disabled = true;
  };

  const mergePayload = (base, patch) => {
    const b = base && typeof base === 'object' ? base : {};
    const p = patch && typeof patch === 'object' ? patch : {};
    const out = { ...b, ...p };
    const mergeObj = (k) => {
      const bv = b[k] && typeof b[k] === 'object' ? b[k] : null;
      const pv = p[k] && typeof p[k] === 'object' ? p[k] : null;
      if (bv || pv) out[k] = { ...(bv || {}), ...(pv || {}) };
    };
    mergeObj('kintai');
    mergeObj('payment');
    mergeObj('bankAccountParts');
    mergeObj('overrideEarnings');
    mergeObj('overrideDeductions');
    if (!Object.prototype.hasOwnProperty.call(p, 'extraEarnings') && Object.prototype.hasOwnProperty.call(b, 'extraEarnings')) out.extraEarnings = b.extraEarnings;
    if (!Object.prototype.hasOwnProperty.call(p, 'extraDeductions') && Object.prototype.hasOwnProperty.call(b, 'extraDeductions')) out.extraDeductions = b.extraDeductions;
    if (!Object.prototype.hasOwnProperty.call(p, 'otherItems') && Object.prototype.hasOwnProperty.call(b, 'otherItems')) out.otherItems = b.otherItems;
    return out;
  };

  let absentDeductionManual = false;

  const updateAutoCalcState = () => {
    const acEl = basicCard.querySelector('#payrollAutoCalc');
    const autoCalc = String(acEl && acEl.value != null ? acEl.value : '0') === '1';
    const dedFields = ['#ovDedHealth', '#ovDedCare', '#ovDedPension', '#ovDedEmployment', '#ovDedIncome'];
    for (const id of dedFields) {
      const el = document.querySelector(id);
      if (el) {
        el.disabled = autoCalc;
        if (autoCalc) {
          el.value = ''; // Clear manual overrides if auto calc is selected
          el.placeholder = '自動計算';
        } else {
          el.placeholder = '0';
        }
      }
    }
  };

  const { addRow, collectItems, setForm: baseSetForm, buildPayload: buildPayloadRaw } = createPayloadController({
    doc: document,
    basicCard,
    dedCard,
    otherCard,
    payCard,
    signal,
    parseNum,
    yen
  });

  const setForm = (payload) => {
    baseSetForm(payload);
    updateAutoCalcState();
    try {
      const ovE = payload && typeof payload === 'object' && payload.overrideEarnings && typeof payload.overrideEarnings === 'object'
        ? payload.overrideEarnings
        : {};
      absentDeductionManual = Object.prototype.hasOwnProperty.call(ovE, '欠勤控除');
    } catch {
      absentDeductionManual = false;
    }
  };

  const buildPayload = async () => {
    const p = await buildPayloadRaw();
    if (!absentDeductionManual && p && typeof p === 'object') {
      const ovE = p.overrideEarnings && typeof p.overrideEarnings === 'object' ? p.overrideEarnings : null;
      if (ovE && Object.prototype.hasOwnProperty.call(ovE, '欠勤控除')) {
        delete ovE['欠勤控除'];
        if (!Object.keys(ovE).length) delete p.overrideEarnings;
      }
    }
    return p;
  };

  const setKpi = ({ gross, deduct, net, paySum, hint }) => {
    const g = document.querySelector('#kpiGross');
    const d = document.querySelector('#kpiDeduct');
    const n = document.querySelector('#kpiNet');
    const p = document.querySelector('#kpiPaySum');
    const h = document.querySelector('#kpiHint');
    if (g) g.textContent = gross == null ? '-' : fmtYen(gross);
    if (d) d.textContent = deduct == null ? '-' : fmtYen(deduct);
    if (n) n.textContent = net == null ? '-' : fmtYen(net);
    if (p) p.textContent = paySum == null ? '-' : fmtYen(paySum);
    if (h) h.textContent = String(hint || '');
    try {
      const nn = Number(net || 0);
      const ps = Number(paySum || 0);
      const ok = nn > 0 && Math.round(ps) === Math.round(nn);
      if (btnCreatePdf) {
        btnCreatePdf.disabled = !ok;
        btnCreatePdf.style.opacity = ok ? '1' : '0.55';
      }
      if (btnDownloadPdf) {
        btnDownloadPdf.disabled = !ok || !lastSecureUrl;
        btnDownloadPdf.style.opacity = (!ok || !lastSecureUrl) ? '0.55' : '1';
      }
    } catch {}
  };

  const renderKv = (obj, { money = true, hide = [] } = {}) => {
    const rows = [];
    for (const [k, v] of Object.entries(obj || {})) {
      if (hide.includes(k)) continue;
      if (v == null) continue;
      if (money && typeof v === 'number' && !isMoneyKey(k)) continue;
      rows.push([k, v]);
    }
    return `
      <table class="pe-table">
        ${rows.map(([k, v]) => {
          const vv = typeof v === 'number' ? (money ? fmtYen(v) : esc(v)) : esc(v);
          return `<tr><td>${esc(k)}</td><td>${vv}</td></tr>`;
        }).join('')}
      </table>
    `;
  };

  const renderKintai = (obj) => {
    const map = {
      '就業時間': (v) => hmFromMin(v),
      '法外時間外': (v) => hmFromMin(v),
      '週40超時間': (v) => hmFromMin(v),
      '月60超時間': (v) => hmFromMin(v),
      '深夜勤時間': (v) => hmFromMin(v)
    };
    const keys = ['出勤日数', '休日出勤日数', '半日出勤日数', '欠勤日数', '有給休暇', '就業時間', '法外時間外', '週40超時間', '月60超時間', '深夜勤時間'];
    return `
      <table class="pe-table">
        ${keys.map((k) => {
          if (!Object.prototype.hasOwnProperty.call(obj || {}, k)) return '';
          const v = obj[k];
          const f = map[k] || ((x) => x);
          const vv = typeof v === 'number' ? esc(f(v)) : esc(v);
          return `<tr><td>${esc(k)}</td><td>${vv}</td></tr>`;
        }).join('')}
      </table>
    `;
  };

  const updatePreview = (emp) => {
    if (!emp) return;
    previewCard.style.display = 'block';
    try { lastEmpCode = String((emp && emp['従業員コード']) ? emp['従業員コード'] : '').trim() || lastEmpCode; } catch {}
    const totals = (emp && emp['合計'] && typeof emp['合計'] === 'object') ? emp['合計'] : {};
    const pay = (emp && emp['支払'] && typeof emp['支払'] === 'object') ? emp['支払'] : {};
    const kintai = (emp && emp['勤怠'] && typeof emp['勤怠'] === 'object') ? emp['勤怠'] : {};
    const earn = (emp && emp['支給'] && typeof emp['支給'] === 'object') ? emp['支給'] : {};
    const ded = (emp && emp['控除'] && typeof emp['控除'] === 'object') ? emp['控除'] : {};
    const other = (emp && emp['その他'] && typeof emp['その他'] === 'object') ? emp['その他'] : {};
    const netPay = Number(totals['差引支給額'] || 0);
    const paySum = Number(pay['振込支給額'] || 0) + Number(pay['現金支給額'] || 0) + Number(pay['現物支給額'] || 0);
    const okPay = Math.round(paySum) === Math.round(netPay);
    try {
      const netEl = document.querySelector('#payrollNetPay');
      const sumEl = document.querySelector('#payrollPaySum');
      if (netEl) netEl.value = fmtNum(netPay);
      if (sumEl) sumEl.value = fmtNum(paySum);
    } catch {}
    const autoEl = document.querySelector('#payrollAutoCalc');
    const isAuto = String(autoEl && autoEl.value != null ? autoEl.value : '0') === '1';
    const calcHint = isAuto ? '【自動計算ON】 保険料・所得税は自動算出されます' : '【自動計算OFF】 保険料・所得税は手入力の値が使用されます';
    try {
      if (!absentDeductionManual) {
        const absentEl = document.querySelector('#ovEarnAbsent');
        const absentDays = Number(kintai['欠勤日数'] || 0);
        const val = Object.prototype.hasOwnProperty.call(earn, '欠勤控除') ? yen(earn['欠勤控除']) : 0;
        if (absentEl) {
          absentEl.value = absentDays > 0 && val ? String(val) : '';
        }
      }
    } catch {}
    previewCard.innerHTML = `
      <div class="pe-title">給与明細書（プレビュー）</div>
      <div class="pe-muted" style="margin-bottom:10px">${esc((emp && emp['対象年月']) ? emp['対象年月'] : '')} / ${esc((emp && emp['所属']) ? emp['所属'] : '')} / ${esc((emp && emp['氏名']) ? emp['氏名'] : '')}（${esc((emp && emp['従業員コード']) ? emp['従業員コード'] : '')}）</div>
      <div class="pe-muted" style="margin-bottom:10px;color:#0ea5e9;">${calcHint}</div>
      <div class="pe-muted" style="margin-bottom:10px">差引支払額（手取り） = 支払内訳合計 − 控除合計</div>
      <div class="pe-previewGrid">
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">勤怠</div>
          ${renderKintai(kintai || {})}
        </div>
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">支払方法</div>
          ${renderKv({ 振込口座: (emp && emp['振込口座']) ? emp['振込口座'] : '', 振込支給額: pay['振込支給額'] || 0, 現金支給額: pay['現金支給額'] || 0, 現物支給額: pay['現物支給額'] || 0, 支払方法合計: paySum }, { money: true })}
          <div class="pe-muted" style="margin-top:6px">${okPay ? '支払方法は一致しています' : '支払方法が一致していません'}</div>
        </div>
      </div>
      <div class="pe-previewGrid" style="margin-top:10px">
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">支給</div>
          ${renderKv(earn || {}, { money: true })}
        </div>
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">控除</div>
          ${renderKv(ded || {}, { money: true, hide: ['社保合計額', '課税対象額'] })}
        </div>
      </div>
      <div class="pe-previewGrid" style="margin-top:10px">
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">その他</div>
          ${renderKv(other || {}, { money: true })}
        </div>
        <div>
          <div class="pe-title" style="margin:0 0 8px 0">合計</div>
          ${renderKv({
            総支給額: totals['総支給額'] || 0,
            総控除額: totals['総控除額'] || 0,
            'その他合計（参考）': totals['その他合計'] || 0,
            差引支給額: totals['差引支給額'] || 0
          }, { money: true })}
        </div>
      </div>
    `;
    const pre = document.querySelector('#payrollDebugJson');
    if (pre) pre.textContent = JSON.stringify(emp || {}, null, 2);
  };

  const svc = createPayrollService({ fetchJSONAuth });
  const { computeEmp, persistPayload, generatePayslip, publishPayslip, listDeliveries } = svc;

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
  };

  const deliveriesCard = document.createElement('div');
  deliveriesCard.className = 'pe-card';
  deliveriesCard.innerHTML = `
    <div class="pe-title">送信履歴</div>
    <div id="payrollDeliveries"></div>
  `;
  wrap.appendChild(deliveriesCard);
  const deliveriesHost = deliveriesCard.querySelector('#payrollDeliveries');

  const renderDeliveries = (items) => {
    if (!deliveriesHost) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      deliveriesHost.innerHTML = `<div style="color:#64748b;font-weight:800;padding:6px 2px;">送信履歴がありません</div>`;
      return;
    }
    deliveriesHost.innerHTML = `
      <table class="pe-table" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tbody>
          ${list.map(it => {
            const when = formatDateTime(it && it.sentAt ? it.sentAt : '');
            const who = escapeHtml(it && it.userName ? it.userName : '');
            const month = escapeHtml(it && it.month ? it.month : '');
            const fileName = escapeHtml(it && it.fileName ? it.fileName : '');
            const fileId = String((it && it.fileId != null) ? it.fileId : '');
            return `
              <tr>
                <td style="width:26%;font-weight:900;">${when}</td>
                <td style="width:24%;">${who}</td>
                <td style="width:16%;">${month}</td>
                <td style="width:34%;">
                  ${fileId ? `<a href="#" data-file-id="${escapeHtml(fileId)}" data-file-name="${fileName}" style="color:#1d4ed8;text-decoration:underline;font-weight:900;">${fileName || 'PDF'}</a>` : `${fileName || '-'}`}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    deliveriesHost.querySelectorAll('a[data-file-id]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = String(a.getAttribute('data-file-id') || '').trim();
        if (!id) return;
        let w = null;
        try { w = window.open('about:blank', '_blank'); } catch {}
        if (!w) { msg('ポップアップがブロックされました。許可してください。'); return; }
        setPopupMessage(w, '処理中…');
        let res = null;
        try {
          res = await fetchResponseAuth(`/api/payslips/admin/file/${encodeURIComponent(id)}`);
        } catch (err) {
          setPopupMessage(w, 'エラー', (err && err.message) ? err.message : 'error');
          return;
        }
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/pdf')) {
          let t = '';
          try { t = await res.clone().text(); } catch {}
          setPopupMessage(w, 'PDFの取得に失敗しました。', t || '');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        try {
          w.location.href = url;
        } catch {}
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 30000);
      });
    });
  };

  const refreshDeliveries = async () => {
    const k = getKey();
    if (!k.userId) { renderDeliveries([]); return; }
    try {
      const r = await listDeliveries({ userId: k.userId, month: null });
      renderDeliveries((r && Array.isArray(r.items)) ? r.items : []);
    } catch (e) {
      if (deliveriesHost) {
        deliveriesHost.innerHTML = `<div style="color:#b91c1c;font-weight:900;padding:6px 2px;">送信履歴の取得に失敗しました（サーバー再起動が必要な可能性があります）</div>`;
      } else {
        renderDeliveries([]);
      }
    }
  };

  const loadInput = async () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { msg('社員と月を選択'); return null; }
    const r = await svc.loadInput({ userId: k.userId, month: k.month });
    const p = (r && r.payload && typeof r.payload === 'object') ? r.payload : null;
    if (p && Object.keys(p).length) {
      setForm(p);
      lastLoadedPayload = p;
      const pubStatus = (r && r.is_published) ? '🟢 公開済' : '🔴 未公開';
      const timeStr = (r && r.updatedAt) ? ` (最終更新: ${formatDateTime(r.updatedAt)})` : '';
      msg(`読み込みました（${pubStatus}）${timeStr}`);
      await refreshDeliveries();
      return p;
    }
    msg('保存データがありません（未保存）');
    lastLoadedPayload = null;
    await refreshDeliveries();
    return p || {};
  };

  const saveInput = async () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { msg('社員と月を選択'); return; }
    const patch = await buildPayload();
    const payload = mergePayload(lastLoadedPayload, patch);
    await persistPayload({ userId: k.userId, month: k.month, payload });
    lastLoadedPayload = payload;
    msg('保存しました', true);
  };

  const preview = async () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { msg('社員と月を選択'); return; }
    clearPdfStateIfKeyChanged();
    const patch = await buildPayload();
    const payload = mergePayload(lastLoadedPayload, patch);
    const emp = await computeEmp({ userId: k.userId, month: k.month, payload });
    try {
      const totals = (emp && emp['合計'] && typeof emp['合計'] === 'object') ? emp['合計'] : {};
      const pay = (emp && emp['支払'] && typeof emp['支払'] === 'object') ? emp['支払'] : {};
      const net = Number(totals['差引支給額'] || 0);
      const sum = Number(pay['振込支給額'] || 0) + Number(pay['現金支給額'] || 0) + Number(pay['現物支給額'] || 0);
      const hint = Math.round(sum) !== Math.round(net)
        ? `支払方法が一致しません（${Math.round(sum)} != ${Math.round(net)}）`
        : '支払方法合計は差引支払額と一致するのが正しい（振込+現金+現物）';
      const acEl = basicCard.querySelector('#payrollAutoCalc');
      const isAuto = String(acEl && acEl.value != null ? acEl.value : '0') === '1';
      const calcHint = isAuto ? '【自動計算ON】 保険料・所得税は自動算出されます' : '【自動計算OFF】 保険料・所得税は手入力の値が使用されます';
      setKpi({ gross: totals['総支給額'], deduct: totals['総控除額'], net, paySum: sum, hint: `${hint} | ${calcHint}` });
    } catch {}
    updatePreview(emp);
  };

  const { scheduleRealtime } = createRealtimeController({
    getKey,
    buildPayload,
    computeEmp,
    setKpi,
    updatePreview,
    clearPdfStateIfKeyChanged
  });

  const safeCloseWindow = (w) => { try { if (w && !w.closed) w.close(); } catch {} };
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  const setPopupMessage = (w, title, detail = '') => {
    if (!w || w.closed) return;
    const t = escapeHtml(title);
    const d = escapeHtml(detail);
    try { w.document.open(); } catch {}
    try {
      w.document.write(`<title>${t}</title><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#0f172a}h1{font-size:16px;margin:0 0 12px}pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}</style><h1>${t}</h1>${d ? `<pre>${d}</pre>` : ''}`);
      w.document.close();
    } catch {}
  };

  const createPdf = async (openedWindow) => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { setPopupMessage(openedWindow, '社員と月を選択'); msg('社員と月を選択'); return; }
    clearPdfStateIfKeyChanged();
    msg('処理中…');
    try {
      const patch = await buildPayload();
      const payload = mergePayload(lastLoadedPayload, patch);
      await persistPayload({ userId: k.userId, month: k.month, payload });
      lastLoadedPayload = payload;
      const emp = await computeEmp({ userId: k.userId, month: k.month, payload }).catch(() => null);
      try { lastEmpCode = String((emp && emp['従業員コード']) ? emp['従業員コード'] : '').trim() || String(k.userId); } catch { lastEmpCode = String(k.userId); }
      const totals = (emp && emp['合計'] && typeof emp['合計'] === 'object') ? emp['合計'] : {};
      const pay = (emp && emp['支払'] && typeof emp['支払'] === 'object') ? emp['支払'] : {};
      const net = Number(totals['差引支給額'] || 0);
      const sum = Math.round(Number(pay['振込支給額'] || 0) + Number(pay['現金支給額'] || 0) + Number(pay['現物支給額'] || 0));
      if (!net) { setPopupMessage(openedWindow, '差引支払額が0です。'); msg('差引支払額が0です。'); return; }
      if (sum !== Math.round(net)) { setPopupMessage(openedWindow, '支払方法が一致しません', `${sum} != ${net}`); msg(`支払方法合計が差引支払額と一致しません（${sum} != ${net}）。`); return; }
      const r = await generatePayslip({ userId: k.userId, month: k.month });
      if (!(r && r.secureUrl)) { setPopupMessage(openedWindow, 'PDF作成に失敗しました。'); msg('PDF作成に失敗しました。', false); return; }
      lastSecureUrl = String(r.secureUrl || '');
      if (btnDownloadPdf) btnDownloadPdf.disabled = false;
      await openPdf(openedWindow);
      msg('PDFを作成しました', true);
      await refreshDeliveries();
    } catch (e) {
      setPopupMessage(openedWindow, 'エラー', (e && e.message) ? e.message : 'error');
      msg((e && e.message) ? e.message : 'error');
    }
  };

  const openPdf = async (openedWindow) => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { setPopupMessage(openedWindow, '社員と月を選択'); msg('社員と月を選択'); return; }
    clearPdfStateIfKeyChanged();
    if (!lastSecureUrl) { setPopupMessage(openedWindow, 'まだPDFがありません。', '先に「PDF作成」を押してください。'); msg('まだPDFがありません。先に「PDF作成」を押してください。'); return; }
    msg('処理中…');
    let w = openedWindow;
    if (!w) {
      try { w = window.open('about:blank', '_blank'); } catch {}
    }
    let res = null;
    try {
      res = await fetchResponseAuth(lastSecureUrl);
    } catch (e) {
      setPopupMessage(w, 'エラー', (e && e.message) ? e.message : 'error');
      msg((e && e.message) ? e.message : 'error');
      return;
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/pdf')) {
      let t = '';
      try { t = await res.clone().text(); } catch {}
      setPopupMessage(w, 'PDFの取得に失敗しました。', t || '');
      msg(t || 'PDFの取得に失敗しました。', false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const y = k.month.slice(0, 4);
    const mm = k.month.slice(5, 7);
    const code = String(lastEmpCode || k.userId).trim() || String(k.userId);
    const filename = `${y}年${mm}月給与明細${code}.pdf`;
    try {
      if (w) {
        w.location.href = url;
        try { w.document.title = filename; } catch {}
      } else {
        window.open(url, '_blank');
      }
    } catch {}
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 30000);
    msg('PDFを開きました', true);
  };

  const downloadPdf = async () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { msg('社員と月を選択'); return; }
    if (!lastSecureUrl) { msg('まだPDFがありません。先に「PDF作成」を押してください。'); return; }
    msg('処理中…');
    let res = null;
    try {
      res = await fetchResponseAuth(lastSecureUrl);
    } catch (e) {
      msg((e && e.message) ? e.message : 'error');
      return;
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/pdf')) {
      let t = '';
      try { t = await res.clone().text(); } catch {}
      msg(t || 'PDFの取得に失敗しました。', false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const y = k.month.slice(0, 4);
    const mm = k.month.slice(5, 7);
    const code = String(lastEmpCode || k.userId).trim() || String(k.userId);
    const filename = `${y}年${mm}月給与明細${code}.pdf`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch {}
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 30000);
    msg('PDFをダウンロードしました', true);
  };

  wrap.addEventListener('input', (e) => {
    if (!e || !e.target) return;
    if (e.target.id === 'payrollAutoCalc') updateAutoCalcState();
    scheduleRealtime();
  }, { passive: true, signal });

  const absentEl = document.querySelector('#ovEarnAbsent');
  if (absentEl) {
    absentEl.addEventListener('input', () => {
      const v = String(absentEl.value || '').trim();
      absentDeductionManual = !!v;
    }, { signal });
  }

  const btnAddEarn = document.querySelector('#btnAddEarn');
  if (btnAddEarn) btnAddEarn.addEventListener('click', () => addRow('#payrollEarnings'), { signal });
  const btnAddDed = document.querySelector('#btnAddDed');
  if (btnAddDed) btnAddDed.addEventListener('click', () => addRow('#payrollDeductions'), { signal });

  const btnLoad = actionCard.querySelector('#btnLoadPayroll');
  if (btnLoad) btnLoad.addEventListener('click', () => loadInput().catch(e => msg((e && e.message) ? e.message : 'error')), { signal });
  const btnSave = actionCard.querySelector('#btnSavePayroll');
  if (btnSave) btnSave.addEventListener('click', () => saveInput().catch(e => msg((e && e.message) ? e.message : 'error')), { signal });
  if (btnPreview) btnPreview.addEventListener('click', async () => {
    const isOpen = previewCard.style.display !== 'none';
    if (isOpen) {
      setPreviewOpen(false);
      return;
    }
    await preview().catch(e => msg((e && e.message) ? e.message : 'error'));
    setPreviewOpen(true);
  }, { signal });
  const btnCreate = actionCard.querySelector('#btnCreatePdf');
  if (btnCreate) btnCreate.addEventListener('click', () => {
    let w = null;
    try { w = window.open('about:blank', '_blank'); } catch {}
    if (!w) msg('ポップアップがブロックされました。許可してください。');
    createPdf(w).catch(e => msg((e && e.message) ? e.message : 'error'));
  }, { signal });
  const btnDl = actionCard.querySelector('#btnDownloadPdf');
  if (btnDl) btnDl.addEventListener('click', () => {
    downloadPdf().catch(e => msg((e && e.message) ? e.message : 'error'));
  }, { signal });
  const btnPublish = actionCard.querySelector('#btnPublishPayroll');
  if (btnPublish) btnPublish.addEventListener('click', async () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) { msg('社員と月を選択'); return; }
    if (!confirm(`${k.month}の給与明細を社員に送信（公開）しますか？\n\n公開すると、社員はマイページからこの給与明細を確認できるようになります。`)) return;
    try {
      msg('送信中...');
      const r = await publishPayslip({ userId: k.userId, month: k.month, is_published: true });
      msg(`社員に送信しました（${formatDateTime(new Date().toISOString())}）`, true);
      await refreshDeliveries();
    } catch (e) {
      msg((e && e.message) ? e.message : '送信に失敗しました');
    }
  }, { signal });

  sel.addEventListener('change', () => {
    clearPdfStateIfKeyChanged();
    try { localStorage.setItem('payroll.lastUserId', String(sel.value || '').trim()); } catch {}
    refreshDeliveries().catch(() => {});
  }, { signal });
  monthEl.addEventListener('change', () => {
    clearPdfStateIfKeyChanged();
    try { localStorage.setItem('payroll.lastMonth', String(monthEl.value || '').trim()); } catch {}
  }, { signal });

  const autoFillKintaiCounts = async () => {
    const userId = String(sel.value || '').trim();
    const ym = String(monthEl.value || '').trim();
    if (!userId || !/^\d{4}-\d{2}$/.test(ym)) return;
    const y = ym.slice(0, 4);
    const m = ym.slice(5, 7);
    try {
      const r = await fetchJSONAuth(`/api/attendance/month/summary?userId=${encodeURIComponent(userId)}&year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}`);
      const src = (r && r.all) ? r.all : (r && r.inhouse) ? r.inhouse : null;
      if (!src || typeof src !== 'object') return;
      const kWork = Number(src['出勤日数'] || 0);
      const kHoliday = Number(src['休日出勤日数'] || 0);
      const kHalf = Number(src['半日出勤日数'] || 0);
      const kAbsent = Number(src['欠勤日数'] || 0);
      const kUnpaid = Number(src['無給休暇'] || 0);
      const setVal = (id, val) => {
        const el = document.querySelector(id);
        if (el) el.value = String(Math.max(0, Math.round(val || 0)));
      };
      setVal('#payrollKWork', kWork);
      setVal('#payrollKHoliday', kHoliday);
      setVal('#payrollKHalf', kHalf);
      setVal('#payrollKAbsent', kAbsent);
      setVal('#payrollKUnpaid', kUnpaid);
    } catch {}
  };

  sel.addEventListener('change', () => { autoFillKintaiCounts().catch(() => {}); }, { signal });
  monthEl.addEventListener('change', () => { autoFillKintaiCounts().catch(() => {}); }, { signal });

  updateAutoCalcState();
  msg('');
  await refreshDeliveries().catch(() => {});
  await autoFillKintaiCounts().catch(() => {});
}
