import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

/**
 * Twilio MCP Tools - Session 250.87
 *
 * API Reference: https://www.twilio.com/docs/api
 * Auth: Account SID + Auth Token (Basic Auth)
 *
 * Multi-tenant support via SecretVault
 *
 * Tools:
 * - twilio_send_sms: Send SMS message
 * - twilio_make_call: Initiate outbound call
 * - twilio_get_call: Get call status
 * - twilio_list_calls: List recent calls
 * - twilio_send_whatsapp: Send WhatsApp message
 *
 * Rate Limits: 1 message/second per phone number (SMS)
 */

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    const vaultPath = path.join(process.cwd(), '..', 'core', 'SecretVault.cjs');
    SecretVault = require(vaultPath);
} catch (e) {
    // Fallback to env vars
}

interface TwilioCredentials {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
}

/**
 * Get Twilio credentials for a tenant
 */
async function getTwilioCredentials(tenantId: string = 'agency_internal'): Promise<TwilioCredentials | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.TWILIO_ACCOUNT_SID && creds.TWILIO_AUTH_TOKEN) {
            return {
                accountSid: creds.TWILIO_ACCOUNT_SID,
                authToken: creds.TWILIO_AUTH_TOKEN,
                phoneNumber: creds.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || ''
            };
        }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (accountSid && authToken) {
        return { accountSid, authToken, phoneNumber };
    }
    return null;
}

/**
 * Make authenticated request to Twilio API
 */
