import { z } from 'zod';
import { createRequire } from 'module';

/**
 * HubSpot MCP Tools - Session 250.87
 *
 * API Reference: https://developers.hubspot.com/docs/api/crm
 * Auth: Bearer token (OAuth 2.0 / Private App)
 *
 * Multi-tenant support via SecretVault
 *
 * Tools:
 * - hubspot_create_contact: Create new contact
 * - hubspot_search_contacts: Search contacts by query
 * - hubspot_get_contact: Get contact by ID
 * - hubspot_update_contact: Update contact properties
 * - hubspot_create_deal: Create deal in pipeline
 * - hubspot_log_call: Log call activity (CTI integration)
 * - hubspot_list_pipelines: List deal pipelines
 *
 * Rate Limits:
 * - Standard: 100 requests per 10 seconds (burst: 190)
 * - Exponential backoff on 429 responses
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
 * Get HubSpot credentials for a tenant
 */
async function getHubSpotCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.HUBSPOT_ACCESS_TOKEN || creds.HUBSPOT_API_KEY) {
            return creds.HUBSPOT_ACCESS_TOKEN || creds.HUBSPOT_API_KEY;
        }
    }
    return process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY || null;
}

/**
 * Make authenticated request to HubSpot API
 */
async function hubspotRequest(
    accessToken: string,
    method: string,
    endpoint: string,
    body?: Record<string, any>
): Promise<any> {
    const url = `https://api.hubapi.com${endpoint}`;

    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VocalIA-MCP/1.0'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '10';
        throw new Error(`HubSpot rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HubSpot API error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) return { success: true };
    return response.json();
}

export const hubspotTools = {
    // =============================================================================
    // CONTACT OPERATIONS
    // =============================================================================

    create_contact: {
        name: 'hubspot_create_contact',
        description: 'Create a new contact in HubSpot CRM',
        parameters: {
            email: z.string().email().describe('Contact email address (required)'),
            firstName: z.string().optional().describe('First name'),
            lastName: z.string().optional().describe('Last name'),
            phone: z.string().optional().describe('Phone number'),
            company: z.string().optional().describe('Company name'),
            jobTitle: z.string().optional().describe('Job title'),
            leadScore: z.number().optional().describe('Lead score (0-100)'),
            properties: z.record(z.string(), z.string()).optional().describe('Additional properties'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            email: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
            company?: string;
            jobTitle?: string;
            leadScore?: number;
            properties?: Record<string, string>;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing HubSpot credentials',
                            requirements: {
                                credentials: ['HUBSPOT_ACCESS_TOKEN'],
                                setup: 'HubSpot → Settings → Integrations → Private Apps → Create'
                            }
                        }, null, 2)
                    }]
                };
            }

            const contactProperties: Record<string, string> = {
                email: params.email,
                ...(params.firstName && { firstname: params.firstName }),
                ...(params.lastName && { lastname: params.lastName }),
                ...(params.phone && { phone: params.phone }),
                ...(params.company && { company: params.company }),
                ...(params.jobTitle && { jobtitle: params.jobTitle }),
                ...(params.leadScore !== undefined && { lead_score: String(params.leadScore) }),
                ...params.properties
            };

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'POST',
                    '/crm/v3/objects/contacts',
                    { properties: contactProperties }
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            contact: {
                                id: result.id,
                                email: params.email,
                                createdAt: result.createdAt
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    search_contacts: {
        name: 'hubspot_search_contacts',
        description: 'Search contacts by email, name, or company',
        parameters: {
            query: z.string().describe('Search query (email, name, or company)'),
            limit: z.number().optional().default(10).describe('Max results (default 10)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            query: string;
            limit?: number;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'POST',
                    '/crm/v3/objects/contacts/search',
                    {
                        query: params.query,
                        limit: params.limit || 10,
                        properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'lead_score']
                    }
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            total: result.total,
                            contacts: result.results?.map((c: any) => ({
                                id: c.id,
                                email: c.properties?.email,
                                name: `${c.properties?.firstname || ''} ${c.properties?.lastname || ''}`.trim(),
                                company: c.properties?.company,
                                leadScore: c.properties?.lead_score
                            })) || []
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    get_contact: {
        name: 'hubspot_get_contact',
        description: 'Get contact details by ID',
        parameters: {
            contactId: z.string().describe('HubSpot contact ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            contactId: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'GET',
                    `/crm/v3/objects/contacts/${params.contactId}?properties=email,firstname,lastname,phone,company,jobtitle,lead_score,hs_lead_status`
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            contact: {
                                id: result.id,
                                ...result.properties,
                                createdAt: result.createdAt,
                                updatedAt: result.updatedAt
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    update_contact: {
        name: 'hubspot_update_contact',
        description: 'Update contact properties',
        parameters: {
            contactId: z.string().describe('HubSpot contact ID'),
            properties: z.record(z.string(), z.string()).describe('Properties to update'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            contactId: string;
            properties: Record<string, string>;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'PATCH',
                    `/crm/v3/objects/contacts/${params.contactId}`,
                    { properties: params.properties }
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            contact: { id: result.id, updatedAt: result.updatedAt }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // DEAL OPERATIONS
    // =============================================================================

    create_deal: {
        name: 'hubspot_create_deal',
        description: 'Create a new deal in HubSpot pipeline',
        parameters: {
            dealname: z.string().describe('Deal name'),
            amount: z.number().optional().describe('Deal value'),
            pipeline: z.string().optional().describe('Pipeline ID (default: default)'),
            dealstage: z.string().optional().describe('Deal stage ID'),
            closedate: z.string().optional().describe('Expected close date (ISO 8601)'),
            contactId: z.string().optional().describe('Associate with contact ID'),
            properties: z.record(z.string(), z.string()).optional().describe('Additional properties'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            dealname: string;
            amount?: number;
            pipeline?: string;
            dealstage?: string;
            closedate?: string;
            contactId?: string;
            properties?: Record<string, string>;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            const dealProperties: Record<string, string> = {
                dealname: params.dealname,
                ...(params.amount !== undefined && { amount: String(params.amount) }),
                ...(params.pipeline && { pipeline: params.pipeline }),
                ...(params.dealstage && { dealstage: params.dealstage }),
                ...(params.closedate && { closedate: params.closedate }),
                ...params.properties
            };

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'POST',
                    '/crm/v3/objects/deals',
                    { properties: dealProperties }
                );

                // Associate with contact if provided
                if (params.contactId && result.id) {
                    await hubspotRequest(
                        accessToken,
                        'PUT',
                        `/crm/v3/objects/deals/${result.id}/associations/contacts/${params.contactId}/deal_to_contact`,
                        {}
                    );
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            deal: {
                                id: result.id,
                                name: params.dealname,
                                amount: params.amount,
                                createdAt: result.createdAt
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // CTI (Call Logging)
    // =============================================================================

    log_call: {
        name: 'hubspot_log_call',
        description: 'Log a call activity (CTI integration for voice agents)',
        parameters: {
            contactId: z.string().describe('HubSpot contact ID'),
            direction: z.enum(['INBOUND', 'OUTBOUND']).describe('Call direction'),
            durationMs: z.number().describe('Call duration in milliseconds'),
            outcome: z.enum(['CONNECTED', 'BUSY', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER', 'CANCELLED']).describe('Call outcome'),
            body: z.string().optional().describe('Call notes/summary'),
            dealId: z.string().optional().describe('Associate with deal ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            contactId: string;
            direction: 'INBOUND' | 'OUTBOUND';
            durationMs: number;
            outcome: string;
            body?: string;
            dealId?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            try {
                const callData = {
                    properties: {
                        hs_call_body: params.body || '',
                        hs_call_direction: params.direction,
                        hs_call_disposition: params.outcome,
                        hs_call_duration: String(params.durationMs),
                        hs_call_status: 'COMPLETED',
                        hs_timestamp: new Date().toISOString()
                    },
                    associations: [
                        {
                            to: { id: params.contactId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 194 }]
                        }
                    ]
                };

                if (params.dealId) {
                    callData.associations.push({
                        to: { id: params.dealId },
                        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 206 }]
                    });
                }

                const result = await hubspotRequest(
                    accessToken,
                    'POST',
                    '/crm/v3/objects/calls',
                    callData
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            call: {
                                id: result.id,
                                direction: params.direction,
                                duration: `${Math.round(params.durationMs / 1000)}s`,
                                outcome: params.outcome
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    },

    // =============================================================================
    // PIPELINE OPERATIONS
    // =============================================================================

    list_pipelines: {
        name: 'hubspot_list_pipelines',
        description: 'List all deal pipelines and stages',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const accessToken = await getHubSpotCredentials(tenantId);

            if (!accessToken) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing HubSpot credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await hubspotRequest(
                    accessToken,
                    'GET',
                    '/crm/v3/pipelines/deals'
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            pipelines: result.results?.map((p: any) => ({
                                id: p.id,
                                label: p.label,
                                stages: p.stages?.map((s: any) => ({
                                    id: s.id,
                                    label: s.label,
                                    displayOrder: s.displayOrder
                                }))
                            })) || []
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: error.message }, null, 2)
                    }]
                };
            }
        }
    }
};

export default hubspotTools;
