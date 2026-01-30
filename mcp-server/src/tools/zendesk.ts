import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Zendesk MCP Tools - Session 249.4
 *
 * API Reference: https://developer.zendesk.com/api-reference/
 * API Version: v2
 * Auth: Basic Auth (email/token) or OAuth
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
 * Get Zendesk credentials for a tenant
 */
async function getZendeskCredentials(tenantId: string = 'agency_internal'): Promise<{
    subdomain: string | null,
    email: string | null,
    apiToken: string | null
}> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.ZENDESK_SUBDOMAIN && creds.ZENDESK_EMAIL && creds.ZENDESK_API_TOKEN) {
            return {
                subdomain: creds.ZENDESK_SUBDOMAIN,
                email: creds.ZENDESK_EMAIL,
                apiToken: creds.ZENDESK_API_TOKEN
            };
        }
    }
    return {
        subdomain: process.env.ZENDESK_SUBDOMAIN || null,
        email: process.env.ZENDESK_EMAIL || null,
        apiToken: process.env.ZENDESK_API_TOKEN || null
    };
}

/**
 * Make authenticated request to Zendesk API
 */
async function zendeskRequest(
    subdomain: string,
    email: string,
    apiToken: string,
    endpoint: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const authString = Buffer.from(`${email}/token:${apiToken}`).toString('base64');

    const response = await fetch(`https://${subdomain}.zendesk.com/api/v2${endpoint}`, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zendesk API error ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export const zendeskTools = {
    list_tickets: {
        name: 'zendesk_list_tickets',
        description: 'List support tickets from Zendesk',
        parameters: {
            status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional()
                .describe('Filter by ticket status'),
            perPage: z.number().optional().describe('Results per page (default: 25, max: 100)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status, perPage = 25, _meta }: {
            status?: string,
            perPage?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials",
                            required: ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_TOKEN"],
                            hint: "Get API token from Zendesk Admin Center > Apps and integrations > APIs > Zendesk API"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams({
                    per_page: Math.min(perPage, 100).toString()
                });
                if (status) params.append('status', status);

                const data = await zendeskRequest(
                    creds.subdomain,
                    creds.email,
                    creds.apiToken,
                    `/tickets.json?${params}`
                );

                const tickets = data.tickets.map((t: any) => ({
                    id: t.id,
                    subject: t.subject,
                    status: t.status,
                    priority: t.priority,
                    type: t.type,
                    requester_id: t.requester_id,
                    assignee_id: t.assignee_id,
                    created_at: t.created_at,
                    updated_at: t.updated_at,
                    tags: t.tags
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
        name: 'zendesk_get_ticket',
        description: 'Get a specific ticket with its comments',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, _meta }: { ticketId: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const [ticketData, commentsData] = await Promise.all([
                    zendeskRequest(creds.subdomain, creds.email, creds.apiToken, `/tickets/${ticketId}.json`),
                    zendeskRequest(creds.subdomain, creds.email, creds.apiToken, `/tickets/${ticketId}/comments.json`)
                ]);

                const ticket = ticketData.ticket;
                const comments = commentsData.comments.slice(0, 5).map((c: any) => ({
                    id: c.id,
                    body: c.plain_body?.substring(0, 200) || c.body?.substring(0, 200),
                    public: c.public,
                    author_id: c.author_id,
                    created_at: c.created_at
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            ticket: {
                                id: ticket.id,
                                subject: ticket.subject,
                                description: ticket.description?.substring(0, 500),
                                status: ticket.status,
                                priority: ticket.priority,
                                type: ticket.type,
                                requester_id: ticket.requester_id,
                                assignee_id: ticket.assignee_id,
                                created_at: ticket.created_at,
                                updated_at: ticket.updated_at,
                                tags: ticket.tags,
                                comments
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
        name: 'zendesk_create_ticket',
        description: 'Create a new support ticket in Zendesk',
        parameters: {
            subject: z.string().describe('Ticket subject'),
            comment: z.string().describe('Initial comment/description'),
            requesterEmail: z.string().email().describe('Requester email address'),
            requesterName: z.string().optional().describe('Requester name'),
            priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('Ticket priority'),
            type: z.enum(['problem', 'incident', 'question', 'task']).optional().describe('Ticket type'),
            tags: z.array(z.string()).optional().describe('Tags to add'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ subject, comment, requesterEmail, requesterName, priority, type, tags, _meta }: {
            subject: string,
            comment: string,
            requesterEmail: string,
            requesterName?: string,
            priority?: string,
            type?: string,
            tags?: string[],
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const ticketData: any = {
                    ticket: {
                        subject,
                        comment: { body: comment },
                        requester: { email: requesterEmail, name: requesterName }
                    }
                };

                if (priority) ticketData.ticket.priority = priority;
                if (type) ticketData.ticket.type = type;
                if (tags && tags.length > 0) ticketData.ticket.tags = tags;

                const data = await zendeskRequest(
                    creds.subdomain,
                    creds.email,
                    creds.apiToken,
                    '/tickets.json',
                    { method: 'POST', body: ticketData }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Ticket created successfully",
                            ticket: {
                                id: data.ticket.id,
                                subject: data.ticket.subject,
                                status: data.ticket.status,
                                priority: data.ticket.priority,
                                created_at: data.ticket.created_at
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

    add_comment: {
        name: 'zendesk_add_comment',
        description: 'Add a comment to an existing ticket',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            body: z.string().describe('Comment body'),
            public: z.boolean().optional().describe('Public comment (default: true)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, body, public: isPublic = true, _meta }: {
            ticketId: number,
            body: string,
            public?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await zendeskRequest(
                    creds.subdomain,
                    creds.email,
                    creds.apiToken,
                    `/tickets/${ticketId}.json`,
                    {
                        method: 'PUT',
                        body: {
                            ticket: {
                                comment: { body, public: isPublic }
                            }
                        }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Comment added successfully",
                            ticket_id: ticketId,
                            updated_at: data.ticket.updated_at
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
        name: 'zendesk_update_ticket',
        description: 'Update an existing ticket',
        parameters: {
            ticketId: z.number().describe('Ticket ID'),
            status: z.enum(['open', 'pending', 'hold', 'solved', 'closed']).optional().describe('New status'),
            priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('New priority'),
            assigneeId: z.number().optional().describe('New assignee user ID'),
            tags: z.array(z.string()).optional().describe('Tags to set'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ ticketId, status, priority, assigneeId, tags, _meta }: {
            ticketId: number,
            status?: string,
            priority?: string,
            assigneeId?: number,
            tags?: string[],
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const ticketUpdate: any = {};
                if (status) ticketUpdate.status = status;
                if (priority) ticketUpdate.priority = priority;
                if (assigneeId) ticketUpdate.assignee_id = assigneeId;
                if (tags) ticketUpdate.tags = tags;

                const data = await zendeskRequest(
                    creds.subdomain,
                    creds.email,
                    creds.apiToken,
                    `/tickets/${ticketId}.json`,
                    { method: 'PUT', body: { ticket: ticketUpdate } }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Ticket updated successfully",
                            ticket: {
                                id: data.ticket.id,
                                status: data.ticket.status,
                                priority: data.ticket.priority,
                                updated_at: data.ticket.updated_at
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

    search_users: {
        name: 'zendesk_search_users',
        description: 'Search for users in Zendesk',
        parameters: {
            query: z.string().describe('Search query (email or name)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ query, _meta }: { query: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZendeskCredentials(tenantId);

            if (!creds.subdomain || !creds.email || !creds.apiToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zendesk credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await zendeskRequest(
                    creds.subdomain,
                    creds.email,
                    creds.apiToken,
                    `/users/search.json?query=${encodeURIComponent(query)}`
                );

                const users = data.users.map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    active: u.active,
                    created_at: u.created_at
                }));

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: users.length,
                            users
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
