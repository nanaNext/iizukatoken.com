const repo = require('./department.repository');
// Controller quản trị phòng ban
exports.list = async (req, res) => {
  try {
    const rows = await repo.getAllDepartments();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.create = async (req, res) => {
  try {
    const { name, code } = req.body || {};
    if (!name) return res.status(400).json({ message: 'Missing name' });
    const id = await repo.createDepartment(name, code || null);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, code } = req.body || {};
    if (!id || (!name && !code)) return res.status(400).json({ message: 'Missing id or fields' });
    await repo.updateDepartment(id, name || null, code || null);
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await repo.deleteDepartment(id);
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createBulk = async (req, res) => {
  try {
    const names = req.body?.names;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: 'Missing names[]' });
    }
    const ids = await repo.createMany(names);
    res.status(201).json({ ids });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
