#!/usr/bin/env node
/**
 * VocalIA - Tenant Catalog Store
 *
 * Centralized store for managing multi-tenant catalog data with:
 * - LRU cache for performance
 * - Automatic sync scheduling
 * - Voice-optimized responses
 * - Per-tenant isolation
 * - Google Calendar integration for dynamic slots (Session 250.72)
 *
 * Version: 1.1.0 | Session 250.72 | 03/02/2026
 */

const fs = require('fs');
const path = require('path');
const { CatalogConnectorFactory, CATALOG_TYPES, CONNECTOR_STATUS } = require('./catalog-connector.cjs');

// Lazy-load CalendarSlotsConnector to avoid circular dependencies
let CalendarSlotsStore = null;
function getCalendarSlotsStore() {
  if (!CalendarSlotsStore) {
    try {
      const module = require('./calendar-slots-connector.cjs');
      CalendarSlotsStore = module.getCalendarSlotsStore();
    } catch (e) {
      console.warn('[TenantCatalogStore] CalendarSlotsConnector not available:', e.message);
    }
  }
  return CalendarSlotsStore;
}

// Store configuration
const CONFIG = {
  dataDir: path.join(__dirname, '../data/catalogs'),
  configFile: path.join(__dirname, '../data/catalogs/store-config.json'),
  cacheMaxSize: 100,
  cacheTTLMs: 5 * 60 * 1000, // 5 minutes
  syncIntervalMs: 15 * 60 * 1000, // 15 minutes
  maxItemsPerTenant: 10000
};

/**
 * LRU Cache for catalog data
 */
class LRUCache {
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(key, data) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

/**
 * Tenant Catalog Store
 * Singleton pattern for centralized catalog management
 */
class TenantCatalogStore {
  constructor(options = {}) {
    this.connectors = new Map(); // tenantId -> connector
    this.tenantConfigs = new Map(); // tenantId -> config
    const maxCacheSize = options.maxCacheSize || CONFIG.cacheMaxSize;
    const cacheTTLMs = options.cacheTTLMs || CONFIG.cacheTTLMs;
    this.cache = new LRUCache(maxCacheSize, cacheTTLMs);
    this.syncTimers = new Map(); // tenantId -> timer
    this.initialized = false;
  }

  /**
   * Initialize the store
   */
  async init() {
    if (this.initialized) return;

    // Ensure data directory exists
    if (!fs.existsSync(CONFIG.dataDir)) {
      fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    }

    // Load store configuration
    this._loadConfig();

    this.initialized = true;
    console.log('[TenantCatalogStore] Initialized');
  }

  /**
   * Register a tenant with catalog configuration
   * @param {string} tenantId - Tenant identifier
   * @param {object} config - Catalog configuration
   */
  async registerTenant(tenantId, config) {
    await this.init();

    this.tenantConfigs.set(tenantId, config);

    // Create connector
    const connector = CatalogConnectorFactory.create(tenantId, config);
    this.connectors.set(tenantId, connector);

    // Connect and initial sync
    await connector.connect();

    // Save config
    this._saveConfig();

    console.log(`[TenantCatalogStore] Registered tenant: ${tenantId} (${config.type || 'custom'})`);
    return connector;
  }

  /**
   * Unregister a tenant
   * @param {string} tenantId - Tenant identifier
   */
  async unregisterTenant(tenantId) {
    // Stop sync timer
    if (this.syncTimers.has(tenantId)) {
      clearInterval(this.syncTimers.get(tenantId));
      this.syncTimers.delete(tenantId);
    }

    // Disconnect
    const connector = this.connectors.get(tenantId);
    if (connector) {
      await connector.disconnect();
    }

    this.connectors.delete(tenantId);
    this.tenantConfigs.delete(tenantId);
    this.cache.invalidate(tenantId);

    this._saveConfig();

    console.log(`[TenantCatalogStore] Unregistered tenant: ${tenantId}`);
  }

