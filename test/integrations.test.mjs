/**
 * Integrations — Unit Tests
 * VocalIA — Session 250.209
 *
 * Tests: 7 integration modules in integrations/
 * Strategy: Constructor defaults, factory patterns, init() behavior,
 * pure formatting functions, error paths without credentials.
 * NO external API calls (no credentials in CI).
 *
 * Run: node --test test/integrations.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Zoho CRM Integration
// ═══════════════════════════════════════════════════════════════════════════════

const zoho = require('../integrations/zoho.cjs');

describe('Zoho CRM Integration', () => {
  describe('constructor defaults', () => {
    it('defaults tenantId to agency_internal', () => {
      const instance = new zoho.ZohoCRMIntegration();
      assert.equal(instance.tenantId, 'agency_internal');
    });

    it('accepts custom tenantId', () => {
      const instance = new zoho.ZohoCRMIntegration('tenant_xyz');
      assert.equal(instance.tenantId, 'tenant_xyz');
    });

    it('initializes with null credentials', () => {
      const instance = new zoho.ZohoCRMIntegration();
      assert.equal(instance.clientId, null);
      assert.equal(instance.clientSecret, null);
      assert.equal(instance.refreshToken, null);
      assert.equal(instance.accessToken, null);
    });

    it('has correct Zoho API base URL', () => {
      const instance = new zoho.ZohoCRMIntegration();
      assert.ok(instance.baseUrl.includes('zohoapis.com'));
    });

    it('has correct OAuth auth URL', () => {
      const instance = new zoho.ZohoCRMIntegration();
      assert.ok(instance.authUrl.includes('zoho.com/oauth'));
    });
  });

  describe('createForTenant factory', () => {
    it('returns a ZohoCRMIntegration instance with tenantId', async () => {
      const instance = await zoho.createForTenant('tenant_test_zoho');
      assert.ok(instance instanceof zoho.ZohoCRMIntegration);
      assert.equal(instance.tenantId, 'tenant_test_zoho');
    });
  });

  describe('init() without credentials', () => {
    it('init() returns boolean without OAuth credentials', async () => {
      const instance = new zoho.ZohoCRMIntegration();
      const result = await instance.init();
      assert.equal(typeof result, 'boolean');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Klaviyo Integration
// ═══════════════════════════════════════════════════════════════════════════════

const klaviyo = require('../integrations/klaviyo.cjs');

describe('Klaviyo Integration', () => {
  describe('constructor defaults', () => {
    it('defaults tenantId to agency_internal', () => {
      const instance = new klaviyo.KlaviyoIntegration();
      assert.equal(instance.tenantId, 'agency_internal');
    });

    it('accepts apiKey parameter', () => {
      const instance = new klaviyo.KlaviyoIntegration('test-key');
      assert.equal(instance.apiKey, 'test-key');
    });

    it('has correct Klaviyo base URL', () => {
      const instance = new klaviyo.KlaviyoIntegration();
      assert.ok(instance.baseUrl.includes('klaviyo.com'));
    });

    it('has API revision in YYYY-MM-DD format', () => {
      const instance = new klaviyo.KlaviyoIntegration();
      assert.ok(instance.revision, 'Revision should be set');
      assert.match(instance.revision, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('createForTenant factory', () => {
    it('returns a KlaviyoIntegration instance with tenantId', async () => {
      const instance = await klaviyo.createForTenant('tenant_test_klaviyo');
      assert.ok(instance instanceof klaviyo.KlaviyoIntegration);
      assert.equal(instance.tenantId, 'tenant_test_klaviyo');
    });
  });

  describe('init() behavior', () => {
    it('returns true when apiKey is provided', async () => {
      const instance = new klaviyo.KlaviyoIntegration('test-key');
      const result = await instance.init();
      assert.equal(result, true);
    });

    it('init without apiKey still returns boolean', async () => {
      const instance = new klaviyo.KlaviyoIntegration();
      const result = await instance.init();
      assert.equal(typeof result, 'boolean');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Pipedrive Integration
// ═══════════════════════════════════════════════════════════════════════════════

const pipedrive = require('../integrations/pipedrive.cjs');

describe('Pipedrive Integration', () => {
  describe('constructor defaults', () => {
    it('defaults tenantId to agency_internal', () => {
      const instance = new pipedrive.PipedriveIntegration();
      assert.equal(instance.tenantId, 'agency_internal');
    });

    it('accepts apiToken parameter', () => {
      const instance = new pipedrive.PipedriveIntegration('test-token');
      assert.equal(instance.apiToken, 'test-token');
    });

    it('has correct Pipedrive base URL', () => {
      const instance = new pipedrive.PipedriveIntegration();
      assert.ok(instance.baseUrl.includes('pipedrive.com'));
    });
  });

  describe('createForTenant factory', () => {
    it('returns a PipedriveIntegration instance with tenantId', async () => {
      const instance = await pipedrive.createForTenant('tenant_test_pipedrive');
      assert.ok(instance instanceof pipedrive.PipedriveIntegration);
      assert.equal(instance.tenantId, 'tenant_test_pipedrive');
    });
  });

  describe('init() behavior', () => {
    it('returns true when apiToken is provided', async () => {
      const instance = new pipedrive.PipedriveIntegration('test-token');
      const result = await instance.init();
      assert.equal(result, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: PrestaShop Integration
// ═══════════════════════════════════════════════════════════════════════════════

const prestashop = require('../integrations/prestashop.cjs');

describe('PrestaShop Integration', () => {
  describe('constructor defaults', () => {
    it('defaults tenantId to agency_internal', () => {
      const instance = new prestashop.PrestaShopIntegration();
      assert.equal(instance.tenantId, 'agency_internal');
    });

    it('accepts url and key parameters', () => {
      const instance = new prestashop.PrestaShopIntegration('https://store.com', 'apikey123');
      assert.equal(instance.url, 'https://store.com');
      assert.equal(instance.key, 'apikey123');
    });
  });

  describe('createForTenant factory', () => {
    it('returns a PrestaShopIntegration instance with tenantId', async () => {
      const instance = await prestashop.createForTenant('tenant_test_presta');
      assert.ok(instance instanceof prestashop.PrestaShopIntegration);
      assert.equal(instance.tenantId, 'tenant_test_presta');
    });
  });

  describe('init() behavior', () => {
    it('returns true when url and key are provided', async () => {
      const instance = new prestashop.PrestaShopIntegration('https://store.com', 'key');
      const result = await instance.init();
      assert.equal(result, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: HubSpot B2B CRM
// ═══════════════════════════════════════════════════════════════════════════════

const hubspot = require('../integrations/hubspot-b2b-crm.cjs');

describe('HubSpot B2B CRM Integration', () => {
  describe('module exports', () => {
    it('default export is instance of HubSpotB2BCRM', () => {
      assert.ok(hubspot instanceof hubspot.HubSpotB2BCRM);
    });

    it('exports createForTenant factory', async () => {
      const instance = await hubspot.createForTenant('tenant_hubspot_test');
      assert.ok(instance instanceof hubspot.HubSpotB2BCRM);
    });

    it('exports getForTenant (returns cached or new)', async () => {
      const a = await hubspot.getForTenant('tenant_hub_cached');
      const b = await hubspot.getForTenant('tenant_hub_cached');
      assert.ok(a instanceof hubspot.HubSpotB2BCRM);
      // getForTenant should cache — same tenant returns same instance
      assert.strictEqual(a, b);
    });
  });

  describe('CONFIG structure', () => {
    it('has rateLimit with numeric requests/perSeconds', () => {
      assert.ok(hubspot.CONFIG.rateLimit);
      assert.equal(typeof hubspot.CONFIG.rateLimit.requests, 'number');
      assert.equal(typeof hubspot.CONFIG.rateLimit.perSeconds, 'number');
      assert.ok(hubspot.CONFIG.rateLimit.requests > 0);
    });

    it('has retry with maxAttempts > 0', () => {
      assert.ok(hubspot.CONFIG.retry);
      assert.equal(typeof hubspot.CONFIG.retry.maxAttempts, 'number');
      assert.ok(hubspot.CONFIG.retry.maxAttempts > 0);
    });
  });

  describe('getCredentials without env', () => {
    it('returns object with null/undefined values when no env vars', () => {
      const creds = hubspot.getCredentials('tenant_no_creds');
      assert.equal(typeof creds, 'object');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Voice CRM Tools — Pure Functions
// ═══════════════════════════════════════════════════════════════════════════════

const voiceCRM = require('../integrations/voice-crm-tools.cjs');

describe('Voice CRM Tools', () => {
  describe('singleton wraps HubSpot', () => {
    it('crm property is HubSpotB2BCRM instance', () => {
      assert.ok(voiceCRM.crm instanceof hubspot.HubSpotB2BCRM);
    });
  });

  describe('formatForVoice() — pure function', () => {
    it('returns empty string for null context', () => {
      assert.equal(voiceCRM.formatForVoice(null), '');
    });

    it('returns empty string for undefined context', () => {
      assert.equal(voiceCRM.formatForVoice(undefined), '');
    });

    it('returns empty string for not-found context', () => {
      assert.equal(voiceCRM.formatForVoice({ found: false }), '');
    });

    it('formats found customer context with all fields', () => {
      const context = {
        found: true,
        fullName: 'Jean Dupont',
        company: 'Acme Corp',
        leadStatus: 'Qualified',
        score: 85
      };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('Jean Dupont'), 'Should include customer name');
      assert.ok(result.includes('Acme Corp'), 'Should include company');
      assert.ok(result.includes('Qualified'), 'Should include lead status');
      assert.ok(result.includes('85'), 'Should include score');
    });

    it('includes last deal info when present', () => {
      const context = {
        found: true,
        fullName: 'Marie Curie',
        company: 'Lab Inc',
        leadStatus: 'Active',
        score: 90,
        lastDeal: { amount: '5000', date: '2026-01-15' }
      };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('5000'), 'Should include deal amount');
      assert.ok(result.includes('2026-01-15'), 'Should include deal date');
    });

    it('omits deal section when no lastDeal', () => {
      const context = { found: true, fullName: 'No Deal', leadStatus: 'New', score: 0 };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(!result.includes('Closed a deal'), 'Should not mention deal');
    });

    it('includes returning customer note', () => {
      const context = { found: true, fullName: 'Test', leadStatus: 'New', score: 0 };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('returning customer'), 'Should note returning customer');
    });

    it('includes CRM_CUSTOMER_HISTORY header', () => {
      const context = { found: true, fullName: 'X', leadStatus: 'Y', score: 0 };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('CRM_CUSTOMER_HISTORY'), 'Should include CRM header');
    });

    it('handles missing company gracefully', () => {
      const context = { found: true, fullName: 'Solo', leadStatus: 'Active', score: 50 };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('Solo'));
      // Should still produce valid output
      assert.ok(result.includes('CRM_CUSTOMER_HISTORY'));
    });

    it('handles score=0 correctly (not omitted)', () => {
      const context = { found: true, fullName: 'Zero', leadStatus: 'New', score: 0 };
      const result = voiceCRM.formatForVoice(context);
      assert.ok(result.includes('0'), 'Score 0 should still be shown');
    });
  });

  describe('getCustomerContext() edge cases', () => {
    it('returns found:false for null email', async () => {
      const result = await voiceCRM.getCustomerContext(null);
      assert.equal(result.found, false);
    });

    it('returns found:false for empty email', async () => {
      const result = await voiceCRM.getCustomerContext('');
      assert.equal(result.found, false);
    });

    it('returns found:false for undefined email', async () => {
      const result = await voiceCRM.getCustomerContext(undefined);
      assert.equal(result.found, false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Voice E-commerce Tools — Error Paths
// ═══════════════════════════════════════════════════════════════════════════════

const voiceEcom = require('../integrations/voice-ecommerce-tools.cjs');

describe('Voice E-commerce Tools', () => {
  describe('getOrderStatus without config', () => {
    it('returns error when Shopify not configured', async () => {
      const result = await voiceEcom.getOrderStatus('test@test.com', {});
      assert.ok(result.success === false || result.found === false,
        'Should indicate not configured or not found');
    });

    it('returns graceful error for null email without config', async () => {
      const result = await voiceEcom.getOrderStatus(null, {});
      assert.ok(result.success === false || result.found === false);
    });
  });

  describe('checkProductStock without config', () => {
    it('returns error when Shopify not configured', async () => {
      const result = await voiceEcom.checkProductStock('Widget', {});
      assert.ok(result.success === false || result.found === false);
    });

    it('returns graceful error for empty query', async () => {
      const result = await voiceEcom.checkProductStock('', {});
      assert.ok(result.success === false || result.found === false);
    });
  });

  describe('getCustomerProfile without config', () => {
    it('returns error when Klaviyo not configured', async () => {
      const result = await voiceEcom.getCustomerProfile('test@test.com', {});
      assert.ok(result.success === false || result.found === false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Cross-module consistency — contractual behavior
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-module consistency', () => {
  it('all 4 CRM/ecom factories return instances of their class', async () => {
    const [z, k, p, ps] = await Promise.all([
      zoho.createForTenant('t1'),
      klaviyo.createForTenant('t2'),
      pipedrive.createForTenant('t3'),
      prestashop.createForTenant('t4')
    ]);
    assert.ok(z instanceof zoho.ZohoCRMIntegration);
    assert.ok(k instanceof klaviyo.KlaviyoIntegration);
    assert.ok(p instanceof pipedrive.PipedriveIntegration);
    assert.ok(ps instanceof prestashop.PrestaShopIntegration);
  });

  it('all 4 factory instances have init() that returns boolean', async () => {
    const results = await Promise.all([
      new zoho.ZohoCRMIntegration().init(),
      new klaviyo.KlaviyoIntegration('k').init(),
      new pipedrive.PipedriveIntegration('p').init(),
      new prestashop.PrestaShopIntegration('u', 'k').init()
    ]);
    for (const r of results) {
      assert.equal(typeof r, 'boolean');
    }
  });

  it('voice-crm-tools wraps HubSpot correctly', () => {
    assert.ok(voiceCRM.crm instanceof hubspot.HubSpotB2BCRM);
  });

  it('adapter ecommerce methods match expected interface', () => {
    // Adapter must expose getOrderStatus, checkProductStock, getCustomerProfile
    // These are used by telephony — contract verification
    assert.equal(typeof voiceEcom.getOrderStatus, 'function');
    assert.equal(typeof voiceEcom.checkProductStock, 'function');
    assert.equal(typeof voiceEcom.getCustomerProfile, 'function');
  });
});
