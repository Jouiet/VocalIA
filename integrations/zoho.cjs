/**
 * VocalIA - Zoho CRM Integration v1.0.0
 * 
 * CRM Sales Pipeline Management.
 * Implements "Sovereign" fetch-based wrapper.
 * 
 * Supports:
 * - Upsert Leads/Contacts
 * - Create Deals
 * - Log Calls
 * 
 * NOTE: Zoho CRM uses OAuth 2.0. This integration assumes a persisted REFRESH_TOKEN 
 * is stored in SecretVault, and handles caching the ACCESS_TOKEN.
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

const { SecretVault } = require('../core/SecretVault.cjs');

class ZohoCRMIntegration {
    constructor(tenantId = 'agency_internal') {
        this.tenantId = tenantId;
        this.clientId = null;
        this.clientSecret = null;
        this.refreshToken = null;
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.baseUrl = 'https://www.zohoapis.com/crm/v2'; // Or v3/v6 depending on region
        this.authUrl = 'https://accounts.zoho.com/oauth/v2/token';
    }

    async init() {
        const creds = await SecretVault.loadCredentials(this.tenantId);
        this.clientId = creds.ZOHO_CLIENT_ID;
        this.clientSecret = creds.ZOHO_CLIENT_SECRET;
        this.refreshToken = creds.ZOHO_REFRESH_TOKEN;

        if (!this.clientId || !this.clientSecret || !this.refreshToken) {
            console.warn(`[ZohoCRM] Missing OAuth credentials for tenant ${this.tenantId}`);
            return false;
        }
        return true;
    }

    /**
     * Refresh valid access token
     */
    async _getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        if (!this.refreshToken) await this.init();
        if (!this.refreshToken) throw new Error('Zoho Refresh Token missing');

        const params = new URLSearchParams();
        params.append('refresh_token', this.refreshToken);
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('grant_type', 'refresh_token');

        const response = await fetch(this.authUrl, {
            method: 'POST',
            body: params
        });

        const data = await response.json();

        if (data.error) throw new Error(`Zoho OAuth Error: ${data.error}`);

        this.accessToken = data.access_token;
        // Set expiry to 55 mins (usually 60)
        this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

        return this.accessToken;
    }

    async _request(method, endpoint, body = null) {
        const token = await this._getAccessToken();

        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        // G8 fix: Check response status before parsing
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;
    }

    /**
     * Search Records
     * @param {string} module - Leads, Contacts
     * @param {string} criteria - e.g. (Email:equals:test@example.com)
     */
    async searchRecords(module, criteria) {
        const response = await this._request('GET', `/${module}/search?criteria=${encodeURIComponent(criteria)}`);
        return response.data;
    }

    /**
     * Insert Record
     * @param {string} module - Leads, Contacts, Deals
     * @param {Object} data - Record data
     */
    async createRecord(module, data) {
        const payload = { data: [data] };
        // trigger: ['approval', 'workflow', 'blueprint'] optional
        const response = await this._request('POST', `/${module}`, payload);
        return response.data; // [{ code: 'SUCCESS', details: { id: ... } }]
    }

    /**
     * Log Call
     * @param {Object} data - { Subject, Call_Duration, Call_Start_Time, Related_To, etc. }
     */
    async logCall(data) {
        data.Call_Type = 'Outbound';
        data.Call_Status = 'Completed';
        return this.createRecord('Calls', data);
    }
}

async function createForTenant(tenantId) {
    const instance = new ZohoCRMIntegration(tenantId);
    await instance.init();
    return instance;
}

module.exports = {
    ZohoCRMIntegration,
    createForTenant
};
