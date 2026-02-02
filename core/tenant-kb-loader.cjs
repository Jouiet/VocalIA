#!/usr/bin/env node
/**
 * VocalIA - Tenant Knowledge Base Loader
 *
 * Role: Multi-tenant KB loading with priority chain + LRU cache
 * Purpose: Each client = unique Knowledge Base + Universal fallback
 *
 * Priority Chain:
 *   1. Client KB [requested language]
 *   2. Client KB [default language]
 *   3. Universal KB [requested language]
 *   4. Universal KB [fr] (ultimate fallback)
 *
 * Version: 1.0.0 | Session 250.45 | 02/02/2026
 */

const fs = require('fs');
const path = require('path');

// Paths
const CLIENTS_DIR = path.join(__dirname, '../clients');
const TELEPHONY_DIR = path.join(__dirname, '../telephony');
const DATA_DIR = path.join(__dirname, '../data/knowledge-base/tenants');

// Supported languages
const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];
const DEFAULT_LANGUAGE = 'fr';

/**
 * LRU Cache for KB data
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

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

/**
 * TenantKBLoader - Multi-tenant Knowledge Base Loader
 */
class TenantKBLoader {
  constructor(options = {}) {
    this.cache = new LRUCache(
      options.maxCacheSize || 100,
      options.cacheTTL || 5 * 60 * 1000
    );
    this.universalKB = {};
    this.watchedFiles = new Map();
    this.loadUniversalKB();
  }

  /**
   * Load universal KB files at startup
   */
  loadUniversalKB() {
    for (const lang of SUPPORTED_LANGUAGES) {
      const filename = lang === 'fr' ? 'knowledge_base.json' : `knowledge_base_${lang}.json`;
      const filepath = path.join(TELEPHONY_DIR, filename);

      if (fs.existsSync(filepath)) {
        try {
          this.universalKB[lang] = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          console.log(`✅ [TenantKB] Universal KB loaded: ${lang} (${Object.keys(this.universalKB[lang]).length} personas)`);
        } catch (e) {
          console.error(`❌ [TenantKB] Failed to load universal KB ${lang}:`, e.message);
          this.universalKB[lang] = {};
        }
      } else {
        this.universalKB[lang] = {};
      }
    }
  }

