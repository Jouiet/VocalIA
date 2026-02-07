/**
 * VocalIA Catalog Connector Tests
 *
 * Tests:
 * - Constants (CATALOG_TYPES, CONNECTOR_STATUS)
 * - CatalogConnector base class (status, abstract methods, config)
 * - CustomCatalogConnector (connect, sync, search, checkAvailability, getItem)
 * - CustomCatalogConnector catalog types (MENU, SERVICES, FLEET, TRIPS, PACKAGES)
 * - CustomCatalogConnector _getEmptyCatalog, _getItems, _countItems, saveCatalog
 * - CustomCatalogConnector file path mode (isFilePath)
 * - CatalogConnectorFactory (create, validateConfig, getAllConnectorsInfo, getAvailableConnectors, getConnectorInfo)
 * - E-commerce connector constructors (Shopify, WooCommerce, Square, Lightspeed, Magento)
 *
 * NOTE: No real e-commerce API calls. Tests use local JSON files.
 *
 * Run: node --test test/catalog-connector.test.mjs
 */


import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CatalogConnector, CustomCatalogConnector, ShopifyCatalogConnector, WooCommerceCatalogConnector, SquareCatalogConnector, LightspeedCatalogConnector, MagentoCatalogConnector, CatalogConnectorFactory, CATALOG_TYPES, CONNECTOR_STATUS } from '../core/catalog-connector.cjs';


// Helper: temp dir
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-cat-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── CATALOG_TYPES ──────────────────────────────────────────────

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

  test('has exactly 6 types', () => {
    assert.strictEqual(Object.keys(CATALOG_TYPES).length, 6);
  });

  test('all values are unique strings', () => {
    const values = Object.values(CATALOG_TYPES);
    const unique = new Set(values);
    assert.strictEqual(unique.size, values.length);
    values.forEach(v => assert.strictEqual(typeof v, 'string'));
  });
});

// ─── CONNECTOR_STATUS ───────────────────────────────────────────

describe('CONNECTOR_STATUS constants', () => {
  test('has all statuses', () => {
    assert.strictEqual(CONNECTOR_STATUS.CONNECTED, 'connected');
    assert.strictEqual(CONNECTOR_STATUS.DISCONNECTED, 'disconnected');
    assert.strictEqual(CONNECTOR_STATUS.ERROR, 'error');
    assert.strictEqual(CONNECTOR_STATUS.SYNCING, 'syncing');
  });

  test('has exactly 4 statuses', () => {
    assert.strictEqual(Object.keys(CONNECTOR_STATUS).length, 4);
  });
});

// ─── CatalogConnector base class ────────────────────────────────

describe('CatalogConnector base class', () => {
  test('initializes with disconnected status', () => {
    const conn = new CatalogConnector('test_tenant');
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
    assert.strictEqual(conn.tenantId, 'test_tenant');
  });

  test('stores config object', () => {
    const cfg = { source: 'test', key: 'val' };
    const conn = new CatalogConnector('t1', cfg);
    assert.deepStrictEqual(conn.config, cfg);
  });

  test('initializes with null lastSync and lastError', () => {
    const conn = new CatalogConnector('t1');
    assert.strictEqual(conn.lastSync, null);
    assert.strictEqual(conn.lastError, null);
    assert.strictEqual(conn.catalogType, null);
  });

  test('getStatus returns tenant info', () => {
    const conn = new CatalogConnector('test_tenant');
    const status = conn.getStatus();
    assert.strictEqual(status.tenantId, 'test_tenant');
    assert.strictEqual(status.status, 'disconnected');
    assert.strictEqual(status.lastSync, null);
    assert.strictEqual(status.lastError, null);
    assert.strictEqual(status.catalogType, null);
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

  test('checkAvailability() throws (abstract)', async () => {
    const conn = new CatalogConnector('test_tenant');
    await assert.rejects(() => conn.checkAvailability('id1'), /must be implemented/);
  });

  test('disconnect() sets status to disconnected', async () => {
    const conn = new CatalogConnector('test_tenant');
    conn.status = CONNECTOR_STATUS.CONNECTED;
    await conn.disconnect();
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

// ─── CustomCatalogConnector basic ───────────────────────────────

describe('CustomCatalogConnector', () => {
  let dir;
  let connector;

  beforeEach(() => {
    dir = tmpDir();
    connector = new CustomCatalogConnector('__test__', {
      dataPath: dir,
      catalogType: CATALOG_TYPES.PRODUCTS
    });
  });

  afterEach(() => { cleanup(dir); });

  test('connect creates directory and sets status', async () => {
    const result = await connector.connect();
    assert.strictEqual(result, true);
    assert.strictEqual(connector.status, CONNECTOR_STATUS.CONNECTED);
    assert.ok(fs.existsSync(dir));
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
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt', price: 199, in_stock: true, category: 'vetements' },
        { id: 'P2', name: 'Jean', price: 399, in_stock: false, category: 'vetements' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
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
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    const item = await connector.getItem('P2');
    assert.ok(item);
    assert.strictEqual(item.name, 'Jean');
  });

  test('getItem returns null for missing item', async () => {
    await connector.connect();
    const catalog = { products: [{ id: 'P1', name: 'T-Shirt' }] };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
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
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('shirt');
    assert.strictEqual(results.length, 2);
  });

  test('search finds items by description', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'Item A', description: 'organic cotton fabric' },
        { id: 'P2', name: 'Item B', description: 'polyester blend' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('organic');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'P1');
  });

  test('search finds items by voice_description', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'Produit A', description: '', voice_description: 'un beau produit artisanal' },
        { id: 'P2', name: 'Produit B', description: '', voice_description: 'produit standard' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('artisanal');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'P1');
  });

  test('search filters by category', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'T-Shirt', category: 'vetements', description: '' },
        { id: 'P2', name: 'Sneakers', category: 'chaussures', description: '' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
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
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('cheap', { minPrice: 60, maxPrice: 200 });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'P2');
  });

  test('search filters by inStock', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'Widget A', description: 'widget', in_stock: true, price: 10 },
        { id: 'P2', name: 'Widget B', description: 'widget', in_stock: false, price: 20 },
        { id: 'P3', name: 'Widget C', description: 'widget', available: true, price: 30 }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('widget', { inStock: true });
    assert.strictEqual(results.length, 2); // P1 (in_stock) and P3 (available)
  });

  test('search respects limit', async () => {
    await connector.connect();
    const catalog = {
      products: Array.from({ length: 20 }, (_, i) => ({
        id: `P${i}`, name: `Product ${i}`, description: 'test product'
      }))
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('product', { limit: 5 });
    assert.strictEqual(results.length, 5);
  });

  test('search defaults to limit 10', async () => {
    await connector.connect();
    const catalog = {
      products: Array.from({ length: 20 }, (_, i) => ({
        id: `P${i}`, name: `Product ${i}`, description: 'test product'
      }))
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const results = await connector.search('product');
    assert.strictEqual(results.length, 10);
  });

  test('checkAvailability returns in_stock for products', async () => {
    await connector.connect();
    const catalog = {
      products: [
        { id: 'P1', name: 'InStock', in_stock: true, stock: 10 },
        { id: 'P2', name: 'OutStock', in_stock: false, stock: 0 }
      ]
    };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();

    const avail1 = await connector.checkAvailability('P1');
    assert.strictEqual(avail1.available, true);
    assert.strictEqual(avail1.stock, 10);
    assert.strictEqual(avail1.itemName, 'InStock');

    const avail2 = await connector.checkAvailability('P2');
    assert.ok(!avail2.available);
  });

  test('checkAvailability returns item_not_found', async () => {
    await connector.connect();
    const catalog = { products: [] };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await connector.sync();
    const avail = await connector.checkAvailability('NONEXISTENT');
    assert.strictEqual(avail.available, false);
    assert.strictEqual(avail.reason, 'item_not_found');
  });
});

// ─── CustomCatalogConnector file path mode ──────────────────────

describe('CustomCatalogConnector file path mode', () => {
  test('isFilePath set when dataPath ends in .json', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'catalog.json');
    const conn = new CustomCatalogConnector('t1', { dataPath: filePath });
    assert.strictEqual(conn.isFilePath, true);
    cleanup(dir);
  });

  test('isFilePath false for directory dataPath', () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t1', { dataPath: dir });
    assert.strictEqual(conn.isFilePath, false);
    cleanup(dir);
  });

  test('connect with file path succeeds when file exists', async () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'catalog.json');
    fs.writeFileSync(filePath, JSON.stringify({ products: [] }));
    const conn = new CustomCatalogConnector('t1', { dataPath: filePath });
    const result = await conn.connect();
    assert.strictEqual(result, true);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.CONNECTED);
    cleanup(dir);
  });

  test('connect with file path fails when file missing', async () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'nonexistent.json');
    const conn = new CustomCatalogConnector('t1', { dataPath: filePath });
    const result = await conn.connect();
    assert.strictEqual(result, false);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.ERROR);
    assert.ok(conn.lastError.includes('not found'));
    cleanup(dir);
  });

  test('sync reads from file path directly', async () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'catalog.json');
    fs.writeFileSync(filePath, JSON.stringify({ products: [{ id: 'FP1', name: 'File Product' }] }));
    const conn = new CustomCatalogConnector('t1', { dataPath: filePath, catalogType: CATALOG_TYPES.PRODUCTS });
    await conn.connect();
    const items = await conn.sync();
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].id, 'FP1');
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector saveCatalog ─────────────────────────

