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
const { sanitizeTenantId } = require('./voice-api-utils.cjs');
const productEmbeddingService = require('./product-embedding-service.cjs');
const vectorStore = require('./vector-store.cjs');

// Association rules storage
const RULES_DIR = path.join(__dirname, '../data/recommendations');

/**
 * Persona-specific terminology for voice responses
 * Maps 38 personas to their specific domain terms
 */
const PERSONA_CONFIG = {
  // PRODUCTS
  RETAILER: { term_fr: 'produits', term_en: 'products', term_es: 'productos', term_ar: 'منتجات', term_ary: 'منتوجات' },
  UNIVERSAL_ECOMMERCE: { term_fr: 'produits', term_en: 'products', term_es: 'productos', term_ar: 'منتجات', term_ary: 'منتوجات' },
  GROCERY: { term_fr: 'articles', term_en: 'items', term_es: 'artículos', term_ar: 'سلع', term_ary: 'تقضية' },
  PHARMACIST: { term_fr: 'produits', term_en: 'products', term_es: 'productos', term_ar: 'منتجات', term_ary: 'دوايات/منتوجات' },
  PRODUCER: { term_fr: 'produits bio', term_en: 'organic products', term_es: 'productos bio', term_ar: 'منتجات عضوية', term_ary: 'منتوجات بيو' },
  BAKERY: { term_fr: 'gourmandises', term_en: 'treats', term_es: 'delicias', term_ar: 'مخبوزات', term_ary: 'شهيوات' },
  MANUFACTURER: { term_fr: 'articles', term_en: 'items', term_es: 'artículos', term_ar: 'عناصر', term_ary: 'سلعة' },

  // SERVICES
  AGENCY: { term_fr: 'solutions', term_en: 'solutions', term_es: 'soluciones', term_ar: 'حلول', term_ary: 'حلول' },
  UNIVERSAL_SME: { term_fr: 'services', term_en: 'services', term_es: 'servicios', term_ar: 'خدمات', term_ary: 'خدمات' },
  IT_SERVICES: { term_fr: 'solutions IT', term_en: 'IT solutions', term_es: 'soluciones TI', term_ar: 'حلول تقنية', term_ary: 'حلول تقنية' },
  CLEANER: { term_fr: 'formules', term_en: 'packages', term_es: 'paquetes', term_ar: 'باقات', term_ary: 'باك' },
  RECRUITER: { term_fr: 'offres', term_en: 'offers', term_es: 'ofertas', term_ar: 'عروض', term_ary: 'عروض' },
  DISPATCHER: { term_fr: 'options', term_en: 'options', term_es: 'opciones', term_ar: 'خيارات', term_ary: 'خيارات' },
  INSURER: { term_fr: 'contrats', term_en: 'policies', term_es: 'pólizas', term_ar: 'عقود', term_ary: 'عقود' },
  ACCOUNTANT: { term_fr: 'services', term_en: 'services', term_es: 'servicios', term_ar: 'خدمات', term_ary: 'خدمات' },
  NOTARY: { term_fr: 'services', term_en: 'services', term_es: 'servicios', term_ar: 'خدمات', term_ary: 'خدمات' },
  LOGISTICIAN: { term_fr: 'options', term_en: 'options', term_es: 'opciones', term_ar: 'خيارات', term_ary: 'خيارات' },
  CONSULTANT: { term_fr: 'services', term_en: 'services', term_es: 'servicios', term_ar: 'خدمات', term_ary: 'خدمات' },

  // CARE / HEALTH
  DENTAL: { term_fr: 'soins', term_en: 'treatments', term_es: 'tratamientos', term_ar: 'علاجات', term_ary: 'علاجات' },
  HEALER: { term_fr: 'soins', term_en: 'treatments', term_es: 'tratamientos', term_ar: 'علاجات', term_ary: 'علاجات' },
  DOCTOR: { term_fr: 'consultations', term_en: 'consultations', term_es: 'consultas', term_ar: 'استشارات', term_ary: 'استشارات' },
  SPECIALIST: { term_fr: 'soins', term_en: 'treatments', term_es: 'tratamientos', term_ar: 'علاجات', term_ary: 'علاجات' },
  STYLIST: { term_fr: 'soins', term_en: 'treatments', term_es: 'tratamientos', term_ar: 'علاجات', term_ary: 'علاجات' },
  GYM: { term_fr: 'abonnements', term_en: 'memberships', term_es: 'membresías', term_ar: 'اشتراكات', term_ary: 'اشتراكات' },

  // MENU
  RESTAURATEUR: { term_fr: 'plats', term_en: 'dishes', term_es: 'platos', term_ar: 'أطباق', term_ary: 'أطباق/شهيوات' },

  // TRIPS
  TRAVEL_AGENT: { term_fr: 'voyages', term_en: 'trips', term_es: 'viajes', term_ar: 'رحلات', term_ary: 'سفرات' },

  // VEHICLES / PROPERTY
  RENTER: { term_fr: 'véhicules', term_en: 'vehicles', term_es: 'vehículos', term_ar: 'مركبات', term_ary: 'طوموبيلات' },
  REAL_ESTATE_AGENT: { term_fr: 'biens', term_en: 'properties', term_es: 'propiedades', term_ar: 'عقارات', term_ary: 'عقارات' },
  PROPERTY: { term_fr: 'services', term_en: 'services', term_es: 'servicios', term_ar: 'خدمات', term_ary: 'خدمات' },

  // PROJECTS
  ARCHITECT: { term_fr: 'projets', term_en: 'projects', term_es: 'proyectos', term_ar: 'مشاريع', term_ary: 'مشاريع' },
  BUILDER: { term_fr: 'projets', term_en: 'projects', term_es: 'proyectos', term_ar: 'مشاريع', term_ary: 'مشاريع' },
  CONTRACTOR: { term_fr: 'solutions', term_en: 'solutions', term_es: 'soluciones', term_ar: 'حلول', term_ary: 'حلول' },
  PLANNER: { term_fr: 'concepts', term_en: 'concepts', term_es: 'conceptos', term_ar: 'مفاهيم', term_ary: 'أفكار' },
  CONCIERGE: { term_fr: 'activités', term_en: 'activities', term_es: 'actividades', term_ar: 'أنشطة', term_ary: 'أنشطة' }
};

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

    const rulesPath = path.join(RULES_DIR, `${sanitizeTenantId(tenantId)}_association_rules.json`);
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
    const rulesPath = path.join(RULES_DIR, `${sanitizeTenantId(tenantId)}_association_rules.json`);
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

    // Count individual items and pairs with MENA-specific filtering
    for (const order of orders) {
      // SOTA: COD Resilience - Filter out cancelled or refunded orders (high in MENA market)
      const isCancelled = ['cancelled', 'voided', 'refunded', 'returned'].includes(order.status?.toLowerCase() || order.fulfillment_status?.toLowerCase());
      if (isCancelled) continue;

      const items = (order.items || order.line_items || [])
        .map(i => ({
          id: i.product_id || i.productId || i.sku,
          category: i.category || i.type || 'general'
        }))
        .filter(i => i.id);

      // Count individual items
      for (const item of items) {
        itemCounts[item.id] = (itemCounts[item.id] || 0) + 1;
      }

      // Count pairs (combinations of 2)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const itemA = items[i];
          const itemB = items[j];
          const pair = [itemA.id, itemB.id].sort().join('|');

          // SOTA: Category-Aware Bundling ("Bakata" logic)
          // Boost support for complementary categories (e.g. Phone + Protection)
          let weight = 1;
          const catA = itemA.category.toLowerCase();
          const catB = itemB.category.toLowerCase();

          if (this._isComplementary(catA, catB)) {
            weight = 1.5; // 50% boost for logical bundles
          }

          pairCounts[pair] = (pairCounts[pair] || 0) + weight;
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
          confidence: Math.min(1.0, confidenceAB),
          coOccurrences: count,
          isHighConfidence: confidenceAB > 0.6 // SOTA: Tag "Must-Buy" pairs
        });
        rulesCount++;
      }

      if (confidenceBA >= minConfidence) {
        if (!pairs[itemB]) pairs[itemB] = [];
        pairs[itemB].push({
          productId: itemA,
          support,
          confidence: Math.min(1.0, confidenceBA),
          coOccurrences: count,
          isHighConfidence: confidenceBA > 0.6
        });
        rulesCount++;
      }
    }

    // Sort and limit rules per product
    for (const productId of Object.keys(pairs)) {
      pairs[productId] = pairs[productId]
        .sort((a, b) => {
          // Boost high-confidence rules in sorting
          const scoreA = a.confidence + (a.isHighConfidence ? 0.5 : 0);
          const scoreB = b.confidence + (b.isHighConfidence ? 0.5 : 0);
          return scoreB - scoreA;
        })
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

  /**
   * SOTA: Complementary category detection
   * In the MENA market, bundling (Bakata) is a key conversion driver.
   */
  _isComplementary(catA, catB) {
    const complementary = [
      ['phone', 'protection'],
      ['phone', 'accessory'],
      ['laptop', 'mouse'],
      ['laptop', 'bag'],
      ['shoes', 'socks'],
      ['dress', 'accessory'],
      ['beauty', 'skincare'],
      ['gaming', 'controller']
    ];

    return complementary.some(([c1, c2]) =>
      (catA.includes(c1) && catB.includes(c2)) ||
      (catA.includes(c2) && catB.includes(c1))
    );
  }
}

