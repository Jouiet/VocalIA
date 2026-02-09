import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Calendly MCP Tools - Session 249.2
 *
 * API Reference: https://developer.calendly.com/api-docs
 * API Version: v2 (v1 deprecated May 2025)
 * Auth: Personal Access Token or OAuth 2.0
 *
 * Multi-tenant support via SecretVault
 */

import { corePath } from '../paths.js';

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars
}

const CALENDLY_API_BASE = 'https://api.calendly.com';

/**
 * Get Calendly credentials for a tenant
 */
async function getCalendlyToken(tenantId: string = 'agency_internal'): Promise<string | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.CALENDLY_ACCESS_TOKEN) {
            return creds.CALENDLY_ACCESS_TOKEN;
        }
    }
    return process.env.CALENDLY_ACCESS_TOKEN || null;
}

/**
 * Make authenticated request to Calendly API
 */
async function calendlyRequest(
    endpoint: string,
    token: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const response = await fetch(`${CALENDLY_API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendly API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const calendlyTools = {
    get_user: {
        name: 'calendly_get_user',
        description: 'Get the current authenticated Calendly user information',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN",
                            hint: "Get your Personal Access Token from https://calendly.com/integrations/api_webhooks"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await calendlyRequest('/users/me', token);
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            user: {
                                uri: data.resource.uri,
                                name: data.resource.name,
                                email: data.resource.email,
                                timezone: data.resource.timezone,
                                scheduling_url: data.resource.scheduling_url,
                                current_organization: data.resource.current_organization
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
        name: 'calendly_list_event_types',
        description: 'List all event types (meeting types) for the authenticated user',
        parameters: {
            active: z.boolean().optional().describe('Filter by active status'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ active, _meta }: { active?: boolean, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                // First get user to get their URI
                const userData = await calendlyRequest('/users/me', token);
                const userUri = userData.resource.uri;

                // Build query params
                const params = new URLSearchParams({ user: userUri });
                if (active !== undefined) {
                    params.append('active', active.toString());
                }

                const data = await calendlyRequest(`/event_types?${params}`, token);

                const eventTypes = data.collection.map((et: any) => ({
                    uri: et.uri,
                    name: et.name,
                    slug: et.slug,
                    duration: et.duration,
                    scheduling_url: et.scheduling_url,
                    active: et.active,
                    type: et.type,
                    color: et.color,
                    description_plain: et.description_plain?.substring(0, 200)
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

    get_available_times: {
        name: 'calendly_get_available_times',
        description: 'Get available time slots for an event type within a date range',
        parameters: {
            eventTypeUri: z.string().describe('Event type URI (from list_event_types)'),
            startTime: z.string().describe('Start of range in ISO format (e.g., 2026-02-01T00:00:00Z)'),
            endTime: z.string().describe('End of range in ISO format'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ eventTypeUri, startTime, endTime, _meta }: {
            eventTypeUri: string,
            startTime: string,
            endTime: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams({
                    event_type: eventTypeUri,
                    start_time: startTime,
                    end_time: endTime
                });

                const data = await calendlyRequest(`/event_type_available_times?${params}`, token);

                const slots = data.collection.map((slot: any) => ({
                    start_time: slot.start_time,
                    status: slot.status,
                    invitees_remaining: slot.invitees_remaining
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: slots.length,
                            available_slots: slots
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure the event type URI is correct and date range is valid"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_scheduled_events: {
        name: 'calendly_list_events',
        description: 'List scheduled events (meetings) for the authenticated user',
        parameters: {
            minStartTime: z.string().optional().describe('Filter events starting after this time (ISO format)'),
            maxStartTime: z.string().optional().describe('Filter events starting before this time (ISO format)'),
            status: z.enum(['active', 'canceled']).optional().describe('Filter by event status'),
            count: z.number().optional().describe('Number of events to return (default: 20, max: 100)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ minStartTime, maxStartTime, status, count = 20, _meta }: {
            minStartTime?: string,
            maxStartTime?: string,
            status?: 'active' | 'canceled',
            count?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Get user URI first
                const userData = await calendlyRequest('/users/me', token);
                const userUri = userData.resource.uri;

                const params = new URLSearchParams({
                    user: userUri,
                    count: Math.min(count, 100).toString()
                });

                if (minStartTime) params.append('min_start_time', minStartTime);
                if (maxStartTime) params.append('max_start_time', maxStartTime);
                if (status) params.append('status', status);

                const data = await calendlyRequest(`/scheduled_events?${params}`, token);

                const events = data.collection.map((event: any) => ({
                    uri: event.uri,
                    name: event.name,
                    status: event.status,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    location: event.location?.type,
                    created_at: event.created_at,
                    event_type: event.event_type
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: events.length,
                            events
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

    cancel_event: {
        name: 'calendly_cancel_event',
        description: 'Cancel a scheduled Calendly event',
        parameters: {
            eventUuid: z.string().describe('Event UUID (from the event URI)'),
            reason: z.string().optional().describe('Cancellation reason to send to invitee'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ eventUuid, reason, _meta }: {
            eventUuid: string,
            reason?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = {};
                if (reason) body.reason = reason;

                await calendlyRequest(
                    `/scheduled_events/${eventUuid}/cancellation`,
                    token,
                    { method: 'POST', body }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Event cancelled successfully",
                            event_uuid: eventUuid,
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
                            message: error.message,
                            hint: "Ensure the event UUID is correct and the event is not already cancelled"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_user_busy_times: {
        name: 'calendly_get_busy_times',
        description: 'Get busy times for a user within a date range (to avoid scheduling conflicts)',
        parameters: {
            startTime: z.string().describe('Start of range in ISO format'),
            endTime: z.string().describe('End of range in ISO format'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ startTime, endTime, _meta }: {
            startTime: string,
            endTime: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getCalendlyToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing CALENDLY_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Get user URI first
                const userData = await calendlyRequest('/users/me', token);
                const userUri = userData.resource.uri;

                const params = new URLSearchParams({
                    user: userUri,
                    start_time: startTime,
                    end_time: endTime
                });

                const data = await calendlyRequest(`/user_busy_times?${params}`, token);

                const busyTimes = data.collection.map((bt: any) => ({
                    type: bt.type,
                    start_time: bt.start_time,
                    end_time: bt.end_time,
                    buffered_start_time: bt.buffered_start_time,
                    buffered_end_time: bt.buffered_end_time,
                    event: bt.event ? {
                        uri: bt.event.uri
                    } : null
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: busyTimes.length,
                            busy_times: busyTimes
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
