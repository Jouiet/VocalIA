/**
 * voice-ecommerce-tools.cjs
 * VocalIA - Session 250.94
 *
 * PRODUCTION BRIDGE: Connects Voice API to Real E-commerce Logic.
 * REPLACES: The previous skeleton "connexion aux commandes n'est pas encore active" mock.
 *
 * Supports: Shopify, WooCommerce (via SecretVault credentials)
 */

const { CatalogConnectorFactory, CATALOG_TYPES } = require('./catalog-connector.cjs');
const SecretVault = require('./SecretVault.cjs');
const https = require('https');

// Cache connectors per tenant to avoid reconnection overhead
const connectors = new Map();
const MAX_CONNECTORS = 50;

async function getConnector(tenantId) {
  if (connectors.has(tenantId)) return connectors.get(tenantId);

  // Evict oldest if cache full
  if (connectors.size >= MAX_CONNECTORS) {
    const oldestKey = connectors.keys().next().value;
    connectors.delete(oldestKey);
  }

  try {
    const connector = CatalogConnectorFactory.create(tenantId, {
      source: 'custom',
      catalogType: CATALOG_TYPES.PRODUCTS
    });

    await connector.connect();
    connectors.set(tenantId, connector);
    return connector;
  } catch (e) {
    console.warn(`[VoiceEcom] Failed to create connector for ${tenantId}:`, e.message);
    throw e;
  }
}

/**
 * Shopify GraphQL Admin API request
 */
