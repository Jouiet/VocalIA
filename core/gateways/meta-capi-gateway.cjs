/**
 * Meta Conversions API (CAPI) Gateway
 * 3A Automation - Session 177/178 (SOTA Optimization)
 *
 * Server-Side Conversion Tracking for Meta Ads
 * Sends offline conversions (Lead, Purchase) back to Meta for optimization
 *
 * SOTA Features (Session 178):
 * - Event Deduplication: event_id for Pixel+CAPI hybrid setup (EMQ boost)
 * - Retry Logic: Exponential backoff (3 attempts)
 * - EMQ Optimization: Enhanced Match Quality targeting 8+ score
 *
 * Benchmark: +13-41% ROAS uplift (Meta, Polar Analytics)
 * Source: Meta CAPI Best Practices 2025, Littledata Engineering Blog
 *
 * Usage:
 *   const MetaCAPI = require('./gateways/meta-capi-gateway.cjs');
 *   await MetaCAPI.trackLead({ email, phone, fbclid, value });
 */

const crypto = require('crypto');

// SOTA: Retry configuration
const RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000
};

class MetaCAPIGateway {
    constructor() {
        this.pixelId = process.env.META_PIXEL_ID;
        this.accessToken = process.env.META_ACCESS_TOKEN;
        this.apiVersion = 'v22.0';
        this.testEventCode = process.env.META_TEST_EVENT_CODE || null;
    }

