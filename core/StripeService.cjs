
/**
 * StripeService.cjs
 * Unified Service Layer for Stripe Operations in the Backend
 * Bridges db-api.cjs (REST) with StripeGlobalGateway (Logic)
 */

const StripeGlobalGateway = require('./gateways/stripe-global-gateway.cjs');
const { getDB } = require('./GoogleSheetsDB.cjs');

class StripeService {
    constructor() {
        this.gateway = new StripeGlobalGateway();
        this.db = getDB();
    }

    /**
     * Get or create Stripe Customer for a tenant
     */
    async getCustomerForTenant(tenantId) {
        // 1. Check if tenant has stripe_customer_id in DB
        const tenants = await this.db.query('tenants', { id: tenantId });
        if (!tenants || tenants.length === 0) throw new Error('Tenant not found');
        const tenant = tenants[0];

        if (tenant.stripe_customer_id) {
            // 2. Fetch from Stripe to verify/get latest details
            try {
                return await this.gateway.getCustomer(tenant.stripe_customer_id);
            } catch (e) {
                console.warn(`[StripeService] Customer ${tenant.stripe_customer_id} not found in Stripe, re-creating.`);
                // Fallthrough to create
            }
        }

        // 3. Create new customer
        const newCustomer = await this.gateway.createCustomer({
            email: tenant.email,
            name: tenant.name,
            metadata: { tenantId: tenant.id }
        });

        // 4. Save Stripe customer ID back to DB (C7 fix)
        try {
          await this.db.update('tenants', tenantId, { stripe_customer_id: newCustomer.id });
        } catch (e) {
          console.error(`❌ [StripeService] Failed to save stripe_customer_id for ${tenantId}:`, e.message);
        }

        return newCustomer;
    }

    /**
     * List Invoices for a tenant
     */
    async listInvoices(tenantId) {
        const customer = await this.getCustomerForTenant(tenantId);
        if (!customer) return [];

        const result = await this.gateway.request('/invoices', 'GET', {
            customer: customer.id,
            limit: 100
        });

        return result.data || [];
    }

    /**
     * Create Checkout Session for tenant billing
     */
    async createCheckoutSession(tenantId, priceId, successUrl, cancelUrl) {
        const customer = await this.getCustomerForTenant(tenantId);
        return this.gateway.createCheckoutSession({
            customerId: customer.id,
            priceId,
            successUrl,
            cancelUrl,
            metadata: { tenantId }
        });
    }

    /**
     * Get active subscription for a tenant
     */
    async getSubscriptionForTenant(tenantId) {
        const customer = await this.getCustomerForTenant(tenantId);
        const subs = await this.gateway.listSubscriptions(customer.id);
        return subs.data?.[0] || null;
    }

    /**
     * Cancel subscription for a tenant (at period end by default)
     */
    async cancelSubscriptionForTenant(tenantId) {
        const sub = await this.getSubscriptionForTenant(tenantId);
        if (!sub) throw new Error('No active subscription');
        return this.gateway.cancelSubscription(sub.id);
    }

