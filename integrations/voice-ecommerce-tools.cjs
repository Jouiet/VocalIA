/**
 * Voice E-commerce Tools
 * 3A Automation - Voice AI Hardening Phase
 * 
 * Provides safe, read-only access to Shopify and Klaviyo data
 * for real-time voice assistants.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '../../../.env');
const ENV = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([A-Z_]+)=(.+)$/);
        if (match) ENV[match[1]] = match[2].trim();
    });
}

class VoiceEcommerceTools {
    constructor() {
        this.shopifyToken = ENV.SHOPIFY_ACCESS_TOKEN;
        this.shopifyShop = ENV.SHOPIFY_SHOP_NAME; // e.g., 'your-store'
        this.klaviyoKey = ENV.KLAVIYO_API_KEY;
    }

    /**
     * Get order status for a customer
     */
    async getOrderStatus(email, orderId = null) {
        if (!this.shopifyToken || !this.shopifyShop) {
            return { success: false, error: "Shopify not configured" };
        }

        try {
            console.log(`[Voice-Tools] Fetching order status for ${email}`);
            // Simple fetch to Shopify GraphQL/REST for demonstration
            // In production, use the shopify-admin MCP or a direct SDK call
            const url = `https://${this.shopifyShop}.myshopify.com/admin/api/2026-01/orders.json?email=${encodeURIComponent(email)}&limit=1`;
            const response = await fetch(url, {
                headers: {
                    'X-Shopify-Access-Token': this.shopifyToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);

            const data = await response.json();
            const order = data.orders && data.orders[0];

            if (!order) return { found: false, message: "No order found for this email." };

            return {
                found: true,
                orderId: order.name,
                status: order.fulfillment_status || 'processing',
                financial_status: order.financial_status,
                date: order.created_at,
                tracking_url: order.fulfillments?.[0]?.tracking_url || null
            };
        } catch (error) {
            console.error('[Voice-Tools] Shopify Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check product availability
     */
    async checkProductStock(query) {
        if (!this.shopifyToken || !this.shopifyShop) {
            return { success: false, error: "Shopify not configured" };
        }

        try {
            console.log(`[Voice-Tools] Checking stock for: ${query}`);
            const url = `https://${this.shopifyShop}.myshopify.com/admin/api/2026-01/products.json?title=${encodeURIComponent(query)}&limit=3`;
            const response = await fetch(url, {
                headers: {
                    'X-Shopify-Access-Token': this.shopifyToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);

            const data = await response.json();
            const products = data.products || [];

            if (products.length === 0) return { found: false, message: "Product not found." };

            return {
                found: true,
                products: products.map(p => ({
                    title: p.title,
                    price: p.variants[0]?.price,
                    inStock: p.variants.some(v => v.inventory_quantity > 0 || v.inventory_policy === 'continue')
                }))
            };
        } catch (error) {
            console.error('[Voice-Tools] Shopify Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get Klaviyo customer profile (Loyalty/Tiers)
     */
    async getCustomerProfile(email) {
        if (!this.klaviyoKey) {
            return { success: false, error: "Klaviyo not configured" };
        }

        try {
            console.log(`[Voice-Tools] Fetching Klaviyo profile: ${email}`);
            const response = await fetch(`https://a.klaviyo.com/api/profiles/?filter=equals(email,"${encodeURIComponent(email)}")`, {
                headers: {
                    'Authorization': `Klaviyo-API-Key ${this.klaviyoKey}`,
                    'accept': 'application/json',
                    'revision': '2026-01-15'
                }
            });

            if (!response.ok) throw new Error(`Klaviyo API error: ${response.status}`);

            const data = await response.json();
            const profile = data.data && data.data[0];

            if (!profile) return { found: false, message: "Customer profile not found." };

            return {
                found: true,
                id: profile.id,
                firstName: profile.attributes.first_name,
                tags: profile.attributes.properties?.tags || []
            };
        } catch (error) {
            console.error('[Voice-Tools] Klaviyo Error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance (aligned with voice-crm-tools.cjs pattern)
module.exports = new VoiceEcommerceTools();
