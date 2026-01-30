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

const CLIENTS_DIR = path.join(process.cwd(), 'clients');

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
                'AE': { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
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

// Cache loaded configs
const configCache = new Map();

/**
 * Load client config from file
 * @param {string} tenantId
 * @returns {Object|null}
 */
function loadConfigFromFile(tenantId) {
    const configPath = path.join(CLIENTS_DIR, tenantId, 'config.json');

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
            integrations: normalizeIntegrations(config.integrations)
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
        // Check cache first
        if (configCache.has(tenantId)) {
            return configCache.get(tenantId);
        }

        // Try file-based config
        let config = loadConfigFromFile(tenantId);

        // Fallback to hardcoded
        if (!config) {
            config = FALLBACK_CLIENTS[tenantId] || FALLBACK_CLIENTS['agency_internal'];
        }

        // Cache and return
        configCache.set(tenantId, config);
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
}

module.exports = ClientRegistry;