async function shopifyGraphQL(store, token, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const options = {
      hostname: `${store}.myshopify.com`,
      port: 443,
      path: '/admin/api/2026-01/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(parsed.errors[0]?.message || 'Shopify API Error'));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error('Invalid Shopify response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Shopify API timeout'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * WooCommerce REST API request
 */
async function woocommerceRequest(siteUrl, key, secret, endpoint) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const url = new URL(endpoint, siteUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `WooCommerce Error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Invalid WooCommerce response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('WooCommerce API timeout'));
    });
    req.end();
  });
}

/**
 * Map fulfillment/order status to voice-friendly message
 */
function getVoiceFriendlyStatus(status, fulfillmentStatus, platform) {
  const statusMap = {
    // Shopify statuses
    'FULFILLED': 'expédiée et en route vers vous',
    'UNFULFILLED': 'confirmée et en cours de préparation',
    'PARTIALLY_FULFILLED': 'partiellement expédiée',
    'PENDING': 'en attente de paiement',
    'PAID': 'payée et en cours de traitement',
    'REFUNDED': 'remboursée',
    'CANCELLED': 'annulée',
    // WooCommerce statuses
    'completed': 'livrée',
    'processing': 'en cours de préparation',
    'on-hold': 'en attente',
    'pending': 'en attente de paiement',
    'cancelled': 'annulée',
    'refunded': 'remboursée',
    'failed': 'échouée'
  };

  // Priority: fulfillmentStatus > status
  const key = fulfillmentStatus || status;
  return statusMap[key] || statusMap[key?.toUpperCase()] || `en statut ${status}`;
}

module.exports = {
  // Pure utility (exported for testing)
  getVoiceFriendlyStatus,

  /**
   * Check order status - PRODUCTION IMPLEMENTATION
   * Supports Shopify (GraphQL) and WooCommerce (REST)
   *
   * @param {string} email - Customer email (for verification)
   * @param {string} orderId - Order ID or order number
   * @param {string} tenantId - Tenant identifier
   */
  checkOrderStatus: async (email, orderId, tenantId) => {
    try {
      console.log(`[VoiceEcom] Checking order ${orderId} for ${email} (Tenant: ${tenantId})`);

      const creds = await SecretVault.loadCredentials(tenantId);

      // Shopify (Primary E-commerce)
      const shopifyStore = creds.SHOPIFY_STORE || creds.SHOPIFY_SHOP_NAME;
      const shopifyToken = creds.SHOPIFY_ACCESS_TOKEN || creds.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (shopifyStore && shopifyToken) {
        try {
          // Clean store name (remove .myshopify.com if present)
          const store = shopifyStore.replace('.myshopify.com', '');

          // Query by order number (e.g., #1001) or ID
          const query = `
            query getOrderByNumber($query: String!) {
              orders(first: 1, query: $query) {
                edges {
                  node {
                    id
                    name
                    email
                    displayFinancialStatus
                    displayFulfillmentStatus
                    createdAt
                    totalPriceSet { shopMoney { amount currencyCode } }
                    fulfillments(first: 1) {
                      trackingInfo { number url company }
                      status
                    }
                  }
                }
              }
            }
          `;

          // Try order number format first, then raw ID
          const searchQuery = orderId.startsWith('#') ? `name:${orderId}` : `name:#${orderId}`;
          const response = await shopifyGraphQL(store, shopifyToken, query, { query: searchQuery });

          const orderEdge = response?.orders?.edges?.[0];
          if (orderEdge) {
            const order = orderEdge.node;

            // Verify email matches (security) — email REQUIRED to prevent order enumeration
            if (!email) {
              return { found: false, message: 'Veuillez fournir votre email pour vérifier la commande.' };
            }
            if (order.email && order.email.toLowerCase() !== email.toLowerCase()) {
              console.warn(`[VoiceEcom] Email mismatch for order ${orderId}`);
              return { found: false, message: 'Cette commande ne correspond pas à votre email.' };
            }

            const tracking = order.fulfillments?.[0]?.trackingInfo?.[0];
            const statusMessage = getVoiceFriendlyStatus(order.displayFinancialStatus, order.displayFulfillmentStatus, 'shopify');

            return {
              found: true,
              source: 'shopify',
              orderId: order.name,
              status: order.displayFulfillmentStatus || order.displayFinancialStatus,
              statusMessage: `Votre commande ${order.name} est ${statusMessage}.`,
              total: `${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`,
              createdAt: order.createdAt,
              tracking: tracking ? {
                number: tracking.number,
                url: tracking.url,
                carrier: tracking.company
              } : null
            };
          }

          return { found: false, source: 'shopify', message: 'Commande introuvable dans notre système.' };
        } catch (shopifyError) {
          console.warn(`[VoiceEcom] Shopify lookup failed: ${shopifyError.message}`);
          // Fall through to WooCommerce
        }
      }

      // WooCommerce (Secondary E-commerce)
      const wooUrl = creds.WOOCOMMERCE_URL || creds.WOO_STORE_URL;
      const wooKey = creds.WOOCOMMERCE_KEY || creds.WOO_CONSUMER_KEY;
      const wooSecret = creds.WOOCOMMERCE_SECRET || creds.WOO_CONSUMER_SECRET;

      if (wooUrl && wooKey && wooSecret) {
        try {
          // Clean order ID (remove # if present)
          const cleanOrderId = orderId.replace('#', '');

          const order = await woocommerceRequest(wooUrl, wooKey, wooSecret, `/wp-json/wc/v3/orders/${cleanOrderId}`);

          // BL7 fix: Email REQUIRED for WooCommerce too (prevents order enumeration)
          if (!email) {
            return { found: false, message: 'Veuillez fournir votre email pour vérifier la commande.' };
          }
          if (order.billing?.email && order.billing.email.toLowerCase() !== email.toLowerCase()) {
            console.warn(`[VoiceEcom] Email mismatch for WooCommerce order ${orderId}`);
            return { found: false, message: 'Cette commande ne correspond pas à votre email.' };
          }

          const statusMessage = getVoiceFriendlyStatus(order.status, null, 'woocommerce');

          return {
            found: true,
            source: 'woocommerce',
            orderId: `#${order.id}`,
            status: order.status,
            statusMessage: `Votre commande #${order.id} est ${statusMessage}.`,
            total: `${order.total} ${order.currency}`,
            createdAt: order.date_created,
            tracking: null // WooCommerce tracking depends on plugins
          };
        } catch (wooError) {
          console.warn(`[VoiceEcom] WooCommerce lookup failed: ${wooError.message}`);
        }
      }

      // No e-commerce credentials configured
      if (!shopifyStore && !wooUrl) {
        return {
          found: false,
          reason: 'no_credentials',
          message: "Le suivi de commande n'est pas encore configuré pour ce marchand."
        };
      }

      return { found: false, message: 'Commande introuvable. Veuillez vérifier le numéro de commande.' };

    } catch (error) {
      console.error('[VoiceEcom] Order check failed:', error);
      return { found: false, error: error.message };
    }
  },

  /**
   * Check product availability (Real Logic via CatalogConnector)
   */
  checkStock: async (productName, tenantId) => {
    try {
      console.log(`[VoiceEcom] Searching stock for: ${productName}`);

      const connector = await getConnector(tenantId);
      const products = await connector.search(productName, { limit: 1 });

      if (products && products.length > 0) {
        const product = products[0];
        return {
          found: true,
          name: product.name,
          price: product.price,
          inStock: product.in_stock !== false,
          stockLevel: product.stock || 'unknown',
          description: product.voice_description || product.description
        };
      }

      return { found: false };
    } catch (error) {
      console.error('[VoiceEcom] Stock check failed:', error);
      return { found: false, error: error.message };
    }
  },

  /**
   * Recommend products based on context
   */
  recommendProducts: async (category, tenantId) => {
    try {
      const connector = await getConnector(tenantId);
      const products = await connector.search(category, { limit: 3 });
      return products.map(p => ({
        name: p.name,
        price: p.price,
        id: p.id
      }));
    } catch (error) {
      return [];
    }
  },

  /**
   * Get order history for customer (last 5 orders)
   */
  getOrderHistory: async (email, tenantId) => {
    try {
      const creds = await SecretVault.loadCredentials(tenantId);

      // Shopify
      const shopifyStore = creds.SHOPIFY_STORE || creds.SHOPIFY_SHOP_NAME;
      const shopifyToken = creds.SHOPIFY_ACCESS_TOKEN || creds.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (shopifyStore && shopifyToken) {
        try {
          const store = shopifyStore.replace('.myshopify.com', '');
          const query = `
            query getCustomerOrders($query: String!) {
              orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    name
                    displayFulfillmentStatus
                    totalPriceSet { shopMoney { amount currencyCode } }
                    createdAt
                  }
                }
              }
            }
          `;

          const response = await shopifyGraphQL(store, shopifyToken, query, { query: `email:${email}` });
          const orders = response?.orders?.edges?.map(e => ({
            orderId: e.node.name,
            status: e.node.displayFulfillmentStatus,
            total: `${e.node.totalPriceSet.shopMoney.amount} ${e.node.totalPriceSet.shopMoney.currencyCode}`,
            date: e.node.createdAt
          })) || [];

          return { found: orders.length > 0, source: 'shopify', orders };
        } catch (e) {
          console.warn(`[VoiceEcom] Shopify order history failed: ${e.message}`);
        }
      }

      return { found: false, orders: [] };
    } catch (error) {
      console.error('[VoiceEcom] Order history failed:', error);
      return { found: false, orders: [], error: error.message };
    }
  }
};
