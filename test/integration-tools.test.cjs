'use strict';

/**
 * VocalIA Integration Tools Tests
 *
 * Tests CRM and E-commerce tool exports, structure, and graceful
 * degradation when no credentials are available.
 *
 * NOTE: These tests do NOT call external APIs. They verify:
 * - Module exports structure
 * - Function signatures
 * - Graceful handling of missing credentials
 * - Response format consistency
 *
 * Run: node --test test/integration-tools.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Voice CRM Tools', () => {
  let crmTools;

  test('module loads without error', () => {
    crmTools = require('../core/voice-crm-tools.cjs');
    assert.ok(crmTools);
  });

  test('exports lookupCustomer function', () => {
    assert.strictEqual(typeof crmTools.lookupCustomer, 'function');
  });

  test('exports createLead function', () => {
    assert.strictEqual(typeof crmTools.createLead, 'function');
  });

  test('exports updateCustomer function', () => {
    assert.strictEqual(typeof crmTools.updateCustomer, 'function');
  });

  test('exports logCall function', () => {
    assert.strictEqual(typeof crmTools.logCall, 'function');
  });

  test('lookupCustomer returns object with found=false when no creds', async () => {
    const result = await crmTools.lookupCustomer('test@example.com', '__no_creds_tenant__');
    assert.ok(result);
    assert.strictEqual(result.found, false);
  });

  test('createLead returns object when no creds', async () => {
    const result = await crmTools.createLead(
      { email: 'lead@test.com', score: 80 },
      '__no_creds_tenant__'
    );
    assert.ok(result);
    assert.ok(typeof result.success === 'boolean');
  });

  test('updateCustomer returns error when no creds', async () => {
    const result = await crmTools.updateCustomer(
      'contact_123',
      { phone: '+212600000000' },
      '__no_creds_tenant__'
    );
    assert.ok(result);
    assert.strictEqual(result.success, false);
  });

  test('logCall returns error when no creds', async () => {
    const result = await crmTools.logCall(
      { contactId: '123', duration: 60, outcome: 'connected' },
      '__no_creds_tenant__'
    );
    assert.ok(result);
    assert.strictEqual(result.success, false);
  });
});

describe('Voice E-commerce Tools', () => {
  let ecomTools;

  test('module loads without error', () => {
    ecomTools = require('../core/voice-ecommerce-tools.cjs');
    assert.ok(ecomTools);
  });

  test('exports checkOrderStatus function', () => {
    assert.strictEqual(typeof ecomTools.checkOrderStatus, 'function');
  });

  test('exports getOrderHistory function', () => {
    assert.strictEqual(typeof ecomTools.getOrderHistory, 'function');
  });

  test('checkOrderStatus handles missing credentials', async () => {
    const result = await ecomTools.checkOrderStatus('test@example.com', 'ORD-001', '__no_creds_tenant__');
    assert.ok(result);
    // Should return a structured response even on failure
    assert.ok(typeof result === 'object');
  });

  test('getOrderHistory handles missing credentials', async () => {
    const result = await ecomTools.getOrderHistory('test@example.com', '__no_creds_tenant__');
    assert.ok(result);
    assert.ok(typeof result === 'object');
  });
});

describe('Catalog Connector Factory', () => {
  let factory;
  let CATALOG_TYPES;

  test('module loads without error', () => {
    const mod = require('../core/catalog-connector.cjs');
    factory = mod.CatalogConnectorFactory;
    CATALOG_TYPES = mod.CATALOG_TYPES;
    assert.ok(factory);
    assert.ok(CATALOG_TYPES);
  });

  test('CatalogConnectorFactory has create method', () => {
    assert.strictEqual(typeof factory.create, 'function');
  });

  test('CATALOG_TYPES has expected types', () => {
    assert.ok(CATALOG_TYPES.PRODUCTS);
  });
});

describe('SecretVault', () => {
  let SecretVault;

  test('module loads without error', () => {
    SecretVault = require('../core/SecretVault.cjs');
    assert.ok(SecretVault);
  });

  test('has loadCredentials method', () => {
    assert.strictEqual(typeof SecretVault.loadCredentials, 'function');
  });

  test('loadCredentials returns object for unknown tenant', async () => {
    const creds = await SecretVault.loadCredentials('__unknown_tenant__');
    assert.ok(typeof creds === 'object');
  });
});
