const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

let fontkit = null;
try { fontkit = require('fontkit'); } catch {}

const _fontFileCache = new Map();
const _fontSubsetCache = new Map();

function pickExistingFile(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function registerFontSafe(doc, name, fontPath) {
  if (!fontPath) return false;
  try {
    doc.registerFont(name, fontPath);
    return true;
  } catch {
    return false;
  }
}

function isTtcFont(fontPath) {
  return /\.ttc$/i.test(String(fontPath || ''));
}

function isFontFilePath(fontPath) {
  const p = String(fontPath || '');
  if (!p || isTtcFont(p)) return false;
  if (!/\.(ttf|otf)$/i.test(p)) return false;
  if (_fontFileCache.has(p)) return _fontFileCache.get(p);
  try {
    const st = fs.statSync(p);
    const ok = !!(st && st.isFile());
    _fontFileCache.set(p, ok);
    return ok;
  } catch {
    _fontFileCache.set(p, false);
    return false;
  }
}

function isTtfFont(fontPath) {
  return /\.ttf$/i.test(String(fontPath || ''));
}

function fontSupportsSubset(fontPath) {
  const p = String(fontPath || '');
  if (!p) return false;
  if (!fontkit) return isTtfFont(p);
  if (_fontSubsetCache.has(p)) return _fontSubsetCache.get(p);
  try {
    const f = fontkit.openSync(p);
    const ok = typeof f?.createSubset === 'function';
    _fontSubsetCache.set(p, ok);
    return ok;
  } catch {
    _fontSubsetCache.set(p, false);
    return false;
  }
}

function pickExistingUsableFontFile(paths) {
  for (const p of (paths || [])) {
    if (!isFontFilePath(p)) continue;
    if (!fontkit && !isTtfFont(p)) continue;
    if (fontkit && !fontSupportsSubset(p)) continue;
    return p;
  }
  return null;
}

function yen(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function hmFromMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}

function txt(v) {
  return v == null ? '' : String(v);
}

function mapPdfFontSubsetError(err, ctx) {
  const m = String(err?.message || err || '');
  if (!m.includes('createSubset')) return err;
  const reg = ctx?.jpRegularPath ? String(ctx.jpRegularPath) : '';
  const bold = ctx?.jpBoldPath ? String(ctx.jpBoldPath) : '';
  const picked = [reg && `REG=${reg}`, bold && `BOLD=${bold}`].filter(Boolean).join(' ');
  return new Error(`PDF font error: selected font does not support subsetting (createSubset). Use a Japanese-capable TTF font and set PAYSLIP_PDF_FONT_REG/PAYSLIP_PDF_FONT_BOLD. ${picked ? `Picked: ${picked}` : ''}`.trim());
}

function buildPayslipPdf({ employee, companyName, issueDate }) {
  return new Promise((resolve, reject) => {
    if (!employee || typeof employee !== 'object') {
      reject(new Error('Employee data required'));
      return;
    }

    let settled = false;
    const finish = (fn) => (...args) => {
      if (settled) return;
      settled = true;
      fn(...args);
    };

    const emp = employee;
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const fontCtx = { jpRegularPath: null, jpBoldPath: null };
    const chunks = [];

    doc.on('data', c => chunks.push(c));
    doc.on('end', finish(() => resolve(Buffer.concat(chunks))));
    doc.on('error', finish((e) => reject(mapPdfFontSubsetError(e, fontCtx))));

  const repoFontDir = path.join(__dirname, '../../', 'static', 'fonts');
  const jpRegularCandidates = [
    process.env.PAYSLIP_PDF_FONT_REG,
    path.join(repoFontDir, 'NotoSansJP-Regular.ttf'),
    path.join(repoFontDir, 'NotoSansJP-Medium.otf'),
    path.join(repoFontDir, 'NotoSansJP-Medium.ttf'),
    path.join(repoFontDir, 'NotoSansJP-Regular.otf'),
    'C:\\Windows\\Fonts\\ARIALUNI.TTF',
    '/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansJP-Regular.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf'
  ];
  const jpBoldCandidates = [
    process.env.PAYSLIP_PDF_FONT_BOLD,
    path.join(repoFontDir, 'NotoSansJP-Bold.ttf'),
    path.join(repoFontDir, 'NotoSansJP-Bold.otf'),
    'C:\\Windows\\Fonts\\ARIALUNI.TTF',
    '/usr/share/fonts/truetype/noto/NotoSansJP-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansCJKjp-Bold.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKjp-Bold.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansJP-Bold.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKjp-Bold.otf'
  ];
  const jpRegularPath = pickExistingUsableFontFile(jpRegularCandidates);
  const jpBoldPath = pickExistingUsableFontFile(jpBoldCandidates);
  fontCtx.jpRegularPath = jpRegularPath;
  fontCtx.jpBoldPath = jpBoldPath;

  const hasJPRegular = registerFontSafe(doc, 'JP', jpRegularPath);
  const hasJPBold = registerFontSafe(doc, 'JP-Bold', jpBoldPath);
  const FONT_REG = hasJPRegular ? 'JP' : 'Helvetica';
  const FONT_BOLD = hasJPBold ? 'JP-Bold' : (hasJPRegular ? 'JP' : 'Helvetica-Bold');
  if (!hasJPRegular && !hasJPBold) {
    try { console.warn(`JP font not found/usable. Falling back to Helvetica. Tried REG: ${jpRegularCandidates.filter(Boolean).join(' | ')}`); } catch {}
  }
  try {
    doc.font(FONT_REG);
    doc.font(FONT_BOLD);
  } catch (e) {
    finish(reject)(mapPdfFontSubsetError(e, fontCtx));
    try { doc.end(); } catch {}
    return;
  }

  try {
  const black = '#000000';
  const cyanBg = '#ccffff';
  const LW = 1;

  const n = (v) => Math.round(Number(v) || 0);
  const money = (v) => yen(n(v));
  const countZero = (v) => Number(v || 0).toFixed(2);

  const drawRect = (x, y, w, h, fill = null, lineWidth = LW) => {
    doc.save();
    if (fill) {
      doc.fillColor(fill).rect(x, y, w, h).fill();
    }
    if (lineWidth && lineWidth > 0) {
      doc.lineWidth(lineWidth).strokeColor(black).lineCap('butt').lineJoin('miter').rect(x, y, w, h).stroke();
    }
    doc.restore();
  };

  const writeText = (text, x, y, options = {}) => {
    doc.save();
    doc.fillColor(black);
    doc.font(options.bold ? FONT_BOLD : FONT_REG).fontSize(options.size || 9);
    try {
      doc.text(text, x, y, options);
    } catch (e) {
      throw mapPdfFontSubsetError(e, fontCtx);
    }
    doc.restore();
  };

  const writeVerticalText = (text, x, y, size = 12) => {
    doc.save();
    doc.fillColor(black).font(FONT_BOLD).fontSize(size);
    let curY = y;
    for (const char of text) {
      try {
        doc.text(char, x, curY, { width: 25, align: 'center' });
      } catch (e) {
        throw mapPdfFontSubsetError(e, fontCtx);
      }
      curY += size + 4;
    }
    doc.restore();
  };

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const W = pageW;
  const H = pageH;
  const mx = 20;
  let cy = 30;

  const compRaw0 = String(companyName || '').trim();
  const compRaw = compRaw0 || '飯塚塗研株式会社';
  const compLines = compRaw ? compRaw.split('\n').map(s => String(s || '').trim()).filter(Boolean) : [];
  if (compLines.length === 0) compLines.push('飯塚塗研株式会社');
  const headerTopY = cy;
  writeText(compLines[0], mx, headerTopY, { size: 11, bold: true, width: W - mx * 2, align: 'center' });
  if (compLines[1]) writeText(compLines[1], mx, headerTopY + 14, { size: 11, bold: true, width: W - mx * 2, align: 'center' });
  const infoY = headerTopY + (compLines[1] ? 34 : 20);
  
  const issueDateStr = txt(issueDate) || '';
  const noStr = txt(emp['従業員コード'] || emp.userId || '');
  const nameStr = txt(emp['氏名'] || '');

  writeText('支給日', 350, infoY, { size: 10 });
  writeText(issueDateStr, 400, infoY, { size: 10 });
  writeText('No', 350, infoY + 14, { size: 10 });
  writeText(noStr, 400, infoY + 14, { size: 10 });
  writeText('氏名', 350, infoY + 28, { size: 10 });
  writeText(nameStr, 400, infoY + 28, { size: 10 });

  cy = infoY + 56;
  
  const month = txt(emp['対象年月'] || emp.month || '');
  const mMatch = month.match(/^(\d{4})-(\d{2})/);
  const year = mMatch ? mMatch[1] : '';
  const mon = mMatch ? mMatch[2] : '';
  writeText(`給与支給明細書　${year}年${mon}月`, mx, cy, { size: 12, bold: true });
  cy += 16;

  const tableW = Math.round(W - mx * 2);
  const leftColW = 25;
  const dataW = tableW - leftColW;

  const maxColsAll = 7;
  const baseColW = Math.floor(dataW / maxColsAll);
  const remColW = dataW - baseColW * maxColsAll;
  const colWsAll = Array.from({ length: maxColsAll }, (_v, i) => baseColW + (i < remColW ? 1 : 0));
  const colXsAll = (() => {
    const xs = [];
    let x = mx + leftColW;
    for (let i = 0; i < maxColsAll; i++) {
      xs.push(x);
      x += colWsAll[i];
    }
    return xs;
  })();

  const drawTableGrid = (startY, title, maxRows, items) => {
    const rowH = 16;
    const totalH = maxRows * 2 * rowH;

    doc.save().fillColor(cyanBg).rect(mx, startY, leftColW, totalH).fill().restore();

    const fillValueRow = title === '勤怠';
    for (let r = 0; r < maxRows; r++) {
      const yRow = startY + r * 2 * rowH;
      const yFill = fillValueRow ? (yRow + rowH) : yRow;
      doc.save().fillColor(cyanBg).rect(mx + leftColW, yFill, dataW, rowH).fill().restore();
    }

    doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').rect(mx, startY, tableW, totalH).stroke().restore();
    doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(mx + leftColW, startY).lineTo(mx + leftColW, startY + totalH).stroke().restore();
    for (let c = 1; c < maxColsAll; c++) {
      const x = colXsAll[c];
      doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(x, startY).lineTo(x, startY + totalH).stroke().restore();
    }

    for (let r = 0; r < maxRows; r++) {
      const yTop = startY + r * 2 * rowH;
      const yMid = yTop + rowH;
      if (r > 0) {
        doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(mx + leftColW, yTop).lineTo(mx + tableW, yTop).stroke().restore();
      }
      doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(mx + leftColW, yMid).lineTo(mx + tableW, yMid).stroke().restore();
    }

    const textHeight = title.length * 16;
    writeVerticalText(title, mx, startY + (totalH - textHeight) / 2, 12);

    for (let r = 0; r < maxRows; r++) {
      const yRow = startY + r * 2 * rowH;
      for (let c = 0; c < maxColsAll; c++) {
        const cx = colXsAll[c];
        const cw = colWsAll[c];
        const idx = r * maxColsAll + c;
        if (idx < items.length && items[idx]) {
          const item = items[idx];
          if (item.label) {
            writeText(item.label, cx + 4, yRow + 4, { size: 8 });
          }
          if (item.value) {
            writeText(String(item.value), cx + 4, yRow + rowH + 4, { size: 9, width: cw - 8, align: 'right' });
          }
        }
      }
    }
    return startY + totalH;
  };

  const kintai = emp['勤怠'] || {};
  const earnings = emp['支給'] || {};
  const deductions = emp['控除'] || {};
  const totals = emp['合計'] || {};

  const attSlots = Array(21).fill(null); // 3 hàng * 7 cột = 21 slots
  attSlots[0] = { label: '出勤日数', value: countZero(kintai['出勤日数']) };
  attSlots[1] = { label: '有給休暇', value: countZero(kintai['有給休暇']) };
  attSlots[4] = { label: '欠勤日数', value: countZero(kintai['欠勤日数']) };
  attSlots[7] = { label: '就業時間', value: countZero(kintai['就業時間']) };
  attSlots[8] = { label: '法外時間外', value: countZero(kintai['法外時間外'] ?? 0) };
  attSlots[9] = { label: '所定休出勤', value: countZero(kintai['所定休出勤'] ?? kintai['休日出勤日数'] ?? 0) };
  attSlots[10] = { label: '週40超時間', value: countZero(kintai['週40超時間'] ?? 0) };
  attSlots[11] = { label: '月60超時間', value: countZero(kintai['月60超時間'] ?? 0) };
  attSlots[12] = { label: '法定休出勤', value: countZero(kintai['法定休出勤'] ?? 0) };
  attSlots[13] = { label: '深夜勤時間', value: countZero(kintai['深夜勤時間'] ?? 0) };
  attSlots[14] = { label: '前月有休残', value: countZero(kintai['前月有休残'] ?? 0) };

  cy = drawTableGrid(cy, '勤怠', 3, attSlots);
  cy += 10;

  const earnItems = [];
  const addE = (l, v) => earnItems.push({ label: l, value: v != null ? money(v) : '' });
  addE('基礎給', earnings['基礎給'] ?? earnings['基本給（月給）']);
  addE('就業手当', earnings['就業手当'] ?? earnings['非課税通勤費']);
  
  const standardE = new Set(['基礎給', '基本給（月給）', '就業手当', '非課税通勤費', '欠勤控除', '時間外手当', '残業手当', '所休出手当', '休日出勤手当', '週40超手当', '月60超手当', '法休出手当', '深夜勤手当', '夜間出勤手当']);
  for (const [k, v] of Object.entries(earnings)) {
    if (!standardE.has(k) && Number(v)) addE(k, v);
  }

  const earnSlots = Array(42).fill(null);
  earnSlots[14] = { label: '欠勤控除', value: money(earnings['欠勤控除'] ?? 0) };
  earnSlots[28] = { label: '時間外手当', value: money(earnings['時間外手当'] ?? earnings['残業手当'] ?? 0) };
  earnSlots[29] = { label: '所休出手当', value: money(earnings['所休出手当'] ?? earnings['休日出勤手当'] ?? 0) };
  earnSlots[30] = { label: '週40超手当', value: money(earnings['週40超手当'] ?? 0) };
  earnSlots[31] = { label: '月60超手当', value: money(earnings['月60超手当'] ?? 0) };
  earnSlots[32] = { label: '法休出手当', value: money(earnings['法休出手当'] ?? 0) };
  earnSlots[33] = { label: '深夜勤手当', value: money(earnings['深夜勤手当'] ?? earnings['夜間出勤手当'] ?? 0) };

  let eIdx = 0;
  for (const item of earnItems) {
    while (earnSlots[eIdx] && eIdx < 42) eIdx++;
    if (eIdx < 42) earnSlots[eIdx] = item;
  }

  cy = drawTableGrid(cy, '支給', 6, earnSlots);
  cy += 10;

  const dedSlots = Array(35).fill(null);
  dedSlots[0] = { label: '健康保険', value: money(deductions['健康保険'] ?? deductions['健康保険料'] ?? 0) };
  dedSlots[1] = { label: '介護保険', value: money(deductions['介護保険'] ?? 0) };
  dedSlots[2] = { label: '厚生年金', value: money(deductions['厚生年金'] ?? deductions['厚生年金保険'] ?? 0) };
  dedSlots[3] = { label: '雇用保険', value: money(deductions['雇用保険'] ?? deductions['雇用保険料'] ?? 0) };
  dedSlots[4] = { label: '社会保険計額', value: money(deductions['社会保険計額'] ?? deductions['社保合計額'] ?? 0) };
  dedSlots[5] = { label: '課税対象額', value: money(deductions['課税対象額'] ?? 0) };
  dedSlots[7] = { label: '所得税', value: money(deductions['所得税'] ?? 0) };
  dedSlots[9] = { label: '公替家賃', value: money(deductions['公替家賃'] ?? deductions['立替家賃'] ?? 0) };
  dedSlots[10] = { label: '住民税', value: money(deductions['住民税'] ?? deductions['住民票'] ?? 0) };

  const standardD = new Set(['健康保険', '健康保険料', '介護保険', '厚生年金', '厚生年金保険', '雇用保険', '雇用保険料', '社会保険計額', '社保合計額', '課税対象額', '所得税', '公替家賃', '立替家賃', '住民税', '住民票']);
  let dIdx = 14;
  for (const [k, v] of Object.entries(deductions)) {
    if (!standardD.has(k) && Number(v)) {
      while (dedSlots[dIdx] && dIdx < 35) dIdx++;
      if (dIdx < 35) dedSlots[dIdx] = { label: k, value: money(v) };
    }
  }

  cy = drawTableGrid(cy, '控除', 5, dedSlots);
  cy += 10;

  const totW = 300;
  const totColW = totW / 3;
  const totX = mx + tableW - totW;

  doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').rect(totX, cy, totW, 32).stroke().restore();
  doc.save().fillColor(cyanBg).rect(totX, cy, totW, 16).fill().restore();
  doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(totX, cy + 16).lineTo(totX + totW, cy + 16).stroke().restore();
  doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(totX + totColW, cy).lineTo(totX + totColW, cy + 32).stroke().restore();
  doc.save().lineWidth(LW).strokeColor(black).lineCap('butt').lineJoin('miter').moveTo(totX + totColW * 2, cy).lineTo(totX + totColW * 2, cy + 32).stroke().restore();
  
  const tLabels = ['総支給額', '総控除額', '差引支給額'];
  const tVals = [
    money(totals['総支給額'] ?? totals['支給合計'] ?? 0),
    money(totals['総控除額'] ?? totals['控除合計'] ?? 0),
    money(totals['差引支給額'] ?? totals['差引支給'] ?? 0)
  ];

  for (let i = 0; i < 3; i++) {
    const cx = totX + i * totColW;
    writeText(tLabels[i], cx + 4, cy + 4, { size: 9 });
    writeText(tVals[i], cx + 4, cy + 16 + 2, { size: 9, width: totColW - 10, align: 'right' });
  }

  cy += 40;

  const others = emp['その他'] || {};
  const otherKeys = Object.keys(others).filter(k => Number(others[k]) !== 0);
  const parts = emp?._bankAccountParts && typeof emp._bankAccountParts === 'object' ? emp._bankAccountParts : null;
  const bankName = txt(parts?.bankName || '');
  const branchName = txt(parts?.branchName || '');
  const acct = txt(emp['振込口座'] || emp['振込銀行'] || '');

  const boxW = W - 2 * mx;
  const boxH = 50;
  const midX = mx + Math.round(boxW * 0.62);

  drawRect(mx, cy, boxW, boxH, cyanBg, LW);

  writeText('振込銀行', mx + 6, cy + 6, { size: 9 });
  writeText(bankName || acct, mx + 52, cy + 6, { size: 9, width: midX - (mx + 52) - 6 });
  writeText('支店', midX + 6, cy + 6, { size: 9 });
  writeText(branchName, midX + 36, cy + 6, { size: 9, width: mx + boxW - (midX + 36) - 6 });

  if (otherKeys.length > 0) {
    const otherTexts = otherKeys.map(k => `${k}:${money(others[k])}`);
    writeText(otherTexts.join('   '), mx + 6, cy + 26, { size: 9, width: boxW - 12 });
  }

    doc.end();
  } catch (e) {
    try { doc.end(); } catch {}
    finish(reject)(mapPdfFontSubsetError(e, fontCtx));
  }
  });
}

module.exports = { buildPayslipPdf, yen, hmFromMinutes };
