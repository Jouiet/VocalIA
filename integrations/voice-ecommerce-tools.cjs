/**
 * Voice E-commerce Tools — Adapter
 * VocalIA - Session 250.174
 *
 * ADAPTER: Wraps core/voice-ecommerce-tools.cjs with the legacy API
 * used by telephony/voice-telephony-bridge.cjs.
 *
 * Methods: getOrderStatus(email, config), checkProductStock(query, config),
 *          getCustomerProfile(email, config)
 *
 * The core module uses tenant-aware SecretVault + CatalogConnector.
 * This adapter passes config directly for backward compatibility.
 */

'use strict';

const coreTools = require('../core/voice-ecommerce-tools.cjs');
const https = require('https');

class VoiceEcommerceTools {
  /**
   * Get order status for a customer
   * Delegates to core checkOrderStatus when tenantId available,
   * falls back to direct Shopify API for legacy config-based calls.
   */
  async getOrderStatus(email, config = {}) {
    // If tenantId provided, use the core implementation
    if (config.tenantId) {
      const result = await coreTools.checkOrderStatus(email, null, config.tenantId);
      // Adapt response format
      if (result.found) {
        return {
          found: true,
          orderId: result.orderId,
          status: result.status,
          financial_status: result.status,
          date: result.createdAt,
          tracking_url: result.tracking?.url || null
        };
      }
      return result;
    }

    // Legacy: direct Shopify API with config credentials
    const token = config.shopifyToken || process.env.SHOPIFY_ACCESS_TOKEN;
    const shop = config.shopifyShop || process.env.SHOPIFY_SHOP_NAME;

    if (!token || !shop) {
      return { success: false, error: 'Shopify not configured for this tenant' };
    }

    try {
      const url = `https://${shop}.myshopify.com/admin/api/2026-01/orders.json?email=${encodeURIComponent(email)}&limit=1`;
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);

      const data = await response.json();
      const order = data.orders && data.orders[0];

      if (!order) return { found: false, message: 'No order found for this email.' };

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
   * Delegates to core checkStock when tenantId available.
   */
  async checkProductStock(query, config = {}) {
    // If tenantId provided, use core implementation
    if (config.tenantId) {
      const result = await coreTools.checkStock(query, config.tenantId);
      if (result.found) {
        return {
          found: true,
          products: [{
            title: result.name,
            price: result.price,
            inStock: result.inStock
          }]
        };
      }
      return result;
    }

    // Legacy: direct Shopify API
    const token = config.shopifyToken || process.env.SHOPIFY_ACCESS_TOKEN;
    const shop = config.shopifyShop || process.env.SHOPIFY_SHOP_NAME;

    if (!token || !shop) {
      return { success: false, error: 'Shopify not configured for this tenant' };
    }

    try {
      const url = `https://${shop}.myshopify.com/admin/api/2026-01/products.json?title=${encodeURIComponent(query)}&limit=3`;
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);

      const data = await response.json();
      const products = data.products || [];

      if (products.length === 0) return { found: false, message: 'Product not found.' };

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
  async getCustomerProfile(email, config = {}) {
    const key = config.klaviyoKey || process.env.KLAVIYO_API_KEY;

    if (!key) {
      return { success: false, error: 'Klaviyo not configured for this tenant' };
    }

    try {
      const response = await fetch(`https://a.klaviyo.com/api/profiles/?filter=equals(email,"${encodeURIComponent(email)}")`, {
        headers: {
          'Authorization': `Klaviyo-API-Key ${key}`,
          'accept': 'application/json',
          'revision': '2026-01-15'
        }
      });

      if (!response.ok) throw new Error(`Klaviyo API error: ${response.status}`);

      const data = await response.json();
      const profile = data.data && data.data[0];

      if (!profile) return { found: false, message: 'Customer profile not found.' };

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

module.exports = new VoiceEcommerceTools();
