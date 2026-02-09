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
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

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
    const clientDir = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'knowledge_base');
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
    const configPath = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'config.json');

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
    const clientDir = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'knowledge_base');

    if (!fs.existsSync(clientDir)) {
      console.warn(`[TenantKB] Cannot watch: ${clientDir} does not exist`);
      return;
    }

    // Close existing watcher before creating a new one (prevent leak)
    const existing = this.watchedFiles.get(tenantId);
    if (existing) {
      existing.close();
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
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    return score;
  }

  /**
   * Import bulk KB entries from JSON or CSV data
   * @param {string} tenantId - Tenant identifier
   * @param {string} language - Language code
   * @param {object|Array} data - JSON object or array of entries
   * @param {object} options - Import options
   * @returns {object} Import result with counts
   */
  async importBulk(tenantId, language, data, options = {}) {
    const kbDir = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'knowledge_base');
    const kbPath = path.join(kbDir, `kb_${language}.json`);

    // Ensure directory exists
    if (!fs.existsSync(kbDir)) {
      fs.mkdirSync(kbDir, { recursive: true });
    }

    // Load existing KB or create new
    let existingKB = {};
    if (fs.existsSync(kbPath)) {
      try {
        existingKB = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
      } catch (e) {
        console.warn(`[TenantKB] Could not parse existing KB: ${e.message}`);
      }
    }

    // Process import data
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Handle array format (CSV-like)
    if (Array.isArray(data)) {
      for (const entry of data) {
        try {
          if (!entry.key) {
            skipped++;
            errors.push({ entry, error: 'Missing key field' });
            continue;
          }

          const key = entry.key;
          delete entry.key;

          if (existingKB[key]) {
            if (options.overwrite !== false) {
              existingKB[key] = entry;
              updated++;
            } else {
              skipped++;
            }
          } else {
            existingKB[key] = entry;
            imported++;
          }
        } catch (e) {
          skipped++;
          errors.push({ entry, error: e.message });
        }
      }
    }
    // Handle object format (JSON)
    else if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (key === '__meta') continue;

        try {
          if (existingKB[key]) {
            if (options.overwrite !== false) {
              existingKB[key] = value;
              updated++;
            } else {
              skipped++;
            }
          } else {
            existingKB[key] = value;
            imported++;
          }
        } catch (e) {
          skipped++;
          errors.push({ key, error: e.message });
        }
      }
    }

    // Update metadata
    existingKB.__meta = {
      ...(existingKB.__meta || {}),
      tenant_id: tenantId,
      last_updated: new Date().toISOString(),
      last_import: {
        timestamp: new Date().toISOString(),
        imported,
        updated,
        skipped
      }
    };

    // Save KB
    fs.writeFileSync(kbPath, JSON.stringify(existingKB, null, 2));

    // Invalidate cache
    this.invalidateCache(tenantId);

    console.log(`[TenantKB] Bulk import for ${tenantId}/${language}: +${imported} new, ${updated} updated, ${skipped} skipped`);

    return {
      success: true,
      tenant_id: tenantId,
      language,
      imported,
      updated,
      skipped,
      total: Object.keys(existingKB).filter(k => k !== '__meta').length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Rebuild TF-IDF index for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} language - Language code (optional, rebuilds all if not specified)
   * @returns {object} Rebuild result
   */
  async rebuildIndex(tenantId, language = null) {
    const indexDir = path.join(DATA_DIR, sanitizeTenantId(tenantId));

    // Ensure directory exists
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }

    const languages = language ? [language] : SUPPORTED_LANGUAGES;
    const results = {};
    let totalChunks = 0;
    let totalVocabulary = 0;

    for (const lang of languages) {
      try {
        const kb = await this.getKB(tenantId, lang);
        const chunks = [];
        const vocabulary = new Map();

        // Build chunks from KB entries
        for (const [key, value] of Object.entries(kb)) {
          if (key === '__meta') continue;

          const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const tokens = this.tokenize(text);

          chunks.push({
            id: `${tenantId}:${lang}:${key}`,
            key,
            language: lang,
            text,
            tokens,
            tokenCount: tokens.length
          });

          // Build vocabulary
          for (const token of tokens) {
            vocabulary.set(token, (vocabulary.get(token) || 0) + 1);
          }
        }

        // Calculate TF-IDF scores
        const docCount = chunks.length;
        const tfidfIndex = {
          docCount,
          vocabulary: Object.fromEntries(vocabulary),
          idf: {}
        };

        for (const [term, docFreq] of vocabulary) {
          tfidfIndex.idf[term] = Math.log((docCount + 1) / (docFreq + 1)) + 1;
        }

        results[lang] = {
          chunks: chunks.length,
          vocabulary: vocabulary.size,
          success: true
        };

        totalChunks += chunks.length;
        totalVocabulary += vocabulary.size;

        // Save index files
        const langIndexDir = path.join(indexDir, lang);
        if (!fs.existsSync(langIndexDir)) {
          fs.mkdirSync(langIndexDir, { recursive: true });
        }

        fs.writeFileSync(
          path.join(langIndexDir, 'chunks.json'),
          JSON.stringify(chunks, null, 2)
        );
        fs.writeFileSync(
          path.join(langIndexDir, 'tfidf_index.json'),
          JSON.stringify(tfidfIndex, null, 2)
        );

        console.log(`[TenantKB] Index rebuilt for ${tenantId}/${lang}: ${chunks.length} chunks, ${vocabulary.size} terms`);
      } catch (e) {
        results[lang] = {
          success: false,
          error: e.message
        };
        console.error(`[TenantKB] Index rebuild failed for ${tenantId}/${lang}: ${e.message}`);
      }
    }

    return {
      success: true,
      tenant_id: tenantId,
      languages: Object.keys(results),
      totalChunks,
      totalVocabulary,
      results
    };
  }

  /**
   * Tokenize text for TF-IDF
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')  // Keep Arabic characters
      .split(/\s+/)
      .filter(token => token.length > 2);
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
