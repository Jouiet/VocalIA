/**
 * VocalIA RecommendationService Tests
 *
 * Tests:
 * - PERSONA_CONFIG (38 personas with 5-lang terminology)
 * - AssociationRulesEngine (learn, getFrequentlyBoughtTogether, getCartRecommendations, _isComplementary)
 * - RecommendationService (_generateUserQuery, _applyLTVReranking, _applyDiversity,
 *   _formatVoiceResponse, _getNoRecommendationsResponse)
 *
 * NOTE: Uses temp directories for file I/O. No external API calls.
 *
 * Run: node --test test/recommendation-service.test.mjs
 */



import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import recSingleton from '../core/recommendation-service.cjs';
import { RecommendationService, AssociationRulesEngine } from '../core/recommendation-service.cjs';
import productEmbeddingService from '../core/product-embedding-service.cjs';
import vectorStore from '../core/vector-store.cjs';

// ─── PERSONA_CONFIG ─────────────────────────────────────────────────

describe('RecommendationService PERSONA_CONFIG', () => {
  // Access PERSONA_CONFIG indirectly through _formatVoiceResponse
  const svc = new RecommendationService();

  test('_getNoRecommendationsResponse returns all 5 languages', () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const result = svc._getNoRecommendationsResponse(lang);
      assert.ok(result.text.length > 10, `${lang} response too short`);
      assert.deepStrictEqual(result.recommendations, []);
      assert.strictEqual(result.voiceWidget, null);
    }
  });

  test('_getNoRecommendationsResponse defaults to fr for unknown lang', () => {
    const fr = svc._getNoRecommendationsResponse('fr');
    const unknown = svc._getNoRecommendationsResponse('xx');
    assert.strictEqual(fr.text, unknown.text);
  });
});

// ─── AssociationRulesEngine ─────────────────────────────────────────

