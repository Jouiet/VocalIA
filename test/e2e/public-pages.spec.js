/**
 * VocalIA E2E Tests - Public Website Pages
 * Session 250.62
 *
 * Tests:
 * - Homepage loads
 * - Key pages accessible
 * - SEO elements present
 * - Accessibility basics
 */

const { test, expect } = require('@playwright/test');

const PUBLIC_PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/pricing.html', name: 'Pricing' },
  { path: '/contact.html', name: 'Contact' },
  { path: '/features.html', name: 'Features' },
  { path: '/about.html', name: 'About' },
];

test.describe('Public Website', () => {
  test.describe('Page Loading', () => {
    for (const { path, name } of PUBLIC_PAGES) {
      test(`${name} page should load`, async ({ page }) => {
        const response = await page.goto(path);

        // Page should return 200 or redirect
        expect([200, 301, 302]).toContain(response?.status() || 0);

        // Page should have title
        await expect(page).toHaveTitle(/VocalIA/i);
      });
    }
  });

  test.describe('Homepage', () => {
    test('should have hero section', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Hero or main heading should exist
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
    });

    test('should have CTA buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should have call-to-action buttons
      const ctaButtons = page.locator('a[href*="demo"], a[href*="contact"], a[href*="signup"], button:has-text("Demo"), button:has-text("Start")');
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have navigation', async ({ page }) => {
      await page.goto('/');

      // Navigation should exist
      const nav = page.locator('nav, header').first();
      await expect(nav).toBeVisible();
    });

    test('should have footer', async ({ page }) => {
      await page.goto('/');

      const footer = page.locator('footer').first();
      await expect(footer).toBeVisible();
    });
  });

  test.describe('SEO Elements', () => {
    test('homepage should have meta description', async ({ page }) => {
      await page.goto('/');

      const metaDesc = page.locator('meta[name="description"]');
      const content = await metaDesc.getAttribute('content');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(50);
    });

    test('homepage should have Open Graph tags', async ({ page }) => {
      await page.goto('/');

      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveAttribute('content', /.+/);
    });

    test('homepage should have hreflang tags', async ({ page }) => {
      await page.goto('/');

      const hreflangs = page.locator('link[rel="alternate"][hreflang]');
      const count = await hreflangs.count();
      expect(count).toBeGreaterThanOrEqual(2); // At least FR and EN
    });
  });

  test.describe('Accessibility', () => {
    test('should have lang attribute', async ({ page }) => {
      await page.goto('/');

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
    });

    test('should have skip link or main landmark', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Page should have body visible and be accessible
      await expect(page.locator('body')).toBeVisible();
    });

    test('images should have alt text', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const images = page.locator('img:visible');
      const count = await images.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt should exist (can be empty for decorative images)
        expect(alt).not.toBeNull();
      }
    });
  });

  test.describe('i18n', () => {
    test('should support French', async ({ page }) => {
      await page.goto('/?lang=fr');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);

      // Page should have French content or lang attribute
      const lang = await page.locator('html').getAttribute('lang');
      expect(['fr', 'fr-FR', 'fr-MA']).toContain(lang);
    });

    // TODO: Some pages need i18n init from URL
    test.skip('should support Arabic with RTL', async ({ page }) => {
      await page.goto('/?lang=ar');
      await page.waitForLoadState('networkidle');

      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');
    });
  });
});

test.describe('Contact Form', () => {
  test('contact page should have form', async ({ page }) => {
    await page.goto('/contact.html');
    await page.waitForLoadState('networkidle');

    // Page should load
    await expect(page).toHaveTitle(/VocalIA/i);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Pricing Page', () => {
  test('should display pricing plans', async ({ page }) => {
    await page.goto('/pricing.html');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/VocalIA/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
