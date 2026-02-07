'use strict';

/**
 * VocalIA Tenant Catalog Store Tests
 *
 * Tests:
 * - CONFIG constants (dataDir, cacheMaxSize, cacheTTLMs, syncIntervalMs)
 * - LRUCache: get/set, TTL expiry, LRU eviction, invalidate, clear, getStats
 * - TenantCatalogStore constructor defaults
 * - Voice response generators (_generateSlotsSummary, _generateBrowseSummary,
 *   _generateItemVoiceDescription, _generateMenuSummary,
 *   _generateAvailabilityVoiceResponse, _generateSearchSummary,
 *   _generateServicesSummary)
 * - _formatDateVoice
 * - getInstance singleton
 *
 * NOTE: Tests pure logic. Does NOT require running services or connectors.
 *
 * Run: node --test test/tenant-catalog-store.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { TenantCatalogStore, getInstance, CONFIG } = require('../core/tenant-catalog-store.cjs');

// ─── CONFIG ─────────────────────────────────────────────────────────

describe('TenantCatalogStore CONFIG', () => {
  test('has dataDir path', () => {
    assert.ok(CONFIG.dataDir);
    assert.ok(CONFIG.dataDir.includes('catalogs'));
  });

  test('has configFile path', () => {
    assert.ok(CONFIG.configFile);
    assert.ok(CONFIG.configFile.includes('store-config.json'));
  });

  test('cacheMaxSize is 100', () => {
    assert.strictEqual(CONFIG.cacheMaxSize, 100);
  });

  test('cacheTTLMs is 5 minutes', () => {
    assert.strictEqual(CONFIG.cacheTTLMs, 5 * 60 * 1000);
  });

  test('syncIntervalMs is 15 minutes', () => {
    assert.strictEqual(CONFIG.syncIntervalMs, 15 * 60 * 1000);
  });

  test('maxItemsPerTenant is 10000', () => {
    assert.strictEqual(CONFIG.maxItemsPerTenant, 10000);
  });
});

// ─── LRUCache ───────────────────────────────────────────────────────

describe('TenantCatalogStore LRUCache', () => {
  // Access internal LRUCache through TenantCatalogStore
  function createCache(maxSize = 5, ttlMs = 60000) {
    const store = new TenantCatalogStore({ maxCacheSize: maxSize, cacheTTLMs: ttlMs });
    return store.cache;
  }

  test('get returns null for missing key', () => {
    const cache = createCache();
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  test('set and get round-trip', () => {
    const cache = createCache();
    cache.set('key1', { name: 'test' });
    const result = cache.get('key1');
    assert.deepStrictEqual(result, { name: 'test' });
  });

  test('set overwrites existing key', () => {
    const cache = createCache();
    cache.set('key1', 'first');
    cache.set('key1', 'second');
    assert.strictEqual(cache.get('key1'), 'second');
  });

  test('evicts oldest entry when full', () => {
    const cache = createCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('b'), 2);
    assert.strictEqual(cache.get('d'), 4);
  });

  test('get refreshes entry position (LRU)', () => {
    const cache = createCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // refresh 'a' to most recent
    cache.set('d', 4); // should evict 'b' (oldest), not 'a'
    assert.strictEqual(cache.get('a'), 1); // still present
    assert.strictEqual(cache.get('b'), null); // evicted
  });

  test('TTL expiry returns null for stale entry', () => {
    const cache = createCache(10, 1); // 1ms TTL
    cache.set('key', 'value');

    // Force stale by manipulating timestamp
    const entry = cache.cache.get('key');
    entry.timestamp = Date.now() - 1000; // 1 second ago
    cache.cache.set('key', entry);

    assert.strictEqual(cache.get('key'), null);
  });

  test('invalidate removes matching keys', () => {
    const cache = createCache();
    cache.set('tenant1:browse:x', 'data1');
    cache.set('tenant1:search:y', 'data2');
    cache.set('tenant2:browse:z', 'data3');
    cache.invalidate('tenant1');
    assert.strictEqual(cache.get('tenant1:browse:x'), null);
    assert.strictEqual(cache.get('tenant1:search:y'), null);
    assert.strictEqual(cache.get('tenant2:browse:z'), 'data3');
  });

  test('clear empties cache', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('b'), null);
  });

  test('getStats returns size and config', () => {
    const cache = createCache(50, 30000);
    cache.set('x', 1);
    cache.set('y', 2);
    const stats = cache.getStats();
    assert.strictEqual(stats.size, 2);
    assert.strictEqual(stats.maxSize, 50);
    assert.strictEqual(stats.ttlMs, 30000);
  });
});

// ─── TenantCatalogStore constructor ─────────────────────────────────

describe('TenantCatalogStore constructor', () => {
  test('starts with empty connectors', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.connectors.size, 0);
  });

  test('starts with empty tenantConfigs', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.tenantConfigs.size, 0);
  });

  test('starts not initialized', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.initialized, false);
  });

  test('creates cache with default config', () => {
    const store = new TenantCatalogStore();
    const stats = store.cache.getStats();
    assert.strictEqual(stats.maxSize, CONFIG.cacheMaxSize);
    assert.strictEqual(stats.ttlMs, CONFIG.cacheTTLMs);
  });

  test('accepts custom cache options', () => {
    const store = new TenantCatalogStore({ maxCacheSize: 50, cacheTTLMs: 30000 });
    const stats = store.cache.getStats();
    assert.strictEqual(stats.maxSize, 50);
    assert.strictEqual(stats.ttlMs, 30000);
  });
});

// ─── Voice Response Generators ──────────────────────────────────────

describe('TenantCatalogStore voice generators', () => {
  const store = new TenantCatalogStore();

  // _generateSlotsSummary
  test('slots summary: no slots', () => {
    const result = store._generateSlotsSummary('2027-06-15', []);
    assert.ok(result.includes('Aucun créneau'));
  });

  test('slots summary: with slots', () => {
    const slots = [
      { time: '09:00' },
      { time: '10:00' },
      { time: '11:00' }
    ];
    const result = store._generateSlotsSummary('2027-06-15', slots);
    assert.ok(result.includes('09:00'));
    assert.ok(result.includes('10:00'));
    assert.ok(result.includes('11:00'));
    assert.ok(result.includes('conviendrait'));
  });

  test('slots summary: more than 5 slots shows count', () => {
    const slots = Array.from({ length: 8 }, (_, i) => ({ time: `${9 + i}:00` }));
    const result = store._generateSlotsSummary('2027-06-15', slots);
    assert.ok(result.includes('3 autres'));
  });

  // _formatDateVoice
  test('formatDateVoice: French day and month', () => {
    const result = store._formatDateVoice('2027-06-15');
    // June 15, 2027 is a Tuesday
    assert.ok(result.includes('mardi'));
    assert.ok(result.includes('15'));
    assert.ok(result.includes('juin'));
  });

  test('formatDateVoice: January date', () => {
    const result = store._formatDateVoice('2027-01-01');
    assert.ok(result.includes('janvier'));
  });

  // _generateBrowseSummary
  test('browse summary: empty list with category', () => {
    const result = store._generateBrowseSummary([], 'Electronique');
    assert.ok(result.includes('Aucun produit'));
    assert.ok(result.includes('Electronique'));
  });

  test('browse summary: empty list without category', () => {
    const result = store._generateBrowseSummary([], null);
    assert.ok(result.includes('catalogue est vide'));
  });

  test('browse summary: items with category', () => {
    const items = [
      { name: 'TV Samsung' },
      { name: 'TV LG' }
    ];
    const result = store._generateBrowseSummary(items, 'TV');
    assert.ok(result.includes('TV Samsung'));
    assert.ok(result.includes('TV LG'));
    assert.ok(result.includes('TV'));
  });

  test('browse summary: more than 3 items shows count', () => {
    const items = [
      { name: 'A' }, { name: 'B' }, { name: 'C' },
      { name: 'D' }, { name: 'E' }
    ];
    const result = store._generateBrowseSummary(items, null);
    assert.ok(result.includes('2 autres'));
  });

  // _generateItemVoiceDescription
  test('item voice description: name only', () => {
    const result = store._generateItemVoiceDescription({ name: 'Couscous' });
    assert.strictEqual(result, 'Couscous');
  });

  test('item voice description: with price', () => {
    const result = store._generateItemVoiceDescription({ name: 'Couscous', price: 120 });
    assert.ok(result.includes('Couscous'));
    assert.ok(result.includes('120'));
  });

  test('item voice description: with currency', () => {
    const result = store._generateItemVoiceDescription({ name: 'Widget', price: 49, currency: 'EUR' });
    assert.ok(result.includes('EUR'));
  });

  test('item voice description: out of stock', () => {
    const result = store._generateItemVoiceDescription({ name: 'Tajine', price: 95, in_stock: false });
    assert.ok(result.includes('indisponible'));
  });

  // _generateMenuSummary
  test('menu summary: no categories', () => {
    const result = store._generateMenuSummary([]);
    assert.ok(result.includes('pas disponible'));
  });

  test('menu summary: with categories', () => {
    const cats = [{ name: 'Entrées' }, { name: 'Plats' }, { name: 'Desserts' }];
    const result = store._generateMenuSummary(cats);
    assert.ok(result.includes('Entrées'));
    assert.ok(result.includes('Plats'));
    assert.ok(result.includes('Desserts'));
    assert.ok(result.includes('souhaitez'));
  });

  // _generateAvailabilityVoiceResponse
  test('availability: available with stock', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: true, itemName: 'Couscous', stock: 5
    });
    assert.ok(result.includes('disponible'));
    assert.ok(result.includes('5'));
  });

  test('availability: available with slots', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: true, itemName: 'Consultation', slots: ['09:00', '10:00']
    });
    assert.ok(result.includes('09:00'));
    assert.ok(result.includes('10:00'));
  });

  test('availability: available no details', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: true, itemName: 'Service'
    });
    assert.ok(result.includes('disponible'));
  });

  test('availability: not found', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: false, reason: 'item_not_found'
    });
    assert.ok(result.includes('pas trouvé'));
  });

  test('availability: not available', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: false, itemName: 'Tajine'
    });
    assert.ok(result.includes('pas disponible'));
  });

  // _generateSearchSummary
  test('search summary: no results', () => {
    const result = store._generateSearchSummary('couscous', []);
    assert.ok(result.includes('rien trouvé'));
    assert.ok(result.includes('couscous'));
  });

  test('search summary: single result', () => {
    const result = store._generateSearchSummary('couscous', [
      { name: 'Couscous Royal', price: 120, voiceDescription: 'Couscous royal à 120 DH' }
    ]);
    assert.ok(result.includes('Couscous royal'));
  });

  test('search summary: multiple results', () => {
    const result = store._generateSearchSummary('plat', [
      { name: 'Tajine' }, { name: 'Couscous' }, { name: 'Pastilla' }
    ]);
    assert.ok(result.includes('3 résultats'));
    assert.ok(result.includes('Tajine'));
  });

  // _generateServicesSummary
  test('services summary: no services', () => {
    const result = store._generateServicesSummary([]);
    assert.ok(result.includes('Aucun service'));
  });

  test('services summary: with services', () => {
    const services = [
      { name: 'Coupe homme' },
      { name: 'Coupe femme' },
      { name: 'Coloration' }
    ];
    const result = store._generateServicesSummary(services);
    assert.ok(result.includes('Coupe homme'));
    assert.ok(result.includes('intéresse'));
  });
});

// ─── getConnector / getStats ────────────────────────────────────────

describe('TenantCatalogStore getConnector', () => {
  test('returns undefined for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.getConnector('nonexistent'), undefined);
  });
});

describe('TenantCatalogStore getStats', () => {
  test('returns empty stats for fresh store', () => {
    const store = new TenantCatalogStore();
    const stats = store.getStats();
    assert.strictEqual(stats.tenantsCount, 0);
    assert.deepStrictEqual(stats.tenants, []);
    assert.ok(stats.cache);
    assert.strictEqual(stats.cache.size, 0);
    assert.ok(stats.config);
    assert.strictEqual(stats.config.cacheMaxSize, CONFIG.cacheMaxSize);
  });
});

// ─── invalidateCache ───────────────────────────────────────────────

describe('TenantCatalogStore invalidateCache', () => {
  test('removes cache entries for specific tenant', () => {
    const store = new TenantCatalogStore();
    store.cache.set('tenant1:browse:x', 'data1');
    store.cache.set('tenant1:search:y', 'data2');
    store.cache.set('tenant2:browse:z', 'data3');
    store.invalidateCache('tenant1');
    assert.strictEqual(store.cache.get('tenant1:browse:x'), null);
    assert.strictEqual(store.cache.get('tenant1:search:y'), null);
    assert.strictEqual(store.cache.get('tenant2:browse:z'), 'data3');
  });
});

// ─── getItems / getItem (no connector) ─────────────────────────────

describe('TenantCatalogStore getItems/getItem', () => {
  test('getItems returns empty for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.deepStrictEqual(store.getItems('nonexistent'), []);
  });

  test('getItem returns null for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.getItem('nonexistent', 'PRODUCTS', 'item1'), null);
  });
});

// ─── addItem / updateItem / removeItem (no connector) ──────────────

describe('TenantCatalogStore CRUD (no connector)', () => {
  test('addItem returns false for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.addItem('nonexistent', 'PRODUCTS', { id: '1', name: 'Widget' }), false);
  });

  test('updateItem returns false for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.updateItem('nonexistent', 'PRODUCTS', '1', { name: 'New' }), false);
  });

  test('removeItem returns false for unregistered tenant', () => {
    const store = new TenantCatalogStore();
    assert.strictEqual(store.removeItem('nonexistent', 'PRODUCTS', '1'), false);
  });
});

// ─── Voice generators edge cases ───────────────────────────────────

describe('TenantCatalogStore voice generators edge cases', () => {
  const store = new TenantCatalogStore();

  test('slots summary: null slots', () => {
    const result = store._generateSlotsSummary('2027-01-01', null);
    assert.ok(result.includes('Aucun créneau'));
  });

  test('browse summary: items without category', () => {
    const items = [{ name: 'Widget A' }, { name: 'Widget B' }];
    const result = store._generateBrowseSummary(items, null);
    assert.ok(result.includes('proposons'));
    assert.ok(result.includes('Widget A'));
  });

  test('item voice description: stock=0 shows indisponible', () => {
    const result = store._generateItemVoiceDescription({ name: 'Item', stock: 0 });
    assert.ok(result.includes('indisponible'));
  });

  test('item voice description: default currency dirhams', () => {
    const result = store._generateItemVoiceDescription({ name: 'Item', price: 100 });
    assert.ok(result.includes('dirhams'));
  });

  test('availability: no itemName uses default text', () => {
    const result = store._generateAvailabilityVoiceResponse({
      available: false
    });
    assert.ok(result.includes('Ce produit'));
  });

  test('search summary: single result with voice description', () => {
    const result = store._generateSearchSummary('widget', [
      { name: 'Widget', voiceDescription: 'A special widget for testing' }
    ]);
    assert.ok(result.includes('special widget'));
  });

  test('search summary: single result without voice description', () => {
    const result = store._generateSearchSummary('widget', [
      { name: 'Widget', price: 50 }
    ]);
    assert.ok(result.includes('Widget'));
    assert.ok(result.includes('50'));
  });
});

// ─── getInstance singleton ──────────────────────────────────────────

describe('TenantCatalogStore getInstance', () => {
  test('returns TenantCatalogStore instance', () => {
    const instance = getInstance();
    assert.ok(instance instanceof TenantCatalogStore);
  });

  test('returns same instance on multiple calls', () => {
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b);
  });
});

// ─── Exports ───────────────────────────────────────────────────────

describe('TenantCatalogStore exports', () => {
  test('exports TenantCatalogStore class', () => {
    assert.strictEqual(typeof TenantCatalogStore, 'function');
  });

  test('exports getInstance function', () => {
    assert.strictEqual(typeof getInstance, 'function');
  });

  test('exports CONFIG object', () => {
    assert.strictEqual(typeof CONFIG, 'object');
  });

  test('instance has all methods', () => {
    const store = new TenantCatalogStore();
    const methods = ['init', 'registerTenant', 'unregisterTenant', 'getConnector',
      'syncTenant', 'startAutoSync', 'stopAutoSync', 'browseCatalog', 'getItemDetails',
      'getMenu', 'checkAvailability', 'searchCatalog', 'getServices', 'getAvailableSlots',
      'bookSlot', 'getStats', 'getItems', 'getItem', 'addItem', 'updateItem', 'removeItem',
      'syncCatalog', 'invalidateCache', 'shutdown'];
    for (const m of methods) {
      assert.strictEqual(typeof store[m], 'function', `Missing method: ${m}`);
    }
  });
});
