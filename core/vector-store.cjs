#!/usr/bin/env node
/**
 * VocalIA - Vector Store
 *
 * In-memory vector store with HNSW-like indexing for fast similarity search.
 * Redis-compatible interface for future migration to Redis Vector Search.
 *
 * Features:
 * - Multi-tenant isolation
 * - Approximate nearest neighbor (ANN) search
 * - Metadata filtering
 * - Persistent storage (file-based)
 * - LRU eviction for memory management
 *
 * Version: 1.0.0 | Session 250.79 | 03/02/2026
 */

const fs = require('fs');
const path = require('path');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

const STORE_DIR = path.join(__dirname, '../data/vector-store');

/**
 * Simple HNSW-like index for approximate nearest neighbor search
 * (Simplified version - uses flat search with early termination for smaller catalogs)
 */
class VectorIndex {
  constructor(options = {}) {
    this.vectors = new Map(); // productId -> { vector, metadata }
    this.dimension = options.dimension || 768;
    this.maxElements = options.maxElements || 100000;
  }

  /**
   * Add or update a vector
   */
  add(id, vector, metadata = {}) {
    if (!vector || vector.length !== this.dimension) {
      throw new Error(`Vector must have ${this.dimension} dimensions`);
    }

    this.vectors.set(id, {
      vector: Float32Array.from(vector), // Memory efficient
      metadata,
      addedAt: Date.now()
    });

    // LRU eviction if over capacity
    if (this.vectors.size > this.maxElements) {
      const oldest = [...this.vectors.entries()]
        .sort((a, b) => a[1].addedAt - b[1].addedAt)[0];
      this.vectors.delete(oldest[0]);
    }
  }

  /**
   * Remove a vector
   */
  remove(id) {
    return this.vectors.delete(id);
  }

  /**
   * Check if vector exists
   */
  has(id) {
    return this.vectors.has(id);
  }

  /**
   * Get vector by ID
   */
  get(id) {
    return this.vectors.get(id);
  }

  /**
   * Search for nearest neighbors
   * @param {number[]} queryVector - Query vector
   * @param {number} topK - Number of results
   * @param {object} filter - Metadata filters
   * @returns {Array} Sorted results with scores
   */
  search(queryVector, topK = 10, filter = {}) {
    if (!queryVector || queryVector.length !== this.dimension) {
      return [];
    }

    const results = [];
    const queryVec = Float32Array.from(queryVector);

    for (const [id, data] of this.vectors) {
      // Apply metadata filters
      if (!this._matchesFilter(data.metadata, filter)) {
        continue;
      }

      const score = this._cosineSimilarity(queryVec, data.vector);
      results.push({
        id,
        score,
        metadata: data.metadata
      });
    }

    // Sort by score descending and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Query items by metadata filter (no vector needed)
   */
  queryByFilter(topK = 10, filter = {}) {
    const results = [];
    for (const [id, data] of this.vectors) {
      if (this._matchesFilter(data.metadata, filter)) {
        results.push({
          id,
          score: 1.0, // Base score for filter match
          metadata: data.metadata
        });
      }
      if (results.length >= topK * 2) break; // Optimization: stop after collecting enough candidates
    }
    return results.slice(0, topK);
  }

  /**
   * Check if metadata matches filter criteria
   */
  _matchesFilter(metadata, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        // Array filter: metadata value must be in array
        if (!value.includes(metadata[key])) return false;
      } else if (typeof value === 'object' && value !== null) {
        // Range filter: { $gte: X, $lte: Y }
        const metaValue = metadata[key];
        if (value.$gte !== undefined && metaValue < value.$gte) return false;
        if (value.$lte !== undefined && metaValue > value.$lte) return false;
        if (value.$gt !== undefined && metaValue <= value.$gt) return false;
        if (value.$lt !== undefined && metaValue >= value.$lt) return false;
        if (value.$ne !== undefined && metaValue === value.$ne) return false;
      } else {
        // Exact match
        if (metadata[key] !== value) return false;
      }
    }
    return true;
  }

  /**
   * Optimized cosine similarity for Float32Arrays
   */
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get index statistics
   */
  stats() {
    return {
      size: this.vectors.size,
      dimension: this.dimension,
      maxElements: this.maxElements,
      memoryEstimate: this.vectors.size * this.dimension * 4 // bytes (Float32)
    };
  }

  /**
   * Serialize index for persistence
   */
  serialize() {
    const data = {};
    for (const [id, item] of this.vectors) {
      data[id] = {
        vector: Array.from(item.vector),
        metadata: item.metadata,
        addedAt: item.addedAt
      };
    }
    return data;
  }

  /**
   * Deserialize index from saved data
   */
  deserialize(data) {
    this.vectors.clear();
    for (const [id, item] of Object.entries(data)) {
      this.vectors.set(id, {
        vector: Float32Array.from(item.vector),
        metadata: item.metadata,
        addedAt: item.addedAt || Date.now()
      });
    }
  }

  /**
   * Clear all vectors
   */
  clear() {
    this.vectors.clear();
  }
}

/**
 * Multi-tenant Vector Store
 */
