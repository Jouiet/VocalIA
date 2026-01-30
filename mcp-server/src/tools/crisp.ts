import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Crisp MCP Tools - Session 249.5
 *
 * API Reference: https://docs.crisp.chat/api/v1/
 * API Version: v1
 * Auth: Basic Auth (Identifier:Key) + Website ID
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

const CRISP_API_BASE = 'https://api.crisp.chat/v1';

/**
 * Get Crisp credentials for a tenant
 */
async function getCrispCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.CRISP_IDENTIFIER && creds.CRISP_KEY && creds.CRISP_WEBSITE_ID) {
            return {
                identifier: creds.CRISP_IDENTIFIER,
                key: creds.CRISP_KEY,
                websiteId: creds.CRISP_WEBSITE_ID
            };
        }
    }
    return {
        identifier: process.env.CRISP_IDENTIFIER || null,
        key: process.env.CRISP_KEY || null,
        websiteId: process.env.CRISP_WEBSITE_ID || null
    };
}

/**
 * Make authenticated request to Crisp API
 */
async function crispRequest(
    identifier: string,
    key: string,
    endpoint: string,
    options: { method?: string; body?: any } = {}
): Promise<any> {
    const url = `${CRISP_API_BASE}${endpoint}`;
    const authString = Buffer.from(`${identifier}:${key}`).toString('base64');

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
            'X-Crisp-Tier': 'plugin'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Crisp API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const crispTools = {
    list_conversations: {
        name: 'crisp_list_conversations',
        description: 'List Crisp conversations for a website',
        parameters: {
            page_number: z.number().min(1).optional().describe('Page number (default: 1)'),
            filter_inbox: z.enum(['all', 'unread', 'unresolved', 'resolved']).optional()
                .describe('Filter by inbox status'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ page_number = 1, filter_inbox, _meta }: {
            page_number?: number,
            filter_inbox?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials",
                            required: ["CRISP_IDENTIFIER", "CRISP_KEY", "CRISP_WEBSITE_ID"],
                            hint: "Get credentials from Crisp > Settings > API Keys"
                        }, null, 2)
                    }]
                };
            }

            try {
                let endpoint = `/website/${creds.websiteId}/conversations/${page_number}`;
                if (filter_inbox) endpoint += `?filter_inbox=${filter_inbox}`;

                const data = await crispRequest(creds.identifier, creds.key, endpoint);

                const conversations = data.data?.map((conv: any) => ({
                    session_id: conv.session_id,
                    inbox_id: conv.inbox_id,
                    state: conv.state,
                    is_verified: conv.is_verified,
                    is_blocked: conv.is_blocked,
                    availability: conv.availability,
                    created_at: conv.created_at,
                    updated_at: conv.updated_at,
                    last_message: conv.last_message,
                    unread: conv.unread,
                    mentions: conv.mentions,
                    assigned: conv.assigned,
                    meta: {
                        nickname: conv.meta?.nickname,
                        email: conv.meta?.email,
                        phone: conv.meta?.phone,
                        avatar: conv.meta?.avatar,
                        ip: conv.meta?.ip,
                        device: conv.meta?.device,
                        segments: conv.meta?.segments
                    }
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: conversations.length,
                            page: page_number,
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
        name: 'crisp_get_conversation',
        description: 'Get a specific Crisp conversation with messages',
        parameters: {
            session_id: z.string().describe('Conversation session ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ session_id, _meta }: { session_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await crispRequest(
                    creds.identifier,
                    creds.key,
                    `/website/${creds.websiteId}/conversation/${session_id}`
                );

                const conv = data.data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            conversation: {
                                session_id: conv.session_id,
                                inbox_id: conv.inbox_id,
                                state: conv.state,
                                is_verified: conv.is_verified,
                                is_blocked: conv.is_blocked,
                                availability: conv.availability,
                                created_at: conv.created_at,
                                updated_at: conv.updated_at,
                                unread: conv.unread,
                                mentions: conv.mentions,
                                assigned: conv.assigned,
                                meta: conv.meta,
                                people: conv.people
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

    get_messages: {
        name: 'crisp_get_messages',
        description: 'Get messages from a Crisp conversation',
        parameters: {
            session_id: z.string().describe('Conversation session ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ session_id, _meta }: { session_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await crispRequest(
                    creds.identifier,
                    creds.key,
                    `/website/${creds.websiteId}/conversation/${session_id}/messages`
                );

                const messages = data.data?.map((msg: any) => ({
                    fingerprint: msg.fingerprint,
                    type: msg.type,
                    from: msg.from,
                    origin: msg.origin,
                    content: typeof msg.content === 'string' ? msg.content.substring(0, 500) : msg.content,
                    timestamp: msg.timestamp,
                    read: msg.read,
                    delivered: msg.delivered,
                    user: msg.user
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: messages.length,
                            session_id,
                            messages
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

    send_message: {
        name: 'crisp_send_message',
        description: 'Send a message in a Crisp conversation',
        parameters: {
            session_id: z.string().describe('Conversation session ID'),
            content: z.string().describe('Message content'),
            type: z.enum(['text', 'note']).optional().describe('Message type (default: text)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ session_id, content, type = 'text', _meta }: {
            session_id: string,
            content: string,
            type?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await crispRequest(
                    creds.identifier,
                    creds.key,
                    `/website/${creds.websiteId}/conversation/${session_id}/message`,
                    {
                        method: 'POST',
                        body: {
                            type,
                            from: 'operator',
                            origin: 'chat',
                            content
                        }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Message sent successfully",
                            session_id,
                            fingerprint: data.data?.fingerprint
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

    update_conversation_state: {
        name: 'crisp_update_conversation_state',
        description: 'Update the state of a Crisp conversation (resolve, unresolve)',
        parameters: {
            session_id: z.string().describe('Conversation session ID'),
            state: z.enum(['pending', 'unresolved', 'resolved']).describe('New conversation state'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ session_id, state, _meta }: {
            session_id: string,
            state: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                await crispRequest(
                    creds.identifier,
                    creds.key,
                    `/website/${creds.websiteId}/conversation/${session_id}/state`,
                    {
                        method: 'PATCH',
                        body: { state }
                    }
                );

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: `Conversation state updated to ${state}`,
                            session_id,
                            state
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

    get_people_profile: {
        name: 'crisp_get_people_profile',
        description: 'Get a Crisp people profile (visitor data)',
        parameters: {
            people_id: z.string().describe('People ID (email or session ID)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ people_id, _meta }: { people_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getCrispCredentials(tenantId);

            if (!creds.identifier || !creds.key || !creds.websiteId) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Crisp credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await crispRequest(
                    creds.identifier,
                    creds.key,
                    `/website/${creds.websiteId}/people/profile/${people_id}`
                );

                const profile = data.data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            profile: {
                                people_id: profile.people_id,
                                email: profile.email,
                                person: profile.person,
                                company: profile.company,
                                geolocation: profile.geolocation,
                                segments: profile.segments,
                                active: profile.active,
                                notepad: profile.notepad?.substring(0, 200),
                                created_at: profile.created_at,
                                updated_at: profile.updated_at
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
    }
};
