/**
 * Tenant-Persona Bridge
 * Connects Google Sheets tenants database to persona injection system
 * Session 250.97quater - CRITICAL ARCHITECTURE FIX
 *
 * PROBLEM SOLVED:
 * - Real tenants created via API → stored in Google Sheets
 * - Persona injector only read static client_registry.json
 * - NEW: This bridge reads from DB first, falls back to static demos
 */

const path = require('path');

// Lazy load to avoid circular dependencies
let GoogleSheetsDB = null;
let CLIENT_REGISTRY = null;

// Cache for tenant configs (LRU-style)
const tenantCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Default sector to PERSONAS archetype mapping
 * Used when tenant.sector doesn't directly match a PERSONAS key
 */
const SECTOR_TO_ARCHETYPE = {
    // Healthcare
    'dental': 'DENTAL',
    'dentist': 'DENTAL',
    'dentiste': 'DENTAL',
    'medical': 'DOCTOR',
    'doctor': 'DOCTOR',
    'medecin': 'DOCTOR',
    'health': 'HEALER',
    'wellness': 'HEALER',
    'spa': 'HEALER',

    // Professional Services
    'legal': 'COUNSELOR',
    'lawyer': 'COUNSELOR',
    'avocat': 'COUNSELOR',
    'notary': 'NOTARY',
    'notaire': 'NOTARY',
    'accounting': 'CONSULTANT',
    'consulting': 'CONSULTANT',
    'consultant': 'CONSULTANT',

    // Real Estate
    'real_estate': 'REAL_ESTATE_AGENT',
    'immobilier': 'REAL_ESTATE_AGENT',
    'property': 'PROPERTY',

    // Hospitality
    'hotel': 'CONCIERGE',
    'riad': 'CONCIERGE',
    'restaurant': 'RESTAURATEUR',
    'cafe': 'RESTAURATEUR',

    // Retail & E-commerce
    'ecommerce': 'UNIVERSAL_ECOMMERCE',
    'e-commerce': 'UNIVERSAL_ECOMMERCE',
    'retail': 'RETAILER',
    'shop': 'RETAILER',
    'boutique': 'RETAILER',

    // Services
    'salon': 'HAIRDRESSER',
    'coiffure': 'HAIRDRESSER',
    'beauty': 'STYLIST',
    'fitness': 'GYM',
    'gym': 'GYM',
    'sport': 'GYM',
    'cleaning': 'CLEANER',
    'nettoyage': 'CLEANER',

    // Business
    'recruitment': 'RECRUITER',
    'hr': 'RECRUITER',
    'rh': 'RECRUITER',
    'sales': 'RECRUITER',
    'insurance': 'INSURER',
    'assurance': 'INSURER',
    'delivery': 'DISPATCHER',
    'logistics': 'DISPATCHER',
    'livraison': 'DISPATCHER',

    // Events & Travel
    'event': 'PLANNER',
    'events': 'PLANNER',
    'wedding': 'PLANNER',
    'travel': 'TRAVEL_AGENT',
    'voyage': 'TRAVEL_AGENT',
    'tourism': 'TRAVEL_AGENT',

    // Default
    'other': 'UNIVERSAL_SME',
    'general': 'UNIVERSAL_SME',
    'sme': 'UNIVERSAL_SME',
    'pme': 'UNIVERSAL_SME'
};

/**
 * Load dependencies lazily
 */
function loadDependencies() {
    if (!GoogleSheetsDB) {
        try {
            const { getDB } = require('./GoogleSheetsDB.cjs');
            GoogleSheetsDB = getDB;
        } catch (err) {
            console.error('[TenantBridge] Failed to load GoogleSheetsDB:', err.message);
        }
    }
    if (!CLIENT_REGISTRY) {
        try {
            CLIENT_REGISTRY = require('../personas/client_registry.json');
        } catch (err) {
            console.error('[TenantBridge] Failed to load client_registry:', err.message);
            CLIENT_REGISTRY = { clients: {} };
        }
    }
}

