'use strict';

/**
 * VocalIA OAuthGateway Tests
 *
 * Tests:
 * - OAUTH_PROVIDERS configuration (Google, HubSpot, Shopify, Slack)
 * - OAuthGateway constructor
 * - verifyState (null for unknown)
 * - getAuthUrl error cases
 * - exchangeCode error cases
 *
 * NOTE: No real OAuth flows. Tests offline logic only.
 * NOTE: generateState tests excluded — setTimeout(10min) keeps event loop alive.
 *
 * Run: node --test test/oauth-gateway.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { OAuthGateway, OAUTH_PROVIDERS } = require('../core/OAuthGateway.cjs');

describe('OAUTH_PROVIDERS configuration', () => {
  test('has google provider with scopes', () => {
    assert.ok(OAUTH_PROVIDERS.google);
    assert.strictEqual(OAUTH_PROVIDERS.google.name, 'Google');
    assert.ok(OAUTH_PROVIDERS.google.authUrl.includes('accounts.google.com'));
    assert.ok(OAUTH_PROVIDERS.google.scopes.calendar);
    assert.ok(OAUTH_PROVIDERS.google.scopes.sheets);
    assert.ok(OAUTH_PROVIDERS.google.scopes.drive);
    assert.ok(OAUTH_PROVIDERS.google.scopes.gmail);
  });

  test('has hubspot provider', () => {
    assert.ok(OAUTH_PROVIDERS.hubspot);
    assert.strictEqual(OAUTH_PROVIDERS.hubspot.name, 'HubSpot');
    assert.ok(OAUTH_PROVIDERS.hubspot.authUrl.includes('hubspot.com'));
    assert.ok(OAUTH_PROVIDERS.hubspot.scopes.crm);
  });

  test('has shopify provider', () => {
    assert.ok(OAUTH_PROVIDERS.shopify);
    assert.strictEqual(OAUTH_PROVIDERS.shopify.name, 'Shopify');
    assert.ok(OAUTH_PROVIDERS.shopify.scopes.default.includes('read_orders'));
  });

  test('has slack provider', () => {
    assert.ok(OAUTH_PROVIDERS.slack);
    assert.strictEqual(OAUTH_PROVIDERS.slack.name, 'Slack');
    assert.ok(OAUTH_PROVIDERS.slack.authUrl.includes('slack.com'));
  });

  test('all providers have clientIdEnv and clientSecretEnv', () => {
    for (const [key, config] of Object.entries(OAUTH_PROVIDERS)) {
      assert.ok(config.clientIdEnv, `${key} missing clientIdEnv`);
      assert.ok(config.clientSecretEnv, `${key} missing clientSecretEnv`);
    }
  });

  test('4 providers total', () => {
    assert.strictEqual(Object.keys(OAUTH_PROVIDERS).length, 4);
  });
});

describe('OAuthGateway constructor', () => {
  test('defaults to port 3010', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.port, 3010);
  });

  test('accepts custom port and baseUrl', () => {
    const gw = new OAuthGateway({ port: 4000, baseUrl: 'https://auth.vocalia.ma' });
    assert.strictEqual(gw.port, 4000);
    assert.strictEqual(gw.baseUrl, 'https://auth.vocalia.ma');
  });

  test('has no server initially', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.server, null);
    assert.strictEqual(gw.app, null);
  });
});

describe('OAuthGateway verifyState', () => {
  test('returns null for unknown state', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.verifyState('nonexistent_state_token'), null);
  });

  test('returns null for empty string', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(gw.verifyState(''), null);
  });
});

describe('OAuthGateway getAuthUrl errors', () => {
  test('throws for unknown provider', () => {
    const gw = new OAuthGateway();
    assert.throws(
      () => gw.getAuthUrl('tenant1', 'unknown_provider'),
      /Unknown OAuth provider/
    );
  });

  test('throws when client ID env var is missing', () => {
    const gw = new OAuthGateway();
    const original = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      assert.throws(
        () => gw.getAuthUrl('tenant1', 'google', ['calendar']),
        /Missing.*GOOGLE_CLIENT_ID/
      );
    } finally {
      if (original) process.env.GOOGLE_CLIENT_ID = original;
    }
  });
});

describe('OAuthGateway exchangeCode errors', () => {
  test('throws for invalid state token', async () => {
    const gw = new OAuthGateway();
    await assert.rejects(
      () => gw.exchangeCode('google', 'auth_code_123', 'invalid_state'),
      /Invalid or expired state token/
    );
  });
});

// NOTE: getAuthUrl success tests excluded because getAuthUrl calls generateState
// which uses setTimeout(10min), keeping the event loop alive and hanging tests.

// NOTE: generateState tests excluded because setTimeout(10min) keeps event loop alive.
// verifyState is tested above with unknown state tokens.

describe('OAUTH_PROVIDERS detail', () => {
  test('google has 4 scopes', () => {
    const scopes = Object.keys(OAUTH_PROVIDERS.google.scopes);
    assert.strictEqual(scopes.length, 4);
    assert.ok(scopes.includes('calendar'));
    assert.ok(scopes.includes('sheets'));
    assert.ok(scopes.includes('drive'));
    assert.ok(scopes.includes('gmail'));
  });

  test('hubspot has crm scope with contacts', () => {
    assert.ok(OAUTH_PROVIDERS.hubspot.scopes.crm.includes('contacts'));
  });

  test('shopify uses template URLs', () => {
    assert.ok(OAUTH_PROVIDERS.shopify.authUrlTemplate);
    assert.ok(OAUTH_PROVIDERS.shopify.tokenUrlTemplate);
    assert.ok(OAUTH_PROVIDERS.shopify.authUrlTemplate.includes('{shop}'));
  });

  test('slack has webhook scope', () => {
    assert.ok(OAUTH_PROVIDERS.slack.scopes.default.includes('incoming-webhook'));
  });

  test('all providers have name', () => {
    for (const [key, cfg] of Object.entries(OAUTH_PROVIDERS)) {
      assert.ok(cfg.name, `${key} missing name`);
    }
  });
});

describe('OAuthGateway exports', () => {
  test('exports OAuthGateway class', () => {
    assert.strictEqual(typeof OAuthGateway, 'function');
  });

  test('exports OAUTH_PROVIDERS', () => {
    assert.strictEqual(typeof OAUTH_PROVIDERS, 'object');
  });

  test('instance has all methods', () => {
    const gw = new OAuthGateway();
    assert.strictEqual(typeof gw.generateState, 'function');
    assert.strictEqual(typeof gw.verifyState, 'function');
    assert.strictEqual(typeof gw.getAuthUrl, 'function');
    assert.strictEqual(typeof gw.exchangeCode, 'function');
  });
});
