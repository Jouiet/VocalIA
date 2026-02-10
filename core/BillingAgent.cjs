/**
 * BillingAgent.cjs - Horizontal Billing Automation
 * VocalIA - Session 178quater (Agent Ops v3.0)
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
 * A2A Protocol Compliance: Agent Card + Task Lifecycle (Session 250.30)
 *
 * Integrates with Meta CAPI for closed-loop attribution.
 * Source: Stripe Billing Best Practices 2025, Growin EDA 2025
 */

// ─────────────────────────────────────────────────────────────────────────────
// A2A AGENT CARD (Google A2A Protocol Spec)
// https://a2a-protocol.org/latest/specification/
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_CARD = {
    name: "BillingAgent",
    version: "3.1.0",
    description: "Autonomous billing orchestration - Stripe/Payzone customer and invoice management",
    provider: {
        organization: "VocalIA",
        url: "https://vocalia.ma"
    },
    capabilities: {
        streaming: false,
        pushNotifications: true,
        stateTransitionHistory: true
    },
    skills: [
        {
            id: "customer_creation",
            name: "Customer Creation",
            description: "Creates Stripe/Payzone customers with idempotency",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        },
        {
            id: "invoice_drafting",
            name: "Invoice Drafting",
            description: "Generates draft invoices for qualified leads",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        },
        {
            id: "payment_processing",
            name: "Payment Processing",
            description: "Handles payment webhooks and status updates",
            inputModes: ["application/json"],
            outputModes: ["application/json"]
        },
        {
            id: "currency_routing",
            name: "Currency Routing",
            description: "Routes MAD to Payzone, EUR/USD to Stripe",
            inputModes: ["text"],
            outputModes: ["application/json"]
        }
    ],
    authentication: {
        schemes: ["bearer"]
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"]
};

// A2A Task States
const TASK_STATES = {
    SUBMITTED: 'submitted',
    WORKING: 'working',
    INPUT_REQUIRED: 'input-required',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELED: 'canceled'
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StripeGlobalGateway = require('./gateways/stripe-global-gateway.cjs');
const PayzoneGlobalGateway = require('./gateways/payzone-global-gateway.cjs'); // NEW: For MAD payments
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
        this.stripe = new StripeGlobalGateway({
            apiKey: process.env.STRIPE_SECRET_KEY
        });

        this.payzone = new PayzoneGlobalGateway({
            apiKey: process.env.PAYZONE_API_KEY
        });

        // Product pricing fallback (Essentials Pack)
        this.defaultPrice = options.defaultPrice || 50000; // €500.00
        this.currency = options.currency || 'eur';

        // A2A: Task state history
        this.taskHistory = new Map();

        console.log(`[BillingAgent] A2A Agent Active - ${AGENT_CARD.name} v${AGENT_CARD.version}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // A2A PROTOCOL METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * A2A: Get Agent Card (metadata about this agent)
     */
    getAgentCard() {
        return AGENT_CARD;
    }

    /**
     * A2A: Get task state history for a correlation ID
     */
    getTaskHistory(correlationId) {
        return this.taskHistory.get(correlationId) || [];
    }

    /**
     * A2A: Record task state transition
     */
    recordTaskState(correlationId, state, details = {}) {
        if (!this.taskHistory.has(correlationId)) {
            this.taskHistory.set(correlationId, []);
        }
        this.taskHistory.get(correlationId).push({
            state,
            timestamp: new Date().toISOString(),
            ...details
        });
        // Cleanup old entries (keep last 500)
        if (this.taskHistory.size > 500) {
            const firstKey = this.taskHistory.keys().next().value;
            this.taskHistory.delete(firstKey);
        }
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
            const tenantId = sessionData.metadata?.tenantId || 'unknown';
            const currency = (sessionData.metadata?.currency || this.currency).toLowerCase();
            const gateway = currency === 'mad' ? this.payzone : this.stripe;

            // 1. Create or Find Customer
            const customer = await this._getOrCreateCustomer(identity, gateway);

            // 2. Determine price via RevenueScience (The Yield Brain)
            const price = RevenueScience.calculateOptimalPrice(qualification);

            // 3. Margin Protection Guard
            if (!RevenueScience.isMarginSafe(price)) {
                console.warn(`[BillingAgent][${tenantId}] MARGIN WARNING: Quote below safety threshold.`);
            }

            // 4. Create Draft Invoice (Engineered Flow: Handoff to human for final 11% check)
            // BL16 fix: Pass sessionData.id for proper idempotency (was null → Date.now()-based key)
            const invoice = await this._createDraftInvoice(customer.id, price, intent?.need, sessionData.id || null, gateway, currency);

            // 5. Track conversion for closed-loop attribution (GA4 + Meta CAPI)
            await MarketingScience.trackV2('booking_initiated', {
                tenantId: tenantId,
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
                    currency: currency,
                    customerId: customer.id,
                    email: identity.email,
                    state: BILLING_STATES.INVOICE_DRAFTED
                }, {
                    tenantId: sessionData.metadata?.tenantId || 'unknown',
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

    // C1+C2 fix: paths without /v1 prefix (gateway base already includes it)
    // C2 fix: pass object, not URLSearchParams.toString() (gateway._buildFormData expects object)
    async _getOrCreateCustomer(identity, gateway) {
        const payload = {
            email: identity.email || '',
            name: identity.name || 'AI Lead',
            phone: identity.phone || '',
            metadata: { agent_ops: 'true', source: 'billing_agent_v2' }
        };

        // SOTA: Idempotency key based on email/phone (prevents duplicate customers)
        const idempotencyKey = gateway.generateIdempotencyKey(
            'create_customer',
            identity.email || identity.phone
        );

        return await gateway.request('/customers', 'POST', payload, { idempotencyKey });
    }

    async _createDraftInvoice(customerId, amountInCents, description = '', sessionId = null, gateway = this.stripe, currency = 'eur') {
        // SOTA: Generate session-scoped idempotency key
        const sessionKey = sessionId || `${customerId}-${Date.now()}`;

        // 1. Create Invoice Item (C1+C2 fix: no /v1 prefix, pass object not string)
        const itemPayload = {
            customer: customerId,
            amount: amountInCents,
            currency: currency,
            description: `VocalIA Service: ${description || 'Essentials Pack'}`
        };
        const itemIdempotencyKey = gateway.generateIdempotencyKey('invoice_item', sessionKey);
        await gateway.request('/invoice_items', 'POST', itemPayload, { idempotencyKey: itemIdempotencyKey });

        // 2. Create Invoice
        const invoicePayload = {
            customer: customerId,
            auto_advance: 'false',
            collection_method: 'send_invoice',
            days_until_due: '7',
            metadata: { session_id: sessionKey, created_by: 'billing_agent_v2' }
        };
        const invoiceIdempotencyKey = gateway.generateIdempotencyKey('invoice', sessionKey);
        return await gateway.request('/invoices', 'POST', invoicePayload, { idempotencyKey: invoiceIdempotencyKey });
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
        const verification = this.stripe.verifyWebhookSignature(rawBody, signature);
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
        if (!this._processedInvoices) this._processedInvoices = new Set();
        if (this._processedInvoices.has(dedupKey)) {
            console.log(`[BillingAgent] Invoice ${invoiceId} already processed, skipping`);
            return { success: true, tracked: false, reason: 'already_processed' };
        }
        this._processedInvoices.add(dedupKey);
        // Bound the set to prevent memory leak (keep last 10,000 invoice IDs)
        if (this._processedInvoices.size > 10000) {
            const firstKey = this._processedInvoices.values().next().value;
            this._processedInvoices.delete(firstKey);
        }

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
                tenantId: invoiceData.metadata?.tenantId || 'unknown',
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
            ...metadata,
            timestamp: new Date().toISOString(),
            category,
            amount,
            tenantId
        };

        // Log to cost tracking
        const logPath = path.join(__dirname, '..', 'logs', 'api-costs.json');
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
