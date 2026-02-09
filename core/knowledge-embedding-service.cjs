const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CACHE_FILE = path.join(__dirname, '../data/knowledge-base/embeddings_cache.json');

// Lazy init — avoids process crash at require-time if API key missing
let _genAI = null;
let _model = null;

function getModel() {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY not set — embeddings unavailable');
      return null;
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    _model = _genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }
  return _model;
}

/**
 * Knowledge Embedding Service
 * Architecture: Dense Vectors (Gemini) + Local Caching
 */
const MAX_CACHE_ENTRIES = 5000;

class KnowledgeEmbeddingService {
    constructor() {
        this.cache = this._loadCache();
    }

    /**
     * Load existing embeddings from disk
     */
    _loadCache() {
        if (fs.existsSync(CACHE_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            } catch (e) {
                console.error('[Embedding] Cache corruption detected:', e.message);
                return {};
            }
        }
        return {};
    }

    /**
     * Save embeddings to disk
     */
    _saveCache() {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2));
    }

    /**
     * Generate embedding for a single text chunk
     */
    async getEmbedding(id, text, apiKey = null, tenantId = null) {
        const cacheKey = tenantId ? `${tenantId}:${id}` : id;
        if (this.cache[cacheKey]) return this.cache[cacheKey];

        try {
            console.log(`[Embedding] Generating for chunk: ${cacheKey}...`);
            const targetModel = apiKey ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "text-embedding-004" }) : getModel();
            const result = await targetModel.embedContent(text);
            const embedding = result.embedding.values;

            // Evict oldest entries if cache is full
            const keys = Object.keys(this.cache);
            if (keys.length >= MAX_CACHE_ENTRIES) {
                const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES + 1);
                for (const k of toRemove) delete this.cache[k];
            }
            this.cache[cacheKey] = embedding;
            return embedding;
        } catch (e) {
            console.error(`[Embedding] Failed for ${id}:`, e.message);
            return null;
        }
    }

    /**
     * Batch generate embeddings for multiple chunks
     */
    async batchEmbed(chunks) {
        let changed = false;
        for (const chunk of chunks) {
            if (!this.cache[chunk.id]) {
                const vector = await this.getEmbedding(chunk.id, chunk.text);
                if (vector) changed = true;
                // Avoid rate limits
                await new Promise(r => setTimeout(r, 200));
            }
        }
        if (changed) this._saveCache();
        return this.cache;
    }

    /**
     * Generate embedding for a query (Real-time)
     */
    async getQueryEmbedding(query, apiKey = null) {
        try {
            const targetModel = apiKey ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "text-embedding-004" }) : getModel();
            const result = await targetModel.embedContent(query);
            return result.embedding.values;
        } catch (e) {
            console.error('[Embedding] Query embedding failed:', e.message);
            return null;
        }
    }

    /**
     * Calculate Cosine Similarity
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dotProduct / denom;
    }
}

module.exports = new KnowledgeEmbeddingService();
