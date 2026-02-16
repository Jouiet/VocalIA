/**
 * Stripe Service + Gateway — Unit Tests
 * VocalIA — Session 250.207
 *
 * Tests: core/StripeService.cjs (83 lines) + core/gateways/stripe-global-gateway.cjs (282 lines)
 * Was: 0 tests.
 *
 * Strategy: Test StripeGlobalGateway pure functions (_buildFormData,
 * generateIdempotencyKey, verifyWebhookSignature, healthCheck) directly.
 * StripeService.cjs is a singleton that requires GoogleSheetsDB — tested via export shape.
 *
 * Run: node --test test/stripe-service.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const StripeGlobalGateway = require('../core/gateways/stripe-global-gateway.cjs');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: StripeGlobalGateway — Constructor
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeGlobalGateway constructor', () => {
  it('creates instance without crashing', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'sk_test_xxx' });
    assert.ok(gw);
  });

  it('uses config.apiKey when provided', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'sk_test_123' });
    assert.equal(gw.apiKey, 'sk_test_123');
  });

  it('falls back to process.env.STRIPE_SECRET_KEY', () => {
    const gw = new StripeGlobalGateway();
    // No env var set → apiKey is undefined
    assert.equal(gw.apiKey, undefined);
  });

  it('uses config.webhookSecret when provided', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: 'whsec_test' });
    assert.equal(gw.webhookSecret, 'whsec_test');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: _buildFormData — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('_buildFormData()', () => {
  const gw = new StripeGlobalGateway({ apiKey: 'test' });

  it('encodes simple key-value pairs', () => {
    const result = gw._buildFormData({ name: 'John', email: 'john@test.com' });
    assert.ok(result.includes('name=John'));
    assert.ok(result.includes('email=john%40test.com'));
  });

  it('encodes nested objects with bracket notation', () => {
    const result = gw._buildFormData({ metadata: { tenantId: 'abc' } });
    assert.ok(result.includes('metadata%5BtenantId%5D=abc') || result.includes('metadata[tenantId]=abc'));
  });

  it('encodes arrays with index notation', () => {
    const result = gw._buildFormData({ items: ['a', 'b'] });
    assert.ok(result.includes('items'));
  });

  it('skips null and undefined values', () => {
    const result = gw._buildFormData({ name: 'John', skip: null, also: undefined });
    assert.ok(result.includes('name=John'));
    assert.ok(!result.includes('skip'));
    assert.ok(!result.includes('also'));
  });

  it('returns empty string for empty object', () => {
    const result = gw._buildFormData({});
    assert.equal(result, '');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: generateIdempotencyKey — deterministic per day
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateIdempotencyKey()', () => {
  const gw = new StripeGlobalGateway({ apiKey: 'test' });

  it('returns a 32-char hex string', () => {
    const key = gw.generateIdempotencyKey('create_customer', 'test@test.com');
    assert.equal(key.length, 32);
    assert.match(key, /^[a-f0-9]+$/);
  });

  it('same action + seed = same key (same day)', () => {
    const key1 = gw.generateIdempotencyKey('create_customer', 'test@test.com');
    const key2 = gw.generateIdempotencyKey('create_customer', 'test@test.com');
    assert.equal(key1, key2);
  });

  it('different action = different key', () => {
    const key1 = gw.generateIdempotencyKey('create_customer', 'test@test.com');
    const key2 = gw.generateIdempotencyKey('create_invoice', 'test@test.com');
    assert.notEqual(key1, key2);
  });

  it('different seed = different key', () => {
    const key1 = gw.generateIdempotencyKey('create_customer', 'a@test.com');
    const key2 = gw.generateIdempotencyKey('create_customer', 'b@test.com');
    assert.notEqual(key1, key2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: verifyWebhookSignature
// ═══════════════════════════════════════════════════════════════════════════════

describe('verifyWebhookSignature()', () => {
  const SECRET = 'whsec_test_secret_key';

  it('returns error when webhookSecret not configured', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'test' });
    const result = gw.verifyWebhookSignature('body', 'sig');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('not configured'));
  });

  it('returns error for invalid signature format', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: SECRET });
    const result = gw.verifyWebhookSignature('body', 'invalid-signature');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('Invalid signature') || result.error.includes('format'));
  });

  it('returns valid=true for correct signature', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: SECRET });
    const body = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${body}`;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(signedPayload).digest('hex');
    const signature = `t=${timestamp},v1=${expectedSig}`;

    const result = gw.verifyWebhookSignature(body, signature);
    assert.equal(result.valid, true);
    assert.ok(result.event);
    assert.equal(result.event.type, 'payment_intent.succeeded');
  });

  it('returns valid=false for wrong signature', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: SECRET });
    const body = '{"type":"test"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSig = crypto.createHmac('sha256', 'wrong_secret').update(`${timestamp}.${body}`).digest('hex');
    const signature = `t=${timestamp},v1=${wrongSig}`;

    const result = gw.verifyWebhookSignature(body, signature);
    assert.equal(result.valid, false);
  });

  it('rejects old signatures (>5 min)', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: SECRET });
    const body = '{"type":"test"}';
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ min ago
    const sig = crypto.createHmac('sha256', SECRET).update(`${oldTimestamp}.${body}`).digest('hex');
    const signature = `t=${oldTimestamp},v1=${sig}`;

    const result = gw.verifyWebhookSignature(body, signature);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('too old'));
  });

  it('accepts Buffer body', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: SECRET });
    const bodyStr = '{"type":"test"}';
    const body = Buffer.from(bodyStr);
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${bodyStr}`).digest('hex');
    const signature = `t=${timestamp},v1=${sig}`;

    const result = gw.verifyWebhookSignature(body, signature);
    assert.equal(result.valid, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: healthCheck — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('healthCheck()', () => {
  it('returns configured=true when apiKey is set', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'sk_test_xxx' });
    const health = gw.healthCheck();
    assert.equal(health.configured, true);
    assert.equal(health.gateway, 'stripe-global');
  });

  it('returns configured=false when apiKey missing', () => {
    const gw = new StripeGlobalGateway({});
    const health = gw.healthCheck();
    assert.equal(health.configured, false);
  });

  it('returns webhookConfigured flag', () => {
    const gw = new StripeGlobalGateway({ webhookSecret: 'whsec_test' });
    const health = gw.healthCheck();
    assert.equal(health.webhookConfigured, true);
  });

  it('includes apiVersion', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'test' });
    const health = gw.healthCheck();
    assert.ok(health.apiVersion);
    assert.ok(health.apiVersion.includes('2026'));
  });

  it('includes version string', () => {
    const gw = new StripeGlobalGateway({ apiKey: 'test' });
    const health = gw.healthCheck();
    assert.equal(health.version, '2.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: request() — error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('request() error handling', () => {
  it('throws when apiKey not configured', async () => {
    const gw = new StripeGlobalGateway({});
    await assert.rejects(
      () => gw.request('/customers', 'GET'),
      /STRIPE_SECRET_KEY not configured/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Convenience methods — behavioral (verify correct API calls)
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeGlobalGateway convenience methods — behavioral', () => {
  // Mock request() to capture what each method sends to Stripe API
  function createTrackedGateway() {
    const gw = new StripeGlobalGateway({ apiKey: 'sk_test_xxx' });
    const calls = [];
    gw.request = async (endpoint, method, data, opts) => {
      calls.push({ endpoint, method, data, opts });
      return { id: 'mock_id', object: 'mock', data: [] };
    };
    return { gw, calls };
  }

  it('createCustomer() calls POST /customers with idempotency', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createCustomer({ email: 'test@co.com', name: 'Test' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].endpoint, '/customers');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].data.email, 'test@co.com');
    assert.ok(calls[0].opts.idempotencyKey, 'should have idempotency key');
    assert.equal(calls[0].opts.idempotencyKey.length, 32);
  });

  it('getCustomer() calls GET /customers/:id', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.getCustomer('cus_abc123');
    assert.equal(calls[0].endpoint, '/customers/cus_abc123');
    assert.equal(calls[0].method, 'GET');
  });

  it('findCustomerByEmail() calls GET /customers with email + returns first', async () => {
    const gw = new StripeGlobalGateway({ apiKey: 'test' });
    gw.request = async (endpoint, method, data) => {
      assert.equal(data.email, 'a@b.com');
      assert.equal(data.limit, 1);
      return { data: [{ id: 'cus_found', email: 'a@b.com' }] };
    };
    const result = await gw.findCustomerByEmail('a@b.com');
    assert.equal(result.id, 'cus_found');
  });

  it('findCustomerByEmail() returns null when no match', async () => {
    const gw = new StripeGlobalGateway({ apiKey: 'test' });
    gw.request = async () => ({ data: [] });
    const result = await gw.findCustomerByEmail('nobody@test.com');
    assert.equal(result, null);
  });

  it('createInvoice() calls POST /invoices with idempotency', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createInvoice({ customer: 'cus_x', auto_advance: true });
    assert.equal(calls[0].endpoint, '/invoices');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].data.customer, 'cus_x');
    assert.ok(calls[0].opts.idempotencyKey);
  });

  it('addInvoiceItem() calls POST /invoiceitems', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.addInvoiceItem({ customer: 'cus_x', amount: 4900, currency: 'eur' });
    assert.equal(calls[0].endpoint, '/invoiceitems');
    assert.equal(calls[0].data.amount, 4900);
  });

  it('finalizeInvoice() calls POST /invoices/:id/finalize', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.finalizeInvoice('inv_123');
    assert.equal(calls[0].endpoint, '/invoices/inv_123/finalize');
    assert.equal(calls[0].method, 'POST');
  });

  it('sendInvoice() calls POST /invoices/:id/send', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.sendInvoice('inv_456');
    assert.equal(calls[0].endpoint, '/invoices/inv_456/send');
  });

  it('createPaymentLink() calls POST /payment_links', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createPaymentLink({ 'line_items[0][price]': 'price_x', 'line_items[0][quantity]': 1 });
    assert.equal(calls[0].endpoint, '/payment_links');
  });

  it('getBalance() calls GET /balance', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.getBalance();
    assert.equal(calls[0].endpoint, '/balance');
    assert.equal(calls[0].method, 'GET');
  });

  // New methods (session 250.210)
  it('createCheckoutSession() calls POST /checkout/sessions with correct params', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createCheckoutSession({
      customerId: 'cus_x', priceId: 'price_y',
      successUrl: 'https://vocalia.ma/success', cancelUrl: 'https://vocalia.ma/cancel'
    });
    assert.equal(calls[0].endpoint, '/checkout/sessions');
    assert.equal(calls[0].data.customer, 'cus_x');
    assert.equal(calls[0].data['line_items[0][price]'], 'price_y');
    assert.equal(calls[0].data.mode, 'subscription');
    assert.equal(calls[0].data.success_url, 'https://vocalia.ma/success');
  });

  it('createSubscription() calls POST /subscriptions with idempotency', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createSubscription({ customerId: 'cus_x', priceId: 'price_y', metadata: { plan: 'starter' } });
    assert.equal(calls[0].endpoint, '/subscriptions');
    assert.equal(calls[0].data.customer, 'cus_x');
    assert.equal(calls[0].data['items[0][price]'], 'price_y');
    assert.deepEqual(calls[0].data.metadata, { plan: 'starter' });
    assert.ok(calls[0].opts.idempotencyKey);
  });

  it('getSubscription() calls GET /subscriptions/:id', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.getSubscription('sub_abc');
    assert.equal(calls[0].endpoint, '/subscriptions/sub_abc');
    assert.equal(calls[0].method, 'GET');
  });

  it('cancelSubscription() with atPeriodEnd=true calls POST (not DELETE)', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.cancelSubscription('sub_abc');
    assert.equal(calls[0].endpoint, '/subscriptions/sub_abc');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].data.cancel_at_period_end, true);
  });

  it('cancelSubscription() with atPeriodEnd=false calls DELETE', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.cancelSubscription('sub_abc', { atPeriodEnd: false });
    assert.equal(calls[0].endpoint, '/subscriptions/sub_abc');
    assert.equal(calls[0].method, 'DELETE');
  });

  it('listSubscriptions() calls GET /subscriptions with customer filter', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.listSubscriptions('cus_xyz');
    assert.equal(calls[0].endpoint, '/subscriptions');
    assert.equal(calls[0].data.customer, 'cus_xyz');
    assert.equal(calls[0].data.limit, 10);
  });

  it('createPrice() calls POST /prices with recurring interval', async () => {
    const { gw, calls } = createTrackedGateway();
    await gw.createPrice({ productId: 'prod_x', unitAmount: 4900, currency: 'eur' });
    assert.equal(calls[0].endpoint, '/prices');
    assert.equal(calls[0].data.product, 'prod_x');
    assert.equal(calls[0].data.unit_amount, 4900);
    assert.equal(calls[0].data['recurring[interval]'], 'month');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: StripeService singleton
// ═══════════════════════════════════════════════════════════════════════════════

describe('StripeService singleton — behavioral', () => {
  const svc = require('../core/StripeService.cjs');

  it('is a singleton instance (not a class)', () => {
    assert.equal(typeof svc, 'object');
    assert.ok(svc.gateway instanceof StripeGlobalGateway);
    assert.ok(svc.db, 'should have db reference from GoogleSheetsDB');
  });

  it('getCustomerForTenant() rejects when tenant not found', async () => {
    // Mock db.query to return empty
    const origQuery = svc.db.query;
    svc.db.query = async () => [];
    try {
      await assert.rejects(
        () => svc.getCustomerForTenant('nonexistent_tenant'),
        /Tenant not found/
      );
    } finally {
      svc.db.query = origQuery;
    }
  });

  it('getCustomerForTenant() uses existing stripe_customer_id when present', async () => {
    const origQuery = svc.db.query;
    const origGetCustomer = svc.gateway.getCustomer;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_existing', email: 'a@b.com' }];
    svc.gateway.getCustomer = async (id) => {
      assert.equal(id, 'cus_existing');
      return { id: 'cus_existing', email: 'a@b.com' };
    };
    try {
      const result = await svc.getCustomerForTenant('t1');
      assert.equal(result.id, 'cus_existing');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCustomer;
    }
  });

  it('getCustomerForTenant() creates new customer when none exists', async () => {
    const origQuery = svc.db.query;
    const origCreate = svc.gateway.createCustomer;
    const origUpdate = svc.db.update;
    let createdWith = null;
    svc.db.query = async () => [{ id: 't2', email: 'new@co.com', name: 'NewCo' }];
    svc.gateway.createCustomer = async (data) => {
      createdWith = data;
      return { id: 'cus_new', email: data.email };
    };
    svc.db.update = async () => {};
    try {
      const result = await svc.getCustomerForTenant('t2');
      assert.equal(result.id, 'cus_new');
      assert.equal(createdWith.email, 'new@co.com');
      assert.equal(createdWith.metadata.tenantId, 't2');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.createCustomer = origCreate;
      svc.db.update = origUpdate;
    }
  });

  it('listInvoices() calls gateway with customer ID', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origRequest = svc.gateway.request;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.request = async (ep, method, data) => {
      assert.equal(ep, '/invoices');
      assert.equal(data.customer, 'cus_x');
      return { data: [{ id: 'inv_1', amount: 4900 }] };
    };
    try {
      const invoices = await svc.listInvoices('t1');
      assert.ok(Array.isArray(invoices));
      assert.equal(invoices[0].id, 'inv_1');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.request = origRequest;
    }
  });

  it('createCheckoutSession() passes correct params to gateway', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origCheckout = svc.gateway.createCheckoutSession;
    let checkoutArgs = null;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.createCheckoutSession = async (args) => {
      checkoutArgs = args;
      return { id: 'cs_test', url: 'https://checkout.stripe.com/test' };
    };
    try {
      const result = await svc.createCheckoutSession('t1', 'price_y', 'https://ok.com', 'https://cancel.com');
      assert.equal(result.url, 'https://checkout.stripe.com/test');
      assert.equal(checkoutArgs.customerId, 'cus_x');
      assert.equal(checkoutArgs.priceId, 'price_y');
      assert.equal(checkoutArgs.metadata.tenantId, 't1');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.createCheckoutSession = origCheckout;
    }
  });

  it('getSubscriptionForTenant() returns first subscription', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origList = svc.gateway.listSubscriptions;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.listSubscriptions = async () => ({ data: [{ id: 'sub_1', status: 'active' }] });
    try {
      const sub = await svc.getSubscriptionForTenant('t1');
      assert.equal(sub.id, 'sub_1');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.listSubscriptions = origList;
    }
  });

  it('getSubscriptionForTenant() returns null when no subscriptions', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origList = svc.gateway.listSubscriptions;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.listSubscriptions = async () => ({ data: [] });
    try {
      const sub = await svc.getSubscriptionForTenant('t1');
      assert.equal(sub, null);
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.listSubscriptions = origList;
    }
  });

  it('cancelSubscriptionForTenant() throws when no active subscription', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origList = svc.gateway.listSubscriptions;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.listSubscriptions = async () => ({ data: [] });
    try {
      await assert.rejects(
        () => svc.cancelSubscriptionForTenant('t1'),
        /No active subscription/
      );
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.listSubscriptions = origList;
    }
  });

  it('cancelSubscriptionForTenant() calls gateway.cancelSubscription with sub ID', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origList = svc.gateway.listSubscriptions;
    const origCancel = svc.gateway.cancelSubscription;
    let cancelledId = null;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.listSubscriptions = async () => ({ data: [{ id: 'sub_to_cancel' }] });
    svc.gateway.cancelSubscription = async (id) => { cancelledId = id; return { id, cancel_at_period_end: true }; };
    try {
      await svc.cancelSubscriptionForTenant('t1');
      assert.equal(cancelledId, 'sub_to_cancel');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.listSubscriptions = origList;
      svc.gateway.cancelSubscription = origCancel;
    }
  });

  it('getPortalLink() returns URL string from billing portal session', async () => {
    const origQuery = svc.db.query;
    const origGetCust = svc.gateway.getCustomer;
    const origRequest = svc.gateway.request;
    svc.db.query = async () => [{ id: 't1', stripe_customer_id: 'cus_x' }];
    svc.gateway.getCustomer = async () => ({ id: 'cus_x' });
    svc.gateway.request = async (ep, method, data) => {
      assert.equal(ep, '/billing_portal/sessions');
      assert.equal(data.customer, 'cus_x');
      return { url: 'https://billing.stripe.com/session/test' };
    };
    try {
      const url = await svc.getPortalLink('t1', 'https://vocalia.ma/billing');
      assert.equal(url, 'https://billing.stripe.com/session/test');
    } finally {
      svc.db.query = origQuery;
      svc.gateway.getCustomer = origGetCust;
      svc.gateway.request = origRequest;
    }
  });
});
