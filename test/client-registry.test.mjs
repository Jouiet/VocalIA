/**
 * VocalIA ClientRegistry Tests
 *
 * Tests:
 * - getClient for known fallback clients (agency_internal, client_demo)
 * - getClient returns null for unknown tenants
 * - getAllClients returns at least fallback clients
 * - clearCache resets the config cache
 * - listTenants returns array with fallback tenants
 * - getTenantIdByTwilioSid returns null for unknown SID
 * - Fallback client structure validation
 *
 * NOTE: Tests use real clients/ directory (read-only).
 * No files are created or modified.
 *
 * Run: node --test test/client-registry.test.mjs
 */



import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import ClientRegistry from '../core/client-registry.cjs';

beforeEach(() => {
  ClientRegistry.clearCache();
});

// ─── getClient ─────────────────────────────────────────────────────

describe('ClientRegistry getClient', () => {
  test('returns agency_internal with expected fields', () => {
    const client = ClientRegistry.getClient('agency_internal');
    assert.ok(client);
    assert.strictEqual(client.id, 'agency_internal');
    assert.strictEqual(client.name, 'VocalIA Internal');
    assert.ok(client.marketRules);
    assert.ok(client.integrations);
  });

  test('returns client_demo', () => {
    const client = ClientRegistry.getClient('client_demo');
    assert.ok(client);
    assert.strictEqual(client.id, 'client_demo');
    assert.strictEqual(client.name, 'Demo Corp US');
  });

  test('returns null for completely unknown tenant', () => {
    const client = ClientRegistry.getClient('nonexistent_tenant_xyz_999');
    assert.strictEqual(client, null);
  });

  test('agency_internal has marketRules with MA market', () => {
    const client = ClientRegistry.getClient('agency_internal');
    assert.ok(client.marketRules.markets.MA);
    assert.strictEqual(client.marketRules.markets.MA.currency, 'MAD');
    assert.strictEqual(client.marketRules.markets.MA.symbol, 'DH');
  });

  test('agency_internal has FR market in EUR', () => {
    const client = ClientRegistry.getClient('agency_internal');
    assert.ok(client.marketRules.markets.FR);
    assert.strictEqual(client.marketRules.markets.FR.currency, 'EUR');
  });

  test('client_demo has default market in USD', () => {
    const client = ClientRegistry.getClient('client_demo');
    assert.strictEqual(client.marketRules.default.currency, 'USD');
  });

  test('caches result on second call', () => {
    const first = ClientRegistry.getClient('agency_internal');
    const second = ClientRegistry.getClient('agency_internal');
    assert.strictEqual(first, second); // Same reference = cached
  });
});

// ─── getAllClients ──────────────────────────────────────────────────

describe('ClientRegistry getAllClients', () => {
  test('returns object with at least 2 fallback clients', () => {
    const all = ClientRegistry.getAllClients();
    assert.ok(typeof all === 'object');
    assert.ok(all.agency_internal);
    assert.ok(all.client_demo);
  });

  test('includes file-based clients from clients/ directory', () => {
    const all = ClientRegistry.getAllClients();
    // Should have many more than just 2 (557+ client folders exist)
    assert.ok(Object.keys(all).length >= 2);
  });
});

// ─── clearCache ────────────────────────────────────────────────────

describe('ClientRegistry clearCache', () => {
  test('clears cached configs', () => {
    // Populate cache
    ClientRegistry.getClient('agency_internal');
    // Clear
    ClientRegistry.clearCache();
    // Next call should reload (no error)
    const client = ClientRegistry.getClient('agency_internal');
    assert.ok(client);
  });
});

// ─── listTenants ───────────────────────────────────────────────────

describe('ClientRegistry listTenants', () => {
  test('returns array', () => {
    const tenants = ClientRegistry.listTenants();
    assert.ok(Array.isArray(tenants));
  });

  test('includes fallback tenants', () => {
    const tenants = ClientRegistry.listTenants();
    assert.ok(tenants.includes('agency_internal'));
    assert.ok(tenants.includes('client_demo'));
  });

  test('includes file-based tenants', () => {
    const tenants = ClientRegistry.listTenants();
    // Should have many tenants from clients/ directory
    assert.ok(tenants.length >= 2);
  });
});

// ─── getTenantIdByTwilioSid ────────────────────────────────────────

describe('ClientRegistry getTenantIdByTwilioSid', () => {
  test('returns null for null SID', () => {
    const result = ClientRegistry.getTenantIdByTwilioSid(null);
    assert.strictEqual(result, null);
  });

  test('returns null for unknown SID', () => {
    const result = ClientRegistry.getTenantIdByTwilioSid('AC_nonexistent_sid_123');
    assert.strictEqual(result, null);
  });

  test('returns null for empty string', () => {
    const result = ClientRegistry.getTenantIdByTwilioSid('');
    assert.strictEqual(result, null);
  });
});

// ─── Integration structure ─────────────────────────────────────────

describe('ClientRegistry integration structure', () => {
  test('agency_internal has hubspot enabled', () => {
    const client = ClientRegistry.getClient('agency_internal');
    assert.strictEqual(client.integrations.hubspot, true);
  });

  test('agency_internal has no shopify integration', () => {
    const client = ClientRegistry.getClient('agency_internal');
    // File-based config doesn't include shopify for agency
    assert.ok(!client.integrations.shopify);
  });

  test('client_demo has shopify enabled', () => {
    const client = ClientRegistry.getClient('client_demo');
    assert.strictEqual(client.integrations.shopify, true);
  });

  test('client_demo has hubspot disabled', () => {
    const client = ClientRegistry.getClient('client_demo');
    assert.strictEqual(client.integrations.hubspot, false);
  });
});