describe('AssociationRulesEngine', () => {
  let engine;
  let testDir;

  beforeEach(() => {
    engine = new AssociationRulesEngine();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-rec-'));
  });

  afterEach(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('constructor initializes empty rules', () => {
    assert.deepStrictEqual(engine.rules, {});
  });

  test('_isComplementary detects phone+protection', () => {
    assert.strictEqual(engine._isComplementary('phone', 'protection'), true);
  });

  test('_isComplementary detects laptop+mouse', () => {
    assert.strictEqual(engine._isComplementary('laptop', 'mouse'), true);
  });

  test('_isComplementary detects reverse order laptop+bag', () => {
    assert.strictEqual(engine._isComplementary('bag', 'laptop'), true);
  });

  test('_isComplementary returns false for unrelated categories', () => {
    assert.strictEqual(engine._isComplementary('food', 'furniture'), false);
  });

  test('_isComplementary detects beauty+skincare', () => {
    assert.strictEqual(engine._isComplementary('beauty', 'skincare'), true);
  });

  test('_loadRules returns empty pairs for unknown tenant', () => {
    const rules = engine._loadRules('unknown_tenant_xyz');
    assert.deepStrictEqual(rules.pairs, {});
    assert.strictEqual(rules.lastUpdated, null);
  });

  test('learn rejects less than 10 orders', () => {
    const result = engine.learn('test_tenant', [
      { items: [{ product_id: 'a' }] },
      { items: [{ product_id: 'b' }] }
    ]);
    assert.strictEqual(result.learned, 0);
  });

  test('learn generates rules from sufficient orders', () => {
    // Create 20 orders where A and B frequently appear together
    const orders = [];
    for (let i = 0; i < 20; i++) {
      orders.push({
        items: [
          { product_id: 'productA', category: 'phone' },
          { product_id: 'productB', category: 'protection' }
        ]
      });
    }

    const result = engine.learn('test_learn', orders);
    assert.ok(result.learned > 0);
    assert.ok(result.products > 0);
  });

  test('learn skips cancelled orders', () => {
    const orders = [];
    for (let i = 0; i < 15; i++) {
      orders.push({
        status: 'cancelled',
        items: [{ product_id: 'x' }, { product_id: 'y' }]
      });
    }

    const result = engine.learn('test_cancelled', orders);
    assert.strictEqual(result.learned, 0);
  });

  test('getFrequentlyBoughtTogether returns empty for unknown product', () => {
    const result = engine.getFrequentlyBoughtTogether('unknown_tenant', 'unknown_product');
    assert.deepStrictEqual(result, []);
  });

  test('getCartRecommendations returns empty for no associations', () => {
    const result = engine.getCartRecommendations('unknown_tenant', ['p1', 'p2']);
    assert.deepStrictEqual(result, []);
  });

  test('getCartRecommendations excludes products already in cart', () => {
    // Manually set up rules
    engine.rules['t1'] = {
      pairs: {
        'p1': [{ productId: 'p2', confidence: 0.8 }, { productId: 'p3', confidence: 0.6 }],
        'p2': [{ productId: 'p1', confidence: 0.7 }]
      }
    };

    const result = engine.getCartRecommendations('t1', ['p1', 'p2'], 5);
    // p2 and p1 are in cart, only p3 should remain
    assert.ok(result.length > 0);
    assert.ok(result.every(r => r.productId !== 'p1' && r.productId !== 'p2'));
  });
});

// ─── RecommendationService pure methods ─────────────────────────────

describe('RecommendationService _generateUserQuery', () => {
  const svc = new RecommendationService();

  test('generates query from LTV tier', () => {
    const query = svc._generateUserQuery({ ltv_tier: 'gold' }, [], []);
    assert.ok(query.includes('gold customer'));
  });

  test('generates query from categories', () => {
    const query = svc._generateUserQuery({ preferences: { categories: ['electronics', 'phones'] } }, [], []);
    assert.ok(query.includes('electronics'));
  });

  test('generates query from language', () => {
    const query = svc._generateUserQuery({ language: 'fr' }, [], []);
    assert.ok(query.includes('fr'));
  });

  test('includes recently purchased', () => {
    const query = svc._generateUserQuery({}, [], ['prod_123']);
    assert.ok(query.includes('prod_123'));
  });

  test('returns empty string for empty profile', () => {
    const query = svc._generateUserQuery({}, [], []);
    assert.strictEqual(query, '');
  });
});

describe('RecommendationService _applyLTVReranking', () => {
  const svc = new RecommendationService();

  test('boosts premium products for diamond tier', () => {
    const recs = [
      { productId: 'cheap', score: 0.8, metadata: { price: 10 } },
      { productId: 'expensive', score: 0.7, metadata: { price: 200 } }
    ];

    const result = svc._applyLTVReranking(recs, { ltv_tier: 'diamond' });
    // Expensive should get premiumBoost of 0.2
    const expensive = result.find(r => r.productId === 'expensive');
    assert.ok(expensive.score > 0.7);
  });

  test('defaults to bronze tier when unknown', () => {
    const recs = [{ productId: 'p1', score: 0.5, metadata: { price: 200 } }];
    const result = svc._applyLTVReranking(recs, {});
    // Bronze premiumBoost = -0.1 for expensive items
    assert.ok(result[0].score < 0.5);
  });

  test('returns sorted by score', () => {
    const recs = [
      { productId: 'a', score: 0.3, metadata: { price: 10 } },
      { productId: 'b', score: 0.9, metadata: { price: 10 } }
    ];
    const result = svc._applyLTVReranking(recs, { ltv_tier: 'gold' });
    assert.strictEqual(result[0].productId, 'b');
  });
});

describe('RecommendationService _applyDiversity', () => {
  const svc = new RecommendationService();

  test('returns unchanged for factor 0', () => {
    const recs = [{ productId: 'a', score: 1, metadata: { category: 'x' } }];
    const result = svc._applyDiversity(recs, 0);
    assert.deepStrictEqual(result, recs);
  });

  test('returns unchanged for single item', () => {
    const recs = [{ productId: 'a', score: 1, metadata: { category: 'x' } }];
    const result = svc._applyDiversity(recs, 0.3);
    assert.deepStrictEqual(result, recs);
  });

  test('penalizes duplicate categories', () => {
    const recs = [
      { productId: 'a', score: 1.0, metadata: { category: 'shoes' } },
      { productId: 'b', score: 0.9, metadata: { category: 'shoes' } },
      { productId: 'c', score: 0.8, metadata: { category: 'bags' } }
    ];
    const result = svc._applyDiversity(recs, 0.5);
    // 'b' has same category as 'a', should be penalized (0.9 * 0.5 = 0.45)
    const b = result.find(r => r.productId === 'b');
    assert.ok(b.score < 0.9);
  });

  test('does not penalize unique categories', () => {
    const recs = [
      { productId: 'a', score: 1.0, metadata: { category: 'shoes' } },
      { productId: 'b', score: 0.9, metadata: { category: 'bags' } }
    ];
    const result = svc._applyDiversity(recs, 0.5);
    const b = result.find(r => r.productId === 'b');
    assert.strictEqual(b.score, 0.9);
  });
});

describe('RecommendationService _formatVoiceResponse', () => {
  const svc = new RecommendationService();

  test('formats similar recommendations in FR', () => {
    const recs = [
      { productId: 'p1', reason: 'similar_product', score: 0.9 },
      { productId: 'p2', reason: 'similar_product', score: 0.7 }
    ];
    const result = svc._formatVoiceResponse(recs, 'similar', 'fr', 'produits');
    assert.ok(result.text.includes('produits'));
    assert.strictEqual(result.recommendations.length, 2);
    assert.strictEqual(result.recommendations[0].position, 1);
    assert.strictEqual(result.voiceWidget.action, 'show_carousel');
    assert.deepStrictEqual(result.voiceWidget.items, ['p1', 'p2']);
  });

  test('formats bought_together in EN', () => {
    const recs = [{ productId: 'p1', reason: 'fbt', score: 0.8 }];
    const result = svc._formatVoiceResponse(recs, 'bought_together', 'en');
    assert.ok(result.text.includes('Often selected together'));
  });

  test('formats personalized in AR', () => {
    const recs = [{ productId: 'p1', reason: 'personalized', score: 0.8 }];
    const result = svc._formatVoiceResponse(recs, 'personalized', 'ar', 'منتجات');
    assert.ok(result.text.includes('تفضيلاتك'));
  });

  test('formats in ARY (Darija)', () => {
    const recs = [{ productId: 'p1', reason: 'similar', score: 0.8 }];
    const result = svc._formatVoiceResponse(recs, 'similar', 'ary', 'منتوجات');
    assert.ok(result.text.includes('منتوجات'));
  });

  test('formats in ES', () => {
    const recs = [{ productId: 'p1', reason: 'personalized', score: 0.8 }];
    const result = svc._formatVoiceResponse(recs, 'personalized', 'es', 'productos');
    assert.ok(result.text.includes('preferencias'));
  });

  test('defaults to FR for unknown lang', () => {
    const recs = [{ productId: 'p1', reason: 'similar', score: 0.8 }];
    const resultFr = svc._formatVoiceResponse(recs, 'similar', 'fr', 'items');
    const resultXx = svc._formatVoiceResponse(recs, 'similar', 'xx', 'items');
    assert.strictEqual(resultFr.text, resultXx.text);
  });
});

// ─── RecommendationService public API (mocked dependencies) ─────────

describe('RecommendationService initializeCatalog', () => {
  test('calls batchEmbed + addBatch, returns {embedded, indexed}', async () => {
    const svc = new RecommendationService();
    // Mock productEmbeddingService on the singleton (used internally)
    const origBatch = productEmbeddingService.batchEmbed;
    const origCached = productEmbeddingService.getCachedEmbedding;
    const origAdd = vectorStore.addBatch;

    productEmbeddingService.batchEmbed = async () => ({ total: 2, generated: 2 });
    productEmbeddingService.getCachedEmbedding = (tid, pid) => [0.1, 0.2, 0.3];
    vectorStore.addBatch = (tid, items) => items.length;

    try {
      const result = await svc.initializeCatalog('test_init', [
        { id: 'p1', title: 'Shoe', category: 'shoes', price: '50' },
        { id: 'p2', title: 'Bag', category: 'bags', price: '80' }
      ]);
      assert.ok(result.embedded);
      assert.strictEqual(result.indexed, 2);
    } finally {
      productEmbeddingService.batchEmbed = origBatch;
      productEmbeddingService.getCachedEmbedding = origCached;
      vectorStore.addBatch = origAdd;
    }
  });
});

describe('RecommendationService getSimilarProducts', () => {
  test('returns array of {productId, score, similarity, metadata, reason}', async () => {
    const svc = new RecommendationService();
    const origFind = vectorStore.findSimilar;
    vectorStore.findSimilar = () => [
      { id: 'p2', score: 0.92, metadata: { category: 'shoes' } },
      { id: 'p3', score: 0.85, metadata: { category: 'bags' } }
    ];
    try {
      const result = await svc.getSimilarProducts('t1', 'p1');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].productId, 'p2');
      assert.strictEqual(result[0].reason, 'similar_product');
      assert.strictEqual(result[0].similarity, 92);
    } finally {
      vectorStore.findSimilar = origFind;
    }
  });

  test('empty vectorStore → returns []', async () => {
    const svc = new RecommendationService();
    const origFind = vectorStore.findSimilar;
    vectorStore.findSimilar = () => [];
    try {
      const result = await svc.getSimilarProducts('t1', 'p1');
      assert.deepStrictEqual(result, []);
    } finally {
      vectorStore.findSimilar = origFind;
    }
  });
});

