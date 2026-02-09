/**
 * VocalIA Tenant-Persona Bridge Tests
 *
 * Tests:
 * - SECTOR_TO_ARCHETYPE mapping (40+ sectors)
 * - transformTenantToClientConfig (field mapping, services/zones parsing)
 * - getClientConfigSync (static demos, null handling)
 * - invalidateCache / getCacheStats
 * - getDemoClients
 *
 * NOTE: Tests sync/static paths only. No Google Sheets calls.
 *
 * Run: node --test test/tenant-persona-bridge.test.mjs
 */


import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SECTOR_TO_ARCHETYPE, transformTenantToClientConfig, getClientConfigSync, invalidateCache, getCacheStats, getDemoClients } from '../core/tenant-persona-bridge.cjs';


// ─── SECTOR_TO_ARCHETYPE ────────────────────────────────────────────

describe('TenantPersonaBridge SECTOR_TO_ARCHETYPE', () => {
  test('maps dental to DENTAL', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.dental, 'DENTAL');
  });

  test('maps dentist to DENTAL', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.dentist, 'DENTAL');
  });

  test('maps dentiste (FR) to DENTAL', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.dentiste, 'DENTAL');
  });

  test('maps ecommerce to UNIVERSAL_ECOMMERCE', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.ecommerce, 'UNIVERSAL_ECOMMERCE');
  });

  test('maps hotel to CONCIERGE', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.hotel, 'CONCIERGE');
  });

  test('maps restaurant to RESTAURATEUR', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.restaurant, 'RESTAURATEUR');
  });

  test('maps general to UNIVERSAL_SME', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.general, 'UNIVERSAL_SME');
  });

  test('maps insurance to INSURER', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.insurance, 'INSURER');
  });

  test('maps notaire (FR) to NOTARY', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.notaire, 'NOTARY');
  });

  test('maps immobilier (FR) to REAL_ESTATE_AGENT', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.immobilier, 'REAL_ESTATE_AGENT');
  });

  test('maps coiffure to HAIRDRESSER', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.coiffure, 'HAIRDRESSER');
  });

  test('maps travel to TRAVEL_AGENT', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.travel, 'TRAVEL_AGENT');
  });

  test('maps pme to UNIVERSAL_SME', () => {
    assert.strictEqual(SECTOR_TO_ARCHETYPE.pme, 'UNIVERSAL_SME');
  });

  test('has at least 30 sector mappings', () => {
    assert.ok(Object.keys(SECTOR_TO_ARCHETYPE).length >= 30);
  });
});

// ─── transformTenantToClientConfig ──────────────────────────────────

