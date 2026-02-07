/**
 * VocalIA Knowledge Embedding Service Tests
 *
 * Tests:
 * - cosineSimilarity (pure math: dot product, norms, edge cases)
 * - Cache management (_loadCache, _saveCache)
 * - Singleton instance behavior
 *
 * NOTE: Does NOT call Gemini API. Tests pure math and cache logic only.
 *
 * Run: node --test test/knowledge-embedding-service.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import embeddingService from '../core/knowledge-embedding-service.cjs';

const require = createRequire(import.meta.url);
const instance2 = require('../core/knowledge-embedding-service.cjs');

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

  test('result is between -1 and 1', () => {
    const a = [0.1, -0.5, 0.3, 0.8, -0.2];
    const b = [-0.3, 0.7, 0.1, -0.4, 0.6];
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(sim >= -1.001 && sim <= 1.001);
  });

  test('works with high-dimensional vectors (768D Gemini)', () => {
    const dim = 768;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
    const b = Array.from({ length: dim }, (_, i) => Math.cos(i));
    const sim = embeddingService.cosineSimilarity(a, b);
    assert.ok(!isNaN(sim), 'Should produce valid number');
    assert.ok(sim >= -1.001 && sim <= 1.001, 'Should be in valid range');
  });

  test('commutative: sim(a,b) === sim(b,a)', () => {
    const a = [1, 3, 5, 7];
    const b = [2, 4, 6, 8];
    const sim1 = embeddingService.cosineSimilarity(a, b);
    const sim2 = embeddingService.cosineSimilarity(b, a);
    assert.ok(Math.abs(sim1 - sim2) < 0.0001);
  });

  test('unit vectors similarity matches dot product', () => {
    // For unit vectors, cosine similarity = dot product
    const normalize = (v) => {
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      return v.map(x => x / norm);
    };
    const a = normalize([3, 4]);
    const b = normalize([1, 0]);
    const sim = embeddingService.cosineSimilarity(a, b);
    const dot = a[0] * b[0] + a[1] * b[1];
    assert.ok(Math.abs(sim - dot) < 0.0001, 'For unit vectors, cosine sim should equal dot product');
  });
});

// ─── Cache behavior ──────────────────────────────────────────────

describe('KnowledgeEmbeddingService cache', () => {
  test('has cache object initialized', () => {
    assert.ok(embeddingService.cache !== undefined, 'Should have cache');
  });

  test('_loadCache executes without error', () => {
    assert.doesNotThrow(() => embeddingService._loadCache());
  });

  test('_saveCache executes without error', () => {
    assert.doesNotThrow(() => embeddingService._saveCache());
  });
});

// ─── Singleton ───────────────────────────────────────────────────

describe('KnowledgeEmbeddingService singleton', () => {
  test('same instance on multiple requires', () => {
    assert.strictEqual(embeddingService, instance2);
  });

  test('cosineSimilarity is callable on the instance', () => {
    // Actually call it to verify it works, not just typeof check
    const result = embeddingService.cosineSimilarity([1, 0], [0, 1]);
    assert.ok(Math.abs(result) < 0.0001, 'Orthogonal vectors should return ~0');
  });
});
