import { listUsers } from '../../api/users.api.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

export async function mount() {
  const content = document.querySelector('#adminContent');
  if (!content) return;
  content.className = 'card';
  const p = normalizePath(window.location.pathname);
  const mod = await import('../legacy/legacy-leave.page.js');

  const mountApprovals = async (host = content, opts = {}) => {
    return mod.mountApprovals({
      host,
      content,
      opts,
      mountApprovalsFn: mountApprovals,
    });
  };

  const mountLeaveGrant = async (host = content, opts = {}) => {
    return mod.mountLeaveGrant({
      host,
      content,
      opts,
      listUsers,
      mountApprovalsFn: mountApprovals,
      mountLeaveBalanceFn: mountLeaveBalance,
    });
  };

  const mountLeaveBalance = async (host = content, opts = {}) => {
    return mod.mountLeaveBalance({
      host,
      content,
      opts,
      mountLeaveGrantFn: mountLeaveGrant,
      mountApprovalsFn: mountApprovals,
    });
  };

  if (p === '/admin/leave/balance') {
    await mountLeaveBalance(content, {});
  } else if (p === '/admin/leave/grants') {
    await mountLeaveGrant(content, {});
  } else {
    await mountApprovals(content, {});
  }
  return () => { try { content.innerHTML = ''; } catch {} };
}
