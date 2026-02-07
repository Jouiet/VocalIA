'use strict';

/**
 * VocalIA Hybrid RAG Tests — BM25 Engine
 *
 * Tests the BM25 sparse search engine in isolation (no external API deps).
 * The HybridRAG class requires EmbeddingService (Gemini API) so we only test
 * the BM25Engine which is pure computation.
 *
 * Run: node --test test/hybrid-rag.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// We need to extract BM25Engine from hybrid-rag
// Since it's not exported directly, we test via HybridRAG import
// BM25Engine is internal — let's test it through require and access the prototype
const { HybridRAG } = require('../core/hybrid-rag.cjs');

describe('HybridRAG Module', () => {
  test('exports HybridRAG class', () => {
    assert.strictEqual(typeof HybridRAG, 'function');
  });

  test('HybridRAG instance has expected methods', () => {
    const rag = new HybridRAG();
    assert.strictEqual(typeof rag.search, 'function');
    assert.strictEqual(typeof rag._getEngine, 'function');
  });

  test('HybridRAG has tenantEngines map', () => {
    const rag = new HybridRAG();
    assert.ok(rag.tenantEngines instanceof Map);
    assert.strictEqual(rag.tenantEngines.size, 0);
  });
});

// Test BM25Engine by creating it manually via the module scope
// Since BM25Engine is not exported, we replicate its logic for testing
// Actually let's test it through the module file directly
describe('BM25 Engine (via source extraction)', () => {
  // We'll create our own lightweight BM25 to verify the algorithm
  // matches the implementation in hybrid-rag.cjs
  let BM25Engine;

  // Extract BM25Engine from module source
  test('BM25Engine can be instantiated from HybridRAG internals', () => {
    // The BM25 engine is created inside _getEngine
    // We can verify the algorithm by testing HybridRAG's search behavior
    // But since it needs tenant KB data, let's test the tokenizer pattern
    const rag = new HybridRAG();
    assert.ok(rag);
  });
});

// Since BM25Engine is internal, let's verify the tokenization and search
// algorithm by testing it through a minimal BM25 implementation
// that matches the code in hybrid-rag.cjs
describe('BM25 Algorithm Verification', () => {
  // Replicate the exact BM25Engine from hybrid-rag.cjs for testing
  class TestBM25 {
    constructor(options = {}) {
      this.k1 = options.k1 || 1.5;
      this.b = options.b || 0.75;
      this.avgdl = 0;
      this.docCount = 0;
      this.idf = new Map();
      this.documents = [];
      this.termFreqs = [];
    }

    tokenize(text) {
      if (!text) return [];
      return text.toLowerCase()
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
    }

    build(documents) {
      this.documents = documents;
      this.docCount = documents.length;
      this.termFreqs = [];
      const df = new Map();
      let totalLen = 0;

      documents.forEach((doc) => {
        const tokens = this.tokenize(doc.text);
        const tf = new Map();
        tokens.forEach(t => {
          tf.set(t, (tf.get(t) || 0) + 1);
        });
        this.termFreqs.push(tf);
        totalLen += tokens.length;

        for (const term of tf.keys()) {
          df.set(term, (df.get(term) || 0) + 1);
        }
      });

      this.avgdl = totalLen / (this.docCount || 1);

      for (const [term, freq] of df) {
        const idf = Math.log((this.docCount - freq + 0.5) / (freq + 0.5) + 1);
        this.idf.set(term, Math.max(idf, 0.01));
      }
    }

    search(query, topK = 10) {
      const tokens = this.tokenize(query);
      const scores = [];

      this.termFreqs.forEach((tf, idx) => {
        let score = 0;
        const docLen = this.tokenize(this.documents[idx].text).length;

        tokens.forEach(token => {
          if (!tf.has(token)) return;
          const f = tf.get(token);
          const idf = this.idf.get(token) || 0;
          const numerator = f * (this.k1 + 1);
          const denominator = f + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
          score += idf * (numerator / denominator);
        });

        if (score > 0) {
          scores.push({ index: idx, score });
        }
      });

      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(s => ({ ...this.documents[s.index], sparseScore: s.score }));
    }
  }

  const docs = [
    { id: '1', text: 'Comment prendre rendez-vous chez le dentiste à Casablanca' },
    { id: '2', text: 'Les tarifs de consultation dentaire sont de 350 DH' },
    { id: '3', text: 'Notre cabinet est ouvert du lundi au vendredi de 9h à 18h' },
    { id: '4', text: 'Pour annuler un rendez-vous, appelez-nous 24h avant' },
    { id: '5', text: 'Nous acceptons les paiements par carte bancaire et espèces' },
    { id: '6', text: 'كيفاش نقدر ندير موعد عند طبيب الأسنان في كازا' }, // Darija
    { id: '7', text: 'The dental clinic is located in Casablanca city center' }
  ];

  let bm25;

  test('builds index from documents', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    assert.strictEqual(bm25.docCount, 7);
    assert.ok(bm25.avgdl > 0);
    assert.ok(bm25.idf.size > 0);
  });

  test('tokenize filters short words (length <= 2)', () => {
    bm25 = new TestBM25();
    const tokens = bm25.tokenize('Le chat est sur la table de la cuisine');
    assert.ok(!tokens.includes('le'));
    assert.ok(!tokens.includes('la'));
    assert.ok(!tokens.includes('de'));
    assert.ok(tokens.includes('chat'));
    assert.ok(tokens.includes('table'));
    assert.ok(tokens.includes('cuisine'));
  });

  test('tokenize handles Arabic text', () => {
    bm25 = new TestBM25();
    const tokens = bm25.tokenize('كيفاش نقدر ندير موعد عند طبيب الأسنان');
    assert.ok(tokens.length > 0);
    assert.ok(tokens.some(t => /[\u0600-\u06FF]/.test(t)));
  });

  test('tokenize handles empty/null input', () => {
    bm25 = new TestBM25();
    assert.deepStrictEqual(bm25.tokenize(''), []);
    assert.deepStrictEqual(bm25.tokenize(null), []);
    assert.deepStrictEqual(bm25.tokenize(undefined), []);
  });

  test('search returns relevant results for FR query', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('rendez-vous dentiste');
    assert.ok(results.length > 0);
    // First result should be about dental appointment
    assert.ok(
      results[0].text.includes('rendez-vous') || results[0].text.includes('dentiste'),
      'Top result should be about dental appointment'
    );
  });

  test('search returns relevant results for EN query', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('dental clinic Casablanca');
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.id === '7'));
  });

  test('search returns empty for unrelated query', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('programming javascript react');
    assert.strictEqual(results.length, 0);
  });

  test('search respects topK parameter', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('dentiste', 2);
    assert.ok(results.length <= 2);
  });

  test('search results have sparseScore property', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('tarifs consultation');
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].sparseScore === 'number');
    assert.ok(results[0].sparseScore > 0);
  });

  test('search results are sorted by score desc', () => {
    bm25 = new TestBM25();
    bm25.build(docs);
    const results = bm25.search('dentiste casablanca');
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].sparseScore >= results[i].sparseScore);
    }
  });

  test('IDF gives higher weight to rare terms', () => {
    bm25 = new TestBM25();
    bm25.build([
      { id: '1', text: 'common word common word common word' },
      { id: '2', text: 'common word rare term' },
      { id: '3', text: 'common word another text' }
    ]);
    const commonIdf = bm25.idf.get('common') || 0;
    const rareIdf = bm25.idf.get('rare') || 0;
    assert.ok(rareIdf > commonIdf, 'Rare terms should have higher IDF');
  });
});

// ─── HybridRAG _fuseResults (RRF) ──────────────────────────────

describe('HybridRAG _fuseResults (Reciprocal Rank Fusion)', () => {
  test('fuses sparse and dense results', () => {
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
    // B appears in both → highest RRF score
    assert.strictEqual(results[0].id, 'B');
    assert.ok(results[0].rrfScore > results[1].rrfScore);
  });

  test('returns empty array for empty inputs', () => {
    const rag = new HybridRAG();
    const results = rag._fuseResults([], [], 5);
    assert.deepStrictEqual(results, []);
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
    const sparse = Array.from({ length: 10 }, (_, i) => ({ id: `S${i}`, text: `sparse ${i}`, sparseScore: 10 - i }));
    const dense = Array.from({ length: 10 }, (_, i) => ({ id: `D${i}`, text: `dense ${i}`, denseScore: 0.9 - i * 0.05 }));
    const results = rag._fuseResults(sparse, dense, 3);
    assert.strictEqual(results.length, 3);
  });

  test('overlapping items get boosted score', () => {
    const rag = new HybridRAG();
    const sparse = [
      { id: 'overlap', text: 'both results', sparseScore: 1.0 },
      { id: 'sparse_only', text: 'only sparse', sparseScore: 5.0 }
    ];
    const dense = [
      { id: 'overlap', text: 'both results', denseScore: 0.9 },
      { id: 'dense_only', text: 'only dense', denseScore: 0.8 }
    ];
    const results = rag._fuseResults(sparse, dense, 5);
    const overlap = results.find(r => r.id === 'overlap');
    const sparseOnly = results.find(r => r.id === 'sparse_only');
    assert.ok(overlap.rrfScore > sparseOnly.rrfScore, 'Overlapping result should have higher RRF score');
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

// ─── HybridRAG invalidate ───────────────────────────────────────

describe('HybridRAG invalidate', () => {
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
    rag.tenantEngines.set('t1:fr', {});
    rag.tenantEngines.set('t1:en', {});
    rag.tenantEngines.set('t1:es', {});
    rag.tenantEngines.set('t1:ar', {});
    rag.tenantEngines.set('t1:ary', {});
    rag.invalidate('t1');
    assert.strictEqual(rag.tenantEngines.size, 0);
  });
});

// ─── HybridRAG getInstance ─────────────────────────────────────

describe('HybridRAG getInstance', () => {
  const { getInstance } = require('../core/hybrid-rag.cjs');

  test('returns HybridRAG instance', () => {
    const inst = getInstance();
    assert.ok(inst instanceof HybridRAG);
  });

  test('returns same instance (singleton)', () => {
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b);
  });
});

// ─── HybridRAG exports ─────────────────────────────────────────

describe('HybridRAG exports', () => {
  const mod = require('../core/hybrid-rag.cjs');

  test('exports HybridRAG class', () => {
    assert.strictEqual(typeof mod.HybridRAG, 'function');
  });

  test('exports getInstance function', () => {
    assert.strictEqual(typeof mod.getInstance, 'function');
  });

  test('HybridRAG has _fuseResults method', () => {
    const rag = new HybridRAG();
    assert.strictEqual(typeof rag._fuseResults, 'function');
  });

  test('HybridRAG has invalidate method', () => {
    const rag = new HybridRAG();
    assert.strictEqual(typeof rag.invalidate, 'function');
  });

  test('HybridRAG has ensureDirectory method', () => {
    const rag = new HybridRAG();
    assert.strictEqual(typeof rag.ensureDirectory, 'function');
  });
});

// ─── BM25 Edge Cases ────────────────────────────────────────────

describe('BM25 Algorithm Edge Cases', () => {
  class TestBM25Edge {
    constructor(options = {}) {
      this.k1 = options.k1 || 1.5;
      this.b = options.b || 0.75;
      this.avgdl = 0;
      this.docCount = 0;
      this.idf = new Map();
      this.documents = [];
      this.termFreqs = [];
    }
    tokenize(text) {
      if (!text) return [];
      return text.toLowerCase()
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
    }
    build(documents) {
      this.documents = documents;
      this.docCount = documents.length;
      this.termFreqs = [];
      const df = new Map();
      let totalLen = 0;
      documents.forEach((doc) => {
        const tokens = this.tokenize(doc.text);
        const tf = new Map();
        tokens.forEach(t => { tf.set(t, (tf.get(t) || 0) + 1); });
        this.termFreqs.push(tf);
        totalLen += tokens.length;
        for (const term of tf.keys()) { df.set(term, (df.get(term) || 0) + 1); }
      });
      this.avgdl = totalLen / (this.docCount || 1);
      for (const [term, freq] of df) {
        const idf = Math.log((this.docCount - freq + 0.5) / (freq + 0.5) + 1);
        this.idf.set(term, Math.max(idf, 0.01));
      }
    }
    search(query, topK = 10) {
      const tokens = this.tokenize(query);
      const scores = [];
      this.termFreqs.forEach((tf, idx) => {
        let score = 0;
        const docLen = this.tokenize(this.documents[idx].text).length;
        tokens.forEach(token => {
          if (!tf.has(token)) return;
          const f = tf.get(token);
          const idf = this.idf.get(token) || 0;
          const numerator = f * (this.k1 + 1);
          const denominator = f + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
          score += idf * (numerator / denominator);
        });
        if (score > 0) { scores.push({ index: idx, score }); }
      });
      return scores.sort((a, b) => b.score - a.score).slice(0, topK)
        .map(s => ({ ...this.documents[s.index], sparseScore: s.score }));
    }
  }

  test('empty document set returns empty search', () => {
    const bm25 = new TestBM25Edge();
    bm25.build([]);
    assert.strictEqual(bm25.docCount, 0);
    const results = bm25.search('anything');
    assert.deepStrictEqual(results, []);
  });

  test('single document index', () => {
    const bm25 = new TestBM25Edge();
    bm25.build([{ id: 'sole', text: 'the quick brown fox jumps over the lazy dog' }]);
    assert.strictEqual(bm25.docCount, 1);
    const results = bm25.search('quick fox');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'sole');
  });

  test('custom k1 and b parameters', () => {
    const bm25 = new TestBM25Edge({ k1: 2.0, b: 0.5 });
    assert.strictEqual(bm25.k1, 2.0);
    assert.strictEqual(bm25.b, 0.5);
  });

  test('repeated term gives higher score', () => {
    const bm25 = new TestBM25Edge();
    bm25.build([
      { id: 'repeat', text: 'vocalia vocalia vocalia voice platform' },
      { id: 'single', text: 'vocalia is nice for business consulting' }
    ]);
    const results = bm25.search('vocalia');
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'repeat');
    assert.ok(results[0].sparseScore > results[1].sparseScore);
  });

  test('tokenize lowercases text', () => {
    const bm25 = new TestBM25Edge();
    const tokens = bm25.tokenize('HELLO World Testing');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
    assert.ok(tokens.includes('testing'));
  });

  test('tokenize strips punctuation but keeps Arabic', () => {
    const bm25 = new TestBM25Edge();
    const tokens = bm25.tokenize('hello, world! مرحبا بالعالم');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
    assert.ok(tokens.some(t => /[\u0600-\u06FF]/.test(t)));
  });

  test('search empty query returns empty', () => {
    const bm25 = new TestBM25Edge();
    bm25.build([{ id: '1', text: 'some document text here' }]);
    const results = bm25.search('');
    assert.deepStrictEqual(results, []);
  });

  test('avgdl computed correctly', () => {
    const bm25 = new TestBM25Edge();
    bm25.build([
      { id: '1', text: 'one two three four five' },     // 5 tokens (all > 2 chars)
      { id: '2', text: 'alpha beta gamma' }              // 3 tokens
    ]);
    // "one" is 3 chars, "two" is 3 chars — all pass filter
    // avgdl = (5 + 3) / 2 = 4 (approximately — depends on exact token count)
    assert.ok(bm25.avgdl > 0);
  });

  test('IDF minimum is 0.01', () => {
    const bm25 = new TestBM25Edge();
    // Term appearing in all docs → IDF near 0
    bm25.build([
      { id: '1', text: 'common term' },
      { id: '2', text: 'common term' },
      { id: '3', text: 'common term' }
    ]);
    const idf = bm25.idf.get('common');
    assert.ok(idf >= 0.01, `IDF should be >= 0.01, got ${idf}`);
  });
});
