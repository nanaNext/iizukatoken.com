const repo = require('./leave.repository');
const userRepo = require('../users/user.repository');
const auditRepo = require('../audit/audit.repository');
const { resolveEmploymentStartDate } = require('../../utils/employmentDate');
const env = require('../../config/env');

const LEAVE_GRANT_MODES = new Set(['AUTO', 'MANUAL', 'HYBRID']);
function getLeaveGrantMode() {
  const m = String(env.leaveGrantMode || 'HYBRID').toUpperCase();
  return LEAVE_GRANT_MODES.has(m) ? m : 'HYBRID';
}

function addMonths(d, m) {
  const dt = new Date(d);
  const day = dt.getDate();
  dt.setMonth(dt.getMonth() + m);
  if (dt.getDate() < day) dt.setDate(0);
  return dt;
}
function addYears(d, y) { return addMonths(d, y * 12); }
function fmt(d) { return d.toISOString().slice(0,10); }
function daysBetweenInclusive(a, b) {
  const ms = 24*60*60*1000;
  const d1 = new Date(a + 'T00:00:00Z');
  const d2 = new Date(b + 'T00:00:00Z');
  return Math.max(0, Math.ceil((d2 - d1)/ms) + 1);
}
function overlapDays(aStart, aEnd, bStart, bEnd) {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (s > e) return 0;
  return daysBetweenInclusive(s, e);
}
async function tryReconcileAttendance() {
  try {
    await repo.reconcileApprovedPaidWithAttendance();
  } catch {}
}
function scheduleGrants(hireDate, untilDate) {
  const grants = [];
  if (!hireDate) return grants;
  const h = new Date(hireDate + 'T00:00:00Z');
  const now = new Date(untilDate + 'T00:00:00Z');
  const milestones = [
    { offsetMonths: 6, days: 10 },
    { offsetMonths: 18, days: 11 },
    { offsetMonths: 30, days: 12 },
    { offsetMonths: 42, days: 14 },
    { offsetMonths: 54, days: 16 },
    { offsetMonths: 66, days: 18 },
    { offsetMonths: 78, days: 20 }
  ];
  for (const m of milestones) {
    const g = addMonths(h, m.offsetMonths);
    if (g <= now) {
      grants.push({ grantDate: fmt(g), days: m.days });
    }
  }
  // After 6年半: 20 days every year
  const last = addMonths(h, 78);
  let y = new Date(last);
  while (y <= now) {
    if (y >= last) grants.push({ grantDate: fmt(y), days: 20 });
    y = addYears(y, 1);
  }
  return grants;
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt;
}
function isSameDate(a, b) {
  return fmt(new Date(a + 'T00:00:00Z')) === fmt(new Date(b + 'T00:00:00Z'));
}
async function getGrantAttendanceEligibility(userId, hireDate, grantDate) {
  if (!hireDate || !grantDate) return false;
  const firstGrantDate = fmt(addMonths(new Date(hireDate + 'T00:00:00Z'), 6));
  let periodStart;
  let periodEnd;
  if (isSameDate(grantDate, firstGrantDate)) {
    periodStart = hireDate;
    periodEnd = fmt(addDays(new Date(grantDate + 'T00:00:00Z'), -1));
  } else {
    periodStart = fmt(addYears(new Date(grantDate + 'T00:00:00Z'), -1));
    periodEnd = fmt(addDays(new Date(grantDate + 'T00:00:00Z'), -1));
  }
  if (periodStart > periodEnd) return { eligible: false, workDays: 0, presentDays: 0, attendanceRate: 0, periodStart, periodEnd };
  let stats = { workDays: 0, presentDays: 0 };
  try {
    stats = await repo.getAttendanceStats(userId, periodStart, periodEnd);
  } catch {}
  const workDays = Number(stats.workDays || 0);
  const presentDays = Number(stats.presentDays || 0);
  const attendanceRate = workDays > 0 ? (presentDays / workDays) : 0;
  return {
    eligible: workDays > 0 && attendanceRate >= 0.8,
    workDays,
    presentDays,
    attendanceRate,
    periodStart,
    periodEnd
  };
}
async function isGrantEligibleByAttendance(userId, hireDate, grantDate) {
  const r = await getGrantAttendanceEligibility(userId, hireDate, grantDate);
  return !!r?.eligible;
}
async function ensureUserGrants(userId) {
  const mode = getLeaveGrantMode();
  const listGrants = async () => {
    const rows = await repo.listGrants(userId, 'paid');
    return (rows || []).slice().sort((a, b) => String(a?.grantDate || '').localeCompare(String(b?.grantDate || '')));
  };

  if (mode === 'MANUAL' || mode === 'HYBRID') {
    return listGrants();
  }

  const u = await userRepo.getUserById(userId);
  const hire = resolveEmploymentStartDate(u);
  if (!hire) return [];
  const today = new Date(); const todayStr = fmt(today);
  const plan = scheduleGrants(hire, todayStr);
  for (const g of plan) {
    const ok = await isGrantEligibleByAttendance(userId, hire, g.grantDate);
    if (!ok) continue;
    const eTmp = addYears(new Date(g.grantDate + 'T00:00:00Z'), 2);
    eTmp.setUTCDate(eTmp.getUTCDate() - 1);
    const expiry = fmt(eTmp);
    await repo.upsertGrant({ userId, type: 'paid', grantDate: g.grantDate, daysGranted: g.days, expiryDate: expiry });
  }
  return listGrants();
}
exports.ensureUserGrants = ensureUserGrants;
function allocateUsage(grants, requests) {
  const out = grants.map(g => ({ ...g, daysRemaining: g.daysGranted, daysUsedAlloc: 0 }));
  for (const r of requests) {
    let need = daysBetweenInclusive(r.startDate, r.endDate);
    for (const g of out) {
      if (need <= 0) break;
      const overlap = overlapDays(r.startDate, r.endDate, g.grantDate, g.expiryDate);
      if (overlap <= 0) continue;
      const take = Math.min(need, g.daysRemaining);
      if (take > 0) {
        g.daysRemaining -= take;
        g.daysUsedAlloc += take;
        need -= take;
      }
    }
  }
  return out;
}

