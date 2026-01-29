#!/usr/bin/env node
/**
 * VECTOR STORE - Knowledge Base
 * =============================
 * Local vector store using TF-IDF + BM25 for retrieval
 * No external API required - works offline
 *
 * Upgrade path: Add OpenAI embeddings when API key available
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  dataDir: path.join(__dirname, '../data'),
  k1: 1.5,          // BM25 parameter
  b: 0.75,          // BM25 parameter
  topK: 5           // Default number of results
};

/**
 * Tokenize and normalize text
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, ' ')  // Keep letters, numbers, spaces
    .split(/\s+/)
    .filter(token => token.length > 2); // Remove very short tokens
}

/**
 * Calculate term frequency
 */
function termFrequency(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  return tf;
}

/**
 * VectorStore class - BM25-based retrieval
 */
class VectorStore {
  constructor() {
    this.documents = [];
    this.avgDocLength = 0;
    this.docFrequencies = {};
    this.totalDocs = 0;
    this.index = {};
  }

  /**
   * Load chunks from JSON file
   */
  load(chunksPath) {
    const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
    this.documents = chunks;
    this.totalDocs = chunks.length;

    // Build index
    console.log(`\n📊 Building index for ${this.totalDocs} documents...`);

    let totalLength = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const tokens = tokenize(chunk.content);
      chunk._tokens = tokens;
      chunk._tf = termFrequency(tokens);
      chunk._length = tokens.length;
      totalLength += tokens.length;

      // Track document frequencies
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.docFrequencies[token] = (this.docFrequencies[token] || 0) + 1;

        // Build inverted index
        if (!this.index[token]) {
          this.index[token] = [];
        }
        this.index[token].push(i);
      }
    }

    this.avgDocLength = totalLength / this.totalDocs;
    console.log(`   ├─ Unique tokens: ${Object.keys(this.docFrequencies).length}`);
    console.log(`   ├─ Avg doc length: ${Math.round(this.avgDocLength)} tokens`);
    console.log(`   └─ Index built successfully`);

    return this;
  }

  /**
   * Calculate BM25 score
   */
  bm25Score(queryTokens, docIndex) {
    const doc = this.documents[docIndex];
    let score = 0;

    for (const token of queryTokens) {
      if (!doc._tf[token]) continue;

      const tf = doc._tf[token];
      const df = this.docFrequencies[token] || 0;
      const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

      const numerator = tf * (CONFIG.k1 + 1);
      const denominator = tf + CONFIG.k1 * (1 - CONFIG.b + CONFIG.b * (doc._length / this.avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Search with query
   */
  search(query, options = {}) {
    const topK = options.topK || CONFIG.topK;
    const category = options.category || null;

    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    // Find candidate documents using inverted index
    const candidates = new Set();
    for (const token of queryTokens) {
      if (this.index[token]) {
        for (const docIndex of this.index[token]) {
          candidates.add(docIndex);
        }
      }
    }

    // Score candidates
    const scores = [];
    for (const docIndex of candidates) {
      const doc = this.documents[docIndex];

      // Filter by category if specified
      if (category && doc.category !== category) {
        continue;
      }

      const score = this.bm25Score(queryTokens, docIndex);
      if (score > 0) {
        scores.push({
          index: docIndex,
          score: score,
          chunk: doc
        });
      }
    }

    // Sort by score and return top K
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  /**
   * Search with multiple query variations for better recall
   */
  multiSearch(query, options = {}) {
    const topK = options.topK || CONFIG.topK;

    // Generate query variations
    const variations = [
      query,
      query.replace(/\?/g, ''),
      query.toLowerCase()
    ];

    // Add French variations
    const frenchMappings = {
      'combien': 'prix coût tarif',
      'comment': 'méthode processus étapes',
      'quels': 'liste services produits',
      'pourquoi': 'raison avantage bénéfice'
    };

    for (const [key, expansion] of Object.entries(frenchMappings)) {
      if (query.toLowerCase().includes(key)) {
        variations.push(query + ' ' + expansion);
      }
    }

    // Merge results from all variations
    const allResults = new Map();

    for (const variation of variations) {
      const results = this.search(variation, { ...options, topK: topK * 2 });
      for (const result of results) {
        const existing = allResults.get(result.chunk.id);
        if (!existing || result.score > existing.score) {
          allResults.set(result.chunk.id, result);
        }
      }
    }

    // Sort and return top K
    const merged = Array.from(allResults.values());
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, topK);
  }

  /**
   * Get context for RAG prompt
   */
  getContext(query, options = {}) {
    const results = this.multiSearch(query, options);

    if (results.length === 0) {
      return {
        context: '',
        sources: [],
        confidence: 0
      };
    }

    // Build context string
    const contextParts = [];
    const sources = [];

    for (const result of results) {
      const chunk = result.chunk;
      const header = chunk.headerPath.length > 0
        ? `[${chunk.headerPath.join(' > ')}]`
        : `[${chunk.source}]`;

      contextParts.push(`${header}\n${chunk.content}`);
      sources.push({
        source: chunk.source,
        section: chunk.headerPath.join(' > '),
        score: result.score.toFixed(3)
      });
    }

    // Calculate confidence based on top score
    const maxScore = results[0].score;
    const confidence = Math.min(1, maxScore / 10); // Normalize

    return {
      context: contextParts.join('\n\n---\n\n'),
      sources: sources,
      confidence: confidence
    };
  }

  /**
   * Save index to file
   */
  save(indexPath) {
    const data = {
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
      docFrequencies: this.docFrequencies,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
    console.log(`\n💾 Index saved to ${indexPath}`);
  }
}

/**
 * Create and initialize vector store
 */
function createVectorStore() {
  const store = new VectorStore();
  const chunksPath = path.join(CONFIG.dataDir, 'chunks.json');

  if (!fs.existsSync(chunksPath)) {
    console.error('❌ chunks.json not found. Run document-parser.cjs first.');
    process.exit(1);
  }

  store.load(chunksPath);
  return store;
}

// Test if run directly
if (require.main === module) {
  console.log('\n' + '═'.repeat(60));
  console.log('  VECTOR STORE - Test');
  console.log('═'.repeat(60));

  const store = createVectorStore();

  // Test queries
  const testQueries = [
    'Combien coûte le package Growth?',
    'Quels scripts Shopify sont disponibles?',
    'Comment fonctionne le lead scoring?',
    'Quels MCPs sont configurés?',
    'Tarifs et pricing'
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Query: "${query}"`);
    console.log('─'.repeat(50));

    const { context, sources, confidence } = store.getContext(query, { topK: 3 });

    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(`   Sources:`);
    for (const src of sources) {
      console.log(`     - ${src.source} > ${src.section || 'root'} (score: ${src.score})`);
    }
  }

  // Save index
  store.save(path.join(CONFIG.dataDir, 'index-stats.json'));

  console.log('\n' + '═'.repeat(60) + '\n');
}

module.exports = { VectorStore, createVectorStore };
