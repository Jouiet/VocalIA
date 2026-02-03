#!/usr/bin/env node
/**
 * VocalIA - AI Recommendation Service
 *
 * Comprehensive recommendation engine combining multiple algorithms:
 * - Content-Based Filtering (similar products via embeddings)
 * - Association Rules (frequently bought together)
 * - Personalized Recommendations (UCP-based)
 * - Re-ranking (LTV tiers, diversity, business rules)
 *
 * Voice-optimized responses for widget and telephony.
 *
 * Version: 1.0.0 | Session 250.79 | 03/02/2026
 */

const fs = require('fs');
const path = require('path');
const productEmbeddingService = require('./product-embedding-service.cjs');
const vectorStore = require('./vector-store.cjs');

// Association rules storage
const RULES_DIR = path.join(__dirname, '../data/recommendations');

/**
 * Association Rules Engine
 * Implements simplified Apriori for "Frequently Bought Together"
 */
class AssociationRulesEngine {
  constructor() {
    this.rules = {}; // tenantId -> { productId: [associatedProducts] }
  }

  /**
   * Load rules from disk
   */
  _loadRules(tenantId) {
    if (this.rules[tenantId]) return this.rules[tenantId];

    const rulesPath = path.join(RULES_DIR, `${tenantId}_association_rules.json`);
    if (fs.existsSync(rulesPath)) {
      try {
        this.rules[tenantId] = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      } catch (e) {
        console.error(`[AssociationRules] Failed to load for ${tenantId}:`, e.message);
        this.rules[tenantId] = { pairs: {}, lastUpdated: null };
      }
    } else {
      this.rules[tenantId] = { pairs: {}, lastUpdated: null };
    }
    return this.rules[tenantId];
  }

  /**
   * Save rules to disk
   */
  _saveRules(tenantId) {
    if (!fs.existsSync(RULES_DIR)) {
      fs.mkdirSync(RULES_DIR, { recursive: true });
    }
    const rulesPath = path.join(RULES_DIR, `${tenantId}_association_rules.json`);
    fs.writeFileSync(rulesPath, JSON.stringify(this.rules[tenantId], null, 2));
  }

