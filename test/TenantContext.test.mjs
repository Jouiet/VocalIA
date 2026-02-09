/**
 * VocalIA TenantContext Tests
 *
 * Tests:
 * - Constructor (paths, defaults, logger creation)
 * - checkRequiredIntegrations (valid/missing)
 * - checkRequiredSecrets (valid/missing)
 * - getShopifyCredentials (enabled/disabled)
 * - getKlaviyoCredentials (enabled/disabled)
 * - getGoogleCredentials (enabled/disabled)
 * - Static listTenants (uses cwd-based path)
 * - Static build method exists
 *
 * Run: node --test test/TenantContext.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import TenantContext from '../core/TenantContext.cjs';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('TenantContext constructor', () => {
  test('sets tenantId', () => {
    const ctx = new TenantContext('test-tenant');
    assert.strictEqual(ctx.tenantId, 'test-tenant');
  });

  test('sets default scriptName to unknown', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.scriptName, 'unknown');
  });

  test('sets custom scriptName', () => {
    const ctx = new TenantContext('t1', { scriptName: 'kb-sync' });
    assert.strictEqual(ctx.scriptName, 'kb-sync');
  });

  test('generates runId if not provided', () => {
    const ctx = new TenantContext('t1');
    assert.ok(ctx.runId);
    assert.ok(ctx.runId.length > 5);
  });

  test('uses provided runId', () => {
    const ctx = new TenantContext('t1', { runId: 'custom-run-123' });
    assert.strictEqual(ctx.runId, 'custom-run-123');
  });

  test('sets startTime to current timestamp', () => {
    const before = Date.now();
    const ctx = new TenantContext('t1');
    const after = Date.now();
    assert.ok(ctx.startTime >= before);
    assert.ok(ctx.startTime <= after);
  });

  test('stores params', () => {
    const ctx = new TenantContext('t1', { params: { mode: 'full' } });
    assert.deepStrictEqual(ctx.params, { mode: 'full' });
  });

  test('default params is empty object', () => {
    const ctx = new TenantContext('t1');
    assert.deepStrictEqual(ctx.params, {});
  });

  test('clientDir includes tenantId', () => {
    const ctx = new TenantContext('my-tenant');
    assert.ok(ctx.clientDir.includes('my-tenant'));
    assert.ok(ctx.clientDir.includes('clients'));
  });

  test('configPath ends with config.json', () => {
    const ctx = new TenantContext('t1');
    assert.ok(ctx.configPath.endsWith('config.json'));
  });

  test('credentialsPath ends with credentials.json', () => {
    const ctx = new TenantContext('t1');
    assert.ok(ctx.credentialsPath.endsWith('credentials.json'));
  });

  test('config is null before loadConfig', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.config, null);
  });

  test('secrets is empty object initially', () => {
    const ctx = new TenantContext('t1');
    assert.deepStrictEqual(ctx.secrets, {});
  });

  test('integrations is empty object initially', () => {
    const ctx = new TenantContext('t1');
    assert.deepStrictEqual(ctx.integrations, {});
  });

  test('creates logger as TenantLogger instance', () => {
    const ctx = new TenantContext('t1');
    assert.ok(ctx.logger);
    assert.strictEqual(ctx.logger.tenantId, 't1');
  });

  test('logger inherits scriptName', () => {
    const ctx = new TenantContext('t1', { scriptName: 'my-script' });
    assert.strictEqual(ctx.logger.scriptName, 'my-script');
  });

  test('logger inherits runId', () => {
    const ctx = new TenantContext('t1', { runId: 'run-xyz' });
    assert.strictEqual(ctx.logger.runId, 'run-xyz');
  });
});

// ─── checkRequiredIntegrations ──────────────────────────────────────────────

describe('TenantContext checkRequiredIntegrations', () => {
  test('returns valid=true with empty required list', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredIntegrations([]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('returns valid=false when integrations missing', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredIntegrations(['shopify', 'hubspot']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['shopify', 'hubspot']);
  });

  test('returns valid=true when all integrations enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {
      shopify: { enabled: true },
      hubspot: { enabled: true }
    };
    const result = ctx.checkRequiredIntegrations(['shopify', 'hubspot']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('returns missing for disabled integrations', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {
      shopify: { enabled: false },
      hubspot: { enabled: true }
    };
    const result = ctx.checkRequiredIntegrations(['shopify', 'hubspot']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['shopify']);
  });

  test('handles mixed enabled/missing/disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {
      shopify: { enabled: true },
      hubspot: { enabled: false }
    };
    const result = ctx.checkRequiredIntegrations(['shopify', 'hubspot', 'klaviyo']);
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('hubspot'));
    assert.ok(result.missing.includes('klaviyo'));
    assert.ok(!result.missing.includes('shopify'));
  });

  test('defaults to empty required when no argument', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredIntegrations();
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });
});

// ─── checkRequiredSecrets ───────────────────────────────────────────────────

describe('TenantContext checkRequiredSecrets', () => {
  test('returns valid=true with empty required list', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredSecrets([]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('returns valid=false when secrets missing', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredSecrets(['API_KEY', 'SECRET']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['API_KEY', 'SECRET']);
  });

  test('returns valid=true when all secrets present', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { API_KEY: 'abc', SECRET: 'xyz' };
    const result = ctx.checkRequiredSecrets(['API_KEY', 'SECRET']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('returns missing for empty string secrets', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { API_KEY: '', SECRET: 'xyz' };
    const result = ctx.checkRequiredSecrets(['API_KEY', 'SECRET']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['API_KEY']);
  });

  test('defaults to empty required when no argument', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredSecrets();
    assert.strictEqual(result.valid, true);
  });
});

// ─── getShopifyCredentials ──────────────────────────────────────────────────

describe('TenantContext getShopifyCredentials', () => {
  test('returns null when shopify not enabled', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.getShopifyCredentials(), null);
  });

  test('returns null when shopify disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: false } };
    assert.strictEqual(ctx.getShopifyCredentials(), null);
  });

  test('returns credentials when shopify enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true, shop_domain: 'myshop.myshopify.com' } };
    ctx.secrets = { SHOPIFY_STORE: 'myshop', SHOPIFY_ACCESS_TOKEN: 'shpat_xxx' };
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.store, 'myshop');
    assert.strictEqual(creds.accessToken, 'shpat_xxx');
  });

  test('falls back to shop_domain from integrations config', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true, shop_domain: 'fallback-shop.myshopify.com' } };
    ctx.secrets = {};
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.store, 'fallback-shop.myshopify.com');
  });

  test('uses default API version 2026-01', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true } };
    ctx.secrets = {};
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.apiVersion, '2026-01');
  });

  test('uses custom API version from secrets', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true } };
    ctx.secrets = { SHOPIFY_API_VERSION: '2025-01' };
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.apiVersion, '2025-01');
  });
});

// ─── getKlaviyoCredentials ──────────────────────────────────────────────────

describe('TenantContext getKlaviyoCredentials', () => {
  test('returns null when klaviyo not enabled', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.getKlaviyoCredentials(), null);
  });

  test('returns null when klaviyo disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: false } };
    assert.strictEqual(ctx.getKlaviyoCredentials(), null);
  });

  test('returns credentials when klaviyo enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true, account_id: 'acc123' } };
    ctx.secrets = { KLAVIYO_API_KEY: 'pk_xxx' };
    const creds = ctx.getKlaviyoCredentials();
    assert.strictEqual(creds.apiKey, 'pk_xxx');
    assert.strictEqual(creds.accountId, 'acc123');
  });

  test('falls back to KLAVIYO_ACCESS_TOKEN', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true } };
    ctx.secrets = { KLAVIYO_ACCESS_TOKEN: 'token_xxx' };
    const creds = ctx.getKlaviyoCredentials();
    assert.strictEqual(creds.apiKey, 'token_xxx');
  });

  test('falls back to account_id from integrations config', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true, account_id: 'from_config' } };
    ctx.secrets = {};
    const creds = ctx.getKlaviyoCredentials();
    assert.strictEqual(creds.accountId, 'from_config');
  });
});

// ─── getGoogleCredentials ───────────────────────────────────────────────────

describe('TenantContext getGoogleCredentials', () => {
  test('returns null when google not enabled', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.getGoogleCredentials(), null);
  });

  test('returns null when google disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { google: { enabled: false } };
    assert.strictEqual(ctx.getGoogleCredentials(), null);
  });

  test('returns credentials when google enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { google: { enabled: true } };
    ctx.secrets = {
      GOOGLE_ACCESS_TOKEN: 'ya29.xxx',
      GOOGLE_REFRESH_TOKEN: '1//xxx',
      GA4_PROPERTY_ID: '123456',
      GSC_SITE_URL: 'https://example.com'
    };
    const creds = ctx.getGoogleCredentials();
    assert.strictEqual(creds.accessToken, 'ya29.xxx');
    assert.strictEqual(creds.refreshToken, '1//xxx');
    assert.strictEqual(creds.propertyId, '123456');
    assert.strictEqual(creds.siteUrl, 'https://example.com');
  });

  test('returns undefined fields when secrets missing', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { google: { enabled: true } };
    ctx.secrets = {};
    const creds = ctx.getGoogleCredentials();
    assert.strictEqual(creds.accessToken, undefined);
    assert.strictEqual(creds.refreshToken, undefined);
  });
});

// ─── loadConfig ─────────────────────────────────────────────────────────────

describe('TenantContext loadConfig', () => {
  test('throws for non-existent tenant config', async () => {
    const ctx = new TenantContext('__nonexistent_tenant_xyz__');
    await assert.rejects(() => ctx.loadConfig(), /Tenant config not found/);
  });
});

// ─── Static methods ─────────────────────────────────────────────────────────

describe('TenantContext static methods', () => {
  test('listTenants returns an array', () => {
    const result = TenantContext.listTenants();
    assert.ok(Array.isArray(result));
  });
});

// NOTE: Class methods are proven by behavioral tests above (constructor, checkRequiredIntegrations,
// checkRequiredSecrets, getShopifyCredentials, getKlaviyoCredentials, getGoogleCredentials, loadConfig).
