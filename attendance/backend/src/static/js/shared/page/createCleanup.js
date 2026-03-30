export function createCleanup() {
  const tasks = [];

  return {
    add(fn) {
      if (typeof fn === 'function') tasks.push(fn);
    },

    run() {
      for (const fn of tasks.splice(0)) {
        try { fn(); } catch { }
      }
    }
  };
}
