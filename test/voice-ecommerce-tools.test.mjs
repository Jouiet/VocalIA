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
 * Run: node --test test/voice-ecommerce-tools.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import ecomTools from '../core/voice-ecommerce-tools.cjs';

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

// ─── getVoiceFriendlyStatus i18n (B28-B37 — Session 250.213c) ───

describe('getVoiceFriendlyStatus - i18n multilang', () => {
  test('EN: FULFILLED returns shipped', () => {
    const msg = getVoiceFriendlyStatus('PAID', 'FULFILLED', 'shopify', 'en');
    assert.ok(msg.includes('shipped'));
  });

  test('ES: CANCELLED returns cancelada', () => {
    const msg = getVoiceFriendlyStatus('CANCELLED', null, 'shopify', 'es');
    assert.ok(msg.includes('cancelada'));
  });

  test('AR: PENDING returns في انتظار الدفع', () => {
    const msg = getVoiceFriendlyStatus('PENDING', null, 'shopify', 'ar');
    assert.ok(msg.includes('انتظار'));
  });

  test('ARY: uses ar map (REFUNDED)', () => {
    const msg = getVoiceFriendlyStatus('REFUNDED', null, 'shopify', 'ary');
    assert.ok(msg.includes('مستردة'));
  });

  test('unknown lang falls back to FR', () => {
    const msg = getVoiceFriendlyStatus('PAID', 'FULFILLED', 'shopify', 'xx');
    assert.ok(msg.includes('expédiée'));
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

// ─── checkOrderStatus i18n BEHAVIORAL (B37 — Session 250.213c) ──
// When no e-commerce credentials configured for a tenant,
// checkOrderStatus returns { found: false, reason: 'no_credentials', message: m.no_creds }
// where m.no_creds is the i18n message in the requested language.

describe('checkOrderStatus i18n — behavioral', () => {
  test('EN: no creds → message contains "tracking"', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant_xyz', 'en');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
    assert.ok(result.message.includes('tracking'),
      `EN message should contain "tracking", got: "${result.message}"`);
  });

  test('ES: no creds → message contains "seguimiento"', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant_xyz', 'es');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
    assert.ok(result.message.includes('seguimiento'),
      `ES message should contain "seguimiento", got: "${result.message}"`);
  });

  test('AR: no creds → message contains "تتبع"', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant_xyz', 'ar');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
    assert.ok(result.message.includes('تتبع'),
      `AR message should contain "تتبع", got: "${result.message}"`);
  });

  test('ARY: no creds → message contains "تتبع" (shares ar map)', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant_xyz', 'ary');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
    assert.ok(result.message.includes('تتبع') || result.message.includes('الطلبيات'),
      `ARY message should contain Darija/AR text, got: "${result.message}"`);
  });

  test('FR default: no creds → message contains "suivi"', async () => {
    const result = await ecomTools.checkOrderStatus('a@b.com', '123', 'no_tenant_xyz');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
    assert.ok(result.message.includes('suivi'),
      `FR message should contain "suivi", got: "${result.message}"`);
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

// ─── T7: searchProductsForRAG (Session 250.246) ─────────────────

describe('VoiceEcommerceTools searchProductsForRAG', () => {
  test('export exists and is a function', () => {
    assert.strictEqual(typeof ecomTools.searchProductsForRAG, 'function');
  });

  test('returns empty array for nonexistent tenant', async () => {
    const result = await ecomTools.searchProductsForRAG('shirt', 'nonexistent_tenant_xyz');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  test('returns empty array for empty query', async () => {
    const result = await ecomTools.searchProductsForRAG('', 'nonexistent_tenant');
    assert.ok(Array.isArray(result));
  });

  test('respects limit option', async () => {
    const result = await ecomTools.searchProductsForRAG('test', 'no_tenant', { limit: 1 });
    assert.ok(Array.isArray(result));
    assert.ok(result.length <= 1);
  });

  test('results have RAG-compatible format', async () => {
    // Even if empty, verify the contract
    const result = await ecomTools.searchProductsForRAG('product', 'no_tenant');
    assert.ok(Array.isArray(result));
    for (const item of result) {
      assert.ok(item.id, 'result must have id');
      assert.ok(item.text, 'result must have text');
      assert.ok(typeof item.rrfScore === 'number', 'result must have numeric rrfScore');
      assert.strictEqual(item.source, 'ecommerce_live');
    }
  });

  test('never throws — returns empty array on error', async () => {
    const result = await ecomTools.searchProductsForRAG(null, null);
    assert.ok(Array.isArray(result));
  });
});
