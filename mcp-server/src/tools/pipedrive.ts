import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Pipedrive CRM MCP Tools - Session 249.2
 *
 * API Reference: https://developers.pipedrive.com/docs/api/v2
 * API Version: v2 (v1 deprecated Dec 2025)
 * Auth: API Token in query string
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
 * Get Pipedrive credentials for a tenant
 */
async function getPipedriveCredentials(tenantId: string = 'agency_internal'): Promise<{ apiToken: string | null, domain: string | null }> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.PIPEDRIVE_API_TOKEN && creds.PIPEDRIVE_DOMAIN) {
            return {
                apiToken: creds.PIPEDRIVE_API_TOKEN,
                domain: creds.PIPEDRIVE_DOMAIN
            };
        }
    }
    return {
        apiToken: process.env.PIPEDRIVE_API_TOKEN || null,
        domain: process.env.PIPEDRIVE_DOMAIN || null
    };
}

/**
 * Make authenticated request to Pipedrive API v2
 */
async function pipedriveRequest(
    domain: string,
    apiToken: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<any> {
    const url = new URL(`https://${domain}.pipedrive.com/api/v2${endpoint}`);
    url.searchParams.append('api_token', apiToken);

    if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
            url.searchParams.append(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pipedrive API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const pipedriveTools = {
    list_deals: {
        name: 'pipedrive_list_deals',
        description: 'List deals from Pipedrive CRM',
        parameters: {
            status: z.enum(['open', 'won', 'lost', 'all_not_deleted']).optional()
                .describe('Filter deals by status'),
            limit: z.number().optional().describe('Number of deals to return (default: 100, max: 500)'),
            ownerId: z.number().optional().describe('Filter by owner user ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ status, limit = 100, ownerId, _meta }: {
            status?: string,
            limit?: number,
            ownerId?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN",
                            hint: "Get your API token from Pipedrive Settings > Personal Preferences > API"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: Math.min(limit, 500).toString()
                };
                if (status) params.status = status;
                if (ownerId) params.owner_id = ownerId.toString();

                const data = await pipedriveRequest(domain, apiToken, '/deals', { params });

                const deals = data.data?.map((deal: any) => ({
                    id: deal.id,
                    title: deal.title,
                    value: deal.value,
                    currency: deal.currency,
                    status: deal.status,
                    stage_id: deal.stage_id,
                    pipeline_id: deal.pipeline_id,
                    person_id: deal.person_id,
                    org_id: deal.org_id,
                    owner_id: deal.owner_id,
                    add_time: deal.add_time,
                    update_time: deal.update_time,
                    expected_close_date: deal.expected_close_date
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: deals.length,
                            deals
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

    create_deal: {
        name: 'pipedrive_create_deal',
        description: 'Create a new deal in Pipedrive CRM',
        parameters: {
            title: z.string().describe('Deal title'),
            value: z.number().optional().describe('Deal value'),
            currency: z.string().optional().describe('Currency code (e.g., USD, EUR, MAD)'),
            personId: z.number().optional().describe('Associated person ID'),
            orgId: z.number().optional().describe('Associated organization ID'),
            stageId: z.number().optional().describe('Pipeline stage ID'),
            expectedCloseDate: z.string().optional().describe('Expected close date (YYYY-MM-DD)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ title, value, currency, personId, orgId, stageId, expectedCloseDate, _meta }: {
            title: string,
            value?: number,
            currency?: string,
            personId?: number,
            orgId?: number,
            stageId?: number,
            expectedCloseDate?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = { title };
                if (value !== undefined) body.value = value;
                if (currency) body.currency = currency;
                if (personId) body.person_id = personId;
                if (orgId) body.org_id = orgId;
                if (stageId) body.stage_id = stageId;
                if (expectedCloseDate) body.expected_close_date = expectedCloseDate;

                const data = await pipedriveRequest(domain, apiToken, '/deals', {
                    method: 'POST',
                    body
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Deal created successfully",
                            deal: {
                                id: data.data.id,
                                title: data.data.title,
                                value: data.data.value,
                                status: data.data.status,
                                add_time: data.data.add_time
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

    update_deal: {
        name: 'pipedrive_update_deal',
        description: 'Update an existing deal in Pipedrive',
        parameters: {
            dealId: z.number().describe('Deal ID'),
            title: z.string().optional().describe('New deal title'),
            value: z.number().optional().describe('New deal value'),
            status: z.enum(['open', 'won', 'lost']).optional().describe('New deal status'),
            stageId: z.number().optional().describe('New stage ID'),
            expectedCloseDate: z.string().optional().describe('New expected close date (YYYY-MM-DD)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ dealId, title, value, status, stageId, expectedCloseDate, _meta }: {
            dealId: number,
            title?: string,
            value?: number,
            status?: 'open' | 'won' | 'lost',
            stageId?: number,
            expectedCloseDate?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = {};
                if (title) body.title = title;
                if (value !== undefined) body.value = value;
                if (status) body.status = status;
                if (stageId) body.stage_id = stageId;
                if (expectedCloseDate) body.expected_close_date = expectedCloseDate;

                const data = await pipedriveRequest(domain, apiToken, `/deals/${dealId}`, {
                    method: 'PATCH',
                    body
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Deal updated successfully",
                            deal: {
                                id: data.data.id,
                                title: data.data.title,
                                value: data.data.value,
                                status: data.data.status,
                                update_time: data.data.update_time
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

    list_persons: {
        name: 'pipedrive_list_persons',
        description: 'List persons (contacts) from Pipedrive',
        parameters: {
            limit: z.number().optional().describe('Number of persons to return (default: 100)'),
            orgId: z.number().optional().describe('Filter by organization ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ limit = 100, orgId, _meta }: {
            limit?: number,
            orgId?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: limit.toString()
                };
                if (orgId) params.org_id = orgId.toString();

                const data = await pipedriveRequest(domain, apiToken, '/persons', { params });

                const persons = data.data?.map((person: any) => ({
                    id: person.id,
                    name: person.name,
                    email: person.email?.[0]?.value,
                    phone: person.phone?.[0]?.value,
                    org_id: person.org_id,
                    owner_id: person.owner_id,
                    add_time: person.add_time,
                    update_time: person.update_time
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: persons.length,
                            persons
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

    create_person: {
        name: 'pipedrive_create_person',
        description: 'Create a new person (contact) in Pipedrive',
        parameters: {
            name: z.string().describe('Person name'),
            email: z.string().email().optional().describe('Email address'),
            phone: z.string().optional().describe('Phone number'),
            orgId: z.number().optional().describe('Organization ID to associate'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ name, email, phone, orgId, _meta }: {
            name: string,
            email?: string,
            phone?: string,
            orgId?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const body: any = { name };
                if (email) body.email = [{ value: email, primary: true }];
                if (phone) body.phone = [{ value: phone, primary: true }];
                if (orgId) body.org_id = orgId;

                const data = await pipedriveRequest(domain, apiToken, '/persons', {
                    method: 'POST',
                    body
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Person created successfully",
                            person: {
                                id: data.data.id,
                                name: data.data.name,
                                email: data.data.email?.[0]?.value,
                                phone: data.data.phone?.[0]?.value,
                                add_time: data.data.add_time
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

    search: {
        name: 'pipedrive_search',
        description: 'Search across deals, persons, and organizations in Pipedrive',
        parameters: {
            term: z.string().describe('Search term'),
            itemType: z.enum(['deal', 'person', 'organization']).optional().describe('Filter by item type'),
            limit: z.number().optional().describe('Number of results (default: 10)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ term, itemType, limit = 10, _meta }: {
            term: string,
            itemType?: string,
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    term,
                    limit: limit.toString()
                };
                if (itemType) params.item_types = itemType;

                // Note: Search uses v1 API
                const url = new URL(`https://${domain}.pipedrive.com/api/v1/itemSearch`);
                url.searchParams.append('api_token', apiToken);
                for (const [key, value] of Object.entries(params)) {
                    url.searchParams.append(key, value);
                }

                const response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status}`);
                }

                const data: any = await response.json();

                const results = data.data?.items?.map((item: any) => ({
                    type: item.item.type,
                    id: item.item.id,
                    title: item.item.title || item.item.name,
                    custom_fields: item.item.custom_fields
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: results.length,
                            results
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

    list_activities: {
        name: 'pipedrive_list_activities',
        description: 'List activities (calls, meetings, tasks) from Pipedrive',
        parameters: {
            type: z.string().optional().describe('Activity type (e.g., "call", "meeting", "task")'),
            done: z.boolean().optional().describe('Filter by completion status'),
            personId: z.number().optional().describe('Filter by person ID'),
            dealId: z.number().optional().describe('Filter by deal ID'),
            limit: z.number().optional().describe('Number of activities to return (default: 100)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ type, done, personId, dealId, limit = 100, _meta }: {
            type?: string,
            done?: boolean,
            personId?: number,
            dealId?: number,
            limit?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const { apiToken, domain } = await getPipedriveCredentials(tenantId);

            if (!apiToken || !domain) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing PIPEDRIVE_API_TOKEN or PIPEDRIVE_DOMAIN"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    limit: limit.toString()
                };
                if (type) params.type = type;
                if (done !== undefined) params.done = done.toString();
                if (personId) params.person_id = personId.toString();
                if (dealId) params.deal_id = dealId.toString();

                const data = await pipedriveRequest(domain, apiToken, '/activities', { params });

                const activities = data.data?.map((act: any) => ({
                    id: act.id,
                    type: act.type,
                    subject: act.subject,
                    done: act.done,
                    due_date: act.due_date,
                    due_time: act.due_time,
                    duration: act.duration,
                    person_id: act.person_id,
                    deal_id: act.deal_id,
                    org_id: act.org_id,
                    note: act.note?.substring(0, 200)
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: activities.length,
                            activities
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