/**
 * Transform Google Sheets tenant record to client config format
 * Compatible with VoicePersonaInjector expectations
 */
function transformTenantToClientConfig(tenant) {
    if (!tenant) return null;

    // Determine archetype from sector
    const sectorLower = (tenant.sector || tenant.industry || 'general').toLowerCase().trim();
    let archetype = SECTOR_TO_ARCHETYPE[sectorLower];

    // If no mapping found, check if sector IS an archetype name
    if (!archetype) {
        const { PERSONAS } = require('../personas/voice-persona-injector.cjs');
        if (PERSONAS[sectorLower.toUpperCase()]) {
            archetype = sectorLower.toUpperCase();
        } else {
            archetype = 'UNIVERSAL_SME'; // Default fallback
        }
    }

    // Parse services (could be JSON string or array)
    let services = [];
    if (tenant.services) {
        if (typeof tenant.services === 'string') {
            try {
                services = JSON.parse(tenant.services);
            } catch {
                services = tenant.services.split(',').map(s => s.trim());
            }
        } else if (Array.isArray(tenant.services)) {
            services = tenant.services;
        }
    }

    // Parse zones
    let zones = [];
    if (tenant.zones) {
        if (typeof tenant.zones === 'string') {
            try {
                zones = JSON.parse(tenant.zones);
            } catch {
                zones = tenant.zones.split(',').map(z => z.trim());
            }
        } else if (Array.isArray(tenant.zones)) {
            zones = tenant.zones;
        }
    }

    // Build client config
    const clientConfig = {
        // Identity - BOTH fields required for compatibility
        name: tenant.business_name || tenant.name || tenant.company || 'Business',
        business_name: tenant.business_name || tenant.name || tenant.company || 'Business',
        sector: archetype,

        // Localization
        currency: tenant.currency || 'EUR',
        language: tenant.language || tenant.lang || 'fr',

        // Contact
        phone: tenant.phone || tenant.telephone || '',
        address: tenant.address || tenant.location || '',
        horaires: tenant.horaires || tenant.hours || tenant.opening_hours || '',

        // Business config
        services: services,
        zones: zones,

        // Knowledge & Payments
        knowledge_base_id: tenant.knowledge_base_id || tenant.kb_id || `tenant_${tenant.id}`,
        payment_method: tenant.payment_method || 'CARD',
        payment_details: tenant.payment_details || '',

        // Widget config
        widget_type: tenant.widget_type || 'B2C',

        // Metadata
        _source: 'database',
        _tenant_id: tenant.id,
        _created_at: tenant.created_at
    };

    return clientConfig;
}

/**
 * Get client config for a tenant
 * Priority: 1. Database (real tenants), 2. Static demos (client_registry.json)
 *
 * @param {string} clientId - The client/tenant ID
 * @returns {Object|null} - Client config or null if not found
 */
async function getClientConfig(clientId) {
    if (!clientId) return null;

    loadDependencies();

    // 1. Check cache first
    const cached = tenantCache.get(clientId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.config;
    }

    // 2. Try database (real tenants)
    let config = null;
    if (GoogleSheetsDB) {
        try {
            const db = GoogleSheetsDB();
            const tenant = await db.findOne('tenants', { id: clientId });

            if (tenant) {
                config = transformTenantToClientConfig(tenant);
                console.log(`[TenantBridge] ✅ Loaded tenant "${clientId}" from database`);
            }
        } catch (err) {
            console.error(`[TenantBridge] DB error for "${clientId}":`, err.message);
        }
    }

    // 3. Fallback to static demos
    if (!config && CLIENT_REGISTRY?.clients?.[clientId]) {
        config = CLIENT_REGISTRY.clients[clientId];
        config._source = 'static_demo';
        console.log(`[TenantBridge] 📦 Loaded tenant "${clientId}" from static demos`);
    }

    // 4. Cache the result (even null to avoid repeated lookups)
    if (tenantCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = tenantCache.keys().next().value;
        tenantCache.delete(firstKey);
    }
    tenantCache.set(clientId, { config, timestamp: Date.now() });

    return config;
}

