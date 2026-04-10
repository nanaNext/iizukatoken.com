const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const authRepository = require('./auth.repository');
const { jwtSecretCurrent, bcryptRounds, accessTokenExpires, refreshTokenExpiresDays, idleTimeoutSeconds } = require('../../config/env');
const refreshRepo = require('./refresh.repository');
const crypto = require('crypto');
const userRepo = require('../users/user.repository');
const auditRepo = require('../audit/audit.repository');
// Controller xác thực: đăng ký và đăng nhập

function isHttpsRequest(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return xfProto.includes('https') || req.protocol === 'https';
}

function setSessionCookie(req, res, token) {
  res.cookie('session_token', token, {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: 'lax',
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie('session_token', { path: '/' });
}

// Đăng ký tài khoản mới
exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, email, password } = req.body;
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email đã tồn tại!' });
    }
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, bcryptRounds);
    // Thêm user mới vào DB
    // Bạn cần bổ sung hàm createUser trong auth.repository.js
    await authRepository.createUser({ username, email, password: hashedPassword });
    res.status(201).json({ message: 'User was registered successfully!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    try {
      const flags = await require('../settings/settings.service').getFlags();
      const lockLogin = !!flags.lockLoginExceptSuper;
      const superEmail = process.env.SUPER_ADMIN_EMAIL;
      if (lockLogin && String(email) === String(superEmail)) {
        // allow SUPER_ADMIN even if lock is on
      } else {
        // ignore lock to ensure users can sign in
      }
    } catch {}
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (String(user.employment_status || 'active') !== 'active') {
      try { await auditRepo.writeLog({ userId: user.id, action: 'login_block_inactive', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ employment_status: user.employment_status }) }); } catch {}
      return res.status(403).json({ message: 'Account inactive' });
    }
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return res.status(423).json({ message: 'Account locked. Try later.' });
    }
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      const fails = await authRepository.incrementFail(email);
      if (fails >= 5) {
        await authRepository.lockUser(email, 15);
      }
      try { require('../../core/metrics').inc('login_fail', 1); } catch {}
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    await authRepository.resetLock(email);
    const m = typeof user.password === 'string' ? user.password.match(/^\$2[aby]\$(\d+)\$/) : null;
    const storedRounds = m ? parseInt(m[1], 10) : null;
    if (storedRounds !== null && storedRounds < bcryptRounds) {
      const upgraded = bcrypt.hashSync(password, bcryptRounds);
      await userRepo.setPassword(user.id, upgraded);
    }
    const role = user.role || 'employee';
    const tokenVersion = user.token_version || 1;
    const token = jwt.sign({ id: user.id, role, v: tokenVersion }, jwtSecretCurrent, { expiresIn: accessTokenExpires });
    const rt = crypto.randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + refreshTokenExpiresDays * 24 * 60 * 60 * 1000);
    await refreshRepo.createToken({ userId: user.id, token: rt, expiresAt: expires.toISOString().slice(0,19).replace('T',' '), userAgent: req.headers['user-agent'], ip: req.ip });
    try { await userRepo.updateUser(user.id, { lastLogin: new Date().toISOString().slice(0,19).replace('T',' ') }); } catch {}
    try { await userRepo.touchLastActive(user.id); } catch {}
    const isHttps = isHttpsRequest(req);
    res.cookie('refreshToken', rt, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
      path: '/api/auth'
    });
    const csrf = crypto.randomBytes(24).toString('hex');
    res.cookie('csrfToken', csrf, {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
      path: '/'
    });
    setSessionCookie(req, res, token);
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      accessToken: token
    });
    try {
      await auditRepo.writeLog({
        userId: user.id,
        action: 'login_success',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ role })
      });
    } catch {}
    try { require('../../core/metrics').inc('login_success', 1); } catch {}
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Thông tin tài khoản hiện tại
exports.me = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const user = await userRepo.getUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Quên mật khẩu: nhận email, phản hồi 202 (stub)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Missing email' });
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      return res.status(202).json({ ok: true });
    }
    const { resetTokenExpiresMinutes } = require('../../config/env');
    const token = require('crypto').randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + (resetTokenExpiresMinutes || 30) * 60 * 1000);
    const pr = require('./password_reset.repository');
    await pr.revokeUnsedForUser(user.id);
    await pr.createReset({
      userId: user.id,
      token,
      expiresAt: expires.toISOString().slice(0,19).replace('T',' '),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    try { require('../../core/metrics').inc('forgot_password_requests', 1); } catch {}
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reset mật khẩu: xác thực token (stub) và đặt mật khẩu mới
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ message: 'Missing token/newPassword' });
    const pr = require('./password_reset.repository');
    const row = await pr.findValid(token);
    if (!row) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (row.used_at) {
      return res.status(401).json({ message: 'Token already used' });
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ message: 'Token expired' });
    }
    const hashed = require('bcrypt').hashSync(newPassword, require('../../config/env').bcryptRounds);
    await userRepo.setPassword(row.userId, hashed);
    await pr.consume(token);
    await require('./refresh.repository').deleteUserTokens(row.userId);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Đặt lại mật khẩu cho SUPER_ADMIN qua Postman (bảo vệ bằng code)
