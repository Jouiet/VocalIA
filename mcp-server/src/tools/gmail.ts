import { z } from 'zod';
import { createRequire } from 'module';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Gmail MCP Tools - Session 249.9
 *
 * Full Gmail API integration via OAuth2:
 * - Send emails
 * - Read emails
 * - Search emails
 * - Manage labels
 * - Create drafts
 *
 * Requires: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 */

import { corePath } from '../paths.js';

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars
}

interface GmailCredentials {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}

/**
 * Get Gmail OAuth2 credentials for a tenant
 */
async function getGmailCredentials(tenantId: string = 'agency_internal'): Promise<GmailCredentials | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.GMAIL_CLIENT_ID && creds.GMAIL_CLIENT_SECRET && creds.GMAIL_REFRESH_TOKEN) {
            return {
                clientId: creds.GMAIL_CLIENT_ID,
                clientSecret: creds.GMAIL_CLIENT_SECRET,
                refreshToken: creds.GMAIL_REFRESH_TOKEN
            };
        }
    }

    // Fallback to environment variables
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
        return {
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN
        };
    }

    return null;
}

/**
 * Create authenticated Gmail client
 */
async function getGmailClient(tenantId: string = 'agency_internal'): Promise<gmail_v1.Gmail | null> {
    const creds = await getGmailCredentials(tenantId);
    if (!creds) return null;

    const oauth2Client = new OAuth2Client(
        creds.clientId,
        creds.clientSecret,
        'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
        refresh_token: creds.refreshToken
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Encode email for Gmail API
 */
function encodeEmail(to: string, subject: string, body: string, from?: string, cc?: string, html?: string): string {
    const boundary = 'boundary_' + Date.now();

    let email = [
        `From: ${from || 'me'}`,
        `To: ${to}`,
        cc ? `Cc: ${cc}` : '',
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body).toString('base64'),
    ].filter(line => line !== '').join('\r\n');

    if (html) {
        email += [
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: base64',
            '',
            Buffer.from(html).toString('base64'),
            '',
            `--${boundary}--`
        ].join('\r\n');
    } else {
        email += `\r\n--${boundary}--`;
    }

    return Buffer.from(email).toString('base64url');
}

/**
 * Parse Gmail message to readable format
 */
function parseMessage(message: gmail_v1.Schema$Message): {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    snippet: string;
    body: string;
    labels: string[];
} {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64url').toString('utf-8');
    } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
        }
    }

    return {
        id: message.id || '',
        threadId: message.threadId || '',
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        snippet: message.snippet || '',
        body: body.substring(0, 2000), // Limit body size
        labels: message.labelIds || []
    };
}

