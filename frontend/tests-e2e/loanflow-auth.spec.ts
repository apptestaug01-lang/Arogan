import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FRONTEND_URL =
  process.env.E2E_FRONTEND_URL ||
  (process.env.E2E_ENV === 'render'
    ? 'https://loanflow-frontend-z67v.onrender.com'
    : 'http://localhost:5173');

const TEST_EMAIL = 'appteastloan12026@gmail.com';
const TEST_PASSWORD = 'Loanflow@123';
const TEST_FULL_NAME = 'Test Borrower';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function uniqueMobile(): string {
  const suffix = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0');
  return `9${suffix}`.slice(0, 10);
}

test.describe('LoanFlow E2E — Signup / Login / Forgot Password', () => {
  test('Signup with appteastloan12026@gmail.com and a unique mobile number', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const mobile = uniqueMobile();
    const fullName = TEST_FULL_NAME;

    await page.goto(`${FRONTEND_URL}/signup`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'signup-01-page.png'), fullPage: true });

    await page.fill('input#fullName', fullName);
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input[placeholder="9876543210"]', mobile);

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill(TEST_PASSWORD);
    await pwInputs.nth(1).fill(TEST_PASSWORD);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'signup-02-filled.png'), fullPage: true });

    await page.getByRole('button', { name: /create account/i }).click();

    // Account may already exist — a successful redirect to /login and an
    // "already registered" message are both acceptable outcomes.
    let result = '';
    try {
      await page.waitForURL(/\/login/, { timeout: 30000 });
      result = 'created -> /login';
    } catch {
      const submitError = await page
        .locator('.text-danger-500')
        .first()
        .innerText()
        .catch(() => '');
      if (/already (registered|exists)/i.test(submitError)) {
        result = 'already registered';
      } else {
        throw new Error(`Unexpected signup state. url=${page.url()} error=${submitError}`);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'signup-03-result.png'), fullPage: true });

    await testInfo.attach('signup-summary', {
      body: `email=${TEST_EMAIL}\nmobile=${mobile}\nresult=${result}`,
      contentType: 'text/plain',
    });
  });

  test('Login with appteastloan12026@gmail.com reaches the dashboard', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-01-page.png'), fullPage: true });

    await page.fill('input#identifier', TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-02-filled.png'), fullPage: true });

    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login-03-dashboard.png'), fullPage: true });
  });

  test('Forgot password sends a reset link for appteastloan12026@gmail.com', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(`${FRONTEND_URL}/forgot-password`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'forgot-01-page.png'), fullPage: true });

    await page.fill('input#email', TEST_EMAIL);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'forgot-02-filled.png'), fullPage: true });

    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'forgot-03-success.png'), fullPage: true });
  });
});