exports.superReset = async (req, res) => {
  try {
    const { email, password, code } = req.body || {};
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    const resetCode = process.env.SUPER_ADMIN_RESET_CODE;
    if (!password || !code) return res.status(400).json({ message: 'Missing password/code' });
    if (!resetCode || code !== resetCode) return res.status(403).json({ message: 'Forbidden' });
    let targetEmail = String(email || '').trim();
    if (superEmail) {
      if (!targetEmail) targetEmail = superEmail;
      if (targetEmail !== superEmail) return res.status(403).json({ message: 'Forbidden' });
    }
    let user = null;
    if (targetEmail) {
      user = await authRepository.findUserByEmail(targetEmail);
    } else {
      const db = require('../../core/database/mysql');
      const [rows] = await db.query(`SELECT * FROM users WHERE LOWER(role) = 'admin' ORDER BY id ASC LIMIT 2`);
      if (!rows || !rows.length) return res.status(404).json({ message: 'User not found.' });
      if (rows.length > 1) return res.status(400).json({ message: 'Multiple admin users found; specify email.' });
      user = rows[0];
      targetEmail = user.email;
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const isHash = typeof password === 'string' && /^\$2[aby]\$\d+\$/.test(password);
    const hashed = isHash ? password : bcrypt.hashSync(password, bcryptRounds);
    await userRepo.setPassword(user.id, hashed);
    res.status(200).json({ ok: true, id: user.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Tạo SUPER ADMIN qua Postman khi chưa có, bảo vệ bằng code
exports.superBootstrap = async (req, res) => {
  try {
    const { email, password, code, name } = req.body || {};
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    const resetCode = process.env.SUPER_ADMIN_RESET_CODE;
    if (!password || !code) return res.status(400).json({ message: 'Missing password/code' });
    if (!resetCode || code !== resetCode) return res.status(403).json({ message: 'Forbidden' });
    const targetEmail = String(email || '').trim();
    if (superEmail && targetEmail !== superEmail) return res.status(403).json({ message: 'Forbidden' });
    if (!superEmail) {
      const db = require('../../core/database/mysql');
      const [cnt] = await db.query(`SELECT COUNT(*) AS c FROM users WHERE LOWER(role) = 'admin'`);
      const hasAdmin = Number(cnt?.[0]?.c || 0) > 0;
      if (hasAdmin) return res.status(409).json({ message: 'Admin already exists' });
    }
    if (!targetEmail) return res.status(400).json({ message: 'Missing email' });
    const existing = await authRepository.findUserByEmail(targetEmail);
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }
    const hashed = /^\$2[aby]\$\d+\$/.test(password) ? password : bcrypt.hashSync(password, bcryptRounds);
    const id = await userRepo.createUser({
      employeeCode: null,
      username: name || process.env.SUPER_ADMIN_NAME || 'Super Admin',
      email: targetEmail,
      password: hashed,
      role: 'admin',
      departmentId: null,
      employmentType: 'full_time',
      hireDate: new Date().toISOString().slice(0,10),
      level: null,
      managerId: null,
      phone: null,
      birthDate: null,
      gender: null,
      avatarUrl: null,
      probationDate: null,
      officialDate: null,
      contractEnd: null,
      baseSalary: null,
      shiftId: null
    });
    try { await auditRepo.writeLog({ userId: id, action: 'super_bootstrap', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ id, email: targetEmail }) }); } catch {}
    res.status(201).json({ id, email: targetEmail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Refresh access token (và rotate refresh token)
exports.refresh = async (req, res) => {
  try {
    const bodyRt = (req.body || {}).refreshToken;
    const cookieRt = req.cookies?.refreshToken;
    const refreshToken = bodyRt || cookieRt;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Missing refreshToken' });
    }
    if (cookieRt) {
      try {
        const origin = String(req.headers.origin || '');
        const host = String(req.headers.host || '').toLowerCase();
        const u = new URL(origin || `http://${host}`);
        const sameHost = !!(host && u.host.toLowerCase() === host);
        if (!sameHost) {
          const csrfHeader = req.headers['x-csrf-token'];
          const csrfCookie = req.cookies?.csrfToken;
          if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
            return res.status(403).json({ message: 'CSRF validation failed' });
          }
        }
      } catch {}
    }
    const row = await refreshRepo.findToken(refreshToken);
    if (!row) {
      const any = await refreshRepo.findAnyToken(refreshToken);
      if (any && any.revoked_at) {
        await refreshRepo.deleteUserTokens(any.userId);
      }
      try { require('../../core/metrics').inc('refresh_fail', 1); } catch {}
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await refreshRepo.revokeToken(refreshToken);
      return res.status(401).json({ message: 'Expired refresh token' });
    }
    // cấp access token mới
    const u = await userRepo.getUserById(row.userId);
    const role2 = u?.role || 'employee';
    const tokenVersion2 = u?.token_version || 1;
    const idleSecs = Math.max(0, Number(idleTimeoutSeconds || 0));
    try {
      if (idleSecs > 0) {
        const last = u?.last_active_at ? new Date(u.last_active_at).getTime() : 0;
        if (last && (Date.now() - last) > idleSecs * 1000) {
          await refreshRepo.deleteUserTokens(u?.id || row.userId);
          res.clearCookie('refreshToken', { path: '/api/auth' });
          clearSessionCookie(res);
          return res.status(401).json({ message: 'Session expired (idle)' });
        }
      }
    } catch {}
    const token = jwt.sign({ id: row.userId, role: role2, v: tokenVersion2 }, jwtSecretCurrent, { expiresIn: accessTokenExpires });
    // rotate refresh token
    const newRt = crypto.randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + refreshTokenExpiresDays * 24 * 60 * 60 * 1000);
    await refreshRepo.revokeToken(refreshToken);
    await refreshRepo.createToken({ userId: row.userId, token: newRt, expiresAt: expires.toISOString().slice(0,19).replace('T',' '), userAgent: req.headers['user-agent'], ip: req.ip });
    try { await userRepo.touchLastActive(row.userId); } catch {}
    res.cookie('refreshToken', newRt, {
      httpOnly: true,
      secure: isHttpsRequest(req),
      sameSite: 'lax',
      maxAge: refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
      path: '/api/auth'
    });
    setSessionCookie(req, res, token);
    res.status(200).json({ accessToken: token });
    try { require('../../core/metrics').inc('token_refresh', 1); } catch {}
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout: revoke refresh token hiện tại
exports.logout = async (req, res) => {
  try {
    const bodyRt = (req.body || {}).refreshToken;
    const cookieRt = req.cookies?.refreshToken;
    const refreshToken = bodyRt || cookieRt;
    if (!refreshToken) return res.status(400).json({ message: 'Missing refreshToken' });
    if (cookieRt) {
      try {
        const origin = String(req.headers.origin || '');
        const host = String(req.headers.host || '').toLowerCase();
        const u = new URL(origin || `http://${host}`);
        const sameHost = !!(host && u.host.toLowerCase() === host);
        if (!sameHost) {
          const csrfHeader = req.headers['x-csrf-token'];
          const csrfCookie = req.cookies?.csrfToken;
          if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
            return res.status(403).json({ message: 'CSRF validation failed' });
          }
        }
      } catch {}
    }
    await refreshRepo.revokeToken(refreshToken);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.clearCookie('csrfToken', { path: '/' });
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Revoke toàn bộ refresh tokens của người dùng hiện tại
exports.revokeAll = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    await refreshRepo.deleteUserTokens(userId);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
