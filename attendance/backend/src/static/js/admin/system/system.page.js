const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

export async function mount() {
  const host = document.querySelector('#adminContent');
  if (!host) return;
  const p = normalizePath(window.location.pathname);
  const isAudit = p === '/admin/system/audit-logs';
  const title = isAudit ? '監査ログ' : '設定';
  const desc = isAudit
    ? '監査ログ画面はこれから実装します。'
    : '設定画面はこれから実装します。';

  host.className = 'card';
  host.innerHTML = `
    <section style="max-width:1100px;margin:12px auto;padding:0 8px;">
      <div style="border:1px solid #dbeafe;background:#f8fbff;border-radius:14px;padding:16px;">
        <div style="font-size:20px;font-weight:900;color:#0b2c66;margin-bottom:8px;">${title}</div>
        <div style="font-size:14px;color:#334155;margin-bottom:14px;">${desc}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="/admin/dashboard" class="btn">ダッシュボードへ戻る</a>
          <a href="/admin/system/settings" class="btn">設定</a>
          <a href="/admin/system/audit-logs" class="btn">監査ログ</a>
        </div>
      </div>
    </section>
  `;
}