describe('CustomCatalogConnector saveCatalog', () => {
  test('saves catalog with metadata', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_save', { dataPath: dir, catalogType: CATALOG_TYPES.PRODUCTS });
    await conn.connect();
    await conn.saveCatalog({ products: [{ id: 'S1', name: 'Saved' }] });

    const filePath = path.join(dir, 'products.json');
    assert.ok(fs.existsSync(filePath));

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(saved.$schema, 'vocalia-catalog-products-v1');
    assert.strictEqual(saved.tenant_id, 't_save');
    assert.ok(saved.last_sync);
    assert.strictEqual(saved.products[0].id, 'S1');

    assert.ok(conn.lastSync);
    assert.strictEqual(conn.catalog.products[0].id, 'S1');
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector MENU type ───────────────────────────

describe('CustomCatalogConnector MENU type', () => {
  test('_getItems flattens menu categories', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_menu', { dataPath: dir, catalogType: CATALOG_TYPES.MENU });
    await conn.connect();
    const catalog = {
      menu: {
        categories: [
          { name: 'Entrees', items: [{ id: 'M1', name: 'Salade', price: 50 }, { id: 'M2', name: 'Soupe', price: 35 }] },
          { name: 'Plats', items: [{ id: 'M3', name: 'Tajine', price: 80 }] }
        ]
      }
    };
    fs.writeFileSync(path.join(dir, 'menu.json'), JSON.stringify(catalog));
    const items = await conn.sync();
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].category, 'Entrees');
    assert.strictEqual(items[2].category, 'Plats');
    assert.strictEqual(items[2].name, 'Tajine');
    cleanup(dir);
  });

  test('checkAvailability MENU returns available by default', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_menu', { dataPath: dir, catalogType: CATALOG_TYPES.MENU });
    await conn.connect();
    const catalog = {
      menu: {
        categories: [
          { name: 'Plats', items: [
            { id: 'M1', name: 'Tajine', available: true, preparation_time: '20min' },
            { id: 'M2', name: 'Couscous', available: false, preparation_time: '45min' }
          ]}
        ]
      }
    };
    fs.writeFileSync(path.join(dir, 'menu.json'), JSON.stringify(catalog));
    await conn.sync();

    const a1 = await conn.checkAvailability('M1');
    assert.strictEqual(a1.available, true);
    assert.strictEqual(a1.preparationTime, '20min');

    const a2 = await conn.checkAvailability('M2');
    assert.strictEqual(a2.available, false);
    cleanup(dir);
  });

  test('_getEmptyCatalog for MENU', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_menu', { dataPath: dir, catalogType: CATALOG_TYPES.MENU });
    await conn.connect();
    const items = await conn.sync(); // No file exists → empty catalog
    assert.deepStrictEqual(items, []);
    assert.ok(conn.catalog.menu);
    assert.deepStrictEqual(conn.catalog.menu.categories, []);
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector SERVICES type ───────────────────────

describe('CustomCatalogConnector SERVICES type', () => {
  test('loads services and checks slot availability', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_svc', { dataPath: dir, catalogType: CATALOG_TYPES.SERVICES });
    await conn.connect();
    const catalog = {
      services: [
        { id: 'SVC1', name: 'Coupe Homme', price: 100, duration: 30 },
        { id: 'SVC2', name: 'Coupe Femme', price: 150, duration: 45 }
      ],
      slots: {
        slots_by_date: {
          '2026-03-01': [
            { time: '09:00', available: true, service_ids: ['SVC1', 'SVC2'] },
            { time: '10:00', available: false, service_ids: ['SVC1'] },
            { time: '11:00', available: true, service_ids: ['SVC1'] }
          ]
        }
      }
    };
    fs.writeFileSync(path.join(dir, 'services.json'), JSON.stringify(catalog));
    await conn.sync();

    const avail = await conn.checkAvailability('SVC1', { date: '2026-03-01' });
    assert.strictEqual(avail.available, true);
    assert.strictEqual(avail.slots.length, 2); // 09:00 and 11:00
    assert.ok(avail.slots.includes('09:00'));
    assert.ok(avail.slots.includes('11:00'));

    const noSlots = await conn.checkAvailability('SVC2', { date: '2026-03-02' });
    assert.strictEqual(noSlots.available, false);
    assert.strictEqual(noSlots.slots.length, 0);
    cleanup(dir);
  });

  test('_getEmptyCatalog for SERVICES', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_svc', { dataPath: dir, catalogType: CATALOG_TYPES.SERVICES });
    await conn.connect();
    await conn.sync();
    assert.deepStrictEqual(conn.catalog.services, []);
    assert.ok(conn.catalog.slots);
    assert.deepStrictEqual(conn.catalog.slots.slots_by_date, {});
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector FLEET type ──────────────────────────

describe('CustomCatalogConnector FLEET type', () => {
  test('normalizes vehicle names', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_fleet', { dataPath: dir, catalogType: CATALOG_TYPES.FLEET });
    await conn.connect();
    const catalog = {
      vehicles: [
        { id: 'V1', brand: 'Dacia', model: 'Logan', price_per_day: 200, available_from: '2026-01-01', available_to: '2026-12-31' },
        { id: 'V2', brand: 'Renault', model: 'Clio', name: 'Custom Name', price_per_day: 250, available_from: '2026-01-01', available_to: '2026-06-30' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'fleet.json'), JSON.stringify(catalog));
    const items = await conn.sync();
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].name, 'Dacia Logan');
    assert.strictEqual(items[1].name, 'Custom Name'); // Keeps existing name
    cleanup(dir);
  });

  test('checkAvailability FLEET checks date range', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_fleet', { dataPath: dir, catalogType: CATALOG_TYPES.FLEET });
    await conn.connect();
    const catalog = {
      vehicles: [
        { id: 'V1', brand: 'Dacia', model: 'Logan', price_per_day: 200, available_from: '2026-01-01', available_to: '2026-06-30' }
      ]
    };
    fs.writeFileSync(path.join(dir, 'fleet.json'), JSON.stringify(catalog));
    await conn.sync();

    const avail = await conn.checkAvailability('V1', { fromDate: '2026-03-01', toDate: '2026-03-15' });
    assert.strictEqual(avail.available, true);
    assert.strictEqual(avail.pricePerDay, 200);
    assert.strictEqual(avail.itemName, 'Dacia Logan');

    const unavail = await conn.checkAvailability('V1', { fromDate: '2026-07-01', toDate: '2026-07-15' });
    assert.strictEqual(unavail.available, false);
    cleanup(dir);
  });

  test('_getEmptyCatalog for FLEET', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_fleet', { dataPath: dir, catalogType: CATALOG_TYPES.FLEET });
    await conn.connect();
    await conn.sync();
    assert.deepStrictEqual(conn.catalog.vehicles, []);
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector TRIPS type ──────────────────────────

describe('CustomCatalogConnector TRIPS type', () => {
  test('normalizes trip names', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_trips', { dataPath: dir, catalogType: CATALOG_TYPES.TRIPS });
    await conn.connect();
    const catalog = {
      trips: [
        { id: 'T1', destination: 'Marrakech', country: 'Morocco', price: 3000 },
        { id: 'T2', destination: 'Paris', country: 'France', name: 'Paris Trip', price: 5000 }
      ]
    };
    fs.writeFileSync(path.join(dir, 'trips.json'), JSON.stringify(catalog));
    const items = await conn.sync();
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].name, 'Marrakech, Morocco');
    assert.strictEqual(items[1].name, 'Paris Trip'); // Keeps existing name
    cleanup(dir);
  });

  test('_getEmptyCatalog for TRIPS', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_trips', { dataPath: dir, catalogType: CATALOG_TYPES.TRIPS });
    await conn.connect();
    await conn.sync();
    assert.deepStrictEqual(conn.catalog.trips, []);
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector PACKAGES type ───────────────────────

describe('CustomCatalogConnector PACKAGES type', () => {
  test('loads packages', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_pkg', { dataPath: dir, catalogType: CATALOG_TYPES.PACKAGES });
    await conn.connect();
    const catalog = {
      packages: [
        { id: 'PK1', name: 'Basic Package', price: 1000 },
        { id: 'PK2', name: 'Premium Package', price: 3000 }
      ]
    };
    fs.writeFileSync(path.join(dir, 'packages.json'), JSON.stringify(catalog));
    const items = await conn.sync();
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].name, 'Basic Package');
    cleanup(dir);
  });

  test('checkAvailability PACKAGES returns available by default', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_pkg', { dataPath: dir, catalogType: CATALOG_TYPES.PACKAGES });
    await conn.connect();
    const catalog = { packages: [{ id: 'PK1', name: 'Basic' }] };
    fs.writeFileSync(path.join(dir, 'packages.json'), JSON.stringify(catalog));
    await conn.sync();
    const avail = await conn.checkAvailability('PK1');
    assert.strictEqual(avail.available, true);
    assert.strictEqual(avail.itemId, 'PK1');
    cleanup(dir);
  });

  test('_getEmptyCatalog for PACKAGES', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_pkg', { dataPath: dir, catalogType: CATALOG_TYPES.PACKAGES });
    await conn.connect();
    await conn.sync();
    assert.deepStrictEqual(conn.catalog.packages, []);
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector _countItems ─────────────────────────

describe('CustomCatalogConnector _countItems', () => {
  test('returns 0 when no catalog', () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t1', { dataPath: dir, catalogType: CATALOG_TYPES.PRODUCTS });
    assert.strictEqual(conn._countItems(), 0);
    cleanup(dir);
  });

  test('counts products correctly', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t1', { dataPath: dir, catalogType: CATALOG_TYPES.PRODUCTS });
    await conn.connect();
    const catalog = { products: [{ id: 'A' }, { id: 'B' }, { id: 'C' }] };
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(catalog));
    await conn.sync();
    assert.strictEqual(conn._countItems(), 3);
    cleanup(dir);
  });
});