    /**
     * Hash user data per Meta requirements (SHA256, lowercase, trimmed)
     */
    _hash(value) {
        if (!value) return null;
        const normalized = String(value).toLowerCase().trim();
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * SOTA: Generate deterministic event_id for deduplication
     * Critical for hybrid Pixel+CAPI setups (avoids double-counting)
     * Source: Meta CAPI docs - "event_id must be identical for browser and server events"
     */
    _generateEventId(eventName, userData, timestamp) {
        const components = [
            eventName,
            userData.email || userData.phone || 'anon',
            timestamp.toString()
        ].join('|');
        return crypto.createHash('sha256').update(components).digest('hex').substring(0, 36);
    }

    /**
     * SOTA: Exponential backoff delay
     */
    _getRetryDelay(attempt) {
        const delay = Math.min(
            RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelayMs
        );
        return delay + Math.random() * 500; // Jitter
    }

    /**
     * Build the base event payload
     * SOTA: Includes event_id for deduplication (hybrid Pixel+CAPI)
     */
    _buildPayload(eventName, userData, customData = {}, eventSourceUrl = 'https://3a-automation.com') {
        const timestamp = Math.floor(Date.now() / 1000);

        // SOTA: Generate event_id for deduplication
        // This must match the event_id sent from browser Pixel for merging
        const eventId = customData.event_id || this._generateEventId(eventName, userData, timestamp);

        const payload = {
            data: [{
                event_name: eventName,
                event_id: eventId, // SOTA: Critical for EMQ score and deduplication
                event_time: timestamp,
                event_source_url: eventSourceUrl,
                action_source: 'website',
                user_data: {
                    em: userData.email ? [this._hash(userData.email)] : undefined,
                    ph: userData.phone ? [this._hash(userData.phone)] : undefined,
                    fn: userData.firstName ? [this._hash(userData.firstName)] : undefined,
                    ln: userData.lastName ? [this._hash(userData.lastName)] : undefined,
                    ct: userData.city ? [this._hash(userData.city)] : undefined,
                    zp: userData.zipCode ? [this._hash(userData.zipCode)] : undefined, // SOTA: ZIP for EMQ
                    country: userData.country ? [this._hash(userData.country)] : undefined,
                    fbc: userData.fbclid ? `fb.1.${timestamp}.${userData.fbclid}` : undefined,
                    fbp: userData.fbp || undefined,
                    client_ip_address: userData.ip || undefined,
                    client_user_agent: userData.userAgent || undefined,
                    external_id: userData.customerId ? [this._hash(userData.customerId)] : undefined // SOTA: CRM ID
                },
                custom_data: {
                    ...customData,
                    currency: customData.currency || 'EUR',
                    value: customData.value || 0
                }
            }]
        };

        // Add test event code for debugging
        if (this.testEventCode) {
            payload.test_event_code = this.testEventCode;
        }

        // Clean undefined values
        Object.keys(payload.data[0].user_data).forEach(key => {
            if (payload.data[0].user_data[key] === undefined) {
                delete payload.data[0].user_data[key];
            }
        });

        return payload;
    }

    /**
     * Send event to Meta CAPI
     * SOTA: Includes retry logic with exponential backoff
     */
    async _send(payload, attempt = 0) {
        if (!this.pixelId || !this.accessToken) {
            console.warn('[MetaCAPI] Missing credentials (META_PIXEL_ID or META_ACCESS_TOKEN)');
            return { success: false, error: 'missing_credentials' };
        }

        const url = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events?access_token=${this.accessToken}`;
        const eventId = payload.data?.[0]?.event_id || 'unknown';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.events_received) {
                console.log(`[MetaCAPI] ✅ Event sent (event_id: ${eventId}). Events received: ${result.events_received}`);
                return {
                    success: true,
                    events_received: result.events_received,
                    fbtrace_id: result.fbtrace_id,
                    event_id: eventId // SOTA: Return for browser Pixel sync
                };
            } else {
                // SOTA: Retry on transient errors (rate limit, server errors)
                const errorCode = result.error?.code;
                const isRetryable = errorCode === 190 || errorCode >= 500 || response.status >= 500;

                if (isRetryable && attempt < RETRY_CONFIG.maxAttempts - 1) {
                    const delay = this._getRetryDelay(attempt);
                    console.warn(`[MetaCAPI] Retry ${attempt + 1}/${RETRY_CONFIG.maxAttempts} in ${Math.round(delay)}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    return this._send(payload, attempt + 1);
                }

                console.error(`[MetaCAPI] ❌ Event failed:`, result);
                return { success: false, error: result.error?.message || 'Unknown error', event_id: eventId };
            }
        } catch (error) {
            // SOTA: Retry on network errors
            if (attempt < RETRY_CONFIG.maxAttempts - 1) {
                const delay = this._getRetryDelay(attempt);
                console.warn(`[MetaCAPI] Network retry ${attempt + 1}/${RETRY_CONFIG.maxAttempts} in ${Math.round(delay)}ms`);
                await new Promise(r => setTimeout(r, delay));
                return this._send(payload, attempt + 1);
            }
            console.error(`[MetaCAPI] ❌ Network error after ${attempt + 1} attempts: ${error.message}`);
            return { success: false, error: error.message, event_id: eventId };
        }
    }

    /**
     * Track Lead event (when BANT qualification is complete)
     * @param {object} data { email, phone, fbclid, leadScore, estimatedLtv }
     */
    async trackLead(data) {
        const userData = {
            email: data.email,
            phone: data.phone,
            fbclid: data.fbclid,
            fbp: data.fbp,
            firstName: data.firstName,
            lastName: data.lastName,
            ip: data.ip,
            userAgent: data.userAgent
        };

        const customData = {
            lead_score: data.leadScore || data.bant_score || 0,
            value: data.estimatedLtv || data.value || 0,
            currency: data.currency || 'EUR',
            content_name: data.service || '3A Automation Lead',
            content_category: data.sector || 'Voice AI'
        };

        const payload = this._buildPayload('Lead', userData, customData, data.sourceUrl);
        console.log(`[MetaCAPI] Tracking Lead: ${data.email || data.phone} | Score: ${customData.lead_score}`);
        return await this._send(payload);
    }

    /**
     * Track Purchase event (when deal is closed)
     * @param {object} data { email, phone, fbclid, value, orderId }
     */
    async trackPurchase(data) {
        const userData = {
            email: data.email,
            phone: data.phone,
            fbclid: data.fbclid,
            fbp: data.fbp,
            ip: data.ip,
            userAgent: data.userAgent
        };

        const customData = {
            value: data.value || 0,
            currency: data.currency || 'EUR',
            order_id: data.orderId || data.invoiceId,
            content_name: data.productName || '3A Automation Service',
            content_category: data.sector || 'Automation'
        };

        const payload = this._buildPayload('Purchase', userData, customData, data.sourceUrl);
        console.log(`[MetaCAPI] Tracking Purchase: ${data.email || data.phone} | Value: €${customData.value}`);
        return await this._send(payload);
    }

    /**
     * Track InitiateCheckout event (when booking is initiated)
     */
    async trackInitiateCheckout(data) {
        const userData = {
            email: data.email,
            phone: data.phone,
            fbclid: data.fbclid
        };

        const customData = {
            value: data.estimatedValue || 500,
            currency: data.currency || 'EUR',
            content_name: data.service || 'Consultation Booking'
        };

        const payload = this._buildPayload('InitiateCheckout', userData, customData, data.sourceUrl);
        console.log(`[MetaCAPI] Tracking InitiateCheckout: ${data.email || data.phone}`);
        return await this._send(payload);
    }

    /**
     * Health check (synchronous)
     */
    healthCheck() {
        return {
            status: (this.pixelId && this.accessToken) ? 'ok' : 'error',
            gateway: 'meta-capi',
            version: '2.0.0', // SOTA: Session 178
            sota_features: ['event_id_deduplication', 'retry_with_backoff', 'emq_optimization'],
            credentials: {
                META_PIXEL_ID: this.pixelId ? 'set' : 'missing',
                META_ACCESS_TOKEN: this.accessToken ? 'set' : 'missing'
            },
            apiVersion: this.apiVersion,
            testMode: !!this.testEventCode,
            retryConfig: RETRY_CONFIG
        };
    }
}

module.exports = new MetaCAPIGateway();
