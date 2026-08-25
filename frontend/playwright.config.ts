import { defineConfig, test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'https://loanflow-frontend-z67v.onrender.com';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60000,
  use: {
    headless: true,
    screenshot: 'on',
    video: 'retain-on-failure',
    baseURL: FRONTEND_URL,
    trace: 'on',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
});