// ─── CustomCatalogConnector sync auto-connect ───────────────────

describe('CustomCatalogConnector sync auto-connect', () => {
  test('sync auto-connects if not connected', async () => {
    const dir = tmpDir();
    const conn = new CustomCatalogConnector('t_auto', { dataPath: dir, catalogType: CATALOG_TYPES.PRODUCTS });
    // Don't call connect(), sync should auto-connect
    const items = await conn.sync();
    assert.deepStrictEqual(items, []);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.CONNECTED);
    cleanup(dir);
  });
});

// ─── E-commerce connector constructors ──────────────────────────

describe('ShopifyCatalogConnector constructor', () => {
  test('initializes with config', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 'my-store', accessToken: 'tok123' });
    assert.strictEqual(conn.tenantId, 't1');
    assert.strictEqual(conn.shop, 'my-store');
    assert.strictEqual(conn.accessToken, 'tok123');
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.PRODUCTS);
    assert.strictEqual(conn.apiVersion, '2026-01');
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });

  test('accepts custom apiVersion and currency', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 's', accessToken: 't', apiVersion: '2025-10', currency: 'EUR' });
    assert.strictEqual(conn.apiVersion, '2025-10');
    assert.strictEqual(conn.currency, 'EUR');
  });

  test('defaults currency to MAD', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 's', accessToken: 't' });
    assert.strictEqual(conn.currency, 'MAD');
  });

  test('has rate limit tracking', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 's', accessToken: 't' });
    assert.strictEqual(conn.availablePoints, 1000);
    assert.strictEqual(conn.restoreRate, 50);
    assert.strictEqual(conn.lastCost, 0);
  });

  test('connect fails without shop/accessToken', async () => {
    const conn = new ShopifyCatalogConnector('t1', {});
    const result = await conn.connect();
    assert.strictEqual(result, false);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.ERROR);
    assert.ok(conn.lastError.includes('Missing'));
  });
});