export const gmailTools = {
    send_email: {
        name: 'gmail_send',
        description: 'Send an email using Gmail API',
        parameters: {
            to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
            subject: z.string().describe('Email subject line'),
            body: z.string().describe('Email body content (plain text)'),
            html: z.string().optional().describe('HTML version of the email body'),
            cc: z.string().optional().describe('CC recipients, comma-separated'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { to: string; subject: string; body: string; html?: string; cc?: string; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured',
                            setup: {
                                required: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
                                guide: 'https://developers.google.com/gmail/api/quickstart'
                            }
                        }, null, 2)
                    }]
                };
            }

            const raw = encodeEmail(params.to, params.subject, params.body, undefined, params.cc, params.html);

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: { raw }
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        messageId: response.data.id,
                        threadId: response.data.threadId,
                        to: params.to,
                        subject: params.subject
                    }, null, 2)
                }]
            };
        }
    },

    list_messages: {
        name: 'gmail_list',
        description: 'List recent emails from Gmail inbox',
        parameters: {
            maxResults: z.number().optional().describe('Maximum number of messages to return (default 10, max 100)'),
            query: z.string().optional().describe('Gmail search query (e.g., "from:user@example.com", "is:unread", "subject:invoice")'),
            labelIds: z.array(z.string()).optional().describe('Filter by label IDs (e.g., ["INBOX", "UNREAD"])'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { maxResults?: number; query?: string; labelIds?: string[]; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const listParams: gmail_v1.Params$Resource$Users$Messages$List = {
                userId: 'me',
                maxResults: Math.min(params.maxResults || 10, 100)
            };

            if (params.query) listParams.q = params.query;
            if (params.labelIds) listParams.labelIds = params.labelIds;

            const listResponse = await gmail.users.messages.list(listParams);
            const messages = listResponse.data.messages || [];

            // Get full message details for each
            const details = await Promise.all(
                messages.slice(0, 20).map(async (msg) => {
                    const full = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                        format: 'full'
                    });
                    return parseMessage(full.data);
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        count: details.length,
                        totalEstimate: listResponse.data.resultSizeEstimate,
                        messages: details
                    }, null, 2)
                }]
            };
        }
    },

    get_message: {
        name: 'gmail_get',
        description: 'Get a specific email by ID',
        parameters: {
            messageId: z.string().describe('Gmail message ID'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { messageId: string; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const response = await gmail.users.messages.get({
                userId: 'me',
                id: params.messageId,
                format: 'full'
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        message: parseMessage(response.data)
                    }, null, 2)
                }]
            };
        }
    },

    search_emails: {
        name: 'gmail_search',
        description: 'Search emails using Gmail query syntax',
        parameters: {
            query: z.string().describe('Gmail search query. Examples: "from:john@example.com", "subject:meeting after:2024/01/01", "has:attachment filename:pdf"'),
            maxResults: z.number().optional().describe('Maximum results (default 20, max 100)'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { query: string; maxResults?: number; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                q: params.query,
                maxResults: Math.min(params.maxResults || 20, 100)
            });

            const messages = listResponse.data.messages || [];

            const details = await Promise.all(
                messages.map(async (msg) => {
                    const full = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                        format: 'metadata',
                        metadataHeaders: ['From', 'To', 'Subject', 'Date']
                    });
                    return parseMessage(full.data);
                })
            );

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        query: params.query,
                        count: details.length,
                        messages: details
                    }, null, 2)
                }]
            };
        }
    },

    create_draft: {
        name: 'gmail_draft',
        description: 'Create a draft email (not sent)',
        parameters: {
            to: z.string().describe('Recipient email address(es)'),
            subject: z.string().describe('Email subject'),
            body: z.string().describe('Email body content'),
            html: z.string().optional().describe('HTML version'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { to: string; subject: string; body: string; html?: string; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const raw = encodeEmail(params.to, params.subject, params.body, undefined, undefined, params.html);

            const response = await gmail.users.drafts.create({
                userId: 'me',
                requestBody: {
                    message: { raw }
                }
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        draftId: response.data.id,
                        messageId: response.data.message?.id,
                        to: params.to,
                        subject: params.subject
                    }, null, 2)
                }]
            };
        }
    },

    list_labels: {
        name: 'gmail_labels',
        description: 'List all Gmail labels',
        parameters: {
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const response = await gmail.users.labels.list({ userId: 'me' });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        labels: response.data.labels?.map(l => ({
                            id: l.id,
                            name: l.name,
                            type: l.type,
                            messagesTotal: l.messagesTotal,
                            messagesUnread: l.messagesUnread
                        }))
                    }, null, 2)
                }]
            };
        }
    },

    modify_labels: {
        name: 'gmail_modify_labels',
        description: 'Add or remove labels from a message',
        parameters: {
            messageId: z.string().describe('Gmail message ID'),
            addLabels: z.array(z.string()).optional().describe('Label IDs to add'),
            removeLabels: z.array(z.string()).optional().describe('Label IDs to remove'),
            tenantId: z.string().optional().describe('Tenant ID for multi-tenant support')
        },
        handler: async (params: { messageId: string; addLabels?: string[]; removeLabels?: string[]; tenantId?: string }) => {
            const gmail = await getGmailClient(params.tenantId);
            if (!gmail) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Gmail credentials not configured'
                        }, null, 2)
                    }]
                };
            }

            const response = await gmail.users.messages.modify({
                userId: 'me',
                id: params.messageId,
                requestBody: {
                    addLabelIds: params.addLabels,
                    removeLabelIds: params.removeLabels
                }
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        messageId: params.messageId,
                        currentLabels: response.data.labelIds
                    }, null, 2)
                }]
            };
        }
    }
};
