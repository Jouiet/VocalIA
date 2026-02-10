/**
 * StripeGlobalGateway.cjs
 * VocalIA - Global Payment Gateway (EUR/USD)
 *
 * Production implementation wrapping Stripe API.
 * Used by BillingAgent for customer and invoice management.
 *
 * @version 2.0.0
 * @date 2026-02-02
 * @session 250.62
 */

const crypto = require('crypto');

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2026-01-28.clover';

class StripeGlobalGateway {
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.STRIPE_SECRET_KEY;
        this.webhookSecret = config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

        if (!this.apiKey) {
            console.warn('[Stripe] ⚠️ STRIPE_SECRET_KEY not configured');
        }
    }

    /**
     * Build URL-encoded form data (Stripe uses form encoding, not JSON)
     */
    _buildFormData(obj, prefix = '') {
        const parts = [];

        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined || value === null) continue;

            const fullKey = prefix ? `${prefix}[${key}]` : key;

            if (Array.isArray(value)) {
                value.forEach((v, i) => {
                    if (typeof v === 'object' && v !== null) {
                        parts.push(this._buildFormData(v, `${fullKey}[${i}]`));
                    } else {
                        parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(v))}`);
                    }
                });
            } else if (typeof value === 'object') {
                parts.push(this._buildFormData(value, fullKey));
            } else {
                parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
            }
        }

        return parts.filter(p => p).join('&');
    }

    /**
     * Make API request to Stripe
     *
     * @param {string} path - API endpoint path (e.g., '/customers')
     * @param {string} method - HTTP method (GET, POST, DELETE)
     * @param {object} body - Request body for POST
     * @param {object} options - Additional options
     * @returns {Promise<object>} API response
     */
    async request(path, method = 'GET', body = null, options = {}) {
        if (!this.apiKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }

        const url = new URL(`${STRIPE_API_BASE}${path}`);

        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Stripe-Version': STRIPE_API_VERSION,
        };

        // Add idempotency key if provided
        if (options.idempotencyKey) {
            headers['Idempotency-Key'] = options.idempotencyKey;
        }

        let requestBody;

        if (method === 'GET' && body) {
            // Add query params for GET
            Object.entries(body).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        value.forEach((v, i) => url.searchParams.append(`${key}[${i}]`, String(v)));
                    } else if (typeof value === 'object') {
                        Object.entries(value).forEach(([k, v]) => {
                            url.searchParams.append(`${key}[${k}]`, String(v));
                        });
                    } else {
                        url.searchParams.append(key, String(value));
                    }
                }
            });
        } else if (method === 'POST' && body) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestBody = this._buildFormData(body);
        }

        const response = await fetch(url.toString(), {
            method,
            headers,
            body: requestBody
        });

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '1';
            throw new Error(`Stripe rate limit exceeded. Retry after ${retryAfter} seconds.`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(`Stripe API Error: ${result.error.message} (${result.error.type})`);
        }

        return result;
    }

    /**
     * Generate idempotency key for safe retry
     *
     * @param {string} action - Action name (e.g., 'create_customer')
     * @param {string} seed - Unique seed (e.g., email or order_id)
     * @returns {string} Idempotency key
     */
    generateIdempotencyKey(action, seed) {
        // BL11 fix: Use date (not time) + no randomness for true idempotency
        // Same action + same seed + same day = same key = duplicate prevented
        // Different day or different seed = different key = new operation allowed
        const date = new Date().toISOString().split('T')[0];
        const data = `stripe_${action}_${seed}_${date}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * Verify Stripe webhook signature
     *
     * @param {string|Buffer} body - Raw request body
     * @param {string} signature - Stripe-Signature header
     * @returns {object} { valid: boolean, event?: object, error?: string }
     */
    verifyWebhookSignature(body, signature) {
        if (!this.webhookSecret) {
            return { valid: false, error: 'STRIPE_WEBHOOK_SECRET not configured' };
        }

        try {
            const bodyString = typeof body === 'string' ? body : body.toString();
            const parts = signature.split(',').reduce((acc, part) => {
                const [key, value] = part.split('=');
                acc[key] = value;
                return acc;
            }, {});

            const timestamp = parts.t;
            const v1Signature = parts.v1;

            if (!timestamp || !v1Signature) {
                return { valid: false, error: 'Invalid signature format' };
            }

            // Verify signature age (5 minute tolerance)
            const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
            if (age > 300) {
                return { valid: false, error: 'Webhook signature too old' };
            }

            // Compute expected signature
            const signedPayload = `${timestamp}.${bodyString}`;
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(signedPayload)
                .digest('hex');

            // Constant-time comparison
            const valid = crypto.timingSafeEqual(
                Buffer.from(v1Signature),
                Buffer.from(expectedSignature)
            );

            if (valid) {
                return { valid: true, event: JSON.parse(bodyString) };
            } else {
                return { valid: false, error: 'Signature mismatch' };
            }
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONVENIENCE METHODS (Used by BillingAgent)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a customer
     */
    async createCustomer(data) {
        const idempotencyKey = this.generateIdempotencyKey('customer', data.email || data.phone);
        return this.request('/customers', 'POST', data, { idempotencyKey });
    }

    /**
     * Get customer by ID
     */
    async getCustomer(customerId) {
        return this.request(`/customers/${customerId}`, 'GET');
    }

    /**
     * Search customer by email
     */
    async findCustomerByEmail(email) {
        const result = await this.request('/customers', 'GET', { email, limit: 1 });
        return result.data?.[0] || null;
    }

    /**
     * Create a draft invoice
     */
    async createInvoice(data) {
        const idempotencyKey = this.generateIdempotencyKey('invoice', data.customer);
        return this.request('/invoices', 'POST', data, { idempotencyKey });
    }

    /**
     * Add item to invoice
     */
    async addInvoiceItem(data) {
        return this.request('/invoiceitems', 'POST', data);
    }

    /**
     * Finalize and send invoice
     */
    async finalizeInvoice(invoiceId) {
        return this.request(`/invoices/${invoiceId}/finalize`, 'POST');
    }

    /**
     * Send invoice to customer
     */
    async sendInvoice(invoiceId) {
        return this.request(`/invoices/${invoiceId}/send`, 'POST');
    }

    /**
     * Create payment link
     */
    async createPaymentLink(data) {
        return this.request('/payment_links', 'POST', data);
    }

    /**
     * Get account balance
     */
    async getBalance() {
        return this.request('/balance', 'GET');
    }

    /**
     * Health check
     */
    healthCheck() {
        return {
            gateway: 'stripe-global',
            version: '2.0.0',
            configured: !!this.apiKey,
            webhookConfigured: !!this.webhookSecret,
            apiVersion: STRIPE_API_VERSION
        };
    }
}

module.exports = StripeGlobalGateway;
