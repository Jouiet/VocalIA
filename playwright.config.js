/**
 * Playwright E2E Test Configuration
 * VocalIA - Session 250.75
 *
 * REAL PRODUCTION TESTING against https://vocalia.ma
 * No mocks, no stubs, no localhost - REAL PRODUCTION
 *
 * Run tests: npx playwright test
 * Run with UI: npx playwright test --ui
 * Run specific file: npx playwright test test/e2e/auth.spec.js
 *
 * Override base URL: BASE_URL=http://localhost:8080 npx playwright test
 */

const { defineConfig, devices } = require('@playwright/test');

// Production by default, localhost for local development
const BASE_URL = process.env.BASE_URL || 'https://vocalia.ma';

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // No webServer needed - testing against LIVE production
  // For local testing: BASE_URL=http://localhost:8080 npx playwright test
});
