import { google } from 'googleapis';
import { z } from 'zod';
import { createRequire } from 'module';
import * as fs from 'fs';
import { corePath, dataPath } from '../paths.js';

// Multi-tenant support via SecretVault (Session 249.2)
const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars or tokens file
}

/**
 * Get Google credentials for a tenant
 * Priority: SecretVault > ENV vars > tokens file
 * @param tenantId - Tenant ID (default: agency_internal)
 */
async function getGoogleCredentials(tenantId: string = 'agency_internal') {
    // 1. Try SecretVault (multi-tenant)
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

    // 2. Try environment variables
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        return {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
            redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
        };
    }

    // 3. Fallback to tokens file (data/google-oauth-tokens.json)
    const tokensPath = dataPath('google-oauth-tokens.json');
    if (fs.existsSync(tokensPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
            if (tokens.client_id && tokens.client_secret && tokens.refresh_token) {
                return {
                    clientId: tokens.client_id,
                    clientSecret: tokens.client_secret,
                    refreshToken: tokens.refresh_token,
                    redirectUri: 'http://localhost:3000/oauth2callback'
                };
            }
        } catch (e) {
            // File read error, continue to throw
        }
    }

    // No credentials found
    return {
        clientId: undefined,
        clientSecret: undefined,
        refreshToken: undefined,
        redirectUri: 'http://localhost:3000/oauth2callback'
    };
}

// Helper to get authenticated Sheets client (multi-tenant aware)
async function getSheetsClient(tenantId: string = 'agency_internal') {
    const creds = await getGoogleCredentials(tenantId);

    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        throw new Error("Missing Google Credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)");
    }

    const oAuth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
    oAuth2Client.setCredentials({ refresh_token: creds.refreshToken });
    return google.sheets({ version: 'v4', auth: oAuth2Client });
}

export const sheetsTools = {
    read_range: {
        name: 'sheets_read_range',
        description: 'Read data from a range in a Google Spreadsheet',
        parameters: {
            spreadsheetId: z.string().describe('The ID of the spreadsheet (from URL)'),
            range: z.string().describe('The A1 notation range to read (e.g., "Sheet1!A1:D10")'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ spreadsheetId, range, _meta }: { spreadsheetId: string, range: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const sheets = await getSheetsClient(tenantId);
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range,
                });

                const rows = response.data.values || [];
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            spreadsheetId,
                            range,
                            rowCount: rows.length,
                            data: rows
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
                            hint: "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set. Scope: spreadsheets.readonly"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    write_range: {
        name: 'sheets_write_range',
        description: 'Write data to a range in a Google Spreadsheet',
        parameters: {
            spreadsheetId: z.string().describe('The ID of the spreadsheet'),
            range: z.string().describe('The A1 notation range to write (e.g., "Sheet1!A1")'),
            values: z.array(z.array(z.string())).describe('2D array of values to write'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ spreadsheetId, range, values, _meta }: { spreadsheetId: string, range: string, values: string[][], _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const sheets = await getSheetsClient(tenantId);
                const response = await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values,
                    },
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            spreadsheetId,
                            updatedRange: response.data.updatedRange,
                            updatedRows: response.data.updatedRows,
                            updatedColumns: response.data.updatedColumns,
                            updatedCells: response.data.updatedCells
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
                            hint: "Ensure Google OAuth has 'spreadsheets' scope (not just readonly)"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    append_rows: {
        name: 'sheets_append_rows',
        description: 'Append rows to a Google Spreadsheet (useful for logging leads, events)',
        parameters: {
            spreadsheetId: z.string().describe('The ID of the spreadsheet'),
            range: z.string().describe('The sheet name or range to append to (e.g., "Leads" or "Sheet1!A:E")'),
            values: z.array(z.array(z.string())).describe('2D array of rows to append'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ spreadsheetId, range, values, _meta }: { spreadsheetId: string, range: string, values: string[][], _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const sheets = await getSheetsClient(tenantId);
                const response = await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: {
                        values,
                    },
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            spreadsheetId,
                            tableRange: response.data.tableRange,
                            updatedRange: response.data.updates?.updatedRange,
                            updatedRows: response.data.updates?.updatedRows,
                            updatedCells: response.data.updates?.updatedCells
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
                            hint: "Ensure Google OAuth has 'spreadsheets' scope"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_spreadsheet_info: {
        name: 'sheets_get_info',
        description: 'Get metadata about a Google Spreadsheet (sheets, titles, etc.)',
        parameters: {
            spreadsheetId: z.string().describe('The ID of the spreadsheet'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ spreadsheetId, _meta }: { spreadsheetId: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const sheets = await getSheetsClient(tenantId);
                const response = await sheets.spreadsheets.get({
                    spreadsheetId,
                    fields: 'spreadsheetId,properties.title,sheets.properties'
                });

                const sheetsList = response.data.sheets?.map(s => ({
                    sheetId: s.properties?.sheetId,
                    title: s.properties?.title,
                    index: s.properties?.index,
                    rowCount: s.properties?.gridProperties?.rowCount,
                    columnCount: s.properties?.gridProperties?.columnCount
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            spreadsheetId: response.data.spreadsheetId,
                            title: response.data.properties?.title,
                            sheets: sheetsList,
                            sheetCount: sheetsList.length
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
                            hint: "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    create_spreadsheet: {
        name: 'sheets_create',
        description: 'Create a new Google Spreadsheet',
        parameters: {
            title: z.string().describe('Title for the new spreadsheet'),
            sheetTitles: z.array(z.string()).optional().describe('Optional array of sheet names to create'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ title, sheetTitles, _meta }: { title: string, sheetTitles?: string[], _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const sheets = await getSheetsClient(tenantId);

                const requestBody: any = {
                    properties: { title }
                };

                if (sheetTitles && sheetTitles.length > 0) {
                    requestBody.sheets = sheetTitles.map((sheetTitle, index) => ({
                        properties: {
                            title: sheetTitle,
                            index
                        }
                    }));
                }

                const response = await sheets.spreadsheets.create({
                    requestBody
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            spreadsheetId: response.data.spreadsheetId,
                            spreadsheetUrl: response.data.spreadsheetUrl,
                            title: response.data.properties?.title,
                            sheets: response.data.sheets?.map(s => s.properties?.title)
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
                            hint: "Ensure Google OAuth has 'spreadsheets' scope (not just readonly)"
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
