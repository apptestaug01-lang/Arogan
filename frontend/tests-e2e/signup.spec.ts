import { test, expect } from '@playwright/test';

const API_BASE = 'https://loanflow-backend.onrender.com/api';
const uniqueEmail = `test.${Date.now()}@example.com`;

test.describe('Signup e2e', () => {
  test('signup creates account and triggers welcome email', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('input[id="fullName"]', 'Test User');
    await page.fill('input[id="email"]', uniqueEmail);
    await page.fill('input[id="mobile"]', '9876543210');
    await page.fill('input[id="password"]', 'Test@1234');
    await page.fill('input[id="confirmPassword"]', 'Test@1234');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/login/);

    const flash = page.locator('text=/account created successfully|check your email/i');
    await expect(flash).toBeVisible({ timeout: 15000 });
  });
});
