const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CACHE_FILE = path.join(__dirname, '../data/knowledge-base/embeddings_cache.json');
const MAX_CACHE_ENTRIES = 5000;

/**
 * Knowledge Embedding Service
 * Architecture: Direct HTTPS Fetch to Gemini v1 API for maximum stability.
 * Bypasses SDK-level versioning issues (v1beta 404).
 */
class KnowledgeEmbeddingService {
    constructor() {
        this.cache = this._loadCache();
        this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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
     * Direct Fetch to Gemini v1 Embedding API
     */
    async _fetchEmbedding(text, apiKeyOverride = null) {
        const key = apiKeyOverride || this.apiKey;
        if (!key) {
            console.error('❌ GEMINI_API_KEY missing');
            return null;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text }] }
                })
            });

            if (!res.ok) {
                const err = await res.text();
                console.error(`[Embedding] API Error (${res.status}):`, err);
                return null;
            }

            const data = await res.json();
            return data.embedding?.values || null;
        } catch (e) {
            console.error('[Embedding] Fetch failed:', e.message);
            return null;
        }
    }

    /**
     * Generate embedding for a single text chunk
     */
    async getEmbedding(id, text, apiKey = null, tenantId = null) {
        const cacheKey = tenantId ? `${tenantId}:${id}` : id;
        if (this.cache[cacheKey]) return this.cache[cacheKey];

        try {
            console.log(`[Embedding] Generating for chunk: ${cacheKey}...`);
            const embedding = await this._fetchEmbedding(text, apiKey);

            if (embedding) {
                // Evict oldest entries if cache is full
                const keys = Object.keys(this.cache);
                if (keys.length >= MAX_CACHE_ENTRIES) {
                    const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES + 1);
                    for (const k of toRemove) delete this.cache[k];
                }
                this.cache[cacheKey] = embedding;
            }
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
        return await this._fetchEmbedding(query, apiKey);
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
