const { parseMySQLJSTToDate } = require('../../utils/dateTime');
// Chuyển chuỗi DATETIME (JST) sang Date (UTC-based) để tính toán

function minutesBetween(a, b) {
  // Tính chênh lệch phút giữa hai thời điểm, không âm
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/**
 * PURE FUNCTIONS FOR TESTING (Ưu tiên 2)
 * Tách logic tính toán ra khỏi DB để có thể viết Unit Test chí mạng.
 */
const CoreRules = {
  /**
   * Tính toán thời gian làm việc cơ bản và các flag bất thường
   */
  calculateWorkMetrics(checkIn, checkOut, shift, isOff = false) {
    if (!checkIn || !checkOut) {
      return { 
        regularMinutes: 0, overtimeMinutes: 0, nightMinutes: 0, 
        isAnomaly: true, anomalyType: !checkOut ? 'MISSING_CHECKOUT' : 'MISSING_CHECKIN' 
      };
    }

    const inJ = checkIn instanceof Date ? checkIn : new Date(checkIn);
    const outJ = checkOut instanceof Date ? checkOut : new Date(checkOut);

    if (outJ < inJ) {
      throw new Error('Invalid time order: Checkout before Checkin');
    }

    const worked = minutesBetween(inJ, outJ);
    const breakMin = shift?.breakMinutes ?? 60;
    
    // 1. Tính toán baseline (theo ca làm việc)
    // Shift times are also Dates
    const shiftStart = shift?.start instanceof Date ? shift.start : new Date(shift.start);
    const shiftEnd = shift?.end instanceof Date ? shift.end : new Date(shift.end);

    // Tính scheduled minutes dựa trên start/end của shift (không trừ break tự động ở đây)
    const scheduled = isOff ? 0 : minutesBetween(shiftStart, shiftEnd);
    
    // Regular minutes = tối đa là (scheduled - breakMin), nhưng không vượt quá (worked - breakMin)
    const regular = isOff ? 0 : Math.min(worked - breakMin, scheduled - breakMin);
    const overtime = Math.max(0, worked - scheduled);

    // 2. Tính toán giờ làm đêm (22:00 - 05:00)
    let night = 0;
    const y = inJ.getUTCFullYear();
    const m = inJ.getUTCMonth();
    const d = inJ.getUTCDate();
    const nightWindows = [];
    // JST is UTC+9, so 22:00 JST is 13:00 UTC, 05:00 JST is 20:00 UTC (previous day or same day)
    // To simplify and match existing logic:
    for (let k = -1; k < 2; k++) { 
      const start = new Date(Date.UTC(y, m, d + k, 22 - 9, 0, 0));
      const end = new Date(Date.UTC(y, m, d + k + 1, 5 - 9, 0, 0));
      nightWindows.push({ start, end });
    }
    for (const w of nightWindows) {
      const s = inJ > w.start ? inJ : w.start;
      const e = outJ < w.end ? outJ : w.end;
      const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
      night += mins;
    }

    // 3. Xử lý ANOMALY FLAGS (Chặn rủi ro Business)
    let isAnomaly = false;
    let anomalyType = null;

    // JST date check (UTC+9)
    const inJST = new Date(inJ.getTime() + 9 * 3600 * 1000);
    const outJST = new Date(outJ.getTime() + 9 * 3600 * 1000);
    const inJSTDate = inJST.getUTCDate();
    const outJSTDate = outJST.getUTCDate();

    if (worked > 12 * 60) {
      isAnomaly = true;
      anomalyType = 'OVERWORK_GT_12H';
    } else if (inJSTDate !== outJSTDate) {
      isAnomaly = true;
      anomalyType = 'OVERNIGHT_SHIFT';
    } else if (inJST.getUTCHours() < 7) { // Trước 7:00 sáng JST
      isAnomaly = true;
      anomalyType = 'EARLY_CHECKIN';
    }

    return {
      regularMinutes: regular,
      overtimeMinutes: overtime,
      nightMinutes: night,
      isAnomaly,
      anomalyType
    };
  }
};

async function computeRecord(rec) {
  const settingsRepo = require('../settings/settings.repository');
  const userRepo = require('../users/user.repository');
  const attendanceRepo = require('./attendance.repository');
  const calendarRepo = require('../calendar/calendar.repository');
  // Tính phút công chuẩn và phút tăng ca cho một bản ghi attendance
  const cfg = await settingsRepo.getSettings().catch(() => null);
  const baseBreak = cfg?.breakMinutes || 60;
  const inDate = parseMySQLJSTToDate(rec.checkIn);
  const y = inDate.getUTCFullYear();
  const m = inDate.getUTCMonth();
  const d = inDate.getUTCDate();
  const jst = (hh, mm) => new Date(Date.UTC(y, m, d, hh - 9, mm, 0));
  let shift;
  let template = false;
  if (rec.shiftId) {
    const def = await attendanceRepo.getShiftById(rec.shiftId);
    if (def) {
      const [sH, sM] = String(def.start_time).split(':').map(n => parseInt(n, 10));
      const [eH, eM] = String(def.end_time).split(':').map(n => parseInt(n, 10));
      shift = { name: def.name, start: jst(sH, sM || 0), end: jst(eH, eM || 0), breakMinutes: def.break_minutes ?? baseBreak };
      try {
        const wt = String(rec.work_type || rec.workType || '').trim();
        const labels = String(rec.labels || '').trim();
        const inHm = String(rec.checkIn || '').slice(11, 16);
        const outHm = String(rec.checkOut || '').slice(11, 16);
        if (!wt && !labels && inHm === String(def.start_time || '').trim() && outHm === String(def.end_time || '').trim()) {
          template = true;
        }
      } catch {}
    }
  }
  if (!shift) {
    const u = await userRepo.getUserById(rec.userId).catch(() => null);
    const empType = String(u?.employment_type || 'full_time').toLowerCase();
    if (empType === 'full_time') {
      let deptNameRaw = '';
      if (u?.departmentId) {
        const dept = await userRepo.getDepartmentById(u.departmentId).catch(() => null);
        deptNameRaw = String(dept?.name || '').trim().toLowerCase();
      }
      const isConstruction = ['工事', 'kouji', 'koji', 'construction', 'engineering'].some(k => deptNameRaw.includes(k));
      const isAccounting = ['経理', 'keiri', 'accounting', 'finance'].some(k => deptNameRaw.includes(k));
      if (isConstruction) {
        shift = { name: 'day_8_17', start: jst(8, 0), end: jst(17, 0), breakMinutes: 60 };
      } else if (isAccounting) {
        shift = { name: 'day_9_17', start: jst(9, 0), end: jst(17, 0), breakMinutes: 60 };
      } else if (cfg?.workStart && cfg?.workEnd) {
        const [sH, sM] = String(cfg.workStart).split(':').map(n => parseInt(n, 10));
        const [eH, eM] = String(cfg.workEnd).split(':').map(n => parseInt(n, 10));
        shift = { name: `settings_${cfg.workStart}_${cfg.workEnd}`, start: jst(sH, sM || 0), end: jst(eH, eM || 0), breakMinutes: baseBreak };
      } else {
        shift = { name: 'day_8_17', start: jst(8, 0), end: jst(17, 0), breakMinutes: 60 };
      }
    } else {
      const inJ2 = parseMySQLJSTToDate(rec.checkIn);
      const outJ2 = parseMySQLJSTToDate(rec.checkOut);
      const worked2 = minutesBetween(inJ2, outJ2);
      const s1 = { name: 'day_8_17', start: jst(8, 0), end: jst(17, 0), breakMinutes: 60 };
      const s2 = { name: 'day_9_17', start: jst(9, 0), end: jst(17, 0), breakMinutes: 60 };
      const s3 = { name: 'part_9_14', start: jst(9, 0), end: jst(14, 0), breakMinutes: 0 };
      if (worked2 >= 7 * 60) {
        if (inJ2 <= jst(8, 30) && outJ2 >= jst(17, 0)) {
          shift = s1;
        } else if (inJ2 <= jst(9, 30) && outJ2 >= jst(16, 0)) {
          shift = s2;
        } else {
          shift = s3;
        }
      } else {
        shift = s3;
      }
    }
  }
  const breakMin = shift.breakMinutes ?? baseBreak;
  const inJ = parseMySQLJSTToDate(rec.checkIn);
  const outJ = parseMySQLJSTToDate(rec.checkOut);
  const worked = minutesBetween(inJ, outJ);
  const dateStr = rec.checkIn.split(' ')[0];
  const isOff = await calendarRepo.isOff(dateStr).catch(() => false);
  const scheduled = isOff ? 0 : Math.max(0, minutesBetween(shift.start, shift.end) - breakMin);
  const regular = Math.min(worked, scheduled);
  const overtime = Math.max(0, worked - scheduled);

  // Dùng CoreRules để lấy thêm thông tin Anomaly
  const metrics = CoreRules.calculateWorkMetrics(inJ, outJ, shift, isOff);

  return {
    id: rec.id,
    userId: rec.userId,
    date: rec.checkIn.split(' ')[0],
    checkIn: rec.checkIn,
    checkOut: rec.checkOut,
    shift: shift.name,
    template,
    regularMinutes: regular,
    overtimeMinutes: overtime,
    nightMinutes: metrics.nightMinutes,
    isAnomaly: metrics.isAnomaly,
    anomalyType: metrics.anomalyType
  };
}

async function computeRange(rows) {
  // Tổng hợp theo ngày và tổng cộng trong khoảng từ danh sách bản ghi đã chốt
  const items = [];
  for (const r of rows) {
    if (!r.checkOut) continue;
    const x = await computeRecord(r);
    if (x?.template) continue;
    items.push(x);
  }
  const byDay = {};
  for (const it of items) {
    if (!byDay[it.date]) byDay[it.date] = { date: it.date, regularMinutes: 0, overtimeMinutes: 0, nightMinutes: 0, items: [] };
    byDay[it.date].regularMinutes += it.regularMinutes;
    byDay[it.date].overtimeMinutes += it.overtimeMinutes;
    byDay[it.date].nightMinutes += it.nightMinutes;
    byDay[it.date].items.push(it);
  }
  const days = Object.values(byDay);
  const total = days.reduce((acc, d) => {
    acc.regularMinutes += d.regularMinutes;
    acc.overtimeMinutes += d.overtimeMinutes;
    acc.nightMinutes += d.nightMinutes;
    return acc;
  }, { regularMinutes: 0, overtimeMinutes: 0, nightMinutes: 0 });
  return { days, total };
}

module.exports = { computeRecord, computeRange, CoreRules };