describe('WooCommerceCatalogConnector constructor', () => {
  test('initializes with config', () => {
    const conn = new WooCommerceCatalogConnector('t1', {
      storeUrl: 'https://store.test',
      consumerKey: 'ck_xxx',
      consumerSecret: 'cs_xxx'
    });
    assert.strictEqual(conn.tenantId, 't1');
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.PRODUCTS);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

describe('SquareCatalogConnector constructor', () => {
  test('initializes with config', () => {
    const conn = new SquareCatalogConnector('t1', { accessToken: 'sq_tok' });
    assert.strictEqual(conn.tenantId, 't1');
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.PRODUCTS);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

describe('LightspeedCatalogConnector constructor', () => {
  test('initializes with config', () => {
    const conn = new LightspeedCatalogConnector('t1', { accessToken: 'ls_tok' });
    assert.strictEqual(conn.tenantId, 't1');
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.MENU);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

describe('MagentoCatalogConnector constructor', () => {
  test('initializes with config', () => {
    const conn = new MagentoCatalogConnector('t1', { baseUrl: 'https://mag.test', accessToken: 'mag_tok' });
    assert.strictEqual(conn.tenantId, 't1');
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.PRODUCTS);
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

// ─── CatalogConnectorFactory ────────────────────────────────────

describe('CatalogConnectorFactory create', () => {
  test('create returns CustomCatalogConnector for custom source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'custom' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('create returns ShopifyCatalogConnector for shopify source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'shopify', shop: 's', accessToken: 't' });
    assert.ok(conn instanceof ShopifyCatalogConnector);
    assert.strictEqual(conn.tenantId, 'test');
  });

  test('create returns WooCommerceCatalogConnector for woocommerce source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'woocommerce', storeUrl: 'u', consumerKey: 'k', consumerSecret: 's' });
    assert.ok(conn instanceof WooCommerceCatalogConnector);
  });

  test('create returns SquareCatalogConnector for square source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'square', accessToken: 't' });
    assert.ok(conn instanceof SquareCatalogConnector);
  });

  test('create returns LightspeedCatalogConnector for lightspeed source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'lightspeed', accessToken: 't' });
    assert.ok(conn instanceof LightspeedCatalogConnector);
  });

  test('create returns MagentoCatalogConnector for magento source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'magento', baseUrl: 'u', accessToken: 't' });
    assert.ok(conn instanceof MagentoCatalogConnector);
  });

  test('create defaults to custom for unknown source', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'unknown_platform' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('create uses type field if source not present', () => {
    const conn = CatalogConnectorFactory.create('test', { type: 'shopify', shop: 's', accessToken: 't' });
    assert.ok(conn instanceof ShopifyCatalogConnector);
  });

  test('create defaults to custom with empty config', () => {
    const conn = CatalogConnectorFactory.create('test', {});
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('create passes catalogType override', () => {
    const conn = CatalogConnectorFactory.create('test', { source: 'custom', catalogType: CATALOG_TYPES.MENU });
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.MENU);
  });
});

describe('CatalogConnectorFactory getAvailableConnectors', () => {
  test('returns array of connector type strings', () => {
    const types = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(Array.isArray(types));
    assert.ok(types.length >= 6);
    assert.ok(types.includes('shopify'));
    assert.ok(types.includes('woocommerce'));
    assert.ok(types.includes('square'));
    assert.ok(types.includes('lightspeed'));
    assert.ok(types.includes('magento'));
    assert.ok(types.includes('custom'));
  });
});

describe('CatalogConnectorFactory getConnectorInfo', () => {
  test('returns info for valid type', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('shopify');
    assert.ok(info);
    assert.strictEqual(info.name, 'Shopify');
    assert.ok(info.requiredConfig.includes('shop'));
    assert.ok(info.requiredConfig.includes('accessToken'));
  });

  test('returns info case-insensitive', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('SHOPIFY');
    assert.ok(info);
    assert.strictEqual(info.name, 'Shopify');
  });

  test('returns null for unknown type', () => {
    assert.strictEqual(CatalogConnectorFactory.getConnectorInfo('unknown'), null);
  });

  test('returns null for null input', () => {
    assert.strictEqual(CatalogConnectorFactory.getConnectorInfo(null), null);
  });

  test('woocommerce info has 3 required config keys', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('woocommerce');
    assert.strictEqual(info.requiredConfig.length, 3);
    assert.ok(info.requiredConfig.includes('storeUrl'));
    assert.ok(info.requiredConfig.includes('consumerKey'));
    assert.ok(info.requiredConfig.includes('consumerSecret'));
  });

  test('custom info has empty requiredConfig', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('custom');
    assert.strictEqual(info.requiredConfig.length, 0);
  });
});

describe('CatalogConnectorFactory validateConfig', () => {
  test('shopify empty config is invalid', () => {
    const result = CatalogConnectorFactory.validateConfig('shopify', {});
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.length > 0);
    assert.ok(result.missing.includes('shop'));
    assert.ok(result.missing.includes('accessToken'));
  });

  test('shopify valid config', () => {
    const result = CatalogConnectorFactory.validateConfig('shopify', { shop: 'my-store', accessToken: 'tok' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
  });

  test('woocommerce valid config', () => {
    const result = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx',
      consumerSecret: 'cs_xxx'
    });
    assert.strictEqual(result.valid, true);
  });

  test('woocommerce missing consumerSecret', () => {
    const result = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx'
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('consumerSecret'));
  });

  test('square without locationId gives warning', () => {
    const result = CatalogConnectorFactory.validateConfig('square', { accessToken: 'tok' });
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('locationId'));
  });

  test('square with locationId no warning', () => {
    const result = CatalogConnectorFactory.validateConfig('square', { accessToken: 'tok', locationId: 'loc1' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('lightspeed without series gives warning', () => {
    const result = CatalogConnectorFactory.validateConfig('lightspeed', { accessToken: 'tok' });
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('series'));
  });

  test('lightspeed with series no warning', () => {
    const result = CatalogConnectorFactory.validateConfig('lightspeed', { accessToken: 'tok', series: 'K' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('magento valid config', () => {
    const result = CatalogConnectorFactory.validateConfig('magento', { baseUrl: 'https://mag.test', accessToken: 'tok' });
    assert.strictEqual(result.valid, true);
  });

  test('magento missing accessToken', () => {
    const result = CatalogConnectorFactory.validateConfig('magento', { baseUrl: 'https://mag.test' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('accessToken'));
  });

  test('unknown connector type returns invalid with warning', () => {
    const result = CatalogConnectorFactory.validateConfig('nonexistent', {});
    assert.strictEqual(result.valid, false);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('Unknown'));
  });

  test('custom connector always valid (no required config)', () => {
    const result = CatalogConnectorFactory.validateConfig('custom', {});
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
  });
});

describe('CatalogConnectorFactory getAllConnectorsInfo', () => {
  test('returns array of connector info objects', () => {
    const info = CatalogConnectorFactory.getAllConnectorsInfo();
    assert.ok(Array.isArray(info));
    assert.ok(info.length >= 6);
  });

  test('each item has required fields', () => {
    const info = CatalogConnectorFactory.getAllConnectorsInfo();
    for (const item of info) {
      assert.strictEqual(typeof item.type, 'string');
      assert.strictEqual(typeof item.name, 'string');
      assert.strictEqual(typeof item.catalogType, 'string');
      assert.ok(Array.isArray(item.requiredConfig));
      assert.ok(Array.isArray(item.optionalConfig));
      assert.strictEqual(typeof item.marketShare, 'string');
      assert.strictEqual(typeof item.description, 'string');
    }
  });

  test('includes shopify and woocommerce', () => {
    const info = CatalogConnectorFactory.getAllConnectorsInfo();
    const types = info.map(i => i.type);
    assert.ok(types.includes('shopify'));
    assert.ok(types.includes('woocommerce'));
  });
});

// NOTE: Exports are proven by behavioral tests above (CATALOG_TYPES, CONNECTOR_STATUS,
// CustomCatalogConnector, CatalogConnectorFactory, e-commerce constructors, etc.)

// ─── CatalogConnectorFactory static methods ─────────────────────

describe('CatalogConnectorFactory getAvailableConnectors', () => {
  test('returns array of connector types', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(Array.isArray(connectors));
    assert.ok(connectors.length >= 6);
  });

  test('includes shopify', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('shopify'));
  });

  test('includes woocommerce', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('woocommerce'));
  });

  test('includes square', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('square'));
  });

  test('includes lightspeed', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('lightspeed'));
  });

  test('includes magento', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('magento'));
  });

  test('includes custom', () => {
    const connectors = CatalogConnectorFactory.getAvailableConnectors();
    assert.ok(connectors.includes('custom'));
  });
});