const MAX_VECTOR_TENANTS = 50;

class VectorStore {
  constructor() {
    this.indices = {}; // tenantId -> VectorIndex
  }

  /**
   * Get or create index for tenant
   */
  _getIndex(tenantId) {
    if (!this.indices[tenantId]) {
      // LRU eviction
      const keys = Object.keys(this.indices);
      if (keys.length >= MAX_VECTOR_TENANTS) {
        delete this.indices[keys[0]];
      }
      this.indices[tenantId] = new VectorIndex();
      this._loadIndex(tenantId);
    }
    return this.indices[tenantId];
  }

  /**
   * Get store file path for tenant
   */
  _getStorePath(tenantId) {
    return path.join(STORE_DIR, `${sanitizeTenantId(tenantId)}_vectors.json`);
  }

  /**
   * Load index from disk
   */
  _loadIndex(tenantId) {
    const storePath = this._getStorePath(tenantId);
    if (fs.existsSync(storePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        this.indices[tenantId].deserialize(data);
        console.log(`[VectorStore] Loaded ${this.indices[tenantId].vectors.size} vectors for ${tenantId}`);
      } catch (e) {
        console.error(`[VectorStore] Failed to load index for ${tenantId}:`, e.message);
      }
    }
  }

  /**
   * Save index to disk
   */
  _saveIndex(tenantId) {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    const storePath = this._getStorePath(tenantId);
    const data = this.indices[tenantId].serialize();
    fs.writeFileSync(storePath, JSON.stringify(data));
  }

  /**
   * Add vector to store
   * @param {string} tenantId - Tenant identifier
   * @param {string} productId - Product identifier
   * @param {number[]} vector - Embedding vector
   * @param {object} metadata - Product metadata (category, price, etc.)
   */
  add(tenantId, productId, vector, metadata = {}) {
    const index = this._getIndex(tenantId);
    index.add(productId, vector, metadata);
  }

  /**
   * Batch add vectors
   */
  addBatch(tenantId, items) {
    const index = this._getIndex(tenantId);
    for (const item of items) {
      index.add(item.id, item.vector, item.metadata || {});
    }
    this._saveIndex(tenantId);
    return items.length;
  }

  /**
   * Remove vector from store
   */
  remove(tenantId, productId) {
    const index = this._getIndex(tenantId);
    return index.remove(productId);
  }

  /**
   * Search for similar vectors
   * @param {string} tenantId - Tenant identifier
   * @param {number[]} queryVector - Query embedding
   * @param {number} topK - Number of results
   * @param {object} filter - Metadata filters
   * @returns {Array} Similar items with scores
   */
  search(tenantId, queryVector, topK = 10, filter = {}) {
    const index = this._getIndex(tenantId);
    return index.search(queryVector, topK, filter);
  }

  /**
   * Query by filter only
   */
  queryByFilter(tenantId, topK = 10, filter = {}) {
    const index = this._getIndex(tenantId);
    return index.queryByFilter(topK, filter);
  }

  /**
   * Find similar products by product ID
   * @param {string} tenantId - Tenant identifier
   * @param {string} productId - Source product ID
   * @param {number} topK - Number of results
   * @param {object} filter - Metadata filters
   * @returns {Array} Similar products (excludes source)
   */
  findSimilar(tenantId, productId, topK = 10, filter = {}) {
    const index = this._getIndex(tenantId);
    const source = index.get(productId);

    if (!source) {
      console.warn(`[VectorStore] Product not found: ${productId}`);
      return [];
    }

    // Exclude source product from results
    const results = index.search(source.vector, topK + 1, filter);
    return results.filter(r => r.id !== productId).slice(0, topK);
  }

  /**
   * Check if product exists in store
   */
  has(tenantId, productId) {
    const index = this._getIndex(tenantId);
    return index.has(productId);
  }

  /**
   * Get store statistics for tenant
   */
  stats(tenantId) {
    const index = this._getIndex(tenantId);
    return index.stats();
  }

  /**
   * Save all indices to disk
   */
  saveAll() {
    for (const tenantId of Object.keys(this.indices)) {
      this._saveIndex(tenantId);
    }
  }

  /**
   * Clear store for tenant
   */
  clear(tenantId) {
    if (this.indices[tenantId]) {
      this.indices[tenantId].clear();
      const storePath = this._getStorePath(tenantId);
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
      }
    }
  }

  /**
   * Get global statistics
   */
  globalStats() {
    const stats = {
      tenants: Object.keys(this.indices).length,
      totalVectors: 0,
      totalMemory: 0
    };

    for (const tenantId of Object.keys(this.indices)) {
      const tenantStats = this.stats(tenantId);
      stats.totalVectors += tenantStats.size;
      stats.totalMemory += tenantStats.memoryEstimate;
    }

    return stats;
  }
}

// Export singleton
const vectorStore = new VectorStore();

// Auto-save on process exit
process.on('beforeExit', () => {
  vectorStore.saveAll();
});

module.exports = vectorStore;
module.exports.VectorStore = VectorStore;
module.exports.VectorIndex = VectorIndex;
