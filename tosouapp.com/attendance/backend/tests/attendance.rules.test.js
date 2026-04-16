const { CoreRules } = require('../src/modules/attendance/attendance.rules');

describe('Attendance CoreRules - Business Risk Tests', () => {
  const mockShift = {
    start: new Date(Date.UTC(2026, 2, 28, 0, 0, 0)), // 09:00 JST
    end: new Date(Date.UTC(2026, 2, 28, 10, 0, 0)),  // 19:00 JST
    breakMinutes: 60
  };

  test('normal work day (baseline)', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 28, 0, 0, 0));  // 09:00 JST
    const checkOut = new Date(Date.UTC(2026, 2, 28, 9, 0, 0)); // 18:00 JST
    
    const result = CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    
    expect(result.isAnomaly).toBe(false);
    expect(result.regularMinutes).toBe(480); // 9h - 1h break = 8h = 480m
    expect(result.overtimeMinutes).toBe(0); // Inside 09:00-19:00
  });

  test('overwork > 12h flagged', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 28, 0, 0, 0));   // 09:00 JST
    const checkOut = new Date(Date.UTC(2026, 2, 28, 14, 0, 0)); // 23:00 JST (14 hours)
    
    const result = CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    
    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyType).toBe('OVERWORK_GT_12H');
  });

  test('early checkin flagged (< 07:00 JST)', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 27, 21, 30, 0)); // 06:30 JST
    const checkOut = new Date(Date.UTC(2026, 2, 28, 6, 0, 0));  // 15:00 JST
    
    const result = CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    
    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyType).toBe('EARLY_CHECKIN');
  });

  test('overnight shift flagged', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 28, 13, 0, 0)); // 22:00 JST
    const checkOut = new Date(Date.UTC(2026, 2, 28, 20, 0, 0)); // 05:00 JST (Next day)
    
    const result = CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    
    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyType).toBe('OVERNIGHT_SHIFT');
    expect(result.nightMinutes).toBe(420); // 22:00 -> 05:00 = 7h = 420m
  });

  test('invalid time order (checkout before checkin)', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 28, 9, 0, 0));
    const checkOut = new Date(Date.UTC(2026, 2, 28, 0, 0, 0));
    
    expect(() => {
      CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    }).toThrow('Invalid time order');
  });

  test('missing checkout flagged', () => {
    const checkIn = new Date(Date.UTC(2026, 2, 28, 0, 0, 0));
    const checkOut = null;
    
    const result = CoreRules.calculateWorkMetrics(checkIn, checkOut, mockShift);
    
    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyType).toBe('MISSING_CHECKOUT');
  });
});
