const db = require('../../core/database/mysql');
const jpEnMap = {
  '元日': "New Year's Day",
  '建国記念の日': 'National Foundation Day',
  '天皇誕生日': "Emperor's Birthday",
  '昭和の日': 'Showa Day',
  '憲法記念日': 'Constitution Memorial Day',
  'みどりの日': 'Greenery Day',
  'こどもの日': "Children's Day",
  '山の日': 'Mountain Day',
  '文化の日': 'Culture Day',
  '勤労感謝の日': 'Labor Thanksgiving Day',
  '春分の日': 'Vernal Equinox Day',
  '秋分の日': 'Autumnal Equinox Day',
  '成人の日': 'Coming of Age Day',
  '海の日': 'Marine Day',
  '敬老の日': 'Respect for the Aged Day',
  'スポーツの日': 'Sports Day',
  '振替休日': 'Substitute Holiday',
  '国民の休日': "Citizen's Holiday"
};
function nameJa(s) {
  const t = String(s || '');
  return t.includes('/') ? t.split('/')[0].trim() : t.trim();
}
function nameEnFromJa(ja) {
  const base = nameJa(ja);
  return jpEnMap[base] || null;
}
function nameEnFromStored(s) {
  const t = String(s || '');
  if (t.includes('/')) return t.split('/').slice(-1)[0].trim();
  return nameEnFromJa(t);
}
function normalizeJaName(s) {
  const t = String(s || '').trim();
  return t.includes('/') ? t.split('/')[0].trim() : t;
}
function ymd(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const mm = m < 10 ? '0' + m : '' + m;
  const dd = day < 10 ? '0' + day : '' + day;
  return `${y}-${mm}-${dd}`;
}
function nthMonday(year, month0, nth) {
  const d = new Date(Date.UTC(year, month0, 1, 0, 0, 0));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + (nth - 1) * 7);
  return ymd(d);
}
function vernalEquinox(year) {
  const day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const dd = String(day).padStart(2, '0');
  return `${year}-03-${dd}`;
}
function autumnEquinox(year) {
  const day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  const dd = String(day).padStart(2, '0');
  return `${year}-09-${dd}`;
}
function addDaysUTC(dateStr, n) {
  const y = parseInt(String(dateStr).slice(0, 4), 10);
  const m = parseInt(String(dateStr).slice(5, 7), 10) - 1;
  const d = parseInt(String(dateStr).slice(8, 10), 10);
  const dt = new Date(Date.UTC(y, m, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + n);
  return ymd(dt);
}
function dow(dateStr) {
  const y = parseInt(String(dateStr).slice(0, 4), 10);
  const m = parseInt(String(dateStr).slice(5, 7), 10) - 1;
  const d = parseInt(String(dateStr).slice(8, 10), 10);
  const dt = new Date(Date.UTC(y, m, d, 0, 0, 0));
  return dt.getUTCDay();
}
module.exports = {
  async ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS company_holidays (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        name VARCHAR(128) NULL,
        type VARCHAR(32) NOT NULL DEFAULT 'fixed',
        is_off TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      const [idx] = await db.query(`
        SELECT index_name 
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'company_holidays'
      `);
      const set = new Set((idx || []).map(i => String(i.index_name)));
      if (!set.has('idx_date')) {
        try { await db.query(`ALTER TABLE company_holidays ADD INDEX idx_date (date)`); } catch {}
      }
    } catch {}
  },
  async listFixed(year) {
    await this.ensureTable();
    const [rows] = await db.query(`SELECT date, name, type, is_off FROM company_holidays WHERE YEAR(date) = ? AND type = 'fixed' ORDER BY date ASC`, [year]);
    return rows;
  },
  async listByTypes(year, types) {
    await this.ensureTable();
    const placeholders = (types || []).map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT date, name, type, is_off FROM company_holidays WHERE YEAR(date) = ? AND type IN (${placeholders}) ORDER BY date ASC`,
      [year, ...types]
    );
    return rows;
  },
  async listAllByYear(year) {
    await this.ensureTable();
    const [rows] = await db.query(
      `SELECT date, name, type, is_off FROM company_holidays WHERE YEAR(date) = ? ORDER BY date ASC`,
      [year]
    );
    return rows;
  },
  async listOverrides(year) {
    await this.ensureTable();
    const [rows] = await db.query(
      `SELECT date, name, type, is_off FROM company_holidays WHERE YEAR(date) = ? AND type = 'jp_override' ORDER BY date ASC`,
      [year]
    );
    return rows;
  },
  applyOverrides(baseList, overrides) {
    const byName = new Map();
    for (const r of overrides || []) {
      const key = normalizeJaName(r.name);
      byName.set(key, { date: String(r.date), is_off: r.is_off ? 1 : 0, name: key, name_en: nameEnFromJa(key) });
    }
    const out = baseList.map(x => {
      const k = normalizeJaName(x.name);
      if (byName.has(k)) {
        const o = byName.get(k);
        return { ...x, date: o.date, is_off: o.is_off, name: o.name, name_en: o.name_en || x.name_en || null };
      }
      return x;
    });
    for (const [k, o] of byName.entries()) {
      if (!out.some(x => normalizeJaName(x.name) === k)) {
        out.push({ date: o.date, name: o.name, name_en: o.name_en || null, type: 'jp_auto', is_off: o.is_off });
      }
    }
    return out;
  },
  async computeJapanHolidays(year) {
    const list = [];
    list.push({ date: `${year}-01-01`, name: '元日', name_en: nameEnFromJa('元日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-02-11`, name: '建国記念の日', name_en: nameEnFromJa('建国記念の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-02-23`, name: '天皇誕生日', name_en: nameEnFromJa('天皇誕生日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-04-29`, name: '昭和の日', name_en: nameEnFromJa('昭和の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-05-03`, name: '憲法記念日', name_en: nameEnFromJa('憲法記念日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-05-04`, name: 'みどりの日', name_en: nameEnFromJa('みどりの日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-05-05`, name: 'こどもの日', name_en: nameEnFromJa('こどもの日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-08-11`, name: '山の日', name_en: nameEnFromJa('山の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-11-03`, name: '文化の日', name_en: nameEnFromJa('文化の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: `${year}-11-23`, name: '勤労感謝の日', name_en: nameEnFromJa('勤労感謝の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: vernalEquinox(year), name: '春分の日', name_en: nameEnFromJa('春分の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: autumnEquinox(year), name: '秋分の日', name_en: nameEnFromJa('秋分の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: nthMonday(year, 0, 2), name: '成人の日', name_en: nameEnFromJa('成人の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: nthMonday(year, 6, 3), name: '海の日', name_en: nameEnFromJa('海の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: nthMonday(year, 8, 3), name: '敬老の日', name_en: nameEnFromJa('敬老の日'), type: 'jp_auto', is_off: 1 });
    list.push({ date: nthMonday(year, 9, 2), name: 'スポーツの日', name_en: nameEnFromJa('スポーツの日'), type: 'jp_auto', is_off: 1 });
    const overrides = await this.listOverrides(year);
    return this.applyOverrides(list, overrides);
  },
  async upsertFixed(dates) {
    await this.ensureTable();
    for (const it of dates || []) {
      const date = String(it.date || it).slice(0, 10);
      const name = it.name || null;
      const type = it.type || 'fixed';
      const isOff = typeof it.is_off === 'number' ? it.is_off : (it.is_off === false ? 0 : 1);
      await db.query(`
        INSERT INTO company_holidays (date, name, type, is_off)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), is_off = VALUES(is_off)
      `, [date, name, type, isOff]);
    }
    return { ok: true };
  },
  async materializeJapanYear(year) {
    await this.ensureTable();
    const fixed = await this.listFixed(year);
    const fixedSet = new Set(fixed.filter(f => f.is_off).map(f => String(f.date)));
    const sundays = [];
    const lastSaturdays = [];
    const all = new Set();
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 0, 0, 0));
    let d = new Date(start);
    while (d.getTime() <= end.getTime()) {
      const ds = ymd(d);
      const w = d.getUTCDay();
      if (w === 0) {
        sundays.push(ds);
        all.add(ds);
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    for (let m = 0; m < 12; m++) {
      const last = new Date(Date.UTC(year, m + 1, 0, 0, 0, 0));
      const tmp = new Date(last);
      while (tmp.getUTCDay() !== 6) {
        tmp.setUTCDate(tmp.getUTCDate() - 1);
      }
      const ds = ymd(tmp);
      lastSaturdays.push(ds);
      all.add(ds);
    }
    for (const f of fixed) {
      if (f.is_off) {
        all.add(String(f.date));
      }
    }
    const jp = await this.computeJapanHolidays(year);
    for (const f of jp) {
      if (f.is_off) {
        all.add(String(f.date));
      }
    }
    const jpSubstitute = [];
    for (const f of jp) {
      const ds = String(f.date);
      if (dow(ds) === 0) {
        let cand = addDaysUTC(ds, 1);
        while (dow(cand) === 0 || all.has(cand)) {
          cand = addDaysUTC(cand, 1);
        }
        jpSubstitute.push({ date: cand, name: '振替休日', name_en: nameEnFromJa('振替休日'), type: 'jp_substitute', is_off: 1 });
        all.add(cand);
      }
    }
    const jpBridge = [];
    {
      let cur = new Date(start);
      while (cur.getTime() <= end.getTime()) {
        const ds = ymd(cur);
        if (!all.has(ds)) {
          const prev = addDaysUTC(ds, -1);
          const next = addDaysUTC(ds, 1);
          if (all.has(prev) && all.has(next)) {
            jpBridge.push({ date: ds, name: '国民の休日', name_en: nameEnFromJa('国民の休日'), type: 'jp_bridge', is_off: 1 });
            all.add(ds);
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    const payload = [
      ...jp.map(x => ({ ...x, name: `${x.name} / ${x.name_en || nameEnFromJa(x.name)}` })),
      ...jpSubstitute.map(x => ({ ...x, name: `${x.name} / ${x.name_en || nameEnFromJa(x.name)}` })),
      ...jpBridge.map(x => ({ ...x, name: `${x.name} / ${x.name_en || nameEnFromJa(x.name)}` }))
    ];
    await this.upsertFixed(payload);
    return { year, counts: { jp_auto: jp.length, jp_substitute: jpSubstitute.length, jp_bridge: jpBridge.length } };
  },
  async ensureMaterializedJapan(year) {
    await this.ensureTable();
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM company_holidays WHERE YEAR(date) = ? AND type IN ('jp_auto','jp_substitute','jp_bridge')`,
      [year]
    );
    const c = (rows && rows[0] && rows[0].c) ? parseInt(rows[0].c, 10) : 0;
    if (c < 10) {
      await this.materializeJapanYear(year);
    }
  },
  async explainDate(dateStr) {
    await this.ensureTable();
    const y = parseInt(String(dateStr).slice(0, 4), 10);
    const r = await this.computeYear(y);
    const list = Array.isArray(r.detail) ? r.detail : [];
    const matched = list.filter(it => String(it.date) === String(dateStr));
    const reasons = matched.map(it => ({ type: it.type, name: it.name, is_off: it.is_off }));
    const offDays = Array.isArray(r.off_days) ? r.off_days.map(d => String(d)) : [];
    const isOff = offDays.includes(String(dateStr)) || reasons.some(x => x.is_off);
    return { date: dateStr, is_off: isOff ? 1 : 0, reasons };
  },
  async computeYear(year) {
    await this.ensureTable();
    await this.ensureMaterializedJapan(year);
    const fixed = await this.listFixed(year);
    const jpAll = await this.listByTypes(year, ['jp_auto','jp_substitute','jp_bridge']);
    const enrich = (r) => ({ ...r, name_ja: nameJa(r.name), name_en: nameEnFromStored(r.name) });
    const jp = jpAll.filter(r => r.type === 'jp_auto').map(enrich);
    const jpSubstitute = jpAll.filter(r => r.type === 'jp_substitute').map(enrich);
    const jpBridge = jpAll.filter(r => r.type === 'jp_bridge').map(enrich);
    const fixedSet = new Set(fixed.filter(f => f.is_off).map(f => String(f.date)));
    const sundays = [];
    const lastSaturdays = [];
    const all = new Set();
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 0, 0, 0));
    let d = new Date(start);
    while (d.getTime() <= end.getTime()) {
      const ds = ymd(d);
      const dow = d.getUTCDay();
      if (dow === 0) {
        sundays.push(ds);
        all.add(ds);
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    for (let m = 0; m < 12; m++) {
      const last = new Date(Date.UTC(year, m + 1, 0, 0, 0, 0));
      const tmp = new Date(last);
      while (tmp.getUTCDay() !== 6) {
        tmp.setUTCDate(tmp.getUTCDate() - 1);
      }
      const ds = ymd(tmp);
      lastSaturdays.push(ds);
      all.add(ds);
    }
    for (const f of fixed) {
      if (f.is_off) {
        all.add(String(f.date));
      }
    }
    for (const f of jp) { if (f.is_off) all.add(String(f.date)); }
    for (const f of jpSubstitute) { if (f.is_off) all.add(String(f.date)); }
    for (const f of jpBridge) { if (f.is_off) all.add(String(f.date)); }
    const detail = [];
    const seen = new Set();
    const push = (obj) => {
      const k = `${obj.date}|${obj.type}`;
      if (!seen.has(k)) {
        seen.add(k);
        detail.push(obj);
      }
    };
    for (const f of fixed) push({ date: String(f.date), name: f.name || null, type: 'fixed', is_off: f.is_off ? 1 : 0 });
    for (const f of jp) push({ date: String(f.date), name: f.name_ja || f.name, name_en: f.name_en || null, type: 'jp_auto', is_off: 1 });
    for (const f of jpSubstitute) push({ date: String(f.date), name: f.name_ja || f.name, name_en: f.name_en || null, type: 'jp_substitute', is_off: f.is_off ? 1 : 0 });
    for (const f of jpBridge) push({ date: String(f.date), name: f.name_ja || f.name, name_en: f.name_en || null, type: 'jp_bridge', is_off: f.is_off ? 1 : 0 });
    for (const ds of sundays) push({ date: ds, name: 'Sunday', type: 'sunday', is_off: 1 });
    for (const ds of lastSaturdays) push({ date: ds, name: 'Saturday(last)', type: 'saturday_last', is_off: 1 });
    detail.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return {
      year,
      fixed,
      jp_auto: jp,
      jp_substitute: jpSubstitute,
      jp_bridge: jpBridge,
      sundays,
      saturday_last: lastSaturdays,
      off_days: Array.from(all).sort(),
      detail
    };
  },
  async isOff(dateStr) {
    const y = parseInt(String(dateStr).slice(0, 4), 10);
    const cal = await this.computeYear(y);
    return cal.off_days.includes(String(dateStr).slice(0, 10));
  }
};
