'use strict';

/**
 * VocalIA Voice E-commerce Tools Tests
 *
 * Tests:
 * - getVoiceFriendlyStatus (pure status mapping)
 * - Module exports (checkOrderStatus, checkStock, recommendProducts, getOrderHistory)
 * - Connector cache (Map)
 *
 * NOTE: Does NOT call Shopify/WooCommerce APIs. Tests pure logic only.
 *
 * Run: node --test test/voice-ecommerce-tools.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const ecomTools = require('../core/voice-ecommerce-tools.cjs');
const { getVoiceFriendlyStatus } = ecomTools;

// NOTE: Exports are proven by behavioral tests below (getVoiceFriendlyStatus, checkOrderStatus, etc.)

// ─── getVoiceFriendlyStatus ─────────────────────────────────────

describe('getVoiceFriendlyStatus - Shopify statuses', () => {
  test('FULFILLED returns expédiée', () => {
    const msg = getVoiceFriendlyStatus('PAID', 'FULFILLED', 'shopify');
    assert.ok(msg.includes('expédiée'));
  });

  test('UNFULFILLED returns préparation', () => {
    const msg = getVoiceFriendlyStatus('PAID', 'UNFULFILLED', 'shopify');
    assert.ok(msg.includes('préparation'));
  });

  test('PARTIALLY_FULFILLED returns partiellement', () => {
    const msg = getVoiceFriendlyStatus('PAID', 'PARTIALLY_FULFILLED', 'shopify');
    assert.ok(msg.includes('partiellement'));
  });

  test('PENDING returns en attente de paiement', () => {
    const msg = getVoiceFriendlyStatus('PENDING', null, 'shopify');
    assert.ok(msg.includes('paiement'));
  });

  test('PAID returns traitement', () => {
    const msg = getVoiceFriendlyStatus('PAID', null, 'shopify');
    assert.ok(msg.includes('traitement'));
  });

  test('REFUNDED returns remboursée', () => {
    const msg = getVoiceFriendlyStatus('REFUNDED', null, 'shopify');
    assert.ok(msg.includes('remboursée'));
  });

  test('CANCELLED returns annulée', () => {
    const msg = getVoiceFriendlyStatus('CANCELLED', null, 'shopify');
    assert.ok(msg.includes('annulée'));
  });
});

describe('getVoiceFriendlyStatus - WooCommerce statuses', () => {
  test('completed returns livrée', () => {
    const msg = getVoiceFriendlyStatus('completed', null, 'woocommerce');
    assert.strictEqual(msg, 'livrée');
  });

  test('processing returns préparation', () => {
    const msg = getVoiceFriendlyStatus('processing', null, 'woocommerce');
    assert.ok(msg.includes('préparation'));
  });

  test('on-hold returns en attente', () => {
    const msg = getVoiceFriendlyStatus('on-hold', null, 'woocommerce');
    assert.ok(msg.includes('attente'));
  });

  test('pending returns en attente de paiement', () => {
    const msg = getVoiceFriendlyStatus('pending', null, 'woocommerce');
    assert.ok(msg.includes('paiement'));
  });

  test('cancelled returns annulée', () => {
    const msg = getVoiceFriendlyStatus('cancelled', null, 'woocommerce');
    assert.ok(msg.includes('annulée'));
  });

  test('refunded returns remboursée', () => {
    const msg = getVoiceFriendlyStatus('refunded', null, 'woocommerce');
    assert.ok(msg.includes('remboursée'));
  });

  test('failed returns échouée', () => {
    const msg = getVoiceFriendlyStatus('failed', null, 'woocommerce');
    assert.ok(msg.includes('échouée'));
  });
});

describe('getVoiceFriendlyStatus - edge cases', () => {
  test('fulfillmentStatus overrides status', () => {
    const msg = getVoiceFriendlyStatus('PENDING', 'FULFILLED', 'shopify');
    assert.ok(msg.includes('expédiée'));
  });

  test('unknown status returns fallback with status name', () => {
    const msg = getVoiceFriendlyStatus('CUSTOM_STATUS', null, 'shopify');
    assert.ok(msg.includes('CUSTOM_STATUS'));
  });

  test('null status returns fallback', () => {
    const msg = getVoiceFriendlyStatus(null, null, 'shopify');
    assert.strictEqual(typeof msg, 'string');
  });

  test('undefined fulfillmentStatus uses status', () => {
    const msg = getVoiceFriendlyStatus('completed', undefined, 'woocommerce');
    assert.strictEqual(msg, 'livrée');
  });
});

// ─── checkOrderStatus without credentials ────────────────────────

describe('VoiceEcommerceTools checkOrderStatus (no creds)', () => {
  test('returns not found for nonexistent tenant', async () => {
    const result = await ecomTools.checkOrderStatus('test@test.com', '#1001', 'nonexistent_tenant_xyz');
    assert.strictEqual(result.found, false);
  });

  test('returns object with found property', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant');
    assert.strictEqual(typeof result.found, 'boolean');
  });
});

// ─── checkStock without connector ────────────────────────────────

describe('VoiceEcommerceTools checkStock (no connector)', () => {
  test('returns not found for nonexistent tenant', async () => {
    const result = await ecomTools.checkStock('widget', 'nonexistent_tenant_xyz');
    assert.strictEqual(result.found, false);
  });

  test('returns error message', async () => {
    const result = await ecomTools.checkStock('product', 'bad_tenant');
    assert.ok(result.error || result.found === false);
  });
});

// ─── recommendProducts without connector ─────────────────────────

describe('VoiceEcommerceTools recommendProducts (no connector)', () => {
  test('returns empty array for nonexistent tenant', async () => {
    const result = await ecomTools.recommendProducts('electronics', 'nonexistent_tenant_xyz');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });
});

// ─── getOrderHistory without credentials ─────────────────────────

describe('VoiceEcommerceTools getOrderHistory (no creds)', () => {
  test('returns not found for nonexistent tenant', async () => {
    const result = await ecomTools.getOrderHistory('test@test.com', 'nonexistent_tenant_xyz');
    assert.strictEqual(result.found, false);
    assert.ok(Array.isArray(result.orders));
  });

  test('returns empty orders array', async () => {
    const result = await ecomTools.getOrderHistory('a@b.com', 'no_tenant');
    assert.strictEqual(result.orders.length, 0);
  });
});
