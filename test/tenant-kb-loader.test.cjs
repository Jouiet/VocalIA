'use strict';

/**
 * VocalIA Tenant KB Loader Tests
 *
 * Tests:
 * - SUPPORTED_LANGUAGES constant (5 languages)
 * - DEFAULT_LANGUAGE constant (fr)
 * - LRUCache constructor (defaults, custom maxSize/ttl)
 * - LRUCache get/set (miss, hit, LRU eviction, TTL expiry)
 * - LRUCache invalidate (pattern-based)
 * - LRUCache clear/stats
 * - TenantKBLoader constructor (cache, universalKB)
 * - TenantKBLoader exports
 *
 * NOTE: Does NOT require KB files or running services.
 * Tests pure cache logic and constants only.
 *
 * Run: node --test test/tenant-kb-loader.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  TenantKBLoader,
  getInstance,
  LRUCache,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} = require('../core/tenant-kb-loader.cjs');

// ─── SUPPORTED_LANGUAGES ────────────────────────────────────────

describe('TenantKBLoader SUPPORTED_LANGUAGES', () => {
  test('has 5 languages', () => {
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 5);
  });

  test('includes fr', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('fr'));
  });

  test('includes en', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('en'));
  });

  test('includes es', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('es'));
  });

  test('includes ar', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('ar'));
  });

  test('includes ary', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('ary'));
  });

  test('is an array of strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.strictEqual(typeof lang, 'string');
    }
  });
});

// ─── DEFAULT_LANGUAGE ───────────────────────────────────────────

describe('TenantKBLoader DEFAULT_LANGUAGE', () => {
  test('is fr', () => {
    assert.strictEqual(DEFAULT_LANGUAGE, 'fr');
  });

  test('is in SUPPORTED_LANGUAGES', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes(DEFAULT_LANGUAGE));
  });
});

// ─── LRUCache constructor ───────────────────────────────────────

describe('LRUCache constructor', () => {
  test('creates with default maxSize 100', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().maxSize, 100);
  });

  test('creates with default ttl 5 minutes', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().ttlMs, 5 * 60 * 1000);
  });

  test('accepts custom maxSize', () => {
    const cache = new LRUCache(50);
    assert.strictEqual(cache.stats().maxSize, 50);
  });

  test('accepts custom ttlMs', () => {
    const cache = new LRUCache(100, 10000);
    assert.strictEqual(cache.stats().ttlMs, 10000);
  });

  test('starts empty', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().size, 0);
  });
});

// ─── LRUCache get/set ───────────────────────────────────────────

describe('LRUCache get/set', () => {
  test('returns null for missing key', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  test('stores and retrieves data', () => {
    const cache = new LRUCache();
    cache.set('key1', { data: 'hello' });
    const result = cache.get('key1');
    assert.deepStrictEqual(result, { data: 'hello' });
  });

  test('increments size on set', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.stats().size, 2);
  });

  test('evicts oldest when maxSize reached', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('d'), 4);
    assert.strictEqual(cache.stats().size, 3);
  });

  test('TTL expiry returns null', () => {
    const cache = new LRUCache(100, 1); // 1ms TTL
    cache.set('expire', 'data');
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy-wait
    assert.strictEqual(cache.get('expire'), null);
  });

  test('LRU: access moves to most recent', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // access 'a', now most recent
    cache.set('d', 4); // should evict 'b' (oldest)
    assert.strictEqual(cache.get('a'), 1); // still present
    assert.strictEqual(cache.get('b'), null); // evicted
  });

  test('overwrite same key updates value', () => {
    const cache = new LRUCache();
    cache.set('x', 'old');
    cache.set('x', 'new');
    assert.strictEqual(cache.get('x'), 'new');
  });
});

// ─── LRUCache invalidate ────────────────────────────────────────

describe('LRUCache invalidate', () => {
  test('removes entries matching prefix', () => {
    const cache = new LRUCache();
    cache.set('tenant1:fr', { lang: 'fr' });
    cache.set('tenant1:en', { lang: 'en' });
    cache.set('tenant2:fr', { lang: 'fr' });
    cache.invalidate('tenant1');
    assert.strictEqual(cache.get('tenant1:fr'), null);
    assert.strictEqual(cache.get('tenant1:en'), null);
    assert.deepStrictEqual(cache.get('tenant2:fr'), { lang: 'fr' });
  });

  test('no-op for non-matching prefix', () => {
    const cache = new LRUCache();
    cache.set('key1', 1);
    cache.invalidate('nonexistent');
    assert.strictEqual(cache.get('key1'), 1);
  });

  test('removes all with empty prefix', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('');
    assert.strictEqual(cache.stats().size, 0);
  });
});

// ─── LRUCache clear/stats ───────────────────────────────────────

describe('LRUCache clear/stats', () => {
  test('clear removes all entries', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.strictEqual(cache.stats().size, 0);
  });

  test('stats returns size, maxSize, ttlMs', () => {
    const cache = new LRUCache(200, 10000);
    const stats = cache.stats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(stats.maxSize, 200);
    assert.strictEqual(stats.ttlMs, 10000);
  });

  test('stats size reflects actual entries', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.strictEqual(cache.stats().size, 3);
  });
});

// ─── TenantKBLoader constructor ─────────────────────────────────

describe('TenantKBLoader constructor', () => {
  test('creates instance', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader);
  });

  test('has cache', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.cache);
    assert.ok(loader.cache instanceof LRUCache);
  });

  test('has universalKB object', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.universalKB);
    assert.strictEqual(typeof loader.universalKB, 'object');
  });

  test('universalKB has keys for all supported languages', () => {
    const loader = new TenantKBLoader();
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(lang in loader.universalKB, `Missing universalKB key: ${lang}`);
    }
  });

  test('has watchedFiles map', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.watchedFiles instanceof Map);
  });
});

// ─── getInstance ────────────────────────────────────────────────

describe('TenantKBLoader getInstance', () => {
  test('returns TenantKBLoader instance', () => {
    const inst = getInstance();
    assert.ok(inst instanceof TenantKBLoader);
  });

  test('returns same instance on multiple calls', () => {
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b);
  });
});

// ─── TenantKBLoader methods ─────────────────────────────────────

describe('TenantKBLoader methods', () => {
  test('has getKB method', () => {
    const loader = new TenantKBLoader();
    assert.strictEqual(typeof loader.getKB, 'function');
  });

  test('has loadWithFallback method', () => {
    const loader = new TenantKBLoader();
    assert.strictEqual(typeof loader.loadWithFallback, 'function');
  });

  test('has getStats method', () => {
    const loader = new TenantKBLoader();
    assert.strictEqual(typeof loader.getStats, 'function');
  });

  test('getStats returns object', () => {
    const loader = new TenantKBLoader();
    const stats = loader.getStats();
    assert.strictEqual(typeof stats, 'object');
  });
});

// ─── Exports ────────────────────────────────────────────────────

describe('TenantKBLoader exports', () => {
  test('exports TenantKBLoader class', () => {
    assert.strictEqual(typeof TenantKBLoader, 'function');
  });

  test('exports getInstance function', () => {
    assert.strictEqual(typeof getInstance, 'function');
  });

  test('exports LRUCache class', () => {
    assert.strictEqual(typeof LRUCache, 'function');
  });

  test('exports SUPPORTED_LANGUAGES array', () => {
    assert.ok(Array.isArray(SUPPORTED_LANGUAGES));
  });

  test('exports DEFAULT_LANGUAGE string', () => {
    assert.strictEqual(typeof DEFAULT_LANGUAGE, 'string');
  });
});
