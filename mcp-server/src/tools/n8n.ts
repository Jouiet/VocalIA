import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * n8n MCP Tools - Session 249.8
 *
 * Open-source iPaaS Integration - Self-hostable alternative to Zapier/Make
 *
 * Advantages:
 * - Self-hosted: Full control over data
 * - Free core: No per-operation costs
 * - 400+ integrations built-in
 * - Code nodes: JavaScript/Python custom logic
 * - Fair-code license: Source available
 *
 * Architecture:
 * - Webhook triggers: VocalIA → n8n workflows
 * - n8n API: Manage workflows, executions, credentials
 * - Custom code: Complex data transformations
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
 * Get n8n credentials for a tenant
 */
async function getN8nCredentials(tenantId: string = 'agency_internal'): Promise<{
    baseUrl: string | null;
    apiKey: string | null;
    webhookUrl: string | null;
}> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        return {
            baseUrl: creds.N8N_BASE_URL || null,
            apiKey: creds.N8N_API_KEY || null,
            webhookUrl: creds.N8N_WEBHOOK_URL || null
        };
    }
    return {
        baseUrl: process.env.N8N_BASE_URL || null,
        apiKey: process.env.N8N_API_KEY || null,
        webhookUrl: process.env.N8N_WEBHOOK_URL || null
    };
}

export const n8nTools = {
    trigger_webhook: {
        name: 'n8n_trigger_webhook',
        description: 'Trigger an n8n workflow via webhook. Self-hosted automation with 400+ integrations.',
        parameters: {
            webhookUrl: z.string().optional().describe('Specific n8n webhook URL (overrides default)'),
            data: z.record(z.string(), z.any()).describe('Data payload to send to n8n'),
            eventType: z.string().optional().describe('Event type for tracking'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ webhookUrl, data, eventType, _meta }: {
            webhookUrl?: string,
            data: Record<string, any>,
            eventType?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';

            let targetUrl: string | undefined = webhookUrl;
            if (!targetUrl) {
                const creds = await getN8nCredentials(tenantId);
                targetUrl = creds.webhookUrl || undefined;
            }

            if (!targetUrl) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing n8n webhook URL",
                            hint: "Provide webhookUrl parameter or configure N8N_WEBHOOK_URL in tenant credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
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
                            message: response.ok ? "n8n workflow triggered successfully" : "Failed to trigger n8n workflow",
                            http_status: response.status,
                            n8n_response: responseData,
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
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    list_workflows: {
        name: 'n8n_list_workflows',
        description: 'List all workflows in the n8n instance.',
        parameters: {
            active: z.boolean().optional().describe('Filter by active status'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ active, _meta }: {
            active?: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getN8nCredentials(tenantId);

            if (!creds.baseUrl || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing n8n API credentials",
                            hint: "Configure N8N_BASE_URL and N8N_API_KEY in tenant credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                let url = `${creds.baseUrl}/api/v1/workflows`;
                if (active !== undefined) {
                    url += `?active=${active}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'X-N8N-API-KEY': creds.apiKey,
                        'Accept': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to list n8n workflows",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                const workflows = data.data || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            n8n_instance: creds.baseUrl,
                            workflow_count: Array.isArray(workflows) ? workflows.length : 0,
                            workflows: Array.isArray(workflows) ? workflows.map((w: any) => ({
                                id: w.id,
                                name: w.name,
                                active: w.active,
                                created: w.createdAt,
                                updated: w.updatedAt,
                                tags: w.tags
                            })) : workflows
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

    get_workflow: {
        name: 'n8n_get_workflow',
        description: 'Get details of a specific n8n workflow.',
        parameters: {
            workflowId: z.string().describe('Workflow ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ workflowId, _meta }: {
            workflowId: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getN8nCredentials(tenantId);

            if (!creds.baseUrl || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing n8n API credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch(`${creds.baseUrl}/api/v1/workflows/${workflowId}`, {
                    headers: {
                        'X-N8N-API-KEY': creds.apiKey,
                        'Accept': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to get workflow",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                const workflow = data.data || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            workflow: {
                                id: workflow.id,
                                name: workflow.name,
                                active: workflow.active,
                                created: workflow.createdAt,
                                updated: workflow.updatedAt,
                                node_count: workflow.nodes?.length || 0,
                                tags: workflow.tags,
                                settings: workflow.settings
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

    activate_workflow: {
        name: 'n8n_activate_workflow',
        description: 'Activate or deactivate an n8n workflow.',
        parameters: {
            workflowId: z.string().describe('Workflow ID'),
            active: z.boolean().describe('Set to true to activate, false to deactivate'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ workflowId, active, _meta }: {
            workflowId: string,
            active: boolean,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getN8nCredentials(tenantId);

            if (!creds.baseUrl || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing n8n API credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const endpoint = active ? 'activate' : 'deactivate';
                const response = await fetch(`${creds.baseUrl}/api/v1/workflows/${workflowId}/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'X-N8N-API-KEY': creds.apiKey,
                        'Accept': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: `Failed to ${endpoint} workflow`,
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
                            message: `Workflow ${active ? 'activated' : 'deactivated'} successfully`,
                            workflow_id: workflowId,
                            new_state: active ? 'active' : 'inactive'
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

    list_executions: {
        name: 'n8n_list_executions',
        description: 'List recent workflow executions.',
        parameters: {
            workflowId: z.string().optional().describe('Filter by workflow ID'),
            status: z.enum(['success', 'error', 'waiting']).optional().describe('Filter by execution status'),
            limit: z.number().optional().describe('Number of executions to return (default: 20)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ workflowId, status, limit = 20, _meta }: {
            workflowId?: string,
            status?: 'success' | 'error' | 'waiting',
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getN8nCredentials(tenantId);

            if (!creds.baseUrl || !creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing n8n API credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params = new URLSearchParams();
                params.set('limit', limit.toString());
                if (workflowId) params.set('workflowId', workflowId);
                if (status) params.set('status', status);

                const response = await fetch(`${creds.baseUrl}/api/v1/executions?${params}`, {
                    headers: {
                        'X-N8N-API-KEY': creds.apiKey,
                        'Accept': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to list executions",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                const executions = data.data || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            filters: { workflowId, status, limit },
                            execution_count: Array.isArray(executions) ? executions.length : 0,
                            executions: Array.isArray(executions) ? executions.map((e: any) => ({
                                id: e.id,
                                workflow_id: e.workflowId,
                                workflow_name: e.workflowData?.name,
                                status: e.status || (e.finished ? 'success' : 'running'),
                                started: e.startedAt,
                                finished: e.stoppedAt,
                                mode: e.mode
                            })) : executions
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
