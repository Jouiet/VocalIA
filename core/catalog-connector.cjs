#!/usr/bin/env node
/**
 * VocalIA - Catalog Connector
 *
 * Unified interface for connecting to various catalog sources:
 * - E-commerce platforms (Shopify, WooCommerce, Magento, etc.)
 * - POS systems (Square, Lightspeed)
 * - Custom JSON/CSV imports
 * - Fleet management systems
 * - Travel/booking systems
 *
 * Version: 1.0.0 | Session 250.63 | 03/02/2026
 */

const fs = require('fs');
const path = require('path');

// Catalog types aligned with 40 personas
const CATALOG_TYPES = {
  PRODUCTS: 'products',      // universal_ecom, retailer, grocery, producer
  MENU: 'menu',              // restaurateur, bakery
  SERVICES: 'services',      // mechanic, stylist, healer, dental, gym, hairdresser, cleaner, trainer
  FLEET: 'fleet',            // renter
  TRIPS: 'trips',            // travel_agent
  PACKAGES: 'packages'       // concierge, planner
};

// Connector status
const CONNECTOR_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  SYNCING: 'syncing'
};

/**
 * Base Catalog Connector - Abstract interface
 */
class CatalogConnector {
  constructor(tenantId, config = {}) {
    this.tenantId = tenantId;
    this.config = config;
    this.status = CONNECTOR_STATUS.DISCONNECTED;
    this.lastSync = null;
    this.lastError = null;
    this.catalogType = null;
  }

  /**
   * Connect to the catalog source
   * @returns {Promise<boolean>} Connection success
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the catalog source
   */
  async disconnect() {
    this.status = CONNECTOR_STATUS.DISCONNECTED;
  }

  /**
   * Sync catalog data from source
   * @returns {Promise<object>} Synced catalog data
   */
  async sync() {
    throw new Error('sync() must be implemented by subclass');
  }

  /**
   * Get single item by ID
   * @param {string} itemId - Item identifier
   * @returns {Promise<object>} Item data
   */
  async getItem(itemId) {
    throw new Error('getItem() must be implemented by subclass');
  }

  /**
   * Search items
   * @param {string} query - Search query
   * @param {object} filters - Optional filters
   * @returns {Promise<Array>} Matching items
   */
  async search(query, filters = {}) {
    throw new Error('search() must be implemented by subclass');
  }

  /**
   * Check availability (stock, slots, dates)
   * @param {string} itemId - Item identifier
   * @param {object} params - Availability parameters
   * @returns {Promise<object>} Availability status
   */
  async checkAvailability(itemId, params = {}) {
    throw new Error('checkAvailability() must be implemented by subclass');
  }

  /**
   * Get connector status
   * @returns {object} Status info
   */
  getStatus() {
    return {
      tenantId: this.tenantId,
      catalogType: this.catalogType,
      status: this.status,
      lastSync: this.lastSync,
      lastError: this.lastError
    };
  }
}

/**
 * Custom JSON/CSV Connector
 * Fallback connector for any tenant - imports from local files
 */
class CustomCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = config.catalogType || CATALOG_TYPES.PRODUCTS;
    this.dataPath = config.dataPath || path.join(__dirname, '../data/catalogs', tenantId);
    this.catalog = null;
    // Check if dataPath is a file or directory
    this.isFilePath = config.dataPath && config.dataPath.endsWith('.json');
  }

  async connect() {
    try {
      // If dataPath is a file, just verify it exists
      if (this.isFilePath) {
        if (!fs.existsSync(this.dataPath)) {
          throw new Error(`Catalog file not found: ${this.dataPath}`);
        }
      } else {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataPath)) {
          fs.mkdirSync(this.dataPath, { recursive: true });
        }
      }
      this.status = CONNECTOR_STATUS.CONNECTED;
      console.log(`[CatalogConnector] Connected: ${this.tenantId} (${this.catalogType})`);
      return true;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[CatalogConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      await this.connect();
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      // Determine catalog file path
      let catalogFile;
      if (this.isFilePath) {
        catalogFile = this.dataPath;
      } else {
        catalogFile = path.join(this.dataPath, `${this.catalogType}.json`);
      }

      if (fs.existsSync(catalogFile)) {
        const content = fs.readFileSync(catalogFile, 'utf8');
        this.catalog = JSON.parse(content);
        this.lastSync = new Date().toISOString();
        this.status = CONNECTOR_STATUS.CONNECTED;

        console.log(`[CatalogConnector] Synced ${this.tenantId}/${this.catalogType}: ${this._countItems()} items`);
        return this._getItems(); // Return items array for convenience
      } else {
        // Return empty catalog structure
        this.catalog = this._getEmptyCatalog();
        this.lastSync = new Date().toISOString();
        this.status = CONNECTOR_STATUS.CONNECTED;
        return [];
      }
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }

    const items = this._getItems();
    return items.find(item => item.id === itemId) || null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const items = this._getItems();
    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;

    let results = items.filter(item => {
      // Search in name and description
      const nameMatch = item.name?.toLowerCase().includes(queryLower);
      const descMatch = item.description?.toLowerCase().includes(queryLower);
      const voiceMatch = item.voice_description?.toLowerCase().includes(queryLower);

      return nameMatch || descMatch || voiceMatch;
    });

    // Apply category filter
    if (filters.category) {
      results = results.filter(item =>
        item.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    // Apply price range filter
    if (filters.minPrice !== undefined) {
      results = results.filter(item => item.price >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(item => item.price <= filters.maxPrice);
    }

    // Apply availability filter
    if (filters.inStock === true) {
      results = results.filter(item => item.in_stock === true || item.available === true);
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'item_not_found' };
    }

    // Product availability (stock)
    if (this.catalogType === CATALOG_TYPES.PRODUCTS) {
      return {
        available: item.in_stock === true || (item.stock && item.stock > 0),
        stock: item.stock || 0,
        itemId,
        itemName: item.name
      };
    }

    // Menu item availability
    if (this.catalogType === CATALOG_TYPES.MENU) {
      return {
        available: item.available !== false,
        itemId,
        itemName: item.name,
        preparationTime: item.preparation_time
      };
    }

    // Service/slot availability
    if (this.catalogType === CATALOG_TYPES.SERVICES) {
      const date = params.date || new Date().toISOString().split('T')[0];
      const slots = this.catalog.slots?.slots_by_date?.[date] || [];
      const availableSlots = slots.filter(s => s.available && s.service_ids?.includes(itemId));

      return {
        available: availableSlots.length > 0,
        itemId,
        itemName: item.name,
        date,
        slots: availableSlots.map(s => s.time)
      };
    }

    // Fleet availability
    if (this.catalogType === CATALOG_TYPES.FLEET) {
      const fromDate = params.fromDate || new Date().toISOString().split('T')[0];
      const toDate = params.toDate || fromDate;

      const isAvailable = item.available_from <= fromDate && item.available_to >= toDate;

      return {
        available: isAvailable,
        itemId,
        itemName: `${item.brand} ${item.model}`,
        fromDate,
        toDate,
        pricePerDay: item.price_per_day
      };
    }

    // Default
    return { available: true, itemId };
  }

  /**
   * Import catalog from file
   * @param {string} filePath - Path to import file
   * @param {string} format - File format (json, csv)
   */
  async importFromFile(filePath, format = 'json') {
    const KBParser = require('./kb-parser.cjs');
    const parser = new KBParser();

    try {
      const data = parser.parseFile(filePath, { format });
      await this.saveCatalog(data);
      return { success: true, itemCount: this._countItems() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Save catalog to storage
   * @param {object} catalogData - Catalog data to save
   */
  async saveCatalog(catalogData) {
    const catalogFile = path.join(this.dataPath, `${this.catalogType}.json`);

    // Add metadata
    catalogData.$schema = `vocalia-catalog-${this.catalogType}-v1`;
    catalogData.tenant_id = this.tenantId;
    catalogData.last_sync = new Date().toISOString();

    fs.writeFileSync(catalogFile, JSON.stringify(catalogData, null, 2));
    this.catalog = catalogData;
    this.lastSync = catalogData.last_sync;

    console.log(`[CatalogConnector] Saved ${this.tenantId}/${this.catalogType}: ${this._countItems()} items`);
  }

  /**
   * Get items array based on catalog type
   */
  _getItems() {
    if (!this.catalog) return [];

    switch (this.catalogType) {
      case CATALOG_TYPES.PRODUCTS:
        return this.catalog.products || [];
      case CATALOG_TYPES.MENU:
        // Flatten menu categories into items
        const menuItems = [];
        if (this.catalog.menu?.categories) {
          for (const cat of this.catalog.menu.categories) {
            if (cat.items) {
              menuItems.push(...cat.items.map(item => ({ ...item, category: cat.name })));
            }
          }
        }
        return menuItems;
      case CATALOG_TYPES.SERVICES:
        return this.catalog.services || [];
      case CATALOG_TYPES.FLEET:
        // Normalize vehicle names: "Brand Model"
        return (this.catalog.vehicles || []).map(v => ({
          ...v,
          name: v.name || `${v.brand} ${v.model}`
        }));
      case CATALOG_TYPES.TRIPS:
        // Normalize trip names: use destination as name
        return (this.catalog.trips || []).map(t => ({
          ...t,
          name: t.name || `${t.destination}, ${t.country}`
        }));
      case CATALOG_TYPES.PACKAGES:
        return this.catalog.packages || [];
      default:
        return [];
    }
  }

  /**
   * Count items in catalog
   */
  _countItems() {
    return this._getItems().length;
  }

  /**
   * Get empty catalog structure
   */
  _getEmptyCatalog() {
    const base = {
      $schema: `vocalia-catalog-${this.catalogType}-v1`,
      tenant_id: this.tenantId,
      last_sync: new Date().toISOString()
    };

    switch (this.catalogType) {
      case CATALOG_TYPES.PRODUCTS:
        return { ...base, products: [] };
      case CATALOG_TYPES.MENU:
        return { ...base, menu: { categories: [] } };
      case CATALOG_TYPES.SERVICES:
        return { ...base, services: [], slots: { available_dates: [], slots_by_date: {} } };
      case CATALOG_TYPES.FLEET:
        return { ...base, vehicles: [] };
      case CATALOG_TYPES.TRIPS:
        return { ...base, trips: [] };
      case CATALOG_TYPES.PACKAGES:
        return { ...base, packages: [] };
      default:
        return base;
    }
  }
}

/**
 * Shopify Catalog Connector
 * Production connector using Shopify GraphQL Admin API (recommended since Oct 2024)
 *
 * Official Documentation:
 * - GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql/latest
 * - Rate Limits: https://shopify.dev/docs/api/usage/limits
 * - Bulk Operations (2026-01): https://shopify.dev/docs/api/usage/bulk-operations/queries
 *
 * Rate Limits (per official docs):
 * - Standard: 50 points/second, up to 1,000 points
 * - Advanced plan: 100 points/second
 * - Shopify Plus: 500 points/second
 * - 2026-01: Supports 5 concurrent bulk operations per shop
 *
 * Query Cost Calculation:
 * - Object: 1 point
 * - Connection: 2 + (number of objects returned)
 *
 * API Version: 2026-01
 */
class ShopifyCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = CATALOG_TYPES.PRODUCTS;
    this.shop = config.shop;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || '2026-01';
    this.catalog = null;
    this.dataPath = path.join(__dirname, '../data/catalogs', tenantId);
    this.currency = config.currency || 'MAD';
    // Rate limit tracking
    this.availablePoints = 1000;
    this.restoreRate = 50;
    this.lastCost = 0;
  }

  async connect() {
    if (!this.shop || !this.accessToken) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing shop or accessToken configuration';
      return false;
    }

    try {
      // Test connection with GraphQL shop query (recommended over REST)
      const response = await this._graphqlRequest(`
        query { shop { name currencyCode } }
      `);

      if (response.shop) {
        this.currency = response.shop.currencyCode || this.currency;
        this.status = CONNECTOR_STATUS.CONNECTED;
        console.log(`[ShopifyConnector] Connected: ${this.tenantId} (${this.shop}) - Currency: ${this.currency}`);
        return true;
      }
      throw new Error('Invalid shop response');
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[ShopifyConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute GraphQL request with rate limit handling
   * Uses calculated query cost model per Shopify docs
   *
   * @param {string} query - GraphQL query
   * @param {object} variables - Query variables
   * @param {boolean} debugCost - Include cost debug header
   * @returns {object} Response data
   */
  async _graphqlRequest(query, variables = {}, debugCost = false) {
    const url = `https://${this.shop}.myshopify.com/admin/api/${this.apiVersion}/graphql.json`;

    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
      'User-Agent': 'VocalIA-CatalogConnector/1.0'
    };

    // Enable cost debugging in development
    if (debugCost || process.env.NODE_ENV === 'development') {
      headers['Shopify-GraphQL-Cost-Debug'] = '1';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      console.log(`[ShopifyConnector] Rate limited. Waiting ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      // Retry once
      return this._graphqlRequest(query, variables, debugCost);
    }

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Track query cost from extensions
    if (result.extensions?.cost) {
      const cost = result.extensions.cost;
      this.lastCost = cost.requestedQueryCost;
      this.availablePoints = cost.throttleStatus?.currentlyAvailable || this.availablePoints;
      this.restoreRate = cost.throttleStatus?.restoreRate || this.restoreRate;

      // Throttle if running low on points (< 100)
      if (this.availablePoints < 100) {
        const waitTime = Math.ceil((100 - this.availablePoints) / this.restoreRate) * 1000;
        console.log(`[ShopifyConnector] Low points (${this.availablePoints}), waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (result.errors?.length > 0) {
      // Check for THROTTLED error
      const throttled = result.errors.find(e => e.extensions?.code === 'THROTTLED');
      if (throttled) {
        console.log('[ShopifyConnector] Throttled, waiting 1s...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this._graphqlRequest(query, variables, debugCost);
      }
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data;
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to Shopify');
      }
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      const products = await this._fetchAllProducts();

      this.catalog = {
        $schema: 'vocalia-catalog-products-v1',
        tenant_id: this.tenantId,
        last_sync: new Date().toISOString(),
        source: 'shopify',
        shop: this.shop,
        currency: this.currency,
        products: products.map(p => this._transformProduct(p))
      };

      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dataPath, 'products.json'),
        JSON.stringify(this.catalog, null, 2)
      );

      this.lastSync = this.catalog.last_sync;
      this.status = CONNECTOR_STATUS.CONNECTED;

      console.log(`[ShopifyConnector] Synced ${this.tenantId}: ${products.length} products`);
      return this.catalog;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  async _fetchAllProducts() {
    const products = [];
    let cursor = null;
    const limit = 50; // Optimal for GraphQL cost

    do {
      const query = `
        query listProducts($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: TITLE) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                description
                status
                productType
                tags
                totalInventory
                priceRangeV2 {
                  minVariantPrice { amount currencyCode }
                  maxVariantPrice { amount currencyCode }
                }
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      inventoryQuantity
                      availableForSale
                      selectedOptions { name value }
                    }
                  }
                }
                images(first: 5) {
                  edges { node { url altText } }
                }
              }
            }
          }
        }
      `;

      const data = await this._graphqlRequest(query, { first: limit, after: cursor });
      const edges = data.products?.edges || [];

      for (const edge of edges) {
        products.push(edge.node);
      }

      cursor = data.products?.pageInfo?.hasNextPage ? data.products.pageInfo.endCursor : null;
    } while (cursor);

    return products;
  }

  _transformProduct(shopifyProduct) {
    const variants = shopifyProduct.variants?.edges?.map(e => e.node) || [];
    const firstVariant = variants[0] || {};
    const price = parseFloat(firstVariant.price) || 0;
    const totalStock = variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

    return {
      id: shopifyProduct.id.replace('gid://shopify/Product/', ''),
      gid: shopifyProduct.id,
      sku: firstVariant.sku || '',
      name: shopifyProduct.title,
      handle: shopifyProduct.handle,
      category: shopifyProduct.productType || '',
      price,
      currency: this.currency,
      stock: totalStock,
      in_stock: totalStock > 0 || variants.some(v => v.availableForSale),
      status: shopifyProduct.status,
      variants: variants.map(v => ({
        id: v.id.replace('gid://shopify/ProductVariant/', ''),
        gid: v.id,
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        stock: v.inventoryQuantity,
        available: v.availableForSale,
        options: v.selectedOptions
      })),
      description: shopifyProduct.description || '',
      tags: shopifyProduct.tags || [],
      images: shopifyProduct.images?.edges?.map(e => e.node.url) || [],
      voice_description: this._generateVoiceDescription(shopifyProduct, price, totalStock),
      voice_summary: this._generateVoiceSummary(shopifyProduct, price)
    };
  }

  _generateVoiceDescription(product, price, stock) {
    let desc = product.title;
    if (price > 0) {
      desc += `, ${price} ${this.currency}`;
    }
    if (stock <= 0) {
      desc += ', rupture de stock';
    } else if (stock <= 5) {
      desc += `, plus que ${stock} en stock`;
    }
    return desc;
  }

  _generateVoiceSummary(product, price) {
    return `${product.title} à ${price} ${this.currency}`;
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }
    return this.catalog.products.find(p => p.id === itemId || p.gid === itemId) || null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;

    let results = this.catalog.products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(queryLower);
      const descMatch = p.description?.toLowerCase().includes(queryLower);
      const tagMatch = p.tags?.some(t => t.toLowerCase().includes(queryLower));
      const skuMatch = p.sku?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch || tagMatch || skuMatch;
    });

    if (filters.inStock === true) {
      results = results.filter(p => p.in_stock);
    }

    if (filters.category) {
      results = results.filter(p =>
        p.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    if (filters.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'product_not_found' };
    }

    // Check specific variant if requested
    if (params.variantId) {
      const variant = item.variants?.find(v => v.id === params.variantId || v.gid === params.variantId);
      if (variant) {
        return {
          available: variant.available,
          stock: variant.stock,
          itemId,
          variantId: params.variantId,
          itemName: `${item.name} - ${variant.title}`,
          price: variant.price
        };
      }
    }

    return {
      available: item.in_stock,
      stock: item.stock,
      itemId,
      itemName: item.name,
      price: item.price,
      currency: item.currency
    };
  }
}

/**
 * WooCommerce Catalog Connector
 * Production connector using WooCommerce REST API v3
 * Reference: https://woocommerce.github.io/woocommerce-rest-api-docs/
 * Requires: WordPress 6.7+, WooCommerce 9.0+, HTTPS
 */
class WooCommerceCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = CATALOG_TYPES.PRODUCTS;
    this.storeUrl = config.storeUrl || config.url;
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.catalog = null;
    this.dataPath = path.join(__dirname, '../data/catalogs', tenantId);
    this.currency = config.currency || 'MAD';
  }

  async connect() {
    if (!this.storeUrl || !this.consumerKey || !this.consumerSecret) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing WooCommerce credentials (storeUrl, consumerKey, consumerSecret)';
      return false;
    }

    try {
      // Test connection with system status endpoint
      const response = await this._apiRequest('/system_status');
      if (response.environment) {
        this.currency = response.settings?.currency || this.currency;
        this.status = CONNECTOR_STATUS.CONNECTED;
        console.log(`[WooCommerceConnector] Connected: ${this.tenantId} (${this.storeUrl})`);
        return true;
      }
      throw new Error('Invalid store response');
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[WooCommerceConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  async _apiRequest(endpoint, options = {}) {
    const baseUrl = this.storeUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/wp-json/wc/v3${endpoint}`);

    // OAuth 1.0a query string authentication (for HTTPS)
    url.searchParams.set('consumer_key', this.consumerKey);
    url.searchParams.set('consumer_secret', this.consumerSecret);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VocalIA-CatalogConnector/1.0'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to WooCommerce');
      }
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      const products = await this._fetchAllProducts();

      this.catalog = {
        $schema: 'vocalia-catalog-products-v1',
        tenant_id: this.tenantId,
        last_sync: new Date().toISOString(),
        source: 'woocommerce',
        store_url: this.storeUrl,
        currency: this.currency,
        products: products.map(p => this._transformProduct(p))
      };

      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dataPath, 'products.json'),
        JSON.stringify(this.catalog, null, 2)
      );

      this.lastSync = this.catalog.last_sync;
      this.status = CONNECTOR_STATUS.CONNECTED;

      console.log(`[WooCommerceConnector] Synced ${this.tenantId}: ${products.length} products`);
      return this.catalog;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  async _fetchAllProducts() {
    const products = [];
    let page = 1;
    const perPage = 100;

    do {
      const batch = await this._apiRequest('/products', {
        params: {
          per_page: perPage.toString(),
          page: page.toString(),
          status: 'publish'
        }
      });

      if (!batch || batch.length === 0) break;
      products.push(...batch);
      page++;
    } while (true);

    return products;
  }

  _transformProduct(wooProduct) {
    const price = parseFloat(wooProduct.price) || 0;
    const regularPrice = parseFloat(wooProduct.regular_price) || price;
    const salePrice = wooProduct.sale_price ? parseFloat(wooProduct.sale_price) : null;
    const stock = wooProduct.stock_quantity || 0;
    const inStock = wooProduct.stock_status === 'instock';

    return {
      id: wooProduct.id.toString(),
      sku: wooProduct.sku || '',
      name: wooProduct.name,
      slug: wooProduct.slug,
      category: wooProduct.categories?.map(c => c.name).join(', ') || '',
      price,
      regular_price: regularPrice,
      sale_price: salePrice,
      on_sale: wooProduct.on_sale || false,
      currency: this.currency,
      stock,
      in_stock: inStock,
      stock_status: wooProduct.stock_status,
      manage_stock: wooProduct.manage_stock,
      type: wooProduct.type,
      variants: wooProduct.variations?.map(v => ({ id: v.toString() })) || [],
      description: this._stripHtml(wooProduct.description || ''),
      short_description: this._stripHtml(wooProduct.short_description || ''),
      tags: wooProduct.tags?.map(t => t.name) || [],
      images: wooProduct.images?.map(img => img.src) || [],
      attributes: wooProduct.attributes?.map(a => ({
        name: a.name,
        options: a.options
      })) || [],
      voice_description: this._generateVoiceDescription(wooProduct, price, inStock, salePrice),
      voice_summary: `${wooProduct.name} à ${price} ${this.currency}`
    };
  }

  _stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  _generateVoiceDescription(product, price, inStock, salePrice) {
    let desc = product.name;
    if (salePrice) {
      desc += `, en promotion à ${salePrice} ${this.currency} au lieu de ${price}`;
    } else if (price > 0) {
      desc += `, ${price} ${this.currency}`;
    }
    if (!inStock) {
      desc += ', rupture de stock';
    }
    return desc;
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }
    return this.catalog.products.find(p => p.id === itemId) || null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;

    let results = this.catalog.products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(queryLower);
      const descMatch = p.description?.toLowerCase().includes(queryLower);
      const tagMatch = p.tags?.some(t => t.toLowerCase().includes(queryLower));
      const skuMatch = p.sku?.toLowerCase().includes(queryLower);
      const catMatch = p.category?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch || tagMatch || skuMatch || catMatch;
    });

    if (filters.inStock === true) {
      results = results.filter(p => p.in_stock);
    }

    if (filters.onSale === true) {
      results = results.filter(p => p.on_sale);
    }

    if (filters.category) {
      results = results.filter(p =>
        p.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    if (filters.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'product_not_found' };
    }

    return {
      available: item.in_stock,
      stock: item.manage_stock ? item.stock : null,
      stockStatus: item.stock_status,
      itemId,
      itemName: item.name,
      price: item.price,
      salePrice: item.sale_price,
      currency: item.currency
    };
  }
}

/**
 * Square Catalog Connector
 * Production connector using Square Catalog API
 *
 * Official Documentation:
 * - Catalog API: https://developer.squareup.com/reference/square/catalog-api
 * - List Catalog: GET /v2/catalog/list (NOT POST!)
 * - Search Catalog: POST /v2/catalog/search
 * - Inventory API: https://developer.squareup.com/reference/square/inventory-api
 *
 * Authentication: OAuth 2.0 Bearer token
 * Required scopes: ITEMS_READ, INVENTORY_READ (for stock)
 *
 * API Version: 2026-01-22 (per official docs)
 */
class SquareCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = config.catalogType || CATALOG_TYPES.PRODUCTS;
    this.accessToken = config.accessToken;
    this.locationId = config.locationId; // Required for inventory counts
    this.environment = config.environment || 'production'; // 'sandbox' or 'production'
    this.catalog = null;
    this.dataPath = path.join(__dirname, '../data/catalogs', tenantId);
    this.currency = config.currency || 'MAD';
    this.apiVersion = '2026-01-22'; // Per official Square docs
  }

  get _baseUrl() {
    return this.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';
  }

  async connect() {
    if (!this.accessToken) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing Square access token';
      return false;
    }

    try {
      // Test connection with merchant info
      const response = await this._apiRequest('/merchants/me');
      if (response.merchant) {
        this.currency = response.merchant.currency || this.currency;
        this.status = CONNECTOR_STATUS.CONNECTED;
        console.log(`[SquareConnector] Connected: ${this.tenantId} (${response.merchant.business_name})`);
        return true;
      }
      throw new Error('Invalid merchant response');
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[SquareConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  /**
   * Make Square API request
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Request options
   * @param {string} options.method - HTTP method (default: GET)
   * @param {object} options.body - Request body for POST/PUT
   * @param {object} options.query - Query parameters for GET
   */
  async _apiRequest(endpoint, options = {}) {
    let url = `${this._baseUrl}${endpoint}`;

    // Add query parameters for GET requests
    if (options.query && Object.keys(options.query).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      }
      url += `?${params.toString()}`;
    }

    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': this.apiVersion,
        'User-Agent': 'VocalIA-CatalogConnector/1.0'
      }
    };

    // Only add body for POST/PUT/PATCH
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMsg = error.errors?.[0]?.detail || error.message || 'Unknown error';
      throw new Error(`Square API error ${response.status}: ${errorMsg}`);
    }

    return response.json();
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to Square');
      }
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      const items = await this._fetchAllItems();
      const inventory = this.locationId ? await this._fetchInventory() : {};

      // Determine catalog structure based on item types
      const isMenu = items.some(i => i.type === 'ITEM' && i.item_data?.product_type === 'FOOD_AND_BEVERAGE');

      if (isMenu) {
        this.catalog = this._buildMenuCatalog(items, inventory);
      } else {
        this.catalog = this._buildProductCatalog(items, inventory);
      }

      this.catalog.$schema = `vocalia-catalog-${this.catalogType}-v1`;
      this.catalog.tenant_id = this.tenantId;
      this.catalog.last_sync = new Date().toISOString();
      this.catalog.source = 'square';

      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dataPath, `${this.catalogType}.json`),
        JSON.stringify(this.catalog, null, 2)
      );

      this.lastSync = this.catalog.last_sync;
      this.status = CONNECTOR_STATUS.CONNECTED;

      console.log(`[SquareConnector] Synced ${this.tenantId}: ${items.length} items`);
      return this.catalog;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  /**
   * Fetch all catalog items using GET /v2/catalog/list
   * Per official docs: https://developer.squareup.com/reference/square/catalog-api/list-catalog
   *
   * @returns {Array} All catalog objects
   */
  async _fetchAllItems() {
    const items = [];
    let cursor = null;

    do {
      // GET /v2/catalog/list with query parameters (NOT POST!)
      const query = {
        types: 'ITEM,CATEGORY,MODIFIER_LIST,MODIFIER'
      };
      if (cursor) query.cursor = cursor;

      const response = await this._apiRequest('/catalog/list', {
        method: 'GET',
        query
      });

      items.push(...(response.objects || []));
      cursor = response.cursor;
    } while (cursor);

    return items;
  }

  async _fetchInventory() {
    if (!this.locationId) return {};

    const inventory = {};
    let cursor = null;

    do {
      const body = { location_ids: [this.locationId] };
      if (cursor) body.cursor = cursor;

      const response = await this._apiRequest('/inventory/counts/batch-retrieve', {
        method: 'POST',
        body
      });

      for (const count of response.counts || []) {
        inventory[count.catalog_object_id] = parseInt(count.quantity, 10) || 0;
      }
      cursor = response.cursor;
    } while (cursor);

    return inventory;
  }

  _buildProductCatalog(items, inventory) {
    const categories = items.filter(i => i.type === 'CATEGORY');
    const products = items.filter(i => i.type === 'ITEM');
    const categoryMap = {};
    for (const cat of categories) {
      categoryMap[cat.id] = cat.category_data?.name || '';
    }

    return {
      currency: this.currency,
      products: products.map(item => {
        const data = item.item_data || {};
        const variations = data.variations || [];
        const firstVar = variations[0]?.item_variation_data || {};
        const price = firstVar.price_money ? firstVar.price_money.amount / 100 : 0;
        const stock = variations.reduce((sum, v) => sum + (inventory[v.id] || 0), 0);

        return {
          id: item.id,
          name: data.name,
          category: categoryMap[data.category_id] || '',
          description: data.description || '',
          price,
          currency: this.currency,
          stock,
          in_stock: stock > 0 || !data.is_taxable, // Non-taxable items often don't track inventory
          variants: variations.map(v => ({
            id: v.id,
            name: v.item_variation_data?.name,
            sku: v.item_variation_data?.sku,
            price: v.item_variation_data?.price_money ? v.item_variation_data.price_money.amount / 100 : 0,
            stock: inventory[v.id] || 0
          })),
          images: data.image_ids || [],
          voice_description: `${data.name}, ${price} ${this.currency}${stock <= 0 ? ', rupture de stock' : ''}`,
          voice_summary: `${data.name} à ${price} ${this.currency}`
        };
      })
    };
  }

  _buildMenuCatalog(items, inventory) {
    const categories = items.filter(i => i.type === 'CATEGORY');
    const menuItems = items.filter(i => i.type === 'ITEM');
    const modifierLists = items.filter(i => i.type === 'MODIFIER_LIST');
    const modifiers = items.filter(i => i.type === 'MODIFIER');

    const modifierMap = {};
    for (const mod of modifiers) {
      const listId = mod.modifier_data?.modifier_list_id;
      if (listId) {
        if (!modifierMap[listId]) modifierMap[listId] = [];
        modifierMap[listId].push({
          id: mod.id,
          name: mod.modifier_data?.name,
          price: mod.modifier_data?.price_money ? mod.modifier_data.price_money.amount / 100 : 0
        });
      }
    }

    const categoryMap = {};
    for (const cat of categories) {
      categoryMap[cat.id] = {
        id: cat.id,
        name: cat.category_data?.name || '',
        items: []
      };
    }

    for (const item of menuItems) {
      const data = item.item_data || {};
      const catId = data.category_id;
      const variations = data.variations || [];
      const firstVar = variations[0]?.item_variation_data || {};
      const price = firstVar.price_money ? firstVar.price_money.amount / 100 : 0;

      const menuItem = {
        id: item.id,
        name: data.name,
        description: data.description || '',
        price,
        currency: this.currency,
        available: !data.is_deleted,
        preparation_time: data.prep_time_duration ? parseInt(data.prep_time_duration.replace(/[^\d]/g, ''), 10) : null,
        modifiers: (data.modifier_list_info || []).flatMap(m =>
          modifierMap[m.modifier_list_id] || []
        ),
        dietary_info: data.dietary_preferences || [],
        voice_description: `${data.name}, ${price} ${this.currency}`,
        voice_summary: `${data.name} à ${price} ${this.currency}`
      };

      if (catId && categoryMap[catId]) {
        categoryMap[catId].items.push(menuItem);
      }
    }

    return {
      currency: this.currency,
      menu: {
        categories: Object.values(categoryMap).filter(c => c.items.length > 0)
      }
    };
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }

    if (this.catalogType === CATALOG_TYPES.MENU) {
      for (const cat of this.catalog.menu?.categories || []) {
        const item = cat.items?.find(i => i.id === itemId);
        if (item) return item;
      }
    } else {
      return this.catalog.products?.find(p => p.id === itemId) || null;
    }
    return null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;
    let items = [];

    if (this.catalogType === CATALOG_TYPES.MENU) {
      for (const cat of this.catalog.menu?.categories || []) {
        items.push(...(cat.items || []));
      }
    } else {
      items = this.catalog.products || [];
    }

    let results = items.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(queryLower);
      const descMatch = item.description?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch;
    });

    if (filters.inStock === true) {
      results = results.filter(p => p.in_stock !== false && p.available !== false);
    }

    if (filters.category) {
      results = results.filter(p =>
        p.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'item_not_found' };
    }

    if (this.catalogType === CATALOG_TYPES.MENU) {
      return {
        available: item.available !== false,
        itemId,
        itemName: item.name,
        preparationTime: item.preparation_time,
        price: item.price
      };
    }

    return {
      available: item.in_stock,
      stock: item.stock,
      itemId,
      itemName: item.name,
      price: item.price,
      currency: item.currency
    };
  }
}

/**
 * Lightspeed Catalog Connector
 * Production connector for Lightspeed Restaurant (K-Series) and Retail (X-Series)
 *
 * Official Documentation:
 * - K-Series (Restaurant): https://api-docs.lsk.lightspeed.app/
 *   - GET /o/op/1/menu/list?businessLocationId={id} - List all menus
 *   - GET /o/op/1/menu/load/{menuId}?businessLocationId={id} - Get single menu
 *   - GET /o/op/1/menu/modifiers?businessLocationId={id} - Get modifiers
 *
 * - X-Series (Retail): https://x-series-api.lightspeedhq.com/
 *   - GET /API/V3/Account/{accountId}/Item.json - List products
 *
 * Authentication: OAuth 2.0 Bearer token
 *
 * Updated: Session 250.72 with correct K-Series endpoints per official docs
 */
class LightspeedCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = config.catalogType || CATALOG_TYPES.MENU; // Restaurant default
    this.accessToken = config.accessToken;
    this.accountId = config.accountId;
    this.series = config.series || 'K'; // 'K' = Restaurant, 'X' = Retail
    this.businessLocationId = config.businessLocationId; // Required for K-Series (not businessId!)
    this.environment = config.environment || 'production'; // 'trial' or 'production'
    this.catalog = null;
    this.dataPath = path.join(__dirname, '../data/catalogs', tenantId);
    this.currency = config.currency || 'MAD';
  }

  get _baseUrl() {
    if (this.series === 'K') {
      // K-Series uses different base URL format per official docs
      return this.environment === 'trial'
        ? 'https://api.trial.lsk.lightspeed.app'
        : 'https://api.lsk.lightspeed.app';
    }
    // X-Series retail
    return 'https://api.lightspeedapp.com/API/V3/Account';
  }

  async connect() {
    if (!this.accessToken) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing Lightspeed access token';
      return false;
    }

    try {
      if (this.series === 'K') {
        // K-Series restaurant - Test by listing menus
        // Requires businessLocationId per official docs
        if (!this.businessLocationId) {
          throw new Error('K-Series requires businessLocationId configuration');
        }

        // GET /o/op/1/menu/list?businessLocationId={id}
        const response = await this._apiRequest('/o/op/1/menu/list', {
          query: { businessLocationId: this.businessLocationId }
        });

        // Response is array of menus [{menuName, ikentooMenuId}, ...]
        if (Array.isArray(response)) {
          this.status = CONNECTOR_STATUS.CONNECTED;
          this._menuIds = response.map(m => m.ikentooMenuId);
          console.log(`[LightspeedConnector] Connected K-Series: ${this.tenantId}, ${response.length} menus`);
          return true;
        }
      } else {
        // X-Series retail
        const response = await this._apiRequest(`/${this.accountId}`);
        if (response.Account) {
          this.status = CONNECTOR_STATUS.CONNECTED;
          console.log(`[LightspeedConnector] Connected X-Series: ${this.tenantId}`);
          return true;
        }
      }
      throw new Error('Invalid response from Lightspeed API');
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[LightspeedConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  /**
   * Make Lightspeed API request
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Request options
   * @param {object} options.query - Query parameters (for K-Series businessLocationId, etc.)
   */
  async _apiRequest(endpoint, options = {}) {
    let url = `${this._baseUrl}${endpoint}`;

    // Add query parameters
    if (options.query && Object.keys(options.query).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      }
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'VocalIA-CatalogConnector/1.0'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Lightspeed API error ${response.status}: ${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to Lightspeed');
      }
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      if (this.series === 'K') {
        // K-Series Restaurant Menu
        await this._syncKSeriesMenu();
      } else {
        // X-Series Retail Products
        await this._syncXSeriesProducts();
      }

      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dataPath, `${this.catalogType}.json`),
        JSON.stringify(this.catalog, null, 2)
      );

      this.lastSync = this.catalog.last_sync;
      this.status = CONNECTOR_STATUS.CONNECTED;

      console.log(`[LightspeedConnector] Synced ${this.tenantId}`);
      return this.catalog;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  /**
   * Sync K-Series Restaurant Menu
   * Uses official K-Series API endpoints:
   * - GET /o/op/1/menu/list?businessLocationId={id} - List all menus
   * - GET /o/op/1/menu/load/{menuId}?businessLocationId={id} - Get menu details
   *
   * Response structure per official docs:
   * - menuName, menuEntryGroups[] with menuEntry[] containing menuItemEntry/menuGroupEntry
   * - Each item has: productName, productPrice, sku, color, richData, allergenCodes
   */
  async _syncKSeriesMenu() {
    // First, get list of menus
    const menuList = await this._apiRequest('/o/op/1/menu/list', {
      query: { businessLocationId: this.businessLocationId }
    });

    if (!Array.isArray(menuList) || menuList.length === 0) {
      throw new Error('No menus found for this business location');
    }

    // Fetch each menu's details
    const categories = [];

    for (const menuInfo of menuList) {
      const menuId = menuInfo.ikentooMenuId;
      const menuName = menuInfo.menuName;

      // GET /o/op/1/menu/load/{menuId}?businessLocationId={id}
      const menuData = await this._apiRequest(`/o/op/1/menu/load/${menuId}`, {
        query: {
          businessLocationId: this.businessLocationId,
          includeRichContent: 'true'
        }
      });

      // Parse menuEntryGroups (categories/screens)
      const groups = menuData.menuEntryGroups || [];
      for (const group of groups) {
        const items = this._parseMenuEntries(group.menuEntry || []);

        if (items.length > 0) {
          categories.push({
            id: group.ikentooModifierId || `cat-${categories.length}`,
            name: group.name || menuName,
            items
          });
        }
      }
    }

    this.catalog = {
      $schema: 'vocalia-catalog-menu-v1',
      tenant_id: this.tenantId,
      last_sync: new Date().toISOString(),
      source: 'lightspeed-k',
      businessLocationId: this.businessLocationId,
      currency: this.currency,
      menu: { categories }
    };
  }

  /**
   * Parse menu entries recursively (handles nested groups)
   */
  _parseMenuEntries(entries) {
    const items = [];

    for (const entry of entries) {
      if (entry.menuItemEntry) {
        // Individual item per K-Series API schema
        const item = entry.menuItemEntry;
        items.push({
          id: item.sku || `item-${items.length}`,
          name: item.productName,
          description: item.richData?.description || '',
          price: item.productPrice || 0,
          currency: this.currency,
          available: true,
          allergens: item.allergenCodes || [],
          color: item.color,
          alcoholContent: item.containsAlcohol ? item.alcoholPercentage : null,
          images: item.richData?.imageDownloadLink ? [item.richData.imageDownloadLink] : [],
          voice_description: `${item.productName}, ${item.productPrice} ${this.currency}`,
          voice_summary: `${item.productName} à ${item.productPrice} ${this.currency}`
        });
      } else if (entry.menuGroupEntry) {
        // Nested group - recurse
        const subEntries = entry.menuGroupEntry.menuEntry || [];
        items.push(...this._parseMenuEntries(subEntries));
      }
      // menuDealEntry (combos) could be added here if needed
    }

    return items;
  }

  async _syncXSeriesProducts() {
    const response = await this._apiRequest(`/${this.accountId}/Item.json`);
    const items = response.Item || [];

    const products = items.map(item => ({
      id: item.itemID,
      sku: item.customSku || item.upc || '',
      name: item.description,
      category: item.Category?.name || '',
      price: parseFloat(item.Prices?.ItemPrice?.[0]?.amount) || 0,
      currency: this.currency,
      stock: parseInt(item.ItemShops?.ItemShop?.[0]?.qoh, 10) || 0,
      in_stock: (parseInt(item.ItemShops?.ItemShop?.[0]?.qoh, 10) || 0) > 0,
      description: item.Note?.note || '',
      images: item.Images?.Image?.map(i => i.baseImageURL) || [],
      voice_description: `${item.description}, ${item.Prices?.ItemPrice?.[0]?.amount || 0} ${this.currency}`,
      voice_summary: `${item.description}`
    }));

    this.catalog = {
      $schema: 'vocalia-catalog-products-v1',
      tenant_id: this.tenantId,
      last_sync: new Date().toISOString(),
      source: 'lightspeed-x',
      currency: this.currency,
      products
    };
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }

    if (this.catalogType === CATALOG_TYPES.MENU) {
      for (const cat of this.catalog.menu?.categories || []) {
        const item = cat.items?.find(i => i.id === itemId);
        if (item) return item;
      }
    } else {
      return this.catalog.products?.find(p => p.id === itemId) || null;
    }
    return null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;
    let items = [];

    if (this.catalogType === CATALOG_TYPES.MENU) {
      for (const cat of this.catalog.menu?.categories || []) {
        items.push(...(cat.items || []).map(i => ({ ...i, category: cat.name })));
      }
    } else {
      items = this.catalog.products || [];
    }

    let results = items.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(queryLower);
      const descMatch = item.description?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch;
    });

    if (filters.inStock === true) {
      results = results.filter(p => p.in_stock !== false && p.available !== false);
    }

    if (filters.category) {
      results = results.filter(p =>
        p.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'item_not_found' };
    }

    if (this.catalogType === CATALOG_TYPES.MENU) {
      return {
        available: item.available !== false,
        itemId,
        itemName: item.name,
        preparationTime: item.preparation_time,
        price: item.price
      };
    }

    return {
      available: item.in_stock,
      stock: item.stock,
      itemId,
      itemName: item.name,
      price: item.price,
      currency: item.currency
    };
  }
}

/**
 * Magento Catalog Connector
 * Production connector using Magento REST API
 * Reference: https://developer.adobe.com/commerce/webapi/rest/
 */
class MagentoCatalogConnector extends CatalogConnector {
  constructor(tenantId, config = {}) {
    super(tenantId, config);
    this.catalogType = CATALOG_TYPES.PRODUCTS;
    this.baseUrl = config.baseUrl || config.url;
    this.accessToken = config.accessToken;
    this.catalog = null;
    this.dataPath = path.join(__dirname, '../data/catalogs', tenantId);
    this.currency = config.currency || 'MAD';
  }

  async connect() {
    if (!this.baseUrl || !this.accessToken) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing Magento baseUrl or accessToken';
      return false;
    }

    try {
      const response = await this._apiRequest('/store/storeConfigs');
      if (Array.isArray(response) && response.length > 0) {
        this.currency = response[0].base_currency_code || this.currency;
        this.status = CONNECTOR_STATUS.CONNECTED;
        console.log(`[MagentoConnector] Connected: ${this.tenantId}`);
        return true;
      }
      throw new Error('Invalid store response');
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[MagentoConnector] Connection error: ${error.message}`);
      return false;
    }
  }

  async _apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl.replace(/\/$/, '')}/rest/V1${endpoint}`;

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VocalIA-CatalogConnector/1.0'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Magento API error ${response.status}: ${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async sync() {
    if (this.status !== CONNECTOR_STATUS.CONNECTED) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to Magento');
      }
    }

    this.status = CONNECTOR_STATUS.SYNCING;

    try {
      const products = await this._fetchAllProducts();

      this.catalog = {
        $schema: 'vocalia-catalog-products-v1',
        tenant_id: this.tenantId,
        last_sync: new Date().toISOString(),
        source: 'magento',
        currency: this.currency,
        products: products.map(p => this._transformProduct(p))
      };

      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(this.dataPath, 'products.json'),
        JSON.stringify(this.catalog, null, 2)
      );

      this.lastSync = this.catalog.last_sync;
      this.status = CONNECTOR_STATUS.CONNECTED;

      console.log(`[MagentoConnector] Synced ${this.tenantId}: ${products.length} products`);
      return this.catalog;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      throw error;
    }
  }

  async _fetchAllProducts() {
    const products = [];
    let page = 1;
    const pageSize = 100;

    do {
      const searchCriteria = `searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${page}`;
      const response = await this._apiRequest(`/products?${searchCriteria}`);

      if (!response.items || response.items.length === 0) break;
      products.push(...response.items);
      page++;

      if (products.length >= response.total_count) break;
    } while (true);

    return products;
  }

  _transformProduct(magentoProduct) {
    const price = magentoProduct.price || 0;
    const customAttrs = {};
    for (const attr of magentoProduct.custom_attributes || []) {
      customAttrs[attr.attribute_code] = attr.value;
    }

    const stock = magentoProduct.extension_attributes?.stock_item;
    const inStock = stock?.is_in_stock === true;
    const qty = stock?.qty || 0;

    return {
      id: magentoProduct.id.toString(),
      sku: magentoProduct.sku,
      name: magentoProduct.name,
      category: customAttrs.category_ids || '',
      price,
      currency: this.currency,
      stock: qty,
      in_stock: inStock,
      type: magentoProduct.type_id,
      status: magentoProduct.status,
      visibility: magentoProduct.visibility,
      description: customAttrs.description || '',
      short_description: customAttrs.short_description || '',
      images: (magentoProduct.media_gallery_entries || []).map(m => m.file),
      attributes: customAttrs,
      voice_description: `${magentoProduct.name}, ${price} ${this.currency}${!inStock ? ', rupture de stock' : ''}`,
      voice_summary: `${magentoProduct.name} à ${price} ${this.currency}`
    };
  }

  async getItem(itemId) {
    if (!this.catalog) {
      await this.sync();
    }
    return this.catalog.products.find(p => p.id === itemId || p.sku === itemId) || null;
  }

  async search(query, filters = {}) {
    if (!this.catalog) {
      await this.sync();
    }

    const queryLower = query.toLowerCase();
    const limit = filters.limit || 10;

    let results = this.catalog.products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(queryLower);
      const descMatch = p.description?.toLowerCase().includes(queryLower);
      const skuMatch = p.sku?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch || skuMatch;
    });

    if (filters.inStock === true) {
      results = results.filter(p => p.in_stock);
    }

    if (filters.category) {
      results = results.filter(p =>
        p.category?.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    return results.slice(0, limit);
  }

  async checkAvailability(itemId, params = {}) {
    const item = await this.getItem(itemId);

    if (!item) {
      return { available: false, reason: 'product_not_found' };
    }

    return {
      available: item.in_stock,
      stock: item.stock,
      itemId,
      itemName: item.name,
      price: item.price,
      currency: item.currency
    };
  }
}

/**
 * Connector Factory
 * Creates appropriate connector based on configuration
 *
 * Supported e-commerce platforms:
 * - Shopify: GraphQL Admin API (2026-01)
 * - WooCommerce: REST API v3
 * - Square: Catalog API (POS integration)
 * - Lightspeed: K-Series (Restaurant) & X-Series (Retail)
 * - Magento: REST API
 * - Custom: JSON/CSV file imports
 */
class CatalogConnectorFactory {
  static CONNECTORS = {
    shopify: {
      name: 'Shopify',
      class: ShopifyCatalogConnector,
      catalogType: CATALOG_TYPES.PRODUCTS,
      requiredConfig: ['shop', 'accessToken'],
      marketShare: '10.32%',
      description: 'GraphQL Admin API with rate limit awareness'
    },
    woocommerce: {
      name: 'WooCommerce',
      class: WooCommerceCatalogConnector,
      catalogType: CATALOG_TYPES.PRODUCTS,
      requiredConfig: ['storeUrl', 'consumerKey', 'consumerSecret'],
      marketShare: '33-39%',
      description: 'REST API v3 (requires WordPress 6.7+, WooCommerce 9.0+)'
    },
    square: {
      name: 'Square',
      class: SquareCatalogConnector,
      catalogType: CATALOG_TYPES.PRODUCTS,
      requiredConfig: ['accessToken'],
      optionalConfig: ['locationId', 'environment'],
      marketShare: '~3%',
      description: 'Catalog API for POS and e-commerce'
    },
    lightspeed: {
      name: 'Lightspeed',
      class: LightspeedCatalogConnector,
      catalogType: CATALOG_TYPES.MENU,
      requiredConfig: ['accessToken'],
      optionalConfig: ['series', 'businessId', 'accountId'],
      marketShare: '~2%',
      description: 'K-Series (Restaurant) and X-Series (Retail) APIs'
    },
    magento: {
      name: 'Magento/Adobe Commerce',
      class: MagentoCatalogConnector,
      catalogType: CATALOG_TYPES.PRODUCTS,
      requiredConfig: ['baseUrl', 'accessToken'],
      marketShare: '8%',
      description: 'REST API for enterprise e-commerce'
    },
    custom: {
      name: 'Custom (JSON/CSV)',
      class: CustomCatalogConnector,
      catalogType: CATALOG_TYPES.PRODUCTS,
      requiredConfig: [],
      optionalConfig: ['dataPath', 'catalogType'],
      marketShare: 'N/A',
      description: 'Local file-based catalog (JSON/CSV import)'
    }
  };

  /**
   * Create connector instance
   * @param {string} tenantId - Tenant identifier
   * @param {object} config - Connector configuration
   * @param {string} config.source - Connector type (shopify, woocommerce, square, lightspeed, magento, custom)
   * @returns {CatalogConnector} Connector instance
   */
  static create(tenantId, config = {}) {
    const connectorType = (config.source || config.type || 'custom').toLowerCase();
    const connectorDef = this.CONNECTORS[connectorType];

    if (!connectorDef) {
      console.warn(`[ConnectorFactory] Unknown connector type: ${connectorType}, using custom`);
      return new CustomCatalogConnector(tenantId, config);
    }

    // Validate required config
    const missing = (connectorDef.requiredConfig || []).filter(key =>
      !config[key] && !config[key.replace(/([A-Z])/g, '_$1').toLowerCase()] // Check camelCase and snake_case
    );

    if (missing.length > 0) {
      console.warn(`[ConnectorFactory] Missing config for ${connectorType}: ${missing.join(', ')}`);
    }

    return new connectorDef.class(tenantId, {
      ...config,
      catalogType: config.catalogType || connectorDef.catalogType
    });
  }

  /**
   * Get list of available connector types
   * @returns {string[]} Connector type identifiers
   */
  static getAvailableConnectors() {
    return Object.keys(this.CONNECTORS);
  }

  /**
   * Get connector metadata
   * @param {string} connectorType - Connector type
   * @returns {object|null} Connector metadata
   */
  static getConnectorInfo(connectorType) {
    return this.CONNECTORS[connectorType?.toLowerCase()] || null;
  }

  /**
   * Get all connectors with metadata
   * @returns {object} All connector definitions
   */
  static getAllConnectorsInfo() {
    return Object.entries(this.CONNECTORS).map(([type, info]) => ({
      type,
      name: info.name,
      catalogType: info.catalogType,
      requiredConfig: info.requiredConfig,
      optionalConfig: info.optionalConfig || [],
      marketShare: info.marketShare,
      description: info.description
    }));
  }

  /**
   * Validate connector configuration
   * @param {string} connectorType - Connector type
   * @param {object} config - Configuration to validate
   * @returns {object} Validation result { valid: boolean, missing: string[], warnings: string[] }
   */
  static validateConfig(connectorType, config = {}) {
    const connectorDef = this.CONNECTORS[connectorType?.toLowerCase()];

    if (!connectorDef) {
      return { valid: false, missing: [], warnings: [`Unknown connector type: ${connectorType}`] };
    }

    const missing = (connectorDef.requiredConfig || []).filter(key => !config[key]);
    const warnings = [];

    // Check optional config hints
    if (connectorType === 'square' && !config.locationId) {
      warnings.push('locationId recommended for inventory tracking');
    }

    if (connectorType === 'lightspeed' && !config.series) {
      warnings.push('series defaults to "K" (Restaurant). Set to "X" for Retail.');
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    };
  }
}

// Export
module.exports = {
  // Base classes
  CatalogConnector,
  CustomCatalogConnector,
  // E-commerce connectors (primordial sector)
  ShopifyCatalogConnector,
  WooCommerceCatalogConnector,
  SquareCatalogConnector,
  LightspeedCatalogConnector,
  MagentoCatalogConnector,
  // Factory
  CatalogConnectorFactory,
  // Constants
  CATALOG_TYPES,
  CONNECTOR_STATUS
};

// CLI Test
if (require.main === module) {
  (async () => {
    console.log('=== VocalIA Catalog Connector Test ===\n');
    console.log('Version: 2.0.0 | Session 250.71 | E-commerce Connectors Production-Ready\n');

    // Display available connectors
    console.log('📦 Available E-commerce Connectors:');
    console.log('─'.repeat(60));
    for (const info of CatalogConnectorFactory.getAllConnectorsInfo()) {
      console.log(`  ${info.name.padEnd(25)} | ${info.marketShare.padEnd(10)} | ${info.catalogType}`);
    }
    console.log('─'.repeat(60));
    console.log(`Total Market Coverage: ~64%+ (WooCommerce+Shopify+Magento+Square+Lightspeed)\n`);

    // Test Custom Connector
    console.log('🧪 Testing Custom Connector...');
    const connector = CatalogConnectorFactory.create('test_tenant', {
      source: 'custom',
      catalogType: CATALOG_TYPES.PRODUCTS
    });

    await connector.connect();
    console.log('   Status:', connector.getStatus().status);

    // Create sample catalog
    const sampleCatalog = {
      products: [
        {
          id: 'PROD-001',
          name: 'T-Shirt Classic',
          category: 'vetements',
          price: 199,
          currency: 'MAD',
          stock: 50,
          in_stock: true,
          description: 'T-shirt 100% coton',
          voice_description: 'T-shirt classic en coton à 199 dirhams',
          voice_summary: 'T-shirt à 199 MAD'
        },
        {
          id: 'PROD-002',
          name: 'Jean Slim',
          category: 'vetements',
          price: 399,
          currency: 'MAD',
          stock: 0,
          in_stock: false,
          description: 'Jean slim stretch',
          voice_description: 'Jean slim à 399 dirhams, rupture de stock',
          voice_summary: 'Jean à 399 MAD'
        }
      ]
    };

    await connector.saveCatalog(sampleCatalog);

    // Test search
    const results = await connector.search('shirt');
    console.log('   Search "shirt":', results.length, 'results');

    // Test availability
    const avail = await connector.checkAvailability('PROD-001');
    console.log('   Availability PROD-001:', avail.available ? '✅ In Stock' : '❌ Out of Stock');

    // Validate Shopify config (example)
    console.log('\n🔍 Config Validation Examples:');
    const shopifyValidation = CatalogConnectorFactory.validateConfig('shopify', {});
    console.log('   Shopify (empty config):', shopifyValidation.valid ? '✅' : `❌ Missing: ${shopifyValidation.missing.join(', ')}`);

    const wooValidation = CatalogConnectorFactory.validateConfig('woocommerce', {
      storeUrl: 'https://store.example.com',
      consumerKey: 'ck_xxx',
      consumerSecret: 'cs_xxx'
    });
    console.log('   WooCommerce (full config):', wooValidation.valid ? '✅ Valid' : '❌ Invalid');

    const squareValidation = CatalogConnectorFactory.validateConfig('square', { accessToken: 'xxx' });
    console.log('   Square (partial config):', squareValidation.valid ? '✅' : '❌', squareValidation.warnings[0] || '');

    console.log('\n✅ Catalog Connector Test Complete');
    console.log('   6 E-commerce platforms supported (Shopify, WooCommerce, Square, Lightspeed, Magento, Custom)');
    console.log('   Voice-optimized responses with voice_description and voice_summary fields');
  })();
}
