const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

const loadAttendanceController = ({
  checkIn = jest.fn(),
  checkOut = jest.fn(),
  timesheet = jest.fn(),
  writeLog = jest.fn(),
  findCheckInByTime = jest.fn(),
  findCheckOutByTime = jest.fn(),
  getOpenAttendanceForUser = jest.fn()
} = {}) => {
  jest.resetModules();

  jest.doMock('../src/modules/attendance/attendance.service', () => ({
    checkIn,
    checkOut,
    timesheet
  }));
  jest.doMock('../src/modules/audit/audit.repository', () => ({
    writeLog
  }));
  jest.doMock('../src/modules/attendance/attendance.repository', () => ({
    findCheckInByTime,
    findCheckOutByTime,
    getOpenAttendanceForUser
  }));
  jest.doMock('../src/modules/attendance/attendance.rules', () => ({}));
  jest.doMock('../src/utils/dateTime', () => ({
    formatInputToMySQLJST: jest.fn((value) => String(value)),
    nowJSTMySQL: jest.fn(() => '2026-04-01 09:00:00')
  }));
  jest.doMock('../src/modules/users/user.repository', () => ({}));
  jest.doMock('../src/modules/workReports/workReports.repository', () => ({}));
  jest.doMock('../src/config/env', () => ({
    timesheetMaxDays: 93
  }));

  return {
    controller: require('../src/modules/attendance/attendance.controller'),
    mocks: {
      checkIn,
      checkOut,
      timesheet,
      writeLog,
      findCheckInByTime,
      findCheckOutByTime,
      getOpenAttendanceForUser
    }
  };
};

describe('attendance.controller', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('checkIn chặn request thiếu userId', async () => {
    const { controller, mocks } = loadAttendanceController();
    const req = {
      body: { time: '2026-04-01T09:00:00+09:00' },
      headers: {},
      path: '/api/attendance/checkin',
      method: 'POST',
      ip: '127.0.0.1'
    };
    const res = makeRes();

    await controller.checkIn(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Missing userId' });
    expect(mocks.checkIn).not.toHaveBeenCalled();
  });

  test('checkIn gọi service với location và workType hợp lệ', async () => {
    const { controller, mocks } = loadAttendanceController({
      checkIn: jest.fn().mockResolvedValue({ id: 91, checkIn: '2026-04-01 09:00:00' })
    });
    const req = {
      user: { id: 9 },
      body: {
        time: '2026-04-01T09:00:00+09:00',
        workType: 'remote',
        latitude: 35.68,
        longitude: 139.76,
        accuracy: 10,
        note: 'WFH'
      },
      headers: { 'user-agent': 'jest-agent' },
      path: '/api/attendance/checkin',
      method: 'POST',
      ip: '127.0.0.1'
    };
    const res = makeRes();

    await controller.checkIn(req, res);

    expect(mocks.checkIn).toHaveBeenCalledWith(
      9,
      '2026-04-01T09:00:00+09:00',
      expect.objectContaining({
        latitude: 35.68,
        longitude: 139.76,
        accuracy: 10,
        note: 'WFH'
      }),
      'remote'
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: 91, checkIn: '2026-04-01 09:00:00' });
  });

  test('checkOut trả 404 khi không có bản ghi đang mở', async () => {
    const { controller, mocks } = loadAttendanceController({
      checkOut: jest.fn().mockResolvedValue(null)
    });
    const req = {
      user: { id: 9 },
      body: { time: '2026-04-01T18:00:00+09:00' },
      headers: { 'user-agent': 'jest-agent' },
      path: '/api/attendance/checkout',
      method: 'POST',
      ip: '127.0.0.1'
    };
    const res = makeRes();

    await controller.checkOut(req, res);

    expect(mocks.checkOut).toHaveBeenCalledWith(
      9,
      '2026-04-01T18:00:00+09:00',
      expect.objectContaining({
        latitude: undefined,
        longitude: undefined
      })
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'No open attendance' });
  });
});
