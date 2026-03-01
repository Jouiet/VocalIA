'use strict';

/**
 * Stripe Subscription Handler — Business logic for Stripe webhook events
 *
 * Handles subscription lifecycle:
 * - checkout.session.completed → activate subscription, upgrade plan
 * - customer.subscription.updated → sync plan changes
 * - customer.subscription.deleted → downgrade to expired
 * - invoice.payment_succeeded → log payment, notify
 *
 * Session 250.255: Revenue Pipeline End-to-End
 *
 * @module stripe-subscription-handler
 * @version 1.0.0
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');
const { atomicWriteFile } = require('./fs-utils.cjs');

// Plan mapping: Stripe price_id env vars → plan names
const PRICE_TO_PLAN = {};
function buildPriceMap() {
  const mapping = {
    STRIPE_PRICE_STARTER: 'starter',
    STRIPE_PRICE_PRO: 'pro',
    STRIPE_PRICE_ECOMMERCE: 'ecommerce',
    STRIPE_PRICE_EXPERT_CLONE: 'expert_clone',
    STRIPE_PRICE_TELEPHONY: 'telephony'
  };
  for (const [envKey, plan] of Object.entries(mapping)) {
    const priceId = process.env[envKey];
    if (priceId) PRICE_TO_PLAN[priceId] = plan;
  }
}

// Lazy-init on first call
let priceMapBuilt = false;
function ensurePriceMap() {
  if (!priceMapBuilt) {
    buildPriceMap();
    priceMapBuilt = true;
  }
}

/**
 * Map a Stripe price ID to a VocalIA plan name
 * @param {string} priceId - Stripe price_xxx ID
 * @returns {string} Plan name or 'starter' as fallback
 */
function mapPriceIdToPlan(priceId) {
  ensurePriceMap();
  return PRICE_TO_PLAN[priceId] || 'starter';
}

/**
 * Read tenant config.json
 * @param {string} tenantId
 * @returns {Object|null}
 */
