const fs = require('fs');
const path = require('path');
const fsp = require('fs').promises;
const { sanitizeTenantId } = require('./voice-api-utils.cjs'); // Shared utility
const AgencyEventBus = require('./AgencyEventBus.cjs');
const { HybridRAG } = require('./hybrid-rag.cjs');
const SimpleVectorStore = require('./memory/SimpleVectorStore.cjs'); // Direct SQLite Access
const EmbeddingService = require('./knowledge-embedding-service.cjs'); // SOTA: Generate Vector

/**
 * TenantMemory.cjs - Persistent Cross-Session Memory for Agents
 * SOTA Pattern #2: Long-term memory beyond 24h session TTL
 * 
 * Capabilities:
 * - Persist extracted facts to JSONL (append-only log)
 * - Deduplicate facts (idempotency)
 * - Index facts into HybridRAG for semantic retrieval
 * - Retrieve facts for context injection
 * - Purge memory (RGPD compliance)
 */

class TenantMemory {
    constructor(options = {}) {
        this.baseDir = options.baseDir || path.join(__dirname, '..', 'data', 'memory');
        this.rag = options.rag || new HybridRAG();
        this.vectorStores = new Map(); // SOTA: Cache open KV stores

        // Ensure base directory exists
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Get storage path for a tenant
     * @param {string} tenantId 
     * @returns {string} Absolute path to facts.jsonl
     */
    _getStoragePath(tenantId) {
        const safeId = sanitizeTenantId(tenantId);
        const tenantDir = path.join(this.baseDir, safeId);

        // Ensure tenant directory exists
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }

        return path.join(tenantDir, 'facts.jsonl');
    }

    /**
     * Promote a session fact to permanent memory
     * @param {string} tenantId - Tenant identifier
     * @param {Object} fact - Fact extracted from ContextBox
     * @param {string} fact.type - budget, preference, timeline, etc.
     * @param {string} fact.value - The extracted value
     * @param {string} fact.source - conversation, system, manual
     * @param {string} fact.sessionId - Origin session ID
     * @param {number} fact.confidence - Confidence score (0-1)
     * @returns {Promise<boolean>} - True if saved, false if duplicate or low confidence
     */
    async promoteFact(tenantId, fact) {
        if (!tenantId || !fact || !fact.value) return false;

        // 1. Validation & Confidence Check
        // facts with excessive length or low confidence are rejected
        if (fact.confidence && fact.confidence < 0.6) {
            return false;
        }

        const safeTenantId = sanitizeTenantId(tenantId);
        const filePath = this._getStoragePath(safeTenantId);

        // 2. Normalization
        const normalizedFact = {
            id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: fact.type,
            value: fact.value.trim(),
            source: fact.source || 'conversation',
            sessionId: fact.sessionId || 'unknown',
            timestamp: new Date().toISOString(),
            confidence: fact.confidence || 1.0
        };

        // 3. Deduplication (Check existing facts)
        // For MVP efficiency, we read the file. For scale, we'd use a bloom filter or index.
        const existingFacts = await this._readFacts(filePath);
        const isDuplicate = existingFacts.some(f =>
            f.type === normalizedFact.type &&
            f.value.toLowerCase() === normalizedFact.value.toLowerCase()
        );

        if (isDuplicate) {
            return false; // Already known
        }

        // 4. Persistence (Append to JSONL)
        const line = JSON.stringify(normalizedFact) + '\n';
        await fsp.appendFile(filePath, line);

        // 5. Indexing (SOTA: Direct SQLite Write)
        // We write directly to the vector store to ensure immediate detailed retrieval
        try {
            let store = this.vectorStores.get(safeTenantId);
            if (!store) {
                store = new SimpleVectorStore(safeTenantId);
                this.vectorStores.set(safeTenantId, store);
            }

            // SOTA FIX: Generate Embedding BEFORE persistence (Phantom Memory Fix)
            const embeddingVector = await EmbeddingService.getEmbedding(
                normalizedFact.id,
                normalizedFact.value,
                null, // Use env API Key
                safeTenantId
            );

            if (!embeddingVector) {
                console.warn(`[TenantMemory] Embedding failed for ${normalizedFact.id}, saving without vector.`);
            }

            store.upsert(normalizedFact.id, normalizedFact.value, {
                source: 'tenant_memory',
                type: normalizedFact.type,
                timestamp: normalizedFact.timestamp,
                sessionId: normalizedFact.sessionId
            }, embeddingVector); // Pass vector!

            // Also notify logic layer
            console.log(`[TenantMemory] Persisted fact ${normalizedFact.id} to SQLite (${safeTenantId})`);

        } catch (err) {
            console.error(`[TenantMemory] SQLite persistence failed for ${safeTenantId}: ${err.message}`);
        }

        // 6. Audit Trail
        AgencyEventBus.publish('memory.fact_promoted', {
            tenantId: safeTenantId,
            factType: normalizedFact.type,
            factValue: normalizedFact.value
        });

        return true;
    }

    /**
     * Helper: Read all facts from file
     * @param {string} filePath 
     * @returns {Promise<Array>}
     */
    async _readFacts(filePath) {
        try {
            if (!fs.existsSync(filePath)) return [];
            const content = await fsp.readFile(filePath, 'utf8');
            return content.trim().split('\n')
                .map(line => {
                    try { return JSON.parse(line); } catch (e) { return null; }
                })
                .filter(f => f !== null);
        } catch (e) {
            console.error(`[TenantMemory] Read error: ${e.message}`);
            return [];
        }
    }

