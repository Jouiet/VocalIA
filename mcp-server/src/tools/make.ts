import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Make.com (formerly Integromat) MCP Tools - Session 249.8
 *
 * iPaaS Integration - Alternative to Zapier with visual workflow builder
 *
 * Architecture:
 * - Webhook triggers: VocalIA → Make scenarios
 * - Make API: Manage scenarios, executions, data stores
 * - Webhook responses: Make → VocalIA (webhook responses)
 *
 * Pricing Advantage:
 * - More operations per $ than Zapier
 * - Better for complex multi-step workflows
 * - Popular in Europe/MENA markets
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
 * Get Make.com credentials for a tenant
 */
async function getMakeCredentials(tenantId: string = 'agency_internal'): Promise<{
    webhookUrl: string | null;
    apiKey: string | null;
    teamId: string | null;
}> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        return {
            webhookUrl: creds.MAKE_WEBHOOK_URL || null,
            apiKey: creds.MAKE_API_KEY || null,
            teamId: creds.MAKE_TEAM_ID || null
        };
    }
    return {
        webhookUrl: process.env.MAKE_WEBHOOK_URL || null,
        apiKey: process.env.MAKE_API_KEY || null,
        teamId: process.env.MAKE_TEAM_ID || null
    };
}

const MAKE_API_BASE = 'https://eu1.make.com/api/v2';

export const makeTools = {
    trigger_webhook: {
        name: 'make_trigger_webhook',
        description: 'Trigger a Make.com scenario via webhook. Starts automated workflows connecting multiple apps.',
        parameters: {
            webhookUrl: z.string().optional().describe('Specific Make webhook URL (overrides default)'),
            data: z.record(z.string(), z.any()).describe('Data payload to send to Make'),
            eventType: z.string().optional().describe('Event type for tracking (e.g., "lead_qualified", "order_placed")'),
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
                const creds = await getMakeCredentials(tenantId);
                targetUrl = creds.webhookUrl || undefined;
            }

            if (!targetUrl) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com webhook URL",
                            hint: "Provide webhookUrl parameter or configure MAKE_WEBHOOK_URL in tenant credentials"
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
                            message: response.ok ? "Make.com scenario triggered successfully" : "Failed to trigger Make scenario",
                            http_status: response.status,
                            make_response: responseData,
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

    list_scenarios: {
        name: 'make_list_scenarios',
        description: 'List all scenarios in the Make.com team. Requires API key.',
        parameters: {
            teamId: z.string().optional().describe('Team ID override'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ teamId, _meta }: {
            teamId?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMakeCredentials(tenantId);

            const apiKey = creds.apiKey;
            const team = teamId || creds.teamId;

            if (!apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com API key",
                            hint: "Configure MAKE_API_KEY in tenant credentials"
                        }, null, 2)
                    }]
                };
            }

            if (!team) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com team ID",
                            hint: "Configure MAKE_TEAM_ID or provide teamId parameter"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch(`${MAKE_API_BASE}/scenarios?teamId=${team}`, {
                    headers: {
                        'Authorization': `Token ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to list Make scenarios",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                const scenarios = data.scenarios || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            team_id: team,
                            scenario_count: Array.isArray(scenarios) ? scenarios.length : 0,
                            scenarios: Array.isArray(scenarios) ? scenarios.map((s: any) => ({
                                id: s.id,
                                name: s.name,
                                is_active: s.isActive,
                                created: s.createdAt,
                                last_edit: s.updatedAt
                            })) : scenarios
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

    get_scenario: {
        name: 'make_get_scenario',
        description: 'Get details of a specific Make.com scenario.',
        parameters: {
            scenarioId: z.number().describe('Scenario ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ scenarioId, _meta }: {
            scenarioId: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMakeCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com API key"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch(`${MAKE_API_BASE}/scenarios/${scenarioId}`, {
                    headers: {
                        'Authorization': `Token ${creds.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                const data: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to get scenario",
                                http_status: response.status,
                                error: data
                            }, null, 2)
                        }]
                    };
                }

                const scenario = data.scenario || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            scenario: {
                                id: scenario.id,
                                name: scenario.name,
                                description: scenario.description,
                                is_active: scenario.isActive,
                                is_paused: scenario.isPaused,
                                created: scenario.createdAt,
                                last_edit: scenario.updatedAt,
                                scheduling: scenario.scheduling,
                                team_id: scenario.teamId
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

    run_scenario: {
        name: 'make_run_scenario',
        description: 'Manually trigger a Make.com scenario to run immediately.',
        parameters: {
            scenarioId: z.number().describe('Scenario ID to run'),
            data: z.record(z.string(), z.any()).optional().describe('Optional data to pass to the scenario'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ scenarioId, data, _meta }: {
            scenarioId: number,
            data?: Record<string, any>,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMakeCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com API key"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch(`${MAKE_API_BASE}/scenarios/${scenarioId}/run`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${creds.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: data ? JSON.stringify({ data }) : undefined
                });

                const result: any = await response.json();

                if (!response.ok) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Failed to run scenario",
                                http_status: response.status,
                                error: result
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Scenario execution started",
                            scenario_id: scenarioId,
                            execution: result.execution || result,
                            data_provided: data ? Object.keys(data) : []
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
        name: 'make_list_executions',
        description: 'List recent executions of a Make.com scenario.',
        parameters: {
            scenarioId: z.number().describe('Scenario ID'),
            limit: z.number().optional().describe('Number of executions to return (default: 10)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ scenarioId, limit = 10, _meta }: {
            scenarioId: number,
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getMakeCredentials(tenantId);

            if (!creds.apiKey) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Make.com API key"
                        }, null, 2)
                    }]
                };
            }

            try {
                const response = await fetch(
                    `${MAKE_API_BASE}/scenarios/${scenarioId}/executions?pg[limit]=${limit}`,
                    {
                        headers: {
                            'Authorization': `Token ${creds.apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

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

                const executions = data.executions || data;
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            scenario_id: scenarioId,
                            execution_count: Array.isArray(executions) ? executions.length : 0,
                            executions: Array.isArray(executions) ? executions.map((e: any) => ({
                                id: e.id,
                                status: e.status,
                                started: e.startedAt,
                                finished: e.finishedAt,
                                operations: e.operations,
                                duration_ms: e.duration
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
