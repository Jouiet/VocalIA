/**
 * VocalIA Module Loader Tests — T1
 *
 * Detects: module-scope crashes, missing exports, singleton vs class confusion,
 * circular require deadlocks, missing path/fs imports, JSON.parse without try/catch.
 *
 * Historical bugs caught: D1 destructuring (5), F19/F20 path/fs (2), V2 circular (1),
 * F22/F23 JSON.parse (2), module-scope crashes (~15) = ~25 bugs.
 *
 * Run: node --test test/module-loader.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── Helper: safely require a module ─────────────────────────────────────────

function safeRequire(modulePath) {
  try {
    return { module: require(modulePath), error: null };
  } catch (e) {
    return { module: null, error: e };
  }
}

// ─── Core modules that export objects/instances ──────────────────────────────

const CORE_MODULES = [
  // Singletons (export instance with methods)
  {
    path: '../core/SecretVault.cjs',
    name: 'SecretVault',
    type: 'singleton',
    expectedMethods: ['loadCredentials', 'getSecret', 'encrypt', 'decrypt', 'healthCheck'],
    classExport: 'SecretVault'
  },
  {
    path: '../core/AgencyEventBus.cjs',
    name: 'AgencyEventBus',
    type: 'singleton',
    expectedMethods: ['publish', 'subscribe', 'unsubscribe', 'getMetrics'],
    classExport: 'AgencyEventBus'
  },
  {
    path: '../core/BillingAgent.cjs',
    name: 'BillingAgent',
    type: 'singleton',
    expectedMethods: ['processSessionBilling', 'getAgentCard', 'getState'],
    classExport: 'BillingAgent'
  },
  {
    path: '../core/ContextBox.cjs',
    name: 'ContextBox',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'ContextBox'
  },
  {
    path: '../core/ErrorScience.cjs',
    name: 'ErrorScience',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'ErrorScience'
  },
  {
    path: '../core/RevenueScience.cjs',
    name: 'RevenueScience',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'RevenueScience'
  },
  {
    path: '../core/OAuthGateway.cjs',
    name: 'OAuthGateway',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'OAuthGateway'
  },
  {
    path: '../core/WebhookRouter.cjs',
    name: 'WebhookRouter',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'WebhookRouter'
  },
  {
    path: '../core/vector-store.cjs',
    name: 'vector-store',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'VectorStore'
  },
  {
    path: '../core/compliance-guardian.cjs',
    name: 'compliance-guardian',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/kling-service.cjs',
    name: 'kling-service',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/knowledge-embedding-service.cjs',
    name: 'knowledge-embedding-service',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/product-embedding-service.cjs',
    name: 'product-embedding-service',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'ProductEmbeddingService'
  },
  {
    path: '../core/recommendation-service.cjs',
    name: 'recommendation-service',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'RecommendationService'
  },
  {
    path: '../core/translation-supervisor.cjs',
    name: 'translation-supervisor',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/TenantOnboardingAgent.cjs',
    name: 'TenantOnboardingAgent',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/StripeService.cjs',
    name: 'StripeService',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/veo-service.cjs',
    name: 'veo-service',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../core/a2ui-service.cjs',
    name: 'a2ui-service',
    type: 'singleton',
    expectedMethods: []
  },

  // Object exports (export { fn1, fn2, ... })
  {
    path: '../core/auth-service.cjs',
    name: 'auth-service',
    type: 'object',
    expectedMethods: ['register', 'login', 'verifyAccessToken', 'getCurrentUser', 'loginWithOAuth']
  },
  {
    path: '../core/auth-middleware.cjs',
    name: 'auth-middleware',
    type: 'object',
    expectedMethods: ['requireAuth', 'requireRole', 'requireTenant', 'requireAdmin', 'extractToken', 'rateLimit']
  },
  {
    path: '../core/db-api.cjs',
    name: 'db-api',
    type: 'object',
    expectedMethods: ['handleRequest', 'startServer', 'parseBody', 'sendJson', 'sendError', 'provisionTenant']
  },
  {
    path: '../core/voice-api-resilient.cjs',
    name: 'voice-api-resilient',
    type: 'object',
    expectedMethods: ['getResilisentResponse', 'sanitizeInput', 'calculateLeadScore', 'checkFeature']
  },
  {
    path: '../core/voice-api-utils.cjs',
    name: 'voice-api-utils',
    type: 'object',
    expectedMethods: ['sanitizeTenantId']
  },
  {
    path: '../core/voice-ecommerce-tools.cjs',
    name: 'voice-ecommerce-tools',
    type: 'object',
    expectedMethods: ['checkOrderStatus', 'checkStock', 'recommendProducts']
  },
  {
    path: '../core/voice-crm-tools.cjs',
    name: 'voice-crm-tools',
    type: 'object',
    expectedMethods: ['lookupCustomer', 'createLead', 'updateCustomer', 'logCall']
  },
  {
    path: '../core/conversation-store.cjs',
    name: 'conversation-store',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/ucp-store.cjs',
    name: 'ucp-store',
    type: 'object',
    expectedMethods: ['getInstance', 'getLTVTier']
  },
  {
    path: '../core/tenant-kb-loader.cjs',
    name: 'tenant-kb-loader',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/tenant-catalog-store.cjs',
    name: 'tenant-catalog-store',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/kb-quotas.cjs',
    name: 'kb-quotas',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/GoogleSheetsDB.cjs',
    name: 'GoogleSheetsDB',
    type: 'object',
    expectedMethods: ['getDB']
  },
  {
    path: '../core/catalog-connector.cjs',
    name: 'catalog-connector',
    type: 'object',
    expectedMethods: ['CatalogConnector', 'CatalogConnectorFactory']
  },
  {
    path: '../core/tenant-cors.cjs',
    name: 'tenant-cors',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/audit-store.cjs',
    name: 'audit-store',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/ab-analytics.cjs',
    name: 'ab-analytics',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/calendar-slots-connector.cjs',
    name: 'calendar-slots-connector',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/chaos-engineering.cjs',
    name: 'chaos-engineering',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/email-service.cjs',
    name: 'email-service',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/elevenlabs-client.cjs',
    name: 'elevenlabs-client',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/grok-client.cjs',
    name: 'grok-client',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/grok-voice-realtime.cjs',
    name: 'grok-voice-realtime',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/hybrid-rag.cjs',
    name: 'hybrid-rag',
    type: 'object',
    expectedMethods: ['getInstance']
  },
  {
    path: '../core/kb-crawler.cjs',
    name: 'kb-crawler',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/kb-parser.cjs',
    name: 'kb-parser',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/kb-provisioner.cjs',
    name: 'kb-provisioner',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/knowledge-base-services.cjs',
    name: 'knowledge-base-services',
    type: 'object',
    expectedMethods: ['ServiceKnowledgeBase']
  },
  {
    path: '../core/lahajati-client.cjs',
    name: 'lahajati-client',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/remotion-hitl.cjs',
    name: 'remotion-hitl',
    type: 'object',
    expectedMethods: ['queueVideo', 'getPending', 'getVideo', 'approveVideo', 'rejectVideo', 'startServer']
  },
  {
    path: '../core/remotion-service.cjs',
    name: 'remotion-service',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/stitch-to-vocalia-css.cjs',
    name: 'stitch-to-vocalia-css',
    type: 'object',
    expectedMethods: ['convertStitchToVocalIA']
  },
  {
    path: '../core/tenant-persona-bridge.cjs',
    name: 'tenant-persona-bridge',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../core/voice-agent-b2b.cjs',
    name: 'voice-agent-b2b',
    type: 'object',
    expectedMethods: ['VoiceAgentB2B']
  },

  // Class constructors
  {
    path: '../core/TenantContext.cjs',
    name: 'TenantContext',
    type: 'class',
    expectedMethods: []
  },
  {
    path: '../core/TenantLogger.cjs',
    name: 'TenantLogger',
    type: 'class',
    expectedMethods: []
  },
  {
    path: '../core/client-registry.cjs',
    name: 'client-registry',
    type: 'class',
    expectedMethods: []
  },
  {
    path: '../core/marketing-science-core.cjs',
    name: 'marketing-science-core',
    type: 'class',
    expectedMethods: []
  }
];

// Non-core modules
const OTHER_MODULES = [
  {
    path: '../telephony/voice-telephony-bridge.cjs',
    name: 'voice-telephony-bridge',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../integrations/hubspot-b2b-crm.cjs',
    name: 'hubspot-b2b-crm',
    type: 'singleton',
    expectedMethods: [],
    classExport: 'HubSpotB2BCRM'
  },
  {
    path: '../integrations/klaviyo.cjs',
    name: 'klaviyo',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../integrations/pipedrive.cjs',
    name: 'pipedrive',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../integrations/prestashop.cjs',
    name: 'prestashop',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../integrations/voice-crm-tools.cjs',
    name: 'integrations/voice-crm-tools',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../integrations/voice-ecommerce-tools.cjs',
    name: 'integrations/voice-ecommerce-tools',
    type: 'singleton',
    expectedMethods: []
  },
  {
    path: '../integrations/zoho.cjs',
    name: 'zoho',
    type: 'object',
    expectedMethods: []
  },
  {
    path: '../personas/voice-persona-injector.cjs',
    name: 'voice-persona-injector',
    type: 'object',
    expectedMethods: ['VoicePersonaInjector']
  },
  {
    path: '../personas/agency-financial-config.cjs',
    name: 'agency-financial-config',
    type: 'object',
    expectedMethods: []
  },
  // NOTE: sensors/*.cjs are EXCLUDED from require() test because they call main()
  // without `if (require.main === module)` guard — they auto-execute on require().
  // This is a known structural issue (same as stitch-api.cjs).
  // They ARE covered by security-regression T5.2/T5.7/T5.8/T5.12/T5.13 scanners.
  //
  // Lib
  {
    path: '../lib/security-utils.cjs',
    name: 'security-utils',
    type: 'object',
    expectedMethods: []
  }
];

const ALL_MODULES = [...CORE_MODULES, ...OTHER_MODULES];

// ─── T1.1: Module loads without error ────────────────────────────────────────

describe('T1: Module Loader — Core Modules', () => {
  for (const mod of CORE_MODULES) {
    test(`${mod.name} loads without error`, () => {
      const { module: loaded, error } = safeRequire(mod.path);
      assert.strictEqual(error, null, `${mod.name} failed to load: ${error?.message}`);
      assert.ok(loaded !== null && loaded !== undefined, `${mod.name} exports null/undefined`);
    });
  }
});

describe('T1: Module Loader — Non-Core Modules', () => {
  for (const mod of OTHER_MODULES) {
    test(`${mod.name} loads without error`, () => {
      const { module: loaded, error } = safeRequire(mod.path);
      assert.strictEqual(error, null, `${mod.name} failed to load: ${error?.message}`);
      assert.ok(loaded !== null && loaded !== undefined, `${mod.name} exports null/undefined`);
    });
  }
});

// ─── T1.2: Exports are non-empty ─────────────────────────────────────────────

describe('T1: Non-empty exports', () => {
  for (const mod of ALL_MODULES) {
    test(`${mod.name} has non-empty exports`, () => {
      const { module: loaded } = safeRequire(mod.path);
      if (!loaded) return; // skip if load failed (caught by T1.1)

      if (mod.type === 'class') {
        assert.strictEqual(typeof loaded, 'function', `${mod.name} should export a class/constructor`);
      } else if (mod.type === 'singleton') {
        assert.strictEqual(typeof loaded, 'object', `${mod.name} should export an object instance`);
        assert.ok(loaded.constructor && loaded.constructor.name !== 'Object',
          `${mod.name} default export should be a class instance, not plain object`);
      } else if (mod.type === 'script') {
        // Standalone scripts — no module.exports expected, just verify load success
        assert.ok(true, `${mod.name} loaded as standalone script`);
      } else {
        // 'object' type — should have at least one key
        const keys = Object.keys(loaded);
        assert.ok(keys.length > 0, `${mod.name} exports empty object`);
      }
    });
  }
});

// ─── T1.3: Expected methods exist and are functions ──────────────────────────

describe('T1: Expected methods exist', () => {
  for (const mod of ALL_MODULES) {
    if (mod.expectedMethods.length === 0) continue;

    for (const method of mod.expectedMethods) {
      test(`${mod.name}.${method} is a function`, () => {
        const { module: loaded } = safeRequire(mod.path);
        if (!loaded) return;

        if (mod.type === 'singleton') {
          // Method could be on the instance prototype or direct property
          const fn = loaded[method] || (Object.getPrototypeOf(loaded)?.[method]);
          assert.ok(typeof fn === 'function',
            `${mod.name}.${method} should be a function, got ${typeof loaded[method]}`);
        } else {
          assert.strictEqual(typeof loaded[method], 'function',
            `${mod.name}.${method} should be a function, got ${typeof loaded[method]}`);
        }
      });
    }
  }
});

// ─── T1.4: Singleton vs Class — D1 destructuring bug detector ───────────────
// Bug D1: `const { SecretVault } = require(...)` gets the CLASS, not the instance.
// The default export IS the instance. Instance has methods. Class needs `new`.

describe('T1: Singleton default export is INSTANCE not CLASS', () => {
  const singletons = ALL_MODULES.filter(m => m.type === 'singleton' && m.classExport);

  for (const mod of singletons) {
    test(`${mod.name}: default export is instance, .${mod.classExport} is class`, () => {
      const { module: loaded } = safeRequire(mod.path);
      if (!loaded) return;

      // Default export should be an instance (typeof === 'object')
      assert.strictEqual(typeof loaded, 'object',
        `${mod.name} default should be instance (object), got ${typeof loaded}`);

      // Named class export should be a function (constructor)
      const cls = loaded[mod.classExport];
      assert.strictEqual(typeof cls, 'function',
        `${mod.name}.${mod.classExport} should be class (function), got ${typeof cls}`);

      // Instance should be instanceof the class
      assert.ok(loaded instanceof cls,
        `${mod.name} default export should be instanceof ${mod.classExport}`);
    });
  }
});

// ─── T1.5: getInstance factories return proper instances ─────────────────────

describe('T1: getInstance factories', () => {
  const factoryModules = [
    { path: '../core/conversation-store.cjs', name: 'conversation-store', factory: 'getInstance', className: 'ConversationStore' },
    { path: '../core/ucp-store.cjs', name: 'ucp-store', factory: 'getInstance', className: 'UCPStore' },
    { path: '../core/tenant-kb-loader.cjs', name: 'tenant-kb-loader', factory: 'getInstance', className: 'TenantKBLoader' },
    { path: '../core/tenant-catalog-store.cjs', name: 'tenant-catalog-store', factory: 'getInstance', className: 'TenantCatalogStore' },
    { path: '../core/kb-quotas.cjs', name: 'kb-quotas', factory: 'getInstance', className: 'KBQuotaManager' },
    { path: '../core/audit-store.cjs', name: 'audit-store', factory: 'getInstance', className: 'AuditStore' },
    { path: '../core/hybrid-rag.cjs', name: 'hybrid-rag', factory: 'getInstance', className: 'HybridRAG' },
  ];

  for (const mod of factoryModules) {
    test(`${mod.name}.getInstance() returns ${mod.className} instance`, () => {
      const { module: loaded } = safeRequire(mod.path);
      if (!loaded) return;

      assert.strictEqual(typeof loaded[mod.factory], 'function',
        `${mod.name}.${mod.factory} should be a function`);

      const instance = loaded[mod.factory]();
      assert.ok(instance !== null && instance !== undefined,
        `${mod.name}.${mod.factory}() returned null/undefined`);

      // Verify it's a class instance, not a plain object
      assert.ok(instance.constructor && instance.constructor.name !== 'Object',
        `${mod.name}.${mod.factory}() should return a class instance`);

      // Verify class export matches
      if (loaded[mod.className]) {
        assert.ok(instance instanceof loaded[mod.className],
          `${mod.name}.${mod.factory}() should return instanceof ${mod.className}`);
      }
    });
  }
});

// ─── T1.6: No stale class properties on singleton exports ────────────────────
// Catches: require('./SecretVault.cjs').loadCredentials should work directly

describe('T1: Singleton method accessibility', () => {
  test('SecretVault.loadCredentials is accessible on default export', () => {
    const vault = safeRequire('../core/SecretVault.cjs').module;
    if (!vault) return;
    assert.strictEqual(typeof vault.loadCredentials, 'function');
  });

  test('AgencyEventBus.publish is accessible on default export', () => {
    const bus = safeRequire('../core/AgencyEventBus.cjs').module;
    if (!bus) return;
    assert.strictEqual(typeof bus.publish, 'function');
  });

  test('BillingAgent.processSessionBilling is accessible on default export', () => {
    const billing = safeRequire('../core/BillingAgent.cjs').module;
    if (!billing) return;
    assert.strictEqual(typeof billing.processSessionBilling, 'function');
  });
});

// ─── T1.7: Module export constants are present ───────────────────────────────

describe('T1: Named constant exports', () => {
  test('AgencyEventBus exports EVENT_SCHEMAS', () => {
    const m = safeRequire('../core/AgencyEventBus.cjs').module;
    if (!m) return;
    assert.ok(m.EVENT_SCHEMAS && typeof m.EVENT_SCHEMAS === 'object');
  });

  test('BillingAgent exports STATES', () => {
    const m = safeRequire('../core/BillingAgent.cjs').module;
    if (!m) return;
    assert.ok(m.STATES && typeof m.STATES === 'object');
  });

  test('OAuthGateway exports OAUTH_PROVIDERS', () => {
    const m = safeRequire('../core/OAuthGateway.cjs').module;
    if (!m) return;
    assert.ok(m.OAUTH_PROVIDERS && typeof m.OAUTH_PROVIDERS === 'object');
  });

  test('WebhookRouter exports WEBHOOK_PROVIDERS', () => {
    const m = safeRequire('../core/WebhookRouter.cjs').module;
    if (!m) return;
    assert.ok(m.WEBHOOK_PROVIDERS && typeof m.WEBHOOK_PROVIDERS === 'object');
  });

  test('db-api exports PLAN_QUOTAS', () => {
    const m = safeRequire('../core/db-api.cjs').module;
    if (!m) return;
    assert.ok(m.PLAN_QUOTAS && typeof m.PLAN_QUOTAS === 'object');
  });

  test('db-api exports PLAN_FEATURES', () => {
    const m = safeRequire('../core/db-api.cjs').module;
    if (!m) return;
    assert.ok(m.PLAN_FEATURES && typeof m.PLAN_FEATURES === 'object');
  });

  test('db-api exports PLAN_NAME_MAP', () => {
    const m = safeRequire('../core/db-api.cjs').module;
    if (!m) return;
    assert.ok(m.PLAN_NAME_MAP && typeof m.PLAN_NAME_MAP === 'object');
  });

  test('voice-api-resilient exports PLAN_PRICES', () => {
    const m = safeRequire('../core/voice-api-resilient.cjs').module;
    if (!m) return;
    assert.ok(m.PLAN_PRICES && typeof m.PLAN_PRICES === 'object');
  });

  test('voice-api-resilient exports PLAN_FEATURES', () => {
    const m = safeRequire('../core/voice-api-resilient.cjs').module;
    if (!m) return;
    assert.ok(m.PLAN_FEATURES && typeof m.PLAN_FEATURES === 'object');
  });

  test('remotion-hitl exports STATES', () => {
    const m = safeRequire('../core/remotion-hitl.cjs').module;
    if (!m) return;
    assert.ok(m.STATES && typeof m.STATES === 'object');
  });

  test('voice-persona-injector exports PERSONAS', () => {
    const m = safeRequire('../personas/voice-persona-injector.cjs').module;
    if (!m) return;
    assert.ok(m.PERSONAS && typeof m.PERSONAS === 'object');
  });

  test('voice-persona-injector exports SYSTEM_PROMPTS', () => {
    const m = safeRequire('../personas/voice-persona-injector.cjs').module;
    if (!m) return;
    assert.ok(m.SYSTEM_PROMPTS && typeof m.SYSTEM_PROMPTS === 'object');
  });

  test('tenant-kb-loader exports SUPPORTED_LANGUAGES', () => {
    const m = safeRequire('../core/tenant-kb-loader.cjs').module;
    if (!m) return;
    assert.ok(Array.isArray(m.SUPPORTED_LANGUAGES), 'SUPPORTED_LANGUAGES should be array');
    assert.ok(m.SUPPORTED_LANGUAGES.length >= 5, 'Should have at least 5 languages');
  });
});
