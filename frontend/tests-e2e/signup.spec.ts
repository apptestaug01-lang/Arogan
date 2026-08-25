import { test, expect } from '@playwright/test';

const API_BASE = 'https://loanflow-backend.onrender.com/api';
const uniqueEmail = `test.${Date.now()}@example.com`;

test.describe('Signup e2e', () => {
  test('signup creates account and triggers welcome email', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('input[id="fullName"]', 'Test User');
    await page.fill('input[id="email"]', uniqueEmail);
    await page.fill('input[placeholder="9876543210"]', '9876543210');
    await page.fill('input[placeholder="Min 8 chars with upper, lower, number, special"]', 'Test@1234');
    await page.fill('input[placeholder="Re-enter your password"]', 'Test@1234');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/login/);

    const flash = page.locator('text=/account created successfully|check your email/i');
    await expect(flash).toBeVisible({ timeout: 15000 });
  });
});
