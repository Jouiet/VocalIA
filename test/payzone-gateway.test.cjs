'use strict';

/**
 * VocalIA Payzone Gateway Tests
 *
 * Tests:
 * - PayzoneGateway constructor (test/prod endpoints, defaults)
 * - generateSignature (SHA-512 HMAC, sorted keys)
 * - buildXml (XML construction)
 * - parseResponse (XML parsing — success, error, partial)
 * - PayzoneGlobalGateway constructor (configured, unconfigured)
 * - generateIdempotencyKey (deterministic, format)
 * - _generateOrderId (format, uniqueness)
 * - _parseResponse (extended XML parsing with order_id, amount)
 * - verifyWebhookSignature (valid, invalid, unconfigured)
 * - healthCheck structure
 *
 * NOTE: Does NOT call Payzone/CMI APIs. Tests pure logic only.
 *
 * Run: node --test test/payzone-gateway.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const PayzoneGateway = require('../core/gateways/payzone-gateway.cjs');
const PayzoneGlobalGateway = require('../core/gateways/payzone-global-gateway.cjs');

// ─── PayzoneGateway constructor ─────────────────────────────────────

describe('PayzoneGateway constructor', () => {
  test('sets merchantId from config', () => {
    const gw = new PayzoneGateway({ merchantId: 'MERCH_123', password: 'pw', secretKey: 'sk' });
    assert.strictEqual(gw.merchantId, 'MERCH_123');
  });

  test('sets password from config', () => {
    const gw = new PayzoneGateway({ merchantId: 'm', password: 'test_pw', secretKey: 'sk' });
    assert.strictEqual(gw.password, 'test_pw');
  });

  test('defaults to test mode', () => {
    const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'sk' });
    assert.strictEqual(gw.isTest, true);
    assert.strictEqual(gw.endpoint, 'test.payzone.ma');
  });

  test('production mode uses payzone.ma', () => {
    const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'sk', isTest: false });
    assert.strictEqual(gw.isTest, false);
    assert.strictEqual(gw.endpoint, 'payzone.ma');
  });

  test('has correct API path', () => {
    const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'sk' });
    assert.strictEqual(gw.path, '/webservices/execution.php');
  });
});

// ─── generateSignature ──────────────────────────────────────────────

describe('PayzoneGateway generateSignature', () => {
  const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'test_secret_key_123' });

  test('generates SHA-512 HMAC hex string', () => {
    const sig = gw.generateSignature({ amount: '100', currency: 'MAD' });
    assert.strictEqual(typeof sig, 'string');
    assert.strictEqual(sig.length, 128); // SHA-512 hex = 128 chars
  });

  test('sorts keys alphabetically', () => {
    // z_key comes before a_key alphabetically in values concatenation
    // But sorted: a_key first, z_key second → "firstsecond"
    const params = { z_key: 'second', a_key: 'first' };
    const expected = crypto.createHmac('sha512', 'test_secret_key_123')
      .update('firstsecond')
      .digest('hex');
    assert.strictEqual(gw.generateSignature(params), expected);
  });

  test('excludes signature field from hash', () => {
    const params = { amount: '100', signature: 'should_be_excluded' };
    const expected = crypto.createHmac('sha512', 'test_secret_key_123')
      .update('100')
      .digest('hex');
    assert.strictEqual(gw.generateSignature(params), expected);
  });

  test('same params produce same signature', () => {
    const params = { amount: '500', currency: '504' };
    const sig1 = gw.generateSignature(params);
    const sig2 = gw.generateSignature(params);
    assert.strictEqual(sig1, sig2);
  });

  test('different params produce different signature', () => {
    const sig1 = gw.generateSignature({ amount: '100' });
    const sig2 = gw.generateSignature({ amount: '200' });
    assert.notStrictEqual(sig1, sig2);
  });
});

// ─── buildXml ───────────────────────────────────────────────────────

describe('PayzoneGateway buildXml', () => {
  const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'sk' });

  test('produces valid XML wrapper', () => {
    const xml = gw.buildXml({ amount: '100' });
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes('<request>'));
    assert.ok(xml.includes('</request>'));
  });

  test('includes data fields as XML elements', () => {
    const xml = gw.buildXml({ amount: '500', currency: '504' });
    assert.ok(xml.includes('<amount>500</amount>'));
    assert.ok(xml.includes('<currency>504</currency>'));
  });

  test('handles empty data', () => {
    const xml = gw.buildXml({});
    assert.strictEqual(xml, '<?xml version="1.0" encoding="UTF-8"?>\n<request></request>');
  });

  test('handles multiple fields', () => {
    const xml = gw.buildXml({ a: '1', b: '2', c: '3' });
    assert.ok(xml.includes('<a>1</a>'));
    assert.ok(xml.includes('<b>2</b>'));
    assert.ok(xml.includes('<c>3</c>'));
  });
});

// ─── parseResponse ──────────────────────────────────────────────────

describe('PayzoneGateway parseResponse', () => {
  const gw = new PayzoneGateway({ merchantId: 'm', password: 'pw', secretKey: 'sk' });

  test('parses success response (code 00)', () => {
    const xml = '<response><response_code>00</response_code><response_desc>Approved</response_desc><transaction_id>TXN_123</transaction_id></response>';
    const result = gw.parseResponse(xml);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code, '00');
    assert.strictEqual(result.message, 'Approved');
    assert.strictEqual(result.transactionId, 'TXN_123');
  });

  test('parses error response', () => {
    const xml = '<response><response_code>05</response_code><response_desc>Declined</response_desc></response>';
    const result = gw.parseResponse(xml);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, '05');
    assert.strictEqual(result.message, 'Declined');
    assert.strictEqual(result.transactionId, null);
  });

  test('handles missing fields', () => {
    const result = gw.parseResponse('<response></response>');
    assert.ok(!result.success); // null && null[1] === '00' → falsy
    assert.strictEqual(result.code, 'ERROR');
    assert.strictEqual(result.message, 'Unknown Error');
    assert.strictEqual(result.transactionId, null);
  });

  test('preserves raw XML', () => {
    const xml = '<response><response_code>00</response_code></response>';
    const result = gw.parseResponse(xml);
    assert.strictEqual(result.raw, xml);
  });
});

// ─── PayzoneGlobalGateway constructor ────────────────────────────────

describe('PayzoneGlobalGateway constructor', () => {
  test('creates without credentials (gateway null)', () => {
    const gw = new PayzoneGlobalGateway({});
    assert.strictEqual(gw.gateway, null);
  });

  test('creates with credentials (gateway initialized)', () => {
    const gw = new PayzoneGlobalGateway({
      merchantId: 'MERCH_123',
      secretKey: 'SECRET_KEY_456'
    });
    assert.ok(gw.gateway);
    assert.ok(gw.gateway instanceof PayzoneGateway);
  });

  test('defaults to test mode', () => {
    const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'sk' });
    assert.strictEqual(gw.isTest, true);
  });

  test('production mode', () => {
    const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'sk', isTest: false });
    assert.strictEqual(gw.isTest, false);
  });
});

// ─── generateIdempotencyKey ──────────────────────────────────────────

describe('PayzoneGlobalGateway generateIdempotencyKey', () => {
  const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'sk' });

  test('returns 24-char hex string', () => {
    const key = gw.generateIdempotencyKey('payment', 'order_123');
    assert.strictEqual(typeof key, 'string');
    assert.strictEqual(key.length, 24);
    assert.ok(/^[0-9a-f]+$/.test(key));
  });

  test('same inputs on same day produce same key', () => {
    const key1 = gw.generateIdempotencyKey('payment', 'order_123');
    const key2 = gw.generateIdempotencyKey('payment', 'order_123');
    assert.strictEqual(key1, key2);
  });

  test('different actions produce different keys', () => {
    const key1 = gw.generateIdempotencyKey('payment', 'seed');
    const key2 = gw.generateIdempotencyKey('refund', 'seed');
    assert.notStrictEqual(key1, key2);
  });

  test('different seeds produce different keys', () => {
    const key1 = gw.generateIdempotencyKey('payment', 'seed_a');
    const key2 = gw.generateIdempotencyKey('payment', 'seed_b');
    assert.notStrictEqual(key1, key2);
  });
});

// ─── _generateOrderId ────────────────────────────────────────────────

describe('PayzoneGlobalGateway _generateOrderId', () => {
  const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'sk' });

  test('starts with VIA- prefix', () => {
    const id = gw._generateOrderId();
    assert.ok(id.startsWith('VIA-'));
  });

  test('generates unique IDs', () => {
    const id1 = gw._generateOrderId();
    const id2 = gw._generateOrderId();
    assert.notStrictEqual(id1, id2);
  });

  test('contains timestamp component', () => {
    const id = gw._generateOrderId();
    const parts = id.split('-');
    assert.ok(parts.length >= 3);
    // Second part should be a timestamp
    const ts = parseInt(parts[1]);
    assert.ok(ts > 1700000000000); // After Nov 2023
  });
});

// ─── _parseResponse (Global) ─────────────────────────────────────────

describe('PayzoneGlobalGateway _parseResponse', () => {
  const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'sk' });

  test('parses full XML response', () => {
    const xml = '<response><response_code>00</response_code><response_desc>OK</response_desc><transaction_id>TX1</transaction_id><order_id>ORD1</order_id><amount>500.00</amount></response>';
    const result = gw._parseResponse(xml);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code, '00');
    assert.strictEqual(result.transactionId, 'TX1');
    assert.strictEqual(result.orderId, 'ORD1');
    assert.strictEqual(result.amount, 500);
  });

  test('parses error response', () => {
    const xml = '<response><response_code>51</response_code><response_desc>Insufficient Funds</response_desc></response>';
    const result = gw._parseResponse(xml);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, '51');
    assert.strictEqual(result.message, 'Insufficient Funds');
    assert.strictEqual(result.transactionId, null);
    assert.strictEqual(result.orderId, null);
    assert.strictEqual(result.amount, null);
  });

  test('handles empty XML', () => {
    const result = gw._parseResponse('<response></response>');
    assert.ok(!result.success); // null when no code match → falsy
    assert.strictEqual(result.code, 'ERROR');
    assert.strictEqual(result.message, 'Unknown');
  });
});

// ─── verifyWebhookSignature ──────────────────────────────────────────

describe('PayzoneGlobalGateway verifyWebhookSignature', () => {
  test('returns invalid when no secret key configured', () => {
    const gw = new PayzoneGlobalGateway({});
    const result = gw.verifyWebhookSignature('body', 'sig');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not configured'));
  });

  test('validates correct signature', () => {
    const secretKey = 'test_webhook_secret';
    const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey });
    const body = '<response><response_code>00</response_code></response>';
    const signature = crypto.createHmac('sha512', secretKey).update(body).digest('hex');
    const result = gw.verifyWebhookSignature(body, signature);
    assert.strictEqual(result.valid, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.code, '00');
  });

  test('rejects incorrect signature', () => {
    const gw = new PayzoneGlobalGateway({ merchantId: 'm', secretKey: 'real_secret' });
    const result = gw.verifyWebhookSignature('body', 'wrong_signature');
    assert.strictEqual(result.valid, false);
  });
});

// ─── healthCheck ─────────────────────────────────────────────────────

describe('PayzoneGlobalGateway healthCheck', () => {
  test('returns health structure', () => {
    const gw = new PayzoneGlobalGateway({ merchantId: 'M123', secretKey: 'SK456' });
    const health = gw.healthCheck();
    assert.strictEqual(health.gateway, 'payzone-global');
    assert.strictEqual(health.version, '2.0.0');
    assert.strictEqual(health.configured, true);
    assert.strictEqual(health.testMode, true);
    assert.strictEqual(health.currency, 'MAD');
    assert.strictEqual(health.region, 'Morocco');
  });

  test('reports unconfigured when no credentials', () => {
    const gw = new PayzoneGlobalGateway({});
    const health = gw.healthCheck();
    assert.strictEqual(health.configured, false);
  });
});

// ─── request errors ──────────────────────────────────────────────────

describe('PayzoneGlobalGateway request errors', () => {
  test('throws when gateway not configured', async () => {
    const gw = new PayzoneGlobalGateway({});
    await assert.rejects(
      () => gw.request('/payment', 'POST', { amount: 100 }),
      /not configured/
    );
  });

  test('processPayment throws when gateway not configured', async () => {
    const gw = new PayzoneGlobalGateway({});
    await assert.rejects(
      () => gw.processPayment({ amount: 100, email: 'test@test.com' }),
      /not configured/
    );
  });
});

// NOTE: Payzone exports/methods are proven by behavioral tests above
// (generateSignature, buildXml, processPayment, verifyWebhookSignature, etc.)