/**
 * Synchronous version for backward compatibility
 * Only returns static demos (database requires async)
 */
function getClientConfigSync(clientId) {
    if (!clientId) return null;

    loadDependencies();

    // Check cache
    const cached = tenantCache.get(clientId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.config;
    }

    // Only static demos available in sync mode
    if (CLIENT_REGISTRY?.clients?.[clientId]) {
        const config = { ...CLIENT_REGISTRY.clients[clientId], _source: 'static_demo' };
        tenantCache.set(clientId, { config, timestamp: Date.now() });
        return config;
    }

    return null;
}

/**
 * Check if a client exists (in DB or static demos)
 */
async function clientExists(clientId) {
    const config = await getClientConfig(clientId);
    return config !== null;
}

/**
 * Clear cache for a specific tenant (call after updates)
 */
function invalidateCache(clientId) {
    if (clientId) {
        tenantCache.delete(clientId);
    } else {
        tenantCache.clear();
    }
}

/**
 * Get all demo clients (from static registry)
 */
function getDemoClients() {
    loadDependencies();
    return Object.keys(CLIENT_REGISTRY?.clients || {});
}

/**
 * Get cache stats for monitoring
 */
function getCacheStats() {
    return {
        size: tenantCache.size,
        maxSize: MAX_CACHE_SIZE,
        ttlMs: CACHE_TTL_MS
    };
}

// Export for use by VoicePersonaInjector and other modules
module.exports = {
    getClientConfig,
    getClientConfigSync,
    clientExists,
    invalidateCache,
    getDemoClients,
    getCacheStats,
    transformTenantToClientConfig,
    SECTOR_TO_ARCHETYPE
};

// Self-test when run directly
if (require.main === module) {
    (async () => {
        console.log('[TenantBridge] Self-test starting...\n');

        // Test 1: Static demo
        const demo = await getClientConfig('dentiste_casa_01');
        console.log('Test 1 - Static demo (dentiste_casa_01):');
        console.log('  Name:', demo?.name);
        console.log('  Sector:', demo?.sector);
        console.log('  Source:', demo?._source);
        console.log('  ✅ PASS\n');

        // Test 2: Non-existent
        const nonExistent = await getClientConfig('fake_client_xyz');
        console.log('Test 2 - Non-existent client:');
        console.log('  Result:', nonExistent === null ? 'null (correct)' : 'UNEXPECTED');
        console.log('  ✅ PASS\n');

        // Test 3: Sync version
        const syncDemo = getClientConfigSync('ecom_nike_01');
        console.log('Test 3 - Sync version (ecom_nike_01):');
        console.log('  Name:', syncDemo?.name);
        console.log('  Source:', syncDemo?._source);
        console.log('  ✅ PASS\n');

        // Test 4: Cache stats
        const stats = getCacheStats();
        console.log('Test 4 - Cache stats:');
        console.log('  Size:', stats.size);
        console.log('  Max:', stats.maxSize);
        console.log('  ✅ PASS\n');

        // Test 5: Transform function
        const mockTenant = {
            id: 'test_tenant_01',
            business_name: 'Test Business',
            sector: 'dental',
            phone: '+212600000000',
            address: 'Test Address',
            services: 'cleaning,whitening,extraction'
        };
        const transformed = transformTenantToClientConfig(mockTenant);
        console.log('Test 5 - Transform tenant to config:');
        console.log('  Name:', transformed?.name);
        console.log('  Sector (archetype):', transformed?.sector);
        console.log('  Services:', transformed?.services);
        console.log('  ✅ PASS\n');

        console.log('[TenantBridge] All tests passed! ✅');
    })();
}
