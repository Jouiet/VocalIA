'use strict';

/**
 * VocalIA Knowledge Embedding Service Tests
 *
 * Tests:
 * - cosineSimilarity (pure math: dot product, norms, edge cases)
 * - Constructor (cache initialization)
 * - Instance methods existence
 *
 * NOTE: Does NOT call Gemini API. Tests pure math and structure only.
 *
 * Run: node --test test/knowledge-embedding-service.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const embeddingService = require('../core/knowledge-embedding-service.cjs');

// ─── cosineSimilarity ────────────────────────────────────────────

describe('KnowledgeEmbeddingService cosineSimilarity', () => {
  test('identical vectors return 1.0', () => {
    const vec = [1, 2, 3, 4, 5];
    const sim = embeddingService.cosineSimilarity(vec, vec);
    assert.ok(Math.abs(sim - 1.0) < 0.0001);
  });

  test('orthogonal vectors return 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.0001);
  });

  test('opposite vectors return -1', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(Math.abs(sim + 1.0) < 0.0001);
  });

  test('similar vectors return high similarity', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1.1, 2.1, 3.1, 4.1, 5.1];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(sim > 0.99);
  });

  test('dissimilar vectors return low similarity', () => {
    const a = [1, 0, 0, 0, 0];
    const b = [0, 0, 0, 0, 1];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.01);
  });

  test('scaled vectors are still similar (cosine ignores magnitude)', () => {
    const a = [1, 2, 3];
    const b = [10, 20, 30];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(Math.abs(sim - 1.0) < 0.0001);
  });

  test('returns number', () => {
    const a = [0.5, 0.3, 0.8];
    const b = [0.2, 0.7, 0.1];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.strictEqual(typeof sim, 'number');
  });

  test('result is between -1 and 1', () => {
    const a = [0.1, -0.5, 0.3, 0.8, -0.2];
    const b = [-0.3, 0.7, 0.1, -0.4, 0.6];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(sim >= -1.001 && sim <= 1.001);
  });

  test('works with high-dimensional vectors', () => {
    const dim = 768; // Gemini embedding dimension
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
    const b = Array.from({ length: dim }, (_, i) => Math.cos(i));
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.strictEqual(typeof sim, 'number');
    assert.ok(!isNaN(sim));
  });

  test('commutative: sim(a,b) === sim(b,a)', () => {
    const a = [1, 3, 5, 7];
    const b = [2, 4, 6, 8];
    const sim1 = embeddingService.cosineSimilarity(a, b);
    const sim2 = embeddingService.cosineSimilarity(b, a);
    assert.ok(Math.abs(sim1 - sim2) < 0.0001);
  });
});

// ─── Constructor / cache ─────────────────────────────────────────

describe('KnowledgeEmbeddingService constructor', () => {
  test('instance exists', () => {
    assert.ok(embeddingService);
  });

  test('has cache object', () => {
    assert.strictEqual(typeof embeddingService.cache, 'object');
  });
});

// ─── Instance methods ────────────────────────────────────────────

describe('KnowledgeEmbeddingService methods', () => {
  test('has getEmbedding method', () => {
    assert.strictEqual(typeof embeddingService.getEmbedding, 'function');
  });

  test('has batchEmbed method', () => {
    assert.strictEqual(typeof embeddingService.batchEmbed, 'function');
  });

  test('has getQueryEmbedding method', () => {
    assert.strictEqual(typeof embeddingService.getQueryEmbedding, 'function');
  });

  test('has cosineSimilarity method', () => {
    assert.strictEqual(typeof embeddingService.cosineSimilarity, 'function');
  });

  test('has _loadCache method', () => {
    assert.strictEqual(typeof embeddingService._loadCache, 'function');
  });

  test('has _saveCache method', () => {
    assert.strictEqual(typeof embeddingService._saveCache, 'function');
  });
});

// ─── Exports ─────────────────────────────────────────────────────

describe('KnowledgeEmbeddingService exports', () => {
  test('default export is object', () => {
    assert.strictEqual(typeof embeddingService, 'object');
  });

  test('is not null', () => {
    assert.ok(embeddingService !== null);
  });
});
