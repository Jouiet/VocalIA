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
 * Connects to Shopify Admin API for e-commerce catalogs
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
  }

  async connect() {
    if (!this.shop || !this.accessToken) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = 'Missing shop or accessToken configuration';
      return false;
    }

    try {
      // Test connection with a simple API call
      const response = await fetch(
        `https://${this.shop}.myshopify.com/admin/api/${this.apiVersion}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      this.status = CONNECTOR_STATUS.CONNECTED;
      console.log(`[ShopifyConnector] Connected: ${this.tenantId} (${this.shop})`);
      return true;
    } catch (error) {
      this.status = CONNECTOR_STATUS.ERROR;
      this.lastError = error.message;
      console.error(`[ShopifyConnector] Connection error: ${error.message}`);
      return false;
    }
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
      // Fetch products from Shopify
      const products = await this._fetchAllProducts();

      // Transform to VocalIA catalog format
      this.catalog = {
        $schema: 'vocalia-catalog-products-v1',
        tenant_id: this.tenantId,
        last_sync: new Date().toISOString(),
        source: 'shopify',
        shop: this.shop,
        products: products.map(p => this._transformProduct(p))
      };

      // Cache locally
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
    let pageInfo = null;
    const limit = 250;

    do {
      let url = `https://${this.shop}.myshopify.com/admin/api/${this.apiVersion}/products.json?limit=${limit}`;
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      products.push(...(data.products || []));

      // Check for pagination
      const linkHeader = response.headers.get('Link');
      pageInfo = this._extractPageInfo(linkHeader);

    } while (pageInfo);

    return products;
  }

  _extractPageInfo(linkHeader) {
    if (!linkHeader) return null;

    const match = linkHeader.match(/page_info=([^&>]+).*rel="next"/);
    return match ? match[1] : null;
  }

  _transformProduct(shopifyProduct) {
    const variant = shopifyProduct.variants?.[0] || {};

    return {
      id: shopifyProduct.id.toString(),
      sku: variant.sku || '',
      name: shopifyProduct.title,
      category: shopifyProduct.product_type || '',
      price: parseFloat(variant.price) || 0,
      currency: 'MAD', // Default, should come from shop settings
      stock: variant.inventory_quantity || 0,
      in_stock: variant.inventory_quantity > 0 || variant.inventory_policy === 'continue',
      variants: shopifyProduct.variants?.map(v => ({
        id: v.id.toString(),
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        stock: v.inventory_quantity,
        options: {
          option1: v.option1,
          option2: v.option2,
          option3: v.option3
        }
      })) || [],
      description: this._stripHtml(shopifyProduct.body_html || ''),
      tags: shopifyProduct.tags?.split(',').map(t => t.trim()) || [],
      images: shopifyProduct.images?.map(img => img.src) || [],
      voice_description: this._generateVoiceDescription(shopifyProduct)
    };
  }

  _stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  _generateVoiceDescription(product) {
    const variant = product.variants?.[0] || {};
    const price = parseFloat(variant.price) || 0;
    const inStock = variant.inventory_quantity > 0;

    let desc = product.title;
    if (price > 0) {
      desc += ` à ${price} dirhams`;
    }
    if (!inStock) {
      desc += ', actuellement en rupture de stock';
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
      return nameMatch || descMatch || tagMatch;
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
      price: item.price
    };
  }
}

/**
 * Connector Factory
 * Creates appropriate connector based on configuration
 */
class CatalogConnectorFactory {
  static create(tenantId, config = {}) {
    const connectorType = config.source || config.type || 'custom';

    switch (connectorType.toLowerCase()) {
      case 'shopify':
        return new ShopifyCatalogConnector(tenantId, config);

      case 'woocommerce':
        // WooCommerce connector (to be implemented)
        console.warn('[ConnectorFactory] WooCommerce connector not yet implemented, using custom');
        return new CustomCatalogConnector(tenantId, { ...config, catalogType: CATALOG_TYPES.PRODUCTS });

      case 'custom':
      default:
        return new CustomCatalogConnector(tenantId, config);
    }
  }

  static getAvailableConnectors() {
    return ['shopify', 'custom'];
  }
}

// Export
module.exports = {
  CatalogConnector,
  CustomCatalogConnector,
  ShopifyCatalogConnector,
  CatalogConnectorFactory,
  CATALOG_TYPES,
  CONNECTOR_STATUS
};

// CLI Test
if (require.main === module) {
  (async () => {
    console.log('=== VocalIA Catalog Connector Test ===\n');

    // Test Custom Connector
    const connector = new CustomCatalogConnector('test_tenant', {
      catalogType: CATALOG_TYPES.PRODUCTS
    });

    await connector.connect();
    console.log('Status:', connector.getStatus());

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
          voice_description: 'T-shirt classic en coton à 199 dirhams'
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
          voice_description: 'Jean slim à 399 dirhams, en rupture de stock'
        }
      ]
    };

    await connector.saveCatalog(sampleCatalog);

    // Test search
    const results = await connector.search('shirt');
    console.log('\nSearch "shirt":', results.length, 'results');

    // Test availability
    const avail = await connector.checkAvailability('PROD-001');
    console.log('Availability PROD-001:', avail);

    console.log('\n✅ Catalog Connector Test Complete');
  })();
}