describe('RecommendationService getPersonalizedRecommendations', () => {
  test('with recentlyViewed → includes based_on_viewed results', async () => {
    const svc = new RecommendationService();
    const origQuery = productEmbeddingService.getQueryEmbedding;
    const origFind = vectorStore.findSimilar;
    const origSearch = vectorStore.search;
    const origFilter = vectorStore.queryByFilter;

    productEmbeddingService.getQueryEmbedding = async () => null; // skip two-tower
    vectorStore.findSimilar = () => [{ id: 'sim1', score: 0.8, metadata: { category: 'x' } }];
    vectorStore.search = () => [];
    vectorStore.queryByFilter = () => [];

    try {
      const result = await svc.getPersonalizedRecommendations('t1', 'u1', {}, {
        recentlyViewed: ['p1'],
        recentlyPurchased: []
      });
      const viewedRec = result.find(r => r.reason === 'based_on_viewed');
      assert.ok(viewedRec, 'Should include based_on_viewed recommendation');
    } finally {
      productEmbeddingService.getQueryEmbedding = origQuery;
      vectorStore.findSimilar = origFind;
      vectorStore.search = origSearch;
      vectorStore.queryByFilter = origFilter;
    }
  });

  test('deduplication: same productId not repeated', async () => {
    const svc = new RecommendationService();
    const origQuery = productEmbeddingService.getQueryEmbedding;
    const origFind = vectorStore.findSimilar;
    const origSearch = vectorStore.search;
    const origFilter = vectorStore.queryByFilter;

    productEmbeddingService.getQueryEmbedding = async () => [0.1, 0.2];
    vectorStore.search = () => [
      { id: 'dup1', score: 0.9, metadata: { category: 'a' } }
    ];
    vectorStore.findSimilar = () => [
      { id: 'dup1', score: 0.7, metadata: { category: 'a' } }
    ];
    vectorStore.queryByFilter = () => [];

    try {
      const result = await svc.getPersonalizedRecommendations('t1', 'u1', {}, {
        recentlyViewed: ['p1'],
        recentlyPurchased: []
      });
      const dup1Count = result.filter(r => r.productId === 'dup1').length;
      assert.strictEqual(dup1Count, 1, 'Same productId should appear only once');
    } finally {
      productEmbeddingService.getQueryEmbedding = origQuery;
      vectorStore.findSimilar = origFind;
      vectorStore.search = origSearch;
      vectorStore.queryByFilter = origFilter;
    }
  });
});