describe('CatalogConnectorFactory getConnectorInfo', () => {
  test('returns info for shopify', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('shopify');
    assert.ok(info);
    assert.strictEqual(info.name, 'Shopify');
    assert.ok(info.requiredConfig.includes('shop'));
    assert.ok(info.requiredConfig.includes('accessToken'));
  });

  test('returns info for woocommerce', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('woocommerce');
    assert.ok(info);
    assert.strictEqual(info.name, 'WooCommerce');
    assert.ok(info.requiredConfig.includes('storeUrl'));
  });

  test('is case insensitive', () => {
    const lower = CatalogConnectorFactory.getConnectorInfo('shopify');
    const upper = CatalogConnectorFactory.getConnectorInfo('SHOPIFY');
    assert.strictEqual(lower?.name, upper?.name);
  });

  test('returns null for unknown type', () => {
    const info = CatalogConnectorFactory.getConnectorInfo('nonexistent');
    assert.strictEqual(info, null);
  });

  test('returns null for null input', () => {
    const info = CatalogConnectorFactory.getConnectorInfo(null);
    assert.strictEqual(info, null);
  });
});

describe('CatalogConnectorFactory getAllConnectorsInfo', () => {
  test('returns array of connector metadata', () => {
    const all = CatalogConnectorFactory.getAllConnectorsInfo();
    assert.ok(Array.isArray(all));
    assert.ok(all.length >= 6);
  });

  test('each entry has type, name, catalogType, requiredConfig', () => {
    const all = CatalogConnectorFactory.getAllConnectorsInfo();
    for (const entry of all) {
      assert.ok(entry.type, `Missing type`);
      assert.ok(entry.name, `Missing name for ${entry.type}`);
      assert.ok(entry.catalogType, `Missing catalogType for ${entry.type}`);
      assert.ok(Array.isArray(entry.requiredConfig), `requiredConfig not array for ${entry.type}`);
    }
  });

  test('includes marketShare for each', () => {
    const all = CatalogConnectorFactory.getAllConnectorsInfo();
    for (const entry of all) {
      assert.ok(entry.marketShare !== undefined, `Missing marketShare for ${entry.type}`);
    }
  });
});

