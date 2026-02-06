'use strict';

/**
 * VocalIA Catalog Connector Tests
 *
 * Tests:
 * - Constants (CATALOG_TYPES, CONNECTOR_STATUS)
 * - CatalogConnector base class (status, abstract methods)
 * - CustomCatalogConnector (connect, sync, search, checkAvailability, getItem)
 * - CatalogConnectorFactory (create, validateConfig, getAllConnectorsInfo)
 *
 * NOTE: No real e-commerce API calls. Tests use local JSON files.
 *
 * Run: node --test test/catalog-connector.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  CatalogConnector,
  CustomCatalogConnector,
  CatalogConnectorFactory,
  CATALOG_TYPES,
  CONNECTOR_STATUS
} = require('../core/catalog-connector.cjs');

describe('CATALOG_TYPES constants', () => {
  test('has PRODUCTS type', () => {
    assert.strictEqual(CATALOG_TYPES.PRODUCTS, 'products');
  });

  test('has MENU type', () => {
    assert.strictEqual(CATALOG_TYPES.MENU, 'menu');
  });

  test('has SERVICES type', () => {
    assert.strictEqual(CATALOG_TYPES.SERVICES, 'services');
  });

  test('has FLEET type', () => {
    assert.strictEqual(CATALOG_TYPES.FLEET, 'fleet');
  });

  test('has TRIPS type', () => {
    assert.strictEqual(CATALOG_TYPES.TRIPS, 'trips');
  });

  test('has PACKAGES type', () => {
    assert.strictEqual(CATALOG_TYPES.PACKAGES, 'packages');
  });
});

describe('CONNECTOR_STATUS constants', () => {
  test('has all statuses', () => {
    assert.strictEqual(CONNECTOR_STATUS.CONNECTED, 'connected');
    assert.strictEqual(CONNECTOR_STATUS.DISCONNECTED, 'disconnected');
    assert.strictEqual(CONNECTOR_STATUS.ERROR, 'error');
    assert.strictEqual(CONNECTOR_STATUS.SYNCING, 'syncing');
  });
});

describe('CatalogConnector base class', () => {
  test('initializes with disconnected status', () => {
    const conn = new CatalogConnector('test_tenant');
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
    assert.strictEqual(conn.tenantId, 'test_tenant');
  });

  test('getStatus returns tenant info', () => {
    const conn = new CatalogConnector('test_tenant');
    const status = conn.getStatus();
    assert.strictEqual(status.tenantId, 'test_tenant');
    assert.strictEqual(status.status, 'disconnected');
    assert.strictEqual(status.lastSync, null);
  });

  test('connect() throws (abstract)', async () => {
    const conn = new CatalogConnector('test_tenant');
    await assert.rejects(() => conn.connect(), /must be implemented/);
  });

  test('sync() throws (abstract)', async () => {
    const conn = new CatalogConnector('test_tenant');
    await assert.rejects(() => conn.sync(), /must be implemented/);
  });

  test('getItem() throws (abstract)', async () => {
    const conn = new CatalogConnector('test_tenant');
    await assert.rejects(() => conn.getItem('id1'), /must be implemented/);
  });

  test('search() throws (abstract)', async () => {
    const conn = new CatalogConnector('test_tenant');
    await assert.rejects(() => conn.search('query'), /must be implemented/);
  });

  test('disconnect() sets status to disconnected', async () => {
    const conn = new CatalogConnector('test_tenant');
    conn.status = CONNECTOR_STATUS.CONNECTED;
    await conn.disconnect();
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

describe('CustomCatalogConnector', () => {
  const testDir = path.join(__dirname, '__test_catalog_temp__');
  let connector;

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    connector = new CustomCatalogConnector('__test__', {
      dataPath: testDir,
      catalogType: CATALOG_TYPES.PRODUCTS
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  test('connect creates directory and sets status', async () => {
    const result = await connector.connect();
    assert.strictEqual(result, true);
    assert.strictEqual(connector.status, CONNECTOR_STATUS.CONNECTED);
    assert.ok(fs.existsSync(testDir));
  });

  test('sync returns empty array when no catalog file', async () => {
    await connector.connect();
    const items = await connector.sync();
    assert.deepStrictEqual(items, []);
    assert.strictEqual(connector.status, CONNECTOR_STATUS.CONNECTED);
    assert.ok(connector.lastSync);
  });

  test('sync loads catalog from JSON file', async () => {
    await connector.connect();
    // Write a test catalog
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt', price: 199, in_stock: true, category: 'vetements' },
        { id: 'P2', name: 'Jean', price: 399, in_stock: false, category: 'vetements' }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    const items = await connector.sync();
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].id, 'P1');
  });

  test('getItem returns matching item', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt', price: 199 },
        { id: 'P2', name: 'Jean', price: 399 }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    const item = await connector.getItem('P2');
    assert.ok(item);
    assert.strictEqual(item.name, 'Jean');
  });

  test('getItem returns null for missing item', async () => {
    await connector.connect();
    const catalog = { products: [{ id: 'P1', name: 'T-Shirt' }] };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    const item = await connector.getItem('NONEXISTENT');
    assert.strictEqual(item, null);
  });

  test('search finds items by name', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt Classic', price: 199, description: 'Cotton tee' },
        { id: 'P2', name: 'Jean Slim', price: 399, description: 'Stretch jean' },
        { id: 'P3', name: 'T-Shirt Premium', price: 299, description: 'Premium cotton' }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('shirt');
    assert.strictEqual(results.length, 2);
  });

  test('search filters by category', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt', category: 'vetements', description: '' },
        { id: 'P2', name: 'Sneakers', category: 'chaussures', description: '' }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('shirt', { category: 'vetements' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'P1');
  });

  test('search filters by price range', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'Cheap', price: 50, description: 'cheap item' },
        { id: 'P2', name: 'Cheap Mid', price: 100, description: 'cheap mid item' },
        { id: 'P3', name: 'Cheap Exp', price: 500, description: 'cheap expensive item' }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('cheap', { minPrice: 60, maxPrice: 200 });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'P2');
  });

  test('search respects limit', async () => {
    await connector.connect();
    const catalog = {
      products: Array.from({ length: 20 }, (_, i) => ({
        id: `P${i}`, name: `Product ${i}`, description: 'test product'
      }))
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('product', { limit: 5 });
    assert.strictEqual(results.length, 5);
  });

  test('checkAvailability returns in_stock for products', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'InStock', in_stock: true, stock: 10 },
        { id: 'P2', name: 'OutStock', in_stock: false, stock: 0 }
      ]
    };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();

    const avail1 = await connector.checkAvailability('P1');
    assert.strictEqual(avail1.available, true);
    assert.strictEqual(avail1.stock, 10);

    const avail2 = await connector.checkAvailability('P2');
    assert.ok(!avail2.available); // 0 or false — both falsy
  });

  test('checkAvailability returns item_not_found', async () => {
    await connector.connect();
    const catalog = { products: [] };
    fs.writeFileSync(path.join(testDir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const avail = await connector.checkAvailability('NONEXISTENT');
    assert.strictEqual(avail.available, false);
    assert.strictEqual(avail.reason, 'item_not_found');
  });
});

describe('CatalogConnectorFactory', () => {
  test('create returns CustomCatalogConnector for custom source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'custom' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('create returns connector for shopify source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'shopify' });
    assert.ok(conn);
    assert.ok(conn.tenantId === 'test');
  });

  test('create returns connector for woocommerce source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'woocommerce' });
    assert.ok(conn);
  });

  test('create defaults to custom for unknown source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'unknown_platform' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('validateConfig checks shopify requirements', () => {
    const result = CatalogConnectorFactory.validateConfig('shopify', {});
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.length > 0);
  });

  test('validateConfig accepts valid woocommerce config', () => {
    const result = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx',
      consumerSecret: 'cs_xxx'
    });
    assert.strictEqual(result.valid, true);
  });

  test('getAllConnectorsInfo returns array of connectors', () => {
    const info = CatalogConnectorFactory.getAllConnectorsInfo();
    assert.ok(Array.isArray(info));
    assert.ok(info.length >= 5); // At least shopify, woo, square, lightspeed, magento
    assert.ok(info[0].name);
    assert.ok(info[0].catalogType);
  });
});
