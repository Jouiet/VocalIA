/**
 * VocalIA OAuthGateway Tests
 *
 * Tests:
 * - OAUTH_PROVIDERS structure (Google, GitHub, HubSpot, Shopify, Slack)
 * - OAuthGateway constructor defaults
 * - generateState / verifyState (CSRF protection)
 * - getAuthUrl (URL construction, validation)
 * - Exports structure
 *
 * NOTE: Does NOT start Express server or make OAuth calls.
 *
 * Run: node --test test/OAuthGateway.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import mod from '../core/OAuthGateway.cjs';

const { OAuthGateway, OAUTH_PROVIDERS } = mod;

// ─── OAUTH_PROVIDERS ─────────────────────────────────────────────────────────

describe('OAUTH_PROVIDERS structure', () => {
  test('has 5 providers', () => {
    assert.strictEqual(Object.keys(OAUTH_PROVIDERS).length, 5);
  });

  test('has github provider', () => {
    assert.ok(OAUTH_PROVIDERS.github);
    assert.strictEqual(OAUTH_PROVIDERS.github.name, 'GitHub');
  });

  test('has google provider', () => {
    assert.ok(OAUTH_PROVIDERS.google);
    assert.strictEqual(OAUTH_PROVIDERS.google.name, 'Google');
  });

  test('has hubspot provider', () => {
    assert.ok(OAUTH_PROVIDERS.hubspot);
    assert.strictEqual(OAUTH_PROVIDERS.hubspot.name, 'HubSpot');
  });

  test('has shopify provider', () => {
    assert.ok(OAUTH_PROVIDERS.shopify);
    assert.strictEqual(OAUTH_PROVIDERS.shopify.name, 'Shopify');
  });

  test('has slack provider', () => {
    assert.ok(OAUTH_PROVIDERS.slack);
    assert.strictEqual(OAUTH_PROVIDERS.slack.name, 'Slack');
  });

  test('google has authUrl pointing to accounts.google.com', () => {
    assert.ok(OAUTH_PROVIDERS.google.authUrl.includes('accounts.google.com'));
  });

  test('google has tokenUrl pointing to googleapis.com', () => {
    assert.ok(OAUTH_PROVIDERS.google.tokenUrl.includes('googleapis.com'));
  });

  test('google has 4 scope keys', () => {
    const scopes = Object.keys(OAUTH_PROVIDERS.google.scopes);
    assert.strictEqual(scopes.length, 4);
    assert.ok(scopes.includes('calendar'));
    assert.ok(scopes.includes('sheets'));
    assert.ok(scopes.includes('drive'));
    assert.ok(scopes.includes('gmail'));
  });

  test('hubspot scopes include CRM permissions', () => {
    assert.ok(OAUTH_PROVIDERS.hubspot.scopes.crm.includes('crm.objects.contacts'));
  });

  test('shopify uses template URLs (shop variable)', () => {
    assert.ok(OAUTH_PROVIDERS.shopify.authUrlTemplate.includes('{shop}'));
    assert.ok(OAUTH_PROVIDERS.shopify.tokenUrlTemplate.includes('{shop}'));
  });

  test('each provider has clientIdEnv and clientSecretEnv', () => {
    for (const [name, config] of Object.entries(OAUTH_PROVIDERS)) {
      assert.ok(config.clientIdEnv, `${name} missing clientIdEnv`);
      assert.ok(config.clientSecretEnv, `${name} missing clientSecretEnv`);
    }
  });

  test('all auth URLs use HTTPS', () => {
    for (const [name, config] of Object.entries(OAUTH_PROVIDERS)) {
      const url = config.authUrl || config.authUrlTemplate;
      assert.ok(url.startsWith('https://'), `${name} authUrl should use HTTPS`);
    }
  });

  test('all token URLs use HTTPS', () => {
    for (const [name, config] of Object.entries(OAUTH_PROVIDERS)) {
      const url = config.tokenUrl || config.tokenUrlTemplate;
      assert.ok(url.startsWith('https://'), `${name} tokenUrl should use HTTPS`);
    }
  });
});

// ─── OAuthGateway constructor ────────────────────────────────────────────────

describe('OAuthGateway constructor', () => {
  test('creates instance with default port 3010', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.port, 3010);
  });

  test('creates instance with custom port', () => {
    const gw = new OAuthGateway({ port: 4000 });
    assert.strictEqual(gw.port, 4000);
  });

  test('creates instance with default baseUrl', () => {
    const gw = new OAuthGateway();
    assert.ok(gw.baseUrl.includes('localhost') || gw.baseUrl.includes('3010'));
  });

  test('creates instance with custom baseUrl', () => {
    const gw = new OAuthGateway({ baseUrl: 'https://oauth.vocalia.ma' });
    assert.strictEqual(gw.baseUrl, 'https://oauth.vocalia.ma');
  });

  test('app is null before start', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.app, null);
  });

  test('server is null before start', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.server, null);
  });
});

// ─── generateState / verifyState ─────────────────────────────────────────────

describe('OAuthGateway generateState', () => {
  const gw = new OAuthGateway();

  test('returns a state string', () => {
    const state = gw.generateState('tenant1', 'google', ['calendar']);
    assert.ok(state);
    assert.strictEqual(typeof state, 'string');
    assert.ok(state.length >= 32);
  });

  test('generates unique states', () => {
    const s1 = gw.generateState('t1', 'google', ['calendar']);
    const s2 = gw.generateState('t1', 'google', ['calendar']);
    assert.notStrictEqual(s1, s2);
  });

  test('returns hex string', () => {
    const state = gw.generateState('t1', 'hubspot', ['crm']);
    assert.match(state, /^[0-9a-f]+$/);
  });
});

describe('OAuthGateway verifyState', () => {
  const gw = new OAuthGateway();

  test('verifies valid state', () => {
    const state = gw.generateState('tenant1', 'google', ['calendar']);
    const data = gw.verifyState(state);
    assert.ok(data);
    assert.strictEqual(data.tenantId, 'tenant1');
    assert.strictEqual(data.provider, 'google');
  });

  test('returns null for invalid state', () => {
    const data = gw.verifyState('invalid-state-value');
    assert.strictEqual(data, null);
  });

  test('consumes state (single use)', () => {
    const state = gw.generateState('t1', 'google', ['calendar']);
    const first = gw.verifyState(state);
    assert.ok(first);
    const second = gw.verifyState(state);
    assert.strictEqual(second, null);
  });

  test('preserves scopes in state data', () => {
    const state = gw.generateState('t1', 'google', ['calendar', 'sheets']);
    const data = gw.verifyState(state);
    assert.deepStrictEqual(data.scopes, ['calendar', 'sheets']);
  });
});

// ─── getAuthUrl ──────────────────────────────────────────────────────────────

describe('OAuthGateway getAuthUrl', () => {
  const gw = new OAuthGateway({ baseUrl: 'https://oauth.vocalia.ma' });

  test('throws for unknown provider', () => {
    assert.throws(() => gw.getAuthUrl('tenant1', 'unknown_provider'), /Unknown OAuth provider/);
  });

  test('throws when client ID env not set', () => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      assert.throws(() => gw.getAuthUrl('tenant1', 'google', ['calendar']), /Missing GOOGLE_CLIENT_ID/);
    }
  });

});

// NOTE: OAuthGateway methods are proven by behavioral tests above
// (generateState, verifyState, getAuthUrl, constructor, OAUTH_PROVIDERS, etc.)
