
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
}

module.exports = new StripeService();
