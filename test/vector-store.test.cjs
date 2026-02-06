'use strict';

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
 * Run: node --test test/vector-store.test.cjs
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const { VectorIndex, VectorStore } = require('../core/vector-store.cjs');

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

describe('VectorStore Multi-Tenant', () => {
  let store;

  beforeEach(() => {
    store = new VectorStore();
  });

  test('add creates tenant index on demand', () => {
    // VectorStore.add(tenantId, productId, vector, metadata) — uses default 768 dims
    // We test with internal _getIndex which auto-creates
    const idx = store._getIndex('__test_tenant__');
    assert.ok(idx);
    assert.ok(idx instanceof VectorIndex);
  });

  test('different tenants have isolated indexes', () => {
    const idx1 = store._getIndex('__test_t1__');
    const idx2 = store._getIndex('__test_t2__');
    // They should be different instances
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
