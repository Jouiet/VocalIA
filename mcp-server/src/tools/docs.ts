import { z } from 'zod';
import { google } from 'googleapis';
import { createRequire } from 'module';

/**
 * Google Docs MCP Tools - Session 249.4
 *
 * API Reference: https://developers.google.com/docs/api
 * SDK: googleapis (already installed)
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

/**
 * Get Google credentials for a tenant
 */
async function getGoogleCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.GOOGLE_CLIENT_ID && creds.GOOGLE_CLIENT_SECRET && creds.GOOGLE_REFRESH_TOKEN) {
            return {
                clientId: creds.GOOGLE_CLIENT_ID,
                clientSecret: creds.GOOGLE_CLIENT_SECRET,
                refreshToken: creds.GOOGLE_REFRESH_TOKEN,
                redirectUri: creds.GOOGLE_REDIRECT_URI || 'http://localhost:3010/oauth/callback'
            };
        }
    }
    return {
        clientId: process.env.GOOGLE_CLIENT_ID || null,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN || null,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3010/oauth/callback'
    };
}

/**
 * Get authenticated Google Docs client
 */
async function getDocsClient(tenantId: string = 'agency_internal') {
    const creds = await getGoogleCredentials(tenantId);

    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        return null;
    }

    const oauth2Client = new google.auth.OAuth2(
        creds.clientId,
        creds.clientSecret,
        creds.redirectUri
    );

    oauth2Client.setCredentials({
        refresh_token: creds.refreshToken
    });

    return google.docs({ version: 'v1', auth: oauth2Client });
}

export const docsTools = {
    get_document: {
        name: 'docs_get_document',
        description: 'Get a Google Document content and metadata',
        parameters: {
            documentId: z.string().describe('Google Document ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ documentId, _meta }: { documentId: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const docs = await getDocsClient(tenantId);

            if (!docs) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Google credentials",
                            required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
                            hint: "Configure via SecretVault or environment variables"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await docs.documents.get({ documentId });
                const doc = response.data;

                // Extract text content from document body
                let textContent = '';
                if (doc.body?.content) {
                    for (const element of doc.body.content) {
                        if (element.paragraph?.elements) {
                            for (const el of element.paragraph.elements) {
                                if (el.textRun?.content) {
                                    textContent += el.textRun.content;
                                }
                            }
                        }
                    }
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            document: {
                                id: doc.documentId,
                                title: doc.title,
                                revisionId: doc.revisionId,
                                textContent: textContent.substring(0, 2000),
                                contentLength: textContent.length
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

    create_document: {
        name: 'docs_create_document',
        description: 'Create a new Google Document',
        parameters: {
            title: z.string().describe('Document title'),
            content: z.string().optional().describe('Initial text content'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ title, content, _meta }: { title: string, content?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const docs = await getDocsClient(tenantId);

            if (!docs) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Google credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Create empty document
                const createResponse = await docs.documents.create({
                    requestBody: { title }
                });

                const documentId = createResponse.data.documentId;

                // If content provided, insert it
                if (content && documentId) {
                    await docs.documents.batchUpdate({
                        documentId,
                        requestBody: {
                            requests: [{
                                insertText: {
                                    location: { index: 1 },
                                    text: content
                                }
                            }]
                        }
                    });
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Document created successfully",
                            document: {
                                id: documentId,
                                title: createResponse.data.title,
                                url: `https://docs.google.com/document/d/${documentId}/edit`
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

    append_text: {
        name: 'docs_append_text',
        description: 'Append text to the end of a Google Document',
        parameters: {
            documentId: z.string().describe('Google Document ID'),
            text: z.string().describe('Text to append'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ documentId, text, _meta }: { documentId: string, text: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const docs = await getDocsClient(tenantId);

            if (!docs) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Google credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Get document to find end index
                const docResponse = await docs.documents.get({ documentId });
                const doc = docResponse.data;

                // Find end of document
                let endIndex = 1;
                if (doc.body?.content) {
                    const lastElement = doc.body.content[doc.body.content.length - 1];
                    if (lastElement.endIndex) {
                        endIndex = lastElement.endIndex - 1;
                    }
                }

                // Append text
                await docs.documents.batchUpdate({
                    documentId,
                    requestBody: {
                        requests: [{
                            insertText: {
                                location: { index: endIndex },
                                text: '\n' + text
                            }
                        }]
                    }
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Text appended successfully",
                            document_id: documentId,
                            appended_length: text.length
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

    replace_text: {
        name: 'docs_replace_text',
        description: 'Find and replace text in a Google Document',
        parameters: {
            documentId: z.string().describe('Google Document ID'),
            findText: z.string().describe('Text to find'),
            replaceText: z.string().describe('Text to replace with'),
            matchCase: z.boolean().optional().describe('Case sensitive match (default: false)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ documentId, findText, replaceText, matchCase = false, _meta }: {
            documentId: string,
            findText: string,
            replaceText: string,
            matchCase?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const docs = await getDocsClient(tenantId);

            if (!docs) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Google credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await docs.documents.batchUpdate({
                    documentId,
                    requestBody: {
                        requests: [{
                            replaceAllText: {
                                containsText: {
                                    text: findText,
                                    matchCase
                                },
                                replaceText
                            }
                        }]
                    }
                });

                const replaceResult = response.data.replies?.[0]?.replaceAllText;

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Text replaced successfully",
                            document_id: documentId,
                            occurrences_replaced: replaceResult?.occurrencesChanged || 0
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
