import { fetchJSONAuth } from '../../api/http.api.js';

export async function mountSettings({ content, profile }) {
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
              <option value="ja" ${prefs.lang === 'ja' ? 'selected' : ''}>日本語</option>
              <option value="en" ${prefs.lang === 'en' ? 'selected' : ''}>English</option>
              <option value="vi" ${prefs.lang === 'vi' ? 'selected' : ''}>Tiếng Việt</option>
            </select>
          </div>
          <div class="row">
            <label>地域</label>
            <select id="regionSel">
              <option value="ja-JP" ${prefs.region === 'ja-JP' ? 'selected' : ''}>日本語 (日本)</option>
              <option value="en-US" ${prefs.region === 'en-US' ? 'selected' : ''}>English (United States)</option>
              <option value="vi-VN" ${prefs.region === 'vi-VN' ? 'selected' : ''}>Tiếng Việt (Việt Nam)</option>
            </select>
          </div>
          <div class="row">
            <label>タイムゾーン</label>
            <select id="tzSel">
              <option value="Asia/Tokyo" ${prefs.tz === 'Asia/Tokyo' ? 'selected' : ''}>GMT+09:00 日本標準時 (Asia/Tokyo)</option>
              <option value="UTC" ${prefs.tz === 'UTC' ? 'selected' : ''}>UTC</option>
              <option value="Asia/Ho_Chi_Minh" ${prefs.tz === 'Asia/Ho_Chi_Minh' ? 'selected' : ''}>GMT+07:00 (Asia/Ho_Chi_Minh)</option>
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
