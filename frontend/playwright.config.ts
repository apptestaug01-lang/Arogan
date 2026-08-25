import { defineConfig } from '@playwright/test';

const env = process.env.E2E_ENV || 'local';

const configs = {
  local: {
    frontendUrl: 'http://localhost:5173',
    apiBase: 'http://localhost:4000/api',
  },
  render: {
    frontendUrl: 'https://loanflow-frontend.onrender.com',
    apiBase: 'https://loanflow-backend.onrender.com/api',
  },
};

const config = configs[env] || configs.local;

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60000,
  use: {
    headless: true,
    screenshot: 'on',
    video: 'retain-on-failure',
    baseURL: config.frontendUrl,
    trace: 'on',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
});
