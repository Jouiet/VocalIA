/**
 * StripeGlobalGateway.cjs
 * VocalIA - Global Payment Gateway (EUR/USD)
 */

class StripeGlobalGateway {
    constructor(config = {}) {
        this.apiKey = config.apiKey;
    }

    async request(path, method, body, options = {}) {
        console.log(`[Stripe] Mock request to ${path}`);
        return { id: `st_${Math.random().toString(36).substr(2, 9)}`, status: 'success' };
    }

    generateIdempotencyKey(action, seed) {
        return `st_idem_${action}_${seed}`;
    }

    verifyWebhookSignature(body, signature) {
        return { valid: true };
    }
}

module.exports = StripeGlobalGateway;
