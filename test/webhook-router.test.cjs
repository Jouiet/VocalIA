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
