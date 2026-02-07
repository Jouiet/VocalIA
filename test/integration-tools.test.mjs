/**
 * VocalIA Integration Tools Tests
 *
 * Tests CRM and E-commerce tool behavioral integration:
 * - Graceful degradation when no credentials are available
 * - Response format consistency
 * - Structured error handling
 *
 * Run: node --test test/integration-tools.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import crmTools from '../core/voice-crm-tools.cjs';
import ecomTools from '../core/voice-ecommerce-tools.cjs';
import { CatalogConnectorFactory, CATALOG_TYPES } from '../core/catalog-connector.cjs';
import SecretVault from '../core/SecretVault.cjs';

describe('Voice CRM Tools', () => {
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
  test('checkOrderStatus handles missing credentials', async () => {
    const result = await ecomTools.checkOrderStatus('test@example.com', 'ORD-001', '__no_creds_tenant__');
    assert.ok(result);
    assert.ok(typeof result === 'object');
  });

  test('getOrderHistory handles missing credentials', async () => {
    const result = await ecomTools.getOrderHistory('test@example.com', '__no_creds_tenant__');
    assert.ok(result);
    assert.ok(typeof result === 'object');
  });
});

describe('Catalog Connector Factory', () => {
  test('CATALOG_TYPES has expected types', () => {
    assert.ok(CATALOG_TYPES.PRODUCTS);
  });

  test('factory is available', () => {
    assert.ok(CatalogConnectorFactory);
  });
});

describe('SecretVault', () => {
  test('loadCredentials returns object for unknown tenant', async () => {
    const creds = await SecretVault.loadCredentials('__unknown_tenant__');
    assert.ok(typeof creds === 'object');
  });
});
