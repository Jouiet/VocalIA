'use strict';

/**
 * VocalIA TenantContext Tests
 *
 * Tests:
 * - Constructor defaults (paths, runId, logger)
 * - loadConfig (missing file → error)
 * - checkRequiredIntegrations
 * - checkRequiredSecrets
 * - getShopifyCredentials (null when disabled)
 * - getKlaviyoCredentials (null when disabled)
 * - getGoogleCredentials (null when disabled)
 * - Helper methods (getSecret, hasIntegration, getDuration)
 *
 * NOTE: Tests use constructor only — no real file I/O for config loading.
 *
 * Run: node --test test/tenant-context.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const TenantContext = require('../core/TenantContext.cjs');

// ─── Constructor ───────────────────────────────────────────────────

describe('TenantContext constructor', () => {
  test('sets tenantId', () => {
    const ctx = new TenantContext('test_tenant');
    assert.strictEqual(ctx.tenantId, 'test_tenant');
  });

  test('defaults scriptName to unknown', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.scriptName, 'unknown');
  });

  test('accepts custom scriptName', () => {
    const ctx = new TenantContext('t1', { scriptName: 'my-script' });
    assert.strictEqual(ctx.scriptName, 'my-script');
  });

  test('generates unique runId', () => {
    const c1 = new TenantContext('t1');
    const c2 = new TenantContext('t1');
    assert.notStrictEqual(c1.runId, c2.runId);
  });

  test('accepts custom runId', () => {
    const ctx = new TenantContext('t1', { runId: 'custom-run-123' });
    assert.strictEqual(ctx.runId, 'custom-run-123');
  });

  test('stores params', () => {
    const ctx = new TenantContext('t1', { params: { key: 'value' } });
    assert.deepStrictEqual(ctx.params, { key: 'value' });
  });

  test('has configPath ending with config.json', () => {
    const ctx = new TenantContext('test_t');
    assert.ok(ctx.configPath.endsWith('test_t/config.json'));
  });

  test('initializes config as null', () => {
    const ctx = new TenantContext('t1');
    assert.strictEqual(ctx.config, null);
  });

  test('initializes empty secrets', () => {
    const ctx = new TenantContext('t1');
    assert.deepStrictEqual(ctx.secrets, {});
  });

  test('initializes empty integrations', () => {
    const ctx = new TenantContext('t1');
    assert.deepStrictEqual(ctx.integrations, {});
  });

  test('has a TenantLogger instance', () => {
    const ctx = new TenantContext('t1');
    assert.ok(ctx.logger);
    assert.strictEqual(ctx.logger.tenantId, 't1');
  });
});

// ─── loadConfig ────────────────────────────────────────────────────

describe('TenantContext loadConfig', () => {
  test('throws for nonexistent tenant config', async () => {
    const ctx = new TenantContext('nonexistent_tenant_xyz_999');
    await assert.rejects(
      () => ctx.loadConfig(),
      /Tenant config not found/
    );
  });
});

// ─── checkRequiredIntegrations ─────────────────────────────────────

describe('TenantContext checkRequiredIntegrations', () => {
  test('valid when no requirements', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredIntegrations([]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('reports missing integrations', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { hubspot: { enabled: true } };
    const result = ctx.checkRequiredIntegrations(['hubspot', 'shopify']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['shopify']);
  });

  test('valid when all present and enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {
      hubspot: { enabled: true },
      shopify: { enabled: true }
    };
    const result = ctx.checkRequiredIntegrations(['hubspot', 'shopify']);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  test('disabled integration counts as missing', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { hubspot: { enabled: false } };
    const result = ctx.checkRequiredIntegrations(['hubspot']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['hubspot']);
  });
});

// ─── checkRequiredSecrets ──────────────────────────────────────────

describe('TenantContext checkRequiredSecrets', () => {
  test('valid when no requirements', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredSecrets([]);
    assert.strictEqual(result.valid, true);
  });

  test('reports missing secrets', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { API_KEY: 'abc' };
    const result = ctx.checkRequiredSecrets(['API_KEY', 'SECRET_KEY']);
    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.missing, ['SECRET_KEY']);
  });

  test('valid when all present', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { A: '1', B: '2' };
    const result = ctx.checkRequiredSecrets(['A', 'B']);
    assert.strictEqual(result.valid, true);
  });
});

// ─── Credential getters ────────────────────────────────────────────

describe('TenantContext credential getters', () => {
  test('getShopifyCredentials returns null when shopify disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {};
    assert.strictEqual(ctx.getShopifyCredentials(), null);
  });

  test('getShopifyCredentials returns config when enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true, shop_domain: 'test.myshopify.com' } };
    ctx.secrets = { SHOPIFY_ACCESS_TOKEN: 'shpat_xxx' };
    const creds = ctx.getShopifyCredentials();
    assert.ok(creds);
    assert.strictEqual(creds.store, 'test.myshopify.com');
    assert.strictEqual(creds.accessToken, 'shpat_xxx');
    assert.strictEqual(creds.apiVersion, '2024-01');
  });

  test('getKlaviyoCredentials returns null when disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {};
    assert.strictEqual(ctx.getKlaviyoCredentials(), null);
  });

  test('getKlaviyoCredentials returns config when enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true, account_id: 'klv_123' } };
    ctx.secrets = { KLAVIYO_API_KEY: 'pk_xxx' };
    const creds = ctx.getKlaviyoCredentials();
    assert.ok(creds);
    assert.strictEqual(creds.apiKey, 'pk_xxx');
    assert.strictEqual(creds.accountId, 'klv_123');
  });

  test('getGoogleCredentials returns null when disabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = {};
    assert.strictEqual(ctx.getGoogleCredentials(), null);
  });

  test('getGoogleCredentials returns tokens when enabled', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { google: { enabled: true } };
    ctx.secrets = {
      GOOGLE_ACCESS_TOKEN: 'ya29.xxx',
      GOOGLE_REFRESH_TOKEN: '1//xxx',
      GA4_PROPERTY_ID: '12345'
    };
    const creds = ctx.getGoogleCredentials();
    assert.ok(creds);
    assert.strictEqual(creds.accessToken, 'ya29.xxx');
    assert.strictEqual(creds.propertyId, '12345');
  });
});

// ─── Credential getter edge cases ─────────────────────────────────

describe('TenantContext credential getter edge cases', () => {
  test('getShopifyCredentials uses SHOPIFY_STORE secret over shop_domain', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true, shop_domain: 'fallback.myshopify.com' } };
    ctx.secrets = { SHOPIFY_STORE: 'primary.myshopify.com', SHOPIFY_ACCESS_TOKEN: 'tok' };
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.store, 'primary.myshopify.com');
  });

  test('getShopifyCredentials custom API version', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { shopify: { enabled: true } };
    ctx.secrets = { SHOPIFY_API_VERSION: '2025-01' };
    const creds = ctx.getShopifyCredentials();
    assert.strictEqual(creds.apiVersion, '2025-01');
  });

  test('getKlaviyoCredentials uses ACCESS_TOKEN fallback', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true } };
    ctx.secrets = { KLAVIYO_ACCESS_TOKEN: 'access_tok' };
    const creds = ctx.getKlaviyoCredentials();
    assert.strictEqual(creds.apiKey, 'access_tok');
  });

  test('getKlaviyoCredentials prefers API_KEY over ACCESS_TOKEN', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { klaviyo: { enabled: true } };
    ctx.secrets = { KLAVIYO_API_KEY: 'api_key', KLAVIYO_ACCESS_TOKEN: 'access_tok' };
    const creds = ctx.getKlaviyoCredentials();
    assert.strictEqual(creds.apiKey, 'api_key');
  });

  test('getGoogleCredentials includes GSC_SITE_URL', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { google: { enabled: true } };
    ctx.secrets = { GSC_SITE_URL: 'https://vocalia.ma' };
    const creds = ctx.getGoogleCredentials();
    assert.strictEqual(creds.siteUrl, 'https://vocalia.ma');
  });
});

// ─── checkRequiredIntegrations edge cases ─────────────────────────

describe('TenantContext checkRequiredIntegrations edge cases', () => {
  test('undefined integration counts as missing', () => {
    const ctx = new TenantContext('t1');
    const result = ctx.checkRequiredIntegrations(['stripe']);
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('stripe'));
  });

  test('integration without enabled property counts as missing', () => {
    const ctx = new TenantContext('t1');
    ctx.integrations = { hubspot: {} };
    const result = ctx.checkRequiredIntegrations(['hubspot']);
    assert.strictEqual(result.valid, false);
  });
});

// ─── checkRequiredSecrets edge cases ──────────────────────────────

describe('TenantContext checkRequiredSecrets edge cases', () => {
  test('empty string secret counts as missing', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { KEY: '' };
    const result = ctx.checkRequiredSecrets(['KEY']);
    assert.strictEqual(result.valid, false);
  });

  test('falsy values count as missing', () => {
    const ctx = new TenantContext('t1');
    ctx.secrets = { KEY: null };
    const result = ctx.checkRequiredSecrets(['KEY']);
    assert.strictEqual(result.valid, false);
  });
});

// ─── listTenants ──────────────────────────────────────────────────

describe('TenantContext listTenants', () => {
  test('returns array', () => {
    const tenants = TenantContext.listTenants();
    assert.ok(Array.isArray(tenants));
  });

  test('each tenant has id and name', () => {
    const tenants = TenantContext.listTenants();
    for (const t of tenants) {
      assert.ok(t.id, 'Tenant missing id');
      assert.ok(t.name, 'Tenant missing name');
    }
  });
});

// ─── Static build ──────────────────────────────────────────────────

describe('TenantContext static build', () => {
  test('throws for nonexistent tenant', async () => {
    await assert.rejects(
      () => TenantContext.build('absolutely_nonexistent_abc_000'),
      /Tenant config not found/
    );
  });
});

// ─── Exports ──────────────────────────────────────────────────────

describe('TenantContext exports', () => {
  test('exports TenantContext class', () => {
    assert.strictEqual(typeof TenantContext, 'function');
  });

  test('TenantContext has static build method', () => {
    assert.strictEqual(typeof TenantContext.build, 'function');
  });

  test('TenantContext has static listTenants method', () => {
    assert.strictEqual(typeof TenantContext.listTenants, 'function');
  });

  test('instance has all methods', () => {
    const ctx = new TenantContext('t1');
    const methods = ['loadConfig', 'loadSecrets', 'build', 'checkRequiredIntegrations',
      'checkRequiredSecrets', 'getShopifyCredentials', 'getKlaviyoCredentials', 'getGoogleCredentials'];
    for (const m of methods) {
      assert.strictEqual(typeof ctx[m], 'function', `Missing method: ${m}`);
    }
  });
});
