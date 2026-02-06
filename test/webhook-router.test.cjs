'use strict';

/**
 * VocalIA WebhookRouter Tests
 *
 * Tests:
 * - WEBHOOK_PROVIDERS signature verification (HubSpot, Shopify, Stripe)
 * - WebhookRouter constructor, registerHandler, processEvent
 * - Event logging
 *
 * NOTE: No real webhook calls. Tests offline signature verification logic.
 *
 * Run: node --test test/webhook-router.test.cjs
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { WebhookRouter, WEBHOOK_PROVIDERS } = require('../core/WebhookRouter.cjs');

describe('WEBHOOK_PROVIDERS', () => {
  test('has hubspot provider', () => {
    assert.ok(WEBHOOK_PROVIDERS.hubspot);
    assert.strictEqual(WEBHOOK_PROVIDERS.hubspot.name, 'HubSpot');
    assert.strictEqual(WEBHOOK_PROVIDERS.hubspot.signatureHeader, 'X-HubSpot-Signature');
  });

  test('has shopify provider', () => {
    assert.ok(WEBHOOK_PROVIDERS.shopify);
    assert.strictEqual(WEBHOOK_PROVIDERS.shopify.name, 'Shopify');
    assert.strictEqual(WEBHOOK_PROVIDERS.shopify.signatureHeader, 'X-Shopify-Hmac-Sha256');
  });

  test('has stripe provider', () => {
    assert.ok(WEBHOOK_PROVIDERS.stripe);
    assert.strictEqual(WEBHOOK_PROVIDERS.stripe.name, 'Stripe');
    assert.strictEqual(WEBHOOK_PROVIDERS.stripe.signatureHeader, 'Stripe-Signature');
  });

  test('has klaviyo provider', () => {
    assert.ok(WEBHOOK_PROVIDERS.klaviyo);
    assert.strictEqual(WEBHOOK_PROVIDERS.klaviyo.name, 'Klaviyo');
  });

  test('has google provider', () => {
    assert.ok(WEBHOOK_PROVIDERS.google);
    assert.strictEqual(WEBHOOK_PROVIDERS.google.name, 'Google (Pub/Sub)');
  });
});

describe('HubSpot signature verification', () => {
  const verify = WEBHOOK_PROVIDERS.hubspot.verifySignature;
  const secret = 'hubspot_secret_123';

  test('verifies valid signature', () => {
    const payload = '{"type":"contact.creation"}';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(verify(payload, signature, secret), true);
  });

  test('rejects invalid signature', () => {
    const payload = '{"type":"contact.creation"}';
    assert.strictEqual(verify(payload, 'invalid_sig', secret), false);
  });

  test('rejects tampered payload', () => {
    const payload = '{"type":"contact.creation"}';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(verify('{"type":"TAMPERED"}', signature, secret), false);
  });
});

describe('Shopify signature verification', () => {
  const verify = WEBHOOK_PROVIDERS.shopify.verifySignature;
  const secret = 'shopify_secret_456';

  test('verifies valid base64 signature', () => {
    const payload = '{"order_id":123}';
    const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
    assert.strictEqual(verify(payload, signature, secret), true);
  });

  test('rejects wrong signature', () => {
    assert.strictEqual(verify('{"order_id":123}', 'wrong_base64==', secret), false);
  });
});

describe('Stripe signature verification', () => {
  const verify = WEBHOOK_PROVIDERS.stripe.verifySignature;
  const secret = 'whsec_stripe_test';

  test('verifies valid Stripe signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = '{"type":"checkout.session.completed"}';
    const signedPayload = `${timestamp}.${payload}`;
    const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const header = `t=${timestamp},v1=${sig}`;
    assert.strictEqual(verify(payload, header, secret), true);
  });

  test('rejects invalid Stripe signature', () => {
    const header = 't=1234567890,v1=invalid_hex';
    assert.strictEqual(verify('{}', header, secret), false);
  });

  test('rejects missing timestamp', () => {
    assert.strictEqual(verify('{}', 'v1=abc123', secret), false);
  });

  test('rejects missing v1', () => {
    assert.strictEqual(verify('{}', 't=123456', secret), false);
  });
});

describe('WebhookRouter constructor', () => {
  test('creates with default port 3011', () => {
    const router = new WebhookRouter();
    assert.strictEqual(router.port, 3011);
  });

  test('accepts custom port', () => {
    const router = new WebhookRouter({ port: 4000 });
    assert.strictEqual(router.port, 4000);
  });
});

describe('WebhookRouter registerHandler', () => {
  test('registers and uses handler', async () => {
    const router = new WebhookRouter();
    let handlerCalled = false;
    let handlerArgs = {};

    router.registerHandler('hubspot', 'contact.creation', (tenantId, eventType, data) => {
      handlerCalled = true;
      handlerArgs = { tenantId, eventType, data };
    });

    await router.processEvent('test_tenant', 'hubspot', 'contact.creation', { id: 123 });
    assert.strictEqual(handlerCalled, true);
    assert.strictEqual(handlerArgs.tenantId, 'test_tenant');
    assert.strictEqual(handlerArgs.eventType, 'contact.creation');
    assert.deepStrictEqual(handlerArgs.data, { id: 123 });
  });

  test('wildcard handler catches any event type', async () => {
    const router = new WebhookRouter();
    let caught = false;

    router.registerHandler('shopify', '*', () => {
      caught = true;
    });

    await router.processEvent('test_tenant', 'shopify', 'order.created', {});
    assert.strictEqual(caught, true);
  });

  test('specific handler takes priority over wildcard', async () => {
    const router = new WebhookRouter();
    let which = '';

    router.registerHandler('shopify', '*', () => { which = 'wildcard'; });
    router.registerHandler('shopify', 'order.paid', () => { which = 'specific'; });

    await router.processEvent('test_tenant', 'shopify', 'order.paid', {});
    assert.strictEqual(which, 'specific');
  });
});

describe('WebhookRouter logEvent', () => {
  const testEventsDir = path.join(process.cwd(), 'data', 'events', 'webhooks');

  afterEach(() => {
    // Clean up test log files
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(testEventsDir, `${today}.jsonl`);
    // Don't delete — other tests may use it
  });

  test('logs event to JSONL file', () => {
    const router = new WebhookRouter();
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(testEventsDir, `${today}.jsonl`);

    // Count lines before
    let linesBefore = 0;
    if (fs.existsSync(logFile)) {
      linesBefore = fs.readFileSync(logFile, 'utf8').trim().split('\n').length;
    }

    router.logEvent('test_tenant', 'hubspot', 'contact.creation', { test: true });

    assert.ok(fs.existsSync(logFile));
    const content = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    assert.ok(content.length > linesBefore);

    const lastEvent = JSON.parse(content[content.length - 1]);
    assert.strictEqual(lastEvent.tenantId, 'test_tenant');
    assert.strictEqual(lastEvent.provider, 'hubspot');
    assert.strictEqual(lastEvent.eventType, 'contact.creation');
    assert.ok(lastEvent.timestamp);
  });
});

// ─── extractTenantId ──────────────────────────────────────────────

describe('WebhookRouter extractTenantId', () => {
  const router = new WebhookRouter();

  test('uses x-tenant-id header when present', () => {
    const tenantId = router.extractTenantId('hubspot', { 'x-tenant-id': 'custom_tenant' }, {});
    assert.strictEqual(tenantId, 'custom_tenant');
  });

  test('extracts HubSpot tenant from portalId', () => {
    const tenantId = router.extractTenantId('hubspot', {}, { portalId: 12345 });
    assert.strictEqual(tenantId, 'hubspot_12345');
  });

  test('returns unknown_webhook for HubSpot without portalId', () => {
    const tenantId = router.extractTenantId('hubspot', {}, {});
    assert.strictEqual(tenantId, 'unknown_webhook');
  });

  test('extracts Shopify tenant from shop domain header', () => {
    const tenantId = router.extractTenantId('shopify', { 'x-shopify-shop-domain': 'mystore.myshopify.com' }, {});
    assert.strictEqual(tenantId, 'shopify_mystore');
  });

  test('returns unknown_webhook for Shopify without domain', () => {
    const tenantId = router.extractTenantId('shopify', {}, {});
    assert.strictEqual(tenantId, 'unknown_webhook');
  });

  test('extracts Stripe tenant from account', () => {
    const tenantId = router.extractTenantId('stripe', {}, { account: 'acct_123abc' });
    assert.strictEqual(tenantId, 'stripe_acct_123abc');
  });

  test('returns unknown_webhook for Stripe without account', () => {
    const tenantId = router.extractTenantId('stripe', {}, {});
    assert.strictEqual(tenantId, 'unknown_webhook');
  });

  test('returns unknown_webhook for unknown provider', () => {
    const tenantId = router.extractTenantId('unknown', {}, {});
    assert.strictEqual(tenantId, 'unknown_webhook');
  });

  test('x-tenant-id header takes priority over provider extraction', () => {
    const tenantId = router.extractTenantId('shopify', {
      'x-tenant-id': 'override_tenant',
      'x-shopify-shop-domain': 'ignored.myshopify.com'
    }, {});
    assert.strictEqual(tenantId, 'override_tenant');
  });
});

// ─── getEventType ─────────────────────────────────────────────────

describe('WebhookRouter getEventType', () => {
  const router = new WebhookRouter();

  test('HubSpot uses subscriptionType', () => {
    assert.strictEqual(router.getEventType('hubspot', {}, { subscriptionType: 'contact.creation' }), 'contact.creation');
  });

  test('HubSpot falls back to eventType', () => {
    assert.strictEqual(router.getEventType('hubspot', {}, { eventType: 'deal.updated' }), 'deal.updated');
  });

  test('HubSpot returns unknown when no type field', () => {
    assert.strictEqual(router.getEventType('hubspot', {}, {}), 'unknown');
  });

  test('Shopify uses x-shopify-topic header', () => {
    assert.strictEqual(router.getEventType('shopify', { 'x-shopify-topic': 'orders/create' }, {}), 'orders/create');
  });

  test('Shopify returns unknown without header', () => {
    assert.strictEqual(router.getEventType('shopify', {}, {}), 'unknown');
  });

  test('Stripe uses body.type', () => {
    assert.strictEqual(router.getEventType('stripe', {}, { type: 'payment_intent.succeeded' }), 'payment_intent.succeeded');
  });

  test('Klaviyo uses body.event', () => {
    assert.strictEqual(router.getEventType('klaviyo', {}, { event: 'track' }), 'track');
  });

  test('Google uses message.attributes.eventType', () => {
    const body = { message: { attributes: { eventType: 'sync' } } };
    assert.strictEqual(router.getEventType('google', {}, body), 'sync');
  });

  test('unknown provider falls back to body.type', () => {
    assert.strictEqual(router.getEventType('other', {}, { type: 'custom' }), 'custom');
  });

  test('unknown provider falls back to body.event', () => {
    assert.strictEqual(router.getEventType('other', {}, { event: 'custom_event' }), 'custom_event');
  });
});

// ─── Klaviyo and Google signature verification ─────────────────────

describe('Klaviyo signature verification', () => {
  test('always returns true (simplified)', () => {
    assert.strictEqual(WEBHOOK_PROVIDERS.klaviyo.verifySignature('payload', 'sig', 'secret'), true);
  });
});

describe('Google signature verification', () => {
  test('always returns true (JWT simplified)', () => {
    assert.strictEqual(WEBHOOK_PROVIDERS.google.verifySignature(), true);
  });
});

// ─── WEBHOOK_PROVIDERS detail ──────────────────────────────────────

describe('WEBHOOK_PROVIDERS detail', () => {
  test('has 5 providers total', () => {
    assert.strictEqual(Object.keys(WEBHOOK_PROVIDERS).length, 5);
  });

  test('all providers have name', () => {
    for (const [key, cfg] of Object.entries(WEBHOOK_PROVIDERS)) {
      assert.ok(cfg.name, `${key} missing name`);
    }
  });

  test('all providers have verifySignature function', () => {
    for (const [key, cfg] of Object.entries(WEBHOOK_PROVIDERS)) {
      assert.strictEqual(typeof cfg.verifySignature, 'function', `${key} missing verifySignature`);
    }
  });
});

// ─── Exports ──────────────────────────────────────────────────────

describe('WebhookRouter exports', () => {
  test('exports WebhookRouter class', () => {
    assert.strictEqual(typeof WebhookRouter, 'function');
  });

  test('exports WEBHOOK_PROVIDERS', () => {
    assert.strictEqual(typeof WEBHOOK_PROVIDERS, 'object');
  });

  test('default export is router instance', () => {
    const mod = require('../core/WebhookRouter.cjs');
    assert.ok(mod instanceof WebhookRouter);
  });

  test('instance has all methods', () => {
    const router = new WebhookRouter();
    const methods = ['registerHandler', 'processEvent', 'extractTenantId',
      'getEventType', 'logEvent', 'healthCheck', 'ensureEventsDir'];
    for (const m of methods) {
      assert.strictEqual(typeof router[m], 'function', `Missing method: ${m}`);
    }
  });
});
