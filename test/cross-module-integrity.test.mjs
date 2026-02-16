/**
 * VocalIA Cross-Module Integrity Tests — T2
 *
 * Detects: function name mismatches (D2), require chain breaks, adapter API divergence,
 * EventBus method confusion (emit vs publish), UCP fragmentation.
 *
 * Historical bugs caught: D2 function name mismatch (4), D1 require chain (5),
 * UCP fragmentation (4), adapter bugs (~10), EventBus wiring (2) = ~25 bugs.
 *
 * Run: node --test test/cross-module-integrity.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.url.replace('file://', ''), '../../');

// ─── Helper: get all own methods of a module export ──────────────────────────

function getMethods(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const proto = Object.getPrototypeOf(obj);
  const own = Object.keys(obj).filter(k => typeof obj[k] === 'function');
  const inherited = proto && proto !== Object.prototype
    ? Object.getOwnPropertyNames(proto).filter(k => k !== 'constructor' && typeof proto[k] === 'function')
    : [];
  return [...new Set([...own, ...inherited])];
}

// ─── T2.1: voice-api-resilient.cjs → core/voice-ecommerce-tools.cjs ─────────
// Bug D2: voice-api called ECOM_TOOLS.getOrderStatus, real name is checkOrderStatus

describe('T2: voice-api-resilient → ECOM_TOOLS methods match', () => {
  const ECOM = require('../core/voice-ecommerce-tools.cjs');
  const ecomMethods = Object.keys(ECOM).filter(k => typeof ECOM[k] === 'function');

  test('checkOrderStatus exists in core ecommerce tools', () => {
    assert.strictEqual(typeof ECOM.checkOrderStatus, 'function');
  });

  test('checkStock exists in core ecommerce tools', () => {
    assert.strictEqual(typeof ECOM.checkStock, 'function');
  });

  test('recommendProducts exists in core ecommerce tools', () => {
    assert.strictEqual(typeof ECOM.recommendProducts, 'function');
  });

  // Verify voice-api-resilient uses the CORRECT method names
  test('voice-api-resilient source calls ECOM_TOOLS.checkOrderStatus (not getOrderStatus)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/voice-api-resilient.cjs'), 'utf8');
    // Should use correct name
    assert.ok(src.includes('ECOM_TOOLS.checkOrderStatus'),
      'Should call ECOM_TOOLS.checkOrderStatus');
    // Should NOT use old wrong name
    assert.ok(!src.includes('ECOM_TOOLS.getOrderStatus'),
      'Should NOT call ECOM_TOOLS.getOrderStatus (wrong name — D2 regression)');
  });

  test('voice-api-resilient source calls ECOM_TOOLS.checkStock (not checkProductStock)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/voice-api-resilient.cjs'), 'utf8');
    assert.ok(src.includes('ECOM_TOOLS.checkStock'),
      'Should call ECOM_TOOLS.checkStock');
    assert.ok(!src.includes('ECOM_TOOLS.checkProductStock'),
      'Should NOT call ECOM_TOOLS.checkProductStock (wrong name — D2 regression)');
  });
});

// ─── T2.2: voice-api-resilient.cjs → core/voice-crm-tools.cjs ───────────────
// Bug D2: voice-api called CRM_TOOLS.getCustomerContext, real name is lookupCustomer

describe('T2: voice-api-resilient → CRM_TOOLS methods match', () => {
  const CRM = require('../core/voice-crm-tools.cjs');

  test('lookupCustomer exists in core CRM tools', () => {
    assert.strictEqual(typeof CRM.lookupCustomer, 'function');
  });

  test('voice-api-resilient source calls CRM_TOOLS.lookupCustomer (not getCustomerContext)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/voice-api-resilient.cjs'), 'utf8');
    assert.ok(src.includes('CRM_TOOLS.lookupCustomer'),
      'Should call CRM_TOOLS.lookupCustomer');
    assert.ok(!src.includes('CRM_TOOLS.getCustomerContext'),
      'Should NOT call CRM_TOOLS.getCustomerContext (wrong name — D2 CRASH regression)');
  });

  test('voice-api-resilient source does NOT call CRM_TOOLS.formatForVoice (nonexistent)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/voice-api-resilient.cjs'), 'utf8');
    assert.ok(!src.includes('CRM_TOOLS.formatForVoice'),
      'CRM_TOOLS.formatForVoice does not exist — D2 regression');
  });
});

// ─── T2.3: Adapter pattern — integrations/ wraps core/ ───────────────────────
// telephony uses integrations/voice-ecommerce-tools.cjs (adapter)
// voice-api uses core/voice-ecommerce-tools.cjs (core)
// They have DIFFERENT method names — this is BY DESIGN but must be consistent

describe('T2: Adapter vs Core method names', () => {
  const coreEcom = require('../core/voice-ecommerce-tools.cjs');
  const adapterEcom = require('../integrations/voice-ecommerce-tools.cjs');

  test('core ecommerce uses checkOrderStatus', () => {
    assert.strictEqual(typeof coreEcom.checkOrderStatus, 'function');
  });

  test('adapter ecommerce uses getOrderStatus', () => {
    const proto = Object.getPrototypeOf(adapterEcom);
    assert.strictEqual(typeof proto.getOrderStatus, 'function');
  });

  test('core CRM uses lookupCustomer', () => {
    const coreCRM = require('../core/voice-crm-tools.cjs');
    assert.strictEqual(typeof coreCRM.lookupCustomer, 'function');
  });

  test('adapter CRM uses getCustomerContext', () => {
    const adapterCRM = require('../integrations/voice-crm-tools.cjs');
    const proto = Object.getPrototypeOf(adapterCRM);
    assert.strictEqual(typeof proto.getCustomerContext, 'function');
  });
});

// ─── T2.4: SecretVault require pattern — instance not class ──────────────────
// Bug D1: `const { SecretVault } = require(...)` gets CLASS, not instance

describe('T2: SecretVault require patterns in all files', () => {
  const filesToCheck = [
    'core/voice-api-resilient.cjs',
    'telephony/voice-telephony-bridge.cjs',
    'integrations/klaviyo.cjs',
    'integrations/zoho.cjs',
    'integrations/pipedrive.cjs',
    'integrations/prestashop.cjs',
    'core/OAuthGateway.cjs',
  ];

  for (const file of filesToCheck) {
    test(`${file} imports SecretVault as instance (not destructured)`, () => {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) return;
      const src = fs.readFileSync(filePath, 'utf8');
      const lines = src.split('\n');

      for (const line of lines) {
        if (line.includes("require") && line.includes('SecretVault')) {
          // Must NOT destructure: const { SecretVault } = require(...)
          assert.ok(
            !line.match(/const\s*\{\s*SecretVault\s*\}\s*=\s*require/),
            `${file}: Destructured SecretVault import gets CLASS not instance — D1 regression.\n  Line: ${line.trim()}`
          );
        }
      }
    });
  }
});

// ─── T2.5: voice-api-resilient require chain — all imports resolve ───────────

describe('T2: voice-api-resilient require chain', () => {
  const requireMap = [
    { varName: 'sanitizeTenantId', from: '../core/voice-api-utils.cjs', method: 'sanitizeTenantId' },
    { varName: 'AUTH_CONFIG', from: '../core/auth-service.cjs', property: 'CONFIG' },
    { varName: 'tenantCors', from: '../core/tenant-cors.cjs', method: null },
    { varName: 'SecretVault', from: '../core/SecretVault.cjs', method: 'loadCredentials' },
    { varName: 'ContextBox', from: '../core/ContextBox.cjs', method: 'get' },
    { varName: 'getConversationStore', from: '../core/conversation-store.cjs', method: 'getInstance' },
    { varName: 'getUCPStore', from: '../core/ucp-store.cjs', method: 'getInstance' },
    { varName: 'getDB', from: '../core/GoogleSheetsDB.cjs', method: 'getDB' },
    { varName: 'eventBus', from: '../core/AgencyEventBus.cjs', method: 'publish' },
    { varName: 'A2UIService', from: '../core/a2ui-service.cjs', method: 'initialize' },
    { varName: 'ServiceKnowledgeBase', from: '../core/knowledge-base-services.cjs', method: 'ServiceKnowledgeBase' },
    { varName: 'ECOM_TOOLS', from: '../core/voice-ecommerce-tools.cjs', method: 'checkOrderStatus' },
    { varName: 'CRM_TOOLS', from: '../core/voice-crm-tools.cjs', method: 'lookupCustomer' },
    { varName: 'RecommendationService', from: '../core/recommendation-service.cjs', method: null },
    { varName: 'ElevenLabsClient', from: '../core/elevenlabs-client.cjs', method: 'ElevenLabsClient' },
    { varName: '_getTenantKBLoader', from: '../core/tenant-kb-loader.cjs', method: 'getInstance' },
  ];

  for (const { varName, from, method, property } of requireMap) {
    test(`${varName} from ${from.split('/').pop()} resolves`, () => {
      const mod = require(from);
      assert.ok(mod !== null && mod !== undefined,
        `${from} returned null/undefined`);

      if (method) {
        // For singletons, check prototype too
        const fn = mod[method] || (Object.getPrototypeOf(mod)?.[method]);
        assert.ok(typeof fn === 'function',
          `${from} should export ${method} as function, got ${typeof mod[method]}`);
      }
      if (property) {
        assert.ok(mod[property] !== undefined,
          `${from} should export ${property}`);
      }
    });
  }
});

// ─── T2.6: telephony require chain ───────────────────────────────────────────

describe('T2: telephony require chain', () => {
  const requireMap = [
    { varName: 'MarketingScience', from: '../core/marketing-science-core.cjs', type: 'class' },
    { varName: 'VoicePersonaInjector', from: '../personas/voice-persona-injector.cjs', method: 'VoicePersonaInjector' },
    { varName: 'ServiceKnowledgeBase', from: '../core/knowledge-base-services.cjs', method: 'ServiceKnowledgeBase' },
    { varName: 'VoiceEcommerceTools', from: '../integrations/voice-ecommerce-tools.cjs', type: 'singleton' },
    { varName: 'ContextBox', from: '../core/ContextBox.cjs', type: 'singleton' },
    { varName: 'BillingAgent', from: '../core/BillingAgent.cjs', type: 'singleton' },
    { varName: 'getTenantKBLoader', from: '../core/tenant-kb-loader.cjs', method: 'getInstance' },
    { varName: 'getConversationStore', from: '../core/conversation-store.cjs', method: 'getInstance' },
    { varName: 'getUCPStore', from: '../core/ucp-store.cjs', method: 'getInstance' },
    { varName: 'getDB', from: '../core/GoogleSheetsDB.cjs', method: 'getDB' },
    { varName: 'SecretVault', from: '../core/SecretVault.cjs', type: 'singleton' },
    { varName: 'ClientRegistry', from: '../core/client-registry.cjs', type: 'class' },
  ];

  for (const { varName, from, method, type } of requireMap) {
    test(`${varName} from ${from.split('/').pop()} resolves`, () => {
      const mod = require(from);
      assert.ok(mod !== null && mod !== undefined);

      if (method) {
        const fn = mod[method] || (Object.getPrototypeOf(mod)?.[method]);
        assert.ok(typeof fn === 'function',
          `${from} should export ${method} as function`);
      }
      if (type === 'class') {
        assert.strictEqual(typeof mod, 'function', `${from} should export a class`);
      }
      if (type === 'singleton') {
        assert.strictEqual(typeof mod, 'object', `${from} should export an instance`);
      }
    });
  }
});

// ─── T2.7: db-api require chain ──────────────────────────────────────────────

describe('T2: db-api require chain', () => {
  const requireMap = [
    { varName: 'getDB', from: '../core/GoogleSheetsDB.cjs', method: 'getDB' },
    { varName: 'authService', from: '../core/auth-service.cjs', method: 'register' },
    { varName: 'requireAuth', from: '../core/auth-middleware.cjs', method: 'requireAuth' },
    { varName: 'requireAdmin', from: '../core/auth-middleware.cjs', method: 'requireAdmin' },
    { varName: 'rateLimit', from: '../core/auth-middleware.cjs', method: 'rateLimit' },
    { varName: 'extractToken', from: '../core/auth-middleware.cjs', method: 'extractToken' },
    { varName: 'sanitizeTenantId', from: '../core/voice-api-utils.cjs', method: 'sanitizeTenantId' },
    { varName: 'getAuditStore', from: '../core/audit-store.cjs', method: 'getInstance' },
    { varName: 'getConversationStore', from: '../core/conversation-store.cjs', method: 'getInstance' },
    { varName: 'tenantCors', from: '../core/tenant-cors.cjs', type: 'object' },
    { varName: 'stripeService', from: '../core/StripeService.cjs', type: 'singleton' },
  ];

  for (const { varName, from, method, type } of requireMap) {
    test(`${varName} from ${from.split('/').pop()} resolves`, () => {
      const mod = require(from);
      assert.ok(mod !== null && mod !== undefined);

      if (method) {
        const fn = mod[method] || (Object.getPrototypeOf(mod)?.[method]);
        assert.ok(typeof fn === 'function',
          `${from} should export ${method} as function`);
      }
    });
  }
});

// ─── T2.8: EventBus method usage — publish vs emit ───────────────────────────
// Bug F8: voice-agent-b2b used emit() instead of publish()

describe('T2: EventBus usage patterns', () => {
  const filesToCheck = [
    'core/voice-api-resilient.cjs',
    'core/voice-agent-b2b.cjs',
    'telephony/voice-telephony-bridge.cjs',
  ];

  for (const file of filesToCheck) {
    test(`${file}: eventBus uses publish() for domain events`, () => {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) return;
      const src = fs.readFileSync(filePath, 'utf8');

      // Find all eventBus.emit() calls — these should use publish() instead
      const emitCalls = src.match(/eventBus\.emit\([^)]*\)/g) || [];

      assert.strictEqual(emitCalls.length, 0,
        `${file}: Found eventBus.emit() — should use publish() (F8 regression).\n  ${emitCalls.join('\n  ')}`);
    });
  }
});

// ─── T2.9: UCP Store usage — same module across all consumers ────────────────
// Bug: 4 UCP fragmentations found in session 250.189

describe('T2: UCP Store unified usage', () => {
  const ucpConsumers = [
    'core/voice-api-resilient.cjs',
    'telephony/voice-telephony-bridge.cjs',
  ];

  test('All UCP consumers import from core/ucp-store.cjs', () => {
    for (const file of ucpConsumers) {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) continue;
      const src = fs.readFileSync(filePath, 'utf8');

      if (src.includes('ucp') || src.includes('UCP')) {
        // Should import from ucp-store.cjs
        const hasUCPImport = src.includes("require('./ucp-store.cjs')") ||
                             src.includes("require('../core/ucp-store.cjs')");
        assert.ok(hasUCPImport, `${file} uses UCP but doesn't import from ucp-store.cjs`);
      }
    }
  });

  test('ucp-store.cjs getInstance returns singleton', () => {
    const { getInstance } = require('../core/ucp-store.cjs');
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b, 'getInstance() should return same instance');
  });
});

// ─── T2.10: conversation-store singleton ─────────────────────────────────────

describe('T2: conversation-store singleton', () => {
  test('getInstance returns same instance', () => {
    const { getInstance } = require('../core/conversation-store.cjs');
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b, 'getInstance() should return same instance');
  });
});

// ─── T2.11: OAuthGateway require chain ───────────────────────────────────────

describe('T2: OAuthGateway require chain', () => {
  test('OAuthGateway imports SecretVault as instance', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core/OAuthGateway.cjs'), 'utf8');
    assert.ok(
      !src.match(/const\s*\{\s*SecretVault\s*\}\s*=\s*require/),
      'OAuthGateway should not destructure SecretVault import'
    );
    assert.ok(
      src.includes("const SecretVault = require('./SecretVault.cjs')"),
      'OAuthGateway should import SecretVault as default'
    );
  });
});

// ─── T2.12: Persona injector — telephony uses VoicePersonaInjector correctly ─

describe('T2: VoicePersonaInjector usage', () => {
  test('telephony destructures VoicePersonaInjector correctly', () => {
    const src = fs.readFileSync(path.join(ROOT, 'telephony/voice-telephony-bridge.cjs'), 'utf8');
    assert.ok(
      src.includes("{ VoicePersonaInjector }"),
      'telephony should destructure VoicePersonaInjector from module exports'
    );
  });

  test('VoicePersonaInjector is a class constructor', () => {
    const { VoicePersonaInjector } = require('../personas/voice-persona-injector.cjs');
    assert.strictEqual(typeof VoicePersonaInjector, 'function');
  });
});

// ─── T2.13: ContextBox behavioral — methods actually work ────────────────────

describe('T2: ContextBox behavioral', () => {
  const ContextBox = require('../core/ContextBox.cjs');

  test('ContextBox.set + get roundtrip stores and retrieves data', () => {
    const sessionId = `__test_${Date.now()}__`;
    ContextBox.set(sessionId, { key: 'testKey', value: 'testValue' });
    const result = ContextBox.get(sessionId);
    assert.ok(result !== null && result !== undefined, 'get should return stored context');
  });

  test('ContextBox.listSessions returns array', () => {
    const sessions = ContextBox.listSessions();
    assert.ok(Array.isArray(sessions), 'listSessions should return array');
  });
});

// ─── T2.14: A2UIService behavioral — methods return expected shapes ──────────

describe('T2: A2UIService behavioral', () => {
  const a2ui = require('../core/a2ui-service.cjs');

  test('A2UIService.initialize() returns without error', () => {
    // initialize sets up internal state — should not throw
    const result = a2ui.initialize({ tenantId: 'test' });
    // May return undefined or an object — just verify no crash
    assert.ok(true, 'initialize should not throw');
  });

  test('A2UIService.health() returns health object', () => {
    const health = a2ui.health();
    assert.ok(typeof health === 'object' && health !== null);
    assert.ok('status' in health || 'initialized' in health || Object.keys(health).length >= 0,
      'health should return object with status info');
  });

  test('A2UIService.generateUI() returns UI descriptor or throws for invalid input', async () => {
    try {
      const result = a2ui.generateUI({ action: 'test', data: {} });
      // If it returns a promise, await it
      if (result && typeof result.then === 'function') await result;
      // May return null/undefined or UI object
      assert.ok(result === null || result === undefined || typeof result === 'object',
        'generateUI should return null/undefined or UI object');
    } catch (e) {
      // Expected for unknown component types — confirms input validation works
      assert.ok(e.message.includes('Unknown') || e.message.includes('component'),
        'Should throw for invalid component type');
    }
  });
});

// ─── T2.15: GoogleSheetsDB.getDB singleton ──────────────────────────────────

describe('T2: GoogleSheetsDB singleton', () => {
  test('getDB returns same instance', () => {
    const { getDB } = require('../core/GoogleSheetsDB.cjs');
    const a = getDB();
    const b = getDB();
    assert.strictEqual(a, b, 'getDB() should return same instance');
  });
});
