/**
 * VocalIA Client Registry
 * Central source of truth for Tenant Configurations.
 *
 * Session 249.2: Updated to load from clients/ directory (file-based)
 * Fallback to hardcoded for backward compatibility.
 *
 * Tenants loaded from: clients/{tenant_id}/config.json
 */

const fs = require('fs');
const path = require('path');

const { sanitizeTenantId } = require('./voice-api-utils.cjs');

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');

// Fallback hardcoded configs (backward compatibility)
const FALLBACK_CLIENTS = {
  'agency_internal': {
    id: 'agency_internal',
    name: 'VocalIA Internal',
    type: 'agency',
    marketRules: {
      strict: true,
      markets: {
        'MA': { id: 'maroc', lang: 'fr', currency: 'MAD', symbol: 'DH', label: 'Maroc' },
        'DZ': { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
        'TN': { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
        'FR': { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
        'AE': { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' }, // Fix F10b: ar not en (MENA→AR strategy)
        'US': { id: 'intl', lang: 'en', currency: 'USD', symbol: '$', label: 'International' }
      },
      default: { id: 'intl', lang: 'en', currency: 'USD', symbol: '$', label: 'International' }
    },
    integrations: { shopify: false, hubspot: true }
  },
  'client_demo': {
    id: 'client_demo',
    name: 'Demo Corp US',
    type: 'client',
    marketRules: {
      strict: false,
      markets: {},
      default: { id: 'us_main', lang: 'en', currency: 'USD', symbol: '$', label: 'US Main' }
    },
    integrations: { shopify: true, hubspot: false }
  }
};

// Cache loaded configs (with TTL)
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Load client config from file
 * @param {string} tenantId
 * @returns {Object|null}
 */
function loadConfigFromFile(tenantId) {
  const configPath = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    // Normalize to expected format
    return {
      id: config.tenant_id || tenantId,
      name: config.name,
      type: config.type,
      vertical: config.vertical,
      plan: config.plan,
      status: config.status,
      features: config.features,
      marketRules: config.market_rules || config.marketRules,
      integrations: normalizeIntegrations(config.integrations),
      integration_configs: config.integrations || {} // Preservation of raw config (Session 250.80)
    };
  } catch (error) {
    console.error(`[ClientRegistry] Failed to load ${tenantId}: ${error.message}`);
    return null;
  }
}

/**
 * Normalize integrations to simple boolean format for backward compat
 */
function normalizeIntegrations(integrations) {
  if (!integrations) return {};

  const normalized = {};
  for (const [key, value] of Object.entries(integrations)) {
    if (typeof value === 'boolean') {
      normalized[key] = value;
    } else if (typeof value === 'object') {
      normalized[key] = value.enabled === true;
    }
  }
  return normalized;
}

class ClientRegistry {
  /**
   * Get Client Configuration by Tenant ID
   * @param {string} tenantId
   * @returns {Object} Client Config
   */
  static getClient(tenantId) {
  // Check cache first (with TTL)
    const cached = configCache.get(tenantId);
    if (cached && Date.now() - cached._cachedAt < CACHE_TTL) {
      return cached.config;
    }

    // Try file-based config
    let config = loadConfigFromFile(tenantId);

    // Fallback to hardcoded
    if (!config) {
      config = FALLBACK_CLIENTS[tenantId] || null;
    }

    // Evict oldest if at capacity
    if (configCache.size >= MAX_CACHE_SIZE && !configCache.has(tenantId)) {
      const oldest = configCache.keys().next().value;
      configCache.delete(oldest);
    }

    // Cache and return
    configCache.set(tenantId, { config, _cachedAt: Date.now() });
    return config;
  }

  /**
   * Get all clients (from files + fallback)
   */
  static getAllClients() {
    const clients = { ...FALLBACK_CLIENTS };

    // Load from files
    if (fs.existsSync(CLIENTS_DIR)) {
      const dirs = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory() && !dir.name.startsWith('_')) {
          const config = loadConfigFromFile(dir.name);
          if (config) {
            clients[dir.name] = config;
          }
        }
      }
    }

    return clients;
  }

  /**
   * Clear config cache (for hot reload)
   */
  static clearCache() {
    configCache.clear();
  }

  /**
   * List all tenant IDs
   */
  static listTenants() {
    const tenants = new Set(Object.keys(FALLBACK_CLIENTS));

    if (fs.existsSync(CLIENTS_DIR)) {
      const dirs = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory() && !dir.name.startsWith('_')) {
          tenants.add(dir.name);
        }
      }
    }

    return Array.from(tenants);
  }

  /**
   * Find Tenant ID by Twilio AccountSid (Reverse Lookup)
   * Critical for BYOK Webhook Validation
   * @param {string} accountSid
   * @returns {string|null} tenantId
   */
  static getTenantIdByTwilioSid(accountSid) {
    if (!accountSid) return null;

    const allClients = this.getAllClients();
    for (const [tenantId, config] of Object.entries(allClients)) {
    // Check nested integration config (New Standard)
    // Uses integration_configs to bypass boolean normalization
      if (config.integration_configs?.twilio?.account_sid === accountSid) {
        return tenantId;
      }
      // Check potential root level or legacy (Defensive)
      if (config.twilio_account_sid === accountSid) {
        return tenantId;
      }
    }
    return null;
  }
}

module.exports = ClientRegistry;
