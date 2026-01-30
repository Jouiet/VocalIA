import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Cal.com MCP Tools - Session 249.4
 *
 * API Reference: https://cal.com/docs/api-reference/v1
 * API Version: v1
 * Auth: API Key
 *
 * Multi-tenant support via SecretVault
 */

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    const vaultPath = path.join(process.cwd(), '..', 'core', 'SecretVault.cjs');
    SecretVault = require(vaultPath);
} catch (e) {
    // Fallback to env vars
}

const CALCOM_API_BASE = 'https://api.cal.com/v1';

/**
 * Get Cal.com API key for a tenant
 */
async function getCalcomApiKey(tenantId: string = 'agency_internal'): Promise<string | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.CALCOM_API_KEY) {
            return creds.CALCOM_API_KEY;
        }
    }
    return process.env.CALCOM_API_KEY || null;
}

/**
 * Make authenticated request to Cal.com API
 */
async function calcomRequest(
    endpoint: string,
    apiKey: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const url = `${CALCOM_API_BASE}${endpoint}`;
    const separator = endpoint.includes('?') ? '&' : '?';

    const response = await fetch(`${url}${separator}apiKey=${apiKey}`, {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cal.com API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const calcomTools = {
    get_me: {
        name: 'calcom_get_me',
        description: 'Get the current authenticated Cal.com user information',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY",
                            hint: "Get your API key from https://app.cal.com/settings/developer/api-keys"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await calcomRequest('/me', apiKey);
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            user: {
                                id: data.user.id,
                                username: data.user.username,
                                email: data.user.email,
                                name: data.user.name,
                                timeZone: data.user.timeZone,
                                weekStart: data.user.weekStart
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_event_types: {
        name: 'calcom_list_event_types',
        description: 'List all event types (meeting types) for the authenticated user',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await calcomRequest('/event-types', apiKey);

                const eventTypes = data.event_types.map((et: any) => ({
                    id: et.id,
                    title: et.title,
                    slug: et.slug,
                    length: et.length,
                    description: et.description?.substring(0, 200),
                    hidden: et.hidden,
                    position: et.position,
                    schedulingType: et.schedulingType
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: eventTypes.length,
                            event_types: eventTypes
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_bookings: {
        name: 'calcom_list_bookings',
        description: 'List bookings (scheduled meetings) for the authenticated user',
        parameters: {
            status: z.enum(['upcoming', 'recurring', 'past', 'cancelled', 'unconfirmed']).optional()
                .describe('Filter by booking status'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status, _meta }: { status?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams();
                if (status) params.append('status', status);

                const endpoint = params.toString() ? `/bookings?${params}` : '/bookings';
                const data = await calcomRequest(endpoint, apiKey);

                const bookings = data.bookings.map((b: any) => ({
                    id: b.id,
                    uid: b.uid,
                    title: b.title,
                    description: b.description?.substring(0, 100),
                    startTime: b.startTime,
                    endTime: b.endTime,
                    status: b.status,
                    attendees: b.attendees?.map((a: any) => ({
                        name: a.name,
                        email: a.email
                    }))
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: bookings.length,
                            bookings
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_availability: {
        name: 'calcom_get_availability',
        description: 'Get availability for a specific date range',
        parameters: {
            dateFrom: z.string().describe('Start date in YYYY-MM-DD format'),
            dateTo: z.string().describe('End date in YYYY-MM-DD format'),
            eventTypeId: z.number().optional().describe('Filter by event type ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ dateFrom, dateTo, eventTypeId, _meta }: {
            dateFrom: string,
            dateTo: string,
            eventTypeId?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams({
                    dateFrom,
                    dateTo
                });
                if (eventTypeId) params.append('eventTypeId', eventTypeId.toString());

                const data = await calcomRequest(`/availability?${params}`, apiKey);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            dateFrom,
                            dateTo,
                            busy: data.busy || [],
                            timeZone: data.timeZone,
                            workingHours: data.workingHours
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    cancel_booking: {
        name: 'calcom_cancel_booking',
        description: 'Cancel an existing booking',
        parameters: {
            bookingId: z.number().describe('Booking ID to cancel'),
            reason: z.string().optional().describe('Cancellation reason'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ bookingId, reason, _meta }: {
            bookingId: number,
            reason?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = {};
                if (reason) body.reason = reason;

                await calcomRequest(`/bookings/${bookingId}/cancel`, apiKey, {
                    method: 'DELETE',
                    body: Object.keys(body).length > 0 ? body : undefined
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Booking cancelled successfully",
                            booking_id: bookingId,
                            reason: reason || "(no reason provided)"
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_schedules: {
        name: 'calcom_list_schedules',
        description: 'List all schedules (availability templates) for the user',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const apiKey = await getCalcomApiKey(tenantId);

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALCOM_API_KEY"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await calcomRequest('/schedules', apiKey);

                const schedules = data.schedules.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    timeZone: s.timeZone,
                    isDefault: s.isDefault,
                    availability: s.availability?.slice(0, 3) // First 3 for brevity
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: schedules.length,
                            schedules
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