exports.create = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, type, reason } = req.body || {};
    if (!userId || !startDate || !endDate || !type) {
      return res.status(400).json({ message: 'Missing userId/startDate/endDate/type' });
    }
    const id = await repo.create({ userId, startDate, endDate, type, reason });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.createPaid = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, reason } = req.body || {};
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing userId/startDate/endDate' });
    }
    const existed = await repo.findExactRequest({ userId, startDate, endDate, type: 'paid', statuses: ['pending', 'approved'] });
    if (existed) {
      return res.status(200).json({ id: existed.id, duplicated: true, status: existed.status });
    }
    const id = await repo.create({ userId, startDate, endDate, type: 'paid', reason });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.cancelMyPaid = async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = String(req.body?.date || '').slice(0, 10);
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Missing userId/date' });
    }
    const affected = await repo.cancelOwnPaidByDate(userId, date);
    return res.status(200).json({ ok: true, affected });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.reconcileAttendance = async (req, res) => {
  try {
    const updated = await repo.reconcileApprovedPaidWithAttendance();
    return res.status(200).json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.listMine = async (req, res) => {
  try {
    const userId = req.user?.id;
    const rows = await repo.listMine(userId);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.listUser = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const rows = await repo.listByUser(userId);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.listPending = async (req, res) => {
  try {
    const rows = await repo.listAllPending();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.listAdminRequests = async (req, res) => {
  try {
    // Keep reconciliation best-effort only; never block list endpoint.
    await tryReconcileAttendance();
    const statusRaw = String(req.query?.status || '').trim().toLowerCase();
    const status = ['pending', 'approved', 'rejected'].includes(statusRaw) ? statusRaw : null;
    // Stable path: always use simple query so FE never falls back to legacy pending.
    const rows = await repo.listAllRequestsSimple({ status, limit: 2000 });
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};
    if (!id || !status || !['approved','rejected','pending'].includes(status)) {
      return res.status(400).json({ message: 'Missing id/status' });
    }
    await repo.updateStatus(id, status);
    res.status(200).json({ id, status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
async function computeUserBalance(userId) {
  const grants = await ensureUserGrants(userId);
  if (!grants.length) {
    return { totalAvailable: 0, usedDays: 0, grants: [], upcomingGrantDate: null, obligation: { required: 0, taken: 0, remaining: 0 } };
  }
  const minDate = grants[0].grantDate;
  const maxExpiry = grants[grants.length - 1].expiryDate;
  const reqs = await repo.listApprovedPaidLeaves(userId, minDate, maxExpiry);
  const alloc = allocateUsage(grants, reqs);
  const totalAvailable = alloc.reduce((s, g) => s + Math.max(0, (new Date(g.expiryDate) >= new Date() ? g.daysRemaining : 0)), 0);
  const usedDays = reqs.reduce((s, r) => s + daysBetweenInclusive(r.startDate, r.endDate), 0);
  const today = fmt(new Date());
  const latest = alloc[alloc.length - 1];
  let required = latest.daysGranted >= 10 ? 5 : 0;
  let taken = 0;
  const oneYearEnd = fmt(addYears(new Date(latest.grantDate + 'T00:00:00Z'), 1));
  for (const r of reqs) taken += overlapDays(r.startDate, r.endDate, latest.grantDate, oneYearEnd);
  const upcomingGrantDate = (() => {
    const lastGrant = alloc[alloc.length - 1];
    const next = fmt(addYears(new Date(lastGrant.grantDate + 'T00:00:00Z'), 1));
    if (next > today) return next;
    return null;
  })();
  return {
    totalAvailable,
    usedDays,
    grants: alloc.map(g => ({
      grantDate: g.grantDate,
      expiryDate: g.expiryDate,
      daysGranted: g.daysGranted,
      daysRemaining: g.daysRemaining
    })),
    upcomingGrantDate,
    obligation: { required, taken, remaining: Math.max(0, required - taken) }
  };
}
exports.myBalance = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const data = await computeUserBalance(userId);
    return res.status(200).json({ ...data, grantMode: getLeaveGrantMode() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.userBalance = async (req, res) => {
  try {
    const userId = parseInt(String(req.query.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const data = await computeUserBalance(userId);
    return res.status(200).json({ userId, ...data, grantMode: getLeaveGrantMode() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.grant = async (req, res) => {
  try {
    const { userId, days, grantDate, expiryDate } = req.body || {};
    if (!userId || !days) return res.status(400).json({ message: 'Missing userId/days' });
    const gDate = grantDate || fmt(new Date());
    let eDate = expiryDate;
    if (!eDate) {
      const et = addYears(new Date(gDate + 'T00:00:00Z'), 2);
      et.setUTCDate(et.getUTCDate() - 1);
      eDate = fmt(et);
    }
    await repo.upsertGrant({ userId, type: 'paid', grantDate: gDate, daysGranted: parseInt(days, 10), expiryDate: eDate });
    try {
      await auditRepo.writeLog({
        userId: req.user?.id,
        action: 'leave_grant_manual',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ targetUserId: Number(userId), days: parseInt(days, 10), grantDate: gDate, expiryDate: eDate })
      });
    } catch {}
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.eligibleList = async (req, res) => {
  try {
    const todayStr = fmt(new Date());
    const users = await userRepo.listUsers();
    const out = [];
    for (const u of (users || [])) {
      const role = String(u?.role || '').toLowerCase();
      const empStatus = String(u?.employment_status || u?.employmentStatus || 'active').toLowerCase();
      if (role === 'admin' || role === 'manager') continue;
      if (empStatus === 'inactive' || empStatus === 'retired') continue;
      const hireDate = resolveEmploymentStartDate(u);
      if (!hireDate) continue;
      const existing = await repo.listGrants(u.id, 'paid');
      const existSet = new Set((existing || []).map(g => String(g?.grantDate || '').slice(0, 10)));
      const plan = scheduleGrants(hireDate, todayStr);
      for (const g of plan) {
        const grantDate = String(g.grantDate || '').slice(0, 10);
        if (!grantDate || existSet.has(grantDate)) continue;
        const info = await getGrantAttendanceEligibility(u.id, hireDate, grantDate);
        if (!info?.eligible) continue;
        out.push({
          userId: u.id,
          employeeCode: u.employee_code || u.employeeCode || '',
          username: u.username || u.email || '',
          hireDate,
          grantDate,
          days: Number(g.days || 0),
          attendanceRate: Number((Number(info.attendanceRate || 0) * 100).toFixed(2)),
          periodStart: info.periodStart,
          periodEnd: info.periodEnd
        });
      }
    }
    out.sort((a, b) => String(a.grantDate).localeCompare(String(b.grantDate)) || Number(a.userId) - Number(b.userId));
    res.status(200).json({ mode: getLeaveGrantMode(), count: out.length, rows: out });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.grantEligibleNow = async (req, res) => {
  try {
    const mode = getLeaveGrantMode();
    if (mode === 'MANUAL') {
      return res.status(400).json({ message: 'LEAVE_GRANT_MODE=MANUAL のため一括付与は無効です', mode });
    }
    const listReq = { user: req.user, query: {}, body: {} };
    const fakeRes = { statusCode: 200, _data: null, status(code) { this.statusCode = code; return this; }, json(v) { this._data = v; return this; } };
    await exports.eligibleList(listReq, fakeRes);
    const rows = Array.isArray(fakeRes?._data?.rows) ? fakeRes._data.rows : [];
    let granted = 0;
    for (const r of rows) {
      const gDate = String(r.grantDate || '').slice(0, 10);
      const d = Number(r.days || 0);
      if (!gDate || !d) continue;
      const et = addYears(new Date(gDate + 'T00:00:00Z'), 2);
      et.setUTCDate(et.getUTCDate() - 1);
      const expiryDate = fmt(et);
      await repo.upsertGrant({ userId: Number(r.userId), type: 'paid', grantDate: gDate, daysGranted: d, expiryDate });
      granted++;
    }
    try {
      await auditRepo.writeLog({
        userId: req.user?.id,
        action: 'leave_grant_bulk',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ mode, eligible: rows.length, granted })
      });
    } catch {}
    res.status(200).json({ mode, eligible: rows.length, granted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, type, reason } = req.body || {};
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing userId/startDate/endDate' });
    }
    const t = type || 'paid';
    const id = await repo.create({ userId, startDate, endDate, type: t, reason });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.approve = async (req, res) => {
  try {
    const { id, status } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const s = status || 'approved';
    if (!['approved','rejected','pending'].includes(s)) return res.status(400).json({ message: 'Invalid status' });
    await repo.updateStatus(id, s);
    res.status(200).json({ id, status: s });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.balance = async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : null;
    const role = String(req.user?.role || '').toLowerCase();
    if (userId && (role === 'admin' || role === 'manager')) {
      req.query.userId = String(userId);
      return exports.userBalance(req, res);
    }
    return exports.myBalance(req, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.summary = async (req, res) => {
  try {
    await tryReconcileAttendance();
    const list = await userRepo.listUsers();
    const out = [];
    for (const u of list) {
      const b = await computeUserBalance(u.id);
      const grants = b.grants || [];
      const today = new Date();
      const totalGranted = grants.reduce((s, g) => s + (new Date(g.expiryDate) >= today ? g.daysGranted : 0), 0);
      const upcoming = grants
        .filter(g => new Date(g.expiryDate) >= today && (g.daysRemaining || 0) > 0)
        .sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0] || null;
      out.push({
        userId: u.id,
        name: u.username || u.email || '',
        departmentId: u.departmentId || null,
        totalGranted,
        usedDays: b.usedDays,
        remainingDays: b.totalAvailable,
        nearestExpiry: upcoming ? upcoming.expiryDate : null,
        nearestExpiryRemaining: upcoming ? upcoming.daysRemaining : 0,
        obligationRemaining: Math.max(0, b?.obligation?.remaining || 0)
      });
    }
    res.status(200).json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.autoGrantNow = async (req, res) => {
  try {
    const mode = getLeaveGrantMode();
    if (mode === 'MANUAL') {
      return res.status(400).json({
        message: 'LEAVE_GRANT_MODE=MANUAL のため自動付与は無効です',
        mode
      });
    }
    const list = await userRepo.listUsers();
    let ok = 0;
    for (const u of list) {
      try {
        await ensureUserGrants(u.id);
        ok++;
      } catch {}
    }
    res.status(200).json({ processed: list.length, ok, mode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
