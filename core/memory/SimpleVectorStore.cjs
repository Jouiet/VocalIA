/**
 * SimpleVectorStore.cjs - SOTA Persistent Memory Architecture
 * 
 * Tech: SQLite (better-sqlite3) + JS-based Cosine Similarity
 * Goal: Replace fragile in-memory arrays with robust, ACID-compliant storage.
 * 
 * Features:
 * - Isolation: One DB file per tenant (`data/vectors/{tenantId}.db`).
 * - Performance: Synchronous I/O (faster than async for SQLite).
 * - Vectors: Stored as efficient BLOBs (Float32Array).
 * - Search: Exact match + Brute-force Cosine Similarity (fast < 100k items).
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data/vectors');

class SimpleVectorStore {
    constructor(tenantId) {
        if (!tenantId) throw new Error('SimpleVectorStore requires a tenantId');
        this.tenantId = tenantId.replace(/[^a-zA-Z0-9_-]/g, ''); // Sanitize
        this.dbPath = path.join(DATA_DIR, `${this.tenantId}.db`);
        this.db = null;

        this._ensureDir();
        this._initDB();
    }

    _ensureDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    _initDB() {
        this.db = new Database(this.dbPath);
        // Optimize for WAL mode (Write-Ahead Logging) - SOTA reliability
        this.db.pragma('journal_mode = WAL');

        // Create table if not exists
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS vectors (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                metadata JSON,
                embedding BLOB,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    /**
     * Add or Update a document with embedding
     * @param {string} id - Unique ID
     * @param {string} text - Content
     * @param {object} metadata - Extra info
     * @param {number[]} embedding - Vector (optional)
     */
    upsert(id, text, metadata = {}, embedding = null) {
        let buffer = null;
        if (embedding) {
            // Convert array to Float32Array then to Buffer
            buffer = Buffer.from(new Float32Array(embedding).buffer);
        }

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO vectors (id, text, metadata, embedding)
            VALUES (?, ?, ?, ?)
        `);

        return stmt.run(id, text, JSON.stringify(metadata), buffer);
    }

    /**
     * Get a document by ID
     */
    get(id) {
        const stmt = this.db.prepare('SELECT * FROM vectors WHERE id = ?');
        const row = stmt.get(id);
        if (!row) return null;
        return this._deserialize(row);
    }

    /**
     * Get ALL documents (for rebuilding BM25 or bulk ops)
     */
    getAll() {
        const stmt = this.db.prepare('SELECT * FROM vectors');
        const rows = stmt.all();
        return rows.map(r => this._deserialize(r));
    }

    /**
     * Vector Search (Cosine Similarity)
     * Limit: Practical up to ~50k vectors per tenant without index.
     */
    async search(queryVector, limit = 10) {
        if (!queryVector) throw new Error('Query vector required');

        // 1. Fetch all vectors (Fast via SQLite)
        const stmt = this.db.prepare('SELECT id, text, metadata, embedding FROM vectors WHERE embedding IS NOT NULL');
        const rows = stmt.all();

        // 2. Calculate Similarity (Async/Non-Blocking Check)
        // If dataset is small (<1000), do sync for speed. 
        // If large, chunk it to yield event loop (SOTA reliability).

        if (rows.length < 1000) {
            // Fast Path
            return this._searchSync(rows, queryVector, limit);
        } else {
            // SOTA Safety Path: Yield to Event Loop
            return await this._searchAsync(rows, queryVector, limit);
        }
    }

    _searchSync(rows, queryVector, limit) {
        const results = rows.map(row => {
            const vec = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
            const score = this._cosineSimilarity(queryVector, vec);
            return {
                id: row.id,
                text: row.text,
                metadata: JSON.parse(row.metadata),
                score
            };
        });
        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    async _searchAsync(rows, queryVector, limit) {
        const results = [];
        const CHUNK_SIZE = 1000;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const chunkResults = this._searchSync(chunk, queryVector, limit); // Reuse sync logic for chunk
            results.push(...chunkResults);

            // Yield to event loop
            await new Promise(resolve => setImmediate(resolve));
        }

        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    /**
     * Helper: Cosine Similarity
     */
    _cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0;
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Internal: Format row for output
     */
    _deserialize(row) {
        return {
            id: row.id,
            text: row.text,
            metadata: JSON.parse(row.metadata),
            embedding: row.embedding
                ? Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4))
                : null
        };
    }

    delete(id) {
        const stmt = this.db.prepare('DELETE FROM vectors WHERE id = ?');
        return stmt.run(id);
    }

    clear() {
        this.db.exec('DELETE FROM vectors');
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = SimpleVectorStore;