describe('CatalogConnectorFactory validateConfig', () => {
  test('shopify with empty config returns invalid', () => {
    const result = CatalogConnectorFactory.validateConfig('shopify', {});
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('shop'));
    assert.ok(result.missing.includes('accessToken'));
  });

  test('shopify with full config returns valid', () => {
    const result = CatalogConnectorFactory.validateConfig('shopify', { shop: 'test.myshopify.com', accessToken: 'xxx' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
  });

  test('woocommerce with full config returns valid', () => {
    const result = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx',
      consumerSecret: 'cs_xxx'
    });
    assert.strictEqual(result.valid, true);
  });

  test('woocommerce missing consumerSecret returns invalid', () => {
    const result = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx'
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('consumerSecret'));
  });

  test('unknown connector returns invalid with warning', () => {
    const result = CatalogConnectorFactory.validateConfig('nonexistent', {});
    assert.strictEqual(result.valid, false);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('Unknown'));
  });

  test('square without locationId generates warning', () => {
    const result = CatalogConnectorFactory.validateConfig('square', { accessToken: 'xxx' });
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('locationId'));
  });

  test('lightspeed without series generates warning', () => {
    const result = CatalogConnectorFactory.validateConfig('lightspeed', { accessToken: 'xxx' });
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes('series'));
  });

  test('custom with empty config returns valid', () => {
    const result = CatalogConnectorFactory.validateConfig('custom', {});
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
  });

  test('magento missing baseUrl returns invalid', () => {
    const result = CatalogConnectorFactory.validateConfig('magento', { accessToken: 'xxx' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes('baseUrl'));
  });
});

describe('CatalogConnectorFactory create', () => {
  test('creates custom connector by default', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', { source: 'custom' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });

  test('creates shopify connector', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', {
      source: 'shopify', shop: 'test.myshopify.com', accessToken: 'xxx'
    });
    assert.ok(conn instanceof ShopifyCatalogConnector);
  });

  test('creates woocommerce connector', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', {
      source: 'woocommerce', storeUrl: 'https://test.com', consumerKey: 'ck', consumerSecret: 'cs'
    });
    assert.ok(conn instanceof WooCommerceCatalogConnector);
  });

  test('creates square connector', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', {
      source: 'square', accessToken: 'xxx'
    });
    assert.ok(conn instanceof SquareCatalogConnector);
  });

  test('creates lightspeed connector', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', {
      source: 'lightspeed', accessToken: 'xxx'
    });
    assert.ok(conn instanceof LightspeedCatalogConnector);
  });

  test('creates magento connector', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', {
      source: 'magento', baseUrl: 'https://magento.test', accessToken: 'xxx'
    });
    assert.ok(conn instanceof MagentoCatalogConnector);
  });

  test('unknown source falls back to custom', () => {
    const conn = CatalogConnectorFactory.create('test_tenant', { source: 'unknown_platform' });
    assert.ok(conn instanceof CustomCatalogConnector);
  });
});

// ─── E-commerce connector constructors ──────────────────────────

describe('ShopifyCatalogConnector constructor', () => {
  test('stores shop and accessToken', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 'my.myshopify.com', accessToken: 'tk' });
    assert.strictEqual(conn.shop, 'my.myshopify.com');
    assert.strictEqual(conn.accessToken, 'tk');
  });

  test('defaults catalogType to PRODUCTS', () => {
    const conn = new ShopifyCatalogConnector('t1', { shop: 's', accessToken: 't' });
    assert.strictEqual(conn.catalogType, CATALOG_TYPES.PRODUCTS);
  });
});

describe('WooCommerceCatalogConnector constructor', () => {
  test('stores storeUrl and credentials', () => {
    const conn = new WooCommerceCatalogConnector('t1', {
      storeUrl: 'https://store.test', consumerKey: 'ck', consumerSecret: 'cs'
    });
    assert.strictEqual(conn.storeUrl, 'https://store.test');
    assert.strictEqual(conn.consumerKey, 'ck');
    assert.strictEqual(conn.consumerSecret, 'cs');
  });
});