/**
 * Main Recommendation Service
 */
class RecommendationService {
  constructor() {
    this.associationEngine = new AssociationRulesEngine();
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

    // 0. SOTA: Two-Tower Retrieval
    // Generate a semantic "User Query" based on profile and history
    const userQuery = this._generateUserQuery(ucpProfile, recentlyViewed, recentlyPurchased);
    const userEmbedding = await productEmbeddingService.getQueryEmbedding(userQuery);

    if (userEmbedding) {
      const vectorRecs = vectorStore.search(tenantId, userEmbedding, 5);
      recommendations.push(...vectorRecs.map(r => ({
        productId: r.id,
        score: r.score * 1.2, // Boosted Two-Tower signal
        similarity: Math.round(r.score * 100),
        metadata: r.metadata,
        reason: 'two_tower_match'
      })));
    }

    // 1. Content-based from recently viewed
    if (recentlyViewed.length > 0) {
      const lastViewed = recentlyViewed[0];
      const similar = await this.getSimilarProducts(tenantId, lastViewed, { topK: 3 });
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
        3
      );
      recommendations.push(...cartRecs.map(r => ({
        ...r,
        reason: 'based_on_purchases'
      })));
    }

    // 3. Category affinity (from UCP)
    if (ucpProfile.preferences?.categories?.length > 0) {
      const topCategory = ucpProfile.preferences.categories[0];
      const categoryResults = vectorStore.queryByFilter(
        tenantId,
        3,
        { category: topCategory }
      );

      recommendations.push(...categoryResults.map(r => ({
        productId: r.id,
        score: r.score * 0.5, // Lower weight for category match
        similarity: 50,
        metadata: r.metadata,
        reason: 'category_affinity'
      })));
    }

