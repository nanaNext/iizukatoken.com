const app = require('./app');
try { require('./core/bootstrap').init(); } catch {}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Auto grant paid leave daily around 03:00 JST without external libs
(function initAutoGrantScheduler() {
  try {
    const userRepo = require('./modules/users/user.repository');
    const { ensureUserGrants } = require('./modules/leave/leave.controller');
    let lastRunDay = null;
    async function run() {
      try {
        const users = await userRepo.listUsers();
        for (const u of users) {
          try { await ensureUserGrants(u.id); } catch {}
        }
        lastRunDay = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        console.log('[auto-grant] completed for day', lastRunDay);
      } catch (err) {
        console.error('[auto-grant] error', err && err.message);
      }
    }
    // run at startup
    run();
    setInterval(() => {
      const jst = new Date(Date.now() + 9 * 3600 * 1000);
      const day = jst.toISOString().slice(0, 10);
      const hour = jst.getUTCHours();
      if (lastRunDay !== day && hour >= 3 && hour < 4) {
        run();
      }
    }, 15 * 60 * 1000);
  } catch (e) {
    console.error('[auto-grant] init error', e && e.message);
  }
})();