describe('TenantPersonaBridge transformTenantToClientConfig', () => {
  test('returns null for null tenant', () => {
    assert.strictEqual(transformTenantToClientConfig(null), null);
  });

  test('maps basic fields', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      business_name: 'Test Shop',
      sector: 'dental',
      currency: 'MAD',
      language: 'fr',
      phone: '+212555',
      address: '123 Rue Test'
    });

    assert.strictEqual(config.name, 'Test Shop');
    assert.strictEqual(config.business_name, 'Test Shop');
    assert.strictEqual(config.sector, 'DENTAL');
    assert.strictEqual(config.currency, 'MAD');
    assert.strictEqual(config.language, 'fr');
    assert.strictEqual(config.phone, '+212555');
    assert.strictEqual(config._source, 'database');
    assert.strictEqual(config._tenant_id, 't1');
  });

  test('defaults currency to EUR', () => {
    const config = transformTenantToClientConfig({ id: 't1' });
    assert.strictEqual(config.currency, 'EUR');
  });

  test('defaults language to fr', () => {
    const config = transformTenantToClientConfig({ id: 't1' });
    assert.strictEqual(config.language, 'fr');
  });

  test('defaults name to Business', () => {
    const config = transformTenantToClientConfig({ id: 't1' });
    assert.strictEqual(config.name, 'Business');
  });

  test('defaults sector to UNIVERSAL_SME for unknown', () => {
    const config = transformTenantToClientConfig({ id: 't1', sector: 'unknown_xyz' });
    assert.strictEqual(config.sector, 'UNIVERSAL_SME');
  });

  test('parses services from JSON string', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      services: '["Consultation", "Surgery"]'
    });
    assert.deepStrictEqual(config.services, ['Consultation', 'Surgery']);
  });

  test('parses services from comma string', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      services: 'Service A, Service B'
    });
    assert.deepStrictEqual(config.services, ['Service A', 'Service B']);
  });

  test('passes services array through', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      services: ['A', 'B']
    });
    assert.deepStrictEqual(config.services, ['A', 'B']);
  });

  test('parses zones from comma string', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      zones: 'Casablanca, Rabat'
    });
    assert.deepStrictEqual(config.zones, ['Casablanca', 'Rabat']);
  });

  test('uses alternative field names', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      company: 'Alt Company',
      telephone: '+33555',
      industry: 'hotel',
      lang: 'en',
      location: '456 Blvd Alt'
    });
    assert.strictEqual(config.name, 'Alt Company');
    assert.strictEqual(config.phone, '+33555');
    assert.strictEqual(config.sector, 'CONCIERGE');
    assert.strictEqual(config.language, 'en');
    assert.strictEqual(config.address, '456 Blvd Alt');
  });

  test('sets widget_type from tenant', () => {
    const config = transformTenantToClientConfig({
      id: 't1',
      widget_type: 'B2B'
    });
    assert.strictEqual(config.widget_type, 'B2B');
  });

  test('defaults widget_type to B2B', () => {
    const config = transformTenantToClientConfig({ id: 't1' });
    assert.strictEqual(config.widget_type, 'B2B');
  });
});

// ─── getClientConfigSync ────────────────────────────────────────────

describe('TenantPersonaBridge getClientConfigSync', () => {
  beforeEach(() => {
    invalidateCache(); // Clear all cache
  });

  test('returns null for null clientId', () => {
    assert.strictEqual(getClientConfigSync(null), null);
  });

  test('returns null for unknown clientId', () => {
    assert.strictEqual(getClientConfigSync('nonexistent_xyz_999'), null);
  });

  test('returns config for known demo client', () => {
    const demos = getDemoClients();
    if (demos.length > 0) {
      const config = getClientConfigSync(demos[0]);
      assert.ok(config);
      assert.strictEqual(config._source, 'static_demo');
    }
  });
});

// ─── invalidateCache / getCacheStats ────────────────────────────────

describe('TenantPersonaBridge cache', () => {
  beforeEach(() => {
    invalidateCache(); // Clear all
  });

  test('getCacheStats returns expected shape', () => {
    const stats = getCacheStats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(typeof stats.maxSize, 'number');
    assert.strictEqual(typeof stats.ttlMs, 'number');
    assert.strictEqual(stats.maxSize, 100);
    assert.strictEqual(stats.ttlMs, 5 * 60 * 1000);
  });

  test('cache starts empty after invalidate', () => {
    const stats = getCacheStats();
    assert.strictEqual(stats.size, 0);
  });

  test('getClientConfigSync populates cache', () => {
    const demos = getDemoClients();
    if (demos.length > 0) {
      getClientConfigSync(demos[0]);
      const stats = getCacheStats();
      assert.ok(stats.size >= 1);
    }
  });

  test('invalidateCache with specific key clears only that key', () => {
    const demos = getDemoClients();
    if (demos.length >= 2) {
      getClientConfigSync(demos[0]);
      getClientConfigSync(demos[1]);
      const before = getCacheStats().size;
      invalidateCache(demos[0]);
      const after = getCacheStats().size;
      assert.strictEqual(after, before - 1);
    }
  });
});

// ─── getDemoClients ─────────────────────────────────────────────────

describe('TenantPersonaBridge getDemoClients', () => {
  test('returns array', () => {
    const demos = getDemoClients();
    assert.ok(Array.isArray(demos));
  });

  test('includes known demo clients', () => {
    const demos = getDemoClients();
    // client_registry.json should have at least agency_internal and client_demo
    assert.ok(demos.length >= 2);
  });
});
