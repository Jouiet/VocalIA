import { z } from 'zod';
import { tenantMiddleware } from '../middleware/tenant.js';
import * as fs from 'fs';
import * as path from 'path';

// File-based UCP Profile Storage
const DATA_DIR = path.join(process.cwd(), '..', 'data');
const UCP_PROFILES_FILE = path.join(DATA_DIR, 'ucp-profiles.json');

interface UCPProfile {
    userId: string;
    tenantId: string;
    country: string;
    market: string;
    locale: string;
    currency: string;
    currencySymbol: string;
    enforced: boolean;
    timestamp: string;
}

interface UCPStorage {
    profiles: { [key: string]: UCPProfile };
    lastUpdated: string;
}

/**
 * Load UCP profiles from file
 */
function loadProfiles(): UCPStorage {
    try {
        if (fs.existsSync(UCP_PROFILES_FILE)) {
            const data = fs.readFileSync(UCP_PROFILES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[UCP] Failed to load profiles:', e);
    }
    return { profiles: {}, lastUpdated: new Date().toISOString() };
}

/**
 * Save UCP profiles to file
 */
function saveProfiles(storage: UCPStorage): boolean {
    try {
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        storage.lastUpdated = new Date().toISOString();
        fs.writeFileSync(UCP_PROFILES_FILE, JSON.stringify(storage, null, 2));
        return true;
    } catch (e) {
        console.error('[UCP] Failed to save profiles:', e);
        return false;
    }
}

/**
 * Generate profile key: tenantId:userId
 */
function profileKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
}

export const ucpTools = {
    ucp_sync_preference: {
        name: 'ucp_sync_preference',
        description: 'Sync user preferences enforcing Tenant Market Rules (Maroc/Europe/International). Returns the enforced profile and PERSISTS it.',
        parameters: {
            countryCode: z.string().describe('ISO Country Code (e.g. MA, FR, US)'),
            userId: z.string().optional().describe('User ID if available'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Meta context for tenancy')
        },
        handler: async (args: any) => {
            // 1. Resolve Tenant Context
            const tenant = await tenantMiddleware(args);
            const config = tenant.config;

            const countryCode = args.countryCode || 'US';
            const code = countryCode.toUpperCase();
            const userId = args.userId || 'anonymous';

            // 2. Apply Tenant-Specific Market Rules
            let rule;
            if (config.marketRules.strict) {
                rule = config.marketRules.markets[code] || config.marketRules.default;
            } else {
                rule = config.marketRules.default;
            }

            // 3. Create profile
            const profile: UCPProfile = {
                userId,
                tenantId: tenant.id,
                country: code,
                market: rule.id,
                locale: rule.lang,
                currency: rule.currency,
                currencySymbol: rule.symbol,
                enforced: true,
                timestamp: new Date().toISOString()
            };

            // 4. PERSIST to file
            const storage = loadProfiles();
            const key = profileKey(tenant.id, userId);
            storage.profiles[key] = profile;
            const saved = saveProfiles(storage);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: saved ? "success" : "warning",
                        message: saved
                            ? `Profile synced and PERSISTED for ${code} on tenant ${tenant.name}`
                            : `Profile synced but FAILED to persist for ${code}`,
                        profile,
                        persisted: saved
                    }, null, 2)
                }]
            };
        }
    },

    ucp_get_profile: {
        name: 'ucp_get_profile',
        description: 'Get current UCP profile from persistent storage',
        parameters: {
            userId: z.string(),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const userId = args.userId;
            const key = profileKey(tenant.id, userId);

            // Load from persistent storage
            const storage = loadProfiles();
            const profile = storage.profiles[key];

            if (profile) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "found",
                            userId,
                            tenant: tenant.name,
                            profile
                        }, null, 2)
                    }]
                };
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        userId,
                        tenant: tenant.name,
                        status: "not_found",
                        hint: "Use ucp_sync_preference to create a profile first.",
                        availableProfiles: Object.keys(storage.profiles).length
                    }, null, 2)
                }]
            };
        }
    },

    ucp_list_profiles: {
        name: 'ucp_list_profiles',
        description: 'List all UCP profiles for a tenant',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const storage = loadProfiles();

            // Filter profiles by tenant
            const tenantProfiles = Object.entries(storage.profiles)
                .filter(([k]) => k.startsWith(`${tenant.id}:`))
                .map(([, profile]) => profile);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        tenant: tenant.name,
                        count: tenantProfiles.length,
                        profiles: tenantProfiles,
                        lastUpdated: storage.lastUpdated
                    }, null, 2)
                }]
            };
        }
    }
};
