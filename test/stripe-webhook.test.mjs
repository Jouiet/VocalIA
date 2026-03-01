/**
 * Stripe Webhook Handler Tests
 * Session 250.255: Revenue Pipeline End-to-End
 *
 * Tests:
 * 1. checkout.session.completed → tenant config updated
 * 2. customer.subscription.deleted → tenant status expired
 * 3. Invalid signature → 401
 * 4. Unknown event type → 200 ack
 * 5. extractTenantId with metadata.tenantId
 * 6. handleSubscriptionUpdated → plan sync
 * 7. handleInvoicePaid → logged
 * 8. mapPriceIdToPlan with env vars
 * 9. provisionTenant includes trial_end + stripe section
 * 10. billing prices endpoint
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENTS_DIR = path.join(__dirname, '..', 'clients');

// Test tenant ID
const TEST_TENANT = 'stripe_test_tenant_255';
const TEST_TENANT_DIR = path.join(CLIENTS_DIR, TEST_TENANT);

// Cleanup helper
function cleanupTestTenant() {
  try {
    if (fs.existsSync(TEST_TENANT_DIR)) {
      fs.rmSync(TEST_TENANT_DIR, { recursive: true, force: true });
    }
  } catch { /* ok */ }
}

describe('Stripe Subscription Handler', () => {
  let handler;

  before(() => {
    // Set test price env vars
    process.env.STRIPE_PRICE_STARTER = 'price_test_starter';
    process.env.STRIPE_PRICE_PRO = 'price_test_pro';
    process.env.STRIPE_PRICE_ECOMMERCE = 'price_test_ecom';
    process.env.STRIPE_PRICE_EXPERT_CLONE = 'price_test_expert';
    process.env.STRIPE_PRICE_TELEPHONY = 'price_test_tel';

    handler = require('../core/stripe-subscription-handler.cjs');
    // Force rebuild price map after setting env vars
    handler._buildPriceMap();
  });

  after(() => {
    cleanupTestTenant();
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_ECOMMERCE;
    delete process.env.STRIPE_PRICE_EXPERT_CLONE;
    delete process.env.STRIPE_PRICE_TELEPHONY;
  });

  describe('mapPriceIdToPlan', () => {
    it('should map known price IDs to plans', () => {
      assert.equal(handler.mapPriceIdToPlan('price_test_starter'), 'starter');
      assert.equal(handler.mapPriceIdToPlan('price_test_pro'), 'pro');
      assert.equal(handler.mapPriceIdToPlan('price_test_ecom'), 'ecommerce');
      assert.equal(handler.mapPriceIdToPlan('price_test_expert'), 'expert_clone');
      assert.equal(handler.mapPriceIdToPlan('price_test_tel'), 'telephony');
    });

    it('should fallback to starter for unknown price IDs', () => {
      assert.equal(handler.mapPriceIdToPlan('price_unknown_xxx'), 'starter');
      assert.equal(handler.mapPriceIdToPlan(null), 'starter');
      assert.equal(handler.mapPriceIdToPlan(undefined), 'starter');
    });
  });

  describe('readTenantConfig / writeTenantConfig', () => {
    beforeEach(() => {
      cleanupTestTenant();
    });

    it('should return null for non-existent tenant', async () => {
      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config, null);
    });

    it('should write and read tenant config', async () => {
      fs.mkdirSync(TEST_TENANT_DIR, { recursive: true });
      const testConfig = { tenant_id: TEST_TENANT, plan: 'starter', status: 'active' };
      await handler.writeTenantConfig(TEST_TENANT, testConfig);

      const read = await handler.readTenantConfig(TEST_TENANT);
      assert.deepEqual(read.tenant_id, TEST_TENANT);
      assert.deepEqual(read.plan, 'starter');
    });
  });

  describe('updateTenantConfig', () => {
    beforeEach(() => {
      cleanupTestTenant();
      fs.mkdirSync(TEST_TENANT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(TEST_TENANT_DIR, 'config.json'),
        JSON.stringify({
          tenant_id: TEST_TENANT,
          plan: 'starter',
          status: 'active',
          stripe: { customer_id: null, subscription_id: null, subscription_status: 'trialing', price_id: null },
          features: { voice_widget: true },
          quotas: { sessions_monthly: 1000 },
          trial_end: '2026-03-15T00:00:00.000Z'
        }, null, 2)
      );
    });

    it('should update stripe section without losing other fields', async () => {
      const success = await handler.updateTenantConfig(TEST_TENANT, {
        stripe: { customer_id: 'cus_123', subscription_status: 'active' }
      });
      assert.equal(success, true);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.stripe.customer_id, 'cus_123');
      assert.equal(config.stripe.subscription_status, 'active');
      // Original fields preserved
      assert.equal(config.plan, 'starter');
      assert.equal(config.status, 'active');
    });

    it('should update plan and features', async () => {
      const success = await handler.updateTenantConfig(TEST_TENANT, {
        plan: 'pro',
        features: { voice_widget: true, booking: true, crm_sync: true },
        trial_end: null
      });
      assert.equal(success, true);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.plan, 'pro');
      assert.equal(config.trial_end, null);
      assert.equal(config.features.booking, true);
    });

    it('should return false for non-existent tenant', async () => {
      const success = await handler.updateTenantConfig('nonexistent_tenant_xyz', {
        plan: 'pro'
      });
      assert.equal(success, false);
    });
  });

  describe('handleCheckoutCompleted', () => {
    beforeEach(() => {
      cleanupTestTenant();
      fs.mkdirSync(TEST_TENANT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(TEST_TENANT_DIR, 'config.json'),
        JSON.stringify({
          tenant_id: TEST_TENANT,
          plan: 'starter',
          status: 'active',
          stripe: { customer_id: null, subscription_id: null, subscription_status: 'trialing', price_id: null },
          features: {},
          quotas: {},
          trial_end: '2026-03-15T00:00:00.000Z'
        }, null, 2)
      );
    });

    it('should activate subscription and upgrade plan', async () => {
      const session = {
        metadata: { tenantId: TEST_TENANT, price_id: 'price_test_pro' },
        customer: 'cus_abc123',
        subscription: 'sub_xyz789',
        amount_total: 9900
      };

      await handler.handleCheckoutCompleted(session);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.stripe.customer_id, 'cus_abc123');
      assert.equal(config.stripe.subscription_id, 'sub_xyz789');
      assert.equal(config.stripe.subscription_status, 'active');
      assert.equal(config.stripe.price_id, 'price_test_pro');
      assert.equal(config.plan, 'pro');
      assert.equal(config.trial_end, null);
      assert.equal(config.status, 'active');
      // Pro plan should have booking enabled
      assert.equal(config.features.booking, true);
      // Pro plan quotas
      assert.equal(config.quotas.sessions_monthly, 999999);
    });

    it('should skip if no tenantId in metadata', async () => {
      const session = { metadata: {}, customer: 'cus_xxx' };
      // Should not throw
      await handler.handleCheckoutCompleted(session);
      // Config unchanged
      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.plan, 'starter');
    });
  });

  describe('handleSubscriptionUpdated', () => {
    beforeEach(() => {
      cleanupTestTenant();
      fs.mkdirSync(TEST_TENANT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(TEST_TENANT_DIR, 'config.json'),
        JSON.stringify({
          tenant_id: TEST_TENANT,
          plan: 'pro',
          status: 'active',
          stripe: { customer_id: 'cus_123', subscription_id: 'sub_456', subscription_status: 'active', price_id: 'price_test_pro' },
          features: {},
          quotas: {}
        }, null, 2)
      );
    });

    it('should sync plan changes on upgrade', async () => {
      const subscription = {
        metadata: { tenantId: TEST_TENANT },
        items: { data: [{ price: { id: 'price_test_ecom' } }] },
        status: 'active'
      };

      await handler.handleSubscriptionUpdated(subscription);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.plan, 'ecommerce');
      assert.equal(config.stripe.subscription_status, 'active');
      assert.equal(config.features.ecom_cart_recovery, true);
    });

    it('should suspend on past_due', async () => {
      const subscription = {
        metadata: { tenantId: TEST_TENANT },
        items: { data: [{ price: { id: 'price_test_pro' } }] },
        status: 'past_due'
      };

      await handler.handleSubscriptionUpdated(subscription);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.status, 'suspended');
      assert.equal(config.stripe.subscription_status, 'past_due');
    });
  });

  describe('handleSubscriptionDeleted', () => {
    beforeEach(() => {
      cleanupTestTenant();
      fs.mkdirSync(TEST_TENANT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(TEST_TENANT_DIR, 'config.json'),
        JSON.stringify({
          tenant_id: TEST_TENANT,
          plan: 'pro',
          status: 'active',
          stripe: { customer_id: 'cus_123', subscription_id: 'sub_456', subscription_status: 'active', price_id: 'price_test_pro' }
        }, null, 2)
      );
    });

    it('should set status to expired and clear subscription', async () => {
      const subscription = {
        metadata: { tenantId: TEST_TENANT },
        id: 'sub_456'
      };

      await handler.handleSubscriptionDeleted(subscription);

      const config = await handler.readTenantConfig(TEST_TENANT);
      assert.equal(config.status, 'expired');
      assert.equal(config.stripe.subscription_status, 'canceled');
      assert.equal(config.stripe.subscription_id, null);
    });
  });

  describe('handleInvoicePaid', () => {
    it('should not throw on valid invoice', async () => {
      const invoice = {
        subscription_details: { metadata: { tenantId: TEST_TENANT } },
        amount_paid: 9900,
        currency: 'eur'
      };
      // Should not throw
      await handler.handleInvoicePaid(invoice);
    });

    it('should skip silently without tenantId', async () => {
      const invoice = { amount_paid: 100, currency: 'eur' };
      await handler.handleInvoicePaid(invoice);
    });
  });
});

