/**
 * VocalIA - PrestaShop Integration v1.0.0
 * 
 * E-commerce Management.
 * Implements "Sovereign" fetch-based wrapper.
 * 
 * Supports:
 * - Get Orders/Products
 * - Stock Check
 * - Customer Sync
 * 
 * Uses PrestaShop Webservice (XML/JSON).
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

const { SecretVault } = require('../core/secret-vault.cjs');

class PrestaShopIntegration {
    constructor(url = null, key = null, tenantId = 'agency_internal') {
        this.url = url; // e.g. https://store.com
        this.key = key;
        this.tenantId = tenantId;
    }

    async init() {
        if (!this.url || !this.key) {
            const creds = await SecretVault.loadCredentials(this.tenantId);
            this.url = creds.PRESTASHOP_URL;
            this.key = creds.PRESTASHOP_KEY;
        }

        if (!this.url || !this.key) {
            console.warn(`[PrestaShop] Missing Credentials for tenant ${this.tenantId}`);
            return false;
        }
        return true;
    }

    async _request(method, resource, params = {}) {
        if (!this.key) await this.init();
        if (!this.key) throw new Error('PrestaShop API Key missing');

        const basicAuth = Buffer.from(`${this.key}:`).toString('base64');

        // Construct URL: url/api/resource?output_format=JSON
        let endpoint = `${this.url.replace(/\/$/, '')}/api/${resource}`;
        const url = new URL(endpoint);
        url.searchParams.append('output_format', 'JSON');
        url.searchParams.append('display', 'full');

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }

        const options = {
            method,
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url.toString(), options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`PrestaShop API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;
    }

    /**
     * Get Products
     */
    async getProducts(limit = 10) {
        const response = await this._request('GET', 'products', { limit });
        return response.products;
    }

    /**
     * Get Orders
     */
    async getOrders(limit = 10) {
        const response = await this._request('GET', 'orders', { limit });
        return response.orders;
    }

    /**
     * Get Customers
     */
    async getCustomers(limit = 10) {
        const response = await this._request('GET', 'customers', { limit });
        return response.customers;
    }
}

async function createForTenant(tenantId) {
    const instance = new PrestaShopIntegration(null, null, tenantId);
    await instance.init();
    return instance;
}

module.exports = {
    PrestaShopIntegration,
    createForTenant
};
