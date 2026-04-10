const PERMS = {
  attendance: {
    admin: new Set(['view']),
    manager: new Set(['manage', 'view']),
    employee: new Set(['self'])
  },
  users: {
    admin: new Set(['full']),
    manager: new Set([]),
    employee: new Set([])
  },
  departments: {
    admin: new Set(['full', 'view']),
    manager: new Set(['view']),
    employee: new Set([])
  },
  employees: {
    admin: new Set(['full', 'view']),
    manager: new Set(['manage', 'view']),
    employee: new Set(['self'])
  },
  overtime: {
    admin: new Set(['view']),
    manager: new Set(['approve', 'view']),
    employee: new Set(['request'])
  },
  requests: {
    admin: new Set(['view']),
    manager: new Set(['approve', 'view']),
    employee: new Set(['create'])
  },
  leaveAdmin: {
    admin: new Set(['full', 'view']),
    manager: new Set(['view']),
    employee: new Set([])
  },
  leave: {
    admin: new Set(['view']),
    manager: new Set(['approve', 'view']),
    employee: new Set(['request'])
  },
  expense: {
    admin: new Set(['view']),
    manager: new Set(['approve', 'view']),
    employee: new Set(['request'])
  },
  salary: {
    admin: new Set(['full']),
    manager: new Set([]),
    employee: new Set([])
  },
  payroll: {
    admin: new Set(['full']),
    manager: new Set([]),
    employee: new Set([])
  },
  payslip: {
    admin: new Set(['send', 'view']),
    manager: new Set(['view']),
    employee: new Set(['view'])
  },
  calendar: {
    admin: new Set(['full', 'view']),
    manager: new Set(['view']),
    employee: new Set(['view'])
  },
  shifts: {
    admin: new Set(['full', 'manage', 'view']),
    manager: new Set(['manage', 'view']),
    employee: new Set(['view'])
  },
  reports: {
    admin: new Set(['full', 'view']),
    manager: new Set(['view']),
    employee: new Set([])
  },
  settings: {
    admin: new Set(['full']),
    manager: new Set([]),
    employee: new Set([])
  },
  logs: {
    admin: new Set(['full', 'view']),
    manager: new Set([]),
    employee: new Set([])
  }
};

function getRole(req) {
  return String(req.user?.role || '').toLowerCase();
}

function permit(moduleKey, action) {
  return (req, res, next) => {
    try {
      const role = getRole(req);
      const mod = PERMS[moduleKey];
      if (!mod) {
        return res.status(500).json({ message: 'RBAC: unknown module' });
      }
      const allowed = mod[role] || new Set();
      if (!allowed.has(action) && !allowed.has('full')) {
        const adminAllowed = mod['admin'] || new Set();
        if (role === 'manager' && (adminAllowed.has(action) || adminAllowed.has('full'))) {
          return next();
        }
        return res.status(403).json({ message: 'Forbidden: insufficient permission' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ message: 'RBAC error' });
    }
  };
}

module.exports = { permit, PERMS };
