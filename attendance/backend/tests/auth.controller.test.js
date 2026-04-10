const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    }
  };
  return res;
};

const loadAuthController = ({
  findUserByEmail = jest.fn(),
  incrementFail = jest.fn(),
  lockUser = jest.fn(),
  resetLock = jest.fn(),
  createToken = jest.fn(),
  findToken = jest.fn(),
  findAnyToken = jest.fn(),
  revokeToken = jest.fn(),
  deleteUserTokens = jest.fn(),
  getUserById = jest.fn(),
  setPassword = jest.fn(),
  updateUser = jest.fn(),
  touchLastActive = jest.fn(),
  writeLog = jest.fn(),
  getFlags = jest.fn().mockResolvedValue({ lockLoginExceptSuper: false }),
  compareSync = jest.fn(),
  hashSync = jest.fn((v) => `hashed:${v}`),
  sign = jest.fn(() => 'signed-access-token'),
  inc = jest.fn()
} = {}) => {
  jest.resetModules();

  const randomBytes = jest.fn((size) => ({
    toString: () => (size === 48 ? 'refresh-token-value' : 'csrf-token-value')
  }));

  jest.doMock('bcrypt', () => ({
    compareSync,
    hashSync
  }));
  jest.doMock('jsonwebtoken', () => ({
    sign
  }));
  jest.doMock('crypto', () => ({
    randomBytes
  }));
  jest.doMock('express-validator', () => ({
    validationResult: () => ({ isEmpty: () => true, array: () => [] })
  }));
  jest.doMock('../src/config/env', () => ({
    jwtSecretCurrent: 'secret',
    bcryptRounds: 10,
    accessTokenExpires: '15m',
    refreshTokenExpiresDays: 7,
    idleTimeoutSeconds: 3600
  }));
  jest.doMock('../src/core/metrics', () => ({
    inc
  }));
  jest.doMock('../src/modules/settings/settings.service', () => ({
    getFlags
  }));
  jest.doMock('../src/modules/auth/auth.repository', () => ({
    findUserByEmail,
    incrementFail,
    lockUser,
    resetLock
  }));
  jest.doMock('../src/modules/auth/refresh.repository', () => ({
    createToken,
    findToken,
    findAnyToken,
    revokeToken,
    deleteUserTokens
  }));
  jest.doMock('../src/modules/users/user.repository', () => ({
    getUserById,
    setPassword,
    updateUser,
    touchLastActive
  }));
  jest.doMock('../src/modules/audit/audit.repository', () => ({
    writeLog
  }));

  return {
    controller: require('../src/modules/auth/auth.controller'),
    mocks: {
      findUserByEmail,
      incrementFail,
      lockUser,
      resetLock,
      createToken,
      findToken,
      findAnyToken,
      revokeToken,
      deleteUserTokens,
      getUserById,
      setPassword,
      updateUser,
      touchLastActive,
      writeLog,
      getFlags,
      compareSync,
      hashSync,
      sign,
      inc,
      randomBytes
    }
  };
};

describe('auth.controller', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPER_ADMIN_RESET_CODE;
  });

  test('login trả accessToken và set cookie mà không trả refreshToken trong body', async () => {
    const { controller, mocks } = loadAuthController({
      findUserByEmail: jest.fn().mockResolvedValue({
        id: 7,
        username: 'demo',
        email: 'demo@example.com',
        password: '$2b$10$storedhash',
        role: 'employee',
        token_version: 2,
        employment_status: 'active'
      }),
      compareSync: jest.fn().mockReturnValue(true)
    });

    const req = {
      body: { email: 'demo@example.com', password: 'secret' },
      headers: { 'user-agent': 'jest-agent', 'x-forwarded-proto': 'https' },
      path: '/api/auth/login',
      method: 'POST',
      ip: '127.0.0.1',
      protocol: 'https'
    };
    const res = makeRes();

    await controller.login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: 7,
      username: 'demo',
      email: 'demo@example.com',
      role: 'employee',
      accessToken: 'signed-access-token'
    });
    expect(res.body.refreshToken).toBeUndefined();
    expect(mocks.createToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      token: 'refresh-token-value',
      userAgent: 'jest-agent',
      ip: '127.0.0.1'
    }));
    expect(res.cookies.map((it) => it.name)).toEqual(expect.arrayContaining(['refreshToken', 'csrfToken', 'session_token']));
  });

  test('refresh rotate cookie token nhưng chỉ trả accessToken', async () => {
    const { controller, mocks } = loadAuthController({
      findToken: jest.fn().mockResolvedValue({
        userId: 5,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null
      }),
      getUserById: jest.fn().mockResolvedValue({
        id: 5,
        role: 'manager',
        token_version: 3,
        last_active_at: new Date().toISOString()
      })
    });

    const req = {
      body: {},
      cookies: { refreshToken: 'cookie-refresh-token' },
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'user-agent': 'jest-agent'
      },
      protocol: 'http'
    };
    const res = makeRes();

    await controller.refresh(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ accessToken: 'signed-access-token' });
    expect(res.body.refreshToken).toBeUndefined();
    expect(mocks.revokeToken).toHaveBeenCalledWith('cookie-refresh-token');
    expect(mocks.createToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5,
      token: 'refresh-token-value'
    }));
    expect(res.cookies.find((it) => it.name === 'refreshToken')?.value).toBe('refresh-token-value');
  });

  test('logout dùng cookie refreshToken để revoke và clear cookie', async () => {
    const { controller, mocks } = loadAuthController({
      revokeToken: jest.fn().mockResolvedValue({ ok: true })
    });

    const req = {
      body: {},
      cookies: {
        refreshToken: 'cookie-refresh-token',
        csrfToken: 'csrf-cookie'
      },
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'x-csrf-token': 'csrf-cookie'
      }
    };
    const res = makeRes();

    await controller.logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mocks.revokeToken).toHaveBeenCalledWith('cookie-refresh-token');
    expect(res.clearedCookies).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'refreshToken' }),
      expect.objectContaining({ name: 'csrfToken' }),
      expect.objectContaining({ name: 'session_token' })
    ]));
  });
});
