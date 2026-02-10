import { z } from 'zod';
import { tenantMiddleware } from '../middleware/tenant.js';
import * as fs from 'fs';
import * as path from 'path';
import { dataPath } from '../paths.js';

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED UCP Storage — Per-tenant directory (shared with core/ucp-store.cjs)
//
// Storage: data/ucp/{tenantId}/profiles.json   (keyed by userId)
//          data/ucp/{tenantId}/interactions.jsonl (append-only audit trail)
//          data/ucp/{tenantId}/ltv.json          (LTV tiers & history)
//
// Session 250.188: Unified with core/ucp-store.cjs — same files, same format.
// Both core REST API and MCP tools now read/write the SAME data.
// ═══════════════════════════════════════════════════════════════════════════════

const UCP_BASE_DIR = dataPath('ucp');

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
    customer_id: string;
    tenant_id: string;
    country?: string;
    market?: string;
    locale?: string;
    currency?: string;
    currencySymbol?: string;
    enforced?: boolean;
    created_at: string;
    updated_at: string;
    // Identity fields (set by core REST API or MCP)
    name?: string;
    email?: string;
    phone?: string;
    // CDP enhanced fields
    interactionHistory?: UCPInteraction[];
    behavioralEvents?: UCPBehavioralEvent[];
    totalInteractions?: number;
    interaction_count?: number;
    lastInteraction?: string;
    last_interaction?: string;
    preferredChannel?: string;
    lifetimeValue?: number;
    ltv_value?: number;
    ltv_tier?: string;
    // Voice pipeline fields (set by auto-enrichment)
    last_channel?: string;
    last_language?: string;
    last_persona?: string;
}

/**
 * Get tenant UCP directory (create if missing)
 */
function getTenantDir(tenantId: string): string {
    const dir = path.join(UCP_BASE_DIR, tenantId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Load UCP profiles for a specific tenant
 * Reads from: data/ucp/{tenantId}/profiles.json
 */
function loadTenantProfiles(tenantId: string): Record<string, UCPProfile> {
    const filepath = path.join(getTenantDir(tenantId), 'profiles.json');
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        }
    } catch (e) {
        console.error(`[UCP] Failed to load profiles for ${tenantId}:`, e);
    }
    return {};
}

/**
 * Save UCP profiles for a specific tenant
 * Writes to: data/ucp/{tenantId}/profiles.json
 */
function saveTenantProfiles(tenantId: string, profiles: Record<string, UCPProfile>): boolean {
    try {
        const filepath = path.join(getTenantDir(tenantId), 'profiles.json');
        fs.writeFileSync(filepath, JSON.stringify(profiles, null, 2));
        return true;
    } catch (e) {
        console.error(`[UCP] Failed to save profiles for ${tenantId}:`, e);
        return false;
    }
}

/**
 * Append interaction to JSONL audit log (shared with core/ucp-store.cjs)
 * Writes to: data/ucp/{tenantId}/interactions.jsonl
 */
