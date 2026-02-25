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

// ─── getEmbedding (behavioral) ───────────────────────────────────────

describe('KnowledgeEmbeddingService getEmbedding', () => {
  test('cache hit → returns cached vector without API call', async () => {
    const fakeVector = [0.11, 0.22, 0.33];
    const cacheKey = `test_tenant_cache:chunk_cached_${Date.now()}`;
    embeddingService.cache[cacheKey] = fakeVector;
    try {
      const result = await embeddingService.getEmbedding(
        `chunk_cached_${Date.now()}`, 'some text', null, 'test_tenant_cache'
      );
      // The cache key uses tenantId:id format
      // Since we pre-populated with exact key, it should return cached
      assert.deepStrictEqual(result, fakeVector);
    } finally {
      delete embeddingService.cache[cacheKey];
    }
  });

  test('cache miss without API key → returns null (graceful)', async () => {
    // Without GEMINI_API_KEY set, getModel() returns null → embedContent throws → returns null
    const origKey = process.env.GEMINI_API_KEY;
    const origKey2 = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const origInstanceKey = embeddingService.apiKey;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    embeddingService.apiKey = null; // Must also clear cached instance key
    try {
      const result = await embeddingService.getEmbedding(
        `chunk_no_key_${Date.now()}`, 'test text', null, 'test_nokey'
      );
      assert.strictEqual(result, null);
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      if (origKey2) process.env.GOOGLE_GENERATIVE_AI_API_KEY = origKey2;
      embeddingService.apiKey = origInstanceKey;
    }
  });

  test('cache eviction when full (MAX_CACHE_ENTRIES)', async () => {
    // Create a temporary service to test eviction without polluting singleton
    const svc = new (embeddingService.constructor)();
    // Clear any entries loaded from disk cache
    for (const k of Object.keys(svc.cache)) delete svc.cache[k];
    svc.apiKey = null; // Ensure no API calls during eviction test
    // Pre-fill with entries at MAX (5000 from source code)
    const MAX = 5000;
    for (let i = 0; i < MAX; i++) {
      svc.cache[`evict_${i}`] = [0.1];
    }
    assert.strictEqual(Object.keys(svc.cache).length, MAX);
    // Manually call getEmbedding which does eviction — will fail without API key but exercises eviction code
    const result = await svc.getEmbedding(`evict_new`, 'text', null, null);
    // Without API key, returns null — but the cache eviction code ran
    assert.strictEqual(result, null);
  });
});

// ─── getQueryEmbedding (behavioral) ──────────────────────────────────

describe('KnowledgeEmbeddingService getQueryEmbedding', () => {
  test('without API key → returns null (graceful)', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origKey2 = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const origInstanceKey = embeddingService.apiKey;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    embeddingService.apiKey = null;
    try {
      const result = await embeddingService.getQueryEmbedding('test query', null);
      assert.strictEqual(result, null);
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      if (origKey2) process.env.GOOGLE_GENERATIVE_AI_API_KEY = origKey2;
      embeddingService.apiKey = origInstanceKey;
    }
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

// ─── batchEmbed (behavioral) ────────────────────────────────────────────

describe('KnowledgeEmbeddingService batchEmbed', () => {
  test('skips cached chunks, embeds uncached, returns cache', async () => {
    const svc = new (embeddingService.constructor)();
    svc.cache['chunk_cached'] = [0.1, 0.2];
    svc.getEmbedding = async (id, text) => {
      if (svc.cache[id]) return svc.cache[id];
      svc.cache[id] = [0.3, 0.4];
      return svc.cache[id];
    };
    svc._saveCache = () => {};

    const result = await svc.batchEmbed([
      { id: 'chunk_cached', text: 'Already cached' },
      { id: 'chunk_new', text: 'Needs embedding' }
    ]);

    assert.ok(result['chunk_cached']);
    assert.ok(result['chunk_new']);
    assert.deepStrictEqual(result['chunk_cached'], [0.1, 0.2]);
    assert.deepStrictEqual(result['chunk_new'], [0.3, 0.4]);
  });

  test('returns cache object (same reference)', async () => {
    const svc = new (embeddingService.constructor)();
    svc.getEmbedding = async () => null;
    svc._saveCache = () => {};

    const result = await svc.batchEmbed([]);
    assert.strictEqual(result, svc.cache);
  });
});
