import { z } from 'zod';
import { createRequire } from 'module';

/**
 * Zoho CRM MCP Tools - Session 249.5
 *
 * API Reference: https://www.zoho.com/crm/developer/docs/api/v6/
 * API Version: v6
 * Auth: OAuth 2.0 (Access Token via refresh token)
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
 * Get Zoho CRM credentials for a tenant
 */
async function getZohoCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.ZOHO_CLIENT_ID && creds.ZOHO_CLIENT_SECRET && creds.ZOHO_REFRESH_TOKEN) {
            return {
                clientId: creds.ZOHO_CLIENT_ID,
                clientSecret: creds.ZOHO_CLIENT_SECRET,
                refreshToken: creds.ZOHO_REFRESH_TOKEN,
                domain: creds.ZOHO_DOMAIN || 'https://www.zohoapis.com'
            };
        }
    }
    return {
        clientId: process.env.ZOHO_CLIENT_ID || null,
        clientSecret: process.env.ZOHO_CLIENT_SECRET || null,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN || null,
        domain: process.env.ZOHO_DOMAIN || 'https://www.zohoapis.com'
    };
}

// Token cache for access tokens
const tokenCache: Map<string, { token: string; expires: number }> = new Map();

/**
 * Get access token using refresh token
 */
async function getAccessToken(tenantId: string): Promise<string | null> {
    const creds = await getZohoCredentials(tenantId);
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        return null;
    }

    // Check cache
    const cached = tokenCache.get(tenantId);
    if (cached && cached.expires > Date.now()) {
        return cached.token;
    }

    // Refresh token
    const params = new URLSearchParams({
        refresh_token: creds.refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token'
    });

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zoho OAuth error: ${error}`);
    }

    const data: any = await response.json();
    const token = data.access_token;
    const expiresIn = data.expires_in || 3600;

    // Cache token
    tokenCache.set(tenantId, {
        token,
        expires: Date.now() + (expiresIn - 300) * 1000 // 5 min buffer
    });

    return token;
}

/**
 * Make authenticated request to Zoho CRM API
 */
async function zohoRequest(
    tenantId: string,
    endpoint: string,
    options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<any> {
    const creds = await getZohoCredentials(tenantId);
    const accessToken = await getAccessToken(tenantId);

    if (!accessToken) {
        throw new Error('Failed to get Zoho access token');
    }

    let url = `${creds.domain}/crm/v6${endpoint}`;
    if (options.params) {
        const searchParams = new URLSearchParams(options.params);
        url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zoho CRM API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const zohoTools = {
    list_leads: {
        name: 'zoho_list_leads',
        description: 'List leads from Zoho CRM',
        parameters: {
            per_page: z.number().min(1).max(200).optional().describe('Results per page (default: 20, max: 200)'),
            page: z.number().min(1).optional().describe('Page number'),
            sort_by: z.string().optional().describe('Field to sort by'),
            sort_order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 20, page = 1, sort_by, sort_order, _meta }: {
            per_page?: number,
            page?: number,
            sort_by?: string,
            sort_order?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials",
                            required: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"],
                            hint: "Create OAuth app at https://api-console.zoho.com/"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };
                if (sort_by) params.sort_by = sort_by;
                if (sort_order) params.sort_order = sort_order;

                const data = await zohoRequest(tenantId, '/Leads', { params });

                const leads = data.data?.map((lead: any) => ({
                    id: lead.id,
                    Full_Name: lead.Full_Name,
                    Email: lead.Email,
                    Phone: lead.Phone,
                    Company: lead.Company,
                    Lead_Status: lead.Lead_Status,
                    Lead_Source: lead.Lead_Source,
                    Owner: lead.Owner?.name,
                    Created_Time: lead.Created_Time,
                    Modified_Time: lead.Modified_Time
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: leads.length,
                            page,
                            per_page,
                            info: data.info,
                            leads
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

    get_lead: {
        name: 'zoho_get_lead',
        description: 'Get a specific lead from Zoho CRM by ID',
        parameters: {
            lead_id: z.string().describe('Zoho Lead ID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ lead_id, _meta }: { lead_id: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const data = await zohoRequest(tenantId, `/Leads/${lead_id}`);
                const lead = data.data?.[0];

                if (!lead) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "error",
                                message: "Lead not found"
                            }, null, 2)
                        }]
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            lead
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

    create_lead: {
        name: 'zoho_create_lead',
        description: 'Create a new lead in Zoho CRM',
        parameters: {
            First_Name: z.string().optional().describe('First name'),
            Last_Name: z.string().describe('Last name (required)'),
            Email: z.string().optional().describe('Email address'),
            Phone: z.string().optional().describe('Phone number'),
            Company: z.string().optional().describe('Company name'),
            Lead_Source: z.string().optional().describe('Lead source (e.g., Web, Phone, Referral)'),
            Lead_Status: z.string().optional().describe('Lead status'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ First_Name, Last_Name, Email, Phone, Company, Lead_Source, Lead_Status, _meta }: {
            First_Name?: string,
            Last_Name: string,
            Email?: string,
            Phone?: string,
            Company?: string,
            Lead_Source?: string,
            Lead_Status?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const leadData: any = { Last_Name };
                if (First_Name) leadData.First_Name = First_Name;
                if (Email) leadData.Email = Email;
                if (Phone) leadData.Phone = Phone;
                if (Company) leadData.Company = Company;
                if (Lead_Source) leadData.Lead_Source = Lead_Source;
                if (Lead_Status) leadData.Lead_Status = Lead_Status;

                const data = await zohoRequest(tenantId, '/Leads', {
                    method: 'POST',
                    body: { data: [leadData] }
                });

                const result = data.data?.[0];
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Lead created successfully",
                            lead_id: result?.details?.id,
                            status_code: result?.code
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

    list_contacts: {
        name: 'zoho_list_contacts',
        description: 'List contacts from Zoho CRM',
        parameters: {
            per_page: z.number().min(1).max(200).optional().describe('Results per page (default: 20, max: 200)'),
            page: z.number().min(1).optional().describe('Page number'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 20, page = 1, _meta }: {
            per_page?: number,
            page?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };

                const data = await zohoRequest(tenantId, '/Contacts', { params });

                const contacts = data.data?.map((contact: any) => ({
                    id: contact.id,
                    Full_Name: contact.Full_Name,
                    Email: contact.Email,
                    Phone: contact.Phone,
                    Account_Name: contact.Account_Name?.name,
                    Owner: contact.Owner?.name,
                    Created_Time: contact.Created_Time
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: contacts.length,
                            page,
                            per_page,
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

    list_deals: {
        name: 'zoho_list_deals',
        description: 'List deals from Zoho CRM',
        parameters: {
            per_page: z.number().min(1).max(200).optional().describe('Results per page (default: 20, max: 200)'),
            page: z.number().min(1).optional().describe('Page number'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ per_page = 20, page = 1, _meta }: {
            per_page?: number,
            page?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    per_page: per_page.toString(),
                    page: page.toString()
                };

                const data = await zohoRequest(tenantId, '/Deals', { params });

                const deals = data.data?.map((deal: any) => ({
                    id: deal.id,
                    Deal_Name: deal.Deal_Name,
                    Amount: deal.Amount,
                    Stage: deal.Stage,
                    Closing_Date: deal.Closing_Date,
                    Account_Name: deal.Account_Name?.name,
                    Contact_Name: deal.Contact_Name?.name,
                    Owner: deal.Owner?.name,
                    Created_Time: deal.Created_Time
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            count: deals.length,
                            page,
                            per_page,
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

    search_records: {
        name: 'zoho_search_records',
        description: 'Search records in Zoho CRM by criteria',
        parameters: {
            module: z.enum(['Leads', 'Contacts', 'Accounts', 'Deals']).describe('Module to search'),
            criteria: z.string().describe('Search criteria (e.g., "Email:equals:test@example.com")'),
            per_page: z.number().min(1).max(200).optional().describe('Results per page'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ module, criteria, per_page = 20, _meta }: {
            module: string,
            criteria: string,
            per_page?: number,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const creds = await getZohoCredentials(tenantId);

            if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing Zoho CRM credentials"
                        }, null, 2)
                    }]
                };
            }

            try {
                const params: Record<string, string> = {
                    criteria: `(${criteria})`,
                    per_page: per_page.toString()
                };

                const data = await zohoRequest(tenantId, `/${module}/search`, { params });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            module,
                            count: data.data?.length || 0,
                            records: data.data || []
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
