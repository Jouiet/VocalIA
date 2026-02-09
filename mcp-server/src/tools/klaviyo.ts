import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Klaviyo MCP Tools - Session 250.87
 *
 * API Reference: https://developers.klaviyo.com/en/reference
 * API Revision: 2024-02-15
 * Auth: Klaviyo-API-Key header
 *
 * Multi-tenant support via SecretVault
 *
 * Tools:
 * - klaviyo_create_profile: Create/update profile
 * - klaviyo_track_event: Track custom events
 * - klaviyo_subscribe: Subscribe to list
 * - klaviyo_get_profile: Get profile by ID or email
 * - klaviyo_list_segments: List audience segments
 *
 * Rate Limits: 75 requests/second
 */

import { corePath } from '../paths.js';

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars
}

const KLAVIYO_REVISION = '2024-02-15';

/**
 * Get Klaviyo credentials for a tenant
 */
async function getKlaviyoCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.KLAVIYO_API_KEY) {
            return creds.KLAVIYO_API_KEY;
        }
    }
    return process.env.KLAVIYO_API_KEY || null;
}

/**
 * Make authenticated request to Klaviyo API
 */
async function klaviyoRequest(
    apiKey: string,
    method: string,
    endpoint: string,
    body?: Record<string, any>
): Promise<any> {
    const url = `https://a.klaviyo.com/api${endpoint}`;

    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'revision': KLAVIYO_REVISION
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 429) {
        throw new Error('Klaviyo rate limit exceeded. Wait and retry.');
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Klaviyo API error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) return { success: true };
    return response.json();
}