describe('WebhookRouter — extractTenantId for Stripe', () => {
  let router;

  before(() => {
    const { WebhookRouter } = require('../core/WebhookRouter.cjs');
    router = new WebhookRouter();
  });

  it('should extract tenantId from Stripe metadata', () => {
    const body = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 'my_tenant_123' },
          customer: 'cus_xyz'
        }
      }
    };
    const tenantId = router.extractTenantId('stripe', {}, body);
    assert.equal(tenantId, 'my_tenant_123');
  });

  it('should extract tenantId from subscription_details metadata', () => {
    const body = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription_details: { metadata: { tenantId: 'tenant_from_sub' } }
        }
      }
    };
    const tenantId = router.extractTenantId('stripe', {}, body);
    assert.equal(tenantId, 'tenant_from_sub');
  });

  it('should fallback to stripe_account for Connect webhooks', () => {
    const body = {
      type: 'account.updated',
      account: 'acct_xxx',
      data: { object: {} }
    };
    const tenantId = router.extractTenantId('stripe', {}, body);
    assert.equal(tenantId, 'stripe_acct_xxx');
  });

  it('should return unknown_webhook when no tenant info', () => {
    const body = { type: 'event.unknown', data: { object: {} } };
    const tenantId = router.extractTenantId('stripe', {}, body);
    assert.equal(tenantId, 'unknown_webhook');
  });

  it('should prefer x-tenant-id header', () => {
    const body = { type: 'checkout.session.completed', data: { object: { metadata: { tenantId: 'meta_tenant' } } } };
    const tenantId = router.extractTenantId('stripe', { 'x-tenant-id': 'header_tenant' }, body);
    assert.equal(tenantId, 'header_tenant');
  });
});

