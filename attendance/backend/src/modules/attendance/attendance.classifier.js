const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function classifyMonthlyDay({
  date,
  kubun,
  isOnLeaveApproved,
  isPlannedOff,
  hasAttendance,
  hasCheckOut
}) {
  const d = String(date || '').slice(0, 10);
  const k = String(kubun || '').trim();
  const offKubun = new Set(['休日', '代替休日']);
  const leaveKubun = new Set(['有給休暇', '無給休暇', '欠勤']);
  const workKubun = new Set(['出勤', '半休']);

  if (!isISODate(d)) {
    return { status: 'planned', plan: 'work', kubun: null };
  }

  if (offKubun.has(k)) return { status: 'leave', plan: null, kubun: k };
  if (leaveKubun.has(k)) return { status: 'leave', plan: null, kubun: k };
  if (isOnLeaveApproved) return { status: 'leave', plan: null, kubun: k || '有給休暇' };

  if (hasAttendance) {
    if (!hasCheckOut) {
      const t = todayJST();
      if (d < t) return { status: 'leave', plan: null, kubun: '欠勤' };
      return { status: 'working', plan: null, kubun: k || '出勤' };
    }
    return { status: 'checked_out', plan: null, kubun: k || '出勤' };
  }

  if (workKubun.has(k)) return { status: 'leave', plan: null, kubun: '欠勤' };

  const plan = isPlannedOff ? 'off' : 'work';
  return { status: 'planned', plan, kubun: null };
}

module.exports = { classifyMonthlyDay };