  /**
   * Learn association rules from order history
   * @param {string} tenantId - Tenant identifier
   * @param {Array} orders - Array of orders, each with items array
   * @param {object} options - Learning options
   */
  learn(tenantId, orders, options = {}) {
    const {
      minSupport = 0.01,    // Minimum frequency (1%)
      minConfidence = 0.1,  // Minimum co-occurrence probability (10%)
      maxRulesPerProduct = 10
    } = options;

    const rules = this._loadRules(tenantId);
    const itemCounts = {};    // productId -> count
    const pairCounts = {};    // "A|B" -> count
    const totalOrders = orders.length;

    if (totalOrders < 10) {
      console.log(`[AssociationRules] Not enough orders for ${tenantId}: ${totalOrders}`);
      return { learned: 0 };
    }

    // Count individual items and pairs
    for (const order of orders) {
      const items = (order.items || order.line_items || [])
        .map(i => i.product_id || i.productId || i.sku)
        .filter(Boolean);

      // Count individual items
      for (const item of items) {
        itemCounts[item] = (itemCounts[item] || 0) + 1;
      }

      // Count pairs (combinations of 2)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const pair = [items[i], items[j]].sort().join('|');
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }
      }
    }

    // Generate rules with support and confidence filtering
    const pairs = {};
    let rulesCount = 0;

    for (const [pair, count] of Object.entries(pairCounts)) {
      const support = count / totalOrders;
      if (support < minSupport) continue;

      const [itemA, itemB] = pair.split('|');
      const countA = itemCounts[itemA] || 1;
      const countB = itemCounts[itemB] || 1;

      // Confidence: P(B|A) = P(A,B) / P(A)
      const confidenceAB = count / countA;
      const confidenceBA = count / countB;

      // Add bidirectional rules
      if (confidenceAB >= minConfidence) {
        if (!pairs[itemA]) pairs[itemA] = [];
        pairs[itemA].push({
          productId: itemB,
          support,
          confidence: confidenceAB,
          coOccurrences: count
        });
        rulesCount++;
      }

      if (confidenceBA >= minConfidence) {
        if (!pairs[itemB]) pairs[itemB] = [];
        pairs[itemB].push({
          productId: itemA,
          support,
          confidence: confidenceBA,
          coOccurrences: count
        });
        rulesCount++;
      }
    }

    // Sort and limit rules per product
    for (const productId of Object.keys(pairs)) {
      pairs[productId] = pairs[productId]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxRulesPerProduct);
    }

    // Update rules
    rules.pairs = pairs;
    rules.lastUpdated = new Date().toISOString();
    rules.stats = {
      totalOrders,
      uniqueProducts: Object.keys(itemCounts).length,
      rulesGenerated: rulesCount
    };

    this._saveRules(tenantId);
    console.log(`[AssociationRules] Learned ${rulesCount} rules for ${tenantId} from ${totalOrders} orders`);

    return {
      learned: rulesCount,
      products: Object.keys(pairs).length
    };
  }

  /**
   * Get frequently bought together products
   */
  getFrequentlyBoughtTogether(tenantId, productId, topK = 5) {
    const rules = this._loadRules(tenantId);
    const associations = rules.pairs[productId] || [];
    return associations.slice(0, topK);
  }

  /**
   * Get frequently bought together for multiple products (cart)
   */
  getCartRecommendations(tenantId, productIds, topK = 5) {
    const rules = this._loadRules(tenantId);
    const candidates = {};

    for (const productId of productIds) {
      const associations = rules.pairs[productId] || [];
      for (const assoc of associations) {
        // Skip if already in cart
        if (productIds.includes(assoc.productId)) continue;

        if (!candidates[assoc.productId]) {
          candidates[assoc.productId] = {
            productId: assoc.productId,
            score: 0,
            sources: 0
          };
        }
        candidates[assoc.productId].score += assoc.confidence;
        candidates[assoc.productId].sources++;
      }
    }

    return Object.values(candidates)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/**
 * Main Recommendation Service
 */
class RecommendationService {
  constructor() {
    this.associationEngine = new AssociationRulesEngine();
    this.userPreferences = {}; // In-memory user preference cache
  }

  /**
   * Initialize catalog embeddings and vector index
   * @param {string} tenantId - Tenant identifier
   * @param {Array} products - Product catalog
   */
  async initializeCatalog(tenantId, products) {
    console.log(`[RecommendationService] Initializing catalog for ${tenantId}: ${products.length} products`);

    // Generate embeddings
    const embedResult = await productEmbeddingService.batchEmbed(tenantId, products);

    // Build vector index
    const vectorItems = [];
    for (const product of products) {
      const productId = product.id || product.sku;
      const embedding = productEmbeddingService.getCachedEmbedding(tenantId, productId);

      if (embedding) {
        vectorItems.push({
          id: productId,
          vector: embedding,
          metadata: {
            category: product.category,
            subcategory: product.subcategory,
            price: parseFloat(product.price) || 0,
            brand: product.brand,
            inStock: product.inventory_quantity > 0 || product.available !== false,
            tags: product.tags
          }
        });
      }
    }

    const indexed = vectorStore.addBatch(tenantId, vectorItems);
    console.log(`[RecommendationService] Indexed ${indexed} products for ${tenantId}`);

    return {
      embedded: embedResult,
      indexed
    };
  }

  /**
   * Learn association rules from order history
   */
  async learnFromOrders(tenantId, orders, options = {}) {
    return this.associationEngine.learn(tenantId, orders, options);
  }

  /**
   * Get similar products (content-based filtering)
   * @param {string} tenantId - Tenant identifier
   * @param {string} productId - Source product ID
   * @param {object} options - Search options
   */
  async getSimilarProducts(tenantId, productId, options = {}) {
    const { topK = 6, filter = {} } = options;

    // Get similar via vector search
    const similar = vectorStore.findSimilar(tenantId, productId, topK, filter);

    return similar.map(item => ({
      productId: item.id,
      score: item.score,
      similarity: Math.round(item.score * 100),
      metadata: item.metadata,
      reason: 'similar_product'
    }));
  }

  /**
   * Get frequently bought together
   */
  async getFrequentlyBoughtTogether(tenantId, productId, topK = 4) {
    const associations = this.associationEngine.getFrequentlyBoughtTogether(tenantId, productId, topK);

    return associations.map(assoc => ({
      productId: assoc.productId,
      score: assoc.confidence,
      coOccurrences: assoc.coOccurrences,
      reason: 'frequently_bought_together'
    }));
  }

  /**
   * Get personalized recommendations for user
   * @param {string} tenantId - Tenant identifier
   * @param {string} userId - User identifier
   * @param {object} ucpProfile - User's UCP profile
   * @param {object} options - Recommendation options
   */
  async getPersonalizedRecommendations(tenantId, userId, ucpProfile = {}, options = {}) {
    const {
      topK = 10,
      diversityFactor = 0.3,
      recentlyViewed = [],
      recentlyPurchased = []
    } = options;

    const recommendations = [];

    // 1. Content-based from recently viewed
    if (recentlyViewed.length > 0) {
      const lastViewed = recentlyViewed[0];
      const similar = await this.getSimilarProducts(tenantId, lastViewed, { topK: 5 });
      recommendations.push(...similar.map(r => ({
        ...r,
        reason: 'based_on_viewed',
        sourceProduct: lastViewed
      })));
    }

    // 2. Association-based from purchase history
    if (recentlyPurchased.length > 0) {
      const cartRecs = this.associationEngine.getCartRecommendations(
        tenantId,
        recentlyPurchased,
        5
      );
      recommendations.push(...cartRecs.map(r => ({
        ...r,
        reason: 'based_on_purchases'
      })));
    }

    // 3. Category affinity (from UCP)
    if (ucpProfile.preferences?.categories?.length > 0) {
      const topCategory = ucpProfile.preferences.categories[0];
      const categoryResults = vectorStore.search(
        tenantId,
        null, // No query vector, just filter
        3,
        { category: topCategory }
      );
      // Note: This would need a category-based fallback since we can't search without vector
    }

    // Remove duplicates
    const seen = new Set();
    const unique = recommendations.filter(r => {
      if (seen.has(r.productId)) return false;
      seen.add(r.productId);
      return true;
    });

    // Apply LTV-based re-ranking
    const reranked = this._applyLTVReranking(unique, ucpProfile);

    // Apply diversity
    const diversified = this._applyDiversity(reranked, diversityFactor);

    return diversified.slice(0, topK);
  }

  /**
   * Re-rank recommendations based on LTV tier
   */
  _applyLTVReranking(recommendations, ucpProfile) {
    const ltvTier = ucpProfile.ltv_tier || 'bronze';

    // LTV-based boosts
    const tierBoosts = {
      diamond: { premiumBoost: 0.2, discountBoost: -0.1 },
      gold: { premiumBoost: 0.1, discountBoost: 0 },
      silver: { premiumBoost: 0, discountBoost: 0.1 },
      bronze: { premiumBoost: -0.1, discountBoost: 0.2 }
    };

    const boosts = tierBoosts[ltvTier] || tierBoosts.bronze;

    return recommendations.map(rec => {
      let adjustedScore = rec.score;

      // Boost premium products for high-LTV users
      if (rec.metadata?.price > 100) {
        adjustedScore += boosts.premiumBoost;
      }

      return { ...rec, score: adjustedScore };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Apply diversity to avoid too similar recommendations
   */
  _applyDiversity(recommendations, factor = 0.3) {
    if (factor === 0 || recommendations.length <= 1) {
      return recommendations;
    }

    const diversified = [recommendations[0]];
    const categories = new Set([recommendations[0].metadata?.category]);

    for (let i = 1; i < recommendations.length; i++) {
      const rec = recommendations[i];
      const category = rec.metadata?.category;

      // Penalize if same category already present
      if (categories.has(category)) {
        rec.score *= (1 - factor);
      } else {
        categories.add(category);
      }

      diversified.push(rec);
    }

    return diversified.sort((a, b) => b.score - a.score);
  }

  /**
   * Get voice-optimized recommendations
   * Returns natural language descriptions for voice output
   */
  async getVoiceRecommendations(tenantId, context = {}, lang = 'fr') {
    const {
      productId,
      productIds,
      userId,
      ucpProfile,
      type = 'similar' // 'similar', 'bought_together', 'personalized'
    } = context;

    let recommendations;

    switch (type) {
      case 'bought_together':
        if (productIds?.length) {
          recommendations = this.associationEngine.getCartRecommendations(tenantId, productIds, 3);
        } else if (productId) {
          recommendations = await this.getFrequentlyBoughtTogether(tenantId, productId, 3);
        }
        break;

      case 'personalized':
        if (userId) {
          recommendations = await this.getPersonalizedRecommendations(
            tenantId,
            userId,
            ucpProfile || {},
            { topK: 3 }
          );
        }
        break;

      case 'similar':
      default:
        if (productId) {
          recommendations = await this.getSimilarProducts(tenantId, productId, { topK: 3 });
        }
    }

    if (!recommendations?.length) {
      return this._getNoRecommendationsResponse(lang);
    }

    return this._formatVoiceResponse(recommendations, type, lang);
  }

  /**
   * Format recommendations for voice output
   */
  _formatVoiceResponse(recommendations, type, lang) {
    const intros = {
      fr: {
        similar: "Voici des produits similaires que vous pourriez aimer :",
        bought_together: "Les clients achètent souvent aussi :",
        personalized: "Basé sur vos préférences, je vous recommande :"
      },
      en: {
        similar: "Here are similar products you might like:",
        bought_together: "Customers often also buy:",
        personalized: "Based on your preferences, I recommend:"
      },
      es: {
        similar: "Aquí hay productos similares que podrían gustarte:",
        bought_together: "Los clientes también suelen comprar:",
        personalized: "Según tus preferencias, te recomiendo:"
      },
      ar: {
        similar: "إليك منتجات مشابهة قد تعجبك:",
        bought_together: "غالبًا ما يشتري العملاء أيضًا:",
        personalized: "بناءً على تفضيلاتك، أوصي بـ:"
      },
      ary: {
        similar: "ها شي منتوجات شابهين لي يمكن يعجبوك:",
        bought_together: "الزبناء كيشريو غالبا حتا:",
        personalized: "على حساب شنو كيعجبك، كنقترح عليك:"
      }
    };

    const intro = (intros[lang] || intros.fr)[type];

    return {
      text: intro,
      recommendations: recommendations.map((rec, i) => ({
        position: i + 1,
        productId: rec.productId,
        reason: rec.reason,
        score: rec.score
      })),
      voiceWidget: {
        action: 'show_carousel',
        items: recommendations.map(r => r.productId)
      }
    };
  }

  /**
   * No recommendations fallback response
   */
  _getNoRecommendationsResponse(lang) {
    const messages = {
      fr: "Je n'ai pas de recommandations spécifiques pour le moment. Puis-je vous aider autrement ?",
      en: "I don't have specific recommendations right now. Can I help you with something else?",
      es: "No tengo recomendaciones específicas en este momento. ¿Puedo ayudarte con algo más?",
      ar: "ليس لدي توصيات محددة حاليًا. هل يمكنني مساعدتك في شيء آخر؟",
      ary: "ما عنديش توصيات دابا. واش نقدر نعاونك فشي حاجة خرا?"
    };

    return {
      text: messages[lang] || messages.fr,
      recommendations: [],
      voiceWidget: null
    };
  }

  /**
   * Get service statistics
   */
  getStats(tenantId) {
    return {
      vectorStore: vectorStore.stats(tenantId),
      embeddingService: productEmbeddingService.getStats()
    };
  }
}

// Export singleton
module.exports = new RecommendationService();
module.exports.RecommendationService = RecommendationService;
module.exports.AssociationRulesEngine = AssociationRulesEngine;