describe('SquareCatalogConnector constructor', () => {
  test('stores accessToken', () => {
    const conn = new SquareCatalogConnector('t1', { accessToken: 'sq_tk' });
    assert.strictEqual(conn.accessToken, 'sq_tk');
  });

  test('initializes with disconnected status', () => {
    const conn = new SquareCatalogConnector('t1', { accessToken: 'sq_tk' });
    assert.strictEqual(conn.status, CONNECTOR_STATUS.DISCONNECTED);
  });
});

describe('LightspeedCatalogConnector constructor', () => {
  test('stores accessToken', () => {
    const conn = new LightspeedCatalogConnector('t1', { accessToken: 'ls_tk' });
    assert.strictEqual(conn.accessToken, 'ls_tk');
  });

  test('defaults series to K (Restaurant)', () => {
    const conn = new LightspeedCatalogConnector('t1', { accessToken: 'ls_tk' });
    assert.strictEqual(conn.series, 'K');
  });
});

describe('MagentoCatalogConnector constructor', () => {
  test('stores baseUrl and accessToken', () => {
    const conn = new MagentoCatalogConnector('t1', { baseUrl: 'https://magento.test', accessToken: 'mg_tk' });
    assert.strictEqual(conn.baseUrl, 'https://magento.test');
    assert.strictEqual(conn.accessToken, 'mg_tk');
  });
});

// ─── ShopifyCatalogConnector pure methods ────────────────────────

describe('ShopifyCatalogConnector _transformProduct', () => {
  const conn = new ShopifyCatalogConnector('t1', { shop: 'test', accessToken: 'tok', currency: 'EUR' });

  test('extracts basic product fields', () => {
    const shopifyProduct = {
      id: 'gid://shopify/Product/12345',
      title: 'T-Shirt',
      handle: 't-shirt',
      description: 'A nice t-shirt',
      status: 'ACTIVE',
      productType: 'Clothing',
      tags: ['summer', 'cotton'],
      totalInventory: 10,
      variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/111', title: 'Default', price: '29.99', sku: 'TS-001', inventoryQuantity: 10, availableForSale: true, selectedOptions: [] } }] },
      images: { edges: [{ node: { url: 'https://img.shopify.com/1.jpg', altText: '' } }] }
    };
    const result = conn._transformProduct(shopifyProduct);
    assert.strictEqual(result.id, '12345');
    assert.strictEqual(result.gid, 'gid://shopify/Product/12345');
    assert.strictEqual(result.name, 'T-Shirt');
    assert.strictEqual(result.price, 29.99);
    assert.strictEqual(result.currency, 'EUR');
    assert.strictEqual(result.stock, 10);
    assert.strictEqual(result.in_stock, true);
    assert.strictEqual(result.sku, 'TS-001');
    assert.ok(result.voice_description);
    assert.ok(result.voice_summary);
  });

  test('handles product with 0 stock', () => {
    const product = {
      id: 'gid://shopify/Product/999',
      title: 'Out of Stock',
      handle: 'out',
      description: '',
      status: 'ACTIVE',
      productType: '',
      tags: [],
      variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/999', title: 'Default', price: '50', sku: '', inventoryQuantity: 0, availableForSale: false, selectedOptions: [] } }] },
      images: { edges: [] }
    };
    const result = conn._transformProduct(product);
    assert.strictEqual(result.stock, 0);
    assert.strictEqual(result.in_stock, false);
  });

  test('handles product with no variants', () => {
    const product = {
      id: 'gid://shopify/Product/0',
      title: 'No Variants',
      handle: 'nv',
      description: '',
      status: 'ACTIVE',
      productType: '',
      tags: [],
      variants: { edges: [] },
      images: { edges: [] }
    };
    const result = conn._transformProduct(product);
    assert.strictEqual(result.price, 0);
    assert.strictEqual(result.sku, '');
  });
});

describe('ShopifyCatalogConnector _generateVoiceDescription', () => {
  const conn = new ShopifyCatalogConnector('t1', { currency: 'MAD' });

  test('includes price', () => {
    const desc = conn._generateVoiceDescription({ title: 'T-Shirt' }, 199, 10);
    assert.ok(desc.includes('199'));
    assert.ok(desc.includes('MAD'));
  });

  test('marks out of stock', () => {
    const desc = conn._generateVoiceDescription({ title: 'Item' }, 50, 0);
    assert.ok(desc.includes('rupture de stock'));
  });

  test('warns low stock (<= 5)', () => {
    const desc = conn._generateVoiceDescription({ title: 'Item' }, 50, 3);
    assert.ok(desc.includes('plus que 3'));
  });

  test('no stock warning for stock > 5', () => {
    const desc = conn._generateVoiceDescription({ title: 'Item' }, 50, 10);
    assert.ok(!desc.includes('rupture'));
    assert.ok(!desc.includes('plus que'));
  });
});

describe('ShopifyCatalogConnector _generateVoiceSummary', () => {
  const conn = new ShopifyCatalogConnector('t1', { currency: 'EUR' });

  test('formats summary correctly', () => {
    assert.strictEqual(conn._generateVoiceSummary({ title: 'Jean Slim' }, 399), 'Jean Slim à 399 EUR');
  });
});

// ─── WooCommerceCatalogConnector pure methods ────────────────────

