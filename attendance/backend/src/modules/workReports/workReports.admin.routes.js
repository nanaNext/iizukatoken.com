const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const repo = require('./workReports.repository');
const attendanceRepo = require('../attendance/attendance.repository');
const calendarRepo = require('../calendar/calendar.repository');
const db = require('../../core/database/mysql');
const { classifyMonthlyDay } = require('../attendance/attendance.classifier');

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const monthJST = () => todayJST().slice(0, 7);
const weekdayJa = (dateStr) => {
  const s = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
  const labels = ['日', '月', '火', '水', '木', '金', '土'];
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return labels[idx] || '';
};
const monthRange = (month) => {
  const [y, m] = String(month).split('-').map(n => parseInt(n, 10));
  const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
};

router.use(authenticate);

router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const date = isISODate(req.query?.date) ? String(req.query.date) : todayJST();
    const isOff = await calendarRepo.isOff(date).catch(() => false);
    const [rows] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.departmentId AS departmentId,
        d.name AS departmentName,
        a.id AS attendanceId,
        a.checkIn AS checkIn,
        a.checkOut AS checkOut,
        COALESCE(wr.work_type, a.work_type) AS work_type,
        ad.kubun AS daily_kubun,
        COALESCE(NULLIF(wr.site, ''), NULLIF(ad.location, '')) AS site,
        COALESCE(NULLIF(wr.work, ''), NULLIF(ad.memo, '')) AS work,
        wr.updated_at AS updated_at
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.departmentId
      LEFT JOIN leave_requests lr
        ON lr.userId = u.id
       AND lr.status = 'approved'
       AND ? BETWEEN lr.startDate AND lr.endDate
      LEFT JOIN attendance_daily ad
        ON ad.userId = u.id
       AND ad.date = ?
      LEFT JOIN (
        SELECT t1.*
        FROM attendance t1
        INNER JOIN (
          SELECT userId, MAX(checkIn) AS maxCheckIn
          FROM attendance
          WHERE DATE(checkIn) = ?
          GROUP BY userId
        ) t2
          ON t2.userId = t1.userId AND t2.maxCheckIn = t1.checkIn
      ) a
        ON a.userId = u.id
      LEFT JOIN work_reports wr
        ON wr.userId = u.id AND wr.date = ?
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
        AND lr.id IS NULL
      ORDER BY
        CASE WHEN a.checkIn IS NULL THEN 1 ELSE 0 END ASC,
        COALESCE(u.employee_code, '') ASC,
        u.id ASC
    `, [date, date, date, date]);

    const items = (rows || []).map(r => {
      const hasIn = !!r.checkIn;
      const hasOut = !!r.checkOut;
      const kubun = String(r.daily_kubun || '').trim();
      const offKubun = new Set(['休日', '代替休日']);
      const leaveKubun = new Set(['有給休暇', '無給休暇', '欠勤']);
      const workKubun = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      const dayIsOff = offKubun.has(kubun) || (!workKubun.has(kubun) && isOff);
      const forceLeave = leaveKubun.has(kubun);
      const status = forceLeave
        ? 'leave'
        : (hasIn
            ? (hasOut ? (dayIsOff ? 'holiday_work' : 'checked_out') : (dayIsOff ? 'holiday_working' : 'working'))
            : (dayIsOff ? 'leave' : 'not_checked_in'));
      // Normalize display kubun for off-days even when daily record is empty.
      const effectiveKubun = kubun || (dayIsOff ? '休日' : '');
      const hasReport = !!(r.site || r.work);
      const wt = r.work_type || null;
      return {
        userId: r.userId,
        employeeCode: r.employeeCode || null,
        username: r.username || null,
        departmentId: r.departmentId || null,
        departmentName: r.departmentName || null,
        attendance: {
          id: r.attendanceId || null,
          checkIn: r.checkIn || null,
          checkOut: r.checkOut || null
        },
        status,
        dailyKubun: effectiveKubun || null,
        workType: wt,
        report: hasReport ? {
          workType: wt,
          site: r.site,
          work: r.work,
          updatedAt: r.updated_at || null
        } : null
      };
    });

    const submitted = items.filter(i => !!i.report).length;
    const required = items.filter(i => i.status === 'checked_out').length;
    const missing = items.filter(i => i.status === 'checked_out' && !i.report).length;
    res.status(200).json({ date, summary: { submitted, required, missing }, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/backfill-worktype',
  rateLimitNamed('workreports_backfill_worktype', { windowMs: 60_000, max: 10 }),
  authorize('admin', 'manager'),
  async (req, res) => {
  try {
    const date = isISODate(req.body?.date) ? String(req.body.date) : todayJST();
    const wtRaw = String(req.body?.workType || req.body?.work_type || 'onsite').trim();
    const workType = wtRaw === 'onsite' || wtRaw === 'remote' || wtRaw === 'satellite' ? wtRaw : 'onsite';
    const [r] = await db.query(
      `UPDATE attendance
       SET work_type = ?
       WHERE DATE(checkIn) = ?
         AND checkIn IS NOT NULL
         AND (work_type IS NULL OR work_type = '')`,
      [workType, date]
    );
    res.status(200).json({ date, workType, updated: Number(r?.affectedRows || 0) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/export.xlsx',
  rateLimitNamed('workreports_export_xlsx', { windowMs: 60_000, max: 10 }),
  authorize('admin', 'manager'),
  async (req, res) => {
  try {
    const period = String(req.query?.period || 'day').toLowerCase();
    const qDate = String(req.query?.date || todayJST()).slice(0, 10);
    const qMonth = String(req.query?.month || qDate.slice(0, 7)).slice(0, 7);
    const qYear = parseInt(String(req.query?.year || qDate.slice(0, 4)), 10);

    const addDays = (dateStr, delta) => {
      const dt = new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z');
      dt.setUTCDate(dt.getUTCDate() + delta);
      return dt.toISOString().slice(0, 10);
    };
    const lastDayOfMonth = (ym) => {
      const [y, m] = String(ym).split('-').map(n => parseInt(n, 10));
      return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    };
    const weekRange = (dateStr) => {
      const dt = new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z');
      const dow = dt.getUTCDay();
      const diffToMon = (dow + 6) % 7;
      const start = addDays(dateStr, -diffToMon);
      const end = addDays(start, 6);
      return { start, end };
    };

    let start = qDate;
    let end = qDate;
    if (period === 'week') {
      const r = weekRange(qDate);
      start = r.start;
      end = r.end;
    } else if (period === 'month') {
      start = `${qMonth}-01`;
      end = lastDayOfMonth(qMonth);
    } else if (period === 'year') {
      const y = qYear || parseInt(qDate.slice(0, 4), 10);
      start = `${String(y).padStart(4, '0')}-01-01`;
      end = `${String(y).padStart(4, '0')}-12-31`;
    }

    const dates = (() => {
      const out = [];
      const d0 = new Date(start + 'T00:00:00Z');
      const d1 = new Date(end + 'T00:00:00Z');
      for (let t = d0.getTime(); t <= d1.getTime(); t += 24 * 60 * 60 * 1000) {
        out.push(new Date(t).toISOString().slice(0, 10));
      }
      return out;
    })();
    const yearsInRange = Array.from(new Set(dates.map(d => parseInt(String(d).slice(0, 4), 10)).filter(Boolean)));
    const offByYear = new Map();
    for (const y of yearsInRange) {
      const cal = await calendarRepo.computeYear(y).catch(() => null);
      const off = new Set((cal?.off_days || []).map(ds => String(ds).slice(0, 10)));
      offByYear.set(y, off);
    }
    const isOffDate = (dateStr) => {
      const y = parseInt(String(dateStr).slice(0, 4), 10);
      const set = offByYear.get(y);
      if (!set) return false;
      return set.has(String(dateStr).slice(0, 10));
    };

    const [users] = await db.query(`
      SELECT u.id AS userId, u.employee_code AS employeeCode, u.username AS username,
             d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC
    `);

    const [attRows] = await db.query(`
      SELECT a.userId, DATE(a.checkIn) AS date, a.checkIn, a.checkOut, a.work_type AS work_type
      FROM attendance a
      INNER JOIN (
        SELECT userId, DATE(checkIn) AS date, MAX(checkIn) AS maxCheckIn
        FROM attendance
        WHERE DATE(checkIn) >= ? AND DATE(checkIn) <= ?
        GROUP BY userId, DATE(checkIn)
      ) t
        ON t.userId = a.userId AND t.maxCheckIn = a.checkIn
    `, [start, end]);

    const [repRows] = await db.query(`
      SELECT userId, date, site, work, work_type
      FROM work_reports
      WHERE date >= ? AND date <= ?
    `, [start, end]);

    const [leaveRows] = await db.query(`
      SELECT userId, startDate, endDate, type
      FROM leave_requests
      WHERE status = 'approved'
        AND endDate >= ? AND startDate <= ?
    `, [start, end]);

    const attMap = new Map();
    for (const a of (attRows || [])) {
      const d = String(a.date || a.checkIn || '').slice(0, 10);
      attMap.set(`${a.userId}|${d}`, a);
    }
    const repMap = new Map();
    for (const r of (repRows || [])) {
      repMap.set(`${r.userId}|${String(r.date).slice(0, 10)}`, r);
    }
    const leaveByUser = new Map();
    for (const lr of (leaveRows || [])) {
      const uid = Number(lr.userId);
      if (!leaveByUser.has(uid)) leaveByUser.set(uid, []);
      leaveByUser.get(uid).push({ start: String(lr.startDate).slice(0, 10), end: String(lr.endDate).slice(0, 10), type: String(lr.type || '') });
    }
    const isOnLeave = (uid, dateStr) => {
      const arr = leaveByUser.get(Number(uid));
      if (!arr || !arr.length) return null;
      for (const it of arr) {
        if (dateStr >= it.start && dateStr <= it.end) return it;
      }
      return null;
    };

    const fmtHm = (dt) => {
      if (!dt) return '';
      const s = String(dt);
      return s.length >= 16 ? s.slice(11, 16) : s;
    };
    const dowJa = (dateStr) => {
      try {
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
      } catch {
        return '';
      }
    };
    const wtLabel = (wt) => wt === 'onsite' ? '出社' : wt === 'remote' ? '在宅' : wt === 'satellite' ? '現場/出張' : '';
    const leaveLabel = (t) => {
      const s = String(t || '').toLowerCase();
      if (s === 'paid') return '有給';
      if (s === 'sick') return '病欠';
      if (s === 'overtime') return '残業';
      return '休暇';
    };

    const buildRow = (u, d) => {
      const uid = Number(u.userId);
      const code = u.employeeCode || `EMP${String(uid).padStart(3, '0')}`;
      const name = u.username || '';
      const dept = u.departmentName || '';
      const leave = isOnLeave(uid, d);
      const att = attMap.get(`${uid}|${d}`) || null;
      const rep = repMap.get(`${uid}|${d}`) || null;
      const wt = String(rep?.work_type || att?.work_type || '').trim();
      let status = '未出勤';
      let cin = '';
      let cout = '';
      if (isOffDate(d) && !att?.checkIn) {
        status = '休日';
      } else if (leave) {
        status = leaveLabel(leave.type);
      } else if (att?.checkIn) {
        status = att?.checkOut ? (isOffDate(d) ? '休日出勤' : '退勤済') : (isOffDate(d) ? '休日出勤' : '出勤中');
        cin = fmtHm(att.checkIn);
        cout = fmtHm(att.checkOut);
      }
      return {
        uid,
        code,
        name,
        dept,
        wt,
        wtText: wtLabel(wt),
        status,
        cin,
        cout,
        site: isOffDate(d) && !att?.checkIn ? '' : String(rep?.site || ''),
        work: isOffDate(d) && !att?.checkIn ? '' : String(rep?.work || ''),
        isOff: isOffDate(d)
      };
    };

    const safeFile = (s) => String(s || '').replace(/[\\\/:*?"<>|]/g, '_');
    const fileName = safeFile(`attendance_${period}_${start}_${end}.xlsx`);

    const { buildXlsx, buildXlsxBook } = require('../../utils/xlsx');

    if (period === 'week') {
      const mmdd = (d) => String(d).slice(5, 10).replace('-', '/');
      const weekCol = (d) => `${dowJa(d)}(${mmdd(d)})`;
      const summaryColumns = [
        { header: '社員番号', width: 12 },
        { header: '氏名', width: 14 },
        { header: '部署', width: 22 },
        ...dates.map(d => ({ header: weekCol(d), width: 22 }))
      ];
      const summaryRows = (users || []).map(u => {
        const uid = Number(u.userId);
        const code = u.employeeCode || `EMP${String(uid).padStart(3, '0')}`;
        const name = u.username || '';
        const dept = u.departmentName || '';
        const dayCells = dates.map(d => {
          const r = buildRow(u, d);
          if (r.status === '休日') return '休日';
          const t1 = r.status ? r.status : '';
          const t2 = r.wtText ? r.wtText : '';
          const t3 = r.cin || r.cout ? `${r.cin || ''}${r.cout ? '-' + r.cout : ''}` : '';
          const t4 = r.site ? r.site : '';
          return [t2, t1, t3, t4].filter(Boolean).join('\n');
        });
        return { isOff: false, cells: [code, name, dept, ...dayCells] };
      });

      const dayColumns = [
        { header: '社員番号', width: 12 },
        { header: '氏名', width: 14 },
        { header: '部署', width: 22 },
        { header: '勤務区分', width: 12 },
        { header: '状態', width: 10 },
        { header: '出勤', width: 8 },
        { header: '退勤', width: 8 },
        { header: '現場', width: 18 },
        { header: '作業内容', width: 52 }
      ];
      const sheets = [
        { name: `週次サマリー ${start}`, columns: summaryColumns, rows: summaryRows }
      ];
      for (const d of dates) {
        const dayRows = (users || []).map(u => {
          const r = buildRow(u, d);
          return {
            isOff: r.isOff,
            cells: [
              r.code,
              r.name,
              r.dept,
              r.wtText || '',
              r.status || '',
              r.cin || '',
              r.cout || '',
              r.site || '',
              r.work || ''
            ]
          };
        });
        sheets.push({ name: `${mmdd(d)} ${dowJa(d)}`, columns: dayColumns, rows: dayRows });
      }

      const buf = buildXlsxBook({ sheets });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(buf);
      return;
    }

    const rows = [];
    for (const d of dates) {
      for (const u of (users || [])) {
        const r = buildRow(u, d);
        rows.push({
          isOff: r.isOff,
          cells: [
            d,
            dowJa(d),
            r.code,
            r.name,
            r.dept,
            r.wtText,
            r.status,
            r.cin,
            r.cout,
            r.site,
            r.work
          ]
        });
      }
    }

    const columns = [
      { header: '日付', width: 12 },
      { header: '曜日', width: 6 },
      { header: '社員番号', width: 12 },
      { header: '氏名', width: 14 },
      { header: '部署', width: 22 },
      { header: '勤務区分', width: 12 },
      { header: '状態', width: 10 },
      { header: '出勤', width: 8 },
      { header: '退勤', width: 8 },
      { header: '現場', width: 18 },
      { header: '作業内容', width: 52 }
    ];

    const baseName = period === 'month' ? `月次_${qMonth}` : period === 'year' ? `年次_${qYear}` : `日次_${start}`;
    const buf = buildXlsx({ sheetName: baseName, columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/month', authorize('admin', 'manager'), async (req, res) => {
  try {
    const month = isYM(req.query?.month) ? String(req.query.month) : monthJST();
    const { start, end } = monthRange(month);
    const closed = await repo.isMonthClosed(month).catch(() => false);
    const wantDebug = String(req.query?.debug || '') === '1';

    // カレンダーの休日（祝日/土日）を取得して判定に利用
    let isOffDate = (ds) => false;
    try {
      const y = parseInt(String(month).slice(0, 4), 10);
      const cal = await calendarRepo.computeYear(y).catch(() => null);
      const off = new Set((cal?.off_days || []).map((d) => String(d).slice(0, 10)));
      isOffDate = (ds) => off.has(String(ds).slice(0, 10));
    } catch {}

    const [users] = await db.query(`
      SELECT u.id AS userId, u.employee_code AS employeeCode, u.username AS username,
             u.departmentId AS departmentId, d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC
    `);

    // Load shift definitions to compute planned work/off per user per day
    let shiftDefs = [];
    try {
      shiftDefs = await attendanceRepo.listShiftDefinitions();
    } catch { shiftDefs = []; }
    const shiftById = new Map();
    const shiftByName = new Map();
    for (const s of shiftDefs || []) {
      if (s?.id != null) shiftById.set(Number(s.id), s);
      if (s?.name) shiftByName.set(String(s.name), s);
    }
    const parseWorkingDays = (s) => {
      const t = String(s || '').toLowerCase();
      if (!t || t === 'flexible') return new Set([1,2,3,4,5]); // default Mon-Fri
      if (t.includes('mon-fri-sat') || t.includes('mon-sat')) return new Set([1,2,3,4,5,6]);
      if (t.includes('mon-fri')) return new Set([1,2,3,4,5]);
      if (t.includes('mon-sun') || t.includes('7') || t.includes('all')) return new Set([0,1,2,3,4,5,6]);
      const map = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
      const out = new Set();
      for (const part of t.split(/[^a-z]+/g)) {
        if (map.hasOwnProperty(part)) out.add(map[part]);
      }
      if (out.size === 0) return new Set([1,2,3,4,5]);
      return out;
    };
    const ymToDow = (ds) => {
      const y = parseInt(String(ds).slice(0,4), 10);
      const m = parseInt(String(ds).slice(5,7), 10) - 1;
      const d = parseInt(String(ds).slice(8,10), 10);
      return new Date(Date.UTC(y, m, d, 0, 0, 0)).getUTCDay();
    };
    const getPlanFor = (assignList, ds) => {
      if (!Array.isArray(assignList) || !assignList.length) return isOffDate(ds) ? 'off' : 'work';
      // pick latest assignment effective by ds
      const eff = assignList.filter(a => {
        const st = String(a.start_date || a.date || '').slice(0,10);
        const ed = a.end_date ? String(a.end_date).slice(0,10) : null;
        return st && st <= ds && (!ed || ds <= ed);
      }).slice(-1)[0];
      if (!eff) return isOffDate(ds) ? 'off' : 'work';
      let def = null;
      if (eff.shiftId != null) def = shiftById.get(Number(eff.shiftId)) || null;
      if (!def && eff.shift) def = shiftByName.get(String(eff.shift)) || null;
      const set = parseWorkingDays(def?.working_days);
      const dow = ymToDow(ds);
      return set.has(dow) ? 'work' : 'off';
    };

    let latestRows = [];
    try {
      const [x] = await db.query(`
        SELECT a.id, a.userId, a.checkIn, a.checkOut
        FROM attendance a
        WHERE a.checkIn >= ? AND a.checkIn < DATE_ADD(?, INTERVAL 1 DAY)
          AND a.userId IN (
            SELECT id
            FROM users
            WHERE employment_status = 'active'
              AND role IN ('employee','manager')
          )
      `, [start + ' 00:00:00', end + ' 00:00:00']);
      latestRows = x;
    } catch {
      try {
        const [attRows] = await db.query(`
          SELECT id, userId, checkIn, checkOut
          FROM attendance
          WHERE checkIn >= ? AND checkIn < DATE_ADD(?, INTERVAL 1 DAY)
            AND userId IN (
              SELECT id
              FROM users
              WHERE employment_status = 'active'
                AND role IN ('employee','manager')
            )
        `, [start + ' 00:00:00', end + ' 00:00:00']);
        latestRows = attRows;
      } catch {}
    }

    const [leaveRows] = await db.query(`
      SELECT userId, startDate, endDate
      FROM leave_requests
      WHERE status = 'approved'
        AND endDate >= ? AND startDate <= ?
    `, [start, end]);

    const [dailyRows] = await db.query(`
      SELECT userId, date, kubun
      FROM attendance_daily
      WHERE date >= ? AND date <= ?
    `, [start, end]);

    const reports = await repo.listByMonth(month);
    const reportMap = new Map();
    for (const r of (reports || [])) {
      reportMap.set(`${r.userId}|${String(r.date).slice(0, 10)}`, r);
    }

    const leaveByUser = new Map();
    for (const lr of (leaveRows || [])) {
      const uid = Number(lr.userId);
      if (!leaveByUser.has(uid)) leaveByUser.set(uid, []);
      leaveByUser.get(uid).push({ start: String(lr.startDate).slice(0, 10), end: String(lr.endDate).slice(0, 10) });
    }
    const isOnLeave = (uid, date) => {
      const arr = leaveByUser.get(uid);
      if (!arr || !arr.length) return false;
      for (const it of arr) {
        if (date >= it.start && date <= it.end) return true;
      }
      return false;
    };
    const dailyByUserDate = new Map();
    for (const r of (dailyRows || [])) {
      const key = `${r.userId}|${String(r.date).slice(0,10)}`;
      dailyByUserDate.set(key, String(r.kubun || '').trim());
    }

    const attLatest = new Map();
    for (const a of (latestRows || [])) {
      const d = String(a.checkIn).slice(0, 10);
      const key = `${a.userId}|${d}`;
      const prev = attLatest.get(key);
      if (!prev) {
        attLatest.set(key, a);
        continue;
      }
      const prevHasOut = !!prev.checkOut;
      const curHasOut = !!a.checkOut;
      if (!prevHasOut && curHasOut) {
        attLatest.set(key, a);
        continue;
      }
      if (prevHasOut && curHasOut) {
        if (String(a.checkOut) > String(prev.checkOut)) attLatest.set(key, a);
        continue;
      }
      if (!prevHasOut && !curHasOut) {
        if (String(a.checkIn) > String(prev.checkIn)) attLatest.set(key, a);
        continue;
      }
    }

    const daysInMonth = (() => {
      const out = [];
      const d0 = new Date(start + 'T00:00:00Z');
      const d1 = new Date(end + 'T00:00:00Z');
      for (let t = d0.getTime(); t <= d1.getTime(); t += 24 * 60 * 60 * 1000) {
        out.push(new Date(t).toISOString().slice(0, 10));
      }
      return out;
    })();

    let requiredTotal = 0;
    let submittedTotal = 0;
    let missingTotal = 0;

    const items = [];
    for (const u of (users || [])) {
      const uid = Number(u.userId);
      const perDay = {};
      // load assignments for this user once
      let assigns = [];
      try { assigns = await attendanceRepo.listShiftAssignmentsBetween(uid, start, end); } catch { assigns = []; }
      for (const d of daysInMonth) {
        const kubun = dailyByUserDate.get(`${uid}|${d}`) || '';
        const a = attLatest.get(`${uid}|${d}`) || null;
        const plan = getPlanFor(assigns, d);
        const cls = classifyMonthlyDay({
          date: d,
          kubun,
          isOnLeaveApproved: isOnLeave(uid, d),
          isPlannedOff: plan === 'off',
          hasAttendance: !!a,
          hasCheckOut: !!a?.checkOut
        });
        const status = cls.status;
        const rep = reportMap.get(`${uid}|${d}`) || null;
        const report = rep ? { site: rep.site, work: rep.work, updatedAt: rep.updated_at || rep.updatedAt || null } : null;
        const entry = { status, report, kubun: cls.kubun || kubun || null, plan: status === 'planned' ? cls.plan : null };
        if (wantDebug) entry.debug = { date: d, userId: uid, kubun, plan, isOffDate: isOffDate(d), hasAttendance: !!a, hasOut: !!a?.checkOut, status };
        perDay[d] = entry;
        if (status === 'checked_out') {
          requiredTotal++;
          if (report) submittedTotal++;
          else missingTotal++;
        }
      }
      items.push({
        userId: uid,
        employeeCode: u.employeeCode || null,
        username: u.username || null,
        departmentId: u.departmentId || null,
        departmentName: u.departmentName || null,
        days: perDay
      });
    }

    res.status(200).json({
      month,
      closed,
      range: { start, end },
      days: daysInMonth,
      summary: { required: requiredTotal, submitted: submittedTotal, missing: missingTotal },
      items
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/backfill/daily',
  rateLimitNamed('workreports_backfill_daily', { windowMs: 60_000, max: 10 }),
  authorize('admin', 'manager'),
  async (req, res) => {
  try {
    const { userId, fromDate, toDate, month } = req.body || {};
    const parseMonth = (s) => {
      const m = String(s || '');
      if (!/^\d{4}-\d{2}$/.test(m)) return null;
      const y = parseInt(m.slice(0, 4), 10);
      const mm = parseInt(m.slice(5, 7), 10);
      if (!y || !mm || mm < 1 || mm > 12) return null;
      const pad = (n) => String(n).padStart(2, '0');
      const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate();
      return { from: `${y}-${pad(mm)}-01`, to: `${y}-${pad(mm)}-${pad(lastDay)}` };
    };
    const range = month ? parseMonth(month) : null;
    const from = String(range ? range.from : fromDate || '').slice(0, 10);
    const to = String(range ? range.to : toDate || '').slice(0, 10);
    if (!from || !to) return res.status(400).json({ message: 'Missing from/to or month' });
    const uid = userId != null ? parseInt(String(userId), 10) : null;
    const params = [];
    let sql = `
      SELECT wr.userId, wr.date, wr.work_type, wr.site, wr.work
      FROM work_reports wr
      WHERE wr.date >= ? AND wr.date <= ?
    `;
    params.push(from, to);
    if (uid) { sql += ` AND wr.userId = ?`; params.push(uid); }
    sql += ` ORDER BY wr.userId ASC, wr.date ASC`;
    const [rows] = await db.query(sql, params);
    let updated = 0;
    let users = new Set();
    for (const r of (rows || [])) {
      const u = Number(r.userId);
      const d = String(r.date).slice(0, 10);
      if (!u || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      users.add(u);
      const payload = {
        workType: r.work_type || null,
        location: r.site || null,
        memo: r.work || null
      };
      try {
        const res1 = await attendanceRepo.upsertDaily(u, d, payload);
        updated += Number(res1?.affectedRows || 0);
      } catch {}
    }
    res.status(200).json({ ok: true, users: Array.from(users), from, to, updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/month/list', authorize('admin', 'manager'), async (req, res) => {
  try {
    const month = isYM(req.query?.month) ? String(req.query.month) : monthJST();
    const { start, end } = monthRange(month);

    const [users] = await db.query(`
      SELECT u.id AS userId,
             u.employee_code AS employeeCode,
             u.username AS username,
             u.departmentId AS departmentId,
             d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC
    `);
    const userMap = new Map((users || []).map(u => [Number(u.userId), u]));

    const [attRows] = await db.query(`
      SELECT a.userId,
             DATE(a.checkIn) AS date,
             MIN(a.checkIn) AS firstCheckIn,
             MAX(a.checkOut) AS lastCheckOut,
             MAX(CASE WHEN a.work_type IS NOT NULL AND a.work_type <> '' THEN a.work_type ELSE NULL END) AS attendanceWorkType
      FROM attendance a
      WHERE DATE(a.checkIn) >= ? AND DATE(a.checkIn) <= ?
        AND a.userId IN (
          SELECT id
          FROM users
          WHERE employment_status = 'active'
            AND role IN ('employee','manager')
        )
      GROUP BY a.userId, DATE(a.checkIn)
      ORDER BY DATE(a.checkIn) ASC, a.userId ASC
    `, [start, end]);

    const [dailyRows] = await db.query(`
      SELECT userId, date, kubun, work_type, location, memo
      FROM attendance_daily
      WHERE date >= ? AND date <= ?
    `, [start, end]);
    const dailyMap = new Map();
    for (const r of (dailyRows || [])) {
      dailyMap.set(`${r.userId}|${String(r.date).slice(0, 10)}`, {
        kubun: r.kubun || null,
        workType: r.work_type || null,
        location: r.location || null,
        memo: r.memo || null
      });
    }

    const reports = await repo.listByMonth(month);
    const reportMap = new Map();
    for (const r of (reports || [])) {
      reportMap.set(`${r.userId}|${String(r.date).slice(0, 10)}`, r);
    }

    const items = [];
    let submitted = 0;
    let missing = 0;
    const workingUsers = new Set();
    for (const a of (attRows || [])) {
      const userId = Number(a.userId);
      const user = userMap.get(userId);
      if (!user) continue;
      const date = String(a.date || a.firstCheckIn || '').slice(0, 10);
      if (!date) continue;
      const key = `${userId}|${date}`;
      const rep = reportMap.get(key) || null;
      const daily = dailyMap.get(key) || null;
      const site = String(rep?.site || daily?.location || '').trim() || null;
      const work = String(rep?.work || daily?.memo || '').trim() || null;
      const workType = rep?.work_type || daily?.workType || a.attendanceWorkType || null;
      const status = a.lastCheckOut
        ? ((site || work) ? 'submitted' : 'missing')
        : 'working';
      if (status === 'submitted') submitted++;
      else if (status === 'missing') missing++;
      workingUsers.add(userId);
      items.push({
        userId,
        employeeCode: user.employeeCode || null,
        username: user.username || null,
        departmentId: user.departmentId || null,
        departmentName: user.departmentName || null,
        date,
        weekday: weekdayJa(date),
        attendance: {
          checkIn: a.firstCheckIn || null,
          checkOut: a.lastCheckOut || null
        },
        kubun: daily?.kubun || null,
        workType,
        site,
        work,
        status
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ac = String(a.employeeCode || '').toUpperCase();
      const bc = String(b.employeeCode || '').toUpperCase();
      if (ac !== bc) return ac < bc ? -1 : 1;
      return Number(a.userId || 0) - Number(b.userId || 0);
    });

    res.status(200).json({
      month,
      range: { start, end },
      summary: {
        employees: workingUsers.size,
        workedDays: items.length,
        submitted,
        missing
      },
      items
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/month/:userId', authorize('admin', 'manager'), async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Invalid userId' });
    const month = isYM(req.query?.month) ? String(req.query.month) : monthJST();
    const { start, end } = monthRange(month);
    const closed = await repo.isMonthClosed(month).catch(() => false);

    const [[u]] = await db.query(`
      SELECT u.id AS userId, u.employee_code AS employeeCode, u.username AS username,
             u.departmentId AS departmentId, d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.id = ?
      LIMIT 1
    `, [userId]);

    const [attRows] = await db.query(`
      SELECT id, checkIn, checkOut
      FROM attendance
      WHERE userId = ?
        AND checkIn >= ? AND checkIn < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY checkIn ASC
    `, [userId, start + ' 00:00:00', end + ' 00:00:00']);

    const attLatest = new Map();
    for (const a of (attRows || [])) {
      const d = String(a.checkIn).slice(0, 10);
      const prev = attLatest.get(d);
      if (!prev || String(a.checkIn) > String(prev.checkIn)) attLatest.set(d, a);
    }

    const [leaveRows] = await db.query(`
      SELECT startDate, endDate
      FROM leave_requests
      WHERE userId = ?
        AND status = 'approved'
        AND endDate >= ? AND startDate <= ?
    `, [userId, start, end]);
    const leaves = (leaveRows || []).map(r => ({ start: String(r.startDate).slice(0, 10), end: String(r.endDate).slice(0, 10) }));
    const isOnLeave = (d) => leaves.some(it => d >= it.start && d <= it.end);

    const reports = await repo.listByUserMonth(userId, month);
    const reportMap = new Map();
    for (const r of (reports || [])) {
      reportMap.set(String(r.date).slice(0, 10), r);
    }

    const days = (() => {
      const out = [];
      const d0 = new Date(start + 'T00:00:00Z');
      const d1 = new Date(end + 'T00:00:00Z');
      for (let t = d0.getTime(); t <= d1.getTime(); t += 24 * 60 * 60 * 1000) {
        out.push(new Date(t).toISOString().slice(0, 10));
      }
      return out;
    })();

    const items = days.map(d => {
      if (isOnLeave(d)) return { date: d, status: 'leave', report: null };
      const a = attLatest.get(d) || null;
      const status = a ? (a.checkOut ? 'checked_out' : 'working') : 'not_checked_in';
      const rep = reportMap.get(d) || null;
      const report = rep ? { site: rep.site, work: rep.work, updatedAt: rep.updated_at || rep.updatedAt || null } : null;
      return { date: d, status, report };
    });

    res.status(200).json({
      month,
      closed,
      user: u ? { userId: u.userId, employeeCode: u.employeeCode || null, username: u.username || null, departmentName: u.departmentName || null } : { userId },
      items
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/close-month',
  rateLimitNamed('workreports_close_month', { windowMs: 60_000, max: 5 }),
  authorize('admin', 'manager'),
  async (req, res) => {
  try {
    const month = isYM(req.body?.month) ? String(req.body.month) : null;
    if (!month) return res.status(400).json({ message: 'Missing month' });
    const r = await repo.closeMonth(month, req.user?.id || null);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId', authorize('admin', 'manager'), async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Invalid userId' });
    const date = isISODate(req.query?.date) ? String(req.query.date) : todayJST();
    const [[row]] = await db.query(`
      SELECT
        wr.*,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.departmentId AS departmentId,
        d.name AS departmentName
      FROM work_reports wr
      LEFT JOIN users u ON u.id = wr.userId
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE wr.userId = ? AND wr.date = ?
      LIMIT 1
    `, [userId, date]);
    res.status(200).json({ date, report: row || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
