/**
 * VocalIA Vector Store Tests
 *
 * Tests:
 * - VectorIndex: add, remove, has, get, search, stats
 * - Cosine similarity correctness
 * - Metadata filtering (exact match, array, range operators)
 * - LRU eviction when over capacity
 * - VectorStore: multi-tenant isolation, createIndex, getIndex
 *
 * Run: node --test test/vector-store.test.mjs
 */



import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VectorIndex, VectorStore } from '../core/vector-store.cjs';

describe('VectorIndex CRUD', () => {
  let index;
  const DIM = 4; // Small dimension for testing

  beforeEach(() => {
    index = new VectorIndex({ dimension: DIM, maxElements: 10 });
  });

  test('add and get vector', () => {
    index.add('item1', [1, 0, 0, 0], { name: 'test' });
    const result = index.get('item1');
    assert.ok(result);
    assert.strictEqual(result.metadata.name, 'test');
  });

  test('has returns true for existing vector', () => {
    index.add('item1', [1, 0, 0, 0]);
    assert.strictEqual(index.has('item1'), true);
  });

  test('has returns false for missing vector', () => {
    assert.strictEqual(index.has('nonexistent'), false);
  });

  test('remove deletes vector', () => {
    index.add('item1', [1, 0, 0, 0]);
    index.remove('item1');
    assert.strictEqual(index.has('item1'), false);
  });

  test('throws for wrong dimension', () => {
    assert.throws(
      () => index.add('item1', [1, 0]), // 2 dims instead of 4
      /dimensions/
    );
  });

  test('stats returns correct size', () => {
    index.add('a', [1, 0, 0, 0]);
    index.add('b', [0, 1, 0, 0]);
    const stats = index.stats();
    assert.strictEqual(stats.size, 2);
    assert.strictEqual(stats.dimension, DIM);
  });
});

describe('VectorIndex Search', () => {
  let index;
  const DIM = 4;

  beforeEach(() => {
    index = new VectorIndex({ dimension: DIM });
    // Add test vectors
    index.add('north', [1, 0, 0, 0], { direction: 'north' });
    index.add('east', [0, 1, 0, 0], { direction: 'east' });
    index.add('south', [-1, 0, 0, 0], { direction: 'south' });
    index.add('northeast', [0.7, 0.7, 0, 0], { direction: 'northeast' });
  });

  test('finds exact match with score 1.0', () => {
    const results = index.search([1, 0, 0, 0], 1);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'north');
    assert.ok(Math.abs(results[0].score - 1.0) < 0.001);
  });

  test('opposite vector has score -1.0', () => {
    const results = index.search([1, 0, 0, 0], 4);
    const south = results.find(r => r.id === 'south');
    assert.ok(south);
    assert.ok(Math.abs(south.score - (-1.0)) < 0.001);
  });

  test('orthogonal vectors have score 0', () => {
    const results = index.search([1, 0, 0, 0], 4);
    const east = results.find(r => r.id === 'east');
    assert.ok(east);
    assert.ok(Math.abs(east.score) < 0.001);
  });

  test('similar vectors rank higher', () => {
    const results = index.search([0.8, 0.6, 0, 0], 4);
    // northeast (0.7, 0.7) should be closest to (0.8, 0.6)
    assert.strictEqual(results[0].id, 'northeast');
  });

  test('respects topK limit', () => {
    const results = index.search([1, 0, 0, 0], 2);
    assert.strictEqual(results.length, 2);
  });

  test('returns empty for null query', () => {
    const results = index.search(null, 5);
    assert.deepStrictEqual(results, []);
  });

  test('returns empty for wrong dimension query', () => {
    const results = index.search([1, 0], 5); // 2 dims instead of 4
    assert.deepStrictEqual(results, []);
  });

  test('results are sorted by score descending', () => {
    const results = index.search([1, 0, 0, 0], 4);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });
});

