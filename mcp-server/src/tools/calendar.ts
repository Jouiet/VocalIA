import { google } from 'googleapis';
import { z } from 'zod';
import * as path from 'path';
import { createRequire } from 'module';

// Multi-tenant support via SecretVault (Session 249.2)
const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    const vaultPath = path.join(process.cwd(), '..', 'core', 'SecretVault.cjs');
    SecretVault = require(vaultPath);
} catch (e) {
    // Fallback to env vars
}

/**
 * Get Google credentials for a tenant
 * @param tenantId - Tenant ID (default: agency_internal)
 */
async function getGoogleCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.GOOGLE_CLIENT_ID && creds.GOOGLE_CLIENT_SECRET && creds.GOOGLE_REFRESH_TOKEN) {
            return {
                clientId: creds.GOOGLE_CLIENT_ID,
                clientSecret: creds.GOOGLE_CLIENT_SECRET,
                refreshToken: creds.GOOGLE_REFRESH_TOKEN,
                redirectUri: creds.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
            };
        }
    }
    // Fallback to environment
    return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    };
}

// Helper to get authenticated client (multi-tenant aware)
async function getCalendarClient(tenantId: string = 'agency_internal') {
    const creds = await getGoogleCredentials(tenantId);

    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        throw new Error("Missing Google Credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)");
    }

    const oAuth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
    oAuth2Client.setCredentials({ refresh_token: creds.refreshToken });
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

export const calendarTools = {
    check_availability: {
        name: 'calendar_check_availability',
        description: 'Check availability in Google Calendar for a specific time range',
        parameters: {
            timeMin: z.string().describe('Start time in ISO format'),
            timeMax: z.string().describe('End time in ISO format'),
            calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ timeMin, timeMax, calendarId = 'primary', _meta }: { timeMin: string, timeMax: string, calendarId?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const calendar = await getCalendarClient(tenantId);
                const response = await calendar.freebusy.query({
                    requestBody: {
                        timeMin,
                        timeMax,
                        items: [{ id: calendarId }]
                    }
                });

                const busy = response.data.calendars?.[calendarId]?.busy || [];
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ status: "success", busy, timeMin, timeMax }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set in .env"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    create_event: {
        name: 'calendar_create_event',
        description: 'Create a new event in Google Calendar',
        parameters: {
            summary: z.string().describe('Event title'),
            startTime: z.string().describe('Start time in ISO format'),
            endTime: z.string().describe('End time in ISO format'),
            attendees: z.array(z.string().email()).optional().describe('List of attendee emails'),
            calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ summary, startTime, endTime, attendees, calendarId = 'primary', _meta }: { summary: string, startTime: string, endTime: string, attendees?: string[], calendarId?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const calendar = await getCalendarClient(tenantId);
                const event = {
                    summary,
                    start: { dateTime: startTime },
                    end: { dateTime: endTime },
                    attendees: attendees?.map(email => ({ email })),
                };

                const response = await calendar.events.insert({
                    calendarId,
                    requestBody: event,
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            eventId: response.data.id,
                            link: response.data.htmlLink
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
                            hint: "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set in .env"
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