describe('RecommendationService getVoiceRecommendations', () => {
  test('type similar with productId → returns formatted string', async () => {
    const svc = new RecommendationService();
    const origFind = vectorStore.findSimilar;
    vectorStore.findSimilar = () => [
      { id: 'p2', score: 0.9, metadata: { category: 'shoes' } }
    ];
    try {
      const result = await svc.getVoiceRecommendations('t1', { productId: 'p1', type: 'similar' }, 'fr');
      assert.ok(result.text);
      assert.ok(result.recommendations.length > 0);
      assert.ok(result.voiceWidget);
    } finally {
      vectorStore.findSimilar = origFind;
    }
  });

  test('no recommendations → returns _getNoRecommendationsResponse', async () => {
    const svc = new RecommendationService();
    const origFind = vectorStore.findSimilar;
    vectorStore.findSimilar = () => [];
    try {
      const result = await svc.getVoiceRecommendations('t1', { productId: 'p1', type: 'similar' }, 'en');
      assert.deepStrictEqual(result.recommendations, []);
      assert.strictEqual(result.voiceWidget, null);
    } finally {
      vectorStore.findSimilar = origFind;
    }
  });
});

describe('RecommendationService learnFromOrders', () => {
  test('delegates to associationEngine.learn', async () => {
    const svc = new RecommendationService();
    const orders = [];
    for (let i = 0; i < 15; i++) {
      orders.push({ items: [{ product_id: 'a', category: 'phone' }, { product_id: 'b', category: 'protection' }] });
    }
    const result = await svc.learnFromOrders('test_learn_api', orders);
    assert.ok('learned' in result);
    assert.ok('products' in result);
  });
});
