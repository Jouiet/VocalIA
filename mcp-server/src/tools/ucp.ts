import { z } from 'zod';
import { tenantMiddleware } from '../middleware/tenant.js';
import * as fs from 'fs';
import { dataPath } from '../paths.js';

// File-based UCP Profile Storage
const DATA_DIR = dataPath();
const UCP_PROFILES_FILE = dataPath('ucp-profiles.json');

interface UCPInteraction {
    type: 'voice_call' | 'widget_chat' | 'api_request' | 'booking' | 'purchase';
    timestamp: string;
    channel: string;
    duration?: number;
    outcome?: string;
    metadata?: Record<string, any>;
}

interface UCPBehavioralEvent {
    event: string;
    timestamp: string;
    value?: any;
    source: 'voice' | 'widget' | 'web' | 'api';
}

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
    // Enhanced CDP fields (Session 250.28)
    interactionHistory: UCPInteraction[];
    behavioralEvents: UCPBehavioralEvent[];
    totalInteractions: number;
    lastInteraction?: string;
    preferredChannel?: string;
    lifetimeValue?: number;
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
 * Generate profile key with unambiguous separator (MM2 fix).
 * Uses '::' which is disallowed in tenant/user IDs by sanitization rules.
 */
function profileKey(tenantId: string, userId: string): string {
    return `${tenantId}::${userId}`;
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

            // 3. Load existing storage and create/update profile
            const storage = loadProfiles();
            const existingProfile = storage.profiles[profileKey(tenant.id, userId)];
            const profile: UCPProfile = {
                userId,
                tenantId: tenant.id,
                country: code,
                market: rule.id,
                locale: rule.lang,
                currency: rule.currency,
                currencySymbol: rule.symbol,
                enforced: true,
                timestamp: new Date().toISOString(),
                // Preserve or initialize CDP fields
                interactionHistory: existingProfile?.interactionHistory || [],
                behavioralEvents: existingProfile?.behavioralEvents || [],
                totalInteractions: existingProfile?.totalInteractions || 0,
                lastInteraction: existingProfile?.lastInteraction,
                preferredChannel: existingProfile?.preferredChannel,
                lifetimeValue: existingProfile?.lifetimeValue || 0
            };

            // 4. PERSIST to file
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
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CDP ENHANCED TOOLS (Session 250.28)
    // ─────────────────────────────────────────────────────────────────────────

    ucp_record_interaction: {
        name: 'ucp_record_interaction',
        description: 'Record a customer interaction (voice call, widget chat, booking, purchase) to build interaction history',
        parameters: {
            userId: z.string().describe('User ID'),
            interactionType: z.enum(['voice_call', 'widget_chat', 'api_request', 'booking', 'purchase']).describe('Type of interaction'),
            channel: z.string().describe('Channel (e.g. telephony, web_widget, api)'),
            duration: z.number().optional().describe('Duration in seconds'),
            outcome: z.string().optional().describe('Outcome (e.g. resolved, escalated, converted)'),
            metadata: z.record(z.any()).optional().describe('Additional metadata'),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const storage = loadProfiles();
            const key = profileKey(tenant.id, args.userId);

            let profile = storage.profiles[key];
            if (!profile) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Profile not found. Use ucp_sync_preference first."
                        }, null, 2)
                    }]
                };
            }

            // Initialize arrays if missing (migration for old profiles)
            if (!profile.interactionHistory) profile.interactionHistory = [];
            if (!profile.behavioralEvents) profile.behavioralEvents = [];

            // Add interaction
            const interaction: UCPInteraction = {
                type: args.interactionType,
                timestamp: new Date().toISOString(),
                channel: args.channel,
                duration: args.duration,
                outcome: args.outcome,
                metadata: args.metadata
            };

            profile.interactionHistory.push(interaction);
            profile.totalInteractions = (profile.totalInteractions || 0) + 1;
            profile.lastInteraction = interaction.timestamp;

            // CDP: Calculate Lifetime Value for purchases/bookings
            if (args.interactionType === 'purchase' || args.interactionType === 'booking') {
                const amount = args.metadata?.amount || args.metadata?.value || 0;
                profile.lifetimeValue = (profile.lifetimeValue || 0) + amount;
            }

            // Update preferred channel based on frequency
            const channelCounts: Record<string, number> = {};
            profile.interactionHistory.forEach((i: UCPInteraction) => {
                channelCounts[i.channel] = (channelCounts[i.channel] || 0) + 1;
            });
            profile.preferredChannel = Object.entries(channelCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0];

            // Keep only last 100 interactions
            if (profile.interactionHistory.length > 100) {
                profile.interactionHistory = profile.interactionHistory.slice(-100);
            }

            storage.profiles[key] = profile;
            saveProfiles(storage);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        message: `Interaction recorded for ${args.userId}`,
                        totalInteractions: profile.totalInteractions,
                        preferredChannel: profile.preferredChannel
                    }, null, 2)
                }]
            };
        }
    },

    ucp_track_event: {
        name: 'ucp_track_event',
        description: 'Track a behavioral event for analytics and personalization',
        parameters: {
            userId: z.string().describe('User ID'),
            event: z.string().describe('Event name (e.g. pricing_viewed, demo_requested, feature_explored)'),
            source: z.enum(['voice', 'widget', 'web', 'api']).describe('Event source'),
            value: z.any().optional().describe('Event value'),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const storage = loadProfiles();
            const key = profileKey(tenant.id, args.userId);

            let profile = storage.profiles[key];
            if (!profile) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Profile not found. Use ucp_sync_preference first."
                        }, null, 2)
                    }]
                };
            }

            // Initialize if missing
            if (!profile.behavioralEvents) profile.behavioralEvents = [];

            // Add event
            const event: UCPBehavioralEvent = {
                event: args.event,
                timestamp: new Date().toISOString(),
                source: args.source,
                value: args.value
            };

            profile.behavioralEvents.push(event);

            // Keep only last 200 events
            if (profile.behavioralEvents.length > 200) {
                profile.behavioralEvents = profile.behavioralEvents.slice(-200);
            }

            storage.profiles[key] = profile;
            saveProfiles(storage);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        event: args.event,
                        totalEvents: profile.behavioralEvents.length
                    }, null, 2)
                }]
            };
        }
    },

    ucp_get_insights: {
        name: 'ucp_get_insights',
        description: 'Get customer insights and analytics from UCP profile',
        parameters: {
            userId: z.string().describe('User ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const storage = loadProfiles();
            const key = profileKey(tenant.id, args.userId);

            const profile = storage.profiles[key];
            if (!profile) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "not_found",
                            message: "Profile not found"
                        }, null, 2)
                    }]
                };
            }

            // Calculate insights
            const interactions = profile.interactionHistory || [];
            const events = profile.behavioralEvents || [];

            // Engagement score (0-100)
            const recencyDays = profile.lastInteraction
                ? Math.floor((Date.now() - new Date(profile.lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            const recencyScore = Math.max(0, 100 - recencyDays * 5);
            const frequencyScore = Math.min(100, (profile.totalInteractions || 0) * 10);
            const engagementScore = Math.round((recencyScore + frequencyScore) / 2);

            // Channel breakdown
            const channelBreakdown: Record<string, number> = {};
            interactions.forEach((i: UCPInteraction) => {
                channelBreakdown[i.channel] = (channelBreakdown[i.channel] || 0) + 1;
            });

            // Event summary
            const eventSummary: Record<string, number> = {};
            events.forEach((e: UCPBehavioralEvent) => {
                eventSummary[e.event] = (eventSummary[e.event] || 0) + 1;
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        userId: args.userId,
                        market: profile.market,
                        locale: profile.locale,
                        insights: {
                            engagementScore,
                            totalInteractions: profile.totalInteractions || 0,
                            lastInteraction: profile.lastInteraction,
                            preferredChannel: profile.preferredChannel,
                            lifetimeValue: profile.lifetimeValue || 0,
                            ltvTier: getLTVTier(profile.lifetimeValue || 0),
                            recencyDays,
                            channelBreakdown,
                            topEvents: Object.entries(eventSummary)
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 5)
                                .map(([event, count]) => ({ event, count }))
                        }
                    }, null, 2)
                }]
            };
        }
    },

    ucp_update_ltv: {
        name: 'ucp_update_ltv',
        description: 'Update customer Lifetime Value (LTV) directly',
        parameters: {
            userId: z.string().describe('User ID'),
            amount: z.number().describe('Transaction amount to add to LTV'),
            transactionType: z.enum(['purchase', 'subscription', 'refund', 'adjustment']).describe('Type of transaction'),
            currency: z.string().optional().describe('Currency code (EUR, MAD, USD)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional()
        },
        handler: async (args: any) => {
            const tenant = await tenantMiddleware(args);
            const storage = loadProfiles();
            const key = profileKey(tenant.id, args.userId);

            let profile = storage.profiles[key];
            if (!profile) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Profile not found. Use ucp_sync_preference first."
                        }, null, 2)
                    }]
                };
            }

            // Calculate LTV change
            const previousLTV = profile.lifetimeValue || 0;
            let ltvChange = args.amount;

            // Refunds decrease LTV
            if (args.transactionType === 'refund') {
                ltvChange = -Math.abs(args.amount);
            }

            profile.lifetimeValue = Math.max(0, previousLTV + ltvChange);

            storage.profiles[key] = profile;
            saveProfiles(storage);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        userId: args.userId,
                        transactionType: args.transactionType,
                        amount: args.amount,
                        previousLTV,
                        newLTV: profile.lifetimeValue,
                        ltvTier: getLTVTier(profile.lifetimeValue),
                        currency: args.currency || profile.currency
                    }, null, 2)
                }]
            };
        }
    }
};

/**
 * Calculate LTV Tier based on value
 * Tiers: Bronze (<100), Silver (100-500), Gold (500-2000), Platinum (2000-10000), Diamond (>10000)
 */
function getLTVTier(ltv: number): string {
    if (ltv >= 10000) return 'diamond';
    if (ltv >= 2000) return 'platinum';
    if (ltv >= 500) return 'gold';
    if (ltv >= 100) return 'silver';
    return 'bronze';
}
