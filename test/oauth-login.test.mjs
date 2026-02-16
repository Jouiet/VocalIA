/**
 * OAuth SSO Login Integration Tests
 *
 * Tests the REAL loginWithOAuth function from auth-service.cjs
 * and the OAuth provider config from OAuthGateway.cjs.
 *
 * These tests verify:
 * 1. loginWithOAuth creates new users for first-time OAuth login
 * 2. loginWithOAuth returns valid JWT tokens
 * 3. loginWithOAuth links existing users by email
 * 4. loginWithOAuth auto-verifies email
 * 5. GitHub provider config exists with correct URLs
 * 6. Google provider has login scopes
 * 7. OAuthGateway login URL generation works
 * 8. Tenant provisioning for new OAuth users
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Load REAL modules
const authService = require('../core/auth-service.cjs');
const { getDB } = require('../core/GoogleSheetsDB.cjs');
const { OAUTH_PROVIDERS, OAuthGateway } = require('../core/OAuthGateway.cjs');
const { provisionTenant, generateTenantIdFromCompany } = require('../core/db-api.cjs');

// Initialize auth-service with REAL database INSTANCE (same as db-api.cjs does)
authService.init(getDB());

// Test data
const TEST_EMAIL_NEW = `oauth_test_new_${Date.now()}@test.com`;
const TEST_EMAIL_EXISTING = `oauth_test_existing_${Date.now()}@test.com`;
const TEST_CLEANUP = [];

after(() => {
  // Cleanup test data
  for (const dir of TEST_CLEANUP) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

describe('OAuth Provider Configuration', () => {
  it('should have GitHub provider with correct config', () => {
    assert.ok(OAUTH_PROVIDERS.github, 'GitHub provider missing');
    assert.strictEqual(OAUTH_PROVIDERS.github.name, 'GitHub');
    assert.strictEqual(OAUTH_PROVIDERS.github.authUrl, 'https://github.com/login/oauth/authorize');
    assert.strictEqual(OAUTH_PROVIDERS.github.tokenUrl, 'https://github.com/login/oauth/access_token');
    assert.ok(OAUTH_PROVIDERS.github.loginScopes, 'GitHub loginScopes missing');
    assert.ok(OAUTH_PROVIDERS.github.loginScopes.includes('read:user'), 'Missing read:user scope');
    assert.ok(OAUTH_PROVIDERS.github.loginScopes.includes('user:email'), 'Missing user:email scope');
    assert.strictEqual(OAUTH_PROVIDERS.github.profileUrl, 'https://api.github.com/user');
    assert.strictEqual(OAUTH_PROVIDERS.github.emailsUrl, 'https://api.github.com/user/emails');
    assert.strictEqual(OAUTH_PROVIDERS.github.clientIdEnv, 'GITHUB_CLIENT_ID');
    assert.strictEqual(OAUTH_PROVIDERS.github.clientSecretEnv, 'GITHUB_CLIENT_SECRET');
  });

  it('should have Google provider with login scopes', () => {
    assert.ok(OAUTH_PROVIDERS.google, 'Google provider missing');
    assert.ok(OAUTH_PROVIDERS.google.loginScopes, 'Google loginScopes missing');
    assert.ok(OAUTH_PROVIDERS.google.loginScopes.includes('openid'), 'Missing openid scope');
    assert.ok(OAUTH_PROVIDERS.google.loginScopes.includes('email'), 'Missing email scope');
    assert.ok(OAUTH_PROVIDERS.google.loginScopes.includes('profile'), 'Missing profile scope');
    assert.strictEqual(OAUTH_PROVIDERS.google.profileUrl, 'https://www.googleapis.com/oauth2/v2/userinfo');
  });

  it('should have 6 total providers (google, github, hubspot, shopify, slack)', () => {
    const keys = Object.keys(OAUTH_PROVIDERS);
    assert.ok(keys.includes('google'));
    assert.ok(keys.includes('github'));
    assert.ok(keys.includes('hubspot'));
    assert.ok(keys.includes('shopify'));
    assert.ok(keys.includes('slack'));
  });

  it('should support login for google, github and slack', () => {
    for (const [key, config] of Object.entries(OAUTH_PROVIDERS)) {
      if (key === 'google' || key === 'github' || key === 'slack') {
        assert.ok(config.loginScopes, `${key} should have loginScopes`);
        assert.ok(config.profileUrl, `${key} should have profileUrl`);
      }
    }
  });

  it('should have Slack provider with correct OIDC config', () => {
    assert.ok(OAUTH_PROVIDERS.slack, 'Slack provider missing');
    assert.strictEqual(OAUTH_PROVIDERS.slack.name, 'Slack');
    assert.strictEqual(OAUTH_PROVIDERS.slack.loginAuthUrl, 'https://slack.com/openid/connect/authorize');
    assert.strictEqual(OAUTH_PROVIDERS.slack.loginTokenUrl, 'https://slack.com/api/openid.connect.token');
    assert.strictEqual(OAUTH_PROVIDERS.slack.profileUrl, 'https://slack.com/api/openid.connect.userInfo');
    assert.strictEqual(OAUTH_PROVIDERS.slack.loginScopes, 'openid email profile');
    assert.strictEqual(OAUTH_PROVIDERS.slack.clientIdEnv, 'SLACK_CLIENT_ID');
    assert.strictEqual(OAUTH_PROVIDERS.slack.clientSecretEnv, 'SLACK_CLIENT_SECRET');
  });

  it('should have Slack bot scopes for integration', () => {
    assert.ok(OAUTH_PROVIDERS.slack.scopes.default.includes('chat:write'));
    assert.ok(OAUTH_PROVIDERS.slack.scopes.default.includes('im:history'));
    assert.ok(OAUTH_PROVIDERS.slack.scopes.default.includes('app_mentions:read'));
  });
});

describe('OAuthGateway Login URL Generation', () => {
  it('should throw if provider not found', () => {
    const gw = new OAuthGateway({ baseUrl: 'http://localhost:3010' });
    assert.throws(
      () => gw.getLoginAuthUrl('nonexistent'),
      /Unknown OAuth provider/
    );
  });

  it('should throw if login not supported for provider', () => {
    // Temporarily remove loginScopes from hubspot
    const original = OAUTH_PROVIDERS.hubspot.loginScopes;
    delete OAUTH_PROVIDERS.hubspot.loginScopes;
    const gw = new OAuthGateway({ baseUrl: 'http://localhost:3010' });
    assert.throws(
      () => gw.getLoginAuthUrl('hubspot'),
      /does not support login/
    );
    // Restore
    if (original) OAUTH_PROVIDERS.hubspot.loginScopes = original;
  });

  it('should throw if credentials missing', () => {
    const gw = new OAuthGateway({ baseUrl: 'http://localhost:3010' });
    // GitHub credentials not set in test env
    assert.throws(
      () => gw.getLoginAuthUrl('github'),
      /Missing GITHUB_CLIENT_ID/
    );
  });

  it('should generate valid Google login URL when credentials present', () => {
    // Temporarily set fake credentials for URL generation test
    const origId = process.env.GOOGLE_CLIENT_ID;
    const origSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

    try {
      const gw = new OAuthGateway({ baseUrl: 'https://api.vocalia.ma' });
      const url = gw.getLoginAuthUrl('google');
      assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
      assert.ok(url.includes('client_id=test-client-id'));
      assert.ok(url.includes('scope=openid+email+profile') || url.includes('scope=openid%20email%20profile'));
      assert.ok(url.includes('redirect_uri='));
      // redirect_uri is URL-encoded in query params
      const urlObj = new URL(url);
      const redirectUri = urlObj.searchParams.get('redirect_uri');
      assert.ok(redirectUri.includes('/oauth/login/callback/google'), `redirect_uri should contain login callback path, got: ${redirectUri}`);
      assert.ok(url.includes('prompt=select_account'));
      assert.ok(url.includes('state='));
    } finally {
      if (origId) process.env.GOOGLE_CLIENT_ID = origId; else delete process.env.GOOGLE_CLIENT_ID;
      if (origSecret) process.env.GOOGLE_CLIENT_SECRET = origSecret; else delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  it('should generate valid GitHub login URL when credentials present', () => {
    const origId = process.env.GITHUB_CLIENT_ID;
    const origSecret = process.env.GITHUB_CLIENT_SECRET;
    process.env.GITHUB_CLIENT_ID = 'test-gh-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-gh-secret';

    try {
      const gw = new OAuthGateway({ baseUrl: 'https://api.vocalia.ma' });
      const url = gw.getLoginAuthUrl('github');
      assert.ok(url.startsWith('https://github.com/login/oauth/authorize'));
      assert.ok(url.includes('client_id=test-gh-client-id'));
      assert.ok(url.includes('redirect_uri='));
      const urlObj = new URL(url);
      const redirectUri = urlObj.searchParams.get('redirect_uri');
      assert.ok(redirectUri.includes('/oauth/login/callback/github'), `redirect_uri should contain login callback path, got: ${redirectUri}`);
      assert.ok(url.includes('state='));
      // GitHub should NOT have prompt=select_account
      assert.ok(!url.includes('prompt='));
    } finally {
      if (origId) process.env.GITHUB_CLIENT_ID = origId; else delete process.env.GITHUB_CLIENT_ID;
      if (origSecret) process.env.GITHUB_CLIENT_SECRET = origSecret; else delete process.env.GITHUB_CLIENT_SECRET;
    }
  });
});

describe('OAuthGateway Slack Login URL Generation', () => {
  it('should generate valid Slack OIDC login URL', () => {
    const origId = process.env.SLACK_CLIENT_ID;
    const origSecret = process.env.SLACK_CLIENT_SECRET;
    process.env.SLACK_CLIENT_ID = 'test-slack-client';
    process.env.SLACK_CLIENT_SECRET = 'test-slack-secret';

    try {
      const gw = new OAuthGateway({ baseUrl: 'https://api.vocalia.ma' });
      const url = gw.getLoginAuthUrl('slack');
      // MUST use OIDC endpoint
      assert.ok(url.startsWith('https://slack.com/openid/connect/authorize'),
        `Expected OIDC URL but got: ${url.substring(0, 60)}`);
      assert.ok(url.includes('client_id=test-slack-client'));
      const urlObj = new URL(url);
      const scope = urlObj.searchParams.get('scope');
      assert.ok(scope.includes('openid'));
      assert.ok(scope.includes('email'));
      assert.ok(scope.includes('profile'));
      const redirectUri = urlObj.searchParams.get('redirect_uri');
      assert.ok(redirectUri.includes('/oauth/login/callback/slack'));
      assert.ok(url.includes('state='));
      // Slack should NOT have prompt=select_account (that's Google-only)
      assert.ok(!url.includes('prompt='));
    } finally {
      if (origId) process.env.SLACK_CLIENT_ID = origId; else delete process.env.SLACK_CLIENT_ID;
      if (origSecret) process.env.SLACK_CLIENT_SECRET = origSecret; else delete process.env.SLACK_CLIENT_SECRET;
    }
  });
});

describe('loginWithOAuth - New User', () => {
  let result;

  it('should create a new user and return valid tokens', async () => {
    result = await authService.loginWithOAuth({
      email: TEST_EMAIL_NEW,
      name: 'Test OAuth User',
      provider: 'github',
      providerId: 'gh_12345'
    });

    assert.ok(result, 'Result should exist');
    assert.ok(result.access_token, 'Should have access_token');
    assert.ok(result.refresh_token, 'Should have refresh_token');
    assert.strictEqual(result.token_type, 'Bearer');
    assert.strictEqual(result.expires_in, 86400);
  });

  it('should return correct user info', () => {
    assert.ok(result.user, 'Should have user object');
    assert.strictEqual(result.user.email, TEST_EMAIL_NEW.toLowerCase());
    assert.strictEqual(result.user.name, 'Test OAuth User');
    assert.strictEqual(result.user.role, 'user');
    assert.strictEqual(result.user.email_verified, true);
  });

  it('should include linked_providers array with the provider (B21 fix)', () => {
    assert.ok(Array.isArray(result.user.linked_providers), 'linked_providers should be an array');
    assert.ok(result.user.linked_providers.includes('github'), 'Should include github');
  });

  it('should produce a valid JWT access token', () => {
    const decoded = authService.verifyToken(result.access_token);
    assert.strictEqual(decoded.email, TEST_EMAIL_NEW.toLowerCase());
    assert.strictEqual(decoded.role, 'user');
    assert.ok(decoded.sub, 'JWT should have sub claim');
  });
});

describe('loginWithOAuth - Existing User (account linking)', () => {
  let firstResult, secondResult;

  before(async () => {
    // First login creates the user
    firstResult = await authService.loginWithOAuth({
      email: TEST_EMAIL_EXISTING,
      name: 'First Login',
      provider: 'google',
      providerId: 'google_99'
    });
  });

  it('should reuse existing user on second OAuth login', async () => {
    secondResult = await authService.loginWithOAuth({
      email: TEST_EMAIL_EXISTING,
      name: 'Second Login',
      provider: 'github',
      providerId: 'gh_99'
    });

    assert.ok(secondResult.access_token);
    assert.strictEqual(secondResult.user.email, TEST_EMAIL_EXISTING.toLowerCase());
    // User ID should be the SAME (same account)
    assert.strictEqual(secondResult.user.id, firstResult.user.id);
  });

  it('should generate different tokens on each login', () => {
    assert.notStrictEqual(firstResult.access_token, secondResult.access_token);
    assert.notStrictEqual(firstResult.refresh_token, secondResult.refresh_token);
  });

  it('should accumulate both providers in linked_providers (B21 fix)', () => {
    assert.ok(Array.isArray(secondResult.user.linked_providers), 'linked_providers should be an array');
    assert.ok(secondResult.user.linked_providers.includes('google'), 'Should include google (first login)');
    assert.ok(secondResult.user.linked_providers.includes('github'), 'Should include github (second login)');
    assert.strictEqual(secondResult.user.linked_providers.length, 2, 'Should have exactly 2 providers');
  });
});

describe('loginWithOAuth - Validation', () => {
  it('should reject invalid email', async () => {
    await assert.rejects(
      authService.loginWithOAuth({
        email: 'not-an-email',
        name: 'Test',
        provider: 'github',
        providerId: 'gh_bad'
      }),
      /Invalid email/
    );
  });
});

describe('OAuth + Tenant Provisioning', () => {
  it('should provision a tenant for new OAuth user', () => {
    const tenantId = generateTenantIdFromCompany('OAuth Test Corp');
    const result = provisionTenant(tenantId, {
      plan: 'starter',
      company: 'OAuth Test Corp',
      email: 'oauth@test.com'
    });

    assert.ok(result.success, 'Provisioning should succeed');
    assert.ok(result.configPath, 'Should have configPath');

    // Verify config.json exists
    assert.ok(fs.existsSync(result.configPath), 'config.json should exist');

    const config = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
    assert.strictEqual(config.plan, 'starter');
    assert.strictEqual(config.status, 'active');
    assert.strictEqual(config.contact.email, 'oauth@test.com');
    assert.ok(config.features.voice_widget);

    // Cleanup
    const clientDir = path.dirname(result.configPath);
    TEST_CLEANUP.push(clientDir);
  });
});

// ─── B27 regression: Both login pages MUST have all 3 SSO buttons ────────

describe('B27 regression — Login pages SSO buttons', () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');

  const loginPages = [
    { name: 'app/auth/login.html', path: join(process.cwd(), 'website', 'app', 'auth', 'login.html') },
    { name: 'login.html (root)',   path: join(process.cwd(), 'website', 'login.html') }
  ];

  for (const page of loginPages) {
    it(`${page.name} has google-login button`, () => {
      const html = readFileSync(page.path, 'utf8');
      assert.ok(html.includes('id="google-login"'), `B27 regression: ${page.name} MUST have google-login button`);
    });

    it(`${page.name} has github-login button`, () => {
      const html = readFileSync(page.path, 'utf8');
      assert.ok(html.includes('id="github-login"'), `B27 regression: ${page.name} MUST have github-login button`);
    });

    it(`${page.name} has slack-login button`, () => {
      const html = readFileSync(page.path, 'utf8');
      assert.ok(html.includes('id="slack-login"'), `B27 regression: ${page.name} MUST have slack-login button`);
    });
  }
});
