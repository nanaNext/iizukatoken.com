import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './attendance/backend/tests/e2e-playwright',
  timeout: 30000,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    baseURL: 'http://127.0.0.1:0'
  }
});