  /**
   * Get KB for a specific tenant and language
   * @param {string} tenantId - Tenant identifier
   * @param {string} language - Requested language code
   * @param {string} personaId - Optional persona ID for filtered response
   * @returns {Promise<Object>} - Merged KB data
   */
  async getKB(tenantId, language = DEFAULT_LANGUAGE, personaId = null) {
    const lang = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
    const cacheKey = `${tenantId}:${lang}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[TenantKB] Cache hit: ${cacheKey}`);
      return personaId ? this.extractPersona(cached, personaId) : cached;
    }

    // Load with fallback chain
    const kb = await this.loadWithFallback(tenantId, lang);

    // Cache result
    this.cache.set(cacheKey, kb);

    return personaId ? this.extractPersona(kb, personaId) : kb;
  }

  /**
   * Load KB with priority fallback chain
   */
  async loadWithFallback(tenantId, language) {
    const clientDir = path.join(CLIENTS_DIR, tenantId, 'knowledge_base');
    const defaultLang = await this.getClientDefaultLanguage(tenantId);

    const loadPaths = [
      // P1: Client KB [requested language]
      { path: path.join(clientDir, `kb_${language}.json`), type: 'client', lang: language },
      // P2: Client KB [default language]
      { path: path.join(clientDir, `kb_${defaultLang}.json`), type: 'client', lang: defaultLang },
      // P3: Universal KB [requested language]
      { path: null, type: 'universal', lang: language },
      // P4: Universal KB [fr] (ultimate fallback)
      { path: null, type: 'universal', lang: 'fr' }
    ];

    let clientKB = null;
    let universalKB = null;

    for (const { path: filepath, type, lang } of loadPaths) {
      if (type === 'client') {
        if (filepath && fs.existsSync(filepath) && !clientKB) {
          try {
            clientKB = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            console.log(`[TenantKB] Loaded client KB: ${tenantId}/${lang}`);
          } catch (e) {
            console.error(`[TenantKB] Error loading ${filepath}:`, e.message);
          }
        }
      } else if (type === 'universal' && !universalKB) {
        if (this.universalKB[lang] && Object.keys(this.universalKB[lang]).length > 0) {
          universalKB = this.universalKB[lang];
          console.log(`[TenantKB] Using universal KB: ${lang}`);
        }
      }
    }

    // Merge: Client overrides Universal
    return this.mergeKB(universalKB || {}, clientKB || {});
  }

  /**
   * Get client's default language from config
   */
  async getClientDefaultLanguage(tenantId) {
    const configPath = path.join(CLIENTS_DIR, tenantId, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.default_language || config.market_rules?.default?.lang || DEFAULT_LANGUAGE;
      } catch (e) {
        return DEFAULT_LANGUAGE;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  /**
   * Merge Universal KB with Client KB (client overrides universal)
   */
  mergeKB(universalKB, clientKB) {
    const merged = { ...universalKB };

    // Extract metadata from client KB
    const clientMeta = clientKB.__meta || {};
    delete clientKB.__meta;

    // Merge each key
    for (const [key, value] of Object.entries(clientKB)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Deep merge for objects
        merged[key] = {
          ...(merged[key] || {}),
          ...value
        };
      } else {
        // Direct override for primitives and arrays
        merged[key] = value;
      }
    }

    // Add metadata
    merged.__meta = {
      ...clientMeta,
      merged: true,
      universalPersonas: Object.keys(universalKB).length,
      clientOverrides: Object.keys(clientKB).length
    };

    return merged;
  }

  /**
   * Extract specific persona from KB
   */
  extractPersona(kb, personaId) {
    if (!personaId) return kb;

    const persona = kb[personaId];
    if (!persona) {
      console.warn(`[TenantKB] Persona not found: ${personaId}`);
      return null;
    }

    return persona;
  }

  /**
   * Invalidate cache for a tenant
   */
  invalidateCache(tenantId) {
    this.cache.invalidate(`${tenantId}:`);
    console.log(`[TenantKB] Cache invalidated for tenant: ${tenantId}`);
  }

  /**
   * Refresh universal KB (hot-reload)
   */
  refreshUniversalKB() {
    console.log('[TenantKB] Refreshing universal KB...');
    this.loadUniversalKB();
    this.cache.clear();
    console.log('[TenantKB] Universal KB refreshed, cache cleared');
  }

  /**
   * Watch a client KB directory for changes (hot-reload)
   */
  watchClient(tenantId) {
    const clientDir = path.join(CLIENTS_DIR, tenantId, 'knowledge_base');

    if (!fs.existsSync(clientDir)) {
      console.warn(`[TenantKB] Cannot watch: ${clientDir} does not exist`);
      return;
    }

    const watcher = fs.watch(clientDir, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        console.log(`[TenantKB] File changed: ${tenantId}/${filename}, invalidating cache...`);
        this.invalidateCache(tenantId);
      }
    });

    this.watchedFiles.set(tenantId, watcher);
    console.log(`[TenantKB] Watching: ${clientDir}`);
  }

  /**
   * Stop watching a client
   */
  unwatchClient(tenantId) {
    const watcher = this.watchedFiles.get(tenantId);
    if (watcher) {
      watcher.close();
      this.watchedFiles.delete(tenantId);
      console.log(`[TenantKB] Stopped watching: ${tenantId}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cache: this.cache.stats(),
      universalKB: Object.fromEntries(
        Object.entries(this.universalKB).map(([lang, kb]) => [lang, Object.keys(kb).length])
      ),
      watchedClients: [...this.watchedFiles.keys()]
    };
  }

  /**
   * Search KB for a tenant
   */
  async searchKB(tenantId, language, query, options = {}) {
    const kb = await this.getKB(tenantId, language);
    const results = [];
    const queryLower = query.toLowerCase();
    const maxResults = options.maxResults || 5;

    // Simple keyword search across all KB entries
    for (const [key, value] of Object.entries(kb)) {
      if (key === '__meta') continue;

      const searchText = JSON.stringify(value).toLowerCase();
      if (searchText.includes(queryLower)) {
        results.push({
          key,
          score: this.calculateRelevance(searchText, queryLower),
          data: value
        });
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Calculate simple relevance score
   */
  calculateRelevance(text, query) {
    const words = query.split(/\s+/);
    let score = 0;

    for (const word of words) {
      const regex = new RegExp(word, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    return score;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    for (const tenantId of this.watchedFiles.keys()) {
      this.unwatchClient(tenantId);
    }
    this.cache.clear();
    console.log('[TenantKB] Cleanup complete');
  }
}

// Singleton instance
let instance = null;

function getInstance(options = {}) {
  if (!instance) {
    instance = new TenantKBLoader(options);
  }
  return instance;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
VocalIA Tenant KB Loader

Usage:
  node tenant-kb-loader.cjs [options]

Options:
  --help              Show this help
  --stats             Show cache statistics
  --tenant <id>       Test loading KB for tenant
  --lang <code>       Language code (fr, en, es, ar, ary)
  --refresh           Refresh universal KB
  --search <query>    Search KB for tenant

Examples:
  node tenant-kb-loader.cjs --stats
  node tenant-kb-loader.cjs --tenant client_demo --lang fr
  node tenant-kb-loader.cjs --tenant salon_elegance --search "horaires"
`);
    process.exit(0);
  }

  const loader = getInstance();

  if (args.includes('--stats')) {
    console.log('\n📊 TenantKB Statistics:');
    console.log(JSON.stringify(loader.getStats(), null, 2));
    process.exit(0);
  }

  if (args.includes('--refresh')) {
    loader.refreshUniversalKB();
    process.exit(0);
  }

  const tenantIdx = args.indexOf('--tenant');
  if (tenantIdx !== -1 && args[tenantIdx + 1]) {
    const tenantId = args[tenantIdx + 1];
    const langIdx = args.indexOf('--lang');
    const lang = langIdx !== -1 && args[langIdx + 1] ? args[langIdx + 1] : 'fr';

    const searchIdx = args.indexOf('--search');
    if (searchIdx !== -1 && args[searchIdx + 1]) {
      const query = args[searchIdx + 1];
      loader.searchKB(tenantId, lang, query).then(results => {
        console.log(`\n🔍 Search results for "${query}" (${tenantId}/${lang}):`);
        console.log(JSON.stringify(results, null, 2));
      });
    } else {
      loader.getKB(tenantId, lang).then(kb => {
        console.log(`\n📚 KB for ${tenantId}/${lang}:`);
        console.log(`   Total entries: ${Object.keys(kb).length}`);
        console.log(`   Keys: ${Object.keys(kb).slice(0, 10).join(', ')}${Object.keys(kb).length > 10 ? '...' : ''}`);
        if (kb.__meta) {
          console.log(`   Meta: ${JSON.stringify(kb.__meta)}`);
        }
      });
    }
  } else if (!args.includes('--stats') && !args.includes('--refresh')) {
    console.log('\n📊 TenantKB Statistics:');
    console.log(JSON.stringify(loader.getStats(), null, 2));
  }
}

module.exports = {
  TenantKBLoader,
  getInstance,
  LRUCache,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
