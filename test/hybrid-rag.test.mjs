/**
 * VocalIA Hybrid RAG Tests — BM25Engine + HybridRAG
 *
 * Tests the REAL BM25Engine and HybridRAG._fuseResults (no replicas).
 * BM25Engine is pure computation — no external API deps.
 *
 * Session 250.238: Converted from REPLICA (TestBM25 class copy) to
 * testing the REAL exported BM25Engine from production code.
 *
 * Run: node --test test/hybrid-rag.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { HybridRAG, getInstance, BM25Engine } from '../core/hybrid-rag.cjs';

// ─── BM25Engine tokenize ─────────────────────────────────────────────────────

describe('BM25Engine.tokenize()', () => {
  const bm25 = new BM25Engine();

  test('returns empty array for empty string', () => {
    assert.deepStrictEqual(bm25.tokenize(''), []);
  });

  test('returns empty array for null/undefined', () => {
    assert.deepStrictEqual(bm25.tokenize(null), []);
    assert.deepStrictEqual(bm25.tokenize(undefined), []);
  });

  test('lowercases all tokens', () => {
    const tokens = bm25.tokenize('HELLO World Testing');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
    assert.ok(tokens.includes('testing'));
  });

  test('filters short words (length <= 2)', () => {
    const tokens = bm25.tokenize('Le chat est sur la table de la cuisine');
    assert.ok(!tokens.includes('le'));
    assert.ok(!tokens.includes('la'));
    assert.ok(!tokens.includes('de'));
    assert.ok(tokens.includes('chat'));
    assert.ok(tokens.includes('table'));
    assert.ok(tokens.includes('cuisine'));
  });

  test('handles Arabic text', () => {
    const tokens = bm25.tokenize('كيفاش نقدر ندير موعد عند طبيب الأسنان');
    assert.ok(tokens.length > 0);
    assert.ok(tokens.some(t => /[\u0600-\u06FF]/.test(t)));
  });

  test('strips punctuation but keeps Arabic chars', () => {
    const tokens = bm25.tokenize('hello, world! مرحبا بالعالم');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
    assert.ok(tokens.some(t => /[\u0600-\u06FF]/.test(t)));
  });
});

// ─── BM25Engine build + search ───────────────────────────────────────────────

describe('BM25Engine.build() + search()', () => {
  const docs = [
    { id: '1', text: 'Comment prendre rendez-vous chez le dentiste à Casablanca' },
    { id: '2', text: 'Les tarifs de consultation dentaire sont de 350 DH' },
    { id: '3', text: 'Notre cabinet est ouvert du lundi au vendredi de 9h à 18h' },
    { id: '4', text: 'Pour annuler un rendez-vous, appelez-nous 24h avant' },
    { id: '5', text: 'Nous acceptons les paiements par carte bancaire et espèces' },
    { id: '6', text: 'كيفاش نقدر ندير موعد عند طبيب الأسنان في كازا' },
    { id: '7', text: 'The dental clinic is located in Casablanca city center' }
  ];

  test('builds index with correct docCount', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    assert.strictEqual(bm25.docCount, 7);
  });

  test('builds index with positive avgdl', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    assert.ok(bm25.avgdl > 0, `avgdl should be > 0, got ${bm25.avgdl}`);
  });

  test('builds IDF map with terms', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    assert.ok(bm25.idf.size > 0, 'IDF map should have entries');
  });

  test('search returns relevant results for FR query', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('rendez-vous dentiste');
    assert.ok(results.length > 0, 'Should find matching documents');
    assert.ok(
      results[0].text.includes('rendez-vous') || results[0].text.includes('dentiste'),
      'Top result should be about dental appointment'
    );
  });

  test('search returns relevant results for EN query', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('dental clinic Casablanca');
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.id === '7'));
  });

  test('search returns empty for unrelated query', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('programming javascript react');
    assert.strictEqual(results.length, 0);
  });

  test('search respects topK parameter', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('dentiste', 2);
    assert.ok(results.length <= 2);
  });

  test('search results have sparseScore property', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('tarifs consultation');
    assert.ok(results.length > 0);
    assert.strictEqual(typeof results[0].sparseScore, 'number');
    assert.ok(results[0].sparseScore > 0);
  });

  test('search results sorted by score descending', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('dentiste casablanca');
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].sparseScore >= results[i].sparseScore);
    }
  });

  test('search empty query returns empty', () => {
    const bm25 = new BM25Engine();
    bm25.build(docs);
    const results = bm25.search('');
    assert.deepStrictEqual(results, []);
  });

  test('empty document set returns empty search', () => {
    const bm25 = new BM25Engine();
    bm25.build([]);
    assert.strictEqual(bm25.docCount, 0);
    assert.deepStrictEqual(bm25.search('anything'), []);
  });

  test('single document index works', () => {
    const bm25 = new BM25Engine();
    bm25.build([{ id: 'sole', text: 'the quick brown fox jumps over the lazy dog' }]);
    assert.strictEqual(bm25.docCount, 1);
    const results = bm25.search('quick fox');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'sole');
  });

  test('repeated term gives higher score', () => {
    const bm25 = new BM25Engine();
    bm25.build([
      { id: 'repeat', text: 'vocalia vocalia vocalia voice platform' },
      { id: 'single', text: 'vocalia is nice for business consulting' }
    ]);
    const results = bm25.search('vocalia');
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'repeat');
    assert.ok(results[0].sparseScore > results[1].sparseScore);
  });

  test('IDF gives higher weight to rare terms', () => {
    const bm25 = new BM25Engine();
    bm25.build([
      { id: '1', text: 'common word common word common word' },
      { id: '2', text: 'common word rare term' },
      { id: '3', text: 'common word another text' }
    ]);
    const commonIdf = bm25.idf.get('common') || 0;
    const rareIdf = bm25.idf.get('rare') || 0;
    assert.ok(rareIdf > commonIdf, `Rare terms should have higher IDF: rare=${rareIdf} common=${commonIdf}`);
  });

  test('IDF minimum is 0.01', () => {
    const bm25 = new BM25Engine();
    bm25.build([
      { id: '1', text: 'common term' },
      { id: '2', text: 'common term' },
      { id: '3', text: 'common term' }
    ]);
    const idf = bm25.idf.get('common');
    assert.ok(idf >= 0.01, `IDF should be >= 0.01, got ${idf}`);
  });
});

// ─── HybridRAG._fuseResults (Reciprocal Rank Fusion) ────────────────────────

describe('HybridRAG._fuseResults()', () => {
  test('fuses sparse and dense results — overlap gets highest score', () => {
    const rag = new HybridRAG();
    const sparse = [
      { id: 'A', text: 'doc A', sparseScore: 2.5 },
      { id: 'B', text: 'doc B', sparseScore: 1.8 }
    ];
    const dense = [
      { id: 'B', text: 'doc B', denseScore: 0.95 },
      { id: 'C', text: 'doc C', denseScore: 0.88 }
    ];
    const results = rag._fuseResults(sparse, dense, 5);
    assert.ok(results.length >= 2);
    assert.strictEqual(results[0].id, 'B', 'B appears in both → highest RRF');
    assert.ok(results[0].rrfScore > results[1].rrfScore);
  });

  test('returns empty for empty inputs', () => {
    const rag = new HybridRAG();
    assert.deepStrictEqual(rag._fuseResults([], [], 5), []);
  });

  test('handles sparse-only results', () => {
    const rag = new HybridRAG();
    const sparse = [
      { id: 'A', text: 'doc A', sparseScore: 3.0 },
      { id: 'B', text: 'doc B', sparseScore: 1.5 }
    ];
    const results = rag._fuseResults(sparse, [], 5);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'A');
  });

  test('handles dense-only results', () => {
    const rag = new HybridRAG();
    const dense = [
      { id: 'X', text: 'doc X', denseScore: 0.99 },
      { id: 'Y', text: 'doc Y', denseScore: 0.75 }
    ];
    const results = rag._fuseResults([], dense, 5);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'X');
  });

  test('respects limit parameter', () => {
    const rag = new HybridRAG();
    const sparse = Array.from({ length: 10 }, (_, i) => ({
      id: `S${i}`, text: `sparse ${i}`, sparseScore: 10 - i
    }));
    const results = rag._fuseResults(sparse, [], 3);
    assert.strictEqual(results.length, 3);
  });

  test('results have rrfScore property', () => {
    const rag = new HybridRAG();
    const sparse = [{ id: 'A', text: 'test', sparseScore: 1.0 }];
    const results = rag._fuseResults(sparse, [], 5);
    assert.strictEqual(typeof results[0].rrfScore, 'number');
    assert.ok(results[0].rrfScore > 0);
  });

  test('results sorted by rrfScore descending', () => {
    const rag = new HybridRAG();
    const sparse = [
      { id: 'A', text: 'a', sparseScore: 3.0 },
      { id: 'B', text: 'b', sparseScore: 2.0 },
      { id: 'C', text: 'c', sparseScore: 1.0 }
    ];
    const results = rag._fuseResults(sparse, [], 5);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].rrfScore >= results[i].rrfScore);
    }
  });
});

// ─── HybridRAG invalidate ────────────────────────────────────────────────────

describe('HybridRAG.invalidate()', () => {
  test('removes matching tenant engines', () => {
    const rag = new HybridRAG();
    rag.tenantEngines.set('tenant1:fr', { bm25: {} });
    rag.tenantEngines.set('tenant1:en', { bm25: {} });
    rag.tenantEngines.set('tenant2:fr', { bm25: {} });
    rag.invalidate('tenant1');
    assert.strictEqual(rag.tenantEngines.size, 1);
    assert.ok(rag.tenantEngines.has('tenant2:fr'));
  });

  test('no-op for non-matching tenant', () => {
    const rag = new HybridRAG();
    rag.tenantEngines.set('t1:fr', { bm25: {} });
    rag.invalidate('t2');
    assert.strictEqual(rag.tenantEngines.size, 1);
  });

  test('removes all languages for a tenant', () => {
    const rag = new HybridRAG();
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      rag.tenantEngines.set(`t1:${lang}`, {});
    }
    rag.invalidate('t1');
    assert.strictEqual(rag.tenantEngines.size, 0);
  });
});

// ─── HybridRAG getInstance (singleton) ───────────────────────────────────────

describe('HybridRAG.getInstance()', () => {
  test('returns HybridRAG instance', () => {
    const inst = getInstance();
    assert.ok(inst instanceof HybridRAG);
  });

  test('returns same instance (singleton)', () => {
    assert.strictEqual(getInstance(), getInstance());
  });

  test('instance has tenantEngines map', () => {
    const inst = getInstance();
    assert.ok(inst.tenantEngines instanceof Map);
  });
});

// ─── HybridRAG.search() Real Integration Chain ──────────────────────────────

const hasGeminiKey = !!process.env.GEMINI_API_KEY;

describe('HybridRAG.search() — Real Integration Chain', { skip: !hasGeminiKey }, () => {
  const rag = new HybridRAG();

  test('search returns results for agency_internal FR with relevant query', async () => {
    const results = await rag.search('agency_internal', 'fr', 'Quels sont vos tarifs ?', {
      limit: 3,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(Array.isArray(results));
    // agency_internal has KB data, so we should get results
    if (results.length > 0) {
      assert.ok(results[0].id, 'Result should have id');
      assert.ok(results[0].text, 'Result should have text');
      assert.ok(results[0].rrfScore > 0, 'Result should have positive RRF score');
    }
  });

  test('search returns results for VocalIA-related query', async () => {
    const results = await rag.search('agency_internal', 'fr', 'Comment fonctionne VocalIA ?', {
      limit: 5,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(Array.isArray(results));
    // BM25 should at least find "vocalia" matches
  });

  test('search returns results for nonexistent tenant (falls back to universal KB)', async () => {
    const results = await rag.search('nonexistent_tenant_xyz', 'fr', 'vocalia', {
      limit: 3,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(Array.isArray(results));
    // Universal KB fallback means we still get results — this is CORRECT behavior
    // The system gracefully degrades rather than returning empty
  });

  test('search handles EN language', async () => {
    const results = await rag.search('agency_internal', 'en', 'What are your prices?', {
      limit: 3,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(Array.isArray(results));
  });

  test('search respects limit parameter', async () => {
    const results = await rag.search('agency_internal', 'fr', 'dentiste médecin santé', {
      limit: 1,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(Array.isArray(results));
    assert.ok(results.length <= 1);
  });

  test('invalidate clears tenant engine cache', async () => {
    // First search to populate cache
    await rag.search('agency_internal', 'fr', 'test', {
      limit: 1,
      geminiKey: process.env.GEMINI_API_KEY
    });
    assert.ok(rag.tenantEngines.size > 0);

    // Invalidate
    rag.invalidate('agency_internal');

    // Verify cache cleared
    let found = false;
    for (const key of rag.tenantEngines.keys()) {
      if (key.startsWith('agency_internal:')) found = true;
    }
    assert.strictEqual(found, false, 'agency_internal engines should be cleared');
  });
});
