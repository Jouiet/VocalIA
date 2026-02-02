/**
 * PayzoneGlobalGateway.cjs
 * VocalIA - Morocco Payment Gateway (MAD)
 *
 * Production wrapper around PayzoneGateway for BillingAgent integration.
 * Handles Moroccan Dirham (MAD) payments via CMI/Payzone.
 *
 * @version 2.0.0
 * @date 2026-02-02
 * @session 250.62
 */

const crypto = require('crypto');
const PayzoneGateway = require('./payzone-gateway.cjs');

class PayzoneGlobalGateway {
    constructor(config = {}) {
        this.merchantId = config.merchantId || process.env.PAYZONE_MERCHANT_ID;
        this.password = config.password || process.env.PAYZONE_PASSWORD;
        this.secretKey = config.secretKey || process.env.PAYZONE_SECRET_KEY;
        this.isTest = config.isTest !== false;

        // Initialize real gateway if configured
        if (this.merchantId && this.secretKey) {
            this.gateway = new PayzoneGateway({
                merchantId: this.merchantId,
                password: this.password,
                secretKey: this.secretKey,
                isTest: this.isTest
            });
        } else {
            this.gateway = null;
            console.warn('[Payzone] ⚠️ PAYZONE credentials not configured (PAYZONE_MERCHANT_ID, PAYZONE_SECRET_KEY)');
        }
    }

    /**
     * Make API request via Payzone
     *
     * @param {string} path - Action path (e.g., '/payment')
     * @param {string} method - HTTP method (always POST for Payzone)
     * @param {object} body - Transaction data
     * @param {object} options - Additional options
     * @returns {Promise<object>} API response
     */
    async request(path, method = 'POST', body = null, options = {}) {
        if (!this.gateway) {
            throw new Error('Payzone credentials not configured (PAYZONE_MERCHANT_ID, PAYZONE_SECRET_KEY)');
        }

        // Route based on path
        if (path === '/payment' || path.includes('payment')) {
            return this.gateway.processPayment({
                amount: body.amount,
                orderId: body.orderId || options.idempotencyKey || this._generateOrderId(),
                email: body.email,
                ip: body.ip || '127.0.0.1'
            });
        }

        // Default: pass through as payment
        return this.gateway.processPayment(body);
    }

    /**
     * Generate idempotency key for safe retry
     *
     * @param {string} action - Action name
     * @param {string} seed - Unique seed
     * @returns {string} Idempotency key
     */
    generateIdempotencyKey(action, seed) {
        const data = `pz_${action}_${seed}_${new Date().toISOString().split('T')[0]}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 24);
    }

    /**
     * Generate unique order ID
     */
    _generateOrderId() {
        return `VIA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    /**
     * Verify webhook signature from Payzone
     *
     * @param {string|Buffer} body - Raw request body
     * @param {string} signature - Signature header
     * @returns {object} { valid: boolean, data?: object, error?: string }
     */
    verifyWebhookSignature(body, signature) {
        if (!this.secretKey) {
            return { valid: false, error: 'PAYZONE_SECRET_KEY not configured' };
        }

        try {
            const bodyString = typeof body === 'string' ? body : body.toString();

            // Payzone uses HMAC-SHA512 for signature
            const expectedSignature = crypto
                .createHmac('sha512', this.secretKey)
                .update(bodyString)
                .digest('hex');

            // Constant-time comparison
            const valid = crypto.timingSafeEqual(
                Buffer.from(signature || ''),
                Buffer.from(expectedSignature)
            );

            if (valid) {
                // Parse Payzone XML response
                const data = this._parseResponse(bodyString);
                return { valid: true, data };
            } else {
                return { valid: false, error: 'Signature mismatch' };
            }
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Parse Payzone XML response
     */
    _parseResponse(xml) {
        const codeMatch = xml.match(/<response_code>(.*?)<\/response_code>/);
        const descMatch = xml.match(/<response_desc>(.*?)<\/response_desc>/);
        const transMatch = xml.match(/<transaction_id>(.*?)<\/transaction_id>/);
        const orderMatch = xml.match(/<order_id>(.*?)<\/order_id>/);
        const amountMatch = xml.match(/<amount>(.*?)<\/amount>/);

        return {
            success: codeMatch && codeMatch[1] === '00',
            code: codeMatch ? codeMatch[1] : 'ERROR',
            message: descMatch ? descMatch[1] : 'Unknown',
            transactionId: transMatch ? transMatch[1] : null,
            orderId: orderMatch ? orderMatch[1] : null,
            amount: amountMatch ? parseFloat(amountMatch[1]) : null
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONVENIENCE METHODS (Used by BillingAgent)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Process a payment
     *
     * @param {object} data - { amount (in centimes), email, orderId }
     */
    async processPayment(data) {
        if (!this.gateway) {
            throw new Error('Payzone credentials not configured');
        }

        return this.gateway.processPayment({
            amount: data.amount,
            orderId: data.orderId || this._generateOrderId(),
            email: data.email,
            ip: data.ip || '127.0.0.1'
        });
    }

    /**
     * Health check
     */
    healthCheck() {
        return {
            gateway: 'payzone-global',
            version: '2.0.0',
            configured: !!(this.merchantId && this.secretKey),
            testMode: this.isTest,
            currency: 'MAD',
            region: 'Morocco'
        };
    }
}

module.exports = PayzoneGlobalGateway;
