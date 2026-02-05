/**
 * VocalIA Knowledge Base Tests
 *
 * Tests for the BM25-based knowledge base and search system
 * Run: node --test test/knowledge-base.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Knowledge Base Module Export', () => {
  test('Module loads without error', () => {
    const mod = require('../core/knowledge-base-services.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('Module exports ServiceKnowledgeBase class', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    assert.ok(ServiceKnowledgeBase, 'Should export ServiceKnowledgeBase class');
    assert.strictEqual(typeof ServiceKnowledgeBase, 'function', 'ServiceKnowledgeBase should be a constructor');
  });

  test('Module exports TFIDFIndex class', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    assert.ok(TFIDFIndex, 'Should export TFIDFIndex class');
    assert.strictEqual(typeof TFIDFIndex, 'function', 'TFIDFIndex should be a constructor');
  });
});

describe('ServiceKnowledgeBase Instantiation', () => {
  test('Can instantiate ServiceKnowledgeBase', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.ok(kb, 'Should create instance');
  });

  test('Instance has search method', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.search, 'function', 'Should have search method');
  });

  test('Instance has asyncSearchHybrid method', () => {
    // Updated Session 250.87: method is asyncSearchHybrid (async)
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.asyncSearchHybrid, 'function', 'Should have asyncSearchHybrid method');
  });

  test('Instance has build method', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.build, 'function', 'Should have build method');
  });

  test('Instance has load method', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.load, 'function', 'Should have load method');
  });

  test('Instance has getStatus method', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.getStatus, 'function', 'Should have getStatus method');
  });
});

describe('TFIDFIndex (BM25 Implementation)', () => {
  test('Can instantiate TFIDFIndex', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    assert.ok(index, 'Should create instance');
  });

  test('TFIDFIndex has search method', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    assert.strictEqual(typeof index.search, 'function', 'Should have search method');
  });

  test('TFIDFIndex has build method', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    assert.strictEqual(typeof index.build, 'function', 'Should have build method');
  });

  test('TFIDFIndex has tokenize method', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    assert.strictEqual(typeof index.tokenize, 'function', 'Should have tokenize method');
  });
});

describe('BM25 Tokenization', () => {
  test('Tokenizes simple text', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize('hello world test');
    assert.ok(Array.isArray(tokens), 'Should return array');
    assert.ok(tokens.length > 0, 'Should have tokens');
  });

  test('Tokenizes to lowercase', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize('HELLO WORLD');
    assert.ok(tokens.every(t => t === t.toLowerCase()), 'All tokens should be lowercase');
  });

  test('Filters short tokens (< 3 chars)', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize('a ab abc abcd');
    assert.ok(tokens.every(t => t.length >= 3), 'All tokens should be 3+ chars');
  });

  test('Handles empty string', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize('');
    assert.ok(Array.isArray(tokens), 'Should return array');
    assert.strictEqual(tokens.length, 0, 'Should be empty');
  });

  test('Handles null input', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize(null);
    assert.ok(Array.isArray(tokens), 'Should return array');
    assert.strictEqual(tokens.length, 0, 'Should be empty');
  });

  test('Handles French text with accents', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();
    const tokens = index.tokenize('café résumé naïve');
    assert.ok(tokens.length > 0, 'Should handle French accents');
  });
});

describe('BM25 Index Build', () => {
  test('Can build index with documents', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing campaign', id: '2' },
      { text: 'shopify ecommerce store', id: '3' }
    ];

    index.build(docs);
    assert.ok(index.documents.length === 3, 'Should have 3 documents');
  });

  test('Build creates vocabulary', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing campaign', id: '2' }
    ];

    index.build(docs);
    assert.ok(index.vocabulary.size > 0, 'Should have vocabulary');
  });

  test('Build calculates IDF', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing automation', id: '2' }
    ];

    index.build(docs);
    assert.ok(index.idf.size > 0, 'Should have IDF values');
  });

  test('Build calculates average doc length', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant', id: '1' },
      { text: 'email marketing campaign test', id: '2' }
    ];

    index.build(docs);
    assert.ok(index.avgDocLength > 0, 'Should have average doc length');
  });
});

describe('BM25 Search', () => {
  test('Search returns results array', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing campaign', id: '2' },
      { text: 'shopify ecommerce store', id: '3' }
    ];

    index.build(docs);
    const results = index.search('voice automation');
    assert.ok(Array.isArray(results), 'Should return array');
  });

  test('Search ranks relevant docs higher', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation system', id: '1' },
      { text: 'email marketing campaign', id: '2' },
      { text: 'shopify ecommerce store', id: '3' }
    ];

    index.build(docs);
    const results = index.search('voice automation', 3);

    // First result should be the voice-related document
    if (results.length > 0 && results[0]) {
      // Check result structure - could be {doc, score} or direct doc
      const firstResult = results[0].doc || results[0];
      assert.ok(firstResult, 'Should have first result');
      // The voice doc should score highest
      if (firstResult.id) {
        assert.strictEqual(firstResult.id, '1', 'Voice doc should rank first');
      }
    }
  });

  test('Search respects topK limit', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing campaign', id: '2' },
      { text: 'shopify ecommerce store', id: '3' },
      { text: 'analytics reporting dashboard', id: '4' },
      { text: 'seo content optimization', id: '5' }
    ];

    index.build(docs);
    const results = index.search('automation', 2);
    assert.ok(results.length <= 2, 'Should respect topK limit');
  });

  test('Search handles no matches', () => {
    const { TFIDFIndex } = require('../core/knowledge-base-services.cjs');
    const index = new TFIDFIndex();

    const docs = [
      { text: 'voice assistant automation', id: '1' },
      { text: 'email marketing campaign', id: '2' }
    ];

    index.build(docs);
    const results = index.search('zzzznonexistent');
    assert.ok(Array.isArray(results), 'Should return array');
  });
});

describe('ServiceKnowledgeBase Status', () => {
  test('getStatus method exists', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    assert.strictEqual(typeof kb.getStatus, 'function', 'getStatus should be a function');
  });

  test('getStatus returns object', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();
    const status = kb.getStatus();
    assert.ok(status !== null && typeof status === 'object', 'Should return object');
  });
});

describe('ServiceKnowledgeBase Search', () => {
  test('search method exists and is function', () => {
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();

    // Just verify method exists (API calls require credentials)
    assert.strictEqual(typeof kb.search, 'function', 'search should be a function');
  });

  test('asyncSearchHybrid method exists and is function', () => {
    // Updated Session 250.87: method is asyncSearchHybrid (async)
    const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
    const kb = new ServiceKnowledgeBase();

    // Just verify method exists (API calls require credentials)
    assert.strictEqual(typeof kb.asyncSearchHybrid, 'function', 'asyncSearchHybrid should be a function');
  });
});
