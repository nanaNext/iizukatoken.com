
function calculatePaidLeaveEntitlement(joinDateStr) {
  if (!joinDateStr) return 0;
  const joinDate = new Date(joinDateStr + 'T00:00:00Z');
  const now = new Date();
  
  // Calculate months of service
  const diffTime = Math.abs(now - joinDate);
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
