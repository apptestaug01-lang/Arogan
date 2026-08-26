import { defineConfig } from '@playwright/test';

const env = process.env.E2E_ENV || 'local';

const configs = {
  local: {
    frontendUrl: 'http://localhost:5173',
  },
  render: {
    frontendUrl: 'https://loanflow-frontend-z67v.onrender.com',
  },
};

const config = configs[env] || configs.local;

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 120000,
  use: {
    headless: true,
    screenshot: 'on',
    video: 'on',
    baseURL: config.frontendUrl,
    trace: 'on',
    viewport: { width: 1280, height: 720 },
  },
  // Slow everything down so each UI validation is clearly visible in the recording.
  launchOptions: {
    slowMo: 700,
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report-slow', open: 'never' }],
    ['list'],
  ],
});
