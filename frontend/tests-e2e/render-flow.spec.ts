import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_EMAIL = 'cursorai981@gmail.com';
const TEST_PASSWORD = 'Cursorai!@2026';
const TEST_FULL_NAME = 'Cursor AI';
const TEST_MOBILE = '9866273746';
const FRONTEND_URL = 'https://loanflow-frontend-z67v.onrender.com';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('LoanFlow E2E — Signup → Login → Forgot Password (Render)', () => {
  test('full auth flow on production', async ({ page }, testInfo) => {
    test.setTimeout(180000);

    // Step 1: Navigate to login page
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });

    // Step 2: Go to signup
    await page.getByRole('link', { name: /sign up/i }).click();
    await page.waitForURL('**/signup');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-signup-page.png'), fullPage: true });

    // Step 3: Fill signup form
    await page.fill('input#fullName', TEST_FULL_NAME);
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input[placeholder="9876543210"]', TEST_MOBILE);
    const pwInputs = await page.locator('input[type="password"]').all();
    if (pwInputs.length >= 2) {
      await pwInputs[0].fill(TEST_PASSWORD);
      await pwInputs[1].fill(TEST_PASSWORD);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-form-filled.png'), fullPage: true });

    // Step 4: Submit signup
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-after-signup.png'), fullPage: true });

    // Step 5: Verify redirect to login or handle existing user
    const currentUrl = page.url();
    let signupResult = '';
    if (currentUrl.includes('/login')) {
      signupResult = 'redirected to login (signup successful)';
    } else if (currentUrl.includes('/signup')) {
      const submitError = await page.locator('text=already registered, text=Validation failed, .text-danger-500').first().textContent();
      signupResult = `on signup page. Message: ${submitError || 'none found'}`;
    } else {
      signupResult = `unexpected URL: ${currentUrl}`;
    }

    // Step 6: Navigate to login if not already there
    if (!currentUrl.includes('/login')) {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    }

    const loginTitle = await page.locator('text=Login to Your Account').textContent();
    expect(loginTitle).toContain('Login to Your Account');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-login-page.png'), fullPage: true });

    // Step 7: Login with password
    await page.fill('input#identifier', TEST_EMAIL);
    const loginPwInputs = await page.locator('input[type="password"]').all();
    if (loginPwInputs.length > 0) {
      await loginPwInputs[0].fill(TEST_PASSWORD);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-login-filled.png'), fullPage: true });

    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-after-login.png'), fullPage: true });

    // Step 8: Verify dashboard
    const dashboardUrl = page.url();
    expect(dashboardUrl).toContain('/dashboard');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-dashboard.png'), fullPage: true });

    // Step 9: Navigate to forgot password
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-forgot-password-page.png'), fullPage: true });

    // Step 10: Submit forgot password
    await page.fill('input#email', TEST_EMAIL);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-forgot-filled.png'), fullPage: true });

    await page.getByRole('button', { name: /send reset link/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-forgot-submitted.png'), fullPage: true });

    // Step 11: Verify success message
    const successMsg = await page.locator('text=Check Your Email').first().textContent();
    expect(successMsg).toContain('Check Your Email');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-forgot-success.png'), fullPage: true });

    // Attach all screenshots
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    for (const file of screenshots) {
      const buffer = fs.readFileSync(path.join(SCREENSHOT_DIR, file));
      testInfo.attach(file, { body: buffer, contentType: 'image/png' });
    }

    testInfo.attach('signup-result', { body: signupResult, contentType: 'text/plain' });
  });
});