export const klaviyoTools = {
    // =============================================================================
    // PROFILE OPERATIONS
    // =============================================================================

    create_profile: {
        name: 'klaviyo_create_profile',
        description: 'Create or update a profile in Klaviyo',
        parameters: {
            email: z.string().email().describe('Email address'),
            phone: z.string().optional().describe('Phone number (E.164 format)'),
            firstName: z.string().optional().describe('First name'),
            lastName: z.string().optional().describe('Last name'),
            organization: z.string().optional().describe('Company/organization'),
            title: z.string().optional().describe('Job title'),
            properties: z.record(z.string(), z.any()).optional().describe('Custom properties'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            email: string;
            phone?: string;
            firstName?: string;
            lastName?: string;
            organization?: string;
            title?: string;
            properties?: Record<string, any>;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const apiKey = await getKlaviyoCredentials(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Klaviyo credentials',
                            requirements: {
                                credentials: ['KLAVIYO_API_KEY'],
                                setup: 'Klaviyo → Settings → API Keys → Create Private API Key'
                            }
                        }, null, 2)
                    }]
                };
            }

            const payload = {
                data: {
                    type: 'profile',
                    attributes: {
                        email: params.email,
                        ...(params.phone && { phone_number: params.phone }),
                        ...(params.firstName && { first_name: params.firstName }),
                        ...(params.lastName && { last_name: params.lastName }),
                        ...(params.organization && { organization: params.organization }),
                        ...(params.title && { title: params.title }),
                        properties: params.properties || {}
                    }
                }
            };

            try {
                const result = await klaviyoRequest(apiKey, 'POST', '/profiles', payload);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            profile: {
                                id: result.data?.id,
                                email: params.email
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    get_profile: {
        name: 'klaviyo_get_profile',
        description: 'Get profile by ID or search by email',
        parameters: {
            profileId: z.string().optional().describe('Klaviyo profile ID'),
            email: z.string().optional().describe('Search by email'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            profileId?: string;
            email?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const apiKey = await getKlaviyoCredentials(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Klaviyo credentials' }, null, 2)
                    }]
                };
            }

            try {
                let result;

                if (params.profileId) {
                    result = await klaviyoRequest(apiKey, 'GET', `/profiles/${params.profileId}`);
                } else if (params.email) {
                    result = await klaviyoRequest(
                        apiKey,
                        'GET',
                        `/profiles?filter=equals(email,"${encodeURIComponent(params.email)}")`
                    );
                    if (result.data?.length > 0) {
                        result = { data: result.data[0] };
                    } else {
                        return {
                            content: [{
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: 'Profile not found' }, null, 2)
                            }]
                        };
                    }
                } else {
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify({ success: false, error: 'Provide profileId or email' }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            profile: {
                                id: result.data?.id,
                                email: result.data?.attributes?.email,
                                firstName: result.data?.attributes?.first_name,
                                lastName: result.data?.attributes?.last_name,
                                phone: result.data?.attributes?.phone_number,
                                properties: result.data?.attributes?.properties
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // EVENT TRACKING
    // =============================================================================

    track_event: {
        name: 'klaviyo_track_event',
        description: 'Track a custom event (Voice Call, Lead Qualified, etc.)',
        parameters: {
            metricName: z.string().describe('Event name (e.g., "Voice Call Completed")'),
            email: z.string().email().optional().describe('Profile email'),
            phone: z.string().optional().describe('Profile phone (E.164)'),
            properties: z.record(z.string(), z.any()).optional().describe('Event properties'),
            value: z.number().optional().describe('Monetary value of event'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            metricName: string;
            email?: string;
            phone?: string;
            properties?: Record<string, any>;
            value?: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const apiKey = await getKlaviyoCredentials(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Klaviyo credentials' }, null, 2)
                    }]
                };
            }

            if (!params.email && !params.phone) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Provide email or phone' }, null, 2)
                    }]
                };
            }

            const profileAttrs: Record<string, any> = {};
            if (params.email) profileAttrs.email = params.email;
            if (params.phone) profileAttrs.phone_number = params.phone;

            const payload = {
                data: {
                    type: 'event',
                    attributes: {
                        properties: {
                            ...params.properties,
                            ...(params.value !== undefined && { $value: params.value })
                        },
                        metric: {
                            data: {
                                type: 'metric',
                                attributes: { name: params.metricName }
                            }
                        },
                        profile: {
                            data: {
                                type: 'profile',
                                attributes: profileAttrs
                            }
                        }
                    }
                }
            };

            try {
                await klaviyoRequest(apiKey, 'POST', '/events', payload);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            event: {
                                metric: params.metricName,
                                profile: params.email || params.phone,
                                value: params.value
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // LIST SUBSCRIPTION
    // =============================================================================

    subscribe: {
        name: 'klaviyo_subscribe',
        description: 'Subscribe a profile to a Klaviyo list',
        parameters: {
            listId: z.string().describe('Klaviyo list ID'),
            email: z.string().email().describe('Email to subscribe'),
            phone: z.string().optional().describe('Phone number (E.164)'),
            firstName: z.string().optional().describe('First name'),
            lastName: z.string().optional().describe('Last name'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            listId: string;
            email: string;
            phone?: string;
            firstName?: string;
            lastName?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const apiKey = await getKlaviyoCredentials(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Klaviyo credentials' }, null, 2)
                    }]
                };
            }

            const payload = {
                data: {
                    type: 'profile-subscription-bulk-create-job',
                    attributes: {
                        profiles: {
                            data: [{
                                type: 'profile',
                                attributes: {
                                    email: params.email,
                                    ...(params.phone && { phone_number: params.phone }),
                                    ...(params.firstName && { first_name: params.firstName }),
                                    ...(params.lastName && { last_name: params.lastName })
                                }
                            }]
                        }
                    },
                    relationships: {
                        list: {
                            data: { type: 'list', id: params.listId }
                        }
                    }
                }
            };

            try {
                await klaviyoRequest(apiKey, 'POST', '/profile-subscription-bulk-create-jobs', payload);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            subscription: {
                                email: params.email,
                                listId: params.listId
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // SEGMENTS
    // =============================================================================

    list_segments: {
        name: 'klaviyo_list_segments',
        description: 'List all audience segments',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const apiKey = await getKlaviyoCredentials(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Klaviyo credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await klaviyoRequest(apiKey, 'GET', '/segments');

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            segments: result.data?.map((s: any) => ({
                                id: s.id,
                                name: s.attributes?.name,
                                created: s.attributes?.created,
                                updated: s.attributes?.updated
                            })) || []
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    }
};

export default klaviyoTools;
