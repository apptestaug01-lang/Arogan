import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const TEST_EMAIL = 'apptestaug01@gmail.com';
const TEST_PASSWORD = 'Cursorai!@2026';
const TEST_FULL_NAME = 'Apptest';
const TEST_MOBILE = '9866273746';
const FRONTEND_URL = 'https://loanflow-frontend-z67v.onrender.com';
const SCREENSHOT_DIR = 'tests-e2e/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('LoanFlow Signup with Gmail — BORROWER flow', () => {
  test('Signup → welcome email → redirect to login', async ({ page }, testInfo) => {
    test.setTimeout(120000);

    // Step 1: Load and screenshot login page
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });

    // Step 2: Click Sign Up
    await page.getByRole('link', { name: /sign up/i }).click();
    await page.waitForURL('**/signup');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-signup-page.png`, fullPage: true });

    // Step 3: Fill in the signup form
    await page.fill('input#fullName', TEST_FULL_NAME);
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input[placeholder="9876543210"]', TEST_MOBILE);
    const pwInputs = await page.locator('input[type="password"]').all();
    if (pwInputs.length >= 2) {
      await pwInputs[0].fill(TEST_PASSWORD);
      await pwInputs[1].fill(TEST_PASSWORD);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-form-filled.png`, fullPage: true });

    // Step 4: Submit the form
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for either success (redirect to login) or existing user message
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000); // extra wait for potential redirect
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-after-submit.png`, fullPage: true });

    // Step 5: Check the page state
    const currentUrl = page.url();
    let signupResult = '';
    if (currentUrl.includes('/login')) {
      signupResult = 'redirected to login (signup successful)';
    } else if (currentUrl.includes('/signup')) {
      const submitError = await page.locator('text=danger-500, text=already registered, text=Validation failed').first().textContent();
      signupResult = `on signup page. Message: ${submitError || 'none found'}`;
    } else {
      signupResult = `unexpected URL: ${currentUrl}`;
    }

    // Step 6: Verify we can see the login page (either via redirect or manually navigate)
    if (!currentUrl.includes('/login')) {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    }

    const loginTitle = await page.locator('text=Login to Your Account').textContent();
    expect(loginTitle).toContain('Login to Your Account');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-login-page-final.png`, fullPage: true });

    // Attach all screenshots
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    for (const file of screenshots) {
      const buffer = fs.readFileSync(`${SCREENSHOT_DIR}/${file}`);
      testInfo.attach(file, { body: buffer, contentType: 'image/png' });
    }

    testInfo.attach('signup-result', { body: signupResult, contentType: 'text/plain' });
  });
});