  /**
   * Get connector for tenant
   * @param {string} tenantId - Tenant identifier
   * @returns {CatalogConnector} Connector instance
   */
  getConnector(tenantId) {
    return this.connectors.get(tenantId);
  }

  /**
   * Sync catalog for tenant
   * @param {string} tenantId - Tenant identifier
   */
  async syncTenant(tenantId) {
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      throw new Error(`Tenant not registered: ${tenantId}`);
    }

    const catalog = await connector.sync();
    this.cache.invalidate(tenantId);

    return catalog;
  }

  /**
   * Start automatic sync for tenant
   * @param {string} tenantId - Tenant identifier
   * @param {number} intervalMs - Sync interval in milliseconds
   */
  startAutoSync(tenantId, intervalMs = CONFIG.syncIntervalMs) {
    // Stop existing timer
    if (this.syncTimers.has(tenantId)) {
      clearInterval(this.syncTimers.get(tenantId));
    }

    // Start new timer
    const timer = setInterval(async () => {
      try {
        await this.syncTenant(tenantId);
        console.log(`[TenantCatalogStore] Auto-synced: ${tenantId}`);
      } catch (error) {
        console.error(`[TenantCatalogStore] Auto-sync error for ${tenantId}: ${error.message}`);
      }
    }, intervalMs);

    this.syncTimers.set(tenantId, timer);
    console.log(`[TenantCatalogStore] Started auto-sync for ${tenantId} (every ${intervalMs / 1000}s)`);
  }

  /**
   * Stop automatic sync for tenant
   * @param {string} tenantId - Tenant identifier
   */
  stopAutoSync(tenantId) {
    if (this.syncTimers.has(tenantId)) {
      clearInterval(this.syncTimers.get(tenantId));
      this.syncTimers.delete(tenantId);
      console.log(`[TenantCatalogStore] Stopped auto-sync for ${tenantId}`);
    }
  }

  // ============================================
  // VOICE-OPTIMIZED CATALOG ACCESS
  // ============================================

