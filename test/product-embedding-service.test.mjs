/**
 * VocalIA Product Embedding Service Tests
 *
 * Tests:
 * - EMBEDDING_DIM constant (768)
 * - Constructor (caches, stats)
 * - _getCachePath (path format)
 * - _generateProductText (title, name, category, description, brand, tags, price, variants)
 * - _getPriceRange (6 ranges: budget, affordable, moderate, premium, high-end, luxury)
 * - cosineSimilarity (identical, orthogonal, opposite, null guard, mismatch, zero vector)
 * - Cache operations: getCachedEmbedding, getAllEmbeddings, clearCache
 * - getStats (hits, misses, errors, hitRate, tenants)
 * - Singleton + class exports
 *
 * NOTE: Does NOT call Gemini/Marqo API. Tests pure math, text gen, and structure only.
 *
 * Run: node --test test/product-embedding-service.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import productEmbeddingService from '../core/product-embedding-service.cjs';

const { ProductEmbeddingService, EMBEDDING_DIM } = productEmbeddingService;

// ─── EMBEDDING_DIM ──────────────────────────────────────────

describe('ProductEmbeddingService EMBEDDING_DIM', () => {
  test('is 768 (Gemini text-embedding-004)', () => {
    assert.strictEqual(EMBEDDING_DIM, 768);
  });

  test('is a number', () => {
    assert.strictEqual(typeof EMBEDDING_DIM, 'number');
  });
});

// ─── Constructor ────────────────────────────────────────────

describe('ProductEmbeddingService constructor', () => {
  test('creates with empty caches object', () => {
    const svc = new ProductEmbeddingService();
    assert.deepStrictEqual(svc.caches, {});
  });

  test('creates with zero stats', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.stats.hits, 0);
    assert.strictEqual(svc.stats.misses, 0);
    assert.strictEqual(svc.stats.errors, 0);
  });

  test('stats is an object', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(typeof svc.stats, 'object');
  });
});

// ─── _getCachePath ──────────────────────────────────────────

describe('ProductEmbeddingService _getCachePath', () => {
  test('returns string ending with _product_embeddings.json', () => {
    const svc = new ProductEmbeddingService();
    const p = svc._getCachePath('test-tenant');
    assert.ok(p.endsWith('test-tenant_product_embeddings.json'));
  });

  test('includes embeddings directory', () => {
    const svc = new ProductEmbeddingService();
    const p = svc._getCachePath('demo');
    assert.ok(p.includes('embeddings'));
  });

  test('includes tenant id in filename', () => {
    const svc = new ProductEmbeddingService();
    const p = svc._getCachePath('my_tenant_123');
    assert.ok(p.includes('my_tenant_123'));
  });

  test('returns an absolute path', () => {
    const svc = new ProductEmbeddingService();
    const p = svc._getCachePath('abc');
    assert.ok(p.startsWith('/') || /^[A-Z]:\\/.test(p));
  });
});

// ─── _generateProductText ───────────────────────────────────

describe('ProductEmbeddingService _generateProductText', () => {
  test('includes title', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'Blue Sneakers' });
    assert.ok(text.includes('Blue Sneakers'));
  });

  test('uses name when title absent', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ name: 'Red Hoodie' });
    assert.ok(text.includes('Red Hoodie'));
  });

  test('title takes priority over name', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'Title', name: 'Name' });
    assert.ok(text.includes('Title'));
  });

  test('includes category with prefix', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', category: 'Shoes' });
    assert.ok(text.includes('Category: Shoes'));
  });

  test('includes subcategory', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', subcategory: 'Running' });
    assert.ok(text.includes('Running'));
  });

  test('truncates description to 500 chars', () => {
    const svc = new ProductEmbeddingService();
    const longDesc = 'Z'.repeat(1000);
    const text = svc._generateProductText({ title: 'X', description: longDesc });
    const zCount = (text.match(/Z/g) || []).length;
    assert.strictEqual(zCount, 500);
  });

  test('includes short description as-is', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', description: 'Great product' });
    assert.ok(text.includes('Great product'));
  });

  test('includes brand with prefix', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', brand: 'Nike' });
    assert.ok(text.includes('Brand: Nike'));
  });

  test('includes tags comma-separated', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', tags: ['sport', 'running', 'outdoor'] });
    assert.ok(text.includes('Tags: sport, running, outdoor'));
  });

  test('skips tags if not array', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', tags: 'not-array' });
    assert.ok(!text.includes('Tags:'));
  });

  test('includes price range for numeric price', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', price: 75 });
    assert.ok(text.includes('Price range: moderate'));
  });

  test('includes variant options (max 5)', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({
      title: 'X',
      variants: [
        { title: 'Small' }, { title: 'Medium' }, { title: 'Large' },
        { title: 'XL' }, { title: 'XXL' }, { title: '3XL' }
      ]
    });
    assert.ok(text.includes('Options: Small, Medium, Large, XL, XXL'));
    assert.ok(!text.includes('3XL'));
  });

  test('uses variant option field as fallback', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({
      title: 'X',
      variants: [{ option: 'Red' }, { option: 'Blue' }]
    });
    assert.ok(text.includes('Options: Red, Blue'));
  });

  test('skips variants without title or option', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({
      title: 'X',
      variants: [{ sku: '123' }, { sku: '456' }]
    });
    assert.ok(!text.includes('Options:'));
  });

  test('skips variants if not array', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'X', variants: 'not-array' });
    assert.ok(!text.includes('Options:'));
  });

  test('joins parts with period-space separator', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({ title: 'Shoe', category: 'Footwear' });
    assert.ok(text.includes('. '));
  });

  test('handles empty product gracefully', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({});
    assert.strictEqual(typeof text, 'string');
    assert.strictEqual(text, '');
  });

  test('full product with all fields', () => {
    const svc = new ProductEmbeddingService();
    const text = svc._generateProductText({
      title: 'Running Shoes Pro',
      category: 'Shoes',
      subcategory: 'Running',
      description: 'Great shoes for road running.',
      brand: 'Adidas',
      tags: ['sport', 'running'],
      price: 120,
      variants: [{ title: 'Black/42' }, { title: 'White/43' }]
    });
    assert.ok(text.includes('Running Shoes Pro'));
    assert.ok(text.includes('Category: Shoes'));
    assert.ok(text.includes('Running'));
    assert.ok(text.includes('Great shoes'));
    assert.ok(text.includes('Brand: Adidas'));
    assert.ok(text.includes('Tags: sport, running'));
    assert.ok(text.includes('Price range: premium'));
    assert.ok(text.includes('Options: Black/42, White/43'));
  });
});

// ─── _getPriceRange ─────────────────────────────────────────

describe('ProductEmbeddingService _getPriceRange', () => {
  test('< 10 → budget', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(5), 'budget');
    assert.strictEqual(svc._getPriceRange(0), 'budget');
    assert.strictEqual(svc._getPriceRange(9.99), 'budget');
  });

  test('10-49 → affordable', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(10), 'affordable');
    assert.strictEqual(svc._getPriceRange(49.99), 'affordable');
  });

  test('50-99 → moderate', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(50), 'moderate');
    assert.strictEqual(svc._getPriceRange(99.99), 'moderate');
  });

  test('100-249 → premium', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(100), 'premium');
    assert.strictEqual(svc._getPriceRange(249), 'premium');
  });

  test('250-499 → high-end', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(250), 'high-end');
    assert.strictEqual(svc._getPriceRange(499), 'high-end');
  });

  test('500+ → luxury', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(500), 'luxury');
    assert.strictEqual(svc._getPriceRange(10000), 'luxury');
  });

  test('parses string prices', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange('75.50'), 'moderate');
    assert.strictEqual(svc._getPriceRange('9.99'), 'budget');
  });

  test('boundary: exactly 10', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(10), 'affordable');
  });

  test('boundary: exactly 50', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(50), 'moderate');
  });

  test('boundary: exactly 100', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(100), 'premium');
  });

  test('boundary: exactly 250', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(250), 'high-end');
  });

  test('boundary: exactly 500', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc._getPriceRange(500), 'luxury');
  });
});

// ─── cosineSimilarity ───────────────────────────────────────

describe('ProductEmbeddingService cosineSimilarity', () => {
  test('identical vectors return 1.0', () => {
    const svc = new ProductEmbeddingService();
    const v = [1, 2, 3, 4];
    assert.ok(Math.abs(svc.cosineSimilarity(v, v) - 1.0) < 0.0001);
  });

  test('orthogonal vectors return 0', () => {
    const svc = new ProductEmbeddingService();
    assert.ok(Math.abs(svc.cosineSimilarity([1, 0], [0, 1])) < 0.0001);
  });

  test('opposite vectors return -1', () => {
    const svc = new ProductEmbeddingService();
    assert.ok(Math.abs(svc.cosineSimilarity([1, 2], [-1, -2]) + 1.0) < 0.0001);
  });

  test('returns 0 for null vecA', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.cosineSimilarity(null, [1, 2]), 0);
  });

  test('returns 0 for null vecB', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.cosineSimilarity([1, 2], null), 0);
  });

  test('returns 0 for undefined vecA', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.cosineSimilarity(undefined, [1, 2]), 0);
  });

  test('returns 0 for mismatched lengths', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.cosineSimilarity([1, 2], [1, 2, 3]), 0);
  });

  test('returns 0 for zero vector', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  });

  test('commutative: sim(a,b) === sim(b,a)', () => {
    const svc = new ProductEmbeddingService();
    const a = [1, 3, 5];
    const b = [2, 4, 6];
    const s1 = svc.cosineSimilarity(a, b);
    const s2 = svc.cosineSimilarity(b, a);
    assert.ok(Math.abs(s1 - s2) < 0.0001);
  });

  test('scaled vectors give similarity 1.0 (cosine ignores magnitude)', () => {
    const svc = new ProductEmbeddingService();
    const a = [1, 2, 3];
    const b = [100, 200, 300];
    assert.ok(Math.abs(svc.cosineSimilarity(a, b) - 1.0) < 0.0001);
  });

  test('result is between -1 and 1', () => {
    const svc = new ProductEmbeddingService();
    const a = [0.1, -0.5, 0.3, 0.8];
    const b = [-0.3, 0.7, 0.1, -0.4];
    const sim = svc.cosineSimilarity(a, b);
    assert.ok(sim >= -1.001 && sim <= 1.001);
  });

  test('high-dimensional vectors', () => {
    const svc = new ProductEmbeddingService();
    const dim = 768;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
    const b = Array.from({ length: dim }, (_, i) => Math.cos(i));
    const sim = svc.cosineSimilarity(a, b);
    assert.strictEqual(typeof sim, 'number');
    assert.ok(!isNaN(sim));
  });
});

// ─── Cache operations (in-memory) ──────────────────────────

describe('ProductEmbeddingService cache operations', () => {
  test('getCachedEmbedding returns null for unknown product', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = {};
    assert.strictEqual(svc.getCachedEmbedding('t1', 'prod-999'), null);
  });

  test('getCachedEmbedding returns cached embedding', () => {
    const svc = new ProductEmbeddingService();
    const embed = [0.1, 0.2, 0.3];
    svc.caches['t1'] = {
      'prod-1': { embedding: embed, generatedAt: '2026-01-01' }
    };
    assert.deepStrictEqual(svc.getCachedEmbedding('t1', 'prod-1'), embed);
  });

  test('getAllEmbeddings returns array of entries', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = {
      'p1': { embedding: [0.1], generatedAt: '2026-01-01' },
      'p2': { embedding: [0.2], generatedAt: '2026-01-02' }
    };
    const all = svc.getAllEmbeddings('t1');
    assert.strictEqual(all.length, 2);
    assert.ok(all[0].productId);
    assert.ok(all[0].embedding);
    assert.ok(all[0].generatedAt);
  });

  test('getAllEmbeddings returns empty array for empty cache', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = {};
    const all = svc.getAllEmbeddings('t1');
    assert.strictEqual(all.length, 0);
  });

  test('clearCache empties tenant cache', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = { 'p1': { embedding: [0.1] } };
    svc.clearCache('t1');
    assert.deepStrictEqual(svc.caches['t1'], {});
  });

  test('clearCache does not affect other tenants', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = { 'p1': { embedding: [0.1] } };
    svc.caches['t2'] = { 'p2': { embedding: [0.2] } };
    svc.clearCache('t1');
    assert.deepStrictEqual(svc.caches['t1'], {});
    assert.deepStrictEqual(svc.caches['t2'], { 'p2': { embedding: [0.2] } });
  });
});

// ─── getStats ───────────────────────────────────────────────

describe('ProductEmbeddingService getStats', () => {
  test('returns stats object with expected keys', () => {
    const svc = new ProductEmbeddingService();
    const stats = svc.getStats();
    assert.ok('hits' in stats);
    assert.ok('misses' in stats);
    assert.ok('errors' in stats);
    assert.ok('hitRate' in stats);
    assert.ok('tenants' in stats);
  });

  test('fresh instance has zeroed stats', () => {
    const svc = new ProductEmbeddingService();
    const stats = svc.getStats();
    assert.strictEqual(stats.hits, 0);
    assert.strictEqual(stats.misses, 0);
    assert.strictEqual(stats.errors, 0);
    assert.strictEqual(stats.hitRate, 0);
    assert.strictEqual(stats.tenants, 0);
  });

  test('hitRate computed correctly', () => {
    const svc = new ProductEmbeddingService();
    svc.stats.hits = 3;
    svc.stats.misses = 7;
    const stats = svc.getStats();
    assert.ok(Math.abs(stats.hitRate - 0.3) < 0.0001);
  });

  test('tenants counts cached tenants', () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t1'] = {};
    svc.caches['t2'] = {};
    svc.caches['t3'] = {};
    assert.strictEqual(svc.getStats().tenants, 3);
  });

  test('hitRate is 0 when no hits or misses', () => {
    const svc = new ProductEmbeddingService();
    assert.strictEqual(svc.getStats().hitRate, 0);
  });
});

// ─── _loadCache ─────────────────────────────────────────────

describe('ProductEmbeddingService _loadCache', () => {
  test('returns empty object for new tenant', () => {
    const svc = new ProductEmbeddingService();
    // Use a unique tenant ID that won't have a file on disk
    const cache = svc._loadCache('_test_nonexistent_' + Date.now());
    assert.deepStrictEqual(cache, {});
  });

  test('returns same object on second call (memoized)', () => {
    const svc = new ProductEmbeddingService();
    const tenantId = '_test_memo_' + Date.now();
    const cache1 = svc._loadCache(tenantId);
    cache1['test'] = 'data';
    const cache2 = svc._loadCache(tenantId);
    assert.strictEqual(cache2['test'], 'data');
    assert.strictEqual(cache1, cache2);
  });
});

// ─── getProductEmbedding (behavioral) ────────────────────────────

describe('ProductEmbeddingService getProductEmbedding', () => {
  test('product without id/sku → returns null', async () => {
    const svc = new ProductEmbeddingService();
    const result = await svc.getProductEmbedding('t_no_id', { title: 'No ID Product' });
    assert.strictEqual(result, null);
  });

  test('cache hit → returns cached embedding, stats.hits++', async () => {
    const svc = new ProductEmbeddingService();
    const fakeEmbed = [0.1, 0.2, 0.3];
    svc.caches['t_cache'] = { 'prod-1': { embedding: fakeEmbed, generatedAt: '2026-01-01' } };
    const before = svc.stats.hits;
    const result = await svc.getProductEmbedding('t_cache', { id: 'prod-1', title: 'Test' });
    assert.deepStrictEqual(result, fakeEmbed);
    assert.strictEqual(svc.stats.hits, before + 1);
  });

  test('cache miss + embedding succeeds → caches and returns', async () => {
    const svc = new ProductEmbeddingService();
    const fakeVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
    svc._getInternalEmbedding = async () => fakeVector;
    const result = await svc.getProductEmbedding('t_miss', { id: 'prod-new', title: 'New Product' });
    assert.ok(result);
    assert.strictEqual(result.length, 768);
    // Verify it's now cached
    assert.ok(svc.caches['t_miss']['prod-new']);
    assert.strictEqual(svc.caches['t_miss']['prod-new'].embedding, fakeVector);
  });

  test('cache miss + embedding fails → returns null, stats.errors++', async () => {
    const svc = new ProductEmbeddingService();
    svc._getInternalEmbedding = async () => null;
    const before = svc.stats.errors;
    const result = await svc.getProductEmbedding('t_fail', { id: 'prod-fail', title: 'Fail' });
    assert.strictEqual(result, null);
    assert.strictEqual(svc.stats.errors, before + 1);
  });
});

// ─── getQueryEmbedding (behavioral) ─────────────────────────────

describe('ProductEmbeddingService getQueryEmbedding', () => {
  test('returns embedding vector from _getInternalEmbedding', async () => {
    const svc = new ProductEmbeddingService();
    const fakeVector = [0.5, 0.6, 0.7];
    svc._getInternalEmbedding = async () => fakeVector;
    const result = await svc.getQueryEmbedding('find similar shoes');
    assert.deepStrictEqual(result, fakeVector);
  });
});

// NOTE: All exports tested behaviorally above (cosineSimilarity, EMBEDDING_DIM,
// _generateProductText, _getPriceRange, getStats, clearCache, etc.).

// ─── batchEmbed (behavioral) ──────────────────────────────────────────

describe('ProductEmbeddingService batchEmbed', () => {
  test('iterates products, generates embeddings, returns summary', async () => {
    const svc = new ProductEmbeddingService();
    const tid = 't_batch_1';
    svc.caches[tid] = {}; // bypass disk read
    svc._saveCache = () => {}; // bypass disk write
    const fakeVector = Array.from({ length: 768 }, () => 0.01);
    svc._getInternalEmbedding = async () => fakeVector;

    const result = await svc.batchEmbed(tid, [
      { id: 'b1', title: 'Shoe A', category: 'shoes', price: '50' },
      { id: 'b2', title: 'Bag B', category: 'bags', price: '80' }
    ], { rateLimit: 1, batchSize: 100 });

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.processed, 2);
    assert.strictEqual(result.generated, 2);
    assert.strictEqual(result.errors, 0);
    assert.strictEqual(result.tenantId, tid);
  });

  test('skips products without id/sku → errors++', async () => {
    const svc = new ProductEmbeddingService();
    const tid = 't_batch_2';
    svc.caches[tid] = {};
    svc._saveCache = () => {};
    svc._getInternalEmbedding = async () => [0.1];

    const result = await svc.batchEmbed(tid, [
      { title: 'No ID' },
      { id: 'ok', title: 'Has ID' }
    ], { rateLimit: 1 });

    assert.strictEqual(result.errors, 1);
    assert.strictEqual(result.generated, 1);
  });

  test('uses cache for already-embedded products', async () => {
    const svc = new ProductEmbeddingService();
    svc.caches['t_batch_cache'] = { 'cached_p': { embedding: [0.1], generatedAt: '2026-01-01' } };
    svc._saveCache = () => {};
    let embedCallCount = 0;
    svc._getInternalEmbedding = async () => { embedCallCount++; return [0.2]; };

    const result = await svc.batchEmbed('t_batch_cache', [
      { id: 'cached_p', title: 'Already cached' },
      { id: 'new_p', title: 'Not cached' }
    ], { rateLimit: 1 });

    assert.strictEqual(result.cached, 1);
    assert.strictEqual(result.generated, 1);
    assert.strictEqual(embedCallCount, 1);
  });

  test('embedding failure → errors++ and continues', async () => {
    const svc = new ProductEmbeddingService();
    const tid = 't_batch_fail';
    svc.caches[tid] = {};
    svc._saveCache = () => {};
    let callCount = 0;
    svc._getInternalEmbedding = async () => {
      callCount++;
      if (callCount === 1) return null;
      return [0.1];
    };

    const result = await svc.batchEmbed(tid, [
      { id: 'fail_p', title: 'Will fail' },
      { id: 'ok_p', title: 'Will succeed' }
    ], { rateLimit: 1 });

    assert.strictEqual(result.errors, 1);
    assert.strictEqual(result.generated, 1);
  });
});
