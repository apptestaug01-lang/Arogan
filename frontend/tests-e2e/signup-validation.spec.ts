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

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-validation');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const shot = async (page: import('@playwright/test').Page, name: string) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: true });
};

test.describe('LoanFlow Signup — UI field validation (slow)', () => {
  test('validates every field before allowing account creation', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto(`${FRONTEND_URL}/signup`, { waitUntil: 'networkidle', timeout: 60000 });
    // Disable native HTML constraint validation so the app's own React
    // field-level messages are what gets exercised and recorded.
    await page.locator('form').first().evaluate((f) => f.setAttribute('novalidate', ''));
    await shot(page, '01-initial.png');

    const submit = page.getByRole('button', { name: /create account/i });
    const fullName = page.locator('input#fullName');
    const email = page.locator('input#email');
    const validEmail = `loanflow.val.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
    const validMobile = `9${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`.slice(0, 10);
    const mobile = page.locator('input[placeholder="9876543210"]');
    const pwInputs = page.locator('input[type="password"]');
    const password = pwInputs.nth(0);
    const confirm = pwInputs.nth(1);

    // 1) Submit empty form -> required-field errors
    await submit.click();
    await expect(page.locator('.text-danger-500').first()).toBeVisible();
    await shot(page, '02-empty-required.png');

    // 2) Full name too short
    await fullName.fill('A');
    await fullName.blur();
    await submit.click();
    await expect(page.getByText(/full name must be at least 2 characters/i)).toBeVisible();
    await shot(page, '03-name-too-short.png');
    await fullName.fill('Test Borrower');

    // 3) Invalid email format
    await email.fill('not-an-email');
    await email.blur();
    await submit.click();
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
    await shot(page, '04-invalid-email.png');
    await email.fill(validEmail);

    // 4) Invalid mobile number (must be 10 digits starting 6-9)
    await mobile.fill('12345');
    await mobile.blur();
    await submit.click();
    await expect(page.getByText(/must be a valid 10-digit indian mobile number/i)).toBeVisible();
    await shot(page, '05-invalid-mobile.png');
    await mobile.fill(validMobile);

    // 5) Weak password
    await password.fill('abc');
    await confirm.fill('abc');
    await submit.click();
    await expect(page.getByText(/password does not meet all strength requirements/i)).toBeVisible();
    await shot(page, '06-weak-password.png');

    // 6) Strong password but mismatch
    await password.fill('Loanflow@123');
    await confirm.fill('Loanflow@124');
    await submit.click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    await shot(page, '07-password-mismatch.png');

    // 7) All valid -> successful submit and redirect to login
    await confirm.fill('Loanflow@123');
    await shot(page, '08-all-valid.png');
    await submit.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
    await shot(page, '09-success-redirect.png');
  });
});
