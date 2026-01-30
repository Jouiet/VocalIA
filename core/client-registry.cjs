/**
 * VocalIA Client Registry
 * Central source of truth for Tenant Configurations.
 * 
 * Tenants:
 * - 'agency_internal': The VocalIA Vitrine (Strict Market Rules: MA=FR/MAD, EU=FR/EUR, etc.)
 * - 'client_demo': A fictional SaaS client (e.g. US-based E-commerce)
 */

const CLIENTS = {
    // 1. INTERNAL (The Agency / Vitrine)
    'agency_internal': {
        id: 'agency_internal',
        name: 'VocalIA Internal',
        type: 'agency',
        // Strict Market Rules from Phase 6
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
        integrations: {
            shopify: false,
            hubspot: true
        }
    },

    // 2. DEMO CLIENT (SaaS Example)
    'client_demo': {
        id: 'client_demo',
        name: 'Demo Corp US',
        type: 'client',
        // Custom Rules: Always USD, English
        marketRules: {
            strict: false,
            markets: {}, // No overrides
            default: { id: 'us_main', lang: 'en', currency: 'USD', symbol: '$', label: 'US Main' }
        },
        integrations: {
            shopify: true,
            hubspot: false
        }
    }
};

class ClientRegistry {
    /**
     * Get Client Configuration by Tenant ID
     * @param {string} tenantId 
     * @returns {Object} Client Config
     */
    static getClient(tenantId) {
        return CLIENTS[tenantId] || CLIENTS['agency_internal']; // Default to internal for safety
    }

    static getAllClients() {
        return CLIENTS;
    }
}

module.exports = ClientRegistry;
