
function calculatePaidLeaveEntitlement(joinDateStr) {
  if (!joinDateStr) return 0;
  const normalized = String(joinDateStr).replace(/\//g, '-').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return 0;
  const joinDate = new Date(normalized + 'T00:00:00Z');
  if (!Number.isFinite(joinDate.getTime())) return 0;
  const now = new Date();
  if (joinDate > now) return 0;
  
  // Calculate months of service
  const diffTime = now - joinDate;
  const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  
  if (diffMonths < 6) return 0;
  if (diffMonths < 18) return 10;
  if (diffMonths < 30) return 11;
  if (diffMonths < 42) return 12;
  if (diffMonths < 54) return 14;
  if (diffMonths < 66) return 16;
  if (diffMonths < 78) return 18;
  return 20;
}

module.exports = { calculatePaidLeaveEntitlement };