describe('VectorIndex Metadata Filtering', () => {
  let index;
  const DIM = 4;

  beforeEach(() => {
    index = new VectorIndex({ dimension: DIM });
    index.add('prod1', [1, 0, 0, 0], { category: 'shoes', price: 50, brand: 'A' });
    index.add('prod2', [0, 1, 0, 0], { category: 'shoes', price: 100, brand: 'B' });
    index.add('prod3', [0, 0, 1, 0], { category: 'shirts', price: 30, brand: 'A' });
  });

  test('exact match filter', () => {
    const results = index.search([1, 1, 1, 0], 10, { category: 'shoes' });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.metadata.category === 'shoes'));
  });

  test('array filter (IN)', () => {
    const results = index.search([1, 1, 1, 0], 10, { brand: ['A'] });
    assert.strictEqual(results.length, 2);
  });

  test('range filter $gte', () => {
    const results = index.search([1, 1, 1, 0], 10, { price: { $gte: 50 } });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.metadata.price >= 50));
  });

  test('range filter $lte', () => {
    const results = index.search([1, 1, 1, 0], 10, { price: { $lte: 50 } });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.metadata.price <= 50));
  });

  test('range filter $ne', () => {
    const results = index.search([1, 1, 1, 0], 10, { brand: { $ne: 'A' } });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'prod2');
  });

  test('queryByFilter without vector', () => {
    const results = index.queryByFilter(10, { category: 'shoes' });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.score === 1.0)); // Base score for filter
  });
});

describe('VectorIndex LRU Eviction', () => {
  test('evicts oldest when over capacity', () => {
    const index = new VectorIndex({ dimension: 2, maxElements: 3 });
    index.add('a', [1, 0], { order: 1 });
    index.add('b', [0, 1], { order: 2 });
    index.add('c', [1, 1], { order: 3 });
    // At capacity (3)
    assert.strictEqual(index.stats().size, 3);

    // Adding 4th should evict oldest (a)
    index.add('d', [0.5, 0.5], { order: 4 });
    assert.strictEqual(index.stats().size, 3);
    assert.strictEqual(index.has('a'), false);
    assert.strictEqual(index.has('d'), true);
  });
});

describe('VectorIndex serialize/deserialize', () => {
  test('serialize produces plain object', () => {
    const index = new VectorIndex({ dimension: 3 });
    index.add('a', [1, 0, 0], { name: 'alpha' });
    index.add('b', [0, 1, 0], { name: 'beta' });
    const data = index.serialize();
    assert.strictEqual(typeof data, 'object');
    assert.ok(data.a);
    assert.ok(data.b);
    assert.ok(Array.isArray(data.a.vector));
    assert.strictEqual(data.a.metadata.name, 'alpha');
  });

  test('deserialize restores vectors', () => {
    const index = new VectorIndex({ dimension: 3 });
    index.add('x', [1, 2, 3], { cat: 'shoes' });
    const serialized = index.serialize();

    const index2 = new VectorIndex({ dimension: 3 });
    index2.deserialize(serialized);
    assert.strictEqual(index2.vectors.size, 1);
    assert.ok(index2.has('x'));
    assert.strictEqual(index2.get('x').metadata.cat, 'shoes');
  });

  test('roundtrip preserves search', () => {
    const index = new VectorIndex({ dimension: 3 });
    index.add('a', [1, 0, 0]);
    index.add('b', [0, 1, 0]);
    const data = index.serialize();

    const index2 = new VectorIndex({ dimension: 3 });
    index2.deserialize(data);
    const results = index2.search([1, 0, 0], 1);
    assert.strictEqual(results[0].id, 'a');
  });
});

describe('VectorIndex clear', () => {
  test('removes all vectors', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0]);
    index.add('b', [0, 1]);
    assert.strictEqual(index.stats().size, 2);
    index.clear();
    assert.strictEqual(index.stats().size, 0);
  });
});

describe('VectorIndex stats', () => {
  test('memoryEstimate increases with vectors', () => {
    const index = new VectorIndex({ dimension: 4 });
    const stats0 = index.stats();
    assert.strictEqual(stats0.memoryEstimate, 0);
    index.add('a', [1, 0, 0, 0]);
    const stats1 = index.stats();
    assert.strictEqual(stats1.memoryEstimate, 4 * 4); // 1 vector × 4 dims × 4 bytes
  });

  test('maxElements matches constructor', () => {
    const index = new VectorIndex({ dimension: 2, maxElements: 42 });
    assert.strictEqual(index.stats().maxElements, 42);
  });
});

