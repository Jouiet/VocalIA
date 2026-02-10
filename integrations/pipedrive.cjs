/**
 * VocalIA - Pipedrive Integration v1.0.0
 * 
 * CRM Sales Pipeline Management.
 * Implements "Sovereign" fetch-based wrapper.
 * 
 * Supports:
 * - Create/Find Person
 * - Create Deal
 * - Add Activity (Call Log)
 * - User Search (Owner assignment)
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

const SecretVault = require('../core/SecretVault.cjs');

class PipedriveIntegration {
    constructor(apiToken = null, tenantId = 'agency_internal') {
        this.apiToken = apiToken;
        this.tenantId = tenantId;
        this.baseUrl = 'https://api.pipedrive.com/v1';
        this.companyDomain = null; // Will be discovered
    }

    async init() {
        if (!this.apiToken) {
            const creds = await SecretVault.loadCredentials(this.tenantId);
            this.apiToken = creds.PIPEDRIVE_API_TOKEN;
        }

        if (!this.apiToken) {
            console.warn(`[Pipedrive] No API Token found for tenant ${this.tenantId}`);
            return false;
        }
        return true;
    }

    async _request(method, endpoint, body = null, params = {}) {
        if (!this.apiToken) await this.init();
        if (!this.apiToken) throw new Error('Pipedrive API Token missing');

        const url = new URL(`${this.baseUrl}${endpoint}`);
        url.searchParams.append('api_token', this.apiToken);

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;
    }

    /**
     * Find a Person by Email
     * @param {string} email 
     */
    async findPerson(email) {
        const response = await this._request('GET', '/persons/search', null, {
            term: email,
            fields: 'email',
            exact_match: true
        });

        if (response.data && response.data.items && response.data.items.length > 0) {
            return response.data.items[0].item;
        }
        return null;
    }

    /**
     * Create a Person
     * @param {Object} data - { name, email, phone, owner_id }
     */
    async createPerson(data) {
        const payload = {
            name: data.name || data.email,
            email: data.email ? [data.email] : undefined,
            phone: data.phone ? [data.phone] : undefined,
            owner_id: data.owner_id
        };

        const response = await this._request('POST', '/persons', payload);
        return response.data;
    }

    /**
     * Create or Update a Person (Upsert)
     */
    async upsertPerson(data) {
        if (data.email) {
            const existing = await this.findPerson(data.email);
            if (existing) return existing;
        }
        return this.createPerson(data);
    }

    /**
     * Create a Deal
     * @param {Object} data - { title, person_id, value, currency, stage_id, status }
     */
    async createDeal(data) {
        const payload = {
            title: data.title,
            person_id: data.person_id,
            value: data.value,
            currency: data.currency || 'EUR',
            stage_id: data.stage_id,
            status: data.status || 'open'
        };

        const response = await this._request('POST', '/deals', payload);
        return response.data;
    }

    /**
     * Log a Call Activity
     * @param {Object} data - { subject, person_id, deal_id, duration, note }
     */
    async logCall(data) {
        const payload = {
            subject: data.subject || 'Voice Call',
            type: 'call',
            person_id: data.person_id,
            deal_id: data.deal_id,
            duration: data.duration, // format HH:MM
            note: data.note,
            done: 1
        };

        const response = await this._request('POST', '/activities', payload);
        return response.data;
    }

    /**
     * Get Users (to find Owner ID)
     */
    async getUsers() {
        const response = await this._request('GET', '/users');
        return response.data;
    }
}

async function createForTenant(tenantId) {
    const instance = new PipedriveIntegration(null, tenantId);
    await instance.init();
    return instance;
}

module.exports = {
    PipedriveIntegration,
    createForTenant
};
