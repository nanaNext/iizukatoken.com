const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const authRepository = require('./auth.repository');
const { jwtSecretCurrent, bcryptRounds, accessTokenExpires, refreshTokenExpiresDays } = require('../../config/env');
const refreshRepo = require('./refresh.repository');
const crypto = require('crypto');
const userRepo = require('../users/user.repository');
const auditRepo = require('../audit/audit.repository');
// Controller xác thực: đăng ký và đăng nhập

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
    await authRepository.ensureUserSecurityColumns();
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
    const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const isHttps = xfProto.includes('https') || (req.protocol === 'https');
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
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      accessToken: token,
      refreshToken: rt
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
    if (!email || !password || !code) {
      return res.status(400).json({ message: 'Missing email/password/code' });
    }
    if (email !== superEmail || code !== resetCode) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await authRepository.findUserByEmail(email);
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
    const token = jwt.sign({ id: row.userId, role: role2, v: tokenVersion2 }, jwtSecretCurrent, { expiresIn: accessTokenExpires });
    // rotate refresh token
    const newRt = crypto.randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + refreshTokenExpiresDays * 24 * 60 * 60 * 1000);
    await refreshRepo.revokeToken(refreshToken);
    await refreshRepo.createToken({ userId: row.userId, token: newRt, expiresAt: expires.toISOString().slice(0,19).replace('T',' '), userAgent: req.headers['user-agent'], ip: req.ip });
    res.cookie('refreshToken', newRt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
      path: '/api/auth'
    });
    res.status(200).json({ accessToken: token, refreshToken: newRt });
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
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
