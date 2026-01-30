import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Freshdesk MCP Tools - Session 249.2
 *
 * API Reference: https://developers.freshdesk.com/api/
 * API Version: v2
 * Auth: Basic Auth (API Key as username, 'X' as password)
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

/**
 * Get Freshdesk credentials for a tenant
 */
async function getFreshdeskCredentials(tenantId: string = 'agency_internal'): Promise<{ apiKey: string | null, domain: string | null }> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.FRESHDESK_API_KEY && creds.FRESHDESK_DOMAIN) {
            return {
                apiKey: creds.FRESHDESK_API_KEY,
                domain: creds.FRESHDESK_DOMAIN
            };
        }
    }
    return {
        apiKey: process.env.FRESHDESK_API_KEY || null,
        domain: process.env.FRESHDESK_DOMAIN || null
    };
}

/**
 * Make authenticated request to Freshdesk API
 */
async function freshdeskRequest(
    domain: string,
    apiKey: string,
    endpoint: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const authHeader = Buffer.from(`${apiKey}:X`).toString('base64');

    const response = await fetch(`https://${domain}.freshdesk.com/api/v2${endpoint}`, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Freshdesk API error ${response.status}: ${errorText}`);
    }

    // Handle empty responses (like DELETE)
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export const freshdeskTools = {
    list_tickets: {
        name: 'freshdesk_list_tickets',
        description: 'List support tickets from Freshdesk',
        parameters: {
            filter: z.enum(['new_and_my_open', 'watching', 'spam', 'deleted', 'all']).optional()
                .describe('Filter tickets (default: all)'),
            status: z.number().optional().describe('Filter by status (2=Open, 3=Pending, 4=Resolved, 5=Closed)'),
            priority: z.number().optional().describe('Filter by priority (1=Low, 2=Medium, 3=High, 4=Urgent)'),
            perPage: z.number().optional().describe('Number of tickets per page (default: 30, max: 100)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ filter, status, priority, perPage = 30, _meta }: {
            filter?: string,
            status?: number,
            priority?: number,
            perPage?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN",
                            hint: "Get your API key from Freshdesk Admin > Profile Settings"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams({
                    per_page: Math.min(perPage, 100).toString(),
                    include: 'requester,stats'
                });

                if (filter) params.append('filter', filter);
                if (status) params.append('status', status.toString());
                if (priority) params.append('priority', priority.toString());

                const data = await freshdeskRequest(domain, apiKey, `/tickets?${params}`);

                const tickets = data.map((ticket: any) => ({
                    id: ticket.id,
                    subject: ticket.subject,
                    status: ticket.status,
                    priority: ticket.priority,
                    type: ticket.type,
                    requester_id: ticket.requester_id,
                    created_at: ticket.created_at,
                    updated_at: ticket.updated_at,
                    due_by: ticket.due_by,
                    tags: ticket.tags
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: tickets.length,
                            tickets
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

    get_ticket: {
        name: 'freshdesk_get_ticket',
        description: 'Get a specific support ticket with its conversations',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, _meta }: { ticketId: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const ticket = await freshdeskRequest(domain, apiKey, `/tickets/${ticketId}?include=conversations,requester`);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            ticket: {
                                id: ticket.id,
                                subject: ticket.subject,
                                description: ticket.description_text?.substring(0, 500),
                                status: ticket.status,
                                priority: ticket.priority,
                                source: ticket.source,
                                type: ticket.type,
                                requester_id: ticket.requester_id,
                                responder_id: ticket.responder_id,
                                created_at: ticket.created_at,
                                updated_at: ticket.updated_at,
                                tags: ticket.tags,
                                conversations: ticket.conversations?.slice(0, 5).map((c: any) => ({
                                    id: c.id,
                                    body_text: c.body_text?.substring(0, 200),
                                    incoming: c.incoming,
                                    created_at: c.created_at
                                }))
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

    create_ticket: {
        name: 'freshdesk_create_ticket',
        description: 'Create a new support ticket in Freshdesk',
        parameters: {
            subject: z.string().describe('Ticket subject'),
            description: z.string().describe('Ticket description (HTML supported)'),
            email: z.string().email().describe('Requester email address'),
            priority: z.number().optional().describe('Priority (1=Low, 2=Medium, 3=High, 4=Urgent)'),
            status: z.number().optional().describe('Status (2=Open, 3=Pending, 4=Resolved, 5=Closed)'),
            type: z.string().optional().describe('Ticket type (e.g., "Question", "Incident", "Problem")'),
            tags: z.array(z.string()).optional().describe('Tags to add to the ticket'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ subject, description, email, priority = 1, status = 2, type, tags, _meta }: {
            subject: string,
            description: string,
            email: string,
            priority?: number,
            status?: number,
            type?: string,
            tags?: string[],
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = {
                    subject,
                    description,
                    email,
                    priority,
                    status
                };

                if (type) body.type = type;
                if (tags && tags.length > 0) body.tags = tags;

                const ticket = await freshdeskRequest(domain, apiKey, '/tickets', {
                    method: 'POST',
                    body
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Ticket created successfully",
                            ticket: {
                                id: ticket.id,
                                subject: ticket.subject,
                                status: ticket.status,
                                priority: ticket.priority,
                                created_at: ticket.created_at
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

    reply_to_ticket: {
        name: 'freshdesk_reply_ticket',
        description: 'Add a reply to an existing support ticket',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            body: z.string().describe('Reply content (HTML supported)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, body, _meta }: {
            ticketId: number,
            body: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const reply = await freshdeskRequest(domain, apiKey, `/tickets/${ticketId}/reply`, {
                    method: 'POST',
                    body: { body }
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Reply added successfully",
                            reply: {
                                id: reply.id,
                                created_at: reply.created_at,
                                ticket_id: ticketId
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

    update_ticket: {
        name: 'freshdesk_update_ticket',
        description: 'Update an existing support ticket',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            status: z.number().optional().describe('New status (2=Open, 3=Pending, 4=Resolved, 5=Closed)'),
            priority: z.number().optional().describe('New priority (1=Low, 2=Medium, 3=High, 4=Urgent)'),
            type: z.string().optional().describe('New ticket type'),
            tags: z.array(z.string()).optional().describe('New tags (replaces existing)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, status, priority, type, tags, _meta }: {
            ticketId: number,
            status?: number,
            priority?: number,
            type?: string,
            tags?: string[],
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = {};
                if (status) body.status = status;
                if (priority) body.priority = priority;
                if (type) body.type = type;
                if (tags) body.tags = tags;

                const ticket = await freshdeskRequest(domain, apiKey, `/tickets/${ticketId}`, {
                    method: 'PUT',
                    body
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Ticket updated successfully",
                            ticket: {
                                id: ticket.id,
                                status: ticket.status,
                                priority: ticket.priority,
                                type: ticket.type,
                                updated_at: ticket.updated_at
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

    search_contacts: {
        name: 'freshdesk_search_contacts',
        description: 'Search for contacts in Freshdesk by email or name',
        parameters: {
            query: z.string().describe('Search query (email or name)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ query, _meta }: { query: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiKey, domain } = await getFreshdeskCredentials(tenantId);

            if (!apiKey || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing FRESHDESK_API_KEY or FRESHDESK_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await freshdeskRequest(domain, apiKey, `/contacts/autocomplete?term=${encodeURIComponent(query)}`);

                const contacts = data.map((contact: any) => ({
                    id: contact.id,
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    company_id: contact.company_id,
                    active: contact.active
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: contacts.length,
                            contacts
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
