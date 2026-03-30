export function createPage({ mount }) {
  let cleanup = () => {};

  return {
    async mount(ctx) {
      cleanup();
      const result = await mount(ctx);
      cleanup = typeof result === 'function' ? result : () => {};
    },

    unmount() {
      cleanup();
      cleanup = () => {};
    }
  };
}
