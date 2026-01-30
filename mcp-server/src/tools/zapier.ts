import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Zapier MCP Tools - Session 249.8
 *
 * iPaaS Integration enabling +7000 app connections via Zapier
 *
 * Architecture:
 * - Webhook triggers: VocalIA → Zapier (starts Zaps)
 * - Zapier NLA API: Natural Language Actions (optional)
 * - Webhook catches: Zapier → VocalIA (receives results)
 *
 * Use Cases:
 * - Trigger CRM updates in any system
 * - Send notifications to any platform
 * - Create records in 7000+ apps
 * - Automate cross-platform workflows
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
 * Get Zapier credentials for a tenant
 */
async function getZapierCredentials(tenantId: string = 'agency_internal'): Promise<{
    webhookUrl: string | null;
    apiKey: string | null;
}> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        return {
            webhookUrl: creds.ZAPIER_WEBHOOK_URL || null,
            apiKey: creds.ZAPIER_API_KEY || null
        };
    }
    return {
        webhookUrl: process.env.ZAPIER_WEBHOOK_URL || null,
        apiKey: process.env.ZAPIER_API_KEY || null
    };
}

export const zapierTools = {
    trigger_webhook: {
        name: 'zapier_trigger_webhook',
        description: 'Trigger a Zapier workflow via webhook. This can start any of 7000+ app integrations configured in Zapier.',
        parameters: {
            webhookUrl: z.string().optional().describe('Specific Zapier webhook URL (overrides default)'),
            data: z.record(z.string(), z.any()).describe('Data payload to send to Zapier'),
            eventType: z.string().optional().describe('Event type for categorization (e.g., "lead_qualified", "booking_created")'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ webhookUrl, data, eventType, _meta }: {
            webhookUrl?: string,
            data: Record<string, any>,
            eventType?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';

            // Get webhook URL from params or tenant config
            let targetUrl: string | undefined = webhookUrl;
            if (!targetUrl) {
                const creds = await getZapierCredentials(tenantId);
                targetUrl = creds.webhookUrl || undefined;
            }

            if (!targetUrl) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zapier webhook URL",
                            hint: "Provide webhookUrl parameter or configure ZAPIER_WEBHOOK_URL in tenant credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Enhance payload with metadata
                const payload = {
                    ...data,
                    _vocalia: {
                        source: 'vocalia-mcp',
                        tenantId,
                        eventType: eventType || 'generic',
                        timestamp: new Date().toISOString()
                    }
                };

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'VocalIA-MCP/1.0'
                    },
                    body: JSON.stringify(payload)
                });

                // Zapier webhooks typically return minimal response
                let responseData: any = null;
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: response.ok ? "success" : "error",
                            message: response.ok ? "Zapier workflow triggered successfully" : "Failed to trigger Zapier workflow",
                            http_status: response.status,
                            zapier_response: responseData,
                            payload_sent: {
                                event_type: eventType || 'generic',
                                data_keys: Object.keys(data),
                                timestamp: payload._vocalia.timestamp
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
                            message: error.message,
                            hint: "Check webhook URL validity and network connectivity"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    trigger_nla: {
        name: 'zapier_trigger_nla',
        description: 'Use Zapier Natural Language Actions to execute an action described in plain text. Requires Zapier NLA API key.',
        parameters: {
            instruction: z.string().describe('Plain text instruction for what action to perform (e.g., "Create a Trello card titled...")'),
            preview: z.boolean().optional().describe('If true, preview the action without executing'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ instruction, preview = false, _meta }: {
            instruction: string,
            preview?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZapierCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zapier API key for NLA",
                            hint: "Configure ZAPIER_API_KEY in tenant credentials. Get it from: https://nla.zapier.com/credentials/"
                        }, null, 2)
                    }]
                };
            }

            try {
                // Zapier NLA API endpoint
                const nlaUrl = 'https://nla.zapier.com/api/v1/dynamic/exposed/';

                const response = await fetch(nlaUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${creds.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        instructions: instruction,
                        preview_only: preview
                    })
                });

                const responseData = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Zapier NLA request failed",
                                http_status: response.status,
                                error: responseData
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: preview ? "Action previewed (not executed)" : "Action executed via Zapier NLA",
                            instruction,
                            preview_mode: preview,
                            result: responseData
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

    list_available_actions: {
        name: 'zapier_list_actions',
        description: 'List available Zapier NLA actions configured for the tenant. Requires Zapier NLA API key.',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZapierCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zapier API key",
                            hint: "Configure ZAPIER_API_KEY to list available NLA actions"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch('https://nla.zapier.com/api/v1/dynamic/exposed/', {
                    headers: {
                        'Authorization': `Bearer ${creds.apiKey}`
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to list Zapier actions",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Available Zapier NLA actions",
                            actions: data.results || data,
                            count: Array.isArray(data.results) ? data.results.length : 'N/A'
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
