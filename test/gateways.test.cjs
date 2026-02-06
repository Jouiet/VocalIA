'use strict';

/**
 * VocalIA Payment Gateways Tests
 *
 * Tests:
 * - StripeGlobalGateway: _buildFormData, generateIdempotencyKey, verifyWebhookSignature, healthCheck
 * - PayzoneGateway: generateSignature, constructor
 * - PayzoneGlobalGateway: healthCheck, generateIdempotencyKey
 *
 * NOTE: No real API calls. Only tests offline logic (serialization, crypto, health checks).
 *
 * Run: node --test test/gateways.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const StripeGlobalGateway = require('../core/gateways/stripe-global-gateway.cjs');
const PayzoneGateway = require('../core/gateways/payzone-gateway.cjs');
const PayzoneGlobalGateway = require('../core/gateways/payzone-global-gateway.cjs');

describe('StripeGlobalGateway _buildFormData', () => {
  const stripe = new StripeGlobalGateway({ apiKey: 'test' });

  test('encodes simple key-value', () => {
    const result = stripe._buildFormData({ name: 'John', email: 'john@test.com' });
    assert.ok(result.includes('name=John'));
    assert.ok(result.includes('email=john%40test.com'));
  });

  test('encodes nested objects', () => {
    const result = stripe._buildFormData({ metadata: { key: 'value' } });
    assert.ok(result.includes('metadata%5Bkey%5D=value') || result.includes('metadata[key]=value'));
  });

  test('encodes arrays', () => {
    const result = stripe._buildFormData({ items: ['a', 'b'] });
    assert.ok(result.includes('items'));
    assert.ok(result.includes('a'));
    assert.ok(result.includes('b'));
  });

  test('skips null and undefined values', () => {
    const result = stripe._buildFormData({ a: 'yes', b: null, c: undefined });
    assert.ok(result.includes('a=yes'));
    assert.ok(!result.includes('b='));
    assert.ok(!result.includes('c='));
  });

  test('empty object returns empty string', () => {
    const result = stripe._buildFormData({});
    assert.strictEqual(result, '');
  });
});

describe('StripeGlobalGateway generateIdempotencyKey', () => {
  const stripe = new StripeGlobalGateway({ apiKey: 'test' });

  test('returns 32-char hex string', () => {
    const key = stripe.generateIdempotencyKey('create_customer', 'user@test.com');
    assert.strictEqual(key.length, 32);
    assert.ok(/^[a-f0-9]+$/.test(key));
  });

  test('same inputs produce same key on same day', () => {
    const key1 = stripe.generateIdempotencyKey('create', 'seed');
    const key2 = stripe.generateIdempotencyKey('create', 'seed');
    assert.strictEqual(key1, key2);
  });

  test('different actions produce different keys', () => {
    const key1 = stripe.generateIdempotencyKey('create', 'seed');
    const key2 = stripe.generateIdempotencyKey('update', 'seed');
    assert.notStrictEqual(key1, key2);
  });

  test('different seeds produce different keys', () => {
    const key1 = stripe.generateIdempotencyKey('create', 'a@test.com');
    const key2 = stripe.generateIdempotencyKey('create', 'b@test.com');
    assert.notStrictEqual(key1, key2);
  });
});

describe('StripeGlobalGateway verifyWebhookSignature', () => {
  const webhookSecret = 'whsec_test_secret_12345';
  const stripe = new StripeGlobalGateway({ apiKey: 'test', webhookSecret });

  test('returns error when webhook secret not configured', () => {
    const noSecret = new StripeGlobalGateway({ apiKey: 'test' });
    const result = noSecret.verifyWebhookSignature('body', 'sig');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not configured'));
  });

  test('returns error for invalid signature format', () => {
    const result = stripe.verifyWebhookSignature('body', 'invalid');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Invalid signature'));
  });

  test('returns error for old timestamp', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const body = '{"type":"test"}';
    const sig = crypto.createHmac('sha256', webhookSecret)
      .update(`${oldTimestamp}.${body}`)
      .digest('hex');
    const result = stripe.verifyWebhookSignature(body, `t=${oldTimestamp},v1=${sig}`);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('too old'));
  });

  test('verifies valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = '{"type":"checkout.session.completed"}';
    const sig = crypto.createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    const result = stripe.verifyWebhookSignature(body, `t=${timestamp},v1=${sig}`);
    assert.strictEqual(result.valid, true);
    assert.ok(result.event);
    assert.strictEqual(result.event.type, 'checkout.session.completed');
  });

  test('rejects invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = '{"type":"test"}';
    const result = stripe.verifyWebhookSignature(body, `t=${timestamp},v1=invalid_hex_signature_aabbccdd`);
    // This should fail due to length mismatch or value mismatch
    assert.strictEqual(result.valid, false);
  });
});

describe('StripeGlobalGateway healthCheck', () => {
  test('returns health status with API key', () => {
    const stripe = new StripeGlobalGateway({ apiKey: 'test' });
    const health = stripe.healthCheck();
    assert.strictEqual(health.gateway, 'stripe-global');
    assert.strictEqual(health.configured, true);
    assert.ok(health.apiVersion);
  });

  test('returns unconfigured status without API key', () => {
    const stripe = new StripeGlobalGateway({});
    const health = stripe.healthCheck();
    assert.strictEqual(health.configured, false);
  });

  test('reports webhook configuration', () => {
    const withWebhook = new StripeGlobalGateway({ apiKey: 'test', webhookSecret: 'wh_secret' });
    assert.strictEqual(withWebhook.healthCheck().webhookConfigured, true);

    const noWebhook = new StripeGlobalGateway({ apiKey: 'test' });
    assert.strictEqual(noWebhook.healthCheck().webhookConfigured, false);
  });
});

describe('StripeGlobalGateway request guard', () => {
  test('throws when API key not configured', async () => {
    const stripe = new StripeGlobalGateway({});
    await assert.rejects(
      () => stripe.request('/customers', 'GET'),
      { message: /STRIPE_SECRET_KEY not configured/ }
    );
  });
});

describe('PayzoneGateway', () => {
  test('constructor sets test endpoint by default', () => {
    const gw = new PayzoneGateway({ merchantId: 'test', secretKey: 'key' });
    assert.strictEqual(gw.isTest, true);
    assert.ok(gw.endpoint.includes('test'));
  });

  test('constructor sets production endpoint when isTest=false', () => {
    const gw = new PayzoneGateway({ merchantId: 'test', secretKey: 'key', isTest: false });
    assert.strictEqual(gw.isTest, false);
    assert.ok(!gw.endpoint.includes('test'));
  });

  test('generateSignature produces hex string', () => {
    const gw = new PayzoneGateway({ merchantId: 'M001', secretKey: 'secret123' });
    const sig = gw.generateSignature({ amount: '100.00', currency: 'MAD', orderId: 'ORD-001' });
    assert.ok(typeof sig === 'string');
    assert.ok(sig.length > 0);
    assert.ok(/^[a-f0-9]+$/.test(sig));
  });

  test('generateSignature is deterministic', () => {
    const gw = new PayzoneGateway({ merchantId: 'M001', secretKey: 'secret123' });
    const params = { amount: '100.00', currency: 'MAD' };
    const sig1 = gw.generateSignature(params);
    const sig2 = gw.generateSignature(params);
    assert.strictEqual(sig1, sig2);
  });

  test('generateSignature excludes signature field', () => {
    const gw = new PayzoneGateway({ merchantId: 'M001', secretKey: 'secret123' });
    const withSig = gw.generateSignature({ amount: '100', signature: 'old_sig' });
    const withoutSig = gw.generateSignature({ amount: '100' });
    assert.strictEqual(withSig, withoutSig);
  });

  test('different params produce different signatures', () => {
    const gw = new PayzoneGateway({ merchantId: 'M001', secretKey: 'secret123' });
    const sig1 = gw.generateSignature({ amount: '100' });
    const sig2 = gw.generateSignature({ amount: '200' });
    assert.notStrictEqual(sig1, sig2);
  });
});

describe('PayzoneGlobalGateway', () => {
  test('healthCheck returns gateway info', () => {
    const gw = new PayzoneGlobalGateway({});
    const health = gw.healthCheck();
    assert.ok(health);
    assert.strictEqual(health.gateway, 'payzone-global');
    assert.ok('configured' in health);
  });

  test('healthCheck shows unconfigured without credentials', () => {
    const gw = new PayzoneGlobalGateway({});
    const health = gw.healthCheck();
    assert.strictEqual(health.configured, false);
  });

  test('generates idempotency key', () => {
    const gw = new PayzoneGlobalGateway({});
    const key = gw.generateIdempotencyKey('payment', 'user@test.com');
    assert.ok(key);
    assert.strictEqual(typeof key, 'string');
    assert.ok(key.length > 0);
  });

  test('request throws without credentials', async () => {
    const gw = new PayzoneGlobalGateway({});
    await assert.rejects(
      () => gw.request('/payment', 'POST', {}),
      { message: /not configured/ }
    );
  });
});
