const repo = require('./settings.repository');
// Controller cấu hình hệ thống
exports.get = async (req, res) => {
  try {
    const s = await repo.getSettings();
    res.status(200).json(s || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    await repo.updateSettings(req.body || {});
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
