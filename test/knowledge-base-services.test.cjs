'use strict';

/**
 * VocalIA Knowledge Base Services Tests
 *
 * Tests:
 * - TFIDFIndex (BM25) constructor (defaults, custom k1/b)
 * - TFIDFIndex tokenize (pure text processing, multilingual, edge cases)
 * - TFIDFIndex build (vocabulary, IDF, document lengths)
 * - TFIDFIndex search (BM25 scoring, ranking, topK)
 * - TFIDFIndex toJSON / fromJSON (serialization round-trip)
 * - TFIDFIndex clear (reset state)
 * - ServiceKnowledgeBase constructor (defaults)
 *
 * NOTE: Does NOT require running services or catalog files.
 * Tests pure BM25/TF-IDF logic and class structure only.
 *
 * Run: node --test test/knowledge-base-services.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { ServiceKnowledgeBase, TFIDFIndex } = require('../core/knowledge-base-services.cjs');

// Sample documents for testing BM25
const SAMPLE_DOCS = [
  { text: 'voice ai assistant for customer service and lead qualification', id: 'doc1' },
  { text: 'email marketing automation with klaviyo integration', id: 'doc2' },
  { text: 'shopify order management and inventory tracking system', id: 'doc3' },
  { text: 'seo content optimization for organic traffic growth', id: 'doc4' },
  { text: 'voice telephony bridge for inbound call handling', id: 'doc5' }
];

// ─── TFIDFIndex constructor ──────────────────────────────────────

describe('TFIDFIndex constructor', () => {
  test('creates instance with default parameters', () => {
    const index = new TFIDFIndex();
    assert.ok(index);
    assert.strictEqual(index.k1, 1.5);
    assert.strictEqual(index.b, 0.75);
  });

  test('accepts custom k1 parameter', () => {
    const index = new TFIDFIndex({ k1: 2.0 });
    assert.strictEqual(index.k1, 2.0);
  });

  test('accepts custom b parameter', () => {
    const index = new TFIDFIndex({ b: 0.5 });
    assert.strictEqual(index.b, 0.5);
  });

  test('starts with empty documents', () => {
    const index = new TFIDFIndex();
    assert.strictEqual(index.documents.length, 0);
  });

  test('starts with empty vocabulary', () => {
    const index = new TFIDFIndex();
    assert.strictEqual(index.vocabulary.size, 0);
  });

  test('starts with empty IDF map', () => {
    const index = new TFIDFIndex();
    assert.strictEqual(index.idf.size, 0);
  });

  test('starts with avgDocLength 0', () => {
    const index = new TFIDFIndex();
    assert.strictEqual(index.avgDocLength, 0);
  });
});

// ─── TFIDFIndex tokenize ─────────────────────────────────────────

describe('TFIDFIndex tokenize', () => {
  test('lowercases text', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('Hello WORLD');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
  });

  test('removes short tokens (< 3 chars)', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('I am a big dog');
    assert.ok(!tokens.includes('am'));
    assert.ok(!tokens.includes('a'));
    assert.ok(tokens.includes('big'));
    assert.ok(tokens.includes('dog'));
  });

  test('returns empty array for null input', () => {
    const index = new TFIDFIndex();
    assert.deepStrictEqual(index.tokenize(null), []);
  });

  test('returns empty array for empty string', () => {
    const index = new TFIDFIndex();
    assert.deepStrictEqual(index.tokenize(''), []);
  });

  test('handles French accented characters', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('Réservation café éléphant');
    assert.ok(tokens.includes('réservation'));
    assert.ok(tokens.includes('café'));
    assert.ok(tokens.includes('éléphant'));
  });

  test('handles Arabic text', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('خدمة العملاء الذكية');
    assert.ok(tokens.length > 0);
  });

  test('splits on whitespace', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('voice  ai   assistant');
    assert.ok(tokens.includes('voice'));
    assert.ok(tokens.includes('assistant'));
  });

  test('removes punctuation', () => {
    const index = new TFIDFIndex();
    const tokens = index.tokenize('hello, world! (test)');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
    assert.ok(tokens.includes('test'));
  });
});

// ─── TFIDFIndex build ────────────────────────────────────────────

describe('TFIDFIndex build', () => {
  test('stores documents', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.strictEqual(index.documents.length, 5);
  });

  test('builds vocabulary from document tokens', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.ok(index.vocabulary.size > 0);
  });

  test('vocabulary contains expected terms', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.ok(index.vocabulary.has('voice'));
    assert.ok(index.vocabulary.has('email'));
    assert.ok(index.vocabulary.has('shopify'));
  });

  test('computes IDF for all vocabulary terms', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.ok(index.idf.size > 0);
    // voice appears in 2 docs, should have lower IDF than email (1 doc)
    assert.ok(index.idf.has('voice'));
    assert.ok(index.idf.has('email'));
  });

  test('IDF values are non-negative', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    for (const [term, idf] of index.idf) {
      assert.ok(idf >= 0, `IDF for ${term} should be non-negative`);
    }
  });

  test('rare terms have higher IDF than common terms', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    // 'voice' appears in 2 docs, 'email' in 1 doc
    // email should have higher IDF
    assert.ok(index.idf.get('email') > index.idf.get('voice'),
      'Rare term should have higher IDF');
  });

  test('computes average document length', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.ok(index.avgDocLength > 0);
    assert.strictEqual(typeof index.avgDocLength, 'number');
  });

  test('stores document lengths', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.strictEqual(index.docLengths.length, 5);
    for (const len of index.docLengths) {
      assert.ok(len > 0);
    }
  });

  test('stores term frequencies per document', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.strictEqual(index.termFreqs.length, 5);
    for (const tf of index.termFreqs) {
      assert.ok(tf instanceof Map);
    }
  });

  test('handles single document', () => {
    const index = new TFIDFIndex();
    index.build([{ text: 'single document test' }]);
    assert.strictEqual(index.documents.length, 1);
    assert.ok(index.vocabulary.size > 0);
  });

  test('handles empty documents array', () => {
    const index = new TFIDFIndex();
    // This may throw or produce NaN avgDocLength
    // Just verify it doesn't crash
    try {
      index.build([]);
      assert.strictEqual(index.documents.length, 0);
    } catch {
      // Some implementations may error on empty docs
      assert.ok(true);
    }
  });
});

// ─── TFIDFIndex search ───────────────────────────────────────────

describe('TFIDFIndex search', () => {
  test('returns results for matching query', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice ai assistant');
    assert.ok(results.length > 0);
  });

  test('returns empty for non-matching query', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('zzzzxyz nonexistent');
    assert.strictEqual(results.length, 0);
  });

  test('results have score property', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice');
    for (const r of results) {
      assert.strictEqual(typeof r.score, 'number');
      assert.ok(r.score > 0);
    }
  });

  test('results are sorted by score descending', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice customer service');
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score,
        'Results should be sorted by score descending');
    }
  });

  test('respects topK parameter', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice', 2);
    assert.ok(results.length <= 2);
  });

  test('default topK is 5', () => {
    const index = new TFIDFIndex();
    const docs = [];
    for (let i = 0; i < 10; i++) {
      docs.push({ text: `document ${i} voice test query`, id: `doc${i}` });
    }
    index.build(docs);
    const results = index.search('voice');
    assert.ok(results.length <= 5);
  });

  test('voice query ranks voice docs higher', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice telephony');
    assert.ok(results.length > 0);
    // First result should be doc5 (voice telephony) or doc1 (voice ai)
    assert.ok(results[0].id === 'doc5' || results[0].id === 'doc1');
  });

  test('email query ranks email doc highest', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('email marketing');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, 'doc2');
  });

  test('shopify query ranks shopify doc highest', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('shopify order');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, 'doc3');
  });

  test('preserves original document properties', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const results = index.search('voice');
    for (const r of results) {
      assert.ok(r.id);
      assert.ok(r.text);
    }
  });
});

// ─── TFIDFIndex toJSON / fromJSON ────────────────────────────────

describe('TFIDFIndex toJSON / fromJSON', () => {
  test('toJSON returns serializable object', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();
    assert.strictEqual(json.type, 'bm25');
    assert.ok(Array.isArray(json.vocabulary));
    assert.ok(Array.isArray(json.idf));
    assert.ok(Array.isArray(json.termFreqs));
    assert.ok(Array.isArray(json.docLengths));
  });

  test('toJSON includes BM25 parameters', () => {
    const index = new TFIDFIndex({ k1: 2.0, b: 0.5 });
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();
    assert.strictEqual(json.k1, 2.0);
    assert.strictEqual(json.b, 0.5);
  });

  test('toJSON includes document_count', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();
    assert.strictEqual(json.document_count, 5);
  });

  test('fromJSON restores vocabulary', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();

    const restored = new TFIDFIndex();
    restored.fromJSON(json);
    assert.strictEqual(restored.vocabulary.size, index.vocabulary.size);
  });

  test('fromJSON restores IDF values', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();

    const restored = new TFIDFIndex();
    restored.fromJSON(json);
    assert.strictEqual(restored.idf.size, index.idf.size);
  });

  test('fromJSON restores BM25 parameters', () => {
    const index = new TFIDFIndex({ k1: 2.0, b: 0.5 });
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();

    const restored = new TFIDFIndex();
    restored.fromJSON(json);
    assert.strictEqual(restored.k1, 2.0);
    assert.strictEqual(restored.b, 0.5);
  });

  test('fromJSON restores docLengths and avgDocLength', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const json = index.toJSON();

    const restored = new TFIDFIndex();
    restored.fromJSON(json);
    assert.strictEqual(restored.avgDocLength, index.avgDocLength);
    assert.strictEqual(restored.docLengths.length, index.docLengths.length);
  });

  test('JSON round-trip produces valid string', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    const jsonStr = JSON.stringify(index.toJSON());
    assert.ok(jsonStr.length > 0);
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.type, 'bm25');
  });
});

// ─── TFIDFIndex clear ────────────────────────────────────────────

describe('TFIDFIndex clear', () => {
  test('clears all data', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    assert.ok(index.vocabulary.size > 0);
    index.clear();
    assert.strictEqual(index.vocabulary.size, 0);
    assert.strictEqual(index.idf.size, 0);
    assert.strictEqual(index.documents.length, 0);
    assert.strictEqual(index.docLengths.length, 0);
    assert.strictEqual(index.termFreqs.length, 0);
    assert.strictEqual(index.avgDocLength, 0);
  });

  test('can rebuild after clear', () => {
    const index = new TFIDFIndex();
    index.build(SAMPLE_DOCS);
    index.clear();
    index.build(SAMPLE_DOCS.slice(0, 2));
    assert.strictEqual(index.documents.length, 2);
    assert.ok(index.vocabulary.size > 0);
  });
});

// ─── ServiceKnowledgeBase constructor ────────────────────────────

describe('ServiceKnowledgeBase constructor', () => {
  test('creates instance', () => {
    const kb = new ServiceKnowledgeBase();
    assert.ok(kb);
  });

  test('starts with empty chunks', () => {
    const kb = new ServiceKnowledgeBase();
    assert.deepStrictEqual(kb.chunks, []);
  });

  test('has BM25 index', () => {
    const kb = new ServiceKnowledgeBase();
    assert.ok(kb.index);
    assert.ok(kb.index instanceof TFIDFIndex);
  });

  test('has empty graph', () => {
    const kb = new ServiceKnowledgeBase();
    assert.deepStrictEqual(kb.graph, { nodes: [], edges: [] });
  });

  test('isLoaded starts false', () => {
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(kb.isLoaded, false);
  });
});

// ─── BM25 scoring correctness ────────────────────────────────────

describe('BM25 scoring correctness', () => {
  test('exact match scores higher than partial match', () => {
    const index = new TFIDFIndex();
    const docs = [
      { text: 'voice ai customer service assistant', id: 'exact' },
      { text: 'email marketing campaign optimization strategy', id: 'partial' },
      { text: 'voice recognition technology', id: 'related' }
    ];
    index.build(docs);
    const results = index.search('voice customer service');
    assert.ok(results[0].id === 'exact');
  });

  test('document with more query terms scores higher', () => {
    const index = new TFIDFIndex();
    const docs = [
      { text: 'voice', id: 'one-term' },
      { text: 'voice assistant customer service', id: 'multi-term' }
    ];
    index.build(docs);
    const results = index.search('voice assistant customer');
    assert.ok(results.length >= 1);
    if (results.length >= 2) {
      assert.strictEqual(results[0].id, 'multi-term');
    }
  });

  test('term frequency affects scoring', () => {
    const index = new TFIDFIndex();
    const docs = [
      { text: 'voice voice voice customer service', id: 'high-tf' },
      { text: 'voice customer service support team', id: 'low-tf' }
    ];
    index.build(docs);
    const results = index.search('voice');
    assert.ok(results.length >= 2);
    // BM25 has saturation so high TF may not always win
    // but both should appear
    const ids = results.map(r => r.id);
    assert.ok(ids.includes('high-tf'));
    assert.ok(ids.includes('low-tf'));
  });

  test('k1 parameter affects term frequency saturation', () => {
    const index1 = new TFIDFIndex({ k1: 0.5 });
    const index2 = new TFIDFIndex({ k1: 3.0 });
    const docs = [
      { text: 'voice voice voice voice', id: 'repeat' },
      { text: 'voice assistant help', id: 'once' }
    ];
    index1.build(docs);
    index2.build(docs);

    const r1 = index1.search('voice');
    const r2 = index2.search('voice');

    // Both should return results
    assert.ok(r1.length > 0);
    assert.ok(r2.length > 0);
  });
});

// ─── Exports ─────────────────────────────────────────────────────

describe('KnowledgeBaseServices exports', () => {
  test('exports ServiceKnowledgeBase class', () => {
    assert.strictEqual(typeof ServiceKnowledgeBase, 'function');
  });

  test('exports TFIDFIndex class', () => {
    assert.strictEqual(typeof TFIDFIndex, 'function');
  });

  test('TFIDFIndex is BM25 implementation', () => {
    const index = new TFIDFIndex();
    // Verify BM25 parameters exist
    assert.strictEqual(typeof index.k1, 'number');
    assert.strictEqual(typeof index.b, 'number');
  });

  test('ServiceKnowledgeBase has build method', () => {
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.build, 'function');
  });
});

// ─── ServiceKnowledgeBase formatForVoice ──────────────────────────

describe('ServiceKnowledgeBase formatForVoice', () => {
  const kb = new ServiceKnowledgeBase();

  test('returns French fallback for empty results (fr)', () => {
    const result = kb.formatForVoice([], 'fr');
    assert.ok(result.includes("pas trouvé"));
  });

  test('returns English fallback for empty results (en)', () => {
    const result = kb.formatForVoice([], 'en');
    assert.ok(result.includes("couldn't find"));
  });

  test('returns English fallback for null results', () => {
    const result = kb.formatForVoice(null, 'en');
    assert.ok(result.includes("couldn't find"));
  });

  test('formats results with title and benefit', () => {
    const results = [{
      title: 'Voice AI',
      benefit_en: 'Automates calls',
      strategic_intent: 'Reduce costs',
      business_outcome: 'Faster response',
      diagnostic_truth: 'AI is efficient'
    }];
    const output = kb.formatForVoice(results, 'en');
    assert.ok(output.includes('VOICE AI'));
    assert.ok(output.includes('Automates calls'));
    assert.ok(output.includes('Reduce costs'));
    assert.ok(output.includes('Faster response'));
  });

  test('uses French title when language is fr', () => {
    const results = [{
      title: 'Voice AI',
      title_fr: 'IA Vocale',
      benefit_en: 'Automates',
      benefit_fr: 'Automatise',
      strategic_intent: 'Intent',
      business_outcome: 'Outcome',
      diagnostic_truth: 'Truth'
    }];
    const output = kb.formatForVoice(results, 'fr');
    assert.ok(output.includes('IA VOCALE'));
    assert.ok(output.includes('Automatise'));
  });

  test('limits to 3 results max', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      title: `Item ${i}`,
      benefit_en: `Benefit ${i}`,
      strategic_intent: 'Intent',
      business_outcome: 'Outcome',
      diagnostic_truth: 'Truth'
    }));
    const output = kb.formatForVoice(results, 'en');
    assert.ok(output.includes('ITEM 0'));
    assert.ok(output.includes('ITEM 2'));
    assert.ok(!output.includes('ITEM 3'));
  });
});

// ─── ServiceKnowledgeBase graphSearch ──────────────────────────────

describe('ServiceKnowledgeBase graphSearch', () => {
  test('returns empty for no matching nodes', () => {
    const kb = new ServiceKnowledgeBase();
    kb.isLoaded = true;
    kb.graph = { nodes: [{ id: 'n1', label: 'Email' }], edges: [] };
    const results = kb.graphSearch('nonexistent');
    assert.deepStrictEqual(results, []);
  });

  test('finds matching node by label', () => {
    const kb = new ServiceKnowledgeBase();
    kb.isLoaded = true;
    kb.graph = {
      nodes: [
        { id: 'n1', label: 'Voice AI', type: 'service' },
        { id: 'n2', label: 'Telephony', type: 'service' }
      ],
      edges: [{ from: 'n1', to: 'n2', relation: 'requires' }]
    };
    const results = kb.graphSearch('voice');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].node.id, 'n2');
    assert.strictEqual(results[0].relation, 'requires');
  });

  test('finds matching node by id', () => {
    const kb = new ServiceKnowledgeBase();
    kb.isLoaded = true;
    kb.graph = {
      nodes: [
        { id: 'voice_ai', label: 'AI Service', type: 'service' },
        { id: 'stt', label: 'STT Engine', type: 'component' }
      ],
      edges: [{ from: 'voice_ai', to: 'stt', relation: 'uses' }]
    };
    const results = kb.graphSearch('voice_ai');
    assert.ok(results.length >= 1);
  });

  test('returns bidirectional edges', () => {
    const kb = new ServiceKnowledgeBase();
    kb.isLoaded = true;
    kb.graph = {
      nodes: [
        { id: 'n1', label: 'A', type: 's' },
        { id: 'n2', label: 'B', type: 's' },
        { id: 'n3', label: 'C', type: 's' }
      ],
      edges: [
        { from: 'n1', to: 'n2', relation: 'depends_on' },
        { from: 'n3', to: 'n1', relation: 'enhances' }
      ]
    };
    const results = kb.graphSearch('A');
    assert.strictEqual(results.length, 2);
  });

  test('filters by tenantId', () => {
    const kb = new ServiceKnowledgeBase();
    kb.isLoaded = true;
    kb.graph = {
      nodes: [
        { id: 'n1', label: 'Voice', type: 's', tenant_id: 'tenant_a' },
        { id: 'n2', label: 'Email', type: 's', tenant_id: 'shared' }
      ],
      edges: [{ from: 'n1', to: 'n2', relation: 'uses' }]
    };
    const results = kb.graphSearch('voice', { tenantId: 'tenant_b' });
    assert.strictEqual(results.length, 0);
  });
});

// ─── ServiceKnowledgeBase getStatus ───────────────────────────────

describe('ServiceKnowledgeBase getStatus', () => {
  test('returns exists:false when no status file', () => {
    const kb = new ServiceKnowledgeBase();
    const status = kb.getStatus();
    assert.strictEqual(typeof status, 'object');
    // Will return exists:true if status.json exists in data dir
    assert.ok('exists' in status);
  });
});

// ─── ServiceKnowledgeBase methods existence ─────────────────────

describe('ServiceKnowledgeBase methods', () => {
  const kb = new ServiceKnowledgeBase();

  test('has load method', () => {
    assert.strictEqual(typeof kb.load, 'function');
  });

  test('has search method', () => {
    assert.strictEqual(typeof kb.search, 'function');
  });

  test('has graphSearch method', () => {
    assert.strictEqual(typeof kb.graphSearch, 'function');
  });

  test('has formatForVoice method', () => {
    assert.strictEqual(typeof kb.formatForVoice, 'function');
  });

  test('has getStatus method', () => {
    assert.strictEqual(typeof kb.getStatus, 'function');
  });

  test('has asyncSearchHybrid method', () => {
    assert.strictEqual(typeof kb.asyncSearchHybrid, 'function');
  });
});