async function twilioRequest(
    creds: TwilioCredentials,
    method: string,
    endpoint: string,
    formData?: Record<string, string>
): Promise<any> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}${endpoint}`;
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');

    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    if (formData) {
        options.body = new URLSearchParams(formData).toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export const twilioTools = {
    // =============================================================================
    // SMS OPERATIONS
    // =============================================================================

    send_sms: {
        name: 'twilio_send_sms',
        description: 'Send an SMS message via Twilio',
        parameters: {
            to: z.string().describe('Recipient phone number (E.164 format, e.g., +33612345678)'),
            body: z.string().describe('SMS message body (max 1600 chars)'),
            from: z.string().optional().describe('Sender phone number (defaults to tenant number)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            to: string;
            body: string;
            from?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const creds = await getTwilioCredentials(tenantId);

            if (!creds) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Twilio credentials',
                            requirements: {
                                credentials: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
                                setup: 'Twilio Console → Account → API Keys'
                            }
                        }, null, 2)
                    }]
                };
            }

            const fromNumber = params.from || creds.phoneNumber;
            if (!fromNumber) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'No sender phone number configured'
                        }, null, 2)
                    }]
                };
            }

            try {
                const result = await twilioRequest(
                    creds,
                    'POST',
                    '/Messages.json',
                    {
                        To: params.to,
                        From: fromNumber,
                        Body: params.body.substring(0, 1600)
                    }
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            message: {
                                sid: result.sid,
                                to: result.to,
                                from: result.from,
                                status: result.status,
                                dateCreated: result.date_created
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
    // VOICE OPERATIONS
    // =============================================================================

    make_call: {
        name: 'twilio_make_call',
        description: 'Initiate an outbound voice call',
        parameters: {
            to: z.string().describe('Recipient phone number (E.164 format)'),
            from: z.string().optional().describe('Caller ID (defaults to tenant number)'),
            twimlUrl: z.string().optional().describe('URL returning TwiML for call flow'),
            twiml: z.string().optional().describe('Inline TwiML (alternative to URL)'),
            statusCallback: z.string().optional().describe('URL for call status updates'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            to: string;
            from?: string;
            twimlUrl?: string;
            twiml?: string;
            statusCallback?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const creds = await getTwilioCredentials(tenantId);

            if (!creds) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Missing Twilio credentials'
                        }, null, 2)
                    }]
                };
            }

            const fromNumber = params.from || creds.phoneNumber;
            if (!fromNumber) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'No caller ID configured'
                        }, null, 2)
                    }]
                };
            }

            if (!params.twimlUrl && !params.twiml) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: 'Provide twimlUrl or twiml parameter'
                        }, null, 2)
                    }]
                };
            }

            const formData: Record<string, string> = {
                To: params.to,
                From: fromNumber
            };

            if (params.twimlUrl) {
                formData.Url = params.twimlUrl;
            } else if (params.twiml) {
                formData.Twiml = params.twiml;
            }

            if (params.statusCallback) {
                formData.StatusCallback = params.statusCallback;
            }

            try {
                const result = await twilioRequest(creds, 'POST', '/Calls.json', formData);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            call: {
                                sid: result.sid,
                                to: result.to,
                                from: result.from,
                                status: result.status,
                                direction: result.direction,
                                dateCreated: result.date_created
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

    get_call: {
        name: 'twilio_get_call',
        description: 'Get call status and details',
        parameters: {
            callSid: z.string().describe('Twilio Call SID'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            callSid: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const creds = await getTwilioCredentials(tenantId);

            if (!creds) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Twilio credentials' }, null, 2)
                    }]
                };
            }

            try {
                const result = await twilioRequest(creds, 'GET', `/Calls/${params.callSid}.json`);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            call: {
                                sid: result.sid,
                                to: result.to,
                                from: result.from,
                                status: result.status,
                                direction: result.direction,
                                duration: result.duration,
                                startTime: result.start_time,
                                endTime: result.end_time,
                                price: result.price,
                                priceUnit: result.price_unit
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

    list_calls: {
        name: 'twilio_list_calls',
        description: 'List recent calls',
        parameters: {
            limit: z.number().optional().default(20).describe('Max results (default 20)'),
            status: z.enum(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']).optional().describe('Filter by status'),
            to: z.string().optional().describe('Filter by recipient'),
            from: z.string().optional().describe('Filter by caller'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            limit?: number;
            status?: string;
            to?: string;
            from?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const creds = await getTwilioCredentials(tenantId);

            if (!creds) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Twilio credentials' }, null, 2)
                    }]
                };
            }

            const queryParams = new URLSearchParams();
            queryParams.append('PageSize', String(params.limit || 20));
            if (params.status) queryParams.append('Status', params.status);
            if (params.to) queryParams.append('To', params.to);
            if (params.from) queryParams.append('From', params.from);

            try {
                const result = await twilioRequest(
                    creds,
                    'GET',
                    `/Calls.json?${queryParams.toString()}`
                );

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            calls: result.calls?.map((c: any) => ({
                                sid: c.sid,
                                to: c.to,
                                from: c.from,
                                status: c.status,
                                direction: c.direction,
                                duration: c.duration,
                                dateCreated: c.date_created
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

    // =============================================================================
    // WHATSAPP
    // =============================================================================

    send_whatsapp: {
        name: 'twilio_send_whatsapp',
        description: 'Send a WhatsApp message via Twilio',
        parameters: {
            to: z.string().describe('Recipient WhatsApp number (E.164 format with whatsapp: prefix)'),
            body: z.string().describe('Message body'),
            from: z.string().optional().describe('Sender WhatsApp number (defaults to tenant number)'),
            mediaUrl: z.string().optional().describe('URL of media to attach'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async (params: {
            to: string;
            body: string;
            from?: string;
            mediaUrl?: string;
            _meta?: { tenantId?: string };
        }) => {
            const tenantId = params._meta?.tenantId || 'agency_internal';
            const creds = await getTwilioCredentials(tenantId);

            if (!creds) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ success: false, error: 'Missing Twilio credentials' }, null, 2)
                    }]
                };
            }

            // Format WhatsApp numbers
            const toNumber = params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`;
            const fromNumber = params.from
                ? (params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`)
                : (creds.phoneNumber.startsWith('whatsapp:') ? creds.phoneNumber : `whatsapp:${creds.phoneNumber}`);

            const formData: Record<string, string> = {
                To: toNumber,
                From: fromNumber,
                Body: params.body
            };

            if (params.mediaUrl) {
                formData.MediaUrl = params.mediaUrl;
            }

            try {
                const result = await twilioRequest(creds, 'POST', '/Messages.json', formData);

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            message: {
                                sid: result.sid,
                                to: result.to,
                                from: result.from,
                                status: result.status,
                                channel: 'whatsapp'
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
    }
};

export default twilioTools;