describe('WooCommerceCatalogConnector _stripHtml', () => {
  const conn = new WooCommerceCatalogConnector('t1');

  test('strips HTML tags', () => {
    assert.strictEqual(conn._stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
  });

  test('replaces &nbsp;', () => {
    assert.strictEqual(conn._stripHtml('Hello&nbsp;World'), 'Hello World');
  });

  test('trims whitespace', () => {
    assert.strictEqual(conn._stripHtml('  Hello  '), 'Hello');
  });

  test('handles empty string', () => {
    assert.strictEqual(conn._stripHtml(''), '');
  });
});

describe('WooCommerceCatalogConnector _transformProduct', () => {
  const conn = new WooCommerceCatalogConnector('t1', { currency: 'MAD' });

  test('transforms basic WooCommerce product', () => {
    const wooProduct = {
      id: 42,
      sku: 'WOO-001',
      name: 'Kaftan',
      slug: 'kaftan',
      price: '299',
      regular_price: '399',
      sale_price: '299',
      on_sale: true,
      stock_quantity: 5,
      stock_status: 'instock',
      manage_stock: true,
      type: 'simple',
      categories: [{ name: 'Clothing' }],
      tags: [{ name: 'traditional' }],
      images: [{ src: 'https://img.com/1.jpg' }],
      attributes: [{ name: 'Color', options: ['Red', 'Blue'] }],
      description: '<p>Beautiful kaftan</p>',
      short_description: '<b>Traditional</b>',
      variations: [42001]
    };
    const result = conn._transformProduct(wooProduct);
    assert.strictEqual(result.id, '42');
    assert.strictEqual(result.price, 299);
    assert.strictEqual(result.sale_price, 299);
    assert.strictEqual(result.on_sale, true);
    assert.strictEqual(result.in_stock, true);
    assert.strictEqual(result.description, 'Beautiful kaftan');
    assert.strictEqual(result.short_description, 'Traditional');
    assert.ok(result.voice_description.includes('promotion'));
  });
});

describe('WooCommerceCatalogConnector _generateVoiceDescription', () => {
  const conn = new WooCommerceCatalogConnector('t1', { currency: 'MAD' });

  test('includes sale price when on sale', () => {
    const desc = conn._generateVoiceDescription({ name: 'Item' }, 100, true, 80);
    assert.ok(desc.includes('promotion'));
    assert.ok(desc.includes('80'));
  });

  test('includes regular price when not on sale', () => {
    const desc = conn._generateVoiceDescription({ name: 'Item' }, 100, true, null);
    assert.ok(desc.includes('100'));
    assert.ok(!desc.includes('promotion'));
  });

  test('marks out of stock', () => {
    const desc = conn._generateVoiceDescription({ name: 'Item' }, 50, false, null);
    assert.ok(desc.includes('rupture de stock'));
  });
});

// ─── MagentoCatalogConnector _transformProduct ───────────────────

describe('MagentoCatalogConnector _transformProduct', () => {
  const conn = new MagentoCatalogConnector('t1', { currency: 'EUR' });

  test('transforms Magento product', () => {
    const product = {
      id: 100,
      sku: 'MAG-001',
      name: 'Widget',
      price: 49.99,
      type_id: 'simple',
      status: 1,
      visibility: 4,
      custom_attributes: [
        { attribute_code: 'description', value: 'A widget' },
        { attribute_code: 'category_ids', value: '5,10' }
      ],
      extension_attributes: { stock_item: { is_in_stock: true, qty: 25 } },
      media_gallery_entries: [{ file: '/w/widget.jpg' }]
    };
    const result = conn._transformProduct(product);
    assert.strictEqual(result.id, '100');
    assert.strictEqual(result.sku, 'MAG-001');
    assert.strictEqual(result.price, 49.99);
    assert.strictEqual(result.stock, 25);
    assert.strictEqual(result.in_stock, true);
    assert.strictEqual(result.description, 'A widget');
  });

  test('handles product without stock extension', () => {
    const product = {
      id: 200,
      sku: 'MAG-002',
      name: 'No Stock',
      price: 10,
      custom_attributes: [],
      media_gallery_entries: []
    };
    const result = conn._transformProduct(product);
    assert.strictEqual(result.in_stock, false);
    assert.strictEqual(result.stock, 0);
  });
});

// ─── SquareCatalogConnector _baseUrl ─────────────────────────────

describe('SquareCatalogConnector _baseUrl', () => {
  test('sandbox uses squareupsandbox', () => {
    const conn = new SquareCatalogConnector('t1', { environment: 'sandbox' });
    assert.ok(conn._baseUrl.includes('sandbox'));
  });

  test('production uses squareup.com', () => {
    const conn = new SquareCatalogConnector('t1', { environment: 'production' });
    assert.ok(conn._baseUrl.includes('squareup.com'));
    assert.ok(!conn._baseUrl.includes('sandbox'));
  });
});

// ─── LightspeedCatalogConnector _baseUrl ─────────────────────────

describe('LightspeedCatalogConnector _baseUrl', () => {
  test('K-Series trial uses trial.lsk URL', () => {
    const conn = new LightspeedCatalogConnector('t1', { series: 'K', environment: 'trial' });
    assert.ok(conn._baseUrl.includes('trial'));
    assert.ok(conn._baseUrl.includes('lsk'));
  });

  test('K-Series production uses lsk URL', () => {
    const conn = new LightspeedCatalogConnector('t1', { series: 'K', environment: 'production' });
    assert.ok(conn._baseUrl.includes('lsk'));
    assert.ok(!conn._baseUrl.includes('trial'));
  });

  test('X-Series uses lightspeedapp', () => {
    const conn = new LightspeedCatalogConnector('t1', { series: 'X' });
    assert.ok(conn._baseUrl.includes('lightspeedapp'));
  });
});

// ─── LightspeedCatalogConnector _parseMenuEntries ────────────────

describe('LightspeedCatalogConnector _parseMenuEntries', () => {
  const conn = new LightspeedCatalogConnector('t1', { currency: 'MAD' });

  test('parses menuItemEntry', () => {
    const entries = [
      { menuItemEntry: { sku: 'SK1', productName: 'Burger', productPrice: 85, richData: { description: 'Juicy' }, allergenCodes: ['GLUTEN'] } }
    ];
    const result = conn._parseMenuEntries(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Burger');
    assert.strictEqual(result[0].price, 85);
    assert.deepStrictEqual(result[0].allergens, ['GLUTEN']);
  });

  test('handles nested menuGroupEntry', () => {
    const entries = [
      { menuGroupEntry: { menuEntry: [{ menuItemEntry: { productName: 'Sub', productPrice: 20, sku: 'S1' } }] } }
    ];
    const result = conn._parseMenuEntries(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Sub');
  });

  test('returns empty for empty entries', () => {
    assert.deepStrictEqual(conn._parseMenuEntries([]), []);
  });

  test('handles entries without menuItemEntry or menuGroupEntry', () => {
    const entries = [{ menuDealEntry: {} }]; // Deals not yet implemented
    const result = conn._parseMenuEntries(entries);
    assert.strictEqual(result.length, 0);
  });
});
