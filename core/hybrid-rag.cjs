#!/usr/bin/env node
/**
 * VocalIA - Hybrid RAG Engine (Zero Debt Implementation)
 * 
 * Architecture:
 * - Sparse Search: BM25 (Best Matching 25) for keyword precision.
 * - Dense Search: Gemini Embeddings (text-embedding-004) for semantic depth.
 * - Fusion: Reciprocal Rank Fusion (RRF) for robust result merging.
 * - Multi-Tenancy: Isolated indices and caches per tenant.
 */

const fs = require('fs');
const path = require('path');
const EmbeddingService = require('./knowledge-embedding-service.cjs');
const { getInstance: getTenantKB } = require('./tenant-kb-loader.cjs');

// Paths
const DATA_DIR = path.join(__dirname, '../data/rag');

/**
 * BM25 implementation for sparse retrieval
 */
class BM25Engine {
    constructor(options = {}) {
        this.k1 = options.k1 || 1.5;
        this.b = options.b || 0.75;
        this.avgdl = 0;
        this.docCount = 0;
        this.idf = new Map();
        this.documents = [];
        this.termFreqs = []; // Array of Maps [docIndex -> Map(term -> count)]
    }

    tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Keep Arabic/Darija chars
            .split(/\s+/)
            .filter(t => t.length > 2);
    }

    build(documents) {
        this.documents = documents;
        this.docCount = documents.length;
        this.termFreqs = [];
        const df = new Map();
        let totalLen = 0;

        documents.forEach((doc, idx) => {
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

        // Calculate IDF
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

/**
 * HybridRAG - Orchestrates Sparse and Dense search
 */
class HybridRAG {
    constructor() {
        this.tenantEngines = new Map();
        this.ensureDirectory();
    }

    ensureDirectory() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    /**
     * Get or create engine for a tenant
     */
    async _getEngine(tenantId, lang) {
        const key = `${tenantId}:${lang}`;
        if (this.tenantEngines.has(key)) return this.tenantEngines.get(key);

        const engine = {
            bm25: new BM25Engine(),
            embeddings: {} // Local cache for this tenant/lang
        };

        // Load KB data
        const kbLoader = getTenantKB();
        const kb = await kbLoader.getKB(tenantId, lang);
        const chunks = Object.entries(kb)
            .filter(([id]) => id !== '__meta')
            .map(([id, data]) => ({
                id,
                text: typeof data === 'string' ? data : JSON.stringify(data)
            }));

        if (chunks.length > 0) {
            engine.bm25.build(chunks);
            // We don't load ALL embeddings into memory at once here, 
            // we'll rely on KnowledgeEmbeddingService's disk cache
            this.tenantEngines.set(key, engine);
        }

        return engine;
    }

    /**
     * Search across Sparse and Dense indices
     */
    async search(tenantId, lang, query, options = {}) {
        const limit = options.limit || 5;
        const engine = await this._getEngine(tenantId, lang);
        if (!engine || engine.bm25.documents.length === 0) {
            return [];
        }

        // 1. Sparse Search (BM25)
        const sparseResults = engine.bm25.search(query, limit * 2);

        // 2. Dense Search (Semantic)
        const queryVector = await EmbeddingService.getQueryEmbedding(query);
        let denseResults = [];

        if (queryVector) {
            const chunks = engine.bm25.documents;
            for (const chunk of chunks) {
                // Use KnowledgeEmbeddingService which has global cache/disk storage
                const chunkVector = await EmbeddingService.getEmbedding(chunk.id, chunk.text);
                if (chunkVector) {
                    const similarity = EmbeddingService.cosineSimilarity(queryVector, chunkVector);
                    denseResults.push({ ...chunk, denseScore: similarity });
                }
            }
            denseResults.sort((a, b) => b.denseScore - a.denseScore);
            denseResults = denseResults.slice(0, limit * 2);
        }

        // 3. Reciprocal Rank Fusion (RRF)
        return this._fuseResults(sparseResults, denseResults, limit);
    }

    /**
     * Reciprocal Rank Fusion (RRF)
     * Formula: score = sum( 1 / (rank + k) )
     */
    _fuseResults(sparse, dense, limit) {
        const k = 60; // Smoothing constant
        const combined = new Map();

        sparse.forEach((item, index) => {
            const score = 1 / (index + k);
            combined.set(item.id, { ...item, rrfScore: score });
        });

        dense.forEach((item, index) => {
            const score = 1 / (index + k);
            if (combined.has(item.id)) {
                const existing = combined.get(item.id);
                existing.rrfScore += score;
                existing.denseScore = item.denseScore;
            } else {
                combined.set(item.id, { ...item, rrfScore: score });
            }
        });

        return Array.from(combined.values())
            .sort((a, b) => b.rrfScore - a.rrfScore)
            .slice(0, limit);
    }

    /**
     * Flush engine for a tenant (on KB update)
     */
    invalidate(tenantId) {
        for (const key of this.tenantEngines.keys()) {
            if (key.startsWith(`${tenantId}:`)) {
                this.tenantEngines.delete(key);
            }
        }
    }
}

// Singleton
let instance = null;
function getInstance() {
    if (!instance) instance = new HybridRAG();
    return instance;
}

module.exports = { HybridRAG, getInstance };

// CLI Test Mode
if (require.main === module) {
    const rag = getInstance();
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
        const tenantId = 'client_demo';
        const lang = 'fr';
        const query = args[args.indexOf('--test') + 1] || 'comment ça marche';

        console.log(`🔍 Testing HybridRAG for ${tenantId}/${lang}: "${query}"`);
        rag.search(tenantId, lang, query).then(results => {
            console.log('\n🏆 Results (RRF Sorted):');
            results.forEach((r, i) => {
                console.log(`${i + 1}. [${r.id}] Score: ${r.rrfScore.toFixed(4)}`);
                console.log(`   Text: ${r.text.substring(0, 100)}...`);
            });
        }).catch(err => {
            console.error('❌ Test failed:', err.message);
        });
    }
}