async function readTenantConfig(tenantId) {
  const safeTId = sanitizeTenantId(tenantId);
  const configPath = path.join(__dirname, '..', 'clients', safeTId, 'config.json');
  try {
    const data = await fsp.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Write tenant config.json (atomic)
 * @param {string} tenantId
 * @param {Object} config
 */
async function writeTenantConfig(tenantId, config) {
  const safeTId = sanitizeTenantId(tenantId);
  const configPath = path.join(__dirname, '..', 'clients', safeTId, 'config.json');
  await atomicWriteFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Update specific fields in tenant config
 * @param {string} tenantId
 * @param {Object} updates - Fields to merge
 * @returns {boolean} success
 */
async function updateTenantConfig(tenantId, updates) {
  const config = await readTenantConfig(tenantId);
  if (!config) {
    console.error(`❌ [StripeHandler] Tenant config not found: ${tenantId}`);
    return false;
  }

  // Deep merge stripe section
  if (updates.stripe) {
    config.stripe = { ...(config.stripe || {}), ...updates.stripe };
  }
  if (updates.plan) config.plan = updates.plan;
  if (updates.features) config.features = { ...(config.features || {}), ...updates.features };
  if (updates.quotas) config.quotas = { ...(config.quotas || {}), ...updates.quotas };
  if (updates.status) config.status = updates.status;
  if (updates.trial_end !== undefined) config.trial_end = updates.trial_end;
  config.updated_at = new Date().toISOString();

  await writeTenantConfig(tenantId, config);
  return true;
}

/**
 * Handle checkout.session.completed
 * Stripe sends this when the customer completes the payment page
 */
async function handleCheckoutCompleted(session) {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) {
    console.error('❌ [StripeHandler] checkout.session.completed without tenantId in metadata');
    return;
  }

  const priceId = session.metadata?.price_id
    || session.line_items?.data?.[0]?.price?.id
    || null;
  const plan = priceId ? mapPriceIdToPlan(priceId) : 'starter';

  // Import PLAN_FEATURES and PLAN_QUOTAS from db-api scope
  const { PLAN_FEATURES, PLAN_QUOTAS } = require('./db-api.cjs');
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
  const quotas = PLAN_QUOTAS[plan] || PLAN_QUOTAS.starter;

  const success = await updateTenantConfig(tenantId, {
    stripe: {
      customer_id: session.customer,
      subscription_id: session.subscription,
      subscription_status: 'active',
      price_id: priceId
    },
    plan,
    features,
    quotas,
    trial_end: null,
    status: 'active'
  });

  if (success) {
    console.log(`✅ [StripeHandler] Subscription activated: ${tenantId} → ${plan}`);

    // Slack notification (fire-and-forget)
    try {
      const slackNotifier = require('./slack-notifier.cjs');
      slackNotifier.notifyPayment({
        tenantId,
        plan,
        amount: session.amount_total ? `${(session.amount_total / 100).toFixed(2)}€` : null,
        action: 'subscription_activated'
      });
    } catch { /* non-blocking */ }

    // EventBus publish (fire-and-forget)
    try {
      const eventBus = require('./AgencyEventBus.cjs');
      eventBus.publish('billing.subscription_activated', { tenantId, plan }, { tenantId });
    } catch { /* non-blocking */ }
  }
}

/**
 * Handle customer.subscription.updated
 * Stripe sends this on plan changes, renewals, etc.
 */
async function handleSubscriptionUpdated(subscription) {
  const tenantId = subscription.metadata?.tenantId;
  if (!tenantId) return;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = priceId ? mapPriceIdToPlan(priceId) : null;
  const status = subscription.status; // active, past_due, canceled, unpaid

  const updates = {
    stripe: {
      subscription_status: status,
      price_id: priceId || null
    }
  };

  if (plan) {
    const { PLAN_FEATURES, PLAN_QUOTAS } = require('./db-api.cjs');
    updates.plan = plan;
    updates.features = PLAN_FEATURES[plan] || PLAN_FEATURES.starter;
    updates.quotas = PLAN_QUOTAS[plan] || PLAN_QUOTAS.starter;
  }

  if (status === 'past_due' || status === 'unpaid') {
    updates.status = 'suspended';
  } else if (status === 'active') {
    updates.status = 'active';
  }

  const success = await updateTenantConfig(tenantId, updates);
  if (success) {
    console.log(`✅ [StripeHandler] Subscription updated: ${tenantId} → ${status}${plan ? ` (${plan})` : ''}`);
  }
}

/**
 * Handle customer.subscription.deleted
 * Stripe sends this when subscription is fully canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const tenantId = subscription.metadata?.tenantId;
  if (!tenantId) return;

  const success = await updateTenantConfig(tenantId, {
    stripe: {
      subscription_status: 'canceled',
      subscription_id: null
    },
    status: 'expired'
  });

  if (success) {
    console.log(`✅ [StripeHandler] Subscription canceled: ${tenantId}`);

    try {
      const slackNotifier = require('./slack-notifier.cjs');
      slackNotifier.notifyPayment({ tenantId, action: 'subscription_canceled' });
    } catch { /* non-blocking */ }

    try {
      const eventBus = require('./AgencyEventBus.cjs');
      eventBus.publish('billing.subscription_canceled', { tenantId }, { tenantId });
    } catch { /* non-blocking */ }
  }
}

/**
 * Handle invoice.payment_succeeded
 * Stripe sends this on each successful charge (initial + recurring)
 */
async function handleInvoicePaid(invoice) {
  const tenantId = invoice.subscription_details?.metadata?.tenantId
    || invoice.metadata?.tenantId
    || null;
  if (!tenantId) return;

  console.log(`✅ [StripeHandler] Invoice paid: ${tenantId} — ${(invoice.amount_paid / 100).toFixed(2)}${invoice.currency?.toUpperCase()}`);

  try {
    const slackNotifier = require('./slack-notifier.cjs');
    slackNotifier.notifyPayment({
      tenantId,
      amount: `${(invoice.amount_paid / 100).toFixed(2)}€`,
      action: 'invoice_paid'
    });
  } catch { /* non-blocking */ }
}

module.exports = {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  mapPriceIdToPlan,
  readTenantConfig,
  writeTenantConfig,
  updateTenantConfig,
  // Test helpers
  _buildPriceMap: buildPriceMap,
  _PRICE_TO_PLAN: PRICE_TO_PLAN
};
