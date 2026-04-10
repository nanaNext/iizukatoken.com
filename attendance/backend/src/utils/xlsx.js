function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n >>> 0, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function zipStore(files) {
  const entries = [];
  let offset = 0;
  const chunks = [];
  for (const f of files) {
    const nameBuf = Buffer.from(String(f.name), 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data ?? ''), 'utf8');
    const crc = crc32(dataBuf);
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(dataBuf.length),
      u32(dataBuf.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf
    ]);
    chunks.push(localHeader, dataBuf);
    const localOffset = offset;
    offset += localHeader.length + dataBuf.length;
    entries.push({ nameBuf, crc, size: dataBuf.length, offset: localOffset });
  }

  const centralStart = offset;
  const centralChunks = [];
  for (const e of entries) {
    const cdir = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(e.crc),
      u32(e.size),
      u32(e.size),
      u16(e.nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(e.offset),
      e.nameBuf
    ]);
    centralChunks.push(cdir);
    offset += cdir.length;
  }

  const centralSize = offset - centralStart;
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(centralStart),
    u16(0)
  ]);
  return Buffer.concat([...chunks, ...centralChunks, eocd]);
}

function xmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
}

function colName(n) {
  let x = n;
  let s = '';
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function sheetXml({ sheetName, columns, rows, styles, headerStyleKey }) {
  const colsXml = (columns || []).map((c, i) => {
    const w = Number(c?.width || 12);
    const idx = i + 1;
    return `<col min="${idx}" max="${idx}" width="${w}" customWidth="1"/>`;
  }).join('');
  const header = (columns || []).map((c, i) => {
    const r = `${colName(i + 1)}1`;
    const sk = headerStyleKey && Object.prototype.hasOwnProperty.call(styles, headerStyleKey) ? headerStyleKey : 'header';
    return `<c r="${r}" t="inlineStr" s="${styles[sk]}"><is><t>${xmlEscape(c?.header || '')}</t></is></c>`;
  }).join('');
  const bodyRows = (rows || []).map((r, ri) => {
    const rowNum = ri + 2;
    const isOff = !!r?.isOff;
    const style = isOff ? styles.off : (ri % 2 === 1 ? styles.stripe : styles.cell);
    const cells = (r?.cells || []).map((raw, ci) => {
      let v = raw;
      let styleKey = '';
      let isFormula = false;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (Object.prototype.hasOwnProperty.call(raw, 'v') || Object.prototype.hasOwnProperty.call(raw, 'value')) {
          v = Object.prototype.hasOwnProperty.call(raw, 'v') ? raw.v : raw.value;
          styleKey = String(raw.s || raw.style || '');
          isFormula = !!raw.f;
        }
      }
      const addr = `${colName(ci + 1)}${rowNum}`;
      const cellStyle = styleKey && Object.prototype.hasOwnProperty.call(styles, styleKey) ? styles[styleKey] : style;
      if (isFormula) {
        return `<c r="${addr}" s="${cellStyle}"><f>${xmlEscape(v)}</f></c>`;
      }
      return `<c r="${addr}" t="inlineStr" s="${cellStyle}"><is><t>${xmlEscape(v ?? '')}</t></is></c>`;
    }).join('');
    return `<row r="${rowNum}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1">${header}</row>
    ${bodyRows}
  </sheetData>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF000000"/><name val="Meiryo"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Meiryo"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F3553"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <sheets>
    <sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function workbookXmlMulti(sheets) {
  const list = (sheets || []).map((s, i) => {
    const id = i + 1;
    return `<sheet name="${xmlEscape(s.name)}" sheetId="${id}" r:id="rId${id}"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <sheets>
    ${list}
  </sheets>
</workbook>`;
}

function workbookRelsXmlMulti(sheetCount) {
  const n = Math.max(1, Number(sheetCount || 1));
  const rels = [];
  for (let i = 1; i <= n; i++) {
    rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);
  }
  rels.push(`<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join('\n  ')}
</Relationships>`;
}

function contentTypesXmlMulti(sheetCount) {
  const n = Math.max(1, Number(sheetCount || 1));
  const overrides = [];
  overrides.push(`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`);
  for (let i = 1; i <= n; i++) {
    overrides.push(`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  }
  overrides.push(`<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides.join('\n  ')}
</Types>`;
}

function safeSheetName(s, fallback = 'Sheet') {
  const name = String(s || '').replace(/[\[\]\*\/\\\:\?]/g, '').trim();
  return (name || fallback).slice(0, 31);
}

function buildXlsxBook({ sheets }) {
  const styles = { cell: 0, header: 1, off: 2, stripe: 3, checkOn: 4, headerGrey: 5 };
  const rawSheets = Array.isArray(sheets) ? sheets : [];
  const s2 = rawSheets.length ? rawSheets.map((s, i) => ({
    name: safeSheetName(s?.name, `Sheet${i + 1}`),
    columns: Array.isArray(s?.columns) ? s.columns : [],
    rows: Array.isArray(s?.rows) ? s.rows : [],
    headerStyleKey: String(s?.headerStyleKey || '').trim()
  })) : [{ name: 'Sheet1', columns: [], rows: [] }];

  const files = [
    { name: '[Content_Types].xml', data: contentTypesXmlMulti(s2.length) },
    { name: '_rels/.rels', data: rootRelsXml() },
    { name: 'xl/workbook.xml', data: workbookXmlMulti(s2) },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXmlMulti(s2.length) },
    { name: 'xl/styles.xml', data: stylesXml() }
  ];
  for (let i = 0; i < s2.length; i++) {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: sheetXml({ sheetName: s2[i].name, columns: s2[i].columns, rows: s2[i].rows, styles, headerStyleKey: s2[i].headerStyleKey || '' })
    });
  }
  return zipStore(files);
}

function buildXlsx({ sheetName, columns, rows }) {
  return buildXlsxBook({ sheets: [{ name: sheetName, columns, rows }] });
}

module.exports = { buildXlsx, buildXlsxBook };
