const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CACHE_FILE = path.join(__dirname, '../../../knowledge_base/embeddings_cache.json');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Knowledge Embedding Service
 * Architecture: Dense Vectors (Gemini) + Local Caching
 */
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
    async getEmbedding(id, text) {
        if (this.cache[id]) return this.cache[id];

        try {
            console.log(`[Embedding] Generating for chunk: ${id}...`);
            const result = await model.embedContent(text);
            const embedding = result.embedding.values;

            this.cache[id] = embedding;
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
    async getQueryEmbedding(query) {
        try {
            const result = await model.embedContent(query);
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
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

module.exports = new KnowledgeEmbeddingService();