  /**
   * Browse catalog by category (for browse_catalog tool)
   * @param {string} tenantId - Tenant identifier
   * @param {object} options - Browse options
   * @returns {object} Voice-formatted response
   */
  async browseCatalog(tenantId, options = {}) {
    const cacheKey = `${tenantId}:browse:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      const items = await connector.search('', {
        category: options.category,
        limit: options.limit || 5,
        inStock: options.inStock
      });

      const response = {
        success: true,
        count: items.length,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          currency: item.currency || 'MAD',
          available: item.in_stock || item.available,
          voiceDescription: item.voice_description
        })),
        voiceSummary: this._generateBrowseSummary(items, options.category)
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get product/item details (for get_product_details tool)
   * @param {string} tenantId - Tenant identifier
   * @param {string} itemId - Item identifier
   * @returns {object} Voice-formatted response
   */
  async getItemDetails(tenantId, itemId) {
    const cacheKey = `${tenantId}:item:${itemId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      const item = await connector.getItem(itemId);
      if (!item) {
        return { success: false, error: 'item_not_found' };
      }

      const response = {
        success: true,
        item: {
          id: item.id,
          name: item.name,
          price: item.price,
          currency: item.currency || 'MAD',
          description: item.description,
          category: item.category,
          available: item.in_stock || item.available,
          stock: item.stock,
          variants: item.variants,
          voiceDescription: item.voice_description || this._generateItemVoiceDescription(item)
        }
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get menu (for get_menu tool - restaurants/bakeries)
   * @param {string} tenantId - Tenant identifier
   * @param {object} options - Menu options
   * @returns {object} Voice-formatted response
   */
  async getMenu(tenantId, options = {}) {
    const cacheKey = `${tenantId}:menu:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      await connector.sync();
      const catalog = connector.catalog;

      if (!catalog?.menu) {
        return { success: false, error: 'no_menu_found' };
      }

      let categories = catalog.menu.categories || [];

      // Filter by category if specified
      if (options.category) {
        categories = categories.filter(cat =>
          cat.name.toLowerCase().includes(options.category.toLowerCase())
        );
      }

      // Filter by dietary if specified
      if (options.dietary) {
        categories = categories.map(cat => ({
          ...cat,
          items: cat.items.filter(item =>
            item.dietary?.includes(options.dietary)
          )
        })).filter(cat => cat.items.length > 0);
      }

      const response = {
        success: true,
        menu: {
          categories: categories.map(cat => ({
            name: cat.name,
            items: cat.items.slice(0, options.limit || 10).map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              available: item.available !== false,
              allergens: item.allergens,
              dietary: item.dietary,
              voiceDescription: item.voice_description
            }))
          })),
          specials: catalog.menu.specials
        },
        voiceSummary: this._generateMenuSummary(categories)
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check availability (for check_availability tool)
   * @param {string} tenantId - Tenant identifier
   * @param {string} itemId - Item identifier
   * @param {object} params - Check parameters
   * @returns {object} Voice-formatted response
   */
  async checkAvailability(tenantId, itemId, params = {}) {
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      const availability = await connector.checkAvailability(itemId, params);

      return {
        success: true,
        ...availability,
        voiceResponse: this._generateAvailabilityVoiceResponse(availability)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search catalog (for search_catalog tool)
   * @param {string} tenantId - Tenant identifier
   * @param {string} query - Search query
   * @param {object} filters - Search filters
   * @returns {object} Voice-formatted response
   */
  async searchCatalog(tenantId, query, filters = {}) {
    const cacheKey = `${tenantId}:search:${query}:${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      const results = await connector.search(query, { ...filters, limit: filters.limit || 5 });

      const response = {
        success: true,
        query,
        count: results.length,
        results: results.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          available: item.in_stock || item.available,
          voiceDescription: item.voice_description
        })),
        voiceSummary: this._generateSearchSummary(query, results)
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get services with slots (for get_services/get_slots tools)
   * @param {string} tenantId - Tenant identifier
   * @param {object} options - Options
   * @returns {object} Voice-formatted response
   */
  async getServices(tenantId, options = {}) {
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      await connector.sync();
      const catalog = connector.catalog;

      if (!catalog?.services) {
        return { success: false, error: 'no_services_found' };
      }

      let services = catalog.services;

      // Filter by category
      if (options.category) {
        services = services.filter(s =>
          s.category?.toLowerCase().includes(options.category.toLowerCase())
        );
      }

      const response = {
        success: true,
        services: services.slice(0, options.limit || 10).map(s => ({
          id: s.id,
          name: s.name,
          price: s.price,
          currency: s.currency || 'MAD',
          duration: s.duration_minutes,
          description: s.description,
          voiceDescription: s.voice_description
        })),
        slots: options.date ? catalog.slots?.slots_by_date?.[options.date] : null,
        voiceSummary: this._generateServicesSummary(services)
      };

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available appointment slots for a service
   * Uses CalendarSlotsConnector for real-time Google Calendar availability,
   * or falls back to static slots from catalog JSON
   *
   * @param {string} tenantId - Tenant identifier
   * @param {object} options - Options
   * @param {string} options.date - Date in YYYY-MM-DD format
   * @param {string} options.serviceId - Optional service ID filter
   * @param {object} options.calendarConfig - Calendar configuration (for dynamic slots)
   * @returns {object} Voice-formatted slots response
   */
  async getAvailableSlots(tenantId, options = {}) {
    const date = options.date || new Date().toISOString().split('T')[0];

    // Try CalendarSlotsConnector first for real-time availability
    const calendarStore = getCalendarSlotsStore();
    if (calendarStore) {
      try {
        // Check if tenant has calendar config
        const connector = calendarStore.getConnector(tenantId);
        if (connector || options.calendarConfig) {
          // Register tenant with calendar config if not already registered
          if (!connector && options.calendarConfig) {
            await calendarStore.registerTenant(tenantId, options.calendarConfig);
          }

          const slotsSummary = await calendarStore.getSlots(tenantId, date, options.calendarConfig);

          if (slotsSummary && slotsSummary.availableCount !== undefined) {
            return {
              success: true,
              date,
              slots: slotsSummary.slots || [],
              count: slotsSummary.availableCount,
              source: slotsSummary.source || 'google_calendar',
              nextAvailable: slotsSummary.nextAvailable,
              voiceSummary: slotsSummary.voiceSummary
            };
          }
        }
      } catch (error) {
        console.warn(`[TenantCatalogStore] Calendar slots error for ${tenantId}: ${error.message}`);
        // Fall through to static slots
      }
    }

    // Fallback: Static slots from catalog JSON
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return { success: false, error: 'tenant_not_registered' };
    }

    try {
      if (!connector.catalog) {
        await connector.sync();
      }

      const catalog = connector.catalog;
      let slots = catalog?.slots?.slots_by_date?.[date] || [];

      // Filter by service if provided
      if (options.serviceId && slots.length > 0) {
        slots = slots.filter(slot =>
          slot.available && (!slot.service_ids || slot.service_ids.includes(options.serviceId))
        );
      } else {
        slots = slots.filter(slot => slot.available);
      }

      const voiceSummary = this._generateSlotsSummary(date, slots);

      return {
        success: true,
        date,
        slots,
        count: slots.length,
        source: 'static_catalog',
        voiceSummary
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Book a slot using CalendarSlotsConnector
   * @param {string} tenantId - Tenant identifier
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @param {object} booking - Booking details
   */
  async bookSlot(tenantId, date, time, booking) {
    const calendarStore = getCalendarSlotsStore();
    if (!calendarStore) {
      return { success: false, error: 'calendar_not_available', voiceResponse: 'Le système de réservation n\'est pas disponible.' };
    }

    return await calendarStore.bookSlot(tenantId, date, time, booking);
  }

  // ============================================
  // VOICE RESPONSE GENERATORS
  // ============================================

  _generateSlotsSummary(date, slots) {
    if (!slots || slots.length === 0) {
      return `Aucun créneau disponible pour le ${this._formatDateVoice(date)}.`;
    }

    const times = slots.slice(0, 5).map(s => s.time).join(', ');
    const more = slots.length > 5 ? ` et ${slots.length - 5} autres créneaux` : '';

    return `Pour le ${this._formatDateVoice(date)}, nous avons des créneaux à ${times}${more}. Quel horaire vous conviendrait?`;
  }

  _formatDateVoice(dateStr) {
    const date = new Date(dateStr);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  _generateBrowseSummary(items, category) {
    if (items.length === 0) {
      return category
        ? `Aucun produit trouvé dans la catégorie ${category}.`
        : 'Le catalogue est vide pour le moment.';
    }

    const names = items.slice(0, 3).map(i => i.name).join(', ');
    const more = items.length > 3 ? ` et ${items.length - 3} autres` : '';

    return category
      ? `Dans ${category}, nous avons ${names}${more}.`
      : `Nous proposons ${names}${more}.`;
  }

  _generateItemVoiceDescription(item) {
    let desc = item.name;
    if (item.price) {
      const cur = item.currency || 'EUR';
      const symbol = { 'MAD': 'DH', 'EUR': '€', 'USD': '$', 'GBP': '£' }[cur] || cur;
      desc += ` à ${item.price} ${symbol}`;
    }
    if (item.in_stock === false || item.stock === 0) {
      desc += ', actuellement indisponible';
    }
    return desc;
  }

  _generateMenuSummary(categories) {
    if (categories.length === 0) {
      return 'Le menu n\'est pas disponible actuellement.';
    }

    const catNames = categories.map(c => c.name).join(', ');
    return `Notre carte propose: ${catNames}. Que souhaitez-vous consulter?`;
  }

  _generateAvailabilityVoiceResponse(availability) {
    if (availability.available) {
      if (availability.stock !== undefined) {
        return `${availability.itemName} est disponible, nous en avons ${availability.stock} en stock.`;
      }
      if (availability.slots) {
        return `${availability.itemName} est disponible. Créneaux libres: ${availability.slots.join(', ')}.`;
      }
      return `${availability.itemName} est disponible.`;
    } else {
      if (availability.reason === 'item_not_found') {
        return 'Je n\'ai pas trouvé ce produit dans notre catalogue.';
      }
      return `${availability.itemName || 'Ce produit'} n'est malheureusement pas disponible actuellement.`;
    }
  }

  _generateSearchSummary(query, results) {
    if (results.length === 0) {
      return `Je n'ai rien trouvé pour "${query}". Voulez-vous essayer une autre recherche?`;
    }

    if (results.length === 1) {
      const item = results[0];
      const cur = item.currency || 'EUR';
      const sym = { 'MAD': 'DH', 'EUR': '€', 'USD': '$', 'GBP': '£' }[cur] || cur;
      return item.voiceDescription || `J'ai trouvé ${item.name} à ${item.price} ${sym}.`;
    }

    const names = results.slice(0, 3).map(r => r.name).join(', ');
    return `J'ai trouvé ${results.length} résultats pour "${query}": ${names}.`;
  }

  _generateServicesSummary(services) {
    if (services.length === 0) {
      return 'Aucun service disponible actuellement.';
    }

    const names = services.slice(0, 3).map(s => s.name).join(', ');
    return `Nos services incluent: ${names}. Quel service vous intéresse?`;
  }

  // ============================================
  // STORE MANAGEMENT
  // ============================================

  /**
   * Get store statistics
   */
  getStats() {
    const tenants = [];
    for (const [tenantId, connector] of this.connectors) {
      tenants.push({
        tenantId,
        ...connector.getStatus(),
        autoSync: this.syncTimers.has(tenantId)
      });
    }

    return {
      tenantsCount: this.connectors.size,
      tenants,
      cache: this.cache.getStats(),
      config: {
        cacheMaxSize: CONFIG.cacheMaxSize,
        cacheTTLMs: CONFIG.cacheTTLMs,
        syncIntervalMs: CONFIG.syncIntervalMs
      }
    };
  }

  // ============================================
  // CRUD OPERATIONS FOR DASHBOARD
  // ============================================

  /**
   * Get all items from a catalog type
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Type: PRODUCTS, MENU, SERVICES, FLEET, TRIPS, PACKAGES
   * @returns {Array} Array of items
   */
  getItems(tenantId, catalogType = 'PRODUCTS') {
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      return [];
    }

    try {
      const items = connector._getItems();
      return items || [];
    } catch (error) {
      console.error(`[TenantCatalogStore] getItems error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get single item by ID
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Catalog type
   * @param {string} itemId - Item ID
   * @returns {object|null} Item or null
   */
  getItem(tenantId, catalogType, itemId) {
    const items = this.getItems(tenantId, catalogType);
    return items.find(item => item.id === itemId) || null;
  }

  /**
   * Add new item to catalog
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Catalog type
   * @param {object} item - Item to add
   * @returns {boolean} Success
   */
  addItem(tenantId, catalogType, item) {
    const connector = this.connectors.get(tenantId);
    if (!connector) {
      console.error(`[TenantCatalogStore] Tenant not found: ${tenantId}`);
      return false;
    }

    try {
      // Add to connector's internal catalog
      if (!connector.catalog) {
        connector.catalog = { products: [], items: [] };
      }

      // Determine which array to use based on catalog type
      const arrayKey = catalogType.toLowerCase() === 'menu' ? 'items' :
                       catalogType.toLowerCase() === 'services' ? 'services' :
                       catalogType.toLowerCase() === 'fleet' ? 'vehicles' :
                       catalogType.toLowerCase() === 'trips' ? 'trips' :
                       'products';

      if (!connector.catalog[arrayKey]) {
        connector.catalog[arrayKey] = [];
      }

      connector.catalog[arrayKey].push(item);

      // Invalidate cache for this tenant
      this.invalidateCache(tenantId);

      // Save to disk if using custom connector
      if (connector.config?.dataPath) {
        this._saveTenantCatalog(tenantId, connector.catalog, catalogType);
      }

      return true;
    } catch (error) {
      console.error(`[TenantCatalogStore] addItem error: ${error.message}`);
      return false;
    }
  }

  /**
   * Update existing item
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Catalog type
   * @param {string} itemId - Item ID to update
   * @param {object} updates - Updated item data
   * @returns {boolean} Success
   */
  updateItem(tenantId, catalogType, itemId, updates) {
    const connector = this.connectors.get(tenantId);
    if (!connector) return false;

    try {
      const arrayKey = catalogType.toLowerCase() === 'menu' ? 'items' :
                       catalogType.toLowerCase() === 'services' ? 'services' :
                       catalogType.toLowerCase() === 'fleet' ? 'vehicles' :
                       catalogType.toLowerCase() === 'trips' ? 'trips' :
                       'products';

      const items = connector.catalog?.[arrayKey];
      if (!items) return false;

      const index = items.findIndex(item => item.id === itemId);
      if (index === -1) return false;

      items[index] = { ...items[index], ...updates, id: itemId };

      this.invalidateCache(tenantId);

      if (connector.config?.dataPath) {
        this._saveTenantCatalog(tenantId, connector.catalog, catalogType);
      }

      return true;
    } catch (error) {
      console.error(`[TenantCatalogStore] updateItem error: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove item from catalog
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Catalog type
   * @param {string} itemId - Item ID to remove
   * @returns {boolean} Success
   */
  removeItem(tenantId, catalogType, itemId) {
    const connector = this.connectors.get(tenantId);
    if (!connector) return false;

    try {
      const arrayKey = catalogType.toLowerCase() === 'menu' ? 'items' :
                       catalogType.toLowerCase() === 'services' ? 'services' :
                       catalogType.toLowerCase() === 'fleet' ? 'vehicles' :
                       catalogType.toLowerCase() === 'trips' ? 'trips' :
                       'products';

      const items = connector.catalog?.[arrayKey];
      if (!items) return false;

      const index = items.findIndex(item => item.id === itemId);
      if (index === -1) return false;

      items.splice(index, 1);

      this.invalidateCache(tenantId);

      if (connector.config?.dataPath) {
        this._saveTenantCatalog(tenantId, connector.catalog, catalogType);
      }

      return true;
    } catch (error) {
      console.error(`[TenantCatalogStore] removeItem error: ${error.message}`);
      return false;
    }
  }

  /**
   * Sync catalog for tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} catalogType - Catalog type
   * @param {object} options - Sync options
   * @returns {object} Sync result
   */
  async syncCatalog(tenantId, catalogType, options = {}) {
    return this.syncTenant(tenantId, options);
  }

  /**
   * Invalidate cache for a tenant
   * @param {string} tenantId - Tenant identifier
   */
  invalidateCache(tenantId) {
    // Clear all cache entries for this tenant
    for (const key of this.cache.cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.cache.cache.delete(key);
      }
    }
  }

  /**
   * Save tenant catalog to disk
   * @param {string} tenantId - Tenant identifier
   * @param {object} catalog - Catalog data
   * @param {string} catalogType - Catalog type
   */
  _saveTenantCatalog(tenantId, catalog, catalogType) {
    const tenantDir = `data/catalogs/tenants/${tenantId}`;
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const filename = `${catalogType.toLowerCase()}.json`;
    const filepath = `${tenantDir}/${filename}`;

    fs.writeFileSync(filepath, JSON.stringify({
      tenant_id: tenantId,
      catalog_type: catalogType,
      updated_at: new Date().toISOString(),
      ...catalog
    }, null, 2));
  }

  /**
   * Load store configuration from disk
   */
  _loadConfig() {
    if (fs.existsSync(CONFIG.configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG.configFile, 'utf8'));

        // Restore tenant configurations
        for (const [tenantId, tenantConfig] of Object.entries(config.tenants || {})) {
          this.tenantConfigs.set(tenantId, tenantConfig);

          // Create connector
          const connector = CatalogConnectorFactory.create(tenantId, tenantConfig);
          this.connectors.set(tenantId, connector);
        }

        console.log(`[TenantCatalogStore] Loaded ${this.tenantConfigs.size} tenant configs`);
      } catch (error) {
        console.warn(`[TenantCatalogStore] Failed to load config: ${error.message}`);
      }
    }
  }

  /**
   * Save store configuration to disk
   */
  _saveConfig() {
    const config = {
      version: '1.0.0',
      updated: new Date().toISOString(),
      tenants: Object.fromEntries(this.tenantConfigs)
    };

    fs.writeFileSync(CONFIG.configFile, JSON.stringify(config, null, 2));
  }

  /**
   * Shutdown store gracefully
   */
  async shutdown() {
    // Stop all sync timers
    for (const [tenantId] of this.syncTimers) {
      this.stopAutoSync(tenantId);
    }

    // Disconnect all connectors
    for (const [tenantId, connector] of this.connectors) {
      await connector.disconnect();
    }

    // Clear cache
    this.cache.clear();

    console.log('[TenantCatalogStore] Shutdown complete');
  }
}

// Singleton instance
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new TenantCatalogStore();
  }
  return instance;
}

// Export
module.exports = {
  TenantCatalogStore,
  getInstance,
  CONFIG
};

// CLI Test
if (require.main === module) {
  (async () => {
    console.log('=== VocalIA Tenant Catalog Store Test ===\n');

    const store = getInstance();
    await store.init();

    // Register test tenant
    await store.registerTenant('restaurant_test', {
      type: 'custom',
      catalogType: CATALOG_TYPES.MENU
    });

    // Create sample menu
    const connector = store.getConnector('restaurant_test');
    await connector.saveCatalog({
      menu: {
        categories: [
          {
            name: 'Entrées',
            items: [
              {
                id: 'E01',
                name: 'Salade Marocaine',
                price: 35,
                available: true,
                allergens: [],
                dietary: ['vegan', 'gluten-free'],
                voice_description: 'Salade marocaine fraîche à 35 dirhams, végane et sans gluten'
              },
              {
                id: 'E02',
                name: 'Briouates',
                price: 45,
                available: true,
                allergens: ['gluten'],
                dietary: [],
                voice_description: 'Briouates croustillantes à 45 dirhams'
              }
            ]
          },
          {
            name: 'Plats',
            items: [
              {
                id: 'P01',
                name: 'Couscous Royal',
                price: 120,
                available: true,
                allergens: ['gluten'],
                dietary: [],
                preparation_time: '25min',
                voice_description: 'Couscous royal avec agneau, poulet et merguez à 120 dirhams'
              },
              {
                id: 'P02',
                name: 'Tajine Agneau',
                price: 95,
                available: false,
                allergens: [],
                dietary: [],
                voice_description: 'Tajine d\'agneau aux pruneaux à 95 dirhams'
              }
            ]
          }
        ],
        specials: {
          menu_du_jour: {
            price: 85,
            includes: ['entrée', 'plat', 'dessert'],
            voice_description: 'Menu du jour à 85 dirhams avec entrée, plat et dessert'
          }
        }
      }
    });

    // Test getMenu
    console.log('\n--- Test getMenu ---');
    const menu = await store.getMenu('restaurant_test');
    console.log('Menu categories:', menu.menu?.categories?.length);
    console.log('Voice summary:', menu.voiceSummary);

    // Test search
    console.log('\n--- Test searchCatalog ---');
    const search = await store.searchCatalog('restaurant_test', 'couscous');
    console.log('Search results:', search.count);
    console.log('Voice summary:', search.voiceSummary);

    // Test availability
    console.log('\n--- Test checkAvailability ---');
    const avail = await store.checkAvailability('restaurant_test', 'P02');
    console.log('Availability:', avail.available);
    console.log('Voice response:', avail.voiceResponse);

    // Stats
    console.log('\n--- Store Stats ---');
    console.log(JSON.stringify(store.getStats(), null, 2));

    // Cleanup
    await store.unregisterTenant('restaurant_test');
    await store.shutdown();

    console.log('\n✅ Tenant Catalog Store Test Complete');
  })();
}
