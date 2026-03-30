const repo = require('./notices.repository');
const userRepo = require('../users/user.repository');

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));

exports.listForMe = async (req, res) => {
  try {
    const date = String(req.query.date || '').slice(0, 10);
    const month = String(req.query.month || '').slice(0, 7);
    const limit = req.query.limit;
    const d = isISODate(date) ? date : new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const m = isYM(month) ? month : String(d).slice(0, 7);
    const rows = await repo.listForDate({ date: d, month: m, limit, userId: req.user?.id || null });
    res.status(200).json({ date: d, month: m, notices: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listAdmin = async (req, res) => {
  try {
    const from = req.query.from ? String(req.query.from).slice(0, 10) : null;
    const to = req.query.to ? String(req.query.to).slice(0, 10) : null;
    const limit = req.query.limit;
    const rows = await repo.listAdmin({ from, to, limit });
    res.status(200).json({ rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const r = await repo.markRead({ noticeIds: ids, userId: req.user?.id || null });
    res.status(200).json(r);
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const b = req.body || {};
    const targetUserIdRaw = b.targetUserId != null ? String(b.targetUserId).trim() : '';
    const targetUserId = /^\d+$/.test(targetUserIdRaw) ? parseInt(targetUserIdRaw, 10) : null;
    const targetDate = b.targetDate != null ? String(b.targetDate).slice(0, 10) : null;
    const targetMonth = b.targetMonth != null ? String(b.targetMonth).slice(0, 7) : null;
    const message = b.message != null ? String(b.message) : '';
    if (targetUserId) {
      const role = String(req.user?.role || '').toLowerCase();
      if (role === 'manager') {
        const me = await userRepo.getUserById(req.user.id);
        const target = await userRepo.getUserById(targetUserId);
        if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
          return res.status(403).json({ message: 'Forbidden: cross-department access' });
        }
        if (String(target?.role || '').toLowerCase() !== 'employee') {
          return res.status(400).json({ message: 'Target must be employee' });
        }
      }
      if (role !== 'admin' && role !== 'manager') {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    const r = await repo.createNotice({
      targetUserId,
      targetDate: isISODate(targetDate) ? targetDate : null,
      targetMonth: isYM(targetMonth) ? targetMonth : null,
      message,
      createdBy: req.user?.id || null
    });
    res.status(201).json({ notice: r });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const r = await repo.deleteNotice(id);
    res.status(200).json({ id: parseInt(String(id || 0), 10) || null, ...r });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};
