import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Intercom MCP Tools - Session 249.5
 *
 * API Reference: https://developers.intercom.com/docs/references/rest-api/
 * API Version: 2.11
 * Auth: Bearer Token (Access Token)
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

const INTERCOM_API_BASE = 'https://api.intercom.io';

/**
 * Get Intercom access token for a tenant
 */
async function getIntercomToken(tenantId: string = 'agency_internal'): Promise<string | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.INTERCOM_ACCESS_TOKEN) {
            return creds.INTERCOM_ACCESS_TOKEN;
        }
    }
    return process.env.INTERCOM_ACCESS_TOKEN || null;
}

/**
 * Make authenticated request to Intercom API
 */
async function intercomRequest(
    endpoint: string,
    token: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const url = `${INTERCOM_API_BASE}${endpoint}`;

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Intercom-Version': '2.11'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Intercom API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const intercomTools = {
    list_contacts: {
        name: 'intercom_list_contacts',
        description: 'List Intercom contacts (users and leads)',
        parameters: {
            per_page: z.number().min(1).max(150).optional().describe('Results per page (default: 50, max: 150)'),
            starting_after: z.string().optional().describe('Cursor for pagination'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 50, starting_after, _meta }: {
            per_page?: number,
            starting_after?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN",
                            hint: "Get your token from Intercom Developer Hub > Your App > Authentication"
                        }, null, 2)
                    }]
                };
            }

            try {
                let endpoint = `/contacts?per_page=${per_page}`;
                if (starting_after) endpoint += `&starting_after=${starting_after}`;

                const data = await intercomRequest(endpoint, token);

                const contacts = data.data?.map((contact: any) => ({
                    id: contact.id,
                    type: contact.role,
                    external_id: contact.external_id,
                    email: contact.email,
                    phone: contact.phone,
                    name: contact.name,
                    created_at: contact.created_at,
                    updated_at: contact.updated_at,
                    signed_up_at: contact.signed_up_at,
                    last_seen_at: contact.last_seen_at,
                    unsubscribed_from_emails: contact.unsubscribed_from_emails,
                    tags: contact.tags?.data?.length || 0,
                    companies: contact.companies?.data?.length || 0
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: contacts.length,
                            total_count: data.total_count,
                            has_more: data.pages?.next ? true : false,
                            next_cursor: data.pages?.next?.starting_after,
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
    },

    get_contact: {
        name: 'intercom_get_contact',
        description: 'Get a specific Intercom contact by ID',
        parameters: {
            contact_id: z.string().describe('Intercom contact ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ contact_id, _meta }: { contact_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const contact = await intercomRequest(`/contacts/${contact_id}`, token);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            contact: {
                                id: contact.id,
                                type: contact.role,
                                external_id: contact.external_id,
                                email: contact.email,
                                phone: contact.phone,
                                name: contact.name,
                                avatar: contact.avatar,
                                owner_id: contact.owner_id,
                                social_profiles: contact.social_profiles?.data,
                                has_hard_bounced: contact.has_hard_bounced,
                                marked_email_as_spam: contact.marked_email_as_spam,
                                unsubscribed_from_emails: contact.unsubscribed_from_emails,
                                created_at: contact.created_at,
                                updated_at: contact.updated_at,
                                signed_up_at: contact.signed_up_at,
                                last_seen_at: contact.last_seen_at,
                                last_contacted_at: contact.last_contacted_at,
                                last_replied_at: contact.last_replied_at,
                                last_email_opened_at: contact.last_email_opened_at,
                                last_email_clicked_at: contact.last_email_clicked_at,
                                language_override: contact.language_override,
                                browser: contact.browser,
                                browser_language: contact.browser_language,
                                os: contact.os,
                                location: contact.location,
                                custom_attributes: contact.custom_attributes,
                                tags: contact.tags?.data,
                                notes: contact.notes?.data?.length || 0,
                                companies: contact.companies?.data
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
        name: 'intercom_search_contacts',
        description: 'Search Intercom contacts by email or name',
        parameters: {
            email: z.string().optional().describe('Search by email'),
            name: z.string().optional().describe('Search by name'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ email, name, _meta }: {
            email?: string,
            name?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            if (!email && !name) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Must provide either email or name to search"
                        }, null, 2)
                    }]
                };
            }

            try {
                const query: any = {
                    operator: 'AND',
                    value: []
                };

                if (email) {
                    query.value.push({
                        field: 'email',
                        operator: '=',
                        value: email
                    });
                }

                if (name) {
                    query.value.push({
                        field: 'name',
                        operator: '~',
                        value: name
                    });
                }

                const data = await intercomRequest('/contacts/search', token, {
                    method: 'POST',
                    body: { query }
                });

                const contacts = data.data?.map((contact: any) => ({
                    id: contact.id,
                    type: contact.role,
                    email: contact.email,
                    phone: contact.phone,
                    name: contact.name,
                    created_at: contact.created_at,
                    last_seen_at: contact.last_seen_at
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: contacts.length,
                            total_count: data.total_count,
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
    },

    list_conversations: {
        name: 'intercom_list_conversations',
        description: 'List Intercom conversations',
        parameters: {
            per_page: z.number().min(1).max(150).optional().describe('Results per page (default: 20, max: 150)'),
            starting_after: z.string().optional().describe('Cursor for pagination'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 20, starting_after, _meta }: {
            per_page?: number,
            starting_after?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                let endpoint = `/conversations?per_page=${per_page}`;
                if (starting_after) endpoint += `&starting_after=${starting_after}`;

                const data = await intercomRequest(endpoint, token);

                const conversations = data.conversations?.map((conv: any) => ({
                    id: conv.id,
                    title: conv.title,
                    state: conv.state,
                    open: conv.open,
                    read: conv.read,
                    priority: conv.priority,
                    created_at: conv.created_at,
                    updated_at: conv.updated_at,
                    waiting_since: conv.waiting_since,
                    snoozed_until: conv.snoozed_until,
                    source: conv.source?.type,
                    contacts: conv.contacts?.contacts?.length || 0,
                    teammates: conv.teammates?.admins?.length || 0,
                    tags: conv.tags?.tags?.length || 0,
                    statistics: conv.statistics
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: conversations.length,
                            total_count: data.total_count,
                            has_more: data.pages?.next ? true : false,
                            next_cursor: data.pages?.next?.starting_after,
                            conversations
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

    get_conversation: {
        name: 'intercom_get_conversation',
        description: 'Get a specific Intercom conversation with full details',
        parameters: {
            conversation_id: z.string().describe('Conversation ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ conversation_id, _meta }: { conversation_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const conv = await intercomRequest(`/conversations/${conversation_id}`, token);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            conversation: {
                                id: conv.id,
                                title: conv.title,
                                state: conv.state,
                                open: conv.open,
                                read: conv.read,
                                priority: conv.priority,
                                created_at: conv.created_at,
                                updated_at: conv.updated_at,
                                waiting_since: conv.waiting_since,
                                snoozed_until: conv.snoozed_until,
                                source: conv.source,
                                first_contact_reply: conv.first_contact_reply,
                                contacts: conv.contacts?.contacts,
                                teammates: conv.teammates?.admins,
                                assignee: conv.assignee,
                                custom_attributes: conv.custom_attributes,
                                tags: conv.tags?.tags,
                                conversation_parts: conv.conversation_parts?.conversation_parts?.slice(0, 10)?.map((part: any) => ({
                                    id: part.id,
                                    part_type: part.part_type,
                                    body: part.body?.substring(0, 500),
                                    created_at: part.created_at,
                                    author: part.author
                                })),
                                statistics: conv.statistics
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

    reply_conversation: {
        name: 'intercom_reply_conversation',
        description: 'Reply to an Intercom conversation as admin',
        parameters: {
            conversation_id: z.string().describe('Conversation ID'),
            admin_id: z.string().describe('Admin ID sending the reply'),
            message: z.string().describe('Reply message body'),
            message_type: z.enum(['comment', 'note']).optional().describe('Type of reply (default: comment)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ conversation_id, admin_id, message, message_type = 'comment', _meta }: {
            conversation_id: string,
            admin_id: string,
            message: string,
            message_type?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const token = await getIntercomToken(tenantId);

            if (!token) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing INTERCOM_ACCESS_TOKEN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const reply = await intercomRequest(`/conversations/${conversation_id}/reply`, token, {
                    method: 'POST',
                    body: {
                        message_type,
                        type: 'admin',
                        admin_id,
                        body: message
                    }
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Reply sent successfully",
                            conversation_id: reply.id,
                            state: reply.state,
                            open: reply.open
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
