const { classifyMonthlyDay } = require('../src/modules/attendance/attendance.classifier');

describe('attendance.classifier - classifyMonthlyDay', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => Date.UTC(2026, 3, 5, 0, 0, 0));
  });
  afterAll(() => {
    Date.now.mockRestore();
  });

  test('休日 kubun -> leave', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '休日', isOnLeaveApproved: false, isPlannedOff: false, hasAttendance: false, hasCheckOut: false });
    expect(r.status).toBe('leave');
    expect(r.kubun).toBe('休日');
  });

  test('欠勤 kubun -> leave', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '欠勤', isOnLeaveApproved: false, isPlannedOff: false, hasAttendance: false, hasCheckOut: false });
    expect(r.status).toBe('leave');
    expect(r.kubun).toBe('欠勤');
  });

  test('approved leave without kubun -> leave', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '', isOnLeaveApproved: true, isPlannedOff: false, hasAttendance: false, hasCheckOut: false });
    expect(r.status).toBe('leave');
  });

  test('attendance with checkout -> checked_out', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '', isOnLeaveApproved: false, isPlannedOff: false, hasAttendance: true, hasCheckOut: true });
    expect(r.status).toBe('checked_out');
  });

  test('attendance without checkout past day -> 欠勤', () => {
    const r = classifyMonthlyDay({ date: '2026-04-04', kubun: '', isOnLeaveApproved: false, isPlannedOff: false, hasAttendance: true, hasCheckOut: false });
    expect(r.status).toBe('leave');
    expect(r.kubun).toBe('欠勤');
  });

  test('no attendance, kubun 出勤 -> 欠勤', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '出勤', isOnLeaveApproved: false, isPlannedOff: false, hasAttendance: false, hasCheckOut: false });
    expect(r.status).toBe('leave');
    expect(r.kubun).toBe('欠勤');
  });

  test('no attendance, no kubun -> planned (off)', () => {
    const r = classifyMonthlyDay({ date: '2026-04-01', kubun: '', isOnLeaveApproved: false, isPlannedOff: true, hasAttendance: false, hasCheckOut: false });
    expect(r.status).toBe('planned');
    expect(r.plan).toBe('off');
  });
});
