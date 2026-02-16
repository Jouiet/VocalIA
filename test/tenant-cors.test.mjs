/**
 * Tenant CORS — Security Tests
 * VocalIA — Session 250.207
 *
 * Tests: core/tenant-cors.cjs (150 lines, 7 exports)
 * Security-critical: Controls origin-based access to ALL API endpoints.
 * In production (7 containers). Was 0 tests.
 *
 * Run: node --test test/tenant-cors.test.mjs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tenantCors = require('../core/tenant-cors.cjs');

const {
  loadTenantOrigins,
  isOriginAllowed,
  validateOriginTenant,
  validateApiKey,
  getCorsHeaders,
  getRegistry,
  VOCALIA_ORIGINS
} = tenantCors;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: VOCALIA_ORIGINS constant
// ═══════════════════════════════════════════════════════════════════════════════

describe('VOCALIA_ORIGINS', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(VOCALIA_ORIGINS));
    assert.ok(VOCALIA_ORIGINS.length >= 3);
  });

  it('contains vocalia.ma', () => {
    assert.ok(VOCALIA_ORIGINS.includes('https://vocalia.ma'));
  });

  it('contains www.vocalia.ma', () => {
    assert.ok(VOCALIA_ORIGINS.includes('https://www.vocalia.ma'));
  });

  it('contains api.vocalia.ma', () => {
    assert.ok(VOCALIA_ORIGINS.includes('https://api.vocalia.ma'));
  });

  it('all entries are HTTPS', () => {
    for (const origin of VOCALIA_ORIGINS) {
      assert.ok(origin.startsWith('https://'), `Expected HTTPS: ${origin}`);
    }
  });

  it('no trailing slashes', () => {
    for (const origin of VOCALIA_ORIGINS) {
      assert.ok(!origin.endsWith('/'), `Unexpected trailing slash: ${origin}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: loadTenantOrigins
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadTenantOrigins()', () => {
  it('loads without error', () => {
    assert.doesNotThrow(() => loadTenantOrigins());
  });

  it('populates the registry', () => {
    loadTenantOrigins();
    const registry = getRegistry();
    assert.ok(registry !== null);
    assert.ok(typeof registry === 'object');
  });

  it('registry contains known tenants', () => {
    const registry = getRegistry();
    assert.ok('agency_internal' in registry);
  });

  it('registry has tenant with allowed_origins', () => {
    const registry = getRegistry();
    const agency = registry.agency_internal;
    assert.ok(Array.isArray(agency.allowed_origins));
    assert.ok(agency.allowed_origins.length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: isOriginAllowed
// ═══════════════════════════════════════════════════════════════════════════════

describe('isOriginAllowed()', () => {
  before(() => loadTenantOrigins());

  // VOCALIA internal origins
  it('allows https://vocalia.ma', () => {
    assert.equal(isOriginAllowed('https://vocalia.ma'), true);
  });

  it('allows https://www.vocalia.ma', () => {
    assert.equal(isOriginAllowed('https://www.vocalia.ma'), true);
  });

  it('allows https://api.vocalia.ma', () => {
    assert.equal(isOriginAllowed('https://api.vocalia.ma'), true);
  });

  // Subdomain wildcard
  it('allows any *.vocalia.ma subdomain', () => {
    assert.equal(isOriginAllowed('https://staging.vocalia.ma'), true);
    assert.equal(isOriginAllowed('https://test.vocalia.ma'), true);
  });

  // Localhost for dev
  it('allows http://localhost', () => {
    assert.equal(isOriginAllowed('http://localhost'), true);
    assert.equal(isOriginAllowed('http://localhost:3000'), true);
    assert.equal(isOriginAllowed('http://localhost:8080'), true);
  });

  it('allows http://127.0.0.1', () => {
    assert.equal(isOriginAllowed('http://127.0.0.1'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:5173'), true);
  });

  // Tenant registered origins
  it('allows a tenant-registered origin', () => {
    const registry = getRegistry();
    const ecom = registry.ecom_nike_01;
    if (ecom && ecom.allowed_origins && ecom.allowed_origins.length > 0) {
      const tenantOrigin = ecom.allowed_origins.find(o => !o.includes('vocalia.ma'));
      if (tenantOrigin) {
        assert.equal(isOriginAllowed(tenantOrigin.replace(/\/$/, '')), true);
      }
    }
  });

  // Blocked origins
  it('rejects null/undefined origin', () => {
    assert.equal(isOriginAllowed(null), false);
    assert.equal(isOriginAllowed(undefined), false);
  });

  it('rejects empty string', () => {
    assert.equal(isOriginAllowed(''), false);
  });

  it('rejects random external origin', () => {
    assert.equal(isOriginAllowed('https://evil-site.com'), false);
  });

  it('rejects http://attacker.vocalia.ma.evil.com', () => {
    // Should NOT match *.vocalia.ma because the actual domain is evil.com
    assert.equal(isOriginAllowed('http://attacker.vocalia.ma.evil.com'), false);
  });

  it('rejects https://notvocalia.ma', () => {
    assert.equal(isOriginAllowed('https://notvocalia.ma'), false);
  });

  it('rejects https://localhost (HTTPS, not HTTP)', () => {
    // The code checks http://localhost specifically
    assert.equal(isOriginAllowed('https://localhost'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: validateOriginTenant — cross-validation origin↔tenant
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateOriginTenant()', () => {
  before(() => loadTenantOrigins());

  it('valid for default tenantId (bypass)', () => {
    const result = validateOriginTenant('https://evil.com', 'default');
    assert.equal(result.valid, true);
  });

  it('valid for null tenantId (bypass)', () => {
    const result = validateOriginTenant('https://evil.com', null);
    assert.equal(result.valid, true);
  });

  it('valid for server-to-server (no origin)', () => {
    const result = validateOriginTenant(null, 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid for localhost origin', () => {
    const result = validateOriginTenant('http://localhost:3000', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid for 127.0.0.1 origin', () => {
    const result = validateOriginTenant('http://127.0.0.1:5173', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid for vocalia.ma origin (any tenant)', () => {
    const result = validateOriginTenant('https://vocalia.ma', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid for vocalia.ma subdomain (any tenant)', () => {
    const result = validateOriginTenant('https://staging.vocalia.ma', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid when origin matches tenant allowed_origins', () => {
    // agency_internal has allowed_origins: ["https://vocalia.ma", "https://www.vocalia.ma"]
    const result = validateOriginTenant('https://vocalia.ma', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('invalid for unknown tenant', () => {
    const result = validateOriginTenant('https://external-site.com', 'nonexistent_tenant_xyz');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'unknown_tenant');
  });

  it('invalid when origin does not match tenant allowed_origins', () => {
    // ecom_nike_01 has allowed_origins: ["https://nike-reseller-paris.com", "https://vocalia.ma"]
    // Using a completely unrelated origin that isn't in VOCALIA_ORIGINS
    const result = validateOriginTenant('https://competitor-store.com', 'ecom_nike_01');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'origin_mismatch');
  });

  it('normalizes trailing slashes', () => {
    // Origin with trailing slash should still match
    const result = validateOriginTenant('https://vocalia.ma/', 'agency_internal');
    assert.equal(result.valid, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: validateApiKey — timing-safe comparison
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateApiKey()', () => {
  before(() => loadTenantOrigins());

  it('valid when no API key provided (backward compat)', () => {
    const result = validateApiKey(null, 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid when no API key provided (undefined)', () => {
    const result = validateApiKey(undefined, 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('valid when tenantId is default', () => {
    const result = validateApiKey('some_key', 'default');
    assert.equal(result.valid, true);
  });

  it('valid when tenantId is null', () => {
    const result = validateApiKey('some_key', null);
    assert.equal(result.valid, true);
  });

  it('valid with correct API key for tenant', () => {
    const registry = getRegistry();
    const tenant = registry.agency_internal;
    if (tenant && tenant.api_key) {
      const result = validateApiKey(tenant.api_key, 'agency_internal');
      assert.equal(result.valid, true);
    }
  });

  it('invalid with wrong API key for tenant', () => {
    const registry = getRegistry();
    const tenant = registry.agency_internal;
    if (tenant && tenant.api_key) {
      const result = validateApiKey('vk_wrong_key_completely_fake_00000000000000000000', 'agency_internal');
      assert.equal(result.valid, false);
      assert.equal(result.reason, 'invalid_api_key');
    }
  });

  it('invalid for unknown tenant with API key', () => {
    const result = validateApiKey('some_key', 'nonexistent_tenant_xyz');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'unknown_tenant');
  });

  it('valid when tenant has no API key configured', () => {
    // Find a tenant without api_key or create a scenario
    const registry = getRegistry();
    const tenantWithoutKey = Object.entries(registry).find(([, v]) => !v.api_key);
    if (tenantWithoutKey) {
      const result = validateApiKey('any_key', tenantWithoutKey[0]);
      assert.equal(result.valid, true);
    }
  });

  it('rejects key with wrong length (timing-safe requires equal length)', () => {
    const registry = getRegistry();
    const tenant = registry.agency_internal;
    if (tenant && tenant.api_key) {
      // Different length = immediate false (before timingSafeEqual)
      const result = validateApiKey('short', 'agency_internal');
      assert.equal(result.valid, false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: getCorsHeaders
// ═══════════════════════════════════════════════════════════════════════════════

describe('getCorsHeaders()', () => {
  before(() => loadTenantOrigins());

  it('returns correct headers for allowed origin', () => {
    const req = { headers: { origin: 'https://vocalia.ma' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://vocalia.ma');
    assert.ok(headers['Access-Control-Allow-Methods'].includes('GET'));
    assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'));
    assert.ok(headers['Access-Control-Allow-Headers'].includes('Content-Type'));
  });

  it('falls back to vocalia.ma for unknown origin', () => {
    const req = { headers: { origin: 'https://evil.com' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Access-Control-Allow-Origin'], VOCALIA_ORIGINS[0]);
  });

  it('falls back to vocalia.ma for missing origin', () => {
    const req = { headers: {} };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Access-Control-Allow-Origin'], VOCALIA_ORIGINS[0]);
  });

  it('includes security headers', () => {
    const req = { headers: { origin: 'https://vocalia.ma' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.ok(headers['Strict-Transport-Security'].includes('max-age'));
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  });

  it('sets Content-Type to application/json', () => {
    const req = { headers: { origin: 'https://vocalia.ma' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('handles null req gracefully', () => {
    const headers = getCorsHeaders(null);
    assert.ok(headers['Access-Control-Allow-Origin']);
  });

  it('handles req without headers', () => {
    const headers = getCorsHeaders({});
    assert.ok(headers['Access-Control-Allow-Origin']);
  });

  it('reflects localhost origin when allowed', () => {
    const req = { headers: { origin: 'http://localhost:3000' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: getRegistry
// ═══════════════════════════════════════════════════════════════════════════════

describe('getRegistry()', () => {
  it('returns an object', () => {
    const registry = getRegistry();
    assert.ok(typeof registry === 'object');
    assert.ok(registry !== null);
  });

  it('contains expected tenant structure', () => {
    const registry = getRegistry();
    const first = Object.values(registry)[0];
    assert.ok('name' in first);
    assert.ok('sector' in first);
  });

  it('returns same reference on consecutive calls (cached)', () => {
    const r1 = getRegistry();
    const r2 = getRegistry();
    assert.equal(r1, r2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Integration chains
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration chains', () => {
  before(() => loadTenantOrigins());

  it('load → isAllowed(tenantOrigin) → true', () => {
    const registry = getRegistry();
    const ecom = registry.ecom_nike_01;
    if (ecom && ecom.allowed_origins) {
      const externalOrigin = ecom.allowed_origins.find(o => !o.includes('vocalia.ma'));
      if (externalOrigin) {
        assert.equal(isOriginAllowed(externalOrigin.replace(/\/$/, '')), true);
      }
    }
  });

  it('load → isAllowed(randomOrigin) → false', () => {
    assert.equal(isOriginAllowed('https://random-not-registered-site.xyz'), false);
  });

  it('load → validateOriginTenant correct pair → valid', () => {
    const result = validateOriginTenant('https://vocalia.ma', 'agency_internal');
    assert.equal(result.valid, true);
  });

  it('load → validateOriginTenant wrong pair → invalid', () => {
    const result = validateOriginTenant('https://competitor-store.com', 'ecom_nike_01');
    assert.equal(result.valid, false);
  });

  it('load → validateApiKey correct → valid', () => {
    const registry = getRegistry();
    const agency = registry.agency_internal;
    if (agency && agency.api_key) {
      const result = validateApiKey(agency.api_key, 'agency_internal');
      assert.equal(result.valid, true);
    }
  });

  it('load → validateApiKey wrong → invalid', () => {
    const registry = getRegistry();
    const agency = registry.agency_internal;
    if (agency && agency.api_key) {
      const wrongKey = 'vk_' + '0'.repeat(agency.api_key.length - 3);
      const result = validateApiKey(wrongKey, 'agency_internal');
      assert.equal(result.valid, false);
    }
  });

  it('getCorsHeaders reflects allowed origin correctly', () => {
    const req = { headers: { origin: 'https://api.vocalia.ma' } };
    const headers = getCorsHeaders(req);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://api.vocalia.ma');
  });
});
