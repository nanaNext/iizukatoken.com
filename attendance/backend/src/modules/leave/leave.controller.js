const repo = require('./leave.repository');
const userRepo = require('../users/user.repository');

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
async function ensureUserGrants(userId) {
  const u = await userRepo.getUserById(userId);
  const hire = u?.hire_date || u?.hireDate || u?.join_date || u?.joinDate || null;
  if (!hire) return [];
  const today = new Date(); const todayStr = fmt(today);
  const plan = scheduleGrants(hire, todayStr);
  for (const g of plan) {
    const eTmp = addYears(new Date(g.grantDate + 'T00:00:00Z'), 2);
    eTmp.setUTCDate(eTmp.getUTCDate() - 1);
    const expiry = fmt(eTmp);
    await repo.upsertGrant({ userId, type: 'paid', grantDate: g.grantDate, daysGranted: g.days, expiryDate: expiry });
  }
  return await repo.listGrants(userId, 'paid');
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
    const id = await repo.create({ userId, startDate, endDate, type: 'paid', reason });
    res.status(201).json({ id });
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
    return res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.userBalance = async (req, res) => {
  try {
    const userId = parseInt(String(req.query.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const data = await computeUserBalance(userId);
    return res.status(200).json({ userId, ...data });
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
    res.status(201).json({ ok: true });
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
    const list = await userRepo.listUsers();
    let ok = 0;
    for (const u of list) {
      try {
        await ensureUserGrants(u.id);
        ok++;
      } catch {}
    }
    res.status(200).json({ processed: list.length, ok });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
