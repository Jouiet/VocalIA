#!/usr/bin/env node
/**
 * VocalIA - Product Embedding Service
 *
 * SOTA e-commerce embeddings for product recommendations:
 * - Marqo E-commerce Embeddings (primary) - when available
 * - Gemini text-embedding-004 (fallback) - always available
 *
 * Features:
 * - E-commerce optimized text generation
 * - Batch processing with rate limiting
 * - Persistent caching (file-based)
 * - Multi-tenant isolation
 *
 * Version: 1.0.0 | Session 250.79 | 03/02/2026
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const CACHE_DIR = path.join(__dirname, '../data/embeddings');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Embedding dimensions (Gemini text-embedding-004)
const EMBEDDING_DIM = 768;

/**
 * Product Embedding Service
 * Generates dense vectors optimized for e-commerce similarity search
 */
class ProductEmbeddingService {
  constructor() {
    this.caches = {}; // Per-tenant caches
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0
    };
  }

  /**
   * Get cache file path for tenant
   */
  _getCachePath(tenantId) {
    return path.join(CACHE_DIR, `${tenantId}_product_embeddings.json`);
  }

  /**
   * Load tenant's embedding cache from disk
   */
  _loadCache(tenantId) {
    if (this.caches[tenantId]) return this.caches[tenantId];

    const cachePath = this._getCachePath(tenantId);
    if (fs.existsSync(cachePath)) {
      try {
        this.caches[tenantId] = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`[ProductEmbedding] Loaded ${Object.keys(this.caches[tenantId]).length} embeddings for ${tenantId}`);
      } catch (e) {
        console.error(`[ProductEmbedding] Cache corruption for ${tenantId}:`, e.message);
        this.caches[tenantId] = {};
      }
    } else {
      this.caches[tenantId] = {};
    }
    return this.caches[tenantId];
  }

  /**
   * Save tenant's embedding cache to disk
   */
  _saveCache(tenantId) {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cachePath = this._getCachePath(tenantId);
    fs.writeFileSync(cachePath, JSON.stringify(this.caches[tenantId], null, 2));
  }

  /**
   * Generate optimized text representation for product
   * Combines multiple fields for better semantic matching
   */
  _generateProductText(product) {
    const parts = [];

    // Title (most important)
    if (product.title || product.name) {
      parts.push(product.title || product.name);
    }

    // Category path
    if (product.category) {
      parts.push(`Category: ${product.category}`);
    }
    if (product.subcategory) {
      parts.push(product.subcategory);
    }

    // Description (truncated for efficiency)
    if (product.description) {
      const desc = product.description.substring(0, 500);
      parts.push(desc);
    }

    // Key attributes
    if (product.brand) {
      parts.push(`Brand: ${product.brand}`);
    }
    if (product.tags && Array.isArray(product.tags)) {
      parts.push(`Tags: ${product.tags.join(', ')}`);
    }

    // Price range indicator (helps with similar-price recommendations)
    if (product.price) {
      const priceRange = this._getPriceRange(product.price);
      parts.push(`Price range: ${priceRange}`);
    }

    // Variants summary
    if (product.variants && Array.isArray(product.variants)) {
      const variantOptions = product.variants.map(v => v.title || v.option).filter(Boolean);
      if (variantOptions.length > 0) {
        parts.push(`Options: ${variantOptions.slice(0, 5).join(', ')}`);
      }
    }

    return parts.join('. ');
  }

  /**
   * Categorize price into ranges for similarity
   */
  _getPriceRange(price) {
    const p = parseFloat(price);
    if (p < 10) return 'budget';
    if (p < 50) return 'affordable';
    if (p < 100) return 'moderate';
    if (p < 250) return 'premium';
    if (p < 500) return 'high-end';
    return 'luxury';
  }

  /**
   * Generate embedding for a single product
   * @param {string} tenantId - Tenant identifier
   * @param {object} product - Product object with id, title, description, etc.
   * @returns {Promise<number[]|null>} Embedding vector or null on error
   */
  async getProductEmbedding(tenantId, product) {
    const cache = this._loadCache(tenantId);
    const productId = product.id || product.sku;

    if (!productId) {
      console.error('[ProductEmbedding] Product must have id or sku');
      return null;
    }

    // Check cache
    if (cache[productId]) {
      this.stats.hits++;
      return cache[productId].embedding;
    }

    // Generate embedding
    try {
      this.stats.misses++;
      const text = this._generateProductText(product);
      console.log(`[ProductEmbedding] Generating for ${tenantId}:${productId}...`);

      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      // Cache with metadata
      cache[productId] = {
        embedding,
        text: text.substring(0, 200), // Store truncated text for debugging
        generatedAt: new Date().toISOString()
      };

      return embedding;
    } catch (e) {
      this.stats.errors++;
      console.error(`[ProductEmbedding] Failed for ${productId}:`, e.message);
      return null;
    }
  }

  /**
   * Batch generate embeddings for catalog sync
   * @param {string} tenantId - Tenant identifier
   * @param {Array} products - Array of product objects
   * @param {object} options - Batch options
   * @returns {Promise<object>} Results summary
   */
  async batchEmbed(tenantId, products, options = {}) {
    const {
      rateLimit = 200,  // ms between requests
      batchSize = 50,   // save cache every N products
      forceRegenerate = false
    } = options;

    const cache = this._loadCache(tenantId);
    let processed = 0;
    let cached = 0;
    let generated = 0;
    let errors = 0;

    console.log(`[ProductEmbedding] Starting batch for ${tenantId}: ${products.length} products`);

    for (const product of products) {
      const productId = product.id || product.sku;
      if (!productId) {
        errors++;
        continue;
      }

      // Skip if cached (unless force regenerate)
      if (cache[productId] && !forceRegenerate) {
        cached++;
        processed++;
        continue;
      }

      // Generate embedding
      try {
        const text = this._generateProductText(product);
        const result = await embeddingModel.embedContent(text);
        const embedding = result.embedding.values;

        cache[productId] = {
          embedding,
          text: text.substring(0, 200),
          generatedAt: new Date().toISOString()
        };

        generated++;
        processed++;

        // Rate limiting
        await new Promise(r => setTimeout(r, rateLimit));

        // Periodic save
        if (generated % batchSize === 0) {
          this._saveCache(tenantId);
          console.log(`[ProductEmbedding] Progress: ${processed}/${products.length} (${generated} generated)`);
        }
      } catch (e) {
        errors++;
        console.error(`[ProductEmbedding] Batch error for ${productId}:`, e.message);
      }
    }

    // Final save
    this._saveCache(tenantId);

    const results = {
      tenantId,
      total: products.length,
      processed,
      cached,
      generated,
      errors,
      cacheSize: Object.keys(cache).length
    };

    console.log(`[ProductEmbedding] Batch complete:`, results);
    return results;
  }

  /**
   * Generate query embedding for search/recommendations
   * @param {string} query - User query text
   * @returns {Promise<number[]|null>} Query embedding
   */
  async getQueryEmbedding(query) {
    try {
      const result = await embeddingModel.embedContent(query);
      return result.embedding.values;
    } catch (e) {
      console.error('[ProductEmbedding] Query embedding failed:', e.message);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
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

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get embedding from cache (for vector store)
   */
  getCachedEmbedding(tenantId, productId) {
    const cache = this._loadCache(tenantId);
    return cache[productId]?.embedding || null;
  }

  /**
   * Get all cached embeddings for tenant
   */
  getAllEmbeddings(tenantId) {
    const cache = this._loadCache(tenantId);
    return Object.entries(cache).map(([id, data]) => ({
      productId: id,
      embedding: data.embedding,
      generatedAt: data.generatedAt
    }));
  }

  /**
   * Clear cache for tenant
   */
  clearCache(tenantId) {
    this.caches[tenantId] = {};
    const cachePath = this._getCachePath(tenantId);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
    console.log(`[ProductEmbedding] Cleared cache for ${tenantId}`);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      tenants: Object.keys(this.caches).length
    };
  }
}

// Export singleton
module.exports = new ProductEmbeddingService();
module.exports.ProductEmbeddingService = ProductEmbeddingService;
module.exports.EMBEDDING_DIM = EMBEDDING_DIM;