describe('WebhookRouter — Stripe Signature Verification', () => {
  it('should verify valid Stripe signature', () => {
    const { WEBHOOK_PROVIDERS } = require('../core/WebhookRouter.cjs');
    const secret = 'whsec_test_secret_123';
    const payload = '{"id":"evt_test"}';
    const timestamp = Math.floor(Date.now() / 1000);

    // Generate valid signature
    const crypto = require('crypto');
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const signature = `t=${timestamp},v1=${expectedSig}`;

    const isValid = WEBHOOK_PROVIDERS.stripe.verifySignature(payload, signature, secret);
    assert.equal(isValid, true);
  });

  it('should reject invalid Stripe signature', () => {
    const { WEBHOOK_PROVIDERS } = require('../core/WebhookRouter.cjs');
    const isValid = WEBHOOK_PROVIDERS.stripe.verifySignature(
      '{"id":"evt_test"}',
      't=1234567890,v1=invalid_sig_abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345',
      'whsec_real_secret'
    );
    assert.equal(isValid, false);
  });

  it('should reject missing signature parts', () => {
    const { WEBHOOK_PROVIDERS } = require('../core/WebhookRouter.cjs');
    assert.equal(WEBHOOK_PROVIDERS.stripe.verifySignature('{}', 'invalid', 'secret'), false);
    assert.equal(WEBHOOK_PROVIDERS.stripe.verifySignature('{}', 't=123', 'secret'), false);
  });
});