describe('VectorIndex additional filter operators', () => {
  test('$gt filter', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0], { price: 10 });
    index.add('b', [0, 1], { price: 20 });
    index.add('c', [1, 1], { price: 30 });
    const results = index.search([1, 1], 10, { price: { $gt: 10 } });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.metadata.price > 10));
  });

  test('$lt filter', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0], { price: 10 });
    index.add('b', [0, 1], { price: 20 });
    index.add('c', [1, 1], { price: 30 });
    const results = index.search([1, 1], 10, { price: { $lt: 30 } });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.metadata.price < 30));
  });

  test('combined range filter', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0], { price: 10 });
    index.add('b', [0, 1], { price: 20 });
    index.add('c', [1, 1], { price: 30 });
    const results = index.search([1, 1], 10, { price: { $gte: 15, $lte: 25 } });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].metadata.price, 20);
  });

  test('multiple filter keys', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0], { category: 'shoes', brand: 'Nike' });
    index.add('b', [0, 1], { category: 'shoes', brand: 'Adidas' });
    index.add('c', [1, 1], { category: 'shirts', brand: 'Nike' });
    const results = index.search([1, 1], 10, { category: 'shoes', brand: 'Nike' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'a');
  });
});

describe('VectorIndex update', () => {
  test('overwrite existing vector', () => {
    const index = new VectorIndex({ dimension: 2 });
    index.add('a', [1, 0], { v: 1 });
    index.add('a', [0, 1], { v: 2 });
    assert.strictEqual(index.stats().size, 1);
    assert.strictEqual(index.get('a').metadata.v, 2);
  });
});

describe('VectorStore Multi-Tenant', () => {
  let store;

  beforeEach(() => {
    store = new VectorStore();
  });

  test('add creates tenant index on demand', () => {
    const idx = store._getIndex('__test_tenant__');
    assert.ok(idx);
    assert.ok(idx instanceof VectorIndex);
  });

  test('different tenants have isolated indexes', () => {
    const idx1 = store._getIndex('__test_t1__');
    const idx2 = store._getIndex('__test_t2__');
    assert.notStrictEqual(idx1, idx2);
  });

  test('same tenant returns same index', () => {
    const idx1 = store._getIndex('__test_same__');
    const idx2 = store._getIndex('__test_same__');
    assert.strictEqual(idx1, idx2);
  });

  test('indices object tracks tenants', () => {
    store._getIndex('__test_a__');
    store._getIndex('__test_b__');
    assert.ok('__test_a__' in store.indices);
    assert.ok('__test_b__' in store.indices);
  });
});

