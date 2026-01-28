/**
 * PayzoneGlobalGateway.cjs
 * VocalIA - Morocco Payment Gateway (MAD)
 */

class PayzoneGlobalGateway {
    constructor(config = {}) {
        this.apiKey = config.apiKey;
    }

    async request(path, method, body, options = {}) {
        console.log(`[Payzone] Mock request to ${path}`);
        return { id: `pz_${Math.random().toString(36).substr(2, 9)}`, status: 'success' };
    }

    generateIdempotencyKey(action, seed) {
        return `pz_idem_${action}_${seed}`;
    }

    verifyWebhookSignature(body, signature) {
        return { valid: true };
    }
}

module.exports = PayzoneGlobalGateway;