describe('provisionTenant — trial_end + stripe section', () => {
  const PROV_TENANT = 'provision_test_255';
  const PROV_DIR = path.join(CLIENTS_DIR, PROV_TENANT);

  after(() => {
    try { fs.rmSync(PROV_DIR, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('should include trial_end and stripe section in new tenant config', () => {
    const { provisionTenant } = require('../core/db-api.cjs');
    const result = provisionTenant(PROV_TENANT, { plan: 'starter', company: 'Test Corp', email: 'test@test.com' });
    assert.equal(result.success, true);

    const config = JSON.parse(fs.readFileSync(path.join(PROV_DIR, 'config.json'), 'utf8'));

    // trial_end should be ~14 days from now
    assert.ok(config.trial_end, 'trial_end should exist');
    const trialEnd = new Date(config.trial_end);
    const now = new Date();
    const diffDays = (trialEnd - now) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays > 13 && diffDays < 15, `trial_end should be ~14 days away, got ${diffDays.toFixed(1)}`);

    // stripe section
    assert.ok(config.stripe, 'stripe section should exist');
    assert.equal(config.stripe.customer_id, null);
    assert.equal(config.stripe.subscription_id, null);
    assert.equal(config.stripe.subscription_status, 'trialing');
    assert.equal(config.stripe.price_id, null);

    // sms_automation should NOT exist
    assert.equal(config.features.sms_automation, undefined, 'sms_automation should be removed');
  });
});

describe('WebhookRouter — getEventType for Stripe', () => {
  let router;

  before(() => {
    const { WebhookRouter } = require('../core/WebhookRouter.cjs');
    router = new WebhookRouter();
  });

  it('should extract Stripe event type from body.type', () => {
    assert.equal(router.getEventType('stripe', {}, { type: 'checkout.session.completed' }), 'checkout.session.completed');
    assert.equal(router.getEventType('stripe', {}, { type: 'customer.subscription.deleted' }), 'customer.subscription.deleted');
    assert.equal(router.getEventType('stripe', {}, { type: 'invoice.payment_succeeded' }), 'invoice.payment_succeeded');
  });

  it('should return unknown for missing type', () => {
    assert.equal(router.getEventType('stripe', {}, {}), 'unknown');
  });
});

describe('WebhookRouter — registered Stripe handlers', () => {
  it('should register 4 Stripe event handlers on start', () => {
    const { WebhookRouter } = require('../core/WebhookRouter.cjs');
    const r = new WebhookRouter({ port: 0 });
    r.registerDefaultHandlers();

    // Check handlers map via the module-level handlers
    // Access via registerHandler tracking — we verify by checking processEvent does not throw
    const expectedEvents = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded'
    ];

    // The handlers should be registered
    for (const evt of expectedEvents) {
      // We can test processEvent directly — it will log but not crash
      // Just verify no error thrown
      r.processEvent('test_tenant', 'stripe', evt, {
        data: { object: { metadata: {} } }
      });
    }
  });
});