    // Remove duplicates
    const seen = new Map();
    const unique = [];

    for (const rec of recommendations) {
      if (!seen.has(rec.productId) || seen.get(rec.productId).score < rec.score) {
        seen.set(rec.productId, rec);
      }
    }

    unique.push(...seen.values());

    // Apply LTV-based re-ranking
    const reranked = this._applyLTVReranking(unique, ucpProfile);

    // Apply diversity
    const diversified = this._applyDiversity(reranked, diversityFactor);

    return diversified.slice(0, topK);
  }

  /**
   * SOTA: Generate a semantic query representating the user's current interests
   * This is the "User Tower" in the Two-Tower retrieval logic.
   */
  _generateUserQuery(ucpProfile, recentlyViewed, recentlyPurchased) {
    const parts = [];

    // LTV and Segment
    if (ucpProfile.ltv_tier) {
      parts.push(`${ucpProfile.ltv_tier} customer`);
    }

    // Preferences
    if (ucpProfile.preferences?.categories?.length) {
      parts.push(`interested in ${ucpProfile.preferences.categories.slice(0, 3).join(', ')}`);
    }

    // Market/Language context
    if (ucpProfile.language) {
      parts.push(`market: ${ucpProfile.language}`);
    }

    // Session Context (if we have descriptions of recently viewed, we'd add them here)
    // For now we use the fact that they viewed/bought recently
    if (recentlyPurchased.length) {
      parts.push(`recently bought products like ${recentlyPurchased.slice(0, 2).join(', ')}`);
    }

    return parts.join('. ');
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
      type = 'similar', // 'similar', 'bought_together', 'personalized'
      persona = 'UNIVERSAL_ECOMMERCE' // Default to ecommerce if not specified
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

    // Determine terminology based on persona
    const terminology = PERSONA_CONFIG[persona] || PERSONA_CONFIG.UNIVERSAL_ECOMMERCE;
    const term = terminology[`term_${lang}`] || terminology.term_fr;

    return this._formatVoiceResponse(recommendations, type, lang, term);
  }

  /**
   * Format recommendations for voice output
   */
  _formatVoiceResponse(recommendations, type, lang, term = 'items') {
    const intros = {
      fr: {
        similar: `Voici des ${term} similaires qui pourraient vous intéresser :`,
        bought_together: `Souvent choisis ensemble :`,
        personalized: `Selon vos préférences, je vous suggère ces ${term} :`
      },
      en: {
        similar: `Here are similar ${term} you might like:`,
        bought_together: `Often selected together:`,
        personalized: `Based on your preferences, I suggest these ${term}:`
      },
      es: {
        similar: `Aquí hay ${term} similares que podrían interesarte:`,
        bought_together: `A menudo seleccionados juntos:`,
        personalized: `Según tus preferencias, sugiero estos ${term}:`
      },
      ar: {
        similar: `إليك ${term} مماثلة قد تهمك:`,
        bought_together: `غالبًا ما يتم اختيارها معًا:`,
        personalized: `بناءً على تفضيلاتك، أقترح هذه ال${term}:`
      },
      ary: {
        similar: `ها شي ${term} فحال هادشي لي يقدر يعجبك:`,
        bought_together: `غالبا كيختارو هادشي مجموع:`,
        personalized: `على حساب شنو كيعجبك، كنقترح عليك هاد ال${term}:`
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
   * Get recommendation action for voice widget (SOTA)
   * Session 250.82: Standardized action wrapper for multi-channel reuse
   */
  async getRecommendationAction(tenantId, personaKey, query, lang = 'fr') {
    // 1. Get personalized recommendations
    const recommendations = await this.getPersonalizedRecommendations(tenantId, 'voice_user', { lastQuery: query });

    // 2. Format with persona-specific terminology
    if (recommendations && recommendations.length > 0) {
      return this.getVoiceRecommendations(tenantId, { recommendations, type: 'personalized', persona: personaKey }, lang);
    }

    return this._getNoRecommendationsResponse(lang);
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