describe('VectorStore wrapper methods', () => {
  let store;
  const DIM = 768; // Default dimension

  beforeEach(() => {
    store = new VectorStore();
  });

  test('add stores vector for tenant', () => {
    const vec = new Array(DIM).fill(0);
    vec[0] = 1;
    store.add('__vst_t1__', 'prod1', vec, { name: 'Shoe' });
    assert.strictEqual(store.has('__vst_t1__', 'prod1'), true);
  });

  test('remove deletes vector for tenant', () => {
    const vec = new Array(DIM).fill(0);
    vec[0] = 1;
    store.add('__vst_t2__', 'prod1', vec);
    store.remove('__vst_t2__', 'prod1');
    assert.strictEqual(store.has('__vst_t2__', 'prod1'), false);
  });

  test('search returns results', () => {
    const vec1 = new Array(DIM).fill(0); vec1[0] = 1;
    const vec2 = new Array(DIM).fill(0); vec2[1] = 1;
    store.add('__vst_t3__', 'a', vec1, { cat: 'shoes' });
    store.add('__vst_t3__', 'b', vec2, { cat: 'shirts' });
    const results = store.search('__vst_t3__', vec1, 2);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'a');
  });

  test('findSimilar excludes source product', () => {
    const vec1 = new Array(DIM).fill(0); vec1[0] = 1;
    const vec2 = new Array(DIM).fill(0); vec2[0] = 0.9; vec2[1] = 0.1;
    const vec3 = new Array(DIM).fill(0); vec3[1] = 1;
    store.add('__vst_t4__', 'src', vec1);
    store.add('__vst_t4__', 'similar', vec2);
    store.add('__vst_t4__', 'different', vec3);
    const results = store.findSimilar('__vst_t4__', 'src', 5);
    assert.ok(results.every(r => r.id !== 'src'));
    assert.strictEqual(results[0].id, 'similar');
  });

  test('findSimilar returns empty for missing product', () => {
    const results = store.findSimilar('__vst_t5__', 'nonexistent', 5);
    assert.deepStrictEqual(results, []);
  });

  test('stats returns index statistics', () => {
    const vec = new Array(DIM).fill(0); vec[0] = 1;
    store.add('__vst_t6__', 'p1', vec);
    const stats = store.stats('__vst_t6__');
    assert.strictEqual(stats.size, 1);
    assert.strictEqual(stats.dimension, DIM);
  });

  test('queryByFilter works via store', () => {
    const vec1 = new Array(DIM).fill(0); vec1[0] = 1;
    const vec2 = new Array(DIM).fill(0); vec2[1] = 1;
    store.add('__vst_t7__', 'a', vec1, { cat: 'shoes' });
    store.add('__vst_t7__', 'b', vec2, { cat: 'shirts' });
    const results = store.queryByFilter('__vst_t7__', 10, { cat: 'shoes' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'a');
  });

  test('globalStats aggregates across tenants', () => {
    const vec = new Array(DIM).fill(0); vec[0] = 1;
    store.add('__vst_g1__', 'p1', vec);
    store.add('__vst_g2__', 'p1', vec);
    store.add('__vst_g2__', 'p2', vec);
    const gs = store.globalStats();
    assert.ok(gs.tenants >= 2);
    assert.ok(gs.totalVectors >= 3);
    assert.ok(gs.totalMemory > 0);
  });

  test('clear removes vectors for tenant', () => {
    const vec = new Array(DIM).fill(0); vec[0] = 1;
    store.add('__vst_c1__', 'p1', vec);
    store.clear('__vst_c1__');
    assert.strictEqual(store.has('__vst_c1__', 'p1'), false);
  });
});

// ─── addBatch ───────────────────────────────────────────────────────────

describe('VectorStore addBatch', () => {
  test('adds multiple items and returns count', () => {
    const store = new VectorStore();
    const DIM = 768;
    const vec1 = new Array(DIM).fill(0); vec1[0] = 1;
    const vec2 = new Array(DIM).fill(0); vec2[1] = 1;

    const count = store.addBatch('__vst_batch__', [
      { id: 'bp1', vector: vec1, metadata: { name: 'Product 1' } },
      { id: 'bp2', vector: vec2, metadata: { name: 'Product 2' } }
    ]);

    assert.strictEqual(count, 2);
    assert.strictEqual(store.has('__vst_batch__', 'bp1'), true);
    assert.strictEqual(store.has('__vst_batch__', 'bp2'), true);
  });

  test('items are searchable after addBatch', () => {
    const store = new VectorStore();
    const DIM = 768;
    const vec1 = new Array(DIM).fill(0); vec1[0] = 1;
    const vec2 = new Array(DIM).fill(0); vec2[1] = 1;

    store.addBatch('__vst_batch_s__', [
      { id: 'bs1', vector: vec1, metadata: { cat: 'shoes' } },
      { id: 'bs2', vector: vec2, metadata: { cat: 'bags' } }
    ]);

    const results = store.search('__vst_batch_s__', vec1, 2);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'bs1');
  });
});

// ─── saveAll ───────────────────────────────────────────────────────────

describe('VectorStore saveAll', () => {
  test('saves all tenant indices without error', () => {
    const store = new VectorStore();
    const DIM = 768;
    const vec = new Array(DIM).fill(0); vec[0] = 1;

    store.add('__vst_save1__', 'p1', vec);
    store.add('__vst_save2__', 'p1', vec);

    assert.doesNotThrow(() => store.saveAll());
  });

  test('saves data that persists across store instances', () => {
    const store = new VectorStore();
    const DIM = 768;
    const vec = new Array(DIM).fill(0); vec[0] = 1;

    store.add('__vst_persist_test__', 'p_saved', vec, { name: 'Persisted' });
    store.saveAll();

    // Load a fresh store and verify the data is there
    const store2 = new VectorStore();
    store2._loadIndex('__vst_persist_test__');
    assert.strictEqual(store2.has('__vst_persist_test__', 'p_saved'), true);
  });
});
