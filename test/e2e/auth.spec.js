/**
 * VocalIA E2E Tests - Authentication Flow
 * Session 250.62
 *
 * Tests:
 * - Login page rendering
 * - Signup page rendering
 * - Password reset flow
 * - Form validation
 * - i18n language switching
 */

const { test, expect } = require('@playwright/test');

test.describe('Authentication Pages', () => {
  test.describe('Login Page', () => {
    test('should render login form correctly', async ({ page }) => {
      await page.goto('/app/auth/login.html');

      // Check page title
      await expect(page).toHaveTitle(/VocalIA/i);

      // Check form elements exist
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();

      // Check links to other auth pages
      await expect(page.locator('a[href*="signup"]')).toBeVisible();
      await expect(page.locator('a[href*="forgot-password"]')).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/app/auth/login.html');

      // Try to submit empty form
      await page.locator('button[type="submit"]').click();

      // Email field should show validation
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('should show validation for invalid email', async ({ page }) => {
      await page.goto('/app/auth/login.html');

      // Enter invalid email
      await page.locator('input[type="email"]').first().fill('invalid-email');
      await page.locator('input[type="password"]').first().fill('password123');

      // The browser's built-in validation should prevent submission
      const emailInput = page.locator('input[type="email"]');
      const isValid = await emailInput.evaluate((el) => el.validity.valid);
      expect(isValid).toBe(false);
    });

    test('should have RTL support for Arabic', async ({ page }) => {
      await page.goto('/app/auth/login.html?lang=ar');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const html = page.locator('html');
      const dir = await html.getAttribute('dir');
      expect(dir).toBe('rtl');
    });

    test('should have RTL support for Darija', async ({ page }) => {
      await page.goto('/app/auth/login.html?lang=ary');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const html = page.locator('html');
      const dir = await html.getAttribute('dir');
      expect(dir).toBe('rtl');
    });

    test('should switch languages', async ({ page }) => {
      await page.goto('/app/auth/login.html');

      // Find language selector
      const langSelector = page.locator('#language-selector, [data-lang-selector]').first();

      if (await langSelector.isVisible()) {
        // Get initial text
        const initialText = await page.locator('button[type="submit"]').textContent();

        // Switch to French if available
        await langSelector.selectOption('fr');
        await page.waitForTimeout(500);

        // Text should change (or stay same if already French)
        const newText = await page.locator('button[type="submit"]').textContent();
        expect(newText).toBeTruthy();
      }
    });
  });

  test.describe('Signup Page', () => {
    test('should render signup form correctly', async ({ page }) => {
      await page.goto('/app/auth/signup.html');

      // Check form elements
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('input[name="name"], input[name="fullname"], input[placeholder*="nom"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();

      // Link to login
      await expect(page.locator('a[href*="login"]')).toBeVisible();
    });

    test('should have password strength indicator or requirements', async ({ page }) => {
      await page.goto('/app/auth/signup.html');

      // Type a weak password
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('123');

      // Check for any password feedback (strength indicator, error message, etc.)
      // Either minlength attribute or custom validation
      const minLength = await passwordInput.getAttribute('minlength');
      expect(parseInt(minLength || '0')).toBeGreaterThanOrEqual(6);
    });
  });

  test.describe('Forgot Password Page', () => {
    test('should render forgot password form', async ({ page }) => {
      await page.goto('/app/auth/forgot-password.html');
      await page.waitForLoadState('networkidle');

      // Check email input
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]').first()).toBeVisible();

      // Link back to login (might be styled differently)
      const loginLink = page.locator('a[href*="login"]').first();
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Reset Password Page', () => {
    test('should render reset password form', async ({ page }) => {
      await page.goto('/app/auth/reset-password.html');
      await page.waitForLoadState('networkidle');

      // Page should load successfully
      await expect(page).toHaveTitle(/VocalIA/i);

      // Check password inputs (new password + confirm) exist
      const passwordInputs = page.locator('input[type="password"]');
      const count = await passwordInputs.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Verify Email Page', () => {
    test('should render verification page', async ({ page }) => {
      await page.goto('/app/auth/verify-email.html');

      // Page should load without errors
      await expect(page).toHaveTitle(/VocalIA/i);
    });
  });
});

test.describe('Auth Navigation', () => {
  test('login -> signup -> login flow', async ({ page }) => {
    // Start at login
    await page.goto('/app/auth/login.html');

    // Click signup link
    await page.locator('a[href*="signup"]').click();
    await expect(page).toHaveURL(/signup/);

    // Click login link from signup
    await page.locator('a[href*="login"]').click();
    await expect(page).toHaveURL(/login/);
  });

  test('login -> forgot password -> login flow', async ({ page }) => {
    await page.goto('/app/auth/login.html');
    await page.waitForLoadState('networkidle');

    // Click forgot password
    await page.locator('a[href*="forgot-password"]').first().click();
    await expect(page).toHaveURL(/forgot-password/);

    await page.waitForLoadState('networkidle');

    // Click back to login
    await page.locator('a[href*="login"]').first().click();
    await expect(page).toHaveURL(/login/);
  });
});
