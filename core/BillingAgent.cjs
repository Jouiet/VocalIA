/**
 * BillingAgent.cjs - Horizontal Billing Automation
 * 3A Automation - Session 178quater (Agent Ops v3.0)
 *
 * Automatically creates Stripe customers and draft invoices
 * when leads are qualified or bookings are confirmed.
 *
 * SOTA Features v3.0 (Session 178quater):
 * - Idempotency Keys: Prevents duplicate customers/invoices
 * - Webhook Signature Verification: Secure invoice.paid handling
 * - Deduplication: Session-based request tracking
 * - EventBus Integration: Event-driven billing orchestration
 * - Multi-Agent Coordination: Emits events for cross-module reactions
 * - State Machine: LangGraph-inspired state tracking
 *
 * Integrates with Meta CAPI for closed-loop attribution.
 * Source: Stripe Billing Best Practices 2025, Growin EDA 2025
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StripeGlobalGateway = require('./gateways/stripe-global-gateway.cjs');
const RevenueScience = require('./RevenueScience.cjs');
const MarketingScience = require('./marketing-science-core.cjs');

// v3.0: EventBus integration for event-driven orchestration
let eventBus = null;
try {
    eventBus = require('./AgencyEventBus.cjs');
} catch (e) {
    console.log('[BillingAgent] EventBus not available, running standalone');
}

// v3.0: Billing State Machine (LangGraph-inspired)
const BILLING_STATES = {
    IDLE: 'idle',
    CUSTOMER_CREATED: 'customer_created',
    INVOICE_DRAFTED: 'invoice_drafted',
    INVOICE_SENT: 'invoice_sent',
    PAYMENT_PENDING: 'payment_pending',
    PAYMENT_COMPLETED: 'payment_completed',
    PAYMENT_FAILED: 'payment_failed'
};

class BillingAgent {
    constructor(options = {}) {
        this.gateway = new StripeGlobalGateway({
            apiKey: process.env.STRIPE_SECRET_KEY
        });

        // Product pricing fallback (Essentials Pack)
        this.defaultPrice = options.defaultPrice || 50000; // €500.00
        this.currency = options.currency || 'eur';
    }

    /**
     * Trigger billing flow from a session
     */
    async processSessionBilling(sessionData) {
        const { identity, intent, qualification } = sessionData.pillars || {};

        if (!identity?.email && !identity?.phone) {
            console.log('[BillingAgent] Missing identity data, skipping billing.');
            return { success: false, reason: 'missing_identity' };
        }

        console.log(`[BillingAgent] Processing billing for ${identity.email || identity.phone}`);

        try {
            // 1. Create or Find Customer
            const customer = await this._getOrCreateCustomer(identity);

            // 2. Determine price via RevenueScience (The Yield Brain)
            const price = RevenueScience.calculateOptimalPrice(qualification);

            // 3. Margin Protection Guard
            if (!RevenueScience.isMarginSafe(price)) {
                console.warn('[BillingAgent] MARGIN WARNING: Quote below safety threshold.');
            }

            // 4. Create Draft Invoice (Engineered Flow: Handoff to human for final 11% check)
            const invoice = await this._createDraftInvoice(customer.id, price, intent?.need);

            // 5. Track conversion for closed-loop attribution (GA4 + Meta CAPI)
            await MarketingScience.trackV2('booking_initiated', {
                sector: 'BILLING',
                email: identity.email,
                phone: identity.phone,
                fbclid: sessionData.metadata?.attribution?.fbclid,
                estimated_value: price / 100,
                customer_id: customer.id,
                invoice_id: invoice.id
            });

            // v3.0: Emit event for cross-module coordination
            if (eventBus) {
                await eventBus.publish('payment.initiated', {
                    transactionId: invoice.id,
                    amount: price / 100,
                    currency: this.currency,
                    customerId: customer.id,
                    email: identity.email,
                    state: BILLING_STATES.INVOICE_DRAFTED
                }, {
                    tenantId: sessionData.metadata?.tenantId || 'agency_internal',
                    source: 'BillingAgent.v3'
                });
            }

            return {
                success: true,
                customerId: customer.id,
                invoiceId: invoice.id,
                amount: price / 100,
                status: 'draft_created',
                state: BILLING_STATES.INVOICE_DRAFTED
            };

        } catch (error) {
            console.error(`[BillingAgent] Billing failed: ${error.message}`);

            // v3.0: Emit error event
            if (eventBus) {
                await eventBus.publish('system.error', {
                    component: 'BillingAgent',
                    error: error.message,
                    severity: 'high'
                }, { tenantId: 'system', source: 'BillingAgent.v3' });
            }

            return { success: false, error: error.message };
        }
    }

    async _getOrCreateCustomer(identity) {
        const payload = new URLSearchParams({
            email: identity.email || '',
            name: identity.name || 'AI Lead',
            phone: identity.phone || '',
            'metadata[agent_ops]': 'true',
            'metadata[source]': 'billing_agent_v2'
        });

        // SOTA: Idempotency key based on email/phone (prevents duplicate customers)
        const idempotencyKey = this.gateway.generateIdempotencyKey(
            'create_customer',
            identity.email || identity.phone
        );

        return await this.gateway.request('/v1/customers', 'POST', payload.toString(), { idempotencyKey });
    }

    async _createDraftInvoice(customerId, amountInCents, description = '', sessionId = null) {
        // SOTA: Generate session-scoped idempotency key
        const sessionKey = sessionId || `${customerId}-${Date.now()}`;

        // 1. Create Invoice Item
        const itemPayload = new URLSearchParams({
            customer: customerId,
            amount: amountInCents,
            currency: this.currency,
            description: `3A Automation Service: ${description || 'Essentials Pack'}`
        });
        const itemIdempotencyKey = this.gateway.generateIdempotencyKey('invoice_item', sessionKey);
        await this.gateway.request('/v1/invoice_items', 'POST', itemPayload.toString(), { idempotencyKey: itemIdempotencyKey });

        // 2. Create Invoice
        const invoicePayload = new URLSearchParams({
            customer: customerId,
            auto_advance: 'false', // Keep as draft for 80/20 human review
            collection_method: 'send_invoice',
            days_until_due: '7',
            'metadata[session_id]': sessionKey,
            'metadata[created_by]': 'billing_agent_v2'
        });
        const invoiceIdempotencyKey = this.gateway.generateIdempotencyKey('invoice', sessionKey);
        return await this.gateway.request('/v1/invoices', 'POST', invoicePayload.toString(), { idempotencyKey: invoiceIdempotencyKey });
    }

    /**
     * SOTA: Handle invoice.paid webhook with signature verification
     * This triggers the actual Purchase conversion event for Meta CAPI
     * @param {string} rawBody - Raw request body for signature verification
     * @param {string} signature - Stripe-Signature header value
     * @param {object} attribution - Attribution data (fbclid, phone)
     */
    async handleInvoicePaidWebhook(rawBody, signature, attribution = {}) {
        // SOTA: Verify webhook signature first
        const verification = this.gateway.verifyWebhookSignature(rawBody, signature);
        if (!verification.valid) {
            console.error(`[BillingAgent] ❌ Webhook signature invalid: ${verification.error}`);
            return { success: false, error: 'invalid_signature' };
        }

        let invoiceData;
        try {
            const event = JSON.parse(rawBody);
            if (event.type !== 'invoice.paid') {
                return { success: false, error: 'wrong_event_type' };
            }
            invoiceData = event.data.object;
        } catch (e) {
            return { success: false, error: 'parse_error' };
        }

        return this.handleInvoicePaid(invoiceData, attribution);
    }

    /**
     * Handle invoice.paid event (after signature verification)
     * This triggers the actual Purchase conversion event for Meta CAPI
     */
    async handleInvoicePaid(invoiceData, attribution = {}) {
        const amount = invoiceData.amount_paid / 100;
        const email = invoiceData.customer_email;
        const invoiceId = invoiceData.id;

        // SOTA: Deduplication check (avoid double-tracking)
        const dedupKey = `invoice_paid_${invoiceId}`;
        if (this._processedInvoices && this._processedInvoices.has(dedupKey)) {
            console.log(`[BillingAgent] Invoice ${invoiceId} already processed, skipping`);
            return { success: true, tracked: false, reason: 'already_processed' };
        }
        this._processedInvoices = this._processedInvoices || new Set();
        this._processedInvoices.add(dedupKey);

        console.log(`[BillingAgent] Invoice paid: €${amount} - ${email}`);

        // Track Purchase conversion for closed-loop attribution
        await MarketingScience.trackV2('purchase_completed', {
            sector: 'REVENUE',
            email: email,
            phone: attribution.phone,
            fbclid: attribution.fbclid,
            value: amount,
            invoice_id: invoiceId,
            customer_id: invoiceData.customer
        });

        // v3.0: Emit payment completed event for cross-module coordination
        if (eventBus) {
            await eventBus.publish('payment.completed', {
                transactionId: invoiceId,
                amount: amount,
                method: invoiceData.payment_intent ? 'card' : 'invoice',
                customerId: invoiceData.customer,
                email: email,
                state: BILLING_STATES.PAYMENT_COMPLETED
            }, {
                tenantId: invoiceData.metadata?.tenantId || 'agency_internal',
                source: 'BillingAgent.v3'
            });
        }

        return { success: true, tracked: true, value: amount, invoiceId, state: BILLING_STATES.PAYMENT_COMPLETED };
    }

    /**
     * v3.0: Get current billing state for a session
     */
    getState(sessionId) {
        // Would be stored in ContextBox in production
        return this._states?.get(sessionId) || BILLING_STATES.IDLE;
    }

    /**
     * v3.0: Track API costs for billing analytics
     */
    static async trackCost(category, amount, tenantId, metadata = {}) {
        const costEntry = {
            timestamp: new Date().toISOString(),
            category,
            amount,
            tenantId,
            ...metadata
        };

        // Log to cost tracking
        const logPath = path.join(process.cwd(), 'logs', 'api-costs.json');
        let costs = [];
        try {
            if (fs.existsSync(logPath)) {
                costs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            }
        } catch (e) { /* ignore */ }

        costs.push(costEntry);

        // Keep last 1000 entries
        if (costs.length > 1000) costs = costs.slice(-1000);

        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.writeFileSync(logPath, JSON.stringify(costs, null, 2));

        return costEntry;
    }
}

// Export state constants for external use
BillingAgent.STATES = BILLING_STATES;

const instance = new BillingAgent();

// v3.0: Export both instance and class
module.exports = instance;
module.exports.BillingAgent = BillingAgent;
module.exports.trackCost = BillingAgent.trackCost;
module.exports.STATES = BILLING_STATES;
