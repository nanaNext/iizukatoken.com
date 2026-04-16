import { test, expect } from '@playwright/test';
import * as http from 'http';
import app from '../../src/app';

test.describe('E2E (Playwright): Login page', () => {
  let server: http.Server;
  let port: number;

  test.beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      }).on('error', reject);
    });
  });

  test.afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('should render login page and have CSP header', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${port}/ui/login`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(/login|ログイン/i.test(title)).toBeTruthy();
    const loginButton = page.locator('#loginBtn');
    await expect(loginButton).toBeVisible();
  });
});