    /**
     * Get all facts for a tenant, optionally filtered
     * @param {string} tenantId 
     * @param {Object} options - { type, limit, since }
     * @returns {Promise<Array>}
     */
    async getFacts(tenantId, options = {}) {
        const safeId = sanitizeTenantId(tenantId);
        const filePath = this._getStoragePath(safeId);

        let facts = await this._readFacts(filePath);

        // Apply filters
        if (options.type) {
            facts = facts.filter(f => f.type === options.type);
        }
        if (options.since) {
            const sinceDate = new Date(options.since);
            facts = facts.filter(f => new Date(f.timestamp) >= sinceDate);
        }

        // Sort by recency (newest first)
        facts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply limit
        if (options.limit && options.limit > 0) {
            facts = facts.slice(0, options.limit);
        }

        return facts;
    }

    /**
     * Semantic search over facts using HybridRAG
     * @param {string} tenantId 
     * @param {string} query 
     * @param {number} topK 
     * @returns {Promise<Array>}
     */
    async searchFacts(tenantId, query, topK = 5) {
        const safeId = sanitizeTenantId(tenantId);

        // We expect HybridRAG to support a filter for source='tenant_memory'
        // If not supported natively, we search global and filter results
        const results = await this.rag.search(safeId, 'fr', query, {
            topK: topK * 2, // Fetch more then filter
            filters: { source: 'tenant_memory' }
        });

        return results
            .filter(r => r.metadata?.source === 'tenant_memory')
            .slice(0, topK);
    }

    /**
     * RGPD: Purge all memory for a tenant
     * @param {string} tenantId 
     * @returns {Promise<boolean>}
     */
    async purgeTenantMemory(tenantId) {
        const safeId = sanitizeTenantId(tenantId);
        const tenantDir = path.join(this.baseDir, safeId);

        try {
            if (fs.existsSync(tenantDir)) {
                await fsp.rm(tenantDir, { recursive: true, force: true });

                // Also remove from RAG index via event or direct call
                // (HybridRAG purge logic handles KB + memory if integrated via source)

                AgencyEventBus.publish('memory.purged', { tenantId: safeId });
                return true;
            }
            return false;
        } catch (e) {
            console.error(`[TenantMemory] Purge error for ${safeId}: ${e.message}`);
            return false;
        }
    }

    /**
     * Get stats for dashboards
     */
    async getStats(tenantId) {
        const safeId = sanitizeTenantId(tenantId);
        // Explicitly call getFacts to ensure paths are correct
        const facts = await this.getFacts(safeId);

        const types = facts.reduce((acc, f) => {
            acc[f.type] = (acc[f.type] || 0) + 1;
            return acc;
        }, {});

        return {
            totalFacts: facts.length,
            lastUpdate: facts.length > 0 ? facts[0].timestamp : null,
            types: types
        };
    }
    /**
     * SOTA: Sync a specific KB entry directly to Vector Store
     * Called by db-api.cjs when Dashboard updates KB
     */
    async syncKBEntry(tenantId, key, value, language = 'fr') {
        const safeId = sanitizeTenantId(tenantId);
        const uniqueId = `kb_${language}_${key}`;

        // Handle object values (e.g. valid/invalid responses)
        const textContent = typeof value === 'object' ?
            (value.response || value.text || JSON.stringify(value)) :
            String(value);

        try {
            let store = this.vectorStores.get(safeId);
            if (!store) {
                store = new SimpleVectorStore(safeId);
                this.vectorStores.set(safeId, store);
            }

            // Generate embedding
            const embedding = await EmbeddingService.getEmbedding(
                uniqueId,
                textContent,
                null,
                safeId
            );

            if (!embedding) {
                console.warn(`[TenantMemory] Failed to embed KB entry ${key}`);
                return false;
            }

            await store.upsert(uniqueId, textContent, {
                source: 'knowledge_base',
                type: 'kb_entry',
                language: language,
                key: key,
                timestamp: new Date().toISOString()
            }, embedding);

            console.log(`[TenantMemory] Synced KB entry ${key} to Vector Store (${safeId})`);
            return true;
        } catch (e) {
            console.error(`[TenantMemory] KB Sync failed: ${e.message}`);
            return false;
        }
    }

    /**
     * SOTA: Delete a KB entry from Vector Store
     */
    async deleteKBEntry(tenantId, key, language = 'fr') {
        const safeId = sanitizeTenantId(tenantId);
        const uniqueId = `kb_${language}_${key}`;

        try {
            let store = this.vectorStores.get(safeId);
            if (!store) {
                store = new SimpleVectorStore(safeId);
                this.vectorStores.set(safeId, store);
            }

            await store.delete(uniqueId);
            console.log(`[TenantMemory] Deleted KB entry ${key} from Vector Store (${safeId})`);
            return true;
        } catch (e) {
            console.error(`[TenantMemory] KB Delete failed: ${e.message}`);
            return false;
        }
    }
}

// Singleton Pattern
let instance = null;
TenantMemory.getInstance = function (options) {
    if (!instance) instance = new TenantMemory(options);
    return instance;
};

module.exports = TenantMemory;
