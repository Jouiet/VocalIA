import { google } from 'googleapis';
import { z } from 'zod';

// Helper to get authenticated client
async function getCalendarClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Google Credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)");
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
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
        },
        handler: async ({ timeMin, timeMax, calendarId = 'primary' }: { timeMin: string, timeMax: string, calendarId?: string }) => {
            try {
                const calendar = await getCalendarClient();
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
        },
        handler: async ({ summary, startTime, endTime, attendees, calendarId = 'primary' }: { summary: string, startTime: string, endTime: string, attendees?: string[], calendarId?: string }) => {
            try {
                const calendar = await getCalendarClient();
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