    /**
     * Get Billing Portal Link
     */
    async getPortalLink(tenantId, returnUrl) {
        const customer = await this.getCustomerForTenant(tenantId);

        const session = await this.gateway.request('/billing_portal/sessions', 'POST', {
            customer: customer.id,
            return_url: returnUrl
        });

        return session.url;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USAGE-BASED BILLING — Stripe Meters (G7 — Session 250.239)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Report voice minutes usage for a tenant
     * @param {string} tenantId - VocalIA tenant ID
     * @param {number} minutes - Call duration in minutes (fractional OK)
     */
    async reportVoiceMinutes(tenantId, minutes) {
        if (!minutes || minutes <= 0) return;
        try {
            const customer = await this.getCustomerForTenant(tenantId);
            await this.gateway.reportMeterEvent('voice_minutes', customer.id, Math.ceil(minutes));
            console.log(`✅ [Billing] Reported ${Math.ceil(minutes)} voice minutes for ${tenantId}`);
        } catch (e) {
            // Non-blocking: log but don't fail the call
            console.warn(`⚠️ [Billing] Failed to report voice minutes for ${tenantId}: ${e.message}`);
        }
    }

    /**
     * Report API call usage for a tenant
     * @param {string} tenantId - VocalIA tenant ID
     * @param {number} calls - Number of API calls
     */
    async reportApiCalls(tenantId, calls = 1) {
        try {
            const customer = await this.getCustomerForTenant(tenantId);
            await this.gateway.reportMeterEvent('api_calls', customer.id, calls);
        } catch (e) {
            console.warn(`⚠️ [Billing] Failed to report API calls for ${tenantId}: ${e.message}`);
        }
    }

    /**
     * Get current usage summary for a tenant
     * @param {string} tenantId - VocalIA tenant ID
     * @returns {{ voice_minutes: number, api_calls: number, period_start: string }}
     */
    async getUsageSummary(tenantId) {
        try {
            const customer = await this.getCustomerForTenant(tenantId);
            const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const startTime = Math.floor(periodStart.getTime() / 1000);
            const endTime = Math.floor(Date.now() / 1000);

            // List meters to find IDs
            const meters = await this.gateway.listMeters();
            const summary = { voice_minutes: 0, api_calls: 0, period_start: periodStart.toISOString() };

            for (const meter of (meters.data || [])) {
                try {
                    const meterSummary = await this.gateway.getMeterEventSummary(
                        meter.id, customer.id, startTime, endTime
                    );
                    const total = meterSummary.data?.[0]?.aggregated_value || 0;
                    if (meter.event_name === 'voice_minutes') summary.voice_minutes = total;
                    if (meter.event_name === 'api_calls') summary.api_calls = total;
                } catch (_e) {
                    // Meter may not have data yet
                }
            }

            return summary;
        } catch (e) {
            console.warn(`⚠️ [Billing] Failed to get usage summary for ${tenantId}: ${e.message}`);
            return { voice_minutes: 0, api_calls: 0, period_start: null, error: e.message };
        }
    }

    /**
     * Initialize meters in Stripe (run once during setup)
     * Creates voice_minutes and api_calls meters if they don't exist.
     */
    async initializeMeters() {
        try {
            const existing = await this.gateway.listMeters();
            const existingNames = (existing.data || []).map(m => m.event_name);

            if (!existingNames.includes('voice_minutes')) {
                await this.gateway.createMeter('Voice Minutes', 'voice_minutes', 'sum');
                console.log('✅ [Stripe] Created meter: voice_minutes');
            }
            if (!existingNames.includes('api_calls')) {
                await this.gateway.createMeter('API Calls', 'api_calls', 'sum');
                console.log('✅ [Stripe] Created meter: api_calls');
            }

            return { success: true, meters: existingNames.length + (existingNames.includes('voice_minutes') ? 0 : 1) + (existingNames.includes('api_calls') ? 0 : 1) };
        } catch (e) {
            console.error(`❌ [Stripe] Failed to initialize meters: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CREDIT GRANT MODEL — 14-day Trial (G12 — Session 250.240)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Plan-based trial credit amounts (in cents, negative = credit on customer balance)
     * Stripe customer balance: negative = credit the customer can use
     */
    static TRIAL_CREDITS = {
      starter:      -4900,   // 49€ = 1 month free
      pro:          -9900,   // 99€ = 1 month free
      ecommerce:    -9900,   // 99€ = 1 month free
      expert_clone: -14900,  // 149€ = 1 month free
      telephony:    -19900,  // 199€ = 1 month free
    };

    static TRIAL_DAYS = 14;

    /**
     * Grant trial credits to a new tenant
     * Creates customer balance transaction (credit) + sets trial_end on subscription
     *
     * @param {string} tenantId - VocalIA tenant ID
     * @param {string} plan - Plan key (starter, pro, ecommerce, expert_clone, telephony)
     * @returns {{ success: boolean, credit_amount: number, trial_end: string }}
     */
    async grantTrialCredits(tenantId, plan = 'starter') {
        const creditAmount = StripeService.TRIAL_CREDITS[plan] || StripeService.TRIAL_CREDITS.starter;
        const trialEnd = new Date(Date.now() + StripeService.TRIAL_DAYS * 24 * 60 * 60 * 1000);

        try {
            const customer = await this.getCustomerForTenant(tenantId);

            // 1. Apply credit balance to customer (Stripe: negative amount = credit)
            await this.gateway.request('/customers/' + customer.id + '/balance_transactions', 'POST', {
                amount: creditAmount,
                currency: 'eur',
                description: `VocalIA 14-day trial credit — ${plan} plan`
            });

            // 2. Update customer metadata with trial info
            await this.gateway.request('/customers/' + customer.id, 'POST', {
                metadata: {
                    vocalia_tenant_id: tenantId,
                    vocalia_plan: plan,
                    trial_start: new Date().toISOString(),
                    trial_end: trialEnd.toISOString(),
                    trial_credit_granted: 'true'
                }
            });

            console.log(`✅ [Billing] Trial credits granted: ${Math.abs(creditAmount / 100)}€ for ${tenantId} (${plan})`);

            return {
                success: true,
                credit_amount: Math.abs(creditAmount / 100),
                currency: 'eur',
                trial_end: trialEnd.toISOString(),
                plan
            };
        } catch (e) {
            console.error(`❌ [Billing] Failed to grant trial credits for ${tenantId}: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Check trial status for a tenant
     * @param {string} tenantId
     * @returns {{ active: boolean, days_remaining: number, credit_remaining: number }}
     */
    async getTrialStatus(tenantId) {
        try {
            const customer = await this.getCustomerForTenant(tenantId);
            const trialEnd = customer.metadata?.trial_end;
            const trialGranted = customer.metadata?.trial_credit_granted === 'true';

            if (!trialGranted) {
                return { active: false, trial_available: true, days_remaining: 0, credit_remaining: 0 };
            }

            const now = new Date();
            const end = trialEnd ? new Date(trialEnd) : now;
            const daysRemaining = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
            const isActive = daysRemaining > 0;

            // Get current customer balance (negative = credit remaining)
            const balance = customer.balance || 0;
            const creditRemaining = balance < 0 ? Math.abs(balance / 100) : 0;

            return {
                active: isActive,
                trial_available: false,
                days_remaining: daysRemaining,
                credit_remaining: creditRemaining,
                trial_end: trialEnd,
                plan: customer.metadata?.vocalia_plan || 'starter'
            };
        } catch (e) {
            return { active: false, error: e.message };
        }
    }

    /**
     * Create subscription with trial period
     * Combines: subscription creation + trial credit grant
     *
     * @param {string} tenantId
     * @param {string} priceId - Stripe Price ID
     * @param {string} plan - Plan key
     */
    async createTrialSubscription(tenantId, priceId, plan = 'starter') {
        const customer = await this.getCustomerForTenant(tenantId);
        const trialEnd = Math.floor((Date.now() + StripeService.TRIAL_DAYS * 24 * 60 * 60 * 1000) / 1000);

        // 1. Create subscription with trial_end (no charge until trial expires)
        const subscription = await this.gateway.request('/subscriptions', 'POST', {
            customer: customer.id,
            'items[0][price]': priceId,
            trial_end: trialEnd,
            metadata: {
                vocalia_tenant_id: tenantId,
                vocalia_plan: plan
            }
        }, { idempotencyKey: this.gateway.generateIdempotencyKey('trial_sub', tenantId) });

        // 2. Grant balance credits for usage-based charges during trial
        await this.grantTrialCredits(tenantId, plan);

        console.log(`✅ [Billing] Trial subscription created for ${tenantId}: ${subscription.id}`);

        return {
            subscription_id: subscription.id,
            trial_end: new Date(trialEnd * 1000).toISOString(),
            status: subscription.status
        };
    }
}

module.exports = new StripeService();