function appendInteractionLog(tenantId: string, entry: Record<string, any>): void {
    try {
        const filepath = path.join(getTenantDir(tenantId), 'interactions.jsonl');
        fs.appendFileSync(filepath, JSON.stringify(entry) + '\n');
    } catch (e) {
        console.error(`[UCP] Failed to append interaction log for ${tenantId}:`, e);
    }
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

            // 3. Load existing profile from shared per-tenant storage
            const profiles = loadTenantProfiles(tenant.id);
            const existing = profiles[userId] || {};
            const now = new Date().toISOString();

            // 4. Merge profile (preserve existing fields, add/update market rules)
            const profile: UCPProfile = {
                ...existing,
                customer_id: userId,
                tenant_id: tenant.id,
                country: code,
                market: rule.id,
                locale: rule.lang,
                currency: rule.currency,
                currencySymbol: rule.symbol,
                enforced: true,
                updated_at: now,
                created_at: existing.created_at || now,
                // Preserve CDP fields
                interactionHistory: existing.interactionHistory || [],
                behavioralEvents: existing.behavioralEvents || [],
                totalInteractions: existing.totalInteractions || existing.interaction_count || 0,
                interaction_count: existing.interaction_count || existing.totalInteractions || 0,
                lastInteraction: existing.lastInteraction || existing.last_interaction,
                last_interaction: existing.last_interaction || existing.lastInteraction,
                preferredChannel: existing.preferredChannel,
                lifetimeValue: existing.lifetimeValue || existing.ltv_value || 0,
                ltv_value: existing.ltv_value || existing.lifetimeValue || 0
            };

            profiles[userId] = profile;
            const saved = saveTenantProfiles(tenant.id, profiles);

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

            const profiles = loadTenantProfiles(tenant.id);
            const profile = profiles[userId];

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
                        availableProfiles: Object.keys(profiles).length
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
            const profiles = loadTenantProfiles(tenant.id);
            const tenantProfiles = Object.values(profiles);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        status: "success",
                        tenant: tenant.name,
                        count: tenantProfiles.length,
                        profiles: tenantProfiles,
                        lastUpdated: new Date().toISOString()
                    }, null, 2)
                }]
            };
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CDP ENHANCED TOOLS (Session 250.28, unified storage 250.188)
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
            const profiles = loadTenantProfiles(tenant.id);

            let profile = profiles[args.userId];
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

            // Initialize arrays if missing (migration for old profiles from core)
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
            profile.interaction_count = profile.totalInteractions;
            profile.lastInteraction = interaction.timestamp;
            profile.last_interaction = interaction.timestamp;
            profile.updated_at = interaction.timestamp;

            // CDP: Calculate Lifetime Value for purchases/bookings
            if (args.interactionType === 'purchase' || args.interactionType === 'booking') {
                const amount = args.metadata?.amount || args.metadata?.value || 0;
                profile.lifetimeValue = (profile.lifetimeValue || 0) + amount;
                profile.ltv_value = profile.lifetimeValue;
                profile.ltv_tier = getLTVTier(profile.lifetimeValue || 0);
            }

            // Update preferred channel based on frequency
            const channelCounts: Record<string, number> = {};
            profile.interactionHistory.forEach((i: UCPInteraction) => {
                channelCounts[i.channel] = (channelCounts[i.channel] || 0) + 1;
            });
            profile.preferredChannel = Object.entries(channelCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0];

            // Keep only last 100 interactions inline
            if (profile.interactionHistory.length > 100) {
                profile.interactionHistory = profile.interactionHistory.slice(-100);
            }

            profiles[args.userId] = profile;
            saveTenantProfiles(tenant.id, profiles);

            // Also append to JSONL audit trail (shared with core/ucp-store.cjs)
            appendInteractionLog(tenant.id, {
                ...interaction,
                id: Math.random().toString(36).substring(2, 10),
                customer_id: args.userId,
                tenant_id: tenant.id
            });

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
            const profiles = loadTenantProfiles(tenant.id);

            let profile = profiles[args.userId];
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
            profile.updated_at = event.timestamp;

            // Keep only last 200 events
            if (profile.behavioralEvents.length > 200) {
                profile.behavioralEvents = profile.behavioralEvents.slice(-200);
            }

            profiles[args.userId] = profile;
            saveTenantProfiles(tenant.id, profiles);

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
            const profiles = loadTenantProfiles(tenant.id);

            const profile = profiles[args.userId];
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
            const lastInt = profile.lastInteraction || profile.last_interaction;
            const recencyDays = lastInt
                ? Math.floor((Date.now() - new Date(lastInt).getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            const recencyScore = Math.max(0, 100 - recencyDays * 5);
            const totalInt = profile.totalInteractions || profile.interaction_count || 0;
            const frequencyScore = Math.min(100, totalInt * 10);
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

            const ltv = profile.lifetimeValue || profile.ltv_value || 0;

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
                            totalInteractions: totalInt,
                            lastInteraction: lastInt,
                            preferredChannel: profile.preferredChannel,
                            lifetimeValue: ltv,
                            ltvTier: getLTVTier(ltv),
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
            const profiles = loadTenantProfiles(tenant.id);

            let profile = profiles[args.userId];
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
            const previousLTV = profile.lifetimeValue || profile.ltv_value || 0;
            let ltvChange = args.amount;

            // Refunds decrease LTV
            if (args.transactionType === 'refund') {
                ltvChange = -Math.abs(args.amount);
            }

            const newLTV = Math.max(0, previousLTV + ltvChange);
            profile.lifetimeValue = newLTV;
            profile.ltv_value = newLTV;
            profile.ltv_tier = getLTVTier(newLTV);
            profile.updated_at = new Date().toISOString();

            profiles[args.userId] = profile;
            saveTenantProfiles(tenant.id, profiles);

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
 * Tiers match core/ucp-store.cjs: Bronze (<100), Silver (100-500), Gold (500-2000), Platinum (2000-10000), Diamond (>10000)
 */
function getLTVTier(ltv: number): string {
    if (ltv >= 10000) return 'diamond';
    if (ltv >= 2000) return 'platinum';
    if (ltv >= 500) return 'gold';
    if (ltv >= 100) return 'silver';
    return 'bronze';
}
